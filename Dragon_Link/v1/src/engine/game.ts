import { ATTRACT, type Rng } from "./chance";
import {
  BET_COINS,
  PAYTABLE,
  coins,
  credits,
  toCredits,
  type Coin,
  type Coins,
  type Credits,
  type OrbFace,
} from "./paytable";
import {
  LINES,
  REELS,
  ROWS,
  grid,
  isPaying,
  type CellRef,
  type Col,
  type DoorFace,
  type Grid,
  type Lead,
  type Line,
  type Paying,
  type Reel,
  type Row,
  type Sym,
  type Window,
} from "./symbols";

export type Action = "spin" | "confirm" | "coinUp" | "coinDown";

export type Board = Grid<OrbFace | null>;

export type LineWin = { readonly line: Line; readonly symbol: Paying; readonly count: 3 | 4 | 5; readonly coins: Coins };

/** What sits on the glass in base and free games. */
export type Glass =
  | { readonly kind: "reels"; readonly window: Window; readonly lines: readonly LineWin[]; readonly moons: Coins }
  | { readonly kind: "board"; readonly board: Board };

/** Where play returns after Hold and Spin. `won` is what the round has paid so far. */
export type Resume =
  | { readonly kind: "base"; readonly won: Credits }
  | { readonly kind: "free"; readonly left: number; readonly won: Credits };

export type Jackpot = { readonly name: "MAJOR" | "GRAND"; readonly amount: Credits };

export type Mode =
  | { readonly kind: "base"; readonly glass: Glass; readonly win: Credits }
  | { readonly kind: "free"; readonly glass: Glass; readonly left: number; readonly won: Credits }
  | { readonly kind: "hold"; readonly board: Board; readonly respins: 1 | 2 | 3; readonly resume: Resume }
  /** Paused on a Major or Grand. The rest of the feature is already paid. Each confirm pays the head. */
  | {
      readonly kind: "jackpot";
      readonly board: Board;
      readonly pending: readonly [Jackpot, ...Jackpot[]];
      readonly won: Credits;
      readonly resume: Resume;
    };

/** How the glass got here on this step. Drives the extra frames. */
export type Motion =
  | { readonly kind: "reels"; readonly landed: Window<"DOOR">; readonly door: DoorFace | null }
  | { readonly kind: "lock"; readonly before: Board; readonly landed: readonly CellRef[] }
  | null;

declare const gameBrand: unique symbol;
/** Values come only from newGame and step. */
export type Game = {
  readonly [gameBrand]: true;
  readonly credits: Credits;
  readonly coin: Coin;
  readonly meters: { readonly major: Coins; readonly grand: Coins };
  readonly mode: Mode;
  readonly motion: Motion;
};

const make = (fields: Omit<Game, typeof gameBrand>) => fields as Game;

export const betOf = (game: Game) => toCredits(BET_COINS, game.coin);

export function newGame(): Game {
  return make({
    credits: PAYTABLE.startCredits,
    coin: PAYTABLE.coins[0],
    meters: { major: PAYTABLE.major.seed, grand: PAYTABLE.grand.seed },
    mode: { kind: "base", glass: { kind: "reels", window: ATTRACT, lines: [], moons: coins(0) }, win: credits(0) },
    motion: null,
  });
}

/**
 * Pure apart from calls on `rng`. Returns the same reference when the action
 * means nothing in this mode, so shells can skip repaints.
 */
