import { describe, expect, test } from "bun:test";
import { decode, encode } from "../src/share";

describe("the race codec", () => {
  test("round-trips a pair", () => {
    const race = { start: "Earth", end: "Moon" };
    expect(decode(encode(race))).toEqual(race);
  });

  test("round-trips spaces, ampersands, and unicode", () => {
    const race = { start: "United States", end: "Éire & I" };
    expect(decode(encode(race))).toEqual(race);
  });

  test("decodes hand-built hashes", () => {
    expect(decode("#s=Earth&e=Moon")).toEqual({ start: "Earth", end: "Moon" });
    expect(decode("#s=United%20States&e=Moon")).toEqual({ start: "United States", end: "Moon" });
  });

  test("rejects missing halves, equal pages, and hashless strings", () => {
    expect(decode("#s=Earth")).toBeNull();
    expect(decode("#e=Moon")).toBeNull();
    expect(decode("#s=Earth&e=Earth")).toBeNull();
    expect(decode("")).toBeNull();
    expect(decode("s=Earth&e=Moon")).toBeNull();
  });
});
