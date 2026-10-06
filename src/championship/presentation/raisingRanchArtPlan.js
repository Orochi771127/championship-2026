// The ranch art plan for any ranch, including the expansion prototype's annex
// (2026-10-05).
//
// raisingCageArtPlan.js lays out the original board and is hash-locked by the
// cage authoring contract, so it is not edited: a ranch without the prototype
// grant goes straight to it. With the annex the board continues as one longer
// field ring, which the original refuses (its tile origin range-checks the
// board slot), so composeRanchArtPlan() repeats its native branch over ring
// slots and adds the fold the presentation shows the annex with. Tests replay
// the repeat over every original layout and require the original's output.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { getCageDefinitionByModuleId, MAX_SLOT_COUNT } from "../cage/cageCatalog.js";
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from "../cage/ranchSlotGeometry.js";
import { RANCH_DECKS_LAYOUT, annexSlotCount, ranchRing, ringFieldTileOrigin, validateRanchLayout } from "../cage/ranchExpansion.js";
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from "./originalCageVisualBindings.js";
import { createRaisingCageArtPlan } from "./raisingCageArtPlan.js";
import { RAISING_TOP_HEADROOM_NATIVE } from "./intRh2/raisingFieldViewport.js";

function fail(reason) { throw new Error(`RAISING_CAGE_ART_PLAN_INVALID:${reason}`); }

const SINGLE_CELL_SHAPE_INDEX = ORIGINAL_CAGE_SHAPE_MASKS.indexOf(1);
const LID_FIELD_ID = ORIGINAL_CAGE_STRUCTURAL_VISUALS.find((entry) => entry.role === "LID")?.fieldId ?? null;

function ringCellGeometry({ field, slotIndex, shapeIndex, unit, ringCount }) {
  const origin = ringFieldTileOrigin(slotIndex, shapeIndex);
  const x = origin.tileX * 8 * unit;
  const y = origin.tileY * 8 * unit;
  const cropTop = slotIndex % 2 === 0 ? 24 * unit : 0;
  const width = Math.min(field.worldWidthPx, ringCount * 48 * unit - x);
  if (width <= 0) fail('NATIVE_LAYOUT_OUTSIDE_BOARD');
  return { x, y, width, sourceRect: { x: 0, y: cropTop, width, height: field.worldHeightPx - cropTop } };
}

/**
 * The original native branch over ranchRing(): every placement at its ring
 * slot, a Lid on every empty bay, back row before front row, the right strip
 * of a tile past the ring's end replayed at x=0. With an annex it also says
 * where the presentation folds the ring.
 */
