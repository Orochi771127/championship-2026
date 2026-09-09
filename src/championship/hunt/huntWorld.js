// VS2 -- Hunt world construction.
//
// PRESERVED STRUCTURE
// -------------------
// The original Hunt field is a large modular 128x128 map traversed by a camera.
// That geometry is VERIFIED_BINARY and is preserved exactly: this module builds a
// real 128x128 FieldDefinition through the existing field kernel, so the frozen
// contract - fixed dimensions, sanitized attribute grid, bit 0 or out-of-bounds
// blocks, every other bit unresolved - validates the world before it can be used.
//
// PRODUCT-AUTHORED CONTENT
// ------------------------
// The terrain and object CONTENT is product-authored, because no original Hunt
// terrain data is available to this product and inventing a claim about it would
// be worse than admitting the gap. What is preserved is the shape of the thing: a
// world far larger than the viewport, a hidden logical grid, modular terrain,
// object placement, and camera traversal.
//
// Generation is seeded and deterministic, so the same gate is the same field on
// every device and in every test run.

import { createFieldDefinition } from "../field/fieldDefinition.js";
import { createFieldCollisionAdapter } from "../field/fieldCollision.js";
import { getFieldFamilyProfile } from "../../data/championship/r2/fields/fieldInventoryR2.js";
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };

export const HUNT_WORLD_TILES = 128;
export const HUNT_TILE_SIZE_PX = 16;
export const HUNT_CHUNK_SIZE_TILES = 16;
export const HUNT_WORLD_SPAN_PX = HUNT_WORLD_TILES * HUNT_TILE_SIZE_PX;

// The one ROM-verified blocking rule: attribute bit 0.
const BLOCKED = 0x01;
const OPEN = 0x00;

// Explicit prototype/replay fixture subset only. Normal beginHunt supplies a
// native entry candidate and branches before this seeded constructor executes.
// These first three non-egg records are not a claim about any Gate's roster.
const WILD_SPECIES = Object.freeze(
  speciesCatalog.records
    .filter((record) => record.generationIndex > 0)
    .slice(0, 3)
    .map((record) => `species-${String(record.recordIndex).padStart(3, "0")}`)
);

export const HUNT_WILD_COUNT = 6;

/** Deterministic 32-bit generator. Seeded per gate; never Math.random. */
function seededRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tileIndex(x, y) {
  return (y * HUNT_WORLD_TILES) + x;
}

/**
 * Stamp an elliptical blocked mass.
 *
 * Masses rather than per-tile noise, so blocked terrain reads as landmarks a
 * player can navigate around instead of static that makes the field unwalkable.
 */
function stampMass(values, centreX, centreY, radiusX, radiusY) {
  const minX = Math.max(0, Math.floor(centreX - radiusX));
  const maxX = Math.min(HUNT_WORLD_TILES - 1, Math.ceil(centreX + radiusX));
  const minY = Math.max(0, Math.floor(centreY - radiusY));
  const maxY = Math.min(HUNT_WORLD_TILES - 1, Math.ceil(centreY + radiusY));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - centreX) / radiusX;
      const dy = (y - centreY) / radiusY;
      if ((dx * dx) + (dy * dy) <= 1) values[tileIndex(x, y)] = BLOCKED;
    }
  }
}

function buildAttributeGrid(random) {
  const values = new Array(HUNT_WORLD_TILES * HUNT_WORLD_TILES).fill(OPEN);

  // A blocked rim. Out-of-bounds already blocks, so this is presentation as much
  // as collision: the player sees a world edge rather than an invisible wall.
  for (let i = 0; i < HUNT_WORLD_TILES; i += 1) {
    values[tileIndex(i, 0)] = BLOCKED;
    values[tileIndex(i, 1)] = BLOCKED;
    values[tileIndex(i, HUNT_WORLD_TILES - 1)] = BLOCKED;
    values[tileIndex(i, HUNT_WORLD_TILES - 2)] = BLOCKED;
    values[tileIndex(0, i)] = BLOCKED;
    values[tileIndex(1, i)] = BLOCKED;
    values[tileIndex(HUNT_WORLD_TILES - 1, i)] = BLOCKED;
    values[tileIndex(HUNT_WORLD_TILES - 2, i)] = BLOCKED;
  }

  const massCount = 26 + Math.floor(random() * 10);
  for (let i = 0; i < massCount; i += 1) {
    stampMass(
      values,
      6 + random() * (HUNT_WORLD_TILES - 12),
      6 + random() * (HUNT_WORLD_TILES - 12),
      2 + random() * 7,
      2 + random() * 7
    );
  }
  return values;
}

/**
 * Every tile reachable on foot from the spawn.
 *
 * Generation can strand a pocket behind a ring of masses. Wild creatures and
 * objects are placed only in the reachable region, so the field is always
 * explorable and nothing important sits somewhere the player cannot walk.
 */
