// Footprint shape index of every cage definition (OVL15 0x0210DB40 masks via
// ranchSlotGeometry.js), plus the product's gachapon cages.
// OWNER_APPROVED_ADAPTATION 2026-11-03: 全自動皇家牧場 (36) and 全自動星際動物園 (37)
// take the waiting room's four-hex shape (index 10, mask 15).
import { ORIGINAL_CAGE_DEFINITION_SHAPES } from './ranchSlotGeometry.js';

export const GACHA_CAGE_DEFINITION_SHAPES = Object.freeze({ 36: 10, 37: 10 });

export function cageDefinitionShape(cageDefinitionIndex) {
  return ORIGINAL_CAGE_DEFINITION_SHAPES[cageDefinitionIndex] ?? GACHA_CAGE_DEFINITION_SHAPES[cageDefinitionIndex];
}
