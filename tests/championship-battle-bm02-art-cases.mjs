import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateRuntimeBattleArenaArtReview } from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const root = process.cwd();
const workspace = path.join(root, "docs/art/production/battle/bm02-r1");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const manifest = readJson("docs/art/production/battle/bm02-r1/manifest.json");
const receipt = readJson("docs/art/production/battle/bm02-r1/receipt.json");
const runtime = readJson("assets/production/internal-battle-review/bm02-r1/runtime.review.json");
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

test("BM02 is one arena background depending on the canonical BM00 layer", () => {
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].id, "production:battle:arena:field-bm02-01");
  assert.deepEqual(manifest.assets[0].dependencies, ["production:battle:shared:field-bm00-00"]);
  const record = crosswalk.records.find((entry) => entry.referenceLogicalGroup === "field_bm02_01");
  assert.equal(record.productionAssetId, manifest.assets[0].id);
  assert.deepEqual(record.productionDependencies, manifest.assets[0].dependencies);
});

test("BM02 output is opaque 1536x1024 and hashes match its receipt", () => {
  const arena = path.join(workspace, receipt.arena.file);
  const composite = path.join(workspace, receipt.compositeReview.file);
  assert.deepEqual(pngHeader(arena), { width: 1536, height: 1024, colorType: 2 });
  assert.deepEqual(pngHeader(composite), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(sha256(arena), receipt.arena.sha256);
  assert.equal(sha256(composite), receipt.compositeReview.sha256);
});

test("BM02 references BM00 in place and does not duplicate its PNG", () => {
  const shared = path.join(root, receipt.canonicalSharedLayer.file);
  assert.equal(sha256(shared), receipt.canonicalSharedLayer.sha256);
  assert.equal(receipt.canonicalSharedLayer.copiedIntoBm02Bundle, false);
  assert.equal(runtime.arena.layers[1].src, receipt.canonicalSharedLayer.file);
  assert.equal(runtime.arena.layers[1].sha256, receipt.canonicalSharedLayer.sha256);
  const runtimePngs = fs.readdirSync(path.join(root, "assets/production/internal-battle-review/bm02-r1"))
    .filter((name) => name.endsWith(".png"));
  assert.deepEqual(runtimePngs, ["field-bm02-01-background.png"]);
});

test("BM02 runtime manifest remains isolated and unpromoted", () => {
  const checked = validateRuntimeBattleArenaArtReview(runtime);
  assert.equal(checked.arena.fieldId, "field_bm02_01");
  assert.equal(checked.humanApproved, false);
  assert.equal(checked.runtimeEligible, false);
  assert.equal(checked.shippingReady, false);
  assert.equal(receipt.promotion.runtimeQaPassed, true);
  assert.deepEqual(receipt.viewportChecks.map((entry) => entry.viewport), [
    [360, 800], [390, 844], [393, 852], [412, 915], [430, 932]
  ]);
  for (const entry of receipt.viewportChecks) {
    const file = path.join(workspace, entry.file);
    assert.equal(sha256(file), entry.sha256);
    assert.deepEqual([pngHeader(file).width, pngHeader(file).height], entry.viewport);
  }
});
