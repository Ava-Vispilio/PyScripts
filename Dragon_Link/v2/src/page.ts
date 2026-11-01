import { act, live, newPlay, rulesHtml, type Play } from "./game";
import { frames, markup, picture, type Picture } from "./text";

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

async function show(next: Play) {
  const list = frames(play, next);
  busy = true;
  for (let i = 0; i < list.length; i++) {
    draw(list[i]!, next.coin);
    if (i < list.length - 1) await new Promise((resolve) => setTimeout(resolve, list[i]!.wait));
  }
  play = next;
  busy = false;
}

draw(picture(play), play.coin);
document.addEventListener("keydown", (event) => {
  const key = event.key === "Enter" || event.key === " " ? "spin" : event.key === "ArrowRight" ? "coinUp" : event.key === "ArrowLeft" ? "coinDown" : null;
  if (!key || busy) return;
  event.preventDefault();
  void show(act(play, key, chance));
});
