// Data Arena V2 Unified PB-Rank Hero Procedural Pixel-Art VFX Engine (Wave 9, 2026-11-25).
//
// 100% Original Volumetric Procedural Pixel-Art VFX Architecture (Zero Wireframe Ring-Spam,
// Zero Blocky Square Clip-Boxes, Zero Muddy Dark Outlines, Zero shadowBlur, Locked 60 FPS):
//  - 6-Layer GPU Draw Pipeline:
//      1. decalsGfx      (ground) : radiating ground cracks, frost filigree, subtle scorch speckles
//      2. groundGfx      (ground) : organic multi-lobe puddles, subtle corner-bracket drop reticles
//      3. depthGfx       (front)  : 3D faceted rock/ice spires (hh), hexagonal shields, hero ground volume
//      4. topGfx / topAddGfx      : 16 Hero Volumetric Renderers (HERO_METEOR, HERO_VORTEX, HERO_SLASH,
//                                   HERO_SHOCKWAVE, HERO_PILLAR_AURA, HERO_CAGE + 10-Element Projectiles
//                                   + massive DRAG_WAVE crests + 12 procedural pixel particle shapes)
//      5. beamConduitGfx (add)    : thick 4-pass animated plasma ribbons + triple braided lightning (x1)
//  - 10 Canonical Element Multi-Stop RGBA Palettes (METAL, WOOD, EARTH, WATER, FIRE, SUN, ICE,
//    WIND, THUNDER, MOON) covering all 324 PB-Rank moves across all 20 combat archetypes.
//  - Presentation only: zero simulation, timing, damage, or RNG authority side effects.

import { BATTLE_FX_PALETTES } from "../battleFx/battleFxPalettes.js";
import { resolveMoveSpecV2 } from "../../modes/dataArena/dataArenaMoveCatalogV2.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Multi-stop RGBA palettes [t, [r,g,b], alpha] across all 10 Canonical Elements + utility looks
export const PB_PARTICLE_PALETTES = Object.freeze({
  // white-hot -> warm -> grey smoke (Slynyrd explosion ramp; no muddy red-brown tail, 2026-11-26)
  fire:     [[0, [255, 255, 232], 1], [0.22, [255, 224, 92], 0.98], [0.5, [255, 112, 28], 0.88], [0.74, [176, 96, 74], 0.42], [1, [120, 116, 120], 0]],
  blueFire: [[0, [245, 255, 255], 1], [0.26, [130, 236, 255], 0.96], [0.60, [48, 138, 255], 0.86], [1, [24, 48, 148], 0]],
  water:    [[0, [242, 253, 255], 1], [0.28, [118, 226, 255], 0.94], [0.66, [34, 132, 238], 0.78], [1, [16, 62, 158], 0]],
  ice:      [[0, [255, 255, 255], 1], [0.28, [202, 248, 255], 0.96], [0.66, [98, 206, 250], 0.82], [1, [44, 124, 198], 0]],
  thunder:  [[0, [255, 255, 246], 1], [0.28, [255, 242, 102], 0.98], [0.66, [255, 184, 22], 0.84], [1, [186, 94, 12], 0]],
  wind:     [[0, [250, 255, 252], 0.98], [0.32, [172, 248, 232], 0.88], [0.72, [88, 204, 196], 0.52], [1, [64, 144, 150], 0]],
  wood:     [[0, [242, 255, 210], 1], [0.30, [134, 238, 98], 0.95], [0.68, [44, 178, 68], 0.80], [1, [20, 96, 38], 0]],
  nature:   [[0, [242, 255, 210], 1], [0.30, [134, 238, 98], 0.95], [0.68, [44, 178, 68], 0.80], [1, [20, 96, 38], 0]],
  earth:    [[0, [255, 238, 192], 0.98], [0.30, [220, 168, 98], 0.92], [0.68, [152, 102, 54], 0.78], [1, [82, 52, 32], 0]],
  metal:    [[0, [255, 255, 255], 1], [0.28, [218, 232, 246], 0.96], [0.66, [136, 158, 182], 0.80], [1, [64, 78, 98], 0]],
  sun:      [[0, [255, 255, 255], 1], [0.28, [255, 246, 168], 0.98], [0.66, [255, 198, 64], 0.82], [1, [218, 120, 20], 0]],
  light:    [[0, [255, 255, 255], 1], [0.28, [255, 246, 168], 0.98], [0.66, [255, 198, 64], 0.82], [1, [218, 120, 20], 0]],
  moon:     [[0, [252, 222, 255], 1], [0.28, [198, 102, 255], 0.94], [0.66, [112, 40, 198], 0.78], [1, [38, 14, 84], 0]],
  dark:     [[0, [248, 210, 255], 0.98], [0.28, [168, 76, 240], 0.92], [0.66, [84, 28, 156], 0.78], [1, [28, 12, 56], 0]],
  poison:   [[0, [240, 212, 255], 0.98], [0.28, [188, 78, 242], 0.92], [0.66, [118, 32, 168], 0.76], [1, [50, 14, 80], 0]],
  toxic:    [[0, [240, 212, 255], 0.98], [0.28, [188, 78, 242], 0.92], [0.66, [118, 32, 168], 0.76], [1, [50, 14, 80], 0]],
  psychic:  [[0, [255, 234, 252], 1], [0.28, [255, 124, 218], 0.96], [0.66, [186, 58, 216], 0.80], [1, [86, 22, 126], 0]],
  dragon:   [[0, [255, 242, 224], 1], [0.26, [255, 132, 82], 0.96], [0.62, [176, 58, 228], 0.84], [1, [64, 22, 116], 0]],
  rose:     [[0, [255, 246, 250], 1], [0.34, [255, 162, 206], 0.95], [0.70, [238, 84, 150], 0.78], [1, [164, 36, 90], 0]],
  dust:     [[0, [240, 224, 194], 0.82], [0.45, [198, 176, 138], 0.58], [1, [138, 118, 92], 0]],
  smoke:    [[0, [216, 220, 228], 0.62], [0.5, [146, 152, 164], 0.38], [1, [84, 88, 98], 0]],
  spark:    [[0, [255, 255, 255], 1], [0.34, [255, 238, 128], 0.96], [0.74, [255, 152, 42], 0.68], [1, [200, 78, 18], 0]],
  white:    [[0, [255, 255, 255], 1], [0.5, [232, 242, 255], 0.82], [1, [168, 196, 236], 0]],
  neutral:  [[0, [255, 255, 255], 1], [0.34, [226, 236, 248], 0.92], [0.74, [160, 176, 198], 0.64], [1, [92, 104, 122], 0]]
});

const ROCK_PALETTES = Object.freeze({
  earth:   [0x3d2817, 0x7a5634, 0xaa7f52, 0xd9b584, 0xfff0d4],
  ice:     [0x1f5378, 0x4b93bf, 0x8ad6f5, 0xcff2ff, 0xffffff],
  metal:   [0x2a3440, 0x5c6b7c, 0x9aa8b8, 0xd4dfe8, 0xffffff],
  wood:    [0x1c3d1e, 0x357538, 0x62b552, 0xa8e882, 0xe8ffd0],
  dark:    [0x1d1033, 0x452072, 0x7b3ec4, 0xc084fc, 0xf3e8ff],
  moon:    [0x1d1033, 0x452072, 0x7b3ec4, 0xc084fc, 0xf3e8ff],
  fire:    [0x3a140e, 0x8a2c14, 0xde5b1e, 0xffaa44, 0xfff2c2],
  sun:     [0x6b3a08, 0xc27812, 0xf5b92a, 0xffe67a, 0xffffff],
  water:   [0x0f3266, 0x1d68b8, 0x4fb8f5, 0xa6e8ff, 0xffffff],
  wind:    [0x1a4d54, 0x3c9196, 0x7bd8d2, 0xc4f8f0, 0xffffff],
  thunder: [0x5c3608, 0xc4820c, 0xf7c928, 0xfff07c, 0xffffff]
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
  if (k === "storm" || k === "electric" || k === "elec") return "thunder";
  if (k === "shadow" || k === "ghost") return "moon";
  if (k === "physical" || k === "steel" || k === "fighting" || k === "fight") return "metal";
  if (k === "grass" || k === "bug" || k === "leaf") return "wood";
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

function rockPalFor(key) {
  return ROCK_PALETTES[normalizePalKey(key)] ?? ROCK_PALETTES.earth;
}

// Rasterize crisp 1px-2px scanline pixel circle (PB Ranked `pxball` — zero blurry blobs!)
function drawPixelBall(gfx, cx, cy, radius, color, alpha) {
  if (!gfx || alpha <= 0.015 || radius < 0.7) return;
  const r = Math.min(34, radius);
  const rx = Math.round(cx), ry = Math.round(cy);
  const step = r > 14 ? 2 : 1;
  const lim = Math.ceil(r);
  for (let dy = -lim; dy <= lim; dy += step) {
    const span = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (span < 0.5) continue;
    const w = Math.max(1, Math.round(span * 2));
    gfx.rect(Math.round(rx - span), ry + dy, w, step).fill({ color, alpha });
  }
}

// 3-pass shaded pixel cloud (PB Ranked `pxpuff`: dark underside -> rich body -> sunlit top highlight!)
function drawPixelPuff(gfx, cx, cy, radius, r, g, b, alpha) {
  if (!gfx || alpha <= 0.015 || radius < 1) return;
  const rad = Math.min(32, radius);
  const darkHex = rgbToHex(r * 0.52, g * 0.52, b * 0.52);
  const baseHex = rgbToHex(r, g, b);
  const hiHex = rgbToHex(r + (255 - r) * 0.54, g + (255 - g) * 0.54, b + (255 - b) * 0.54);
  drawPixelBall(gfx, cx + rad * 0.18, cy + rad * 0.22, rad, darkHex, alpha * 0.88);
  drawPixelBall(gfx, cx, cy, rad * 0.88, baseHex, alpha);
  drawPixelBall(gfx, cx - rad * 0.24, cy - rad * 0.28, rad * 0.50, hiHex, alpha * 0.94);
}

// Faceted 8-vertex procedural rock/ice/magma spire (PB Ranked `hh()`)
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
    gfx.poly(flatPoly(pts.map(([x, y]) => [cx + (x - cx) * 1.18 + 3, cy + (y - cy) * 1.12 + 5]))).fill({ color: 0x090b14, alpha: 0.34 * alpha });
    gfx.poly(flatPoly(pts)).fill({ color: pal[2], alpha });
    gfx.poly(flatPoly(pts.map(([x, y]) => [x + (cx + radius * 0.32 - x) * 0.45, y + (cy + radius * 0.32 - y) * 0.45]))).fill({ color: pal[1], alpha: 0.88 * alpha });
    gfx.poly(flatPoly(pts.map(([x, y]) => [x + (cx - radius * 0.28 - x) * 0.5, y + (cy - radius * 0.3 - y) * 0.5]))).fill({ color: pal[3], alpha: 0.92 * alpha });
  } else {
    gfx.circle(cx, cy, radius).fill({ color: pal[2], alpha });
  }
  gfx.circle(cx - radius * 0.32, cy - radius * 0.34, Math.max(1.5, radius * 0.16)).fill({ color: pal[4], alpha: 0.96 * alpha });
  gfx.moveTo(cx - radius * 0.12, cy - radius * 0.46).lineTo(cx + radius * 0.08, cy - radius * 0.04).lineTo(cx - radius * 0.06, cy + radius * 0.36)
    .stroke({ color: pal[0], width: 1.5, alpha: 0.85 * alpha });
}

// Hero Primitive 1: Filled tapered anime pixel crescent blade/claw polygon (razor-sharp outer + white hot core!)
function drawFilledCrescent(gfx, cx, cy, radius, angle, span, thickness, mainHex, coreHex, alpha) {
  if (!gfx || alpha <= 0.02 || radius < 4) return;
  const segs = 12;
  const a0 = angle - span, a1 = angle + span;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const a = a0 + (a1 - a0) * f;
    const taper = Math.sin(Math.PI * f);
    const rOut = radius;
    const rIn = Math.max(2, radius - thickness * taper);
    outer.push(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut * 0.84);
    inner.unshift(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn * 0.84);
  }
  if (typeof gfx.poly === "function") {
    gfx.poly([...outer, ...inner]).fill({ color: mainHex, alpha: 0.88 * alpha });
    // Hot white-core inner razor blade
    const coreOuter = [], coreInner = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const a = a0 + (a1 - a0) * f;
      const taper = Math.sin(Math.PI * f);
      const rOut = radius - thickness * 0.12 * taper;
      const rIn = Math.max(2, radius - thickness * 0.56 * taper);
      coreOuter.push(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut * 0.84);
      coreInner.unshift(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn * 0.84);
    }
    gfx.poly([...coreOuter, ...coreInner]).fill({ color: coreHex, alpha: 0.96 * alpha });
  } else {
    gfx.moveTo(outer[0], outer[1]);
    for (let i = 2; i < outer.length; i += 2) gfx.lineTo(outer[i], outer[i + 1]);
    gfx.stroke({ color: mainHex, width: Math.max(2, thickness * 0.6), alpha, cap: "round" });
  }
}