export function step(game: Game, action: Action, rng: Rng): Game {
  const { mode } = game;
  switch (mode.kind) {
    case "base":
      if (action === "spin") return game.credits < betOf(game) ? game : spinBase(game, rng);
      if (action === "coinUp") return changeCoin(game, 1);
      if (action === "coinDown") return changeCoin(game, -1);
      return game;
    case "free":
      return action === "spin" ? spinFree(game, mode, rng) : game;
    case "hold":
      return action === "spin" ? respin(game, mode, rng) : game;
    case "jackpot":
      return action === "confirm" ? collect(game, mode) : game;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function changeCoin(game: Game, by: 1 | -1): Game {
  const next = PAYTABLE.coins[PAYTABLE.coins.indexOf(game.coin) + by];
  return next === undefined ? game : make({ ...game, coin: next, motion: null });
}

function spinBase(game: Game, rng: Rng): Game {
  const grow = (meter: Coins, perBet: number) => coins(meter + BET_COINS * perBet);
  const paid = make({
    ...game,
    credits: credits(game.credits - betOf(game)),
    meters: {
      major: grow(game.meters.major, PAYTABLE.major.perBet),
      grand: grow(game.meters.grand, PAYTABLE.grand.perBet),
    },
  });
  return settle(paid, rng.base(), rng, (triggered, win) =>
    triggered ? { kind: "free", left: PAYTABLE.freeGames, won: win } : { kind: "base", won: win },
  );
}

function spinFree(game: Game, mode: Extract<Mode, { kind: "free" }>, rng: Rng): Game {
  return settle(game, rng.free(), rng, (triggered, win) => {
    const left = mode.left - 1 + (triggered ? PAYTABLE.freeGames : 0);
    const won = credits(mode.won + win);
    return left > 0 ? { kind: "free", left, won } : { kind: "base", won };
  });
}

function settle(
  game: Game,
  landed: Window<"DOOR">,
  rng: Rng,
  after: (triggered: boolean, win: Credits) => Resume,
): Game {
  let door: DoorFace | null = null;
  const open = () => (door ??= rng.door());
  const lead = (s: Lead | "DOOR"): Lead => (s === "DOOR" ? open() : s);
  const any = (s: Sym | "DOOR"): Sym => (s === "DOOR" ? open() : s);
  const col = <T, U>(c: Col<T>, f: (t: T) => U): Col<U> => [f(c[0]), f(c[1]), f(c[2])];
  const shown: Window = [col(landed[0], lead), col(landed[1], any), col(landed[2], any), col(landed[3], any), col(landed[4], any)];

  const lines = lineWins(shown);
  const moons = moonPay(shown.flat().filter((s) => s === "MOON").length);
  const win = toCredits(coins(lines.reduce((sum: number, w) => sum + w.coins, moons)), game.coin);
  const resume = after(moons > 0, win);
  const paid = make({ ...game, credits: credits(game.credits + win), motion: { kind: "reels", landed, door } });

  if (shown.flat().filter((s) => s === "ORB").length >= PAYTABLE.holdTrigger) {
    const board = lock(EMPTY, (reel, row) => shown[reel][row] === "ORB", rng);
    return isFull(board)
      ? finish(paid, board, resume)
      : make({ ...paid, mode: { kind: "hold", board, respins: PAYTABLE.respins, resume } });
  }
  return enter(paid, resume, { kind: "reels", window: shown, lines, moons }, credits(0));
}

function lineWins(w: Window): LineWin[] {
  return LINES.flatMap((line) => {
    const symbol = w[0][line[0]];
    if (!isPaying(symbol)) return [];
    const cells = REELS.map((reel) => w[reel][line[reel]]);
    let run = 1;
    while (cells[run] === symbol || cells[run] === "WILD") run++;
    const count = run >= 5 ? 5 : run === 4 ? 4 : run === 3 ? 3 : null;
    return count ? [{ line, symbol, count, coins: PAYTABLE.lines[symbol][count] }] : [];
  });
}

function moonPay(count: number): Coins {
  if (count < 3) return coins(0);
  return PAYTABLE.moons[count >= 5 ? 5 : count === 4 ? 4 : 3];
}

const EMPTY: Board = grid(() => null);

const isFull = (board: Board) => board.every((col) => col.every((face) => face !== null));
const hasMajor = (board: Board) => board.some((col) => col.some((face) => face?.kind === "MAJOR"));

/** Locks a new orb on every open cell that `catches`, keeping at most one MAJOR on the board. */
function lock(board: Board, catches: (reel: Reel, row: Row) => boolean, rng: Rng): Board {
  let major = hasMajor(board);
  return grid((reel, row) => {
    const held = board[reel][row];
    if (held || !catches(reel, row)) return held;
    const face = rng.orb({ major: !major });
    if (face.kind === "MAJOR") major = true;
    return face;
  });
}

const COUNTDOWN = { 3: 2, 2: 1, 1: 0 } as const;

function respin(game: Game, mode: Extract<Mode, { kind: "hold" }>, rng: Rng): Game {
  const open = REELS.flatMap((reel) => ROWS.filter((row) => !mode.board[reel][row]).map((row) => [reel, row] as const));
  const landed = rng.respin(open);
  const board = lock(mode.board, (reel, row) => landed.some(([r, w]) => r === reel && w === row), rng);
  const moved = make({ ...game, motion: { kind: "lock", before: mode.board, landed } });
  const respins = landed.length > 0 ? PAYTABLE.respins : COUNTDOWN[mode.respins];
  if (respins === 0 || isFull(board)) return finish(moved, board, mode.resume);
  return make({ ...moved, mode: { ...mode, board, respins } });
}

/** Value of the locked board in coins, before any Major or Grand. */
export function boardCoins(board: Board): Coins {
  const value = (face: OrbFace | null): number => {
    switch (face?.kind) {
      case "credit":
        return face.coins;
      case "MINI":
        return PAYTABLE.mini;
      case "MINOR":
        return PAYTABLE.minor;
      default:
        return 0;
    }
  };
  return coins(board.flat().reduce((sum, face) => sum + value(face), 0));
}

function finish(game: Game, board: Board, resume: Resume): Game {
  const rest = toCredits(boardCoins(board), game.coin);
  const paid = make({ ...game, credits: credits(game.credits + rest) });
  const pending: Jackpot[] = [];
  if (hasMajor(board)) pending.push({ name: "MAJOR", amount: toCredits(game.meters.major, game.coin) });
  if (isFull(board)) pending.push({ name: "GRAND", amount: toCredits(game.meters.grand, game.coin) });
  const [first, ...more] = pending;
  if (!first) return enter(paid, resume, { kind: "board", board }, rest);
  return make({ ...paid, mode: { kind: "jackpot", board, pending: [first, ...more], won: rest, resume } });
}

function collect(game: Game, mode: Extract<Mode, { kind: "jackpot" }>): Game {
  const [head, ...more] = mode.pending;
  const won = credits(mode.won + head.amount);
  const paid = make({
    ...game,
    credits: credits(game.credits + head.amount),
    meters:
      head.name === "MAJOR"
        ? { ...game.meters, major: PAYTABLE.major.seed }
        : { ...game.meters, grand: PAYTABLE.grand.seed },
    motion: null,
  });
  const [next, ...rest] = more;
  if (next) return make({ ...paid, mode: { ...mode, pending: [next, ...rest], won } });
  return enter(paid, mode.resume, { kind: "board", board: mode.board }, won);
}

function enter(game: Game, resume: Resume, glass: Glass, extra: Credits): Game {
  const won = credits(resume.won + extra);
  const mode: Mode =
    resume.kind === "base" ? { kind: "base", glass, win: won } : { kind: "free", glass, left: resume.left, won };
  return make({ ...game, mode });
}
