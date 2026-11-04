import { expect, test } from "bun:test";
import { bestCell } from "../src/ai";
import { turnOf, winnerOf, type Board, type Mark } from "../src/game";

const board = (text: string): Board => [...text].map((c) => (c === "X" || c === "O" ? c : null));

type Walk = { leaves: number; losses: number; illegal: number };

const walk = (board: Board, algo: Mark): Walk => {
  const won = winnerOf(board);
  if (won) return { leaves: 1, losses: won.player === algo ? 0 : 1, illegal: 0 };
  if (board.every((cell) => cell !== null)) return { leaves: 1, losses: 0, illegal: 0 };

  const mover = turnOf(board);
  if (mover === algo) {
    const cell = bestCell(board);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || board[cell] !== null) {
      return { leaves: 1, losses: 0, illegal: 1 };
    }
    const next = [...board];
    next[cell] = mover;
    return walk(next, algo);
  }

  const empties = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => board[cell] === null);
  return empties.reduce<Walk>(
    (acc, cell) => {
      const next = [...board];
      next[cell] = mover;
      const result = walk(next, algo);
      return {
        leaves: acc.leaves + result.leaves,
        losses: acc.losses + result.losses,
        illegal: acc.illegal + result.illegal,
      };
    },
    { leaves: 0, losses: 0, illegal: 0 },
  );
};

test("bestCell takes an immediate win", () => {
  expect(bestCell(board("XX.O...O."))).toBe(2);
});

test("bestCell blocks an immediate threat", () => {
  expect(bestCell(board("OO.X....X"))).toBe(2);
});

test("bestCell wins instead of blocking when it can", () => {
  expect(bestCell(board("XX.OO...."))).toBe(2);
});

test("bestCell never loses as X", () => {
  const result = walk(board("........."), "X");
  expect(result.leaves).toBeGreaterThan(0);
  expect(result.losses).toBe(0);
});

test("bestCell never loses as O", () => {
  const result = walk(board("........."), "O");
  expect(result.leaves).toBeGreaterThan(0);
  expect(result.losses).toBe(0);
});

test("bestCell always returns an empty in-range cell", () => {
  expect(walk(board("........."), "X").illegal).toBe(0);
  expect(walk(board("........."), "O").illegal).toBe(0);
});
