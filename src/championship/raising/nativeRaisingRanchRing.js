// The field ring with the ranch expansion prototype's annex (2026-10-05).
//
// nativeRaisingGround.js composes the original board and is hash-locked by the
// cage authoring contract, so it is not edited. A ranch without the prototype
// grant goes straight to it. A ranch with the annex needs the same composition
// over a ring longer than twenty slots, which the original helpers refuse (they
// range-check the board slot), so this module repeats the composition and the
// spawn sampler with ring-slot origins. Tests replay both repeats over every
// original layout and require identical results, so the two cannot drift.

import source from "../../data/championship/catalogs/raising-ground.r1.json" with { type: "json" };
import { ORIGINAL_CAGE_DEFINITION_SHAPES } from "../cage/ranchSlotGeometry.js";
import { getCageDefinitionByModuleId } from "../cage/cageCatalog.js";
import { RANCH_DECKS_LAYOUT, ranchRing, ringFieldTileOrigin, validateRanchLayout } from "../cage/ranchExpansion.js";
import { createNativeRaisingGround, findNativeRaisingOpenTile, nativeRaisingEntryPosition, nativeRaisingSpawnPosition } from "./nativeRaisingGround.js";

import { PRODUCT_RANCH_GRID, PRODUCT_RANCH_WORLD_WIDTH, PRODUCT_RANCH_WORLD_HEIGHT,
  productFieldTileOrigin, productPlacementCells, productUnlockedSlots, validateProductRanch } from '../cage/productRanchGrid.js';

import { reviewGroundField,parseRaisingGroundField } from "./raisingGroundReview.js";
import sportsGround from '../../data/championship/catalogs/ranch-sports-ground.r1.json' with {type:'json'};
import { connectRanchGround } from "../cage/ranchConnections.js";
const fields = source.fields.map((field) => {
  const cells = field.runs.flatMap(([count, ...v]) => Array.from({ length: count }, () => v));
  const clearance = field.clearanceRuns.flatMap(([count, v]) => Array(count).fill(v));
  if (cells.length !== field.width * field.height || clearance.length !== cells.length) throw new Error("INVALID_RAISING_GROUND_SOURCE");
  return { ...field, cells, clearance };
});
const selectedSportsGround=new Map(sportsGround.fields.map(f=>[f.definitionIndex,parseRaisingGroundField(f)]));

/** 020502D8's origin for a ring slot. */
export function ringCageOrigin(definitionIndex, ringSlot) {
  const p = ringFieldTileOrigin(ringSlot, ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex]);
  return [p.tileX * 8, p.tileY * 8 - (ringSlot % 2 === 0 ? 24 : 0), 0];
}

/** The original composition loop, over ranchRing()'s placements and empty bays. */
export function composeRanchRingGround(ring) {
  const width = ring.ringCount * 6, height = 24, size = width * height;
  const terrain = new Uint8Array(size).fill(1), clearance = new Uint8Array(size), owners = new Int16Array(size).fill(-1);
  const placements = ring.placements.map((p) => ({ ...p, definitionIndex: getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex }));
  const steps = [...placements, ...ring.uncovered.map((slotIndex) => ({ definitionIndex: 36, slotIndex }))];
  for (const p of steps) {
    const f = reviewGroundField(p.definitionIndex) ?? fields[p.definitionIndex], row = p.slotIndex % 2, col = Math.floor(p.slotIndex / 2);
    const x = p.definitionIndex === 36 ? col * 12 + row * 6 : ringFieldTileOrigin(p.slotIndex, ORIGINAL_CAGE_DEFINITION_SHAPES[p.definitionIndex]).tileX;
    const y = row * 8, crop = row === 0 ? 3 : 0;
    for (let sy = crop; sy < f.height; sy++) for (let sx = 0; sx < f.width; sx++) {
      const i = (y + sy - crop) * width + ((x + sx) % width), [owner, type, distance] = f.cells[sy * f.width + sx];
      if (i >= size) throw new Error("RAISING_NATIVE_GROUND_BOUNDS");
      if (owner) { owners[i] = p.definitionIndex; terrain[i] = type; }
      if (distance) clearance[i] = distance;
    }
  }
  const map = new Map(placements.map((p) => [p.definitionIndex, p]));
  const read = (values, x, y, fallback) => x < 0 || y < 0 || x >= width || y >= height ? fallback : values[y * width + x];
  const wrap = (n, n2) => ((n % n2) + n2) % n2;
  return Object.freeze({ width, height, pixelWidth: width * 8, placements, terrain, clearance, owners,
    // Where the annex columns begin on the ring, in native pixels.
    ...(ring.annexStart !== null ? { annexStartPixel: ring.annexStart * 48 } : {}),
    readTerrain: (x, y) => terrain[wrap(y, height) * width + wrap(x, width)], readClearance: (x, y) => read(clearance, x, y, 0),
    cageAt(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || y < 0 || y >= 192) return null;
      const tx = Math.trunc((((Math.trunc(x) % (width * 8)) + width * 8) % (width * 8)) / 8), ty = Math.trunc(y / 8);
      return map.get(read(owners, tx, ty, -1)) ?? null;
    },
    placement: (definition) => map.get(definition) ?? null,
    origin: (definition) => { const p = map.get(definition); return p ? ringCageOrigin(definition, p.slotIndex) : null; }
  });
}

