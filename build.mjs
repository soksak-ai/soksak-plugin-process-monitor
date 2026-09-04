import { build } from "esbuild";
import { readFileSync } from "node:fs";

// `--check` builds the bundle in memory and compares it with the committed main.js. A release
// packs main.js as committed, so a bundle behind its source ships the old code: measured
// 2026-09-05, 0.0.19 was released with a restore declaration in src and none in main.js, and the
// core refused the view it was meant to fix.
const check = process.argv.includes("--check");
const manifest = JSON.parse(readFileSync(new URL("./plugin.json", import.meta.url), "utf8"));
if (manifest.version !== JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version) {
  throw new Error("plugin and package versions differ");
}
const options = { entryPoints: ["src/index.ts"], bundle: true, format: "esm", platform: "browser", minify: true };
if (check) {
  const { outputFiles } = await build({ ...options, write: false, outfile: "main.js" });
  const built = outputFiles[0].text;
  let committed;
  try {
    committed = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  } catch {
    throw new Error("main.js is missing");
  }
  if (committed !== built) throw new Error("main.js is behind src: run pnpm build");
  process.exit(0);
}
await build({ ...options, outfile: "main.js" });
