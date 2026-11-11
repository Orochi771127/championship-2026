// Move set pieces -> code module (BESPOKE_MOVE_VFX_PROGRAM_20261111, refinement pass 1).
//
// Owner 2026-11-11: the hand-drawn pieces looked「很像卡通」「很廉價」「像小朋友畫的」;
// look at the original, Pokemon Arena 2D and pixelfx. The original's hit
// effects are energy -- a white-hot core, a hue rim, sharp rays and sparks, no
// outline and no drawn objects -- so each piece now plays a pixelfx effect
// (MIT, github.com/patch-gg/pixelfx) converted to that finish: stepped light,
// solid texels, no soft halo, no outline. pixelfx is a local authoring tool,
// never a game dependency: this script runs its effect code once and writes
// palette-keyed, run-length rows the game recolours per move at runtime (each
// key's brightness picks a step of the move's palette, so one bake serves
// every element).
//
// Per piece: fx, the effect; from/until, the seconds kept (the wind-up and the
// smoke tail cut); anchor 'contact' (centred on the burst's own centre of
// light) or 'ground' (the effect's own feet line on the target's feet);
// fit, the burst's span in body widths; grey, bake through a neutral ramp so
// the runtime recolour reads every step (effects that take a palette).
//
// Usage: node scripts/vfx/bake-move-piece-vfx.mjs [--check] [--only a,b] [--sheet <dir>]
//   PIXELFX_HOME  a pixelfx checkout (required to bake; --check only re-reads)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {KEYS, finish, quantise, rle} from './pixelfxBakeLib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = 'src/championship/presentation/vfx/moveVfxPieceSprites.js';
const FPS = 30;
// The light layer (pixelfx's own bloom, added over the colour): intensity steps at half resolution.
const GLOW_KEYS = 'abcdefgh', GLOW_FLOOR = 18;
const GREY = ['#141414', '#3a3a3a', '#6a6a6a', '#9c9c9c', '#d0d0d0', '#ffffff'];

