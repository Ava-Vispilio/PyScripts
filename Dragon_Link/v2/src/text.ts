import { hotCells, type Play } from "./game";

export type Tone =
  | "card"
  | "fan"
  | "koi"
  | "lotus"
  | "dragon"
  | "wild"
  | "moon"
  | "orb"
  | "mini"
  | "minor"
  | "major"
  | "grand"
  | "door"
  | "dim"
  | "gold";

export type Look = "still" | "spin" | "win" | "lock";

export type Cell = { text: string; tone: Tone; look: Look };

export type Bar = "play" | "win" | "free" | "door" | "hold" | "major" | "grand" | "spin" | "broke";

export type Picture = {
  meters: { name: string; value: string; tone: Tone; look: Look }[];
  /** The row above the reels. Spinning, a win, and a feature callout share it. */
  spin: string;
  rows: Cell[][];
  credits: string;
  banner: string;
  bannerTone: Tone;
  feature: string;
  status: string;
  bar: Bar;
  /** How long to hold this frame before the next one, in milliseconds. */
  wait: number;
};

const SGR: Record<Tone, string> = {
  card: "37",
  fan: "33",
  koi: "38;5;209",
  lotus: "38;5;213",
  dragon: "91",
  wild: "93;1",
  moon: "93;1",
  orb: "38;5;208;1",
  mini: "32;1",
  minor: "34;1",
  major: "35;1",
  grand: "31;1",
  door: "34;1",
  dim: "90",
  gold: "33;1",
};

const LOOK: Record<Look, string> = { still: "", spin: ";2", win: "", lock: ";1" };

