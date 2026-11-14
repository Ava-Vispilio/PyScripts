import { newGame, SPEEDS, step, type Game } from "./game";

/**
 * The loop-URL codec: the contract the TUI hands to the browser. No shared
 * process state crosses shells — just this string on the end of the page URL.
 */
export type Parts = {
  videoId: string;
  window: [number, number] | null;
  speed: number;
  mode: "full" | "snippet";
};

const ID = /^[\w-]{11}$/;

const num = (text: string | null): number | null => {
  if (text === null || !/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};

export function encode(state: Game): string {
  const [s = 0, e = 0] = state.window ?? [];
  return `v=${state.videoId ?? ""}&s=${s}&e=${e}&z=${state.speed}&m=${state.mode}`;
}

export function decode(hash: string): Parts | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const v = params.get("v");
  if (!v || !ID.test(v)) return null;
  const s = num(params.get("s"));
  const e = num(params.get("e"));
  const window = s !== null && e !== null && s >= 0 && s < e ? ([s, e] as [number, number]) : null;
  const z = num(params.get("z"));
  const speed = z !== null && SPEEDS.includes(z as (typeof SPEEDS)[number]) ? z : 1;
  const mode = params.get("m") === "snippet" && window ? "snippet" : "full";
  return { videoId: v, window, speed, mode };
}

/** Rebuild a loaded game from shared parts, purely through engine actions. */
export function open(parts: Parts): Game {
  let game = newGame();
  for (const ch of `https://youtu.be/${parts.videoId}`) game = step(game, { type: "type", ch });
  game = step(game, { type: "accept" });
  game = step(game, { type: "titled", title: parts.videoId });
  if (parts.window) {
    game = step(game, { type: "focus", field: "start" });
    for (const ch of String(parts.window[0])) game = step(game, { type: "type", ch });
    game = step(game, { type: "focus", field: "end" });
    for (const ch of String(parts.window[1])) game = step(game, { type: "type", ch });
    game = step(game, { type: "accept" });
  }
  const target = SPEEDS.indexOf(parts.speed as (typeof SPEEDS)[number]);
  const base = SPEEDS.indexOf(1);
  for (let i = 0; i < Math.abs(target - base); i++)
    game = step(game, { type: target > base ? "faster" : "slower" });
  if (parts.mode === "full" && game.mode === "snippet") game = step(game, { type: "toggleMode" });
  return game;
}

export function composeUrl(state: Game, base: string): string {
  return `${base}#${encode(state)}`;
}
