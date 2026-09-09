// Cage Edit coordinates and Training composition are separate coordinate spaces.
// R2 proof: docs/contracts/championship/CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json.
// Original ARM placement (OVL15 0x0210C118) and field tile origins (ARM9
// 0x020827B0) were executed against synthetic records. The board is now traced;
// layoutRanchTiles remains a legacy shelf pack until source cropping, wrapping,
// special fields, actor transforms and existing-save compatibility are closed.
// Original cages have multi-cell shape masks, not one cell per cage.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { MAX_SLOT_COUNT } from "./cageCatalog.js";

/** ROM_VERIFIED: cage_edit_obj_main.nxr. */
export const RANCH_COVER_NODES = deepFreeze([
  { node: "cover3", x: 170, y: 8 },
  { node: "cover2", x: 194, y: 8 },
  { node: "cover1", x: 218, y: 8 }
]);
export const RANCH_COVER_PITCH_PX = 24;
export const RANCH_COVER_EVIDENCE = "ROM_VERIFIED";

/** Each cover hides two slots: three covers span the six unlockable slots. */
export const SLOTS_PER_COVER = 2;
export const SLOTS_PER_COVER_EVIDENCE = "VERIFIED_BINARY";

/** OVL15 0x0210C150..0x0210C17C; caller limits columns to 0..9. */
export const BOARD_ROWS = 2;
export const BOARD_COLUMNS = MAX_SLOT_COUNT / BOARD_ROWS;
export const BOARD_ARRANGEMENT_EVIDENCE = "VERIFIED_BINARY_NATIVE_REPLAY";

/**
 * Board cell for a slot, in the Cage Edit board's own 256x192 coordinates.
 *
 * Column-major so that unlocking two more slots reveals one more column, which
 * is what a cover hiding two slots implies.
 */
export function ranchBoardCell(slotIndex) {
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOT_COUNT) {
    throw new RangeError(`RANCH_SLOT_OUT_OF_RANGE: ${slotIndex}`);
  }
  const column = Math.floor(slotIndex / BOARD_ROWS);
  const row = slotIndex % BOARD_ROWS;
  return deepFreeze({
    slotIndex,
    column,
    row,
    // The lower ROW moves right by 12; alternating columns do not move down.
    x: 2 + (column * 24) + (row * 12),
    y: 8 + (row * 22),
    hiddenByCover: column >= BOARD_COLUMNS - RANCH_COVER_NODES.length
  });
}

/** Which cover hides a slot, or null when the slot is always visible. */
export function ranchCoverForSlot(slotIndex) {
  const cell = ranchBoardCell(slotIndex);
  if (!cell.hiddenByCover) return null;
  return RANCH_COVER_NODES[cell.column - (BOARD_COLUMNS - RANCH_COVER_NODES.length)] ?? null;
}

/** OVL15 0x0210DB40; same bytes read by the ARM9 field origin consumer. */
export const ORIGINAL_CAGE_SHAPE_MASKS = Object.freeze([
  1, 5, 3, 6, 21, 14, 7, 13, 11, 26, 15, 30, 27, 90, 85, 31
]);

/** ARM9 0x020C8CBC, stride 40; includes Waiting Room at definition 35.
 * Its special fixed presentation is not an ordinary user-placed cage.
 */
export const ORIGINAL_CAGE_DEFINITION_SHAPES = Object.freeze([
  0, 6, 15, 4, 11, 13, 10, 8, 12, 12, 9, 7, 6, 7, 8, 0, 5, 3,
  14, 7, 11, 6, 2, 0, 1, 11, 5, 0, 1, 0, 0, 0, 0, 0, 0, 10
]);

function shapeMask(shapeIndex) {
  if (!Number.isSafeInteger(shapeIndex) || shapeIndex < 0 || shapeIndex >= ORIGINAL_CAGE_SHAPE_MASKS.length) {
    throw new RangeError(`RANCH_SHAPE_OUT_OF_RANGE: ${shapeIndex}`);
  }
  return ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex];
}

