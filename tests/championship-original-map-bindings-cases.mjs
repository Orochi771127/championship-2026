import assert from "node:assert/strict";
import test from "node:test";

import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import {
  ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS,
  ORIGINAL_CAGE_STRUCTURAL_VISUALS,
  ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS,
  getOriginalCageVisualBinding
} from "../src/championship/presentation/originalCageVisualBindings.js";
import {
  ORIGINAL_MAP_ANIMATION_TICK_HZ,
  ORIGINAL_MAP_ANIMATION_TIMING_EVIDENCE,
  originalMapAnimationFramesToRuntime,
  originalMapAnimationTicksToMs
} from "../src/championship/presentation/originalMapAnimationTiming.js";

test("all 16 Gate identities carry their ROM-verified day/night Hunt fields", () => {
  const gates = listChampionshipGates();
  assert.equal(gates.length, 16);
  assert.deepEqual(
    gates.map(({ biomeId, originalFields }) => [biomeId, originalFields.dayFieldId, originalFields.nightFieldId]),
    [
      ["Canyon", "field_hm08_01", "field_hm08_02"],
      ["Crag", "field_hm14_01", "field_hm14_02"],
      ["Damp", "field_hm05_01", "field_hm05_02"],
      ["Desert", "field_hm16_01", "field_hm16_02"],
      ["Factory", "field_hm10_01", "field_hm10_01"],
      ["Forest", "field_hm03_01", "field_hm03_02"],
      ["Grass", "field_hm01_01", "field_hm01_02"],
      ["Ice", "field_hm13_01", "field_hm13_02"],
      ["Jungle", "field_hm04_01", "field_hm04_02"],
      ["Mine", "field_hm09_01", "field_hm09_01"],
      ["Oasis", "field_hm17_01", "field_hm17_02"],
      ["Ruins", "field_hm18_01", "field_hm18_02"],
      ["Savanna", "field_hm02_01", "field_hm02_02"],
      ["Seaside", "field_hm06_01", "field_hm06_02"],
      ["Sewer", "field_hm11_01", "field_hm11_01"],
      ["Volcano", "field_hm15_01", "field_hm15_02"]
    ]
  );
  assert.ok(gates.every((gate) => gate.originalFieldMapping === "ROM_VERIFIED"));
});

test("36 CageDefinitions bind exactly like the original 37-entry visual table", () => {
  assert.equal(ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS.length, 36);
  assert.equal(new Set(ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS.map(({ fieldId }) => fieldId)).size, 36);
  assert.equal(getOriginalCageVisualBinding(0).fieldId, "field_cm01_01");
  assert.equal(getOriginalCageVisualBinding(26).fieldId, "field_cm27_01");
  assert.equal(getOriginalCageVisualBinding(27).fieldId, "field_cm30_01");
  assert.equal(getOriginalCageVisualBinding(34).fieldId, "field_cm40_01");
  assert.equal(getOriginalCageVisualBinding(35).fieldId, "field_cm28_01");
  assert.equal(getOriginalCageVisualBinding(36), null);
  assert.deepEqual(ORIGINAL_CAGE_STRUCTURAL_VISUALS.map(({ fieldId }) => fieldId), ["field_cm29_01"]);
  assert.deepEqual(ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS, [
    "field_cm33_01", "field_cm36_01", "field_cm38_01"
  ]);
});

test("BSAR raw durations use the original field-update/video clock", () => {
  assert.equal(ORIGINAL_MAP_ANIMATION_TIMING_EVIDENCE, "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK");
  assert.ok(Math.abs(ORIGINAL_MAP_ANIMATION_TICK_HZ - 59.82609828808083) < 1e-12);
  assert.ok(Math.abs(originalMapAnimationTicksToMs(20) - 334.30226226176285) < 1e-9);
  assert.ok(Math.abs(originalMapAnimationTicksToMs(50) - 835.7556556544072) < 1e-9);
  assert.throws(() => originalMapAnimationTicksToMs(0), /INVALID_ORIGINAL_MAP_ANIMATION_TICKS/);
  assert.deepEqual(
    originalMapAnimationFramesToRuntime([
      { frameIndex: 0, durationRawTicks: 13 },
      { frameIndex: 1, durationRawTicks: 12 }
    ]).map(({ frameIndex, durationRawTicks, durationMs }) => [frameIndex, durationRawTicks, Math.round(durationMs * 1000)]),
    [[0, 13, 217296], [1, 12, 200581]]
  );
});
