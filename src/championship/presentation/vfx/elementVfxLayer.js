// Element dressing shared by the AI battle and the Data Arena
// (OWNER_APPROVED_ADAPTATION 2026-11-01, VFX_FIVE_LAYER_20261101).
//
//   charge   an element orb at the release point, four glints spiralling in
//   muzzle   a shock ring across the release direction and seven recoil sparks
//   storm    a ~0.53 s full-field backdrop for signature moves, stepped at
//            15 fps and faded by stepped weights (as a hardware blend pair would)
//   decal    a ground mark that lives four seconds: scorch, puddle, frost,
//            static, crack, roots, swirl, sunburst or shade
//   cell     one native sequence of the shared effect atlas, played here (the
//            presentation fallback for records that name no bank, element
//            accents and the brief overlay on a struck body)
//
// Presentation only. The layer owns no clock (callers pass the one Pixi
// ticker's delta), reads no simulation state and writes nothing back. All
// textures are drawn to canvases on first use and destroyed on dispose.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};
import {pixelateCanvas} from './pixelateCanvas.js';
import {paintCraterBase, paintCraterEmbers, CRATER_KINDS, emberWeight, craterPop} from './groundCrater.js';
import {bakedPieceLook, paintBakedPieceFrames} from './moveVfxSetPieces.js';

/**
 * Refinement pass 8 (BESPOKE_MOVE_VFX_PROGRAM_20261111): the ground marks drawn as vector strokes --
 * a spiral of roots, frost spokes, sun rays -- read as cheap next to the craters. Once the baked
 * pieces are in, each kind leaves a still frame of a pixelfx ground effect instead (its fullest
 * frame); a thunder mark scorches the floor as a fire crater does. The canvas drawings stay as the
 * fallback before the bake loads.
 */
export const ELEMENT_DECAL_BAKED = Object.freeze({puddle: 'mark-ripple', frost: 'mark-frost', roots: 'mark-roots', swirl: 'mist',
  sunburst: 'heal', shade: 'eye'});
export const ELEMENT_DECAL_AS_CRATER = Object.freeze({static: 'scorch'});

const TAU = Math.PI * 2;
const TICK_MS = 1000 / 60;
export const ELEMENT_DECAL_MS = 4000;
export const ELEMENT_STORM_MS = 530;
/** Stepped weights over the storm's frames (15 fps): fade in, hold, weight-step out. */
export const ELEMENT_STORM_WEIGHTS = Object.freeze([0.38, 0.72, 0.86, 0.86, 0.82, 0.74, 0.62, 0.48, 0.32]);
const rgba = (color, alpha) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

