import { awaitingReply, newGame, nudgeCell, nudgeOption, stage, step, type Action, type Dir, type Game } from "./game";
import { bestCell } from "./ai";
import { ansi, newView, picture } from "./text";

const THINKING = 1000;

const ARROWS: Record<string, Dir> = { "\x1b[A": "up", "\x1b[B": "down", "\x1b[C": "right", "\x1b[D": "left" };

type Key = { kind: "arrow"; dir: Dir } | { kind: "enter" } | { kind: "restart" } | { kind: "back" } | { kind: "quit" };

function keyOf(press: string): Key | null {
  const dir = ARROWS[press];
  if (dir) return { kind: "arrow", dir };
  if (press === "\r" || press === "\n" || press === " ") return { kind: "enter" };
  if (press === "r" || press === "R") return { kind: "restart" };
  if (press === "\x1b") return { kind: "back" };
  if (press === "q" || press === "Q" || press === "\x03") return { kind: "quit" };
  return null;
}

/** The terminal hands us whatever arrived, so a fast arrow-plus-Enter is one chunk. */
export function pressesOf(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\x1b" && text.charAt(i + 1) === "[" && text.charAt(i + 2) >= "A" && text.charAt(i + 2) <= "D") {
      out.push(text.slice(i, i + 3));
      i += 3;
    } else {
      out.push(text.charAt(i));
      i += 1;
    }
  }
  return out;
}

if (import.meta.main) {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  let game: Game = stage(process.argv[2] ?? "") ?? newGame();
  let view = newView();
  const paint = () => process.stdout.write(ansi(picture(game, view)));

  /** The engine never sleeps: the pause lives here, and the fire-time check keeps a stale timer harmless. */
  function wake() {
    if (!awaitingReply(game)) return;
    setTimeout(() => {
      if (awaitingReply(game)) game = step(game, { type: "reply", cell: bestCell(game.board) });
      paint();
    }, THINKING);
  }

  function act(action: Action) {
    game = step(game, action);
    if (action.type !== "place" && action.type !== "reply") view = newView();
    paint();
    wake();
  }

  function enter() {
    const phase = game.phase;
    if (phase.kind === "select") act(view.option === 0 ? { type: "chooseSingle" } : { type: "chooseDouble" });
    else if (phase.kind === "playing") act({ type: "place", cell: view.cell });
    else act({ type: "restart" });
  }

  paint();
  wake();

  stdin.on("data", (buf) => {
    for (const press of pressesOf(buf.toString("utf8"))) {
      const key = keyOf(press);
      if (!key) continue;
      if (key.kind === "quit") {
        stdin.setRawMode(false);
        process.exit(0);
      }
      if (key.kind === "arrow") {
        if (game.phase.kind === "select") view.option = nudgeOption(view.option);
        else if (game.phase.kind === "playing") view.cell = nudgeCell(view.cell, key.dir);
        else continue;
        paint();
        continue;
      }
      if (key.kind === "enter") enter();
      else if (key.kind === "restart") act({ type: "restart" });
      else act({ type: "back" });
    }
  });
}
