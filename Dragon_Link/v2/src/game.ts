export type Row = [string, string, string, string, string];
export type Rows = [Row, Row, Row];

export type Face = { label: string; pay: number };
type Locked = (Face | null)[][];
type Resume = { kind: "base" } | { kind: "free"; left: number };
type Jack = { name: "MAJOR" | "GRAND"; amount: number };

type Phase =
  | { kind: "base" }
  | { kind: "free"; left: number }
  | { kind: "doors"; left: number; face: string; under: Rows }
  | { kind: "arm"; under: Rows; resume: Resume }
  | { kind: "hold"; respins: number; locked: Locked; under: Rows; resume: Resume }
  | { kind: "jackpot"; pending: Jack[]; locked: Locked; under: Rows; resume: Resume };

export type Play = {
  credits: number;
  coin: number;
  major: number;
  grand: number;
  win: number;
  rows: Rows;
  feature: string;
  status: string;
  phase: Phase;
};

export type Chance = {
  window: (free: boolean) => Rows;
  door: () => string;
  face: (allowMajor: boolean) => Face;
  locks: (open: number) => boolean[];
};

const PAYING = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN"] as const;
type Paying = (typeof PAYING)[number];

const LINE: Record<Paying, Record<3 | 4 | 5, number>> = {
  "9": { 3: 5, 4: 15, 5: 80 },
  "10": { 3: 5, 4: 15, 5: 90 },
  J: { 3: 5, 4: 20, 5: 100 },
  Q: { 3: 10, 4: 25, 5: 120 },
  K: { 3: 10, 4: 30, 5: 150 },
  FAN: { 3: 15, 4: 50, 5: 200 },
  KOI: { 3: 20, 4: 60, 5: 250 },
  LOTUS: { 3: 25, 4: 80, 5: 300 },
  DRGN: { 3: 40, 4: 150, 5: 800 },
};

const COINS = [1, 2, 5, 10];
const BASE_HOLD = "FEATURE: Collect 6 or more ORB symbols for HOLD & SPIN";
const HOLD_RULE = "FEATURE: Reset to 3 respins whenever a new ORB lands";

