// Move set pieces (BESPOKE_MOVE_VFX_PROGRAM_20261111): the bespoke moment of a
// move, animated from its own pixel drawings (drawnVfxSprites.js, drawn with
// the pxl tool) in the move's palette. moveVfxChoreography.js says which piece
// a move plays at release and on contact.
//
//   jaws           flame jaws drop and rise, snap shut on the target, then let go
//   jaws-horn      the jaws clamp, then a horn drives through them
//   horn           a horn thrusts through the target along the blow
//   claws          three claw marks rake down one after another
//   core           a molten core lands, flashes white and cracks outward
//   muzzle         a muzzle ring pops at the caster as the move goes
//   muzzle-spiral  three rings spin out of the muzzle, one after another
//   fist           a fist drives in along the blow; a star bursts where it lands
//   rush           speed streaks sweep in, then the star of the landing
//   quake          the ground cracks open under the target, a star and a ring
//   spin           rings spin round the target, then a star
//   roar           three widening rings roll out from the caster
//   cross          two blade arcs cut an X
//   slash          one blade arc sweeps through
//   scissor        two blade arcs close like shears
//   iai            a single white line flashes, then the cut shows
//   knives         five knives fly in one after another
//
// Presentation only: no clock of its own (the owner calls update with its frame
// delta, 0 during a hit-stop), textures baked once per piece and palette, pooled
// sprites, nearest sampling, whole-pixel positions.
import {DRAWN_VFX_FIXED, DRAWN_VFX_SPRITES} from './drawnVfxSprites.js';

const PIECE_SPRITES = Object.freeze({
  jaws: ['jaw_top', 'jaw_bottom'], 'jaws-horn': ['jaw_top', 'jaw_bottom', 'horn_tip'], horn: ['horn_tip'],
  claws: ['claw_mark', 'claw_mark', 'claw_mark'], core: ['core'], muzzle: ['muzzle'], 'muzzle-spiral': ['muzzle', 'muzzle', 'muzzle'],
  fist: ['fist', 'impact_star'], rush: ['streaks', 'streaks', 'impact_star'], quake: ['crack', 'impact_star', 'muzzle'],
  spin: ['muzzle', 'muzzle', 'impact_star'], roar: ['muzzle', 'muzzle', 'muzzle'], cross: ['blade_arc', 'blade_arc'],
  slash: ['blade_arc'], scissor: ['blade_arc', 'blade_arc'], iai: ['streaks', 'blade_arc'], knives: ['knife', 'knife', 'knife', 'knife', 'knife']
});
export const MOVE_VFX_SET_PIECES = Object.freeze(Object.keys(PIECE_SPRITES));
const DURATION = Object.freeze({jaws: 420, 'jaws-horn': 560, horn: 380, claws: 440, core: 420, muzzle: 300, 'muzzle-spiral': 460,
  fist: 400, rush: 420, quake: 520, spin: 520, roar: 480, cross: 420, slash: 340, scissor: 420, iai: 460, knives: 520});

const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const easeIn = t => t * t * t;
const easeOut = t => 1 - (1 - t) ** 3;
const clamp01 = t => Math.max(0, Math.min(1, t));
/** Stepped fade (pixel finish): full, then two bands. */
const stepFade = k => (k < 0.55 ? 1 : k < 0.8 ? 0.6 : 0.3);

/** A drawn sprite's RGBA in a palette: o outline, e edge, m main, x main/core, c core; fixed keys keep their colour. */
export function paintSetPieceSprite(name, palette) {
  const sprite = DRAWN_VFX_SPRITES[name];
  if (!sprite) return null;
  const main = rgb(palette.main), core = rgb(palette.core), edge = rgb(palette.edge);
  const tone = {o: edge.map(v => v * 0.38), e: edge, m: main, x: main.map((v, i) => (v + core[i]) / 2), c: core};
  for (const [key, value] of Object.entries(DRAWN_VFX_FIXED)) tone[key] ??= rgb(value);
  const data = new Uint8ClampedArray(sprite.w * sprite.h * 4);
  sprite.rows.forEach((row, y) => [...row].forEach((key, x) => {
    const c = tone[key];
    if (c) data.set([c[0], c[1], c[2], 255], (y * sprite.w + x) * 4);
  }));
  return {w: sprite.w, h: sprite.h, data};
}

