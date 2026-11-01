import { act, live, newPlay, type Play } from "./game";
import { plain } from "./text";

const paint = (play: Play) => {
  const text = plain(play);
  const cut = text.lastIndexOf("\n");
  const body = text.slice(0, cut);
  const status = text.slice(cut + 1).padEnd(72);
  process.stdout.write(`\x1b[H\x1b[J\x1b[33m${body}\x1b[0m\n\x1b[41;97m${status}\x1b[0m\n`);
};

const keyOf = (key: string): "spin" | "coinUp" | "coinDown" | "quit" | null => {
  if (key === "\r" || key === "\n" || key === " ") return "spin";
  if (key === "\x1b[C" || key === "+" || key === "=") return "coinUp";
  if (key === "\x1b[D" || key === "-" || key === "_") return "coinDown";
  if (key === "q" || key === "Q" || key === "\x03") return "quit";
  return null;
};

if (import.meta.main) {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  let play = newPlay();
  const chance = live();
  paint(play);
  stdin.on("data", (buf) => {
    const key = keyOf(buf.toString("utf8"));
    if (key === "quit") {
      stdin.setRawMode(false);
      process.exit(0);
    }
    if (key === "spin" || key === "coinUp" || key === "coinDown") {
      play = act(play, key, chance);
      paint(play);
    }
  });
}
