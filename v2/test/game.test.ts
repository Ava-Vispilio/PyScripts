import { expect, test } from "bun:test";
import { act, live, newPlay, scripted, type Face, type Row, type Rows } from "../src/game";
import { plain } from "../src/text";

const row = (a: string, b: string, c: string, d: string, e: string): Row => [a, b, c, d, e];
const grid = (cells: string[]): Rows => [
  row(cells[0]!, cells[1]!, cells[2]!, cells[3]!, cells[4]!),
  row(cells[5]!, cells[6]!, cells[7]!, cells[8]!, cells[9]!),
  row(cells[10]!, cells[11]!, cells[12]!, cells[13]!, cells[14]!),
];
const face = (label: string, pay: number): Face => ({ label, pay });

test("the screen is the terminal text", () => {
  const text = plain(newPlay());
  expect(text.startsWith("AUTUMN MOON\n")).toBe(true);
  expect(text).toContain("[ DRGN  ]  [ MOON  ]  [ ORB   ]  [ LOTUS ]  [ FAN   ]");
  expect(text).toContain("credits: 50,000     bet: 50     win: 0");
  expect(text.endsWith("Press Enter to spin.")).toBe(true);
});

test("three KOI pay on every line and an orb does not", () => {
  const koi = grid("KOI KOI KOI Q LOTUS KOI KOI KOI K DRGN KOI KOI KOI FAN 9".split(" "));
  const skipped = grid("9 KOI KOI KOI LOTUS 10 KOI KOI KOI DRGN J KOI KOI KOI 9".split(" "));
  const orbs = grid("ORB ORB ORB Q LOTUS 9 K 10 K DRGN 10 FAN J FAN 9".split(" "));
  expect(act(newPlay(), "spin", scripted({ windows: [koi] })).credits).toBe(50_000 - 50 + 50 * 20);
  expect(act(newPlay(), "spin", scripted({ windows: [skipped] })).credits).toBe(50_000 - 50);
  expect(act(newPlay(), "spin", scripted({ windows: [orbs] })).credits).toBe(50_000 - 50);
});

test("a wild completes a line and does not stand in for a moon", () => {
  const wild = grid("KOI WILD KOI Q LOTUS KOI WILD KOI K DRGN KOI WILD KOI FAN 9".split(" "));
  const moon = grid("MOON WILD MOON Q LOTUS ORB WILD ORB K DRGN ORB WILD 9 FAN 9".split(" "));
  expect(act(newPlay(), "spin", scripted({ windows: [wild] })).credits).toBe(50_000 - 50 + 50 * 20);
  expect(act(newPlay(), "spin", scripted({ windows: [moon] })).credits).toBe(50_000 - 50);
});

test("five moons pay 250 times the bet and start six free games", () => {
  const moons = grid("MOON MOON MOON MOON MOON 9 10 J Q K 9 10 J Q K".split(" "));
  const play = act(newPlay(), "spin", scripted({ windows: [moons] }));
  expect(play.credits).toBe(50_000 - 50 + 250 * 50);
  expect(play.phase).toEqual({ kind: "free", left: 6 });
  expect(plain(play)).toContain("6 free games left.");
});

test("doors on one free spin open onto one symbol", () => {
  const trigger = grid("MOON MOON MOON 9 10 9 10 J Q K 9 10 J Q K".split(" "));
  const doors = grid("DOOR KOI DOOR J Q FAN DOOR 10 DOOR K 9 LOTUS DOOR FAN DOOR".split(" "));
  let play = act(newPlay(), "spin", scripted({ windows: [trigger, doors], doors: ["ORB"] }));
  play = act(play, "spin", scripted({ windows: [doors], doors: ["ORB"] }));
  expect(plain(play)).toContain("[ DOOR  ]");
  expect(play.status).toBe("Press Enter to open the doors.");
  play = act(play, "spin", scripted({}));
  expect(plain(play)).not.toContain("DOOR");
  expect(play.rows.flat().filter((symbol) => symbol === "ORB")).toHaveLength(6);
  expect(play.status).toBe("Six orbs landed. Press Enter to start Hold & Spin.");
});

test("a new orb resets the respin count and fifteen orbs pay Grand", () => {
  const six = grid("ORB ORB ORB ORB ORB ORB 9 10 J Q K 9 10 J Q".split(" "));
  const faces = [1, 2, 1, 5, 1, 1].map((times) => face(String(times * 50), times * 50));
  let play = act(newPlay(), "spin", scripted({ windows: [six], faces }));
  play = act(play, "spin", scripted({ faces }));
  expect(play.phase).toMatchObject({ kind: "hold", respins: 3 });
  expect(play.status).toBe("Press Enter for hold-and-spin respin 3.");
  play = act(play, "spin", scripted({ locks: [[true, false, false, false, false, false, false, false, false]], faces: [face("100", 100)] }));
  expect(play.phase).toMatchObject({ kind: "hold", respins: 3 });
  const full = grid(Array(15).fill("ORB"));
  const many = Array.from({ length: 15 }, () => face("50", 50));
  let grand = act(newPlay(), "spin", scripted({ windows: [full], faces: many }));
  grand = act(grand, "spin", scripted({ faces: many }));
  expect(grand.status.startsWith("GRAND ")).toBe(true);
  expect(grand.status.endsWith("Press Enter to collect.")).toBe(true);
});

test("the same seed plays the same game", () => {
  const rng = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  };
  const left = act(newPlay(), "spin", live(rng(7)));
  const right = act(newPlay(), "spin", live(rng(7)));
  expect(left.rows).toEqual(right.rows);
  expect(left.credits).toBe(right.credits);
});
