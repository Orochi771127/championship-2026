// Shared pixelfx bake steps (STATUS_AILMENT_VFX_20261110, BESPOKE_MOVE_VFX_PROGRAM_20261111):
// the game's pixel finish for converted pixelfx frames (stepped light, the 292
// cells' one-texel dark outline), colour quantising and run-length rows.
// Tools only: never imported by the game.
export const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&*+-:;<=>?@^_~';

export const luma = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** One frame -> RGBA (Uint8ClampedArray), stepped, the stand-in cut out, outlined. */
export function finish(frame, w, h, inside, {noSmoke = false, outline = true} = {}, saturatedOnly = null) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (inside(i)) continue;
    const c = frame.raw[i], l = frame.light[i];
    let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, a = (c >>> 24) / 255;
    const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255, lm = Math.max(lr, lg, lb);
    if (a >= 0.3) {
      // colour first; strong light brightens it a step
      if (lm > 90) { const k = Math.min(1, lm / 255) * 0.5; r += (255 - r) * k * (lr / Math.max(1, lm)); g += (255 - g) * k * (lg / Math.max(1, lm)); b += (255 - b) * k * (lb / Math.max(1, lm)); }
      a = a >= 0.75 ? 1 : 0.55;
    } else if (lm >= 150) {
      const k = 255 / lm; r = Math.min(255, lr * k); g = Math.min(255, lg * k); b = Math.min(255, lb * k); a = lm >= 205 ? 1 : 0.55;
    } else continue; // soft halo: dropped, the 292 cells have none
    if (noSmoke && Math.max(r, g, b) - Math.min(r, g, b) < 48 && luma(r, g, b) < 0.7) continue;
    if (saturatedOnly?.(i) && (Math.max(r, g, b) - Math.min(r, g, b) < 90 || a < 1)) continue;
    out.set([r, g, b, Math.round(a * 255)], i * 4);
  }
  // The original's own hit effects carry no outline (white core, hue rim): a move piece bakes without one.
  if (!outline) return out;
  // outline: bright opaque shapes of 4+ texels get a one-texel dark ring
  const solid = i => out[i * 4 + 3] === 255;
  const seen = new Uint8Array(w * h), ring = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !solid(s)) continue;
    const comp = [s]; seen[s] = 1;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[n] || !solid(n)) continue;
        seen[n] = 1; comp.push(n);
      }
    }
    if (comp.length < 4) continue;
    let sr = 0, sg = 0, sb = 0;
    for (const i of comp) { sr += out[i * 4]; sg += out[i * 4 + 1]; sb += out[i * 4 + 2]; }
    const dark = [sr / comp.length * 0.22, sg / comp.length * 0.2, sb / comp.length * 0.26 + 10];
    for (const i of comp) {
      if (luma(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]) < 0.22) continue;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || out[n * 4 + 3] === 255 || inside(n)) continue;
        ring.push([n, dark]);
      }
    }
  }
  for (const [n, [r, g, b]] of ring) out.set([r, g, b, 255], n * 4);
  return out;
}

/** Quantise every frame of one look to at most `max` RGBA keys. */
export function quantise(frames, max = KEYS.length - 32) {
  const tally = new Map();
  const step = v => Math.min(255, Math.round(v / 17) * 17);
  const keyOf = (d, j) => `${step(d[j])},${step(d[j + 1])},${step(d[j + 2])},${d[j + 3]}`;
  for (const d of frames) for (let j = 0; j < d.length; j += 4) if (d[j + 3]) { const k = keyOf(d, j); tally.set(k, (tally.get(k) ?? 0) + 1); }
  let colours = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k.split(',').map(Number));
  const kept = colours.slice(0, max);
  const near = c => {
    let best = 0, bd = Infinity;
    kept.forEach((k, i) => { if (k[3] !== c[3]) return; const d = (k[0] - c[0]) ** 2 + (k[1] - c[1]) ** 2 + (k[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    if (bd === Infinity) kept.forEach((k, i) => { const d = (k[0] - c[0]) ** 2 + (k[1] - c[1]) ** 2 + (k[2] - c[2]) ** 2 + (k[3] - c[3]) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const index = new Map();
  for (const c of colours) index.set(c.join(','), near(c));
  return {palette: kept, indexOf: (d, j) => index.get(keyOf(d, j))};
}

export function rle(row) {
  let s = '', i = 0;
  while (i < row.length) {
    let j = i; while (j < row.length && row[j] === row[i]) j++;
    s += row[i] + (j - i > 1 ? j - i : ''); i = j;
  }
  return s;
}

