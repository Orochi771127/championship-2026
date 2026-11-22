// Data Arena Unified PixelFX 3D Terrain, Organic Shield Walls, Burrow & Ground Spikes (2026-11-22).
//
// Strict Unified PixelFX Aesthetic:
//  - ZERO flat CSS / plain Canvas rectangular boxes!
//  - Every shield wall is a hand-sculpted 3D organic terrain barricade (layered mountain rock outcrop,
//    gnarled oak tree trunk & roots with pixel foliage, faceted glacial crystal ice spires, volcanic
//    obsidian-magma crags, prismatic elemental crystals, beveled armored chevron bastion).
//  - Every burrow tunnel & ground spike projects in true 3D across all 360 degrees with Bayer 2x2
//    PixelFX dithering, curated 6-tone palette snap, grounded Z=0 shadow, and crisp 1px dark ink outline.

import { finishPixelFxPass } from "./dataArenaVolumetricFx3D.js";

const Y_PITCH = 0.56;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rgbCss(c, a = 1) {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

// ============================================================================
// Move #3: Organic Sculpted 3D PixelFX Elemental Shield Walls (6 Materials!)
// ============================================================================

const WALL_PALETTES = Object.freeze({
  STONE: {
    lit: [238, 224, 198],
    hi: [198, 178, 148],
    mid: [148, 128, 102],
    deep: [98, 82, 66],
    shadow: [58, 48, 38],
    accent: [122, 166, 94], // subtle moss specks on granite base
    ink: [26, 20, 16]
  },
  WOOD: {
    lit: [214, 158, 104],
    hi: [176, 114, 66],
    mid: [132, 78, 42],
    deep: [86, 48, 24],
    shadow: [52, 28, 14],
    leafLit: [184, 242, 122],
    leafMid: [86, 192, 92],
    leafDeep: [38, 118, 56],
    ink: [24, 14, 10]
  },
  ICE: {
    lit: [252, 255, 255],
    hi: [194, 244, 255],
    mid: [108, 204, 246],
    deep: [48, 134, 204],
    shadow: [24, 72, 136],
    accent: [255, 255, 255],
    ink: [14, 34, 68]
  },
  BASALT: {
    lit: [126, 114, 122],
    hi: [88, 76, 84],
    mid: [58, 48, 56],
    deep: [38, 30, 36],
    shadow: [22, 16, 20],
    lavaCore: [255, 248, 196],
    lavaMain: [255, 136, 44],
    ink: [14, 10, 14]
  },
  CRYSTAL_LIGHT: {
    lit: [255, 254, 232],
    hi: [255, 232, 126],
    mid: [244, 182, 54],
    deep: [182, 108, 24],
    shadow: [110, 58, 14],
    accent: [255, 255, 255],
    ink: [56, 28, 8]
  },
  CRYSTAL_WATER: {
    lit: [244, 254, 255],
    hi: [136, 232, 255],
    mid: [42, 168, 240],
    deep: [18, 104, 188],
    shadow: [10, 54, 116],
    accent: [255, 255, 255],
    ink: [10, 26, 56]
  },
  CRYSTAL_DARK: {
    lit: [246, 220, 255],
    hi: [200, 124, 255],
    mid: [134, 62, 208],
    deep: [74, 28, 136],
    shadow: [38, 14, 76],
    accent: [255, 224, 255],
    ink: [20, 8, 42]
  },
  METAL: {
    lit: [236, 246, 255],
    hi: [176, 196, 214],
    mid: [114, 134, 154],
    deep: [66, 82, 100],
    shadow: [36, 46, 60],
    energy: [112, 246, 255],
    ink: [16, 22, 32]
  }
});

function resolveWallPalette(material = "STONE", element = null) {
  if (material === "CRYSTAL") {
    if (element === "shadow" || element === "dark") return WALL_PALETTES.CRYSTAL_DARK;
    if (element === "light") return WALL_PALETTES.CRYSTAL_LIGHT;
    return WALL_PALETTES.CRYSTAL_WATER;
  }
  return WALL_PALETTES[material] ?? WALL_PALETTES.STONE;
}

/**
 * Helper: push a 3D faceted tapered prism / crag / spire into painter's drawItems!
 */
function pushFacetedPrism(drawItems, project, {
  cx = 0, cy = 0, baseZ = 0, height = 38, rx = 14, ry = 10, topScale = 0.25,
  topShiftX = 0, topShiftY = 0, sides = 6, rotOffset = 0,
  colors, seed = 1, magma = false
}) {
  const bot = [];
  const top = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rotOffset;
    const jitterB = 0.86 + 0.26 * Math.abs(Math.sin(i * 3.7 + seed * 1.9));
    const jitterT = 0.82 + 0.30 * Math.abs(Math.cos(i * 2.9 + seed * 2.3));
    const bx = cx + Math.cos(a) * rx * jitterB;
    const by = cy + Math.sin(a) * ry * jitterB;
    const tx = cx + topShiftX + Math.cos(a) * rx * topScale * jitterT;
    const ty = cy + topShiftY + Math.sin(a) * ry * topScale * jitterT;
    const tz = baseZ + height * (0.92 + 0.14 * Math.sin(i * 2.3 + seed));
    bot.push({ p: project(bx, by, baseZ), a });
    top.push({ p: project(tx, ty, tz), a });
  }
  // Side facets
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const p0 = bot[i].p, p1 = bot[j].p, p2 = top[j].p, p3 = top[i].p;
    const midX = (p0.wx + p1.wx) * 0.5 - cx;
    const midY = (p0.wy + p1.wy) * 0.5 - cy;
    // Directional sunlight from upper-left (-x, +y slightly)
    const light = (-midX * 0.65 + midY * 0.45) / Math.max(4, Math.hypot(midX, midY));
    const col = light > 0.38 ? colors.hi : light > -0.08 ? colors.mid : light > -0.52 ? colors.deep : colors.shadow;
    drawItems.push({
      depth: (p0.depth + p1.depth + p2.depth + p3.depth) * 0.25,
      kind: "poly",
      pts: [p0, p1, p2, p3],
      color: col
    });
    // Volcanic magma veins glowing in rock fissures!
    if (magma && i % 2 === 0 && midY > -2) {
      const m0 = { sx: (p0.sx + p1.sx) * 0.5, sy: (p0.sy + p1.sy) * 0.5 };
      const m1 = { sx: (p2.sx + p3.sx) * 0.5, sy: (p2.sy + p3.sy) * 0.5 };
      const midPt = { sx: (m0.sx + m1.sx) * 0.5 + (i % 4 === 0 ? 3 : -3), sy: (m0.sy + m1.sy) * 0.5 };
      drawItems.push({
        depth: (p0.depth + p1.depth + p2.depth + p3.depth) * 0.25 + 0.6,
        kind: "crack",
        pts: [m0, midPt, m1],
        width: 2.6,
        color: colors.lavaMain
      });
      drawItems.push({
        depth: (p0.depth + p1.depth + p2.depth + p3.depth) * 0.25 + 0.9,
        kind: "crack",
        pts: [m0, midPt, m1],
        width: 1.2,
        color: colors.lavaCore
      });
    }
  }
  // Top cap facet (sunlit!)
  const topPts = top.map((v) => v.p);
  const topDepth = topPts.reduce((s, v) => s + v.depth, 0) / topPts.length + 0.3;
  drawItems.push({
    depth: topDepth,
    kind: "poly",
    pts: topPts,
    color: colors.lit
  });
}

