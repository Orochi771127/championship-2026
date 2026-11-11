// Status-ailment loops -> code module (STATUS_AILMENT_VFX_20261110).
//
// Owner 2026-11-10: 「交給你去處理幫我補完，然後或者是轉成我們適用的」 -- fill the
// battle's missing status visuals from the MIT-licensed pixelfx library
// (https://github.com/patch-gg/pixelfx, Copyright (c) 2026 Patch and Hugo
// Duprez, adapting MIT work of Sprite Fusion and Hollow Crown), converted to the
// game's own pixel finish. pixelfx is a local authoring tool, never a game
// dependency: this script runs its effect code once and writes the result as
// palette-keyed, run-length rows the game paints at runtime, the same way
// drawnVfxSprites.js ships the hand-drawn move effects (no image files).
//
// Conversion, per look:
//   1. play the effect around a stand-in creature (a 40 x 34 blob, not the
//      library's humanoid dummy) at 12 fps, the library's own pose step;
//   2. drop every pixel inside that stand-in: the game paints the body itself
//      (a tint and a glow on the fighter's own frame), so only what sits
//      around, above and below a creature of any shape is kept;
//   3. light becomes two stepped bands, colour alpha two steps, so there
//      are no soft halos (additive glow washes out on bright arenas);
//   4. a one-texel dark outline round every bright shape of 4+ texels, the
//      heavy-outline look of the original 292 cells; shapes the library already
//      rings in a dark line keep theirs;
//   5. colours quantise to at most 40 keys per look; frames crop to their
//      union box and keep the stand-in's feet as the origin.
//
// Usage: node scripts/vfx/bake-status-ailment-vfx.mjs [--check] [--sheet <dir>]
//   PIXELFX_HOME  a pixelfx checkout (required to bake; --check only re-reads)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {KEYS, finish, quantise, rle} from './pixelfxBakeLib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = 'src/championship/presentation/vfx/statusAilmentSprites.js';
const HIT_OUT = 'src/championship/presentation/vfx/pixelHitBurstSprites.js';
const FPS = 12;
const MASK_W = 40, MASK_H = 34;

/**
 * look -> pixelfx effect, its palette (null: the effect's own), seed and cut:
 * how far past the stand-in's edge pixels are dropped (2: also the rim an
 * effect paints round the body, which would trace the blob on a real creature;
 * -2: keep a two-texel band inside the edge, where flames stand; 'saturated':
 * keep only strongly coloured, solid texels on the body -- flames, not the
 * body the effect recoloured).
 * keepAbove: a scene effect with no body: only what is more than that many
 * texels above its own origin stays, and that line stands `lift` texels above
 * the stand-in's feet. noSmoke: grey, unlit texels (smoke) are dropped.
 */
export const STATUS_AILMENT_BAKE = Object.freeze({
  stunned: {fx: 'status/stunned'},
  charmed: {fx: 'status/charmed'},
  confused: {fx: 'status/confused'},
  sleep: {fx: 'status/sleep'},
  frozen: {fx: 'status/frozen', cut: 2},
  poisoned: {fx: 'status/poisoned'},
  // inside the body only the saturated flame tongues stay (the charred grey
  // body and the white ignition flash go); round it, embers and smoke
  burning: {fx: 'status/burning', cut: 'saturated', noSmoke: true},
  bleeding: {fx: 'status/bleeding'},
  cursed: {fx: 'status/cursed'},
  rage: {fx: 'status/rage'},
  slowed: {fx: 'status/slowed'},
  electrified: {fx: 'lightning/electrified', cut: 2}
});

/**
 * Move hits (STATUS_AILMENT_VFX_20261110, second part: 「招式的特效也做得漂亮一點」):
 * one burst per effect element, only the burst (`from`..`until` seconds: the
 * wind-up and the smoke tail dropped), at 15 fps. `anchor`: 'ground' plays at the target's feet line,
 * 'contact' at the hit point. A palette recolours an effect to its element.
 */
