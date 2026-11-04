import { awaitingReply, newGame, nudgeCell, nudgeOption, stage, step, type Action, type Dir, type Game } from "./game";
import { bestCell } from "./ai";
import { markup, newView, picture, BACK } from "./text";

function need(id: string): HTMLElement {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement)) throw new Error("missing page");
  return el;
}

const board = need("#screen");
const bar = need("#status");
const back = need("#back");

let game = opened();
let view = newView();
let busy = false;
const THINKING = 1000;

const ARROWS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

function opened(): Game {
  const name = new URLSearchParams(location.search).get("state");
  return (name && stage(name)) || newGame();
}

function draw() {
  const pic = picture(game, view);
  board.innerHTML = markup(pic);
  bar.textContent = pic.status;
  bar.className = pic.bar;
  back.textContent = pic.screen === "board" ? BACK : "";
  back.hidden = pic.screen !== "board";
}

function think() {
  if (!awaitingReply(game)) return;
  busy = true;
  setTimeout(() => {
    if (awaitingReply(game)) game = step(game, { type: "reply", cell: bestCell(game.board) });
    busy = false;
    draw();
  }, THINKING);
}

function act(action: Action) {
  if (busy && action.type !== "back") return;
  busy = false;
  game = step(game, action);
  if (action.type !== "place" && action.type !== "reply") view = newView();
  draw();
  think();
}

function enter() {
  const phase = game.phase;
  if (phase.kind === "select") act(view.option === 0 ? { type: "chooseSingle" } : { type: "chooseDouble" });
  else if (phase.kind === "playing") act({ type: "place", cell: view.cell });
  else act({ type: "restart" });
}

draw();
think();

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const dir = ARROWS[event.key];
  if (dir) {
    event.preventDefault();
    if (game.phase.kind === "select") view.option = nudgeOption(view.option);
    else if (game.phase.kind === "playing") view.cell = nudgeCell(view.cell, dir);
    else return;
    draw();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    act({ type: "back" });
    return;
  }
  if ((event.key === "r" || event.key === "R") && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    act({ type: "restart" });
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    enter();
  }
});

document.addEventListener("click", (event) => {
  if (busy || !(event.target instanceof Element)) return;
  const option = event.target.closest("[data-option]");
  if (option instanceof HTMLElement) {
    view.option = Number(option.dataset.option);
    if (game.phase.kind === "select") enter();
    return;
  }
  const cell = event.target.closest("[data-cell]");
  if (cell instanceof HTMLElement) {
    view.cell = Number(cell.dataset.cell);
    if (game.phase.kind === "playing") enter();
  }
});

(window as unknown as { ticState: (name: string) => void }).ticState = (name) => {
  if (busy) return;
  const next = stage(name);
  if (!next) return;
  game = next;
  view = newView();
  draw();
  think();
};
