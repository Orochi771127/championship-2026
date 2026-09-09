import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
test("every registered art bundle has its manifest in the full local acceptance environment", () => {
  for (const entry of index.entries) assert.ok(fs.existsSync(entry.manifestPath), entry.manifestPath);
});
