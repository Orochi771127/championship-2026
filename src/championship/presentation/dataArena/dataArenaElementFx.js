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
import {createMoveVfxKit} from '../vfx/moveVfxKit.js';
import {createPixelHitBursts} from '../vfx/pixelHitBursts.js';
import {createPixelMotes} from '../vfx/pixelMotes.js';
import {moveVfxChoreography} from '../vfx/moveVfxChoreography.js';
import {createMoveVfxSetPieces} from '../vfx/moveVfxSetPieces.js';
import {DATA_ARENA_POOL_ARCHETYPE, moveVfxRecipe} from '../vfx/moveVfxRecipes.js';
import {moveVfxSignature} from '../vfx/moveVfxSignatures.js';
import {battleMoveName} from '../../text/battleMoveNames.js';
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

/**
 * `kit` (MOVE_VFX_KIT_20261105, default on; ?moveVfx=classic keeps the cells):
 * every phase of a move -- charge, release, shot, hit, signature close -- is
 * drawn by the move VFX kit in one style instead of atlas cells over vector
 * heads. The signature storm, hit-stop and the struck-body hold stay here.
 */
export function createDataArenaElementFx({PIXI, ground, front, art = null, quality = 'high', reducedMotion = false, kit: useKit = true}) {
  const layer = createElementVfxLayer({PIXI, ground, front, art, quality: quality === 'low' ? 'saver' : 'balanced', reducedMotion, seed: 0xda7a});
  if (!layer) return null;
  const kit = useKit ? createMoveVfxKit({PIXI, front, ground, quality: quality === 'low' ? 'saver' : 'balanced', reducedMotion, seed: 0xda7b}) : null;
  const SCALE = 5; // world px per native px: the arena camera shows the field far wider than a battle
  // Pixel hit bursts (STATUS_AILMENT_VFX_20261110): the AI battle's element bursts on every landed move here too.
  const pixelHits = typeof createPixelHitBursts === 'function'
    ? createPixelHitBursts({PIXI, layer: front, quality: quality === 'low' ? 'saver' : 'balanced', reducedMotion}) : null;
  const BODY = 78; // a relay fighter's body width in world px (ROLE_HEIGHT 96 x 0.8)
  // Pixel motes (MOVE_VFX_QUALITY_20261110): the AI battle's element particles on shots in flight and on every hit.
  const motes = typeof createPixelMotes === 'function'
    ? createPixelMotes({PIXI, layer: front, quality: quality === 'low' ? 'saver' : 'balanced', reducedMotion, seed: 0xda7c}) : null;
  const moteTrails = [];
  // Each move's own moment (BESPOKE_MOVE_VFX_PROGRAM_20261111), as in the AI battle.
  const setPieces = typeof createMoveVfxSetPieces === 'function' ? createMoveVfxSetPieces({PIXI, layer: front, reducedMotion}) : null;
  // Cover materials as piece palettes (core lit top, main face, edge shadow); basalt burns inside.
  const COVER_PALETTE = Object.freeze({
    STONE: {core: 0xe4e8ea, main: 0xb7bec2, edge: 0x5e666e}, WOOD: {core: 0xe0b07a, main: 0xb07b48, edge: 0x553620},
    TIMBER: {core: 0xe0b07a, main: 0xb07b48, edge: 0x553620}, BASALT: {core: 0xffb070, main: 0xff8a3c, edge: 0x241c1f},
    CORAL: {core: 0xfbe2d8, main: 0xf2c7b8, edge: 0xa96f62}, ICE: {core: 0xffffff, main: 0xd6f3fb, edge: 0x5fa4c4},
    SANDSTONE: {core: 0xf2dcae, main: 0xe0c08a, edge: 0x8e6d3e}, CRYSTAL: {core: 0xe0ffff, main: 0x8ff3ff, edge: 0x1b3a4f},
    METAL: {core: 0xffffff, main: 0x9aa8b6, edge: 0x3f4a56}});
  const pieceAt = (moveId, phase, at) => {
    const choreo = moveVfxChoreography(moveId), c = choreo?.[phase];
    if (!c || !setPieces) return;
    // An ultimate opens its contact with an impact frame, held by the layer's hit-stop.
    if (phase === 'contact' && choreo.impactFrame) setPieces.play('impact-frame', {...at, palette: {core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true}, size: BODY, unit: SCALE * 0.5, groundY: at.y + BODY * 0.5, scale: c.scale ?? 1});
    setPieces.play(c.piece, {...at, size: BODY, unit: SCALE * 0.5, groundY: at.y + BODY * 0.5, scale: c.scale ?? 1, fast: c.fast, sprite: c.sprite, at: phase === 'contact' ? 'contact' : null});
  };
  let moteClock = 0, moteSeq = 0;
  // Kit effects read at phone size under that wide camera (Owner 2026-11-05: they looked small).
  const KIT = 1.4;
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
    const style = dataArenaMoveStyle(moveId, arena) ?? 'strike';
    // The kit effect: a partner's own move by its approved name, a pool move by its own entry.
    const own = relayOwnMoveInfo(moveId);
    // The move's own signature (UNIQUE_PIXEL_MOVE_VFX_20261108) names its archetype and palette, as in every other mode.
    const signature = moveVfxSignature(moveId);
    const archetype = signature?.archetype ?? (own ? moveVfxRecipe({style, element, name: battleMoveName(own.record) ?? ''}).archetype
      : DATA_ARENA_POOL_ARCHETYPE[moveId] ?? moveVfxRecipe({style, element}).archetype);
    const base = elementVfx(element);
    return {...base, paletteKey: signature?.paletteKey ?? base.paletteKey, element, style, archetype, signature};
  };
  const cellFor = (v, role) => pick(v.style, role) ?? (MELEE.has(v.style) ? null : pick(ELEMENT_STYLE[v.element], role));
  let stats = {casts: 0, releases: 0, hits: 0, ults: 0, projectiles: 0};
  return Object.freeze({
    look,
    /** Windup at the release point: high-saturation Charge Orb + 4 inward-spiraling motes. */
    cast({x, y, moveId, speciesId, windup = 0.2, size = 30, follow = null}) {
      if (reducedMotion) return;
      const v = look(moveId, speciesId);
      if (kit) { kit.charge({x, y, paletteKey: v.paletteKey, size: size * KIT, ms: Math.max(0.12, windup) * 1000, follow, signature: v.signature}); stats.casts++; return; }
      layer.charge({x, y, palette: v.palette, ms: Math.max(0.12, windup) * 1000, size, follow});
      stats.casts++;
    },
    /** Release: perpendicular Muzzle Ring + 7 recoil sparks + the style's 292-frame HD launch cell. */
    release({x, y, angle = 0, moveId, speciesId, melee = false}) {
      const v = look(moveId, speciesId);
      pieceAt(moveId, 'release', {x, y, angle, palette: v.palette});
      if (kit) {
        const archetype = v.archetype;
        if (melee) kit.melee({x, y, angle, paletteKey: v.paletteKey, archetype, size: 34 * KIT, signature: v.signature});
        else kit.launch({x, y, angle, paletteKey: v.paletteKey, archetype, size: 28 * KIT, signature: v.signature});
        stats.releases++;
        return;
      }
      layer.muzzle({x, y, angle, palette: v.palette, size: melee ? 34 : 28});
      const cell = cellFor(v, 'launch') ?? cellFor(v, 'body');
      if (cell) layer.cell({...cell, x, y, scale: SCALE, angle});
      stats.releases++;
    },
    /** Attach a looping 292-frame 4x HD Web Atlas sequence to a live projectile in flight. */
    projectile({follow, moveId, speciesId, angle = 0, lifeMs = 950, scale = SCALE * 0.82, size = 26}) {
      if (motes && typeof follow === 'function') moteTrails.push({id: `p${moteSeq++}`, follow, element: look(moveId, speciesId).element, until: moteClock + lifeMs});
      if (kit) {
        const v = look(moveId, speciesId);
        const ok = Boolean(kit.projectile({follow, paletteKey: v.paletteKey, archetype: v.archetype, size: size * KIT, signature: v.signature}));
        if (ok) stats.projectiles++;
        return ok;
      }
      if (!art) return false;
      const v = look(moveId, speciesId);
      const cell = cellFor(v, 'body') ?? cellFor(v, 'launch') ?? cellFor(v, 'hit');
      if (!cell) return false;
      const ok = layer.cell({...cell, follow, scale, repeatMs: lifeMs, angle});
      if (ok) stats.projectiles++;
      return ok;
    },
    /** A landed move: 292-frame HD hit cell, 4-second ground decal + HD ground cells, and struck-body overlay. */
    hit({x, y, groundY = y, moveId, speciesId, heavy = false, follow = null, angle = 0, size = 30}) {
      const v = look(moveId, speciesId);
      pixelHits?.spawn({element: v.element, x, y, groundY, size: BODY, unit: SCALE, heavy, flip: Math.cos(angle) < 0});
      motes?.burst({element: v.element, x, y, groundY, unit: SCALE * 0.5, weight: heavy ? 'heavy' : 'light', dir: Math.sign(Math.cos(angle))});
      pieceAt(moveId, 'contact', {x, y, angle, palette: v.palette});
      // Refinement pass 2 (Owner: 場地破壞 at the AI battle's level): a heavy hit marks the floor with its
      // element's ground mark -- a crater, scorch, frost or puddle -- as the AI battle does; the kit path used to skip it.
      if (kit && heavy) layer.decal({x, y: groundY, kind: v.decal, palette: v.palette, paletteKey: v.paletteKey, size: 116, scale: SCALE});
      if (kit) {
        kit.impact({x, y, groundY, angle, paletteKey: v.paletteKey, archetype: v.archetype, heavy, size: size * KIT, signature: v.signature});
        if (heavy) layer.hold(55);
        stats.hits++;
        return;
      }
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
    /** An area move landing (nova, zone): one heavy hit sized to the area. */
    area({x, y, radius = 100, moveId, speciesId}) {
      if (!kit) return false;
      const v = look(moveId, speciesId);
      pixelHits?.spawn({element: v.element, x, y, groundY: y, size: Math.max(BODY, radius * 0.9), unit: SCALE, heavy: true});
      motes?.burst({element: v.element, x, y, groundY: y, unit: SCALE * 0.5, weight: 'heavy'});
      kit.impact({x, y, groundY: y, paletteKey: v.paletteKey, archetype: v.archetype, heavy: true, size: Math.max(20 * KIT, radius * 0.31), signature: v.signature});
      stats.hits++;
      return true;
    },
    /** 80 TP power skill: the element backdrop over the visible arena and its signature close. */
    ult({moveId, speciesId, rect, center}) {
      const v = look(moveId, speciesId);
      // The kit washes the field in the move's colour; the line-art storm stays for the classic look.
      if (kit) kit.wash({rect, center, paletteKey: v.paletteKey});
      else layer.storm({kind: v.storm, palette: v.palette, paletteKey: v.paletteKey, rect, center});
      if (center && kit) kit.signature({x: center.x, y: center.y, paletteKey: v.paletteKey, archetype: v.archetype, size: 40 * KIT, signature: v.signature});
      else if (center) {
        const cell = cellFor(v, 'hit') ?? cellFor(v, 'launch');
        if (cell) layer.cell({...cell, x: center.x, y: center.y, scale: SCALE * 1.25});
      }
      layer.hold(65);
      stats.ults++;
    },
    /**
     * The arena's cover (refinement pass 2): a struck block throws a chip of its own material,
     * a broken one bursts into debris and dust and leaves a crater under its rubble.
     */
    prop({x, y, material = 'STONE', broken = false, weak = false}) {
      const palette = COVER_PALETTE[material] ?? COVER_PALETTE.STONE;
      if (setPieces) setPieces.play(broken ? 'prop-dust' : 'prop-chip', {x, y: y - BODY * 0.28, groundY: y, palette, size: BODY * (broken ? 1.3 : weak ? 1 : 0.8), unit: SCALE * 0.5});
      if (broken) {
        layer.decal({x, y, kind: 'crack', palette, paletteKey: 'earth', size: 120, scale: SCALE});
        layer.hold(45);
      }
      stats.props = (stats.props ?? 0) + 1;
      return true;
    },
    /** True when the kit draws the shots, so the scene hides its own vector heads. */
    drawsShots: () => Boolean(kit),
    update(dtMs) {
      layer.update(dtMs); kit?.update(layer.holding() ? 0 : dtMs); pixelHits?.update(layer.holding() ? 0 : dtMs);
      if (motes) {
        moteClock += dtMs;
        for (let i = moteTrails.length - 1; i >= 0; i--) {
          const t = moteTrails[i], at = moteClock < t.until ? t.follow() : null;
          if (!at) { moteTrails.splice(i, 1); continue; }
          motes.trail(t.id, {element: t.element, x: at.x, y: at.y, groundY: at.groundY ?? null, unit: SCALE * 0.5});
        }
        motes.update(layer.holding() ? 0 : dtMs);
      }
      if (setPieces) {
        setPieces.update(layer.holding() ? 0 : dtMs);
      }
    },
    holding: () => layer.holding(),
    getDiagnostics: () => Object.freeze({...layer.getDiagnostics(), ...stats, originalCells: art?.getDiagnostics?.() ?? null, kit: kit?.getDiagnostics() ?? null, pixelHits: pixelHits?.getDiagnostics() ?? null, motes: motes?.getDiagnostics() ?? null}),
    dispose() { setPieces?.dispose(); pixelHits?.dispose(); motes?.dispose(); moteTrails.length = 0; kit?.dispose(); layer.dispose(); }
  });
}
