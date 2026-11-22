// Data Arena Batch 2 Unified PixelFX 3D Combat VFX Engine (2026-11-22).
//
// Moves #5-#8 (100% Unified 16-bit PixelFX Material via `finishPixelFxPass`):
//  - Move #5: `renderVolumetricCraterShockwave3D` (3D Uplifted Seismic Ring + Cracked Crater + Debris)
//  - Move #6: `renderVolumetricBeam3D`            (True 3D Cylindrical Spiral Energy Cannon / Stream at all 360 deg!)
//  - Move #7: `renderVolumetricMeteor3D`          (True 3D Tumbling Sky-Drop Meteor / Storm-Cloud Thunder Pillar + 3D Blast)
//  - Move #8: `renderVolumetricPsychicCage3D`     (True 3D Gyroscopic Telekinesis Field + 3D Hexagonal Energy Cage)

import { finishPixelFxPass } from "./dataArenaVolumetricFx3D.js";

const Y_PITCH = 0.56;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rgbCss(c, a = 1) {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

const COMBAT_PALETTES = Object.freeze({
  earth: {
    core: [255, 246, 214],
    hi: [224, 188, 134],
    mid: [168, 128, 82],
    deep: [108, 78, 48],
    shadow: [62, 44, 28],
    ink: [28, 18, 12]
  },
  fire: {
    core: [255, 254, 218],
    hi: [255, 204, 78],
    mid: [246, 114, 34],
    deep: [186, 42, 24],
    shadow: [96, 18, 22],
    ink: [44, 10, 14]
  },
  water: {
    core: [246, 254, 255],
    hi: [134, 228, 255],
    mid: [38, 156, 238],
    deep: [18, 96, 184],
    shadow: [10, 48, 110],
    ink: [10, 26, 54]
  },
  ice: {
    core: [252, 255, 255],
    hi: [192, 244, 255],
    mid: [104, 202, 246],
    deep: [44, 128, 200],
    shadow: [20, 66, 130],
    ink: [14, 34, 68]
  },
  thunder: {
    core: [255, 255, 230],
    hi: [255, 232, 92],
    mid: [244, 178, 38],
    deep: [96, 110, 216],
    shadow: [42, 48, 126],
    ink: [18, 20, 56]
  },
  light: {
    core: [255, 255, 244],
    hi: [255, 240, 142],
    mid: [248, 194, 58],
    deep: [188, 118, 24],
    shadow: [114, 62, 16],
    ink: [54, 28, 10]
  },
  nature: {
    core: [238, 255, 202],
    hi: [152, 236, 116],
    mid: [68, 182, 86],
    deep: [32, 118, 56],
    shadow: [18, 64, 34],
    ink: [12, 36, 20]
  },
  dark: {
    core: [250, 224, 255],
    hi: [208, 126, 255],
    mid: [138, 60, 216],
    deep: [74, 26, 140],
    shadow: [36, 12, 76],
    ink: [18, 6, 38]
  }
});

function palColors(pal) {
  return [pal.core, pal.hi, pal.mid, pal.deep, pal.shadow];
}

// ============================================================================
// Move #5: 3D Volumetric Seismic Crater & Expanding Uplifted Shockwave Ring
// (For SHOCKWAVE_RING, LEAP_SLAM, GRAB_SLAM impacts!)
// ============================================================================

export function renderVolumetricCraterShockwave3D(ctx, {
  width = 160,
  height = 124,
  phase = 0.42,
  paletteKey = "earth"
} = {}) {
  const pal = COMBAT_PALETTES[paletteKey] ?? COMBAT_PALETTES.earth;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const alphaFade = p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.22) : 1;
  if (alphaFade <= 0.02) return;

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.64);
  const project = (wx, wy, wz) => ({
    sx: cx + wx,
    sy: cy + wy * Y_PITCH - wz,
    wx, wy, wz,
    depth: wy * 0.83 + wz * 0.55
  });

  const expand = Math.pow(p, 0.62);
  const ringR = 16 + expand * 52;
  const crestH = Math.sin(clamp(p / 0.82, 0, 1) * Math.PI) * 24;

  // 1. Grounded dark crater shadow + jagged radial ground fissures on Z = 0
  ctx.save();
  ctx.fillStyle = "rgba(12, 16, 28, 0.34)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, ringR * 1.05, ringR * 1.05 * Y_PITCH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];

  // Cracked center bowl & 7 radial jagged fissure lines on Z = 0
  const cracks = 7;
  for (let i = 0; i < cracks; i++) {
    const a = (i / cracks) * Math.PI * 2 + 0.3;
    const len = 14 + expand * 36;
    const p0 = project(Math.cos(a) * 4, Math.sin(a) * 4, 0.5);
    const p1 = project(Math.cos(a + 0.12) * len * 0.55, Math.sin(a + 0.12) * len * 0.55, 0.5);
    const p2 = project(Math.cos(a - 0.08) * len, Math.sin(a - 0.08) * len, 0.5);
    drawItems.push({ depth: p1.depth - 40, kind: "line", pts: [p0, p1, p2], width: 2.6, color: pal.shadow });
    drawItems.push({ depth: p1.depth - 39.5, kind: "line", pts: [p0, p1], width: 1.2, color: pal.core });
  }

  // 2. Expanding 3D Uplifted Jagged Crest Ring (18 interlocking tilted 3D wave-slabs!)
  const slabs = 18;
  for (let i = 0; i < slabs; i++) {
    const a0 = (i / slabs) * Math.PI * 2;
    const a1 = ((i + 1) / slabs) * Math.PI * 2;
    const aMid = (a0 + a1) * 0.5;
    const jag = 0.78 + 0.38 * Math.abs(Math.sin(i * 2.7 + 0.6));
    const h = Math.max(3, crestH * jag);
    const rIn = Math.max(8, ringR - 11);
    const rOut = ringR + 5;
    const rPeak = ringR - 2;

    const in0 = project(Math.cos(a0) * rIn, Math.sin(a0) * rIn, 1);
    const in1 = project(Math.cos(a1) * rIn, Math.sin(a1) * rIn, 1);
    const out0 = project(Math.cos(a0) * rOut, Math.sin(a0) * rOut, 1);
    const out1 = project(Math.cos(a1) * rOut, Math.sin(a1) * rOut, 1);
    const pk0 = project(Math.cos(a0) * rPeak, Math.sin(a0) * rPeak, h);
    const pk1 = project(Math.cos(a1) * rPeak, Math.sin(a1) * rPeak, h * (0.85 + 0.25 * (i % 2)));

    const ny = Math.sin(aMid);
    const nx = Math.cos(aMid);
    const light = -nx * 0.45 + ny * 0.4;
    const outerCol = light > 0.25 ? pal.hi : light > -0.15 ? pal.mid : pal.deep;
    const innerCol = ny < 0 ? pal.core : pal.shadow;

    // Inner steep shock face
    drawItems.push({
      depth: (in0.depth + in1.depth + pk0.depth + pk1.depth) * 0.25,
      kind: "poly", pts: [in0, in1, pk1, pk0], color: innerCol
    });
    // Outer sloped rock/energy face
    drawItems.push({
      depth: (out0.depth + out1.depth + pk0.depth + pk1.depth) * 0.25 + 0.4,
      kind: "poly", pts: [out0, out1, pk1, pk0], color: outerCol
    });
    // Razor bright crest rim
    drawItems.push({
      depth: (pk0.depth + pk1.depth) * 0.5 + 0.8,
      kind: "line", pts: [pk0, pk1], width: 2.0, color: pal.core
    });
  }

  // 3. 12 Parabolic Flying 3D Debris Chunks arcing upward & outward!
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996 + 0.4;
    const dist = 10 + expand * (34 + (i % 4) * 10);
    const arcZ = Math.max(2, Math.sin(clamp(p * 1.15, 0, 1) * Math.PI) * (32 + (i % 3) * 14));
    const dp = project(Math.cos(a) * dist, Math.sin(a) * dist, arcZ);
    drawItems.push({
      depth: dp.depth + 2.0,
      kind: "chunk",
      x: dp.sx, y: dp.sy,
      sz: i % 3 === 0 ? 5 : 3.5,
      color: i % 3 === 0 ? pal.core : i % 2 === 0 ? pal.hi : pal.mid
    });
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
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].sx, it.pts[i].sy);
      ctx.stroke();
    } else if (it.kind === "chunk") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.fillRect(Math.round(it.x - it.sz * 0.5), Math.round(it.y - it.sz * 0.5), Math.round(it.sz), Math.round(it.sz));
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 10 });
}