function makeCanvas(width, height) {
  const element = globalThis.document?.createElement?.('canvas');
  if (!element) return null;
  element.width = width; element.height = height;
  return element.getContext?.('2d') ? element : null;
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------ canvas drawings
const DECALS = {
  scorch(c, p, r) {
    const g = c.createRadialGradient(64, 32, 2, 64, 32, 60);
    g.addColorStop(0, 'rgba(24,10,4,0.9)'); g.addColorStop(0.45, 'rgba(42,16,8,0.65)'); g.addColorStop(0.78, rgba(p.edge, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 60, 28, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.main, 0.85); c.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + r() * 0.4;
      c.beginPath(); c.moveTo(64 + Math.cos(a) * 6, 32 + Math.sin(a) * 3);
      c.quadraticCurveTo(64 + Math.cos(a + 0.3) * 26, 32 + Math.sin(a + 0.3) * 12, 64 + Math.cos(a) * 46, 32 + Math.sin(a) * 20);
      c.stroke();
    }
    c.fillStyle = rgba(p.core, 0.92);
    for (let i = 0; i < 11; i++) { const a = r() * TAU, d = 8 + r() * 34; c.beginPath(); c.arc(64 + Math.cos(a) * d, 32 + Math.sin(a) * d * 0.45, 1.8 + r() * 1.5, 0, TAU); c.fill(); }
  },
  puddle(c, p, r = () => 0.5) {
    const g = c.createRadialGradient(64, 32, 4, 64, 32, 58);
    g.addColorStop(0, rgba(p.core, 0.55)); g.addColorStop(0.45, rgba(p.main, 0.38)); g.addColorStop(0.82, rgba(p.edge, 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 58, 26, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.core, 0.85); c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const a0 = i * TAU / 4 + 0.3;
      c.beginPath(); c.ellipse(64, 32, 22 + i * 10, (22 + i * 10) * 0.42, 0, a0, a0 + 1.35); c.stroke();
    }
    c.fillStyle = rgba(p.core, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + r() * 0.3, d = 14 + (i % 3) * 13;
      c.beginPath(); c.arc(64 + Math.cos(a) * d, 32 + Math.sin(a) * d * 0.42, 2.2, 0, TAU); c.fill();
    }
  },
  frost(c, p, r) {
    c.fillStyle = rgba(p.main, 0.28); c.beginPath(); c.ellipse(64, 32, 58, 26, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.core, 0.9); c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + 0.26; c.beginPath(); c.moveTo(64, 32);
      const x = 64 + Math.cos(a) * 50, y = 32 + Math.sin(a) * 22; c.lineTo(x, y);
      const bx = 64 + Math.cos(a) * 30, by = 32 + Math.sin(a) * 13;
      c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.7) * 12, by + Math.sin(a + 0.7) * 6); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.7) * 12, by + Math.sin(a - 0.7) * 6);
      c.stroke();
    }
    c.strokeStyle = rgba(p.edge, 0.7); c.beginPath(); c.ellipse(64, 32, 22, 10, 0, 0, TAU); c.stroke();
  },
  static(c, p, r) {
    const g = c.createRadialGradient(64, 32, 1, 64, 32, 46); g.addColorStop(0, 'rgba(20,16,10,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 48, 22, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.main, 0.95); c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      let a = i * TAU / 7 + r() * 0.4, x = 64, y = 32; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 4; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 12; y += Math.sin(a) * 5; c.lineTo(x, y); }
      c.stroke();
    }
    c.fillStyle = 'rgba(8,6,4,0.95)';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(40 + r() * 48, 24 + r() * 16, 3, 1.6, 0, 0, TAU); c.fill(); }
  },
  crack(c, p, r) {
    c.fillStyle = rgba(p.smoke, 0.35); c.beginPath(); c.ellipse(64, 32, 50, 20, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(30,20,12,0.9)'; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      let a = i * TAU / 6 + r() * 0.5, x = 64, y = 32; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 3; k++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 16; y += Math.sin(a) * 7; c.lineTo(x, y); }
      c.stroke();
    }
    c.fillStyle = rgba(p.main, 0.9); for (let i = 0; i < 6; i++) c.fillRect(30 + r() * 68, 18 + r() * 28, 4, 3);
  },
  roots(c, p, r) {
    const g = c.createRadialGradient(64, 32, 4, 64, 32, 56);
    g.addColorStop(0, rgba(p.core, 0.48)); g.addColorStop(0.5, rgba(p.main, 0.28)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 56, 25, 0, 0, TAU); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + r() * 0.4, tx = 64 + Math.cos(a) * 52, ty = 32 + Math.sin(a) * 22;
      const cx = 64 + Math.cos(a + 0.55) * 28, cy = 32 + Math.sin(a + 0.55) * 12;
      for (const [width, color] of [[6.5, 'rgba(8,36,14,0.6)'], [3.8, rgba(p.main, 0.92)], [1.5, rgba(p.core, 0.95)]]) {
        c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(64, 32); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
      }
    }
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = 14 + r() * 34, x = 64 + Math.cos(a) * d, y = 32 + Math.sin(a) * d * 0.42;
      c.fillStyle = rgba(p.main, 0.95); c.beginPath(); c.ellipse(x, y, 7, 3.2, a, 0, TAU); c.fill();
      c.fillStyle = rgba(p.core, 0.95); c.beginPath(); c.ellipse(x - 1.2, y - 0.6, 3, 1.2, a, 0, TAU); c.fill();
    }
  },
  swirl(c, p) {
    c.strokeStyle = rgba(p.main, 0.75); c.lineWidth = 3;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const a = t * 4.4 + k * 2.1, d = 8 + t * 46; c.lineTo(64 + Math.cos(a) * d, 32 + Math.sin(a) * d * 0.42); } c.stroke(); }
  },
  sunburst(c, p) {
    const g = c.createRadialGradient(64, 32, 2, 64, 32, 58); g.addColorStop(0, rgba(p.core, 0.8)); g.addColorStop(0.4, rgba(p.main, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 58, 26, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.edge, 0.85); c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.beginPath(); c.moveTo(64 + Math.cos(a) * 16, 32 + Math.sin(a) * 7); c.lineTo(64 + Math.cos(a) * 52, 32 + Math.sin(a) * 23); c.stroke(); }
  },
  shade(c, p, r) {
    for (let i = 0; i < 6; i++) {
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 24), x = 40 + r() * 48, y = 22 + r() * 20;
      g.addColorStop(0, rgba(p.edge, 0.6)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.translate(x, y); c.scale(1, 0.45); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.restore();
    }
    c.fillStyle = rgba(p.main, 0.9); for (let i = 0; i < 5; i++) c.fillRect(36 + r() * 56, 20 + r() * 24, 2, 2);
  }
};

