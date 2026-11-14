import type { Game } from "./game";

export type Tone = "url" | "time" | "gold" | "card" | "dim" | "good" | "bad";
export type Look = "still" | "hot";
export type Bar = "idle" | "checking" | "good" | "bad";
export type Piece = { text: string; tone: Tone; look: Look };

/** One settled screen. Fixed height: the same twenty rows for every state. */
export type Picture = {
  title: Piece;
  urlLabel: Piece;
  urlField: Piece;
  loadButton: Piece;
  name: Piece;
  loop: Piece;
  speedMinus: Piece;
  speedValue: Piece;
  speedPlus: Piece;
  playChip: Piece;
  modeChip: Piece;
  startLabel: Piece;
  startField: Piece;
  endLabel: Piece;
  endField: Piece;
  snipButton: Piece;
  tip: Piece;
  status: string;
  bar: Bar;
};

export const WIDTH = 39;
const TITLE = "LOOP SONG";
const TIP = "P = Play, +/- = Speed, M = Mode";

/** The reset hint sits under the status bar. The page paints it itself, like the bar. */
export const BACK = "Esc or R = Reset, Q = Quit";

const SGR: Record<Tone, string> = {
  url: "96;1",
  time: "38;5;208;1",
  gold: "33;1",
  card: "37",
  dim: "90",
  good: "32;1",
  bad: "31;1",
};
const HOT: Record<Tone, string> = {
  url: "106;30",
  time: "48;5;208;30",
  gold: "103;30",
  card: "107;30",
  dim: "100;30",
  good: "42;30",
  bad: "41;30",
};
const BAR: Record<Bar, string> = { idle: "43;30", checking: "43;30", good: "42;97", bad: "41;97" };

function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

/** A typing field can grow past the board, so it shows its tail: the caret stays visible. */
function tail(text: string, max: number): string {
  return text.length <= max ? text : "…" + text.slice(text.length - max + 1);
}

