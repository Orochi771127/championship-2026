// Move set pieces (BESPOKE_MOVE_VFX_PROGRAM_20261111): the bespoke moment of a
// move. moveVfxChoreography.js says which piece a move plays at release and on
// contact, how large, and with what hit-stop, shake and knock.
//
// Refinement pass 1 (Owner 2026-11-11:「不要看起來很像卡通」「很廉價」「像小朋友畫的」;
// look at the original, Pokemon Arena 2D and pixelfx): the pieces were drawn
// objects -- a fist, a mouth, a shield -- with a dark outline. The original's
// hit effects are energy: a white-hot core, a hue rim, sharp rays and sparks,
// no outline, no drawn object. Each piece now plays a pixelfx effect baked to
// that finish (moveVfxPieceSprites.js, scripts/vfx/bake-move-piece-vfx.mjs),
// recoloured per move by brightness: white core, core, core/main, main, edge.
//
//   jaws       two rows of claw rakes close from above and below (a bite)
//   jaws-horn  the bite, then a thrust drives through it
//   horn       a thrust of light through the target along the blow
//   claws      three claw rakes
//   core       a burst of fire and embers
//   fist       a blunt blow: a white flash and its ring of dust
//   rush       a critical flare: a star of light and its streaks
//   quake      a ground slam: a dome of shock and flying debris
//   spin       a ring slash round the target
//   roar       a thunderclap shock
//   cross      two slashes cross (the double slash, mirrored)
//   slash      one crescent slash
//   scissor    two crescents close like shears
//   iai        one long sweeping cut
//   knives     a flurry of thrown blades
//   stream     a jet of flame along the blow
//   wisps      spirit flames
//   orb        an arcane orb
//   splat      an acid splash on the ground
//   eye        a hex sigil under the target
//   lance      a beam of light
//   rain       stars fall on the target
//   clock      a time-stop dial
//   flurry     a storm of what the move names (leaves, feathers, shards, bubbles, notes, hearts)
//   drop       what the move names falls and bursts (a meteor, a bomb, a rock)
//   bolt       a lightning strike
//   vortex     a black hole
//   vines      a vine whip
//   mist       a poison cloud on the ground
//   wave       a wave crashes
//   muzzle / muzzle-spiral   the release flash at the caster / a charging spell
//   impact-frame             a white star flare held under the hit-stop
//   heal, cleanse, buff-*    the support casts on the receiving body
//
// Presentation only: no clock of its own (the owner calls update with its
// frame delta, 0 during a hit-stop), one recoloured sheet per piece and
// palette, pooled sprites, nearest sampling, whole-pixel positions. The baked
// sheets load on first use (a dynamic import); a piece asked for before they
// arrive is skipped.
import {MOVE_VFX_3D_PIECE_GROUP, MOVE_VFX_3D_PIECE_GROUPS, MOVE_VFX_3D_FALLBACK} from './moveVfxPieceSprites3dIndex.js';
import {decodeStatusAilmentFrame} from '../battleFx/battleStatusAilmentFx.js';

const SINGLE = ['horn', 'claws', 'core', 'fist', 'rush', 'quake', 'spin', 'roar', 'slash', 'iai', 'knives', 'stream', 'wisps', 'orb',
  'splat', 'eye', 'lance', 'rain', 'clock', 'bolt', 'vortex', 'vines', 'mist', 'wave', 'muzzle', 'muzzle-spiral'];
/**
 * Each piece -> its layers: a baked look, an offset in body widths, a mirror
 * and a delay. Flurry and drop pick their look from the choreography's `sprite`.
 */
