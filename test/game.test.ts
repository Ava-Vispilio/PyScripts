import { describe, expect, test } from "bun:test";
import { PAYTABLE, frames, newGame, reelRng, seeded, step, type Game } from "../src/engine";
import { LINES } from "../src/engine/symbols";
import { credit, doors, labels, rigged, window } from "../src/engine/testing";

const BET = 50;
const credits = (game: Game): number => game.credits;
const START = credits(newGame());
const DEAD = "9 Q 9 Q KOI / 10 K 10 K LOTUS / J FAN J FAN DRGN";
const THREE_MOONS = "MOON 9 MOON 10 MOON / 9 J Q K FAN / 10 J Q K FAN";

const settled = (game: Game) => {
  const shown = frames(game);
  let last = shown[0];
  for (const screen of shown) last = screen;
  return last;
};

function freeGames(): Game {
  const g = step(newGame(), "spin", rigged({ base: [window(THREE_MOONS)] }));
  expect(g.mode).toMatchObject({ kind: "free", left: 6 });
  return g;
}

describe("lines", () => {
  test("there are fifty distinct lines", () => {
    expect(new Set(LINES.map((line) => line.join())).size).toBe(50);
  });

  test("three KOI from reel 0 pay on every line", () => {
    const rng = rigged({ base: [window("KOI KOI KOI Q LOTUS / KOI KOI KOI K DRGN / KOI KOI KOI FAN 9")] });
    const g = step(newGame(), "spin", rng);
    expect(credits(g)).toBe(START - BET + 50 * PAYTABLE.lines.KOI[3]);
    expect(g.mode.kind).toBe("base");
  });

  test("a run that skips reel 0 pays nothing", () => {
    const rng = rigged({ base: [window("9 KOI KOI KOI LOTUS / 10 KOI KOI KOI DRGN / J KOI KOI KOI 9")] });
    expect(credits(step(newGame(), "spin", rng))).toBe(START - BET);
  });

  test("orbs on a line do not pay", () => {
    const rng = rigged({ base: [window("ORB ORB ORB Q LOTUS / 9 K 10 K DRGN / 10 FAN J FAN 9")] });
    const g = step(newGame(), "spin", rng);
    expect(credits(g)).toBe(START - BET);
    expect(g.mode.kind).toBe("base");
  });

  test("a wild completes a line", () => {
    const rng = rigged({ base: [window("KOI WILD KOI Q LOTUS / KOI WILD KOI K DRGN / KOI WILD KOI FAN 9")] });
    expect(credits(step(newGame(), "spin", rng))).toBe(START - BET + 50 * PAYTABLE.lines.KOI[3]);
  });

  test("a wild does not stand in for a moon or an orb", () => {
    const rng = rigged({ base: [window("MOON WILD MOON Q LOTUS / ORB WILD ORB K DRGN / ORB WILD 9 FAN 9")] });
    const g = step(newGame(), "spin", rng);
    expect(credits(g)).toBe(START - BET);
    expect(g.mode.kind).toBe("base");
  });

  test("a window cannot put WILD on reel 0", () => {
    expect(() => window("WILD 9 9 9 9 / 9 9 9 9 9 / 9 9 9 9 9")).toThrow();
  });
});

describe("moons and free games", () => {
  test("five moons pay 250 times the bet and start six free games", () => {
    const rng = rigged({ base: [window("MOON 9 10 J MOON / 9 MOON Q MOON K / 10 J MOON Q K")] });
    const g = step(newGame(), "spin", rng);
    expect(credits(g)).toBe(START - BET + 250 * BET);
    expect(g.mode).toMatchObject({ kind: "free", left: 6 });
  });

  test("three moons start six free games and three more add six", () => {
    const g = freeGames();
    expect(credits(g)).toBe(START - BET + PAYTABLE.moons[3]);
    const more = step(g, "spin", rigged({ free: [doors(THREE_MOONS)] }));
    expect(more.mode).toMatchObject({ kind: "free", left: 11 });
    expect(credits(more)).toBe(g.credits + PAYTABLE.moons[3]);
  });

  test("free spins cost nothing and the last one returns to base", () => {
    let g = freeGames();
    const before = credits(g);
    const rng = rigged({ free: Array.from({ length: 6 }, () => doors(DEAD)) });
    for (let i = 0; i < 5; i++) g = step(g, "spin", rng);
    expect(g.mode).toMatchObject({ kind: "free", left: 1 });
    g = step(g, "spin", rng);
    expect(g.mode.kind).toBe("base");
    expect(credits(g)).toBe(before);
  });

  test("every door on one free spin opens onto the same scripted face", () => {
    const g = freeGames();
    const rng = rigged({
      free: [doors("DOOR DOOR DOOR Q LOTUS / DOOR DOOR DOOR K DRGN / DOOR DOOR DOOR FAN 9")],
      doors: ["KOI"],
    });
    const next = step(g, "spin", rng);
    expect(labels(next).map((row) => row.slice(0, 3))).toEqual([
      ["KOI", "KOI", "KOI"],
      ["KOI", "KOI", "KOI"],
      ["KOI", "KOI", "KOI"],
    ]);
    expect(credits(next)).toBe(g.credits + 50 * PAYTABLE.lines.KOI[3]);
  });
});

