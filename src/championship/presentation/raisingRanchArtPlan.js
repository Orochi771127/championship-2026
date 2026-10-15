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

import { PRODUCT_RANCH_GRID, PRODUCT_RANCH_SLOT_COUNT, productGridCell, productPlacementCells, validateProductRanch, productFieldTileOrigin, PRODUCT_RANCH_WORLD_WIDTH, PRODUCT_RANCH_WORLD_HEIGHT } from "../cage/productRanchGrid.js";
import { deepFreeze } from "../contracts/championshipContracts.js";
import { getCageDefinitionByModuleId, MAX_SLOT_COUNT } from "../cage/cageCatalog.js";
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from "../cage/ranchSlotGeometry.js";
import { NATIVE_RANCH_LAYOUT, RANCH_DECKS_LAYOUT, RANCH_EXPANSION_DECK_SLOTS, annexSlotCount, ranchRing, ringFieldTileOrigin,
  validateRanchLayout } from "../cage/ranchExpansion.js";
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from "./originalCageVisualBindings.js";
import { createRaisingCageArtPlan } from "./raisingCageArtPlan.js";

function fail(reason) { throw new Error(`RAISING_CAGE_ART_PLAN_INVALID:${reason}`); }

const SINGLE_CELL_SHAPE_INDEX = ORIGINAL_CAGE_SHAPE_MASKS.indexOf(1);

/**
 * The annex is drawn as the honeycomb's next two rows, under the main board.
 * Field tops sit 11 tiles apart (row 0's at -3 under its 3-row crop, row 1's
 * at 8), so a third row's field top is 19 tiles down and its cropped upper
 * edge 22 tiles: 176 native pixels below the board's top edge. The 24-pixel
 * band an upper-row cell drops is the pointed top of its hexes, so the annex
 * draws it back as a cap that meets the pointed bottoms of the main lower row.
 */
export const RANCH_ANNEX_BAND_OFFSET_NATIVE = 176;
export const RANCH_UPPER_ROW_CAP_NATIVE = 24;
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
  // Caps: the cropped tops of the annex's upper-row cells, drawn only in the
  // annex band, above its first row.
  const caps = ring.annexStart === null ? [] : result.filter((tile) => tile.fragmentOfSlot === undefined
    && tile.slotIndex >= ring.annexStart && tile.slotIndex % 2 === 0 && tile.sourceRect?.y > 0).map((tile) => ({
    fieldId: tile.fieldId, moduleId: tile.moduleId, cageDefinitionIndex: tile.cageDefinitionIndex,
    ...(tile.structuralRole ? { structuralRole: tile.structuralRole } : {}), x: tile.x, y: -tile.sourceRect.y,
    foldCap: true, capOfSlot: tile.slotIndex, sourceRect: { x: tile.sourceRect.x, y: 0, width: tile.sourceRect.width, height: tile.sourceRect.y } }));
  return deepFreeze({ mode: 'NATIVE_RANCH', placementEvidence: 'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART',
    residentViewport, wrapWidthPx: ring.ringCount * 48 * worldUnit, placements: [...result, ...caps],
    ...(ring.annexStart !== null ? { fold: { splitPx: ring.annexStart * 48 * worldUnit, ringPx: ring.ringCount * 48 * worldUnit,
      bandOffsetPx: RANCH_ANNEX_BAND_OFFSET_NATIVE * worldUnit, capPx: RANCH_UPPER_ROW_CAP_NATIVE * worldUnit } } : {}) });
}

/**
 * The expansion as a ranch without it sees it (2026-10-12): the annex's ten
 * bays under the board, each under the original Lid, so the room an
 * expansion would open reads as more of the same honeycomb instead of empty
 * screen. Presentation only -- the player's ring, walk grid and placements
 * are untouched, and nothing here can be walked into or built on.
 *
 * The bays sit exactly where a granted annex draws its rows 3-4: the same
 * band offset, the same capped upper row, the same cell origins. Owner
 * 2026-10-12: the covers run under every column of the board, not only the
 * expansion's five, so panning never opens a hole below the ranch. The band
 * is a ring as long as the board's (it repeats with the ranch's own wrap),
 * and its front row's last half-bay wraps into the band's first column.
 * Bays 0-9 are the expansion's ten; padlocks sit only on those. Back row
 * first, caps last, as the annex band draws them.
 */
