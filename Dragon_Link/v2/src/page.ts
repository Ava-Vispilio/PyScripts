import { act, live, newPlay, rulesHtml, stage, type Play } from "./game";
import { coast, markup, picture, type Picture } from "./text";

function need(id: string): HTMLElement {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement)) throw new Error("missing page");
  return el;
}

const board = need("#screen");
const bar = need("#status");
const copy = need("#rules");

let play: Play = opened();
let busy = false;
let down = false;
let shownCoin = -1;
const chance = live(seeded(1));

function opened(): Play {
  const name = new URLSearchParams(location.search).get("state");
  return (name && stage(name)) || newPlay();
}

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

async function playSpin(next: Play) {
  busy = true;
  const list = coast(play, next, 0);
  for (let i = 0; i < list.length; i++) {
    draw(list[i]!, next.coin);
    if (i < list.length - 1) await new Promise((resolve) => setTimeout(resolve, list[i]!.wait));
  }
  play = next;
  busy = false;
}

function press(key: "spin" | "coinUp" | "coinDown") {
  if (busy || down) return;
  if (key !== "spin") {
    play = act(play, key, chance);
    draw(picture(play), play.coin);
    return;
  }
  down = true;
  void playSpin(act(play, "spin", chance));
}

draw(picture(play), play.coin);

document.addEventListener("keydown", (event) => {
  const key = event.key === "Enter" || event.key === " " ? "spin" : event.key === "ArrowRight" ? "coinUp" : event.key === "ArrowLeft" ? "coinDown" : null;
  if (!key || event.repeat) return;
  event.preventDefault();
  press(key);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Enter" || event.key === " ") down = false;
});

window.addEventListener("blur", () => {
  down = false;
});

(window as unknown as { autumnState: (name: string) => void }).autumnState = (name) => {
  if (down || busy) return;
  const next = stage(name);
  if (!next) return;
  play = next;
  draw(picture(play), play.coin);
};
