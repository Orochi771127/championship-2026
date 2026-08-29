import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = "docs/art/technical/a1-map-tech";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("approved A1 map directions are split into bounded technical review assets", () => {
  assert.equal(manifest.cage.moduleCount, 12);
  assert.equal(manifest.cage.modules.length, 12);
  assert.equal(manifest.hunt.standardCount, 2);
  assert.equal(manifest.hunt.standards.length, 2);
  assert.equal(new Set(manifest.cage.modules.map((entry) => entry.assetId)).size, 12);
});

test("technical review outputs are deterministic and source-hash locked", () => {
  for (const board of manifest.sourceBoards) {
    const resolved = path.resolve(root, board.file);
    assert.equal(digest(resolved), board.sha256);
  }
  for (const entry of [...manifest.cage.modules, ...manifest.hunt.standards]) {
    assert.equal(fs.existsSync(`${root}/${entry.file}`), true);
    assert.equal(digest(`${root}/${entry.file}`), entry.sha256);
  }
  for (const entry of manifest.cage.modules) {
    assert.equal(digest(`${root}/${entry.transparentFile}`), entry.transparentSha256);
    assert.equal(digest(`${root}/${entry.visualSilhouetteFile}`), entry.visualSilhouetteSha256);
  }
});

test("map technicalization does not invent Cage gameplay or promote flattened boards", () => {
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
  assert.match(manifest.rights.promotionState, /LINKED_LICENSE/);
  for (const entry of manifest.cage.modules) {
    assert.equal(entry.gameplayFootprint, "UNKNOWN_REQUIRES_VERIFIED_SHAPE_MASK");
    assert.equal(entry.raisingEffects, "UNKNOWN_REQUIRES_TRACE");
    assert.equal(entry.runtimeEligible, false);
    assert.equal(entry.sourceState, "TRANSPARENT_FLATTENED_APPROVED_DIRECTION_MASTER");
    assert.equal(entry.alphaMetrics.outputEdgeOpaquePixels, 0);
    assert.ok(entry.alphaMetrics.transparentPixels > 0);
    assert.ok(entry.alphaMetrics.partialAlphaPixels > 0);
    assert.match(entry.visualSilhouetteFile, /visual-silhouette/);
  }
  for (const entry of manifest.hunt.standards) assert.equal(entry.runtimeEligible, false);
});

test("original-structure contracts cover Cage assembly and Hunt field composition", () => {
  assert.deepEqual(manifest.cage.requiredNativeLayers, ["CORE_FIELD_TILES", "OBJECT_BUNDLE"]);
  assert.deepEqual(manifest.cage.requiredExternalData, ["ATR_RAW_CLASSES", "COL_RAW_CLASSES"]);
  assert.equal(manifest.hunt.requiredNativeLayers.length, 8);
  assert.match(manifest.hunt.bindingRule, /EXTERNAL_GAMEPLAY_AUTHORITY/);
  assert.match(manifest.cage.bindingRule, /VERIFIED_EXTERNAL_SHAPE_MASK/);
  assert.match(manifest.cage.maskWarning, /MUST_NOT_BE_USED_AS_GAMEPLAY_SHAPE_MASKS/);
});

test("all forty original CM structures are classified without copying original pixels", () => {
  const csv = fs.readFileSync("docs/art/technical/a1-cage-original-structure/CM40_ORIGINAL_STRUCTURE_CROSSWALK.csv", "utf8").trim().split(/\r?\n/);
  assert.equal(csv.length, 41);
  const rows = csv.slice(1);
  assert.equal(new Set(rows.map((row) => row.match(/^"(\d+)"/)?.[1])).size, 40);
  assert.equal(new Set(rows.map((row) => row.match(/"(field_cm\d{2}_01)"/)?.[1])).size, 40);
  assert.equal(rows.filter((row) => row.includes('"CM01_CM10"')).length, 10);
  assert.equal(rows.filter((row) => row.includes('"CM11_CM20"')).length, 10);
  assert.equal(rows.filter((row) => row.includes('"CM21_CM30"')).length, 10);
  assert.equal(rows.filter((row) => row.includes('"CM31_CM40"')).length, 10);
  assert.equal(rows.filter((row) => row.includes('"ORIGINAL_OBJECT_INDEX_CONFLICT_DO_NOT_INFER"')).length, 2);
  assert.equal(rows.filter((row) => row.includes('"NO_NATIVE_OBJECT_LAYER"')).length, 2);
  for (const row of rows) {
    assert.match(row, /"REFERENCE_METADATA_ONLY_NO_ORIGINAL_PIXELS"/);
    assert.match(row, /"NOT_RUNTIME_READY"$/);
  }
});

test("CM01-CM10 clean-room review packets preserve original construction boundaries", () => {
  const packRoot = "docs/art/production/cage/cm01-cm10/packages";
  const cageManifest = JSON.parse(fs.readFileSync(`${packRoot}/manifest.json`, "utf8"));
  assert.equal(cageManifest.fieldCount, 10);
  assert.equal(cageManifest.fields.length, 10);
  assert.equal(new Set(cageManifest.fields.map((field) => field.fieldId)).size, 10);
  assert.deepEqual(cageManifest.construction, ["CORE_FIELD_TILES", "OBJECT_BUNDLE", "EXTERNAL_ATR", "EXTERNAL_COL"]);
  assert.match(cageManifest.referencePolicy, /NO_ROM_IMAGE_INPUT_NO_ORIGINAL_PIXELS/);
  assert.equal(cageManifest.humanApproved, false);
  assert.equal(cageManifest.runtimeEligible, false);
  assert.equal(cageManifest.shippingReady, false);
  for (const field of cageManifest.fields) {
    assert.match(field.fieldId, /^field_cm(0[1-9]|10)_01$/);
    assert.equal(field.originalStructure.atr, "EXTERNAL_RAW_CLASSES_NOT_INFERRED");
    assert.equal(field.originalStructure.col, "EXTERNAL_RAW_CLASSES_NOT_INFERRED");
    assert.equal(field.runtimeEligible, false);
    for (const layer of [field.coreField, field.objectBundle]) {
      const file = `${packRoot}/${layer.file}`;
      assert.equal(fs.existsSync(file), true);
      assert.equal(digest(file), layer.sha256);
      const png = fs.readFileSync(file);
      assert.equal(png[25], 6, `${layer.file} must be RGBA PNG`);
      assert.equal(layer.anchor.policy, "BOTTOM_CENTER");
    }
  }
});
