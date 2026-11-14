import { newGame, nudgeSpot, stage, step, type Action, type Game } from "./game";
import { composeUrl } from "./share";
import { ansi } from "./text";

const PRINTABLE = /^[\x20-\x7e]$/;
const DIGIT = /^[\d.]$/;

type Key =
  | { kind: "arrow"; dir: "up" | "down" }
  | { kind: "enter" }
  | { kind: "restart" }
  | { kind: "quit" }
  | { kind: "backspace" }
  | { kind: "char"; ch: string };

export function keyOf(press: string, focus: Game["focus"]): Key | null {
  if (press === "\x1b[A") return { kind: "arrow", dir: "up" };
  if (press === "\x1b[B") return { kind: "arrow", dir: "down" };
  if (press === "\r" || press === "\n") return { kind: "enter" };
  if (press === "\x7f" || press === "\b") return { kind: "backspace" };
  if (press === "\x1b") return { kind: "restart" };
  if (press === "\x03") return { kind: "quit" };
  // Up and down walk the spots; left and right do nothing. Typing follows the
  // spot: the URL takes every printable, the time fields take digits and a
  // dot, and the chips take nothing at all.
  if (focus === "url") return PRINTABLE.test(press) ? { kind: "char", ch: press } : null;
  if (focus === "start" || focus === "end") return DIGIT.test(press) ? { kind: "char", ch: press } : null;
  return null;
}

/** The terminal hands us whatever arrived, so a fast arrow-plus-Enter is one chunk. */
export function pressesOf(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\x1b" && text.charAt(i + 1) === "[" && text.charAt(i + 2) >= "A" && text.charAt(i + 2) <= "D") {
      out.push(text.slice(i, i + 3));
      i += 3;
    } else {
      out.push(text.charAt(i));
      i += 1;
    }
  }
  return out;
}

const PAGE_BASE = process.env.LOOP_SONG_PAGE ?? "https://ava-vispilio.github.io/PyScripts/Loop_Song/";

if (import.meta.main) {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  let game: Game = stage(process.argv[2] ?? "") ?? newGame();
  const paint = () => process.stdout.write(ansi(game));

  function act(action: Action) {
    game = step(game, action);
    paint();
  }

  /**
   * The engine never fetches: the title check is one keyless GET sent back in
   * as an action, with a fire-time guard so a stale reply is harmless. Offline
   * and private videos fall back to the raw videoId; only a real 404 is not
   * found.
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

  /** Compose the loop URL and hand it to the OS opener. The page is the player. */
  function launch() {
    if (process.env.LOOP_SONG_OPEN === "0") return;
    const url = composeUrl(game, PAGE_BASE);
    const cmd =
      process.platform === "darwin"
        ? ["open", url]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", "", url]
          : ["xdg-open", url];
    try {
      Bun.spawnSync(cmd, { stdout: "ignore", stderr: "ignore" });
    } catch {
      // no opener on this machine: the composed URL still shows in the status
    }
  }

  /** Enter on the play chip arms or disarms; only the arming edge opens the browser. */
  function play() {
    const wasArmed = game.armed;
    act({ type: "accept" });
    if (!wasArmed && game.armed) launch();
  }

  function enter() {
    act({ type: "accept" });
    if (game.load === "checking") void check();
  }

  paint();
  if (game.load === "checking") void check();

  stdin.on("data", (buf) => {
    for (const press of pressesOf(buf.toString("utf8"))) {
      const key = keyOf(press, game.focus);
      if (!key) continue;
      if (key.kind === "quit") {
        stdin.setRawMode(false);
        process.exit(0);
      }
      if (key.kind === "arrow") act({ type: "focus", spot: nudgeSpot(game.focus, key.dir === "down" ? 1 : -1) });
      else if (key.kind === "enter") {
        if (game.focus === "play") play();
        else enter();
      } else if (key.kind === "restart") act({ type: "restart" });
      else if (key.kind === "backspace") act({ type: "backspace" });
      else act({ type: "type", ch: key.ch });
    }
  });
}