// Hero Primitive 2: Faceted 3-tone crystal / icicle / chrome spearhead polygon
function drawCrystalSpear(gfx, cx, cy, length, width, angle, pal, alpha) {
  if (!gfx || alpha <= 0.02 || length < 4) return;
  const c = Math.cos(angle), s = Math.sin(angle);
  const nx = -s, ny = c;
  const tipX = cx + c * length * 0.62, tipY = cy + s * length * 0.62;
  const tailX = cx - c * length * 0.48, tailY = cy - s * length * 0.48;
  const leftX = cx + nx * width * 0.55 - c * length * 0.08, leftY = cy + ny * width * 0.55 - s * length * 0.08;
  const rightX = cx - nx * width * 0.55 - c * length * 0.08, rightY = cy - ny * width * 0.55 - s * length * 0.08;
  if (typeof gfx.poly === "function") {
    // Upper sunlit facet
    gfx.poly([tipX, tipY, leftX, leftY, tailX, tailY, cx, cy]).fill({ color: pal[3], alpha: 0.96 * alpha });
    // Lower shaded facet
    gfx.poly([tipX, tipY, cx, cy, tailX, tailY, rightX, rightY]).fill({ color: pal[1], alpha: 0.94 * alpha });
    // Crisp specular center spine
    gfx.moveTo(tailX, tailY).lineTo(tipX, tipY).stroke({ color: pal[4], width: Math.max(1.6, width * 0.16), alpha: 0.95 * alpha, cap: "round" });
    gfx.poly([tipX, tipY, leftX, leftY, tailX, tailY, rightX, rightY]).stroke({ color: pal[0], width: 1.1, alpha: 0.65 * alpha });
  } else {
    gfx.moveTo(tailX, tailY).lineTo(tipX, tipY).stroke({ color: pal[3], width: Math.max(2, width * 0.5), alpha, cap: "round" });
  }
}

// Hero Primitive 3: Wide curved crashing elemental wave crest (Surf / Heat Wave / Muddy Water / Blizzard)
function drawWaveCrest(gfx, addGfx, cx, cy, width, angle, stops, alpha, seed) {
  if (!gfx || alpha <= 0.02) return;
  const c = Math.cos(angle), s = Math.sin(angle);
  const nx = -s, ny = c;
  const count = 7;
  const colMid = sampleStops(stops, 0.42);
  const colBright = sampleStops(stops, 0.14);
  for (let i = 0; i < count; i++) {
    const f = (i / (count - 1)) * 2 - 1; // -1 .. +1
    const bow = (1 - f * f) * width * 0.24;
    const wx = cx + nx * (f * width * 0.48) + c * bow;
    const wy = cy + ny * (f * width * 0.48) + s * bow;
    const puffR = width * (0.19 - Math.abs(f) * 0.065);
    drawPixelPuff(gfx, wx - c * puffR * 0.45, wy - s * puffR * 0.45, puffR * 1.15, colMid.r, colMid.g, colMid.b, alpha * 0.92);
    drawPixelPuff(gfx, wx + c * puffR * 0.28, wy + s * puffR * 0.28, puffR * 0.72, colBright.r, colBright.g, colBright.b, alpha * 0.96);
  }
  // White foaming leading crest curve
  const foamGfx = addGfx ?? gfx;
  const foamPts = [];
  for (let i = 0; i <= 8; i++) {
    const f = (i / 8) * 2 - 1;
    const bow = (1 - f * f) * width * 0.29 + 6;
    const jitter = Math.sin(seed * 9 + i * 2.7) * 2.5;
    foamPts.push([
      cx + nx * (f * width * 0.50) + c * (bow + jitter),
      cy + ny * (f * width * 0.50) + s * (bow + jitter)
    ]);
  }
  foamGfx.moveTo(foamPts[0][0], foamPts[0][1]);
  for (let i = 1; i < foamPts.length; i++) foamGfx.lineTo(foamPts[i][0], foamPts[i][1]);
  foamGfx.stroke({ color: 0xffffff, width: Math.max(3, width * 0.07), alpha: 0.94 * alpha, cap: "round", join: "round" });
}

// Jagged branching lightning bolt (PB Ranked `x1()`)
function drawJaggedBolt(gfx, x0, y0, x1, y1, width, mainHex, coreHex, alpha, seed) {
  if (!gfx || alpha <= 0.02) return;
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
  if (dist < 6) return;
  const nx = -dy / dist, ny = dx / dist;
  const segs = clamp(Math.floor(dist / 24), 4, 14);
  const pts = [[x0, y0]];
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const j = Math.sin(seed * 19.3 + i * 7.1) * Math.min(26, dist * 0.13);
    pts.push([x0 + dx * f + nx * j, y0 + dy * f + ny * j]);
  }
  pts.push([x1, y1]);
  gfx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
  gfx.stroke({ color: mainHex, width: width * 2.5, alpha: 0.52 * alpha, cap: "round", join: "round" });
  gfx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
  gfx.stroke({ color: coreHex, width: Math.max(2, width), alpha: 0.98 * alpha, cap: "round", join: "round" });
}

// Hero Primitive 4: Thick 4-pass animated plasma / flame / hydro / shadow beam conduit
function drawBoltRibbon(gfx, x0, y0, x1, y1, width, mainHex, coreHex, alpha, time, seed) {
  if (!gfx || alpha <= 0.02) return;
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
  if (dist < 10) return;
  const nx = -dy / dist, ny = dx / dist;
  const segs = clamp(Math.floor(dist / 32), 6, 16);
  // Pass 1: Wide outer volumetric energy halo
  gfx.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: mainHex, width: width * 1.65, alpha: 0.34 * alpha, cap: "round" });
  // Pass 2: Saturated vibrant plasma tube
  gfx.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: mainHex, width: width * 0.95, alpha: 0.72 * alpha, cap: "round" });
  // Pass 3: Twin counter-phase braided sine energy ribbons
  for (const dir of [-1, 1]) {
    gfx.moveTo(x0, y0);
    for (let s = 1; s < segs; s++) {
      const f = s / segs;
      const amp = width * 0.44 * Math.sin(Math.PI * f);
      const wave = Math.sin(f * Math.PI * 4 - time * 38 + seed * 3 + (dir < 0 ? Math.PI : 0)) * amp * dir;
      gfx.lineTo(x0 + dx * f + nx * wave, y0 + dy * f + ny * wave);
    }
    gfx.lineTo(x1, y1).stroke({ color: coreHex, width: Math.max(2.6, width * 0.26), alpha: 0.88 * alpha, cap: "round", join: "round" });
  }
  // Pass 4: Blazing pure-white core laser spine
  gfx.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: 0xffffff, width: Math.max(3.2, width * 0.38), alpha: 0.96 * alpha, cap: "round" });
  // Starburst muzzle flare + intense impact flare at tip
  for (const [px, py, mul] of [[x0, y0, 0.82], [x1, y1, 1.05]]) {
    const r = width * mul;
    gfx.circle(px, py, r * 0.95).fill({ color: mainHex, alpha: 0.56 * alpha });
    gfx.circle(px, py, r * 0.52).fill({ color: 0xffffff, alpha: 0.95 * alpha });
    for (let k = 0; k < 4; k++) {
      const a = time * 6 + k * (Math.PI / 4) + seed;
      const arm = r * (k % 2 === 0 ? 1.5 : 0.95);
      gfx.moveTo(px - Math.cos(a) * arm, py - Math.sin(a) * arm)
        .lineTo(px + Math.cos(a) * arm, py + Math.sin(a) * arm)
        .stroke({ color: 0xffffff, width: Math.max(1.8, width * 0.14), alpha: 0.9 * alpha, cap: "round" });
    }
  }
}

