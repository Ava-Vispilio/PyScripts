import { act, live, newPlay, rulesHtml, type Play } from "./game";
import { coast, markup, picture, whirl, type Picture } from "./text";

function need(id: string): HTMLElement {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement)) throw new Error("missing page");
  return el;
}

const board = need("#screen");
const bar = need("#status");
const copy = need("#rules");

let play: Play = newPlay();
let busy = false;
let down = false;
let tick = 0;
let pending: Play | null = null;
let pulse = 0;
let shownCoin = -1;
const chance = live(seeded(1));

function draw(pic: Picture, coin: number) {
  board.innerHTML = markup(pic);
  bar.textContent = pic.status;
  bar.className = pic.bar;
  if (coin !== shownCoin) {
    copy.innerHTML = rulesHtml(coin);
    shownCoin = coin;
  }
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function stopPulse() {
  window.clearInterval(pulse);
  pulse = 0;
}

async function land() {
  if (!pending) return;
  const before = play;
  const landed = pending;
  const from = tick;
  pending = null;
  down = false;
  stopPulse();
  busy = true;
  const list = coast(before, landed, from);
  for (let i = 0; i < list.length; i++) {
    draw(list[i]!, landed.coin);
    if (i < list.length - 1) await new Promise((resolve) => setTimeout(resolve, list[i]!.wait));
  }
  play = landed;
  busy = false;
}

function press(key: "spin" | "coinUp" | "coinDown") {
  if (key !== "spin") {
    if (down || busy) return;
    play = act(play, key, chance);
    draw(picture(play), play.coin);
    return;
  }
  if (down || busy) return;
  const after = act(play, "spin", chance);
  const kind = play.phase.kind;
  const rolls = kind === "arm" || kind === "hold" || ((kind === "base" || kind === "free") && after.rows !== play.rows);
  if (!rolls) {
    play = after;
    draw(picture(play), play.coin);
    return;
  }
  down = true;
  pending = after;
  tick = 0;
  draw(whirl(play, after, tick), after.coin);
  pulse = window.setInterval(() => {
    tick += 1;
    if (pending) draw(whirl(play, pending, tick), pending.coin);
  }, 36);
}

draw(picture(play), play.coin);

document.addEventListener("keydown", (event) => {
  const key = event.key === "Enter" || event.key === " " ? "spin" : event.key === "ArrowRight" ? "coinUp" : event.key === "ArrowLeft" ? "coinDown" : null;
  if (!key || event.repeat) return;
  event.preventDefault();
  press(key);
});

document.addEventListener("keyup", (event) => {
  if ((event.key === "Enter" || event.key === " ") && down) void land();
});

window.addEventListener("blur", () => {
  if (down) void land();
});
