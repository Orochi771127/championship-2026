// Arena hazards over the native battle — OWNER_APPROVED_ADAPTATION 2026-10-18.
//
// The original battle has no terrain rules; this layer is product design, opt
// in, and never ROM evidence. It reuses the Data Arena grid (terrain, charge,
// natural/temporary ice, refreeze) instead of a second terrain engine, and it
// reads the native simulation from the outside:
//
//  * It never selects actions, touches RNG channels, cooldowns, the clock or
//    AI state. The ROM AI does not know hazards exist.
//  * It writes only `currentHp` of a standing combatant (never below 1: no
//    hazard defeats anyone until the Owner decides lethal rules) and, after a
//    fall, that combatant's native world point when it is put back ashore.
//  * Element is the one the player sees: the battle VFX palette of the move
//    (`describeBattleFxMove`). Fire-palette hits heat ice, ice-palette hits
//    cool water, thunder-palette hits charge conductive water, water-palette
//    (and ice-palette) hits crust lava into temporarily safe rock.
//  * Heat resistance against lava is the projected HEAT stat (profile field
//    070 = creature +0x70, `stats.field70`); enough of it makes lava harmless.
//    It does not protect against falls, charge or any direct attack.
//  * Thunder resistance is the individual's projected THUNDER stat
//    (`projectNativeIndividualStats`, profile field 080 = creature +0x80, the
//    value the battle roster already carries as `stats.field80`). Using it as
//    conduction resistance is part of this adaptation, not a ROM rule.
//
// Coordinates are native field pixels (416 x 272); a grid cell is 8 px. Every
// number below is a first, tunable test value, not an Owner balance decision.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { createDataArenaGrid } from "../modes/dataArena/dataArenaGrid.js";
import { DATA_ARENA_GRID_RULES, DATA_ARENA_TERRAIN as T } from "../modes/dataArena/dataArenaConfig.js";
import { describeBattleFxMove } from "../presentation/battleFx/battleFxRecipes.js";
import bm04Terrain from "../../data/championship/battle-arena-terrain/field_bm04_01.r2.json" with { type: "json" };
import bm05Terrain from "../../data/championship/battle-arena-terrain/field_bm05_01.r1.json" with { type: "json" };
import bm03Terrain from "../../data/championship/battle-arena-terrain/field_bm03_01.r3.json" with { type: "json" };

export const BATTLE_ARENA_HAZARD_AUTHORITY = "OWNER_APPROVED_ADAPTATION_2026-10-18";

export const BATTLE_ARENA_HAZARD_RULES = deepFreeze({
  frameSeconds: 1 / 60,
  airborneNativePx: 6, // a combatant this far off the ground touches no surface
  shock: {
    seconds: 3, // matches the Data Arena default so both modes read the same
    radiusCells: 7, // 56 native px: about an eighth of the field width
    tickFrames: 30, // one damage tick per half second spent in charged water
    maxHpFraction: 0.02, // per tick, before resistance
    immuneStat: 234 // THUNDER at or above this (stat-curve step 20) makes charge harmless
  },
  heat: {
    radiusCells: 2.5, // a local patch, never the whole sheet
    base: 70, // integrity removed at the centre: one strong fire hit opens a small hole
    perPower: 1 / 8 // plus move power / 8 (power 30..600 -> 74..145)
  },
  cold: { radiusCells: 2, seconds: 6 },
  lava: {
    coolRadiusCells: 2.5, // water-palette hit: local crust around the target
    coolSeconds: 8, // ice-palette hits crust for 5 s; re-cooling resets, never stacks
    coldSeconds: 5,
    tickFrames: 30, // one burn tick per half second on molten lava
    maxHpFraction: 0.03, // per tick, before resistance
    immuneStat: 234 // HEAT at or above this (stat-curve step 20) walks lava unharmed
  },
  fall: {
    sinkFrames: 48, // 0.8 s: losing footing, dropping in, the splash
    maxHpFraction: 0.06, // one-off, never below 1 HP
    graceFrames: 120, // 2 s ashore before any surface rule applies again
    landingIntegrity: 0.5 // natural ice needs half its integrity to be a safe landing
  }
});

const TERRAINS = deepFreeze({ [bm04Terrain.fieldId]: bm04Terrain, [bm05Terrain.fieldId]: bm05Terrain, [bm03Terrain.fieldId]: bm03Terrain });
// "=" is natural ice: WATER underneath, an authored sheet on top.
const LEGEND = deepFreeze({ "~": T.SHALLOW, ".": T.GROUND, "w": T.WATER, "=": T.WATER, "#": T.SOLID, "L": T.LAVA });

export function battleArenaHasHazards(fieldId) {
  return Object.hasOwn(TERRAINS, fieldId);
}

