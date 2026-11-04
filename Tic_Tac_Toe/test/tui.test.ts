import { expect, test } from "bun:test";
import { pressesOf } from "../src/tui";

test("a lone press comes back as itself", () => {
  expect(pressesOf("q")).toEqual(["q"]);
  expect(pressesOf("\r")).toEqual(["\r"]);
  expect(pressesOf("\x1b")).toEqual(["\x1b"]);
});

test("an arrow coalesced with Enter splits into two presses", () => {
  expect(pressesOf("\x1b[B\r")).toEqual(["\x1b[B", "\r"]);
  expect(pressesOf("\x1b[A\x1b[D\r")).toEqual(["\x1b[A", "\x1b[D", "\r"]);
});

test("a burst of arrows and letters keeps its order", () => {
  expect(pressesOf("q\x1b[C\x1b[C\r")).toEqual(["q", "\x1b[C", "\x1b[C", "\r"]);
});

test("an escape followed by another key stays Esc plus that key", () => {
  expect(pressesOf("\x1br")).toEqual(["\x1b", "r"]);
});
