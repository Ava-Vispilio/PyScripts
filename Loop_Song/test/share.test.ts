import { expect, test } from "bun:test";
import { stage } from "../src/game";
import { composeUrl, decode, encode, open } from "../src/share";

test("encode writes every field, window or not", () => {
  expect(encode(stage("loaded")!)).toBe("v=dQw4w9WgXcQ&s=0&e=0&z=1&m=full");
  expect(encode(stage("snippet")!)).toBe("v=dQw4w9WgXcQ&s=12&e=18&z=1&m=snippet");
});

test("decode round-trips what encode wrote", () => {
  for (const name of ["loaded", "snippet"]) {
    const game = stage(name)!;
    const parts = decode("#" + encode(game))!;
    expect(parts.videoId).toBe(game.videoId!);
    expect(parts.window).toEqual(game.window);
    expect(parts.speed).toBe(game.speed);
    expect(parts.mode).toBe(game.mode);
  }
});

test("decode drops bad pieces instead of failing", () => {
  const base = { videoId: "dQw4w9WgXcQ" };
  expect(decode("#v=dQw4w9WgXcQ&s=18&e=12&z=1.3&m=snippet")).toEqual({ ...base, window: null, speed: 1, mode: "full" });
  expect(decode("#v=dQw4w9WgXcQ&s=12.5&e=18&z=0.5")).toEqual({ ...base, window: [12.5, 18], speed: 0.5, mode: "full" });
  expect(decode("v=dQw4w9WgXcQ")).toEqual({ ...base, window: null, speed: 1, mode: "full" });
});

test("decode refuses a hash without a valid id", () => {
  expect(decode("")).toBeNull();
  expect(decode("#s=12&e=18")).toBeNull();
  expect(decode("#v=short")).toBeNull();
  expect(decode("#v=waytoolongid12345")).toBeNull();
});

test("open rebuilds the same game through engine actions alone", () => {
  for (const name of ["loaded", "snippet"]) {
    const game = stage(name)!;
    const rebuilt = open(decode("#" + encode(game))!);
    expect(rebuilt.load).toBe("loaded");
    expect(rebuilt.videoId).toBe(game.videoId);
    expect(rebuilt.window).toEqual(game.window);
    expect(rebuilt.mode).toBe(game.mode);
    expect(rebuilt.speed).toBe(game.speed);
    expect(rebuilt.armed).toBe(false);
  }
});

test("open lands every speed and honors full mode over a set window", () => {
  expect(open({ videoId: "dQw4w9WgXcQ", window: null, speed: 2, mode: "full" }).speed).toBe(2);
  expect(open({ videoId: "dQw4w9WgXcQ", window: null, speed: 0.25, mode: "full" }).speed).toBe(0.25);
  const full = open({ videoId: "dQw4w9WgXcQ", window: [12, 18], speed: 1.5, mode: "full" });
  expect(full.mode).toBe("full");
  expect(full.window).toEqual([12, 18]);
  expect(full.speed).toBe(1.5);
});

test("composeUrl pins the hash onto the page base", () => {
  expect(composeUrl(stage("snippet")!, "https://x.y/Loop_Song/")).toBe(
    "https://x.y/Loop_Song/#v=dQw4w9WgXcQ&s=12&e=18&z=1&m=snippet",
  );
});
