// Move VFX kit -- baked flipbooks (OWNER_APPROVED_ADAPTATION 2026-11-05,
// MOVE_VFX_KIT_20261105: 「商業級遊戲該有的招式特效」, one style for every move).
//
// Every texture is computed here from fractal noise and distance fields, then
// coloured through the move's three-tone palette (edge -> main -> core) by
// intensity. No image file, no ROM pixel and no generated picture enters: the
// kit adds no download and no asset-rights question. Smooth, high-resolution
// and additive by design, so it sits with the HD-2D fields and lighting
// instead of enlarging 16 px cells.
//
// Shapes are drawn facing +x (right); the runtime turns them to their heading.
// A sheet is baked the first time a palette asks for it and cached until
// dispose(). Presentation only.

const TAU = Math.PI * 2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Tileable fractal value noise on a `size` square, sampled with wrap. */
export function createNoiseField(size = 128, seed = 0x5eed) {
  let s = seed >>> 0;
  const random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const field = new Float32Array(size * size);
  let total = 0;
  for (const [period, weight] of [[4, 0.5], [8, 0.25], [16, 0.15], [32, 0.1]]) {
    const grid = Array.from({length: period * period}, random);
    const cell = size / period;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => grid[((j + period) % period) * period + ((i + period) % period)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      field[y * size + x] += (top + (bottom - top) * sy) * weight;
    }
    total += weight;
  }
  for (let i = 0; i < field.length; i++) field[i] /= total;
  return {
    size,
    /** Noise in [0, 1] at a point; coordinates wrap, so any offset scrolls seamlessly. */
    at(u, v) {
      const x = ((u % size) + size) % size, y = ((v % size) + size) % size;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
      const a = field[y0 * size + x0], b = field[y0 * size + x1], c = field[y1 * size + x0], d = field[y1 * size + x1];
      return a + (b - a) * fx + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
  };
}

const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Intensity -> colour through edge, main and core; alpha follows intensity. */
function ramp(palette, {soft = false} = {}) {
  const edge = rgb(palette.edge), main = rgb(palette.main), core = rgb(palette.core);
  return i => {
    const k = clamp01(i);
    // Most of the range is edge -> main; only the hottest tenth reaches the core.
    const [a, b, t] = k < 0.55 ? [edge, main, k / 0.55] : k < 0.9 ? [main, core, (k - 0.55) / 0.35] : [core, core, 0];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, soft ? smooth(0, 0.5, k) : smooth(0.03, 0.4, k)];
  };
}

/** Smoke: one shade of the palette's smoke colour, light at the top of the puff. */
function smokeRamp(palette) {
  const base = rgb(palette.smoke ?? 0x606060);
  return i => [base[0] + (255 - base[0]) * 0.25 * i, base[1] + (255 - base[1]) * 0.25 * i, base[2] + (255 - base[2]) * 0.25 * i, smooth(0.05, 0.6, i) * 0.82];
}

/**
 * The sheet recipes. Each returns {width, height, frames, fn(x, y, t, n)}
 * where x, y are in [-1, 1] (y down), t in [0, 1) across the frames, and
 * `n(u, v)` samples the noise in texture pixels. `fn` returns intensity.
 */