export const MOVE_PIECE_BAKE = Object.freeze({
  // ---- blows
  jaws: {fx: 'melee/claw-swipe', until: 0.6, fit: 1.1},
  horn: {fx: 'melee/thrust', from: 0.1, until: 0.65, fit: 1.6},
  claws: {fx: 'melee/claw-swipe', until: 0.7, fit: 1.2},
  core: {fx: 'explosions/plasma-explosion', until: 0.9, fit: 1.3, grey: true, noSmoke: true},
  fist: {fx: 'explosions/firework-burst', until: 0.6, fit: 1.3, grey: true},
  rush: {fx: 'impacts/crit-hit', until: 0.7, fit: 1.5},
  quake: {fx: 'impacts/ground-slam', until: 0.9, fit: 2.0, anchor: 'ground', noSmoke: true},
  spin: {fx: 'melee/spin-slash', from: 0.15, until: 0.85, fit: 1.8},
  roar: {fx: 'lightning/thunderclap', until: 0.8, fit: 2.0, grey: true},
  cross: {fx: 'melee/double-slash', from: 0.1, until: 0.8, fit: 1.4},
  slash: {fx: 'melee/sword-slash', from: 0.05, until: 0.6, fit: 1.4},
  iai: {fx: 'melee/spear-sweep', from: 0.2, until: 0.7, fit: 2.0, noSmoke: true},
  knives: {fx: 'melee/dagger-flurry', from: 0.1, until: 0.85, fit: 1.6},
  stream: {fx: 'fire/flamethrower', until: 0.9, fit: 2.0, grey: true, noSmoke: true},
  wisps: {fx: 'fire/spirit-flame', until: 0.9, fit: 1.0, grey: true},
  orb: {fx: 'arcane/arcane-orb', until: 0.9, fit: 1.2, grey: true},
  splat: {fx: 'nature/acid-splash', from: 0.2, until: 1.0, fit: 1.4, anchor: 'ground'},
  eye: {fx: 'shadow/hex-sigil', until: 0.9, fit: 1.6, anchor: 'ground', grey: true},
  lance: {fx: 'arcane/arcane-beam', until: 0.8, fit: 2.2, grey: true},
  rain: {fx: 'arcane/star-fall', until: 1.0, fit: 1.8, anchor: 'ground', grey: true},
  clock: {fx: 'arcane/time-stop', until: 1.0, fit: 1.8, grey: true},
  drop: {fx: 'fire/meteor', until: 1.0, fit: 1.8, anchor: 'ground', noSmoke: true},
  bolt: {fx: 'lightning/lightning-strike', from: 0.4, until: 1.2, fit: 1.4, anchor: 'ground', dropDark: 0.16},
  vortex: {fx: 'shadow/black-hole', until: 1.0, fit: 1.6, grey: true},
  vines: {fx: 'nature/vine-whip', until: 0.9, fit: 1.6},
  mist: {fx: 'nature/poison-cloud', until: 1.0, fit: 1.8, anchor: 'ground', grey: true},
  wave: {fx: 'water/wave-crash', from: 0.35, until: 1.3, fit: 2.0, anchor: 'ground', grey: true},
  // flurry and drop by their drawing (the move names what flies or falls)
  'flurry-leaf': {fx: 'nature/leaf-storm', until: 1.0, fit: 1.6},
  'flurry-feather': {fx: 'holy/feather-burst', until: 0.9, fit: 1.6},
  'flurry-shard': {fx: 'ice/snowflake-burst', until: 0.9, fit: 1.6, grey: true},
  'flurry-bubble': {fx: 'water/splash', until: 1.0, fit: 1.4, anchor: 'ground', grey: true},
  'flurry-note': {fx: 'arcane/mana-burst', until: 0.9, fit: 1.6, grey: true},
  'flurry-heart': {fx: 'holy/blessing', until: 1.0, fit: 1.4, grey: true},
  'flurry-spore': {fx: 'nature/poison-cloud', until: 1.0, fit: 1.4},
  'drop-bomb': {fx: 'explosions/plasma-explosion', until: 0.9, fit: 1.8, grey: true, noSmoke: true},
  'drop-rock': {fx: 'nature/boulder', until: 1.0, fit: 1.6, anchor: 'ground'},
  // ---- release
  muzzle: {fx: 'projectiles/muzzle-shotgun', until: 0.4, fit: 1.0, noSmoke: true},
  'muzzle-spiral': {fx: 'arcane/spell-charge', until: 0.8, fit: 1.2, grey: true},
  // ---- the impact frame
  // pass 7: the flash alone (its tick-mark ring came in by the fourth frame and stamped every ultimate alike)
  'impact-frame': {fx: 'impacts/crit-hit', until: 0.07, fit: 1.4, grey: true},
  // ---- floor circles (refinement pass 2: the kit's drawn hexagram sigils)
  'sigil-cast': {fx: 'arcane/magic-circle-cast', until: 1.2, fit: 1.6, anchor: 'ground', grey: true},
  'sigil-rune': {fx: 'arcane/rune-circle', until: 1.2, fit: 1.6, anchor: 'ground', grey: true},
  // the Data Arena's delayed ground zones: a round sigil seen from above that draws itself in as the zone charges
  'zone-sigil': {fx: 'shadow/hex-sigil', until: 1.0, fit: 1.0, anchor: 'centre', grey: true},
  // ---- the arena's cover (refinement pass 2): a chip off a struck block, a block breaking
  'prop-chip': {fx: 'impacts/bullet-impact', until: 0.5, fit: 0.8, grey: true},
  'prop-dust': {fx: 'explosions/dirt-explosion', until: 1.0, fit: 1.6, anchor: 'ground', grey: true},
  // ---- flying shots (refinement pass 3): looping heads the kit carries along the shot.
  // anchor 'origin': the effect's own head point (the tip of a right-facing shot).
  'shot-fire': {fx: 'fire/fireball', loop: true, fps: 20, fit: 1.0, anchor: 'origin'},
  'shot-water': {fx: 'water/water-orb', loop: true, fps: 12, fit: 0.8, grey: true, skyOnly: 22},
  'shot-arcane': {fx: 'arcane/arcane-orb', loop: true, fps: 12, fit: 0.8, grey: true, skyOnly: 30},
  'shot-void': {fx: 'shadow/void-orb', loop: true, fps: 12, fit: 0.9, grey: true, skyOnly: 34},
  'shot-laser': {fx: 'projectiles/laser-bolt', loop: true, fps: 24, fit: 1.0, anchor: 'origin', grey: true},
  'shot-plasma': {fx: 'projectiles/plasma-shot', loop: true, fps: 20, fit: 1.0, anchor: 'origin', grey: true},
  'shot-ice': {fx: 'ice/ice-lance', loop: true, fps: 20, fit: 1.1, anchor: 'origin', grey: true},
  'shot-rocket': {fx: 'projectiles/rocket', loop: true, fps: 20, fit: 1.4, anchor: 'origin', noSmoke: true},
  'shot-disc': {fx: 'projectiles/energy-disc', loop: true, fps: 24, fit: 0.9, anchor: 'origin', grey: true},
  // more flying heads (refinement pass 5)
  'shot-leaf': {fx: 'nature/leaf-storm', loop: true, fps: 12, fit: 1.0, skyOnly: 10},
  'shot-tornado': {fx: 'nature/tornado', loop: true, fps: 12, fit: 1.2, anchor: 'origin', grey: true, noSmoke: true},
  'shot-arrow': {fx: 'projectiles/arrow', loop: true, fps: 20, fit: 1.0, anchor: 'origin'},
  'shot-xp': {fx: 'pickups/xp-orb', loop: true, fps: 12, fit: 0.6, grey: true, skyOnly: 6},
  'shot-heart': {fx: 'pickups/heart-pickup', loop: true, fps: 12, fit: 0.6, grey: true, skyOnly: 6},
  'shot-star': {fx: 'pickups/power-star', loop: true, fps: 12, fit: 0.7, grey: true, skyOnly: 6},
  'shot-fish': {fx: 'critters/fish-school', loop: true, fps: 12, fit: 1.0, grey: true},
  'shot-wisp': {fx: 'critters/wisp', loop: true, fps: 12, fit: 0.8, grey: true, skyOnly: 10},
  // ---- ground marks (refinement pass 8: the hit decals drawn as vector strokes) -- a still frame each
  'mark-ripple': {fx: 'water/ripples', loop: true, fps: 12, fit: 1.6, anchor: 'ground', grey: true},
  'mark-frost': {fx: 'ice/frost-nova', from: 0.3, until: 1.4, fit: 1.6, anchor: 'ground', grey: true},
  'mark-roots': {fx: 'nature/root-snare', until: 1.4, fit: 1.6, anchor: 'ground'},
  // ---- the special prelude's aura round its caster (pass 8: the vector ring and light streaks)
  'hyper-ring': {fx: 'arcane/rune-circle', loop: true, fps: 20, fit: 1.4, anchor: 'ground', grey: true},
  // ---- support (on the receiving body)
  heal: {fx: 'holy/heal-aoe', until: 1.2, fit: 1.4, anchor: 'ground', grey: true},
  cleanse: {fx: 'holy/blessing', until: 1.2, fit: 1.6, anchor: 'ground', grey: true},
  'buff-atk': {fx: 'arcane/mana-burst', until: 1.0, fit: 1.6, anchor: 'ground', grey: true},
  'buff-def': {fx: 'holy/divine-shield', until: 1.2, fit: 1.6, anchor: 'ground', grey: true},
  'buff-spd': {fx: 'lightning/charge-up', until: 0.9, fit: 1.4, anchor: 'ground', grey: true},
  'buff-hit': {fx: 'arcane/rune-circle', until: 1.0, fit: 1.6, anchor: 'ground', grey: true},
  'buff-tol': {fx: 'scifi/force-field', until: 1.2, fit: 1.6, anchor: 'ground', grey: true}
});

