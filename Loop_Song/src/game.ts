export type Field = "url" | "start" | "end";
export type Load = "idle" | "checking" | "loaded" | "notFound" | "badLink";
export type Snip = "empty" | "bad" | "set";
export type Mode = "full" | "snippet";

/**
 * The state is the whole screen: which field the caret sits on, the URL draft,
 * the load pipeline, the video, the snippet drafts and their confirmed window,
 * the speed, the loop mode, and whether the player has been launched.
 */
export type Game = {
  focus: Field;
  url: string;
  load: Load;
  videoId: string | null;
  title: string | null;
  start: string;
  end: string;
  snip: Snip;
  window: [number, number] | null;
  speed: number;
  mode: Mode;
  armed: boolean;
};

/**
 * `type` and `backspace` carry data — the sanctioned exception for typing
 * screens. Everything else is data-free, and the engine stays pure: it never
 * fetches and never sleeps. The shells own the oEmbed check and the timer.
 */
export type Action =
  | { type: "type"; ch: string }
  | { type: "backspace" }
  | { type: "focus"; field: Field }
  | { type: "accept" }
  | { type: "titled"; title: string }
  | { type: "notFound" }
  | { type: "faster" }
  | { type: "slower" }
  | { type: "toggleMode" }
  | { type: "arm" }
  | { type: "restart" };

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

const PRINTABLE = /^[\x20-\x7e]$/;
const TIME = /^\d+(\.\d+)?$/;

export function newGame(): Game {
  return {
    focus: "url",
    url: "",
    load: "idle",
    videoId: null,
    title: null,
    start: "",
    end: "",
    snip: "empty",
    window: null,
    speed: 1,
    mode: "full",
    armed: false,
  };
}

/** Pull the 11-character video id out of the link shapes YouTube hands around. */
export function videoIdOf(text: string): string | null {
  const t = text.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const short = /youtu\.be\/([\w-]{11})/.exec(t);
  if (short) return short[1]!;
  const path = /youtube\.com\/(?:shorts|embed|live)\/([\w-]{11})/.exec(t);
  if (path) return path[1]!;
  const watch = /youtube\.com\/watch\?(?:[^#\s]*&)?v=([\w-]{11})/.exec(t);
  if (watch) return watch[1]!;
  return null;
}

/** Move between the three fields on a torus, so every arrow lands somewhere. */
export function nudgeField(field: Field, dir: 1 | -1): Field {
  const FIELDS: Field[] = ["url", "start", "end"];
  const n = FIELDS.length;
  return FIELDS[(FIELDS.indexOf(field) + dir + n) % n]!;
}

/** Step through YouTube's playback speeds, clamped at both ends. */
export function nudgeSpeed(speed: number, dir: 1 | -1): number {
  const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
  if (i === -1) return 1;
  return SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + dir))]!;
}

const parseTime = (text: string): number | null => {
  const t = text.trim();
  if (!TIME.test(t)) return null;
  return Number(t);
};

/** Editing a draft clears what the old draft had confirmed: bad links go idle, set snippets unset. */
function edit(game: Game, action: { type: "type"; ch: string } | { type: "backspace" }): Game {
  const base: Partial<Game> = {};
  if (game.focus === "url") {
    if (game.load === "badLink" || game.load === "notFound") base.load = "idle";
  } else if (game.snip !== "empty") {
    base.snip = "empty";
    base.window = null;
    base.mode = "full";
  }
  const draft = game.focus === "url" ? game.url : game.focus === "start" ? game.start : game.end;
  const next =
    action.type === "type" ? (PRINTABLE.test(action.ch) ? draft + action.ch : draft) : draft.slice(0, -1);
  if (game.focus === "url") base.url = next;
  else if (game.focus === "start") base.start = next;
  else base.end = next;
  return { ...game, ...base };
}

/** Enter on the URL loads it; Enter on a time pair confirms the snippet. Both need a settled draft. */
function accept(game: Game): Game {
  if (game.focus === "url") {
    if (game.load === "checking" || game.url.trim() === "") return game;
    const id = videoIdOf(game.url);
    const cleared = { videoId: id, title: null, window: null, snip: "empty" as Snip, mode: "full" as Mode, armed: false };
    if (!id) return { ...game, load: "badLink", ...cleared };
    return { ...game, load: "checking", ...cleared };
  }
  if (game.load !== "loaded") return game;
  const start = parseTime(game.start);
  const end = parseTime(game.end);
  if (start === null || end === null || start < 0 || start >= end) return { ...game, snip: "bad", window: null };
  return { ...game, snip: "set", window: [start, end], mode: "snippet" };
}

export function step(game: Game, action: Action): Game {
  if (action.type === "restart") return newGame();
  if (action.type === "focus") return { ...game, focus: action.field };
  if (action.type === "type" || action.type === "backspace") {
    if (game.load === "checking") return game;
    return edit(game, action);
  }
  if (action.type === "accept") return accept(game);
  if (action.type === "titled") {
    if (action.title === "") return game;
    if (game.load === "checking") return { ...game, load: "loaded", title: action.title };
    if (game.load === "loaded") return { ...game, title: action.title };
    return game;
  }
  if (action.type === "notFound") {
    if (game.load !== "checking") return game;
    return { ...game, load: "notFound", videoId: null };
  }
  if (action.type === "faster" || action.type === "slower")
    return { ...game, speed: nudgeSpeed(game.speed, action.type === "faster" ? 1 : -1) };
  if (action.type === "toggleMode") {
    if (game.mode === "full") return game.window ? { ...game, mode: "snippet" } : game;
    return { ...game, mode: "full" };
  }
  if (action.type === "arm") return game.load === "loaded" ? { ...game, armed: true } : game;
  return game;
}

const typeAll = (game: Game, text: string): Game =>
  [...text].reduce((g, ch) => step(g, { type: "type", ch }), game);

/** A game for a named situation. Used by the page query `state`, the tests, and the shells. */
export function stage(name: string): Game | null {
  if (name === "" || name === "empty") return newGame();
  const loadUrl = (url: string): Game => step(typeAll(newGame(), url), { type: "accept" });
  if (name === "checking") return loadUrl("https://youtu.be/dQw4w9WgXcQ");
  if (name === "loaded") return step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "titled", title: "Test Video" });
  if (name === "snippet") {
    let game = step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "titled", title: "Test Video" });
    game = typeAll(step(game, { type: "focus", field: "start" }), "12");
    game = typeAll(step(game, { type: "focus", field: "end" }), "18");
    return step(game, { type: "accept" });
  }
  if (name === "bad") return loadUrl("not a link");
  if (name === "notfound") return step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "notFound" });
  if (name === "badtimes") {
    let game = step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "titled", title: "Test Video" });
    game = typeAll(step(game, { type: "focus", field: "start" }), "18");
    game = typeAll(step(game, { type: "focus", field: "end" }), "12");
    return step(game, { type: "accept" });
  }
  return null;
}
