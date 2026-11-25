// Data Arena V2 Unified PB-Rank Procedural Pixel-Particle VFX Engine (Wave 8-A, 2026-11-25).
//
// 100% Original Procedural Pixel-Art VFX Architecture (Zero Blocky Square Clip-Boxes,
// Zero Muddy Dark Outlines, Zero shadowBlur, Locked 60 FPS on iPhone & Desktop):
//  - 5-Layer GPU Draw Pipeline:
//      1. decalsGfx  (ground) : radiating ground cracks, subtle scorch speckles, frost filigree
//      2. groundGfx  (ground) : elliptical shockwave rings, ripples, low-alpha soft fog surfaces
//      3. depthGfx   (front)  : faceted 8-vertex rock/ice spires (hh), translucent hex shields, ribbons
//      4. topGfx / topAddGfx  : 12 procedural pixel-art particle shapes (px, pxball, 3-pass shaded
//                               pxpuff, crescent, ring, streak, shard, star, glow, fog, soft, rose)
//      5. beamConduitGfx      : tapered energy conduits + jagged branching lightning arcs (x1)
//  - 10 Canonical Element Multi-Stop RGBA Palettes (METAL, WOOD, EARTH, WATER, FIRE, SUN, ICE,
//    WIND, THUNDER, MOON) + 13 Elemental Hit-Burst Presets + strict particle cap (zero GC spikes).
//  - Presentation only: zero simulation, timing, damage, or RNG authority side effects.

import { BATTLE_FX_PALETTES } from "../battleFx/battleFxPalettes.js";
import { resolveMoveSpecV2 } from "../../modes/dataArena/dataArenaMoveCatalogV2.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Multi-stop RGBA palettes [t, [r,g,b], alpha] across all 10 Canonical Elements + utility looks
export const PB_PARTICLE_PALETTES = Object.freeze({
  fire:     [[0, [255, 255, 232], 1], [0.25, [255, 224, 96], 0.96], [0.58, [255, 118, 32], 0.88], [0.85, [196, 44, 18], 0.55], [1, [92, 22, 16], 0]],
  blueFire: [[0, [245, 255, 255], 1], [0.28, [130, 236, 255], 0.95], [0.62, [48, 138, 255], 0.85], [1, [24, 48, 148], 0]],
  water:    [[0, [240, 252, 255], 0.98], [0.3, [120, 224, 255], 0.9], [0.7, [38, 136, 236], 0.72], [1, [18, 68, 160], 0]],
  ice:      [[0, [255, 255, 255], 1], [0.3, [198, 246, 255], 0.95], [0.68, [102, 206, 248], 0.78], [1, [48, 128, 198], 0]],
  thunder:  [[0, [255, 255, 244], 1], [0.3, [255, 240, 108], 0.96], [0.68, [255, 186, 24], 0.8], [1, [186, 98, 12], 0]],
  wind:     [[0, [250, 255, 252], 0.95], [0.35, [182, 246, 232], 0.82], [0.75, [104, 204, 196], 0.45], [1, [72, 148, 152], 0]],
  wood:     [[0, [242, 255, 212], 1], [0.32, [138, 238, 106], 0.94], [0.7, [48, 178, 72], 0.78], [1, [22, 98, 42], 0]],
  nature:   [[0, [242, 255, 212], 1], [0.32, [138, 238, 106], 0.94], [0.7, [48, 178, 72], 0.78], [1, [22, 98, 42], 0]],
  earth:    [[0, [255, 236, 192], 0.96], [0.32, [218, 168, 104], 0.9], [0.7, [152, 104, 58], 0.74], [1, [82, 54, 34], 0]],
  metal:    [[0, [255, 255, 255], 1], [0.3, [214, 228, 242], 0.94], [0.68, [136, 156, 178], 0.76], [1, [68, 82, 100], 0]],
  sun:      [[0, [255, 255, 255], 1], [0.3, [255, 244, 172], 0.96], [0.68, [255, 202, 72], 0.78], [1, [218, 124, 24], 0]],
  light:    [[0, [255, 255, 255], 1], [0.3, [255, 244, 172], 0.96], [0.68, [255, 202, 72], 0.78], [1, [218, 124, 24], 0]],
  moon:     [[0, [250, 218, 255], 0.98], [0.3, [196, 104, 255], 0.92], [0.68, [112, 42, 196], 0.74], [1, [42, 16, 86], 0]],
  dark:     [[0, [246, 206, 255], 0.96], [0.3, [168, 78, 238], 0.9], [0.68, [88, 32, 158], 0.74], [1, [30, 14, 58], 0]],
  poison:   [[0, [238, 210, 255], 0.95], [0.3, [186, 82, 238], 0.9], [0.68, [120, 34, 166], 0.72], [1, [54, 16, 82], 0]],
  toxic:    [[0, [238, 210, 255], 0.95], [0.3, [186, 82, 238], 0.9], [0.68, [120, 34, 166], 0.72], [1, [54, 16, 82], 0]],
  psychic:  [[0, [255, 232, 250], 1], [0.3, [255, 128, 216], 0.94], [0.68, [186, 62, 214], 0.76], [1, [88, 24, 128], 0]],
  dragon:   [[0, [255, 240, 224], 1], [0.28, [255, 134, 86], 0.95], [0.64, [176, 62, 226], 0.82], [1, [66, 24, 118], 0]],
  rose:     [[0, [255, 244, 248], 1], [0.35, [255, 164, 206], 0.94], [0.72, [236, 88, 152], 0.75], [1, [164, 38, 92], 0]],
  dust:     [[0, [238, 222, 192], 0.78], [0.45, [196, 174, 138], 0.56], [1, [138, 118, 92], 0]],
  smoke:    [[0, [212, 216, 224], 0.58], [0.5, [144, 150, 162], 0.36], [1, [84, 88, 98], 0]],
  spark:    [[0, [255, 255, 255], 1], [0.35, [255, 236, 132], 0.95], [0.75, [255, 156, 48], 0.65], [1, [200, 80, 20], 0]],
  white:    [[0, [255, 255, 255], 1], [0.5, [232, 242, 255], 0.8], [1, [168, 196, 236], 0]],
  neutral:  [[0, [255, 255, 255], 1], [0.35, [226, 236, 248], 0.9], [0.75, [160, 176, 198], 0.62], [1, [92, 104, 122], 0]]
});

const ROCK_PALETTES = Object.freeze({
  earth: [0x3d2817, 0x7a5634, 0xaa7f52, 0xd9b584, 0xfff0d4],
  ice:   [0x1f5378, 0x4b93bf, 0x8ad6f5, 0xcff2ff, 0xffffff],
  metal: [0x2a3440, 0x5c6b7c, 0x9aa8b8, 0xd4dfe8, 0xffffff],
  wood:  [0x1c3d1e, 0x357538, 0x62b552, 0xa8e882, 0xe8ffd0],
  dark:  [0x1d1033, 0x452072, 0x7b3ec4, 0xc084fc, 0xf3e8ff],
  fire:  [0x3a140e, 0x8a2c14, 0xde5b1e, 0xffaa44, 0xfff2c2]
});

const COVER_PALETTE_KEY = Object.freeze({
  STONE: "earth", WOOD: "wood", TIMBER: "wood", BASALT: "fire",
  CORAL: "rose", ICE: "ice", SANDSTONE: "earth", CRYSTAL: "ice", METAL: "metal"
});

const PUDDLE_CONFIG = Object.freeze({
  WATER_PUDDLE:      { pal: "water",   alpha: 0.34, ambient: "soft",   rate: 0.28 },
  POISON_POOL:       { pal: "poison",  alpha: 0.38, ambient: "pxball", rate: 0.22 },
  ICE_PATCH:         { pal: "ice",     alpha: 0.38, ambient: "shard",  rate: 0.32 },
  FIRE_PATCH:        { pal: "fire",    alpha: 0.36, ambient: "pxpuff", rate: 0.16 },
  VINE_PATCH:        { pal: "wood",    alpha: 0.36, ambient: "rose",   rate: 0.30 },
  ELECTRIFIED_WATER: { pal: "thunder", alpha: 0.40, ambient: "px",     rate: 0.14 },
  MUD_PATCH:         { pal: "earth",   alpha: 0.36, ambient: "dust",   rate: 0.35 }
});

function rgbToHex(r, g, b) {
  return ((clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255));
}

function sampleStops(stops, t) {
  const g = clamp(t, 0, 1);
  if (!stops?.length) return { hex: 0xffffff, r: 255, g: 255, b: 255, a: 1 };
  if (g <= stops[0][0]) {
    const c = stops[0][1];
    return { hex: rgbToHex(c[0], c[1], c[2]), r: c[0], g: c[1], b: c[2], a: stops[0][2] };
  }
  for (let i = 1; i < stops.length; i++) {
    if (g <= stops[i][0]) {
      const [t0, c0, a0] = stops[i - 1];
      const [t1, c1, a1] = stops[i];
      const k = (g - t0) / Math.max(0.0001, t1 - t0);
      const r = c0[0] + (c1[0] - c0[0]) * k;
      const gr = c0[1] + (c1[1] - c0[1]) * k;
      const b = c0[2] + (c1[2] - c0[2]) * k;
      const a = a0 + (a1 - a0) * k;
      return { hex: rgbToHex(r, gr, b), r, g: gr, b, a };
    }
  }
  const last = stops[stops.length - 1];
  return { hex: rgbToHex(last[1][0], last[1][1], last[1][2]), r: last[1][0], g: last[1][1], b: last[1][2], a: last[2] };
}