async function bakePiece(home, name, spec) {
  const {loadEffect, renderFrames} = await import(pathToFileURL(path.join(home, 'tools/lib/fxlib.mjs')).href);
  const fx = await loadEffect(spec.fx);
  const margin = 16;
  const r = renderFrames(fx, {fps: FPS, actor: false, margin, bg: 'none', seed: 7, options: spec.grey ? {palette: GREY} : {}});
  const fps = spec.fps ?? FPS;
  // a loop keeps its whole cycle (seamless), at its own frame rate
  const rr = spec.loop ? renderFrames(fx, {fps, actor: false, margin, bg: 'none', seed: 7, options: spec.grey ? {palette: GREY} : {}}) : r;
  let src = spec.loop ? rr.frames : r.frames.slice(Math.round((spec.from ?? 0) * FPS), Math.max(1, Math.round((spec.until ?? 1) * FPS)));
  const [OX, OY] = fx.meta.origin, w = r.w, h = r.h;
  let frames = src.map(f => finish(f, w, h, () => false, {noSmoke: spec.noSmoke, outline: false}));
  // dropDark: an effect's own backdrop (a storm's dark sky, a water body) goes; the game has its own arena
  if (spec.dropDark) for (const d of frames) for (let j = 0; j < d.length; j += 4) if (d[j + 3] && (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255 < spec.dropDark) d[j + 3] = 0;
  const count = d => { let n = 0; for (let j = 3; j < d.length; j += 4) if (d[j]) n++; return n; };
  // the wind-up (almost nothing lit) and the empty tail go -- the light layer keeps the same frames
  const peak = Math.max(...frames.map(count));
  if (!spec.loop) {
    while (frames.length > 1 && count(frames[0]) < peak * 0.04) { frames.shift(); src = src.slice(1); }
    while (frames.length > 1 && count(frames[frames.length - 1]) === 0) { frames.pop(); src = src.slice(0, -1); }
  }
  // The light layer: pixelfx's own bloom (its light buffer), the soft halo the colour layer drops.
  const lightOf = f => { const out = new Float32Array(w * h); for (let i = 0; i < w * h; i++) { const l = f.light[i]; out[i] = Math.max(l & 255, (l >>> 8) & 255, (l >>> 16) & 255) / 255; } return out; };
  const lights = spec.noGlow ? [] : src.map(lightOf);
  // skyOnly: a floating orb keeps only what is more than that many texels above its own ground
  // (its shadow and ground glow would trail behind a shot)
  if (spec.skyOnly) {
    const cut = OY + margin - spec.skyOnly;
    for (const d of frames) for (let i = cut * w; i < w * h; i++) d[i * 4 + 3] = 0;
    for (const L of lights) for (let i = cut * w; i < w * h; i++) L[i] = 0;
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const grow = i => { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const d of frames) for (let i = 0; i < w * h; i++) if (d[i * 4 + 3]) grow(i);
  for (const L of lights) for (let i = 0; i < w * h; i++) if (L[i] * 255 >= GLOW_FLOOR) grow(i);
  if (x1 < 0) throw new Error(`${name}: empty`);
  // contact: centred on the light of the first strong frame (where the blow lands); ground: the effect's feet line
  let ox, oy;
  if ((spec.anchor ?? 'contact') === 'ground' || spec.anchor === 'origin') { ox = OX + margin - x0; oy = OY + margin - y0; }
  else if (spec.anchor === 'centre') { ox = Math.round((x1 - x0) / 2); oy = Math.round((y1 - y0) / 2); }
  else {
    const first = frames.find(d => count(d) >= peak * 0.35) ?? frames[0];
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < w * h; i++) if (first[i * 4 + 3]) { const L = first[i * 4] + first[i * 4 + 1] + first[i * 4 + 2] + 1; sx += (i % w) * L; sy += ((i / w) | 0) * L; n += L; }
    ox = Math.round(sx / n) - x0; oy = Math.round(sy / n) - y0;
  }
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
  // light: 2 x 2 averaged, eight intensity steps, the faintest dropped
  const gw = Math.ceil(cw / 2), gh = Math.ceil(ch / 2);
  const glow = lights.map(L => {
    const lines = [];
    for (let gy = 0; gy < gh; gy++) {
      let line = '';
      for (let gx = 0; gx < gw; gx++) {
        let sum = 0, n = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const x = x0 + gx * 2 + dx, y = y0 + gy * 2 + dy; if (x < w && y < h) { sum += L[y * w + x]; n++; } }
        const v = n ? sum / n : 0;
        line += v * 255 < GLOW_FLOOR ? '.' : GLOW_KEYS[Math.min(7, Math.floor(v * 8))];
      }
      lines.push(rle(line));
    }
    return lines.join('/');
  });
  return {name, source: spec.fx, fps, ...(spec.loop ? {loop: true} : {}), anchor: spec.anchor ?? 'contact', fit: spec.fit ?? 1.4, w: cw, h: ch, ox, oy,
    palette: palette.map(([r0, g0, b0, a0]) => [r0, g0, b0, +(a0 / 255).toFixed(2)]), frames: rows, glow, gw, gh,
    finished: frames.map((d, k) => ({d, x0, y0, w, L: lights[k]}))};
}

