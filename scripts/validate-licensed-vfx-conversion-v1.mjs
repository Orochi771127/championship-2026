import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const bundleRoot = path.join(repoRoot, "assets/production/vfx/original-rom-conversion-v1");
const manifest = readJson(path.join(bundleRoot, "manifest.json"));
const receipt = readJson(path.join(repoRoot, "docs/art/production/vfx/ORIGINAL_ROM_CONVERSION_V1_RECEIPT.json"));
const rights = readJson(path.join(repoRoot, "docs/legal/RIGHTS_EVIDENCE_REGISTRY.json"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

assert.equal(manifest.bundleId, "championship-vfx-original-rom-conversion-v1");
assert.equal(manifest.systems.length, 5);
assert.equal(manifest.runtimeCandidate, true);
assert.equal(manifest.runtimeRegistryEnabled, false);
assert.equal(manifest.shippingReady, false);
assert.equal(manifest.sourcePayloadIncluded, false);
assert.equal(receipt.bundleId, manifest.bundleId);
assert.equal(receipt.rightsEvidenceId, manifest.rightsEvidenceId);
assert.equal(receipt.sourcePayloadIncluded, false);
assert.equal(receipt.sourceLocationIncluded, false);
assert.equal(receipt.systems.length, 5);

const evidence = rights.entries.find((entry) => entry.evidenceId === manifest.rightsEvidenceId);
assert.ok(evidence, "Rights evidence ID must exist in the repository ledger.");
assert.equal(evidence.document.status, "PENDING_PRIVATE_DOCUMENT_LINK");
assert.equal(evidence.decisions.conversionPermitted, true);
assert.equal(evidence.decisions.runtimeIntegrationPermitted, false);
assert.equal(evidence.decisions.shippingPermitted, false);

let glbCount = 0;
let pngCount = 0;
let sidecarCount = 0;
for (const system of manifest.systems) {
  assert.equal(system.runtimeCandidate, true);
  assert.equal(system.runtimeRegistryEnabled, false);
  assert.equal(system.shippingReady, false);
  assert.ok(system.knownGaps.length >= 1);

  for (const output of system.outputs) {
    assert.doesNotMatch(output.path, /\.(?:nds|srl|nsbmd|nsbca|nsbta|nsbma|nsbva)$/i);
    const absolutePath = path.join(repoRoot, ...output.path.split("/"));
    assert.ok(fs.statSync(absolutePath).isFile(), `${output.path} must exist.`);
    assert.equal(fs.statSync(absolutePath).size, output.size);
    assert.equal(sha256(absolutePath), output.sha256);
    if (output.path.endsWith(".glb")) {
      glbCount += 1;
      const header = fs.readFileSync(absolutePath).subarray(0, 12);
      assert.equal(header.toString("ascii", 0, 4), "glTF");
      assert.equal(header.readUInt32LE(4), 2);
      assert.equal(header.readUInt32LE(8), output.size);
      assert.ok(output.glb.meshes >= 1);
    } else if (output.path.endsWith(".png")) {
      pngCount += 1;
    } else if (output.path.endsWith(".json")) {
      sidecarCount += 1;
      assert.ok(output.sidecar?.frameCount > 0);
      assert.ok(output.sidecar?.targetCount > 0);
    }
  }
}

assert.equal(glbCount, 6);
assert.equal(pngCount, 9);
assert.equal(sidecarCount, 2);

const serialized = JSON.stringify(manifest);
assert.doesNotMatch(serialized, /R:\\|C:\\|\.(?:nds|srl|nsbmd|nsbca|nsbta|nsbma|nsbva)\b/i);
assert.doesNotMatch(JSON.stringify(receipt), /R:\\|C:\\/i);
assert.equal(receipt.systems.flatMap((system) => system.sources).length, 12);
console.log("Licensed VFX conversion v1 validation passed: 5 systems, 6 GLBs, 9 PNGs, 2 animation sidecars.");
