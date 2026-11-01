import { act, live, newPlay, type Play } from "./game";
import { ansi, coast, picture, whirl } from "./text";

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
  let held = false;
  let coasting = false;
  let ready = true;
  let tick = 0;
  let next: Play | null = null;
  let lastSpin = 0;
  let pulse: ReturnType<typeof setInterval> | undefined;
  const chance = live();
  const paint = (pic: ReturnType<typeof picture>) => process.stdout.write(ansi(pic));
  paint(picture(play));

  const stopPulse = () => {
    if (pulse) clearInterval(pulse);
    pulse = undefined;
  };

  async function land() {
    if (!held || !next) return;
    held = false;
    ready = false;
    stopPulse();
    const before = play;
    const landed = next;
    const from = tick;
    coasting = true;
    const list = coast(before, landed, from);
    for (let i = 0; i < list.length; i++) {
      paint(list[i]!);
      if (i < list.length - 1) await sleep(list[i]!.wait);
    }
    play = landed;
    next = null;
    coasting = false;
  }

  setInterval(() => {
    if (held && Date.now() - lastSpin > 180) void land();
    if (!ready && !held && !coasting && Date.now() - lastSpin > 180) ready = true;
  }, 40);

  stdin.on("data", (buf) => {
    const key = keyOf(buf.toString("utf8"));
    if (key === "quit") {
      stopPulse();
      stdin.setRawMode(false);
      process.exit(0);
    }
    if (key === "coinUp" || key === "coinDown") {
      if (held || coasting) return;
      play = act(play, key, chance);
      paint(picture(play));
      return;
    }
    if (key !== "spin") return;
    lastSpin = Date.now();
    if (coasting || held || !ready) return;
    const after = act(play, "spin", chance);
    const kind = play.phase.kind;
    const rolls = kind === "arm" || kind === "hold" || ((kind === "base" || kind === "free") && after.rows !== play.rows);
    if (!rolls) {
      play = after;
      ready = false;
      paint(picture(play));
      return;
    }
    held = true;
    next = after;
    tick = 0;
    paint(whirl(play, after, tick));
    pulse = setInterval(() => {
      tick += 1;
      if (next) paint(whirl(play, next, tick));
    }, 36);
  });
}