function reachableTiles(values, startX, startY) {
  const reachable = new Uint8Array(values.length);
  const queue = [tileIndex(startX, startY)];
  reachable[queue[0]] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % HUNT_WORLD_TILES;
    const y = (index - x) / HUNT_WORLD_TILES;
    const neighbours = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= HUNT_WORLD_TILES || ny >= HUNT_WORLD_TILES) continue;
      const next = tileIndex(nx, ny);
      if (reachable[next] || values[next] === BLOCKED) continue;
      reachable[next] = 1;
      queue.push(next);
    }
  }
  return { reachable, count: queue.length, order: queue };
}

/** Clear a small open pocket so the spawn tile is never inside a mass. */
function clearSpawnPocket(values, centreX, centreY) {
  for (let y = centreY - 3; y <= centreY + 3; y += 1) {
    for (let x = centreX - 3; x <= centreX + 3; x += 1) {
      if (x < 2 || y < 2 || x >= HUNT_WORLD_TILES - 2 || y >= HUNT_WORLD_TILES - 2) continue;
      values[tileIndex(x, y)] = OPEN;
    }
  }
}

/** Reachability lookup used during placement, before the world object exists. */
function isReachableIn(reachable, x, y) {
  if (x < 0 || y < 0 || x >= HUNT_WORLD_TILES || y >= HUNT_WORLD_TILES) return false;
  return reachable[tileIndex(x, y)] === 1;
}

export function huntTileToWorldCentre(tileX, tileY) {
  return {
    x: (tileX * HUNT_TILE_SIZE_PX) + (HUNT_TILE_SIZE_PX / 2),
    y: (tileY * HUNT_TILE_SIZE_PX) + (HUNT_TILE_SIZE_PX / 2)
  };
}

/**
 * Build the world behind one gate.
 *
 * Returns the validated FieldDefinition, a collision adapter, deterministic
 * object placement, the spawn point, and the wild creature spawn list. It holds
 * no mutable runtime state: that belongs to the hunt runtime.
 */
export function createHuntWorld(gate, nativeEntry = null) {
  if (!gate || typeof gate.gateId !== "string" || !Number.isSafeInteger(gate.worldSeed)) {
    throw new TypeError("createHuntWorld requires a Championship gate with a world seed");
  }
  if (nativeEntry !== null) return createNativeEntryWorld(gate, nativeEntry);
  const random = seededRandom(gate.worldSeed);
  const values = buildAttributeGrid(random);

  const spawnTileX = HUNT_WORLD_TILES >> 1;
  const spawnTileY = HUNT_WORLD_TILES >> 1;
  clearSpawnPocket(values, spawnTileX, spawnTileY);

  const { reachable, count, order } = reachableTiles(values, spawnTileX, spawnTileY);

  const profile = getFieldFamilyProfile("HM");
  const definition = createFieldDefinition({
    schemaVersion: 2,
    fieldId: `championship:2026:r2:field:hm-${gate.gateId.split(":").pop()}`,
    family: "HM",
    collisionProfileId: profile.profileId,
    dimensions: { widthTiles: HUNT_WORLD_TILES, heightTiles: HUNT_WORLD_TILES },
    tileSizePx: HUNT_TILE_SIZE_PX,
    chunkSizeTiles: HUNT_CHUNK_SIZE_TILES,
    collisionData: { kind: "HM_SANITIZED_ATTRIBUTE_GRID", values }
  }, profile);

  const collision = createFieldCollisionAdapter(definition);

  // Objects are decoration over the collision truth, never a second collision
  // authority: a BLOCKER marks a tile the attribute grid already blocks.
  const objects = [];
  const objectCount = 90;
  for (let i = 0; i < objectCount; i += 1) {
    const tile = order[Math.floor(random() * order.length)];
    const x = tile % HUNT_WORLD_TILES;
    const y = (tile - x) / HUNT_WORLD_TILES;
    if (Math.abs(x - spawnTileX) < 4 && Math.abs(y - spawnTileY) < 4) continue;
    const centre = huntTileToWorldCentre(x, y);
    objects.push(Object.freeze({
      objectId: `${gate.gateId}:object:${String(i).padStart(3, "0")}`,
      kind: "SCENERY",
      tileX: x,
      tileY: y,
      worldX: centre.x,
      worldY: centre.y,
      art: Object.freeze({ sprite: null })
    }));
  }

  // Wild creatures are placed in widening bands around the spawn rather than
  // scattered anywhere in a 16,384-tile world. Uniform scattering is defensible
  // as a model and useless as a field: the camera shows roughly 24 x 49 tiles, so
  // a uniform spread means a player can walk for minutes without meeting
  // anything. Neither placement is evidenced, so this picks the one that makes
  // the slice legible. Distance from spawn is the only thing being tuned; nothing
  // here reacts to the player.
  const wildCreatures = [];
  for (let i = 0; i < HUNT_WILD_COUNT; i += 1) {
    const bandTiles = 9 + (i * 6);
    const angle = (i * 2.399963) + (random() * 0.9);
    let placed = null;
    for (let attempt = 0; attempt < 40 && !placed; attempt += 1) {
      const radius = bandTiles + (attempt * 1.5);
      const x = Math.round(spawnTileX + (Math.cos(angle) * radius));
      const y = Math.round(spawnTileY + (Math.sin(angle) * radius));
      if (isReachableIn(reachable, x, y)) placed = { x, y };
    }
    if (!placed) {
      const fallback = order[Math.floor(random() * order.length)];
      placed = { x: fallback % HUNT_WORLD_TILES, y: (fallback - (fallback % HUNT_WORLD_TILES)) / HUNT_WORLD_TILES };
    }
    const centre = huntTileToWorldCentre(placed.x, placed.y);
    wildCreatures.push(Object.freeze({
      wildId: `${gate.gateId}:wild:${String(i).padStart(2, "0")}`,
      speciesId: WILD_SPECIES[i % WILD_SPECIES.length],
      tileX: placed.x,
      tileY: placed.y,
      worldX: centre.x,
      worldY: centre.y,
      wanderSeed: (gate.worldSeed * 31 + i * 2654435761) >>> 0
    }));
  }

  return Object.freeze({
    gateId: gate.gateId,
    definition,
    collision,
    widthTiles: HUNT_WORLD_TILES,
    heightTiles: HUNT_WORLD_TILES,
    tileSizePx: HUNT_TILE_SIZE_PX,
    chunkSizeTiles: HUNT_CHUNK_SIZE_TILES,
    worldWidthPx: HUNT_WORLD_SPAN_PX,
    worldHeightPx: HUNT_WORLD_SPAN_PX,
    spawn: Object.freeze({ tileX: spawnTileX, tileY: spawnTileY, ...huntTileToWorldCentre(spawnTileX, spawnTileY) }),
    objects: Object.freeze(objects),
    wildCreatures: Object.freeze(wildCreatures),
    reachableTileCount: count,
    isBlockedTile(x, y) {
      if (x < 0 || y < 0 || x >= HUNT_WORLD_TILES || y >= HUNT_WORLD_TILES) return true;
      return values[tileIndex(x, y)] === BLOCKED;
    },
    isReachableTile(x, y) {
      if (x < 0 || y < 0 || x >= HUNT_WORLD_TILES || y >= HUNT_WORLD_TILES) return false;
      return reachable[tileIndex(x, y)] === 1;
    }
  });
}