const LAYERS = Object.freeze({
  ...Object.fromEntries(SINGLE.map(p => [p, [{look: p}]])),
  jaws: [{look: 'jaws', dy: -0.16}, {look: 'jaws', dy: 0.16, flipY: true}],
  'jaws-horn': [{look: 'jaws', dy: -0.16}, {look: 'jaws', dy: 0.16, flipY: true}, {look: 'horn', dx: -0.1, delayMs: 110}],
  cross: [{look: 'cross'}, {look: 'cross', flipY: true, delayMs: 70}],
  scissor: [{look: 'slash', dy: -0.08}, {look: 'slash', dy: 0.08, flipY: true}],
  flurry: [{look: 'flurry'}], drop: [{look: 'drop'}],
  'impact-frame': [{look: 'impact-frame'}],
  heal: [{look: 'heal'}], cleanse: [{look: 'cleanse'}], 'buff-atk': [{look: 'buff-atk'}], 'buff-def': [{look: 'buff-def'}],
  'buff-spd': [{look: 'buff-spd'}], 'buff-hit': [{look: 'buff-hit'}], 'buff-tol': [{look: 'buff-tol'}]
});
export const MOVE_VFX_SET_PIECES = Object.freeze(Object.keys(LAYERS).filter(p => p !== 'impact-frame' && !p.startsWith('buff-') && p !== 'heal' && p !== 'cleanse'));
/** Support pieces: the cast on the receiving body, not a blow. */
export const MOVE_VFX_SUPPORT_PIECES = Object.freeze(['heal', 'cleanse', 'buff-atk', 'buff-def', 'buff-spd', 'buff-hit', 'buff-tol']);
/** Drawings a flurry or a drop may name, and the baked look each plays. */
const FLURRY = Object.freeze({leaf: 'flurry-leaf', feather_sm: 'flurry-feather', shard: 'flurry-shard', bubble_sm: 'flurry-bubble', note: 'flurry-note',
  heart: 'flurry-heart', fish_0: 'flurry-bubble', mushroom: 'flurry-spore', ghost: 'flurry-note', cherry: 'flurry-leaf'});
const DROP = Object.freeze({bomb: 'drop-bomb', mushroom: 'flurry-spore', gear: 'drop-rock', bone: 'drop-rock', cherry: 'drop-rock'});
export const MOVE_VFX_PIECE_DRAWINGS = Object.freeze(Object.keys({...FLURRY, ...DROP}));
/**
 * The frame where a baked look connects (its approach before it): a contact
 * piece starts there, so the hit-stop -- which starts with the hit -- holds the
 * connecting frame. The bake already cut every other wind-up.
 */
export const MOVE_VFX_CONTACT_FRAME = Object.freeze({drop: 7, bolt: 4, rain: 4, splat: 2, wave: 8});

/** Pieces whose artwork travels or cuts along a heading in mid-air and rotates across 360 degrees.
 * Ground-anchored pieces with a flat waterline (`wave`, `quake`) stay upright on the arena floor. */
const DIRECTIONAL_PIECES = new Set([
  'slash', 'claws', 'iai', 'cross', 'scissor', 'horn', 'rush', 'lance', 'stream',
  'knives', 'vines', 'muzzle', 'flurry-leaf', 'flurry-feather', 'flurry-shard', 'flurry-bubble',
  // 00GameDevs MIT directional 3D->PixelFX hero pieces (right-facing 0 rad, upright flip when aiming left)
  'gd-radiant-beam', 'gd-arc-ray', 'gd-ice-lance', 'gd-lightning-arrow', 'gd-fireball',
  'gd-shadow-glaive', 'gd-azure-sweep', 'gd-sword-wave',
  'gd-charged-beam', 'gd-venom-stream', 'gd-soul-siphon'
]);

/** 00GameDevs MIT 3D->PixelFX Batch 1 + Batch 2 (48) hero pieces & their instant pixelfx fallbacks before lazy load finishes. */
export const MOVE_VFX_00GAMEDEVS_FALLBACK = Object.freeze({
  // Batch 1 (24 core archetype animations)
  'gd-thousand-slashes': 'cross',
  'gd-azure-sweep': 'slash',
  'gd-dimensional-rend': 'iai',
  'gd-sword-wave': 'slash',
  'gd-shadow-glaive': 'spin',
  'gd-fireball': 'core',
  'gd-ice-lance': 'horn',
  'gd-lightning-arrow': 'bolt',
  'gd-radiant-beam': 'lance',
  'gd-arc-ray': 'bolt',
  'gd-meteor-strike': 'drop',
  'gd-thunder-strike': 'bolt',
  'gd-frost-lance-rain': 'rain',
  'gd-celestial-rain': 'rain',
  'gd-tidal-surge': 'wave',
  'gd-flame-surge': 'wave',
  'gd-lightning-tornado': 'vortex',
  'gd-astral-vortex': 'vortex',
  'gd-shockwave': 'quake',
  'gd-darkchain-burst': 'vortex',
  'gd-ice-pillar': 'quake',
  'gd-thorn-crown': 'vines',
  'gd-prism-parry': 'ring-pop',
  'gd-healing-field': 'heal',
  // Batch 2 (24 elemental ultimates, combo vortexes, beams, traps, buffs & shields)
  'gd-hellfire-pillar': 'drop',
  'gd-dark-pillar': 'vortex',
  'gd-dark-lightning': 'bolt',
  'gd-starblade-cataclysm': 'lance',
  'gd-starblade-explosion': 'core',
  'gd-golden-chain-rain': 'rain',
  'gd-arcane-arrow-rain': 'rain',
  'gd-magma-fissure': 'quake',
  'gd-ground-freeze': 'mark-frost',
  'gd-ice-shatter': 'flurry-shard',
  'gd-energy-burst': 'roar',
  'gd-fire-vortex': 'vortex',
  'gd-wind-vortex': 'vortex',
  'gd-dust-devil': 'vortex',
  'gd-charged-beam': 'lance',
  'gd-venom-stream': 'stream',
  'gd-soul-siphon': 'wisps',
  'gd-binding-curse': 'eye',
  'gd-venom-pool': 'mist',
  'gd-burning-ground': 'core',
  'gd-frost-field': 'mark-frost',
  'gd-verdant-heal': 'heal',
  'gd-revival-bloom': 'buff-atk',
  'gd-prism-guard': 'buff-def'
});
export const MOVE_VFX_00GAMEDEVS_KEYS = Object.freeze(Object.keys(MOVE_VFX_00GAMEDEVS_FALLBACK));