export const PIXEL_HIT_BAKE = Object.freeze({
  // refinement pass 10: a ring of fire bursting out at the feet, not a heap of red balls
  FIRE: {fx: 'fire/fire-ring', from: 0.28, until: 1.0, anchor: 'ground'},
  WATER: {fx: 'water/splash', from: 0.25, until: 1.0, anchor: 'ground'},
  ICE: {fx: 'ice/frost-nova', from: 0.45, until: 1.2, anchor: 'ground'},
  THUNDER: {fx: 'lightning/zap-hit', until: 0.8, anchor: 'contact'},
  WOOD: {fx: 'nature/thorns', from: 0.2, until: 1.2, anchor: 'ground'},
  EARTH: {fx: 'explosions/dirt-explosion', until: 0.75, anchor: 'ground'},
  WIND: {fx: 'arcane/mana-burst', from: 0.25, until: 1.1, anchor: 'contact', palette: ['#0e2a24', '#1d5a46', '#2fa070', '#6fd9a0', '#c4ffe0', '#ffffff']},
  SUN: {fx: 'impacts/crit-hit', until: 0.7, anchor: 'contact'},
  MOON: {fx: 'shadow/dark-explosion', from: 0.55, until: 1.35, anchor: 'contact', noSmoke: true},
  METAL: {fx: 'impacts/hit-spark', until: 0.5, anchor: 'contact', palette: ['#1c2230', '#3c4658', '#7a8aa2', '#b8c6da', '#e8f0ff', '#ffffff']},
  NEUTRAL: {fx: 'impacts/blunt-hit', until: 0.6, anchor: 'contact'}
});
const HIT_FPS = 15;

/** The stand-in creature: a rounded body with a head on its right, feet at (0, 0). */
function standIn() {
  const data = new Uint8Array(MASK_W * MASK_H);
  for (let y = 0; y < MASK_H; y++) for (let x = 0; x < MASK_W; x++) {
    const body = ((x - 19.5) / 18.5) ** 2 + ((y - 22.5) / 11.5) ** 2 <= 1;
    const head = (x - 28) ** 2 + (y - 10) ** 2 <= 9.5 ** 2;
    const feet = y >= 30 && ((x >= 7 && x <= 12) || (x >= 26 && x <= 31));
    if (body || head || feet) data[y * MASK_W + x] = 1;
  }
  const mask = {w: MASK_W, h: MASK_H, data};
  // a flat mid grey body (some effects recolour the body's own pixels; those are cut out anyway)
  const pixels = Uint32Array.from(data, on => (on ? 0xff6b6b6b : 0));
  return {mask, pixels, x: -Math.floor(MASK_W / 2), y: -MASK_H, w: MASK_W, h: MASK_H, k: 2,
    head: [8, -MASK_H], chest: [0, -16], eyes: [[29, 8], [32, 8]]};
}

