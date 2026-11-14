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

test("all four arrows act: up and down jump sections, left and right walk within one", () => {
  for (const focus of ["url", "start", "end", "play", "speed", "mode"] as const) {
    expect(keyOf("\x1b[A", focus)).toEqual({ kind: "arrow", dir: "up" });
    expect(keyOf("\x1b[B", focus)).toEqual({ kind: "arrow", dir: "down" });
    expect(keyOf("\x1b[C", focus)).toEqual({ kind: "side", dir: "right" });
    expect(keyOf("\x1b[D", focus)).toEqual({ kind: "side", dir: "left" });
  }
});

test("the URL field types every printable, including the old command letters", () => {
  for (const ch of "pmrq+-=Q") expect(keyOf(ch, "url")).toEqual({ kind: "char", ch });
  expect(keyOf("\x03", "url")).toEqual({ kind: "quit" });
  expect(keyOf("\x1b", "url")).toEqual({ kind: "restart" });
});

test("the time fields type digits and a dot, and nothing else", () => {
  for (const focus of ["start", "end"] as const) {
    expect(keyOf("5", focus)).toEqual({ kind: "char", ch: "5" });
    expect(keyOf(".", focus)).toEqual({ kind: "char", ch: "." });
    for (const ch of "pmrq+-=Q") expect(keyOf(ch, focus)).toBeNull();
    expect(keyOf("\r", focus)).toEqual({ kind: "enter" });
    expect(keyOf("\x7f", focus)).toEqual({ kind: "backspace" });
    expect(keyOf("\x1b", focus)).toEqual({ kind: "restart" });
    expect(keyOf("\x03", focus)).toEqual({ kind: "quit" });
  }
});

test("the chips take Enter and commands, but never type", () => {
  for (const focus of ["play", "speed", "mode"] as const) {
    expect(keyOf("p", focus)).toBeNull();
    expect(keyOf("5", focus)).toBeNull();
    expect(keyOf("+", focus)).toBeNull();
    expect(keyOf("\r", focus)).toEqual({ kind: "enter" });
    expect(keyOf("\x7f", focus)).toEqual({ kind: "backspace" });
    expect(keyOf("\x1b", focus)).toEqual({ kind: "restart" });
    expect(keyOf("\x03", focus)).toEqual({ kind: "quit" });
  }
});