/** The bloom's strength over the colour (pixelfx adds its light at full; a bright arena takes a little less). */
export const GLOW_ALPHA = 0.85;

const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const luma = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/**
 * A baked look's palette in a move's palette {core, main, edge}: each key's
 * brightness picks a step from white-hot to the edge; grey smoke and dust stay
 * grey (a little tinted). `flat` paints every key white (the impact frame).
 */
export function recolourPiecePalette(palette, {core, main, edge, flat = false}) {
  const C = rgb(core), M = rgb(main), E = rgb(edge), white = [255, 255, 255];
  return palette.map(([r, g, b, a]) => {
    if (flat) return [255, 255, 255, a];
    const L = luma([r, g, b]), sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 24 && L > 0.25 && L < 0.72) return [...mix([r, g, b], M, 0.18), a];
    const to = L >= 0.93 ? mix(C, white, 0.6) : L >= 0.78 ? C : L >= 0.6 ? mix(M, C, 0.5) : L >= 0.4 ? M : L >= 0.22 ? E : mix(E, [0, 0, 0], 0.45);
    return [...to, a];
  });
}

/** The baked look a piece layer plays. */
function lookName(layer, drawing, piece) {
  if (layer.look === 'flurry') return FLURRY[drawing] ?? 'flurry-leaf';
  if (layer.look === 'drop') return DROP[drawing] ?? 'drop';
  return layer.look ?? piece;
}