async function bakeLook(home, name, spec) {
  const {loadEffect, renderFrames} = await import(pathToFileURL(path.join(home, 'tools/lib/fxlib.mjs')).href);
  const fx = await loadEffect(spec.fx);
  const actor = standIn(), margin = 18, fps = spec.fps ?? FPS;
  const r = renderFrames(fx, {fps, actor: false, margin, bg: 'none', ...(spec.seed !== undefined ? {seed: spec.seed} : {}),
    options: {actor, ...(spec.palette ? {palette: spec.palette} : {})}});
  // A one-shot keeps only its burst.
  if (spec.until !== undefined) r.frames = r.frames.slice(Math.round((spec.from ?? 0) * fps), Math.max(1, Math.round(spec.until * fps)));
  const [OX, OY] = fx.meta.origin, w = r.w, h = r.h;
  const fx0 = OX + margin, fy0 = OY + margin; // the stand-in's feet in frame pixels
  const ax = fx0 + actor.x, ay = fy0 + actor.y;
  const on = (x, y) => x >= 0 && y >= 0 && x < MASK_W && y < MASK_H && actor.mask.data[y * MASK_W + x] > 0;
  const cut = spec.cut ?? 0, R = cut === 'saturated' ? 0 : Math.abs(cut);
  const onBody = i => on((i % w) - ax, ((i / w) | 0) - ay);
  const near = (x, y, want) => { for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R && on(x + dx, y + dy) === want) return true; return false; };
  const inside = i => { const x = (i % w) - ax, y = ((i / w) | 0) - ay;
    if (spec.keepAbove !== undefined) return ((i / w) | 0) - fy0 >= -spec.keepAbove;
    if (spec.until !== undefined && !fx.meta.actor) return false; // a hit with no body to cut
    if (cut === 'saturated') return false; // finish() sorts the body texels by colour
    return cut > 0 ? near(x, y, true) : cut < 0 ? on(x, y) && !near(x, y, false) : on(x, y); };
  const frames = r.frames.map(f => finish(f, w, h, inside, spec, cut === 'saturated' ? onBody : null));
  while (frames.length > 1 && !frames[frames.length - 1].some((v, j) => j % 4 === 3 && v)) frames.pop();
  // union crop
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (const d of frames) for (let i = 0; i < w * h; i++) if (d[i * 4 + 3]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new Error(`${name}: nothing left outside the stand-in`);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const {palette, indexOf} = quantise(frames);
  const rows = frames.map(d => {
    const lines = [];
    for (let y = y0; y <= y1; y++) {
      let line = '';
      for (let x = x0; x <= x1; x++) { const j = (y * w + x) * 4; line += d[j + 3] ? KEYS[indexOf(d, j)] : '.'; }
      lines.push(rle(line));
    }
    return lines.join('/');
  });
  const oy = spec.keepAbove !== undefined ? fy0 - spec.keepAbove + spec.lift - y0 : fy0 - y0;
  return {name, source: spec.fx, fps, loop: spec.until === undefined && Boolean(fx.meta.loop), ...(spec.anchor ? {anchor: spec.anchor} : {}), w: cw, h: ch, ox: fx0 - x0, oy,
    palette: palette.map(([r0, g0, b0, a0]) => [r0, g0, b0, +(a0 / 255).toFixed(2)]), frames: rows, finished: frames.map(d => ({d, x0, y0, w}))};
}

function moduleText(looks, hits = false) {
  const head = `/*! ${hits ? 'Pixel move-hit bursts' : 'Status-ailment loops'} (STATUS_AILMENT_VFX_20261110). GENERATED by
 * scripts/vfx/bake-status-ailment-vfx.mjs; edit the bake, not this file.
 *
 * Converted from pixelfx (github.com/patch-gg/pixelfx): MIT License,
 * Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez; parts adapt
 * Sprite Fusion's pixel art VFX and Hollow Crown (rehan-remade), both MIT.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: The above copyright
 * notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// Each look: fps, loop, w x h texels, (ox, oy) = the stand-in creature's feet,
// standIn = its body box (40 x 34 texels) the game fits to the fighter, palette
// = [r, g, b, alpha] per key, frames = rows joined by "/", each a run of
// "<key><count>" ("." clear, count omitted for 1).
`;
  const body = looks.map(l => `  ${l.name}: look(${JSON.stringify({source: l.source, fps: l.fps, loop: l.loop, ...(l.anchor ? {anchor: l.anchor} : {}), w: l.w, h: l.h, ox: l.ox, oy: l.oy, palette: l.palette})},\n    ${JSON.stringify(l.frames)})`).join(',\n');
  if (hits) return `${head}const look = (meta, frames) => Object.freeze({...meta, palette: Object.freeze(meta.palette.map(c => Object.freeze(c))), frames: Object.freeze(frames)});
export const PIXEL_HIT_BURST_KEYS = ${JSON.stringify(KEYS)};
export const PIXEL_HIT_BURST_SPRITES = Object.freeze({
${body}
});
`;
  return `${head}const look = (meta, frames) => Object.freeze({...meta, palette: Object.freeze(meta.palette.map(c => Object.freeze(c))), frames: Object.freeze(frames)});
export const STATUS_AILMENT_KEYS = ${JSON.stringify(KEYS)};
export const STATUS_AILMENT_STAND_IN = Object.freeze({w: ${MASK_W}, h: ${MASK_H}});
export const STATUS_AILMENT_SPRITES = Object.freeze({
${body}
});
`;
}

