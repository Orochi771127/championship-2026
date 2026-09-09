import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateRuntimeBattleArenaArtReview } from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const root = process.cwd();
const batchRoot = path.join(root, "docs/art/production/battle/bm07-cyberspace-r1");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const manifest = readJson("docs/art/production/battle/bm07-cyberspace-r1/manifest.json");
const receipt = readJson("docs/art/production/battle/bm07-cyberspace-r1/receipt.json");
const runtime = readJson("assets/production/internal-battle-review/bm07-cyberspace-r1/runtime.review.json");
const catalog = readJson("src/data/championship/catalogs/battle-arenas.r1.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("BM07 catalog evidence requires an independent static single layer", () => {
  const record = catalog.records.find((item) => item.identifier === "BATTLE_CYBERSPACE");
  assert.equal(record.string04, "field_bm07_01");
  assert.equal(record.string08, "");
  assert.equal(record.string0C, "");
  assert.equal(record.string10, "");
  assert.deepEqual(manifest.referenceEvidence.catalogDependencies, []);
  assert.equal(manifest.referenceEvidence.animation, "NOT_PRESENT");
  assert.equal(manifest.referenceEvidence.productionReuse, "STRUCTURAL_FUNCTION_ONLY_NO_ROM_ASSET_REUSE");
});

test("BM07 runtime manifest has no invented BM00 dependency or extra layer", () => {
  const checked = validateRuntimeBattleArenaArtReview(runtime);
  assert.equal(checked.arena.fieldId, "field_bm07_01");
  assert.deepEqual(checked.arena.dependencies, []);
  assert.equal(checked.arena.layers.length, 1);
  assert.equal(checked.arena.layers[0].role, "ARENA_BACKGROUND");
  assert.equal(checked.arena.layers[0].alpha, false);
  assert.equal(checked.arena.layers[0].src.includes("bm00"), false);
  assert.equal(checked.humanApproved, false);
  assert.equal(checked.runtimeEligible, false);
  assert.equal(checked.shippingReady, false);
});

test("BM07 standing-zone contract is exactly aligned and deterministic", () => {
  assert.deepEqual(receipt.ringContract.columns, [440, 768, 1096]);
  assert.deepEqual(receipt.ringContract.rows, [400, 632]);
  assert.deepEqual(receipt.ringContract.centers, [
    [440, 400], [768, 400], [1096, 400], [440, 632], [768, 632], [1096, 632]
  ]);
  assert.equal(receipt.ringContract.count, 6);
  assert.equal(receipt.ringContract.radius, 96);
  assert.equal(receipt.ringContract.source, "DETERMINISTIC_BUILDER_NOT_IMAGE_MODEL");
  assert.deepEqual(runtime.arena.standingZoneContract.centers, receipt.ringContract.centers);
});

test("BM07 source, review, runtime, and viewport artifacts match receipts", () => {
  for (const item of [receipt.source, receipt.output]) {
    const file = path.join(batchRoot, item.file);
    assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 2 });
    assert.equal(sha256(file), item.sha256);
  }
  const runtimeFile = path.join(root, receipt.runtime.file);
  assert.deepEqual(pngHeader(runtimeFile), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(sha256(runtimeFile), receipt.runtime.sha256);
  assert.notEqual(receipt.source.sha256, receipt.output.sha256);
  assert.equal(receipt.viewportChecks.length, 5);
  for (const viewport of receipt.viewportChecks) {
    const file = path.join(batchRoot, viewport.file);
    assert.equal(sha256(file), viewport.sha256);
    assert.deepEqual([pngHeader(file).width, pngHeader(file).height], viewport.viewport);
  }
});

test("BM07 browser QA stays internal and promotion remains closed", () => {
  assert.equal(receipt.promotion.runtimeQaPassed, true);
  assert.equal(receipt.promotion.humanApproved, false);
  assert.equal(receipt.promotion.readyForRuntime, false);
  assert.equal(receipt.promotion.shippingReady, false);
});