let bakedPromise = null, baked = null;
let baked00GdPromise = null, baked00Gd = null;
// Three.js pieces (UNIFIED_MOVES_20261118): small group modules loaded when a move needs one.
const baked3d = {}, groupLoads = new Map();
const lookOf = name => baked?.[name] ?? baked00Gd?.[name] ?? baked3d[name] ?? null;
const is3d = name => typeof name === 'string' && name.startsWith('3d-');
const is00Gd = name => typeof name === 'string' && name.startsWith('gd-');
/** Load the 00GameDevs MIT 3D->PixelFX Batch 1 + Batch 2 sprite sheets on demand (lazy, zero boot cost). */
export function loadMoveVfx00GameDevsSprites() {
  baked00GdPromise ??= Promise.all([
    import('./moveVfx00GameDevsSprites.js').then(m => m.MOVE_VFX_00GAMEDEVS_SPRITES).catch(() => null),
    import('./moveVfx00GameDevsBatch2Sprites.js').then(m => m.MOVE_VFX_00GAMEDEVS_BATCH2_SPRITES).catch(() => null)
  ]).then(([b1, b2]) => {
    if (!b1 && !b2) return null;
    baked00Gd = Object.freeze({ ...(b1 ?? {}), ...(b2 ?? {}) });
    return baked00Gd;
  });
  return baked00GdPromise;
}
/** Resolve a 00GameDevs MIT hero animation upgrade for a move archetype / piece + element palette (48 pieces across Batch 1 + 2). */
export function resolve00GameDevsPiece({ piece = null, archetype = null, paletteKey = 'fire', tier = 'standard' } = {}) {
  let candidate = null;
  if (archetype) {
    switch (archetype) {
      case 'FLURRY_COMBO': candidate = 'gd-thousand-slashes'; break;
      case 'SHADOW_BACKSTAB': candidate = 'gd-dimensional-rend'; break;
      case 'UTURN_STRIKE': candidate = 'gd-sword-wave'; break;
      case 'MULTI_DASH': candidate = 'gd-shadow-glaive'; break;
      case 'STREAM_BEAM':
        candidate = tier === 'ultimate'
          ? ((paletteKey === 'light' || paletteKey === 'fire') ? 'gd-starblade-cataclysm' : 'gd-charged-beam')
          : (paletteKey === 'toxic' || paletteKey === 'poison') ? 'gd-venom-stream'
            : paletteKey === 'dark' ? 'gd-soul-siphon'
              : (paletteKey === 'thunder' || paletteKey === 'wind') ? 'gd-arc-ray'
                : 'gd-radiant-beam';
        break;
      case 'METEOR_RAIN':
        candidate = paletteKey === 'dark' ? (tier === 'ultimate' ? 'gd-dark-pillar' : 'gd-dark-lightning')
          : paletteKey === 'thunder' ? 'gd-thunder-strike'
            : (paletteKey === 'ice' || paletteKey === 'water') ? 'gd-frost-lance-rain'
              : paletteKey === 'fire' ? (tier === 'ultimate' ? 'gd-hellfire-pillar' : 'gd-meteor-strike')
                : paletteKey === 'earth' ? 'gd-meteor-strike'
                  : paletteKey === 'metal' ? 'gd-golden-chain-rain'
                    : (paletteKey === 'wind' || paletteKey === 'nature') ? 'gd-arcane-arrow-rain'
                      : 'gd-celestial-rain';
        break;
      case 'VORTEX_PULL':
        candidate = paletteKey === 'fire' ? 'gd-fire-vortex'
          : (paletteKey === 'wind' || paletteKey === 'nature') ? 'gd-wind-vortex'
            : (paletteKey === 'earth' || paletteKey === 'metal') ? 'gd-dust-devil'
              : paletteKey === 'thunder' ? 'gd-lightning-tornado'
                : 'gd-astral-vortex';
        break;
      case 'DRAG_WAVE':
        candidate = (paletteKey === 'fire' || paletteKey === 'earth' || paletteKey === 'dark') ? 'gd-flame-surge' : 'gd-tidal-surge';
        break;
      case 'SHOCKWAVE_RING':
      case 'LEAP_SLAM':
      case 'GRAB_SLAM':
        candidate = paletteKey === 'ice' ? 'gd-ice-shatter'
          : paletteKey === 'thunder' ? 'gd-energy-burst'
            : (paletteKey === 'fire' && tier === 'ultimate') ? 'gd-starblade-explosion'
              : (paletteKey === 'fire' || paletteKey === 'earth') ? 'gd-magma-fissure'
                : 'gd-shockwave';
        break;
      case 'GUARD_BREAK_SLAM':
        candidate = paletteKey === 'dark' ? 'gd-dark-pillar'
          : (paletteKey === 'light' || paletteKey === 'fire') ? 'gd-starblade-explosion'
            : 'gd-darkchain-burst';
        break;
      case 'TELEKINESIS_SLAM':
        candidate = 'gd-binding-curse'; break;
      case 'BURROW_AMBUSH':
        candidate = paletteKey === 'fire' ? 'gd-hellfire-pillar'
          : paletteKey === 'ice' ? 'gd-ice-pillar'
            : (paletteKey === 'nature' || paletteKey === 'wood') ? 'gd-thorn-crown'
              : 'gd-magma-fissure';
        break;
      case 'GROUND_SPIKES':
        candidate = paletteKey === 'fire' ? 'gd-burning-ground'
          : paletteKey === 'ice' ? 'gd-ground-freeze'
            : (paletteKey === 'dark' || paletteKey === 'toxic') ? 'gd-venom-pool'
              : (paletteKey === 'nature' || paletteKey === 'wood') ? 'gd-thorn-crown'
                : 'gd-ice-pillar';
        break;
      case 'PROTECT_COUNTER':
        candidate = piece === 'buff-def' ? 'gd-prism-guard' : 'gd-prism-parry'; break;
      case 'RECOVERY_SUPPORT':
        candidate = paletteKey === 'nature' ? 'gd-verdant-heal' : 'gd-healing-field'; break;
      case 'SELF_BUFF':
        candidate = piece === 'buff-def' ? 'gd-prism-guard' : 'gd-revival-bloom'; break;
      case 'HOMING_ORB':
        candidate = paletteKey === 'dark' ? 'gd-soul-siphon' : 'gd-fireball'; break;
      case 'VOLLEY_BARRAGE':
        candidate = (paletteKey === 'thunder' || paletteKey === 'light') ? 'gd-lightning-arrow' : 'gd-ice-lance';
        break;
      default: break;
    }
  }
  if (!candidate && piece) {
    if (piece === 'drop' || piece === 'drop-bomb' || piece === 'drop-rock') candidate = (paletteKey === 'dark') ? 'gd-dark-pillar' : 'gd-meteor-strike';
    else if (piece === 'bolt') candidate = paletteKey === 'dark' ? 'gd-dark-lightning' : 'gd-thunder-strike';
    else if (piece === 'rain') candidate = (paletteKey === 'ice' || paletteKey === 'water') ? 'gd-frost-lance-rain'
      : paletteKey === 'metal' ? 'gd-golden-chain-rain'
        : (paletteKey === 'wind' || paletteKey === 'nature') ? 'gd-arcane-arrow-rain' : 'gd-celestial-rain';
    else if (piece === 'vortex') candidate = paletteKey === 'fire' ? 'gd-fire-vortex'
      : paletteKey === 'wind' ? 'gd-wind-vortex'
        : paletteKey === 'earth' ? 'gd-dust-devil'
          : paletteKey === 'thunder' ? 'gd-lightning-tornado' : 'gd-astral-vortex';
    else if (piece === 'quake') candidate = paletteKey === 'ice' ? 'gd-ice-shatter'
      : (paletteKey === 'fire' || paletteKey === 'earth') ? 'gd-magma-fissure' : 'gd-shockwave';
    else if (piece === 'roar') candidate = 'gd-energy-burst';
    else if (piece === 'wave') candidate = (paletteKey === 'fire' || paletteKey === 'earth') ? 'gd-flame-surge' : 'gd-tidal-surge';
    else if (piece === 'iai') candidate = 'gd-dimensional-rend';
    else if (piece === 'cross' || piece === 'spin') candidate = tier === 'ultimate' ? 'gd-thousand-slashes' : 'gd-azure-sweep';
    else if (piece === 'slash' || piece === 'scissor') candidate = 'gd-azure-sweep';
    else if (piece === 'lance' || piece === 'stream') candidate = tier === 'ultimate' ? 'gd-charged-beam'
      : (paletteKey === 'toxic' || paletteKey === 'poison') ? 'gd-venom-stream'
        : (paletteKey === 'thunder' || paletteKey === 'dark') ? 'gd-arc-ray' : 'gd-radiant-beam';
    else if (piece === 'core') candidate = tier === 'ultimate' ? 'gd-starblade-explosion' : 'gd-fireball';
    else if (piece === 'eye') candidate = 'gd-binding-curse';
    else if (piece === 'mist' || piece === 'splat') candidate = 'gd-venom-pool';
    else if (piece === 'wisps') candidate = paletteKey === 'dark' ? 'gd-soul-siphon' : 'gd-burning-ground';
    else if (piece === 'mark-frost') candidate = 'gd-frost-field';
    else if (piece === 'vines') candidate = 'gd-thorn-crown';
    else if (piece === 'heal') candidate = paletteKey === 'nature' ? 'gd-verdant-heal' : 'gd-healing-field';
    else if (piece === 'buff-def') candidate = 'gd-prism-guard';
    else if (piece === 'buff-atk' || piece === 'buff-spd' || piece === 'cleanse') candidate = 'gd-revival-bloom';
  }
  if (candidate && baked00Gd?.[candidate]) return candidate;
  return piece;
}
/** Load the group modules holding these three.js pieces (other names are ignored). */
export function loadMoveVfx3dPieces(names) {
  const groups = new Set([...(names ?? [])].filter(is3d).map(n => MOVE_VFX_3D_PIECE_GROUP[n]).filter(Boolean));
  return Promise.all([...groups].map(g => {
    if (!groupLoads.has(g)) groupLoads.set(g, MOVE_VFX_3D_PIECE_GROUPS[g]().then(m => { Object.assign(baked3d, m.MOVE_VFX_PIECE_SPRITES); return true; }).catch(() => false));
    return groupLoads.get(g);
  })).then(r => r.every(Boolean));
}
/** Load the baked sheets once (the module is large, so not part of the first load). */
export function loadMoveVfxPieceSprites() {
  loadMoveVfx00GameDevsSprites();
  bakedPromise ??= import('./moveVfxPieceSprites.js').then(m => { baked = m.MOVE_VFX_PIECE_SPRITES; return baked; }).catch(() => null);
  return bakedPromise;
}