/** Pure port of OVL15 0x0210C118. The caller supplies ALL occupied/locked bits.
 * This does not mutate the editor or migrate legacy saves. The original caller
 * also normalizes row eligibility, reserves fixed cells and handles rollback.
 */
export function evaluateOriginalCagePlacement({ shapeIndex, slotIndex, occupiedMask }) {
  const mask = shapeMask(shapeIndex);
  const cell = ranchBoardCell(slotIndex);
  if (!Number.isSafeInteger(occupiedMask) || occupiedMask < 0 || occupiedMask > 0xffffffff) {
    throw new RangeError("RANCH_OCCUPIED_MASK_INVALID");
  }
  if ((mask & (occupiedMask >>> slotIndex)) !== 0) {
    return deepFreeze({ ok: false, occupiedMask, xFixed: null, yFixed: null });
  }
  return deepFreeze({ ok: true, occupiedMask: (occupiedMask | (mask << slotIndex)) >>> 0,
    xFixed: cell.x * 4096, yFixed: cell.y * 4096 });
}

/** ARM9 0x020827B0..0x020827F4. Coordinates are destination TILE indices,
 * not art sprite/world origins. Do not feed these into layoutRanchTiles.
 * Upper-row source cropping and horizontal wrap require the full compositor.
 */
export function originalRanchFieldTileOrigin(slotIndex, shapeIndex) {
  const mask = shapeMask(shapeIndex);
  const { column, row } = ranchBoardCell(slotIndex);
  return deepFreeze({ tileX: column * 12 + row * 6 + ((mask & 1) ? 0 : 6),
    tileY: row * 8, coordinateSpace: "ORIGINAL_FIELD_DESTINATION_TILES",
    evidence: "VERIFIED_BINARY_NATIVE_REPLAY" });
}

/**
 * Lay the Training field out: real tile sizes, packed edge to edge.
 *
 * PRODUCT_AUTHORED. The original's field placement is untraced, and the tiles
 * are nine different sizes, so this is a deterministic shelf pack rather than a
 * grid: fill a row left to right until the next tile will not fit, then start a
 * new row below the tallest tile so far. Deterministic because it is driven by
 * slot order alone -- the same ranch lays out the same way on every device.
 *
 * Positions are integers. The tiles are hard-edged with no partial alpha, so a
 * fractional position resamples an edge and shows as a seam.
 *
 * @param {Array<{slotIndex:number, fieldId:string, worldWidthPx:number, worldHeightPx:number}>} tiles
 * @param {{maxRowWidthPx?:number}} [options]
 */
export function layoutRanchTiles(tiles, { maxRowWidthPx = 1536 } = {}) {
  if (!Array.isArray(tiles)) throw new TypeError("layoutRanchTiles requires an array of tiles");
  const ordered = [...tiles].sort((a, b) => a.slotIndex - b.slotIndex);

  const placed = [];
  let cursorX = 0;
  let rowTop = 0;
  let rowHeight = 0;

  for (const tile of ordered) {
    const width = Math.round(tile.worldWidthPx);
    const height = Math.round(tile.worldHeightPx);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError(`RANCH_TILE_SIZE_INVALID: ${tile.fieldId}`);
    }
    if (cursorX > 0 && cursorX + width > maxRowWidthPx) {
      rowTop += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }
    placed.push(deepFreeze({
      slotIndex: tile.slotIndex,
      fieldId: tile.fieldId,
      x: cursorX,
      y: rowTop,
      widthPx: width,
      heightPx: height
    }));
    cursorX += width;
    if (height > rowHeight) rowHeight = height;
  }

  const widthPx = placed.reduce((widest, tile) => Math.max(widest, tile.x + tile.widthPx), 0);
  const heightPx = placed.reduce((tallest, tile) => Math.max(tallest, tile.y + tile.heightPx), 0);
  return deepFreeze({ tiles: deepFreeze(placed), widthPx, heightPx, evidence: "PRODUCT_AUTHORED" });
}
