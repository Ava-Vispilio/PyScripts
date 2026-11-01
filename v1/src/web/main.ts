import { frames, newGame, reelRng, seeded, step, type Action, type Game, type Screen, type Tone } from "../engine";
import { rulesHtml } from "./rules";

const BEAT_MS = 90;

const TONE: Record<Tone, string> = {
  card: "t-card",
  fan: "t-fan",
  koi: "t-koi",
  lotus: "t-lotus",
  dragon: "t-dragon",
  wild: "t-wild",
  moon: "t-moon",
  orb: "t-orb",
  jackpot: "t-jackpot",
  door: "t-door",
  blank: "t-blank",
};

const PROMPT: Record<Action | "broke", string> = {
  spin: "Press SPIN, Enter, or Space.",
  confirm: "Jackpot! Press COLLECT, Enter, or Space.",
  coinUp: "Raise the coin.",
  coinDown: "Lower the coin.",
  broke: "Not enough credits for this bet. Lower the coin.",
};

const ACTIONS: readonly Action[] = ["spin", "confirm", "coinUp", "coinDown"];
const isAction = (s: string | undefined): s is Action => ACTIONS.some((a) => a === s);

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`page is missing #${id}`);
  return found;
}

const board = el("board");
const cells = Array.from({ length: 15 }, () => board.appendChild(document.createElement("div")));
const text = {
  grand: el("grand"),
  major: el("major"),
  minor: el("minor"),
  mini: el("mini"),
  credits: el("credits"),
  bet: el("bet"),
  win: el("win"),
  banner: el("banner"),
  prompt: el("prompt"),
};
const article = el("rules");

function render(screen: Screen) {
  screen.rows.forEach((row, r) =>
    row.forEach((tile, c) => {
      const cell = cells[r * 5 + c];
      if (!cell) return;
      cell.textContent = tile.label;
      cell.className = `tile ${TONE[tile.tone]} look-${tile.look}`;
    }),
  );
  text.grand.textContent = screen.meters.grand;
  text.major.textContent = screen.meters.major;
  text.minor.textContent = screen.meters.minor;
  text.mini.textContent = screen.meters.mini;
  text.credits.textContent = screen.credits;
  text.bet.textContent = screen.bet;
  text.win.textContent = screen.win;
  text.banner.textContent = screen.banner;
  text.prompt.textContent = PROMPT[screen.prompt];
  document.body.dataset.prompt = screen.prompt;
  document.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.disabled = busy;
  });
}

const rng = reelRng(seeded(Date.now()));
let game: Game = newGame();
let shown: Screen = frames(game)[0];
let busy = false;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function act(action: Action) {
  if (busy) return;
  const next = step(game, action, rng);
  if (next === game) return;
  const coinChanged = next.coin !== game.coin;
  game = next;
  if (coinChanged) article.innerHTML = rulesHtml(game.coin);
  busy = true;
  for (const screen of frames(game)) {
    shown = screen;
    render(screen);
    await sleep(BEAT_MS);
  }
  busy = false;
  render(shown);
}

document.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest("button") : null;
  const action = button?.dataset.action;
  if (isAction(action)) void act(action);
});

const KEYS: Record<string, Action | "go"> = {
  Enter: "go",
  " ": "go",
  c: "confirm",
  ArrowLeft: "coinDown",
  "-": "coinDown",
  ArrowRight: "coinUp",
  "+": "coinUp",
  "=": "coinUp",
};

document.addEventListener("keydown", (event) => {
  const key = KEYS[event.key];
  if (!key) return;
  event.preventDefault();
  void act(key === "go" ? (shown.prompt === "confirm" ? "confirm" : "spin") : key);
});

article.innerHTML = rulesHtml(game.coin);
render(shown);