/** A baked look once the sheets are in (null before): the kit reads its floor circles from here. */
export function bakedPieceLook(name) { return lookOf(name); }
function applyDarkPixelRim(data, w, h, edgeHex) {
  const [er, eg, eb] = mix(rgb(edgeHex), [12, 16, 28], 0.58);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= 120) mask[i] = 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (mask[idx]) continue;
      if (mask[idx - 1] || mask[idx + 1] || mask[idx - w] || mask[idx + w]) {
        const o = idx * 4;
        data[o] = er; data[o + 1] = eg; data[o + 2] = eb; data[o + 3] = 240;
      }
    }
  }
}

/**
 * One baked look as canvases in a palette: `glow` false gives the colour
 * frames (w x h), true the light layer (gw x gh, to be drawn 2x and added).
 */
export function paintBakedPieceFrames(name, palette, {doc = globalThis.document, glow = false, outline = false} = {}) {
  const look = lookOf(name);
  if (!look || (glow && !look.glow?.length)) return null;
  const tinted = glow ? null : {...look, palette: recolourPiecePalette(look.palette, palette)};
  const M = rgb(palette.main), C = rgb(palette.core), w = glow ? look.gw : look.w, h = glow ? look.gh : look.h;
  const frames = [];
  for (let i = 0; i < (glow ? look.glow : look.frames).length; i++) {
    const canvas = doc?.createElement?.('canvas'), context = canvas?.getContext?.('2d');
    if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') return null;
    canvas.width = w; canvas.height = h;
    const image = context.createImageData(w, h);
    if (!glow) {
      image.data.set(decodeStatusAilmentFrame(tinted, i));
      if (outline && !palette.flat) applyDarkPixelRim(image.data, w, h, palette.edge);
    } else {
      const rows = look.glow[i].split('/');
      for (let y = 0; y < h; y++) {
        let x = 0;
        for (const [, k, count] of (rows[y] ?? '').matchAll(/([^0-9])(\d*)/g)) {
          const run = count ? Number(count) : 1;
          if (k !== '.') { const v = ('abcdefgh'.indexOf(k) + 0.5) / 8, c = mix(M, C, v); for (let q = 0; q < run; q++) image.data.set([c[0], c[1], c[2], Math.round(v * 255)], (y * w + x + q) * 4); }
          x += run;
        }
      }
    }
    context.putImageData(image, 0, 0);
    frames.push(canvas);
  }
  return {frames, w, h, ox: glow ? look.ox / 2 : look.ox, oy: glow ? look.oy / 2 : look.oy};
}

