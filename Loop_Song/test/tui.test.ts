import { expect, test } from "bun:test";
import { keyOf, pressesOf } from "../src/tui";

test("a lone press comes back as itself", () => {
  expect(pressesOf("q")).toEqual(["q"]);
  expect(pressesOf("\r")).toEqual(["\r"]);
  expect(pressesOf("\x1b")).toEqual(["\x1b"]);
  expect(pressesOf("\x7f")).toEqual(["\x7f"]);
});

test("an arrow coalesced with Enter splits into two presses", () => {
  expect(pressesOf("\x1b[B\r")).toEqual(["\x1b[B", "\r"]);
  expect(pressesOf("\x1b[A\x1b[D\r")).toEqual(["\x1b[A", "\x1b[D", "\r"]);
});

test("a burst of arrows and letters keeps its order", () => {
  expect(pressesOf("m\x1b[C\x1b[C\r")).toEqual(["m", "\x1b[C", "\x1b[C", "\r"]);
});

test("an escape followed by another key stays Esc plus that key", () => {
  expect(pressesOf("\x1br")).toEqual(["\x1b", "r"]);
});

test("a pasted link arrives as one character per press", () => {
  const link = "https://youtu.be/dQw4w9WgXcQ";
  expect(pressesOf(link)).toEqual([...link]);
});

test("the URL field types every printable, including the command letters", () => {
  for (const ch of "pmrq+-=Q") expect(keyOf(ch, "url")).toEqual({ kind: "char", ch });
  expect(keyOf("\x03", "url")).toEqual({ kind: "quit" });
  expect(keyOf("\x1b", "url")).toEqual({ kind: "restart" });
});

test("the time fields keep the letter commands and type digits", () => {
  expect(keyOf("p", "start")).toEqual({ kind: "play" });
  expect(keyOf("m", "end")).toEqual({ kind: "mode" });
  expect(keyOf("r", "start")).toEqual({ kind: "restart" });
  expect(keyOf("q", "end")).toEqual({ kind: "quit" });
  expect(keyOf("+", "start")).toEqual({ kind: "speed", dir: 1 });
  expect(keyOf("-", "end")).toEqual({ kind: "speed", dir: -1 });
  expect(keyOf("5", "start")).toEqual({ kind: "char", ch: "5" });
  expect(keyOf(".", "end")).toEqual({ kind: "char", ch: "." });
});