// ============================================================================
// Move #6: True 3D Cylindrical Spiral Energy Cannon / Stream Beam (All 360 deg!)
// (For STREAM_BEAM: 光矛 / 曦冕審判 / 烈鎧焰砲 / 潮鬃水砲 / 電弧針!)
// ============================================================================

export function renderVolumetricBeam3D(ctx, {
  width = 180,
  height = 140,
  angle = 0,
  phase = 0.45,
  paletteKey = "light",
  length = 112
} = {}) {
  const pal = COMBAT_PALETTES[paletteKey] ?? COMBAT_PALETTES.light;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  // Rapid beam blast expansion -> roaring sustained core -> snappy taper off
  const girth = p < 0.16 ? Math.sin((p / 0.16) * Math.PI * 0.5)
    : p < 0.76 ? 1.0 + Math.sin(p * 34) * 0.10
      : Math.max(0.06, 1 - (p - 0.76) / 0.24);
  const reach = p < 0.18 ? clamp(p / 0.18, 0.15, 1) : 1.0;
  const alphaFade = p > 0.84 ? Math.max(0, 1 - (p - 0.84) / 0.16) : 1;
  if (girth <= 0.05 || alphaFade <= 0.02) return;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  // Origin sits slightly behind center so the full beam projects cleanly at ALL 8 directions!
  const cx = Math.round(width * 0.5 - cosA * length * 0.36);
  const cy = Math.round(height * 0.58 - sinA * length * 0.36 * Y_PITCH);
  const BEAM_Z = 20;

  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return {
      sx: cx + wx,
      sy: cy + wy * Y_PITCH - lz,
      wx, wy, wz: lz,
      depth: wy * 0.83 + lz * 0.55
    };
  };

  // 1. Grounded shadow strip directly beneath the hovering 3D beam cylinder (Z = 0)
  ctx.save();
  ctx.strokeStyle = "rgba(10, 18, 34, 0.28)";
  ctx.lineWidth = Math.max(4, 15 * girth);
  ctx.lineCap = "round";
  const sh0 = project(0, 0, 0);
  const sh1 = project(length * reach, 0, 0);
  ctx.beginPath();
  ctx.moveTo(sh0.sx, sh0.sy + 3);
  ctx.lineTo(sh1.sx, sh1.sy + 3);
  ctx.stroke();
  ctx.restore();

  const drawItems = [];
  const spin = p * Math.PI * 9.5;
  const curLen = length * reach;
  const baseR = 11.5 * girth;

  // 2. True 3D Cylindrical Plasma Tube (14 axial slices x 12 radial facets)
  const X_SEGS = 14;
  const R_SEGS = 12;
  const grid = [];
  for (let ix = 0; ix <= X_SEGS; ix++) {
    const t = ix / X_SEGS;
    const lx = t * curLen;
    // Bulge slightly at muzzle and impact tip!
    const rMod = baseR * (t < 0.14 ? 0.75 + t * 2.4 : t > 0.88 ? 1.0 + (t - 0.88) * 3.0 : 0.96 + 0.10 * Math.sin(t * 14 - spin * 1.4));
    const row = [];
    for (let ir = 0; ir <= R_SEGS; ir++) {
      const th = (ir / R_SEGS) * Math.PI * 2;
      const ly = Math.cos(th) * rMod;
      const lz = BEAM_Z + Math.sin(th) * rMod;
      row.push({ p: project(lx, ly, lz), th, t });
    }
    grid.push(row);
  }

  for (let ix = 0; ix < X_SEGS; ix++) {
    for (let ir = 0; ir < R_SEGS; ir++) {
      const a = grid[ix][ir], b = grid[ix][ir + 1], c = grid[ix + 1][ir + 1], d = grid[ix + 1][ir];
      const thMid = (a.th + b.th) * 0.5;
      // Cel-shading around cylinder circumference: white-hot core center -> bright hi -> mid -> deep edge!
      const elev = Math.sin(thMid);
      const col = elev > 0.35 ? pal.core : elev > -0.15 ? pal.hi : elev > -0.60 ? pal.mid : pal.deep;
      drawItems.push({
        depth: (a.p.depth + b.p.depth + c.p.depth + d.p.depth) * 0.25,
        kind: "poly", pts: [a.p, b.p, c.p, d.p], color: col
      });
    }
  }

  // 3. Blazing 3D Muzzle Burst Orb at origin (x = 0) + Flared Impact Plasma Head at front tip (x = curLen)!
  const addBurstFlare = (lx, rad, col) => {
    const cPt = project(lx, 0, BEAM_Z);
    drawItems.push({ depth: cPt.depth + 2.2, kind: "puff", x: cPt.sx, y: cPt.sy, rx: rad, ry: rad * 0.88, color: col });
    drawItems.push({ depth: cPt.depth + 2.6, kind: "puff", x: cPt.sx, y: cPt.sy, rx: rad * 0.62, ry: rad * 0.56, color: pal.core });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + spin * 0.9;
      const tip = project(lx + (lx > 10 ? 5 : -4), Math.cos(a) * rad * 1.45, BEAM_Z + Math.sin(a) * rad * 1.45);
      drawItems.push({ depth: cPt.depth + 2.0, kind: "line", pts: [cPt, tip], width: 2.6 * girth, color: i % 2 === 0 ? pal.core : pal.hi });
    }
  };
  addBurstFlare(2, baseR * 1.38, pal.hi);
  if (reach > 0.55) addBurstFlare(curLen, baseR * 1.25, pal.mid);

  // 4. Two Intertwining 3D Helical Energy Ribbons spiraling down the beam cylinder!
  for (let h = 0; h < 2; h++) {
    const phaseOff = h * Math.PI + spin * 1.6;
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const th0 = phaseOff + t0 * Math.PI * 4.2;
      const th1 = phaseOff + t1 * Math.PI * 4.2;
      const hr = baseR + 4.8 * girth;
      const p0 = project(t0 * curLen, Math.cos(th0) * hr, BEAM_Z + Math.sin(th0) * hr);
      const p1 = project(t1 * curLen, Math.cos(th1) * hr, BEAM_Z + Math.sin(th1) * hr);
      drawItems.push({
        depth: (p0.depth + p1.depth) * 0.5 + 1.4,
        kind: "line", pts: [p0, p1], width: 2.6 * girth, color: h === 0 ? pal.core : pal.hi
      });
    }
  }

  // 5. High-speed energy sparks streaking alongside the cannon
  for (let i = 0; i < 8; i++) {
    const t = ((i / 8) + p * 2.2) % 1;
    const ang = i * 2.1 + spin;
    const r = baseR + 7 + (i % 3) * 3;
    const sp = project(t * curLen, Math.cos(ang) * r, BEAM_Z + Math.sin(ang) * r);
    drawItems.push({ depth: sp.depth + 2.0, kind: "spark", x: sp.sx, y: sp.sy, color: i % 2 === 0 ? pal.core : pal.hi });
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
      ctx.lineWidth = Math.max(1.2, it.width);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      ctx.lineTo(it.pts[1].sx, it.pts[1].sy);
      ctx.stroke();
    } else if (it.kind === "puff") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(1, it.rx), Math.max(1, it.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === "spark") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.fillRect(Math.round(it.x - 1.5), Math.round(it.y - 1.5), 3, 3);
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 9 });
}

