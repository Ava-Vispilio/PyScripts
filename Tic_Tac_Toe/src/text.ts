import { turnOf, type Game, type Mark } from "./game";

export type Tone = "x" | "o" | "card" | "dim" | "gold";
export type Look = "still" | "hot";
export type Bar = "select" | "play" | "win" | "lose" | "draw";
export type Piece = { text: string; tone: Tone; look: Look };

/** The cursor lives in the shells, not the engine: which option and which cell it sits on. */
export type View = { option: number; cell: number };

export type SelectPicture = {
  screen: "select";
  title: string;
  options: Piece[];
  tip: string;
  status: string;
  bar: Bar;
};

export type BoardPicture = {
  screen: "board";
  title: string;
  rows: Piece[][];
  turn: Piece;
  tip: string;
  status: string;
  bar: Bar;
};

export type Picture = SelectPicture | BoardPicture;

export const WIDTH = 31;
const TITLE = "TIC TAC TOE";
const TIP_SELECT = "TIP: Arrows move, Enter chooses";
const TIP_BOARD = "TIP: Arrows move, Enter places";

/** The go-back hint sits under the status bar on board screens. The page paints it itself, like the bar. */
export const BACK = "Press Esc to go back";

export const newView = (): View => ({ option: 0, cell: 4 });

const SGR: Record<Tone, string> = { x: "96;1", o: "38;5;208;1", card: "37", dim: "90", gold: "33" };
const HOT: Record<Tone, string> = { x: "106;30", o: "48;5;208;30", card: "107;30", dim: "100;30", gold: "103;30" };
const BAR: Record<Bar, string> = { select: "100;37", play: "43;30", win: "42;97", lose: "41;97", draw: "100;30" };

const toneOf = (mark: Mark): Tone => (mark === "X" ? "x" : "o");

function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

function box(label: string): string {
  return `[ ${center(label, 5)} ]`;
}

function turnPiece(game: Game): Piece {
  const phase = game.phase;
  if (phase.kind === "playing") {
    const turn = turnOf(game.board);
    const who = phase.vs === "ai" ? (turn === "X" ? "You" : "CPU") : turn === "X" ? "Player 1" : "Player 2";
    return { text: `Turn: ${who} (${turn})`, tone: toneOf(turn), look: "still" };
  }
  if (phase.kind === "win") {
    const text =
      phase.vs === "ai"
        ? phase.player === "X"
          ? "You win"
          : "CPU wins"
        : `Player ${phase.player === "X" ? "1" : "2"} (${phase.player}) wins`;
    return { text, tone: toneOf(phase.player), look: "still" };
  }
  return { text: "It's a draw!", tone: "dim", look: "still" };
}

function statusOf(game: Game): string {
  const phase = game.phase;
  if (phase.kind === "select") return "Choose a mode";
  if (phase.kind === "playing") return "In progress";
  return "Press Enter to reset board";
}

function barOf(game: Game): Bar {
  const phase = game.phase;
  if (phase.kind === "select") return "select";
  if (phase.kind === "playing") return "play";
  if (phase.kind === "draw") return "draw";
  return phase.player === "X" ? "win" : "lose";
}

/** One settled screen, with a color and a highlight on every piece. */
export function picture(game: Game, view: View): Picture {
  if (game.phase.kind === "select") {
    const options = ["ONE PLAYER", "TWO PLAYERS"].map((label, i) => ({
      text: box(label),
      tone: "card" as const,
      look: i === view.option ? ("hot" as const) : ("still" as const),
    }));
    return { screen: "select", title: TITLE, options, tip: TIP_SELECT, status: statusOf(game), bar: barOf(game) };
  }

  const phase = game.phase;
  const turn = turnOf(game.board);
  const rows = [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => {
      const cell = r * 3 + c;
      const mark = game.board[cell];
      const hot =
        phase.kind === "playing"
          ? cell === view.cell
          : phase.kind === "win" && phase.line.includes(cell);
      const tone: Tone = hot
        ? toneOf(phase.kind === "win" ? phase.player : turn)
        : mark
          ? toneOf(mark)
          : "card";
      return { text: box(mark ?? ""), tone, look: hot ? ("hot" as const) : ("still" as const) };
    }),
  );
  return {
    screen: "board",
    title: TITLE,
    rows,
    turn: turnPiece(game),
    tip: TIP_BOARD,
    status: statusOf(game),
    bar: barOf(game),
  };
}

/** The screen as plain text. The last line is the status bar. */
export function plain(game: Game, view: View): string {
  const pic = picture(game, view);
  const bar = center(pic.status, WIDTH);
  if (pic.screen === "select") {
    return [center(pic.title, WIDTH), "", ...pic.options.map((option) => center(option.text, WIDTH)), "", pic.tip, "", bar].join("\n");
  }
  return [
    center(pic.title, WIDTH),
    "",
    ...pic.rows.map((line) => line.map((cell) => cell.text).join("  ")),
    "",
    pic.turn.text,
    "",
    pic.tip,
    "",
    bar,
    BACK,
  ].join("\n");
}

function paint(codes: string, text: string): string {
  return `\x1b[${codes}m${text}\x1b[0m`;
}

/** The picture as terminal color. The status bar takes its color from the phase. */
export function ansi(pic: Picture): string {
  const ink = (piece: Piece) => paint(piece.look === "hot" ? HOT[piece.tone] : SGR[piece.tone], piece.text);
  const lines = [paint(SGR.gold, center(pic.title, WIDTH)), ""];
  if (pic.screen === "select") {
    lines.push(
      ...pic.options.map((option) => paint(option.look === "hot" ? HOT[option.tone] : SGR[option.tone], center(option.text, WIDTH))),
      "",
      paint(SGR.gold, pic.tip),
    );
  } else {
    lines.push(
      ...pic.rows.map((line) => line.map(ink).join("  ")),
      "",
      paint(SGR[pic.turn.tone], pic.turn.text),
      "",
      paint(SGR.gold, pic.tip),
      "",
    );
  }
  const hint = pic.screen === "board" ? `\n${paint(SGR.dim, BACK)}` : "";
  return `\x1b[H\x1b[J${lines.join("\n")}\n${paint(BAR[pic.bar], center(pic.status, WIDTH))}${hint}\n`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function span(text: string, tone: Tone, look: Look): string {
  return `<span class="${tone} ${look}">${esc(text)}</span>`;
}

/** The picture as colored text. The page paints the status bar itself, so it carries no status. */
export function markup(pic: Picture): string {
  const head = span(center(pic.title, WIDTH), "gold", "still");
  if (pic.screen === "select") {
    const options = pic.options
      .map((option, i) => `<span class="opt" data-option="${i}">${span(center(option.text, WIDTH), option.tone, option.look)}</span>`)
      .join("\n");
    return `${head}\n\n${options}\n\n${span(pic.tip, "gold", "still")}`;
  }
  const rows = pic.rows
    .map((line, r) =>
      line.map((cell, c) => `<span class="cell" data-cell="${r * 3 + c}">${span(cell.text, cell.tone, cell.look)}</span>`).join("  "),
    )
    .join("\n");
  return `${head}\n\n${rows}\n\n${span(pic.turn.text, pic.turn.tone, "still")}\n\n${span(pic.tip, "gold", "still")}`;
}
