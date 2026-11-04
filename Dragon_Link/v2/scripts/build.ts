import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const docs = join(root, "docs");

await rm(docs, { recursive: true, force: true });

// A classic script, not a module: browsers refuse module scripts on file:// pages.
const web = await Bun.build({
  entrypoints: [join(root, "src/page.ts")],
  outdir: docs,
  naming: "main.js",
  target: "browser",
  format: "iife",
  minify: true,
});
if (!web.success) {
  for (const log of web.logs) console.error(log);
  process.exit(1);
}

await Bun.write(join(docs, "index.html"), await Bun.file(join(root, "src/index.html")).text());
await Bun.write(join(docs, ".nojekyll"), "");

const tui = Bun.spawnSync(
  [process.execPath, "build", "--compile", join(root, "src/tui.ts"), "--outfile", join(root, "dist/autumn-moon-v2")],
  { stdout: "inherit", stderr: "inherit" },
);
if (tui.exitCode !== 0) process.exit(tui.exitCode);

console.log(`page: ${join(docs, "index.html")}\nterminal: ${join(root, "dist/autumn-moon-v2")}`);
