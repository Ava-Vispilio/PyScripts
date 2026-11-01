import { act, live, newPlay, rulesText, type Play } from "./game";
import { plain } from "./text";

function need(id: string): HTMLElement {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement)) throw new Error("missing page");
  return el;
}

const board = need("#screen");
const bar = need("#status");
const copy = need("#rules");

let play: Play = newPlay();
const chance = live(seeded(1));

function draw(next: Play) {
  const text = plain(next);
  const cut = text.lastIndexOf("\n");
  board.textContent = text.slice(0, cut);
  bar.textContent = text.slice(cut + 1);
  copy.textContent = rulesText(next.coin);
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

draw(play);
document.addEventListener("keydown", (event) => {
  const key = event.key === "Enter" || event.key === " " ? "spin" : event.key === "ArrowRight" ? "coinUp" : event.key === "ArrowLeft" ? "coinDown" : null;
  if (!key) return;
  event.preventDefault();
  play = act(play, key, chance);
  draw(play);
});