async function writeSheet(dir, looks, file = 'status-ailment-sheet.png') {
  // Review sheet: every kept frame of every look, 3x, on a dark field (PNG via pixelfx's encoder).
  const home = process.env.PIXELFX_HOME;
  const {canvas, save} = await import(pathToFileURL(path.join(home, 'tools/lib/fxlib.mjs')).href);
  const Z = 3, cols = 12, pad = 4;
  const cell = Math.max(...looks.map(l => Math.max(l.w, l.h))) * Z + pad;
  const H = looks.length * cell, W = cols * cell;
  const img = canvas(W, H, [28, 24, 40, 255]);
  looks.forEach((l, li) => l.finished.slice(0, cols).forEach((f, fi) => {
    const tile = new Uint8ClampedArray(l.w * Z * l.h * Z * 4);
    for (let y = 0; y < l.h * Z; y++) for (let x = 0; x < l.w * Z; x++) {
      const j = (((f.y0 + ((y / Z) | 0)) * f.w) + f.x0 + ((x / Z) | 0)) * 4, o = (y * l.w * Z + x) * 4;
      const a = f.d[j + 3] / 255;
      tile[o] = f.d[j] * a + 28 * (1 - a); tile[o + 1] = f.d[j + 1] * a + 24 * (1 - a); tile[o + 2] = f.d[j + 2] * a + 40 * (1 - a); tile[o + 3] = 255;
    }
    img.paste(tile, l.w * Z, l.h * Z, fi * cell, li * cell);
  }));
  fs.mkdirSync(dir, {recursive: true});
  save(path.join(dir, file), img.png());
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const text = fs.readFileSync(path.join(root, OUT), 'utf8');
  const mod = await import(pathToFileURL(path.join(root, OUT)).href);
  const names = Object.keys(mod.STATUS_AILMENT_SPRITES);
  const missing = Object.keys(STATUS_AILMENT_BAKE).filter(n => !names.includes(n));
  if (missing.length) { console.error('missing looks:', missing.join(', ')); process.exit(1); }
  const hitText = fs.readFileSync(path.join(root, HIT_OUT), 'utf8');
  const hits = Object.keys((await import(pathToFileURL(path.join(root, HIT_OUT)).href)).PIXEL_HIT_BURST_SPRITES);
  const missingHits = Object.keys(PIXEL_HIT_BAKE).filter(n => !hits.includes(n));
  if (missingHits.length) { console.error('missing hits:', missingHits.join(', ')); process.exit(1); }
  console.log(JSON.stringify({looks: names.length, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex'),
    hits: hits.length, hitBytes: Buffer.byteLength(hitText), hitSha256: createHash('sha256').update(hitText).digest('hex')}));
} else {
  const home = process.env.PIXELFX_HOME;
  if (!home || !fs.existsSync(path.join(home, 'tools/lib/fxlib.mjs'))) { console.error('set PIXELFX_HOME to a pixelfx checkout'); process.exit(1); }
  const looks = [];
  for (const [name, spec] of Object.entries(STATUS_AILMENT_BAKE)) {
    const look = await bakeLook(home, name, spec);
    looks.push(look);
    console.log(`${name.padEnd(12)} ${String(look.frames.length).padStart(3)} frames ${look.w}x${look.h} ${look.palette.length} keys`);
  }
  const text = moduleText(looks);
  fs.writeFileSync(path.join(root, OUT), text);
  console.log(`${OUT}: ${Buffer.byteLength(text)} bytes`);
  const hits = [];
  for (const [name, spec] of Object.entries(PIXEL_HIT_BAKE)) {
    const look = await bakeLook(home, name, {fps: HIT_FPS, ...spec});
    hits.push(look);
    console.log(`hit ${name.padEnd(8)} ${String(look.frames.length).padStart(3)} frames ${look.w}x${look.h} ${look.palette.length} keys`);
  }
  const hitText = moduleText(hits, true);
  fs.writeFileSync(path.join(root, HIT_OUT), hitText);
  console.log(`${HIT_OUT}: ${Buffer.byteLength(hitText)} bytes`);
  const sheet = args.indexOf('--sheet');
  if (sheet >= 0) { await writeSheet(path.resolve(args[sheet + 1]), looks); await writeSheet(path.resolve(args[sheet + 1]), hits, 'pixel-hit-sheet.png'); }
}