describe("hold and spin", () => {
  const SIX_ORBS = "ORB ORB 9 Q KOI / ORB ORB 10 K LOTUS / ORB ORB J FAN DRGN";

  test("six orbs from doors hold with three respins, a new orb resets to three, and free games resume", () => {
    let g = freeGames();
    g = step(
      g,
      "spin",
      rigged({
        free: [doors("DOOR DOOR 9 J K / DOOR DOOR Q K FAN / DOOR DOOR J Q K")],
        doors: ["ORB"],
        orbs: [credit(1), credit(2), credit(1), credit(5), credit(1), credit(1)],
      }),
    );
    expect(g.mode).toMatchObject({ kind: "hold", respins: 3, resume: { kind: "free", left: 5 } });

    const before = g.credits;
    const rng = rigged({ respins: [[], [[2, 0]], [], [], []], orbs: [credit(3)] });
    g = step(g, "spin", rng);
    expect(g.mode).toMatchObject({ kind: "hold", respins: 2 });
    g = step(g, "spin", rng);
    expect(g.mode).toMatchObject({ kind: "hold", respins: 3 });
    g = step(g, "spin", rng);
    g = step(g, "spin", rng);
    expect(g.mode).toMatchObject({ kind: "hold", respins: 1 });
    expect(credits(g)).toBe(before);
    g = step(g, "spin", rng);

    expect(g.mode).toMatchObject({ kind: "free", left: 5 });
    expect(credits(g)).toBe(before + (1 + 2 + 1 + 5 + 1 + 1 + 3) * BET);
    expect(labels(g)).toEqual([
      ["50", "250", "150", "", ""],
      ["100", "50", "", "", ""],
      ["50", "50", "", "", ""],
    ]);
  });

  test("a hold started in base returns to base", () => {
    const rng = rigged({
      base: [window(SIX_ORBS)],
      orbs: Array.from({ length: 6 }, () => credit(1)),
      respins: [[], [], []],
    });
    let g = step(newGame(), "spin", rng);
    for (let i = 0; i < 3; i++) g = step(g, "spin", rng);
    expect(g.mode.kind).toBe("base");
    expect(credits(g)).toBe(START - BET + 6 * BET);
  });

  test("fifteen orbs award the Grand and pause until confirm", () => {
    const rng = rigged({
      base: [window("ORB ORB ORB ORB ORB / ORB ORB ORB ORB ORB / ORB ORB ORB ORB ORB")],
      orbs: Array.from({ length: 15 }, () => credit(1)),
    });
    const g = step(newGame(), "spin", rng);
    expect(g.mode.kind).toBe("jackpot");
    expect(settled(g).prompt).toBe("confirm");
    expect(step(g, "spin", rng)).toBe(g);

    const grand = Math.floor(g.meters.grand * g.coin);
    expect(grand).toBeGreaterThanOrEqual(PAYTABLE.grand.seed);
    const paid = step(g, "confirm", rng);
    expect(credits(paid)).toBe(g.credits + grand);
    expect(paid.mode.kind).toBe("base");
    expect(paid.meters.grand).toBe(PAYTABLE.grand.seed);
  });

  test("a Major pauses until confirm and then pays the Major meter", () => {
    const rng = rigged({
      base: [window(SIX_ORBS)],
      orbs: [{ kind: "MAJOR" }, credit(1), credit(1), credit(1), credit(1), credit(1)],
      respins: [[], [], []],
    });
    let g = step(newGame(), "spin", rng);
    for (let i = 0; i < 3; i++) g = step(g, "spin", rng);
    expect(g.mode.kind).toBe("jackpot");
    expect(credits(g)).toBe(START - BET + 5 * BET);
    expect(step(g, "spin", rng)).toBe(g);

    const major = Math.floor(g.meters.major * g.coin);
    const paid = step(g, "confirm", rng);
    expect(credits(paid)).toBe(g.credits + major);
    expect(paid.meters.major).toBe(PAYTABLE.major.seed);
  });

  test("rigged rejects a second MAJOR face while one is showing", () => {
    const rng = rigged({ base: [window(SIX_ORBS)], orbs: [{ kind: "MAJOR" }, { kind: "MAJOR" }] });
    expect(() => step(newGame(), "spin", rng)).toThrow();
  });
});

describe("cabinet", () => {
  test("an action that means nothing returns the same game", () => {
    const g = newGame();
    const rng = rigged({});
    expect(step(g, "confirm", rng)).toBe(g);
    expect(step(g, "coinDown", rng)).toBe(g);
    const free = freeGames();
    expect(step(free, "coinUp", rng)).toBe(free);
  });

  test("coin changes the bet and scales the meters without changing them", () => {
    const g = newGame();
    const up = step(g, "coinUp", rigged({}));
    expect(up.coin).toBe(PAYTABLE.coins[1]);
    expect(up.meters).toEqual(g.meters);
    expect(settled(up).bet).toBe((BET * PAYTABLE.coins[1]).toLocaleString("en-US"));
    expect(settled(up).meters.major).toBe((PAYTABLE.major.seed * PAYTABLE.coins[1]).toLocaleString("en-US"));
  });

  test("the same seed plays the same game twice", () => {
    const play = () => {
      const rng = reelRng(seeded(2026));
      let g = newGame();
      const seen: string[] = [];
      for (let i = 0; i < 400; i++) {
        g = step(g, g.mode.kind === "jackpot" ? "confirm" : "spin", rng);
        seen.push(labels(g).flat().join(","));
      }
      return { credits: g.credits, seen };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(new Set(a.seen).size).toBeGreaterThan(1);
  });
});
