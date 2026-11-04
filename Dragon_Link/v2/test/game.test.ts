import { expect, test } from "bun:test";
import { act, hotCells, live, newPlay, rulesHtml, scripted, stage, type Face, type Row, type Rows } from "../src/game";
import { frames, markup, picture, plain } from "../src/text";

const row = (a: string, b: string, c: string, d: string, e: string): Row => [a, b, c, d, e];
const grid = (cells: string[]): Rows => [
  row(cells[0]!, cells[1]!, cells[2]!, cells[3]!, cells[4]!),
  row(cells[5]!, cells[6]!, cells[7]!, cells[8]!, cells[9]!),
  row(cells[10]!, cells[11]!, cells[12]!, cells[13]!, cells[14]!),
];
const face = (label: string, pay: number): Face => ({ label, pay });

test("the screen is the terminal text", () => {
  const text = plain(newPlay());
  const lines = text.split("\n");
  expect(lines[0]!.trim()).toBe("AUTUMN MOON");
  expect(lines[0]!.startsWith(" ")).toBe(true);
  expect(lines[0]).toHaveLength(53);
  expect(lines[2]).toHaveLength(53);
  expect(lines[3]).toHaveLength(53);
  expect(lines[5]).toHaveLength(53);
  const miniMid = lines[2]!.indexOf("MINI") + 1.5;
  const numMid = lines[3]!.indexOf("1,000") + 2;
  expect(numMid).toBeLessThanOrEqual(miniMid);
  expect(lines.at(-3)!.startsWith("TIP:")).toBe(true);
  expect(lines.at(-3)!.length).toBeLessThanOrEqual(53);
  expect(lines.at(-2)).toBe("Esc or R = Reset");
  expect(text).toContain("[ DRGN  ]  [ MOON  ]  [  ORB  ]  [ LOTUS ]  [  FAN  ]");
  expect(text).toContain("Credits: 50,000     Bet: 50     Win: 0");
  expect(text.endsWith("Press Enter to spin")).toBe(true);
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
  expect(plain(play)).toContain("TIP: Doors open onto one symbol, 6 free games left");
  expect(plain(play).split("\n").at(-3)!.length).toBeLessThanOrEqual(53);
  expect(markup(picture(play))).toContain('class="banner free"');
});

test("doors on one free spin open onto one symbol", () => {
  const trigger = grid("MOON MOON MOON 9 10 9 10 J Q K 9 10 J Q K".split(" "));
  const doors = grid("DOOR KOI DOOR J Q FAN DOOR 10 DOOR K 9 LOTUS DOOR FAN DOOR".split(" "));
  let play = act(newPlay(), "spin", scripted({ windows: [trigger, doors], doors: ["ORB"] }));
  play = act(play, "spin", scripted({ windows: [doors], doors: ["ORB"] }));
  expect(plain(play)).toContain("[ DOOR  ]");
  expect(play.status).toBe("Press Enter to open the doors");
  expect(markup(picture(play))).toContain('class="banner door"');
  play = act(play, "spin", scripted({}));
  expect(plain(play)).not.toContain("DOOR");
  expect(play.rows.flat().filter((symbol) => symbol === "ORB")).toHaveLength(6);
  expect(play.status).toBe("Six orbs landed, press Enter to start Hold & Spin");
});

test("a new orb resets the respin count and fifteen orbs pay Grand", () => {
  const six = grid("ORB ORB ORB ORB ORB ORB 9 10 J Q K 9 10 J Q".split(" "));
  const faces = [1, 2, 1, 5, 1, 1].map((times) => face(String(times * 50), times * 50));
  let play = act(newPlay(), "spin", scripted({ windows: [six], faces }));
  play = act(play, "spin", scripted({ faces }));
  expect(play.phase).toMatchObject({ kind: "hold", respins: 3 });
  expect(play.status).toBe("Press Enter for hold-and-spin respin 3");
  expect(plain(play).split("\n").at(-3)).toBe("TIP: A new ORB resets the respins to 3");
  expect(markup(picture(play))).toContain('class="banner hold"');
  play = act(play, "spin", scripted({ locks: [[true, false, false, false, false, false, false, false, false]], faces: [face("100", 100)] }));
  expect(play.phase).toMatchObject({ kind: "hold", respins: 3 });
  const full = grid(Array(15).fill("ORB"));
  const many = Array.from({ length: 15 }, () => face("50", 50));
  let grand = act(newPlay(), "spin", scripted({ windows: [full], faces: many }));
  grand = act(grand, "spin", scripted({ faces: many }));
  expect(grand.status.startsWith("GRAND ")).toBe(true);
  expect(grand.status.endsWith("press Enter to collect")).toBe(true);
  expect(markup(picture(grand))).toContain('class="banner grand"');
});

test("winning cells light up and the reels stop one at a time", () => {
  const koi = grid("KOI KOI KOI Q LOTUS KOI KOI KOI K DRGN KOI KOI KOI FAN 9".split(" "));
  const start = newPlay();
  const after = act(start, "spin", scripted({ windows: [koi] }));
  const hot = hotCells(after.rows);
  expect(hot[0]![0] && hot[0]![1] && hot[0]![2]).toBe(true);
  expect(hot[0]![3]).toBe(false);
  const pics = frames(start, after);
  expect(pics.length).toBeGreaterThan(5);
  expect(pics[0]!.spin.trim()).toBe("SPINNING");
  expect(pics[0]!.bar).toBe("spin");
  expect(markup(pics[0]!).split("\n").length).toBe(markup(picture(start)).split("\n").length);
  expect(pics[0]!.rows[0]![4]!.look).toBe("spin");
  expect(pics[0]!.wait).toBeLessThan(pics.at(-2)!.wait);
  const settled = pics.find((pic) => pic.rows[0]![0]!.look === "still" && pic.rows[0]![4]!.look === "spin");
  expect(settled).toBeTruthy();
  expect(pics.at(-1)!.rows[0]![0]!.look).toBe("win");
  expect(pics.at(-1)!.spin.trim()).toBe("WINNER");
  expect(pics.at(-1)!.bar).toBe("win");
  expect(markup(pics.at(-1)!)).toContain('class="banner win"');
  expect(markup(picture(start)).split("\n").length).toBe(markup(pics.at(-1)!).split("\n").length);
  expect(picture(start).rows[0]![0]!.tone).toBe("dragon");
  expect(picture(start).rows[0]![2]!.tone).toBe("orb");
  expect(picture(start).rows[2]![0]!.text).toBe("[   9   ]");
  expect(picture(start).bar).toBe("play");
});

test("the rules article explains the parody and the pays", () => {
  const html = rulesHtml(1);
  expect(html).toContain("What this is");
  expect(html).toContain("Line pays");
  expect(html).toContain("<th>DRGN</th><td>40</td><td>150</td><td>800</td>");
  expect(html).toContain("Aristocrat did not make it");
  const story = html.slice(html.indexOf("<h2>What this is</h2>"), html.indexOf("<h2>Rules of this version</h2>"));
  expect(story.replace(/<[^>]+>/g, "")).not.toMatch(/\d/);
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

test("a named state is a finished play", () => {
  expect(stage("win")?.win).toBeGreaterThan(0);
  expect(stage("free")?.phase).toEqual({ kind: "free", left: 6 });
  expect(stage("doors")?.phase.kind).toBe("doors");
  expect(stage("arm")?.phase.kind).toBe("arm");
  expect(stage("hold")?.phase.kind).toBe("hold");
  expect(stage("grand")?.status.startsWith("GRAND ")).toBe(true);
  expect(stage("nope")).toBeNull();
});
