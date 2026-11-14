import { describe, expect, test } from "bun:test";
import {
  cycleSpeed,
  newGame,
  nudgeSide,
  nudgeSpot,
  SPEEDS,
  stage,
  step,
  videoIdOf,
  type Game,
} from "../src/game";

const typeAll = (game: Game, text: string): Game =>
  [...text].reduce((g, ch) => step(g, { type: "type", ch }), game);

const load = (url: string): Game => step(typeAll(newGame(), url), { type: "accept" });

describe("videoIdOf", () => {
  test("reads every link shape YouTube hands around", () => {
    expect(videoIdOf("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("  https://youtu.be/dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("https://www.youtube.com/watch?si=abc&t=30s&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdOf("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("refuses anything without an id", () => {
    expect(videoIdOf("")).toBeNull();
    expect(videoIdOf("not a link")).toBeNull();
    expect(videoIdOf("https://vimeo.com/12345")).toBeNull();
    expect(videoIdOf("https://www.youtube.com/watch?si=xyz")).toBeNull();
  });
});

describe("the load pipeline", () => {
  test("Enter on an empty draft is a no-op", () => {
    expect(step(newGame(), { type: "accept" })).toEqual(newGame());
  });

  test("a good accept seals the URL and hands the caret to the times, a bad one keeps both", () => {
    const good = load("https://youtu.be/dQw4w9WgXcQ");
    expect(good.focus).toBe("start");
    expect(good.urlLocked).toBe(true);
    const bad = step(typeAll(newGame(), "nope"), { type: "accept" });
    expect(bad.focus).toBe("url");
    expect(bad.urlLocked).toBe(false);
  });

  test("a parseable link enters checking with the old video cleared", () => {
    const game = load("https://youtu.be/dQw4w9WgXcQ");
    expect(game.load).toBe("checking");
    expect(game.videoId).toBe("dQw4w9WgXcQ");
    expect(game.title).toBeNull();
    expect(game.window).toBeNull();
    expect(game.mode).toBe("full");
    expect(game.armed).toBe(false);
  });

  test("garbage marks the link bad and keeps the draft", () => {
    const game = load("not a link");
    expect(game.load).toBe("badLink");
    expect(game.url).toBe("not a link");
    expect(game.videoId).toBeNull();
  });

  test("titled settles the check, notFound rejects it", () => {
    const checking = load("https://youtu.be/dQw4w9WgXcQ");
    const loaded = step(checking, { type: "titled", title: "Test Video" });
    expect(loaded.load).toBe("loaded");
    expect(loaded.title).toBe("Test Video");
    expect(step(load("https://youtu.be/dQw4w9WgXcQ"), { type: "notFound" }).load).toBe("notFound");
  });

  test("titled and notFound only land while the pipeline is live", () => {
    expect(step(newGame(), { type: "titled", title: "X" }).load).toBe("idle");
    expect(step(newGame(), { type: "notFound" }).load).toBe("idle");
    const loaded = step(load("https://youtu.be/dQw4w9WgXcQ"), { type: "titled", title: "Test Video" });
    expect(step(loaded, { type: "notFound" }).load).toBe("loaded");
  });

  test("titled can retitle a loaded video, but never to nothing", () => {
    const loaded = stage("loaded")!;
    expect(step(loaded, { type: "titled", title: "Real Title" }).title).toBe("Real Title");
    expect(step(loaded, { type: "titled", title: "" }).title).toBe("Test Video");
  });
});

describe("the URL seal", () => {
  test("a sealed URL refuses the keys until Enter unlocks it", () => {
    let game = stage("loaded")!;
    game = step(game, { type: "focus", spot: "url" });
    expect(step(game, { type: "type", ch: "x" })).toBe(game);
    expect(step(game, { type: "backspace" })).toBe(game);
    const unlocked = step(game, { type: "accept" });
    expect(unlocked.urlLocked).toBe(false);
    expect(unlocked.load).toBe("loaded");
    expect(unlocked.videoId).toBe("dQw4w9WgXcQ");
    expect(unlocked.title).toBe("Test Video");
    expect(step(unlocked, { type: "backspace" }).url).toBe("https://youtu.be/dQw4w9WgXc");
  });

  test("Enter on an unlocked loaded URL starts a fresh check", () => {
    let game = stage("loaded")!;
    game = step(game, { type: "focus", spot: "url" });
    game = step(game, { type: "accept" });
    const rechecked = step(game, { type: "accept" });
    expect(rechecked.load).toBe("checking");
    expect(rechecked.urlLocked).toBe(true);
    expect(rechecked.focus).toBe("start");
  });
});

describe("typing", () => {
  test("printables land in the focused field, backspace removes", () => {
    let game = newGame();
    game = typeAll(game, "abc");
    expect(game.url).toBe("abc");
    game = step(game, { type: "backspace" });
    expect(game.url).toBe("ab");
  });

  test("typing during checking is refused", () => {
    const checking = load("https://youtu.be/dQw4w9WgXcQ");
    expect(step(checking, { type: "type", ch: "x" })).toBe(checking);
    expect(step(checking, { type: "backspace" })).toBe(checking);
    expect(step(checking, { type: "accept" })).toBe(checking);
  });

  test("editing after a bad link returns the pipeline to idle", () => {
    const bad = load("nope");
    const edited = step(bad, { type: "type", ch: "!" });
    expect(edited.load).toBe("idle");
    expect(edited.url).toBe("nope!");
  });

  test("the chips never type", () => {
    for (const spot of ["play", "speed", "mode"] as const) {
      let game = step(stage("loaded")!, { type: "focus", spot });
      expect(step(game, { type: "type", ch: "5" })).toBe(game);
      expect(step(game, { type: "backspace" })).toBe(game);
    }
  });

  test("only single printable characters type", () => {
    const game = step(newGame(), { type: "type", ch: "ab" });
    expect(game.url).toBe("");
    expect(step(newGame(), { type: "type", ch: "\n" }).url).toBe("");
  });
});

describe("the snippet", () => {
  test("confirmed times set the window and switch the mode", () => {
    const snippet = stage("snippet")!;
    expect(snippet.snip).toBe("set");
    expect(snippet.window).toEqual([12, 18]);
    expect(snippet.mode).toBe("snippet");
  });

  test("start must sit before end", () => {
    expect(stage("badtimes")!.snip).toBe("bad");
    let game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", spot: "start" }), "18");
    game = typeAll(step(game, { type: "focus", spot: "end" }), "18");
    expect(step(game, { type: "accept" }).snip).toBe("bad");
  });

  test("decimals parse, garbage does not", () => {
    let game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", spot: "start" }), "12.5");
    game = typeAll(step(game, { type: "focus", spot: "end" }), "18");
    expect(step(game, { type: "accept" }).window).toEqual([12.5, 18]);
    game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", spot: "start" }), "1:30");
    game = typeAll(step(game, { type: "focus", spot: "end" }), "18");
    expect(step(game, { type: "accept" }).snip).toBe("bad");
  });

  test("times confirm only against a loaded video", () => {
    let game = newGame();
    game = typeAll(step(game, { type: "focus", spot: "start" }), "12");
    game = typeAll(step(game, { type: "focus", spot: "end" }), "18");
    expect(step(game, { type: "accept" }).snip).toBe("empty");
  });

  test("Enter on an empty pair is a no-op, not a red bar", () => {
    const loaded = stage("loaded")!;
    expect(step(loaded, { type: "accept" })).toBe(loaded);
  });

  test("Enter on a half-typed pair hops the caret to the missing field", () => {
    let game = stage("loaded")!;
    game = typeAll(game, "12");
    const hop = step(game, { type: "accept" });
    expect(hop.focus).toBe("end");
    expect(hop.snip).toBe("empty");
    expect(hop.window).toBeNull();
    // Enter again with the caret already on the missing field stays put.
    expect(step(hop, { type: "accept" })).toEqual(hop);
  });

  test("a lone End hops back to Start, before any video too", () => {
    let game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", spot: "end" }), "18");
    expect(step(game, { type: "accept" }).focus).toBe("start");
    let bare = newGame();
    bare = typeAll(step(bare, { type: "focus", spot: "start" }), "12");
    const hopped = step(bare, { type: "accept" });
    expect(hopped.focus).toBe("end");
    expect(hopped.snip).toBe("empty");
    expect(hopped.window).toBeNull();
  });

  test("locked times refuse the keys, and Enter unlocks while keeping the window", () => {
    const snippet = stage("snippet")!;
    const locked = step(snippet, { type: "type", ch: "9" });
    expect(locked).toBe(snippet);
    const unlocked = step(snippet, { type: "accept" });
    expect(unlocked.snip).toBe("empty");
    expect(unlocked.window).toEqual([12, 18]);
    expect(unlocked.mode).toBe("snippet");
    const relocked = step(unlocked, { type: "accept" });
    expect(relocked.snip).toBe("set");
    expect(relocked.window).toEqual([12, 18]);
  });

  test("editing a bad pair returns it to neutral", () => {
    const bad = stage("badtimes")!;
    const edited = step(bad, { type: "backspace" });
    expect(edited.snip).toBe("empty");
    expect(edited.end).toBe("1");
  });
});

describe("speed, mode, and play", () => {
  test("cycleSpeed wraps at both ends", () => {
    expect(cycleSpeed(2)).toBe(0.25);
    expect(cycleSpeed(0.25)).toBe(0.5);
    expect(cycleSpeed(1)).toBe(1.25);
    expect(SPEEDS as readonly number[]).toContain(cycleSpeed(3.7));
  });

  test("Enter on the speed chip cycles through the steps", () => {
    let game = step(stage("loaded")!, { type: "focus", spot: "speed" });
    for (let i = 0; i < 5; i++) game = step(game, { type: "accept" });
    expect(game.speed).toBe(0.25);
    game = step(game, { type: "accept" });
    expect(game.speed).toBe(0.5);
    for (let i = 0; i < 7; i++) game = step(game, { type: "accept" });
    expect(game.speed).toBe(0.25);
  });

  test("snippet mode refuses without a confirmed window", () => {
    const loaded = step(stage("loaded")!, { type: "focus", spot: "mode" });
    expect(step(loaded, { type: "accept" }).mode).toBe("full");
  });

  test("Enter on the mode chip toggles, and a window keeps it reachable", () => {
    let game = step(stage("snippet")!, { type: "focus", spot: "mode" });
    game = step(game, { type: "accept" });
    expect(game.mode).toBe("full");
    expect(game.window).toEqual([12, 18]);
    game = step(game, { type: "accept" });
    expect(game.mode).toBe("snippet");
  });

  test("Enter on the play chip toggles the arm, only against a loaded video", () => {
    let game = step(newGame(), { type: "focus", spot: "play" });
    expect(step(game, { type: "accept" }).armed).toBe(false);
    game = step(stage("loaded")!, { type: "focus", spot: "play" });
    game = step(game, { type: "accept" });
    expect(game.armed).toBe(true);
    game = step(game, { type: "accept" });
    expect(game.armed).toBe(false);
  });
});

describe("spots and reset", () => {
  test("vertical movement jumps between sections, wrapping both ways", () => {
    const at = (spot: Game["focus"]): Game => step(newGame(), { type: "focus", spot });
    expect(nudgeSpot(at("url"), 1)).toBe("play");
    expect(nudgeSpot(at("play"), 1)).toBe("start");
    expect(nudgeSpot(at("speed"), 1)).toBe("start");
    expect(nudgeSpot(at("mode"), 1)).toBe("start");
    expect(nudgeSpot(at("start"), 1)).toBe("url");
    expect(nudgeSpot(at("end"), 1)).toBe("url");
    expect(nudgeSpot(at("url"), -1)).toBe("end");
    expect(nudgeSpot(at("start"), -1)).toBe("mode");
    expect(nudgeSpot(at("end"), -1)).toBe("mode");
  });

  test("a sealed pair leaves the section walk while the loop is full", () => {
    const sealed = stage("fullloop")!;
    expect(sealed.mode).toBe("full");
    expect(sealed.window).toEqual([12, 18]);
    // The caret rides the mode chip, and both arrows skip the pair.
    expect(sealed.focus).toBe("mode");
    expect(nudgeSpot(sealed, 1)).toBe("url");
    expect(nudgeSpot(sealed, -1)).toBe("url");
    const onUrl = step(sealed, { type: "focus", spot: "url" });
    expect(nudgeSpot(onUrl, 1)).toBe("play");
    expect(nudgeSpot(onUrl, -1)).toBe("mode");
    // The sealed fields refuse the caret outright.
    expect(step(sealed, { type: "focus", spot: "start" })).toBe(sealed);
    expect(step(sealed, { type: "focus", spot: "end" })).toBe(sealed);
    // The mode chip is the way back: toggling to the snippet returns the pair.
    const snip = step(sealed, { type: "accept" });
    expect(snip.mode).toBe("snippet");
    expect(nudgeSpot(snip, 1)).toBe("start");
  });

  test("horizontal movement walks a torus within a section, and the URL stands alone", () => {
    expect(nudgeSide("play", 1)).toBe("speed");
    expect(nudgeSide("speed", 1)).toBe("mode");
    expect(nudgeSide("mode", 1)).toBe("play");
    expect(nudgeSide("mode", -1)).toBe("speed");
    expect(nudgeSide("play", -1)).toBe("mode");
    expect(nudgeSide("start", 1)).toBe("end");
    expect(nudgeSide("end", 1)).toBe("start");
    expect(nudgeSide("end", -1)).toBe("start");
    expect(nudgeSide("url", 1)).toBe("url");
    expect(nudgeSide("url", -1)).toBe("url");
  });

  test("restart returns a fresh form from anywhere", () => {
    expect(step(stage("snippet")!, { type: "restart" })).toEqual(newGame());
    expect(step(stage("bad")!, { type: "restart" })).toEqual(newGame());
  });

  test("stages cover the pipeline", () => {
    expect(stage("")).toEqual(newGame());
    expect(stage("checking")!.load).toBe("checking");
    expect(stage("loaded")!.load).toBe("loaded");
    expect(stage("snippet")!.mode).toBe("snippet");
    expect(stage("snippet")!.urlLocked).toBe(true);
    expect(stage("fullloop")!.mode).toBe("full");
    expect(stage("bad")!.load).toBe("badLink");
    expect(stage("notfound")!.load).toBe("notFound");
    expect(stage("badtimes")!.snip).toBe("bad");
    expect(stage("nonsense")).toBeNull();
  });
});
