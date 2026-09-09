import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateRuntimeBattleArenaArtReview } from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const root = process.cwd();
const batchRoot = path.join(root, "docs/art/production/battle/bm05-bm11-static-r1");
const runtimeRoot = path.join(root, "assets/production/internal-battle-review/bm05-bm11-static-r1");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const manifest = readJson("docs/art/production/battle/bm05-bm11-static-r1/manifest.json");
const receipt = readJson("docs/art/production/battle/bm05-bm11-static-r1/receipt.json");
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("static family contains exactly six BM00-dependent arenas", () => {
  assert.deepEqual(manifest.assets.map((asset) => asset.fieldId), [
    "field_bm05_01", "field_bm06_01", "field_bm08_01", "field_bm09_01", "field_bm10_01", "field_bm11_01"
  ]);
  const byLogicalGroup = new Map(crosswalk.records.map((record) => [record.referenceLogicalGroup, record]));
  for (const asset of manifest.assets) {
    const record = byLogicalGroup.get(asset.fieldId);
    assert.equal(record.productionAssetId, asset.id);
    assert.deepEqual(record.productionDependencies, ["production:battle:shared:field-bm00-00"]);
    assert.deepEqual(asset.dependencies, record.productionDependencies);
  }
});

test("BM03 and BM04 remain animation-blocked while BM07 stays independent", () => {
  assert.deepEqual(manifest.excluded, [
    { fieldId: "field_bm03_01", reason: "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE" },
    { fieldId: "field_bm04_01", reason: "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE" },
    { fieldId: "field_bm07_01", reason: "INDEPENDENT_NO_BM00_DEPENDENCY_REQUIRES_SEPARATE_ARCHITECTURE_BATCH" }
  ]);
  const byLogicalGroup = new Map(crosswalk.records.map((record) => [record.referenceLogicalGroup, record]));
  assert.deepEqual(byLogicalGroup.get("field_bm07_01").productionDependencies, []);
});

test("family references one canonical BM00 payload and duplicates none", () => {
  const shared = path.join(root, receipt.canonicalSharedLayer.file);
  assert.equal(sha256(shared), receipt.canonicalSharedLayer.sha256);
  assert.equal(receipt.canonicalSharedLayer.copiedIntoFamilyBundle, false);
  const runtimePngs = fs.readdirSync(runtimeRoot).filter((name) => name.endsWith(".png")).sort();
  assert.deepEqual(runtimePngs, manifest.assets.map((asset) => `${asset.fieldId.replaceAll("_", "-")}-background.png`).sort());
  assert.equal(runtimePngs.some((name) => name.includes("bm00")), false);
});

test("all arena files, manifests and viewport receipts are deterministic", () => {
  assert.equal(receipt.arenas.length, 6);
  const contactSheet = path.join(batchRoot, receipt.contactSheet.file);
  assert.deepEqual(pngHeader(contactSheet), { width: 2304, height: 1024, colorType: 2 });
  assert.equal(sha256(contactSheet), receipt.contactSheet.sha256);
  assert.deepEqual(receipt.contactSheet.order, manifest.assets.map((asset) => asset.fieldId));
  for (const arena of receipt.arenas) {
    const background = path.join(batchRoot, arena.file);
    assert.deepEqual(pngHeader(background), { width: 1536, height: 1024, colorType: 2 });
    assert.equal(sha256(background), arena.sha256);
    const runtime = readJson(arena.runtimeManifest);
    const checked = validateRuntimeBattleArenaArtReview(runtime);
    assert.equal(checked.arena.fieldId, arena.fieldId);
    assert.equal(checked.arena.layers[1].src, receipt.canonicalSharedLayer.file);
    assert.equal(checked.arena.layers[1].sha256, receipt.canonicalSharedLayer.sha256);
    assert.equal(checked.humanApproved, false);
    assert.equal(checked.runtimeEligible, false);
    assert.equal(checked.shippingReady, false);
    assert.equal(arena.viewportChecks.length, 5);
    for (const viewport of arena.viewportChecks) {
      const file = path.join(batchRoot, viewport.file);
      assert.equal(sha256(file), viewport.sha256);
      assert.deepEqual([pngHeader(file).width, pngHeader(file).height], viewport.viewport);
    }
  }
});

test("known BM08 and BM11 object structure stays a promotion blocker", () => {
  const objectFields = receipt.arenas.filter((arena) => arena.referenceObjectLayerPresent).map((arena) => arena.fieldId);
  assert.deepEqual(objectFields, ["field_bm08_01", "field_bm11_01"]);
  assert.ok(receipt.arenas.every((arena) => arena.flattenedInternalReviewOnly));
  assert.ok(receipt.arenas.filter((arena) => objectFields.includes(arena.fieldId)).every((arena) => arena.productionObjectSeparationRequired));
  assert.equal(receipt.promotion.runtimeQaPassed, true);
  assert.equal(manifest.reviewPolicy.runtimeQaPassed, true);
  assert.equal(manifest.reviewPolicy.humanApproved, false);
});
