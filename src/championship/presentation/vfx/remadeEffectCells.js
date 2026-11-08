// Remade effect cells (OWNER_APPROVED_ADAPTATION 2026-11-08,
// UNIQUE_PIXEL_MOVE_VFX_20261108: 「表現方式也要一樣…每一招都要照著作為參考」).
//
// The AI battle plays every move through the native effect pool: how many
// actors, where they stand, when each appears, its scale, turn, fade and which
// frame of which sequence it shows. A cell only the reference atlas has used
// to be drawn from that atlas. Here each such cell is drawn again in the kit's
// pixel finish from a written brief -- what the thing is, its colour family and
// how it changes from frame to frame -- and handed back in the reference cell's
// place, so the native pool plays the remade cell exactly where and when it
// played the old one. No original pixel or palette value is read: a brief is
// design direction written by looking at the move, the cell's frame and origin
// are the pool's own numeric data, and the drawing is the kit's own shapes.
//
// Presentation only. Families without a written brief get a look from their
// form, colour family and the stage the move plays the sequence in.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};
import moves from '../../../data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import {BATTLE_FX_PALETTES} from '../battleFx/battleFxPalettes.js';
import {battleFxFamilyForm, battleFxFamilyName, battleFxFamilyPalette, battleFxMoveBanks} from '../battleFx/battleFxRecipes.js';
import {createNoiseField, paintMoveVfxCell} from './moveVfxKitTextures.js';
import {moveVfxObjectOfFamily} from './moveVfxRecipes.js';
import {BRIEF_PALETTES, REMADE_EFFECT_BRIEFS} from './remadeEffectBriefs.js';

/** Texels per native pixel: the remade cells are drawn three times finer than the native grid. */
export const REMADE_CELL_SCALE = 3;
export const REMADE_CELL_SOURCE = 'REMADE_PIXEL_KIT';

// The stage each (bank, sequence) plays in the moves that name it: launch, body or hit.
const STAGE = (() => {
  const votes = new Map();
  for (const move of moves.records) for (const b of battleFxMoveBanks(move)) {
    const key = `${b.bankId}:${b.sequence}`, tally = votes.get(key) ?? {};
    tally[b.role] = (tally[b.role] ?? 0) + 1; votes.set(key, tally);
  }
  return new Map([...votes].map(([key, tally]) => [key, Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]]));
})();

/** {sequence, index, count} of a cell in its bank's sequences, the first sequence that shows it. */
function placeOf(bankId, cell) {
  const bank = profiles.banks[bankId - 1];
  for (const [sequence, s] of (bank?.sequences ?? []).entries()) {
    const index = s.frames.findIndex(f => f.cell === cell);
    if (index >= 0) return {sequence, index, count: s.frames.length};
  }
  return null;
}

// Default looks by form and colour family, for families without a written brief.
const SHOT_BY_PALETTE = Object.freeze({fire: 'comet', water: 'drop', ice: 'shard', thunder: 'orb', nature: 'leaf', light: 'star', dark: 'orb',
  metal: 'missile', earth: 'rock', wind: 'slash', toxic: 'mist', psychic: 'orb', neutral: 'orb'});
const HIT_BY_PALETTE = Object.freeze({toxic: 'mist', dark: 'burst', water: 'burst', ice: 'burst', earth: 'burst'});
const OBJECT_SHEET = Object.freeze({mushroom: 'mushroom', bomb: 'bomb', banana: 'banana', fish: 'fish', gear: 'gear', bone: 'bone', heart: 'heart',
  syringe: 'syringe', egg: 'egg', mist: 'mist', bubble: 'bubble', crescent: 'crescent', star: 'star', shuriken: 'shuriken', thunder: 'orb', orb: 'orb',
  drill: 'drill', petal: 'petal'});
const LIGHT = new Set(['glow', 'flare', 'ring', 'streak', 'beam']);

/** A palette by brief name, BATTLE_FX_PALETTES key or object; neutral when unknown. */
function paletteOf(key) {
  if (key && typeof key === 'object') return key;
  return BRIEF_PALETTES[key] ?? BATTLE_FX_PALETTES[key] ?? BATTLE_FX_PALETTES.neutral;
}

/**
 * A sequence written in words: "sheet [grow a b] [fade a] [scale k] [palette key] [light]",
 * e.g. "burst grow 0.4 1.2 fade 0.3 palette fire".
 */
function stageFromWords(words) {
  const w = words.trim().split(/\s+/), spec = {sheet: w[0]};
  for (let i = 1; i < w.length; i++) {
    if (w[i] === 'grow') { spec.grow = [Number(w[i + 1]), Number(w[i + 2])]; i += 2; }
    else if (w[i] === 'fade') spec.fade = Number(w[++i]);
    else if (w[i] === 'scale') spec.scale = Number(w[++i]);
    else if (w[i] === 'palette') spec.palette = w[++i];
    else if (w[i] === 'light') spec.light = true;
  }
  return spec;
}

