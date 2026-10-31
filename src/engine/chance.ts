import { PAYTABLE, type OrbFace } from "./paytable";
import {
  isLead,
  isLeadOrDoor,
  isSym,
  isSymOrDoor,
  type CellRef,
  type Col,
  type DoorFace,
  type Window,
} from "./symbols";

/**
 * Every random event the cabinet has, asked in domain terms. step calls
 * these and nothing else random. Each call may advance hidden state.
 */
export interface Rng {
  base(): Window;
  free(): Window<"DOOR">;
  /** Called once per free spin, only when the landed window shows a DOOR. */
  door(): DoorFace;
  /** Which of the open cells catch an orb on this respin. Subset of `open`. */
  respin(open: readonly CellRef[]): readonly CellRef[];
  /** Face for a newly locked orb. `major: false` once the board already shows MAJOR. */
  orb(allow: { readonly major: boolean }): OrbFace;
}

/** Uniform source in [0, 1). Math.random fits. */
export type Uniform = () => number;

type Strip<T> = readonly [T, ...T[]];

function strip<T extends string>(text: string, is: (s: string) => s is T): Strip<T> {
  const [first, ...rest] = text.trim().split(/\s+/);
  if (first === undefined || !is(first)) throw new Error(`bad strip symbol: ${first}`);
  return [first, ...rest.map((s) => (is(s) ? s : fail(`bad strip symbol: ${s}`)))];
}

function fail(message: string): never {
  throw new Error(message);
}

const BASE = [
  strip("9 J ORB K 10 FAN Q MOON 9 KOI J ORB ORB 10 K LOTUS Q 9 DRGN J 10 K FAN Q 9 KOI 10 J LOTUS Q", isLead),
  strip("10 Q ORB J WILD 9 K FAN MOON 10 KOI Q 9 J LOTUS K 10 DRGN Q ORB ORB 9 FAN J WILD KOI 10 K Q 9", isSym),
  strip("J K ORB 9 10 WILD Q FAN 9 MOON KOI ORB ORB J 10 LOTUS K Q DRGN 9 J WILD FAN 10 K KOI Q 9 LOTUS J", isSym),
  strip("Q 9 ORB 10 K FAN WILD J MOON KOI 9 Q 10 LOTUS J K DRGN WILD 9 ORB ORB 10 FAN Q KOI J K LOTUS 9 10", isSym),
  strip("K 10 ORB Q J FAN 9 WILD MOON KOI 10 ORB ORB K Q LOTUS 9 J DRGN 10 WILD FAN K 9 KOI Q J LOTUS 10 9", isSym),
] as const;

const FREE = [
  strip("9 J DOOR DOOR K 10 FAN Q MOON 9 KOI J ORB 10 K DOOR DOOR LOTUS Q 9 DRGN J 10 K FAN Q", isLeadOrDoor),
  strip("10 Q DOOR DOOR J WILD 9 K MOON FAN 10 KOI ORB Q 9 DOOR DOOR J LOTUS K WILD DRGN Q 10 J FAN", isSymOrDoor),
  strip("J K DOOR DOOR 9 WILD 10 Q MOON FAN KOI ORB J 10 DOOR DOOR LOTUS K WILD Q DRGN 9 J 10 K FAN", isSymOrDoor),
  strip("Q 9 DOOR DOOR 10 K WILD J MOON FAN KOI ORB Q 10 DOOR DOOR LOTUS J WILD K DRGN 9 Q 10 J FAN", isSymOrDoor),
  strip("K 10 DOOR DOOR Q J WILD 9 MOON FAN KOI ORB K Q DOOR DOOR LOTUS 9 WILD J DRGN 10 K Q 9 FAN", isSymOrDoor),
] as const;

const DOOR_FACES = [
  { face: "ORB", weight: 34 },
  { face: "DRGN", weight: 6 },
  { face: "LOTUS", weight: 8 },
  { face: "KOI", weight: 10 },
  { face: "FAN", weight: 12 },
  { face: "K", weight: 14 },
  { face: "Q", weight: 14 },
  { face: "J", weight: 16 },
  { face: "10", weight: 16 },
  { face: "9", weight: 16 },
] as const satisfies readonly { face: DoorFace; weight: number }[];

/** Chance that one open cell catches an orb on a respin. */
const ORB_LAND = 0.05;

/** The window a fresh cabinet shows before the first spin. */
export const ATTRACT: Window = [
  ["DRGN", "KOI", "9"],
  ["MOON", "LOTUS", "WILD"],
  ["ORB", "DRGN", "FAN"],
  ["LOTUS", "MOON", "K"],
  ["FAN", "ORB", "DRGN"],
];

type Weighted<F> = { readonly face: F; readonly weight: number };

function pick<F>(u: Uniform, items: readonly [Weighted<F>, ...Weighted<F>[]]): F {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = u() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item.face;
  }
  return items[0].face;
}

export function reelRng(u: Uniform): Rng {
  const land = <T>(s: Strip<T>): Col<T> => {
    const top = Math.floor(u() * s.length);
    const at = (i: number) => s[(top + i) % s.length] ?? s[0];
    return [at(0), at(1), at(2)];
  };
  return {
    base: () => [land(BASE[0]), land(BASE[1]), land(BASE[2]), land(BASE[3]), land(BASE[4])],
    free: () => [land(FREE[0]), land(FREE[1]), land(FREE[2]), land(FREE[3]), land(FREE[4])],
    door: () => pick<DoorFace>(u, DOOR_FACES),
    respin: (open) => open.filter(() => u() < ORB_LAND),
    orb: ({ major }) => {
      const [first, ...rest] = PAYTABLE.orbs.filter(({ face }) => major || face.kind !== "MAJOR");
      return first ? pick<OrbFace>(u, [first, ...rest]) : fail("no orb face allowed");
    },
  };
}

/** mulberry32. Deterministic Uniform for the page and for replays. */
export function seeded(seed: number): Uniform {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}