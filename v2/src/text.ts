import type { Play } from "./game";

const WIDTH = 14;

function commas(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function cell(label: string): string {
  return `[ ${label.padEnd(5)} ]`;
}

/** The screen from the video, as plain text. The last line is the red bar. */
export function plain(play: Play): string {
  const bet = 50 * play.coin;
  const meter = (coins: number) => commas(coins * play.coin);
  const head = ["MINI", "MINOR", "MAJOR", "GRAND"].map((name) => name.padEnd(WIDTH)).join("");
  const values = [meter(1000), meter(5000), meter(play.major), meter(play.grand)]
    .map((value) => value.padEnd(WIDTH))
    .join("");
  const rows = play.rows.map((row) => row.map(cell).join("  ")).join("\n");
  return [
    "AUTUMN MOON",
    "",
    head.trimEnd(),
    values.trimEnd(),
    "",
    rows,
    "",
    `credits: ${commas(play.credits)}     bet: ${commas(bet)}     win: ${commas(play.win)}`,
    play.feature,
    play.status,
  ].join("\n");
}
