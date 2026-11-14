import { newGame, nudgeSide, nudgeSpot, stage, step, timesSealed, type Action, type Game } from "./game";
import { decode, open } from "./share";
import { backOf, markup } from "./text";

/** The slice of the IFrame API the page uses, declared by hand: no dependency, no types package. */
type Player = {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { title?: string };
  loadVideoById(id: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
};

type YT = { Player: new (el: HTMLElement | string, options: Record<string, unknown>) => Player };

function need(id: string): HTMLElement {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement)) throw new Error("missing page");
  return el;
}

const board = need("#screen");
const back = need("#back");

let game = opened();
let player: Player | null = null;
let playerReady = false;
let apiReady = false;
let loadedId: string | null = null;
let lastSpeed = 1;

function opened(): Game {
  const name = new URLSearchParams(location.search).get("state");
  if (name && stage(name)) return stage(name)!;
  if (location.hash) {
    const parts = decode(location.hash);
    if (parts) return open(parts);
  }
  return newGame();
}

function draw() {
  board.innerHTML = markup(game);
  back.textContent = backOf;
}

function act(action: Action) {
  game = step(game, action);
  if (action.type === "restart" && player && playerReady) player.pauseVideo();
  draw();
  syncPlayer();
}

/** The page is the player: a loaded video gets an iframe as soon as the API allows it. */
function syncPlayer() {
  if (game.load !== "loaded" || !game.videoId || !apiReady) return;
  const yt = (window as unknown as { YT?: YT }).YT;
  if (!yt) return;
  if (!player) {
    player = new yt.Player("player", {
      videoId: game.videoId,
      playerVars: {
        playsinline: 1,
        ...(location.protocol === "http:" || location.protocol === "https:" ? { origin: location.origin } : {}),
      },
      events: {
        onReady: () => {
          // The widget API attaches its methods only once the iframe has
          // shaken hands, so nothing may touch the player before this fires.
          playerReady = true;
          applySettings();
        },
      },
    });
    loadedId = game.videoId;
    return;
  }
  if (!playerReady) return;
  if (game.videoId !== loadedId) {
    loadedId = game.videoId;
    player.loadVideoById(game.videoId);
    applySettings();
  }
  if (game.speed !== lastSpeed) {
    lastSpeed = game.speed;
    player.setPlaybackRate(game.speed);
  }
}

function applySettings() {
  if (!player) return;
  lastSpeed = game.speed;
  player.setPlaybackRate(game.speed);
  if (game.mode === "snippet" && game.window) player.seekTo(game.window[0], true);
  else player.seekTo(0, true);
}

/**
 * The typed-URL path needs its own title check: the hash path settles through
 * `open()`, but a URL keyed into the page stops at "checking" unless the page
 * fetches oEmbed itself, exactly like the terminal shell.
 */
async function check() {
  const id = game.videoId;
  if (game.load !== "checking" || !id) return;
  const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
  let action: Action = { type: "titled", title: id };
  try {
    const res = await fetch(target);
    if (res.status === 404) action = { type: "notFound" };
    else if (res.ok) {
      const data = (await res.json()) as { title?: unknown };
      if (typeof data.title === "string" && data.title) action = { type: "titled", title: data.title };
    }
  } catch {
    // offline: keep the videoId fallback
  }
  if (game.load === "checking" && game.videoId === id) act(action);
}

/**
 * The loop row becomes the live bar here: a track with the played span and the
 * playhead pip. In snippet mode the bar spans the window only — zoomed in, so
 * a short loop moves as fast as it feels.
 */
