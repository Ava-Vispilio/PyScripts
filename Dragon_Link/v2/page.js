// src/game.ts
var PAYING = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN"];
var LINE = {
  "9": { 3: 5, 4: 15, 5: 80 },
  "10": { 3: 5, 4: 15, 5: 90 },
  J: { 3: 5, 4: 20, 5: 100 },
  Q: { 3: 10, 4: 25, 5: 120 },
  K: { 3: 10, 4: 30, 5: 150 },
  FAN: { 3: 15, 4: 50, 5: 200 },
  KOI: { 3: 20, 4: 60, 5: 250 },
  LOTUS: { 3: 25, 4: 80, 5: 300 },
  DRGN: { 3: 40, 4: 150, 5: 800 }
};
var COINS = [1, 2, 5, 10];
var BASE_HOLD = "TIP: 6 or more ORB symbols start HOLD & SPIN";
var HOLD_RULE = "TIP: A new ORB resets the respins to 3";
var REEL0 = ["9", "10", "J", "Q", "K", "9", "10", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB", "Q", "K", "9"];
var REEL = ["9", "10", "J", "Q", "K", "WILD", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB", "9", "10", "J", "Q"];
var DOORS = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN", "ORB", "ORB", "FAN"];
var FACES = [
  { label: "50", coins: 50, weight: 30 },
  { label: "100", coins: 100, weight: 24 },
  { label: "150", coins: 150, weight: 14 },
  { label: "250", coins: 250, weight: 9 },
  { label: "400", coins: 400, weight: 5 },
  { label: "750", coins: 750, weight: 2 },
  { label: "MINI", coins: 1000, weight: 5 },
  { label: "MINOR", coins: 5000, weight: 1.5 },
  { label: "MAJOR", coins: 0, weight: 0.3, major: true }
];
function bends(line) {
  let n = 0;
  for (let i = 1;i < line.length; i++) {
    const step = Math.abs((line[i] ?? 0) - (line[i - 1] ?? 0));
    if (step > 1)
      return -1;
    if (step === 1)
      n++;
  }
  return n;
}
var LINES = [];
for (let a = 0;a < 3; a++)
  for (let b = 0;b < 3; b++)
    for (let c = 0;c < 3; c++)
      for (let d = 0;d < 3; d++)
        for (let e = 0;e < 3; e++) {
          const line = [a, b, c, d, e];
          if (bends(line) >= 0)
            LINES.push(line);
        }
LINES.sort((x, y) => bends(x) - bends(y));
LINES.length = 50;
var row = (a, b, c, d, e) => [a, b, c, d, e];
var flat = (grid) => grid.flat();
var isPaying = (s) => PAYING.includes(s);
function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
function drawStrip(rng, free) {
  const grid = [0, 1, 2].map(() => [0, 1, 2, 3, 4].map((reel) => pick(rng, reel === 0 ? REEL0 : REEL)));
  if (!free)
    return grid;
  let doors = 0;
  const opened = grid.map((line) => line.map((symbol) => {
    if (rng() < 0.28) {
      doors++;
      return "DOOR";
    }
    return symbol;
  }));
  if (doors === 0)
    opened[0][0] = "DOOR";
  return opened;
}
function rollFace(rng, allowMajor) {
  const pool = FACES.filter((face) => allowMajor || !face.major);
  const total = pool.reduce((sum, face) => sum + face.weight, 0);
  let roll = rng() * total;
  for (const face of pool) {
    roll -= face.weight;
    if (roll <= 0)
      return { label: face.label, pay: face.coins };
  }
  const last = pool[pool.length - 1];
  return { label: last.label, pay: last.coins };
}
function live(rng = Math.random) {
  return {
    window: (free) => drawStrip(rng, free),
    door: () => pick(rng, DOORS),
    face: (allowMajor) => rollFace(rng, allowMajor),
    locks: (open) => Array.from({ length: open }, () => rng() < 0.22)
  };
}
function scripted(input) {
  const windows = [...input.windows ?? []];
  const doors = [...input.doors ?? []];
  const faces = [...input.faces ?? []];
  const locks = [...input.locks ?? []];
  const take = (queue, name) => {
    const next = queue.shift();
    if (next === undefined)
      throw new Error(`script ran out of ${name}`);
    return next;
  };
  return {
    window: () => take(windows, "windows"),
    door: () => take(doors, "doors"),
    face: (allowMajor) => {
      const face = take(faces, "faces");
      if (!allowMajor && face.label === "MAJOR")
        throw new Error("second MAJOR");
      return face;
    },
    locks: (open) => {
      const hit = take(locks, "locks");
      if (hit.length !== open)
        throw new Error(`expected ${open} locks`);
      return hit;
    }
  };
}
function newPlay() {
  return show({
    credits: 50000,
    coin: 1,
    major: 25000,
    grand: 250000,
    win: 0,
    rows: [
      row("DRGN", "MOON", "ORB", "LOTUS", "FAN"),
      row("KOI", "LOTUS", "DRGN", "MOON", "ORB"),
      row("9", "WILD", "FAN", "K", "DRGN")
    ],
    phase: { kind: "base" }
  });
}
function show(play) {
  const feature = play.feature ?? featureOf(play.phase);
  const status = play.status ?? "Press Enter to spin";
  return { ...play, feature, status };
}
function featureOf(phase) {
  if (phase.kind === "free" || phase.kind === "doors") {
    return `TIP: Doors open onto one symbol, ${phase.left} free games left`;
  }
  if (phase.kind === "hold" || phase.kind === "arm" || phase.kind === "jackpot")
    return HOLD_RULE;
  return BASE_HOLD;
}
function betOf(play) {
  return 50 * play.coin;
}
function act(play, key, chance) {
  if (key !== "spin")
    return play.phase.kind === "base" ? changeCoin(play, key) : play;
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
function changeCoin(play, key) {
  const index = COINS.indexOf(play.coin);
  const next = COINS[index + (key === "coinUp" ? 1 : -1)];
  if (next === undefined)
    return play;
  return show({ ...play, coin: next, win: 0 });
}
function spinBase(play, chance) {
  const bet = betOf(play);
  if (play.credits < bet)
    return show({ ...play, status: "Not enough credits for this bet" });
  const grid = chance.window(false);
  const paid = { ...play, credits: play.credits - bet, major: play.major + 50 * 0.01, grand: play.grand + 50 * 0.004 };
  return settle(paid, grid, { kind: "base" });
}
function spinFree(play, phase, chance) {
  const left = phase.left - 1;
  const grid = chance.window(true);
  if (flat(grid).includes("DOOR")) {
    return show({
      ...play,
      rows: grid,
      win: 0,
      phase: { kind: "doors", left, face: chance.door(), under: grid },
      status: "Press Enter to open the doors"
    });
  }
  return settle(play, grid, { kind: "free", left });
}
function openDoors(play, phase) {
  const grid = phase.under.map((line) => line.map((symbol) => symbol === "DOOR" ? phase.face : symbol));
  return settle({ ...play, rows: grid }, grid, { kind: "free", left: phase.left });
}
function settle(play, grid, resume) {
  const score = scoreGrid(grid, play.coin);
  const credits = play.credits + score.pay;
  const left = resume.kind === "free" ? resume.left + (score.moons >= 3 ? 6 : 0) : score.moons >= 3 ? 6 : 0;
  const next = left > 0 ? { kind: "free", left } : { kind: "base" };
  const shown = show({
    ...play,
    credits,
    rows: grid,
    win: score.pay,
    phase: next.kind === "free" ? { kind: "free", left: next.left } : { kind: "base" },
    feature: next.kind === "free" ? featureOf({ kind: "free", left: next.left }) : BASE_HOLD,
    status: "Press Enter to spin"
  });
  if (score.orbs < 6)
    return shown;
  return show({
    ...shown,
    phase: { kind: "arm", under: grid, resume: next },
    feature: HOLD_RULE,
    status: "Six orbs landed, press Enter to start Hold & Spin"
  });
}
function hotCells(grid) {
  const hot = [0, 1, 2].map(() => [false, false, false, false, false]);
  for (const line of LINES) {
    const symbol = grid[line[0]][0];
    if (!isPaying(symbol))
      continue;
    let run = 1;
    for (let reel = 1;reel < 5; reel++) {
      const symbolOnLine = grid[line[reel]][reel];
      if (symbolOnLine === symbol || symbolOnLine === "WILD")
        run++;
      else
        break;
    }
    if (run >= 3)
      for (let reel = 0;reel < run; reel++)
        hot[line[reel]][reel] = true;
  }
  if (flat(grid).filter((symbol) => symbol === "MOON").length >= 3) {
    grid.forEach((line, r) => line.forEach((symbol, c) => symbol === "MOON" && (hot[r][c] = true)));
  }
  return hot;
}
function scoreGrid(grid, coin) {
  let coins = 0;
  for (const line of LINES) {
    const symbol = grid[line[0]][0];
    if (!isPaying(symbol))
      continue;
    let run = 1;
    for (let reel = 1;reel < 5; reel++) {
      const symbolOnLine = grid[line[reel]][reel];
      if (symbolOnLine === symbol || symbolOnLine === "WILD")
        run++;
      else
        break;
    }
    if (run >= 3)
      coins += LINE[symbol][run >= 5 ? 5 : run];
  }
  const moons = flat(grid).filter((symbol) => symbol === "MOON").length;
  const moonCoins = moons >= 5 ? 250 * 50 : moons === 4 ? 20 * 50 : moons >= 3 ? 3 * 50 : 0;
  return { pay: (coins + moonCoins) * coin, moons, orbs: flat(grid).filter((symbol) => symbol === "ORB").length };
}
function beginHold(play, phase, chance) {
  let major = false;
  const locked = phase.under.map((line) => line.map((symbol) => {
    if (symbol !== "ORB")
      return null;
    const face = chance.face(!major);
    if (face.label === "MAJOR")
      major = true;
    return face;
  }));
  return landHold(play, locked, phase.under, 3, phase.resume);
}
function respin(play, phase, chance) {
  const open = [];
  phase.locked.forEach((line, r) => line.forEach((cell, c) => cell === null && open.push([r, c])));
  const hits = chance.locks(open.length);
  let major = phase.locked.some((line) => line.some((cell) => cell?.label === "MAJOR"));
  const locked = phase.locked.map((line) => line.slice());
  let landed = 0;
  open.forEach(([r, c], i) => {
    if (!hits[i])
      return;
    const face = chance.face(!major);
    if (face.label === "MAJOR")
      major = true;
    locked[r][c] = face;
    landed++;
  });
  const respins = landed > 0 ? 3 : phase.respins - 1;
  return landHold(play, locked, phase.under, respins, phase.resume);
}
function landHold(play, locked, under, respins, resume) {
  const rows = locked.map((line, r) => line.map((cell, c) => cell ? faceLabel(cell, play.coin) : under[r][c]));
  const win = holdWin(locked, play.coin);
  const full = locked.every((line) => line.every((cell) => cell !== null));
  if (respins > 0 && !full) {
    return show({
      ...play,
      rows,
      win,
      phase: { kind: "hold", respins, locked, under, resume },
      feature: HOLD_RULE,
      status: `Press Enter for hold-and-spin respin ${respins}`
    });
  }
  return finish(play, locked, under, rows, win, resume, full);
}
function faceLabel(face, coin) {
  if (face.label === "MINI" || face.label === "MINOR" || face.label === "MAJOR")
    return face.label;
  return String(face.pay * coin);
}
function holdWin(locked, coin) {
  return locked.flat().reduce((sum, cell) => sum + (cell && cell.label !== "MAJOR" ? cell.pay * coin : 0), 0);
}
function finish(play, locked, under, rows, win, resume, full) {
  const pending = [];
  let major = play.major;
  let grand = play.grand;
  if (locked.some((line) => line.some((cell) => cell?.label === "MAJOR"))) {
    pending.push({ name: "MAJOR", amount: Math.floor(major * play.coin) });
    major = 25000;
  }
  if (full) {
    pending.push({ name: "GRAND", amount: Math.floor(grand * play.coin) });
    grand = 250000;
  }
  const credits = play.credits + win;
  if (pending.length === 0)
    return returned({ ...play, credits, major, grand, rows, win }, resume);
  const first = pending[0];
  return show({
    ...play,
    credits,
    major,
    grand,
    rows,
    win,
    phase: { kind: "jackpot", pending, locked, under, resume },
    feature: HOLD_RULE,
    status: `${first.name} ${first.amount.toLocaleString("en-US")}, press Enter to collect`
  });
}
function collect(play, phase) {
  const [head, ...rest] = phase.pending;
  const credits = play.credits + (head?.amount ?? 0);
  if (rest.length > 0 && head) {
    const next = rest[0];
    return show({
      ...play,
      credits,
      phase: { ...phase, pending: rest },
      status: `${next.name} ${next.amount.toLocaleString("en-US")}, press Enter to collect`
    });
  }
  return returned({ ...play, credits, win: 0 }, phase.resume);
}
function returned(play, resume) {
  if (resume.kind === "free") {
    return show({
      ...play,
      phase: { kind: "free", left: resume.left },
      feature: featureOf({ kind: "free", left: resume.left }),
      status: "Press Enter to spin"
    });
  }
  return show({ ...play, phase: { kind: "base" }, feature: BASE_HOLD, status: "Press Enter to spin" });
}
var PARODY = [
  "This is an unofficial parody of Aristocrat's Dragon Link Autumn Moon. Aristocrat did not make it and does not endorse it.",
  `It grew out of the Alberta Tech reel "Vibe Coding is Gambling" and Dave Eddy's YSAP Link stitch of that reel.`,
  "Nothing here is real wagering. Credits are pretend, cost nothing, and cannot be cashed out.",
  "A text screen has no cabinet art, no sound, and no linked jackpot. The Major and Grand meters grow only from your own spins in this session."
];
var ODDS = "Reel strips, weights, and odds are original to this parody and are not Aristocrat's math.";
function rulesHtml(coin) {
  const money = (coins) => Math.floor(coins * coin).toLocaleString("en-US");
  const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pays = Object.keys(LINE).map((symbol) => {
    const pay = LINE[symbol];
    return `<tr><th>${symbol}</th><td>${money(pay[3])}</td><td>${money(pay[4])}</td><td>${money(pay[5])}</td></tr>`;
  }).join(`
`);
  const story = PARODY.map((sentence) => `<p>${esc(sentence)}</p>`).join(`
`);
  return `
<h2>What this is</h2>
${story}
<h2>Rules of this version</h2>
<p>Coin ${coin}. Every credit amount below is for this coin and changes when you change the coin.</p>
<ul>
  <li>5 reels, 3 rows, 50 fixed lines. Lines pay left to right, starting on the first reel. The bet is ${money(50)} credits: 50 lines times the coin. You start with 50,000 credits.</li>
  <li>WILD lands on every reel except the first. It stands in for every paying symbol. It does not stand in for MOON or ORB, and ORB never pays on a line.</li>
  <li>MOON pays anywhere on the screen. Three moons pay ${money(150)}, four pay ${money(1000)}, and five pay ${money(12500)}, which is 250 times the bet. Three or more moons also start 6 free games. Three more moons during free games add 6 more.</li>
  <li>Free spins can land DOOR stacks. Every door on one spin opens onto the same symbol. That symbol can be ORB, but never WILD or MOON.</li>
  <li>6 or more ORB start Hold and Spin with 3 respins. Each new orb locks and resets the count to 3. Orbs show credits (${[50, 100, 150, 250, 400, 750].map((n) => money(n)).join(", ")}) or a jackpot name. Only one MAJOR can show at a time.</li>
  <li>MINI pays ${money(1000)}. MINOR pays ${money(5000)}. MAJOR pays its meter, which starts at ${money(25000)}. Filling all 15 cells pays the GRAND meter, which starts at ${money(250000)}. Both meters grow a little with every paid spin and reset after they pay.</li>
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
var cells = (text) => {
  const part = text.split(" ");
  const row = (start) => [part[start], part[start + 1], part[start + 2], part[start + 3], part[start + 4]];
  return [row(0), row(5), row(10)];
};
function stage(name) {
  const face = (label, pay) => ({ label, pay });
  const koi = cells("KOI KOI KOI Q LOTUS KOI KOI KOI K DRGN KOI KOI KOI FAN 9");
  const moons = cells("MOON MOON MOON MOON MOON 9 10 J Q K 9 10 J Q K");
  const trigger = cells("MOON MOON MOON 9 10 9 10 J Q K 9 10 J Q K");
  const doors = cells("DOOR KOI DOOR J Q FAN DOOR 10 DOOR K 9 LOTUS DOOR FAN DOOR");
  const six = cells("ORB ORB ORB ORB ORB ORB 9 10 J Q K 9 10 J Q");
  const faces = [1, 2, 1, 5, 1, 1].map((times) => face(String(times * 50), times * 50));
  if (name === "win")
    return act(newPlay(), "spin", scripted({ windows: [koi] }));
  if (name === "free")
    return act(newPlay(), "spin", scripted({ windows: [moons] }));
  if (name === "doors") {
    const chance = scripted({ windows: [trigger, doors], doors: ["ORB"] });
    return act(act(newPlay(), "spin", chance), "spin", chance);
  }
  if (name === "arm")
    return act(newPlay(), "spin", scripted({ windows: [six], faces }));
  if (name === "hold") {
    const chance = scripted({ windows: [six], faces });
    return act(act(newPlay(), "spin", chance), "spin", chance);
  }
  if (name === "grand") {
    const full = cells(Array(15).fill("ORB").join(" "));
    const many = Array.from({ length: 15 }, () => face("50", 50));
    const chance = scripted({ windows: [full], faces: many });
    return act(act(newPlay(), "spin", chance), "spin", chance);
  }
  return null;
}

// src/text.ts
function commas(n) {
  return Math.floor(n).toLocaleString("en-US");
}
function center(text, width) {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}
function box(label) {
  return `[ ${center(label, 5)} ]`;
}
var BOARD = 53;
var WIDTHS = [13, 12, 13, 12];
var ORB_PACE = 64;
function under(label, value, width) {
  const name = center(label, width);
  const mid = Math.max(0, name.indexOf(label)) + (label.length - 1) / 2;
  const at = Math.floor(mid - (value.length - 1) / 2);
  if (value.length >= width)
    return value;
  const left = Math.max(0, Math.min(at, width - value.length));
  return " ".repeat(left) + value + " ".repeat(width - left - value.length);
}
var REEL02 = ["9", "10", "J", "Q", "K", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB"];
var REEL2 = ["9", "10", "J", "Q", "K", "WILD", "FAN", "KOI", "LOTUS", "DRGN", "MOON", "ORB"];
var FACES2 = ["50", "100", "150", "250", "400", "750", "MINI", "MINOR", "MAJOR"];
function creditLine(play) {
  const bet = 50 * play.coin;
  return `Credits: ${commas(play.credits)}     Bet: ${commas(bet)}     Win: ${commas(play.win)}`;
}
function toneOf(label) {
  switch (label) {
    case "FAN":
      return "fan";
    case "KOI":
      return "koi";
    case "LOTUS":
      return "lotus";
    case "DRGN":
      return "dragon";
    case "WILD":
      return "wild";
    case "MOON":
      return "moon";
    case "ORB":
      return "orb";
    case "DOOR":
      return "door";
    case "MINI":
      return "mini";
    case "MINOR":
      return "minor";
    case "MAJOR":
      return "major";
    case "GRAND":
      return "grand";
    default:
      return /^\d+$/.test(label) ? "orb" : "card";
  }
}
function lockedAt(play, r, c) {
  const phase = play.phase;
  if (phase.kind !== "hold" && phase.kind !== "jackpot")
    return false;
  return phase.locked[r]?.[c] != null;
}
function callout(play) {
  const phase = play.phase;
  if (phase.kind === "jackpot") {
    const name = phase.pending[0]?.name ?? "MAJOR";
    return { banner: name, bannerTone: name === "GRAND" ? "grand" : "major" };
  }
  if (phase.kind === "hold")
    return { banner: `HOLD & SPIN    ${phase.respins} RESPINS`, bannerTone: "orb" };
  if (phase.kind === "arm")
    return { banner: "HOLD & SPIN", bannerTone: "orb" };
  if (phase.kind === "doors")
    return { banner: "MYSTERY DOORS", bannerTone: "door" };
  if (phase.kind === "free")
    return { banner: `FREE GAMES    ${phase.left} LEFT`, bannerTone: "moon" };
  if (play.win > 0)
    return { banner: "WINNER", bannerTone: "gold" };
  return { banner: "", bannerTone: "gold" };
}
function barOf(play) {
  if (play.status.startsWith("Not enough"))
    return "broke";
  if (play.phase.kind === "jackpot")
    return play.phase.pending[0]?.name === "GRAND" ? "grand" : "major";
  if (play.phase.kind === "doors")
    return "door";
  if (play.phase.kind === "arm" || play.phase.kind === "hold")
    return "hold";
  if (play.phase.kind === "free")
    return "free";
  if (play.win > 0)
    return "win";
  return "play";
}
function picture(play) {
  const meter = (coins) => commas(coins * play.coin);
  const holding = play.phase.kind === "hold" || play.phase.kind === "jackpot";
  const hot = holding ? [] : hotCells(play.rows);
  const prize = play.phase.kind === "jackpot" ? play.phase.pending[0]?.name : undefined;
  const meters = [
    ["MINI", meter(1000), "mini"],
    ["MINOR", meter(5000), "minor"],
    ["MAJOR", meter(play.major), "major"],
    ["GRAND", meter(play.grand), "grand"]
  ].map(([name, value, tone]) => ({ name, value, tone, look: prize === name ? "lock" : "still" }));
  const rows = play.rows.map((line, r) => line.map((label, c) => {
    const locked = lockedAt(play, r, c);
    const dim = holding && !locked;
    const look = hot[r]?.[c] ? "win" : locked || play.phase.kind === "arm" && label === "ORB" ? "lock" : "still";
    return { text: box(label), tone: dim ? "dim" : toneOf(label), look };
  }));
  const note = callout(play);
  return {
    meters: [...meters],
    rows,
    credits: creditLine(play),
    feature: play.feature,
    status: play.status,
    spin: note.banner ? center(note.banner, BOARD) : "",
    bar: barOf(play),
    wait: 0,
    ...note
  };
}
function stopsFor(rows) {
  const base = [6, 9, 12, 16, 20];
  return base.map((ticks, reel) => ticks + (rows[0]?.[reel] ?? "A").charCodeAt(0) % 3);
}
function rolling(after, tick, stops, wait) {
  const pic = picture(after);
  const moving = stops.map((stop) => tick < stop);
  pic.rows = pic.rows.map((line, r) => line.map((cell, reel) => {
    if (!moving[reel])
      return { ...cell, look: "still" };
    const strip = reel === 0 ? REEL02 : REEL2;
    const label = strip[(tick + r * 3 + reel * 2) % strip.length];
    return { text: box(label), tone: toneOf(label), look: "spin" };
  }));
  return { ...pic, spin: center("SPINNING", BOARD), banner: "", bar: "spin", wait };
}
function reelSpin(before, after) {
  const kind = before.phase.kind;
  if (kind === "arm" || kind === "hold")
    return true;
  if (kind === "base" || kind === "free")
    return after.rows !== before.rows;
  return false;
}
function coast(before, after, from) {
  if (!reelSpin(before, after))
    return [picture(after)];
  if (before.phase.kind === "arm" || before.phase.kind === "hold")
    return land(before, after);
  const remain = stopsFor(after.rows);
  const last = Math.max(...remain);
  const slowing = Array.from({ length: last }, (_, step) => rolling(after, from + step, remain.map((n) => from + n), 32 + step * 14));
  return [...slowing, picture(after)];
}
function openings(before, after) {
  const spots = [];
  after.rows.forEach((line, r) => line.forEach((label, c) => label !== before.rows[r]?.[c] && spots.push([r, c])));
  if (spots.length === 0 && before.phase.kind === "hold") {
    before.phase.locked.forEach((line, r) => line.forEach((cell, c) => cell == null && spots.push([r, c])));
  }
  return spots;
}
function land(before, after) {
  const end = picture(after);
  const spots = openings(before, after);
  if (spots.length === 0)
    return [end];
  const miss = after.rows.every((line, r) => line.every((label, c) => label === before.rows[r]?.[c]));
  const ticks = miss ? [0, 1, 2] : [0, 1, 2, 3, 4];
  return [...ticks.map((tick) => cover(after, spots, tick, ORB_PACE + tick * 36)), end];
}
function cover(play, open, tick, wait) {
  const pic = picture(play);
  for (const [r, c] of open) {
    const row = pic.rows[r];
    const label = FACES2[(tick + r + c) % FACES2.length];
    if (row)
      row[c] = { text: box(label), tone: toneOf(label), look: "spin" };
  }
  return { ...pic, spin: center("HOLD & SPIN", BOARD), banner: "", bar: "spin", wait };
}
function esc(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function span(text, tone, look) {
  return `<span class="${tone} ${look}">${esc(text)}</span>`;
}
function markup(pic) {
  const width = [13, 12, 13, 12];
  const col = (text, tone, look, i) => span(center(text, width[i] ?? 12), tone, look);
  const meters = pic.meters.map((meter, i) => col(meter.name, meter.tone, "still", i)).join(" ");
  const values = pic.meters.map((meter, i) => span(under(meter.name, meter.value, WIDTHS[i] ?? 12), meter.tone, meter.look)).join(" ");
  const rows = pic.rows.map((line) => line.map((cell) => cell.look === "win" ? `<span class="hit">${esc(cell.text)}</span>` : span(cell.text, cell.tone, cell.look)).join("  ")).join(`
`);
  const label = pic.spin.trim();
  const spin = label ? `<span class="banner ${pic.bar}">${esc(center(label, BOARD))}</span>` : "";
  return `${span("AUTUMN MOON", "gold", "still")}

${meters}
${values}
${spin}
${rows}

${span(pic.credits, "card", "still")}
${span(pic.feature, "gold", "still")}`;
}

// src/page.ts
function need(id) {
  const el = document.querySelector(id);
  if (!(el instanceof HTMLElement))
    throw new Error("missing page");
  return el;
}
var board = need("#screen");
var bar = need("#status");
var copy = need("#rules");
var play = opened();
var busy = false;
var down = false;
var shownCoin = -1;
var chance = live(seeded(1));
function opened() {
  const name = new URLSearchParams(location.search).get("state");
  return name && stage(name) || newPlay();
}
function draw(pic, coin) {
  board.innerHTML = markup(pic);
  bar.textContent = pic.status;
  bar.className = pic.bar;
  if (coin !== shownCoin) {
    copy.innerHTML = rulesHtml(coin);
    shownCoin = coin;
  }
}
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 2 ** 32;
  };
}
async function playSpin(next) {
  busy = true;
  const list = coast(play, next, 0);
  for (let i = 0;i < list.length; i++) {
    draw(list[i], next.coin);
    if (i < list.length - 1)
      await new Promise((resolve) => setTimeout(resolve, list[i].wait));
  }
  play = next;
  busy = false;
}
function press(key) {
  if (busy || down)
    return;
  if (key !== "spin") {
    play = act(play, key, chance);
    draw(picture(play), play.coin);
    return;
  }
  down = true;
  playSpin(act(play, "spin", chance));
}
draw(picture(play), play.coin);
document.addEventListener("keydown", (event) => {
  const key = event.key === "Enter" || event.key === " " ? "spin" : event.key === "ArrowRight" ? "coinUp" : event.key === "ArrowLeft" ? "coinDown" : null;
  if (!key || event.repeat)
    return;
  event.preventDefault();
  press(key);
});
document.addEventListener("keyup", (event) => {
  if (event.key === "Enter" || event.key === " ")
    down = false;
});
window.addEventListener("blur", () => {
  down = false;
});
window.autumnState = (name) => {
  if (down || busy)
    return;
  const next = stage(name);
  if (!next)
    return;
  play = next;
  draw(picture(play), play.coin);
};