/** Row runs of the authored character grid become Data Arena rectangles. */
export function battleArenaTerrainMap(doc) {
  const rects = [], naturalIce = [];
  doc.grid.forEach((line, row) => {
    if (line.length !== doc.cols) throw new Error(`BATTLE_ARENA_TERRAIN_ROW_WIDTH:${row}`);
    let start = 0;
    for (let col = 1; col <= line.length; col++) {
      if (col < line.length && line[col] === line[start]) continue;
      const kind = LEGEND[line[start]];
      if (kind === undefined) throw new Error(`BATTLE_ARENA_TERRAIN_SYMBOL:${line[start]}`);
      rects.push([start, row, col - start, 1, kind]);
      if (line[start] === "=") naturalIce.push([start, row, col - start, 1]);
      start = col;
    }
  });
  if (doc.grid.length !== doc.rows || doc.cols * doc.cellNativePx !== doc.nativeWidthPx
    || doc.rows * doc.cellNativePx !== doc.nativeHeightPx) throw new Error("BATTLE_ARENA_TERRAIN_SHAPE");
  return deepFreeze({ cell: doc.cellNativePx, cols: doc.cols, rows: doc.rows, rects, naturalIce, stage: null, pylons: [], flammable: [] });
}

/**
 * @param {object} options
 * @param {string} options.fieldId arena field (e.g. field_bm04_01)
 * @param {(slot:number)=>number} options.teamOfSlot
 * @param {object} [options.terrain] explicit terrain document (tests)
 * @returns {object|null} null when the arena has no hazard terrain
 */
