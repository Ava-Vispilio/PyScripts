import { describe, expect, test } from "bun:test";
import { current, hops, initial, step, HOP_CAP, type State } from "../src/game";

function racing(): State {
  return step(initial(), { type: "start", start: "Earth", end: "Moon" });
}

describe("start", () => {
  test("moves setup to racing with the start page on the path", () => {
    const s = racing();
    expect(s.phase).toBe("racing");
    expect(s.start).toBe("Earth");
    expect(s.end).toBe("Moon");
    expect(s.path).toEqual(["Earth"]);
    expect(s.armed).toBe(false);
    expect(hops(s)).toBe(0);
    expect(current(s)).toBe("Earth");
  });

  test("refuses empty titles, equal titles, and starts outside setup", () => {
    const i = initial();
    expect(step(i, { type: "start", start: "", end: "Moon" })).toBe(i);
    expect(step(i, { type: "start", start: "Earth", end: "" })).toBe(i);
    expect(step(i, { type: "start", start: "Earth", end: "Earth" })).toBe(i);
    const r = racing();
    expect(step(r, { type: "start", start: "Earth", end: "Moon" })).toBe(r);
  });
});

describe("follow", () => {
  test("appends a hop and arms only on the first follow", () => {
    let s = racing();
    s = step(s, { type: "follow", title: "Country" });
    expect(s.path).toEqual(["Earth", "Country"]);
    expect(s.armed).toBe(true);
    expect(s.phase).toBe("racing");
    s = step(s, { type: "follow", title: "Nation" });
    expect(s.armed).toBe(true);
    expect(hops(s)).toBe(2);
    expect(current(s)).toBe("Nation");
  });

  test("wins on the end title", () => {
    const s = step(racing(), { type: "follow", title: "Moon" });
    expect(s.phase).toBe("won");
    expect(hops(s)).toBe(1);
  });

  test("is dead outside racing and on an empty title", () => {
    const i = initial();
    expect(step(i, { type: "follow", title: "Moon" })).toBe(i);
    const r = racing();
    expect(step(r, { type: "follow", title: "" })).toBe(r);
    const w = step(r, { type: "follow", title: "Moon" });
    expect(step(w, { type: "follow", title: "Earth" })).toBe(w);
  });

  test("loses on the cap hop when it is not the end page", () => {
    let s = racing();
    for (let i = 1; i < HOP_CAP; i++) s = step(s, { type: "follow", title: `P${i}` });
    expect(s.phase).toBe("racing");
    expect(hops(s)).toBe(HOP_CAP - 1);
    s = step(s, { type: "follow", title: `P${HOP_CAP}` });
    expect(s.phase).toBe("lost");
    expect(hops(s)).toBe(HOP_CAP);
    expect(current(s)).toBe(`P${HOP_CAP}`);
  });

  test("the cap hop still wins when it is the end page", () => {
    let s = racing();
    for (let i = 1; i < HOP_CAP; i++) s = step(s, { type: "follow", title: `P${i}` });
    s = step(s, { type: "follow", title: "Moon" });
    expect(s.phase).toBe("won");
  });
});

describe("back", () => {
  test("pops the path and drops the hop count", () => {
    let s = step(racing(), { type: "follow", title: "Country" });
    s = step(s, { type: "follow", title: "Nation" });
    s = step(s, { type: "back" });
    expect(s.path).toEqual(["Earth", "Country"]);
    expect(hops(s)).toBe(1);
    expect(s.phase).toBe("racing");
  });

  test("is dead at the start of the path, outside racing, and after a win", () => {
    const r = racing();
    expect(step(r, { type: "back" })).toBe(r);
    const i = initial();
    expect(step(i, { type: "back" })).toBe(i);
    const w = step(r, { type: "follow", title: "Moon" });
    expect(step(w, { type: "back" })).toBe(w);
  });

  test("is dead after a loss", () => {
    let s = racing();
    for (let i = 0; i < HOP_CAP; i++) s = step(s, { type: "follow", title: `P${i + 1}` });
    expect(s.phase).toBe("lost");
    expect(step(s, { type: "back" })).toBe(s);
  });
});
