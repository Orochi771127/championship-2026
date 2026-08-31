import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const root = path.join(repo, "docs/art/production/vfx/faithful-reference-26");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.systemCount, 26);
assert.equal(manifest.systems.length, 26);
assert.equal(manifest.runtimeEligible, false);
assert.equal(manifest.shippingReady, false);
assert.equal(new Set(manifest.systems.map((system) => system.logicalGroup)).size, 26);
let outputCount = 0;
for (const system of manifest.systems) {
  assert.ok(system.sources.some((source) => source.path.endsWith(".nsbmd")));
  assert.ok(system.outputs.some((output) => output.path.endsWith(".glb")));
  assert.equal(system.runtimeEligible, false);
  for (const output of system.outputs) {
    const file = path.join(repo, ...output.path.split("/"));
    assert.ok(fs.statSync(file).isFile());
    assert.equal(fs.statSync(file).size, output.bytes);
    assert.equal(hash(file), output.sha256);
    if (output.glb) assert.ok(output.glb.meshes >= 1);
    outputCount += 1;
  }
}
console.log(`VFX faithful reference validation passed: 26 systems, ${outputCount} converted outputs.`);