export function createBattleArenaHazards({ fieldId, teamOfSlot, rules = BATTLE_ARENA_HAZARD_RULES, terrain = null } = {}) {
  const doc = terrain ?? TERRAINS[fieldId];
  if (!doc) return null;
  if (typeof teamOfSlot !== "function") throw new Error("BATTLE_ARENA_HAZARDS_TEAM_OF_SLOT_REQUIRED");
  const grid = createDataArenaGrid({ map: battleArenaTerrainMap(doc) });
  const cell = grid.cell;
  const events = [];
  const recent = []; // last events with a sequence number, for presentation
  let sequence = 0;
  let frame = 0;
  // Per-cell ice transitions collapse into one summary per frame (the cell
  // states themselves are in the snapshot), so a large melt or refreeze can
  // never push a fall or a recovery out of the recent ring.
  const CELL_EVENTS = { ICE_CRACK_WARN: "cracked", ICE_MELT: "opened", ICE_FORM: "frozen", ICE_MELT_HIT: "worn" };
  const record = () => {
    const summary = { cracked: 0, opened: 0, frozen: 0, worn: 0 };
    let cells = 0;
    const push = event => { recent.push(Object.freeze({ ...event, seq: ++sequence, frame })); if (recent.length > 32) recent.shift(); };
    for (const event of events.splice(0, events.length)) {
      const key = CELL_EVENTS[event.type];
      if (key) { summary[key]++; cells++; } else push(event);
    }
    if (cells) push({ type: "ICE_CHANGES", ...summary });
  };
  const exposure = new Map(); // slot -> frames spent in enemy charge
  const burning = new Map(); // slot -> frames spent on molten lava
  const falls = new Map(); // slot -> {frames, x, y}
  const grace = new Map(); // slot -> frames left
  const applied = new Set(); // "frame:attacker:move:kind" already resolved this frame
  const totals = { shock: new Map(), falls: new Map(), burn: new Map() };
  const native = ([x, y, z]) => [x / 4096, y / 4096, z / 4096];

  function elementOf(move) {
    try { return describeBattleFxMove(move).palette; } catch { return "neutral"; }
  }

  function once(kind, attackerSlot, move) {
    const key = `${frame}:${attackerSlot}:${move.recordIndex}:${kind}`;
    if (applied.has(key)) return false;
    applied.add(key);
    return true;
  }

  function standable(i) {
    if (i < 0 || i >= grid.count || grid.isSolid(i) || grid.fire[i] > 0 || grid.charge[i] > 0) return false;
    if (grid.terrain[i] === T.GROUND || grid.terrain[i] === T.SHALLOW) return true;
    if (grid.terrain[i] === T.LAVA) return grid.cooled[i] > DATA_ARENA_GRID_RULES.lavaWarnSeconds;
    return grid.ice[i] === Infinity && grid.iceIntegrity[i] >= DATA_ARENA_GRID_RULES.naturalIceIntegrity * rules.fall.landingIntegrity;
  }

  /** Nearest cell whose whole 3 x 3 neighbourhood is safe footing. */
  function safeLanding(x, y) {
    const c0 = grid.cellOf(x), r0 = grid.cellOf(y);
    for (let radius = 0; radius < Math.max(grid.cols, grid.rows); radius++) {
      let best = null, bestDistance = Infinity;
      for (let r = r0 - radius; r <= r0 + radius; r++) for (let c = c0 - radius; c <= c0 + radius; c++) {
        if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== radius || c < 1 || r < 1 || c >= grid.cols - 1 || r >= grid.rows - 1) continue;
        let ok = true;
        for (let dr = -1; dr <= 1 && ok; dr++) for (let dc = -1; dc <= 1 && ok; dc++) ok = standable(grid.index(c + dc, r + dr));
        if (!ok) continue;
        const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell, d = Math.hypot(cx - x, cy - y);
        if (d < bestDistance) { bestDistance = d; best = { x: cx, y: cy }; }
      }
      if (best) return best;
    }
    return grid.nearestSafeCell(x, y);
  }

  return Object.freeze({
    fieldId: doc.fieldId,
    grid,
    rules,
    /** A resolved hit from the existing damage loop. */
    onHit({ move, attackerSlot, targetPosition }) {
      if (!move || !targetPosition) return 0;
      const [x, y, z] = native(targetPosition);
      const element = elementOf(move);
      let changed = 0;
      if (element === "thunder" && z <= rules.airborneNativePx) {
        changed = grid.applyShock(x, y, { team: teamOfSlot(attackerSlot), seconds: rules.shock.seconds,
          radius: rules.shock.radiusCells, source: `MOVE_${move.recordIndex}` }, events);
      } else if (element === "fire" && once("heat", attackerSlot, move)) {
        changed = grid.heatIceAt(x, y, { radius: rules.heat.radiusCells,
          amount: rules.heat.base + (move.power ?? 0) * rules.heat.perPower, source: `MOVE_${move.recordIndex}` }, events);
      } else if (element === "ice" && once("cold", attackerSlot, move)) {
        changed = grid.coolAt(x, y, { radius: rules.cold.radiusCells, seconds: rules.cold.seconds, source: `MOVE_${move.recordIndex}` }, events)
          + grid.coolLavaAt(x, y, { radius: rules.lava.coolRadiusCells, seconds: rules.lava.coldSeconds, source: `MOVE_${move.recordIndex}` }, events);
      } else if (element === "water" && once("water", attackerSlot, move)) {
        changed = grid.coolLavaAt(x, y, { radius: rules.lava.coolRadiusCells, seconds: rules.lava.coolSeconds, source: `MOVE_${move.recordIndex}` }, events);
      }
      record();
      return changed;
    },
    /**
     * Advance one simulation frame after the session step. Returns the slots
     * whose HP changed; `setPositionOf` puts a fallen combatant back ashore.
     */
    step({ slots, positionOf, thunderStatOf, heatStatOf = () => 0, setPositionOf = null }) {
      frame++;
      applied.clear();
      grid.step(rules.frameSeconds, events);
      const changed = [];
      slots.forEach((combatant, slot) => {
        if (!combatant || !(combatant.currentHp > 0)) { exposure.delete(slot); burning.delete(slot); falls.delete(slot); grace.delete(slot); return; }
        const position = positionOf(slot);
        if (!position) { exposure.delete(slot); return; }
        const [x, y, z] = native(position);
        // A fall in progress: sink, then come back ashore with a short grace.
        const fall = falls.get(slot);
        if (fall) {
          fall.frames++;
          if (fall.frames < rules.fall.sinkFrames) return;
          falls.delete(slot);
          const landing = safeLanding(fall.x, fall.y);
          if (landing && setPositionOf) setPositionOf(slot, [landing.x, landing.y]);
          grace.set(slot, rules.fall.graceFrames);
          events.push({ type: "RECOVERED", slot, x: landing?.x ?? fall.x, y: landing?.y ?? fall.y, fromX: fall.x, fromY: fall.y });
          return;
        }
        const graceLeft = grace.get(slot) ?? 0;
        if (graceLeft > 0) { grace.set(slot, graceLeft - 1); exposure.delete(slot); return; }
        if (z > rules.airborneNativePx) { exposure.delete(slot); return; }
        // Open water under a walker's feet: lose footing (never a defeat).
        if (grid.surfaceAt(x, y) === "WATER") {
          const damage = Math.max(1, Math.round((combatant.maxHp ?? combatant.currentHp) * rules.fall.maxHpFraction));
          const hp = Math.max(1, combatant.currentHp - damage);
          const dealt = combatant.currentHp - hp;
          combatant.currentHp = hp;
          falls.set(slot, { frames: 0, x, y });
          exposure.delete(slot);
          totals.falls.set(slot, (totals.falls.get(slot) ?? 0) + 1);
          events.push({ type: "FELL_IN_WATER", slot, x, y, damage: dealt, hp });
          if (dealt > 0) changed.push(slot);
          return;
        }
        // Molten lava burns per tick unless HEAT is high enough; crust is safe.
        if (grid.surfaceAt(x, y) === "LAVA") {
          const frames = (burning.get(slot) ?? 0) + 1;
          burning.set(slot, frames);
          if (frames % rules.lava.tickFrames === 0) {
            const stat = heatStatOf(slot) ?? 0;
            if (stat >= rules.lava.immuneStat) events.push({ type: "LAVA_RESISTED", slot, x, y });
            else {
              const scale = 1 - Math.max(0, stat) / rules.lava.immuneStat;
              const damage = Math.max(1, Math.round((combatant.maxHp ?? combatant.currentHp) * rules.lava.maxHpFraction * scale));
              const hp = Math.max(1, combatant.currentHp - damage);
              const dealt = combatant.currentHp - hp;
              if (dealt > 0) {
                combatant.currentHp = hp;
                totals.burn.set(slot, (totals.burn.get(slot) ?? 0) + dealt);
                events.push({ type: "LAVA_BURN", slot, damage: dealt, hp, x, y });
                changed.push(slot);
              } else events.push({ type: "LAVA_FLOORED", slot, x, y });
            }
          }
        } else burning.delete(slot);
        const charge = grid.chargeAt(x, y);
        if (!charge || charge.team === teamOfSlot(slot)) { exposure.delete(slot); return; }
        const frames = (exposure.get(slot) ?? 0) + 1;
        exposure.set(slot, frames);
        if (frames % rules.shock.tickFrames !== 0) return;
        const stat = thunderStatOf(slot) ?? 0;
        if (stat >= rules.shock.immuneStat) { events.push({ type: "SHOCK_RESISTED", slot, x, y }); return; }
        const scale = 1 - Math.max(0, stat) / rules.shock.immuneStat;
        const damage = Math.max(1, Math.round((combatant.maxHp ?? combatant.currentHp) * rules.shock.maxHpFraction * scale));
        const hp = Math.max(1, combatant.currentHp - damage);
        const dealt = combatant.currentHp - hp;
        if (dealt <= 0) { events.push({ type: "SHOCK_FLOORED", slot, x, y }); return; }
        combatant.currentHp = hp;
        totals.shock.set(slot, (totals.shock.get(slot) ?? 0) + dealt);
        events.push({ type: "SHOCKED", slot, damage: dealt, hp, x, y });
        changed.push(slot);
      });
      record();
      return changed;
    },
    /** Small immutable view for presentation: only cells that differ from rest. */
    snapshot() {
      const charged = [], ice = [], lava = [];
      if (grid.cooledCount > 0) for (let i = 0; i < grid.count; i++) if (grid.cooled[i] > 0) lava.push([i, grid.cooled[i]]);
      if (grid.chargedCount > 0) {
        for (let i = 0; i < grid.count; i++) if (grid.charge[i] > 0) charged.push([i, grid.charge[i], grid.chargeTeam[i]]);
      }
      if (grid.naturalCount > 0 || grid.iceCount > 0) {
        // state: 1 heated (natural, worn), 2 cracking, 3 open (natural, melted), 4 temporary ice
        for (let i = 0; i < grid.count; i++) {
          const v = grid.ice[i];
          if (v === Infinity) { if (grid.iceIntegrity[i] < DATA_ARENA_GRID_RULES.naturalIceIntegrity) ice.push([i, 1, grid.iceIntegrity[i] / DATA_ARENA_GRID_RULES.naturalIceIntegrity]); }
          else if (v > 0) ice.push([i, v <= DATA_ARENA_GRID_RULES.iceWarnSeconds ? 2 : 4, v]);
          else if (grid.naturalIce[i]) ice.push([i, 3, grid.refreeze[i]]);
        }
      }
      return deepFreeze({ authority: BATTLE_ARENA_HAZARD_AUTHORITY, fieldId: doc.fieldId, frame, cellNativePx: cell,
        cols: grid.cols, rows: grid.rows, warnSeconds: DATA_ARENA_GRID_RULES.shockWarnSeconds,
        lavaWarnSeconds: DATA_ARENA_GRID_RULES.lavaWarnSeconds,
        charged, ice, lava,
        recent: [...recent],
        falls: Object.fromEntries([...falls].map(([slot, f]) => [slot, { progress: f.frames / rules.fall.sinkFrames, x: f.x, y: f.y }])),
        grace: Object.fromEntries(grace),
        shockTotals: Object.fromEntries(totals.shock), fallTotals: Object.fromEntries(totals.falls), burnTotals: Object.fromEntries(totals.burn),
        burningSlots: [...burning.keys()],
        exposedSlots: [...exposure.keys()] });
    }
  });
}
