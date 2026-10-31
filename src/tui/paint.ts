import type { Action, Screen, Tile, Tone } from "../engine";

const SGR = (codes: string, text: string) => `\x1b[${codes}m${text}\x1b[0m`;

const TONE: Record<Tone, string> = {
  card: "37",
  fan: "33",
  koi: "91",
  lotus: "95",
  dragon: "91",
  wild: "93;1",
  moon: "93;1",
  orb: "38;5;208;1",
  jackpot: "35;1",
  door: "34;1",
  blank: "90",
};

const LOOK: Record<Tile["look"], string> = { still: "", spinning: ";2", locked: ";1", win: ";7" };

const HINT: Record<Action | "broke", string> = {
  spin: "ENTER/SPACE spin   ←/→ or -/+ coin (base game)   Q quit",
  confirm: "ENTER/SPACE or C collect the jackpot   Q quit",
  coinUp: "→ or + raises the coin",
  coinDown: "← or - lowers the coin",
  broke: "Out of credits for this bet. Lower the coin or Q to quit.",
};

const WIDTH = 8;

function cell(tile: Tile): string {
  const text = tile.look === "spinning" ? "░".repeat(WIDTH - 2) : tile.label;
  const left = Math.floor((WIDTH - text.length) / 2);
  const padded = " ".repeat(Math.max(0, left)) + text + " ".repeat(Math.max(0, WIDTH - left - text.length));
  return SGR(TONE[tile.tone] + LOOK[tile.look], padded);
}

/** One full frame, drawn from the top-left corner. */
export function paint(screen: Screen): string {
  const rule = `  +${`${"-".repeat(WIDTH)}+`.repeat(5)}`;
  const { grand, major, minor, mini } = screen.meters;
  const lines = [
    SGR("33;1", "  AUTUMN MOON  ·  unofficial parody, no real wagering"),
    "",
    `  ${SGR("31;1", `GRAND ${grand}`)}   ${SGR("35;1", `MAJOR ${major}`)}   ${SGR("34;1", `MINOR ${minor}`)}   ${SGR("32;1", `MINI ${mini}`)}`,
    "",
    rule,
    ...screen.rows.map((row) => `  |${row.map(cell).join("|")}|`),
    rule,
    "",
    `  CREDITS ${SGR("1", screen.credits)}   BET ${SGR("1", screen.bet)}   WIN ${SGR("1", screen.win)}`,
    `  ${SGR("93;1", screen.banner)}`,
    `  ${SGR("2", HINT[screen.prompt])}`,
  ];
  return `\x1b[H${lines.map((line) => `${line}\x1b[K`).join("\n")}\x1b[J`;
}
