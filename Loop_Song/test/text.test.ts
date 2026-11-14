import { expect, test } from "bun:test";
import { stage, step, type Game } from "../src/game";
import { ansi, backOf, markup, plain, WIDTH } from "../src/text";

const STAGES = ["", "checking", "loaded", "snippet", "bad", "notfound", "badtimes"];
const games = (): [string, Game][] => STAGES.map((name) => [name, stage(name)!]);

test("the screen holds a fixed height for every stage", () => {
  for (const [name, game] of games()) {
    const lines = plain(game).split("\n");
    expect(lines.length).toBe(19);
    for (const line of lines) expect(line.length, `${name}: ${line}`).toBeLessThanOrEqual(WIDTH);
  }
});

test("the empty form lays out as planned", () => {
  const lines = plain(stage("")!).split("\n");
  expect(lines[2]).toBe("Video to load:");
  expect(lines[3]).toBe("▌");
  expect(lines[4]).toBe("[ Enter to load ]");
  expect(lines[6]).toBe("-");
  expect(lines[7]).toBe("Loop: -");
  expect(lines[9]).toBe("Start / End Timings");
  expect(lines[10]).toBe("Start: ");
  expect(lines[11]).toBe("End:   ");
  expect(lines[12]).toBe("[ Enter to confirm ]");
  expect(lines[14]).toBe("  [ Play ]  [ 1.00x ]  [ Loop: FULL ]  ");
  expect(lines[16]).toBe("↑↓ = Move, Enter = Select, Esc = Reset ");
  expect(lines[17]).toBe("              Type a link              ");
  expect(lines[18]).toBe(backOf);
});

test("the reset hint is a constant", () => {
  expect(backOf).toBe("Esc = Reset, Ctrl-C = Quit");
});

test("a loaded snippet fills the rows it owns and touches nothing else", () => {
  const lines = plain(stage("snippet")!).split("\n");
  expect(lines[3]).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(lines[4]).toBe("[ Enter to choose another song ]");
  expect(lines[6]).toBe("Test Video");
  expect(lines[7]).toBe("Loop: 12.0s → 18.0s (6.0s)");
  expect(lines[10]).toBe("Start: 12");
  expect(lines[11]).toBe("End:   18");
  expect(lines[12]).toBe("[ Enter to edit ]");
  expect(lines[17]).toBe("              Snippet set              ");
});

test("the failure states say so on their button and their bar", () => {
  expect(plain(stage("bad")!).split("\n")[4]).toBe("[ Bad link ]");
  expect(plain(stage("notfound")!).split("\n")[4]).toBe("[ Not found ]");
  const bad = plain(stage("badtimes")!).split("\n");
  expect(bad[12]).toBe("[ Bad times ]");
  expect(bad[17]).toBe("               Bad times               ");
});

test("the caret rides a focused field it can edit, and only that field", () => {
  // stage("loaded") hands the caret to Start after the URL seals.
  let game = stage("loaded")!;
  let lines = plain(game).split("\n");
  expect(lines[3]).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(lines[10]).toBe("Start: ▌");
  game = step(game, { type: "focus", spot: "end" });
  lines = plain(game).split("\n");
  expect(lines[10]).toBe("Start: ");
  expect(lines[11]).toBe("End:   ▌");
  // A sealed URL and a locked pair lose the caret even when focused.
  game = step(game, { type: "focus", spot: "start" });
  game = step(game, { type: "accept" });
  game = typeInto(game, "start", "12");
  game = typeInto(game, "end", "18");
  game = step(game, { type: "accept" });
  game = step(game, { type: "focus", spot: "url" });
  lines = plain(game).split("\n");
  expect(lines[3]).toBe("https://youtu.be/dQw4w9WgXcQ");
  game = step(game, { type: "focus", spot: "end" });
  expect(plain(game).split("\n")[11]).toBe("End:   18");
});

const typeInto = (game: Game, spot: "start" | "end", text: string): Game => {
  let g = step(game, { type: "focus", spot });
  for (const ch of text) g = step(g, { type: "type", ch });
  return g;
};

test("a long draft keeps its tail and the video name keeps its head", () => {
  let game = step(stage("loaded")!, { type: "focus", spot: "url" });
  game = step(game, { type: "accept" }); // unlock the seal to edit again
  for (let i = 0; i < 12; i++) game = step(game, { type: "backspace" });
  for (const ch of "0123456789012345678901234567890123456789") game = step(game, { type: "type", ch });
  const line = plain(game).split("\n")[3]!;
  expect(line.length).toBe(WIDTH);
  expect(line.endsWith("▌")).toBe(true);
  const named = step(game, { type: "titled", title: "A Very Long Video Name That Runs Past The Board" });
  const name = plain(named).split("\n")[6]!;
  expect(name.length).toBe(WIDTH);
  expect(name.endsWith("…")).toBe(true);
});

test("the ansi frame clears, colors the bar, and dims the hint", () => {
  const out = ansi(stage("snippet")!);
  expect(out.startsWith("\x1b[H\x1b[J")).toBe(true);
  expect(out).toContain("\x1b[42;97m");
  expect(out.endsWith(`\x1b[90m${backOf}\x1b[0m\n`)).toBe(true);
  expect(out).toContain("\x1b[38;5;208;1m"); // the orange time fields
  expect(ansi(stage("bad")!)).toContain("\x1b[41;97m");
});

test("the markup carries a click target for every control", () => {
  const out = markup(stage("snippet")!);
  for (const attr of ['data-field="url"', 'data-field="start"', 'data-field="end"', "data-load", "data-snip", "data-play", "data-speed", "data-mode", "data-loop"])
    expect(out).toContain(attr);
  expect(out).not.toContain("Type a link"); // the page paints the bar itself
});
