// OVL0 0210B5E4 / 0210B924 / 0210C408. Position initialization only:
// individual stats, AI initialization and later same-species grouping have
// separate callers. No ROM grid, fixed encounter, seed or replay is embedded.

function positive(n, name, max) {
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new TypeError(`NATIVE_SPAWN_${name}_REQUIRED`);
}

// Consume channel 0, then B2 when even or B3 when odd. The signed multiply
// helper divides by 102; this is not random % range or a uniform JS draw.
export function rollNativeHuntRange(rng, range) {
  positive(range, "RANGE", 32767);
  if (typeof rng?.next !== "function") throw new TypeError("NATIVE_SPAWN_RNG_REQUIRED");
  const parity = rng.next(0);
  if (!Number.isInteger(parity) || parity < 0 || parity > 102) throw new RangeError("NATIVE_SPAWN_RNG_VALUE_REQUIRED");
  const value = rng.next(parity % 2 === 0 ? 0xB2 : 0xB3);
  if (!Number.isInteger(value) || value < 0 || value > 102) throw new RangeError("NATIVE_SPAWN_RNG_VALUE_REQUIRED");
  return Math.trunc(((range - 1) * value) / 102);
}

// This is the native eight-ray search, radius 0..50 in a fixed order. It is
// neither flood fill nor a nearest-cell search. Negative-side candidates
// require >0; positive-side tests are unsigned. Radius 0 returns unchanged.
export function repairNativeHuntSpawnTile(tile, terrain) {
  if (!Array.isArray(tile) || tile.length !== 2
    || tile.some((n) => !Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff)) {
    throw new TypeError("NATIVE_SPAWN_TILE_REQUIRED");
  }
  positive(terrain?.width, "WIDTH", 256); positive(terrain?.height, "HEIGHT", 256);
  if (typeof terrain.isBlocked !== "function") throw new TypeError("NATIVE_SPAWN_TERRAIN_REQUIRED");
  const [x, y] = tile;
  for (let radius = 0; radius <= 50; radius++) {
    const right = x + radius, left = x - radius, down = y + radius, up = y - radius;
    const rightIn = (right >>> 0) < terrain.width, downIn = (down >>> 0) < terrain.height;
    const candidates = [
      [rightIn, right, y], [left > 0, left, y],
      [downIn, x, down], [up > 0, x, up],
      [rightIn && downIn, right, down], [rightIn && up > 0, right, up],
      [left > 0 && downIn, left, down], [left > 0 && up > 0, left, up],
    ];
    for (const [eligible, cx, cy] of candidates) {
      if (!eligible) continue;
      const blocked = terrain.isBlocked(cx, cy);
      if (blocked !== true && blocked !== false) throw new TypeError("NATIVE_SPAWN_BLOCKED_BOOLEAN_REQUIRED");
      if (!blocked) return { radius, tile: radius === 0 ? [...tile] : [cx, cy] };
    }
  }
  // Original returns zero without changing the supplied coordinates on failure.
  return { radius: 0, tile: [...tile] };
}

export function initializeNativeHuntPosition({ rng, widthPixels, heightPixels, terrain } = {}) {
  positive(widthPixels, "WIDTH_PIXELS", 2048); positive(heightPixels, "HEIGHT_PIXELS", 2048);
  if (terrain?.width * 8 !== widthPixels || terrain?.height * 8 !== heightPixels
    || typeof terrain.isBlocked !== "function") throw new TypeError("NATIVE_SPAWN_MATCHING_TERRAIN_REQUIRED");
  const facing = rollNativeHuntRange(rng, 32767) % 2;
  // Preserve the first draw of each axis even though the following branches
  // both consume another range draw. Dropping it changes all later RNG users.
  rollNativeHuntRange(rng, heightPixels);
  const y = rollNativeHuntRange(rng, heightPixels);
  rollNativeHuntRange(rng, widthPixels);
  const x = rollNativeHuntRange(rng, widthPixels);
  const repair = repairNativeHuntSpawnTile([Math.trunc(x / 8), Math.trunc(y / 8)], terrain);
  const position = repair.radius ? repair.tile.map((n) => n * 8 + 4) : [x, y];
  return { facing, positionQ12: [...position.map((n) => n * 4096), 0], repair };
}
