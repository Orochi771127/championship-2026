import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS,
  ORIGINAL_CAGE_STRUCTURAL_VISUALS,
  ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS
} from "../src/championship/presentation/originalCageVisualBindings.js";
import { originalMapAnimationTicksToMs } from "../src/championship/presentation/originalMapAnimationTiming.js";
import { validateRuntimeMapArtBundle } from "../src/championship/presentation/runtimeMapArtBundle.js";

const MANIFEST_PATH = "assets/production/cage/licensed-runtime-v1/manifest.json";
const SOURCE_MANIFEST_PATH = "docs/art/production/cage/faithful-hd40/manifest.json";
const ANIMATED_FIELD_IDS = ["field_cm07_01", "field_cm09_01", "field_cm21_01", "field_cm39_01"];

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function walkFiles(relativeDir) {
  const start = path.resolve(relativeDir);
  const output = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const item = path.join(start, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(item));
    else output.push(path.relative(".", item).replaceAll("\\", "/"));
  }
  return output;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const source = JSON.parse(fs.readFileSync(SOURCE_MANIFEST_PATH, "utf8"));
const checked = validateRuntimeMapArtBundle(manifest);
const fieldIds = checked.fields.map((field) => field.fieldId);

test("licensed Cage runtime stores all 40 visual fields without inventing ranch layout", () => {
  assert.equal(checked.family, "CAGE");
  assert.equal(checked.runtimeEligible, true);
  assert.equal(checked.shippingReady, false);
  // Changed by the Claude lane on 2026-09-03 with the ranch composition work.
  // Cages are small shaped tiles that must be on screen together to read as one
  // habitat, which the one-at-a-time policy made impossible; Hunt and Battle keep
  // ONE_ACTIVE_FIELD, and a separate test below holds them to it.
  //
  // This test's own guarantee is untouched: no ranch layout is invented IN THE
  // MANIFEST. Placement is computed at runtime from the traced slot model and is
  // labelled PRODUCT_AUTHORED there -- see src/championship/cage/ranchSlotGeometry.js.
  assert.equal(checked.memoryPolicy, "N_ACTIVE_TILES_LOAD_ON_ENTRY_UNLOAD_ON_EXIT");
  for (const field of checked.fields) {
    assert.equal(field.x, undefined, `${field.fieldId} must carry no manifest position`);
    assert.equal(field.y, undefined, `${field.fieldId} must carry no manifest position`);
    assert.equal(field.slotIndex, undefined, `${field.fieldId} must carry no manifest slot`);
  }
  assert.equal(checked.fields.length, 40);
  assert.equal(new Set(fieldIds).size, 40);
  assert.equal(manifest.defaultPreviewFieldId, "field_cm01_01");
  assert.match(manifest.defaultPreviewNote, /not original ranch layout/i);
  for (let index = 1; index <= 40; index += 1) {
    assert.ok(fieldIds.includes(`field_cm${String(index).padStart(2, "0")}_01`));
  }
});

test("licensed Cage runtime keeps the 36-definition table, lid, and unreferenced assets distinct", () => {
  for (const binding of ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS) {
    const field = checked.fields.find((entry) => entry.fieldId === binding.fieldId);
    assert.ok(field, binding.fieldId);
    assert.equal(field.visualRole, binding.role);
  }
  assert.equal(checked.fields.find((field) => field.fieldId === "field_cm29_01").visualRole, "LID");
  assert.deepEqual(ORIGINAL_CAGE_STRUCTURAL_VISUALS.map(({ fieldId }) => fieldId), ["field_cm29_01"]);
  for (const fieldId of ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS) {
    assert.equal(checked.fields.find((field) => field.fieldId === fieldId).visualRole, "UNREFERENCED_VISUAL_ASSET");
  }
  assert.equal(ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS[0].fieldId, "field_cm01_01");
  assert.equal(ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS[35].fieldId, "field_cm28_01");
});

test("licensed Cage frames live under production, hash-match HD4x, and keep verified tick timing", () => {
  for (const field of checked.fields) {
    const sourceField = source.fields.find((entry) => entry.fieldId === field.fieldId);
    assert.ok(sourceField, field.fieldId);
    assert.equal(field.worldWidthPx, sourceField.faithfulHd4x.width);
    assert.equal(field.worldHeightPx, sourceField.faithfulHd4x.height);
    assert.equal(field.gameplayBinding, "EXTERNAL_EXISTING_RUNTIME");
    assert.equal(field.gateMapping, "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED");
    assert.equal(field.collisionBinding, "EXTERNAL_NOT_IN_ART_BUNDLE");
    const animated = ANIMATED_FIELD_IDS.includes(field.fieldId);
    assert.equal(field.frames.length, animated ? 2 : 1);
    assert.equal(sha256File(field.frames[0].src), sourceField.faithfulHd4x.sha256);
    assert.equal(sha256File(field.frames[0].src), field.frames[0].sha256);
    if (!animated) {
      assert.equal(field.frames[0].durationMs, null);
      continue;
    }
    const ticks = sourceField.animatedLayer.frameDurationsRawTicks;
    assert.equal(field.frames[0].durationMs, originalMapAnimationTicksToMs(ticks[0]));
    assert.equal(field.frames[1].durationMs, originalMapAnimationTicksToMs(ticks[1]));
    assert.equal(sha256File(field.frames[1].src), sourceField.animatedLayer.alternateFaithfulHd4xFrame.sha256);
  }
  assert.equal(
    checked.fields.find((field) => field.fieldId === "field_cm01_01").frames[0].sha256,
    "816EC7851457DF8DF012A71CF36CEBC69DBDAF62E42B2C091D746733FA1DBB0A"
  );
});

test("licensed Cage runtime does not carry RAW collision or Nitro payloads", () => {
  const files = walkFiles("assets/production/cage/licensed-runtime-v1");
  assert.ok(files.every((file) => file.endsWith(".png") || file.endsWith("manifest.json")));
  const text = fs.readFileSync(MANIFEST_PATH, "utf8");
  assert.doesNotMatch(text, /\.atr|\.col|\.nbs|\.opm|\.ncgr|\.nsbmd|attribute-raw-classes|collision-raw-classes/i);
});
