export const PAYING = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN"] as const;
export type Paying = (typeof PAYING)[number];
export type Sym = Paying | "WILD" | "MOON" | "ORB";
/** Anything that may land on reel 0. */
export type Lead = Exclude<Sym, "WILD">;
/** What a mystery door can open onto. Never WILD, never MOON. */
export type DoorFace = Paying | "ORB";

export const REELS = [0, 1, 2, 3, 4] as const;
export const ROWS = [0, 1, 2] as const;
export type Reel = (typeof REELS)[number];
export type Row = (typeof ROWS)[number];
export type CellRef = readonly [reel: Reel, row: Row];

export type Col<T> = readonly [T, T, T];
/** Column-major 5x3. Index by reel, then row. */
export type Grid<T> = readonly [Col<T>, Col<T>, Col<T>, Col<T>, Col<T>];

/** A landed reel window. D is "DOOR" on free spins and never on base spins. */
export type Window<D extends "DOOR" = never> = readonly [
  Col<Lead | D>,
  Col<Sym | D>,
  Col<Sym | D>,
  Col<Sym | D>,
  Col<Sym | D>,
];

/** Calls `cell` in reel-then-row order. */
export function grid<T>(cell: (reel: Reel, row: Row) => T): Grid<T> {
  const col = (reel: Reel): Col<T> => [cell(reel, 0), cell(reel, 1), cell(reel, 2)];
  return [col(0), col(1), col(2), col(3), col(4)];
}

export const isPaying = (s: string): s is Paying => PAYING.some((p) => p === s);
export const isSym = (s: string): s is Sym => isPaying(s) || s === "WILD" || s === "MOON" || s === "ORB";
export const isLead = (s: string): s is Lead => isSym(s) && s !== "WILD";
export const isLeadOrDoor = (s: string): s is Lead | "DOOR" => s === "DOOR" || isLead(s);
export const isSymOrDoor = (s: string): s is Sym | "DOOR" => s === "DOOR" || isSym(s);

/** One row index per reel, left to right. */
export type Line = readonly [Row, Row, Row, Row, Row];

function paths(): Line[] {
  const out: Line[] = [];
  for (const a of ROWS)
    for (const b of ROWS)
      for (const c of ROWS)
        for (const d of ROWS)
          for (const e of ROWS) {
            const line: Line = [a, b, c, d, e];
            if (bends(line) >= 0) out.push(line);
          }
  return out;
}

/** Row changes along a line, or -1 when it jumps two rows between neighbours. */
function bends(line: Line): number {
  let n = 0;
  for (let r = 1; r < line.length; r++) {
    const step = Math.abs((line[r] ?? 0) - (line[r - 1] ?? 0));
    if (step > 1) return -1;
    if (step === 1) n++;
  }
  return n;
}

/** The 50 fixed lines: the flattest connected paths across the window. */
export const LINES: readonly Line[] = paths()
  .sort((x, y) => bends(x) - bends(y))
  .slice(0, 50);