// The same field kernel receives native initial blocking semantics. Normal
// entry supplies this candidate; the seeded constructor is a test/replay fixture.
function createNativeEntryWorld(gate, entry) {
  const { scene, encounter } = entry;
  const env = scene.environment;
  if (scene.biomeId !== gate.biomeId || env.width !== 128 || env.height !== 128
    || !encounter.actors.length) throw Error("HUNT_WORLD_NATIVE_ENTRY_INVALID");
  const values = Array.from({ length:env.width * env.height }, (_,i) =>
    env.isBlocked(i % env.width, Math.floor(i / env.width)) ? BLOCKED : OPEN);
  const profile = getFieldFamilyProfile("HM");
  const definition = createFieldDefinition({ schemaVersion:2,
    fieldId:`championship:2026:r2:field:hm-${gate.gateId.split(":").pop()}`,
    family:"HM", collisionProfileId:profile.profileId,
    dimensions:{ widthTiles:env.width, heightTiles:env.height }, tileSizePx:HUNT_TILE_SIZE_PX,
    chunkSizeTiles:HUNT_CHUNK_SIZE_TILES, collisionData:{ kind:"HM_SANITIZED_ATTRIBUTE_GRID", values }
  }, profile);
  // Retain the existing product camera centre; never alter native actor positions
  // to fit the viewport or apply prototype reachability filtering to them.
  return Object.freeze({ gateId:gate.gateId, definition, collision:createFieldCollisionAdapter(definition),
    nativeEntry:true, nativeHuntIndex:scene.nativeHuntIndex, artFieldId:scene.fieldId,
    widthTiles:env.width, heightTiles:env.height, tileSizePx:HUNT_TILE_SIZE_PX,
    chunkSizeTiles:HUNT_CHUNK_SIZE_TILES, worldWidthPx:env.width * HUNT_TILE_SIZE_PX,
    worldHeightPx:env.height * HUNT_TILE_SIZE_PX,
    spawn:Object.freeze({ tileX:64, tileY:64, ...huntTileToWorldCentre(64,64) }),
    objects:Object.freeze([]),
    wildCreatures:Object.freeze(encounter.actors.map((actor,i) => Object.freeze({
      wildId:`${gate.gateId}:native-wild:${i}`, speciesId:`species-${String(actor.speciesIndex).padStart(3,"0")}`,
      worldX:actor.positionQ12[0] / 2048, worldY:actor.positionQ12[1] / 2048,
      facing:actor.facing, currentHp:actor.individual.fields["050"], maxHp:actor.individual.fields["058"]
    }))),
    isBlockedTile:env.isBlocked
  });
}
