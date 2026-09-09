// Pure port of three ARM9 copy loops. See CHAMPIONSHIP_RANCH_TILE_COMPOSITION.
// This owns no renderer, map assets, collision semantics, app state or save.
import { originalRanchFieldTileOrigin, ranchBoardCell } from "./ranchSlotGeometry.js";

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`RANCH_COMPOSITION_${label}`);
  return value;
}

function sourcePlane(values, length, max, label) {
  if ((!Array.isArray(values) && !ArrayBuffer.isView(values)) || values.length !== length) {
    throw new TypeError(`RANCH_COMPOSITION_${label}_LENGTH`);
  }
  for (const value of values) integer(value, 0, max, label);
}

/** Compose packed tile IDs plus raw metadata, using explicit external inputs.
 * All results are newly allocated. Source arrays and previous app state are
 * never mutated. Invalid input refuses the entire operation, not a partial map.
 * The native startup values are tile=0, attribute=1, collision=0, owner=-1.
 * No semantic meaning is assigned to the raw attribute/collision bytes here.
 */
export function composeOriginalRanchTilePlanes({ width, steps, initial = {} }) {
  if (![84, 96, 108, 120].includes(width)) throw new RangeError("RANCH_COMPOSITION_WIDTH");
  if (!Array.isArray(steps)) throw new TypeError("RANCH_COMPOSITION_STEPS");
  const height = 24;
  const seed = { tiles: 0, attributes: 1, collision: 0, owners: -1, ...initial };
  integer(seed.tiles, 0, 0xffff, "INITIAL_TILE");
  integer(seed.attributes, 0, 255, "INITIAL_ATTRIBUTE");
  integer(seed.collision, 0, 255, "INITIAL_COLLISION");
  integer(seed.owners, -1, 0x7fffffff, "INITIAL_OWNER");
  const prepared = steps.map((step) => {
    if (!step || !["ordinary", "filler", "wall"].includes(step.mode)) throw new TypeError("RANCH_COMPOSITION_MODE");
    const source = step.source;
    if (!source) throw new TypeError("RANCH_COMPOSITION_SOURCE");
    const sw = integer(source.width, 1, width, "SOURCE_WIDTH");
    const sh = integer(source.height, 1, 27, "SOURCE_HEIGHT");
    sourcePlane(source.tiles, sw * sh, 0xffff, "SOURCE_TILE");
    const tileBase = integer(step.tileBase, 0, 0xffff, "TILE_BASE");
    if (step.mode === "wall") {
      if (sw > 12 || sh > 5) throw new RangeError("RANCH_COMPOSITION_WALL_BOUNDS");
      return { ...step, source, sw, sh, tileBase };
    }
    sourcePlane(source.attributes, sw * sh, 255, "SOURCE_ATTRIBUTE");
    sourcePlane(source.collision, sw * sh, 255, "SOURCE_COLLISION");
    integer(step.definitionIndex, 0, 36, "DEFINITION");
    const { row, column } = ranchBoardCell(step.anchor);
    let x = column * 12 + row * 6;
    if (step.mode === "ordinary") x = originalRanchFieldTileOrigin(step.anchor, step.shapeIndex).tileX;
    const sourceRow = row === 0 ? 3 : 0;
    if (sh < sourceRow) throw new RangeError("RANCH_COMPOSITION_SOURCE_CROP");
    const base = row * 8 * width + x;
    // The original valid caller fits these records inside its allocation.
    // Fail instead of allowing malformed inputs to silently write out of range.
    if (base + Math.max(0, sh-sourceRow-1)*width + sw-1 >= width*height) {
      const last = base + Math.max(0, sh-sourceRow-1)*width + sw-1;
      const wraps = base % width + sw-1 >= width;
      if (last - (wraps ? width : 0) >= width*height) throw new RangeError("RANCH_COMPOSITION_DESTINATION_BOUNDS");
    }
    return { ...step, source, sw, sh, tileBase, base, sourceRow };
  });
  const size = width * height;
  const tiles = new Uint16Array(size).fill(seed.tiles);
  const attributes = new Uint8Array(size).fill(seed.attributes);
  const collision = new Uint8Array(size).fill(seed.collision);
  const owners = new Int32Array(size).fill(seed.owners);
  for (const step of prepared) {
    const { source, sw, sh, tileBase } = step;
    if (step.mode === "wall") {
      for (let column = 0; column < width; column += 12) {
        for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
          const raw = source.tiles[y*sw+x];
          if (raw !== 0) tiles[(19+y)*width+column+x] = (tileBase+raw) & 0xffff;
        }
      }
      continue;
    }
    const { base, sourceRow } = step;
    for (let sourceY = sourceRow; sourceY < sh; sourceY += 1) {
      for (let x = 0; x < sw; x += 1) {
        const si = sourceY * sw + x;
        let di = base + (sourceY-sourceRow)*width+x;
        if (base % width + x >= width) di -= width;
        const tile = (source.tiles[si] + tileBase) & 0xffff;
        const rawAttribute = source.attributes[si];
        if (step.mode === "filler") {
          if (tile === tileBase) continue;
          tiles[di] = tile;
          if ((rawAttribute & 1) === 0) { attributes[di] = 0; owners[di] = step.definitionIndex; }
        } else {
          if (tile === tileBase && (rawAttribute & 1) !== 0) continue;
          if (tile !== tileBase) tiles[di] = tile;
          if (rawAttribute !== 1) { attributes[di] = rawAttribute; owners[di] = step.definitionIndex; }
        }
        if (source.collision[si] !== 0) collision[di] = source.collision[si];
      }
    }
  }
  return Object.freeze({ width, height, tiles, attributes, collision, owners,
    evidence: "VERIFIED_BINARY_NATIVE_REPLAY", coordinateSpace: "ORIGINAL_FIELD_DESTINATION_TILES" });
}