function drawLoop(t: number, d: number) {
  const loopEl = document.querySelector("[data-loop]");
  if (!(loopEl instanceof HTMLElement)) return;
  const n = 37;
  const chars: string[] = Array<string>(n).fill("·");
  let frac: number;
  if (game.mode === "snippet" && game.window) {
    const span = Math.max(0.05, game.window[1] - game.window[0]);
    frac = Math.max(0, Math.min(1, (t - game.window[0]) / span));
  } else {
    frac = d > 0 ? Math.max(0, Math.min(1, t / d)) : 0;
  }
  const played = Math.min(n, Math.round(frac * n));
  for (let i = 0; i < played; i++) chars[i] = "█";
  if (played < n) chars[played] = "▌";
  loopEl.textContent = `[${chars.join("")}]`;
}

/** Seek back at the loop edge; the engine stays pure and knows nothing of time. */
setInterval(() => {
  if (!player || !playerReady || game.load !== "loaded") return;
  const t = player.getCurrentTime();
  const d = player.getDuration();
  if (game.mode === "snippet" && game.window) {
    if (t >= game.window[1] - 0.05) player.seekTo(game.window[0], true);
  } else if (d > 0 && t >= d - 0.05) {
    player.seekTo(0, true);
  }
  drawLoop(t, d);
  // getVideoData runs empty at first, so the real name arrives here once
  // the embed has it — and again after a switch to another video.
  const title = player.getVideoData().title;
  if (title && title !== game.title) act({ type: "titled", title });
}, 250);

/** Enter or click on the play chip toggles the player, mirroring the armed flag. */
function play() {
  if (game.load !== "loaded") return;
  act({ type: "accept" });
  if (player && playerReady) {
    if (player.getPlayerState() === 1) player.pauseVideo();
    else player.playVideo();
  }
}

/** Enter off the play chip acts on the focused spot, and a live check gets its fetch. */
function enter() {
  act({ type: "accept" });
  if (game.load === "checking") void check();
}

draw();

const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);
(window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = () => {
  apiReady = true;
  syncPlayer();
};

const DIGIT = /^[\d.]$/;

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    act({ type: "focus", spot: nudgeSpot(game, event.key === "ArrowDown" ? 1 : -1) });
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    act({ type: "focus", spot: nudgeSide(game.focus, event.key === "ArrowRight" ? 1 : -1) });
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (game.focus === "play") play();
    else enter();
    return;
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    act({ type: "backspace" });
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    act({ type: "restart" });
    return;
  }
  // Typing follows the spot, matching the terminal shell's key map: the URL
  // takes every printable, the time fields take digits and a dot, the chips
  // take nothing.
  if (game.focus === "url" && event.key.length === 1) {
    event.preventDefault();
    act({ type: "type", ch: event.key });
    return;
  }
  if ((game.focus === "start" || game.focus === "end") && DIGIT.test(event.key)) {
    event.preventDefault();
    act({ type: "type", ch: event.key });
  }
});

/** Clicks land as focus first, then the same Enter the keyboard would send. */
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const field = event.target.closest("[data-field]");
  if (field instanceof HTMLElement) {
    act({ type: "focus", spot: field.dataset.field as typeof game.focus });
    return;
  }
  if (event.target.closest("[data-load]")) {
    act({ type: "focus", spot: "url" });
    enter();
    return;
  }
  if (event.target.closest("[data-snip]")) {
    // While the pair is sealed the button is the way back to the snippet, so
    // the click lands on the mode chip instead of the unreachable fields.
    act({ type: "focus", spot: timesSealed(game) ? "mode" : "end" });
    act({ type: "accept" });
    return;
  }
  if (event.target.closest("[data-play]")) {
    act({ type: "focus", spot: "play" });
    play();
    return;
  }
  if (event.target.closest("[data-speed]")) {
    act({ type: "focus", spot: "speed" });
    act({ type: "accept" });
    return;
  }
  if (event.target.closest("[data-mode]")) {
    act({ type: "focus", spot: "mode" });
    act({ type: "accept" });
  }
});

(window as unknown as { loopState: (name: string) => void }).loopState = (name) => {
  const next = stage(name);
  if (!next) return;
  game = next;
  draw();
  syncPlayer();
};
