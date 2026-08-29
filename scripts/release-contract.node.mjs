import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const manifest = JSON.parse(readFileSync("plugin.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.contributes.views[0].surfaces[0], "side");
assert.equal(manifest.contributes.views[0].id, "process-monitor");
assert.deepEqual(JSON.parse(readFileSync("release-files.json", "utf8")), ["LICENSE", "main.js", "plugin.json"]);