export function createMoveVfxSetPieces({PIXI, layer, reducedMotion = false, doc = globalThis.document, sprites: given = null, outline = false}) {
  if (given) baked = given; else loadMoveVfxPieceSprites();
  const sheets = new Map(), live = [], pool = [];
  const stats = {played: 0, peak: 0, skipped: 0};

  function sheet(name, palette) {
    const look = lookOf(name);
    if (!look) return null;
    const key = `${name}:${palette.main}:${palette.core}:${palette.edge}:${palette.flat ? 1 : 0}:${outline ? 1 : 0}`;
    if (sheets.has(key)) return sheets.get(key);
    const tinted = {...look, palette: recolourPiecePalette(look.palette, palette)};
    const n = look.frames.length, canvas = doc?.createElement?.('canvas');
    const context = canvas?.getContext?.('2d');
    // A canvas that cannot paint pixels (a headless stub) draws no piece rather than failing the hit.
    if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { sheets.set(key, null); return null; }
    canvas.width = look.w * n; canvas.height = look.h;
    for (let i = 0; i < n; i++) {
      const image = context.createImageData(look.w, look.h);
      image.data.set(decodeStatusAilmentFrame(tinted, i));
      if (outline && !palette.flat) applyDarkPixelRim(image.data, look.w, look.h, palette.edge);
      context.putImageData(image, i * look.w, 0);
    }
    const base = PIXI.Texture.from(canvas);
    base.source.scaleMode = 'nearest';
    const textures = Array.from({length: n}, (_, i) => new PIXI.Texture({source: base.source, frame: new PIXI.Rectangle(i * look.w, 0, look.w, look.h)}));
    const value = {base, textures, look, canvas};
    sheets.set(key, value);
    return value;
  }
  // The light layer (pixelfx's bloom): intensity keys a..h, in the move's main toward its core, added over the colour.
  function glowSheet(name, palette) {
    const look = lookOf(name);
    if (!look?.glow?.length || palette.flat) return null;
    const key = `glow:${name}:${palette.main}:${palette.core}`;
    if (sheets.has(key)) return sheets.get(key);
    const n = look.glow.length, w = look.gw, h = look.gh, canvas = doc?.createElement?.('canvas');
    const context = canvas?.getContext?.('2d');
    if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { sheets.set(key, null); return null; }
    canvas.width = w * n; canvas.height = h;
    const M = rgb(palette.main), C = rgb(palette.core);
    for (let i = 0; i < n; i++) {
      const image = context.createImageData(w, h), rows = look.glow[i].split('/');
      for (let y = 0; y < h; y++) {
        let x = 0;
        for (const [, k, count] of (rows[y] ?? '').matchAll(/([^0-9])(\d*)/g)) {
          const run = count ? Number(count) : 1;
          if (k !== '.') {
            const v = ('abcdefgh'.indexOf(k) + 0.5) / 8, c = mix(M, C, v);
            for (let q = 0; q < run; q++) image.data.set([c[0], c[1], c[2], Math.round(v * 255)], (y * w + x + q) * 4);
          }
          x += run;
        }
      }
      context.putImageData(image, i * w, 0);
    }
    const base = PIXI.Texture.from(canvas);
    base.source.scaleMode = 'linear';
    const textures = Array.from({length: n}, (_, i) => new PIXI.Texture({source: base.source, frame: new PIXI.Rectangle(i * w, 0, w, h)}));
    const value = {base, textures, look, canvas};
    sheets.set(key, value);
    return value;
  }
  function take(texture) {
    const s = pool.pop() ?? new PIXI.Sprite(texture);
    if (!s.parent) layer.addChild(s);
    s.texture = texture; s.visible = true; s.alpha = 1; s.rotation = 0; s.tint = 0xffffff; s.eventMode = 'none';
    return s;
  }
  function release(s) { if (s) { s.visible = false; s.blendMode = 'normal'; pool.push(s); } }

  return Object.freeze({
    /** Resolves once the baked sheets are in (tests and review pages wait on it). */
    ready: () => (baked ? Promise.resolve(true) : loadMoveVfxPieceSprites().then(Boolean)),
    /**
     * Play `piece` at (x, y): `angle` is the blow's heading, `size` the struck
     * (or casting) body's width in world px, `unit` world px per native pixel
     * (keeps a texel near the fighters' own pixels), `groundY` that body's feet,
     * `palette` {core, main, edge}. `at: 'contact'` starts on the connecting
     * frame. Returns false when the piece is unknown or not loaded yet.
     */
    play(piece, {x, y, groundY = null, angle = 0, palette, size = 80, unit = null, scale = 1, fast = false, sprite: drawing = null, at = null}) {
      // a three.js / 00GameDevs piece plays as one layer; until loaded, the shared pixelfx piece it replaces plays
      const layers = LAYERS[piece]
        ?? (is00Gd(piece) && MOVE_VFX_00GAMEDEVS_FALLBACK[piece] ? [{look: piece}]
          : (is3d(piece) && MOVE_VFX_3D_PIECE_GROUP[piece] ? [{look: piece}] : (baked?.[piece] ? [{look: piece}] : null)));
      if (!layers || !palette) return false;
      if (is00Gd(piece) && !lookOf(piece)) {
        loadMoveVfx00GameDevsSprites();
        const base = MOVE_VFX_00GAMEDEVS_FALLBACK[piece];
        return base ? this.play(base, arguments[1]) : false;
      }
      if (is3d(piece) && !lookOf(piece)) {
        loadMoveVfx3dPieces([piece]);
        const base = MOVE_VFX_3D_FALLBACK[piece];
        return base ? this.play(base, arguments[1]) : false;
      }
      const facing = Math.cos(angle) < 0 ? -1 : 1, u = unit > 0 ? unit : size / 64;
      const directional = DIRECTIONAL_PIECES.has(piece);
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const parts = [];
      for (const l of layers) {
        const name = lookName(l, drawing, piece), art = sheet(name, palette);
        if (!art) { parts.forEach(p => { release(p.sprite); release(p.glow); }); stats.skipped++; return false; }
        const look = art.look;
        const rotLayer = directional || DIRECTIONAL_PIECES.has(name);
        // the look spans `fit` body widths, kept between half and 1.25 of a fighter's pixel per texel
        const texel = Math.min(u * 1.25, Math.max(u * 0.5, size * look.fit / look.w)) * scale;
        const s = take(art.textures[0]);
        s.anchor.set(look.ox / look.w, look.oy / look.h);
        // Directional pixel art (waves, slashes, beams, streams, claws) rotates smoothly in 360 deg
        // while keeping its top silhouette right-side-up when aiming left (cos(angle) < 0)!
        const sx = rotLayer ? texel : texel * facing;
        const sy = texel * (rotLayer && facing < 0 ? -1 : 1) * (l.flipY ? -1 : 1);
        s.scale.set(sx, sy);
        s.rotation = rotLayer ? angle : 0;
        const ground = look.anchor === 'ground' && !rotLayer;
        const ldx = (l.dx ?? 0) * size, ldy = (l.dy ?? 0) * size;
        const ox = rotLayer ? (cosA * ldx - sinA * ldy) : facing * ldx;
        const oy = rotLayer ? (sinA * ldx + cosA * ldy) : ldy;
        const px = x + ox, py = (ground ? (groundY ?? y + size * 0.6) : y) + oy;
        s.position.set(Math.round(px), Math.round(py));
        const fps = look.fps * (fast ? 1.28 : 1), start = at === 'contact' ? (MOVE_VFX_CONTACT_FRAME[name] ?? 0) : 0;
        s.visible = !(l.delayMs > 0);
        // the bloom: half resolution, the same box, added over the colour
        const g = glowSheet(name, palette);
        let glow = null;
        if (g) {
          glow = take(g.textures[0]);
          glow.blendMode = 'add'; glow.alpha = GLOW_ALPHA;
          glow.anchor.set(look.ox / 2 / look.gw, look.oy / 2 / look.gh);
          glow.scale.set(sx * 2, sy * 2);
          glow.rotation = s.rotation;
          glow.position.set(s.position.x, s.position.y);
          glow.visible = s.visible;
        }
        parts.push({sprite: s, glow, art, gart: g, fps, ms: start / fps * 1000 - (l.delayMs ?? 0)});
      }
      if (piece === 'impact-frame' && typeof layer.addChildAt === 'function') for (const p of parts) layer.addChildAt(p.sprite, 0);
      else if (typeof layer.addChild === 'function') for (const p of parts) { layer.addChild(p.sprite); if (p.glow) layer.addChild(p.glow); }
      live.push({piece, parts});
      stats.played++; stats.peak = Math.max(stats.peak, live.length);
      this.update(0);
      return true;
    },
    update(dtMs) {
      const step = Math.max(0, dtMs || 0);
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        let alive = false;
        for (const part of p.parts) {
          part.ms += step;
          const n = part.art.textures.length;
          // Reduced motion: the strongest frame briefly instead of the whole bloom.
          const index = reducedMotion ? (part.ms < 160 ? Math.min(n - 1, Math.floor(n / 4)) : n) : Math.floor(part.ms / 1000 * part.fps);
          if (part.ms < 0) { part.sprite.visible = false; if (part.glow) part.glow.visible = false; alive = true; continue; }
          if (index >= n) { part.sprite.visible = false; if (part.glow) part.glow.visible = false; continue; }
          part.sprite.visible = true; part.sprite.texture = part.art.textures[index]; alive = true;
          if (part.glow) { part.glow.visible = true; part.glow.texture = part.gart.textures[Math.min(index, part.gart.textures.length - 1)]; }
        }
        if (!alive) { p.parts.forEach(q => { release(q.sprite); release(q.glow); }); live.splice(i, 1); }
      }
    },
    getDiagnostics: () => Object.freeze({...stats, live: live.length, textures: sheets.size, loaded: Boolean(baked)}),
    dispose() {
      for (const p of live.splice(0)) p.parts.forEach(q => { release(q.sprite); release(q.glow); });
      for (const s of pool.splice(0)) { s.parent?.removeChild(s); s.destroy(); }
      for (const art of sheets.values()) if (art) {
        for (const t of art.textures) t.destroy(false);
        art.base.destroy(true);
        if (art.canvas) { art.canvas.width = 0; art.canvas.height = 0; }
      }
      sheets.clear();
    }
  });
}