/**
 * Render a hand-sculpted 3D PixelFX organic elemental shield barricade!
 * Supports 6 distinct sculpted forms (STONE rock formation, WOOD oak trunk & roots,
 * ICE crystal spires, BASALT lava crags, CRYSTAL prism cluster, METAL chevron bastion),
 * continuous 360-degree orientation (`angle`), eruption `rise` (0..1), and 3 damage tiers (0..2).
 */
export function renderVolumetricShieldWall3D(ctx, {
  width = 112,
  height = 104,
  material = "STONE",
  element = null,
  angle = 0,
  rise = 1,
  damageTier = 0
} = {}) {
  const pal = resolveWallPalette(material, element);
  ctx.clearRect(0, 0, width, height);
  const r = clamp(rise, 0.08, 1);
  // Orient barricade naturally along the shield axis, keeping generous 3D girth from BOTH
  // horizontal (east-west duel) and vertical (north-south duel) camera angles!
  const wallAngle = angle;
  const cosA = Math.cos(wallAngle);
  const sinA = Math.sin(wallAngle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.74);

  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return {
      sx: cx + wx,
      sy: cy + wy * Y_PITCH - lz * r,
      wx,
      wy,
      wz: lz * r,
      depth: wy * 0.83 + lz * r * 0.55
    };
  };

  // 1. Grounded contact shadow on Z = 0
  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 28, 0.38)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 30 * (0.65 + 0.35 * r), 15 * (0.65 + 0.35 * r), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];
  const dmgShrink = damageTier === 2 ? 0.78 : damageTier === 1 ? 0.90 : 1.0;

  if (material === "WOOD") {
    // GNARLED ANCIENT TREE TRUNK + SPRAWLING ROOTS + LEAFY PIXEL CANOPY TUFTS!
    // 4 twisting surface roots gripping the arena dirt
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const rx0 = Math.cos(a) * 10, ry0 = Math.sin(a) * 8;
      const rx1 = Math.cos(a) * 25, ry1 = Math.sin(a) * 18;
      const p0 = project(rx0, ry0, 12);
      const p1 = project((rx0 + rx1) * 0.5, (ry0 + ry1) * 0.5, 6);
      const p2 = project(rx1, ry1, 1);
      drawItems.push({
        depth: p1.depth - 0.5,
        kind: "root",
        pts: [p0, p1, p2],
        width: 5.5,
        color: i % 2 === 0 ? pal.mid : pal.deep
      });
    }
    // Main rugged bark trunk (twisted stacked rings, NOT a rectangle!)
    pushFacetedPrism(drawItems, project, {
      cx: -6, cy: 0, baseZ: 0, height: 42 * dmgShrink, rx: 14, ry: 11, topScale: 0.72,
      topShiftX: -3, topShiftY: 0, sides: 8, rotOffset: 0.2, colors: pal, seed: 3
    });
    // Secondary intertwined trunk beside it forming a solid natural barricade
    pushFacetedPrism(drawItems, project, {
      cx: 10, cy: 2, baseZ: 0, height: 34 * dmgShrink, rx: 12, ry: 9, topScale: 0.65,
      topShiftX: 4, topShiftY: -2, sides: 7, rotOffset: 0.6, colors: pal, seed: 7
    });
    // Broken gnarled side bough jutting outward
    pushFacetedPrism(drawItems, project, {
      cx: 17, cy: -1, baseZ: 14, height: 15 * dmgShrink, rx: 6, ry: 5, topScale: 0.5,
      topShiftX: 9, topShiftY: 1, sides: 6, rotOffset: 0.1, colors: pal, seed: 11
    });
    // Lush layered pixel-art emerald foliage clusters sprouting on top!
    const tufts = [
      { x: -12, y: -2, z: 42 * dmgShrink, rx: 12, ry: 8 },
      { x: 0, y: 2, z: 46 * dmgShrink, rx: 14, ry: 9 },
      { x: 13, y: 0, z: 36 * dmgShrink, rx: 11, ry: 8 },
      { x: -4, y: 5, z: 38 * dmgShrink, rx: 10, ry: 7 },
      { x: 8, y: -4, z: 40 * dmgShrink, rx: 10, ry: 7 }
    ];
    tufts.forEach((tf, idx) => {
      const pp = project(tf.x, tf.y, tf.z);
      drawItems.push({ depth: pp.depth + 2.0, kind: "puff", x: pp.sx, y: pp.sy + 3, rx: tf.rx, ry: tf.ry, color: pal.leafDeep });
      drawItems.push({ depth: pp.depth + 2.4, kind: "puff", x: pp.sx - 1, y: pp.sy, rx: tf.rx * 0.88, ry: tf.ry * 0.82, color: pal.leafMid });
      drawItems.push({ depth: pp.depth + 2.8, kind: "puff", x: pp.sx - 3, y: pp.sy - 2, rx: tf.rx * 0.55, ry: tf.ry * 0.50, color: idx % 2 === 0 ? pal.leafLit : pal.leafMid });
    });
  } else if (material === "ICE" || material === "CRYSTAL") {
    // JAGGED GLACIAL / PRISMATIC CRYSTAL SPIRE CLUSTER!
    // Frosted snow/crystal base collar
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pp = project(Math.cos(a) * 20, Math.sin(a) * 11, 2);
      drawItems.push({ depth: pp.depth - 1.5, kind: "puff", x: pp.sx, y: pp.sy, rx: 7, ry: 4.5, color: pal.hi });
    }
    // 5 dramatic angled hexagonal crystal spires bursting upward!
    const spires = [
      { cx: -16, cy: 1, h: 30, rx: 9, ry: 7, sx: -7, sy: 1, s: 2 },
      { cx: -5, cy: -2, h: 48, rx: 11, ry: 9, sx: -3, sy: -2, s: 5 },
      { cx: 6, cy: 2, h: 42, rx: 10, ry: 8, sx: 4, sy: 1, s: 9 },
      { cx: 17, cy: 0, h: 28, rx: 8, ry: 6, sx: 8, sy: 0, s: 13 },
      { cx: 0, cy: 6, h: 24, rx: 9, ry: 6, sx: 1, sy: 4, s: 17 }
    ];
    for (const sp of spires) {
      pushFacetedPrism(drawItems, project, {
        cx: sp.cx, cy: sp.cy, baseZ: 0, height: sp.h * dmgShrink, rx: sp.rx, ry: sp.ry,
        topScale: 0.14, topShiftX: sp.sx, topShiftY: sp.sy, sides: 6, rotOffset: sp.s * 0.3,
        colors: pal, seed: sp.s
      });
    }
    // Specular PixelFX crystal sparkle glints
    const glints = [project(-6, 0, 44 * dmgShrink), project(8, 2, 37 * dmgShrink), project(-17, 1, 26 * dmgShrink)];
    glints.forEach((gp) => {
      drawItems.push({ depth: gp.depth + 4, kind: "spark", x: gp.sx, y: gp.sy, color: pal.accent });
    });
  } else if (material === "METAL") {
    // BEVELED ANGLED ARMORED CHEVRON BLAST-BASTION (Sci-fi Data Shield!)
    // Left & right angled wing buttresses
    pushFacetedPrism(drawItems, project, {
      cx: -17, cy: 3, baseZ: 0, height: 34 * dmgShrink, rx: 9, ry: 8, topScale: 0.72,
      topShiftX: 2, topShiftY: -2, sides: 6, rotOffset: 0.4, colors: pal, seed: 4
    });
    pushFacetedPrism(drawItems, project, {
      cx: 17, cy: 3, baseZ: 0, height: 34 * dmgShrink, rx: 9, ry: 8, topScale: 0.72,
      topShiftX: -2, topShiftY: -2, sides: 6, rotOffset: 0.4, colors: pal, seed: 8
    });
    // Central tall beveled armored shield core
    pushFacetedPrism(drawItems, project, {
      cx: 0, cy: -1, baseZ: 0, height: 44 * dmgShrink, rx: 14, ry: 10, topScale: 0.78,
      topShiftX: 0, topShiftY: 0, sides: 6, rotOffset: Math.PI / 6, colors: pal, seed: 2
    });
    // Glowing cyan energy shield core chevron across the front face
    const e0 = project(-13, 9, 20 * dmgShrink);
    const e1 = project(0, 11, 26 * dmgShrink);
    const e2 = project(13, 9, 20 * dmgShrink);
    drawItems.push({ depth: e1.depth + 3.5, kind: "crack", pts: [e0, e1, e2], width: 3.4, color: pal.energy });
    drawItems.push({ depth: e1.depth + 3.8, kind: "crack", pts: [e0, e1, e2], width: 1.5, color: pal.lit });
  } else {
    // STONE (Craggy Layered Mountain Granite Formation) & BASALT (Volcanic Magma Crags!)
    const isBasalt = material === "BASALT";
    const crags = [
      { cx: -16, cy: 2, h: 28, rx: 12, ry: 9, ts: 0.45, sx: -3, sy: 0, s: 2 },
      { cx: -2, cy: -2, h: 45, rx: 16, ry: 12, ts: 0.36, sx: -2, sy: -1, s: 5 },
      { cx: 14, cy: 1, h: 35, rx: 13, ry: 10, ts: 0.40, sx: 3, sy: 0, s: 9 },
      { cx: 4, cy: 7, h: 21, rx: 11, ry: 8, ts: 0.52, sx: 1, sy: 2, s: 14 }
    ];
    for (const c of crags) {
      pushFacetedPrism(drawItems, project, {
        cx: c.cx, cy: c.cy, baseZ: 0, height: c.h * dmgShrink, rx: c.rx, ry: c.ry,
        topScale: c.ts, topShiftX: c.sx, topShiftY: c.sy, sides: 7, rotOffset: c.s * 0.4,
        colors: pal, seed: c.s, magma: isBasalt
      });
    }
    // Loose grounded rubble pebbles & subtle moss specks around the boulder base
    const pebbles = [[-24, 6, 4], [-12, 11, 3.5], [11, 11, 4], [24, 5, 3.5], [0, 12, 3]];
    pebbles.forEach(([px, py, pr], idx) => {
      const pp = project(px, py, 1.5);
      drawItems.push({ depth: pp.depth + 1.0, kind: "puff", x: pp.sx, y: pp.sy, rx: pr, ry: pr * 0.68, color: idx % 2 === 0 ? pal.hi : pal.mid });
      if (!isBasalt && idx === 1) {
        drawItems.push({ depth: pp.depth + 1.3, kind: "puff", x: pp.sx + 4, y: pp.sy - 3, rx: 3.5, ry: 2.2, color: pal.accent });
      }
    });
  }

  // Damage fracture cracks for damageTier >= 1
  if (damageTier >= 1) {
    const f0 = project(-6, 9, 30 * dmgShrink);
    const f1 = project(2, 10, 18 * dmgShrink);
    const f2 = project(-3, 9, 7 * dmgShrink);
    drawItems.push({ depth: f1.depth + 4.5, kind: "crack", pts: [f0, f1, f2], width: damageTier >= 2 ? 2.4 : 1.6, color: pal.ink });
    if (damageTier >= 2) {
      const g0 = project(10, 8, 26 * dmgShrink);
      const g1 = project(4, 9, 14 * dmgShrink);
      drawItems.push({ depth: g1.depth + 4.5, kind: "crack", pts: [g0, g1], width: 2.0, color: pal.ink });
    }
  }

  // Strict Painter's depth sort
  drawItems.sort((a, b) => a.depth - b.depth);
  for (const item of drawItems) {
    if (item.kind === "poly") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
      for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].sx, item.pts[i].sy);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === "puff") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.ellipse(item.x, item.y, Math.max(1, item.rx), Math.max(1, item.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === "root" || item.kind === "crack") {
      ctx.strokeStyle = rgbCss(item.color);
      ctx.lineWidth = item.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
      for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].sx, item.pts[i].sy);
      ctx.stroke();
    } else if (item.kind === "spark") {
      ctx.fillStyle = rgbCss(item.color);
      const sx = Math.round(item.x), sy = Math.round(item.y);
      ctx.fillRect(sx - 3, sy, 7, 1);
      ctx.fillRect(sx, sy - 3, 1, 7);
    }
  }

  // Unified PixelFX Bayer 2x2 dither + curated palette snap + crisp 1px dark outline!
  const paletteColors = Object.values(pal).filter((v) => Array.isArray(v) && v.length === 3);
  finishPixelFxPass(ctx, width, height, { paletteColors, ink: pal.ink, alphaFade: 1, dither: 10 });
}

