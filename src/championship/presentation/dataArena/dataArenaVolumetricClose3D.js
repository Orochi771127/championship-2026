// Data Arena Batch 3 Unified PixelFX 3D Close-Combat, Projectiles & Support VFX (2026-11-22).
//
// Completes 100% of all 20 V2 Archetypes in ONE cohesive 16-bit PixelFX 3D visual language:
//  - Move #9:  `renderVolumetricSlashArc3D`   (3D Crescent Blade Wave / Triple Claw / Supersonic Dash Cone)
//  - Move #10: `renderVolumetricOrb3D`        (3D Spinning Elemental Energy Orb / Faceted Shard Dart with ground shadow!)
//  - Move #11: `renderVolumetricAuraPillar3D` (3D Rising Spiral Power-Up Spire & Emerald Heal Sanctuary Pillar)

import { finishPixelFxPass } from "./dataArenaVolumetricFx3D.js";

const Y_PITCH = 0.56;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rgbCss(c, a = 1) {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

const CLOSE_PALETTES = Object.freeze({
  fire: { core: [255, 254, 218], hi: [255, 202, 78], mid: [246, 114, 34], deep: [182, 42, 24], shadow: [96, 18, 22], ink: [44, 10, 14] },
  water: { core: [246, 254, 255], hi: [134, 228, 255], mid: [38, 156, 238], deep: [18, 96, 184], shadow: [10, 48, 110], ink: [10, 26, 54] },
  ice: { core: [252, 255, 255], hi: [194, 244, 255], mid: [104, 202, 246], deep: [44, 128, 200], shadow: [20, 66, 130], ink: [14, 34, 68] },
  thunder: { core: [255, 255, 232], hi: [255, 232, 92], mid: [244, 178, 38], deep: [96, 110, 216], shadow: [42, 48, 126], ink: [18, 20, 56] },
  light: { core: [255, 255, 244], hi: [255, 240, 142], mid: [248, 194, 58], deep: [188, 118, 24], shadow: [114, 62, 16], ink: [54, 28, 10] },
  nature: { core: [238, 255, 202], hi: [152, 236, 116], mid: [68, 182, 86], deep: [32, 118, 56], shadow: [18, 64, 34], ink: [12, 36, 20] },
  dark: { core: [250, 224, 255], hi: [208, 126, 255], mid: [138, 60, 216], deep: [74, 26, 140], shadow: [36, 12, 76], ink: [18, 6, 38] },
  earth: { core: [255, 246, 214], hi: [224, 188, 134], mid: [168, 128, 82], deep: [108, 78, 48], shadow: [62, 44, 28], ink: [28, 18, 12] },
  wind: { core: [246, 255, 250], hi: [176, 244, 224], mid: [94, 198, 178], deep: [44, 134, 128], shadow: [22, 74, 78], ink: [14, 42, 46] },
  metal: { core: [246, 252, 255], hi: [192, 212, 228], mid: [124, 146, 168], deep: [70, 86, 106], shadow: [38, 48, 62], ink: [16, 22, 32] }
});

function palColors(pal) {
  return [pal.core, pal.hi, pal.mid, pal.deep, pal.shadow];
}

// ============================================================================
// Move #9: True 3D Sculpted Crescent Blade Wave / Triple Claw / Supersonic Dash Cone
// (For FLURRY_COMBO, MULTI_DASH, SHADOW_BACKSTAB, UTURN_STRIKE, GUARD_BREAK_SLAM!)
// ============================================================================

export function renderVolumetricSlashArc3D(ctx, {
  width = 120,
  height = 104,
  angle = 0,
  phase = 0.45,
  paletteKey = "fire",
  variant = "slash" // "slash" | "claws" | "dashcone"
} = {}) {
  const pal = CLOSE_PALETTES[paletteKey] ?? CLOSE_PALETTES.fire;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const alphaFade = p > 0.80 ? Math.max(0, 1 - (p - 0.80) / 0.20) : 1;
  if (alphaFade <= 0.02) return;

  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.66);
  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return { sx: cx + wx, sy: cy + wy * Y_PITCH - lz, wx, wy, wz: lz, depth: wy * 0.83 + lz * 0.55 };
  };

  // Grounded contact shadow (Z = 0)
  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 28, 0.28)";
  ctx.beginPath();
  const sC = project(6, 0, 0);
  ctx.ellipse(sC.sx, sC.sy + 2, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];

  if (variant === "dashcone") {
    // 3D SUPERSONIC MACH AIR-CONE with jagged serrated speed-tail + concentric shock rings!
    const surge = Math.sin(clamp(p / 0.88, 0, 1) * Math.PI);
    const Z0 = 22;
    const nose = project(34 * (0.7 + 0.35 * p), 0, Z0);
    const segs = 14;
    const rRear = 24 * (0.72 + 0.32 * surge);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      // Serrated swept-back jet-stream tail (never a flat triangle!)
      const tail0 = -16 - (i % 2 === 0 ? 15 : 3);
      const tail1 = -16 - ((i + 1) % 2 === 0 ? 15 : 3);
      const p0 = project(tail0, Math.cos(a0) * rRear, Z0 + Math.sin(a0) * rRear);
      const p1 = project(tail1, Math.cos(a1) * rRear, Z0 + Math.sin(a1) * rRear);
      const mid0 = project(4, Math.cos(a0) * rRear * 0.56, Z0 + Math.sin(a0) * rRear * 0.56);
      const mid1 = project(4, Math.cos(a1) * rRear * 0.56, Z0 + Math.sin(a1) * rRear * 0.56);
      const elev = Math.sin((a0 + a1) * 0.5);
      const colTip = elev > 0.1 ? pal.core : pal.hi;
      const colTail = elev > 0.25 ? pal.hi : elev > -0.25 ? pal.mid : pal.deep;
      drawItems.push({ depth: (mid0.depth + p0.depth + p1.depth) / 3, kind: "poly", pts: [mid0, mid1, p1, p0], color: colTail });
      drawItems.push({ depth: (nose.depth + mid0.depth + mid1.depth) / 3 + 0.3, kind: "poly", pts: [nose, mid0, mid1], color: colTip });
    }
    // Two crisp concentric Mach shock rings peeling backward along the dash!
    for (let k = 0; k < 2; k++) {
      const lx = 8 - k * 20 - p * 12;
      const rr = (19 + k * 7);
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
        const r0 = project(lx, Math.cos(a0) * rr, Z0 + Math.sin(a0) * rr);
        const r1 = project(lx, Math.cos(a1) * rr, Z0 + Math.sin(a1) * rr);
        drawItems.push({ depth: (r0.depth + r1.depth) * 0.5 + 1.8, kind: "line", pts: [r0, r1], width: 2.8, color: k === 0 ? pal.core : pal.hi });
      }
    }
  } else {
    // BOLD 3D HORIZONTAL-TILTED CRESCENT BLADE WAVE (`slash`) OR TRIPLE PARALLEL 3D CLAW RAKES (`claws`)!
    // Uses gentle forward bow in Z (`22 + cos(a)*8`) so it NEVER collapses edge-on at 135° or 315°!
    const bands = variant === "claws" ? [-1, 0, 1] : [0];
    const sweepStart = -1.42 + p * 0.40;
    const sweepEnd = Math.min(1.52, 0.35 + p * 1.75);
    const segs = 16;

    bands.forEach((bi) => {
      const rad = variant === "claws" ? 36 - Math.abs(bi) * 2 : 41;
      const thick = variant === "claws" ? 6.5 : 18;
      const zOff = variant === "claws" ? bi * 11 : 0;
      const latOff = variant === "claws" ? bi * 5 : 0;
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        const a0 = sweepStart + (sweepEnd - sweepStart) * t0;
        const a1 = sweepStart + (sweepEnd - sweepStart) * t1;
        const w0 = thick * Math.pow(Math.sin(t0 * Math.PI), 0.72);
        const w1 = thick * Math.pow(Math.sin(t1 * Math.PI), 0.72);
        const evalArc = (a, r, dz = 0) => project(
          Math.cos(a) * r + 4,
          Math.sin(a) * r + latOff,
          Math.max(4, 24 + zOff + Math.cos(a) * 8 + dz)
        );
        const out0 = evalArc(a0, rad, 3);
        const out1 = evalArc(a1, rad, 3);
        const mid0 = evalArc(a0, rad - w0 * 0.45, 1);
        const mid1 = evalArc(a1, rad - w1 * 0.45, 1);
        const in0 = evalArc(a0, rad - w0, -3);
        const in1 = evalArc(a1, rad - w1, -3);
        const depth = (out0.depth + out1.depth + in0.depth + in1.depth) * 0.25;
        drawItems.push({ depth, kind: "poly", pts: [in0, in1, mid1, mid0], color: t0 > 0.35 ? pal.mid : pal.deep });
        drawItems.push({ depth: depth + 0.5, kind: "poly", pts: [mid0, mid1, out1, out0], color: t0 > 0.42 ? pal.core : pal.hi });
      }
    });

    // Razor slash sparks flying off the blade arc
    for (let i = 0; i < 7; i++) {
      const a = sweepEnd - i * 0.34;
      const sp = project(Math.cos(a) * 44 + 6, Math.sin(a) * 42, 26 + (i % 3) * 6);
      drawItems.push({ depth: sp.depth + 2, kind: "spark", x: sp.sx, y: sp.sy, color: i % 2 === 0 ? pal.core : pal.hi });
    }
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const it of drawItems) {
    if (it.kind === "poly") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].sx, it.pts[i].sy);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === "line") {
      ctx.strokeStyle = rgbCss(it.color);
      ctx.lineWidth = it.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      ctx.lineTo(it.pts[1].sx, it.pts[1].sy);
      ctx.stroke();
    } else if (it.kind === "spark") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.fillRect(Math.round(it.x - 1.5), Math.round(it.y - 1.5), 3, 3);
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 9 });
}