function moduleText(looks) {
  const notice = fs.readFileSync(path.join(root, 'src/championship/presentation/vfx/pixelHitBurstSprites.js'), 'utf8').match(/ \* Converted from pixelfx[\s\S]*?THE SOFTWARE\.\n/)[0];
  return `/*! Move set pieces (BESPOKE_MOVE_VFX_PROGRAM_20261111). GENERATED by
 * scripts/vfx/bake-move-piece-vfx.mjs; edit the bake, not this file.
 *
${notice} */
// Each piece: fps, anchor ('contact': (ox, oy) is the burst's centre; 'ground':
// its feet line), fit = its span in body widths, w x h texels, palette =
// [r, g, b, alpha] per key (the runtime recolours by brightness), frames = rows
// joined by "/", each a run of "<key><count>" ("." clear, count omitted for 1);
// glow = the light layer, gw x gh at half resolution, keys a..h = intensity
// 1/8..8/8 (added over the colour in the move's palette).
const piece = (meta, frames, glow) => Object.freeze({...meta, palette: Object.freeze(meta.palette.map(c => Object.freeze(c))), frames: Object.freeze(frames), glow: Object.freeze(glow)});
export const MOVE_VFX_PIECE_KEYS = ${JSON.stringify(KEYS)};
export const MOVE_VFX_PIECE_SPRITES = Object.freeze({
${looks.map(l => `  ${JSON.stringify(l.name)}: piece(${JSON.stringify({source: l.source, fps: l.fps, ...(l.loop ? {loop: true} : {}), anchor: l.anchor, fit: l.fit, w: l.w, h: l.h, ox: l.ox, oy: l.oy, gw: l.gw, gh: l.gh, palette: l.palette})},\n    ${JSON.stringify(l.frames)},\n    ${JSON.stringify(l.glow)})`).join(',\n')}
});
`;
}

