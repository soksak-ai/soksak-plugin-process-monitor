import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";

const check = process.argv.includes("--check");
const manifest = JSON.parse(readFileSync(new URL("./plugin.json", import.meta.url), "utf8"));
if (manifest.version !== JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version) {
  throw new Error("plugin and package versions differ");
}
if (check && !existsSync(new URL("./main.js", import.meta.url))) throw new Error("main.js is missing");
if (check) process.exit(0);
await build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", platform: "browser", outfile: "main.js", minify: true });