const SHEETS = Object.freeze({
  // A comet head with a licking tail, pointing right, looping.
  comet: {width: 128, height: 64, frames: 8, loop: true, fn(x, y, t, n) {
    const hx = 0.62, along = clamp01((hx - x) / 1.55); // 0 at the head, 1 at the tail end
    const radius = 0.62 * (1 - along) ** 0.85 + 0.04;
    const d = x > hx ? Math.hypot((x - hx) / 0.36, y / 0.62) : Math.abs(y) / radius;
    const lick = n((x + 1) * 40 + t * 128, (y + 1) * 20) * 0.9 + n((x + 1) * 90 + t * 256, (y + 1) * 45 + 17) * 0.45;
    // The tail frays: noise eats more of it the further it trails.
    const body = (1 - smooth(0.2, 1.05, d + (lick - 0.6) * 0.5 * along)) * smooth(along * 0.6 - 0.15, along * 0.6 + 0.3, lick * 0.85);
    const hot = 1 - smooth(0, 0.6, Math.hypot((x - hx + 0.12) / 0.34, y / 0.38));
    return body * (0.3 + lick * 0.55) * (1 - along * 0.55) + hot * 0.62;
  }},
  // A ball of churning energy, looping (dark orbs, thunder balls, sound).
  orb: {width: 96, height: 96, frames: 8, loop: true, fn(x, y, t, n) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const swirl = n(Math.cos(a + t * TAU) * 24 + r * 60, Math.sin(a + t * TAU) * 24 + r * 60 + t * 128);
    const shell = 1 - smooth(0.45, 0.95, r + (swirl - 0.5) * 0.25);
    return shell * (0.25 + swirl * 0.55) + (1 - smooth(0, 0.5, r)) * 0.45;
  }},
  // An explosion: a hot ball that grows, cools and breaks into wisps.
  burst: {width: 128, height: 128, frames: 12, fn(x, y, t, n) {
    const grow = 0.38 + 0.58 * (1 - (1 - t) ** 3);
    const r = Math.hypot(x, y) / grow;
    const wisps = n(x * 48 + 64, y * 48 + 64) * 0.7 + n(x * 110 + 9, y * 110 + 31) * 0.35;
    const erode = smooth(t * 0.7 - 0.12, t * 0.7 + 0.28, wisps * (1 - r * 0.45));
    const ball = (1 - smooth(0.45, 1, r + (wisps - 0.5) * 0.35)) * erode;
    // Hot at the heart, cooler at the rim, and cooling as it burns out.
    return ball * (0.3 + 0.7 * (1 - r) ** 0.7) * (1.05 - t * 0.8) * (0.75 + wisps * 0.45) + (t < 0.18 ? (1 - smooth(0, 0.55, r)) * (1 - t / 0.18) * 0.9 : 0);
  }},
  // Smoke puff: grows and frays (normal blend, smoke colour).
  smoke: {width: 64, height: 64, frames: 10, smoke: true, fn(x, y, t, n) {
    const r = Math.hypot(x, y) / (0.55 + 0.4 * t);
    const fray = n(x * 32 + 40 + t * 20, y * 32 + 40 - t * 30);
    return (1 - smooth(0.35, 1, r + (fray - 0.5) * 0.5)) * (1 - smooth(0.3, 1, t + (0.5 - fray) * 0.4)) * (0.6 + fray * 0.6);
  }},
  // A crescent slash that sweeps open, then thins away.
  slash: {width: 128, height: 128, frames: 8, fn(x, y, t, n) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x); // the arc spans -1.25..1.25 rad on the right side
    const open = smooth(0, 0.45, t), fade = 1 - smooth(0.5, 1, t);
    const span = 1.25, head = -span + 2 * span * open;
    if (a > head || a < -span) return 0;
    const along = (a + span) / (2 * span); // 0 at the tail, 1 at the far tip
    const taper = Math.sin(Math.PI * clamp01(along)) ** 0.7;
    const width = 0.2 * taper * (0.4 + 0.6 * fade);
    const band = 1 - smooth(0, width + 0.001, Math.abs(r - 0.72));
    const grain = n(a * 40 + 64, r * 60);
    return band * (0.75 + grain * 0.5) * (0.45 + 0.55 * fade) + band * smooth(head - 0.35, head, a) * 0.5;
  }},
  // A water crest: a thick arch that rolls out from left to right, foam on its lip.
  crest: {width: 128, height: 96, frames: 10, fn(x, y, t, n) {
    const cy = 1.05, r = Math.hypot(x, y - cy), a = Math.atan2(x, cy - y); // a: -1.2 (left) .. 1.2 (right)
    const front = -1.25 + 2.5 * smooth(0, 0.7, t), fade = 1 - smooth(0.6, 1, t);
    if (a > front + 0.12) return 0;
    const cut = 1 - smooth(front - 0.04, front + 0.12, a);
    const thick = 0.22 * (1 - smooth(0.6, 1.25, Math.abs(a))) + 0.04;
    const body = 1 - smooth(thick * 0.6, thick, Math.abs(r - 0.95 + 0.1 * Math.sin(a * 3 + t * 6)));
    const churn = n(a * 60 - t * 90, r * 70);
    const lip = (1 - smooth(0, 0.07, Math.abs(r - 0.95 - thick * 0.8))) * smooth(0.35, 0.8, churn);
    const head = 1 - smooth(0, 0.25, front - a);
    return (body * (0.3 + churn * 0.5) + lip * 0.8 + body * head * 0.35) * fade * cut;
  }},
  // A straight beam section, tileable along x, looping.
  beam: {width: 128, height: 48, frames: 8, loop: true, fn(x, y, t, n) {
    const flow = n((x + 1) * 64 - t * 128, (y + 1) * 12) * 0.7 + n((x + 1) * 64 - t * 256, (y + 1) * 30 + 50) * 0.4;
    const core = 1 - smooth(0, 0.28 + flow * 0.1, Math.abs(y));
    const glow = 1 - smooth(0.1, 0.95 + (flow - 0.5) * 0.3, Math.abs(y));
    return core * 1.0 + glow * (0.35 + flow * 0.45);
  }},
  // Statics: a soft glow, a star flare, a ring, a spark streak, a shard, a drop, a leaf.
  glow: {width: 64, height: 64, frames: 1, soft: true, fn: (x, y) => (1 - smooth(0, 1, Math.hypot(x, y))) ** 1.6},
  flare: {width: 128, height: 128, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const spikes = Math.abs(Math.cos(a * 2)) ** 24 * (1 - smooth(0, 1, r)) + Math.abs(Math.cos(a * 2 + Math.PI / 4)) ** 40 * (1 - smooth(0, 0.6, r)) * 0.6;
    return spikes + (1 - smooth(0, 0.5, r)) ** 2 * 1.1;
  }},
  ring: {width: 128, height: 128, frames: 1, fn(x, y, t, n) {
    const r = Math.hypot(x, y);
    return (1 - smooth(0, 0.09, Math.abs(r - 0.86))) * (0.75 + n(Math.atan2(y, x) * 20 + 64, 3) * 0.5) + (1 - smooth(0, 0.3, Math.abs(r - 0.82))) * 0.25;
  }},
  streak: {width: 64, height: 16, frames: 1, fn: (x, y) => (1 - smooth(0, 1, Math.abs(y) / (0.15 + 0.85 * clamp01((x + 1) / 2)))) * smooth(-1, 0.4, x) * (1 - smooth(0.85, 1, x))},
  shard: {width: 64, height: 32, frames: 1, fn(x, y) {
    const d = Math.abs(y) / 0.85 + Math.max(0, x) / 0.95 + Math.max(0, -x) / 0.7;
    const facet = y < 0 ? 1 : 0.7;
    return (1 - smooth(0.82, 1, d)) * facet * (0.55 + 0.45 * (1 - Math.abs(y) * 1.2)) + (1 - smooth(0, 0.25, Math.abs(y) + Math.abs(x - 0.2) * 0.3)) * 0.5;
  }},
  drop: {width: 48, height: 32, frames: 1, fn(x, y) {
    const d = x > 0.2 ? Math.hypot((x - 0.2) / 0.75, y / 0.8) : Math.abs(y) / (0.8 * smooth(-1, 0.2, x) + 0.02);
    return (1 - smooth(0.7, 1, d)) * (0.55 + 0.6 * (1 - smooth(0, 0.6, Math.hypot(x - 0.35, y + 0.3))));
  }},
  leaf: {width: 48, height: 32, frames: 1, fn(x, y) {
    const w = 0.85 * Math.sqrt(clamp01(1 - x * x));
    const vein = 1 - smooth(0, 0.08, Math.abs(y));
    return (1 - smooth(w * 0.75, w + 0.01, Math.abs(y))) * (0.6 + 0.3 * (1 - Math.abs(y) / (w + 0.01))) + vein * 0.35 * (1 - smooth(0.6, 1, Math.abs(x)));
  }},
  // A ground mark (normal blend, smoke colour), flattened by the caller.
  decal: {width: 128, height: 128, frames: 1, smoke: true, fn(x, y, t, n) {
    const r = Math.hypot(x, y), rough = n(x * 30 + 64, y * 30 + 64);
    return (1 - smooth(0.45, 0.95, r + (rough - 0.5) * 0.45)) * (0.55 + rough * 0.5);
  }}
});
export const MOVE_VFX_SHEETS = Object.freeze(Object.keys(SHEETS));