/**
 * Ground cells (Owner 2026-11-03): each mark also plays the element's own hit
 * or ground sequence from the shared effect atlas at the mark, so a hit leaves
 * crystal spikes, cracks or a burst on the floor instead of only thin lines.
 * [bankId, sequence] pairs from battleEffectProfiles.json (sequence 2 is a
 * bank's three-frame hit); every frame is in the shipped 292-cell web atlas.
 */
export const ELEMENT_GROUND_CELLS = Object.freeze({
  roots: Object.freeze([[53, 2], [25, 1]]),   // toge00 jade spikes, seed00 seeds
  crack: Object.freeze([[24, 2]]),            // rock00 shatter
  scorch: Object.freeze([[149, 0]]),          // explo
  frost: Object.freeze([[26, 2]]),            // snowcrystal00
  puddle: Object.freeze([[91, 0]]),           // tsunami
  static: Object.freeze([[28, 2]]),           // thunderball00
  swirl: Object.freeze([[33, 2]]),            // tatumaki00
  sunburst: Object.freeze([[1, 33]]),         // battle light burst
  shade: Object.freeze([[100, 2]])            // dark01
});

/** A soft lit pool under every mark: brightest in the middle, foreshortened like the floor. */
function groundGlow(c, p) {
  const g = c.createRadialGradient(64, 32, 1, 64, 32, 62);
  g.addColorStop(0, rgba(p.core, 0.42)); g.addColorStop(0.45, rgba(p.main, 0.24)); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(64, 32); c.scale(1, 0.46); c.translate(-64, -32);
  c.fillStyle = g; c.beginPath(); c.arc(64, 32, 62, 0, TAU); c.fill(); c.restore();
}