/** The raising ground for any ranch: the original board, or the ring with its annex. */
export function createRanchRaisingGround(frame) {
  if (frame?.layoutVersion === PRODUCT_RANCH_GRID) return composeProductRanchGround(frame);
  if (frame?.layoutVersion !== RANCH_DECKS_LAYOUT) return createNativeRaisingGround(frame);
  if (![14, 16, 18, 20].includes(frame.unlockedCount) || !validateRanchLayout(frame.placements, {
    layoutVersion: frame.layoutVersion, mainUnlocked: frame.unlockedCount, expansion: frame.expansion ?? null })) {
    throw new Error("INVALID_RAISING_NATIVE_RANCH");
  }
  return composeRanchRingGround(ranchRing(frame));
}

/** 020500BC's sampler with ring-slot origins (repeat of nativeRaisingSpawnPosition). */
export function ringRaisingSpawnPosition(ground, definition, rng) {
  const p = ground.placement(definition), f = reviewGroundField(definition) ?? fields[definition];
  if (!p || !f || typeof rng?.next !== "function") throw new TypeError("NATIVE_RAISING_SPAWN_CONTEXT_REQUIRED");
  const origin = ringFieldTileOrigin(p.slotIndex, ORIGINAL_CAGE_DEFINITION_SHAPES[definition]);
  const max = f.width * f.height - 1;
  let threshold = [0, 15, 23, 27, 29, 30, 31, 32, 33, 34].includes(definition) ? 1 : 2, rejections = 0;
  for (let guard = 0; guard < 100000; guard++) {
    const index = Math.trunc(max * rng.next(1) / 102);
    if (f.clearance[index] > threshold && (p.slotIndex % 2 !== 0 || index > f.width * 3))
      return [(index % f.width + origin.tileX) * 8 * 4096 + 16384, (Math.floor(index / f.width) + origin.tileY) * 8 * 4096 + 16384, 0];
    rng.next(1); if (++rejections > max) { rejections = 0; if (threshold > 0) threshold--; }
  }
  throw new Error("NATIVE_RAISING_SPAWN_RNG_EXHAUSTED");
}

export function ranchRaisingSpawnPosition(ground, definition, rng) {
  if (ground?.layoutVersion === PRODUCT_RANCH_GRID) return productRaisingSpawnPosition(ground, definition, rng);
  return ground?.annexStartPixel === undefined ? nativeRaisingSpawnPosition(ground, definition, rng) : ringRaisingSpawnPosition(ground, definition, rng);
}

/** nativeRaisingEntryPosition over the ring (repeat, with the ring sampler). */
export function ranchRaisingEntryPosition(ground, definition, rng, poolSlot) {
  if (ground?.layoutVersion === PRODUCT_RANCH_GRID) return productRaisingSpawnPosition(ground, definition, rng);
  if (ground?.annexStartPixel === undefined) return nativeRaisingEntryPosition(ground, definition, rng, poolSlot);
  const position = ringRaisingSpawnPosition(ground, definition, rng);
  const x = Math.trunc((position[0] >> 12) / 8), y = Math.trunc((position[1] >> 12) / 8);
  if (ground.readTerrain(x, y) !== 1) return position;
  const tile = findNativeRaisingOpenTile(ground, x, y, { centralBand: true, rng, poolSlot });
  return tile.distance > 0 ? [tile.x * 32768, tile.y * 32768, position[2]] : position;
}

