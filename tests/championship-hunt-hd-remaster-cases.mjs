import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const root = "docs/art/production/hunt/hd-remaster-v1";
const sourceRoot = "docs/art/production/hunt/faithful-hd30";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const sourceManifest = JSON.parse(fs.readFileSync(`${sourceRoot}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("first Hunt HD remaster batch covers HM00-HM02 without runtime promotion", () => {
  assert.equal(manifest.batch, "ART_A4_HUNT_HD_REMASTER_V1_HM00_HM02");
  assert.equal(manifest.fieldCount, 5);
  assert.equal(manifest.plannedFieldCount, 30);
  assert.deepEqual(manifest.completedFields, [
    "field_hm00_01",
    "field_hm01_01",
    "field_hm01_02",
    "field_hm02_01",
    "field_hm02_02",
  ]);
  assert.equal(manifest.humanApproved, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
});

test("Hunt worlds remain complete 128x128 maps and portrait is only a draggable viewport", () => {
  assert.match(manifest.cameraPolicy, /FULL_2048_WORLD_IS_PRESERVED/);
  assert.match(manifest.cameraPolicy, /DRAGGABLE_VIEWPORT_NOT_A_CROP/);
  assert.match(manifest.memoryPolicy, /NEVER_PRELOAD_ALL_THIRTY/);
  assert.equal(manifest.qa.allFieldsRemain128x128, true);
  assert.equal(manifest.qa.allFramesAre2048Square, true);
  assert.equal(manifest.qa.worldCroppedToPortrait, false);
  for (const field of manifest.fields) {
    assert.deepEqual(field.topologyCells, [128, 128]);
    assert.deepEqual(field.nativeDimensions, [1024, 1024]);
    assert.deepEqual(field.remasterDimensions, [2048, 2048]);
  }
});

test("source assembly, object placement records and raw gameplay maps are unchanged", () => {
  const sourceById = new Map(sourceManifest.fields.map((field) => [field.fieldId, field]));
  assert.equal(manifest.compositionOrder, "BSAR_ANIMATED_TERRAIN_THEN_VOID_MASKED_CORE_THEN_OPM_NCER_NCBR_OBJECTS");
  for (const field of manifest.fields) {
    const source = sourceById.get(field.fieldId);
    assert.ok(source, field.fieldId);
    assert.equal(field.objectPlacement.coordinatesChanged, false);
    assert.equal(field.objectPlacement.count, source.objectPlacement.count);
    assert.equal(digest(`${sourceRoot}/${field.objectPlacement.sourceFile}`), field.objectPlacement.sourceSha256);
    assert.equal(digest(`${sourceRoot}/${field.attribute.sourceFile}`), field.attribute.sourceSha256);
    assert.equal(digest(`${sourceRoot}/${field.encounter.sourceFile}`), field.encounter.sourceSha256);
    assert.equal(field.attribute.changed, false);
    assert.equal(field.encounter.changed, false);
  }
  assert.equal(manifest.qa.objectPlacementRelayoutPerformed, false);
});

test("all verified Hunt animation frames and raw timing ticks are retained", () => {
  const sourceById = new Map(sourceManifest.fields.map((field) => [field.fieldId, field]));
  for (const field of manifest.fields) {
    const source = sourceById.get(field.fieldId);
    const expected = source.animation.status === "NOT_PRESENT"
      ? [{ frameIndex: 0, durationRawTicks: null }]
      : source.animation.frames.map(({ frameIndex, durationRawTicks }) => ({ frameIndex, durationRawTicks }));
    assert.deepEqual(
      field.frames.map(({ frameIndex, durationRawTicks }) => ({ frameIndex, durationRawTicks })),
      expected,
      field.fieldId,
    );
    assert.equal(field.animationPreserved, source.animation.status !== "NOT_PRESENT");
  }
  assert.equal(manifest.qa.animationFlattenedToStatic, false);
});

test("every HD frame is hash locked and contains no missing-region diagnostic red", () => {
  assert.equal(manifest.qa.allTransparentRgbZero, true);
  assert.equal(manifest.qa.allDiagnosticRedAbsent, true);
  assert.equal(digest(`${root}/${manifest.contactSheet.file}`), manifest.contactSheet.sha256);
  for (const field of manifest.fields) {
    for (const frame of field.frames) {
      const file = `${root}/${frame.file}`;
      assert.equal(fs.existsSync(file), true, file);
      assert.equal(digest(file), frame.sha256, file);
      assert.equal(frame.transparentRgbZero, true);
      assert.equal(frame.diagnosticRedPixelCount, 0);
    }
  }
});

