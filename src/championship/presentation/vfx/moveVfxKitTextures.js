// Move VFX kit -- baked flipbooks (OWNER_APPROVED_ADAPTATION 2026-11-05,
// MOVE_VFX_KIT_20261105: 「商業級遊戲該有的招式特效」, one style for every move).
//
// Every texture is computed here from fractal noise and distance fields, then
// coloured through the move's three-tone palette (edge -> main -> core) by
// intensity. No image file, no ROM pixel and no generated picture enters: the
// kit adds no download and no asset-rights question. Since
// UNIQUE_PIXEL_MOVE_VFX_20261108 the kit paints with the pixel finish below
// (flat tones, dark outline, stepped light) so every mode shares the look of
// the original remade cells; the smooth ramp stays for `pixel: false`.
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
  // A vine section, tileable along x: a twisting stem with thorn buds.
  stem: {width: 64, height: 24, frames: 1, fn(x, y) {
    const centre = Math.sin(x * Math.PI) * 0.22, d = Math.abs(y - centre);
    const bud = Math.max(0, 1 - Math.hypot((x - 0.45) / 0.18, (y - centre + 0.55) / 0.3)) + Math.max(0, 1 - Math.hypot((x + 0.5) / 0.18, (y - centre - 0.55) / 0.3));
    return (1 - smooth(0.28, 0.42, d)) * (0.5 + 0.35 * (1 - d / 0.42)) + smooth(0.2, 0.6, bud) * 0.6;
  }},
  // A spike pointing up (roots, ground spikes, ice and earth), anchored at its base.
  spike: {width: 32, height: 96, frames: 1, fn(x, y) {
    const up = (1 - y) / 2; // 0 at the base, 1 at the tip
    const bend = Math.sin(up * Math.PI) * 0.12, half = 0.85 * (1 - up) ** 0.9;
    const d = Math.abs(x - bend) / (half + 0.001);
    return (1 - smooth(0.82, 1, d)) * (x < bend ? 0.85 : 0.55) * (0.6 + 0.4 * up);
  }},
  // A tree trunk, anchored at its base, with two branches near the top.
  trunk: {width: 48, height: 96, frames: 1, fn(x, y, t, n) {
    const up = (1 - y) / 2, half = 0.42 - up * 0.18;
    const bark = n(x * 30 + 64, y * 8) * 0.35;
    const trunk = 1 - smooth(half - 0.06, half, Math.abs(x));
    const branch = up > 0.6 ? Math.max(1 - smooth(0, 0.09, Math.abs(y + 0.25 + x * 0.9)), 1 - smooth(0, 0.09, Math.abs(y + 0.4 - x * 0.8))) * smooth(0.6, 0.7, up) : 0;
    return Math.max(trunk * (0.45 + bark) * (x < 0 ? 1 : 0.75), branch * 0.6);
  }},
  // A canopy that bursts open from a bud, leaf-edged.
  canopy: {width: 128, height: 96, frames: 8, fn(x, y, t, n) {
    const grow = 0.3 + 0.7 * (1 - (1 - Math.min(1, t * 1.6)) ** 3);
    let blob = 0;
    for (const [cx, cy, r] of [[0, 0.05, 0.55], [-0.45, 0.2, 0.42], [0.45, 0.2, 0.42], [-0.22, -0.3, 0.42], [0.25, -0.32, 0.4]]) blob = Math.max(blob, 1 - Math.hypot((x - cx * grow) / (r * grow), (y - cy * grow) / (r * grow * 1.15)));
    const leaves = n(x * 70 + 64, y * 70 + 64);
    return smooth(0.02, 0.25, blob + (leaves - 0.5) * 0.25) * (0.3 + leaves * 0.35 + blob * 0.25);
  }},
  // A missile facing right: nose cone, body, tail fins.
  missile: {width: 64, height: 24, frames: 1, fn(x, y) {
    const body = x > -0.65 && x < 0.45 && Math.abs(y) < 0.38 ? 1 : 0;
    const nose = x >= 0.45 && Math.abs(y) < 0.38 * (1 - (x - 0.45) / 0.5) ? 1 : 0;
    const fin = x < -0.35 && x > -0.85 && Math.abs(y) < 0.38 + (-0.35 - x) * 1.4 ? 1 : 0;
    const shade = 0.75 - y * 0.35, band = Math.abs(x - 0.15) < 0.06 ? 0.35 : 0;
    return Math.max(body * (shade + band), nose * (shade + 0.15), fin * 0.45);
  }},
  // A cannon ball with a highlight.
  ball: {width: 32, height: 32, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y);
    return (1 - smooth(0.8, 0.9, r)) * (0.35 + 0.65 * (1 - smooth(0, 0.55, Math.hypot(x + 0.3, y + 0.3))));
  }},
  // A rock chunk with facets.
  rock: {width: 48, height: 40, frames: 1, fn(x, y, t, n) {
    const a = Math.atan2(y, x), r = Math.hypot(x, y), edge = 0.78 + 0.14 * Math.cos(a * 5 + 1) + 0.06 * Math.cos(a * 9);
    return (1 - smooth(edge - 0.06, edge, r)) * (0.45 + (y < 0 ? 0.3 : 0) + (x < 0 ? 0.12 : 0) + n(x * 20 + 64, y * 20) * 0.15);
  }},
  // A tornado funnel, wide at the top, looping.
  funnel: {width: 64, height: 128, frames: 8, loop: true, fn(x, y, t, n) {
    const up = (1 - y) / 2, half = 0.12 + 0.78 * up ** 1.4, sway = Math.sin(up * 4 + t * TAU) * 0.08;
    const d = Math.abs(x - sway) / half;
    if (d > 1) return 0;
    const bands = n(Math.asin(Math.max(-1, Math.min(1, (x - sway) / half))) * 30 + t * 128, up * 40);
    return (1 - smooth(0.7, 1, d)) * (0.3 + bands * 0.7) * smooth(0, 0.12, up) * (1 - smooth(0.92, 1, up));
  }},
  // UNIQUE_PIXEL_MOVE_VFX_20261108: the things a named ranged move throws.
  // A four-bladed throwing star (the kit spins it).
  shuriken: {width: 48, height: 48, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y), edge = 0.3 + 0.62 * Math.abs(Math.cos(Math.atan2(y, x) * 2)) ** 6;
    return r < 0.12 ? 0 : (1 - smooth(edge - 0.08, edge, r)) * (0.55 + (y < 0 ? 0.3 : 0));
  }},
  // A crescent blade, horns pointing back (left), bright on its cutting edge.
  crescent: {width: 64, height: 64, frames: 1, fn(x, y) {
    const outer = Math.hypot(x, y), inner = Math.hypot(x + 0.38, y * 1.05);
    const body = (1 - smooth(0.78, 0.86, outer)) * smooth(0.62, 0.7, inner);
    return body * (0.5 + 0.5 * smooth(0.2, 0.85, x + 0.3) + (outer > 0.72 ? 0.25 : 0));
  }},
  // A five-pointed star.
  star: {width: 48, height: 48, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2;
    const edge = 0.42 + 0.5 * Math.abs(Math.cos(a * 2.5)) ** 3;
    return (1 - smooth(edge - 0.08, edge, r)) * (0.6 + 0.4 * (1 - r)) + (1 - smooth(0, 0.3, r)) * 0.4;
  }},
  // A bubble: a thin shell with a highlight.
  bubble: {width: 40, height: 40, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y);
    return (1 - smooth(0, 0.14, Math.abs(r - 0.78))) * 0.75 + (1 - smooth(0, 0.22, Math.hypot(x + 0.32, y + 0.34))) * 0.95 + (1 - smooth(0.3, 0.8, r)) * 0.18;
  }},
  // A musical note: head, stem and flag, upright.
  note: {width: 40, height: 56, frames: 1, fn(x, y) {
    const head = 1 - smooth(0.3, 0.38, Math.hypot((x + 0.25) / 1.25, (y - 0.55) / 0.9));
    const stem = x > 0.12 && x < 0.3 && y > -0.85 && y < 0.55 ? 1 : 0;
    const flag = x > 0.25 && x < 0.75 && Math.abs(y + 0.62 - (x - 0.25) * 0.9) < 0.14 ? 1 : 0;
    return Math.max(head * 0.85, stem * 0.75, flag * 0.7);
  }},
  // A feather pointing right: shaft and a vane that narrows to the tip.
  feather: {width: 64, height: 24, frames: 1, fn(x, y) {
    const w = 0.85 * Math.sin(Math.PI * clamp01((x + 0.9) / 1.85)) ** 0.7;
    const vane = 1 - smooth(w * 0.8, w + 0.02, Math.abs(y));
    const barbs = 0.75 + 0.25 * Math.sin((x - Math.abs(y) * 0.6) * 22);
    const shaft = 1 - smooth(0, 0.1, Math.abs(y));
    return Math.max(vane * 0.6 * barbs, shaft * 0.9 * smooth(-1, -0.7, x));
  }},
  // A petal pointing right.
  petal: {width: 40, height: 28, frames: 1, fn(x, y) {
    const w = 0.85 * Math.sqrt(clamp01((1 - x) / 2)) * smooth(-1, -0.6, x);
    return (1 - smooth(w * 0.8, w + 0.01, Math.abs(y))) * (0.55 + 0.45 * (1 - Math.abs(y) / (w + 0.01)));
  }},
  // A six-armed snowflake.
  snowflake: {width: 48, height: 48, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y);
    let arm = 0;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, along = x * Math.cos(a) + y * Math.sin(a), across = -x * Math.sin(a) + y * Math.cos(a);
      if (along > 0 && along < 0.92) arm = Math.max(arm, 1 - smooth(0.05, 0.12, Math.abs(across)));
      if (along > 0.45 && along < 0.75) arm = Math.max(arm, 1 - smooth(0.04, 0.1, Math.abs(Math.abs(across) - (along - 0.45) * 0.9)));
    }
    return Math.max(arm * 0.85, (1 - smooth(0.1, 0.22, r)) * 0.95);
  }},
  // A drill cone pointing right, its bands turning (looping).
  drill: {width: 64, height: 40, frames: 6, loop: true, fn(x, y, t) {
    const half = 0.85 * clamp01((0.95 - x) / 1.7);
    if (Math.abs(y) > half || x < -0.8) return 0;
    const band = 0.5 + 0.5 * Math.sin((x * 9 + y / (half + 0.01) * 2.2 - t * TAU) * 1.0);
    return (0.45 + band * 0.45) * (y < 0 ? 1 : 0.8);
  }},
  // Concrete things an original effect family threw (UNIQUE_PIXEL_MOVE_VFX_20261108,
  // Owner: the mushroom move must stay a mushroom). Drawn here from shapes, as
  // design references only: no original pixel, palette or layout is used.
  // A mushroom standing on its stem, anchored at the base: a domed cap with spots.
  mushroom: {width: 48, height: 48, frames: 1, fn(x, y) {
    const stem = Math.abs(x) < 0.24 - y * 0.04 && y > -0.05 && y < 0.95 ? 0.78 + (x < 0 ? 0.06 : 0) : 0;
    const capR = Math.hypot(x / 0.92, (y + 0.05) / 0.72);
    const cap = y < 0.12 && capR < 1 ? 0.62 + (y < -0.35 ? 0.1 : 0) : 0;
    const spot = cap && [[-0.42, -0.3, 0.17], [0.18, -0.48, 0.15], [0.5, -0.12, 0.13], [-0.1, -0.08, 0.12]].some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r) ? 1 : 0;
    return Math.max(stem, cap, spot);
  }},
  // A round bomb with a fuse, lit from the top left.
  bomb: {width: 40, height: 40, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y - 0.15);
    const body = r < 0.72 ? 0.42 + (1 - smooth(0, 0.35, Math.hypot(x + 0.28, y + 0.12))) * 0.5 : 0;
    const cap = Math.abs(x - 0.32) < 0.16 && y > -0.75 && y < -0.48 ? 0.55 : 0;
    const fuse = Math.abs(x - 0.48 - (y + 0.75) * -0.4) < 0.07 && y > -0.98 && y < -0.72 ? 0.7 : 0;
    return Math.max(body, cap, fuse);
  }},
  // A banana, curved, pointing right.
  banana: {width: 48, height: 32, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y + 1.35), a = Math.atan2(x, y + 1.35);
    if (Math.abs(a) > 0.62) return 0;
    const thick = 0.26 * Math.cos(a / 0.62 * Math.PI / 2) ** 0.6 + 0.04;
    return Math.abs(r - 1.55) < thick ? 0.55 + (r > 1.55 ? 0.2 : 0) + (Math.abs(a) > 0.55 ? -0.3 : 0) : 0;
  }},
  // A fish swimming right, with a tail and an eye.
  fish: {width: 56, height: 32, frames: 1, fn(x, y) {
    const body = Math.hypot((x - 0.15) / 0.75, y / 0.62) < 1;
    const tail = x < -0.5 && x > -0.98 && Math.abs(y) < (-0.5 - x) * 1.25;
    const eye = Math.hypot(x - 0.55, y + 0.12) < 0.1;
    if (eye) return 0;
    return body ? 0.5 + (y < 0 ? 0.2 : 0) + (Math.abs(x - 0.0) < 0.05 ? 0.25 : 0) : tail ? 0.45 : 0;
  }},
  // A gear with eight teeth and an axle hole.
  gear: {width: 48, height: 48, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const edge = 0.68 + (Math.cos(a * 8) > 0.2 ? 0.26 : 0);
    return r < edge && r > 0.24 ? 0.5 + (y < 0 ? 0.15 : 0) + (r < 0.45 ? 0.15 : 0) : 0;
  }},
  // A bone: a shaft with two knobs at each end.
  bone: {width: 56, height: 28, frames: 1, fn(x, y) {
    const shaft = Math.abs(x) < 0.68 && Math.abs(y) < 0.2;
    const knob = [[-0.74, -0.28], [-0.74, 0.28], [0.74, -0.28], [0.74, 0.28]].some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 0.3);
    return shaft || knob ? 0.6 + (y < 0 ? 0.2 : 0) : 0;
  }},
  // A heart.
  heart: {width: 40, height: 40, frames: 1, fn(x, y) {
    const u = x * 1.2, v = -(y * 1.2) + 0.25;
    const f = (u * u + v * v - 1) ** 3 - u * u * v ** 3;
    return f < 0 ? 0.55 + (1 - smooth(0, 0.4, Math.hypot(x + 0.35, y + 0.3))) * 0.45 : 0;
  }},
  // A syringe pointing right: plunger, barrel with liquid, needle.
  syringe: {width: 64, height: 24, frames: 1, fn(x, y) {
    if (x > 0.42 && x < 1 && Math.abs(y) < 0.08) return 0.75;
    if (x > -0.62 && x <= 0.42 && Math.abs(y) < 0.36) return x > -0.15 ? 0.9 : 0.4;
    if (x > -0.98 && x <= -0.62 && Math.abs(y) < 0.12) return 0.5;
    if (Math.abs(x + 0.98) < 0.05 && Math.abs(y) < 0.4) return 0.5;
    return 0;
  }},
  // An egg with spots.
  egg: {width: 36, height: 44, frames: 1, fn(x, y) {
    const inside = Math.hypot(x / 0.72, y / (y < 0 ? 0.96 : 0.8)) < 1;
    const spot = [[-0.25, -0.3, 0.16], [0.28, 0.1, 0.14], [-0.1, 0.45, 0.12]].some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r);
    return inside ? (spot ? 0.95 : 0.5 + (1 - smooth(0, 0.5, Math.hypot(x + 0.25, y + 0.4))) * 0.3) : 0;
  }},
  // An explosion built of several fireballs: they swell out from a hot core,
  // then cool and break into fragments (8 frames across the blast).
  blast: {width: 64, height: 64, frames: 8, fn(x, y, t, n) {
    const g = 1 - (1 - Math.min(1, t * 1.8)) ** 3;
    let v = 1 - Math.hypot(x, y + 0.05) / (0.18 + 0.32 * g);
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + 0.4, r = (0.2 + 0.3 * g) * (0.8 + 0.2 * Math.sin(i * 2.3));
      v = Math.max(v, 1 - Math.hypot(x - Math.cos(a) * 0.36 * g, y - Math.sin(a) * 0.3 * g + 0.05) / r);
    }
    if (v <= 0) return 0;
    if (t > 0.5 && n(x * 44 + 64, y * 44 + 64) < (t - 0.5) * 1.9) return 0;
    const hot = Math.hypot(x, y) < 0.3 * (1 - t) ? 0.3 : 0;
    return Math.min(1, 0.45 + v * 0.55 + hot - t * 0.25);
  }},
  // A splash: drops thrown up and out from a low ring (6 frames).
  splash: {width: 64, height: 48, frames: 6, fn(x, y, t) {
    let v = 0;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.1 + 0.8 * i / 8), reach = 0.15 + 0.75 * t;
      const cx = Math.cos(a) * reach, cy = 0.55 + Math.sin(a) * reach * 1.1 + t * t * 0.6, r = 0.15 * (1 - t * 0.45) * (i % 2 ? 0.8 : 1);
      v = Math.max(v, 1 - Math.hypot(x - cx, y - cy) / r);
    }
    const ring = Math.abs(Math.hypot(x / (0.3 + 0.6 * t), (y - 0.7) / 0.18) - 1) < 0.25 && t < 0.7 ? 0.5 : 0;
    return v > 0 ? 0.55 + v * 0.45 : ring;
  }},
  // The tail end of an effect: fragments drifting apart and thinning out (4 frames).
  debris: {width: 48, height: 48, frames: 4, fn(x, y, t) {
    const cell = 0.2, gx = Math.floor((x / (0.6 + 0.5 * t) + 1) / cell), gy = Math.floor((y / (0.6 + 0.5 * t) + 1) / cell);
    let h = Math.imul(gx * 374761393 + gy * 668265263, 1274126177) >>> 0; h = ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    const lx = ((x / (0.6 + 0.5 * t) + 1) / cell) % 1, ly = ((y / (0.6 + 0.5 * t) + 1) / cell) % 1;
    return h < 0.32 * (1 - t * 0.7) && lx > 0.2 && lx < 0.8 && ly > 0.2 && ly < 0.8 && Math.hypot(x, y) < 0.95 ? 0.55 + h : 0;
  }},
  // A lightning bolt running right: a zigzag core with a halo and a fork, flickering (looping).
  bolt: {width: 64, height: 32, frames: 4, loop: true, fn(x, y, t) {
    const zig = u => { const v = u * 2.6 + t * 1.7; return (Math.abs(((v % 1) + 1) % 1 - 0.5) * 4 - 1) * 0.5 * Math.cos(u * 1.3); };
    const d = Math.abs(y - zig(x)), fork = x > 0 && x < 0.6 ? Math.abs(y - zig(x) - (x * 0.9)) : 9;
    return Math.min(1, d < 0.07 ? 1 : d < 0.2 ? 0.55 : 0) || (fork < 0.06 ? 0.8 : fork < 0.14 ? 0.45 : 0);
  }},
  // An arrow flying right: head, shaft and fletching.
  arrow: {width: 64, height: 24, frames: 1, fn(x, y) {
    if (x > 0.42 && Math.abs(y) < (1 - x) * 0.75) return 0.92;
    if (x > -0.78 && x <= 0.42 && Math.abs(y) < 0.09) return 0.6;
    if (x <= -0.62 && x > -1 && Math.abs(y) < 0.12 + (-0.62 - x) * 1.6 && Math.abs(y) > 0.04) return 0.45;
    return 0;
  }},
  // A cat's eye: an almond with a round iris and a slit pupil.
  eye: {width: 56, height: 32, frames: 1, fn(x, y) {
    const lid = 0.62 * Math.cos(x * Math.PI / 2);
    if (Math.abs(y) > lid) return 0;
    const r = Math.hypot(x, y);
    if (Math.abs(x) < 0.08 && Math.abs(y) < 0.4) return 0;
    return r < 0.45 ? (Math.hypot(x + 0.15, y + 0.15) < 0.1 ? 1 : 0.72) : 0.45;
  }},
  // A ghost's face in a hood of flame: round head, two eye holes, wisps above.
  ghost: {width: 48, height: 48, frames: 1, fn(x, y, t, n) {
    const head = Math.hypot(x / 0.72, (y - 0.08) / 0.68) < 1;
    const hole = Math.hypot(Math.abs(x) - 0.28, y + 0.02) < 0.16 || (Math.abs(x) < 0.22 && Math.abs(y - 0.42) < 0.06);
    const wisp = y < -0.4 && Math.abs(x) < 0.8 && n(x * 30 + 64, y * 20) > 0.45 + (y + 1) * 0.3;
    if (head) return hole ? 0 : 0.62 + (y < -0.1 ? 0.15 : 0);
    return wisp ? 0.45 : 0;
  }},
  // Two cherries on joined stems with a leaf.
  cherry: {width: 40, height: 40, frames: 1, fn(x, y) {
    for (const [cx, cy] of [[-0.38, 0.45], [0.32, 0.52]]) {
      const r = Math.hypot(x - cx, y - cy);
      if (r < 0.34) return Math.hypot(x - cx + 0.12, y - cy + 0.12) < 0.1 ? 1 : 0.62;
    }
    const stem = [[-0.38, 0.12], [0.32, 0.18]].some(([sx, sy]) => { const k = (y - sy) / (-0.62 - sy); return k >= 0 && k <= 1 && Math.abs(x - (sx + (0.02 - sx) * k)) < 0.06; });
    if (stem) return 0.35;
    return Math.hypot((x - 0.32) / 0.32, (y + 0.68) / 0.14) < 1 ? 0.4 : 0;
  }},
  // An alarm clock: two bells, a rim, a pale face and its hands.
  clock: {width: 40, height: 40, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y + 0.08);
    if (r < 0.8) {
      if (r > 0.66) return 0.55;
      const hand = (Math.abs(x) < 0.05 && y < -0.08 && y > -0.48) || (Math.abs(y + 0.08) < 0.05 && x > 0 && x < 0.32);
      return hand ? 0.15 : 0.95;
    }
    return [-0.55, 0.55].some(bx => Math.hypot(x - bx, y + 0.78) < 0.2) ? 0.55 : 0;
  }},
  // A rose seen from above: a spiral of petals.
  rose: {width: 40, height: 40, frames: 1, fn(x, y) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    if (r > 0.85) return 0;
    const band = Math.sin(a + r * 11) > -0.2 ? 0.64 : 0.4;
    return r < 0.12 ? 0.9 : band + (1 - r) * 0.1;
  }},
  // A gate: two pillars under an arch, a bright opening inside.
  arch: {width: 48, height: 64, frames: 1, fn(x, y) {
    const outer = Math.abs(x) < 0.85 && (y > -0.35 || Math.hypot(x / 0.85, (y + 0.35) / 0.6) < 1);
    const inner = Math.abs(x) < 0.5 && (y > -0.35 || Math.hypot(x / 0.5, (y + 0.35) / 0.4) < 1);
    return inner ? 0.95 : outer ? 0.55 : 0;
  }},
  // An upright flame, licking (looping), anchored at its base.
  flame: {width: 40, height: 56, frames: 6, loop: true, fn(x, y, t, n) {
    const up = (1 - y) / 2, sway = Math.sin(up * 5 + t * TAU) * 0.12 * up;
    const half = 0.7 * Math.sqrt(Math.max(0, 1 - up)) * Math.min(1, up * 4 + 0.2);
    const d = Math.abs(x - sway) / (half + 0.001);
    const lick = n(x * 30 + 64, y * 30 - t * 64);
    return d < 1 ? (d < 0.4 && up < 0.6 ? 0.95 : 0.6) * (lick > 0.25 + up * 0.5 ? 1 : 0) : 0;
  }},
  // A crack running across the ground with branches.
  crack: {width: 64, height: 32, frames: 1, fn(x, y) {
    const line = Math.abs(y - Math.sin(x * 7) * 0.25 - x * 0.1);
    const branch = x > -0.3 && x < 0.3 ? Math.abs(y + 0.4 - (x + 0.3) * 1.2) : 9;
    return line < 0.04 || branch < 0.03 ? 0.75 : line < 0.1 || branch < 0.07 ? 0.45 : 0;
  }},
  // A drifting cloud of mist or spores, its lobes rolling (looping).
  mist: {width: 64, height: 48, frames: 8, loop: true, smoke: true, fn(x, y, t, n) {
    let cloud = 0;
    for (const [cx, cy, r, ph] of [[-0.45, 0.15, 0.48, 0], [0.05, -0.15, 0.55, 2], [0.5, 0.12, 0.45, 4], [0.05, 0.35, 0.42, 1]]) {
      const k = r * (0.92 + 0.08 * Math.sin(t * TAU + ph));
      cloud = Math.max(cloud, 1 - Math.hypot(x - cx, (y - cy) * 1.2) / k);
    }
    const churn = n(x * 40 + t * 64 + 64, y * 40 + 64);
    return cloud > 0 ? 0.3 + cloud * 0.6 + (churn - 0.5) * 0.3 : 0;
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

/**
 * Pixel finish (UNIQUE_PIXEL_MOVE_VFX_20261108: 「統一風格」, the look of the
 * original remade 292 cells). Bodies take four flat tones -- edge, main, a
 * main/core mix and core -- at full alpha with a one-texel dark outline; light
 * sheets (`light`) keep three stepped alpha bands and no outline; smoke steps
 * its alpha. Sample the result `nearest`.
 */
function pixelTable(palette, {smoke = false, light = false} = {}) {
  const edge = rgb(palette.edge), main = rgb(palette.main), core = rgb(palette.core);
  const mix = main.map((v, i) => (v + core[i]) / 2);
  if (smoke) {
    const base = rgb(palette.smoke ?? 0x606060), lit = base.map(v => v + (255 - v) * 0.2);
    return Array.from({length: 256}, (_, i) => { const k = i / 255; return k < 0.12 ? [0, 0, 0, 0] : k < 0.45 ? [...base, 0.45] : k < 0.75 ? [...base, 0.7] : [...lit, 0.82]; });
  }
  if (light) return Array.from({length: 256}, (_, i) => { const k = i / 255; return k < 0.1 ? [0, 0, 0, 0] : k < 0.35 ? [...edge, 0.4] : k < 0.65 ? [...main, 0.7] : k < 0.88 ? [...mix, 1] : [...core, 1]; });
  return Array.from({length: 256}, (_, i) => { const k = i / 255; return k < 0.12 ? [0, 0, 0, 0] : k < 0.4 ? [...edge, 1] : k < 0.68 ? [...main, 1] : k < 0.88 ? [...mix, 1] : [...core, 1]; });
}

/** Colour a baked sheet with one palette: one canvas per frame. `doc` supplies createElement. */
export function paintMoveVfxSheet(intensity, palette, {doc = globalThis.document, pixel = false, light = false} = {}) {
  if (!intensity || !doc) return null;
  if (pixel) return paintPixelSheet(intensity, palette, {doc, light});
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

/**
 * One remade effect cell (UNIQUE_PIXEL_MOVE_VFX_20261108): a sheet's shape at
 * time `t`, drawn into `box` (x, y, w, h in texels, may reach past the canvas)
 * of a `width` x `height` canvas, flipped with `flipX`, then given the pixel
 * finish. Several `layers` can share one cell (a cloud and its spores).
 */
export function paintMoveVfxCell({width, height, layers, doc = globalThis.document, noise}) {
  if (!doc) return null;
  const canvas = doc.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height), out = image.data;
  for (const {name, palette, box, t = 0, light = false, alpha = 1, flipX = false, drawn = null, at = [0, 0], fixed = {}, zoom = 1} of layers) {
    // A hand-drawn sprite (drawnVfxSprites.js) lands pixel for pixel at `at`, tone keys in the palette's colours.
    if (drawn) {
      const tone = {o: rgb(palette.edge).map(v => v * 0.38), e: rgb(palette.edge), m: rgb(palette.main),
        x: rgb(palette.main).map((v, i) => (v + rgb(palette.core)[i]) / 2), c: rgb(palette.core)};
      // `zoom` (a whole number) doubles or triples every drawn pixel, so a big thing stays crisp.
      for (let y = 0; y < drawn.h * zoom; y++) for (let x = 0; x < drawn.w * zoom; x++) {
        const sx = Math.floor(x / zoom), key = drawn.rows[Math.floor(y / zoom)][flipX ? drawn.w - 1 - sx : sx];
        const px = at[0] + x, py = at[1] + y;
        if (key === '.' || px < 0 || py < 0 || px >= width || py >= height) continue;
        const colour = tone[key] ?? (fixed[key] !== undefined ? rgb(fixed[key]) : null);
        if (!colour) continue;
        const o = (py * width + px) * 4, under = out[o + 3] / 255, total = alpha + under * (1 - alpha);
        for (let i = 0; i < 3; i++) out[o + i] = (colour[i] * alpha + out[o + i] * under * (1 - alpha)) / total;
        out[o + 3] = Math.round(total * 255);
      }
      continue;
    }
    const sheet = SHEETS[name];
    if (!sheet) continue;
    const k = noise.size / Math.max(sheet.width, sheet.height), n = (u, v) => noise.at(u * k, v * k);
    const intensity = new Uint8Array(width * height);
    for (let py = Math.max(0, Math.floor(box[1])); py < Math.min(height, Math.ceil(box[1] + box[3])); py++)
      for (let px = Math.max(0, Math.floor(box[0])); px < Math.min(width, Math.ceil(box[0] + box[2])); px++) {
        let x = (px + 0.5 - box[0]) / box[2] * 2 - 1;
        const y = (py + 0.5 - box[1]) / box[3] * 2 - 1;
        if (flipX) x = -x;
        intensity[py * width + px] = Math.round(clamp01(sheet.fn(x, y, t, n)) * 255);
      }
    const table = pixelTable(palette, {smoke: Boolean(sheet.smoke), light});
    const outline = !sheet.smoke && !light ? rgb(palette.edge).map(v => v * 0.38) : null;
    for (let i = 0; i < intensity.length; i++) {
      const [r, g, b, a] = table[intensity[i]];
      if (!a) continue;
      // Over: a later layer covers an earlier one by its own alpha.
      const o = i * 4, top = a * alpha, under = out[o + 3] / 255, total = top + under * (1 - top);
      if (!top) continue;
      out[o] = (r * top + out[o] * under * (1 - top)) / total; out[o + 1] = (g * top + out[o + 1] * under * (1 - top)) / total;
      out[o + 2] = (b * top + out[o + 2] * under * (1 - top)) / total; out[o + 3] = Math.round(total * 255);
    }
    if (outline) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (out[i * 4 + 3]) continue;
      const solid = (u, v) => u >= 0 && v >= 0 && u < width && v < height && table[intensity[v * width + u]][3] === 1;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i * 4] = outline[0]; out[i * 4 + 1] = outline[1]; out[i * 4 + 2] = outline[2]; out[i * 4 + 3] = Math.round(255 * alpha);
      }
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function paintPixelSheet(intensity, palette, {doc, light}) {
  const {width, height} = intensity;
  const table = pixelTable(palette, {smoke: intensity.smoke, light});
  const outline = !intensity.smoke && !light ? rgb(palette.edge).map(v => v * 0.38) : null;
  const frames = intensity.frames.map(data => {
    const canvas = doc.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(width, height), out = image.data;
    for (let i = 0; i < data.length; i++) {
      const [r, g, b, a] = table[data[i]];
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = Math.round(a * 255);
    }
    // One texel of dark outline round every body, as the remade cells have.
    if (outline) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (out[i * 4 + 3]) continue;
      const solid = (u, v) => u >= 0 && v >= 0 && u < width && v < height && table[data[v * width + u]][3] === 1;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i * 4] = outline[0]; out[i * 4 + 1] = outline[1]; out[i * 4 + 2] = outline[2]; out[i * 4 + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  });
  return {name: intensity.name, frames, loop: intensity.loop, width, height, smoke: intensity.smoke};
}

/**
 * A move's own sigil (UNIQUE_PIXEL_MOVE_VFX_20261108: 「每一招都獨特」): a
 * mirrored 11 x 11 glyph drawn from the move's seed inside a ring with eight
 * ticks, 32 x 32 texels. No two seeds in the signature table share a glyph
 * (tests). Returns {cells: Uint8Array of 0 empty / 1 ring / 2 glyph, size}.
 */
export function moveVfxSigilCells(seed) {
  let s = seed >>> 0;
  const random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const size = 32, cells = new Uint8Array(size * size), c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c), a = Math.atan2(y - c, x - c);
    const tick = Math.abs(((a / TAU * 8) % 1 + 1) % 1 - 0.5) > 0.44 && r > 12.2 && r < 15.4;
    if ((r > 13.2 && r < 14.6) || tick) cells[y * size + x] = 1;
  }
  // The glyph: a 6 x 11 half, mirrored, denser near the axis, always joined to it.
  const half = Array.from({length: 11}, (_, row) => Array.from({length: 6}, (_, col) => random() < 0.62 - col * 0.07 + (row % 2 ? 0 : 0.05)));
  for (let row = 0; row < 11; row++) half[row][0] ||= row > 0 && row < 10 && random() < 0.7;
  const glyph = (gx, gy) => half[gy][gx < 6 ? 5 - gx : gx - 5];
  for (let gy = 0; gy < 11; gy++) for (let gx = 0; gx < 11; gx++) if (glyph(gx, gy)) {
    // Each glyph cell is 2 x 2 texels, centred: 22 texels across a 32 texel sigil.
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) cells[(5 + gy * 2 + dy) * size + 5 + gx * 2 + dx] = 2;
  }
  return {cells, size};
}

/** Paint a sigil: ring in the palette's main colour, glyph in its core, dark outline. */
export function paintMoveVfxSigil(seed, palette, {doc = globalThis.document} = {}) {
  if (!doc) return null;
  const {cells, size} = moveVfxSigilCells(seed);
  const canvas = doc.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size), out = image.data;
  const colours = [null, rgb(palette.main), rgb(palette.core)], outline = rgb(palette.edge).map(v => v * 0.38);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, kind = cells[i];
    let colour = colours[kind];
    if (!colour) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size && cells[(y + dy) * size + x + dx]);
      if (!near) continue;
      colour = outline;
    }
    out[i * 4] = colour[0]; out[i * 4 + 1] = colour[1]; out[i * 4 + 2] = colour[2]; out[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