// ============================================================================
// Move #4A & #4B: 3D Volumetric Ground Spikes (`GROUND_SPIKES`) & Burrow (`BURROW_AMBUSH`)
// ============================================================================

const SPIKE_PALETTES = Object.freeze({
  earth: {
    lit: [246, 228, 188],
    hi: [208, 176, 126],
    mid: [154, 118, 76],
    deep: [98, 72, 46],
    shadow: [58, 42, 28],
    dirt: [184, 146, 94],
    ink: [28, 18, 12]
  },
  ice: {
    lit: [252, 255, 255],
    hi: [188, 244, 255],
    mid: [96, 198, 246],
    deep: [42, 126, 198],
    shadow: [20, 66, 128],
    dirt: [216, 246, 255],
    ink: [14, 34, 68]
  },
  nature: {
    lit: [228, 255, 176],
    hi: [136, 224, 102],
    mid: [62, 166, 74],
    deep: [32, 104, 48],
    shadow: [18, 56, 28],
    dirt: [142, 110, 68],
    ink: [14, 34, 18]
  },
  fire: {
    lit: [255, 250, 206],
    hi: [255, 176, 62],
    mid: [232, 86, 32],
    deep: [132, 34, 28],
    shadow: [52, 24, 26],
    dirt: [112, 74, 58],
    ink: [34, 12, 14]
  },
  dark: {
    lit: [246, 218, 255],
    hi: [192, 112, 252],
    mid: [122, 50, 196],
    deep: [64, 22, 118],
    shadow: [30, 10, 62],
    dirt: [74, 46, 106],
    ink: [16, 6, 34]
  },
  thunder: {
    lit: [255, 254, 224],
    hi: [255, 226, 86],
    mid: [146, 164, 246],
    deep: [66, 78, 176],
    shadow: [30, 36, 98],
    dirt: [164, 138, 92],
    ink: [18, 20, 56]
  },
  water: {
    lit: [246, 254, 255],
    hi: [134, 228, 255],
    mid: [38, 156, 238],
    deep: [18, 96, 184],
    shadow: [10, 48, 110],
    dirt: [204, 244, 255],
    ink: [10, 26, 54]
  }
});

