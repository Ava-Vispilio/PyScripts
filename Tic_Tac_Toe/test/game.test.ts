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
import { ansi, markup, newView, picture, plain, WIDTH } from "../src/text";

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

test("both screens fit the board width", () => {
  for (const name of ["", "mid", "xwins", "owins", "draw"]) {
    for (const line of plain(stage(name)!, newView()).split("\n")) {
      expect(line.length).toBeLessThanOrEqual(WIDTH);
    }
  }
  const boardText = plain(stage("mid")!, newView()).split("\n");
  expect(boardText[2]).toHaveLength(WIDTH);
  expect(boardText[3]).toHaveLength(WIDTH);
  expect(boardText[4]).toHaveLength(WIDTH);
  expect(boardText[2]).toBe("[   X   ]  [       ]  [   X   ]");
  expect(boardText[3]).toBe("[       ]  [   O   ]  [       ]");
});

test("the mode screen offers both modes with the cursor on the first", () => {
  const text = plain(newGame(), newView());
  expect(text).toContain("[ ONE PLAYER ]");
  expect(text).toContain("[ TWO PLAYERS ]");
  expect(plain(newGame(), newView()).split("\n").at(-1)).toBe("         Choose a mode         ");
  const web = markup(picture(newGame(), newView()));
  expect(web).toContain('<span class="opt" data-option="0"><span class="card hot">');
  expect(web).toContain('<span class="opt" data-option="1"><span class="card still">');
});

test("the cursor cell wears the mover's color", () => {
  const web = markup(picture(stage("mid")!, { option: 0, cell: 1 }));
  expect(web).toContain('<span class="cell" data-cell="1"><span class="o hot">[       ]</span>');
  expect(web).toContain('<span class="cell" data-cell="0"><span class="x still">[   X   ]</span>');
});

test("the turn row names the mover in their color", () => {
  expect(plain(single(), newView())).toContain("Turn: You (X)");
  expect(plain(single(), newView()).split("\n")).toContain("Turn: You (X)");
  expect(plain(stage("mid")!, newView())).toContain("Turn: CPU (O)");
  expect(plain(double(), newView())).toContain("Turn: Player 1 (X)");
  expect(plain(place(double(), 4), newView())).toContain("Turn: Player 2 (O)");
});

test("the board advertises going back under the bar, the mode screen does not", () => {
  const text = plain(stage("mid")!, newView()).split("\n");
  expect(text).toContain("Esc = Back, R = Reset");
  expect(text.at(-1)).toBe("Esc = Back, R = Reset");
  expect(text.at(-2)).toBe("          In progress          ");
  expect(plain(newGame(), newView())).not.toContain("Esc = Back, R = Reset");
  const screen = ansi(picture(stage("xwins")!, newView()));
  expect(screen.endsWith("\x1b[90mEsc = Back, R = Reset\x1b[0m\n")).toBe(true);
  expect(screen).toContain("\x1b[42;97m  Press Enter to reset board   \x1b[0m\n\x1b[90mEsc = Back, R = Reset");
  expect(markup(picture(double(), newView()))).not.toContain("Esc = Back, R = Reset");
});

test("the result rows name the winner", () => {
  const duel = (moves: number[]): Game =>
    moves.reduce((g, cell) => step(g, { type: turnOf(g.board) === "X" ? "place" : "reply", cell }), single());
  expect(plain(duel([0, 4, 1, 8, 2]), newView())).toContain("You win");
  expect(plain(duel([0, 2, 5, 4, 7, 6]), newView())).toContain("CPU wins");
  expect(plain(stage("xwins")!, newView())).toContain("Player 1 (X) wins");
  expect(plain(stage("owins")!, newView())).toContain("Player 2 (O) wins");
  expect(plain(stage("draw")!, newView())).toContain("It's a draw!");
});

test("the bar tracks the phase", () => {
  expect(picture(newGame(), newView()).bar).toBe("select");
  expect(picture(double(), newView()).bar).toBe("play");
  expect(picture(stage("xwins")!, newView()).bar).toBe("win");
  expect(picture(stage("owins")!, newView()).bar).toBe("lose");
  expect(picture(stage("draw")!, newView()).bar).toBe("draw");
  expect(plain(double(), newView()).split("\n").at(-2)).toBe("          In progress          ");
  expect(plain(stage("xwins")!, newView()).split("\n").at(-2)).toBe("  Press Enter to reset board   ");
});

test("the winning line lights up in the winner's color", () => {
  const web = markup(picture(stage("xwins")!, newView()));
  expect(web).toContain('<span class="cell" data-cell="0"><span class="x hot">[   X   ]</span>');
  expect(web).toContain('<span class="cell" data-cell="1"><span class="x hot">[   X   ]</span>');
  expect(web).toContain('<span class="cell" data-cell="2"><span class="x hot">[   X   ]</span>');
  expect(web).toContain('<span class="cell" data-cell="3"><span class="card still">[       ]</span>');
  expect(web).toContain('<span class="cell" data-cell="4"><span class="o still">[   O   ]</span>');
});

test("ansi clears the screen and paints the hint under the bar", () => {
  const text = ansi(picture(stage("xwins")!, newView()));
  expect(text.startsWith("\x1b[H\x1b[J")).toBe(true);
  expect(text.endsWith("\x1b[42;97m  Press Enter to reset board   \x1b[0m\n\x1b[90mEsc = Back, R = Reset\x1b[0m\n")).toBe(true);
  expect(markup(picture(double(), newView()))).not.toContain("In progress");
});
