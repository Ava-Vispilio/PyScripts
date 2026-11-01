import { act, live, newPlay, type Play } from "./game";
import { ansi, coast, picture } from "./text";

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
  let play: Play = newPlay();
  let coasting = false;
  let ready = true;
  let lastSpin = 0;
  const chance = live();
  const paint = (pic: ReturnType<typeof picture>) => process.stdout.write(ansi(pic));
  paint(picture(play));

  async function playSpin() {
    ready = false;
    coasting = true;
    const before = play;
    const landed = act(before, "spin", chance);
    const list = coast(before, landed, 0);
    for (let i = 0; i < list.length; i++) {
      paint(list[i]!);
      if (i < list.length - 1) await sleep(list[i]!.wait);
    }
    play = landed;
    coasting = false;
  }

  setInterval(() => {
    if (!ready && !coasting && Date.now() - lastSpin > 180) ready = true;
  }, 40);

  stdin.on("data", (buf) => {
    const key = keyOf(buf.toString("utf8"));
    if (key === "quit") {
      stdin.setRawMode(false);
      process.exit(0);
    }
    if (key === "coinUp" || key === "coinDown") {
      if (coasting || !ready) return;
      play = act(play, key, chance);
      paint(picture(play));
      return;
    }
    if (key !== "spin") return;
    lastSpin = Date.now();
    if (coasting || !ready) return;
    void playSpin();
  });
}
