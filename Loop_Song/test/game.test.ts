import { describe, expect, test } from "bun:test";
import {
  newGame,
  nudgeField,
  nudgeSpeed,
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

  test("a good accept hands the caret to the snippet fields, a bad one keeps it", () => {
    expect(load("https://youtu.be/dQw4w9WgXcQ").focus).toBe("start");
    expect(step(typeAll(newGame(), "nope"), { type: "accept" }).focus).toBe("url");
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

  test("editing a set snippet unsets it and returns to full loop", () => {
    const snippet = stage("snippet")!;
    const edited = step(snippet, { type: "backspace" });
    expect(edited.snip).toBe("empty");
    expect(edited.window).toBeNull();
    expect(edited.mode).toBe("full");
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
    game = typeAll(step(game, { type: "focus", field: "start" }), "18");
    game = typeAll(step(game, { type: "focus", field: "end" }), "18");
    expect(step(game, { type: "accept" }).snip).toBe("bad");
  });

  test("decimals parse, garbage does not", () => {
    let game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", field: "start" }), "12.5");
    game = typeAll(step(game, { type: "focus", field: "end" }), "18");
    expect(step(game, { type: "accept" }).window).toEqual([12.5, 18]);
    game = stage("loaded")!;
    game = typeAll(step(game, { type: "focus", field: "start" }), "1:30");
    game = typeAll(step(game, { type: "focus", field: "end" }), "18");
    expect(step(game, { type: "accept" }).snip).toBe("bad");
  });

  test("times confirm only against a loaded video", () => {
    let game = typeAll(newGame(), "12");
    expect(step(game, { type: "accept" }).snip).toBe("empty");
  });
});

describe("speed and mode", () => {
  test("speed steps run 0.25x to 2x and clamp at both ends", () => {
    let game = stage("loaded")!;
    for (let i = 0; i < 10; i++) game = step(game, { type: "faster" });
    expect(game.speed).toBe(2);
    for (let i = 0; i < 12; i++) game = step(game, { type: "slower" });
    expect(game.speed).toBe(0.25);
  });

  test("nudgeSpeed clamps through the same steps", () => {
    expect(nudgeSpeed(2, 1)).toBe(2);
    expect(nudgeSpeed(0.25, -1)).toBe(0.25);
    expect(nudgeSpeed(1, 1)).toBe(1.25);
    expect(nudgeSpeed(1, -1)).toBe(0.75);
    expect(SPEEDS as readonly number[]).toContain(nudgeSpeed(3.7, 1));
  });

  test("snippet mode refuses without a confirmed window", () => {
    expect(step(stage("loaded")!, { type: "toggleMode" }).mode).toBe("full");
    expect(step(stage("snippet")!, { type: "toggleMode" }).mode).toBe("full");
    expect(step(stage("snippet")!, { type: "toggleMode" })).not.toBe(stage("snippet")!);
  });

  test("the mode chip arms only against a loaded video", () => {
    expect(step(newGame(), { type: "arm" }).armed).toBe(false);
    expect(step(stage("loaded")!, { type: "arm" }).armed).toBe(true);
  });
});

describe("fields and reset", () => {
  test("the field ring visits url, start, end", () => {
    expect(nudgeField("url", 1)).toBe("start");
    expect(nudgeField("start", 1)).toBe("end");
    expect(nudgeField("end", 1)).toBe("url");
    expect(nudgeField("url", -1)).toBe("end");
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
    expect(stage("bad")!.load).toBe("badLink");
    expect(stage("notfound")!.load).toBe("notFound");
    expect(stage("badtimes")!.snip).toBe("bad");
    expect(stage("nonsense")).toBeNull();
  });
});