/**
 * Render a TRUE 3D sculpted Ground Spike / Stone Edge / Icicle Spire bursting out of the arena floor
 * tilted aggressively forward along `angle` (continuous 360 deg!).
 */
export function renderVolumetricGroundSpike3D(ctx, {
  width = 116,
  height = 116,
  angle = 0,
  phase = 0.45,
  paletteKey = "earth"
} = {}) {
  const pal = SPIKE_PALETTES[paletteKey] ?? SPIKE_PALETTES.earth;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  // Explosive punch upward -> hold sharp -> crumble down
  const thrust = p < 0.22 ? Math.sin((p / 0.22) * Math.PI * 0.5)
    : p < 0.72 ? 1.0
      : Math.max(0.08, 1 - (p - 0.72) / 0.28);
  const alphaFade = p > 0.80 ? Math.max(0, 1 - (p - 0.80) / 0.20) : 1;
  if (thrust <= 0.05 || alphaFade <= 0.02) return;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.76);

  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return {
      sx: cx + wx,
      sy: cy + wy * Y_PITCH - lz,
      wx,
      wy,
      wz: lz,
      depth: wy * 0.83 + lz * 0.55
    };
  };

  // Ground crater shadow (Z = 0)
  ctx.save();
  ctx.fillStyle = "rgba(12, 16, 26, 0.40)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 24 * (0.6 + 0.4 * thrust), 13 * (0.6 + 0.4 * thrust), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];

  // Cracked upturned dirt/frost rim chunks around the eruption hole
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const rad = 16 + (i % 2) * 4;
    const pp = project(Math.cos(a) * rad, Math.sin(a) * rad, 3 * thrust);
    drawItems.push({
      depth: pp.depth - 0.8,
      kind: "puff",
      x: pp.sx,
      y: pp.sy,
      rx: 5.5,
      ry: 3.4,
      color: i % 2 === 0 ? pal.dirt : pal.deep
    });
  }

  // Main towering razor spire leaning forward along +X (projected in true 3D by `angle`!)
  pushFacetedPrism(drawItems, project, {
    cx: 0, cy: 0, baseZ: 0, height: 64 * thrust, rx: 13, ry: 11, topScale: 0.05,
    topShiftX: 16 * thrust, topShiftY: 0, sides: 6, rotOffset: 0.35, colors: pal, seed: 5,
    magma: paletteKey === "fire"
  });
  // Two flanking jagged side shards bursting out at splayed angles
  pushFacetedPrism(drawItems, project, {
    cx: -5, cy: -10, baseZ: 0, height: 38 * thrust, rx: 8, ry: 7, topScale: 0.06,
    topShiftX: 8 * thrust, topShiftY: -9 * thrust, sides: 5, rotOffset: 0.8, colors: pal, seed: 11
  });
  pushFacetedPrism(drawItems, project, {
    cx: -5, cy: 10, baseZ: 0, height: 35 * thrust, rx: 8, ry: 7, topScale: 0.06,
    topShiftX: 8 * thrust, topShiftY: 9 * thrust, sides: 5, rotOffset: 1.4, colors: pal, seed: 17
  });

  // Flying shattered pixel clods ejected upward on burst!
  const fly = clamp(p * 1.4, 0, 1);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1 + 0.5;
    const dist = 12 + fly * (18 + (i % 3) * 8);
    const z = Math.max(2, (24 + (i % 3) * 14) * Math.sin(fly * Math.PI) + 8 * thrust);
    const cp = project(Math.cos(a) * dist, Math.sin(a) * dist, z);
    drawItems.push({
      depth: cp.depth + 2.0,
      kind: "clod",
      x: cp.sx,
      y: cp.sy,
      sz: i % 2 === 0 ? 4 : 3,
      color: i % 3 === 0 ? pal.lit : pal.hi
    });
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const item of drawItems) {
    if (item.kind === "poly") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
      for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].sx, item.pts[i].sy);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === "puff") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.ellipse(item.x, item.y, item.rx, item.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === "clod") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.fillRect(Math.round(item.x - item.sz * 0.5), Math.round(item.y - item.sz * 0.5), item.sz, item.sz);
    }
  }

  const paletteColors = Object.values(pal).filter((v) => Array.isArray(v) && v.length === 3);
  finishPixelFxPass(ctx, width, height, { paletteColors, ink: pal.ink, alphaFade, dither: 10 });
}

