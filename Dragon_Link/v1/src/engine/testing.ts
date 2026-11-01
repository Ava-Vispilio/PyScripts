import type { Rng } from "./chance";
import type { Game } from "./game";
import { BET_COINS, coins, type OrbFace } from "./paytable";
import { frames } from "./screen";
import {
  isLead,
  isLeadOrDoor,
  isSym,
  isSymOrDoor,
  type CellRef,
  type Col,
  type DoorFace,
  type Reel,
  type Row,
  type Window,
} from "./symbols";

export type Script = {
  readonly base?: readonly Window[];
  readonly free?: readonly Window<"DOOR">[];
  readonly doors?: readonly DoorFace[];
  readonly respins?: readonly (readonly CellRef[])[];
  readonly orbs?: readonly OrbFace[];
};

/** An Rng that plays back cabinet outcomes in order and throws when step asks for something unscripted or illegal. */
export function rigged(script: Script): Rng {
  const queue = <T>(name: keyof Script, items: readonly T[] = []) => {
    const left = [...items];
    return (): T => {
      const next = left.shift();
      if (next === undefined) throw new Error(`script ran out: ${name}`);
      return next;
    };
  };
  const base = queue("base", script.base);
  const free = queue("free", script.free);
  const door = queue("doors", script.doors);
  const respin = queue("respins", script.respins);
  const orb = queue("orbs", script.orbs);
  return {
    base,
    free,
    door,
    respin: (open) => {
      const landed = respin();
      for (const [reel, row] of landed)
        if (!open.some(([r, w]) => r === reel && w === row)) throw new Error(`respin cell ${reel},${row} is not open`);
      return landed;
    },
    orb: (allow) => {
      const face = orb();
      if (face.kind === "MAJOR" && !allow.major) throw new Error("a second MAJOR on the board");
      return face;
    },
  };
}

function parse<L extends string, S extends string>(
  text: string,
  lead: (s: string) => s is L,
  rest: (s: string) => s is S,
): readonly [Col<L>, Col<S>, Col<S>, Col<S>, Col<S>] {
  const rows = text
    .trim()
    .split(/\s*[/\n]\s*/)
    .map((row) => row.split(/\s+/));
  if (rows.length !== 3 || rows.some((row) => row.length !== 5)) throw new Error(`a window is 3 rows of 5: ${text}`);
  const col = <T extends string>(reel: Reel, is: (s: string) => s is T): Col<T> => {
    const cell = (row: Row): T => {
      const s = rows[row]?.[reel] ?? "";
      if (!is(s)) throw new Error(`${s} cannot land on reel ${reel}`);
      return s;
    };
    return [cell(0), cell(1), cell(2)];
  };
  return [col(0, lead), col(1, rest), col(2, rest), col(3, rest), col(4, rest)];
}

/** A base window, written row by row. Rows split on "/" or newline. */
export const window = (text: string): Window => parse(text, isLead, isSym);
/** A free-game window that may show DOOR cells. */
export const doors = (text: string): Window<"DOOR"> => parse(text, isLeadOrDoor, isSymOrDoor);
/** A credit orb worth `timesBet` total bets. */
export const credit = (timesBet: number): OrbFace => ({ kind: "credit", coins: coins(timesBet * BET_COINS) });

/** Labels of the settled screen, row-major. */
export function labels(game: Game): string[][] {
  const shown = frames(game);
  let last = shown[0];
  for (const screen of shown) last = screen;
  return last.rows.map((row) => row.map((tile) => tile.label));
}