function normalizePalKey(key) {
  const k = String(key ?? "fire").toLowerCase();
  if (PB_PARTICLE_PALETTES[k]) return k;
  if (k === "frost") return "ice";
  if (k === "storm" || k === "electric") return "thunder";
  if (k === "shadow" || k === "ghost") return "moon";
  if (k === "physical" || k === "steel" || k === "fighting") return "metal";
  if (k === "grass" || k === "bug") return "wood";
  if (k === "rock" || k === "ground") return "earth";
  if (k === "fairy") return "sun";
  return "fire";
}

function paletteStops(key) {
  return PB_PARTICLE_PALETTES[normalizePalKey(key)] ?? PB_PARTICLE_PALETTES.fire;
}

function paletteHex(key) {
  const p = BATTLE_FX_PALETTES[key] ?? BATTLE_FX_PALETTES[normalizePalKey(key)];
  if (p) return p;
  const s = paletteStops(key);
  const c0 = s[0][1], c1 = s[1]?.[1] ?? c0, c2 = s[Math.min(2, s.length - 1)][1];
  return { core: rgbToHex(c0[0], c0[1], c0[2]), main: rgbToHex(c1[0], c1[1], c1[2]), edge: rgbToHex(c2[0], c2[1], c2[2]) };
}

// Rasterize crisp 1px scanline pixel circle (PB Ranked `pxball` — zero blurry edges, zero square clip box!)
function drawPixelBall(gfx, cx, cy, radius, color, alpha) {
  if (!gfx || alpha <= 0.015 || radius < 0.7) return;
  const r = Math.min(28, radius);
  const rx = Math.round(cx), ry = Math.round(cy);
  const step = r > 12 ? 2 : 1;
  const lim = Math.ceil(r);
  for (let dy = -lim; dy <= lim; dy += step) {
    const span = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (span < 0.5) continue;
    const w = Math.max(1, Math.round(span * 2));
    gfx.rect(Math.round(rx - span), ry + dy, w, step).fill({ color, alpha });
  }
}

// 3-pass shaded pixel cloud (PB Ranked `pxpuff`: dark underside -> base body -> sunlit top highlight!)
function drawPixelPuff(gfx, cx, cy, radius, r, g, b, alpha) {
  if (!gfx || alpha <= 0.015 || radius < 1) return;
  const rad = Math.min(26, radius);
  const darkHex = rgbToHex(r * 0.55, g * 0.55, b * 0.55);
  const baseHex = rgbToHex(r, g, b);
  const hiHex = rgbToHex(r + (255 - r) * 0.48, g + (255 - g) * 0.48, b + (255 - b) * 0.48);
  drawPixelBall(gfx, cx + rad * 0.18, cy + rad * 0.22, rad, darkHex, alpha * 0.85);
  drawPixelBall(gfx, cx, cy, rad * 0.88, baseHex, alpha);
  drawPixelBall(gfx, cx - rad * 0.25, cy - rad * 0.28, rad * 0.5, hiHex, alpha * 0.92);
}

// Faceted 8-vertex procedural rock/ice spire (PB Ranked `hh()` — crisp 3D volume with drop shadow + fracture line!)
function drawFacetedSpire(gfx, cx, cy, radius, rot, seed, pal, alpha) {
  if (!gfx || alpha <= 0.02 || radius < 2) return;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU;
    const jitter = 0.78 + 0.3 * Math.abs(Math.sin(seed * 12.7 + i * 5.3));
    const pr = radius * jitter;
    pts.push([cx + Math.cos(a) * pr, cy + Math.sin(a) * pr * 0.84]);
  }
  const flatPoly = (arr) => {
    const flat = [];
    for (const p of arr) flat.push(p[0], p[1]);
    return flat;
  };
  if (typeof gfx.poly === "function") {
    // Ground drop shadow
    gfx.poly(flatPoly(pts.map(([x, y]) => [cx + (x - cx) * 1.18 + 3, cy + (y - cy) * 1.12 + 5]))).fill({ color: 0x090b14, alpha: 0.32 * alpha });
    // Base facet
    gfx.poly(flatPoly(pts)).fill({ color: pal[2], alpha });
    // Dark lower-right facet
    gfx.poly(flatPoly(pts.map(([x, y]) => [x + (cx + radius * 0.32 - x) * 0.45, y + (cy + radius * 0.32 - y) * 0.45]))).fill({ color: pal[1], alpha: 0.85 * alpha });
    // Sunlit upper-left facet
    gfx.poly(flatPoly(pts.map(([x, y]) => [x + (cx - radius * 0.28 - x) * 0.5, y + (cy - radius * 0.3 - y) * 0.5]))).fill({ color: pal[3], alpha: 0.9 * alpha });
  } else {
    gfx.circle(cx, cy, radius).fill({ color: pal[2], alpha });
  }
  // Specular glint + internal fracture line
  gfx.circle(cx - radius * 0.32, cy - radius * 0.34, Math.max(1.5, radius * 0.16)).fill({ color: pal[4], alpha: 0.95 * alpha });
  gfx.moveTo(cx - radius * 0.12, cy - radius * 0.46).lineTo(cx + radius * 0.08, cy - radius * 0.04).lineTo(cx - radius * 0.06, cy + radius * 0.36)
    .stroke({ color: pal[0], width: 1.4, alpha: 0.82 * alpha });
}

// Jagged branching lightning bolt (PB Ranked `x1()`)
function drawJaggedBolt(gfx, x0, y0, x1, y1, width, mainHex, coreHex, alpha, seed) {
  if (!gfx || alpha <= 0.02) return;
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  const nx = -dy / dist, ny = dx / dist;
  const segs = clamp(Math.floor(dist / 26), 4, 12);
  const pts = [[x0, y0]];
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const j = Math.sin(seed * 19.3 + i * 7.1) * Math.min(22, dist * 0.11);
    pts.push([x0 + dx * f + nx * j, y0 + dy * f + ny * j]);
  }
  pts.push([x1, y1]);
  gfx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
  gfx.stroke({ color: mainHex, width: width * 2.2, alpha: 0.46 * alpha, cap: "round", join: "round" });
  gfx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
  gfx.stroke({ color: coreHex, width: Math.max(1.8, width), alpha: 0.96 * alpha, cap: "round", join: "round" });
}

