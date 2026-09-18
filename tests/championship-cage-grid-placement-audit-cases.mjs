import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../assets/production/cage/licensed-runtime-v1/manifest.json' with {type:'json'};
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, nativePlacementMask, validateNativeRanch } from '../src/championship/cage/nativeRanchLayout.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, originalRanchFieldTileOrigin, ranchBoardCell } from '../src/championship/cage/ranchSlotGeometry.js';
import { createRaisingCageArtPlan } from '../src/championship/presentation/raisingCageArtPlan.js';
import { cageEditorArtCells } from '../src/championship/presentation/cageUiArt.js';

const definitions = listCageDefinitions();
const fieldById = new Map(manifest.fields.map(field => [field.fieldId, field]));
const localPreview = 'http://127.0.0.1:8732/championship.html';
const moduleOf = index => definitions[index].moduleId;
const bitSlots = mask => Array.from({length:20}, (_, slot) => slot).filter(slot => mask & (1 << slot));

function targetFragments(plan, definitionIndex) {
  return plan.placements.filter(placement => placement.cageDefinitionIndex === definitionIndex);
}

test('all 36 facilities use their traced footprint and position in every legal editor cell', () => {
  const checkedDefinitions = new Set([35]);
  const checkedAnchors = new Set([0]);
  let legalPlacements = 0;

  for (const unlockedCount of [14, 16, 18, 20]) {
    for (let definitionIndex = 0; definitionIndex < 35; definitionIndex++) {
      const definition = definitions[definitionIndex];
      for (let slotIndex = 4; slotIndex < unlockedCount; slotIndex++) {
        const placements = [
          {moduleId:WAITING_ROOM_MODULE, slotIndex:0},
          {moduleId:definition.moduleId, slotIndex}
        ];
        if (!validateNativeRanch(placements, unlockedCount)) continue;

        const runtime = createCageEditRuntime({snapshot:{layoutVersion:NATIVE_RANCH_LAYOUT, placements}});
        const frame = runtime.getFrame([definition.shopRecordIndex], unlockedCount >= 20 ? 6 : unlockedCount >= 18 ? 4 : unlockedCount >= 16 ? 2 : 0);
        const expectedSlots = bitSlots(nativePlacementMask(placements[1], unlockedCount));
        const actualSlots = frame.slots.filter(cell => cell.moduleId === definition.moduleId).map(cell => cell.slotIndex);
        assert.deepEqual(actualSlots, expectedSlots, `editor footprint definition ${definitionIndex} anchor ${slotIndex} ranch ${unlockedCount}`);

        const cells = cageEditorArtCells(frame.slots, localPreview).filter(cell => expectedSlots.includes(cell.slotIndex));
        assert.equal(cells.length, expectedSlots.length);
        assert.ok(cells.every(cell => cell.image === cells[0].image && cell.image));
        const sharedImageX = cells[0].x + cells[0].imageX;
        const sharedImageY = cells[0].y + cells[0].imageY;
        for (const cell of cells) {
          const board = ranchBoardCell(cell.slotIndex);
          assert.deepEqual([cell.x, cell.y], [board.x * 2, (board.y - 8) * 2]);
          assert.ok(Math.abs(cell.x + cell.imageX - sharedImageX) < 1e-9, 'all occupied hexes sample one shared facility image');
          assert.ok(Math.abs(cell.y + cell.imageY - sharedImageY) < 1e-9, 'all occupied hexes sample one shared facility image');
        }

        checkedDefinitions.add(definitionIndex);
        checkedAnchors.add(slotIndex);
        legalPlacements++;
      }
    }
  }

  assert.equal(checkedDefinitions.size, 36, 'all shop cages plus Waiting Room are represented');
  assert.deepEqual([...checkedAnchors].sort((a,b)=>a-b), [0,...Array.from({length:16},(_,i)=>i+4)], 'every user-placeable board cell is exercised');
  assert.ok(legalPlacements > 1000, `expected a full placement matrix, checked ${legalPlacements}`);
});

test('every legal cage-map placement is cropped, wrapped and contained by the ranch board', () => {
  let checked = 0;
  let wrapped = 0;
  for (const unlockedCount of [14, 16, 18, 20]) {
    const boardWidth = unlockedCount * 48 * 4;
    const boardHeight = 176 * 4;
    for (let definitionIndex = 0; definitionIndex < 35; definitionIndex++) {
      for (let slotIndex = 4; slotIndex < unlockedCount; slotIndex++) {
        const placements = [
          {moduleId:WAITING_ROOM_MODULE, slotIndex:0},
          {moduleId:moduleOf(definitionIndex), slotIndex}
        ];
        if (!validateNativeRanch(placements, unlockedCount)) continue;
        const plan = createRaisingCageArtPlan({manifest, placements, layoutVersion:NATIVE_RANCH_LAYOUT, unlockedCount});
        const pieces = targetFragments(plan, definitionIndex);
        const field = fieldById.get(pieces[0].fieldId);
        const unit = field.worldWidthPx / field.nativeWidthPx;
        const origin = originalRanchFieldTileOrigin(slotIndex, ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex]);
        const cropTop = slotIndex % 2 === 0 ? 24 * unit : 0;

        assert.equal(unit, 4);
        assert.equal(plan.wrapWidthPx, boardWidth);
        assert.deepEqual([pieces[0].x, pieces[0].y], [origin.tileX * 8 * unit, origin.tileY * 8 * unit]);
        assert.equal(pieces[0].sourceRect.y, cropTop);
        assert.equal(pieces[0].sourceRect.height, field.worldHeightPx - cropTop);

        const source = [...pieces].sort((a,b)=>a.sourceRect.x-b.sourceRect.x);
        let cursor = 0;
        for (const piece of source) {
          const rect = piece.sourceRect;
          assert.equal(rect.x, cursor, 'wrapped source strips have no gap or overlap');
          cursor += rect.width;
          assert.ok(piece.x >= 0 && piece.x + rect.width <= boardWidth, 'destination stays inside the horizontal board');
          assert.ok(piece.y >= 0 && piece.y + rect.height <= boardHeight, 'destination stays inside the vertical board');
        }
        assert.equal(cursor, field.worldWidthPx, 'the full map width is drawn exactly once');
        assert.ok(pieces.length === 1 || pieces.length === 2);
        if (pieces.length === 2) wrapped++;
        checked++;
      }
    }
  }
  assert.ok(checked > 1000, `expected a full map-placement matrix, checked ${checked}`);
  assert.ok(wrapped > 0, 'right-edge wrap placements were exercised');
});

test('Waiting Room and every empty cell lid also stay inside all four ranch sizes', () => {
  for (const unlockedCount of [14,16,18,20]) {
    const placements = [{moduleId:WAITING_ROOM_MODULE,slotIndex:0}];
    const plan = createRaisingCageArtPlan({manifest, placements, layoutVersion:NATIVE_RANCH_LAYOUT, unlockedCount});
    const boardWidth = unlockedCount * 48 * 4, boardHeight = 176 * 4;
    const lids = new Set();
    for (const piece of plan.placements) {
      assert.ok(piece.x >= 0 && piece.x + piece.sourceRect.width <= boardWidth);
      assert.ok(piece.y >= 0 && piece.y + piece.sourceRect.height <= boardHeight);
      if (piece.structuralRole === 'LID' && Number.isInteger(piece.slotIndex)) lids.add(piece.slotIndex);
    }
    assert.deepEqual([...lids].sort((a,b)=>a-b), Array.from({length:unlockedCount-4},(_,i)=>i+4));
  }
});
