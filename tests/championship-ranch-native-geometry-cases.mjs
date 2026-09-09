import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BOARD_ARRANGEMENT_EVIDENCE, ORIGINAL_CAGE_SHAPE_MASKS, ORIGINAL_CAGE_DEFINITION_SHAPES,
  evaluateOriginalCagePlacement, originalRanchFieldTileOrigin, ranchBoardCell
} from "../src/championship/cage/ranchSlotGeometry.js";
import { createCageEditRuntime } from "../src/championship/cage/cageEditRuntime.js";

const receipt = JSON.parse(readFileSync(new URL(
  "../docs/research/ranch-assembly-2026-09-06/native-geometry-receipt.json", import.meta.url), "utf8"));

test("placement port matches all 2560 original ARM execution results", () => {
  assert.equal(receipt.placementVectorCount, 2560);
  assert.equal(receipt.placementVectors.length, receipt.placementVectorCount);
  for (const row of receipt.placementVectors) {
    const input = Object.freeze({ shapeIndex: row.shape, slotIndex: row.slot, occupiedMask: row.occupiedBefore });
    assert.deepEqual(evaluateOriginalCagePlacement(input), { ok: row.ok, occupiedMask: row.occupiedAfter,
      xFixed: row.ok ? row.xFixed : null, yFixed: row.ok ? row.yFixed : null }, JSON.stringify(row));
  }
});

test("field destination origin matches 320 native segments without claiming sprite position", () => {
  assert.equal(receipt.fieldVectorCount, 320);
  assert.equal(receipt.fieldVectors.length, receipt.fieldVectorCount);
  for (const row of receipt.fieldVectors) {
    const result = originalRanchFieldTileOrigin(row.slot, row.shape);
    assert.equal(result.tileX, row.destinationTileX);
    assert.equal(result.tileY, row.destinationTileY);
    assert.equal(result.coordinateSpace, "ORIGINAL_FIELD_DESTINATION_TILES");
    assert.equal(result.tileY * 120 + result.tileX, row.destinationOffset);
  }
});

test("all 36 definition shape indices and 16 masks agree with direct source reads", () => {
  assert.deepEqual(ORIGINAL_CAGE_SHAPE_MASKS, receipt.maskTable.values);
  assert.deepEqual(ORIGINAL_CAGE_DEFINITION_SHAPES, receipt.definitionShapes);
  // Cage 1 has mask 7, three occupied bits. This specifically refutes one-cell ownership.
  assert.equal(ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[1]], 7);
  assert.equal(ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[35]], 15);
  assert.ok(Object.isFrozen(ORIGINAL_CAGE_SHAPE_MASKS));
});

test("native lower row shifts right, with no alternating-column vertical stagger", () => {
  assert.equal(BOARD_ARRANGEMENT_EVIDENCE, "VERIFIED_BINARY_NATIVE_REPLAY");
  assert.deepEqual([0, 1, 2, 3, 18, 19].map((i) => {
    const cell = ranchBoardCell(i); return [cell.x, cell.y];
  }), [[2, 8], [14, 30], [26, 8], [38, 30], [218, 8], [230, 30]]);
});

test("blocked masks remain unchanged and malformed native-port inputs cannot wrap", () => {
  const blocked = evaluateOriginalCagePlacement({ shapeIndex: 6, slotIndex: 4, occupiedMask: 0x40 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.occupiedMask, 0x40);
  assert.ok(Object.isFrozen(blocked));
  for (const occupiedMask of [-1, 0x100000000, NaN, 0.5, "0"]) {
    assert.throws(() => evaluateOriginalCagePlacement({ shapeIndex: 0, slotIndex: 0, occupiedMask }), /MASK_INVALID/);
  }
  for (const shape of [-1, 16, NaN, 0.5]) assert.throws(() => originalRanchFieldTileOrigin(0, shape), /SHAPE_OUT_OF_RANGE/);
  for (const slot of [-1, 20, NaN, 0.5]) assert.throws(() => originalRanchFieldTileOrigin(slot, 0), /SLOT_OUT_OF_RANGE/);
});

test("legacy editor labels its placement model honestly and preserves historical saves", () => {
  const snapshot = { placements: [
    { moduleId: "championship:2026:cage:1", slotIndex: 1 },
    { moduleId: "championship:2026:cage:waiting-room", slotIndex: 2 }
  ] };
  const editor = createCageEditRuntime({ snapshot });
  assert.deepEqual(editor.toSave(), snapshot);
  assert.equal(createCageEditRuntime().getFrame().placementEvidence,
    "PRODUCT_AUTHORED_PENDING_ORIGINAL_FOOTPRINT_MIGRATION");
  // The pure native audit must not silently normalize/drop a legacy record.
  evaluateOriginalCagePlacement({ shapeIndex: 6, slotIndex: 1, occupiedMask: 4 });
  assert.deepEqual(editor.toSave(), snapshot);
});
