import { deepFreeze } from "../contracts/championshipContracts.js";
import { getCageDefinitionByModuleId, MAX_SLOT_COUNT } from "../cage/cageCatalog.js";
import { layoutRanchTiles, originalRanchFieldTileOrigin, ORIGINAL_CAGE_DEFINITION_SHAPES } from "../cage/ranchSlotGeometry.js";
import { NATIVE_RANCH_LAYOUT, validateNativeRanch } from '../cage/nativeRanchLayout.js';
import { getOriginalCageVisualBinding } from "./originalCageVisualBindings.js";

function fail(reason) { throw new Error(`RAISING_CAGE_ART_PLAN_INVALID:${reason}`); }

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
    for (const tile of tiles) {
      const identity = identities.get(tile.slotIndex);
      const field = fields.get(tile.fieldId);
      const unit = field.worldWidthPx / field.nativeWidthPx;
      const shape = ORIGINAL_CAGE_DEFINITION_SHAPES[identity.cageDefinitionIndex];
      const origin = originalRanchFieldTileOrigin(tile.slotIndex, shape);
      const x = origin.tileX * 8 * unit;
      const y = origin.tileY * 8 * unit;
      const cropTop = tile.slotIndex % 2 === 0 ? 24 * unit : 0;
      const boardWidth = unlockedCount * 48 * unit;
      const width = Math.min(field.worldWidthPx, boardWidth-x);
      if (width <= 0) fail('NATIVE_LAYOUT_OUTSIDE_BOARD');
      const sourceRect = { x: 0, y: cropTop, width, height: field.worldHeightPx-cropTop };
      result.push({ ...tile, ...identity, x, y, sourceRect });
      if (identity.cageDefinitionIndex === 35) residentViewport = {x,y,width,height:sourceRect.height};
      if (width < field.worldWidthPx) result.push({fieldId:tile.fieldId, ...identity,
        x:0,y,fragmentOfSlot:tile.slotIndex, sourceRect:{...sourceRect,x:width,width:field.worldWidthPx-width}});
    }
    return deepFreeze({mode:'NATIVE_RANCH', placementEvidence:'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART',
      residentViewport, placements:result});
  }
  const layout = layoutRanchTiles(tiles);
  return deepFreeze({ mode: "PLAYER_PLACEMENTS", placementEvidence: layout.evidence,
    placements: layout.tiles.map((tile) => ({ ...tile, ...identities.get(tile.slotIndex) })) });
}
