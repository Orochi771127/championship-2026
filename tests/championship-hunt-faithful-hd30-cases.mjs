import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const root = "docs/art/production/hunt/faithful-hd30";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("Hunt exact-original HD baseline covers all 30 source variants", () => {
  assert.equal(manifest.fieldCount, 30);
  assert.equal(manifest.fields.length, 30);
  assert.equal(new Set(manifest.fields.map((field) => field.fieldId)).size, 30);
  assert.equal(manifest.representativeArchivePixelExactCount, 16);
  assert.equal(manifest.animatedVariantCount, 13);
  assert.equal(manifest.animationFrameCount, 28);
  assert.equal(manifest.compositionOrder, "BSAR_ANIMATED_TERRAIN_THEN_VOID_MASKED_CORE_THEN_OPM_NCER_NCBR_OBJECTS");
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
});

test("Hunt fields preserve 128x128 data and deterministic 2048px HD frame zero", () => {
  for (const field of manifest.fields) {
    assert.deepEqual(field.nativeDimensions, [1024, 1024]);
    assert.deepEqual(field.faithfulHd2x.dimensions, [2048, 2048]);
    assert.equal(field.faithfulHd2x.scale, 2);
    assert.equal(field.faithfulHd2x.filter, "NEAREST");
    if (field.selectedArchiveRepresentative) assert.equal(field.archiveStaticDiagnosticPixelDiffCount, 0);
    for (const record of [field.faithfulHd2x, field.core, field.staticDiagnostic, field.objectPlacement,
      field.objectCellBank, field.attribute, field.encounter]) {
      const file = `${root}/${record.file}`;
      assert.equal(fs.existsSync(file), true, file);
      assert.equal(digest(file), record.sha256, file);
    }
    const tilemap = JSON.parse(fs.readFileSync(`${root}/fields/${field.fieldId}/core-tilemap.json`, "utf8"));
    const atr = JSON.parse(fs.readFileSync(`${root}/${field.attribute.file}`, "utf8"));
    const esc = JSON.parse(fs.readFileSync(`${root}/${field.encounter.file}`, "utf8"));
    assert.deepEqual([tilemap.width, tilemap.height, tilemap.cells.length], [128, 128, 16384]);
    assert.deepEqual([atr.width, atr.height, atr.cells.length], [128, 128, 16384]);
    assert.deepEqual([esc.width, esc.height, esc.cells.length], [128, 128, 16384]);
  }
});

test("all 13 native BSAR bundles export complete layer and composite frames", () => {
  const animated = manifest.fields.filter((field) => field.animation.status !== "NOT_PRESENT");
  assert.equal(animated.length, 13);
  for (const field of animated) {
    assert.equal(field.animation.status, "PRESENT_EXACT_LAYER_COMPOSITED");
    assert.equal(field.animation.frames.length, field.animation.frameCount);
    for (const frame of field.animation.frames) {
      for (const [fileKey, hashKey] of [["layerFile", "layerSha256"], ["compositeFile", "compositeSha256"]]) {
        const file = `${root}/${frame[fileKey]}`;
        assert.equal(fs.existsSync(file), true, file);
        assert.equal(digest(file), frame[hashKey], file);
      }
    }
  }
});

test("animated terrain stays below void-masked core land and objects", () => {
  const source = fs.readFileSync("scripts/build-hunt-faithful-hd30.py", "utf8");
  const terrainBed = source.indexOf("frame_base = layer.copy()");
  const maskedCore = source.indexOf("frame_base.alpha_composite(core_with_void_transparent)");
  const objects = source.indexOf("frame, frame_invalid = composite_object_placements", maskedCore);
  assert.notEqual(terrainBed, -1);
  assert.ok(terrainBed < maskedCore && maskedCore < objects);
  assert.equal(source.includes("frame_base = core.copy()\n                frame_base.alpha_composite(layer)"), false);
});