/** The video name is read-only, so it loses its head instead. */
function head(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

export function statusOf(game: Game): string {
  if (game.load === "badLink") return "Bad link";
  if (game.load === "notFound") return "Not found";
  if (game.load === "checking") return "Checking";
  if (game.load === "idle") return "Type a link";
  if (game.snip === "bad") return "Bad times";
  if (game.window) return "Snippet set";
  return "Loaded";
}

export function barOf(game: Game): Bar {
  if (game.load === "badLink" || game.load === "notFound") return "bad";
  if (game.load === "checking") return "checking";
  if (game.load === "idle") return "idle";
  if (game.snip === "bad") return "bad";
  return "good";
}

function loadButton(game: Game): Piece {
  if (game.load === "checking") return { text: "[ Checking ]", tone: "gold", look: "still" };
  if (game.load === "loaded") return { text: "[ Loaded ]", tone: "good", look: "still" };
  if (game.load === "badLink") return { text: "[ Bad link ]", tone: "bad", look: "still" };
  if (game.load === "notFound") return { text: "[ Not found ]", tone: "bad", look: "still" };
  return { text: "[ Enter to load ]", tone: "dim", look: "still" };
}

function snipButton(game: Game): Piece {
  if (game.snip === "bad") return { text: "[ Bad times ]", tone: "bad", look: "still" };
  if (game.snip === "set" && game.load === "loaded") return { text: "[ Snippet set ]", tone: "good", look: "still" };
  return { text: "[ Enter to confirm ]", tone: "dim", look: "still" };
}

function loopPiece(game: Game): Piece {
  if (game.load !== "loaded" && game.load !== "checking") return { text: "Loop: -", tone: "dim", look: "still" };
  if (!game.window) return { text: "Loop: Full video", tone: "card", look: "still" };
  const [s, e] = game.window;
  return { text: `Loop: ${s.toFixed(1)}s → ${e.toFixed(1)}s (${(e - s).toFixed(1)}s)`, tone: "card", look: "still" };
}

/** The time fields sit orange once a video is loaded, dim before that. */
const timeTone = (game: Game): Tone => (game.load === "loaded" ? "time" : "dim");

/** One settled screen, with a color and a highlight on every piece. */
export function picture(game: Game): Picture {
  const focused = (field: Game["focus"]): Look => (game.focus === field ? "hot" : "still");
  const caret = (field: Game["focus"]): string => (game.focus === field ? "▌" : "");
  return {
    title: { text: TITLE, tone: "gold", look: "still" },
    urlLabel: { text: "Video to load", tone: "dim", look: "still" },
    urlField: { text: tail(game.url + caret("url"), WIDTH), tone: "url", look: focused("url") },
    loadButton: loadButton(game),
    name: { text: head(game.title ?? "-", WIDTH), tone: game.title ? "card" : "dim", look: "still" },
    loop: loopPiece(game),
    speedMinus: { text: "-", tone: "gold", look: "still" },
    speedValue: { text: `${game.speed.toFixed(2)}x`, tone: "gold", look: "still" },
    speedPlus: { text: "+", tone: "gold", look: "still" },
    playChip: { text: "[ P = Play ]", tone: "card", look: game.armed ? "hot" : "still" },
    modeChip: { text: game.mode === "snippet" ? "[ Loop: SNIP ]" : "[ Loop: FULL ]", tone: "card", look: game.mode === "snippet" ? "hot" : "still" },
    startLabel: { text: "Start Timing: ", tone: "dim", look: "still" },
    startField: { text: tail(game.start + caret("start"), WIDTH - 14), tone: timeTone(game), look: focused("start") },
    endLabel: { text: "End Timing:   ", tone: "dim", look: "still" },
    endField: { text: tail(game.end + caret("end"), WIDTH - 14), tone: timeTone(game), look: focused("end") },
    snipButton: snipButton(game),
    tip: { text: TIP, tone: "gold", look: "still" },
    status: statusOf(game),
    bar: barOf(game),
  };
}

const speedRow = (pic: Picture): string => `${pic.speedMinus.text}  ${pic.speedValue.text}  ${pic.speedPlus.text}`;
const chipsRow = (pic: Picture): string => `${pic.playChip.text}     ${pic.modeChip.text}`;

/** The screen as plain text. The last two lines are the status bar and the hint. */
export function plain(game: Game): string {
  const pic = picture(game);
  return [
    center(pic.title.text, WIDTH),
    "",
    pic.urlLabel.text,
    pic.urlField.text,
    pic.loadButton.text,
    "",
    pic.name.text,
    pic.loop.text,
    "",
    center(speedRow(pic), WIDTH),
    "",
    center(chipsRow(pic), WIDTH),
    "",
    pic.startLabel.text + pic.startField.text,
    pic.endLabel.text + pic.endField.text,
    pic.snipButton.text,
    "",
    center(pic.tip.text, WIDTH),
    center(pic.status, WIDTH),
    BACK,
  ].join("\n");
}

function paint(codes: string, text: string): string {
  return `\x1b[${codes}m${text}\x1b[0m`;
}

/** The picture as terminal color. The status bar takes its color from the load. */
export function ansi(game: Game): string {
  const pic = picture(game);
  const ink = (piece: Piece) => paint(piece.look === "hot" ? HOT[piece.tone] : SGR[piece.tone], piece.text);
  const lines = [
    paint(SGR.gold, center(pic.title.text, WIDTH)),
    "",
    ink(pic.urlLabel),
    ink(pic.urlField),
    ink(pic.loadButton),
    "",
    ink(pic.name),
    ink(pic.loop),
    "",
    paint(SGR.gold, center(speedRow(pic), WIDTH)),
    "",
    center(`${ink(pic.playChip)}     ${ink(pic.modeChip)}`, WIDTH),
    "",
    ink(pic.startLabel) + ink(pic.startField),
    ink(pic.endLabel) + ink(pic.endField),
    ink(pic.snipButton),
    "",
    paint(SGR.gold, center(pic.tip.text, WIDTH)),
  ];
  return `\x1b[H\x1b[J${lines.join("\n")}\n${paint(BAR[pic.bar], center(pic.status, WIDTH))}\n${paint(SGR.dim, BACK)}\n`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function span(text: string, tone: Tone, look: Look): string {
  return `<span class="${tone} ${look}">${esc(text)}</span>`;
}

const wrap = (attr: string, inner: string) => `<span class="btn" ${attr}>${inner}</span>`;

/** Center colored markup by padding around its plain text, so the row never shifts. */
function centerHtml(html: string, plainText: string, width: number): string {
  const pad = Math.max(0, width - plainText.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + html + " ".repeat(pad - left);
}

/** The picture as colored text. The page paints the status bar and the hint itself. */
export function markup(game: Game): string {
  const pic = picture(game);
  const ink = (piece: Piece) => span(piece.text, piece.tone, piece.look);
  const speed = centerHtml(
    `${wrap('data-speed="-"', ink(pic.speedMinus))}  ${ink(pic.speedValue)}  ${wrap('data-speed="+"', ink(pic.speedPlus))}`,
    speedRow(pic),
    WIDTH,
  );
  const chips = centerHtml(`${wrap("data-play", ink(pic.playChip))}     ${wrap("data-mode", ink(pic.modeChip))}`, chipsRow(pic), WIDTH);
  return [
    span(center(pic.title.text, WIDTH), pic.title.tone, "still"),
    "",
    ink(pic.urlLabel),
    wrap('data-field="url"', ink(pic.urlField)),
    wrap("data-load", ink(pic.loadButton)),
    "",
    ink(pic.name),
    `<span class="loop" data-loop>${ink(pic.loop)}</span>`,
    "",
    speed,
    "",
    chips,
    "",
    ink(pic.startLabel) + wrap('data-field="start"', ink(pic.startField)),
    ink(pic.endLabel) + wrap('data-field="end"', ink(pic.endField)),
    wrap("data-snip", ink(pic.snipButton)),
    "",
    span(center(pic.tip.text, WIDTH), pic.tip.tone, "still"),
  ].join("\n");
}