export function createDataArenaPixelFxV2({ PIXI, ground, front, quality = "high", reducedMotion = false }) {
  if (!PIXI || !front) return null;

  const MAX_PARTICLES = quality === "low" ? 180 : 340;
  const MAX_DECALS = quality === "low" ? 24 : 48;
  const MAX_SPIRES = quality === "low" ? 14 : 28;
  const MAX_LIGHTNING = 12;

  const makeGfx = (parent, label, blend = null) => {
    if (!PIXI.Graphics) return null;
    const g = new PIXI.Graphics();
    g.label = label;
    if (blend) g.blendMode = blend;
    parent?.addChild?.(g);
    return g;
  };

  // 5-layer PB-Rank GPU draw stack
  const decalsGfx = makeGfx(ground ?? front, "pbrank decals");
  const groundGfx = makeGfx(ground ?? front, "pbrank ground fx");
  const depthGfx = makeGfx(front, "pbrank depth spires & shields");
  const topGfx = makeGfx(front, "pbrank top particles");
  const topAddGfx = makeGfx(front, "pbrank top additive particles", "add");
  const beamConduitGfx = makeGfx(front, "pixelfx v2 beam conduits", "add");

  const particles = [];
  const decals = [];
  const spires = [];
  const lightningBolts = [];
  const liveShots = [];
  const livePuddles = new Map();
  const beamConduits = [];
  const telegraphs = [];
  const shields = [];

  let holdMs = 0;
  let lastRingAt = 0;
  let seedCounter = 1;
  const rand = () => {
    seedCounter = (seedCounter * 1664525 + 1013904223) >>> 0;
    return seedCounter / 4294967296;
  };

  const stats = {
    engine: "pixelfx-v2",
    renderer: "pbrank-procedural-pixelfx",
    casts: 0, releases: 0, hits: 0, ults: 0, projectiles: 0, props: 0, clashes: 0
  };

  function spawnP(p) {
    if (reducedMotion && particles.length >= 40) return;
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      layer: p.layer ?? "top",     // "ground" | "top"
      shape: p.shape ?? "px",      // px | pxball | pxpuff | crescent | ring | streak | shard | star | glow | fog | soft | rose
      x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0,
      vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0,
      drag: p.drag ?? 0.92,
      gravity: p.gravity ?? 0,
      size: p.size ?? 6,
      size1: p.size1 ?? (p.size ?? 6),
      rot: p.rot ?? 0,
      vrot: p.vrot ?? 0,
      width: p.width ?? 2.4,
      squash: p.squash ?? 0.62,
      stretch: p.stretch ?? 1.8,
      add: p.add ?? false,
      alphaMul: p.alphaMul ?? 1,
      stops: p.stops ?? paletteStops(p.pal ?? "fire"),
      age: 0,
      life: Math.max(0.06, p.life ?? 0.35)
    });
  }

  function addDecal({ x, y, kind = "scorch", radius = 26, pal = "earth", life = 3.6 }) {
    if (reducedMotion) return;
    if (decals.length >= MAX_DECALS) decals.shift();
    decals.push({ x, y, kind, radius, pal: normalizePalKey(pal), seed: rand() * 99, age: 0, life });
  }

  function addSpire({ x, y, radius = 22, pal = "earth", life = 0.58, delay = 0 }) {
    if (spires.length >= MAX_SPIRES) spires.shift();
    spires.push({ x, y, radius, pal: ROCK_PALETTES[normalizePalKey(pal)] ?? ROCK_PALETTES.earth, rot: rand() * TAU, seed: rand() * 100, age: -delay, life });
  }

  function addLightning(x0, y0, x1, y1, palKey = "thunder", width = 3.2, life = 0.22) {
    if (lightningBolts.length >= MAX_LIGHTNING) lightningBolts.shift();
    const hex = paletteHex(palKey);
    lightningBolts.push({ x0, y0, x1, y1, main: hex.main, core: hex.core, width, age: 0, life, seed: rand() * 100 });
  }

  // PB Ranked 13-elemental hit-burst preset (`ws(fxType, x, y, scale, angle)`)
  function emitElementBurst({ x, y, palKey = "fire", scale = 1, angle = 0, heavy = false }) {
    const pk = normalizePalKey(palKey);
    const stops = paletteStops(pk);
    const count = heavy ? (quality === "low" ? 10 : 18) : (quality === "low" ? 6 : 11);

    // Core starburst + additive glow flash
    spawnP({ shape: "glow", x, y, size: 12 * scale, size1: 30 * scale, life: 0.16, pal: pk, add: true, alphaMul: 0.85 });
    spawnP({ shape: "star", x, y, size: (heavy ? 18 : 11) * scale, size1: 3 * scale, rot: rand() * TAU, life: 0.18, pal: "white", add: true });
    spawnP({ shape: "ring", x, y, size: 8 * scale, size1: (heavy ? 44 : 28) * scale, width: heavy ? 3.5 : 2.2, squash: 0.72, life: 0.22, pal: pk, add: true });

    if (pk === "thunder") {
      for (let i = 0; i < (heavy ? 3 : 2); i++) {
        const a = angle + (rand() - 0.5) * 2.4;
        const d = (28 + rand() * 38) * scale;
        addLightning(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, "thunder", heavy ? 3.2 : 2.2, 0.18);
      }
    }

    for (let i = 0; i < count; i++) {
      const spread = heavy ? TAU : 2.1;
      const a = angle + (rand() - 0.5) * spread;
      const spd = (110 + rand() * (heavy ? 240 : 160)) * scale;
      let shape = "px";
      let add = true;
      let size = (3 + rand() * 3.5) * scale;
      let size1 = 0.8;
      if (pk === "fire" || pk === "blueFire") {
        shape = i % 3 === 0 ? "pxpuff" : i % 2 === 0 ? "streak" : "pxball";
        add = shape !== "pxpuff";
        size = (shape === "pxpuff" ? 7 + rand() * 6 : 3 + rand() * 3) * scale;
      } else if (pk === "water") {
        shape = i % 3 === 0 ? "pxball" : i % 2 === 0 ? "soft" : "streak";
        add = shape === "streak";
        size = (3.5 + rand() * 4.5) * scale;
      } else if (pk === "ice" || pk === "metal") {
        shape = i % 2 === 0 ? "shard" : "streak";
        size = (4.5 + rand() * 4) * scale;
      } else if (pk === "wood") {
        shape = i % 3 === 0 ? "rose" : i % 2 === 0 ? "shard" : "px";
        add = shape === "px";
        size = (4 + rand() * 3.5) * scale;
      } else if (pk === "earth") {
        shape = i % 2 === 0 ? "shard" : "pxpuff";
        add = false;
        size = (4.5 + rand() * 5) * scale;
      } else if (pk === "moon" || pk === "dark" || pk === "poison") {
        shape = i % 3 === 0 ? "pxball" : i % 2 === 0 ? "glow" : "px";
        size = (4 + rand() * 4.5) * scale;
      } else if (pk === "sun" || pk === "light") {
        shape = i % 2 === 0 ? "star" : "streak";
        size = (5 + rand() * 4.5) * scale;
      } else if (pk === "wind") {
        shape = i % 2 === 0 ? "streak" : "crescent";
        size = (6 + rand() * 5) * scale;
      }
      spawnP({
        shape, x, y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.82,
        vz: (pk === "earth" || pk === "water") ? 90 + rand() * 110 : 0,
        gravity: (pk === "earth" || pk === "water") ? 360 : 0,
        drag: shape === "pxpuff" ? 0.88 : 0.91,
        size, size1, rot: a, vrot: (rand() - 0.5) * 9,
        stops, add, life: 0.20 + rand() * 0.22
      });
    }
  }

  // Emit a fluid PB-Ranked Flamethrower / Dragon Breath overlapping pxpuff stream!
  function emitFluidStream({ x, y, angle = 0, palKey = "fire", range = 260, puffs = 14 }) {
    const pk = normalizePalKey(palKey);
    const stops = paletteStops(pk);
    const n = quality === "low" ? Math.ceil(puffs * 0.6) : puffs;
    for (let i = 0; i < n; i++) {
      const f = i / Math.max(1, n - 1);
      const jitter = (rand() - 0.5) * 0.22;
      const a = angle + jitter;
      const spd = (240 + f * 260) * (range / 280);
      const isCore = f < 0.28;
      spawnP({
        shape: isCore ? "pxball" : "pxpuff",
        x: x + Math.cos(angle) * (10 + f * 18),
        y: y + Math.sin(angle) * (10 + f * 18),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        drag: 0.90,
        size: (isCore ? 6 : 8 + f * 6),
        size1: (isCore ? 10 : 14 + f * 7),
        stops, add: isCore,
        alphaMul: isCore ? 0.98 : 0.88,
        life: 0.24 + f * 0.22
      });
    }
    spawnP({ shape: "glow", x, y, size: 12, size1: 24, life: 0.2, pal: pk, add: true, alphaMul: 0.75 });
  }

  // Emit crisp PB-Ranked melee crescent slash arcs tightly hugging fighter/target (~1.2x body!)
  function emitCrescentSlash({ x, y, angle = 0, palKey = "metal", scale = 1, count = 1 }) {
    const pk = normalizePalKey(palKey);
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) * 0.5) * 0.42;
      spawnP({
        shape: "crescent", x: x + Math.cos(a) * 14 * scale, y: y + Math.sin(a) * 12 * scale,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 32, drag: 0.85,
        size: 28 * scale, size1: 38 * scale, width: 5.5 * scale, rot: a,
        pal: pk, add: true, life: 0.16 + i * 0.04
      });
      spawnP({
        shape: "crescent", x: x + Math.cos(a) * 14 * scale, y: y + Math.sin(a) * 12 * scale,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 32, drag: 0.85,
        size: 26 * scale, size1: 35 * scale, width: 2.5 * scale, rot: a,
        pal: "white", add: true, life: 0.13 + i * 0.03
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + (rand() - 0.5) * 1.4;
      spawnP({
        shape: "streak", x, y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 220,
        size: 5, size1: 1, stretch: 2.4, pal: pk, add: true, life: 0.16
      });
    }
  }

  function drawParticle(gfx, p) {
    const g = clamp(p.age / p.life, 0, 1);
    const col = sampleStops(p.stops, g);
    const alpha = clamp(col.a * p.alphaMul, 0, 1);
    if (alpha <= 0.015) return;
    const sz = p.size + (p.size1 - p.size) * g;
    if (sz <= 0.4) return;
    const x = p.x, y = p.y - p.z;
    const hex = col.hex;

    switch (p.shape) {
      case "px": {
        const s = Math.max(1.5, Math.round(sz));
        gfx.rect(Math.round(x - s * 0.5), Math.round(y - s * 0.5), s, s).fill({ color: hex, alpha });
        break;
      }
      case "pxball":
        drawPixelBall(gfx, x, y, sz, hex, alpha);
        break;
      case "pxpuff":
        drawPixelPuff(gfx, x, y, sz, col.r, col.g, col.b, alpha);
        break;
      case "glow": {
        gfx.circle(x, y, sz * 1.5).fill({ color: hex, alpha: alpha * 0.22 });
        gfx.circle(x, y, sz * 0.92).fill({ color: hex, alpha: alpha * 0.45 });
        gfx.circle(x, y, sz * 0.45).fill({ color: 0xffffff, alpha: alpha * 0.65 });
        break;
      }
      case "fog": {
        if (typeof gfx.ellipse === "function") {
          gfx.ellipse(x, y, sz * 1.3, sz * 0.78).fill({ color: hex, alpha: alpha * 0.5 });
          gfx.ellipse(x, y, sz * 0.85, sz * 0.5).fill({ color: hex, alpha: alpha * 0.65 });
        } else {
          gfx.circle(x, y, sz).fill({ color: hex, alpha: alpha * 0.55 });
        }
        break;
      }
      case "soft":
        gfx.circle(x, y, sz).fill({ color: hex, alpha: alpha * 0.82 });
        gfx.circle(x - sz * 0.28, y - sz * 0.28, sz * 0.3).fill({ color: 0xffffff, alpha: alpha * 0.85 });
        break;
      case "streak": {
        const spd = Math.hypot(p.vx, p.vy - p.vz) || 1;
        const dx = p.vx / spd, dy = (p.vy - p.vz) / spd;
        const len = Math.max(sz * 1.6, Math.min(48, spd * 0.045 * p.stretch));
        gfx.moveTo(x - dx * len, y - dy * len).lineTo(x + dx * len * 0.4, y + dy * len * 0.4)
          .stroke({ color: hex, width: Math.max(1.5, sz * 0.45), alpha, cap: "round" });
        break;
      }
      case "shard": {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const l = sz * 1.45, w = sz * 0.55;
        const pts = [
          x + c * l, y + s * l,
          x - s * w, y + c * w,
          x - c * l * 0.75, y - s * l * 0.75,
          x + s * w, y - c * w
        ];
        if (typeof gfx.poly === "function") {
          gfx.poly(pts).fill({ color: hex, alpha });
          gfx.moveTo(pts[0], pts[1]).lineTo(pts[4], pts[5]).stroke({ color: 0xffffff, width: 1.2, alpha: alpha * 0.75 });
        } else {
          gfx.circle(x, y, sz).fill({ color: hex, alpha });
        }
        break;
      }
      case "ring": {
        const rx = sz, ry = sz * p.squash;
        if (typeof gfx.ellipse === "function") {
          gfx.ellipse(x, y, rx, ry).stroke({ color: hex, width: Math.max(1.2, p.width * (1 - g * 0.55)), alpha });
        } else {
          gfx.circle(x, y, rx).stroke({ color: hex, width: Math.max(1.2, p.width * (1 - g * 0.55)), alpha });
        }
        break;
      }
      case "crescent": {
        const span = 1.15;
        const a0 = p.rot - span, a1 = p.rot + span;
        const segs = 8;
        gfx.moveTo(x + Math.cos(a0) * sz, y + Math.sin(a0) * sz * 0.85);
        for (let i = 1; i <= segs; i++) {
          const a = a0 + (a1 - a0) * (i / segs);
          gfx.lineTo(x + Math.cos(a) * sz, y + Math.sin(a) * sz * 0.85);
        }
        gfx.stroke({ color: hex, width: Math.max(1.6, p.width * (1 - g * 0.65)), alpha, cap: "round" });
        break;
      }
      case "star": {
        const arms = 4;
        for (let i = 0; i < arms; i++) {
          const a = p.rot + (i * Math.PI) / arms;
          const len = i % 2 === 0 ? sz * 1.4 : sz * 0.85;
          gfx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len)
            .lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
            .stroke({ color: hex, width: Math.max(1.4, sz * 0.2), alpha, cap: "round" });
        }
        gfx.circle(x, y, sz * 0.28).fill({ color: 0xffffff, alpha });
        break;
      }
      case "rose": {
        for (let i = 0; i < 5; i++) {
          const a = p.rot + (i / 5) * TAU;
          gfx.circle(x + Math.cos(a) * sz * 0.52, y + Math.sin(a) * sz * 0.52, sz * 0.44).fill({ color: hex, alpha: alpha * 0.92 });
        }
        gfx.circle(x, y, sz * 0.26).fill({ color: 0xfff8dc, alpha });
        break;
      }
    }
  }

  function drawDecal(gfx, d) {
    const rem = d.life - d.age;
    const fade = rem < 0.9 ? clamp(rem / 0.9, 0, 1) : 1;
    const a = 0.45 * fade;
    if (a <= 0.015) return;
    if (d.kind === "crack") {
      // Crisp PB Ranked radiating ground cracks (Earthquake / Slam)
      const rays = 7;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * TAU + (d.seed % 1);
        const len = d.radius * (0.65 + 0.35 * Math.sin(d.seed + i * 3.1));
        const mx = d.x + Math.cos(ang + 0.14) * len * 0.52;
        const my = d.y + Math.sin(ang + 0.14) * len * 0.34;
        const ex = d.x + Math.cos(ang) * len;
        const ey = d.y + Math.sin(ang) * len * 0.65;
        gfx.moveTo(d.x, d.y).lineTo(mx, my).lineTo(ex, ey)
          .stroke({ color: 0x1b1714, width: 2.0, alpha: a * 1.25, cap: "round" });
      }
      if (typeof gfx.ellipse === "function") {
        gfx.ellipse(d.x, d.y, d.radius * 0.32, d.radius * 0.2).fill({ color: 0x1b1714, alpha: a * 0.55 });
      }
    } else if (d.kind === "frost") {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + d.seed;
        gfx.moveTo(d.x, d.y).lineTo(d.x + Math.cos(ang) * d.radius * 0.75, d.y + Math.sin(ang) * d.radius * 0.48)
          .stroke({ color: 0xb8f0ff, width: 1.6, alpha: a * 1.1 });
      }
    } else {
      // Subtle scorch / splash speckles (zero muddy brown smudge blocks!)
      const hex = d.pal === "water" ? 0x1e5c8a : d.pal === "poison" ? 0x5c227a : 0x221915;
      for (let i = 0; i < 5; i++) {
        const ang = d.seed + i * 2.1;
        const dist = d.radius * (0.18 + (i % 3) * 0.24);
        const r = Math.max(2, d.radius * (0.16 - i * 0.015));
        drawPixelBall(gfx, d.x + Math.cos(ang) * dist, d.y + Math.sin(ang) * dist * 0.62, r, hex, a * 0.65);
      }
    }
  }

  return Object.freeze({
    isPixelFxV2: true,
    look: (moveId) => resolveMoveSpecV2(moveId),

    /** Directly play any PB-324 move record's procedural particle recipe (ready for Wave 8-B). */
    playPbMoveVfx({ x, y, angle = 0, element = "FIRE", shapes = [], layers = [], heavy = false, radius = 90 }) {
      const pk = normalizePalKey(element);
      if (shapes.includes("crescent")) emitCrescentSlash({ x, y, angle, palKey: pk, scale: heavy ? 1.25 : 1.0, count: heavy ? 2 : 1 });
      if (shapes.includes("pxpuff")) emitFluidStream({ x, y, angle, palKey: pk, range: Math.max(180, radius * 2), puffs: heavy ? 14 : 9 });
      if (layers.includes("ground-decals")) addDecal({ x, y: y + 10, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: Math.min(54, radius * 0.45), pal: pk });
      emitElementBurst({ x, y, palKey: pk, scale: heavy ? 1.25 : 0.9, angle, heavy });
      stats.releases++;
      return true;
    },

    cast({ x, y, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      // PB Ranked charge windup: inward-pulling energy streaks + glowing core star
      spawnP({ shape: "star", x, y: y - 4, size: 12, size1: 3, rot: rand() * TAU, pal: pk, add: true, life: 0.20 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rand() * 0.4;
        const r = 34;
        spawnP({ shape: "streak", x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.72, vx: -Math.cos(a) * 145, vy: -Math.sin(a) * 110, size: 3.5, size1: 1, pal: pk, add: true, life: 0.18 });
      }
      stats.casts++;
    },

    telegraph({ x, y, shape = "circle", radius = 95, range = 360, angle = 0, moveId = null, paletteKey = null, duration = 0.45 }) {
      if (reducedMotion) return false;
      const spec = moveId ? resolveMoveSpecV2(moveId) : null;
      const pk = normalizePalKey(paletteKey ?? spec?.paletteKey ?? "fire");
      const hex = paletteHex(pk);
      telegraphs.push({ x, y, shape, radius, range, angle, color: hex.main, core: hex.core, age: 0, life: Math.max(0.22, Math.min(0.9, duration)) });
      if (telegraphs.length > 10) telegraphs.shift();
      return true;
    },

    deployShield({ x, y, paletteKey = "light", duration = 0.35 }) {
      if (reducedMotion) return false;
      const pk = normalizePalKey(paletteKey);
      const hex = paletteHex(pk);
      shields.push({ x, y: y - 12, radius: 42, color: hex.main, core: hex.core, age: 0, life: Math.max(0.32, duration) });
      spawnP({ shape: "ring", layer: "ground", x, y: y + 6, size: 18, size1: 48, width: 2.5, squash: 0.6, pal: pk, add: true, life: 0.32 });
      return true;
    },

    arenaZone({ x, y, kind = "ECHO", phase = "ACTIVE", radius = 72 }) {
      if (reducedMotion) return false;
      const palMap = { ECHO: "sun", BLOOM: "wood", VENT: "fire", TIDE: "water", UPDRAFT: "wind", RECHARGE: "thunder", SUPER_CORE: "sun" };
      const pk = palMap[kind] ?? "sun";
      if (phase === "WARNING") {
        spawnP({ shape: "ring", layer: "ground", x, y: y + 6, size: radius * 1.15, size1: radius * 0.4, width: 2, squash: 0.65, pal: pk, add: true, life: 0.45 });
        return true;
      }
      spawnP({ shape: "ring", layer: "ground", x, y: y + 6, size: radius * 0.35, size1: radius * 1.15, width: 3, squash: 0.65, pal: pk, add: true, life: 0.36 });
      for (let i = 0; i < (phase === "CLAIM" ? 12 : 6); i++) {
        const a = rand() * TAU;
        const d = rand() * radius * 0.7;
        spawnP({
          shape: kind === "BLOOM" ? "rose" : "star",
          x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.65,
          vx: Math.cos(a) * 30, vy: -75 - rand() * 65,
          size: 5 + rand() * 4, size1: 1.5, pal: pk, add: true, life: 0.38
        });
      }
      if (phase === "CLAIM" && kind === "VENT") addDecal({ x, y: y + 8, kind: "crack", radius: 34, pal: "fire" });
      return true;
    },

    release({ x, y, angle = 0, moveId, melee = false }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const arch = spec.v2Archetype;
      const pbShapes = spec.pb324?.vfx?.shapes ?? [];
      if (arch === "STREAM_BEAM") {
        spawnP({ shape: "glow", x, y, size: 16, size1: 30, pal: pk, add: true, life: 0.24 });
        spawnP({ shape: "star", x, y, size: 16, size1: 4, rot: angle, pal: "white", add: true, life: 0.22 });
        if (pk === "fire" || pk === "water" || pk === "ice" || pk === "dragon" || pbShapes.includes("pxpuff")) {
          emitFluidStream({ x, y, angle, palKey: pk, range: 260, puffs: 11 });
        }
      } else if (melee || ["FLURRY_COMBO", "MULTI_DASH", "SHADOW_BACKSTAB", "UTURN_STRIKE", "GUARD_BREAK_SLAM"].includes(arch)) {
        emitCrescentSlash({ x, y, angle, palKey: pk, scale: arch === "GUARD_BREAK_SLAM" ? 1.3 : 1.05, count: arch === "FLURRY_COMBO" ? 2 : 1 });
      } else if (arch === "SELF_BUFF") {
        this.buff({ x, y, paletteKey: pk });
      } else if (arch === "PROTECT_COUNTER") {
        this.parry({ x, y });
      } else if (arch === "RECOVERY_SUPPORT") {
        this.heal({ x, y });
      } else {
        spawnP({ shape: "ring", x, y, size: 6, size1: 24, width: 2.2, squash: 0.85, pal: pk, add: true, life: 0.18 });
        spawnP({ shape: "star", x, y, size: 10, size1: 2, rot: angle, pal: "white", add: true, life: 0.16 });
      }
      // Express each PB-324 move's unique procedural shape accents on release!
      if (pbShapes.includes("rose")) {
        for (let i = 0; i < 4; i++) {
          const a = angle + (rand() - 0.5) * 1.1;
          spawnP({ shape: "rose", x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 110 - 25, size: 6.5, size1: 2, pal: pk, add: true, life: 0.34 });
        }
      } else if (pbShapes.includes("shard")) {
        for (let i = 0; i < 4; i++) {
          const a = angle + (rand() - 0.5) * 0.9;
          spawnP({ shape: "shard", x, y, vx: Math.cos(a) * 185, vy: Math.sin(a) * 150, size: 6, size1: 2, rot: a, pal: pk, add: true, life: 0.24 });
        }
      } else if (pbShapes.includes("pxpuff") && arch !== "STREAM_BEAM") {
        for (let i = 0; i < 3; i++) {
          const a = angle + (rand() - 0.5) * 0.8;
          spawnP({ shape: "pxpuff", x, y, vx: Math.cos(a) * 95, vy: Math.sin(a) * 75 - 15, size: 9, size1: 15, pal: pk, add: true, life: 0.28 });
        }
      }
      stats.releases++;
    },

    beamStream({ followStart, followEnd, moveId = "sunSpear", width = 16, durationSec = 0.65 }) {
      if (reducedMotion || !beamConduitGfx || typeof followStart !== "function" || typeof followEnd !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const pal = paletteHex(pk);
      const s0 = followStart();
      const e0 = followEnd();
      if (!s0 || !e0) return false;
      beamConduits.push({
        followStart, followEnd,
        originX: s0.x, originY: s0.y,
        lastX: e0.x, lastY: e0.y,
        main: pal.main ?? 0x6ff7ff,
        core: pal.core ?? 0xffffff,
        palKey: pk,
        width: Math.max(9, Math.min(22, width)),
        age: 0, maxAge: durationSec, detachedAt: null
      });
      if (beamConduits.length > 8) beamConduits.shift();
      return true;
    },

    /** Crisp procedural PB-Rank projectiles (compact 12-28px glowing head + dynamic particle trail!). */
    projectile({ follow, moveId, angle = 0, lifeMs = 1200 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const arch = spec.v2Archetype;
      const headShape = arch === "DRAG_WAVE" ? "pxpuff"
        : (pk === "ice" || pk === "wood" || pk === "metal" || pk === "earth") ? "shard"
        : (pk === "sun" || pk === "light") ? "star"
        : (pk === "wind") ? "crescent"
        : "pxball";
      const radius = arch === "DRAG_WAVE" ? 18 : arch === "STREAM_BEAM" ? 11 : 12;
      liveShots.push({
        follow, palKey: pk, stops: paletteStops(pk), headShape, radius, arch,
        age: 0, maxAge: lifeMs / 1000, prevX: null, prevY: null, angle, trailAcc: 0
      });
      stats.projectiles++;
      return true;
    },

    hit({ x, y, groundY = y, moveId, heavy = false, angle = 0 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pb = spec.pb324 ?? null;
      const fxKey = pb?.vfx?.fx ? normalizePalKey(pb.vfx.fx) : normalizePalKey(spec.paletteKey);
      const pk = normalizePalKey(spec.paletteKey);
      const isStream = Boolean(pb?.hitFeel?.stream);
      const isHeavy = heavy || Boolean(pb?.hitFeel?.impact) || (pb?.hitFeel?.hitstop ?? 0) >= 12;
      // Single cohesive procedural hit burst driven directly by each move's exact PB-324 fx preset & shapes!
      emitElementBurst({ x, y, palKey: fxKey || pk, scale: isStream ? 0.78 : isHeavy ? 1.32 : 0.96, angle, heavy: isHeavy && !isStream });
      if ((spec.melee || pb?.vfx?.shapes?.includes("crescent")) && !isStream) {
        emitCrescentSlash({ x, y, angle, palKey: pk, scale: isHeavy ? 1.22 : 0.92, count: 1 });
      }
      if (isHeavy && !reducedMotion && (!pb || pb.vfx.layers.includes("ground-decals"))) {
        addDecal({ x, y: groundY + 6, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: 34, pal: pk });
        holdMs = Math.max(holdMs, spec.hitStopMs ? Math.min(115, spec.hitStopMs) : 55);
      }
      stats.hits++;
    },

    area({ x, y, radius = 100, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const sc = clamp(radius / 95, 0.85, 1.55);
      spawnP({ shape: "ring", layer: "ground", x, y: y + 8, size: 16, size1: radius * 0.95, width: 4, squash: 0.62, pal: pk, add: true, life: 0.30 });
      emitElementBurst({ x, y, palKey: pk, scale: sc, angle: 0, heavy: true });
      addDecal({ x, y: y + 8, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: Math.min(58, radius * 0.48), pal: pk });
      stats.hits++;
      return true;
    },

    ult({ moveId, center }) {
      if (!center) return;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      spawnP({ shape: "ring", layer: "ground", x: center.x, y: center.y + 24, size: 22, size1: 110, width: 4.5, squash: 0.62, pal: pk, add: true, life: 0.42 });
      spawnP({ shape: "ring", layer: "ground", x: center.x, y: center.y + 24, size: 12, size1: 72, width: 2.5, squash: 0.62, pal: "white", add: true, life: 0.32 });
      spawnP({ shape: "star", x: center.x, y: center.y, size: 32, size1: 6, rot: 0, pal: "white", add: true, life: 0.28 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        spawnP({ shape: "streak", x: center.x + Math.cos(a) * 65, y: center.y + Math.sin(a) * 45, vx: -Math.cos(a) * 220, vy: -Math.sin(a) * 160, size: 5, size1: 1.5, pal: pk, add: true, life: 0.26 });
      }
      holdMs = Math.max(holdMs, 65);
      stats.ults++;
    },

    buff({ x, y, paletteKey = "sun" }) {
      const pk = normalizePalKey(paletteKey);
      spawnP({ shape: "ring", layer: "ground", x, y: y + 12, size: 16, size1: 62, width: 3.2, squash: 0.6, pal: pk, add: true, life: 0.42 });
      spawnP({ shape: "ring", layer: "ground", x, y: y + 12, size: 10, size1: 42, width: 2.2, squash: 0.6, pal: "white", add: true, life: 0.34 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        spawnP({ shape: i % 2 === 0 ? "star" : "px", x: x + Math.cos(a) * 26, y: y + 8 + Math.sin(a) * 14, vx: Math.cos(a) * 18, vy: -110 - rand() * 70, size: 6, size1: 1.5, pal: pk, add: true, life: 0.45 });
      }
    },

    heal({ x, y }) {
      spawnP({ shape: "ring", layer: "ground", x, y: y + 12, size: 16, size1: 58, width: 3, squash: 0.6, pal: "wood", add: true, life: 0.44 });
      for (let i = 0; i < 16; i++) {
        const a = rand() * TAU;
        const r = 8 + rand() * 28;
        spawnP({ shape: i % 3 === 0 ? "rose" : "star", x: x + Math.cos(a) * r, y: y + 10 + Math.sin(a) * r * 0.5, vx: 0, vy: -90 - rand() * 70, size: 6.5, size1: 2, pal: i % 3 === 0 ? "rose" : "wood", add: true, life: 0.50 });
      }
    },

    parry({ x, y }) {
      shields.push({ x, y: y - 10, radius: 46, color: 0x7fe9ff, core: 0xffffff, age: 0, life: 0.42 });
      spawnP({ shape: "ring", x, y: y - 10, size: 22, size1: 66, width: 3.5, squash: 0.9, pal: "white", add: true, life: 0.24 });
      spawnP({ shape: "star", x, y: y - 10, size: 22, size1: 4, pal: "sun", add: true, life: 0.22 });
    },

    clash({ x, y }) {
      spawnP({ shape: "star", x, y, size: 28, size1: 4, pal: "white", add: true, life: 0.22 });
      spawnP({ shape: "ring", x, y, size: 12, size1: 58, width: 4, squash: 0.85, pal: "thunder", add: true, life: 0.22 });
      emitElementBurst({ x, y, palKey: "spark", scale: 1.1, heavy: true });
      holdMs = Math.max(holdMs, 50);
      stats.clashes++;
      return true;
    },

    surfWave({ follow, angle = 0, moveId = "surfRush" }) {
      if (typeof follow !== "function") return false;
      const pos = follow();
      if (!pos) return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      emitFluidStream({ x: pos.x, y: pos.y + 4, angle, palKey: pk, range: 220, puffs: 10 });
      stats.releases++;
      return true;
    },

    vortex({ x, y, moveId = "vortex", radius = 118, paletteKey = null }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(paletteKey || spec.paletteKey || "wind");
      const r = clamp(radius, 52, 135);
      // Clean layered spinning tornado rings + swirling streaks (ZERO opaque blob!)
      for (let i = 0; i < 4; i++) {
        const yOff = -i * 14;
        spawnP({
          shape: "ring", layer: i === 0 ? "ground" : "top",
          x, y: y + yOff, size: r * (0.28 + i * 0.14), size1: r * (0.58 + i * 0.14),
          width: 2.6, squash: 0.42, pal: pk, add: true, life: 0.45 + i * 0.08
        });
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        spawnP({
          shape: pk === "wood" ? "rose" : "streak",
          x: x + Math.cos(a) * r * 0.55, y: y + Math.sin(a) * r * 0.3,
          vx: -Math.sin(a) * 190, vy: Math.cos(a) * 90 - 70,
          size: 5, size1: 1.5, pal: pk, add: true, life: 0.42
        });
      }
      stats.releases++;
      return true;
    },

    wallShatter({ x, y, angle = 0, material = "STONE" }) {
      const pk = COVER_PALETTE_KEY[String(material ?? "STONE").toUpperCase()] ?? "earth";
      spawnP({ shape: "star", x, y, size: 22, size1: 4, pal: "white", add: true, life: 0.18 });
      for (let i = 0; i < 12; i++) {
        const a = angle + (rand() - 0.5) * 1.4;
        const spd = 160 + rand() * 220;
        spawnP({
          shape: "shard", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.8,
          vz: 110 + rand() * 120, gravity: 420, size: 6 + rand() * 5, size1: 2,
          rot: a, vrot: (rand() - 0.5) * 14, pal: pk, add: false, life: 0.45
        });
      }
      holdMs = Math.max(holdMs, 56);
      stats.props++;
      return true;
    },

    surfaceBurst({ x, y, radius = 100, paletteKey = "fire", kind = "POISON_IGNITE" }) {
      const pk = kind.includes("FREEZE") || kind.includes("FROST") ? "ice"
        : kind.includes("ELECTR") || kind.includes("CONDUCT") ? "thunder"
        : normalizePalKey(paletteKey);
      spawnP({ shape: "ring", layer: "ground", x, y: y + 6, size: 16, size1: radius * 0.95, width: 3.5, squash: 0.62, pal: pk, add: true, life: 0.32 });
      emitElementBurst({ x, y, palKey: pk, scale: clamp(radius / 85, 0.9, 1.5), heavy: true });
      if (kind.includes("IGNITE") || kind.includes("ECLIPSE")) holdMs = Math.max(holdMs, 52);
      stats.hits++;
      return true;
    },

    groundSpike({ x, y, moveId = "shardVolley", scale = 1.0 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "earth");
      // Faceted 8-vertex spire (PB Ranked hh()) + rising shards!
      addSpire({ x, y: y + 2, radius: clamp(18 * scale, 14, 28), pal: pk, life: 0.52 });
      spawnP({ shape: "ring", layer: "ground", x, y: y + 6, size: 8, size1: 28 * scale, width: 2.2, squash: 0.55, pal: pk, add: true, life: 0.24 });
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU;
        spawnP({ shape: "shard", x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 55, vz: 140 + rand() * 90, gravity: 440, size: 5, size1: 1.5, pal: pk, add: false, life: 0.34 });
      }
      stats.releases++;
      return true;
    },

    burrowMound({ follow, moveId = "own-63" }) {
      if (typeof follow !== "function") return false;
      const pos = follow();
      if (!pos) return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "earth");
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU;
        spawnP({ shape: i % 2 === 0 ? "pxpuff" : "shard", x: pos.x + Math.cos(a) * 14, y: pos.y + 4, vx: Math.cos(a) * 65, vy: Math.sin(a) * 40, vz: 95 + rand() * 60, gravity: 380, size: 7, size1: 3, pal: pk === "ice" ? "ice" : "dust", add: false, life: 0.36 });
      }
      addDecal({ x: pos.x, y: pos.y + 6, kind: "crack", radius: 24, pal: pk });
      stats.releases++;
      return true;
    },

    craterShockwave({ x, y, moveId = "quakeSlam", radius = 140 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "earth");
      // PB Ranked Earthquake: radiating ground cracks + expanding shockwave rings + faceted flying rocks!
      addDecal({ x, y: y + 8, kind: "crack", radius: Math.min(64, radius * 0.45), pal: pk, life: 4.0 });
      spawnP({ shape: "ring", layer: "ground", x, y: y + 8, size: 18, size1: radius * 0.92, width: 4.2, squash: 0.58, pal: pk, add: true, life: 0.34 });
      spawnP({ shape: "ring", layer: "ground", x, y: y + 8, size: 12, size1: radius * 0.62, width: 2.4, squash: 0.58, pal: "white", add: true, life: 0.24 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + rand() * 0.5;
        addSpire({ x: x + Math.cos(a) * 34, y: y + 6 + Math.sin(a) * 20, radius: 13 + rand() * 6, pal: pk, life: 0.44, delay: i * 0.03 });
      }
      emitElementBurst({ x, y, palKey: pk, scale: 1.15, heavy: true });
      stats.hits++;
      return true;
    },

    meteorDrop({ x, y, moveId = "flameRing", radius = 110 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "fire");
      if (pk === "thunder") {
        addLightning(x + (rand() - 0.5) * 20, y - 240, x, y, "thunder", 5.5, 0.32);
        addLightning(x + (rand() - 0.5) * 35, y - 220, x + 12, y + 4, "thunder", 3.0, 0.26);
      } else {
        // Falling blazing meteor streaks from sky!
        for (let i = 0; i < 8; i++) {
          spawnP({ shape: i < 3 ? "pxpuff" : "streak", x: x - 45 + i * 6, y: y - 180 + i * 22, vx: 110, vy: 420, drag: 0.96, size: 9, size1: 4, pal: pk, add: i >= 3, life: 0.32 });
        }
      }
      spawnP({ shape: "ring", layer: "ground", x, y: y + 8, size: 14, size1: radius * 0.88, width: 3.4, squash: 0.6, pal: pk, add: true, life: 0.34 });
      addDecal({ x, y: y + 8, kind: pk === "ice" ? "frost" : "crack", radius: Math.min(48, radius * 0.42), pal: pk });
      stats.releases++;
      return true;
    },

    psychicCage({ x, y, moveId = "nightPulse", mode = "telekinesis", radius = 100 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "moon");
      const r = clamp(radius * 0.72, 38, 86);
      spawnP({ shape: "ring", layer: "ground", x, y: y + 8, size: r * 0.4, size1: r, width: 3, squash: 0.62, pal: pk, add: true, life: 0.42 });
      spawnP({ shape: "ring", x, y: y - 12, size: r * 0.85, size1: r * 0.3, width: 2.4, squash: 0.65, pal: "white", add: true, life: 0.36 });
      if (mode === "cage" && (pk === "ice" || pk === "earth" || pk === "wood")) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          addSpire({ x: x + Math.cos(a) * r * 0.55, y: y + Math.sin(a) * r * 0.36, radius: 15, pal: pk, life: 0.62 });
        }
      } else {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          spawnP({ shape: "star", x: x + Math.cos(a) * r * 0.5, y: y - 8 + Math.sin(a) * r * 0.35, vx: 0, vy: -45, size: 6, size1: 1.5, pal: pk, add: true, life: 0.42 });
        }
      }
      stats.releases++;
      return true;
    },

    scorchTrench({ x1, y1, x2, y2, moveId }) {
      if (reducedMotion) return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      if (pk === "water") return false;
      for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        addDecal({ x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f, kind: pk === "ice" ? "frost" : "scorch", radius: 22, pal: pk, life: 3.0 });
      }
      return true;
    },

    coneStorm({ x, y, angle = 0, range = 280, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      emitFluidStream({ x, y, angle, palKey: pk, range, puffs: 14 });
      return true;
    },

    prop({ x, y, material = "STONE", broken = false, weak = false }) {
      const pk = COVER_PALETTE_KEY[String(material ?? "STONE").toUpperCase()] ?? "earth";
      const n = broken ? 12 : weak ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU;
        spawnP({ shape: i % 2 === 0 ? "shard" : "pxpuff", x, y: y - 14, vx: Math.cos(a) * (80 + rand() * 140), vy: Math.sin(a) * 70, vz: 100 + rand() * 120, gravity: 420, size: broken ? 7 : 4.5, size1: 1.5, pal: pk, add: false, life: 0.40 });
      }
      if (broken) holdMs = Math.max(holdMs, 42);
      stats.props++;
      return true;
    },

    eventRing({ x, y, radius = 60, tint = 0xffffff }) {
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - lastRingAt < 180) return true;
      lastRingAt = now;
      const r = (tint >> 16) & 255, g = (tint >> 8) & 255, b = tint & 255;
      spawnP({
        shape: "ring", layer: "ground", x, y: y + 8,
        size: 10, size1: Math.min(95, radius), width: 2.6, squash: 0.62,
        stops: [[0, [255, 255, 255], 0.9], [0.45, [r, g, b], 0.72], [1, [r, g, b], 0]],
        add: true, life: 0.28
      });
      return true;
    },

    drawsShots: () => true,

    /** Low-alpha soft ground surfaces + subtle rising ambient particles (ZERO flat opaque pizzas!). */
    syncPuddles(puddles = []) {
      const seen = new Set();
      for (const p of puddles) {
        if (!p || p.done) continue;
        seen.add(p.id);
        const cfg = PUDDLE_CONFIG[p.kind] ?? PUDDLE_CONFIG.WATER_PUDDLE;
        let entry = livePuddles.get(p.id);
        if (!entry || entry.kind !== p.kind) {
          entry = { id: p.id, kind: p.kind, x: p.x, y: p.y + 6, radius: p.radius, ttl: p.ttl ?? 3, cfg, tick: rand() * 0.25 };
          livePuddles.set(p.id, entry);
        } else {
          entry.x = p.x; entry.y = p.y + 6; entry.radius = p.radius; entry.ttl = p.ttl ?? 1;
        }
      }
      for (const id of livePuddles.keys()) {
        if (!seen.has(id)) livePuddles.delete(id);
      }
    },

    update(dtMs) {
      const dt = Math.min(0.1, (dtMs || 0) / 1000);
      if (holdMs > 0) holdMs = Math.max(0, holdMs - (dtMs || 0));
      const stepDt = holdMs > 0 ? 0 : dt;

      // 1) Update decals (always age out even in headless mocks without PIXI.Graphics)
      if (decalsGfx) decalsGfx.clear();
      for (let i = decals.length - 1; i >= 0; i--) {
        const d = decals[i];
        d.age += dt;
        if (d.age >= d.life) { decals.splice(i, 1); continue; }
        if (decalsGfx) drawDecal(decalsGfx, d);
      }

      // 2) Update puddles & telegraphs & ground particles on groundGfx
      if (groundGfx) {
        groundGfx.clear();
        for (const entry of livePuddles.values()) {
          const fade = clamp((entry.ttl ?? 1) / 1.2, 0.12, 1);
          const hex = paletteHex(entry.cfg.pal);
          const rx = entry.radius * 0.96, ry = entry.radius * 0.56;
          if (typeof groundGfx.ellipse === "function") {
            groundGfx.ellipse(entry.x, entry.y, rx, ry).fill({ color: hex.main, alpha: entry.cfg.alpha * 0.45 * fade });
            groundGfx.ellipse(entry.x, entry.y, rx * 0.72, ry * 0.72).fill({ color: hex.core, alpha: entry.cfg.alpha * 0.35 * fade });
            groundGfx.ellipse(entry.x, entry.y, rx, ry).stroke({ color: hex.core, width: 1.4, alpha: entry.cfg.alpha * 0.55 * fade });
          } else {
            groundGfx.circle(entry.x, entry.y, rx * 0.8).fill({ color: hex.main, alpha: entry.cfg.alpha * 0.45 * fade });
          }
          entry.tick += stepDt;
          if (!reducedMotion && entry.tick >= entry.cfg.rate) {
            entry.tick = 0;
            const a = rand() * TAU;
            const d = rand() * entry.radius * 0.65;
            spawnP({
              shape: entry.cfg.ambient,
              x: entry.x + Math.cos(a) * d, y: entry.y + Math.sin(a) * d * 0.55,
              vx: (rand() - 0.5) * 16, vy: -28 - rand() * 32,
              size: entry.cfg.ambient === "pxpuff" ? 5 : 3.5, size1: 1.5,
              pal: entry.cfg.pal, add: entry.cfg.pal === "fire" || entry.cfg.pal === "thunder",
              alphaMul: 0.75, life: 0.38
            });
          }
        }
        for (let i = telegraphs.length - 1; i >= 0; i--) {
          const tg = telegraphs[i];
          tg.age += dt;
          if (tg.age >= tg.life) { telegraphs.splice(i, 1); continue; }
          const k = clamp(tg.age / tg.life, 0, 1);
          const a = (1 - k * 0.35) * 0.65;
          if (tg.shape === "rect") {
            const len = Math.min(tg.range, 560);
            const hw = Math.max(14, tg.radius * 0.55);
            const c = Math.cos(tg.angle), s = Math.sin(tg.angle), nx = -s * hw, ny = c * hw;
            const ex = tg.x + c * len, ey = tg.y + s * len;
            if (typeof groundGfx.poly === "function") {
              groundGfx.poly([tg.x + nx, tg.y + ny, ex + nx, ey + ny, ex - nx, ey - ny, tg.x - nx, tg.y - ny])
                .fill({ color: tg.color, alpha: 0.14 * a })
                .stroke({ color: tg.core, width: 1.6, alpha: 0.62 * a });
            }
          } else {
            const r = Math.min(180, tg.radius);
            if (typeof groundGfx.ellipse === "function") {
              groundGfx.ellipse(tg.x, tg.y, r, r * 0.62).fill({ color: tg.color, alpha: 0.12 * a }).stroke({ color: tg.core, width: 1.8, alpha: 0.65 * a });
              groundGfx.ellipse(tg.x, tg.y, r * k, r * 0.62 * k).stroke({ color: tg.core, width: 1.2, alpha: 0.42 * a });
            } else {
              groundGfx.circle(tg.x, tg.y, r).stroke({ color: tg.core, width: 1.8, alpha: 0.65 * a });
            }
          }
        }
      }

      // 3) Update depth layer (faceted rock/ice spires + hex shields)
      if (depthGfx) {
        depthGfx.clear();
        for (let i = spires.length - 1; i >= 0; i--) {
          const sp = spires[i];
          sp.age += stepDt;
          if (sp.age < 0) continue;
          if (sp.age >= sp.life) { spires.splice(i, 1); continue; }
          const k = sp.age / sp.life;
          const rise = k < 0.2 ? k / 0.2 : 1;
          const alpha = k > 0.72 ? clamp((1 - k) / 0.28, 0, 1) : 1;
          drawFacetedSpire(depthGfx, sp.x, sp.y - rise * sp.radius * 0.35, sp.radius * (0.4 + 0.6 * rise), sp.rot, sp.seed, sp.pal, alpha);
        }
        for (let i = shields.length - 1; i >= 0; i--) {
          const sh = shields[i];
          sh.age += dt;
          if (sh.age >= sh.life) { shields.splice(i, 1); continue; }
          const k = sh.age / sh.life;
          const a = (1 - k * 0.65) * 0.78;
          depthGfx.circle(sh.x, sh.y, sh.radius).fill({ color: sh.color, alpha: 0.16 * a }).stroke({ color: sh.core, width: 2.2, alpha: a });
          // Inner crisp hexagon
          if (typeof depthGfx.poly === "function") {
            const hexPts = [];
            for (let s = 0; s < 6; s++) {
              const ang = sh.age * 2.2 + (s / 6) * TAU;
              hexPts.push(sh.x + Math.cos(ang) * sh.radius * 0.72, sh.y + Math.sin(ang) * sh.radius * 0.72);
            }
            depthGfx.poly(hexPts).stroke({ color: sh.core, width: 1.4, alpha: 0.65 * a });
          }
        }
      }

      // 4) Update procedural projectiles + emit fluid particle trails
      for (let i = liveShots.length - 1; i >= 0; i--) {
        const s = liveShots[i];
        s.age += stepDt;
        const pos = s.age <= s.maxAge ? s.follow() : null;
        if (!pos) { liveShots.splice(i, 1); continue; }
        if (s.prevX !== null && Math.hypot(pos.x - s.prevX, pos.y - s.prevY) > 0.5) {
          s.angle = Math.atan2(pos.y - s.prevY, pos.x - s.prevX);
        }
        s.prevX = pos.x; s.prevY = pos.y;
        s.trailAcc += stepDt;
        const emitInterval = s.arch === "DRAG_WAVE" ? 0.025 : 0.032;
        if (!reducedMotion && s.trailAcc >= emitInterval) {
          s.trailAcc = 0;
          const trailShape = (s.palKey === "fire" || s.palKey === "water" || s.arch === "DRAG_WAVE") ? "pxpuff"
            : s.palKey === "ice" || s.palKey === "wood" ? "shard"
            : s.palKey === "thunder" ? "streak" : "px";
          spawnP({
            shape: trailShape,
            x: pos.x - Math.cos(s.angle) * 6 + (rand() - 0.5) * 6,
            y: pos.y - Math.sin(s.angle) * 6 + (rand() - 0.5) * 6,
            vx: -Math.cos(s.angle) * 35 + (rand() - 0.5) * 28,
            vy: -Math.sin(s.angle) * 35 + (rand() - 0.5) * 28,
            size: s.radius * (trailShape === "pxpuff" ? 0.68 : 0.42),
            size1: 1.2,
            rot: s.angle,
            stops: s.stops,
            add: trailShape !== "pxpuff",
            alphaMul: 0.85,
            life: 0.18 + rand() * 0.12
          });
        }
      }

      // 5) Draw all particles + live projectile heads + lightning on topGfx / topAddGfx
      if (topGfx) topGfx.clear();
      if (topAddGfx) topAddGfx.clear();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += stepDt;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        const dragPow = Math.pow(p.drag, stepDt * 60);
        p.vx *= dragPow;
        p.vy *= dragPow;
        p.vz -= p.gravity * stepDt;
        p.x += p.vx * stepDt;
        p.y += p.vy * stepDt;
        p.z = Math.max(0, p.z + p.vz * stepDt);
        if (p.z === 0 && p.vz < -20) p.vz = Math.abs(p.vz) * 0.28;
        p.rot += p.vrot * stepDt;
        const targetGfx = p.layer === "ground" ? groundGfx : (p.add ? topAddGfx : topGfx);
        if (targetGfx) drawParticle(targetGfx, p);
      }

      // Render crisp procedural projectile heads right on topGfx / topAddGfx
      for (const s of liveShots) {
        if (s.prevX === null) continue;
        const col = sampleStops(s.stops, 0.22);
        if (topAddGfx) {
          topAddGfx.circle(s.prevX, s.prevY, s.radius * 1.45).fill({ color: col.hex, alpha: 0.28 });
        }
        if (topGfx) {
          if (s.headShape === "pxpuff") {
            drawPixelPuff(topGfx, s.prevX, s.prevY, s.radius, col.r, col.g, col.b, 0.96);
          } else if (s.headShape === "pxball") {
            drawPixelBall(topGfx, s.prevX, s.prevY, s.radius, col.hex, 0.98);
            drawPixelBall(topGfx, s.prevX - s.radius * 0.2, s.prevY - s.radius * 0.2, s.radius * 0.48, 0xffffff, 0.96);
          } else {
            drawParticle(topAddGfx ?? topGfx, {
              shape: s.headShape, x: s.prevX, y: s.prevY, z: 0,
              vx: Math.cos(s.angle) * 100, vy: Math.sin(s.angle) * 100, vz: 0,
              size: s.radius, size1: s.radius, rot: s.angle + (s.headShape === "star" ? s.age * 10 : 0),
              width: 3.4, squash: 0.8, stretch: 2, stops: s.stops, alphaMul: 1, age: 0, life: 1
            });
          }
        }
      }

      // Draw jagged lightning bolts on topAddGfx
      if (topAddGfx) {
        for (let i = lightningBolts.length - 1; i >= 0; i--) {
          const b = lightningBolts[i];
          b.age += dt;
          if (b.age >= b.life) { lightningBolts.splice(i, 1); continue; }
          const a = clamp(1 - b.age / b.life, 0, 1);
          drawJaggedBolt(topAddGfx, b.x0, b.y0, b.x1, b.y1, b.width, b.main, b.core, a, b.seed + Math.floor(b.age * 40));
        }
      }

      // 6) Draw tapered beam conduits on beamConduitGfx
      if (beamConduitGfx) {
        beamConduitGfx.clear();
        for (let i = beamConduits.length - 1; i >= 0; i--) {
          const bc = beamConduits[i];
          bc.age += dt;
          const endPt = bc.followEnd();
          if (endPt) {
            bc.lastX = endPt.x;
            bc.lastY = endPt.y;
            const startPt = bc.followStart(endPt);
            if (startPt) { bc.originX = startPt.x; bc.originY = startPt.y; }
          } else if (bc.detachedAt === null) {
            bc.detachedAt = bc.age;
          }
          const fadeOut = bc.detachedAt !== null ? Math.max(0, 1 - (bc.age - bc.detachedAt) / 0.16) : 1;
          const lifeFade = Math.max(0, 1 - bc.age / bc.maxAge);
          const alpha = Math.min(fadeOut, lifeFade * 2.2);
          if (bc.age >= bc.maxAge || alpha <= 0.02) {
            beamConduits.splice(i, 1);
            continue;
          }
          const dx = bc.lastX - bc.originX, dy = bc.lastY - bc.originY;
          const dist = Math.hypot(dx, dy);
          if (dist < 14) continue;
          const nx = -dy / dist, ny = dx / dist;
          const pulse = 0.85 + 0.22 * Math.sin(bc.age * 42 + i * 1.7);
          const wOuter = bc.width * pulse * (0.45 + 0.55 * alpha);
          const wCore = Math.max(3, wOuter * 0.42);
          if (bc.palKey === "thunder") {
            drawJaggedBolt(beamConduitGfx, bc.originX, bc.originY, bc.lastX, bc.lastY, wCore, bc.main, bc.core, alpha, i * 11 + Math.floor(bc.age * 35));
          } else {
            beamConduitGfx.moveTo(bc.originX, bc.originY).lineTo(bc.lastX, bc.lastY)
              .stroke({ color: bc.main, width: wOuter, alpha: 0.48 * alpha, cap: "round" });
            const segs = Math.min(10, Math.max(4, Math.floor(dist / 42)));
            beamConduitGfx.moveTo(bc.originX, bc.originY);
            for (let s = 1; s < segs; s++) {
              const f = s / segs;
              const wave = Math.sin(f * Math.PI * 3 - bc.age * 36 + i) * (wCore * 0.62);
              beamConduitGfx.lineTo(bc.originX + dx * f + nx * wave, bc.originY + dy * f + ny * wave);
            }
            beamConduitGfx.lineTo(bc.lastX, bc.lastY)
              .stroke({ color: bc.core, width: wCore, alpha: 0.94 * alpha, cap: "round", join: "round" });
          }
          beamConduitGfx.circle(bc.originX, bc.originY, wOuter * 0.58).fill({ color: bc.main, alpha: 0.55 * alpha });
          beamConduitGfx.circle(bc.originX, bc.originY, wCore * 0.72).fill({ color: bc.core, alpha: 0.92 * alpha });
        }
      }
    },

    holding: () => holdMs > 0,

    getDiagnostics: () => Object.freeze({
      ...stats,
      particles: particles.length,
      decals: decals.length,
      scars: decals.length,
      spires: spires.length,
      liveShots: liveShots.length,
      beamConduits: beamConduits.length
    }),

    dispose() {
      particles.length = 0;
      decals.length = 0;
      spires.length = 0;
      lightningBolts.length = 0;
      liveShots.length = 0;
      livePuddles.clear();
      beamConduits.length = 0;
      telegraphs.length = 0;
      shields.length = 0;
      decalsGfx?.destroy();
      groundGfx?.destroy();
      depthGfx?.destroy();
      topGfx?.destroy();
      topAddGfx?.destroy();
      beamConduitGfx?.destroy();
    }
  });
}