// ============================================================================
// Move #10: True 3D Spinning Elemental Energy Orb / Faceted Shard Dart
// (For HOMING_ORB & VOLLEY_BARRAGE — hovering 3D projectile + grounded Z=0 shadow!)
// ============================================================================

export function renderVolumetricOrb3D(ctx, {
  width = 88,
  height = 80,
  angle = 0,
  phase = 0.45,
  paletteKey = "fire",
  variant = "orb" // "orb" | "dart"
} = {}) {
  const pal = CLOSE_PALETTES[paletteKey] ?? CLOSE_PALETTES.fire;
  ctx.clearRect(0, 0, width, height);

  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.68);
  const Z0 = 19;
  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return { sx: cx + wx, sy: cy + wy * Y_PITCH - lz, wx, wy, wz: lz, depth: wy * 0.83 + lz * 0.55 };
  };

  // Grounded shadow directly below hovering 3D projectile!
  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 28, 0.34)";
  ctx.beginPath();
  const sh = project(0, 0, 0);
  ctx.ellipse(sh.sx, sh.sy + 2, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];
  const spin = phase * Math.PI * 4;

  // Tapering 3D plasma/flame tail trailing behind along -X!
  for (let i = 5; i >= 1; i--) {
    const k = i / 5;
    const wig = Math.sin(spin * 2 + i * 1.4) * 3.2 * k;
    const tp = project(-k * 24, wig, Z0 + Math.cos(spin * 2 + i) * 2.2 * k);
    const rr = (variant === "dart" ? 7.5 : 10.5) * (1 - k * 0.62);
    drawItems.push({ depth: tp.depth - k * 2, kind: "puff", x: tp.sx, y: tp.sy, rx: rr, ry: rr * 0.86, color: k < 0.4 ? pal.hi : k < 0.75 ? pal.mid : pal.deep });
  }

  if (variant === "dart") {
    // Sleek faceted 3D diamond/crystal spearhead pointing along +X!
    const tip = project(18, 0, Z0);
    const tail = project(-10, 0, Z0);
    const ring = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + spin * 0.5;
      ring.push(project(2, Math.cos(a) * 8.5, Z0 + Math.sin(a) * 8.5));
    }
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const col = i === 0 ? pal.core : i === 1 ? pal.hi : i === 2 ? pal.mid : pal.deep;
      drawItems.push({ depth: (tip.depth + ring[i].depth + ring[j].depth) / 3, kind: "poly", pts: [tip, ring[i], ring[j]], color: col });
      drawItems.push({ depth: (tail.depth + ring[i].depth + ring[j].depth) / 3 - 0.5, kind: "poly", pts: [tail, ring[i], ring[j]], color: pal.deep });
    }
  } else {
    // Sculpted 3D glowing energy orb + orbiting 3D gyroscopic ring!
    const c = project(3, 0, Z0);
    drawItems.push({ depth: c.depth, kind: "puff", x: c.sx, y: c.sy, rx: 13, ry: 12.5, color: pal.deep });
    drawItems.push({ depth: c.depth + 0.4, kind: "puff", x: c.sx - 1.5, y: c.sy - 1.5, rx: 10.5, ry: 10, color: pal.mid });
    drawItems.push({ depth: c.depth + 0.8, kind: "puff", x: c.sx - 2.5, y: c.sy - 2.5, rx: 7.2, ry: 6.8, color: pal.hi });
    drawItems.push({ depth: c.depth + 1.2, kind: "puff", x: c.sx - 3.5, y: c.sy - 3.5, rx: 4.0, ry: 3.6, color: pal.core });

    // Tilted orbiting 3D plasma ring around the sphere
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 + spin;
      const a1 = ((i + 1) / segs) * Math.PI * 2 + spin;
      const p0 = project(3 + Math.cos(a0) * 15, Math.sin(a0) * 15, Z0 + Math.sin(a0) * 7);
      const p1 = project(3 + Math.cos(a1) * 15, Math.sin(a1) * 15, Z0 + Math.sin(a1) * 7);
      drawItems.push({ depth: (p0.depth + p1.depth) * 0.5, kind: "line", pts: [p0, p1], width: 2.2, color: i % 2 === 0 ? pal.core : pal.hi });
    }
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const it of drawItems) {
    if (it.kind === "poly") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].sx, it.pts[i].sy);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === "puff") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(1, it.rx), Math.max(1, it.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === "line") {
      ctx.strokeStyle = rgbCss(it.color);
      ctx.lineWidth = it.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      ctx.lineTo(it.pts[1].sx, it.pts[1].sy);
      ctx.stroke();
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade: 1, dither: 8 });
}

