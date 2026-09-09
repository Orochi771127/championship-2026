import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const batch = path.join(root, "docs/art/production/battle/human-paint-static-r5");
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

test("R5 is a seven-field internal review batch, not a runtime replacement", () => {
  assert.equal(manifest.status, "STATIC_STYLE_MIGRATION_INTERNAL_REVIEW");
  assert.equal(manifest.styleDirectionHumanApproved, true);
  assert.equal(manifest.assetHumanApproved, false);
  assert.equal(manifest.runtimeMutation, false);
  assert.equal(manifest.replacementPerformed, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
  assert.equal(receipt.generatedBackgroundCount, 7);
  assert.deepEqual(manifest.assets.map((asset) => asset.fieldId), [
    "field_bm01_01", "field_bm02_01", "field_bm05_01", "field_bm08_01",
    "field_bm09_01", "field_bm10_01", "field_bm11_01"
  ]);
});

test("all generated backgrounds and review composites are exact opaque 1536x1024 PNGs", () => {
  for (const asset of receipt.assets) {
    const background = path.join(root, asset.background.file);
    assert.deepEqual(pngHeader(background), { width: 1536, height: 1024, colorType: 2 });
    assert.equal(sha256(background), asset.background.sha256);
    for (const composite of asset.composites) {
      const file = path.join(root, composite.file);
      assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 2 });
      assert.equal(sha256(file), composite.sha256);
    }
  }
});

test("every shared-ring field depends on the exact R4 canonical BM00 layer", () => {
  const shared = path.join(root, receipt.sharedLayer.file);
  assert.deepEqual(pngHeader(shared), { width: 1536, height: 1024, colorType: 6 });
  assert.equal(sha256(shared), receipt.sharedLayer.sha256);
  for (const asset of receipt.assets) {
    assert.deepEqual(asset.dependencies, ["art:battle:human-paint-r4:field-bm00-00-shared-layer"]);
    assert.equal(asset.sharedLayer, receipt.sharedLayer.file);
    assert.equal(asset.geometryAuthority, "R4_CANONICAL_BM00_AND_VERIFIED_EXISTING_OBJECT_LAYERS_NOT_IMAGE_MODEL");
  }
});

test("BM08 and BM11 keep verified object-layer responsibilities separate", () => {
  const byField = new Map(receipt.assets.map((asset) => [asset.fieldId, asset]));
  const bm08 = byField.get("field_bm08_01");
  const bm11 = byField.get("field_bm11_01");
  assert.equal(bm08.objectLayerSeparation, "VERIFIED_EXISTING_LAYER_RETAINED");
  assert.equal(bm08.objectLayers.length, 1);
  assert.match(bm08.objectLayers[0].file, /field-bm08-01-objects\.png$/);
  assert.equal(bm08.frameCount, 1);
  assert.equal(bm11.objectLayerSeparation, "VERIFIED_EXISTING_LAYER_RETAINED");
  assert.equal(bm11.objectLayers.length, 2);
  assert.deepEqual(bm11.frameDurationsRawTicks, [6, 6]);
  assert.deepEqual(bm11.composites.map((frame) => frame.durationRawTicks), [6, 6]);
  assert.equal(bm11.frameCount, 2);
  for (const asset of [bm08, bm11]) {
    for (const object of asset.objectLayers) {
      assert.equal(sha256(path.join(root, object.file)), object.sha256);
    }
  }
});

test("all exact 9:16 reviews reserve a 360x240 field band without black filler", () => {
  assert.equal(receipt.layoutPreviews.length, 7);
  for (const item of receipt.layoutPreviews) {
    const file = path.join(root, item.file);
    assert.deepEqual(item.size, [360, 640]);
    assert.deepEqual(item.fieldBand, { x: 0, y: 96, width: 360, height: 240 });
    assert.deepEqual(pngHeader(file), { width: 360, height: 640, colorType: 2 });
    assert.equal(sha256(file), item.sha256);
  }
  const contact = path.join(root, receipt.contactSheet.file);
  assert.deepEqual(pngHeader(contact), { width: 2304, height: 1536, colorType: 2 });
  assert.equal(sha256(contact), receipt.contactSheet.sha256);
});

test("R5 remains absent from runtime, gallery, review page, and production index", () => {
  const needles = ["human-paint-static-r5", "art:battle:human-paint-r5"];
  const files = [
    "assets/production/ART_PRODUCTION_INDEX.json",
    "championship.html",
    "battle-art-gallery.html",
    "battle-art-review.html"
  ];
  for (const relative of files) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    for (const needle of needles) assert.equal(text.includes(needle), false, `${relative} contains ${needle}`);
  }
  const srcFiles = fs.readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
  for (const file of srcFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of needles) assert.equal(text.includes(needle), false, `${file} contains ${needle}`);
  }
});
