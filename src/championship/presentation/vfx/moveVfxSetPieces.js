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
/** Load the baked sheets once (the module is large, so not part of the first load). */
export function loadMoveVfxPieceSprites() {
  bakedPromise ??= import('./moveVfxPieceSprites.js').then(m => { baked = m.MOVE_VFX_PIECE_SPRITES; return baked; }).catch(() => null);
  return bakedPromise;
}

export function createMoveVfxSetPieces({PIXI, layer, reducedMotion = false, doc = globalThis.document, sprites: given = null}) {
  if (given) baked = given; else loadMoveVfxPieceSprites();
  const sheets = new Map(), live = [], pool = [];
  const stats = {played: 0, peak: 0, skipped: 0};

  function sheet(name, palette) {
    const look = baked?.[name];
    if (!look) return null;
    const key = `${name}:${palette.main}:${palette.core}:${palette.edge}:${palette.flat ? 1 : 0}`;
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
      context.putImageData(image, i * look.w, 0);
    }
    const base = PIXI.Texture.from(canvas);
    base.source.scaleMode = 'nearest';
    const textures = Array.from({length: n}, (_, i) => new PIXI.Texture({source: base.source, frame: new PIXI.Rectangle(i * look.w, 0, look.w, look.h)}));
    const value = {base, textures, look};
    sheets.set(key, value);
    return value;
  }
  // The light layer (pixelfx's bloom): intensity keys a..h, in the move's main toward its core, added over the colour.
  function glowSheet(name, palette) {
    const look = baked?.[name];
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
    const value = {base, textures, look};
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
      const layers = LAYERS[piece];
      if (!layers || !palette) return false;
      const facing = Math.cos(angle) < 0 ? -1 : 1, u = unit > 0 ? unit : size / 64;
      const parts = [];
      for (const l of layers) {
        const name = lookName(l, drawing, piece), art = sheet(name, palette);
        if (!art) { parts.forEach(p => { release(p.sprite); release(p.glow); }); stats.skipped++; return false; }
        const look = art.look;
        // the look spans `fit` body widths, kept between half and 1.25 of a fighter's pixel per texel
        const texel = Math.min(u * 1.25, Math.max(u * 0.5, size * look.fit / look.w)) * scale;
        const s = take(art.textures[0]);
        s.anchor.set(look.ox / look.w, look.oy / look.h);
        s.scale.set(texel * facing, texel * (l.flipY ? -1 : 1));
        const ground = look.anchor === 'ground';
        const px = x + facing * (l.dx ?? 0) * size, py = (ground ? (groundY ?? y + size * 0.6) : y) + (l.dy ?? 0) * size;
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
          glow.scale.set(texel * 2 * facing, texel * 2 * (l.flipY ? -1 : 1));
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
      for (const art of sheets.values()) if (art) { for (const t of art.textures) t.destroy(false); art.base.destroy(true); }
      sheets.clear();
    }
  });
}