/**
 * Intensity of every frame of one sheet, palette-free (Uint8 per pixel). This
 * is the expensive part, so it runs once per sheet; colouring per palette is a
 * table look-up.
 */
export function bakeMoveVfxIntensity(name, noise, {scale = 1} = {}) {
  const sheet = SHEETS[name];
  if (!sheet) return null;
  const width = Math.max(8, Math.round(sheet.width * scale)), height = Math.max(8, Math.round(sheet.height * scale));
  const k = noise.size / Math.max(sheet.width, sheet.height);
  const n = (u, v) => noise.at(u * k, v * k);
  const frames = [];
  for (let f = 0; f < sheet.frames; f++) {
    const data = new Uint8Array(width * height);
    const t = sheet.frames > 1 ? f / sheet.frames : 0;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const x = (px + 0.5) / width * 2 - 1, y = (py + 0.5) / height * 2 - 1;
      data[py * width + px] = Math.round(clamp01(sheet.fn(x, y, t, n)) * 255);
    }
    frames.push(data);
  }
  return {name, frames, width, height, loop: Boolean(sheet.loop), smoke: Boolean(sheet.smoke), soft: Boolean(sheet.soft)};
}

/** Colour a baked sheet with one palette: one canvas per frame. `doc` supplies createElement. */
export function paintMoveVfxSheet(intensity, palette, {doc = globalThis.document} = {}) {
  if (!intensity || !doc) return null;
  const colour = intensity.smoke ? smokeRamp(palette) : ramp(palette, {soft: intensity.soft});
  const table = Array.from({length: 256}, (_, i) => colour(i / 255));
  const frames = intensity.frames.map(data => {
    const canvas = doc.createElement('canvas');
    canvas.width = intensity.width; canvas.height = intensity.height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(intensity.width, intensity.height);
    for (let i = 0; i < data.length; i++) {
      const [r, g, b, a] = table[data[i]];
      image.data[i * 4] = r; image.data[i * 4 + 1] = g; image.data[i * 4 + 2] = b; image.data[i * 4 + 3] = Math.round(a * 255);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  });
  return {name: intensity.name, frames, loop: intensity.loop, width: intensity.width, height: intensity.height, smoke: intensity.smoke};
}
