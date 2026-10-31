import { frames, newGame, reelRng, step, type Action, type Game, type Screen } from "../engine";
import { paint } from "./paint";

const BEAT_MS = 90;

/** "go" is whatever the screen currently prompts for: spin, or confirm during a jackpot. */
const KEYS: Record<string, Action | "go" | "quit"> = {
  "\r": "go",
  " ": "go",
  c: "confirm",
  "\x1b[D": "coinDown",
  "-": "coinDown",
  "\x1b[C": "coinUp",
  "+": "coinUp",
  "=": "coinUp",
  q: "quit",
  "\x03": "quit",
};

const write = (text: string) => process.stdout.write(text);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function quit(): never {
  process.stdin.setRawMode(false);
  write("\x1b[?25h\n");
  process.exit(0);
}

if (!process.stdin.isTTY) {
  console.error("Autumn Moon needs an interactive terminal.");
  process.exit(1);
}

const rng = reelRng(Math.random);
let game: Game = newGame();
let shown: Screen = frames(game)[0];

process.stdin.setRawMode(true);
write("\x1b[2J\x1b[?25l");
write(paint(shown));

for await (const chunk of process.stdin) {
  const key = KEYS[String(chunk)];
  if (!key) continue;
  if (key === "quit") quit();
  const action = key === "go" ? (shown.prompt === "confirm" ? "confirm" : "spin") : key;
  const next = step(game, action, rng);
  if (next === game) continue;
  game = next;
  for (const screen of frames(game)) {
    shown = screen;
    write(paint(screen));
    await sleep(BEAT_MS);
  }
}
