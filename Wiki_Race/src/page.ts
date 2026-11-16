import { current, hops, initial, step, type State } from "./game";
import { decode, encode } from "./share";
import { classify, fetchArticle, prepare, type Article } from "./wiki";

const raceEl = document.getElementById("race")!;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const main = document.getElementById("main")!;

let state: State = initial();
let frame: HTMLIFrameElement | null = null;
let statsLine: HTMLParagraphElement | null = null;
let backBtn: HTMLButtonElement | null = null;
let hopsSpan: HTMLSpanElement | null = null;
let timeSpan: HTMLSpanElement | null = null;
let noteEl: HTMLSpanElement | null = null;

// Every navigation (follow, back, reset, new race) bumps this; an async fetch
// whose seq no longer matches is stale and must not paint or dispatch.
let seq = 0;
let armedAt = 0;
let finalMs = 0;
let tick: ReturnType<typeof setInterval> | null = null;

const cache = new Map<string, Article>();

function format(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function startTick() {
  if (tick === null) tick = setInterval(paintTime, 500);
}

function stopTick() {
  if (tick !== null) {
    clearInterval(tick);
    tick = null;
  }
}

type SetupUi = { button: HTMLButtonElement; note: HTMLSpanElement };

let setupUi: SetupUi | null = null;

function paintSetup(opts: { start?: string; end?: string } = {}): SetupUi {
  frame = null;
  statsLine = backBtn = hopsSpan = timeSpan = noteEl = null;
  raceEl.textContent = "";
  main.replaceChildren();

  const startInput = document.createElement("input");
  startInput.value = opts.start ?? "Earth";
  startInput.size = 30;
  const endInput = document.createElement("input");
  endInput.value = opts.end ?? "Moon";
  endInput.size = 30;
  const startLabel = document.createElement("label");
  startLabel.textContent = "Start page: ";
  startLabel.append(startInput);
  const endLabel = document.createElement("label");
  endLabel.textContent = "End page: ";
  endLabel.append(endInput);

  const button = document.createElement("button");
  button.textContent = "Start the race";
  const note = document.createElement("span");
  note.className = "note";

  const ui: SetupUi = { button, note };
  const form = document.createElement("form");
  const p1 = document.createElement("p");
  p1.append(startLabel);
  const p2 = document.createElement("p");
  p2.append(endLabel);
  const p3 = document.createElement("p");
  p3.append(button, " ", note);
  form.append(p1, p2, p3);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void beginRace(startInput.value.trim(), endInput.value.trim(), ui);
  });
  main.append(form);
  setupUi = ui;
  return ui;
}

async function beginRace(startRaw: string, endRaw: string, ui: SetupUi) {
  const { button, note } = ui;
  const bad = (msg: string) => {
    note.textContent = msg;
    note.classList.add("bad");
  };
  note.textContent = "";
  note.classList.remove("bad");
  if (!startRaw || !endRaw) return bad("Enter both pages.");

  button.disabled = true;
  button.textContent = "Checking…";
  const mySeq = ++seq;
  const [s, e] = await Promise.all([
    fetchArticle(startRaw).catch(() => null),
    fetchArticle(endRaw).catch(() => null),
  ]);
  if (mySeq !== seq) return;
  button.disabled = false;
  button.textContent = "Start the race";
  if (!s) return bad(`Could not find "${startRaw}" on Wikipedia.`);
  if (!e) return bad(`Could not find "${endRaw}" on Wikipedia.`);
  if (s.canonical === e.canonical) return bad("Start and end are the same page.");
  cacheArticle(startRaw, s);
  cacheArticle(endRaw, e);
  startRace(s.canonical, e.canonical);
}

function cacheArticle(key: string, article: Article) {
  // Single choke point: every cached article is prepared exactly once, so
  // writeWindow can write html as-is (and Back never re-runs the regexes).
  const prepared = { ...article, html: prepare(article.html) };
  cache.set(article.canonical, prepared);
  if (key !== article.canonical) cache.set(key, prepared);
}

function startRace(start: string, end: string) {
  seq++;
  state = step(state, { type: "start", start, end });
  history.replaceState(null, "", location.pathname + location.search + encode({ start, end }));
  paintRace();
}

function paintRace() {
  raceEl.textContent = `${state.start} → ${state.end}`;
  main.replaceChildren();

  statsLine = document.createElement("p");
  backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", goBack);
  hopsSpan = document.createElement("span");
  timeSpan = document.createElement("span");
  noteEl = document.createElement("span");
  noteEl.className = "note";
  statsLine.append(backBtn, " ", hopsSpan, " ", timeSpan, " ", noteEl);

  frame = document.createElement("iframe");
  frame.title = "Wikipedia article";

  main.append(statsLine, frame);
  paintStats();
  void showArticle(state.start);
}

async function showArticle(title: string) {
  const mySeq = seq;
  const article = await loadCached(title);
  if (mySeq !== seq || !article || !frame) {
    if (mySeq === seq && noteEl) {
      noteEl.textContent = `Could not load "${title}" — press Reset and try again.`;
      noteEl.classList.add("bad");
    }
    return;
  }
  writeWindow(frame, article.html);
}