export function createMoveVfxSetPieces({PIXI, layer, reducedMotion = false, doc = globalThis.document}) {
  if (!PIXI || !layer || !doc) return null;
  const textures = new Map(), live = [], pool = [];
  const stats = {played: 0, peak: 0};

  function texture(name, palette) {
    const key = `${name}:${palette.main}:${palette.core}:${palette.edge}`;
    if (textures.has(key)) return textures.get(key);
    const painted = paintSetPieceSprite(name, palette), canvas = doc.createElement('canvas');
    const context = canvas.getContext?.('2d');
    if (!painted || typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { textures.set(key, null); return null; }
    canvas.width = painted.w; canvas.height = painted.h;
    const image = context.createImageData(painted.w, painted.h); image.data.set(painted.data); context.putImageData(image, 0, 0);
    const t = PIXI.Texture.from(canvas); t.source.scaleMode = 'nearest';
    textures.set(key, t);
    return t;
  }
  function sprite(name, palette) {
    const t = texture(name, palette);
    if (!t) return null;
    const s = pool.pop() ?? new PIXI.Sprite(t);
    if (!s.parent) layer.addChild(s);
    s.texture = t; s.visible = true; s.alpha = 1; s.rotation = 0; s.tint = 0xffffff; s.eventMode = 'none'; s.anchor.set(0.5);
    return s;
  }
  function release(s) { if (s) { s.visible = false; pool.push(s); } }

  return Object.freeze({
    /**
     * Play `piece` at (x, y): `angle` is the blow's heading, `size` the struck
     * (or casting) body's width in world px, `palette` {core, main, edge}.
     * Returns false when the piece is unknown or cannot be painted.
     */
    play(piece, {x, y, angle = 0, palette, size = 80, scale = 1, fast = false}) {
      if (!DURATION[piece] || !palette) return false;
      const names = PIECE_SPRITES[piece];
      const sprites = names.map(name => sprite(name, palette));
      if (sprites.some(s => !s)) { sprites.forEach(release); return false; }
      // World px per texel: a jaw (44 texels) spans about 0.73 of the body.
      const texel = Math.max(0.8, size / 60) * scale;
      const facing = Math.cos(angle) < 0 ? -1 : 1;
      live.push({piece, sprites, x, y, angle, facing, texel, ms: 0, life: DURATION[piece] * (fast ? 0.78 : 1)});
      stats.played++; stats.peak = Math.max(stats.peak, live.length);
      this.update(0);
      return true;
    },
    update(dtMs) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.ms += Math.max(0, dtMs || 0);
        const k = reducedMotion ? 0.45 : clamp01(p.ms / p.life);
        if (p.ms >= (reducedMotion ? 160 : p.life)) { p.sprites.forEach(release); live.splice(i, 1); continue; }
        pose(p, k);
      }
    },
    getDiagnostics: () => Object.freeze({...stats, live: live.length, textures: textures.size}),
    dispose() {
      for (const p of live.splice(0)) p.sprites.forEach(release);
      for (const s of pool.splice(0)) { s.parent?.removeChild(s); s.destroy(); }
      for (const t of textures.values()) t?.destroy(true);
      textures.clear();
    }
  });

  /** One frame of a piece: k runs 0..1 over its life. */
  function pose(p, k) {
    const {x, y, texel: s, facing} = p, set = (sp, px, py, sx, sy, alpha = 1, rot = 0) => {
      sp.position.set(Math.round(px), Math.round(py)); sp.scale.set(sx * s, sy * s); sp.alpha = alpha; sp.rotation = rot;
    };
    if (p.piece === 'jaws' || p.piece === 'jaws-horn') {
      const [top, bottom, horn] = p.sprites;
      // close (0-0.3), bite and hold (0.3-0.5), let go (0.5-1)
      const close = easeIn(clamp01(k / 0.3)), open = clamp01((k - 0.5) / 0.5);
      const gap = (1 - close) * 26 + 3 + open * 6, squash = k >= 0.3 && k < 0.5 ? 1.08 : 1;
      const alpha = k < 0.5 ? 1 : stepFade(open);
      set(top, x, y - gap * s, squash * facing, 1, alpha);
      set(bottom, x, y + gap * s, squash * facing, 1, alpha);
      if (horn) {
        const thrust = easeOut(clamp01((k - 0.32) / 0.25)), hornAlpha = k < 0.32 ? 0 : k < 0.7 ? 1 : stepFade((k - 0.7) / 0.3);
        set(horn, x + facing * (-36 + thrust * 30) * s, y, facing * (1 + thrust * 0.25), 1, hornAlpha);
      }
    } else if (p.piece === 'horn') {
      const [horn] = p.sprites, thrust = easeOut(clamp01(k / 0.35));
      set(horn, x + facing * (-40 + thrust * 44) * s, y, facing * (1 + (1 - thrust) * 0.4), 1, k < 0.6 ? 1 : stepFade((k - 0.6) / 0.4));
    } else if (p.piece === 'claws') {
      p.sprites.forEach((mark, i) => {
        const start = i * 0.11, grow = easeOut(clamp01((k - start) / 0.14)), fade = clamp01((k - 0.6) / 0.4);
        mark.anchor.set(0.5, 0);
        set(mark, x + facing * (i - 1) * 13 * s, y - 20 * s, facing, grow, grow > 0 ? (fade > 0 ? stepFade(fade) : 1) : 0);
      });
    } else if (p.piece === 'core') {
      const [core] = p.sprites, land = easeOut(clamp01(k / 0.2)), crack = clamp01((k - 0.25) / 0.75);
      set(core, x, y - (1 - land) * 18 * s, 0.4 + 0.6 * land + crack * 0.6, 0.4 + 0.6 * land + crack * 0.6, crack > 0 ? stepFade(crack) : 1);
    } else if (p.piece === 'fist') {
      const [fist, star] = p.sprites, drive = easeIn(clamp01(k / 0.28)), after = clamp01((k - 0.28) / 0.72);
      set(fist, x + facing * (-46 + drive * 34) * s, y, facing * (k < 0.28 ? 1 : 1.12), k < 0.28 ? 1 : 0.88, k < 0.28 ? 1 : stepFade(after));
      set(star, x, y, 0.3 + easeOut(after) * 1.1, 0.3 + easeOut(after) * 1.1, k < 0.28 ? 0 : stepFade(after), after * 0.6);
    } else if (p.piece === 'rush') {
      const [a, b, star] = p.sprites, sweep = easeOut(clamp01(k / 0.3)), after = clamp01((k - 0.3) / 0.7);
      set(a, x + facing * (-60 + sweep * 40) * s, y - 8 * s, facing * (1.4 - sweep * 0.5), 1, k < 0.5 ? 1 : stepFade(after));
      set(b, x + facing * (-70 + sweep * 40) * s, y + 8 * s, facing * (1.4 - sweep * 0.5), 1, k < 0.5 ? 1 : stepFade(after));
      set(star, x, y, 0.4 + easeOut(after) * 1.2, 0.4 + easeOut(after) * 1.2, k < 0.3 ? 0 : stepFade(after));
    } else if (p.piece === 'quake') {
      const [crack, star, ring] = p.sprites, open = easeOut(clamp01(k / 0.35)), after = clamp01((k - 0.2) / 0.8);
      crack.anchor.set(0.5, 0.7);
      set(crack, x, y + 26 * s, 0.4 + open * 0.9, 0.6 + open * 0.6, k < 0.6 ? 1 : stepFade((k - 0.6) / 0.4));
      set(star, x, y, 0.5 + easeOut(after), 0.5 + easeOut(after), k < 0.2 ? 0 : stepFade(after));
      set(ring, x, y + 26 * s, 0.6 + easeOut(after) * 2.2, (0.6 + easeOut(after) * 2.2) * 0.35, k < 0.2 ? 0 : stepFade(after));
    } else if (p.piece === 'spin' || p.piece === 'roar') {
      const spin = p.piece === 'spin';
      p.sprites.forEach((sp, i) => {
        const start = i * 0.18, t = clamp01((k - start) / 0.6);
        if (spin && i === 2) { const after = clamp01((k - 0.5) / 0.5); set(sp, x, y, 0.4 + easeOut(after) * 1.1, 0.4 + easeOut(after) * 1.1, k < 0.5 ? 0 : stepFade(after)); return; }
        const r = spin ? 0.9 + i * 0.25 : 0.6 + easeOut(t) * (1.4 + i * 0.4);
        set(sp, spin ? x : x + facing * (easeOut(t) * 30 * s), y, r, spin ? r * 0.5 : r, t > 0 ? stepFade(t) : 0, spin ? (t * 4 + i) * Math.PI * facing : 0);
      });
    } else if (p.piece === 'cross' || p.piece === 'slash' || p.piece === 'scissor') {
      p.sprites.forEach((arc, i) => {
        const start = p.piece === 'cross' ? i * 0.18 : 0, t = clamp01((k - start) / 0.45), fade = clamp01((k - start - 0.35) / 0.5);
        const sign = i ? -1 : 1, base = p.piece === 'scissor' ? sign * (0.9 - easeIn(t) * 0.9) : p.piece === 'cross' ? sign * 0.7 : -0.5 + t * 1.0;
        set(arc, x + facing * (p.piece === 'slash' ? (-10 + t * 20) * s : 0), y, facing * (0.8 + t * 0.4), sign * (0.8 + t * 0.4), t > 0 ? (fade > 0 ? stepFade(fade) : 1) : 0, base * facing);
      });
    } else if (p.piece === 'iai') {
      const [line, arc] = p.sprites, flash = clamp01(k / 0.15), cut = clamp01((k - 0.35) / 0.65);
      set(line, x, y, facing * (0.4 + flash * 2.4), 0.25, k < 0.35 ? 1 : 0);
      line.tint = 0xffffff;
      set(arc, x, y, facing * 1.3, 0.35, k < 0.35 ? 0 : stepFade(cut), 0);
    } else if (p.piece === 'knives') {
      p.sprites.forEach((knife, i) => {
        const start = i * 0.1, t = clamp01((k - start) / 0.22), land = clamp01((k - start - 0.22) / 0.5);
        const lane = (i - 2) * 9 * s;
        set(knife, x + facing * (-70 + easeOut(t) * 62) * s, y + lane * 1.4, facing * 1.8, 1.8, t > 0 ? (land > 0 ? stepFade(land) : 1) : 0, 0);
      });
    } else {
      // muzzle / muzzle-spiral: rings pop and spin out
      p.sprites.forEach((ring, i) => {
        const start = i * 0.16, t = clamp01((k - start) / (p.sprites.length > 1 ? 0.55 : 1));
        const grow = 0.5 + easeOut(t) * (0.8 + i * 0.25);
        set(ring, x + facing * i * 10 * s * easeOut(t), y, grow, grow, t > 0 ? stepFade(t) : 0, (p.piece === 'muzzle-spiral' ? 1 : 0.4) * t * Math.PI * facing);
      });
    }
  }
}
