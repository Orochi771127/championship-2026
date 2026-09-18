import { deepFreeze } from "../contracts/championshipContracts.js";
import { getCageDefinitionByModuleId, MAX_SLOT_COUNT } from "../cage/cageCatalog.js";
import { layoutRanchTiles, originalRanchFieldTileOrigin, ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from "../cage/ranchSlotGeometry.js";
import { NATIVE_RANCH_LAYOUT, nativePlacementMask, validateNativeRanch } from '../cage/nativeRanchLayout.js';
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from "./originalCageVisualBindings.js";

function fail(reason) { throw new Error(`RAISING_CAGE_ART_PLAN_INVALID:${reason}`); }

/** The single-cell shape, which is what the Lid covers. */
const SINGLE_CELL_SHAPE_INDEX = ORIGINAL_CAGE_SHAPE_MASKS.indexOf(1);
const LID_FIELD_ID = ORIGINAL_CAGE_STRUCTURAL_VISUALS.find((entry) => entry.role === "LID")?.fieldId ?? null;

/** Where one board cell's art lands, and how much of it the board shows.
 *
 * The upper row drops its top three tile rows (ARM9 `row === 0 ? 3 : 0`), which
 * is the band the lower row covers; the field art is authored with that band
 * spare. A tile running past the right edge keeps its right strip, which the
 * caller replays at x=0 because the board wraps.
 */
function boardCellGeometry({ field, slotIndex, shapeIndex, unit, unlockedCount }) {
  const origin = originalRanchFieldTileOrigin(slotIndex, shapeIndex);
  const x = origin.tileX * 8 * unit;
  const y = origin.tileY * 8 * unit;
  const cropTop = slotIndex % 2 === 0 ? 24 * unit : 0;
  const width = Math.min(field.worldWidthPx, unlockedCount * 48 * unit - x);
  if (width <= 0) fail('NATIVE_LAYOUT_OUTSIDE_BOARD');
  return { x, y, width, sourceRect: { x: 0, y: cropTop, width, height: field.worldHeightPx - cropTop } };
}

/** A projection of the existing editor placements, never a second ranch state.
 * Resolve every placed cage before loading. Missing art must not silently omit
 * a player's module or turn a nonempty ranch into the default preview.
 */
export function createRaisingCageArtPlan({ manifest, placements, previewFieldId = null, layoutVersion = null, unlockedCount = 14 }) {
  if (manifest?.family !== "CAGE" || !Array.isArray(manifest.fields)) fail("CAGE_MANIFEST_REQUIRED");
  if (!Array.isArray(placements)) fail("PLACEMENTS_REQUIRED");
  const fields = new Map(manifest.fields.map((field) => [field.fieldId, field]));
  if (previewFieldId !== null || placements.length === 0) {
    const fieldId = previewFieldId ?? getOriginalCageVisualBinding(0).fieldId;
    if (!fields.has(fieldId)) fail(`FIELD_UNKNOWN:${fieldId}`);
    return deepFreeze({ mode: previewFieldId !== null ? "EXPLICIT_ART_PREVIEW" : "EMPTY_RANCH_ART_PREVIEW",
      placementEvidence: "PREVIEW_ONLY_NOT_PLAYER_PLACEMENT",
      placements: [{ fieldId, x: 0, y: 0 }] });
  }
  const slots = new Set();
  const modules = new Set();
  const identities = new Map();
  const tiles = placements.map((placement) => {
    const { slotIndex, moduleId } = placement ?? {};
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOT_COUNT) fail("SLOT_OUT_OF_RANGE");
    if (slots.has(slotIndex)) fail(`DUPLICATE_SLOT:${slotIndex}`);
    slots.add(slotIndex);
    // Match the existing editor's unique module ownership; do not invent an
    // instance authority or change duplicate-purchase semantics here.
    if (modules.has(moduleId)) fail(`DUPLICATE_MODULE:${moduleId}`);
    modules.add(moduleId);
    const definition = getCageDefinitionByModuleId(moduleId);
    if (!definition) fail(`MODULE_UNKNOWN:${moduleId}`);
    const binding = getOriginalCageVisualBinding(definition.cageDefinitionIndex);
    const field = fields.get(binding?.fieldId);
    if (!field) fail(`FIELD_MISSING_FOR_MODULE:${moduleId}`);
    identities.set(slotIndex, { moduleId, cageDefinitionIndex: definition.cageDefinitionIndex });
    return { slotIndex, fieldId: field.fieldId, worldWidthPx: field.worldWidthPx, worldHeightPx: field.worldHeightPx };
  });
  if (layoutVersion === NATIVE_RANCH_LAYOUT) {
    if (![14,16,18,20].includes(unlockedCount) || !validateNativeRanch(placements)) fail('NATIVE_LAYOUT_INVALID');
    const result = [];
    let residentViewport = null;
    const place = (tile, identity, geometry) => {
      result.push({ ...tile, ...identity, x: geometry.x, y: geometry.y, sourceRect: geometry.sourceRect });
      const field = fields.get(tile.fieldId);
      if (geometry.width < field.worldWidthPx) {
        result.push({ fieldId: tile.fieldId, ...identity, x: 0, y: geometry.y, fragmentOfSlot: tile.slotIndex,
          sourceRect: { ...geometry.sourceRect, x: geometry.width, width: field.worldWidthPx - geometry.width } });
      }
    };

    // An empty bay is not a hole in the board: the original bolts the Lid over
    // it, so the ranch reads as one machine full of terrain trays rather than
    // a few islands floating on the backdrop. Lids go down first, because a
    // cage's own art may overhang the bay next to it.
    const lidField = LID_FIELD_ID ? fields.get(LID_FIELD_ID) : null;
    if (lidField) {
      let occupied = 0;
      for (const placement of placements) occupied |= nativePlacementMask(placement, unlockedCount) ?? 0;
      const unit = lidField.worldWidthPx / lidField.nativeWidthPx;
      for (let slotIndex = 0; slotIndex < unlockedCount; slotIndex += 1) {
        if (occupied & (1 << slotIndex)) continue;
        const tile = { slotIndex, fieldId: lidField.fieldId,
          worldWidthPx: lidField.worldWidthPx, worldHeightPx: lidField.worldHeightPx };
        place(tile, { moduleId: null, cageDefinitionIndex: null, structuralRole: 'LID' },
          boardCellGeometry({ field: lidField, slotIndex, shapeIndex: SINGLE_CELL_SHAPE_INDEX, unit, unlockedCount }));
      }
    }

    // Back row before front row: the lower row is the one that overlaps, and
    // the composite draws in array order. Editor order is arrival order.
    for (const tile of [...tiles].sort((a, b) => (a.slotIndex % 2) - (b.slotIndex % 2) || a.slotIndex - b.slotIndex)) {
      const identity = identities.get(tile.slotIndex);
      const field = fields.get(tile.fieldId);
      const unit = field.worldWidthPx / field.nativeWidthPx;
      const shape = ORIGINAL_CAGE_DEFINITION_SHAPES[identity.cageDefinitionIndex];
      const geometry = boardCellGeometry({ field, slotIndex: tile.slotIndex, shapeIndex: shape, unit, unlockedCount });
      place(tile, identity, geometry);
      if (identity.cageDefinitionIndex === 35) {
        residentViewport = { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.sourceRect.height };
      }
    }
    return deepFreeze({mode:'NATIVE_RANCH', placementEvidence:'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART',
      residentViewport, wrapWidthPx:unlockedCount*48*(tiles[0].worldWidthPx/fields.get(tiles[0].fieldId).nativeWidthPx), placements:result});
  }
  const layout = layoutRanchTiles(tiles);
  return deepFreeze({ mode: "PLAYER_PLACEMENTS", placementEvidence: layout.evidence,
    placements: layout.tiles.map((tile) => ({ ...tile, ...identities.get(tile.slotIndex) })) });
}