// ============================================================================
// Move #7: True 3D Falling Flaming Meteor / Storm-Cloud Thunder Pillar + 3D Blast
// (For METEOR_RAIN: 火環 / 熔核爆發 / 天雷 / 流星雨!)
// ============================================================================

export function renderVolumetricMeteor3D(ctx, {
  width = 148,
  height = 196,
  phase = 0.35,
  paletteKey = "fire",
  variant = "meteor" // "meteor" | "thunder"
} = {}) {
  const pal = COMBAT_PALETTES[paletteKey] ?? COMBAT_PALETTES.fire;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const alphaFade = p > 0.84 ? Math.max(0, 1 - (p - 0.84) / 0.16) : 1;
  if (alphaFade <= 0.02) return;

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.82);
  const project = (wx, wy, wz) => ({
    sx: cx + wx,
    sy: cy + wy * Y_PITCH - wz,
    wx, wy, wz,
    depth: wy * 0.83 + wz * 0.55
  });

  const drawItems = [];

  if (variant === "thunder") {
    // STORM-CLOUD THUNDER PILLAR: dark 3D billowing thundercloud overhead + jagged 3D lightning strike + ground burst!
    const cloudZ = 92;
    const strikeOn = p >= 0.22 && p <= 0.78;
    const cloudPuffs = [
      [-18, -2, 0, 16, 10], [0, 2, 4, 20, 12], [18, -1, 0, 16, 10],
      [-10, 6, -3, 14, 9], [10, 6, -3, 14, 9]
    ];
    // Ground flash shadow
    ctx.save();
    ctx.fillStyle = strikeOn ? "rgba(255, 240, 140, 0.35)" : "rgba(18, 22, 46, 0.34)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, strikeOn ? 32 : 20, (strikeOn ? 32 : 20) * Y_PITCH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Jagged 3D lightning column punching from cloud (Z=86) down to ground (Z=0)!
    if (strikeOn) {
      const boltPts = [];
      const steps = 9;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const jx = i === 0 || i === steps ? 0 : Math.sin(i * 4.3 + Math.floor(p * 24) * 2.1) * 11;
        const jy = i === 0 || i === steps ? 0 : Math.cos(i * 3.1 + Math.floor(p * 24)) * 6;
        boltPts.push(project(jx, jy, (1 - t) * (cloudZ - 6)));
      }
      drawItems.push({ depth: 18, kind: "line", pts: boltPts, width: 11, color: pal.deep });
      drawItems.push({ depth: 19, kind: "line", pts: boltPts, width: 6.5, color: pal.hi });
      drawItems.push({ depth: 20, kind: "line", pts: boltPts, width: 3.0, color: pal.core });

      // Two crackling side branches
      const b1 = [boltPts[3], project(boltPts[3].wx + 18, 4, 48), project(boltPts[3].wx + 26, 6, 30)];
      const b2 = [boltPts[5], project(boltPts[5].wx - 19, -4, 30), project(boltPts[5].wx - 24, -2, 16)];
      drawItems.push({ depth: 18.5, kind: "line", pts: b1, width: 3.2, color: pal.hi });
      drawItems.push({ depth: 18.5, kind: "line", pts: b2, width: 3.2, color: pal.hi });

      // Ground impact burst puffs
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + p * 6;
        const gp = project(Math.cos(a) * 22, Math.sin(a) * 22, 6 + (i % 2) * 5);
        drawItems.push({ depth: gp.depth + 2, kind: "puff", x: gp.sx, y: gp.sy, rx: 8, ry: 5.5, color: i % 2 === 0 ? pal.core : pal.hi });
      }
    }

    // Billowing 3D dark thundercloud crown overhead
    cloudPuffs.forEach(([ox, oy, oz, rx, ry], idx) => {
      const cp = project(ox, oy, cloudZ + oz);
      drawItems.push({ depth: cp.depth + 40, kind: "puff", x: cp.sx, y: cp.sy + 3, rx, ry, color: pal.shadow });
      drawItems.push({ depth: cp.depth + 41, kind: "puff", x: cp.sx - 1, y: cp.sy, rx: rx * 0.88, ry: ry * 0.82, color: pal.deep });
      if (strikeOn && idx === 1) {
        drawItems.push({ depth: cp.depth + 42, kind: "puff", x: cp.sx, y: cp.sy + 4, rx: 10, ry: 6, color: pal.hi });
      }
    });
  } else if (p < 0.52) {
    // STAGE A: TRUE 3D TUMBLING METEOR BOULDER PLUNGING OBLIQUELY FROM THE SKY!
    const dp = clamp(p / 0.52, 0, 1);
    const mz = (1 - dp * dp) * 96 + 10;
    const mx = -(1 - dp) * 34;
    const my = -(1 - dp) * 10;

    // Growing grounded impact shadow on Z = 0
    ctx.save();
    ctx.fillStyle = "rgba(12, 16, 28, 0.36)";
    ctx.beginPath();
    const shR = 10 + dp * 22;
    ctx.ellipse(cx, cy + 2, shR, shR * Y_PITCH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Organic billowing fiery flame-and-smoke comet plumes trailing diagonally up into the sky!
    for (let i = 9; i >= 1; i--) {
      const k = i / 9;
      const jitterX = Math.sin(i * 3.1 + p * 22) * (3 + k * 4);
      const tp = project(mx - k * 28 + jitterX, my - k * 8, mz + k * 48);
      const tr = (14.5 - k * 8.5) * (0.85 + 0.3 * (i % 2));
      const col = k < 0.25 ? pal.core : k < 0.52 ? pal.hi : k < 0.78 ? pal.mid : pal.deep;
      drawItems.push({ depth: tp.depth - k * 2.5, kind: "puff", x: tp.sx, y: tp.sy, rx: tr * 1.05, ry: tr * 0.92, color: col });
      if (i % 2 === 0) {
        const sp = project(mx - k * 24 - jitterX * 1.6, my + 4, mz + k * 42 + 4);
        drawItems.push({ depth: sp.depth + 1, kind: "spark", x: sp.sx, y: sp.sy, color: pal.core });
      }
    }

    // Chunky, craggy 3D asteroid rock boulder with dark crust & glowing molten fissure!
    const spin = p * Math.PI * 6;
    const mPts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + spin;
      const rr = 17.5 + (i % 2 === 0 ? 4.2 : -2.5) + Math.sin(i * 2.7) * 2.2;
      mPts.push(project(mx + Math.cos(a) * rr, my, mz + Math.sin(a) * rr));
    }
    const mc = project(mx, my + 4, mz);
    drawItems.push({ depth: mc.depth + 2.0, kind: "poly", pts: mPts, color: pal.shadow });
    const midFacet = [mPts[0], mPts[1], mPts[2], mPts[3], mc];
    drawItems.push({ depth: mc.depth + 2.4, kind: "poly", pts: midFacet, color: pal.deep });
    // Glowing molten magma crack across the tumbling boulder
    drawItems.push({ depth: mc.depth + 2.9, kind: "line", pts: [mPts[1], mc, mPts[5]], width: 3.0, color: pal.hi });
    drawItems.push({ depth: mc.depth + 3.1, kind: "line", pts: [mPts[1], mc, mPts[5]], width: 1.4, color: pal.core });
    // Blazing white-hot atmospheric entry shock arc hugging the leading bottom-right nose!
    const nose = project(mx + 8, my + 5, mz - 10);
    drawItems.push({ depth: nose.depth + 3.4, kind: "puff", x: nose.sx, y: nose.sy, rx: 12, ry: 7.5, color: pal.hi });
    drawItems.push({ depth: nose.depth + 3.8, kind: "puff", x: nose.sx + 2, y: nose.sy + 1, rx: 7, ry: 4.5, color: pal.core });
  } else {
    // STAGE B: VOLUMETRIC 3D MUSHROOM BLAST DOME + EXPANDING BLAST COLLAR!
    const bp = clamp((p - 0.52) / 0.48, 0, 1);
    const swell = Math.sin(Math.min(1, bp * 1.4) * Math.PI * 0.5);
    const shrink = bp > 0.65 ? 1 - (bp - 0.65) / 0.35 : 1;
    const r = (18 + swell * 26) * (0.45 + 0.55 * shrink);

    // Grounded blast shadow
    ctx.save();
    ctx.fillStyle = "rgba(12, 16, 28, 0.34)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, r * 1.35, r * 1.35 * Y_PITCH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Base shockwave puff ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + bp * 1.6;
      const rr = r * 1.15;
      const gp = project(Math.cos(a) * rr, Math.sin(a) * rr, 5 + (i % 2) * 3);
      drawItems.push({ depth: gp.depth, kind: "puff", x: gp.sx, y: gp.sy, rx: 9 * shrink, ry: 6 * shrink, color: gp.wy > 0 ? pal.hi : pal.mid });
    }
    // Rising 3D billowing mushroom fireball column & crown!
    const domeZ = 14 + swell * 30;
    const domePuffs = [
      [0, 0, domeZ * 0.45, r * 0.65, r * 0.55, pal.mid],
      [-r * 0.42, 2, domeZ, r * 0.68, r * 0.56, pal.mid],
      [r * 0.42, 2, domeZ, r * 0.68, r * 0.56, pal.deep],
      [0, 4, domeZ + 8, r * 0.82, r * 0.68, pal.hi],
      [-4, 5, domeZ + 11, r * 0.48, r * 0.40, pal.core]
    ];
    for (const [ox, oy, oz, rx, ry, col] of domePuffs) {
      const dp = project(ox, oy, oz);
      drawItems.push({ depth: dp.depth + 3, kind: "puff", x: dp.sx, y: dp.sy, rx: Math.max(2, rx), ry: Math.max(2, ry), color: col });
    }
    // Flying molten embers
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996;
      const dist = 16 + bp * 46;
      const ez = Math.max(2, Math.sin(bp * Math.PI) * 56 + 10);
      const ep = project(Math.cos(a) * dist, Math.sin(a) * dist, ez);
      drawItems.push({ depth: ep.depth + 4, kind: "spark", x: ep.sx, y: ep.sy, color: i % 2 === 0 ? pal.core : pal.hi });
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
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].sx, it.pts[i].sy);
      ctx.stroke();
    } else if (it.kind === "puff") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(1, it.rx), Math.max(1, it.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === "spark") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.fillRect(Math.round(it.x - 1.5), Math.round(it.y - 1.5), 3, 3);
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 10 });
}

