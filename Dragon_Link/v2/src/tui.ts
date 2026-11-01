import { act, live, newPlay, type Play } from "./game";
import { ansi, frames, picture } from "./text";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  let busy = false;
  const chance = live();
  process.stdout.write(ansi(picture(play)));
  stdin.on("data", (buf) => {
    void onKey(buf.toString("utf8"));
  });

  async function onKey(raw: string) {
    const key = keyOf(raw);
    if (key === "quit") {
      stdin.setRawMode(false);
      process.exit(0);
    }
    if (busy || (key !== "spin" && key !== "coinUp" && key !== "coinDown")) return;
    const next = act(play, key, chance);
    const list = frames(play, next);
    busy = true;
    for (let i = 0; i < list.length; i++) {
      process.stdout.write(ansi(list[i]!));
      if (i < list.length - 1) await sleep(list[i]!.wait);
    }
    play = next;
    busy = false;
  }
}
