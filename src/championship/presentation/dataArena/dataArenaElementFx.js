// Data Arena element dressing (OWNER_APPROVED_ADAPTATION 2026-11-01,
// VFX_FIVE_LAYER_20261101): the same five layers as the AI battle -- charge
// orb, muzzle ring, signature storm, four-second ground marks, struck-body
// overlay -- plus the original remade effect cells over the vector shots.
//
// Element of a move, as in presentation/vfx/unifiedMoveVfxResolver.js: the
// approved name of a partner's own move, else the move's arena element, else
// the caster's taxonomy element. Presentation only: no rule, timing, damage or
// collision reads anything here.
import {moveNameElement} from '../../text/moveNameElements.js';
import {speciesTaxonomyForId} from '../../contracts/speciesTaxonomy.js';
import {createElementVfxLayer} from '../vfx/elementVfxLayer.js';
import {STYLE_FALLBACK_CELLS, elementVfx} from '../vfx/unifiedMoveVfxResolver.js';
import {relayOwnMoveInfo, RELAY_POOL_MOVE_ELEMENT} from '../../modes/dataArena/dataArenaRelayKits.js';
import {relayEffectStyle} from '../../modes/dataArena/dataArenaRelay.js';

const ARENA_ELEMENT = Object.freeze({fire: 'FIRE', frost: 'ICE', light: 'SUN', water: 'WATER', earth: 'EARTH', storm: 'THUNDER', nature: 'WOOD', shadow: 'MOON'});
const PALETTE_ELEMENT = Object.freeze({fire: 'FIRE', water: 'WATER', ice: 'ICE', thunder: 'THUNDER', metal: 'METAL', nature: 'WOOD', earth: 'EARTH',
  wind: 'WIND', light: 'SUN', dark: 'MOON'});
// Tournament / harbour kit moves outside the relay pool.
const KIT_ELEMENT = [[/flame|ember|inferno|cinder/, 'fire'], [/tide|surf|foam|vortex|wave/, 'water'], [/ice|frost|white|glacier/, 'frost'],
  [/sun|dawn|light|halo|radiant/, 'light'], [/shard|quake|rock/, 'earth'], [/arc|storm|bolt/, 'storm'], [/seed|vine|leaf|thorn|grove|bark/, 'nature'],
  [/shade|dusk|night/, 'shadow']];
// Original cells to fall back on when a style's first choice has no original cell on this host.
const ALTERNATE = Object.freeze({water: {hit: [91, 0]}, ice: {hit: [1, 31]}, seed: {hit: [1, 44]}, vine: {hit: [1, 44]}, leaf: {hit: [1, 44]},
  thorn: {hit: [1, 44]}, spore: {hit: [1, 34]}, quake: {hit: [64, 0]}, wind: {hit: [1, 40]}, dark: {hit: [16, 2]}});
// Element cells for a skill whose own style has none (web atlas round): wood
// seed00, ice snowcrystal00, earth rock00, wind tatumaki00, moon dark01.
const ELEMENT_STYLE = Object.freeze({WOOD: 'seed', ICE: 'ice', EARTH: 'quake', WIND: 'wind', MOON: 'dark', WATER: 'water', FIRE: 'fireball',
  THUNDER: 'thunder', SUN: 'holy'});
const MELEE = new Set(['strike', 'claw', 'slash', 'pierce']);

export function dataArenaMoveElement(moveId, casterSpeciesId = null) {
  const own = relayOwnMoveInfo(moveId);
  if (own) return moveNameElement(own.record) ?? PALETTE_ELEMENT[own.palette] ?? speciesTaxonomyForId(casterSpeciesId)?.element ?? 'NEUTRAL';
  const arena = RELAY_POOL_MOVE_ELEMENT[moveId] ?? KIT_ELEMENT.find(([rule]) => rule.test(String(moveId)))?.[1] ?? null;
  return ARENA_ELEMENT[arena] ?? speciesTaxonomyForId(casterSpeciesId)?.element ?? 'NEUTRAL';
}

export function dataArenaMoveStyle(moveId, arenaElement = null) {
  const own = relayOwnMoveInfo(moveId);
  if (own) return own.style;
  try { return relayEffectStyle(moveId, arenaElement)?.style ?? null; } catch { return null; }
}

