import { getCageDefinitionByModuleId, listCageDefinitions } from './cageCatalog.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from './ranchSlotGeometry.js';

export const NATIVE_RANCH_LAYOUT = 'NATIVE_ANCHORS_V1';
export const WAITING_ROOM_MODULE = 'championship:2026:cage:waiting-room';
// Original record setter execution: 02067C64, 02067E68, 02068070, 02068270.
// Only a new game receives these records. Old saves have no layout marker.
export function originalStartingRanch() {
  const definitions = listCageDefinitions();
  return { layoutVersion: NATIVE_RANCH_LAYOUT, placements: [[35,0],[0,8],[1,4],[15,7]].map(([id,slotIndex])=>({
    moduleId: definitions.find(d=>d.cageDefinitionIndex===id).moduleId, slotIndex
  })) };
}

export function nativePlacementMask(entry, unlockedCount = 20) {
  const definition = getCageDefinitionByModuleId(entry?.moduleId);
  if (!definition || !Number.isInteger(entry.slotIndex) || entry.slotIndex < 0 || entry.slotIndex >= unlockedCount) return null;
  const shape = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
  // OVL15 drop caller: masks spanning both rows must start in the upper row.
  if ((shape & 0xaa) && (entry.slotIndex & 1)) return null;
  const mask = shape << entry.slotIndex;
  if (mask & ~((1 << unlockedCount)-1)) return null;
  return mask;
}

export function validateNativeRanch(placements, unlockedCount = 20) {
  let occupiedMask = 0;
  const seen = new Set();
  for (const entry of placements) {
    const mask = nativePlacementMask(entry, unlockedCount);
    if (mask === null || (occupiedMask & mask) || seen.has(entry.moduleId)) return false;
    if (entry.moduleId === WAITING_ROOM_MODULE && entry.slotIndex !== 0) return false;
    occupiedMask |= mask;
    seen.add(entry.moduleId);
  }
  return seen.has(WAITING_ROOM_MODULE);
}
