import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const manifestPath = path.join(repo, "assets/production/internal-faithful-baseline/v1/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.packId, "championship:pack:faithful-original");
assert.equal(manifest.binding, "DIRECT_NO_USER_FACING_LOADER");
assert.equal(manifest.publicReleasePermitted, false);
assert.equal(manifest.shippingReady, false);
assert.equal(manifest.sourcePayloadIncluded, false);
assert.equal(manifest.gameplayOrSaveChangesPermitted, false);
assert.equal(manifest.readySlotCount, 5);
assert.equal(manifest.totalSlotCount, 9);
assert.equal(manifest.complete, false);

let fileCount = 0;
for (const slot of Object.values(manifest.slots)) {
  for (const record of slot.files) {
    const source = path.join(repo, ...record.source.split("/"));
    const output = path.join(repo, ...record.path.split("/"));
    assert.ok(fs.statSync(source).isFile());
    assert.ok(fs.statSync(output).isFile());
    assert.equal(fs.statSync(output).size, record.bytes);
    assert.equal(hash(output), record.sha256);
    fileCount += 1;
  }
}
assert.equal(fileCount, manifest.totalFiles);
console.log(`Internal faithful baseline validation passed: ${manifest.readySlotCount}/${manifest.totalSlotCount} slots, ${fileCount} files.`);
