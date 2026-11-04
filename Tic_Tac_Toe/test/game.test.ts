import { expect, test } from "bun:test";
import {
  awaitingReply,
  LINES,
  newGame,
  nudgeCell,
  nudgeOption,
  stage,
  step,
  turnOf,
  type Board,
  type Game,
} from "../src/game";

const board = (text: string): Board => [...text].map((c) => (c === "X" || c === "O" ? c : null));
const place = (game: Game, ...cells: number[]): Game =>
  cells.reduce((g, cell) => step(g, { type: "place", cell }), game);
const single = (): Game => step(newGame(), { type: "chooseSingle" });
const double = (): Game => step(newGame(), { type: "chooseDouble" });

test("X moves first and the turn follows the mark count", () => {
  expect(turnOf(board("........."))).toBe("X");
  expect(turnOf(board("X........"))).toBe("O");
  expect(turnOf(board("X.O......"))).toBe("X");
  expect(turnOf(board("XOXOXOXO."))).toBe("X");
});

test("the mode is chosen once and only from the select screen", () => {
  expect(single().phase).toEqual({ kind: "playing", vs: "ai" });
  expect(double().phase).toEqual({ kind: "playing", vs: "human" });
  const playing = double();
  expect(step(playing, { type: "chooseSingle" })).toBe(playing);
  const won = stage("xwins")!;
  expect(step(won, { type: "chooseDouble" })).toBe(won);
});

test("marks alternate X then O", () => {
  const game = place(double(), 4);
  expect(game.board[4]).toBe("X");
  expect(step(game, { type: "place", cell: 0 }).board[0]).toBe("O");
});

test("illegal placements change nothing", () => {
  const game = place(double(), 0, 4);
  expect(step(game, { type: "place", cell: 0 })).toBe(game);
  expect(step(game, { type: "place", cell: -1 })).toBe(game);
  expect(step(game, { type: "place", cell: 9 })).toBe(game);
  expect(step(game, { type: "place", cell: 2.5 })).toBe(game);
  const fresh = newGame();
  expect(step(fresh, { type: "place", cell: 0 })).toBe(fresh);
  const won = stage("xwins")!;
  expect(step(won, { type: "place", cell: 3 })).toBe(won);
});

test("a human hand cannot move for the algorithm", () => {
  const game = place(single(), 0);
  expect(awaitingReply(game)).toBe(true);
  expect(step(game, { type: "place", cell: 4 })).toBe(game);
});

test("the reply belongs to the algorithm alone", () => {
  const hotseat = double();
  expect(step(hotseat, { type: "reply", cell: 4 })).toBe(hotseat);
  const yourMove = single();
  expect(step(yourMove, { type: "reply", cell: 4 })).toBe(yourMove);
  const game = place(single(), 0);
  expect(step(game, { type: "reply", cell: 0 })).toBe(game);
  expect(step(game, { type: "reply", cell: 9 })).toBe(game);
  const answered = step(game, { type: "reply", cell: 4 });
  expect(answered.board[4]).toBe("O");
  expect(awaitingReply(answered)).toBe(false);
});

test("every win line pays off on the fifth mark", () => {
  for (const line of LINES) {
    const outside = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => !line.includes(cell));
    const game = place(double(), line[0], outside[0]!, line[1], outside[1]!, line[2]);
    expect(game.phase).toEqual({ kind: "win", player: "X", line, vs: "human" });
  }
});

test("O wins a line on its third mark", () => {
  expect(place(double(), 0, 2, 1, 4, 8, 6).phase).toEqual({
    kind: "win",
    player: "O",
    line: [2, 4, 6],
    vs: "human",
  });
});

test("a full board that completes a line is a win, not a draw", () => {
  const game = place(double(), 0, 1, 2, 3, 4, 5, 7, 6);
  const last = step(game, { type: "place", cell: 8 });
  expect(last.phase).toEqual({ kind: "win", player: "X", line: [0, 4, 8], vs: "human" });
  expect(last.board.every((mark) => mark !== null)).toBe(true);
});

test("a full board with no line is a draw", () => {
  expect(place(double(), 0, 1, 2, 4, 3, 5, 7, 6, 8).phase).toEqual({ kind: "draw", vs: "human" });
});

test("restart keeps the mode and back forgets it", () => {
  const mid = place(single(), 0);
  expect(step(mid, { type: "restart" }).phase).toEqual({ kind: "playing", vs: "ai" });
  expect(step(stage("xwins")!, { type: "restart" }).phase).toEqual({ kind: "playing", vs: "human" });
  expect(step(stage("draw")!, { type: "restart" }).phase).toEqual({ kind: "playing", vs: "human" });
  const fresh = newGame();
  expect(step(fresh, { type: "restart" })).toBe(fresh);
  expect(step(mid, { type: "back" }).phase).toEqual({ kind: "select" });
  expect(step(stage("xwins")!, { type: "back" }).phase).toEqual({ kind: "select" });
  expect(step(stage("draw")!, { type: "back" }).phase).toEqual({ kind: "select" });
  expect(step(fresh, { type: "back" })).toBe(fresh);
});

test("the cursors wrap around their grids", () => {
  expect(nudgeCell(0, "left")).toBe(2);
  expect(nudgeCell(0, "up")).toBe(6);
  expect(nudgeCell(8, "right")).toBe(6);
  expect(nudgeCell(8, "down")).toBe(2);
  expect(nudgeCell(4, "up")).toBe(1);
  expect(nudgeOption(0)).toBe(1);
  expect(nudgeOption(1)).toBe(0);
});

test("named stages land on the situations the page links to", () => {
  expect(stage("")!.phase).toEqual({ kind: "select" });
  expect(stage("select")!.phase).toEqual({ kind: "select" });
  expect(stage("nope")).toBeNull();
  const mid = stage("mid")!;
  expect(mid.phase).toEqual({ kind: "playing", vs: "ai" });
  expect(mid.board).toEqual(board("X.X.O...."));
  expect(awaitingReply(mid)).toBe(true);
  expect(stage("xwins")!.phase).toEqual({ kind: "win", player: "X", line: [0, 1, 2], vs: "human" });
  expect(stage("owins")!.phase).toEqual({ kind: "win", player: "O", line: [2, 4, 6], vs: "human" });
  expect(stage("draw")!.phase).toEqual({ kind: "draw", vs: "human" });
});