export function composeRanchArtPlan({ manifest, placements, layoutVersion, unlockedCount, expansion = null }) {
  if (manifest?.family !== "CAGE" || !Array.isArray(manifest.fields)) fail("CAGE_MANIFEST_REQUIRED");
  if (!Array.isArray(placements) || placements.length === 0) fail("PLACEMENTS_REQUIRED");
  const fields = new Map(manifest.fields.map((field) => [field.fieldId, field]));
  const slotLimit = MAX_SLOT_COUNT + (layoutVersion === RANCH_DECKS_LAYOUT ? annexSlotCount(expansion) : 0);
  const slots = new Set(), modules = new Set();
  for (const placement of placements) {
    const { slotIndex, moduleId } = placement ?? {};
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotLimit) fail("SLOT_OUT_OF_RANGE");
    if (slots.has(slotIndex)) fail(`DUPLICATE_SLOT:${slotIndex}`);
    slots.add(slotIndex);
    if (modules.has(moduleId)) fail(`DUPLICATE_MODULE:${moduleId}`);
    modules.add(moduleId);
  }
  if (![14, 16, 18, 20].includes(unlockedCount)
    || !validateRanchLayout(placements, { layoutVersion, mainUnlocked: MAX_SLOT_COUNT, expansion })) fail('NATIVE_LAYOUT_INVALID');
  const ring = ranchRing({ layoutVersion, placements, unlockedCount, expansion });
  const tiles = ring.placements.map(({ slotIndex, moduleId }) => {
    const definition = getCageDefinitionByModuleId(moduleId);
    if (!definition) fail(`MODULE_UNKNOWN:${moduleId}`);
    const field = fields.get(getOriginalCageVisualBinding(definition.cageDefinitionIndex)?.fieldId);
    if (!field) fail(`FIELD_MISSING_FOR_MODULE:${moduleId}`);
    return { slotIndex, fieldId: field.fieldId, worldWidthPx: field.worldWidthPx, worldHeightPx: field.worldHeightPx,
      identity: { moduleId, cageDefinitionIndex: definition.cageDefinitionIndex } };
  });
  const result = [];
  let residentViewport = null;
  const place = (tile, identity, geometry) => {
    result.push({ slotIndex: tile.slotIndex, fieldId: tile.fieldId, worldWidthPx: tile.worldWidthPx, worldHeightPx: tile.worldHeightPx,
      ...identity, x: geometry.x, y: geometry.y, sourceRect: geometry.sourceRect });
    const field = fields.get(tile.fieldId);
    if (geometry.width < field.worldWidthPx) {
      result.push({ fieldId: tile.fieldId, ...identity, x: 0, y: geometry.y, fragmentOfSlot: tile.slotIndex,
        sourceRect: { ...geometry.sourceRect, x: geometry.width, width: field.worldWidthPx - geometry.width } });
    }
  };
  const lidField = LID_FIELD_ID ? fields.get(LID_FIELD_ID) : null;
  if (lidField) {
    const unit = lidField.worldWidthPx / lidField.nativeWidthPx;
    for (const slotIndex of ring.uncovered) {
      place({ slotIndex, fieldId: lidField.fieldId, worldWidthPx: lidField.worldWidthPx, worldHeightPx: lidField.worldHeightPx },
        { moduleId: null, cageDefinitionIndex: null, structuralRole: 'LID' },
        ringCellGeometry({ field: lidField, slotIndex, shapeIndex: SINGLE_CELL_SHAPE_INDEX, unit, ringCount: ring.ringCount }));
    }
  }
  for (const tile of [...tiles].sort((a, b) => (a.slotIndex % 2) - (b.slotIndex % 2) || a.slotIndex - b.slotIndex)) {
    const field = fields.get(tile.fieldId);
    const unit = field.worldWidthPx / field.nativeWidthPx;
    const shape = ORIGINAL_CAGE_DEFINITION_SHAPES[tile.identity.cageDefinitionIndex];
    const geometry = ringCellGeometry({ field, slotIndex: tile.slotIndex, shapeIndex: shape, unit, ringCount: ring.ringCount });
    place(tile, tile.identity, geometry);
    if (tile.identity.cageDefinitionIndex === 35) {
      residentViewport = { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.sourceRect.height };
    }
  }
  const worldUnit = tiles[0].worldWidthPx / fields.get(tiles[0].fieldId).nativeWidthPx;
  return deepFreeze({ mode: 'NATIVE_RANCH', placementEvidence: 'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART',
    residentViewport, wrapWidthPx: ring.ringCount * 48 * worldUnit, placements: result,
    // The second band starts one body's headroom below the first band's foot,
    // the same room the viewport holds above the board, so no body overlaps it.
    ...(ring.annexStart !== null ? { fold: { splitPx: ring.annexStart * 48 * worldUnit, ringPx: ring.ringCount * 48 * worldUnit,
      bandGapPx: RAISING_TOP_HEADROOM_NATIVE * worldUnit } } : {}) });
}

/** The art plan for whichever layout the ranch carries. */
export function createRanchCageArtPlan(options) {
  if (options?.layoutVersion !== RANCH_DECKS_LAYOUT || (options.previewFieldId ?? null) !== null) return createRaisingCageArtPlan(options);
  return composeRanchArtPlan(options);
}
