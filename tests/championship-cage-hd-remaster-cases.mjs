import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const root = "docs/art/production/cage/hd-remaster-v1";
const sourceRoot = "docs/art/production/cage/faithful-hd40";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const sourceManifest = JSON.parse(fs.readFileSync(`${sourceRoot}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("first two Cage HD remaster batches cover CM01-CM20 without runtime promotion", () => {
  assert.equal(manifest.batch, "ART_A3_CAGE_HD_REMASTER_V1_CM11_CM20");
  assert.deepEqual(manifest.completedBatches.map((batch) => batch.batch), [
    "ART_A3_CAGE_HD_REMASTER_V1_CM01_CM10",
    "ART_A3_CAGE_HD_REMASTER_V1_CM11_CM20",
  ]);
  assert.equal(manifest.fieldCount, 20);
  assert.equal(manifest.plannedFieldCount, 40);
  assert.deepEqual(manifest.completedFields, Array.from({ length: 20 }, (_, index) => `field_cm${String(index + 1).padStart(2, "0")}_01`));
  assert.deepEqual(manifest.nextFields, Array.from({ length: 10 }, (_, index) => `field_cm${String(index + 21).padStart(2, "0")}_01`));
  assert.equal(manifest.scale, 4);
  assert.equal(manifest.profile, "COMPONENT_FAITHFUL_EDGE_AWARE_BICUBIC_PMA_4X_V1");
  assert.match(manifest.visualPolicy, /ORIGINAL_COMPOSITION.*PRESERVED/);
  assert.equal(manifest.humanApproved, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
});

test("HD components retain source dimensions, placements, flips and object bindings", () => {
  const sourceById = new Map(sourceManifest.fields.map((field) => [field.fieldId, field]));
  for (const field of manifest.fields) {
    const source = sourceById.get(field.fieldId);
    assert.ok(source, field.fieldId);
    assert.deepEqual(field.core.dimensions, field.core.sourceDimensions.map((value) => value * manifest.scale));
    assert.deepEqual(field.frameZero.dimensions, [source.nativeOriginal.width * manifest.scale, source.nativeOriginal.height * manifest.scale]);
    assert.equal(field.grid.aligned, true);
    assert.equal(field.grid.remasterCellPixels, 32);
    assert.equal(field.core.transparentRgbZero, true);
    assert.equal(field.core.alphaBoundsPreservedAt4x, true);
    assert.equal(field.objectPlacements.length, source.objectPlacement.count);

    const sourcePlacement = JSON.parse(fs.readFileSync(`${sourceRoot}/${source.objectPlacement.file}`, "utf8"));
    assert.equal(field.objectPlacements.length, sourcePlacement.placements.length);
    for (let index = 0; index < field.objectPlacements.length; index += 1) {
      const output = field.objectPlacements[index];
      const input = sourcePlacement.placements[index];
      assert.equal(output.sequenceId, input.sequenceId);
      assert.equal(output.firstFrameCellId, input.resolvedFirstFrameCellId);
      assert.deepEqual(output.sourceCoordinate, [input.sourceX, input.sourceY]);
      assert.deepEqual(output.remasterCoordinate, [input.sourceX * manifest.scale, input.sourceY * manifest.scale]);
      assert.equal(output.horizontalFlip, input.horizontalFlip);
      assert.equal(output.verticalFlip, input.verticalFlip);
    }

    if (source.objectCellBank.status === "NOT_PRESENT") {
      assert.equal(field.objectCells.length, 0);
    } else {
      const sourceBank = JSON.parse(fs.readFileSync(`${sourceRoot}/${source.objectCellBank.file}`, "utf8"));
      assert.equal(field.objectCells.length, sourceBank.renderedCells.length);
    }
  }
  assert.equal(manifest.qa.allFieldsGridAligned, true);
  assert.equal(manifest.qa.allCoreTransparentRgbZero, true);
  assert.equal(manifest.qa.allObjectCellsTransparentRgbZero, true);
  assert.equal(manifest.qa.placementRelayoutPerformed, false);
  assert.equal(manifest.qa.newObjectsInvented, false);
  assert.equal(manifest.qa.recolorDirectionApplied, false);
});

test("CM07 and CM09 preserve their verified animated-terrain frame records", () => {
  const animated = manifest.fields.filter((field) => field.animatedFrames.length > 0);
  assert.deepEqual(animated.map((field) => field.fieldId), ["field_cm07_01", "field_cm09_01"]);
  for (const field of animated) {
    assert.equal(field.animatedFrames.length, 2);
    for (const frame of field.animatedFrames) {
      assert.equal(frame.layer.transparentRgbZero, true);
      assert.equal(frame.layer.alphaBoundsPreservedAt4x, true);
      assert.ok(Number.isInteger(frame.rawDurationTicks));
    }
  }
});

test("CM12 and CM18 retain the resolved OPMD to NANR to NCER bindings", () => {
  const byId = new Map(manifest.fields.map((field) => [field.fieldId, field]));
  const cm12 = byId.get("field_cm12_01");
  const cm18 = byId.get("field_cm18_01");
  assert.ok(cm12);
  assert.ok(cm18);
  assert.deepEqual(cm12.objectPlacements.map((item) => item.firstFrameCellId), [0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(cm18.objectPlacements.map((item) => item.firstFrameCellId), [2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 4, 5, 6, 7]);
  assert.equal(cm12.objectPlacements.length, 7);
  assert.equal(cm18.objectPlacements.length, 16);
});

test("all Cage HD remaster outputs are present and hash locked", () => {
  const records = [manifest.contactSheet];
  for (const field of manifest.fields) {
    records.push(field.core, field.staticComposite, field.frameZero, ...field.objectCells);
    for (const frame of field.animatedFrames) {
      records.push(frame.layer, { file: frame.compositeFile, sha256: frame.compositeSha256 });
    }
  }
  for (const record of records) {
    const file = `${root}/${record.file}`;
    assert.equal(fs.existsSync(file), true, file);
    assert.equal(digest(file), record.sha256, file);
  }
});