export function ranchExpansionPreviewPlan({ manifest, layoutVersion, unlockedCount = null, previewFieldId = null }) {
  if (layoutVersion !== NATIVE_RANCH_LAYOUT || previewFieldId !== null || !Array.isArray(manifest?.fields)) return null;
  const lid = LID_FIELD_ID ? manifest.fields.find((field) => field.fieldId === LID_FIELD_ID) : null;
  if (!lid || !(lid.nativeWidthPx > 0)) return null;
  const unit = lid.worldWidthPx / lid.nativeWidthPx;
  const ringCount = [14, 16, 18, 20].includes(unlockedCount) ? unlockedCount : RANCH_EXPANSION_DECK_SLOTS;
  const bays = [], caps = [];
  const slots = Array.from({ length: ringCount }, (_, slot) => slot).sort((a, b) => (a % 2) - (b % 2) || a - b);
  for (const slotIndex of slots) {
    const geometry = ringCellGeometry({ field: lid, slotIndex, shapeIndex: SINGLE_CELL_SHAPE_INDEX, unit, ringCount });
    const identity = { fieldId: lid.fieldId, moduleId: null, cageDefinitionIndex: null, structuralRole: 'LID' };
    bays.push({ slotIndex, ...identity, x: geometry.x, y: geometry.y, sourceRect: geometry.sourceRect });
    if (geometry.width < lid.worldWidthPx) bays.push({ ...identity, x: 0, y: geometry.y, fragmentOfSlot: slotIndex,
      sourceRect: { ...geometry.sourceRect, x: geometry.width, width: lid.worldWidthPx - geometry.width } });
    if (geometry.sourceRect.y > 0) caps.push({ ...identity, x: geometry.x, y: -geometry.sourceRect.y, capOfSlot: slotIndex,
      sourceRect: { x: geometry.sourceRect.x, y: 0, width: geometry.sourceRect.width, height: geometry.sourceRect.y } });
  }
  return deepFreeze({ mode: 'NATIVE_RANCH_EXPANSION_PREVIEW', placements: [...bays, ...caps],
    bandOffsetPx: RANCH_ANNEX_BAND_OFFSET_NATIVE * unit, capPx: RANCH_UPPER_ROW_CAP_NATIVE * unit,
    widthPx: ringCount * 48 * unit, expansionBays: RANCH_EXPANSION_DECK_SLOTS, bayHeightPx: lid.worldHeightPx, nativePixelWorldScale: unit,
    // A few bays carry a lock: enough to read as locked, not a wall of icons.
    lockedBays: Object.freeze([2, 6, 5]) });
}

/** The art plan for whichever layout the ranch carries. */
export function createRanchCageArtPlan(options) {
  if(options?.layoutVersion===PRODUCT_RANCH_GRID&&(options.previewFieldId??null)===null)return createProductGridArtPlan(options);
  if (options?.layoutVersion !== RANCH_DECKS_LAYOUT || (options.previewFieldId ?? null) !== null) return createRaisingCageArtPlan(options);
  return composeRanchArtPlan(options);
}



/** Product-authored continuous five-row area, not a ROM geometry claim.
 * Uses the authoritative cell adapter; visual copies never add build slots. */