export function createDataArenaPixelFxV2({ PIXI, ground, front, quality = "high", reducedMotion = false, ownsBurst = null }) {
  // ORIGINAL_MOVES_ARENA_20261126: when a move's own original cells draw its burst
  // (a mushroom's spores, a bomb's blast), this layer adds only the crisp flash,
  // spark needles and ground mark -- no cloud puffs piled over the original cells.
  const cellsOwnBurst = (moveId) => Boolean(moveId && typeof ownsBurst === "function" && ownsBurst(moveId));
  if (!PIXI || !front) return null;

  const MAX_PARTICLES = quality === "low" ? 210 : 420;
  const MAX_DECALS = quality === "low" ? 24 : 48;
  const MAX_SPIRES = quality === "low" ? 18 : 34;
  const MAX_LIGHTNING = 18;
  const MAX_HEROES = quality === "low" ? 10 : 20;

  const makeGfx = (parent, label, blend = null) => {
    if (!PIXI.Graphics) return null;
    const g = new PIXI.Graphics();
    g.label = label;
    if (blend) g.blendMode = blend;
    parent?.addChild?.(g);
    return g;
  };

  // 6-layer PB-Rank GPU draw stack
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
  const heroEffects = [];
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
    renderer: "pbrank-hero-volumetric-pixelfx",
    casts: 0, releases: 0, hits: 0, ults: 0, projectiles: 0, props: 0, clashes: 0, heroes: 0
  };

  function spawnP(p) {
    if (reducedMotion && particles.length >= 44) return;
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      layer: p.layer ?? "top",
      shape: p.shape ?? "px",
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

  function addHero(h) {
    if (reducedMotion && heroEffects.length >= 6) return;
    if (heroEffects.length >= MAX_HEROES) heroEffects.shift();
    heroEffects.push({
      age: 0,
      detonated: false,
      seed: rand() * 100,
      ...h
    });
    stats.heroes++;
  }

  function addDecal({ x, y, kind = "scorch", radius = 26, pal = "earth", life = 3.6 }) {
    if (reducedMotion) return;
    if (decals.length >= MAX_DECALS) decals.shift();
    decals.push({ x, y, kind, radius, pal: normalizePalKey(pal), seed: rand() * 99, age: 0, life });
  }

  function addSpire({ x, y, radius = 22, pal = "earth", life = 0.58, delay = 0 }) {
    if (spires.length >= MAX_SPIRES) spires.shift();
    spires.push({ x, y, radius, pal: rockPalFor(pal), rot: rand() * TAU, seed: rand() * 100, age: -delay, life });
  }

  function addLightning(x0, y0, x1, y1, palKey = "thunder", width = 3.6, life = 0.24) {
    if (lightningBolts.length >= MAX_LIGHTNING) lightningBolts.shift();
    const hex = paletteHex(palKey);
    lightningBolts.push({ x0, y0, x1, y1, main: hex.main, core: hex.core, width, age: 0, life, seed: rand() * 100 });
  }

  // PB Ranked 10-elemental volumetric hit-burst preset (ZERO empty wireframe rings!)
  let fxClock = 0, pendingUlt = null;
  function playPendingUlt(moveId, x, y) {
    if (!pendingUlt || pendingUlt.moveId !== moveId || fxClock - pendingUlt.at > 4) return;
    const { arch, pk, angle } = pendingUlt; pendingUlt = null;
    if (arch === "METEOR_RAIN") spawnHeroMeteor({ x, y, radius: 145, palKey: pk, count: pk === "water" ? 1 : 4 });
    else if (arch === "VORTEX_PULL") spawnHeroVortex({ x, y, radius: 135, palKey: pk, durationSec: 1.05 });
    else if (arch === "FLURRY_COMBO" || arch === "MULTI_DASH" || arch === "GUARD_BREAK_SLAM" || arch === "SHADOW_BACKSTAB") {
      emitCrescentSlash({ x, y, angle, palKey: pk, scale: 1.2, count: 3, style: "flurry" });
      spawnHeroShockwave({ x, y: y + 8, radius: 120, palKey: pk, spiresCount: 5 });
    } else if (arch !== "STREAM_BEAM") spawnHeroShockwave({ x, y: y + 8, radius: 130, palKey: pk, spiresCount: 6 });
  }
  function emitElementBurst({ x, y, palKey = "fire", scale = 1, angle = 0, heavy = false, crisp = false }) {
    const pk = normalizePalKey(palKey);
    const stops = paletteStops(pk);
    const count = Math.round((heavy ? (quality === "low" ? 12 : 22) : (quality === "low" ? 7 : 13)) * (crisp ? 0.55 : 1));

    // Hot white starburst + saturated volumetric flash core
    spawnP({ shape: "glow", x, y, size: 14 * scale, size1: 34 * scale, life: 0.18, pal: pk, add: true, alphaMul: 0.9 });
    spawnP({ shape: "star", x, y, size: (heavy ? 22 : 14) * scale, size1: 3 * scale, rot: rand() * TAU, life: 0.20, pal: "white", add: true });

    // Volumetric 3-pass shaded cloud punch at center (replaces wireframe ring!)
    if (!crisp && (pk === "fire" || pk === "blueFire" || pk === "water" || pk === "earth" || pk === "moon" || pk === "poison" || pk === "dragon")) {
      const puffs = heavy ? 5 : 3;
      for (let i = 0; i < puffs; i++) {
        const a = angle + (i / puffs) * TAU + rand() * 0.5;
        const spd = (45 + rand() * 95) * scale;
        spawnP({
          shape: "pxpuff", x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.72 - 18,
          drag: 0.86, size: (heavy ? 7 : 5) * scale, size1: (heavy ? 11 : 8) * scale,
          stops, add: false, alphaMul: 0.94, life: 0.26 + rand() * 0.16
        });
      }
    }

    if (pk === "thunder") {
      for (let i = 0; i < (heavy ? 4 : 2); i++) {
        const a = angle + (rand() - 0.5) * 2.8;
        const d = (34 + rand() * 48) * scale;
        addLightning(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, "thunder", heavy ? 3.8 : 2.6, 0.22);
      }
    }

    for (let i = 0; i < count; i++) {
      const spread = heavy ? TAU : 2.2;
      const a = angle + (rand() - 0.5) * spread;
      const spd = (120 + rand() * (heavy ? 260 : 180)) * scale;
      let shape = "px";
      let add = true;
      let size = (3.5 + rand() * 4) * scale;
      let size1 = 0.8;
      if (pk === "fire" || pk === "blueFire" || pk === "dragon") {
        shape = i % 3 === 0 ? "pxpuff" : i % 2 === 0 ? "streak" : "pxball";
        add = shape !== "pxpuff";
        size = (shape === "pxpuff" ? 9 + rand() * 7 : 3.5 + rand() * 3.5) * scale;
      } else if (pk === "water") {
        shape = i % 3 === 0 ? "pxpuff" : i % 2 === 0 ? "pxball" : "soft";
        add = shape === "soft";
        size = (shape === "pxpuff" ? 8 + rand() * 6 : 4 + rand() * 4.5) * scale;
      } else if (pk === "ice" || pk === "metal") {
        shape = i % 2 === 0 ? "shard" : "streak";
        size = (5.5 + rand() * 5) * scale;
      } else if (pk === "wood" || pk === "rose") {
        shape = i % 3 === 0 ? "rose" : i % 2 === 0 ? "shard" : "px";
        add = shape === "px";
        size = (5 + rand() * 4) * scale;
      } else if (pk === "earth") {
        shape = i % 2 === 0 ? "shard" : "pxpuff";
        add = false;
        size = (6 + rand() * 5.5) * scale;
      } else if (pk === "moon" || pk === "dark" || pk === "poison" || pk === "psychic") {
        shape = i % 3 === 0 ? "pxpuff" : i % 2 === 0 ? "star" : "pxball";
        add = shape !== "pxpuff";
        size = (shape === "pxpuff" ? 8 + rand() * 6 : 4.5 + rand() * 4.5) * scale;
      } else if (pk === "sun" || pk === "light") {
        shape = i % 2 === 0 ? "star" : "streak";
        size = (6 + rand() * 5) * scale;
      } else if (pk === "wind") {
        shape = i % 2 === 0 ? "streak" : "crescent";
        size = (8 + rand() * 6) * scale;
      }
      if (crisp && (shape === "pxpuff" || shape === "rose")) { shape = "streak"; add = true; size = (3.5 + rand() * 3) * scale; }
      spawnP({
        shape, x, y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.82,
        vz: (pk === "earth" || pk === "water" || pk === "ice") ? 95 + rand() * 125 : 0,
        gravity: (pk === "earth" || pk === "water" || pk === "ice") ? 360 : 0,
        drag: shape === "pxpuff" ? 0.88 : 0.91,
        size, size1, rot: a, vrot: (rand() - 0.5) * 9,
        stops, add, life: 0.22 + rand() * 0.24
      });
    }
  }

  // Emit a rich fluid PB-Ranked Flamethrower / Hydro Pump / Blizzard overlapping pxpuff stream!
  function emitFluidStream({ x, y, angle = 0, palKey = "fire", range = 280, puffs = 16 }) {
    const pk = normalizePalKey(palKey);
    const stops = paletteStops(pk);
    const n = quality === "low" ? Math.ceil(puffs * 0.65) : puffs;
    for (let i = 0; i < n; i++) {
      const f = i / Math.max(1, n - 1);
      const jitter = (rand() - 0.5) * 0.24;
      const a = angle + jitter;
      const spd = (250 + f * 290) * (range / 280);
      const isCore = f < 0.25;
      spawnP({
        shape: isCore ? "pxball" : "pxpuff",
        x: x + Math.cos(angle) * (10 + f * 20),
        y: y + Math.sin(angle) * (10 + f * 20),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        drag: 0.90,
        size: (isCore ? 7.5 : 10 + f * 8),
        size1: (isCore ? 12 : 18 + f * 9),
        stops, add: isCore,
        alphaMul: isCore ? 0.98 : 0.92,
        life: 0.26 + f * 0.24
      });
    }
    spawnP({ shape: "glow", x, y, size: 16, size1: 30, life: 0.22, pal: pk, add: true, alphaMul: 0.82 });
  }

  // Emit bold filled anime pixel crescent slash showpiece (`HERO_SLASH` — ZERO thin wireframe lines!)
  function emitCrescentSlash({ x, y, angle = 0, palKey = "metal", scale = 1, count = 1, style = "cleave" }) {
    const pk = normalizePalKey(palKey);
    // Centre the arc behind the struck body so the stroke passes through it, not beyond it.
    x -= Math.cos(angle) * 18 * Math.min(1.25, scale); y -= Math.sin(angle) * 12 * Math.min(1.25, scale);
    const hex = paletteHex(pk);
    addHero({
      kind: "HERO_SLASH",
      x, y, angle, palKey: pk,
      mainHex: hex.main, coreHex: hex.core,
      scale: clamp(scale, 0.85, 1.8),
      count: clamp(count, 1, 3),
      style,
      life: style === "flurry" ? 0.34 : 0.26
    });
    for (let i = 0; i < 8; i++) {
      const a = angle + (rand() - 0.5) * 1.5;
      spawnP({
        shape: "streak", x, y, vx: Math.cos(a) * 290 * scale, vy: Math.sin(a) * 240 * scale,
        size: 6 * scale, size1: 1, stretch: 2.5, pal: pk, add: true, life: 0.18
      });
    }
  }

  // Spawn volumetric billowing cloud + faceted spire shockwave (`HERO_SHOCKWAVE` — ZERO plain circles!)
  function spawnHeroShockwave({ x, y, radius = 120, palKey = "earth", spiresCount = 5 }) {
    const pk = normalizePalKey(palKey);
    const r = clamp(radius, 56, 175);
    addHero({
      kind: "HERO_SHOCKWAVE",
      x, y, radius: r, palKey: pk, stops: paletteStops(pk),
      life: 0.44
    });
    emitElementBurst({ x, y: y - 12, palKey: pk, scale: 1.2, angle: 0, heavy: true, crisp: true });
    // Rock and ice spires belong to earth, ice and metal blasts; fire and the rest leave none (2026-11-26).
    const solid = pk === "earth" || pk === "ice" || pk === "metal";
    const spCount = !solid ? 0 : quality === "low" ? Math.ceil(spiresCount * 0.6) : spiresCount;
    for (let i = 0; i < spCount; i++) {
      const a = (i / Math.max(1, spCount)) * TAU + rand() * 0.4;
      const dist = r * (0.28 + rand() * 0.32);
      addSpire({
        x: x + Math.cos(a) * dist,
        y: y + 6 + Math.sin(a) * dist * 0.58,
        radius: clamp(14 + rand() * 10, 14, 26),
        pal: pk, life: 0.52, delay: i * 0.025
      });
    }
    if (pk === "thunder") {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + rand() * 0.5;
        addLightning(x, y - 10, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.48, "thunder", 3.6, 0.24);
      }
    }
  }

  // Spawn dramatic multi-frame sky-drop meteor / water geyser / thunder pillar (`HERO_METEOR`!)
  function spawnHeroMeteor({ x, y, radius = 118, palKey = "fire", count = 3 }) {
    const pk = normalizePalKey(palKey);
    const r = clamp(radius, 64, 170);
    const meteors = [];
    const n = pk === "water" ? 1 : clamp(count, 1, 5);
    for (let i = 0; i < n; i++) {
      const offA = (i / Math.max(1, n)) * TAU + rand() * 0.6;
      const offR = n === 1 ? 0 : (14 + rand() * (r * 0.38));
      meteors.push({
        tx: x + Math.cos(offA) * offR,
        ty: y + Math.sin(offA) * offR * 0.58,
        delay: i * 0.075,
        size: n === 1 ? 30 : (20 + rand() * 12),
        detonated: false,
        seed: rand() * 100
      });
    }
    addHero({
      kind: "HERO_METEOR",
      x, y, radius: r, palKey: pk, stops: paletteStops(pk),
      rockPal: rockPalFor(pk), meteors,
      life: pk === "water" ? 0.78 : (0.76 + (n - 1) * 0.075)
    });
  }

  // Spawn towering animated 3D swirling pixel tornado funnel (`HERO_VORTEX` — ZERO empty rings!)
  function spawnHeroVortex({ x, y, radius = 115, palKey = "wind", durationSec = 0.95 }) {
    const pk = normalizePalKey(palKey);
    addHero({
      kind: "HERO_VORTEX",
      x, y, radius: clamp(radius, 54, 140),
      palKey: pk, stops: paletteStops(pk),
      life: clamp(durationSec, 0.58, 1.25)
    });
  }

  // Spawn luminous rising vertical energy pillar aura (`HERO_PILLAR_AURA` for buffs / heals / arena zones!)
  function spawnHeroPillarAura({ x, y, radius = 56, palKey = "sun", mode = "buff" }) {
    const pk = normalizePalKey(palKey);
    const hex = paletteHex(pk);
    addHero({
      kind: "HERO_PILLAR_AURA",
      x, y, radius: clamp(radius, 34, 96),
      palKey: pk, mainHex: hex.main, coreHex: hex.core, mode,
      life: 0.58
    });
  }

  // Draw one active Hero Showpiece frame across depthGfx / topGfx / topAddGfx
  function drawHeroEffect(h, dtStep) {
    const t = clamp(h.age / h.life, 0, 1);
    const stops = h.stops ?? paletteStops(h.palKey);
    const hex = paletteHex(h.palKey);

    if (h.kind === "HERO_SLASH") {
      // Peak on the first frame (a slash shape lives 1-2 frames at full strength), then thins out.
      const fade = clamp(1 - Math.max(0, t - 0.2) / 0.8, 0, 1);
      // ~1.2 body (PB keeps a slash tight on the caster and target, 2026-11-26).
      const rBase = (26 + t * 12) * Math.min(1.25, h.scale);
      const gMain = topGfx ?? topAddGfx;
      const gAdd = topAddGfx ?? topGfx;
      if (!gMain) return;
      if (h.style === "backstab") {
        // 3 parallel razor-sharp dark/elemental claw gashes!
        for (let k = -1; k <= 1; k++) {
          const perp = h.angle + Math.PI * 0.5;
          const ox = h.x + Math.cos(perp) * k * 14 * h.scale;
          const oy = h.y + Math.sin(perp) * k * 11 * h.scale;
          drawFilledCrescent(gAdd, ox, oy, rBase * 0.92, h.angle + k * 0.14, 0.92, 11 * h.scale * fade, h.mainHex, 0xffffff, fade);
        }
      } else if (h.style === "dash") {
        // Piercing elemental spearhead wedge + sweeping wake crescent
        drawCrystalSpear(gMain, h.x + Math.cos(h.angle) * (16 + t * 28), h.y + Math.sin(h.angle) * (12 + t * 22), 62 * h.scale, 24 * h.scale * fade, h.angle, rockPalFor(h.palKey), fade);
        drawFilledCrescent(gAdd, h.x, h.y, rBase * 0.96, h.angle, 1.05, 13 * h.scale * fade, h.mainHex, 0xffffff, fade * 0.9);
      } else {
        // Flurry X-cross / Heavy Overhead Cleave filled anime crescent arcs!
        const slashCount = h.count || 1;
        for (let i = 0; i < slashCount; i++) {
          const subT = clamp((h.age - i * 0.055) / Math.max(0.12, h.life - i * 0.055), 0, 1);
          if (subT <= 0 || subT >= 1) continue;
          const subFade = subT < 0.22 ? subT / 0.22 : clamp(1 - (subT - 0.22) / 0.78, 0, 1);
          const sweepA = h.angle + (i % 2 === 0 ? 1 : -1) * (slashCount > 1 ? 0.58 : 0.12) + (subT - 0.5) * 0.45;
          const rr = (38 + subT * 26) * h.scale * (i === slashCount - 1 ? 1.15 : 0.95);
          drawFilledCrescent(gAdd, h.x + Math.cos(h.angle) * 14, h.y + Math.sin(h.angle) * 10, rr, sweepA, 1.28, (16 + (h.style === "heavy" ? 6 : 0)) * h.scale * subFade, h.mainHex, 0xffffff, subFade);
        }
      }
      return;
    }

    if (h.kind === "HERO_METEOR") {
      if (h.palKey === "water") {
        // Towering 145px foaming water geyser column (Water Spout / Hydro Cannon / 【淵隕擊】)!
        const rise = t < 0.28 ? (t / 0.28) : 1;
        const fade = t > 0.65 ? clamp((1 - t) / 0.35, 0, 1) : 1;
        const colH = 148 * rise;
        const baseW = clamp(h.radius * 0.42, 26, 48);
        const colMid = sampleStops(stops, 0.38);
        const colTop = sampleStops(stops, 0.08);
        if (topGfx) {
          // Stacked billowing 3-pass shaded water swells rising skyward
          for (let i = 0; i < 9; i++) {
            const f = i / 8;
            const py = h.y + 6 - colH * f;
            const sway = Math.sin(h.age * 16 + i * 1.1 + h.seed) * 5;
            const r = baseW * (1.05 - f * 0.32) * (0.85 + 0.15 * Math.sin(h.age * 22 + i));
            drawPixelPuff(topGfx, h.x + sway, py, r, colMid.r, colMid.g, colMid.b, 0.94 * fade);
          }
          // Crashing white-foam crown plumes bursting outward at the top!
          for (let side of [-1, 1]) {
            const crownX = h.x + side * (baseW * 0.85 + t * 28);
            const crownY = h.y - colH + 10 + t * 26;
            drawPixelPuff(topGfx, crownX, crownY, baseW * 0.68, colTop.r, colTop.g, colTop.b, 0.92 * fade);
          }
        }
        if (topAddGfx) {
          // Bright vertical hydro-pressure core jet
          topAddGfx.moveTo(h.x, h.y + 4).lineTo(h.x, h.y - colH)
            .stroke({ color: 0xffffff, width: Math.max(6, baseW * 0.38), alpha: 0.82 * fade, cap: "round" });
        }
        if (!h.detonated && t >= 0.2) {
          h.detonated = true;
          emitElementBurst({ x: h.x, y: h.y - 16, palKey: "water", scale: 1.45, heavy: true });
          for (let i = 0; i < 14; i++) {
            const a = -Math.PI * 0.5 + (rand() - 0.5) * 1.6;
            spawnP({
              shape: i % 2 === 0 ? "pxball" : "soft",
              x: h.x + (rand() - 0.5) * 24, y: h.y - colH * 0.7,
              vx: Math.cos(a) * (110 + rand() * 140), vy: Math.sin(a) * (130 + rand() * 120),
              gravity: 420, size: 5 + rand() * 5, size1: 1.5, pal: "water", add: i % 3 === 0, life: 0.48
            });
          }
        }
        return;
      }

      if (h.palKey === "thunder") {
        // Colossal sky-to-ground triple braided lightning pillar!
        const fade = clamp(1 - t * 0.9, 0, 1);
        if (topAddGfx) {
          topAddGfx.moveTo(h.x, h.y - 280).lineTo(h.x, h.y)
            .stroke({ color: hex.main, width: 34 * fade, alpha: 0.38 * fade, cap: "round" });
          const jitterTick = Math.floor(h.age * 42);
          drawJaggedBolt(topAddGfx, h.x - 10, h.y - 280, h.x, h.y, 7.5 * fade, hex.main, 0xffffff, fade, h.seed + jitterTick);
          drawJaggedBolt(topAddGfx, h.x + 14, h.y - 260, h.x + 6, h.y + 4, 4.2 * fade, hex.main, hex.core, fade * 0.9, h.seed + 31 + jitterTick);
          drawJaggedBolt(topAddGfx, h.x - 16, h.y - 240, h.x - 8, h.y + 2, 3.4 * fade, hex.main, hex.core, fade * 0.85, h.seed + 67 + jitterTick);
          topAddGfx.circle(h.x, h.y, 38 * fade).fill({ color: hex.main, alpha: 0.5 * fade });
          topAddGfx.circle(h.x, h.y, 18 * fade).fill({ color: 0xffffff, alpha: 0.95 * fade });
        }
        if (!h.detonated) {
          h.detonated = true;
          emitElementBurst({ x: h.x, y: h.y, palKey: "thunder", scale: 1.5, heavy: true });
          addDecal({ x: h.x, y: h.y + 6, kind: "crack", radius: Math.min(54, h.radius * 0.48), pal: "thunder" });
        }
        return;
      }

      // Physical falling giant meteors / plunging icicle spears / magma boulders / eclipse comets!
      for (const m of h.meteors) {
        const mt = h.age - m.delay;
        if (mt < 0) continue;
        const fallDur = 0.34;
        if (mt < fallDur) {
          const f = mt / fallDur;
          const ease = f * f;
          const sx = m.tx - 115 * (1 - ease);
          const sy = m.ty - 250 * (1 - ease);
          const fallAng = Math.atan2(250, 115);
          // Ground shadow growing as meteor plummets!
          if (groundGfx && typeof groundGfx.ellipse === "function") {
            const sr = m.size * (0.35 + 0.85 * ease);
            groundGfx.ellipse(m.tx, m.ty + 6, sr, sr * 0.54).fill({ color: 0x090b14, alpha: 0.38 * ease });
          }
          // Blazing trailing comet clouds & streaks
          const colHot = sampleStops(stops, 0.25);
          if (topGfx) {
            for (let tr = 1; tr <= 4; tr++) {
              const bx = sx - Math.cos(fallAng) * tr * 18;
              const by = sy - Math.sin(fallAng) * tr * 18;
              drawPixelPuff(topGfx, bx, by, m.size * (0.95 - tr * 0.16), colHot.r, colHot.g, colHot.b, 0.88 - tr * 0.15);
            }
            if (h.palKey === "ice" || h.palKey === "metal") {
              drawCrystalSpear(topGfx, sx, sy, m.size * 2.5, m.size * 0.95, fallAng, h.rockPal, 0.98);
            } else {
              drawFacetedSpire(topGfx, sx, sy, m.size, mt * 7 + m.seed, m.seed, h.rockPal, 0.98);
            }
          }
          if (topAddGfx) {
            topAddGfx.circle(sx, sy, m.size * 1.15).fill({ color: hex.main, alpha: 0.42 });
            topAddGfx.circle(sx, sy, m.size * 0.52).fill({ color: 0xffffff, alpha: 0.88 });
          }
        } else {
          // Detonation fireball / billowing explosion clouds!
          const bt = clamp((mt - fallDur) / 0.42, 0, 1);
          if (!m.detonated) {
            m.detonated = true;
            emitElementBurst({ x: m.tx, y: m.ty - 6, palKey: h.palKey, scale: 1.35, heavy: true });
            addDecal({ x: m.tx, y: m.ty + 6, kind: h.palKey === "ice" ? "frost" : "crack", radius: Math.min(54, h.radius * 0.46), pal: h.palKey });
            addSpire({ x: m.tx + (rand() - 0.5) * 26, y: m.ty + 4, radius: 16 + rand() * 8, pal: h.palKey, life: 0.52 });
          }
          if (bt < 1 && topGfx) {
            const fade = clamp(1 - bt * bt, 0, 1);
            const colBlast = sampleStops(stops, bt * 0.8);
            const cloudCount = 7;
            for (let c = 0; c < cloudCount; c++) {
              const ca = (c / cloudCount) * TAU + m.seed;
              const cd = (12 + bt * m.size * 2.2) * (0.75 + 0.35 * Math.sin(m.seed + c * 4));
              const cx = m.tx + Math.cos(ca) * cd;
              const cy = m.ty - 8 + Math.sin(ca) * cd * 0.62 - bt * 24;
              const cr = m.size * (0.92 - bt * 0.42) * (c === 0 ? 1.25 : 0.85);
              drawPixelPuff(topGfx, cx, cy, cr, colBlast.r, colBlast.g, colBlast.b, 0.94 * fade);
            }
            if (topAddGfx && bt < 0.45) {
              const fl = 1 - bt / 0.45;
              topAddGfx.circle(m.tx, m.ty - 8, m.size * (1.2 + bt * 1.4)).fill({ color: hex.main, alpha: 0.52 * fl });
              topAddGfx.circle(m.tx, m.ty - 8, m.size * 0.72 * fl).fill({ color: 0xffffff, alpha: 0.96 * fl });
            }
          }
        }
      }
      return;
    }

    if (h.kind === "HERO_VORTEX") {
      // Cohesive 132px-tall 3D swirling pixel tornado funnel (tapered translucent core + tightly overlapping cloud tiers!)
      const fade = t < 0.16 ? t / 0.16 : t > 0.72 ? clamp((1 - t) / 0.28, 0, 1) : 1;
      const tiers = 7;
      const colMain = sampleStops(stops, 0.36);
      const colCore = sampleStops(stops, 0.12);
      if (topGfx) {
        if (typeof topGfx.poly === "function") {
          const swayTop = Math.sin(h.age * 10 + 3.2 + h.seed) * 10;
          const topW = 24 + h.radius * 0.36;
          const botW = 12;
          topGfx.poly([
            h.x - botW, h.y + 8,
            h.x + botW, h.y + 8,
            h.x + swayTop + topW, h.y - 126,
            h.x + swayTop - topW, h.y - 126
          ]).fill({ color: hex.main, alpha: 0.34 * fade });
        }
        for (let tier = 0; tier < tiers; tier++) {
          const tf = tier / (tiers - 1);
          const ty = h.y + 8 - tf * 128;
          const tr = (7 + tf * h.radius * 0.28) * (0.9 + 0.1 * fade);
          const sway = Math.sin(h.age * 10 + tf * 3.2 + h.seed) * (3 + tf * 8);
          const puffCount = 5 + Math.floor(tf * 3);
          for (let p = 0; p < puffCount; p++) {
            const ang = h.age * (10.5 - tf * 2.2) + (p / puffCount) * TAU + tier * 0.85;
            const px = h.x + sway + Math.cos(ang) * tr;
            const py = ty + Math.sin(ang) * tr * 0.32;
            const pr = 11 + tf * 12;
            const useBright = p % 2 === 0;
            drawPixelPuff(topGfx, px, py, pr, useBright ? colCore.r : colMain.r, useBright ? colCore.g : colMain.g, useBright ? colCore.b : colMain.b, 0.90 * fade);
          }
        }
      }
      if (topAddGfx) {
        for (let r = 0; r < 4; r++) {
          const baseA = h.age * 9.5 + (r / 4) * TAU;
          let started = false;
          for (let s = 0; s <= 12; s++) {
            const sf = s / 12;
            const ang = baseA + sf * Math.PI * 2.6;
            const rad = 10 + sf * h.radius * 0.34;
            const sway = Math.sin(h.age * 10 + sf * 3.2 + h.seed) * (3 + sf * 8);
            const rx = h.x + sway + Math.cos(ang) * rad;
            const ry = h.y + 4 - sf * 130 + Math.sin(ang) * rad * 0.30;
            if (!started) { topAddGfx.moveTo(rx, ry); started = true; }
            else topAddGfx.lineTo(rx, ry);
          }
          topAddGfx.stroke({ color: r % 2 === 0 ? 0xffffff : hex.main, width: r % 2 === 0 ? 3.2 : 2.4, alpha: 0.78 * fade, cap: "round" });
        }
      }
      return;
    }

    if (h.kind === "HERO_SHOCKWAVE") {
      // Organic billowing anime cloud blast (jittered overlapping outer plumes + central blast core — ZERO bead-ring!)
      const ease = 1 - Math.pow(1 - t, 2.2);
      const fade = clamp(1 - t * t, 0, 1);
      const curR = h.radius * (0.18 + 0.74 * ease);
      const col = sampleStops(stops, t * 0.72);
      const colHot = sampleStops(stops, t * 0.3);
      const count = quality === "low" ? 9 : 14;
      if (topGfx) {
        // Dense central billowing plumes
        for (let c = 0; c < 5; c++) {
          const ca = (c / 5) * TAU + h.seed * 1.7;
          const cd = curR * (0.26 + 0.16 * Math.sin(h.seed + c * 3.3));
          // 2026-11-26 PB scale: a blast reads as fine dust and sparks around the body, never a pile of balls over it.
          const pr = clamp(h.radius * 0.07, 5, 9) * (1.15 - t * 0.52);
          drawPixelPuff(topGfx, h.x + Math.cos(ca) * cd, h.y + Math.sin(ca) * cd * 0.56 - t * 14, pr, colHot.r, colHot.g, colHot.b, 0.92 * fade);
        }
        // Irregular overlapping outer smoke/flame/frost/earth cloud ring
        for (let i = 0; i < count; i++) {
          const a = (i / count) * TAU + h.seed + Math.sin(i * 4.1 + h.seed) * 0.18;
          const radMul = 0.72 + 0.34 * Math.abs(Math.sin(h.seed * 3 + i * 2.7));
          const cx = h.x + Math.cos(a) * curR * radMul;
          const cy = h.y + 4 + Math.sin(a) * curR * radMul * 0.58 - (1 - t) * 8;
          const szMul = 0.78 + 0.44 * Math.abs(Math.cos(h.seed + i * 3.1));
          const pr = clamp(h.radius * 0.06, 4, 8) * szMul * (1.15 - t * 0.52);
          drawPixelPuff(topGfx, cx, cy, pr, col.r, col.g, col.b, 0.94 * fade);
        }
      }
      if (topAddGfx && t < 0.48) {
        const fl = 1 - t / 0.48;
        topAddGfx.circle(h.x, h.y, curR * 0.52).fill({ color: hex.main, alpha: 0.46 * fl });
        topAddGfx.circle(h.x, h.y, curR * 0.26).fill({ color: 0xffffff, alpha: 0.92 * fl });
      }
      return;
    }

    if (h.kind === "HERO_PILLAR_AURA") {
      // Rising vertical translucent energy light pillars + floating stars (Buff / Heal / Arena Zone!)
      const fade = t < 0.2 ? t / 0.2 : clamp((1 - t) / 0.8, 0, 1);
      const gAdd = topAddGfx ?? topGfx;
      if (!gAdd) return;
      const pillars = 6;
      for (let i = 0; i < pillars; i++) {
        const a = (i / pillars) * TAU + h.age * 2.2 + h.seed;
        const px = h.x + Math.cos(a) * h.radius * 0.65;
        const py = h.y + 10 + Math.sin(a) * h.radius * 0.36;
        const ph = (48 + (i % 3) * 24) * (0.4 + 0.8 * t);
        const pw = 5 + (i % 2) * 3;
        gAdd.rect(px - pw * 0.5, py - ph, pw, ph).fill({ color: i % 2 === 0 ? h.mainHex : h.coreHex, alpha: 0.46 * fade });
        gAdd.rect(px - pw * 0.2, py - ph, pw * 0.4, ph).fill({ color: 0xffffff, alpha: 0.72 * fade });
      }
      if (depthGfx && typeof depthGfx.ellipse === "function") {
        depthGfx.ellipse(h.x, h.y + 10, h.radius * 0.75, h.radius * 0.4).fill({ color: h.mainHex, alpha: 0.22 * fade });
      }
      return;
    }

    if (h.kind === "HERO_CAGE") {
      // Orbiting psychic/elemental rune crystals + vertical energy lift beams!
      const fade = t < 0.18 ? t / 0.18 : t > 0.75 ? clamp((1 - t) / 0.25, 0, 1) : 1;
      const gAdd = topAddGfx ?? topGfx;
      if (!gAdd) return;
      for (let i = 0; i < 6; i++) {
        const a = h.age * 4.5 + (i / 6) * TAU;
        const rx = h.x + Math.cos(a) * h.radius * 0.62;
        const ry = h.y - 12 + Math.sin(a) * h.radius * 0.36;
        gAdd.moveTo(rx, ry + 26).lineTo(rx, ry - 48).stroke({ color: h.mainHex, width: 3.2, alpha: 0.62 * fade, cap: "round" });
        drawCrystalSpear(gAdd, rx, ry - 14, 24, 10, -Math.PI * 0.5, rockPalFor(h.palKey), 0.92 * fade);
      }
      return;
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
        gfx.circle(x, y, sz * 1.5).fill({ color: hex, alpha: alpha * 0.24 });
        gfx.circle(x, y, sz * 0.92).fill({ color: hex, alpha: alpha * 0.48 });
        gfx.circle(x, y, sz * 0.45).fill({ color: 0xffffff, alpha: alpha * 0.72 });
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
        gfx.circle(x, y, sz).fill({ color: hex, alpha: alpha * 0.86 });
        gfx.circle(x - sz * 0.28, y - sz * 0.28, sz * 0.32).fill({ color: 0xffffff, alpha: alpha * 0.9 });
        break;
      case "streak": {
        const spd = Math.hypot(p.vx, p.vy - p.vz) || 1;
        const dx = p.vx / spd, dy = (p.vy - p.vz) / spd;
        const len = Math.max(sz * 1.8, Math.min(54, spd * 0.048 * p.stretch));
        gfx.moveTo(x - dx * len, y - dy * len).lineTo(x + dx * len * 0.42, y + dy * len * 0.42)
          .stroke({ color: hex, width: Math.max(1.8, sz * 0.48), alpha, cap: "round" });
        break;
      }
      case "shard": {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const l = sz * 1.55, w = sz * 0.58;
        const pts = [
          x + c * l, y + s * l,
          x - s * w, y + c * w,
          x - c * l * 0.78, y - s * l * 0.78,
          x + s * w, y - c * w
        ];
        if (typeof gfx.poly === "function") {
          gfx.poly(pts).fill({ color: hex, alpha });
          gfx.moveTo(pts[0], pts[1]).lineTo(pts[4], pts[5]).stroke({ color: 0xffffff, width: 1.3, alpha: alpha * 0.8 });
        } else {
          gfx.circle(x, y, sz).fill({ color: hex, alpha });
        }
        break;
      }
      case "ring": {
        // Soft filled inner flash instead of harsh wireframe spam if ring is ever explicitly called
        const rx = sz, ry = sz * p.squash;
        if (typeof gfx.ellipse === "function") {
          gfx.ellipse(x, y, rx, ry).fill({ color: hex, alpha: alpha * 0.16 });
        } else {
          gfx.circle(x, y, rx).fill({ color: hex, alpha: alpha * 0.16 });
        }
        break;
      }
      case "crescent": {
        drawFilledCrescent(gfx, x, y, sz, p.rot, 1.05, Math.max(4, p.width * (1 - g * 0.5)), hex, 0xffffff, alpha);
        break;
      }
      case "star": {
        const arms = 4;
        for (let i = 0; i < arms; i++) {
          const a = p.rot + (i * Math.PI) / arms;
          const len = i % 2 === 0 ? sz * 1.55 : sz * 0.9;
          gfx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len)
            .lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
            .stroke({ color: hex, width: Math.max(1.6, sz * 0.22), alpha, cap: "round" });
        }
        gfx.circle(x, y, sz * 0.3).fill({ color: 0xffffff, alpha });
        break;
      }
      case "rose": {
        for (let i = 0; i < 5; i++) {
          const a = p.rot + (i / 5) * TAU;
          gfx.circle(x + Math.cos(a) * sz * 0.55, y + Math.sin(a) * sz * 0.55, sz * 0.46).fill({ color: hex, alpha: alpha * 0.94 });
        }
        gfx.circle(x, y, sz * 0.28).fill({ color: 0xfff8dc, alpha });
        break;
      }
    }
  }

  // Render 10 Distinct Element Projectile Hero Silhouettes + Huge DRAG_WAVE Walls!
  function drawHeroProjectile(s) {
    const x = s.prevX, y = s.prevY;
    const pk = s.palKey;
    const col = sampleStops(s.stops, 0.22);
    const colHot = sampleStops(s.stops, 0.08);
    const hex = paletteHex(pk);

    // Massive 96px-wide curved crashing elemental wave wall for DRAG_WAVE moves!
    if (s.arch === "DRAG_WAVE") {
      drawWaveCrest(topGfx, topAddGfx, x, y, Math.max(82, s.radius * 4.4), s.angle, s.stops, 0.96, s.age * 6 + s.seed);
      return;
    }

    if (topAddGfx) {
      topAddGfx.circle(x, y, s.radius * 1.55).fill({ color: col.hex, alpha: 0.34 });
    }
    if (!topGfx) return;

    if (pk === "fire" || pk === "blueFire" || pk === "dragon") {
      // Multi-layered blazing fireball with fluttering flame tail & white-hot core!
      const c = Math.cos(s.angle), sn = Math.sin(s.angle);
      drawPixelPuff(topGfx, x - c * s.radius * 0.95, y - sn * s.radius * 0.95, s.radius * 0.92, col.r, col.g, col.b, 0.88);
      drawPixelPuff(topGfx, x, y, s.radius * 1.25, col.r, col.g, col.b, 0.98);
      drawPixelBall(topAddGfx ?? topGfx, x + c * s.radius * 0.15, y + sn * s.radius * 0.15, s.radius * 0.62, 0xffffff, 0.96);
    } else if (pk === "water") {
      // Curved foaming water spear-wave + white foam tip!
      drawWaveCrest(topGfx, topAddGfx, x, y, s.radius * 2.8, s.angle, s.stops, 0.96, s.age * 8 + s.seed);
    } else if (pk === "ice") {
      // Razor-sharp faceted 3-tone crystal icicle spear!
      drawCrystalSpear(topGfx, x, y, s.radius * 3.1, s.radius * 1.15, s.angle, rockPalFor("ice"), 0.98);
      if (topAddGfx) topAddGfx.circle(x + Math.cos(s.angle) * s.radius * 0.7, y + Math.sin(s.angle) * s.radius * 0.7, s.radius * 0.4).fill({ color: 0xffffff, alpha: 0.9 });
    } else if (pk === "thunder") {
      // Blazing plasma core + 2 live crackling jagged lightning mini-arcs orbiting every frame!
      drawPixelBall(topGfx, x, y, s.radius * 1.05, hex.main, 0.98);
      drawPixelBall(topAddGfx ?? topGfx, x, y, s.radius * 0.58, 0xffffff, 0.98);
      if (topAddGfx) {
        const tick = Math.floor(s.age * 40);
        const a1 = s.angle + Math.sin(tick * 2.3 + s.seed) * 1.4;
        const a2 = s.angle + Math.PI + Math.cos(tick * 3.1 + s.seed) * 1.2;
        drawJaggedBolt(topAddGfx, x, y, x + Math.cos(a1) * s.radius * 2.2, y + Math.sin(a1) * s.radius * 2.2, 2.4, hex.main, 0xffffff, 0.95, tick + s.seed);
        drawJaggedBolt(topAddGfx, x, y, x + Math.cos(a2) * s.radius * 1.8, y + Math.sin(a2) * s.radius * 1.8, 2.0, hex.main, hex.core, 0.9, tick + 19 + s.seed);
      }
    } else if (pk === "wood" || pk === "nature" || pk === "rose") {
      // Spinning twin razor-leaves / blooming 5-petal blossom!
      const spin = s.age * 16 + s.seed;
      drawCrystalSpear(topGfx, x, y, s.radius * 2.4, s.radius * 1.0, spin, rockPalFor("wood"), 0.98);
      drawCrystalSpear(topGfx, x, y, s.radius * 2.4, s.radius * 1.0, spin + Math.PI * 0.5, rockPalFor("wood"), 0.92);
      drawPixelBall(topAddGfx ?? topGfx, x, y, s.radius * 0.42, 0xf2ffd4, 0.96);
    } else if (pk === "earth") {
      // Tumbling 3D faceted 8-vertex boulder!
      drawFacetedSpire(topGfx, x, y, s.radius * 1.28, s.age * 9 + s.seed, s.seed, rockPalFor("earth"), 0.98);
    } else if (pk === "wind") {
      // Wide sweeping curved turquoise/white crescent air-blade!
      drawFilledCrescent(topAddGfx ?? topGfx, x, y, s.radius * 1.9, s.angle, 1.18, s.radius * 0.72, hex.main, 0xffffff, 0.96);
    } else if (pk === "metal") {
      // Gleaming silver-chrome faceted spearhead / saw-blade!
      drawCrystalSpear(topGfx, x, y, s.radius * 2.9, s.radius * 1.1, s.angle, rockPalFor("metal"), 0.98);
      drawFilledCrescent(topAddGfx ?? topGfx, x, y, s.radius * 1.3, s.angle, 0.85, s.radius * 0.38, 0xd4dfe8, 0xffffff, 0.88);
    } else if (pk === "sun" || pk === "light") {
      // Rotating 8-point golden solar flare star!
      const gAdd = topAddGfx ?? topGfx;
      for (let i = 0; i < 4; i++) {
        const a = s.age * 8 + (i * Math.PI) / 4;
        const len = s.radius * (i % 2 === 0 ? 2.1 : 1.4);
        gAdd.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len)
          .lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
          .stroke({ color: i % 2 === 0 ? 0xffffff : hex.main, width: Math.max(2.6, s.radius * 0.28), alpha: 0.96, cap: "round" });
      }
      drawPixelBall(topGfx, x, y, s.radius * 0.92, hex.main, 0.98);
      drawPixelBall(gAdd, x, y, s.radius * 0.55, 0xffffff, 0.98);
    } else {
      // MOON / dark / poison / psychic: ominous black-indigo eclipse orb wreathed in violet pxpuff flames!
      const c = Math.cos(s.angle), sn = Math.sin(s.angle);
      drawPixelPuff(topGfx, x - c * s.radius * 0.65, y - sn * s.radius * 0.65, s.radius * 1.15, col.r, col.g, col.b, 0.92);
      drawPixelBall(topGfx, x, y, s.radius * 1.12, hex.main, 0.96);
      drawPixelBall(topGfx, x, y, s.radius * 0.68, 0x120826, 0.98);
      drawFilledCrescent(topAddGfx ?? topGfx, x, y, s.radius * 1.18, s.angle + s.age * 7, 1.35, s.radius * 0.35, hex.main, colHot.hex, 0.94);
    }
  }

  function drawDecal(gfx, d) {
    const rem = d.life - d.age;
    const fade = rem < 0.9 ? clamp(rem / 0.9, 0, 1) : 1;
    const a = 0.48 * fade;
    if (a <= 0.015) return;
    if (d.kind === "crack") {
      const rays = 7;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * TAU + (d.seed % 1);
        const len = d.radius * (0.65 + 0.35 * Math.sin(d.seed + i * 3.1));
        const mx = d.x + Math.cos(ang + 0.14) * len * 0.52;
        const my = d.y + Math.sin(ang + 0.14) * len * 0.34;
        const ex = d.x + Math.cos(ang) * len;
        const ey = d.y + Math.sin(ang) * len * 0.65;
        gfx.moveTo(d.x, d.y).lineTo(mx, my).lineTo(ex, ey)
          .stroke({ color: 0x1b1714, width: 2.2, alpha: a * 1.25, cap: "round" });
      }
      if (typeof gfx.ellipse === "function") {
        gfx.ellipse(d.x, d.y, d.radius * 0.3, d.radius * 0.18).fill({ color: 0x1b1714, alpha: a * 0.55 });
      }
    } else if (d.kind === "frost") {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + d.seed;
        gfx.moveTo(d.x, d.y).lineTo(d.x + Math.cos(ang) * d.radius * 0.78, d.y + Math.sin(ang) * d.radius * 0.50)
          .stroke({ color: 0xb8f0ff, width: 1.8, alpha: a * 1.15 });
      }
    } else {
      // Subtle scattered ember / splash speckles (zero muddy brown rectangular smudge blocks!)
      const hex = d.pal === "water" ? 0x1e5c8a : d.pal === "poison" ? 0x5c227a : 0x221915;
      for (let i = 0; i < 5; i++) {
        const ang = d.seed + i * 2.1;
        const dist = d.radius * (0.18 + (i % 3) * 0.24);
        const r = Math.max(2, d.radius * (0.15 - i * 0.014));
        drawPixelBall(gfx, d.x + Math.cos(ang) * dist, d.y + Math.sin(ang) * dist * 0.62, r, hex, a * 0.6);
      }
    }
  }

  return Object.freeze({
    isPixelFxV2: true,
    look: (moveId) => resolveMoveSpecV2(moveId),

    /** Directly play any PB-324 move record's Hero procedural VFX recipe. */
    playPbMoveVfx({ x, y, angle = 0, element = "FIRE", shapes = [], layers = [], heavy = false, radius = 90 }) {
      const pk = normalizePalKey(element);
      if (shapes.includes("crescent")) emitCrescentSlash({ x, y, angle, palKey: pk, scale: heavy ? 1.35 : 1.05, count: heavy ? 2 : 1 });
      if (shapes.includes("pxpuff")) emitFluidStream({ x, y, angle, palKey: pk, range: Math.max(200, radius * 2.1), puffs: heavy ? 15 : 10 });
      if (layers.includes("ground-decals")) addDecal({ x, y: y + 10, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: Math.min(54, radius * 0.45), pal: pk });
      emitElementBurst({ x, y, palKey: pk, scale: heavy ? 1.3 : 0.95, angle, heavy });
      stats.releases++;
      return true;
    },

    cast({ x, y, moveId, windup = 0.2 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      // The charge is visible for the whole windup: an orb grows in the hand until the release (2026-11-26 blind review).
      const hold = clamp(windup, 0.12, 1.4);
      spawnP({ shape: "glow", x, y: y - 6, size: 4, size1: 22, pal: pk, add: true, alphaMul: 0.85, life: hold, drag: 1 });
      spawnP({ shape: "pxball", x, y: y - 6, size: 2, size1: 9, pal: pk, add: false, life: hold, drag: 1 });
      // PB Ranked charge windup: bright core star + inward-converging elemental energy streaks
      spawnP({ shape: "star", x, y: y - 6, size: 15, size1: 3, rot: rand() * TAU, pal: pk, add: true, life: 0.22 });
      spawnP({ shape: "glow", x, y: y - 6, size: 14, size1: 24, pal: pk, add: true, alphaMul: 0.72, life: 0.22 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + rand() * 0.4;
        const r = 38;
        spawnP({ shape: "streak", x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.72, vx: -Math.cos(a) * 165, vy: -Math.sin(a) * 125, size: 4, size1: 1, pal: pk, add: true, life: 0.20 });
      }
      stats.casts++;
    },

    telegraph({ x, y, shape = "circle", radius = 95, range = 360, angle = 0, moveId = null, paletteKey = null, duration = 0.45 }) {
      if (reducedMotion) return false;
      const spec = moveId ? resolveMoveSpecV2(moveId) : null;
      const pk = normalizePalKey(paletteKey ?? spec?.paletteKey ?? "fire");
      const hex = paletteHex(pk);
      telegraphs.push({ x, y, shape, radius, range, angle, color: hex.main, core: hex.core, age: 0, life: Math.max(0.22, Math.min(0.85, duration)) });
      if (telegraphs.length > 8) telegraphs.shift();
      return true;
    },

    deployShield({ x, y, paletteKey = "light", duration = 0.35 }) {
      if (reducedMotion) return false;
      const pk = normalizePalKey(paletteKey);
      const hex = paletteHex(pk);
      shields.push({ x, y: y - 12, radius: 44, color: hex.main, core: hex.core, age: 0, life: Math.max(0.34, duration) });
      spawnHeroPillarAura({ x, y, radius: 44, palKey: pk, mode: "shield" });
      return true;
    },

    arenaZone({ x, y, kind = "ECHO", phase = "ACTIVE", radius = 72 }) {
      if (reducedMotion) return false;
      const palMap = { ECHO: "sun", BLOOM: "wood", VENT: "fire", TIDE: "water", UPDRAFT: "wind", RECHARGE: "thunder", SUPER_CORE: "sun" };
      const pk = palMap[kind] ?? "sun";
      if (phase === "WARNING") {
        spawnHeroPillarAura({ x, y, radius: radius * 0.75, palKey: pk, mode: "warn" });
        return true;
      }
      spawnHeroPillarAura({ x, y, radius: radius * 0.9, palKey: pk, mode: "zone" });
      for (let i = 0; i < (phase === "CLAIM" ? 14 : 7); i++) {
        const a = rand() * TAU;
        const d = rand() * radius * 0.7;
        spawnP({
          shape: kind === "BLOOM" ? "rose" : "star",
          x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.65,
          vx: Math.cos(a) * 35, vy: -85 - rand() * 75,
          size: 6 + rand() * 4, size1: 1.5, pal: pk, add: true, life: 0.42
        });
      }
      if (phase === "CLAIM" && kind === "VENT") addDecal({ x, y: y + 8, kind: "crack", radius: 36, pal: "fire" });
      return true;
    },

    release({ x, y, angle = 0, moveId, melee = false }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const arch = spec.v2Archetype;
      const pbShapes = spec.pb324?.vfx?.shapes ?? [];
      if (arch === "STREAM_BEAM") {
        spawnP({ shape: "glow", x, y, size: 20, size1: 36, pal: pk, add: true, life: 0.26 });
        spawnP({ shape: "star", x, y, size: 22, size1: 4, rot: angle, pal: "white", add: true, life: 0.24 });
        if (pk === "fire" || pk === "water" || pk === "ice" || pk === "dragon" || pk === "wind" || pbShapes.includes("pxpuff")) {
          emitFluidStream({ x, y, angle, palKey: pk, range: 290, puffs: 14 });
        }
      } else if (melee || arch === "FLURRY_COMBO" || arch === "SHADOW_BACKSTAB" || arch === "GUARD_BREAK_SLAM" || arch === "MULTI_DASH" || arch === "UTURN_STRIKE") {
        // 2026-11-26 blind review: a melee blow's slash belongs on the contact (hit() draws it there);
        // the release only kicks a few speed streaks and dust off the caster's feet.
        for (let i = 0; i < 5; i++) {
          const a = angle + Math.PI + (rand() - 0.5) * 0.8;
          spawnP({ shape: i % 2 ? "streak" : "px", x, y: y + 10, vx: Math.cos(a) * (120 + rand() * 80), vy: Math.sin(a) * (60 + rand() * 40), size: 4.5, size1: 1, rot: a, pal: i % 2 ? pk : "dust", add: i % 2 === 1, life: 0.2 });
        }
      } else if (arch === "SELF_BUFF") {
        this.buff({ x, y, paletteKey: pk });
      } else if (arch === "PROTECT_COUNTER") {
        this.parry({ x, y });
      } else if (arch === "RECOVERY_SUPPORT") {
        this.heal({ x, y });
      } else {
        // Crisp directional muzzle burst (ZERO empty wireframe ring!)
        spawnP({ shape: "glow", x, y, size: 14, size1: 26, pal: pk, add: true, life: 0.18 });
        spawnP({ shape: "star", x, y, size: 15, size1: 3, rot: angle, pal: "white", add: true, life: 0.18 });
        for (let i = 0; i < 6; i++) {
          const a = angle + (rand() - 0.5) * 0.95;
          spawnP({
            shape: pk === "wood" ? "rose" : (pk === "ice" || pk === "metal" || pk === "earth") ? "shard" : "streak",
            x, y, vx: Math.cos(a) * (160 + rand() * 110), vy: Math.sin(a) * (130 + rand() * 90),
            size: 5.5, size1: 1.5, rot: a, pal: pk, add: pk !== "earth", life: 0.22
          });
        }
      }
      // Express each PB-324 move's distinctive shape flourishes
      if (pbShapes.includes("rose")) {
        for (let i = 0; i < 5; i++) {
          const a = angle + (rand() - 0.5) * 1.2;
          spawnP({ shape: "rose", x, y, vx: Math.cos(a) * 155, vy: Math.sin(a) * 120 - 25, size: 7.5, size1: 2, pal: pk, add: true, life: 0.36 });
        }
      } else if (pbShapes.includes("pxpuff") && arch !== "STREAM_BEAM") {
        for (let i = 0; i < 4; i++) {
          const a = angle + (rand() - 0.5) * 0.9;
          spawnP({ shape: "pxpuff", x, y, vx: Math.cos(a) * 105, vy: Math.sin(a) * 85 - 15, size: 10, size1: 17, pal: pk, add: false, life: 0.30 });
        }
      }
      stats.releases++;
    },

    beamStream({ followStart, followEnd, moveId = "sunSpear", width = 22, durationSec = 0.68 }) {
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
        stops: paletteStops(pk),
        width: Math.max(16, Math.min(36, width * 1.45)),
        age: 0, maxAge: durationSec, detachedAt: null, puffAcc: 0
      });
      if (beamConduits.length > 8) beamConduits.shift();
      return true;
    },

    /** 10-Element Hero Silhouette Projectiles + massive DRAG_WAVE crashing wave walls! */
    projectile({ follow, moveId, angle = 0, lifeMs = 1200 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const arch = spec.v2Archetype;
      const radius = arch === "DRAG_WAVE" ? 22 : arch === "STREAM_BEAM" ? 14 : (spec.tier === "ultimate" ? 19 : 15);
      liveShots.push({
        follow, palKey: pk, stops: paletteStops(pk), radius, arch,
        age: 0, maxAge: lifeMs / 1000, prevX: null, prevY: null, angle, trailAcc: 0, seed: rand() * 100
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
      const crisp = cellsOwnBurst(moveId) || Boolean(spec.melee);
      playPendingUlt(moveId, x, groundY);
      emitElementBurst({ x, y, palKey: fxKey || pk, scale: isStream ? 0.85 : isHeavy ? 1.42 : 1.05, angle, heavy: isHeavy && !isStream, crisp });
      if ((spec.melee || pb?.vfx?.shapes?.includes("crescent")) && !isStream && !cellsOwnBurst(moveId)) {
        emitCrescentSlash({ x, y, angle, palKey: pk, scale: isHeavy ? 1.32 : 1.0, count: 1, style: isHeavy ? "heavy" : "cleave" });
      }
      if (isHeavy && !reducedMotion && (!pb || pb.vfx.layers.includes("ground-decals"))) {
        addDecal({ x, y: groundY + 6, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: 38, pal: pk });
        holdMs = Math.max(holdMs, spec.hitStopMs ? Math.min(115, spec.hitStopMs) : 55);
      }
      stats.hits++;
    },

    area({ x, y, radius = 100, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const sc = clamp(radius / 95, 0.95, 1.6);
      const crisp = cellsOwnBurst(moveId);
      playPendingUlt(moveId, x, y);
      if (!crisp) spawnHeroShockwave({ x, y: y + 6, radius, palKey: pk, spiresCount: pk === "earth" || pk === "ice" || pk === "metal" ? 6 : 4 });
      emitElementBurst({ x, y, palKey: pk, scale: sc, angle: 0, heavy: true, crisp });
      addDecal({ x, y: y + 8, kind: pk === "earth" ? "crack" : pk === "ice" ? "frost" : "scorch", radius: Math.min(60, radius * 0.48), pal: pk });
      stats.hits++;
      return true;
    },

    ult({ moveId, center, target = null, angle = 0 }) {
      if (!center) return;
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey);
      const arch = spec.v2Archetype;
      // 2026-11-26 cause and effect: the target-side spectacle waits for the move's first contact
      // (hit / area for this move id); only the caster's power-up plays at the cast.
      pendingUlt = { moveId, arch, pk, angle, at: fxClock };
      if (arch === "STREAM_BEAM") {
        emitFluidStream({ x: center.x, y: center.y, angle, palKey: pk, range: 360, puffs: 18 });
        spawnHeroPillarAura({ x: center.x, y: center.y + 10, radius: 68, palKey: pk, mode: "ult" });
      } else {
        spawnHeroPillarAura({ x: center.x, y: center.y + 10, radius: 68, palKey: pk, mode: "ult" });
      }
      // Caster ultimate power surge flash + inward energy streaks (ZERO concentric wireframe rings!)
      spawnP({ shape: "star", x: center.x, y: center.y, size: 36, size1: 6, rot: 0, pal: "white", add: true, life: 0.30 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        spawnP({ shape: "streak", x: center.x + Math.cos(a) * 72, y: center.y + Math.sin(a) * 48, vx: -Math.cos(a) * 240, vy: -Math.sin(a) * 170, size: 5.5, size1: 1.5, pal: pk, add: true, life: 0.28 });
      }
      holdMs = Math.max(holdMs, 65);
      stats.ults++;
    },
    /** Internal: the deferred target-side spectacle of an ultimate, at its contact point. */

    buff({ x, y, paletteKey = "sun" }) {
      const pk = normalizePalKey(paletteKey);
      spawnHeroPillarAura({ x, y, radius: 52, palKey: pk, mode: "buff" });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        spawnP({ shape: i % 2 === 0 ? "star" : "px", x: x + Math.cos(a) * 28, y: y + 8 + Math.sin(a) * 15, vx: Math.cos(a) * 20, vy: -120 - rand() * 80, size: 6.5, size1: 1.5, pal: pk, add: true, life: 0.48 });
      }
    },

    heal({ x, y }) {
      spawnHeroPillarAura({ x, y, radius: 52, palKey: "wood", mode: "heal" });
      for (let i = 0; i < 18; i++) {
        const a = rand() * TAU;
        const r = 8 + rand() * 30;
        spawnP({ shape: i % 3 === 0 ? "rose" : "star", x: x + Math.cos(a) * r, y: y + 10 + Math.sin(a) * r * 0.5, vx: 0, vy: -95 - rand() * 75, size: 7, size1: 2, pal: i % 3 === 0 ? "rose" : "wood", add: true, life: 0.52 });
      }
    },

    parry({ x, y }) {
      shields.push({ x, y: y - 10, radius: 48, color: 0x7fe9ff, core: 0xffffff, age: 0, life: 0.44 });
      spawnP({ shape: "star", x, y: y - 10, size: 28, size1: 4, pal: "white", add: true, life: 0.24 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        spawnP({ shape: "streak", x, y: y - 10, vx: Math.cos(a) * 240, vy: Math.sin(a) * 200, size: 5, size1: 1, pal: "sun", add: true, life: 0.20 });
      }
    },

    clash({ x, y }) {
      spawnP({ shape: "star", x, y, size: 34, size1: 4, pal: "white", add: true, life: 0.24 });
      emitElementBurst({ x, y, palKey: "spark", scale: 1.25, heavy: true });
      addLightning(x - 28, y - 22, x + 28, y + 22, "thunder", 3.2, 0.20);
      addLightning(x + 26, y - 24, x - 26, y + 20, "thunder", 3.2, 0.20);
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
      emitFluidStream({ x: pos.x, y: pos.y + 4, angle, palKey: pk, range: 250, puffs: 14 });
      stats.releases++;
      return true;
    },

    vortex({ x, y, moveId = "vortex", radius = 118, paletteKey = null, durationSec = 0.95 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(paletteKey || spec.paletteKey || "wind");
      const r = clamp(radius, 56, 138);
      spawnHeroVortex({ x, y, radius: r, palKey: pk, durationSec });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        spawnP({
          shape: pk === "wood" ? "rose" : (pk === "ice" ? "shard" : "streak"),
          x: x + Math.cos(a) * r * 0.55, y: y + Math.sin(a) * r * 0.3,
          vx: -Math.sin(a) * 210, vy: Math.cos(a) * 95 - 85,
          size: 6, size1: 1.5, pal: pk, add: true, life: 0.46
        });
      }
      stats.releases++;
      return true;
    },

    wallShatter({ x, y, angle = 0, material = "STONE" }) {
      const pk = COVER_PALETTE_KEY[String(material ?? "STONE").toUpperCase()] ?? "earth";
      spawnP({ shape: "star", x, y, size: 26, size1: 4, pal: "white", add: true, life: 0.20 });
      for (let i = 0; i < 14; i++) {
        const a = angle + (rand() - 0.5) * 1.4;
        const spd = 170 + rand() * 230;
        spawnP({
          shape: "shard", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.8,
          vz: 115 + rand() * 130, gravity: 420, size: 7 + rand() * 5, size1: 2,
          rot: a, vrot: (rand() - 0.5) * 14, pal: pk, add: false, life: 0.48
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
      spawnHeroShockwave({ x, y: y + 6, radius, palKey: pk, spiresCount: 4 });
      emitElementBurst({ x, y, palKey: pk, scale: clamp(radius / 85, 1.0, 1.55), heavy: true });
      if (kind.includes("IGNITE") || kind.includes("ECLIPSE")) holdMs = Math.max(holdMs, 52);
      stats.hits++;
      return true;
    },

    groundSpike({ x, y, moveId = "shardVolley", scale = 1.0 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "earth");
      // Tall dramatic 3D faceted spire + twin side shards + dust burst!
      const rad = clamp(24 * scale, 18, 34);
      addSpire({ x, y: y + 2, radius: rad, pal: pk, life: 0.58 });
      addSpire({ x: x - rad * 0.72, y: y + 8, radius: rad * 0.62, pal: pk, life: 0.50, delay: 0.04 });
      addSpire({ x: x + rad * 0.72, y: y + 8, radius: rad * 0.62, pal: pk, life: 0.50, delay: 0.06 });
      for (let i = 0; i < 8; i++) {
        const a = rand() * TAU;
        spawnP({ shape: i % 2 === 0 ? "shard" : "pxpuff", x, y, vx: Math.cos(a) * 105, vy: Math.sin(a) * 65, vz: 145 + rand() * 95, gravity: 440, size: 6.5, size1: 1.8, pal: pk, add: false, life: 0.38 });
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
      for (let i = 0; i < 8; i++) {
        const a = rand() * TAU;
        spawnP({ shape: i % 2 === 0 ? "pxpuff" : "shard", x: pos.x + Math.cos(a) * 16, y: pos.y + 4, vx: Math.cos(a) * 75, vy: Math.sin(a) * 45, vz: 105 + rand() * 65, gravity: 380, size: 8.5, size1: 3.5, pal: pk === "ice" ? "ice" : "dust", add: false, life: 0.40 });
      }
      addDecal({ x: pos.x, y: pos.y + 6, kind: "crack", radius: 26, pal: pk });
      stats.releases++;
      return true;
    },

    craterShockwave({ x, y, moveId = "quakeSlam", radius = 140 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "earth");
      addDecal({ x, y: y + 8, kind: pk === "ice" ? "frost" : "crack", radius: Math.min(68, radius * 0.48), pal: pk, life: 4.0 });
      spawnHeroShockwave({ x, y: y + 6, radius, palKey: pk, spiresCount: 6 });
      emitElementBurst({ x, y, palKey: pk, scale: 1.3, heavy: true });
      stats.hits++;
      return true;
    },

    meteorDrop({ x, y, moveId = "flameRing", radius = 118 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "fire");
      const count = spec.tier === "ultimate" ? 4 : 3;
      spawnHeroMeteor({ x, y, radius, palKey: pk, count });
      stats.releases++;
      return true;
    },

    psychicCage({ x, y, moveId = "nightPulse", mode = "telekinesis", radius = 100 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pk = normalizePalKey(spec.paletteKey || "moon");
      const r = clamp(radius * 0.78, 42, 92);
      const hex = paletteHex(pk);
      addHero({
        kind: "HERO_CAGE",
        x, y, radius: r, palKey: pk, mainHex: hex.main, coreHex: hex.core,
        life: 0.65
      });
      if (mode === "cage" && (pk === "ice" || pk === "earth" || pk === "wood" || pk === "metal")) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.3;
          addSpire({ x: x + Math.cos(a) * r * 0.56, y: y + Math.sin(a) * r * 0.36, radius: 18, pal: pk, life: 0.68 });
        }
      } else {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          spawnP({ shape: "star", x: x + Math.cos(a) * r * 0.52, y: y - 8 + Math.sin(a) * r * 0.35, vx: 0, vy: -55, size: 7, size1: 1.5, pal: pk, add: true, life: 0.46 });
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
      emitFluidStream({ x, y, angle, palKey: pk, range, puffs: 15 });
      return true;
    },

    prop({ x, y, material = "STONE", broken = false, weak = false }) {
      const pk = COVER_PALETTE_KEY[String(material ?? "STONE").toUpperCase()] ?? "earth";
      const n = broken ? 14 : weak ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU;
        spawnP({ shape: i % 2 === 0 ? "shard" : "pxpuff", x, y: y - 14, vx: Math.cos(a) * (85 + rand() * 150), vy: Math.sin(a) * 75, vz: 105 + rand() * 125, gravity: 420, size: broken ? 8 : 5, size1: 1.5, pal: pk, add: false, life: 0.42 });
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
      const stops = [[0, [255, 255, 255], 0.96], [0.45, [r, g, b], 0.82], [1, [r, g, b], 0]];
      spawnP({ shape: "star", x, y, size: clamp(radius * 0.34, 12, 26), size1: 3, stops, add: true, life: 0.22 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rand() * 0.3;
        spawnP({ shape: "streak", x, y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 120, size: 4.5, size1: 1, stops, add: true, life: 0.22 });
      }
      return true;
    },

    drawsShots: () => true,

    /** Organic multi-lobe low-alpha ground puddles + subtle rising ambient particles (ZERO harsh outer stroked circle!). */
    syncPuddles(puddles = []) {
      const seen = new Set();
      for (const p of puddles) {
        if (!p || p.done) continue;
        seen.add(p.id);
        const cfg = PUDDLE_CONFIG[p.kind] ?? PUDDLE_CONFIG.WATER_PUDDLE;
        let entry = livePuddles.get(p.id);
        if (!entry || entry.kind !== p.kind) {
          entry = { id: p.id, kind: p.kind, x: p.x, y: p.y + 6, radius: p.radius, ttl: p.ttl ?? 3, cfg, tick: rand() * 0.25, seed: rand() * 100 };
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
      fxClock += dt;
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

      // 2) Update organic puddles & minimal corner-bracket telegraphs on groundGfx (ZERO concentric ring spam!)
      if (groundGfx) {
        groundGfx.clear();
        for (const entry of livePuddles.values()) {
          const fade = clamp((entry.ttl ?? 1) / 1.2, 0.12, 1);
          const hex = paletteHex(entry.cfg.pal);
          const rx = entry.radius * 0.92, ry = entry.radius * 0.52;
          if (typeof groundGfx.ellipse === "function") {
            // Soft organic multi-lobe blotches without any harsh outer wireframe ring!
            groundGfx.ellipse(entry.x, entry.y, rx, ry).fill({ color: hex.main, alpha: entry.cfg.alpha * 0.42 * fade });
            groundGfx.ellipse(entry.x + rx * 0.22, entry.y - ry * 0.12, rx * 0.65, ry * 0.62).fill({ color: hex.main, alpha: entry.cfg.alpha * 0.32 * fade });
            groundGfx.ellipse(entry.x - rx * 0.18, entry.y + ry * 0.12, rx * 0.56, ry * 0.54).fill({ color: hex.core, alpha: entry.cfg.alpha * 0.28 * fade });
          } else {
            groundGfx.circle(entry.x, entry.y, rx * 0.8).fill({ color: hex.main, alpha: entry.cfg.alpha * 0.42 * fade });
          }
          entry.tick += stepDt;
          if (!reducedMotion && entry.tick >= entry.cfg.rate) {
            entry.tick = 0;
            const a = rand() * TAU;
            const d = rand() * entry.radius * 0.65;
            spawnP({
              shape: entry.cfg.ambient,
              x: entry.x + Math.cos(a) * d, y: entry.y + Math.sin(a) * d * 0.55,
              vx: (rand() - 0.5) * 16, vy: -30 - rand() * 34,
              size: entry.cfg.ambient === "pxpuff" ? 6 : 4, size1: 1.5,
              pal: entry.cfg.pal, add: entry.cfg.pal === "fire" || entry.cfg.pal === "thunder",
              alphaMul: 0.78, life: 0.40
            });
          }
        }
        for (let i = telegraphs.length - 1; i >= 0; i--) {
          const tg = telegraphs[i];
          tg.age += dt;
          if (tg.age >= tg.life) { telegraphs.splice(i, 1); continue; }
          const k = clamp(tg.age / tg.life, 0, 1);
          const a = (1 - k * 0.4) * 0.52;
          if (tg.shape === "rect") {
            const len = Math.min(tg.range, 560);
            const hw = Math.max(14, tg.radius * 0.52);
            const c = Math.cos(tg.angle), s = Math.sin(tg.angle), nx = -s * hw, ny = c * hw;
            const ex = tg.x + c * len, ey = tg.y + s * len;
            if (typeof groundGfx.poly === "function") {
              groundGfx.poly([tg.x + nx, tg.y + ny, ex + nx, ey + ny, ex - nx, ey - ny, tg.x - nx, tg.y - ny])
                .fill({ color: tg.color, alpha: 0.10 * a });
              // Crisp directional center aim chevrons instead of heavy box outline
              for (let ch = 1; ch <= 3; ch++) {
                const cf = ch / 4;
                const cx = tg.x + c * len * cf, cy = tg.y + s * len * cf;
                groundGfx.moveTo(cx - c * 10 + nx * 0.45, cy - s * 10 + ny * 0.45)
                  .lineTo(cx + c * 8, cy + s * 8)
                  .lineTo(cx - c * 10 - nx * 0.45, cy - s * 10 - ny * 0.45)
                  .stroke({ color: tg.core, width: 2.0, alpha: 0.55 * a, cap: "round", join: "round" });
              }
            }
          } else {
            // Subtle 4-segment dashed ground corner reticle + tiny center crosshair (ZERO giant empty circles!)
            const r = Math.min(135, tg.radius * 0.85);
            if (typeof groundGfx.ellipse === "function") {
              groundGfx.ellipse(tg.x, tg.y, r, r * 0.60).fill({ color: tg.color, alpha: 0.08 * a });
            }
            for (let seg = 0; seg < 4; seg++) {
              const a0 = seg * (Math.PI * 0.5) + 0.28;
              const a1 = a0 + 0.52;
              const steps = 4;
              groundGfx.moveTo(tg.x + Math.cos(a0) * r, tg.y + Math.sin(a0) * r * 0.60);
              for (let st = 1; st <= steps; st++) {
                const aa = a0 + (a1 - a0) * (st / steps);
                groundGfx.lineTo(tg.x + Math.cos(aa) * r, tg.y + Math.sin(aa) * r * 0.60);
              }
              groundGfx.stroke({ color: tg.core, width: 1.8, alpha: 0.52 * a, cap: "round" });
            }
            const cr = 7 * (1.2 - k * 0.5);
            groundGfx.moveTo(tg.x - cr, tg.y).lineTo(tg.x + cr, tg.y).stroke({ color: tg.core, width: 1.5, alpha: 0.55 * a });
            groundGfx.moveTo(tg.x, tg.y - cr * 0.6).lineTo(tg.x, tg.y + cr * 0.6).stroke({ color: tg.core, width: 1.5, alpha: 0.55 * a });
          }
        }
      }

      // 3) Update depth layer (3D faceted spires + crystalline hexagonal shields)
      if (depthGfx) {
        depthGfx.clear();
        for (let i = spires.length - 1; i >= 0; i--) {
          const sp = spires[i];
          sp.age += stepDt;
          if (sp.age < 0) continue;
          if (sp.age >= sp.life) { spires.splice(i, 1); continue; }
          const k = sp.age / sp.life;
          const rise = k < 0.18 ? k / 0.18 : 1;
          const alpha = k > 0.72 ? clamp((1 - k) / 0.28, 0, 1) : 1;
          drawFacetedSpire(depthGfx, sp.x, sp.y - rise * sp.radius * 0.42, sp.radius * (0.45 + 0.55 * rise), sp.rot, sp.seed, sp.pal, alpha);
        }
        for (let i = shields.length - 1; i >= 0; i--) {
          const sh = shields[i];
          sh.age += dt;
          if (sh.age >= sh.life) { shields.splice(i, 1); continue; }
          const k = sh.age / sh.life;
          const a = (1 - k * 0.65) * 0.85;
          if (typeof depthGfx.poly === "function") {
            const outerHex = [], innerHex = [];
            for (let s = 0; s < 6; s++) {
              const ang = sh.age * 1.8 + (s / 6) * TAU;
              outerHex.push(sh.x + Math.cos(ang) * sh.radius, sh.y + Math.sin(ang) * sh.radius);
              innerHex.push(sh.x + Math.cos(ang) * sh.radius * 0.68, sh.y + Math.sin(ang) * sh.radius * 0.68);
            }
            depthGfx.poly(outerHex).fill({ color: sh.color, alpha: 0.22 * a }).stroke({ color: sh.core, width: 2.6, alpha: a });
            depthGfx.poly(innerHex).stroke({ color: sh.core, width: 1.5, alpha: 0.68 * a });
          } else {
            depthGfx.circle(sh.x, sh.y, sh.radius).fill({ color: sh.color, alpha: 0.22 * a });
          }
        }
      }

      // 4) Update procedural projectiles + emit rich element-matched particle trails
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
        const emitInterval = s.arch === "DRAG_WAVE" ? 0.022 : 0.028;
        if (!reducedMotion && s.trailAcc >= emitInterval) {
          s.trailAcc = 0;
          const trailShape = (s.palKey === "fire" || s.palKey === "water" || s.palKey === "moon" || s.arch === "DRAG_WAVE") ? "pxpuff"
            : (s.palKey === "ice" || s.palKey === "metal") ? "shard"
            : s.palKey === "wood" ? "rose"
            : s.palKey === "sun" ? "star"
            : s.palKey === "thunder" ? "streak" : "px";
          spawnP({
            shape: trailShape,
            x: pos.x - Math.cos(s.angle) * 8 + (rand() - 0.5) * (s.arch === "DRAG_WAVE" ? 42 : 8),
            y: pos.y - Math.sin(s.angle) * 8 + (rand() - 0.5) * (s.arch === "DRAG_WAVE" ? 30 : 8),
            vx: -Math.cos(s.angle) * 42 + (rand() - 0.5) * 32,
            vy: -Math.sin(s.angle) * 42 + (rand() - 0.5) * 32,
            size: s.radius * (trailShape === "pxpuff" ? 0.72 : 0.45),
            size1: 1.5,
            rot: s.angle + rand(),
            stops: s.stops,
            add: trailShape !== "pxpuff",
            alphaMul: 0.88,
            life: 0.20 + rand() * 0.14
          });
        }
      }

      // 5) Draw particles + Hero Showpieces + 10-Element Projectiles + Lightning on topGfx / topAddGfx
      if (topGfx) topGfx.clear();
      if (topAddGfx) topAddGfx.clear();

      for (let i = heroEffects.length - 1; i >= 0; i--) {
        const h = heroEffects[i];
        h.age += stepDt;
        if (h.age >= h.life) { heroEffects.splice(i, 1); continue; }
        drawHeroEffect(h, stepDt);
      }

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

      for (const s of liveShots) {
        if (s.prevX === null) continue;
        drawHeroProjectile(s);
      }

      if (topAddGfx) {
        for (let i = lightningBolts.length - 1; i >= 0; i--) {
          const b = lightningBolts[i];
          b.age += dt;
          if (b.age >= b.life) { lightningBolts.splice(i, 1); continue; }
          const a = clamp(1 - b.age / b.life, 0, 1);
          drawJaggedBolt(topAddGfx, b.x0, b.y0, b.x1, b.y1, b.width, b.main, b.core, a, b.seed + Math.floor(b.age * 42));
        }
      }

      // 6) Draw thick 4-pass animated STREAM_BEAM conduits + streaming pxpuff billows on beamConduitGfx
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
          const pulse = 0.88 + 0.20 * Math.sin(bc.age * 46 + i * 1.7);
          const wOuter = bc.width * pulse * (0.5 + 0.5 * alpha);
          if (bc.palKey === "thunder") {
            const jTick = Math.floor(bc.age * 38);
            drawJaggedBolt(beamConduitGfx, bc.originX, bc.originY, bc.lastX, bc.lastY, wOuter * 0.34, bc.main, 0xffffff, alpha, i * 11 + jTick);
            drawJaggedBolt(beamConduitGfx, bc.originX, bc.originY, bc.lastX, bc.lastY, wOuter * 0.22, bc.main, bc.core, alpha * 0.9, i * 17 + 29 + jTick);
            drawJaggedBolt(beamConduitGfx, bc.originX, bc.originY, bc.lastX, bc.lastY, wOuter * 0.18, bc.main, bc.core, alpha * 0.8, i * 23 + 53 + jTick);
          } else {
            drawBoltRibbon(beamConduitGfx, bc.originX, bc.originY, bc.lastX, bc.lastY, wOuter, bc.main, bc.core, alpha, bc.age, i + 1);
          }
          // Emit streaming volumetric pxpuff / shard / spark billows along the live beam path!
          bc.puffAcc += stepDt;
          if (!reducedMotion && bc.puffAcc >= 0.035) {
            bc.puffAcc = 0;
            const f = 0.2 + rand() * 0.72;
            const bx = bc.originX + dx * f + (rand() - 0.5) * 10;
            const by = bc.originY + dy * f + (rand() - 0.5) * 10;
            const bShape = (bc.palKey === "fire" || bc.palKey === "water" || bc.palKey === "moon" || bc.palKey === "dragon") ? "pxpuff"
              : (bc.palKey === "ice" || bc.palKey === "metal") ? "shard"
              : bc.palKey === "wood" ? "rose" : "star";
            spawnP({
              shape: bShape, x: bx, y: by,
              vx: (dx / dist) * 120 + (rand() - 0.5) * 45,
              vy: (dy / dist) * 120 + (rand() - 0.5) * 45,
              size: bShape === "pxpuff" ? 11 : 6.5, size1: bShape === "pxpuff" ? 18 : 1.5,
              stops: bc.stops, add: bShape !== "pxpuff", alphaMul: 0.9, life: 0.22
            });
          }
        }
      }
    },

    holding: () => holdMs > 0,

    getDiagnostics: () => Object.freeze({
      ...stats,
      particles: particles.length,
      heroes: heroEffects.length,
      decals: decals.length,
      scars: decals.length,
      spires: spires.length,
      liveShots: liveShots.length,
      beamConduits: beamConduits.length
    }),

    dispose() {
      particles.length = 0;
      heroEffects.length = 0;
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