// Product adaptation: source terrain stays unscaled and shares the exact art
// origin. Native tables and their original twenty-slot composer are untouched.
export function composeProductRanchGround(frame) {
  const unlocked = frame.unlockedSlots ?? productUnlockedSlots(frame.gridAccess, frame.mainUnlockedCount ?? frame.unlockedCount, frame.testAccessOverride);
  if (!validateProductRanch(frame.placements, unlocked)) throw new Error('INVALID_PRODUCT_RAISING_RANCH');
  const width = PRODUCT_RANCH_WORLD_WIDTH / 8, height = PRODUCT_RANCH_WORLD_HEIGHT / 8;
  const terrain = new Uint8Array(width * height).fill(1), clearance = new Uint8Array(width * height);
  const owners = new Int16Array(width * height).fill(-1);
  const placements = frame.placements.map((p,ownerIndex)=>({...p,ownerIndex,definitionIndex:getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex}));
  const occupied = new Set(placements.flatMap(productPlacementCells));
  const steps = [...placements, ...unlocked.filter(slot=>!occupied.has(slot)).map(slotIndex=>({slotIndex,definitionIndex:36}))];
  const wrap = n=>((n % width)+width)%width;
  for (const p of steps) {
    const field = reviewGroundField(p.definitionIndex) ?? selectedSportsGround.get(p.definitionIndex) ?? fields[p.definitionIndex];
    const origin = productFieldTileOrigin(p.slotIndex, p.definitionIndex === 36 ? 0 : ORIGINAL_CAGE_DEFINITION_SHAPES[p.definitionIndex]);
    for (let sy=origin.cropTopTiles; sy<field.height; sy++) for (let sx=0; sx<field.width; sx++) {
      const y=origin.tileY+sy;
      if (y<0 || y>=height) continue;
      const [owner,type,distance]=field.cells[sy*field.width+sx], index=y*width+wrap(origin.tileX+sx);
      if (owner) { owners[index]=p.ownerIndex??-1; terrain[index]=type; }
      if (distance) clearance[index]=distance;
    }
  }
  const map = new Map(placements.map(p=>[p.ownerIndex,p]));
  const byInstance=new Map(placements.map(p=>[p.instanceId,p]));
  const placement=reference=>typeof reference==='string'?byInstance.get(reference)??null:placements.find(p=>p.definitionIndex===reference)??null;
  const read = (values,x,y,fallback)=>!Number.isInteger(x)||!Number.isInteger(y)||y<0||y>=height ? fallback : values[y*width+wrap(x)];
  return Object.freeze(connectRanchGround({layoutVersion:PRODUCT_RANCH_GRID,width,height,pixelWidth:width*8,pixelHeight:height*8,
    placements,terrain,clearance,owners,
    readTerrain:(x,y)=>read(terrain,x,y,1), readClearance:(x,y)=>read(clearance,x,y,0),
    cageAt:(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?map.get(read(owners,Math.floor(x/8),Math.floor(y/8),-1))??null:null,
    placement,
    origin:reference=>{const p=placement(reference);if(!p)return null;
      const o=productFieldTileOrigin(p.slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[p.definitionIndex]);return [o.tileX*8,o.tileY*8,0];}
  }));
}

function productRaisingSpawnPosition(ground,definition,rng) {
  const p=ground.placement(definition), field=reviewGroundField(p?.definitionIndex) ?? fields[p?.definitionIndex];
  if(!p||!field||typeof rng?.next!=='function')throw new TypeError('NATIVE_RAISING_SPAWN_CONTEXT_REQUIRED');
  const candidates=[];
  for(let y=0;y<ground.height;y++)for(let x=0;x<ground.width;x++){
    if(ground.readClearance(x,y)>1 && ground.readTerrain(x,y)!==1 && ground.cageAt(x*8,y*8)?.ownerIndex===p.ownerIndex)candidates.push([x,y]);
  }
  if(!candidates.length)throw new Error('PRODUCT_RANCH_NO_SPAWN_GROUND');
  const [x,y]=candidates[Math.min(candidates.length-1,Math.max(0,Math.trunc(candidates.length*rng.next(1)/102)))];
  return [(x*8+4)*4096,(y*8+4)*4096,0];
}

// The native fallback is restricted to y=3..18. Product rows use a bounded
// nearest-owner search instead, never wrapping vertically onto another row.
export function findRanchRaisingOpenTile(ground,x,y,options={}) {
  if(ground?.layoutVersion!==PRODUCT_RANCH_GRID)return findNativeRaisingOpenTile(ground,x,y,options);
  let best=null;
  for(let ty=0;ty<ground.height;ty++)for(let tx=0;tx<ground.width;tx++){
    if(ground.readTerrain(tx,ty)===1 || !ground.cageAt(tx*8,ty*8))continue;
    const raw=Math.abs(tx-((x%ground.width+ground.width)%ground.width));
    const distance=Math.max(Math.min(raw,ground.width-raw),Math.abs(ty-y));
    if(!best||distance<best.distance)best={x:tx,y:ty,distance};
  }
  if(!best)throw new Error('PRODUCT_RANCH_NO_OPEN_GROUND');
  return best;
}
