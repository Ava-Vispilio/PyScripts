import { newGame, nudgeField, stage, step, type Action, type Dir, type Game } from "./game";
import { decode, open } from "./share";
import { backOf, markup, statusOf, barOf } from "./text";

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
const bar = need("#status");
const back = need("#back");

let game = opened();
let player: Player | null = null;
let playerReady = false;
let apiReady = false;
let loadedId: string | null = null;
let lastSpeed = 1;

const ARROWS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

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
  bar.textContent = statusOf(game);
  bar.className = barOf(game);
  back.textContent = backOf(game);
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

/** The loop row becomes the live bar here: track, snippet window, played span, playhead. */
function drawLoop(t: number, d: number) {
  const loopEl = document.querySelector("[data-loop]");
  if (!(loopEl instanceof HTMLElement)) return;
  const n = 37;
  const chars: string[] = Array<string>(n).fill("·");
  const frac = (x: number) => (d > 0 ? Math.max(0, Math.min(1, x / d)) : 0);
  if (game.mode === "snippet" && game.window) {
    const a = Math.round(frac(game.window[0]) * n);
    const b = Math.round(frac(game.window[1]) * n);
    for (let i = a; i < b; i++) chars[i] = "▒";
  }
  const played = Math.min(n, Math.round(frac(t) * n));
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

function play() {
  if (game.load !== "loaded") return;
  act({ type: "arm" });
  if (player && playerReady) {
    if (player.getPlayerState() === 1) player.pauseVideo();
    else player.playVideo();
  }
}

draw();

const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);
(window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = () => {
  apiReady = true;
  syncPlayer();
};

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const dir = ARROWS[event.key];
  if (dir) {
    event.preventDefault();
    act({ type: "focus", field: nudgeField(game.focus, dir === "down" || dir === "right" ? 1 : -1) });
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    act({ type: "accept" });
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
  // The URL field types every printable; the letter commands live in the time
  // fields, matching the terminal shell's key map.
  if (game.focus === "url") {
    if (event.key.length === 1) {
      event.preventDefault();
      act({ type: "type", ch: event.key });
    }
    return;
  }
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    act({ type: "restart" });
    return;
  }
  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    play();
    return;
  }
  if (event.key === "m" || event.key === "M") {
    event.preventDefault();
    act({ type: "toggleMode" });
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    act({ type: "faster" });
    return;
  }
  if (event.key === "-") {
    event.preventDefault();
    act({ type: "slower" });
    return;
  }
  if (event.key.length === 1) {
    event.preventDefault();
    act({ type: "type", ch: event.key });
  }
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const field = event.target.closest("[data-field]");
  if (field instanceof HTMLElement) {
    act({ type: "focus", field: field.dataset.field as typeof game.focus });
    return;
  }
  if (event.target.closest("[data-load]")) {
    act({ type: "focus", field: "url" });
    act({ type: "accept" });
    return;
  }
  if (event.target.closest("[data-snip]")) {
    act({ type: "focus", field: "end" });
    act({ type: "accept" });
    return;
  }
  const speed = event.target.closest("[data-speed]");
  if (speed instanceof HTMLElement) {
    act({ type: speed.dataset.speed === "+" ? "faster" : "slower" });
    return;
  }
  if (event.target.closest("[data-play]")) {
    play();
    return;
  }
  if (event.target.closest("[data-mode]")) act({ type: "toggleMode" });
});

(window as unknown as { loopState: (name: string) => void }).loopState = (name) => {
  const next = stage(name);
  if (!next) return;
  game = next;
  draw();
  syncPlayer();
};
