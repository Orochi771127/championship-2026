import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const batch = path.join(root, "docs/art/production/battle/human-paint-migration-r4");
const manifest = JSON.parse(fs.readFileSync(path.join(batch, "manifest.json"), "utf8"));
const receipt = JSON.parse(fs.readFileSync(path.join(batch, "receipt.json"), "utf8"));

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("R4 records style approval without silently approving migrated assets", () => {
  assert.equal(manifest.status, "BOUNDED_STYLE_MIGRATION_INTERNAL_REVIEW");
  assert.equal(manifest.styleDirectionHumanApproved, true);
  assert.equal(manifest.assetHumanApproved, false);
  assert.equal(manifest.runtimeMutation, false);
  assert.equal(manifest.replacementPerformed, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
  assert.equal(manifest.rightsStatus, "ORIGINAL_CREATED_AI_ASSISTED_TERMS_LINK_PENDING");
});

test("BM00 uses the canonical alpha geometry rather than model-drawn transparency", () => {
  const record = receipt.sharedLayer;
  const file = path.join(root, record.file);
  assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 6 });
  assert.equal(sha256(file), record.sha256);
  assert.equal(record.alphaMaskSha256, record.canonicalAlphaMaskSha256);
  assert.equal(record.geometryAuthority, "CANONICAL_BM00_ALPHA_MASK_NOT_IMAGE_MODEL");
});

test("BM07 restores all six zones from fixed builder coordinates", () => {
  assert.deepEqual(receipt.bm07.standingZoneContract.centers, [
    [440, 400], [768, 400], [1096, 400], [440, 632], [768, 632], [1096, 632]
  ]);
  assert.equal(receipt.bm07.standingZoneContract.radius, 96);
  assert.equal(receipt.bm07.standingZoneContract.source, "DETERMINISTIC_BUILDER_NOT_IMAGE_MODEL");
  assert.deepEqual(receipt.bm07.dependencies, []);
  const file = path.join(root, receipt.bm07.file);
  assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(sha256(file), receipt.bm07.sha256);
});

test("BM03 and BM04 preserve verified two-frame timing and composition boundaries", () => {
  const byField = new Map(receipt.animatedFields.map((item) => [item.fieldId, item]));
  assert.deepEqual(byField.get("field_bm03_01").frames.map((item) => item.durationRawTicks), [50, 50]);
  assert.deepEqual(byField.get("field_bm04_01").frames.map((item) => item.durationRawTicks), [20, 20]);
  assert.equal(byField.get("field_bm03_01").objectLayer, null);
  assert.match(byField.get("field_bm04_01").objectLayer, /field-bm04-01-objects\.png$/);
  for (const field of byField.values()) {
    assert.equal(field.frameCount, 2);
    assert.ok(field.maskCoverage > 0.04 && field.maskCoverage < 0.55);
    for (const item of [...field.frames, ...field.composites]) {
      const file = path.join(root, item.file);
      assert.deepEqual([pngHeader(file).width, pngHeader(file).height], [1536, 1024]);
      assert.equal(sha256(file), item.sha256);
    }
  }
});

test("portrait reviews place the full 3:2 field into the exact 9:16 field band", () => {
  assert.equal(receipt.layoutPreviews.length, 3);
  for (const item of receipt.layoutPreviews) {
    const file = path.join(root, item.file);
    assert.deepEqual(item.size, [360, 640]);
    assert.deepEqual(pngHeader(file), { width: 360, height: 640, colorType: 2 });
    assert.equal(sha256(file), item.sha256);
  }
});

test("the rejected BM07 candidate remains quarantined and documented", () => {
  assert.equal(receipt.rejectionReason, "MODEL_DRAWN_STANDING_ZONES_CANNOT_OWN_GAMEPLAY_GEOMETRY");
  assert.ok(fs.statSync(path.join(batch, receipt.rejectedCandidate)).isFile());
  const contact = path.join(root, receipt.contactSheet.file);
  assert.deepEqual(pngHeader(contact), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(sha256(contact), receipt.contactSheet.sha256);
});