/**
 * Render a TRUE 3D Rumbling Underground Burrow Mound (`BURROW_AMBUSH` tunneling phase!)
 * tearing across the arena floor along continuous 360° heading `angle`, kicking up earth/water clods!
 */
export function renderVolumetricBurrowMound3D(ctx, {
  width = 112,
  height = 96,
  angle = 0,
  phase = 0.5,
  paletteKey = "earth"
} = {}) {
  const pal = SPIKE_PALETTES[paletteKey] ?? SPIKE_PALETTES.earth;
  ctx.clearRect(0, 0, width, height);

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.68);
  const rumble = Math.sin(phase * Math.PI * 16);

  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return {
      sx: cx + wx,
      sy: cy + wy * Y_PITCH - lz,
      wx,
      wy,
      wz: lz,
      depth: wy * 0.83 + lz * 0.55
    };
  };

  // Ground shadow
  ctx.save();
  ctx.fillStyle = "rgba(12, 16, 26, 0.36)";
  ctx.beginPath();
  const sC = project(0, 0, 0);
  ctx.ellipse(sC.sx, sC.sy + 2, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];
  // Rear churned dirt wake + leading rumbling jagged dome mound pushing forward along +X!
  pushFacetedPrism(drawItems, project, {
    cx: -14, cy: 0, baseZ: 0, height: 11 + rumble * 2, rx: 11, ry: 12, topScale: 0.45,
    topShiftX: -3, topShiftY: 0, sides: 6, rotOffset: 0.2, colors: pal, seed: 3
  });
  pushFacetedPrism(drawItems, project, {
    cx: 4, cy: 0, baseZ: 0, height: 22 - rumble * 2.5, rx: 16, ry: 14, topScale: 0.35,
    topShiftX: 6, topShiftY: 0, sides: 7, rotOffset: 0.5, colors: pal, seed: 8
  });
  // Flanking churned clods spraying outward from the tunnel prow!
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const t = ((phase * 3.5 + i * 0.17) % 1);
    const lx = 10 - t * 26;
    const ly = side * (9 + t * 14);
    const lz = Math.sin(t * Math.PI) * 18 + 2;
    const cp = project(lx, ly, lz);
    drawItems.push({
      depth: cp.depth + 1.5,
      kind: "clod",
      x: cp.sx,
      y: cp.sy,
      sz: i % 3 === 0 ? 4 : 3,
      color: i % 2 === 0 ? pal.lit : pal.hi
    });
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const item of drawItems) {
    if (item.kind === "poly") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
      for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].sx, item.pts[i].sy);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === "clod") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.fillRect(Math.round(item.x - item.sz * 0.5), Math.round(item.y - item.sz * 0.5), item.sz, item.sz);
    }
  }

  const paletteColors = Object.values(pal).filter((v) => Array.isArray(v) && v.length === 3);
  finishPixelFxPass(ctx, width, height, { paletteColors, ink: pal.ink, alphaFade: 1, dither: 10 });
}