const REEL0 = ["9", "10", "J", "Q", "K", "9", "10", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB", "Q", "K", "9"];
const REEL = ["9", "10", "J", "Q", "K", "WILD", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB", "9", "10", "J", "Q"];
const DOORS = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN", "ORB", "ORB", "FAN"];
const FACES: { label: string; coins: number; weight: number; major?: boolean }[] = [
  { label: "50", coins: 50, weight: 30 },
  { label: "100", coins: 100, weight: 24 },
  { label: "150", coins: 150, weight: 14 },
  { label: "250", coins: 250, weight: 9 },
  { label: "400", coins: 400, weight: 5 },
  { label: "750", coins: 750, weight: 2 },
  { label: "MINI", coins: 1000, weight: 5 },
  { label: "MINOR", coins: 5000, weight: 1.5 },
  { label: "MAJOR", coins: 0, weight: 0.3, major: true },
];

function bends(line: number[]): number {
  let n = 0;
  for (let i = 1; i < line.length; i++) {
    const step = Math.abs((line[i] ?? 0) - (line[i - 1] ?? 0));
    if (step > 1) return -1;
    if (step === 1) n++;
  }
  return n;
}

const LINES: number[][] = [];
for (let a = 0; a < 3; a++)
  for (let b = 0; b < 3; b++)
    for (let c = 0; c < 3; c++)
      for (let d = 0; d < 3; d++)
        for (let e = 0; e < 3; e++) {
          const line = [a, b, c, d, e];
          if (bends(line) >= 0) LINES.push(line);
        }
LINES.sort((x, y) => bends(x) - bends(y));
LINES.length = 50;

const row = (a: string, b: string, c: string, d: string, e: string): Row => [a, b, c, d, e];
const flat = (grid: Rows) => grid.flat();
const isPaying = (s: string): s is Paying => (PAYING as readonly string[]).includes(s);

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function drawStrip(rng: () => number, free: boolean): Rows {
  const grid = [0, 1, 2].map(() =>
    [0, 1, 2, 3, 4].map((reel) => pick(rng, reel === 0 ? REEL0 : REEL)),
  ) as Rows;
  if (!free) return grid;
  let doors = 0;
  const opened = grid.map((line) =>
    line.map((symbol) => {
      if (rng() < 0.28) {
        doors++;
        return "DOOR";
      }
      return symbol;
    }),
  ) as Rows;
  if (doors === 0) opened[0][0] = "DOOR";
  return opened;
}

function rollFace(rng: () => number, allowMajor: boolean): Face {
  const pool = FACES.filter((face) => allowMajor || !face.major);
  const total = pool.reduce((sum, face) => sum + face.weight, 0);
  let roll = rng() * total;
  for (const face of pool) {
    roll -= face.weight;
    if (roll <= 0) return { label: face.label, pay: face.coins };
  }
  const last = pool[pool.length - 1]!;
  return { label: last.label, pay: last.coins };
}

export function live(rng: () => number = Math.random): Chance {
  return {
    window: (free) => drawStrip(rng, free),
    door: () => pick(rng, DOORS),
    face: (allowMajor) => rollFace(rng, allowMajor),
    locks: (open) => Array.from({ length: open }, () => rng() < 0.22),
  };
}

export function scripted(input: { windows?: Rows[]; doors?: string[]; faces?: Face[]; locks?: boolean[][] }): Chance {
  const windows = [...(input.windows ?? [])];
  const doors = [...(input.doors ?? [])];
  const faces = [...(input.faces ?? [])];
  const locks = [...(input.locks ?? [])];
  const take = <T>(queue: T[], name: string): T => {
    const next = queue.shift();
    if (next === undefined) throw new Error(`script ran out of ${name}`);
    return next;
  };
  return {
    window: () => take(windows, "windows"),
    door: () => take(doors, "doors"),
    face: (allowMajor) => {
      const face = take(faces, "faces");
      if (!allowMajor && face.label === "MAJOR") throw new Error("second MAJOR");
      return face;
    },
    locks: (open) => {
      const hit = take(locks, "locks");
      if (hit.length !== open) throw new Error(`expected ${open} locks`);
      return hit;
    },
  };
}

export function newPlay(): Play {
  return show({
    credits: 50_000,
    coin: 1,
    major: 25_000,
    grand: 250_000,
    win: 0,
    rows: [
      row("DRGN", "MOON", "ORB", "LOTUS", "FAN"),
      row("KOI", "LOTUS", "DRGN", "MOON", "ORB"),
      row("9", "WILD", "FAN", "K", "DRGN"),
    ],
    phase: { kind: "base" },
  });
}

function show(play: Omit<Play, "feature" | "status"> & { feature?: string; status?: string }): Play {
  const feature = play.feature ?? featureOf(play.phase);
  const status = play.status ?? "Press Enter to spin";
  return { ...play, feature, status };
}

function featureOf(phase: Phase): string {
  if (phase.kind === "free" || phase.kind === "doors") {
    return `FEATURE: Every door opens onto the same symbol, ${phase.left} free games left`;
  }
  if (phase.kind === "hold" || phase.kind === "arm" || phase.kind === "jackpot") return HOLD_RULE;
  return BASE_HOLD;
}

function betOf(play: Play): number {
  return 50 * play.coin;
}

export function act(play: Play, key: "spin" | "coinUp" | "coinDown", chance: Chance): Play {
  if (key !== "spin") return play.phase.kind === "base" ? changeCoin(play, key) : play;
  switch (play.phase.kind) {
    case "base":
      return spinBase(play, chance);
    case "free":
      return spinFree(play, play.phase, chance);
    case "doors":
      return openDoors(play, play.phase);
    case "arm":
      return beginHold(play, play.phase, chance);
    case "hold":
      return respin(play, play.phase, chance);
    case "jackpot":
      return collect(play, play.phase);
  }
}

function changeCoin(play: Play, key: "coinUp" | "coinDown"): Play {
  const index = COINS.indexOf(play.coin);
  const next = COINS[index + (key === "coinUp" ? 1 : -1)];
  if (next === undefined) return play;
  return show({ ...play, coin: next, win: 0 });
}

function spinBase(play: Play, chance: Chance): Play {
  const bet = betOf(play);
  if (play.credits < bet) return show({ ...play, status: "Not enough credits for this bet" });
  const grid = chance.window(false);
  const paid = { ...play, credits: play.credits - bet, major: play.major + 50 * 0.01, grand: play.grand + 50 * 0.004 };
  return settle(paid, grid, { kind: "base" });
}

function spinFree(play: Play, phase: Extract<Phase, { kind: "free" }>, chance: Chance): Play {
  const left = phase.left - 1;
  const grid = chance.window(true);
  if (flat(grid).includes("DOOR")) {
    return show({
      ...play,
      rows: grid,
      win: 0,
      phase: { kind: "doors", left, face: chance.door(), under: grid },
      status: "Press Enter to open the doors",
    });
  }
  return settle(play, grid, { kind: "free", left });
}

function openDoors(play: Play, phase: Extract<Phase, { kind: "doors" }>): Play {
  const grid = phase.under.map((line) => line.map((symbol) => (symbol === "DOOR" ? phase.face : symbol))) as Rows;
  return settle({ ...play, rows: grid }, grid, { kind: "free", left: phase.left });
}

function settle(play: Play, grid: Rows, resume: Resume): Play {
  const score = scoreGrid(grid, play.coin);
  const credits = play.credits + score.pay;
  const left = resume.kind === "free" ? resume.left + (score.moons >= 3 ? 6 : 0) : score.moons >= 3 ? 6 : 0;
  const next: Resume = left > 0 ? { kind: "free", left } : { kind: "base" };
  const shown = show({
    ...play,
    credits,
    rows: grid,
    win: score.pay,
    phase: next.kind === "free" ? { kind: "free", left: next.left } : { kind: "base" },
    feature: next.kind === "free" ? featureOf({ kind: "free", left: next.left }) : BASE_HOLD,
    status: "Press Enter to spin",
  });
  if (score.orbs < 6) return shown;
  return show({
    ...shown,
    phase: { kind: "arm", under: grid, resume: next },
    feature: HOLD_RULE,
    status: "Six orbs landed, press Enter to start Hold & Spin",
  });
}

export function hotCells(grid: Rows): boolean[][] {
  const hot = [0, 1, 2].map(() => [false, false, false, false, false]);
  for (const line of LINES) {
    const symbol = grid[line[0]!]![0]!;
    if (!isPaying(symbol)) continue;
    let run = 1;
    for (let reel = 1; reel < 5; reel++) {
      const symbolOnLine = grid[line[reel]!]![reel]!;
      if (symbolOnLine === symbol || symbolOnLine === "WILD") run++;
      else break;
    }
    if (run >= 3) for (let reel = 0; reel < run; reel++) hot[line[reel]!]![reel] = true;
  }
  if (flat(grid).filter((symbol) => symbol === "MOON").length >= 3) {
    grid.forEach((line, r) => line.forEach((symbol, c) => symbol === "MOON" && (hot[r]![c] = true)));
  }
  return hot;
}

function scoreGrid(grid: Rows, coin: number): { pay: number; moons: number; orbs: number } {
  let coins = 0;
  for (const line of LINES) {
    const symbol = grid[line[0]!]![0]!;
    if (!isPaying(symbol)) continue;
    let run = 1;
    for (let reel = 1; reel < 5; reel++) {
      const symbolOnLine = grid[line[reel]!]![reel]!;
      if (symbolOnLine === symbol || symbolOnLine === "WILD") run++;
      else break;
    }
    if (run >= 3) coins += LINE[symbol][(run >= 5 ? 5 : run) as 3 | 4 | 5];
  }
  const moons = flat(grid).filter((symbol) => symbol === "MOON").length;
  const moonCoins = moons >= 5 ? 250 * 50 : moons === 4 ? 20 * 50 : moons >= 3 ? 3 * 50 : 0;
  return { pay: (coins + moonCoins) * coin, moons, orbs: flat(grid).filter((symbol) => symbol === "ORB").length };
}

function beginHold(play: Play, phase: Extract<Phase, { kind: "arm" }>, chance: Chance): Play {
  let major = false;
  const locked = phase.under.map((line) =>
    line.map((symbol) => {
      if (symbol !== "ORB") return null;
      const face = chance.face(!major);
      if (face.label === "MAJOR") major = true;
      return face;
    }),
  );
  return landHold(play, locked, phase.under, 3, phase.resume);
}

function respin(play: Play, phase: Extract<Phase, { kind: "hold" }>, chance: Chance): Play {
  const open: [number, number][] = [];
  phase.locked.forEach((line, r) => line.forEach((cell, c) => cell === null && open.push([r, c])));
  const hits = chance.locks(open.length);
  let major = phase.locked.some((line) => line.some((cell) => cell?.label === "MAJOR"));
  const locked = phase.locked.map((line) => line.slice()) as Locked;
  let landed = 0;
  open.forEach(([r, c], i) => {
    if (!hits[i]) return;
    const face = chance.face(!major);
    if (face.label === "MAJOR") major = true;
    locked[r]![c] = face;
    landed++;
  });
  const respins = landed > 0 ? 3 : phase.respins - 1;
  return landHold(play, locked, phase.under, respins, phase.resume);
}

function landHold(play: Play, locked: Locked, under: Rows, respins: number, resume: Resume): Play {
  const rows = locked.map((line, r) =>
    line.map((cell, c) => (cell ? faceLabel(cell, play.coin) : under[r]![c]!)),
  ) as Rows;
  const win = holdWin(locked, play.coin);
  const full = locked.every((line) => line.every((cell) => cell !== null));
  if (respins > 0 && !full) {
    return show({
      ...play,
      rows,
      win,
      phase: { kind: "hold", respins, locked, under, resume },
      feature: HOLD_RULE,
      status: `Press Enter for hold-and-spin respin ${respins}`,
    });
  }
  return finish(play, locked, under, rows, win, resume, full);
}

function faceLabel(face: Face, coin: number): string {
  if (face.label === "MINI" || face.label === "MINOR" || face.label === "MAJOR") return face.label;
  return String(face.pay * coin);
}

function holdWin(locked: Locked, coin: number): number {
  return locked.flat().reduce((sum, cell) => sum + (cell && cell.label !== "MAJOR" ? cell.pay * coin : 0), 0);
}

function finish(play: Play, locked: Locked, under: Rows, rows: Rows, win: number, resume: Resume, full: boolean): Play {
  const pending: Jack[] = [];
  let major = play.major;
  let grand = play.grand;
  if (locked.some((line) => line.some((cell) => cell?.label === "MAJOR"))) {
    pending.push({ name: "MAJOR", amount: Math.floor(major * play.coin) });
    major = 25_000;
  }
  if (full) {
    pending.push({ name: "GRAND", amount: Math.floor(grand * play.coin) });
    grand = 250_000;
  }
  const credits = play.credits + win;
  if (pending.length === 0) return returned({ ...play, credits, major, grand, rows, win }, resume);
  const first = pending[0]!;
  return show({
    ...play,
    credits,
    major,
    grand,
    rows,
    win,
    phase: { kind: "jackpot", pending, locked, under, resume },
    feature: HOLD_RULE,
    status: `${first.name} ${first.amount.toLocaleString("en-US")}, press Enter to collect`,
  });
}

function collect(play: Play, phase: Extract<Phase, { kind: "jackpot" }>): Play {
  const [head, ...rest] = phase.pending;
  const credits = play.credits + (head?.amount ?? 0);
  if (rest.length > 0 && head) {
    const next = rest[0]!;
    return show({
      ...play,
      credits,
      phase: { ...phase, pending: rest },
      status: `${next.name} ${next.amount.toLocaleString("en-US")}, press Enter to collect`,
    });
  }
  return returned({ ...play, credits, win: 0 }, phase.resume);
}

function returned(play: Omit<Play, "feature" | "status" | "phase">, resume: Resume): Play {
  if (resume.kind === "free") {
    return show({
      ...play,
      phase: { kind: "free", left: resume.left },
      feature: featureOf({ kind: "free", left: resume.left }),
      status: "Press Enter to spin",
    });
  }
  return show({ ...play, phase: { kind: "base" }, feature: BASE_HOLD, status: "Press Enter to spin" });
}

const PARODY = [
  "This is an unofficial parody of Aristocrat's Dragon Link Autumn Moon. Aristocrat did not make it and does not endorse it.",
  "It grew out of the Alberta Tech reel \"Vibe Coding is Gambling\" and Dave Eddy's YSAP Link stitch of that reel.",
  "Nothing here is real wagering. Credits are pretend, cost nothing, and cannot be cashed out.",
  "A text screen has no cabinet art, no sound, and no linked jackpot. The Major and Grand meters grow only from your own spins in this session.",
] as const;

const ODDS = "Reel strips, weights, and odds are original to this parody and are not Aristocrat's math.";

/** The rules article. Parody sentences carry no digits. Every number comes from the pay list. */
export function rulesHtml(coin: number): string {
  const money = (coins: number) => Math.floor(coins * coin).toLocaleString("en-US");
  const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pays = (Object.keys(LINE) as Paying[])
    .map((symbol) => {
      const pay = LINE[symbol];
      return `<tr><th>${symbol}</th><td>${money(pay[3])}</td><td>${money(pay[4])}</td><td>${money(pay[5])}</td></tr>`;
    })
    .join("\n");
  const story = PARODY.map((sentence) => `<p>${esc(sentence)}</p>`).join("\n");
  return `
<h2>What this is</h2>
${story}
<h2>Rules of this version</h2>
<p>Coin ${coin}. Every credit amount below is for this coin and changes when you change the coin.</p>
<ul>
  <li>5 reels, 3 rows, 50 fixed lines. Lines pay left to right, starting on the first reel. The bet is ${money(50)} credits: 50 lines times the coin. You start with 50,000 credits.</li>
  <li>WILD lands on every reel except the first. It stands in for every paying symbol. It does not stand in for MOON or ORB, and ORB never pays on a line.</li>
  <li>MOON pays anywhere on the screen. Three moons pay ${money(150)}, four pay ${money(1000)}, and five pay ${money(12_500)}, which is 250 times the bet. Three or more moons also start 6 free games. Three more moons during free games add 6 more.</li>
  <li>Free spins can land DOOR stacks. Every door on one spin opens onto the same symbol. That symbol can be ORB, but never WILD or MOON.</li>
  <li>6 or more ORB start Hold and Spin with 3 respins. Each new orb locks and resets the count to 3. Orbs show credits (${[50, 100, 150, 250, 400, 750].map((n) => money(n)).join(", ")}) or a jackpot name. Only one MAJOR can show at a time.</li>
  <li>MINI pays ${money(1000)}. MINOR pays ${money(5000)}. MAJOR pays its meter, which starts at ${money(25_000)}. Filling all 15 cells pays the GRAND meter, which starts at ${money(250_000)}. Both meters grow a little with every paid spin and reset after they pay.</li>
  <li>A Major or Grand win pauses the game until you collect it. Spin does nothing during that pause.</li>
  <li>Hold and Spin started during free games returns to those free games.</li>
  <li>The coin changes only in the base game.</li>
  <li>${esc(ODDS)}</li>
</ul>
<table>
  <thead><tr><th>Line pays</th><th>Three</th><th>Four</th><th>Five</th></tr></thead>
  <tbody>
${pays}
  </tbody>
</table>`;
}
