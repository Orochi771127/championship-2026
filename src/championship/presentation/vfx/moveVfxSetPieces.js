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
//   stream         a stream of flame tongues runs along the blow into a core
//   wisps          three spirit flames circle the target, then dive in
//   orb            a sphere of light swells, pulses twice and bursts
//   splat          a toxic blob slaps on and drips
//   eye            an evil eye opens over the target and stares
//   lance          a lance of light drives through the target
//   rain           missiles fall on the target one after another
//   clock          a clock face spins its hands, then the blow lands
//   flurry         a swarm of one small drawing (notes, leaves, feathers,
//                  bubbles, shards: the choreography's `sprite`) spirals in and scatters
//   drop           one object (bomb, mushroom, gear...: `sprite`) falls and bursts
//   bolt           three lightning strikes fall on the target
//   vortex         a black vortex spins down into the target and implodes
//   vines          three vines rise round the target and curl over
//   mist           clouds of mist roll out and thin away
//   wave           a splash rises, crests and falls over the target
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
  slash: ['blade_arc'], scissor: ['blade_arc', 'blade_arc'], iai: ['streaks', 'blade_arc'], knives: ['knife', 'knife', 'knife', 'knife', 'knife'],
  stream: ['flame', 'flame', 'flame', 'flame', 'core'], wisps: ['flame', 'flame', 'flame', 'impact_star'], orb: ['core', 'muzzle', 'muzzle'],
  splat: ['blob', 'core'], eye: ['eye', 'muzzle'], lance: ['lance_beam', 'impact_star'], rain: ['missile', 'missile', 'missile', 'missile', 'impact_star'],
  clock: ['clock', 'impact_star'],
  flurry: null, drop: null, bolt: ['bolt_0', 'bolt_1', 'bolt_2', 'impact_star'], vortex: ['vortex', 'impact_star'],
  vines: ['vine', 'vine', 'vine'], mist: ['puff_1', 'puff_2', 'puff_3', 'puff_2'], wave: ['splash_0', 'splash_1', 'splash_2'],
  // Support moves (batch 7), played on the body that receives them.
  heal: ['plus', 'plus', 'plus', 'plus', 'plus', 'muzzle'], cleanse: ['shard', 'shard', 'shard', 'shard', 'shard', 'shard', 'muzzle', 'muzzle'],
  'buff-atk': ['arrow_up', 'arrow_up', 'arrow_up', 'impact_star'], 'buff-def': ['shield', 'muzzle'],
  'buff-spd': ['streaks', 'streaks', 'streaks', 'arrow_up'], 'buff-hit': ['reticle', 'impact_star'], 'buff-tol': ['shield', 'shard', 'shard', 'shard', 'shard']
});
/** Support pieces: the cast on the receiving body, not a blow. */
export const MOVE_VFX_SUPPORT_PIECES = Object.freeze(['heal', 'cleanse', 'buff-atk', 'buff-def', 'buff-spd', 'buff-hit', 'buff-tol']);
/** Sprites of a piece; flurry and drop take the choreography's own drawing. */
function piecesOf(piece, drawing) {
  if (piece === 'flurry') return [...Array(8).fill(drawing ?? 'leaf'), 'impact_star'];
  if (piece === 'drop') return [drawing ?? 'bomb', 'impact_star', 'muzzle'];
  return PIECE_SPRITES[piece];
}
export const MOVE_VFX_SET_PIECES = Object.freeze(Object.keys(PIECE_SPRITES));
/** Drawings a flurry or a drop may take. */
export const MOVE_VFX_PIECE_DRAWINGS = Object.freeze(['note', 'leaf', 'feather_sm', 'bubble_sm', 'shard', 'heart', 'bomb', 'mushroom', 'gear', 'bone', 'cherry', 'fish_0', 'ghost']);
const DURATION = Object.freeze({jaws: 420, 'jaws-horn': 560, horn: 380, claws: 440, core: 420, muzzle: 300, 'muzzle-spiral': 460,
  fist: 400, rush: 420, quake: 520, spin: 520, roar: 480, cross: 420, slash: 340, scissor: 420, iai: 460, knives: 520,
  stream: 520, wisps: 620, orb: 560, splat: 460, eye: 600, lance: 420, rain: 640, clock: 620,
  flurry: 640, drop: 560, bolt: 500, vortex: 660, vines: 620, mist: 700, wave: 560,
  heal: 820, cleanse: 760, 'buff-atk': 720, 'buff-def': 760, 'buff-spd': 620, 'buff-hit': 700, 'buff-tol': 800});

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
    play(piece, {x, y, angle = 0, palette, size = 80, scale = 1, fast = false, sprite: drawing = null}) {
      if (!DURATION[piece] || !palette) return false;
      const names = piecesOf(piece, drawing);
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
    } else if (p.piece === 'stream') {
      const flames = p.sprites.slice(0, 4), core = p.sprites[4];
      flames.forEach((f, i) => {
        const start = i * 0.08, t = clamp01((k - start) / 0.3), fade = clamp01((k - start - 0.3) / 0.4);
        f.anchor.set(0.5, 1);
        set(f, x + facing * (-60 + i * 16 + t * 12) * s, y + 10 * s, facing * (0.7 + t * 0.4), 0.6 + t * 0.6, t > 0 ? (fade > 0 ? stepFade(fade) : 1) : 0, facing * 1.2);
      });
      const hit = clamp01((k - 0.35) / 0.65);
      set(core, x, y, 0.5 + easeOut(hit) * 1.1, 0.5 + easeOut(hit) * 1.1, k < 0.35 ? 0 : stepFade(hit));
    } else if (p.piece === 'wisps') {
      const [a, b, c, star] = p.sprites, dive = clamp01((k - 0.55) / 0.2), after = clamp01((k - 0.75) / 0.25);
      [a, b, c].forEach((f, i) => {
        const ang = (k * 3.2 + i / 3) * Math.PI * 2, r = (1 - easeIn(dive)) * 34 * s;
        f.anchor.set(0.5, 0.6);
        set(f, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.45 - (1 - dive) * 10 * s, 0.7, 0.7, k < 0.75 ? 1 : 0);
      });
      set(star, x, y, 0.4 + easeOut(after) * 1.2, 0.4 + easeOut(after) * 1.2, k < 0.75 ? 0 : stepFade(after));
    } else if (p.piece === 'orb') {
      const [core, r1, r2] = p.sprites, grow = easeOut(clamp01(k / 0.3)), pulse = 1 + Math.sin(clamp01((k - 0.3) / 0.4) * Math.PI * 2) * 0.12;
      const burst = clamp01((k - 0.7) / 0.3);
      set(core, x, y, (0.4 + grow * 1.1) * pulse + burst * 0.8, (0.4 + grow * 1.1) * pulse + burst * 0.8, k < 0.7 ? 1 : stepFade(burst));
      [r1, r2].forEach((ring, i) => { const t = clamp01((k - 0.3 - i * 0.18) / 0.5); set(ring, x, y, 0.6 + easeOut(t) * 1.8, 0.6 + easeOut(t) * 1.8, t > 0 ? stepFade(t) : 0); });
    } else if (p.piece === 'splat') {
      const [blob, core] = p.sprites, slap = easeOut(clamp01(k / 0.15)), drip = clamp01((k - 0.15) / 0.85);
      set(blob, x, y + drip * 10 * s, 0.4 + slap * 1.0 + (k < 0.2 ? 0.25 : 0), (0.4 + slap * 1.0) * (k < 0.2 ? 0.8 : 1 + drip * 0.15), k < 0.55 ? 1 : stepFade((k - 0.55) / 0.45));
      set(core, x, y, 0.4 + drip * 1.2, 0.3 + drip * 0.6, k < 0.15 ? 0 : stepFade(drip));
    } else if (p.piece === 'eye') {
      const [eye, ring] = p.sprites, open = easeOut(clamp01(k / 0.25)), stare = clamp01((k - 0.25) / 0.45), close = clamp01((k - 0.7) / 0.3);
      set(eye, x, y - 34 * s, 1.3, 1.3 * open * (1 - close * 0.9), 1);
      set(ring, x, y, 0.6 + easeOut(stare) * 1.6, 0.6 + easeOut(stare) * 1.6, stare > 0 && close < 1 ? stepFade(stare) : 0);
    } else if (p.piece === 'lance') {
      const [lance, star] = p.sprites, thrust = easeIn(clamp01(k / 0.25)), after = clamp01((k - 0.25) / 0.75);
      lance.anchor.set(1, 0.5);
      set(lance, x + facing * (-40 + thrust * 70) * s, y, facing * (0.8 + thrust * 0.6), 1, k < 0.45 ? 1 : stepFade((k - 0.45) / 0.55));
      set(star, x, y, 0.5 + easeOut(after) * 1.1, 0.5 + easeOut(after) * 1.1, k < 0.25 ? 0 : stepFade(after));
    } else if (p.piece === 'rain') {
      const shells = p.sprites.slice(0, 4), star = p.sprites[4];
      shells.forEach((m, i) => {
        const start = i * 0.12, t = clamp01((k - start) / 0.25);
        set(m, x + (i - 1.5) * 14 * s, y - (1 - easeIn(t)) * 80 * s, 1, 1, t > 0 && t < 1 ? 1 : 0, Math.PI / 2);
      });
      const boom = clamp01((k - 0.25) / 0.75);
      set(star, x, y, 0.5 + easeOut(boom) * 1.3, 0.5 + easeOut(boom) * 1.3, k < 0.25 ? 0 : stepFade(boom), boom * 0.8);
    } else if (p.piece === 'clock') {
      const [clock, star] = p.sprites, show = easeOut(clamp01(k / 0.2)), strike = clamp01((k - 0.6) / 0.4);
      set(clock, x, y - 30 * s, show * 1.2, show * 1.2, k < 0.6 ? 1 : stepFade(strike), Math.sin(k * 30) * 0.08 * (1 - strike));
      set(star, x, y, 0.5 + easeOut(strike) * 1.3, 0.5 + easeOut(strike) * 1.3, k < 0.6 ? 0 : stepFade(strike));
    } else if (p.piece === 'flurry') {
      const bits = p.sprites.slice(0, 8), star = p.sprites[8], hit = clamp01((k - 0.55) / 0.45);
      bits.forEach((b, i) => {
        const ang = i / 8 * Math.PI * 2 + k * 5, r = (k < 0.55 ? (1 - easeOut(k / 0.55)) * 56 + 6 : 6 + easeOut(hit) * 40) * s;
        set(b, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.7, 1.1, 1.1, k < 0.55 ? 1 : stepFade(hit), ang);
      });
      set(star, x, y, 0.4 + easeOut(hit) * 1.1, 0.4 + easeOut(hit) * 1.1, k < 0.55 ? 0 : stepFade(hit));
    } else if (p.piece === 'drop') {
      const [obj, star, ring] = p.sprites, fall = easeIn(clamp01(k / 0.35)), boom = clamp01((k - 0.35) / 0.65);
      set(obj, x, y - (1 - fall) * 90 * s, k < 0.35 ? 1.3 : 1.3 + boom * 0.5, k < 0.35 ? 1.3 : (1.3 - boom * 0.6), k < 0.35 ? 1 : stepFade(boom * 1.4));
      set(star, x, y, 0.5 + easeOut(boom) * 1.3, 0.5 + easeOut(boom) * 1.3, k < 0.35 ? 0 : stepFade(boom));
      set(ring, x, y + 14 * s, 0.6 + easeOut(boom) * 2, (0.6 + easeOut(boom) * 2) * 0.35, k < 0.35 ? 0 : stepFade(boom));
    } else if (p.piece === 'bolt') {
      const bolts = p.sprites.slice(0, 3), star = p.sprites[3];
      bolts.forEach((b, i) => {
        const at = i * 0.18, on = k >= at && k < at + 0.14;
        b.anchor.set(0, 0.5);
        set(b, x + (i - 1) * 12 * s, y, 1.6, 1.2, on ? 1 : 0, -Math.PI / 2 + (i - 1) * 0.15);
      });
      const hit = clamp01((k - 0.1) / 0.9);
      set(star, x, y, 0.5 + easeOut(hit) * 1.2, 0.5 + easeOut(hit) * 1.2, k < 0.1 ? 0 : stepFade(hit), hit * 2);
    } else if (p.piece === 'vortex') {
      const [v, star] = p.sprites, spin = clamp01(k / 0.7), imp = clamp01((k - 0.7) / 0.3);
      set(v, x, y, (1.6 - spin * 0.9) * (1 - imp), (1.6 - spin * 0.9) * (1 - imp) * 0.8, 1, -k * 14);
      set(star, x, y, 0.3 + easeOut(imp) * 1.4, 0.3 + easeOut(imp) * 1.4, k < 0.7 ? 0 : stepFade(imp));
    } else if (p.piece === 'vines') {
      p.sprites.forEach((v, i) => {
        const start = i * 0.12, rise = easeOut(clamp01((k - start) / 0.3)), fade = clamp01((k - 0.7) / 0.3);
        v.anchor.set(0.5, 1);
        set(v, x + (i - 1) * 20 * s, y + 24 * s, (i === 2 ? -1 : 1), rise, rise > 0 ? (fade > 0 ? stepFade(fade) : 1) : 0, (i - 1) * 0.25);
      });
    } else if (p.piece === 'mist') {
      p.sprites.forEach((m, i) => {
        const t = clamp01((k - i * 0.1) / 0.75), ang = i / 4 * Math.PI * 2;
        set(m, x + Math.cos(ang) * easeOut(t) * 30 * s, y + Math.sin(ang) * easeOut(t) * 14 * s, 0.8 + t * 1.2, 0.8 + t * 1.2, t > 0 ? stepFade(t) : 0);
      });
    } else if (p.piece === 'wave') {
      p.sprites.forEach((w, i) => {
        const on = k >= i * 0.28 && k < i * 0.28 + 0.36, t = clamp01((k - i * 0.28) / 0.36);
        w.anchor.set(0.5, 1);
        set(w, x, y + 20 * s, 1.6 + t * 0.4, 1.6 + t * 0.3, on ? (i === 2 ? stepFade(t) : 1) : 0);
      });
    } else if (p.piece === 'heal') {
      // pluses well up from the feet and drift above the head; a ring blooms flat on the ground
      const pluses = p.sprites.slice(0, 5), ring = p.sprites[5];
      pluses.forEach((b, i) => {
        const t = clamp01((k - i * 0.1) / 0.6), lift = easeOut(t), sway = Math.sin(t * Math.PI * 2 + i) * 4;
        set(b, x + ((i * 37) % 5 - 2) * 11 * s + sway * s, y + (30 - lift * 80) * s, 0.8 + (t < 0.15 ? t * 3 : 0.45), 0.8 + (t < 0.15 ? t * 3 : 0.45), t > 0 ? (t < 0.6 ? 1 : stepFade((t - 0.6) / 0.4)) : 0);
      });
      const bloom = clamp01(k / 0.5);
      set(ring, x, y + 30 * s, 0.6 + easeOut(bloom) * 2.2, (0.6 + easeOut(bloom) * 2.2) * 0.32, stepFade(bloom));
    } else if (p.piece === 'cleanse') {
      // two rings sweep outward and the shards of what was cleared rise and spin away
      const shards = p.sprites.slice(0, 6), rings = p.sprites.slice(6);
      rings.forEach((ring, i) => { const t = clamp01((k - i * 0.2) / 0.55); set(ring, x, y + 20 * s, 0.5 + easeOut(t) * 2.6, (0.5 + easeOut(t) * 2.6) * 0.34, t > 0 ? stepFade(t) : 0); });
      shards.forEach((b, i) => {
        const t = clamp01((k - 0.15 - i * 0.05) / 0.7), ang = i / 6 * Math.PI * 2;
        set(b, x + Math.cos(ang) * (16 + easeOut(t) * 20) * s, y + (10 - easeOut(t) * 70) * s, 0.9, 0.9, t > 0 ? stepFade(t) : 0, t * 6 + i);
      });
    } else if (p.piece === 'buff-atk' || p.piece === 'buff-spd') {
      // a power climb: three arrows (or speed streaks) shoot up the body, then a flash above the head
      const spd = p.piece === 'buff-spd', cols = p.sprites.slice(0, 3), top = p.sprites[3];
      cols.forEach((b, i) => {
        const t = clamp01((k - [0.1, 0, 0.2][i] * (spd ? 0.6 : 1)) / (spd ? 0.4 : 0.55)), rise = (spd ? easeIn : easeOut)(t);
        set(b, x + (i - 1) * 20 * s, y + (34 - rise * 74) * s, spd ? 1.1 : 1.1, spd ? 0.9 : 1.1, t > 0 && t < 1 ? (t < 0.7 ? 1 : 0.6) : 0, spd ? -Math.PI / 2 : 0);
      });
      const pop = clamp01((k - 0.5) / 0.5);
      if (spd) set(top, x, y + (24 - easeOut(clamp01(k / 0.6)) * 70) * s, 1.4, 1.4, k < 0.6 ? 1 : stepFade(pop));
      else set(top, x, y - 46 * s, 0.4 + easeOut(pop) * 1.1, 0.4 + easeOut(pop) * 1.1, k < 0.5 ? 0 : stepFade(pop));
    } else if (p.piece === 'buff-def' || p.piece === 'buff-tol') {
      // a guard shield slams up in front of the body, overshoots, settles, glints and fades;
      // a resist guard also keeps four shards circling it
      const [shield, ...rest] = p.sprites, popIn = clamp01(k / 0.2), hold = clamp01((k - 0.65) / 0.35);
      const sc = popIn < 1 ? easeOut(popIn) * 1.5 : 1.5 - Math.min(1, (k - 0.2) / 0.12) * 0.3;
      set(shield, x + facing * 10 * s, y - 4 * s, sc * (k > 0.45 && k < 0.5 ? 1.08 : 1), sc, k < 0.65 ? 1 : stepFade(hold));
      if (p.piece === 'buff-def') {
        const t = clamp01((k - 0.15) / 0.5);
        set(rest[0], x, y + 28 * s, 0.6 + easeOut(t) * 2, (0.6 + easeOut(t) * 2) * 0.32, k < 0.15 ? 0 : stepFade(t));
      } else rest.forEach((b, i) => {
        const ang = i / 4 * Math.PI * 2 + k * 9;
        set(b, x + Math.cos(ang) * 34 * s, y + Math.sin(ang) * 14 * s - 4 * s, 0.9, 0.9, k < 0.15 ? 0 : k < 0.7 ? 1 : stepFade(hold), ang);
      });
    } else if (p.piece === 'buff-hit') {
      // a reticle spins in from wide and locks on the body, then a flash at the lock
      const [ret, star] = p.sprites, close = easeOut(clamp01(k / 0.45)), lock = clamp01((k - 0.45) / 0.55);
      set(ret, x, y - 6 * s, 2.4 - close * 1.3, 2.4 - close * 1.3, k < 0.45 ? 0.6 + close * 0.4 : stepFade(lock), (1 - close) * Math.PI);
      set(star, x, y - 6 * s, 0.3 + easeOut(lock) * 0.9, 0.3 + easeOut(lock) * 0.9, k < 0.45 ? 0 : stepFade(lock));
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