/**
 * Create a live PixiJS-ready 3D Volumetric Ground Spike sprite (eruption along heading `angle`)!
 */
export function createVolumetricGroundSpikeSprite({ PIXI, layer, x = 0, y = 0, angle = 0, paletteKey = "earth", durationSec = 0.65, scale = 1.45, doc = globalThis.document }) {
  if (!PIXI || !layer) return null;
  const width = 116, height = 116;
  const canvas = doc?.createElement?.("canvas");
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  canvas.width = width;
  canvas.height = height;

  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 0.76);
  sprite.scale.set(scale);
  sprite.position.set(Math.round(x), Math.round(y + 6));
  layer.addChild(sprite);

  let age = 0, lastRenderAt = -1, dead = false;
  const drawNow = (phase) => {
    renderVolumetricGroundSpike3D(ctx, { width, height, angle, phase, paletteKey });
    texture.source?.update?.();
  };
  drawNow(0.08);

  return {
    update(dt) {
      if (dead) return false;
      age += dt;
      const phase = clamp(age / Math.max(0.2, durationSec), 0, 1);
      if (age - lastRenderAt >= 1 / 24 || phase >= 0.98) {
        lastRenderAt = age;
        drawNow(phase);
      }
      if (age >= durationSec) { this.dispose(); return false; }
      return true;
    },
    dispose() {
      if (dead) return;
      dead = true;
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
      texture.destroy(true);
      canvas.width = 0; canvas.height = 0;
    }
  };
}