const STORMS = {
  vortex(c, p, r, v) {
    c.translate(128, 128);
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      for (let t = 0; t <= 1; t += 0.02) { const a = t * 5.2 + k * TAU / 5 + v * 0.6, d = t * 128; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
      c.strokeStyle = rgba(k % 2 ? p.main : p.edge, 0.85); c.lineWidth = 14 - k; c.stroke();
    }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 70); g.addColorStop(0, rgba(p.core, 0.95)); g.addColorStop(1, rgba(p.main, 0)); c.fillStyle = g; c.fillRect(-128, -128, 256, 256);
  },
  lattice(c, p, r) {
    c.translate(128, 128); c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let a = i * TAU / 9 + r() * 0.4, x = 0, y = 0; c.beginPath(); c.moveTo(0, 0);
      for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 20; y += Math.sin(a) * 20; c.lineTo(x, y); }
      c.strokeStyle = rgba(p.edge, 0.7); c.lineWidth = 7; c.stroke(); c.strokeStyle = rgba(p.core, 0.95); c.lineWidth = 2.5; c.stroke();
    }
    for (const rr of [60, 100]) { c.strokeStyle = rgba(p.main, 0.5); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke(); }
  },
  aurora(c, p, r, v) {
    for (let k = 0; k < 6; k++) {
      const y0 = 40 + k * 32;
      const g = c.createLinearGradient(0, y0 - 18, 0, y0 + 18); g.addColorStop(0, rgba(p.main, 0)); g.addColorStop(0.5, rgba(k % 2 ? p.core : p.main, 0.7)); g.addColorStop(1, rgba(p.edge, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(0, y0);
      for (let x = 0; x <= 256; x += 8) c.lineTo(x, y0 + Math.sin(x / 30 + k + v * 1.3) * 12 - 18);
      for (let x = 256; x >= 0; x -= 8) c.lineTo(x, y0 + Math.sin(x / 30 + k + v * 1.3) * 12 + 18);
      c.fill();
    }
  },
  gears(c, p, r, v) {
    c.translate(128, 128);
    for (const [gx, gy, R, n] of [[0, 0, 70, 14], [-88, -70, 38, 9], [92, 64, 44, 10], [86, -84, 28, 7]]) {
      c.save(); c.translate(gx, gy); c.rotate(v * 0.3 * (n % 2 ? 1 : -1)); c.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, rr = i % 2 ? R : R + 10; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.strokeStyle = rgba(p.edge, 0.9); c.lineWidth = 4; c.stroke();
      c.beginPath(); c.arc(0, 0, R * 0.45, 0, TAU); c.strokeStyle = rgba(p.main, 0.85); c.lineWidth = 3; c.stroke(); c.restore();
    }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, rgba(p.core, 0.8)); g.addColorStop(1, rgba(p.core, 0)); c.fillStyle = g; c.fillRect(-128, -128, 256, 256);
  },
  gale(c, p, r, v) {
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const y = r() * 256, x = r() * 140 - 20 + v * 24, len = 60 + r() * 90;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * 0.5, y - 26, x + len, y - 6);
      c.strokeStyle = rgba(i % 3 ? p.main : p.core, 0.75); c.lineWidth = 3 + r() * 4; c.stroke();
    }
    c.fillStyle = rgba(p.edge, 0.9); for (let i = 0; i < 14; i++) { c.save(); c.translate(r() * 256, r() * 256); c.rotate(r() * TAU); c.fillRect(-5, -2, 10, 4); c.restore(); }
  },
  eclipse(c, p, r, v) {
    c.translate(128, 128);
    const g = c.createRadialGradient(0, 0, 40, 0, 0, 128); g.addColorStop(0, rgba(p.core, 0.95)); g.addColorStop(0.35, rgba(p.main, 0.6)); g.addColorStop(1, rgba(p.edge, 0));
    c.fillStyle = g; c.fillRect(-128, -128, 256, 256);
    c.fillStyle = 'rgba(8,6,16,0.92)'; c.beginPath(); c.arc(v * 4, 0, 44, 0, TAU); c.fill();
    c.strokeStyle = rgba(p.core, 0.95); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 48, 0, TAU); c.stroke();
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + v * 0.2; c.fillStyle = rgba(p.core, 0.95); c.fillRect(Math.cos(a) * 92 - 2, Math.sin(a) * 92 - 2, 4, 4); }
  },
  quake(c, p, r) {
    c.translate(128, 128); c.strokeStyle = rgba(p.edge, 0.9); c.lineWidth = 5;
    for (let i = 0; i < 10; i++) { let a = i * TAU / 10 + r() * 0.3, x = 0, y = 0; c.beginPath(); c.moveTo(0, 0); for (let k = 0; k < 5; k++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 26; y += Math.sin(a) * 26; c.lineTo(x, y); } c.stroke(); }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 110); g.addColorStop(0, rgba(p.main, 0.7)); g.addColorStop(1, rgba(p.smoke, 0)); c.fillStyle = g; c.fillRect(-128, -128, 256, 256);
  },
  // A banded flash of the element's colour (pixel look): concentric steps, no strokes,
  // so nothing turns into a long line once it is scaled to the field.
  wash(c, p) {
    c.translate(128, 128);
    for (const [r, colour, a] of [[128, p.edge, 0.35], [100, p.main, 0.45], [70, p.main, 0.6], [42, p.core, 0.75]]) {
      c.fillStyle = rgba(colour, a); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    }
  },
  burst(c, p) {
    c.translate(128, 128);
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; c.beginPath(); c.moveTo(Math.cos(a - 0.05) * 30, Math.sin(a - 0.05) * 30); c.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); c.lineTo(Math.cos(a + 0.05) * 30, Math.sin(a + 0.05) * 30); c.fillStyle = rgba(i % 2 ? p.main : p.core, 0.7); c.fill(); }
  }
};

/**
 * `ground` holds storms and decals (under the fighters), `front` charges,
 * muzzle rings, sparks and cells (over them). `art` is the loaded effect art
 * (getCell) or null when this host loads none; cells then play nothing.
 */
/**
 * `pixel` (the AI battle, MOVE_VFX_KIT_20261105): every generated texture is
 * pixelated to sit with the sequence cells, and signature storms become a
 * banded wash instead of line art.
 */