// ============================================================================
// Move #8: True 3D Gyroscopic Telekinesis Field & Hexagonal Energy Cage
// (For TELEKINESIS_SLAM + Thunder/Ice/Fire Trap Cages!)
// ============================================================================

export function renderVolumetricPsychicCage3D(ctx, {
  width = 148,
  height = 148,
  phase = 0.45,
  paletteKey = "dark",
  mode = "telekinesis" // "telekinesis" | "cage"
} = {}) {
  const pal = COMBAT_PALETTES[paletteKey] ?? COMBAT_PALETTES.dark;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const growth = p < 0.16 ? Math.sin((p / 0.16) * Math.PI * 0.5) : p > 0.84 ? Math.max(0.08, 1 - (p - 0.84) / 0.16) : 1;
  const alphaFade = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
  if (growth <= 0.05 || alphaFade <= 0.02) return;

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.74);
  const project = (wx, wy, wz) => ({
    sx: cx + wx,
    sy: cy + wy * Y_PITCH - wz,
    wx, wy, wz,
    depth: wy * 0.83 + wz * 0.55
  });

  // Grounded shadow / arcane floor ring
  ctx.save();
  ctx.fillStyle = "rgba(14, 10, 32, 0.34)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 34 * growth, 34 * growth * Y_PITCH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];
  const spin = p * Math.PI * 6.5;

  if (mode === "cage") {
    // 3D HEXAGONAL ENERGY CAGE (Thunder Cage / Ice Prison / Fire Spin Cage!)
    const posts = 6;
    const rad = 32 * growth;
    const postH = 52 * growth;
    const postCoords = [];
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2 + 0.25;
      const wx = Math.cos(a) * rad, wy = Math.sin(a) * rad;
      const bot = project(wx, wy, 0);
      const top = project(wx, wy, postH);
      postCoords.push({ wx, wy, bot, top });
      // Sculpted vertical energy post
      drawItems.push({ depth: (bot.depth + top.depth) * 0.5, kind: "line", pts: [bot, top], width: 5.5, color: pal.deep });
      drawItems.push({ depth: (bot.depth + top.depth) * 0.5 + 0.4, kind: "line", pts: [bot, top], width: 2.5, color: pal.hi });
      // Glowing cap crystal at top of each post
      drawItems.push({ depth: top.depth + 1.0, kind: "puff", x: top.sx, y: top.sy, rx: 4.5, ry: 4.5, color: pal.core });
    }
    // 2 Tiers of crackling horizontal 3D fence arcs linking adjacent posts!
    for (let tier = 0; tier < 2; tier++) {
      const z = (tier === 0 ? 18 : 38) * growth;
      for (let i = 0; i < posts; i++) {
        const a = postCoords[i], b = postCoords[(i + 1) % posts];
        const p0 = project(a.wx, a.wy, z);
        const midZ = z + Math.sin(spin * 2 + i * 2.1 + tier) * 5;
        const pm = project((a.wx + b.wx) * 0.5, (a.wy + b.wy) * 0.5, midZ);
        const p1 = project(b.wx, b.wy, z);
        drawItems.push({ depth: pm.depth + 0.2, kind: "line", pts: [p0, pm, p1], width: 3.4, color: pal.mid });
        drawItems.push({ depth: pm.depth + 0.6, kind: "line", pts: [p0, pm, p1], width: 1.5, color: pal.core });
      }
    }
  } else {
    // 3D GYROSCOPIC TELEKINESIS FIELD (3 tilted intersecting 3D rings + rising lift ribbons + orbiting crystals!)
    const liftZ = 34 + Math.sin(clamp(p / 0.72, 0, 1) * Math.PI * 0.5) * 28;
    const rings = [
      { rx: 32 * growth, tiltX: 0.35, tiltY: 0.2, speed: 1.2, col: pal.hi },
      { rx: 28 * growth, tiltX: -0.95, tiltY: 0.55, speed: -1.6, col: pal.mid },
      { rx: 24 * growth, tiltX: 1.15, tiltY: -0.65, speed: 2.0, col: pal.core }
    ];
    // Grounded base rune ring (Z = 2)
    const baseSegs = 18;
    for (let i = 0; i < baseSegs; i++) {
      const a0 = (i / baseSegs) * Math.PI * 2 + spin * 0.5;
      const a1 = ((i + 1) / baseSegs) * Math.PI * 2 + spin * 0.5;
      const p0 = project(Math.cos(a0) * 28 * growth, Math.sin(a0) * 28 * growth, 2);
      const p1 = project(Math.cos(a1) * 28 * growth, Math.sin(a1) * 28 * growth, 2);
      drawItems.push({ depth: (p0.depth + p1.depth) * 0.5 - 2, kind: "line", pts: [p0, p1], width: 3.0, color: i % 2 === 0 ? pal.mid : pal.hi });
    }
    // 3 Tilted 3D Gyroscopic Psychic Rings around the lifted target!
    for (const rg of rings) {
      const segs = 20;
      const rot = spin * rg.speed;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2 + rot;
        const a1 = ((i + 1) / segs) * Math.PI * 2 + rot;
        const evalPt = (a) => {
          const ux = Math.cos(a) * rg.rx;
          const uy = Math.sin(a) * rg.rx;
          const wx = ux * Math.cos(rg.tiltY);
          const wy = uy * Math.cos(rg.tiltX);
          const wz = liftZ + uy * Math.sin(rg.tiltX) + ux * Math.sin(rg.tiltY);
          return project(wx, wy, wz);
        };
        const p0 = evalPt(a0), p1 = evalPt(a1);
        drawItems.push({ depth: (p0.depth + p1.depth) * 0.5, kind: "line", pts: [p0, p1], width: 3.6, color: pal.deep });
        drawItems.push({ depth: (p0.depth + p1.depth) * 0.5 + 0.5, kind: "line", pts: [p0, p1], width: 1.8, color: rg.col });
      }
    }
    // 6 Orbiting Floating Psychic Crystal Shards!
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + spin * 1.1;
      const z = liftZ + Math.sin(a * 2 + spin) * 14;
      const cp = project(Math.cos(a) * 35 * growth, Math.sin(a) * 35 * growth, z);
      drawItems.push({ depth: cp.depth + 2.0, kind: "puff", x: cp.sx, y: cp.sy, rx: 4.5, ry: 3.0, color: i % 2 === 0 ? pal.core : pal.hi });
    }
  }

  drawItems.sort((a, b) => a.depth - b.depth);
  for (const it of drawItems) {
    if (it.kind === "line") {
      ctx.strokeStyle = rgbCss(it.color);
      ctx.lineWidth = it.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].sx, it.pts[i].sy);
      ctx.stroke();
    } else if (it.kind === "puff") {
      ctx.fillStyle = rgbCss(it.color);
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, Math.max(1, it.rx), Math.max(1, it.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  finishPixelFxPass(ctx, width, height, { paletteColors: palColors(pal), ink: pal.ink, alphaFade, dither: 9 });
}

// ============================================================================
// Live PixiJS Sprite Wrappers for Moves #5-#8
// ============================================================================

function makeAnimated3DSprite({ PIXI, layer, width, height, anchorX, anchorY, x, y, follow = null, durationSec, scale, renderFrame, doc = globalThis.document }) {
  if (!PIXI || !layer) return null;
  const canvas = doc?.createElement?.("canvas");
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  canvas.width = width;
  canvas.height = height;
  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(anchorX, anchorY);
  sprite.scale.set(scale);
  sprite.position.set(Math.round(x), Math.round(y));
  layer.addChild(sprite);

  let age = 0, lastRenderAt = -1, dead = false;
  const drawNow = (phase) => {
    renderFrame(ctx, phase);
    texture.source?.update?.();
  };
  drawNow(0.06);

  return {
    update(dt) {
      if (dead) return false;
      age += dt;
      if (typeof follow === "function") {
        const pos = follow();
        if (pos) sprite.position.set(Math.round(pos.x), Math.round(pos.y));
      }
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

export function createVolumetricCraterShockwaveSprite({ PIXI, layer, x, y, paletteKey = "earth", durationSec = 0.55, scale = 1.55, doc = globalThis.document }) {
  return makeAnimated3DSprite({
    PIXI, layer, width: 160, height: 124, anchorX: 0.5, anchorY: 0.64, x, y: y + 4, durationSec, scale, doc,
    renderFrame: (ctx, phase) => renderVolumetricCraterShockwave3D(ctx, { width: 160, height: 124, phase, paletteKey })
  });
}

export function createVolumetricBeamSprite({ PIXI, layer, x, y, angle = 0, paletteKey = "light", durationSec = 0.52, scale = 1.75, length = 112, doc = globalThis.document }) {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  return makeAnimated3DSprite({
    PIXI, layer, width: 180, height: 140, anchorX: 0.5, anchorY: 0.58,
    x: x + cosA * length * 0.36 * scale, y: y + sinA * length * 0.36 * Y_PITCH * scale,
    durationSec, scale, doc,
    renderFrame: (ctx, phase) => renderVolumetricBeam3D(ctx, { width: 180, height: 140, angle, phase, paletteKey, length })
  });
}

export function createVolumetricMeteorSprite({ PIXI, layer, x, y, paletteKey = "fire", variant = "meteor", durationSec = 0.92, scale = 1.65, doc = globalThis.document }) {
  return makeAnimated3DSprite({
    PIXI, layer, width: 148, height: 196, anchorX: 0.5, anchorY: 0.82, x, y: y + 6, durationSec, scale, doc,
    renderFrame: (ctx, phase) => renderVolumetricMeteor3D(ctx, { width: 148, height: 196, phase, paletteKey, variant })
  });
}

export function createVolumetricPsychicCageSprite({ PIXI, layer, x, y, follow = null, paletteKey = "dark", mode = "telekinesis", durationSec = 0.85, scale = 1.5, doc = globalThis.document }) {
  return makeAnimated3DSprite({
    PIXI, layer, width: 148, height: 148, anchorX: 0.5, anchorY: 0.74, x, y: y + 6, follow, durationSec, scale, doc,
    renderFrame: (ctx, phase) => renderVolumetricPsychicCage3D(ctx, { width: 148, height: 148, phase, paletteKey, mode })
  });
}
