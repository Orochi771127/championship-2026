// Data Arena -- the harbor tile grid and its element rules.
//
// Pure data and rules; no DOM, no Pixi, no clock of its own. The simulation
// steps it with the fixed step and reads the events it returns.
//
// ELEMENT RULES (the contract the tests pin):
//  * FIRE burns only on flammable cells that are not wet and not ash. A burning
//    cell heats its four neighbours every `fireTick`; a neighbour ignites when
//    its heat reaches 1. A cell burns `fireBurnSeconds`, then becomes ash.
//  * WATER (surge, tide bolt) puts a burning cell out and leaves it wet; a wet
//    cell cannot ignite until it dries. Putting fire out is an element chain.
//  * CRYO turns a WATER cell into ICE for a limited time. ICE is walkable. In
//    its last `iceWarnSeconds` it is CRACKING (announced once) and the nav stops
//    routing new paths over it. When it melts, anything standing on it falls
//    into the water (the simulation handles the safe recovery).
//  * An EMBER shot landing on ice takes `emberIceMelt` seconds off it.

import { DATA_ARENA_GRID_RULES, DATA_ARENA_MAP, DATA_ARENA_TERRAIN } from "./dataArenaConfig.js";

const T = DATA_ARENA_TERRAIN;

export function createDataArenaGrid({ map = DATA_ARENA_MAP, rules = DATA_ARENA_GRID_RULES } = {}) {
  const { cols, rows, cell } = map;
  const count = cols * rows;
  const terrain = new Uint8Array(count);
  const flammable = new Uint8Array(count);
  const fire = new Float32Array(count); // seconds of burn left; 0 = not burning
  const heat = new Float32Array(count);
  const wet = new Float32Array(count);
  const ash = new Float32Array(count);
  const ice = new Float32Array(count); // seconds of ice left on a water cell
  const iceWarned = new Uint8Array(count);
  // A monotonically increasing revision of everything navigation reads.
  let navRevision = 1;
  let fireTimer = 0;
  let burningCount = 0;
  let iceCount = 0;

  const index = (c, r) => r * cols + c;
  const inBounds = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const cellOf = (x) => Math.floor(x / cell);

  for (const [c0, r0, w, h, kind] of map.rects) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (inBounds(c, r)) terrain[index(c, r)] = kind;
  }
  const stage = map.stage;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (Math.hypot(c + 0.5 - (stage.col + 0.5), r + 0.5 - (stage.row + 0.5)) <= stage.radius && terrain[index(c, r)] === T.GROUND) {
      terrain[index(c, r)] = T.STAGE;
    }
  }
  for (const [c, r] of map.pylons) terrain[index(c, r)] = T.SOLID;
  for (const [c0, r0, w, h] of map.flammable) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) {
      if (inBounds(c, r) && terrain[index(c, r)] === T.GROUND) flammable[index(c, r)] = 1;
    }
  }

  const isWaterTerrain = (i) => terrain[i] === T.WATER;
  const isSolid = (i) => terrain[i] === T.SOLID || terrain[i] === T.STANDS;

  /** What a body standing on this cell stands on. */
  function surface(i) {
    if (i < 0 || i >= count) return "OUT";
    if (isSolid(i)) return "SOLID";
    if (isWaterTerrain(i)) return ice[i] > 0 ? (ice[i] <= rules.iceWarnSeconds ? "ICE_CRACKING" : "ICE") : "WATER";
    return "GROUND";
  }

  function surfaceAt(x, y) {
    const c = cellOf(x), r = cellOf(y);
    return inBounds(c, r) ? surface(index(c, r)) : "OUT";
  }

  /** Movement blocking per body kind. Swimmers cross open water; walkers do not. */
  function blocksMove(i, kind) {
    if (i < 0 || i >= count) return true;
    if (isSolid(i)) return true;
    if (isWaterTerrain(i) && ice[i] <= 0) return kind !== "swimmer" && kind !== "player";
    return false;
  }

  function blocksMoveAt(c, r, kind) {
    return !inBounds(c, r) || blocksMove(index(c, r), kind);
  }

  const blocksLaser = (i) => i < 0 || i >= count || isSolid(i);

  /**
   * Distance along a unit ray to the first laser-blocking cell (DDA traversal),
   * capped at maxDistance.
   */
  function raycast(x0, y0, dx, dy, maxDistance) {
    let c = cellOf(x0), r = cellOf(y0);
    if (!inBounds(c, r) || blocksLaser(index(c, r))) return 0;
    const stepC = dx > 0 ? 1 : -1, stepR = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(cell / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(cell / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (c + 1) * cell - x0 : x0 - c * cell) / Math.abs(dx)) : Infinity;
    let tMaxY = dy !== 0 ? ((dy > 0 ? (r + 1) * cell - y0 : y0 - r * cell) / Math.abs(dy)) : Infinity;
    for (let guard = 0; guard < cols + rows + 4; guard++) {
      let t;
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; c += stepC; }
      else { t = tMaxY; tMaxY += tDeltaY; r += stepR; }
      if (t >= maxDistance) return maxDistance;
      if (!inBounds(c, r) || blocksLaser(index(c, r))) return t;
    }
    return maxDistance;
  }

  function ignite(i, events, source = "SPREAD") {
    if (i < 0 || i >= count || !flammable[i] || fire[i] > 0 || wet[i] > 0 || ash[i] > 0) return false;
    fire[i] = rules.fireBurnSeconds;
    heat[i] = 0;
    burningCount++;
    navRevision++;
    events?.push({ type: "FIRE_IGNITE", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source });
    return true;
  }

  function igniteAt(x, y, events, source) {
    const c = cellOf(x), r = cellOf(y);
    return inBounds(c, r) ? ignite(index(c, r), events, source) : false;
  }

  function forCellsInRadius(x, y, radiusCells, visit) {
    const c0 = cellOf(x), r0 = cellOf(y), span = Math.ceil(radiusCells);
    const limit = radiusCells * cell;
    for (let r = r0 - span; r <= r0 + span; r++) for (let c = c0 - span; c <= c0 + span; c++) {
      if (!inBounds(c, r)) continue;
      const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell;
      if (Math.hypot(cx - x, cy - y) <= limit + cell * 0.5) visit(index(c, r), cx, cy);
    }
  }

  /** Water on an area: put out fire and leave the cells wet. Returns cells put out. */
  function applyWater(x, y, radiusCells, events) {
    let out = 0;
    forCellsInRadius(x, y, radiusCells, (i, cx, cy) => {
      if (fire[i] > 0) {
        fire[i] = 0; burningCount--; out++; navRevision++;
        events?.push({ type: "FIRE_OUT", cell: i, x: cx, y: cy });
      }
      if (flammable[i]) { wet[i] = rules.wetSeconds; heat[i] = 0; }
    });
    return out;
  }

  function freezeCell(i, seconds, events, source) {
    if (i < 0 || i >= count || !isWaterTerrain(i)) return false;
    const was = ice[i];
    if (was >= seconds) return false;
    if (was <= 0) { iceCount++; navRevision++; }
    ice[i] = seconds;
    iceWarned[i] = 0;
    events?.push({ type: "ICE_FORM", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source, seconds });
    return true;
  }

  /**
   * A cryo pod bursting on a bank freezes a three-cell-wide column straight
   * across the channel, from the first water cell to the far bank: a bridge.
   * Returns the number of cells frozen.
   */
  function applyCryoColumn(x, y, seconds, events) {
    const c0 = cellOf(x), r0 = cellOf(y);
    let direction = 0;
    for (const dr of [1, -1]) if (inBounds(c0, r0 + dr) && isWaterTerrain(index(c0, r0 + dr))) { direction = dr; break; }
    if (!direction) return 0;
    let frozen = 0;
    for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc;
      for (let r = r0 + direction; inBounds(c, r) && isWaterTerrain(index(c, r)); r += direction) {
        if (freezeCell(index(c, r), seconds, events, "POD")) frozen++;
      }
    }
    return frozen;
  }

  /** An ember landing on ice shortens it. */
  function meltAt(x, y, seconds, events) {
    const c = cellOf(x), r = cellOf(y);
    if (!inBounds(c, r)) return false;
    const i = index(c, r);
    if (ice[i] <= 0) return false;
    ice[i] = Math.max(0.01, ice[i] - seconds);
    events?.push({ type: "ICE_MELT_HIT", cell: i, x: (c + 0.5) * cell, y: (r + 0.5) * cell });
    return true;
  }

  /** The tide opens: the retractable bridge lifts and its cells become water. */
  function openTide(events) {
    let changed = 0;
    for (let i = 0; i < count; i++) if (terrain[i] === T.BRIDGE) { terrain[i] = T.WATER; changed++; }
    if (changed) { navRevision++; events?.push({ type: "BRIDGE_LIFTED", cells: changed }); }
    return changed;
  }

  function step(dt, events) {
    // Ice: count down, warn once, melt.
    if (iceCount > 0) {
      for (let i = 0; i < count; i++) {
        if (ice[i] <= 0) continue;
        const before = ice[i];
        ice[i] -= dt;
        if (!iceWarned[i] && ice[i] <= rules.iceWarnSeconds) {
          iceWarned[i] = 1; navRevision++;
          events.push({ type: "ICE_CRACK_WARN", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
        }
        if (ice[i] <= 0 && before > 0) {
          ice[i] = 0; iceCount--; navRevision++;
          events.push({ type: "ICE_MELT", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
        }
      }
    }
    for (let i = 0; i < count; i++) {
      if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - dt);
      if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - dt);
    }
    if (burningCount <= 0) { fireTimer = 0; return; }
    for (let i = 0; i < count; i++) {
      if (fire[i] <= 0) continue;
      fire[i] -= dt;
      if (fire[i] <= 0) {
        fire[i] = 0; burningCount--; ash[i] = rules.ashSeconds; navRevision++;
        events.push({ type: "FIRE_BURNT_OUT", cell: i });
      }
    }
    fireTimer += dt;
    if (fireTimer < rules.fireTick) return;
    fireTimer -= rules.fireTick;
    // Heat is accumulated first, then applied, so spread order never depends
    // on scan direction.
    const toIgnite = [];
    for (let i = 0; i < count; i++) {
      if (fire[i] <= 0) continue;
      const c = i % cols, r = (i - c) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inBounds(c + dc, r + dr)) continue;
        const n = index(c + dc, r + dr);
        if (!flammable[n] || fire[n] > 0 || wet[n] > 0 || ash[n] > 0) continue;
        heat[n] += rules.fireSpreadHeat;
        if (heat[n] >= 1) toIgnite.push(n);
      }
    }
    for (const n of toIgnite) ignite(n, events, "SPREAD");
  }

  return Object.freeze({
    cols, rows, cell, count, terrain, flammable, fire, wet, ash, ice,
    index, inBounds, cellOf,
    get navRevision() { return navRevision; },
    get burningCount() { return burningCount; },
    get iceCount() { return iceCount; },
    surface, surfaceAt, blocksMove, blocksMoveAt, blocksLaser, isSolid, isWaterTerrain,
    raycast, ignite, igniteAt, applyWater, freezeCell, applyCryoColumn, meltAt, openTide, step,
    burningAt(x, y) { const c = cellOf(x), r = cellOf(y); return inBounds(c, r) && fire[index(c, r)] > 0; },
    /** Nearest cell a walker may safely stand on (not solid, not open water, not burning). */
    nearestSafeCell(x, y) {
      const c0 = cellOf(x), r0 = cellOf(y);
      for (let radius = 0; radius < Math.max(cols, rows); radius++) {
        let best = null, bestDistance = Infinity;
        for (let r = r0 - radius; r <= r0 + radius; r++) for (let c = c0 - radius; c <= c0 + radius; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== radius || !inBounds(c, r)) continue;
          const i = index(c, r);
          if (isSolid(i) || isWaterTerrain(i) || fire[i] > 0) continue;
          const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell, d = Math.hypot(cx - x, cy - y);
          if (d < bestDistance) { bestDistance = d; best = { x: cx, y: cy, cell: i }; }
        }
        if (best) return best;
      }
      return null;
    }
  });
}