export function createElementVfxLayer({PIXI, ground, front, art = null, quality = 'balanced', reducedMotion = false, seed = 0x5eed, pixel = false}) {
  if (!makeCanvas(1, 1)) return null;
  const rich = quality !== 'saver';
  const random = seeded(seed);
  const textures = new Map();
  const stormLayer = new PIXI.Container({label: 'element vfx storm'});
  const decalLayer = new PIXI.Container({label: 'element vfx decals'});
  const frontLayer = new PIXI.Container({label: 'element vfx front'});
  // Storms and marks go under whatever the ground layer already holds.
  if (typeof ground.addChildAt === 'function') { ground.addChildAt(stormLayer, 0); ground.addChildAt(decalLayer, 1); }
  else ground.addChild(stormLayer, decalLayer);
  front.addChild(frontLayer);
  const decals = [], storms = [], charges = [], rings = [], sparks = [], cells = [];
  const filters = new Map();
  let hold = 0, created = {decals: 0, storms: 0, charges: 0, muzzles: 0, cells: 0, overlays: 0};

  function texture(key, width, height, draw, {raw = false} = {}) {
    let t = textures.get(key);
    if (!t) {
      // No 2D canvas at this moment (a headless check): draw nothing.
      const canvas = makeCanvas(width, height);
      if (!canvas) return null;
      const c = canvas.getContext('2d');
      try { draw(c); } catch { /* a partial 2D context draws what it can */ }
      // Stepped bands, not blocks: a texture's own pixels are scaled per sprite, so blocks would not match the cells' grid.
      if (pixel && !raw) pixelateCanvas(canvas, {block: 1, levels: 4});
      t = PIXI.Texture.from(canvas);
      if (pixel && t.source) t.source.scaleMode = 'nearest';
      textures.set(key, t);
    }
    return t;
  }
  const glow = () => texture('glow', 64, 64, c => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  const ringTexture = () => texture('ring', 64, 64, c => { c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.stroke(); });
  const sparkTexture = () => texture('spark', 8, 2, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 2); });
  const decalTexture = (kind, paletteKey, palette, variant) => texture(`decal:${kind}:${paletteKey}:${variant}`, 128, 64,
    c => { groundGlow(c, palette); (DECALS[kind] ?? DECALS.crack)(c, palette, seeded(variant * 977 + kind.length)); });
  // Craters are pixel art already: no glow pool, no alpha stepping, always sampled nearest.
  const craterTexture = (layer, kind, paletteKey, palette, variant) => {
    const t = texture(`crater:${layer}:${kind}:${paletteKey}:${variant}`, 128, 64, c => {
      const r = seeded(variant * 977 + kind.length);
      if (layer === 'ember') paintCraterEmbers(c, palette, r); else paintCraterBase(c, palette, r, {scorched: kind === 'scorch'});
    }, {raw: true});
    if (t?.source) t.source.scaleMode = 'nearest';
    return t;
  };
  const stormTexture = (kind, paletteKey, palette, variant) => texture(`storm:${pixel ? 'wash' : kind}:${paletteKey}:${variant}`, 256, 256,
    c => (STORMS[pixel ? 'wash' : kind] ?? STORMS.burst)(c, palette, seeded(variant * 131 + kind.length * 7), variant));
  function hueFilter(hue) {
    if (!hue || !PIXI.ColorMatrixFilter) return null;
    let f = filters.get(hue);
    if (!f) { f = new PIXI.ColorMatrixFilter(); f.hue(hue, false); filters.set(hue, f); }
    return [f];
  }

  /** A four-second ground mark at a ground point, with the element's own ground cells. */
  function decal({x, y, kind, palette, paletteKey = 'neutral', size = 40, scale = 0}) {
    if (ELEMENT_DECAL_AS_CRATER[kind] && bakedPieceLook('mark-ripple')) kind = ELEMENT_DECAL_AS_CRATER[kind];
    if (CRATER_KINDS.has(kind)) return crater({x, y, kind, palette, paletteKey, size, scale});
    const baked = bakedMark(kind, palette);
    if (baked) return bakedDecal({x, y, kind, baked, size, scale});
    const look = decalTexture(kind, paletteKey, palette, 1 + (created.decals % 3));
    if (!look) return;
    if (decals.length >= (rich ? 16 : 6)) { const old = decals.shift(); old.sprite.destroy(); old.ember?.destroy(); }
    const sprite = new PIXI.Sprite(look);
    sprite.anchor.set(0.5); sprite.position.set(x, y); sprite.scale.set(Math.max(18, size) / 128 * 2.1, Math.max(18, size) / 128 * 1.9);
    sprite.rotation = (random() - 0.5) * 0.12; sprite.alpha = 0;
    decalLayer.addChild(sprite);
    decals.push({sprite, age: 0, life: ELEMENT_DECAL_MS});
    created.decals++;
    if (scale > 0) for (const [bankId, sequence] of (rich ? ELEMENT_GROUND_CELLS[kind] ?? [] : (ELEMENT_GROUND_CELLS[kind] ?? []).slice(0, 1)))
      cell({bankId, sequence, x, y, scale: scale * 0.9, ground: true});
  }
  /** The fullest frame of a baked ground look in a palette, cached per kind and palette. */
  const bakedMarks = new Map();
  function bakedMark(kind, palette) {
    const name = ELEMENT_DECAL_BAKED[kind];
    if (!name || !palette || typeof bakedPieceLook !== 'function' || !bakedPieceLook(name)) return null;
    const key = `${name}:${palette.main}:${palette.core}:${palette.edge}`;
    if (bakedMarks.has(key)) return bakedMarks.get(key);
    const painted = paintBakedPieceFrames(name, palette, {doc: globalThis.document});
    let best = null, most = -1;
    for (const canvas of painted?.frames ?? []) {
      const data = canvas.getContext?.('2d')?.getImageData?.(0, 0, canvas.width, canvas.height)?.data;
      if (!data) continue;
      let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
      if (n > most) { most = n; best = canvas; }
    }
    const value = best ? {texture: PIXI.Texture.from(best), w: painted.w, h: painted.h, ox: painted.ox, oy: painted.oy} : null;
    if (value) value.texture.source.scaleMode = 'nearest';
    bakedMarks.set(key, value);
    return value;
  }
  function bakedDecal({x, y, kind, baked, size, scale}) {
    if (decals.length >= (rich ? 16 : 6)) { const old = decals.shift(); old.sprite.destroy(); old.ember?.destroy(); }
    const sprite = new PIXI.Sprite(baked.texture), k = Math.max(18, size) * 1.5 / baked.w;
    sprite.anchor.set(baked.ox / baked.w, baked.oy / baked.h); sprite.position.set(Math.round(x), Math.round(y));
    sprite.scale.set(k * (random() < 0.5 ? -1 : 1), k); sprite.alpha = 0;
    decalLayer.addChild(sprite);
    decals.push({sprite, age: 0, life: ELEMENT_DECAL_MS});
    created.decals++;
    if (scale > 0) for (const [bankId, sequence] of (rich ? ELEMENT_GROUND_CELLS[kind] ?? [] : (ELEMENT_GROUND_CELLS[kind] ?? []).slice(0, 1)))
      cell({bankId, sequence, x, y, scale: scale * 0.9, ground: true});
  }
  /** A broken-floor crater (Owner 2026-11-10): pixel pit, cracks and chips; a burning one glows and cools. */
  function crater({x, y, kind, palette, paletteKey, size, scale}) {
    const variant = 1 + (created.decals % 3), base = craterTexture('base', kind, paletteKey, palette, variant);
    if (!base) return;
    if (decals.length >= (rich ? 16 : 6)) { const old = decals.shift(); old.sprite.destroy(); old.ember?.destroy(); }
    const unit = Math.max(18, size) / 128 * 2, flip = random() < 0.5 ? -1 : 1;
    const sprite = new PIXI.Sprite(base);
    sprite.anchor.set(0.5); sprite.position.set(x, y); sprite.alpha = 0;
    decalLayer.addChild(sprite);
    let ember = null;
    if (kind === 'scorch') {
      const glowLook = craterTexture('ember', kind, paletteKey, palette, variant);
      if (glowLook) {
        ember = new PIXI.Sprite(glowLook); ember.anchor.set(0.5); ember.position.set(x, y); ember.blendMode = 'add'; ember.alpha = 0;
        decalLayer.addChild(ember);
      }
    }
    decals.push({sprite, ember, unit, flip, crater: true, age: 0, life: ELEMENT_DECAL_MS});
    created.decals++;
    applyCrater(decals[decals.length - 1]);
    if (scale > 0) for (const [bankId, sequence] of (rich ? ELEMENT_GROUND_CELLS[kind] ?? [] : (ELEMENT_GROUND_CELLS[kind] ?? []).slice(0, 1)))
      cell({bankId, sequence, x, y, scale: scale * 0.9, ground: true});
  }
  function applyCrater(d) {
    const pop = reducedMotion ? 1 : craterPop(d.age), fade = d.age < 60 ? d.age / 60 : d.age > d.life - 1200 ? (d.life - d.age) / 1200 : 1;
    d.sprite.scale.set(d.unit * pop * d.flip, d.unit * pop); d.sprite.alpha = fade;
    if (d.ember) { d.ember.scale.set(d.unit * pop * d.flip, d.unit * pop); d.ember.alpha = fade * emberWeight(d.age); d.ember.visible = d.ember.alpha > 0.01; }
  }
  /** The signature backdrop over the field rectangle (world space). */
  function storm({kind, palette, paletteKey = 'neutral', rect, center = null}) {
    if (!rect || !stormTexture(kind, paletteKey, palette, 1)) return;
    for (const old of storms.splice(0)) old.sprites.forEach(s => s.destroy());
    const cx = center?.x ?? rect.x + rect.width / 2, cy = center?.y ?? rect.y + rect.height / 2;
    const cover = Math.hypot(rect.width, rect.height) * 1.15 / 256;
    const variants = reducedMotion ? [1] : [1, 2];
    const sprites = variants.map(v => {
      const sprite = new PIXI.Sprite(stormTexture(kind, paletteKey, palette, v));
      sprite.anchor.set(0.5); sprite.position.set(cx, cy); sprite.scale.set(cover);
      sprite.blendMode = kind === 'eclipse' && !pixel ? 'normal' : 'add'; sprite.alpha = 0; sprite.visible = false;
      stormLayer.addChild(sprite);
      return sprite;
    });
    storms.push({sprites, age: 0, life: reducedMotion ? 360 : ELEMENT_STORM_MS, weight: rich ? 1 : 0.7});
    created.storms++;
  }
  /** Charge at a release point: an orb that swells while four glints spiral in. */
  function charge({x, y, palette, ms = 140, size = 26, follow = null}) {
    if (!glow()) return;
    const orb = new PIXI.Sprite(glow()); orb.anchor.set(0.5); orb.blendMode = 'add'; orb.tint = palette.main;
    const core = new PIXI.Sprite(glow()); core.anchor.set(0.5); core.blendMode = 'add'; core.tint = palette.core;
    const glints = Array.from({length: 4}, () => { const s = new PIXI.Sprite(glow()); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = palette.core; return s; });
    frontLayer.addChild(orb, core, ...glints);
    charges.push({orb, core, glints, x, y, follow, size, age: 0, life: Math.max(90, ms)});
    created.charges++;
  }
  /** Release: a shock ring across the shot direction and seven recoil sparks. */
  function muzzle({x, y, angle = 0, palette, size = 22}) {
    if (!ringTexture() || !sparkTexture()) return;
    const ring = new PIXI.Sprite(ringTexture()); ring.anchor.set(0.5); ring.blendMode = 'add'; ring.tint = palette.main;
    ring.position.set(x, y); ring.rotation = angle;
    frontLayer.addChild(ring);
    rings.push({sprite: ring, size, age: 0, life: 170});
    for (let i = 0; i < 7; i++) {
      const a = angle + Math.PI + (i - 3) * 0.32 + (random() - 0.5) * 0.2, v = 90 + random() * 120;
      const s = new PIXI.Sprite(sparkTexture()); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = i % 2 ? palette.core : palette.main;
      s.position.set(x, y); s.rotation = a; frontLayer.addChild(s);
      sparks.push({sprite: s, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 200 + random() * 80});
    }
    created.muzzles++;
  }
  /**
   * Play one native sequence of the effect atlas at a point (or following a
   * point getter). `scale` is screen px per native px; `repeatMs` loops it.
   * `angle` (radians) turns a travelling cell to its heading; the cells are
   * drawn facing right, so a leftward heading mirrors them top to bottom
   * instead of drawing them upside down.
   */
  function cell({bankId, sequence, x = 0, y = 0, scale = 2, hue = 0, follow = null, repeatMs = 0, flip = false, angle = null, overlay = false, alpha = 1, ground = false}) {
    const profile = profiles.banks[(bankId | 0) - 1]?.sequences?.[sequence];
    if (!art || !profile) return null;
    const frames = profile.frames.map(f => ({art: art.getCell(bankId, f.cell), ticks: Math.max(1, f.ticks)}));
    if (frames.some(f => !f.art)) return null;
    if (cells.length >= (rich ? 24 : 10)) { const old = cells.shift(); old.sprite.destroy(); }
    const sprite = new PIXI.Sprite(frames[0].art.texture);
    sprite.filters = hueFilter(hue);
    sprite.alpha = alpha;
    // Ground cells lie with the marks, under the fighters; the rest play over them.
    (ground ? decalLayer : frontLayer).addChild(sprite);
    const total = frames.reduce((t, f) => t + f.ticks, 0) * TICK_MS;
    // A ground cell plays its sequence once, however the bank loops it in flight.
    cells.push({sprite, frames, total, x, y, follow, scale, flip, angle, age: 0, life: ground ? total : Math.max(total, repeatMs), loop: !ground && (repeatMs > 0 || profile.playbackMode === 2)});
    created[overlay ? 'overlays' : 'cells']++;
    return true;
  }
  function placeCell(entry) {
    const total = entry.total, t = entry.loop ? entry.age % total : Math.min(entry.age, total - 1);
    let acc = 0, frame = entry.frames[entry.frames.length - 1];
    for (const f of entry.frames) { acc += f.ticks * TICK_MS; if (t < acc) { frame = f; break; } }
    const c = frame.art, s = entry.sprite;
    s.texture = c.texture;
    const w = c.frame?.[2] ?? c.texture.width, h = c.frame?.[3] ?? c.texture.height;
    s.anchor.set((c.origin?.[0] ?? w / 2) / w, (c.origin?.[1] ?? h / 2) / h);
    const k = entry.scale / (c.pixelsPerNativePixel ?? 1);
    if (Number.isFinite(entry.angle)) { s.rotation = entry.angle; s.scale.set(k, Math.cos(entry.angle) < 0 ? -k : k); }
    else s.scale.set(entry.flip ? -k : k, k);
    // A followed body that has gone (knocked out, left) hides the cell instead of
    // dropping it at the origin.
    const at = entry.follow ? entry.follow() : entry;
    if (!at) { s.visible = false; return; }
    s.position.set(at.x, at.y);
    s.visible = !c.blank;
  }

  function update(dtMs) {
    const realMs = dtMs;
    if (hold > 0) { hold = Math.max(0, hold - realMs); dtMs = 0; }
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]; d.age += realMs;
      if (d.age >= d.life) { d.sprite.destroy(); d.ember?.destroy(); decals.splice(i, 1); continue; }
      if (d.crater) { applyCrater(d); continue; }
      d.sprite.alpha = d.age < 80 ? d.age / 80 : d.age > d.life - 1200 ? (d.life - d.age) / 1200 : 1;
    }
    for (let i = storms.length - 1; i >= 0; i--) {
      const s = storms[i]; s.age += dtMs;
      if (s.age >= s.life) { s.sprites.forEach(x => x.destroy()); storms.splice(i, 1); continue; }
      const frame = Math.floor(s.age / (1000 / 15)), steps = ELEMENT_STORM_WEIGHTS;
      const weight = steps[Math.min(steps.length - 1, Math.floor(s.age / s.life * steps.length))] * s.weight;
      s.sprites.forEach((sprite, i) => {
        sprite.visible = s.sprites.length === 1 || frame % s.sprites.length === i;
        sprite.alpha = weight;
        if (!reducedMotion) sprite.rotation = frame * 0.06 * (i ? -1 : 1);
      });
    }
    for (let i = charges.length - 1; i >= 0; i--) {
      const c = charges[i]; c.age += dtMs;
      const k = Math.min(1, c.age / c.life), at = c.follow?.() ?? c;
      if (c.age >= c.life) { [c.orb, c.core, ...c.glints].forEach(s => s.destroy()); charges.splice(i, 1); continue; }
      const swell = c.size / 64 * (0.55 + 0.75 * Math.sin(k * Math.PI * 0.5));
      c.orb.position.set(at.x, at.y); c.orb.scale.set(swell * 1.6); c.orb.alpha = 0.85;
      c.core.position.set(at.x, at.y); c.core.scale.set(swell * 0.7); c.core.alpha = 1;
      c.glints.forEach((g, j) => {
        const a = j * Math.PI / 2 + k * Math.PI * 2.2, r = c.size * 1.3 * (1 - k);
        g.position.set(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * 0.8); g.scale.set(0.16); g.alpha = 0.4 + 0.6 * k;
      });
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.age += dtMs;
      if (r.age >= r.life) { r.sprite.destroy(); rings.splice(i, 1); continue; }
      const k = r.age / r.life;
      r.sprite.scale.set(r.size / 64 * (0.35 + 0.55 * k), r.size / 64 * (0.9 + 1.4 * k)); r.sprite.alpha = 1 - k;
    }
    const dt = dtMs / 1000;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dtMs;
      if (s.age >= s.life) { s.sprite.destroy(); sparks.splice(i, 1); continue; }
      s.vx *= 1 - 3 * dt; s.vy *= 1 - 3 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.sprite.position.set(s.x, s.y); s.sprite.alpha = 1 - s.age / s.life;
    }
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i]; c.age += dtMs;
      if (c.age >= c.life) { c.sprite.destroy(); cells.splice(i, 1); continue; }
      placeCell(c);
    }
  }

  return Object.freeze({
    decal, storm, charge, muzzle, cell, update,
    /** Drawing-only hit-stop: everything but the decal fades holds for `ms`. */
    hold(ms) { if (!reducedMotion) hold = Math.max(hold, ms); },
    holding: () => hold > 0,
    setArt(next) { art = next ?? null; },
    getDiagnostics: () => Object.freeze({decals: decals.length, storms: storms.length, charges: charges.length, rings: rings.length,
      sparks: sparks.length, cells: cells.length, created: {...created}, art: Boolean(art), holding: hold > 0}),
    dispose() {
      for (const node of [stormLayer, decalLayer, frontLayer]) { node.parent?.removeChild(node); node.destroy({children: true}); }
      for (const t of textures.values()) t.destroy(true);
      textures.clear(); filters.clear();
      decals.length = storms.length = charges.length = rings.length = sparks.length = cells.length = 0;
    }
  });
}
