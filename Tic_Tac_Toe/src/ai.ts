import { turnOf, winnerOf, type Board } from "./game";

const WIN = 10;

const full = (board: Board): boolean => board.every((cell) => cell !== null);

const keyOf = (board: Board): string => board.map((cell) => cell ?? ".").join("");

const search = (board: Board, depth: number, memo: Map<string, number>): number => {
  const key = keyOf(board);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let score: number;
  if (winnerOf(board)) score = depth - WIN;
  else if (full(board)) score = 0;
  else {
    const mark = turnOf(board);
    score = -Infinity;
    for (let cell = 0; cell < 9; cell++) {
      if (board[cell] !== null) continue;
      const next = [...board];
      next[cell] = mark;
      score = Math.max(score, -search(next, depth + 1, memo));
    }
  }

  memo.set(key, score);
  return score;
};

/** The unbeatable minimax move for the side to move. */
export function bestCell(board: Board): number {
  const mark = turnOf(board);
  const memo = new Map<string, number>();
  let best = -Infinity;
  let choice = -1;
  for (let cell = 0; cell < 9; cell++) {
    if (board[cell] !== null) continue;
    const next = [...board];
    next[cell] = mark;
    const score = -search(next, 1, memo);
    if (score > best) {
      best = score;
      choice = cell;
    }
  }
  return choice;
}