async function writeSheet(dir, looks) {
  const {canvas, save} = await import(pathToFileURL(path.join(process.env.PIXELFX_HOME, 'tools/lib/fxlib.mjs')).href);
  const Z = 2, cols = 10, pad = 6, cell = 150 * Z;
  const img = canvas(cols * (cell + pad), looks.length * (cell + pad), [70, 110, 52, 255]);
  looks.forEach((l, li) => {
    const n = l.finished.length, m = Math.min(cols, n), pick = Array.from({length: m}, (_, i) => Math.floor(i * n / m));
    pick.forEach((fi, ci) => {
      const f = l.finished[fi], s = Math.min(Z, cell / Math.max(l.w, l.h)), tw = Math.max(1, Math.floor(l.w * s)), th = Math.max(1, Math.floor(l.h * s));
      const tile = new Uint8ClampedArray(tw * th * 4);
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const j = (((f.y0 + Math.floor(y / s)) * f.w) + f.x0 + Math.floor(x / s)) * 4, o = (y * tw + x) * 4, a = f.d[j + 3] / 255;
        tile[o] = f.d[j] * a + 70 * (1 - a); tile[o + 1] = f.d[j + 1] * a + 110 * (1 - a); tile[o + 2] = f.d[j + 2] * a + 52 * (1 - a); tile[o + 3] = 255;
        // the light layer, added (a warm white stand-in for the move's palette)
        const L = f.L ? f.L[j / 4] : 0;
        if (L * 255 >= 18) { tile[o] = Math.min(255, tile[o] + 255 * L * 0.8); tile[o + 1] = Math.min(255, tile[o + 1] + 225 * L * 0.8); tile[o + 2] = Math.min(255, tile[o + 2] + 170 * L * 0.8); }
      }
      img.paste(tile, tw, th, ci * (cell + pad), li * (cell + pad));
    });
  });
  fs.mkdirSync(dir, {recursive: true});
  save(path.join(dir, 'move-piece-sheet.png'), img.png());
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const text = fs.readFileSync(path.join(root, OUT), 'utf8');
  const names = Object.keys((await import(pathToFileURL(path.join(root, OUT)).href)).MOVE_VFX_PIECE_SPRITES);
  const missing = Object.keys(MOVE_PIECE_BAKE).filter(n => !names.includes(n));
  if (missing.length) { console.error('missing pieces:', missing.join(', ')); process.exit(1); }
  console.log(JSON.stringify({pieces: names.length, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex')}));
} else {
  const home = process.env.PIXELFX_HOME;
  if (!home || !fs.existsSync(path.join(home, 'tools/lib/fxlib.mjs'))) { console.error('set PIXELFX_HOME to a pixelfx checkout'); process.exit(1); }
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
  const looks = [];
  for (const [name, spec] of Object.entries(MOVE_PIECE_BAKE)) {
    if (only && !only.includes(name)) continue;
    const look = await bakePiece(home, name, spec);
    looks.push(look);
    console.log(`${name.padEnd(15)} ${String(look.frames.length).padStart(3)} frames ${look.w}x${look.h} ${look.palette.length} keys`);
  }
  if (!only) {
    const text = moduleText(looks);
    fs.writeFileSync(path.join(root, OUT), text);
    console.log(`${OUT}: ${Buffer.byteLength(text)} bytes`);
  }
  const sheet = args.indexOf('--sheet');
  if (sheet >= 0) await writeSheet(path.resolve(args[sheet + 1]), looks);
}
