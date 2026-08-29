import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const root = "docs/art/production/technical-qa/cage-hunt-exact-baseline";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("Cage technical QA covers all 40 exact 4x fields and raw-grid alignment", () => {
  assert.equal(manifest.cage.fieldCount, 40);
  assert.equal(manifest.cage.fields.length, 40);
  assert.equal(manifest.cage.exact4xBlockReplicationCount, 40);
  assert.equal(manifest.cage.collisionAttributeTilemapAlignedCount, 40);
  assert.deepEqual(manifest.cage.objectConflictFields, ["field_cm12_01", "field_cm18_01"]);
  assert.equal(manifest.cage.contactPages.length, 4);
  for (const record of [manifest.cage.master40ArtContact, ...manifest.cage.contactPages, ...manifest.cage.fields.map((field) => field.collisionOverlay)]) {
    const file = `${root}/${record.file}`;
    assert.equal(fs.existsSync(file), true, file);
    assert.equal(digest(file), record.sha256, file);
  }
});

test("Hunt technical QA rejects large diagnostic-red regions in all 30 variants", () => {
  assert.equal(manifest.hunt.fieldCount, 30);
  assert.equal(manifest.hunt.fields.length, 30);
  assert.equal(manifest.hunt.largeDiagnosticRedRegionAbsentCount, 30);
  assert.equal(manifest.hunt.animatedVariantCount, 13);
  assert.equal(manifest.hunt.animationFrameCount, 28);
  assert.equal(manifest.hunt.portraitReviewContactPages.length, 3);
  for (const field of manifest.hunt.fields) {
    assert.equal(field.largeDiagnosticRedRegionAbsent, true, field.fieldId);
    assert.deepEqual(field.hdDimensions, [2048, 2048]);
    assert.deepEqual(field.reviewCrop.dimensions, [390, 844]);
  }
  for (const record of manifest.hunt.portraitReviewContactPages) {
    const file = `${root}/${record.file}`;
    assert.equal(fs.existsSync(file), true, file);
    assert.equal(digest(file), record.sha256, file);
  }
});

test("performance verdict forbids preloading all full Hunt maps", () => {
  assert.equal(manifest.hunt.performance.singleHdFieldDecodedRgbaBytes, 16 * 1024 * 1024);
  assert.equal(manifest.hunt.performance.all30HdFieldsDecodedRgbaBytes, 480 * 1024 * 1024);
  assert.match(manifest.hunt.performance.budgetVerdict, /DO_NOT_PRELOAD_30/);
  assert.equal(manifest.boundaries.visualTransformationPerformed, false);
  assert.equal(manifest.boundaries.rawClassSemanticsInvented, false);
  assert.equal(manifest.boundaries.runtimeEligible, false);
  assert.equal(manifest.boundaries.shippingReady, false);
  assert.ok(manifest.boundaries.knownBlockers.includes("GENUINE_HAND_REDRAWN_HD_MASTER_NOT_YET_PRODUCED"));
});