// ============================================================================
// Move #11: True 3D Rising Power-Up Spire & Emerald Heal Sanctuary Pillar
// (For SELF_BUFF & RECOVERY_SUPPORT!)
// ============================================================================

export function renderVolumetricAuraPillar3D(ctx, {
  width = 128,
  height = 136,
  phase = 0.45,
  paletteKey = "light",
  variant = "buff" // "buff" | "heal"
} = {}) {
  const pal = CLOSE_PALETTES[paletteKey] ?? (variant === "heal" ? CLOSE_PALETTES.nature : CLOSE_PALETTES.light);
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const growth = p < 0.20 ? Math.sin((p / 0.20) * Math.PI * 0.5) : p > 0.80 ? Math.max(0.08, 1 - (p - 0.80) / 0.20) : 1;
  const alphaFade = p > 0.84 ? Math.max(0, 1 - (p - 0.84) / 0.16) : 1;
  if (growth <= 0.05 || alphaFade <= 0.02) return;

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.78);
  const project = (wx, wy, wz) => ({
    sx: cx + wx,
    sy: cy + wy * Y_PITCH - wz,
    wx, wy, wz,
    depth: wy * 0.83 + wz * 0.55
  });

  // Ground glow ring shadow
  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 28, 0.26)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 30 * growth, 30 * growth * Y_PITCH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];
  const spin = p * Math.PI * 6.0;

  // Grounded 3D radiant sanctuary base ring
  const segs = 18;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2 + spin * 0.4;
    const a1 = ((i + 1) / segs) * Math.PI * 2 + spin * 0.4;
    const p0 = project(Math.cos(a0) * 28 * growth, Math.sin(a0) * 28 * growth, 2);
    const p1 = project(Math.cos(a1) * 28 * growth, Math.sin(a1) * 28 * growth, 2);
    drawItems.push({ depth: (p0.depth + p1.depth) * 0.5 - 2, kind: "line", pts: [p0, p1], width: 3.4, color: i % 2 === 0 ? pal.core : pal.hi });
  }

  // 3 Rising Spiral 3D Energy Ribbons wrapping upward around the fighter!
  for (let r = 0; r < 3; r++) {
    const baseA = r * ((Math.PI * 2) / 3) + spin;
    const steps = 14;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const rad0 = (26 - t0 * 8) * growth;
      const rad1 = (26 - t1 * 8) * growth;
      const a0 = baseA + t0 * Math.PI * 2.2;
      const a1 = baseA + t1 * Math.PI * 2.2;
      const p0 = project(Math.cos(a0) * rad0, Math.sin(a0) * rad0, t0 * 74 * growth);
      const p1 = project(Math.cos(a1) * rad1, Math.sin(a1) * rad1, t1 * 74 * growth);
      drawItems.push({ depth: (p0.depth + p1.depth) * 0.5, kind: "line", pts: [p0, p1], width: 4.0 * (1 - t0 * 0.35), color: pal.mid });
      drawItems.push({ depth: (p0.depth + p1.depth) * 0.5 + 0.5, kind: "line", pts: [p0, p1], width: 1.8 * (1 - t0 * 0.35), color: pal.core });
    }
  }

  // Rising 3D Power Chevrons (`buff`) OR Pixel Heal Crosses (`heal`)!
  for (let i = 0; i < 6; i++) {
    const t = ((i / 6) + p * 1.1) % 1;
    const a = i * 1.1 + spin * 0.6;
    const rad = 24 * growth;
    const ip = project(Math.cos(a) * rad, Math.sin(a) * rad, 10 + t * 66 * growth);
    drawItems.push({ depth: ip.depth + 2.5, kind: variant === "heal" ? "cross" : "chevron", x: ip.sx, y: ip.sy, color: i % 2 === 0 ? pal.core : pal.hi });
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const it of drawItems) {
    if (it.kind === "line") {
      ctx.strokeStyle = rgbCss(it.color);
      ctx.lineWidth = it.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      ctx.lineTo(it.pts[1].sx, it.pts[1].sy);
      ctx.stroke();
    } else if (it.kind === "cross") {
      ctx.fillStyle = rgbCss(it.color);
      const x = Math.round(it.x), y = Math.round(it.y);
      ctx.fillRect(x - 4, y - 1, 9, 3);
      ctx.fillRect(x - 1, y - 4, 3, 9);
    } else if (it.kind === "chevron") {
      ctx.strokeStyle = rgbCss(it.color);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(it.x - 4, it.y + 3);
      ctx.lineTo(it.x, it.y - 3);
      ctx.lineTo(it.x + 4, it.y + 3);
      ctx.stroke();
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 9 });
}
