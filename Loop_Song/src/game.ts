export type Spot = "url" | "start" | "end" | "play" | "speed" | "mode";
export type Load = "idle" | "checking" | "loaded" | "notFound" | "badLink";
export type Snip = "empty" | "bad" | "set";
export type Mode = "full" | "snippet";

/**
 * The state is the whole screen: which spot the caret sits on, the URL draft
 * and its seal, the load pipeline, the video, the snippet drafts and their
 * confirmed window, the speed, the loop mode, and whether the player is armed.
 */
export type Game = {
  focus: Spot;
  url: string;
  urlLocked: boolean;
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
 * Enter drives every control through `accept` on the focused spot.
 */
export type Action =
  | { type: "type"; ch: string }
  | { type: "backspace" }
  | { type: "focus"; spot: Spot }
  | { type: "accept" }
  | { type: "titled"; title: string }
  | { type: "notFound" }
  | { type: "restart" };

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Arrow directions as the shells see them, before they map to the spot ring. */
export type Dir = "up" | "down" | "left" | "right";

const PRINTABLE = /^[\x20-\x7e]$/;
const TIME = /^\d+(\.\d+)?$/;

export function newGame(): Game {
  return {
    focus: "url",
    url: "",
    urlLocked: false,
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

/** The sections in screen order: the URL, the chip row, the time pair. */
const SECTIONS: Spot[][] = [["url"], ["play", "speed", "mode"], ["start", "end"]];

/**
 * While the loop plays the full video on purpose — a confirmed window kept,
 * the mode toggled back — the time pair sits out of the walk: it has nothing
 * to say. The mode chip is the way back in.
 */
export const timesSealed = (game: Game): boolean => game.mode === "full" && game.window !== null;

const sectionsOf = (game: Game): Spot[][] => (timesSealed(game) ? SECTIONS.slice(0, 2) : SECTIONS);

/**
 * Up and down jump between sections on a torus, so every arrow lands somewhere.
 * Down lands on the next section's first spot, up on the previous section's
 * last. Locked sections stay reachable: their Enter is the unlock. A sealed
 * time pair leaves the walk entirely; the toggle back to the snippet returns it.
 */
export function nudgeSpot(game: Game, dir: 1 | -1): Spot {
  const sections = sectionsOf(game);
  const si = sections.findIndex((section) => section.includes(game.focus));
  if (si === -1) return "url";
  const n = sections.length;
  const next = sections[(si + dir + n) % n]!;
  return dir === 1 ? next[0]! : next[next.length - 1]!;
}

/** Left and right walk a torus within the section; the URL stands alone. */
export function nudgeSide(spot: Spot, dir: 1 | -1): Spot {
  const section = SECTIONS.find((spots) => spots.includes(spot))!;
  if (section.length < 2) return spot;
  const n = section.length;
  return section[(section.indexOf(spot) + dir + n) % n]!;
}

/** Cycle through YouTube's playback speeds, wrapping at both ends. */
export function cycleSpeed(speed: number): number {
  const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
  if (i === -1) return 1;
  return SPEEDS[(i + 1) % SPEEDS.length]!;
}

const parseTime = (text: string): number | null => {
  const t = text.trim();
  if (!TIME.test(t)) return null;
  return Number(t);
};

/**
 * Typing follows the locks: a sealed URL and confirmed times refuse the keys,
 * the display-only spots never type, and a bad link or bad pair returns to
 * neutral as soon as the draft is edited.
 */
function edit(game: Game, action: { type: "type"; ch: string } | { type: "backspace" }): Game {
  if (game.focus === "play" || game.focus === "speed" || game.focus === "mode") return game;
  if (game.focus === "url" && game.urlLocked) return game;
  if (game.focus !== "url" && game.snip === "set") return game;
  const base: Partial<Game> = {};
  if (game.focus === "url") {
    if (game.load === "badLink" || game.load === "notFound") base.load = "idle";
  } else if (game.snip === "bad") {
    base.snip = "empty";
  }
  const draft = game.focus === "url" ? game.url : game.focus === "start" ? game.start : game.end;
  const next =
    action.type === "type" ? (PRINTABLE.test(action.ch) ? draft + action.ch : draft) : draft.slice(0, -1);
  if (game.focus === "url") base.url = next;
  else if (game.focus === "start") base.start = next;
  else base.end = next;
  return { ...game, ...base };
}

/**
 * Enter acts on the focused spot: load or unlock the URL, confirm or unlock
 * the times (hopping to the missing field while the pair is half-typed),
 * toggle play, cycle speed or mode.
 */
function accept(game: Game): Game {
  if (game.focus === "url") {
    if (game.load === "checking") return game;
    if (game.urlLocked) return { ...game, urlLocked: false };
    if (game.url.trim() === "") return game;
    const id = videoIdOf(game.url);
    const cleared = { videoId: id, title: null, window: null, snip: "empty" as Snip, mode: "full" as Mode, armed: false };
    if (!id) return { ...game, load: "badLink", urlLocked: false, ...cleared };
    // A good link seals the URL and hands the caret to the snippet fields.
    return { ...game, load: "checking", urlLocked: true, ...cleared, focus: "start" };
  }
  if (game.focus === "start" || game.focus === "end") {
    // Enter means "next" until the pair is whole: the caret hops to the
    // missing field instead of failing on a half-typed window.
    if (game.snip !== "set") {
      if (game.start.trim() === "" && game.end.trim() === "") return game;
      if (game.start.trim() === "") return { ...game, focus: "start" };
      if (game.end.trim() === "") return { ...game, focus: "end" };
    }
    if (game.load !== "loaded") return game;
    if (game.snip === "set") return { ...game, snip: "empty" };
    const start = parseTime(game.start);
    const end = parseTime(game.end);
    if (start === null || end === null || start < 0 || start >= end)
      return { ...game, snip: "bad", window: null, mode: "full" };
    return { ...game, snip: "set", window: [start, end], mode: "snippet" };
  }
  if (game.focus === "play") return game.load === "loaded" ? { ...game, armed: !game.armed } : game;
  if (game.focus === "speed") return { ...game, speed: cycleSpeed(game.speed) };
  if (game.mode === "full") return game.window ? { ...game, mode: "snippet" } : game;
  return { ...game, mode: "full" };
}

export function step(game: Game, action: Action): Game {
  if (action.type === "restart") return newGame();
  if (action.type === "focus") {
    // A sealed pair is off the walk, so it refuses the caret as well.
    if (timesSealed(game) && (action.spot === "start" || action.spot === "end")) return game;
    return { ...game, focus: action.spot };
  }
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
  const withTimes = (start: string, end: string): Game => {
    let game = step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "titled", title: "Test Video" });
    game = typeAll(step(game, { type: "focus", spot: "start" }), start);
    game = typeAll(step(game, { type: "focus", spot: "end" }), end);
    return step(game, { type: "accept" });
  };
  if (name === "snippet") return withTimes("12", "18");
  if (name === "fullloop")
    return step(step(withTimes("12", "18"), { type: "focus", spot: "mode" }), { type: "accept" });
  if (name === "bad") return loadUrl("not a link");
  if (name === "notfound") return step(loadUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "notFound" });
  if (name === "badtimes") return withTimes("18", "12");
  return null;
}