async function loadCached(title: string): Promise<Article | null> {
  const hit = cache.get(title);
  if (hit) return hit;
  const article = await fetchArticle(title).catch(() => null);
  if (article) cacheArticle(title, article);
  return article;
}

async function followLink(linkTitle: string) {
  if (state.phase !== "racing") return;
  const mySeq = ++seq;
  if (!armedAt) {
    armedAt = Date.now();
    startTick();
  }
  const article = await loadCached(linkTitle);
  if (mySeq !== seq || state.phase !== "racing") return;
  if (!article || !frame) {
    if (noteEl) {
      noteEl.textContent = `Could not load "${linkTitle}" — try another link.`;
      noteEl.classList.add("bad");
    }
    return;
  }
  if (noteEl) {
    noteEl.textContent = "";
    noteEl.classList.remove("bad");
  }
  state = step(state, { type: "follow", title: article.canonical });
  writeWindow(frame, article.html);
  paintStats();
  if (state.phase === "won") win();
  else if (state.phase === "lost") lose();
}

function goBack() {
  if (state.phase !== "racing" || state.path.length <= 1) return;
  seq++;
  state = step(state, { type: "back" });
  const title = current(state);
  const article = title === undefined ? undefined : cache.get(title);
  if (article && frame) writeWindow(frame, article.html);
  paintStats();
}

function reset() {
  seq++;
  stopTick();
  armedAt = 0;
  finalMs = 0;
  state = initial();
  cache.clear();
  history.replaceState(null, "", location.pathname + location.search);
  paintSetup();
}

function paintStats() {
  if (!statsLine || !backBtn || !hopsSpan) return;
  backBtn.disabled = state.phase !== "racing" || state.path.length <= 1;
  hopsSpan.textContent = `Hops: ${hops(state)}`;
  paintTime();
}

function paintTime() {
  if (!timeSpan) return;
  const ms = state.phase === "won" ? finalMs : armedAt ? Date.now() - armedAt : 0;
  timeSpan.textContent = `Time: ${format(ms)}`;
}

function win() {
  stopTick();
  const finalMs = armedAt ? Date.now() - armedAt : 0;
  const n = hops(state);
  const unit = n === 1 ? "hop" : "hops";
  const time = format(finalMs);
  const result = `Wiki Race: ${state.start} → ${state.end} in ${n} ${unit} and ${time}`;

  statsLine!.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = `${state.end} reached in ${n} ${unit} and ${time}`;
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy result";
  const input = document.createElement("input");
  input.readOnly = true;
  input.value = result;
  input.size = Math.max(result.length, 20);
  copyBtn.addEventListener("click", () => {
    const clip = navigator.clipboard;
    if (clip) clip.writeText(result).then(() => (copyBtn.textContent = "Copied!"), () => input.select());
    else input.select();
  });
  statsLine!.append(strong, " ", copyBtn, " ", input);
}

function lose() {
  stopTick();
  statsLine!.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = `Out of hops — the cap is ${hops(state)} and "${state.end}" was never reached.`;
  statsLine!.append(strong);
}

function writeWindow(frame: HTMLIFrameElement, html: string) {
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  wireWindow(doc);
}

function wireWindow(doc: Document) {
  for (const a of doc.querySelectorAll("a[href]")) {
    const link = classify(a.getAttribute("href") ?? "");
    if (link.kind === "article") {
      a.setAttribute("data-title", link.title);
      a.setAttribute("href", "#");
    } else if (link.kind === "dead") {
      a.removeAttribute("href");
    }
    // In-page anchors keep their href and scroll natively — not a hop.
  }
  // document.open() keeps the Document object, so remove-then-add is idempotent
  // whether or not it also drops listeners.
  doc.removeEventListener("click", onWindowClick);
  doc.removeEventListener("keydown", backKey);
  doc.addEventListener("click", onWindowClick);
  doc.addEventListener("keydown", backKey);
}

function onWindowClick(e: Event) {
  const target = e.target;
  if (!target || typeof (target as Element).closest !== "function") return;
  const a = (target as Element).closest("a");
  if (!a) return;
  const title = a.getAttribute("data-title");
  if (title !== null) {
    e.preventDefault();
    void followLink(title);
    return;
  }
  const href = a.getAttribute("href") ?? "";
  if (href.startsWith("#") && href.length > 1) return;
  e.preventDefault();
}

function backKey(e: KeyboardEvent) {
  if (e.key !== "Backspace" || e.repeat) return;
  const t = e.target as HTMLElement | null;
  if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
  if (t && t.isContentEditable) return;
  goBack();
}

resetBtn.addEventListener("click", reset);
document.addEventListener("keydown", backKey);

const fromHash = decode(location.hash);
const ui = paintSetup(fromHash ? { start: fromHash.start, end: fromHash.end } : {});
if (fromHash) void beginRace(fromHash.start, fromHash.end, ui);

// Pasting a race URL into an already-open tab is a same-document navigation —
// the page never reloads, so the hash has to be watched.
window.addEventListener("hashchange", () => {
  const race = decode(location.hash);
  if (!race || !setupUi) return;
  reset();
  void beginRace(race.start, race.end, setupUi);
});
