// Read-only projection of current gameplay/placement authorities for art QA.
import fs from 'node:fs';
import { originalStartingRanch, NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE } from '../../src/championship/cage/nativeRanchLayout.js';
import { ORIGINAL_CAGE_SHAPE_MASKS, ORIGINAL_CAGE_DEFINITION_SHAPES, ranchBoardCell, originalRanchFieldTileOrigin } from '../../src/championship/cage/ranchSlotGeometry.js';
import { createRaisingCageArtPlan } from '../../src/championship/presentation/raisingCageArtPlan.js';
import { createNativeRaisingGround } from '../../src/championship/raising/nativeRaisingGround.js';

export function cageAuthoringGeometry() {
  const manifest = JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json', 'utf8'));
  const waiting = { moduleId: WAITING_ROOM_MODULE, slotIndex: 0 };
  const vacant = slotIndex => ({ moduleId: 'championship:2026:cage:0', slotIndex });
  const scenarios = [
    ['upper-row', [waiting, vacant(8)]],
    ['lower-row', [waiting, vacant(9)]],
    ['wrap-edge', [waiting, vacant(13)]],
    ['starting-ranch', originalStartingRanch().placements]
  ].map(([id, placements]) => {
    const frame = { layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount: 14, placements };
    const ground = createNativeRaisingGround(frame);
    return { id, placements, plan: createRaisingCageArtPlan({ ...frame, manifest }),
      ground: { width: ground.width, height: ground.height,
        terrain: Array.from(ground.terrain), owners: Array.from(ground.owners) } };
  });
  const shapeIndex = ORIGINAL_CAGE_DEFINITION_SHAPES[0];
  return { definitionIndex: 0, shapeIndex, shapeMask: ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex],
    coordinateSpaces: ['CAGE_EDIT_BOARD_256x192', 'OCCUPANCY_COLUMN_MAJOR', 'ORIGINAL_FIELD_DESTINATION_TILES', 'OBJECT_LOCAL_NATIVE_PIXELS'],
    boardCells: [8,9].map(ranchBoardCell), tileOrigins: [8,9].map(slot => originalRanchFieldTileOrigin(slot, shapeIndex)), scenarios };
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/cage-authoring-geometry.mjs')) console.log(JSON.stringify(cageAuthoringGeometry()));