export function createProductGridArtPlan({manifest,placements,unlockedSlots=null}) {
  if(manifest?.family!=="CAGE"||!Array.isArray(manifest.fields))fail("CAGE_MANIFEST_REQUIRED");
  if(!Array.isArray(placements)||!placements.length)fail("PLACEMENTS_REQUIRED");
  if(!validateProductRanch(placements))fail("PRODUCT_GRID_LAYOUT_INVALID");
  const fields=new Map(manifest.fields.map(field=>[field.fieldId,field]));
  const occupied=new Set(),modules=new Set();
  for(const placement of placements){
    const cells=productPlacementCells(placement);
    if(!Array.isArray(cells)||!cells.length||modules.has(placement.moduleId))fail("PRODUCT_GRID_LAYOUT_INVALID");
    modules.add(placement.moduleId);
    for(const cell of cells){if(occupied.has(cell))fail("PRODUCT_GRID_OCCUPANCY_OVERLAP");occupied.add(cell);}
  }
  if(unlockedSlots!==null&&(!Array.isArray(unlockedSlots)||unlockedSlots.some(slot=>!Number.isInteger(slot)||slot<0||slot>=PRODUCT_RANCH_SLOT_COUNT)))fail("PRODUCT_GRID_ACCESS_INVALID");
  const available=new Set([...(unlockedSlots??[]),...occupied]);
  const lockedSlots=Array.from({length:PRODUCT_RANCH_SLOT_COUNT},(_,slot)=>slot).filter(slot=>!available.has(slot));
  const lid=fields.get(LID_FIELD_ID);
  if(!lid)fail("PRODUCT_GRID_LID_REQUIRED");
  const unit=lid.worldWidthPx/lid.nativeWidthPx,wrapWidthPx=PRODUCT_RANCH_WORLD_WIDTH*unit;
  const result=[];let residentViewport=null;
  const all=[...placements.map(p=>({...p,definition:getCageDefinitionByModuleId(p.moduleId)})),
    ...Array.from({length:PRODUCT_RANCH_SLOT_COUNT},(_,slotIndex)=>slotIndex).filter(slot=>!occupied.has(slot))
      .map(slotIndex=>({slotIndex,moduleId:null,definition:null}))];
  all.sort((a,b)=>productGridCell(a.slotIndex).row-productGridCell(b.slotIndex).row||a.slotIndex-b.slotIndex);
  for(const p of all){
    const cell=productGridCell(p.slotIndex),definitionIndex=p.definition?.cageDefinitionIndex??null;
    const field=definitionIndex===null?lid:fields.get(getOriginalCageVisualBinding(definitionIndex)?.fieldId);
    if(!field)fail("PRODUCT_GRID_FIELD_REQUIRED");
    const shapeIndex=definitionIndex===null?SINGLE_CELL_SHAPE_INDEX:ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex];
    const origin=productFieldTileOrigin(p.slotIndex,shapeIndex);
    // Keep the original top contour above native y=0. This is art overhang,
    // not extra walkable cells or a displacement of the existing ground.
    const x=origin.tileX*8*unit,cropTop=0;
    const y=origin.tileY*8*unit;
    const width=Math.min(field.worldWidthPx,wrapWidthPx-x),height=field.worldHeightPx-cropTop;
    if(width<=0||height<=0)fail("PRODUCT_GRID_SOURCE_BOUNDS");
    const identity={moduleId:p.moduleId,cageDefinitionIndex:definitionIndex,
      ...(definitionIndex===null?{structuralRole:'LID'}:{})};
    result.push({slotIndex:p.slotIndex,fieldId:field.fieldId,worldWidthPx:field.worldWidthPx,worldHeightPx:field.worldHeightPx,
      ...identity,x,y,sourceRect:{x:0,y:cropTop,width,height}});
    if(width<field.worldWidthPx)result.push({fieldId:field.fieldId,...identity,x:0,y,fragmentOfSlot:p.slotIndex,
      sourceRect:{x:width,y:cropTop,width:field.worldWidthPx-width,height}});
    // Preserve the established resident/drop bounds independently of the art.
    if(definitionIndex===35){const inset=origin.cropTopTiles*8*unit;
      residentViewport={x,y:y+inset,width,height:height-inset};}
  }
  return deepFreeze({mode:'NATIVE_RANCH',placementEvidence:'PRODUCT_AUTHORED_CONTINUOUS_GRID50',wrapWidthPx,residentViewport,
    placements:result,productGrid:{columns:10,rows:5,worldWidthNative:PRODUCT_RANCH_WORLD_WIDTH,worldHeightNative:PRODUCT_RANCH_WORLD_HEIGHT,sizingHeightNative:192,lockedSlots}});
}