export function createDataArenaElementFx({PIXI, ground, front, art = null, quality = 'high', reducedMotion = false}) {
  const layer = createElementVfxLayer({PIXI, ground, front, art, quality: quality === 'low' ? 'saver' : 'balanced', reducedMotion, seed: 0xda7a});
  if (!layer) return null;
  const SCALE = 5; // world px per native px: the arena camera shows the field far wider than a battle
  const pick = (style, role) => {
    for (const set of [STYLE_FALLBACK_CELLS[style], ALTERNATE[style]]) {
      const cell = set?.[role];
      if (cell && art?.has?.(cell[0], cell[1])) return {bankId: cell[0], sequence: cell[1]};
    }
    return null;
  };
  const look = (moveId, speciesId) => {
    const element = dataArenaMoveElement(moveId, speciesId);
    const arena = Object.entries(ARENA_ELEMENT).find(([, e]) => e === element)?.[0] ?? null;
    return {...elementVfx(element), element, style: dataArenaMoveStyle(moveId, arena) ?? 'strike'};
  };
  const cellFor = (v, role) => pick(v.style, role) ?? (MELEE.has(v.style) ? null : pick(ELEMENT_STYLE[v.element], role));
  let stats = {casts: 0, releases: 0, hits: 0, ults: 0, projectiles: 0};
  return Object.freeze({
    look,
    /** Windup at the release point: high-saturation Charge Orb + 4 inward-spiraling motes. */
    cast({x, y, moveId, speciesId, windup = 0.2, size = 30, follow = null}) {
      if (reducedMotion) return;
      const v = look(moveId, speciesId);
      layer.charge({x, y, palette: v.palette, ms: Math.max(0.12, windup) * 1000, size, follow});
      stats.casts++;
    },
    /** Release: perpendicular Muzzle Ring + 7 recoil sparks + the style's 292-frame HD launch cell. */
    release({x, y, angle = 0, moveId, speciesId, melee = false}) {
      const v = look(moveId, speciesId);
      layer.muzzle({x, y, angle, palette: v.palette, size: melee ? 34 : 28});
      const cell = cellFor(v, 'launch') ?? cellFor(v, 'body');
      if (cell) layer.cell({...cell, x, y, scale: SCALE, flip: Math.cos(angle) < 0});
      stats.releases++;
    },
    /** Attach a looping 292-frame 4x HD Web Atlas sequence to a live projectile in flight. */
    projectile({follow, moveId, speciesId, angle = 0, lifeMs = 950, scale = SCALE * 0.82}) {
      if (!art) return false;
      const v = look(moveId, speciesId);
      const cell = cellFor(v, 'body') ?? cellFor(v, 'launch') ?? cellFor(v, 'hit');
      if (!cell) return false;
      const ok = layer.cell({...cell, follow, scale, repeatMs: lifeMs, flip: Math.cos(angle) < 0});
      if (ok) stats.projectiles++;
      return ok;
    },
    /** A landed move: 292-frame HD hit cell, 4-second ground decal + HD ground cells, and struck-body overlay. */
    hit({x, y, groundY = y, moveId, speciesId, heavy = false, follow = null}) {
      const v = look(moveId, speciesId);
      const cell = cellFor(v, 'hit');
      if (cell) layer.cell({...cell, x, y, scale: heavy ? SCALE * 1.18 : SCALE});
      // Heavy fire/water/wood impacts also trigger signature 292-frame atlas bursts (explo 149, tsunami 91, toge00 53).
      if (heavy && v.element === 'FIRE' && art?.has?.(149, 0)) layer.cell({bankId: 149, sequence: 0, x, y: y - 8, scale: SCALE * 1.15});
      else if (heavy && v.element === 'WATER' && art?.has?.(91, 0)) layer.cell({bankId: 91, sequence: 0, x, y: groundY, scale: SCALE * 1.05});
      else if (heavy && v.element === 'WOOD' && art?.has?.(53, 2)) layer.cell({bankId: 53, sequence: 2, x, y: groundY, scale: SCALE * 1.05});
      // A melee hit also carries its element's original accent cell, as in the AI battle.
      if (MELEE.has(v.style) && v.accent && art?.has?.(v.accent[0], v.accent[1]))
        layer.cell({bankId: v.accent[0], sequence: v.accent[1], x, y: y - 6, scale: SCALE * 0.88});
      // Every landed move marks the ground for four seconds AND spawns its 292-frame HD ground cells (scale: SCALE).
      layer.decal({x, y: groundY, kind: v.decal, palette: v.palette, paletteKey: v.paletteKey, size: heavy ? 116 : 76, scale: SCALE});
      const overlayCell = v.overlay ?? v.accent;
      if (overlayCell && art?.has?.(overlayCell[0], overlayCell[1]) && follow)
        layer.cell({bankId: overlayCell[0], sequence: overlayCell[1], follow, scale: SCALE * 0.82, repeatMs: heavy ? 900 : 520, overlay: true});
      if (heavy) layer.hold(55);
      stats.hits++;
    },
    /** 80 TP power skill: the element storm over the visible arena + HD atlas burst. */
    ult({moveId, speciesId, rect, center}) {
      const v = look(moveId, speciesId);
      layer.storm({kind: v.storm, palette: v.palette, paletteKey: v.paletteKey, rect, center});
      if (center) {
        const cell = cellFor(v, 'hit') ?? cellFor(v, 'launch');
        if (cell) layer.cell({...cell, x: center.x, y: center.y, scale: SCALE * 1.25});
      }
      layer.hold(65);
      stats.ults++;
    },
    update: dtMs => layer.update(dtMs),
    holding: () => layer.holding(),
    getDiagnostics: () => Object.freeze({...layer.getDiagnostics(), ...stats, originalCells: art?.getDiagnostics?.() ?? null}),
    dispose: () => layer.dispose()
  });
}
