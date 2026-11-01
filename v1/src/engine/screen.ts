import { betOf, boardCoins, type Action, type Board, type Game, type Glass, type Mode } from "./game";
import { PAYTABLE, toCredits, type Coin, type OrbFace } from "./paytable";
import { grid, type Grid, type Reel, type Row, type Sym } from "./symbols";

export type Tone = "card" | "fan" | "koi" | "lotus" | "dragon" | "wild" | "moon" | "orb" | "jackpot" | "door" | "blank";

export type Tile = {
  readonly label: string;
  readonly tone: Tone;
  readonly look: "still" | "spinning" | "locked" | "win";
};

export type TileRow = readonly [Tile, Tile, Tile, Tile, Tile];

export type Screen = {
  readonly rows: readonly [TileRow, TileRow, TileRow];
  readonly meters: { readonly grand: string; readonly major: string; readonly minor: string; readonly mini: string };
  readonly credits: string;
  readonly bet: string;
  readonly win: string;
  readonly banner: string;
  /** The input that does something now. */
  readonly prompt: Action | "broke";
};

const TONE: Record<Sym | "DOOR", Tone> = {
  "9": "card",
  "10": "card",
  J: "card",
  Q: "card",
  K: "card",
  FAN: "fan",
  KOI: "koi",
  LOTUS: "lotus",
  DRGN: "dragon",
  WILD: "wild",
  MOON: "moon",
  ORB: "orb",
  DOOR: "door",
};

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

const SPINNING: Tile = { label: "", tone: "blank", look: "spinning" };
const BLANK: Tile = { label: "", tone: "blank", look: "still" };
const symTile = (s: Sym | "DOOR", look: Tile["look"] = "still"): Tile => ({ label: s, tone: TONE[s], look });

function faceTile(face: OrbFace | null, coin: Coin): Tile {
  if (!face) return BLANK;
  return face.kind === "credit"
    ? { label: fmt(toCredits(face.coins, coin)), tone: "orb", look: "locked" }
    : { label: face.kind, tone: "jackpot", look: "locked" };
}

const rowsOf = (g: Grid<Tile>): Screen["rows"] => {
  const row = (r: Row): TileRow => [g[0][r], g[1][r], g[2][r], g[3][r], g[4][r]];
  return [row(0), row(1), row(2)];
};

const boardTiles = (board: Board, coin: Coin) => grid((reel, row) => faceTile(board[reel][row], coin));

function glassTiles(glass: Glass, coin: Coin): Grid<Tile> {
  if (glass.kind === "board") return boardTiles(glass.board, coin);
  const { window, lines, moons } = glass;
  const winning = (reel: Reel, row: Row) =>
    (moons > 0 && window[reel][row] === "MOON") || lines.some(({ line, count }) => reel < count && line[reel] === row);
  return grid((reel, row) => symTile(window[reel][row], winning(reel, row) ? "win" : "still"));
}

function boardOf(mode: Mode): Board | null {
  if (mode.kind === "hold" || mode.kind === "jackpot") return mode.board;
  return mode.glass.kind === "board" ? mode.glass.board : null;
}

function settled(game: Game): Screen {
  const { mode, coin } = game;
  const bet = betOf(game);
  const common = {
    meters: {
      grand: fmt(toCredits(game.meters.grand, coin)),
      major: fmt(toCredits(game.meters.major, coin)),
      minor: fmt(toCredits(PAYTABLE.minor, coin)),
      mini: fmt(toCredits(PAYTABLE.mini, coin)),
    },
    credits: fmt(game.credits),
    bet: fmt(bet),
  };
  switch (mode.kind) {
    case "base": {
      const broke = game.credits < bet;
      return {
        ...common,
        rows: rowsOf(glassTiles(mode.glass, coin)),
        win: fmt(mode.win),
        banner: broke ? "NOT ENOUGH CREDITS" : mode.win > 0 ? "WINNER" : "AUTUMN MOON",
        prompt: broke ? "broke" : "spin",
      };
    }
    case "free":
      return {
        ...common,
        rows: rowsOf(glassTiles(mode.glass, coin)),
        win: fmt(mode.won),
        banner: `FREE GAMES ${mode.left} LEFT`,
        prompt: "spin",
      };
    case "hold":
      return {
        ...common,
        rows: rowsOf(boardTiles(mode.board, coin)),
        win: fmt(toCredits(boardCoins(mode.board), coin)),
        banner: `HOLD & SPIN · RESPINS ${mode.respins}`,
        prompt: "spin",
      };
    case "jackpot":
      return {
        ...common,
        rows: rowsOf(boardTiles(mode.board, coin)),
        win: fmt(mode.won),
        banner: `${mode.pending[0].name} ${fmt(mode.pending[0].amount)}`,
        prompt: "confirm",
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/** The animation for the last step. Always ends on the settled screen. */
export function frames(game: Game): readonly [Screen, ...Screen[]] {
  const end = settled(game);
  const { motion, coin } = game;
  if (!motion) return [end];
  const still = (tiles: Grid<Tile>): Screen => ({ ...end, rows: rowsOf(tiles), win: "", banner: "" });

  if (motion.kind === "reels") {
    const { landed, door } = motion;
    const stop = (stopped: number) =>
      still(grid((reel, row) => (reel <= stopped ? symTile(landed[reel][row]) : SPINNING)));
    const flip = door ? [still(grid((reel, row) => symTile(landed[reel][row] === "DOOR" ? door : landed[reel][row])))] : [];
    return [stop(0), stop(1), stop(2), stop(3), stop(4), ...flip, end];
  }

  const after = boardOf(game.mode);
  if (!after) return [end];
  const { before, landed } = motion;
  const order = (reel: number, row: Row) => landed.findIndex(([r, w]) => r === reel && w === row);
  // Beat 0 spins every open cell. Landed cell k shows a bare ORB at beat 2k+1 and its face from 2k+2.
  const beat = (n: number) =>
    still(
      grid((reel, row) => {
        const held = before[reel][row];
        if (held) return faceTile(held, coin);
        const k = order(reel, row);
        if (k === -1 || n < 2 * k + 1) return n === 0 ? SPINNING : BLANK;
        return n === 2 * k + 1 ? symTile("ORB", "locked") : faceTile(after[reel][row], coin);
      }),
    );
  const later = Array.from({ length: Math.max(0, 2 * landed.length - 1) }, (_, n) => beat(n + 1));
  return [beat(0), ...later, end];
}