function commas(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

function box(label: string): string {
  return `[ ${center(label, 5)} ]`;
}

const BOARD = 53;
const WIDTHS = [13, 12, 13, 12];
const RESET = "Esc or R = Reset";

/** How long one spinning frame stays up. Orb faces turn a little slower than the reels. */
export const REEL_PACE = 36;
export const ORB_PACE = 64;

/** Four jackpot columns, the same width as the five reels. */
function spread(parts: string[]): string {
  return parts.map((part, i) => center(part, WIDTHS[i] ?? 12)).join(" ");
}

/** The value sits on the label's center. A leftover column goes to the right, so a number does not hang past its name. */
function under(label: string, value: string, width: number): string {
  const name = center(label, width);
  const mid = Math.max(0, name.indexOf(label)) + (label.length - 1) / 2;
  const at = Math.floor(mid - (value.length - 1) / 2);
  if (value.length >= width) return value;
  const left = Math.max(0, Math.min(at, width - value.length));
  return " ".repeat(left) + value + " ".repeat(width - left - value.length);
}

const REEL0 = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB"];
const REEL = ["9", "10", "J", "Q", "K", "WILD", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB"];
const FACES = ["50", "100", "150", "250", "400", "750", "MINI", "MINOR", "MAJOR"];

function creditLine(play: Play): string {
  const bet = 50 * play.coin;
  return `Credits: ${commas(play.credits)}     Bet: ${commas(bet)}     Win: ${commas(play.win)}`;
}

function toneOf(label: string): Tone {
  switch (label) {
    case "FAN":
      return "fan";
    case "KOI":
      return "koi";
    case "LOTUS":
      return "lotus";
    case "DRGN":
      return "dragon";
    case "WILD":
      return "wild";
    case "MOON":
      return "moon";
    case "ORB":
      return "orb";
    case "DOOR":
      return "door";
    case "MINI":
      return "mini";
    case "MINOR":
      return "minor";
    case "MAJOR":
      return "major";
    case "GRAND":
      return "grand";
    default:
      return /^\d+$/.test(label) ? "orb" : "card";
  }
}

function lockedAt(play: Play, r: number, c: number): boolean {
  const phase = play.phase;
  if (phase.kind !== "hold" && phase.kind !== "jackpot") return false;
  return phase.locked[r]?.[c] != null;
}

/** The screen from the video, as plain text. The last line is the status bar. */
export function plain(play: Play): string {
  const names = ["MINI", "MINOR", "MAJOR", "GRAND"];
  const meter = (coins: number) => commas(coins * play.coin);
  const head = spread(names);
  const values = [meter(1000), meter(5000), meter(play.major), meter(play.grand)].map((amount, i) => under(names[i] ?? "", amount, WIDTHS[i] ?? 12)).join(" ");
  const rows = play.rows.map((row) => row.map(box).join("  ")).join("\n");
  return [center("AUTUMN MOON", BOARD), "", head, values, "", rows, "", creditLine(play), play.feature, RESET, play.status].join("\n");
}

function callout(play: Play): { banner: string; bannerTone: Tone } {
  const phase = play.phase;
  if (phase.kind === "jackpot") {
    const name = phase.pending[0]?.name ?? "MAJOR";
    return { banner: name, bannerTone: name === "GRAND" ? "grand" : "major" };
  }
  if (phase.kind === "hold") return { banner: `HOLD & SPIN    ${phase.respins} RESPINS`, bannerTone: "orb" };
  if (phase.kind === "arm") return { banner: "HOLD & SPIN", bannerTone: "orb" };
  if (phase.kind === "doors") return { banner: "MYSTERY DOORS", bannerTone: "door" };
  if (phase.kind === "free") return { banner: `FREE GAMES    ${phase.left} LEFT`, bannerTone: "moon" };
  if (play.win > 0) return { banner: "WINNER", bannerTone: "gold" };
  return { banner: "", bannerTone: "gold" };
}

function barOf(play: Play): Bar {
  if (play.status.startsWith("Not enough")) return "broke";
  if (play.phase.kind === "jackpot") return play.phase.pending[0]?.name === "GRAND" ? "grand" : "major";
  if (play.phase.kind === "doors") return "door";
  if (play.phase.kind === "arm" || play.phase.kind === "hold") return "hold";
  if (play.phase.kind === "free") return "free";
  if (play.win > 0) return "win";
  return "play";
}

/** One settled screen, with a color and a highlight on every cell. */
export function picture(play: Play): Picture {
  const meter = (coins: number) => commas(coins * play.coin);
  const holding = play.phase.kind === "hold" || play.phase.kind === "jackpot";
  const hot = holding ? [] : hotCells(play.rows);
  const prize = play.phase.kind === "jackpot" ? play.phase.pending[0]?.name : undefined;
  const meters = (
    [
      ["MINI", meter(1000), "mini"],
      ["MINOR", meter(5000), "minor"],
      ["MAJOR", meter(play.major), "major"],
      ["GRAND", meter(play.grand), "grand"],
    ] as const
  ).map(([name, value, tone]) => ({ name, value, tone, look: prize === name ? "lock" : "still" }) as const);
  const rows = play.rows.map((line, r) =>
    line.map((label, c) => {
      const locked = lockedAt(play, r, c);
      const dim = holding && !locked;
      const look: Look = hot[r]?.[c] ? "win" : locked || (play.phase.kind === "arm" && label === "ORB") ? "lock" : "still";
      return { text: box(label), tone: dim ? "dim" : toneOf(label), look };
    }),
  );
  const note = callout(play);
  return {
    meters: [...meters],
    rows,
    credits: creditLine(play),
    feature: play.feature,
    status: play.status,
    spin: note.banner ? center(note.banner, BOARD) : "",
    bar: barOf(play),
    wait: 0,
    ...note,
  };
}

function stopsFor(rows: Play["rows"]): number[] {
  const base = [6, 9, 12, 16, 20];
  return base.map((ticks, reel) => ticks + ((rows[0]?.[reel] ?? "A").charCodeAt(0) % 3));
}

function rolling(after: Play, tick: number, stops: number[], wait: number): Picture {
  const pic = picture(after);
  const moving = stops.map((stop) => tick < stop);
  pic.rows = pic.rows.map((line, r) =>
    line.map((cell, reel) => {
      if (!moving[reel]) return { ...cell, look: "still" };
      const strip = reel === 0 ? REEL0 : REEL;
      const label = strip[(tick + r * 3 + reel * 2) % strip.length]!;
      return { text: box(label), tone: toneOf(label), look: "spin" };
    }),
  );
  return { ...pic, spin: center("SPINNING", BOARD), banner: "", bar: "spin", wait };
}

function reelSpin(before: Play, after: Play): boolean {
  const kind = before.phase.kind;
  if (kind === "arm" || kind === "hold") return true;
  if (kind === "base" || kind === "free") return after.rows !== before.rows;
  return false;
}

/** One fast frame while the player is still holding the button. */
export function whirl(before: Play, after: Play, tick: number): Picture {
  if (before.phase.kind === "arm" || before.phase.kind === "hold") return cover(after, openings(before, after), tick, ORB_PACE);
  return rolling(after, tick, [1e9, 1e9, 1e9, 1e9, 1e9], REEL_PACE);
}

/** The slowdown that starts when the player lets go. The result is already in `after`. */
export function coast(before: Play, after: Play, from: number): Picture[] {
  if (!reelSpin(before, after)) return [picture(after)];
  if (before.phase.kind === "arm" || before.phase.kind === "hold") return land(before, after);
  const remain = stopsFor(after.rows);
  const last = Math.max(...remain);
  const slowing = Array.from({ length: last }, (_, step) => rolling(after, from + step, remain.map((n) => from + n), 32 + step * 14));
  return [...slowing, picture(after)];
}

/** Reel stops and hold-and-spin landings between two plays. */
export function frames(before: Play, after: Play): Picture[] {
  return coast(before, after, 0);
}

function openings(before: Play, after: Play): [number, number][] {
  const spots: [number, number][] = [];
  after.rows.forEach((line, r) => line.forEach((label, c) => label !== before.rows[r]?.[c] && spots.push([r, c])));
  if (spots.length === 0 && before.phase.kind === "hold") {
    before.phase.locked.forEach((line, r) => line.forEach((cell, c) => cell == null && spots.push([r, c])));
  }
  return spots;
}

function land(before: Play, after: Play): Picture[] {
  const end = picture(after);
  const spots = openings(before, after);
  if (spots.length === 0) return [end];
  const miss = after.rows.every((line, r) => line.every((label, c) => label === before.rows[r]?.[c]));
  const ticks = miss ? [0, 1, 2] : [0, 1, 2, 3, 4];
  return [...ticks.map((tick) => cover(after, spots, tick, ORB_PACE + tick * 36)), end];
}

function cover(play: Play, open: [number, number][], tick: number, wait: number): Picture {
  const pic = picture(play);
  for (const [r, c] of open) {
    const row = pic.rows[r];
    const label = FACES[(tick + r + c) % FACES.length]!;
    if (row) row[c] = { text: box(label), tone: toneOf(label), look: "spin" };
  }
  return { ...pic, spin: center("HOLD & SPIN", BOARD), banner: "", bar: "spin", wait };
}

function paint(codes: string, text: string): string {
  return `\x1b[${codes}m${text}\x1b[0m`;
}

const BAR: Record<Bar, string> = {
  play: "42;97",
  win: "42;97",
  free: "44;97",
  door: "104;97",
  hold: "48;5;208;97",
  major: "45;97",
  grand: "41;97",
  spin: "43;30",
  broke: "100;37",
};

/** The picture as terminal color. The status line takes its color from the feature. */
export function ansi(pic: Picture): string {
  const width = [13, 12, 13, 12];
  const col = (text: string, tone: Tone, look: Look, i: number) => paint(SGR[tone] + LOOK[look], center(text, width[i] ?? 12));
  const meters = pic.meters.map((meter, i) => col(meter.name, meter.tone, "still", i)).join(" ");
  const values = pic.meters.map((meter, i) => paint(SGR[meter.tone] + LOOK[meter.look], under(meter.name, meter.value, WIDTHS[i] ?? 12))).join(" ");
  const ink = (cell: Cell) => (cell.look === "win" ? "30;107" : SGR[cell.tone] + LOOK[cell.look]);
  const rows = pic.rows.map((line) => line.map((cell) => paint(ink(cell), cell.text)).join("  ")).join("\n");
  const above = pic.spin ? paint(BAR[pic.bar], center(pic.spin.trim(), BOARD)) : "";
  const lines = [paint(SGR.gold, center("AUTUMN MOON", BOARD)), "", meters, values, above, rows, "", paint("37", pic.credits), paint("33", pic.feature), paint(SGR.dim, RESET)];
  return `\x1b[H\x1b[J${lines.join("\n")}\n${paint(BAR[pic.bar], center(pic.status, BOARD))}\n`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function span(text: string, tone: Tone, look: Look): string {
  return `<span class="${tone} ${look}">${esc(text)}</span>`;
}

/** The picture as colored text. The page paints the status bar itself. */
export function markup(pic: Picture): string {
  const width = [13, 12, 13, 12];
  const col = (text: string, tone: Tone, look: Look, i: number) => span(center(text, width[i] ?? 12), tone, look);
  const meters = pic.meters.map((meter, i) => col(meter.name, meter.tone, "still", i)).join(" ");
  const values = pic.meters.map((meter, i) => span(under(meter.name, meter.value, WIDTHS[i] ?? 12), meter.tone, meter.look)).join(" ");
  const rows = pic.rows.map((line) => line.map((cell) => (cell.look === "win" ? `<span class="hit">${esc(cell.text)}</span>` : span(cell.text, cell.tone, cell.look))).join("  ")).join("\n");
  const label = pic.spin.trim();
  const spin = label ? `<span class="banner ${pic.bar}">${esc(center(label, BOARD))}</span>` : "";
  return `${span(center("AUTUMN MOON", BOARD), "gold", "still")}\n\n${meters}\n${values}\n${spin}\n${rows}\n\n${span(pic.credits, "card", "still")}\n${span(pic.feature, "gold", "still")}\n${span(RESET, "dim", "still")}`;
}
