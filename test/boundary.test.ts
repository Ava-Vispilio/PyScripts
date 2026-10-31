import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { PAYTABLE, rules } from "../src/engine";

const ROOT = resolve(import.meta.dir, "..");
const ENGINE = join(ROOT, "src/engine");
const PUBLIC = [
  "newGame",
  "step",
  "frames",
  "reelRng",
  "seeded",
  "rules",
  "PAYTABLE",
  "Game",
  "Action",
  "Screen",
  "Tile",
  "Tone",
  "Rng",
];

const sources = (dir: string) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .map((file) => join(ROOT, dir, file));

test("shells reach the engine only through its index", () => {
  const allowed = new Set([ENGINE, join(ENGINE, "index"), join(ENGINE, "index.ts")]);
  const leaks = [...sources("src/tui"), ...sources("src/web"), ...sources("scripts")].flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].flatMap(([, spec]) => {
      if (!spec?.startsWith(".")) return [];
      const target = resolve(dirname(file), spec);
      return target.startsWith(ENGINE) && !allowed.has(target) ? [`${relative(ROOT, file)} -> ${spec}`] : [];
    }),
  );
  expect(leaks).toEqual([]);
});

test("the engine index exports exactly the public names", () => {
  const source = readFileSync(join(ENGINE, "index.ts"), "utf8");
  const statements = source.split(";").map((s) => s.trim()).filter(Boolean);
  const names = statements.flatMap((statement) => {
    const match = statement.match(/^export\s*\{([^}]*)\}\s*from\s*["'][^"']+["']$/);
    if (!match?.[1]) return [`unrecognised export: ${statement}`];
    return match[1]
      .split(",")
      .map((name) => name.trim().replace(/^type\s+/, ""))
      .filter(Boolean)
      .map((name) => name.split(/\s+as\s+/).pop() ?? name);
  });
  expect(names.sort()).toEqual([...PUBLIC].sort());
});

test("no parody sentence carries a digit", () => {
  for (const coin of PAYTABLE.coins) {
    const { parody, odds } = rules(coin);
    for (const sentence of [...parody, odds]) expect(sentence).not.toMatch(/\d/);
  }
});