function defaultStage(family, stage) {
  const form = battleFxFamilyForm(family), palette = battleFxFamilyPalette(family) ?? 'neutral';
  const object = OBJECT_SHEET[moveVfxObjectOfFamily(family)] ?? null;
  if (form === 'smoke') return {sheet: 'mist', grow: [0.35, 1.1], fade: 0.4};
  if (stage === 'hit' || stage === 'extra') return {sheet: object === 'mist' ? 'mist' : HIT_BY_PALETTE[palette] ?? 'burst', grow: [0.8, 1.25], fade: 0.4};
  if (form === 'beam') return {sheet: 'beam', light: true};
  if (form === 'area') return {sheet: object ?? 'burst'};
  if (stage === 'launch' || stage === 'prepare') return object ? {sheet: object, scale: 0.8} : {sheet: 'flare', light: true, scale: 0.8};
  if (form === 'stream') return {sheet: palette === 'toxic' ? 'mist' : 'comet'};
  return {sheet: object ?? SHOT_BY_PALETTE[palette] ?? 'orb'};
}

/**
 * The look of one cell, or null when it cannot be remade: {palette, layers}
 * with each layer's box in native pixels relative to the cell's origin.
 */
export function remadeCellLook(bankId, cell, reference) {
  const family = battleFxFamilyName(bankId), place = placeOf(bankId, cell);
  if (!family || !place || !reference || reference.blank) return null;
  const brief = REMADE_EFFECT_BRIEFS[family] ?? null;
  const stage = STAGE.get(`${bankId}:${place.sequence}`) ?? (place.sequence === 0 ? 'launch' : place.sequence === 1 ? 'body' : 'hit');
  const written = brief?.sequences?.[place.sequence];
  const spec = typeof written === 'string' ? stageFromWords(written) : written ?? defaultStage(family, stage);
  const frame = spec.frames?.[place.index] ?? {};
  const [, , fw, fh] = reference.frame, [ox, oy] = reference.origin;
  const progress = place.count > 1 ? place.index / (place.count - 1) : 1;
  const t = frame.t ?? (place.count > 1 ? place.index / place.count : 0);
  const palette = paletteOf(frame.palette ?? spec.palette ?? brief?.palette ?? battleFxFamilyPalette(family));
  // Default box: the whole cell frame, inset one native pixel and scaled about the origin;
  // `grow: [from, to]` scales it across the sequence, `fade: a` thins the second half towards alpha a.
  const k = frame.scale ?? (spec.grow ? spec.grow[0] + (spec.grow[1] - spec.grow[0]) * progress : spec.scale ?? 1);
  const fadeAlpha = spec.fade !== undefined && progress > 0.5 ? 1 - (1 - spec.fade) * (progress - 0.5) * 2 : 1;
  const whole = [(-ox + 1) * k, (-oy + 1) * k, (fw - 2) * k, (fh - 2) * k];
  const layers = (frame.layers ?? spec.layers ?? [{}]).map(layer => ({
    sheet: layer.sheet ?? frame.sheet ?? spec.sheet, box: layer.box ?? frame.box ?? spec.box ?? whole,
    t: layer.t ?? t, alpha: (layer.alpha ?? frame.alpha ?? 1) * fadeAlpha, light: layer.light ?? spec.light ?? LIGHT.has(layer.sheet ?? frame.sheet ?? spec.sheet),
    flipX: Boolean(layer.flipX ?? frame.flipX), palette: layer.palette ? paletteOf(layer.palette) : palette
  }));
  return {family, stage, sequence: place.sequence, index: place.index, briefed: Boolean(brief), layers};
}

/**
 * Wraps a loaded battle effect art (same getCell/dispose contract): a cell that
 * only the reference atlas has comes back remade; original cells pass through.
 */
export function createRemadeEffectArt({PIXI, base, doc = globalThis.document}) {
  if (!base || !doc) return base;
  const probe = doc.createElement?.('canvas')?.getContext?.('2d');
  if (typeof probe?.createImageData !== 'function') return base;
  const noise = createNoiseField(64, 0x5ce1);
  const cells = new Map(), S = REMADE_CELL_SCALE;
  let remade = 0, briefed = 0;
  function remake(bankId, cell, reference) {
    const look = remadeCellLook(bankId, cell, reference);
    if (!look) return null;
    const [, , fw, fh] = reference.frame, [ox, oy] = reference.origin;
    const canvas = paintMoveVfxCell({width: fw * S, height: fh * S, doc, noise, layers: look.layers.map(layer => ({
      name: layer.sheet, palette: layer.palette, t: layer.t, light: layer.light, alpha: layer.alpha, flipX: layer.flipX,
      box: [(ox + layer.box[0]) * S, (oy + layer.box[1]) * S, layer.box[2] * S, layer.box[3] * S]}))});
    if (!canvas) return null;
    const texture = PIXI.Texture.from(canvas);
    if (texture.source) texture.source.scaleMode = 'nearest';
    remade++; if (look.briefed) briefed++;
    return {...reference, texture, frame: [0, 0, fw * S, fh * S], origin: [ox * S, oy * S], pixelsPerNativePixel: S,
      artSource: REMADE_CELL_SOURCE, remade: {family: look.family, stage: look.stage, briefed: look.briefed}};
  }
  return {
    ...base,
    assetId: base.assetId,
    getCell(bankId, cell) {
      const reference = base.getCell(bankId, cell);
      if (!reference || reference.artSource || reference.blank) return reference;
      const key = `${bankId}:${cell}`;
      if (!cells.has(key)) cells.set(key, remake(bankId, cell, reference));
      return cells.get(key) ?? reference;
    },
    getRemadeDiagnostics: () => ({remade, briefed, cached: cells.size}),
    /** Free the remade textures only; the base art stays with whoever loaded it. */
    releaseRemade() {
      for (const entry of cells.values()) entry?.texture.destroy(true);
      cells.clear();
    },
    dispose() { this.releaseRemade(); return base.dispose?.(); }
  };
}