/**
 * Create a live PixiJS-ready 3D Volumetric Burrow Mound following a tunneling fighter!
 */
export function createVolumetricBurrowMoundSprite({ PIXI, layer, follow, angle = 0, paletteKey = "earth", durationSec = 0.75, scale = 1.45, doc = globalThis.document }) {
  if (!PIXI || !layer || typeof follow !== "function") return null;
  const width = 112, height = 96;
  const canvas = doc?.createElement?.("canvas");
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  canvas.width = width;
  canvas.height = height;

  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 0.68);
  sprite.scale.set(scale);
  layer.addChild(sprite);

  let age = 0, lastRenderAt = -1, curAngle = angle, prevX = null, prevY = null, dead = false;
  const drawNow = (phase) => {
    renderVolumetricBurrowMound3D(ctx, { width, height, angle: curAngle, phase, paletteKey });
    texture.source?.update?.();
  };
  const p0 = follow();
  if (p0) { sprite.position.set(Math.round(p0.x), Math.round(p0.y + 4)); drawNow(0.05); }

  return {
    update(dt) {
      if (dead) return false;
      age += dt;
      const pos = age <= durationSec + 0.15 ? follow() : null;
      if (!pos) { this.dispose(); return false; }
      if (prevX !== null && Math.hypot(pos.x - prevX, pos.y - prevY) > 0.5) {
        curAngle = Math.atan2(pos.y - prevY, pos.x - prevX);
      }
      prevX = pos.x; prevY = pos.y;
      sprite.position.set(Math.round(pos.x), Math.round(pos.y + 4));
      const phase = clamp(age / Math.max(0.2, durationSec), 0, 1);
      if (age - lastRenderAt >= 1 / 24) {
        lastRenderAt = age;
        drawNow(phase);
      }
      return true;
    },
    dispose() {
      if (dead) return;
      dead = true;
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
      texture.destroy(true);
      canvas.width = 0; canvas.height = 0;
    }
  };
}
