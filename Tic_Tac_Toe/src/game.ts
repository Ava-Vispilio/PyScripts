export type Mark = "X" | "O";
export type Vs = "human" | "ai";
export type Line = [number, number, number];
export type Board = (Mark | null)[];

export const LINES: Line[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type Phase =
  | { kind: "select" }
  | { kind: "playing"; vs: Vs }
  | { kind: "win"; player: Mark; line: Line; vs: Vs }
  | { kind: "draw"; vs: Vs };

export type Game = { phase: Phase; board: Board };

/**
 * `place` is a human hand, `reply` is the algorithm answering. Keeping them
 * apart lets the engine refuse a keypress during the opponent's pause without
 * ever needing to know about timers.
 */
export type Action =
  | { type: "chooseSingle" }
  | { type: "chooseDouble" }
  | { type: "place"; cell: number }
  | { type: "reply"; cell: number }
  | { type: "restart" }
  | { type: "back" };

export type Dir = "up" | "down" | "left" | "right";

const empty = (): Board => Array<Mark | null>(9).fill(null);

export function newGame(): Game {
  return { phase: { kind: "select" }, board: empty() };
}

/** X always moves first, so the turn is the count of marks already placed. */
export function turnOf(board: Board): Mark {
  const marks = board.filter((cell) => cell !== null).length;
  return marks % 2 === 0 ? "X" : "O";
}

export function winnerOf(board: Board): { player: Mark; line: Line } | null {
  for (const line of LINES) {
    const [a, b, c] = line.map((cell) => board[cell]);
    if (a && a === b && b === c) return { player: a, line };
  }
  return null;
}

/** True when the shell owes the player a pause and then a `reply` action. */
export function awaitingReply(game: Game): boolean {
  return game.phase.kind === "playing" && game.phase.vs === "ai" && turnOf(game.board) === "O";
}

const put = (game: Game, vs: Vs, cell: number): Game => {
  const board = [...game.board];
  board[cell] = turnOf(game.board);
  const won = winnerOf(board);
  if (won) return { phase: { kind: "win", player: won.player, line: won.line, vs }, board };
  if (board.every((mark) => mark !== null)) return { phase: { kind: "draw", vs }, board };
  return { phase: { kind: "playing", vs }, board };
};

const legal = (game: Game, cell: number): boolean =>
  Number.isInteger(cell) && cell >= 0 && cell <= 8 && game.board[cell] === null;

export function step(game: Game, action: Action): Game {
  const phase = game.phase;

  if (action.type === "chooseSingle" || action.type === "chooseDouble") {
    if (phase.kind !== "select") return game;
    return { phase: { kind: "playing", vs: action.type === "chooseSingle" ? "ai" : "human" }, board: empty() };
  }

  if (action.type === "place") {
    if (phase.kind !== "playing") return game;
    if (phase.vs === "ai" && turnOf(game.board) === "O") return game;
    if (!legal(game, action.cell)) return game;
    return put(game, phase.vs, action.cell);
  }

  if (action.type === "reply") {
    if (phase.kind !== "playing" || phase.vs !== "ai") return game;
    if (turnOf(game.board) !== "O") return game;
    if (!legal(game, action.cell)) return game;
    return put(game, phase.vs, action.cell);
  }

  if (action.type === "restart") {
    if (phase.kind === "select") return game;
    return { phase: { kind: "playing", vs: phase.vs }, board: empty() };
  }

  if (phase.kind === "select") return game;
  return newGame();
}

/** Move the cell cursor on a 3x3 torus so every arrow always lands somewhere. */
export function nudgeCell(cell: number, dir: Dir): number {
  const row = Math.floor(cell / 3);
  const col = cell % 3;
  if (dir === "up") return ((row + 2) % 3) * 3 + col;
  if (dir === "down") return ((row + 1) % 3) * 3 + col;
  if (dir === "left") return row * 3 + ((col + 2) % 3);
  return row * 3 + ((col + 1) % 3);
}

/** Two options on the mode screen, so any arrow flips between them. */
export function nudgeOption(option: number): number {
  return option === 0 ? 1 : 0;
}

/** A game for a named situation. Used by the page query `state` and the tests. */
export function stage(name: string): Game | null {
  if (name === "" || name === "select") return newGame();
  const begin = (vs: Vs): Game =>
    step(newGame(), { type: vs === "ai" ? "chooseSingle" : "chooseDouble" });
  const fill = (game: Game, cells: number[]): Game =>
    cells.reduce((g, cell) => step(g, { type: "place", cell }), game);
  if (name === "mid") return fill(step(fill(begin("ai"), [0]), { type: "reply", cell: 4 }), [2]);
  if (name === "xwins") return fill(begin("human"), [0, 4, 1, 8, 2]);
  if (name === "owins") return fill(begin("human"), [0, 2, 1, 4, 8, 6]);
  if (name === "draw") return fill(begin("human"), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  return null;
}
