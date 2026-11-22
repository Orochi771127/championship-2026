// Data Arena Volumetric 3D Pixel-Art Move VFX Engine (2026-11-22).
//
// Move #1: Sculpted 3D Volumetric Curling Ocean Wave (`renderVolumetricWave3D`)
// True 3D wide-wall Hokusai / Wave-Crash curling tsunami shell + continuous floor water sheet +
// smooth anime cel-shading (zero checkerboard noise) + exact 3D depth sorting +
// billowing crest foam & leading splash collar + 1px dark pixel-art ink outline.
// Projects live at ANY continuous 360-degree angle (0..360 deg).

const WAVE_PALETTES = Object.freeze({
  water: {
    foam: [246, 254, 255],
    foamShade: [188, 240, 255],
    highlight: [94, 214, 255],
    mid: [30, 142, 234],
    deep: [16, 86, 176],
    shadow: [10, 44, 106],
    ink: [10, 24, 54]
  },
  ice: {
    foam: [248, 254, 255],
    foamShade: [204, 244, 255],
    highlight: [164, 236, 255],
    mid: [90, 192, 238],
    deep: [44, 124, 188],
    shadow: [22, 64, 122],
    ink: [14, 34, 64]
  },
  fire: {
    foam: [255, 252, 224],
    foamShade: [255, 222, 128],
    highlight: [255, 188, 70],
    mid: [242, 104, 36],
    deep: [180, 40, 24],
    shadow: [104, 18, 22],
    ink: [46, 10, 14]
  },
  dark: {
    foam: [238, 216, 255],
    foamShade: [198, 152, 246],
    highlight: [172, 104, 242],
    mid: [110, 50, 180],
    deep: [62, 24, 114],
    shadow: [32, 12, 66],
    ink: [16, 6, 34]
  }
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rgbCss(c, a = 1) {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

// Unified 2x2 Bayer ordered dithering + curated palette snap + crisp 1px dark PixelFX ink outline!
// Gives ALL 3D volumetric moves (Wave, Tornado, Rock/Tree/Ice Shield Walls, Burrow, Ground Spikes,
// Shockwaves, Beams, Meteors) the exact same cohesive 16-bit PixelFX material grain & silhouette pop.
const BAYER_2X2 = [
  [-1, 1],
  [1, -1]
];

export function finishPixelFxPass(ctx, width, height, { paletteColors = null, ink = [12, 22, 42], alphaFade = 1, dither = 10 } = {}) {
  if (typeof ctx.getImageData !== "function") return;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const bRow = BAYER_2X2[y & 1];
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const o = i * 4;
      const a = d[o + 3];
      if (a >= 140) {
        if (paletteColors && paletteColors.length) {
          const bias = bRow[x & 1] * dither;
          const r = clamp(d[o] + bias, 0, 255);
          const g = clamp(d[o + 1] + bias, 0, 255);
          const b = clamp(d[o + 2] + bias, 0, 255);
          let best = paletteColors[0];
          let bestDist = 1e9;
          for (let k = 0; k < paletteColors.length; k++) {
            const pc = paletteColors[k];
            const dr = r - pc[0], dg = g - pc[1], db = b - pc[2];
            const dist = dr * dr + dg * dg + db * db;
            if (dist < bestDist) { bestDist = dist; best = pc; }
          }
          d[o] = best[0];
          d[o + 1] = best[1];
          d[o + 2] = best[2];
        }
        d[o + 3] = Math.round(255 * alphaFade);
        mask[i] = 1;
      } else if (a >= 26 && d[o] < 28 && d[o + 1] < 36) {
        // Preserve soft grounded contact shadows on Z = 0
        d[o + 3] = Math.round(a * alphaFade);
      } else {
        d[o + 3] = 0;
      }
    }
  }

  const [ir, ig, ib] = ink;
  const outlineAlpha = Math.round(255 * alphaFade);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx]) continue;
      if (mask[idx - 1] || mask[idx + 1] || mask[idx - width] || mask[idx + width]) {
        const o = idx * 4;
        d[o] = ir;
        d[o + 1] = ig;
        d[o + 2] = ib;
        d[o + 3] = outlineAlpha;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Evaluate a point on the TRUE 3D wide-wall curling tsunami shell in wave-local space:
 *   +X = forward travel direction (sweeping from -40 rear wake -> +28 curling lip)
 *   +Y = lateral width across the wave wall (-25 .. +25)
 *   +Z = vertical height straight up off the arena floor (0 .. 50)
 */
function waveShellPoint(u, v, layer, swell, curl, timePhase) {
  const edge = Math.abs(u);
  // Broad ocean wave wall across the middle 75%, smoothly tapering at the far wings
  const shoulder = edge < 0.72 ? 1.0 : Math.cos(((edge - 0.72) / 0.28) * Math.PI * 0.5);
  const archH = (0.38 + 0.62 * Math.pow(Math.max(0, shoulder), 0.7)) * swell;
  const halfWidth = 25;
  const lateral = u * halfWidth;
  // Gentle forward crescent bow
  const crescentLead = (1 - u * u) * 4.5;

  let fwd = 0;
  let up = 0;
  let thickFwd = 0;
  let thickUp = 0;

  if (v < 0.28) {
    // Sleek ground-hugging trailing water wake tapering cleanly into speed-ribbons
    const k = v / 0.28;
    fwd = -42 + k * 28;
    up = Math.pow(k, 2.5) * 5.5 * archH;
    thickFwd = (4.0 + 9.0 * k) * (0.45 + 0.55 * shoulder);
    thickUp = -0.8 * k;
  } else if (v < 0.68) {
    // Tall concave ocean sweep surging gracefully upward to 52 native px!
    const k = (v - 0.28) / 0.40;
    const ease = Math.sin(k * Math.PI * 0.5);
    fwd = -14 + k * 24;
    up = (5.5 + ease * 45.5) * archH;
    const thick = (1 - k * 0.56) * 12.5 * (0.5 + 0.5 * shoulder);
    thickFwd = thick;
    thickUp = -thick * 0.48;
  } else {
    // Dramatic PB-Ranked-style overhanging C-hook curling boldly forward over open air!
    const k = (v - 0.68) / 0.32;
    const theta = k * (Math.PI * (0.86 + 0.18 * curl));
    const r = (18.0 + 2.8 * curl) * (0.50 + 0.50 * shoulder) * swell;
    fwd = 10 + Math.sin(theta) * r * 1.28;
    up = 51.0 * archH - (1 - Math.cos(theta)) * r * 0.80;
    const thick = (1 - k * 0.68) * 5.2 * (0.5 + 0.5 * shoulder);
    thickFwd = Math.cos(theta) * thick * 0.7;
    thickUp = -Math.sin(theta) * thick - 2.0 * (1 - k);
  }

  // Gentle traveling surface ripple (very subtle so silhouette stays razor-clean!)
  const ripple = Math.sin(u * 3.0 + timePhase * 7.5 + v * 4.0) * 0.55 * v * swell;
  if (layer === "inner") {
    return {
      x: fwd + crescentLead + thickFwd,
      y: lateral,
      z: Math.max(0, up + thickUp + ripple * 0.4)
    };
  }
  return {
    x: fwd + crescentLead,
    y: lateral,
    z: Math.max(0, up + ripple)
  };
}

/**
 * Render a TRUE 3D volumetric wide-wall curling ocean wave at ANY continuous 360-degree angle
 * onto a crisp pixel canvas (`width=136, height=116`).
 */
export function renderVolumetricWave3D(ctx, {
  width = 136,
  height = 116,
  angle = 0,
  phase = 0.48,
  paletteKey = "water"
} = {}) {
  const pal = WAVE_PALETTES[paletteKey] ?? WAVE_PALETTES.water;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  const swell = p < 0.20 ? Math.sin((p / 0.20) * Math.PI * 0.5)
    : p < 0.78 ? 1.0
      : Math.max(0.10, 1 - (p - 0.78) / 0.22);
  const curl = p < 0.15 ? 0.35 : p < 0.75 ? 0.58 + 0.42 * ((p - 0.15) / 0.6) : 1.0 + (p - 0.75) * 1.1;
  const alphaFade = p > 0.85 ? Math.max(0, 1 - (p - 0.85) / 0.15) : 1;
  if (alphaFade <= 0.02 || swell <= 0.04) return;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.70);
  const Y_PITCH = 0.56;

  const project = (lx, ly, lz) => {
    const wx = lx * cosA - ly * sinA;
    const wy = lx * sinA + ly * cosA;
    return {
      sx: cx + wx,
      sy: cy + wy * Y_PITCH - lz,
      wx,
      wy,
      wz: lz,
      // Strict true-3D camera depth (camera looks from south-above at ~56 deg elevation)
      depth: wy * 0.83 + lz * 0.55
    };
  };

  // 1. Soft ground shadow anchored strictly on Z = 0
  ctx.save();
  ctx.globalAlpha = 0.34 * alphaFade;
  ctx.fillStyle = "rgb(8, 18, 36)";
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    const pt = project(1 + Math.cos(t) * 32, Math.sin(t) * 28, 0);
    if (i === 0) ctx.moveTo(pt.sx, pt.sy); else ctx.lineTo(pt.sx, pt.sy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Build closed 3D volumetric wave shell
  const NU = 16;
  const NV = 16;
  const outerGrid = [];
  const innerGrid = [];
  for (let iv = 0; iv <= NV; iv++) {
    const v = iv / NV;
    const oRow = [];
    const iRow = [];
    for (let iu = 0; iu <= NU; iu++) {
      const u = (iu / NU) * 2 - 1;
      const op = waveShellPoint(u, v, "outer", swell, curl, p);
      const ip = waveShellPoint(u, v, "inner", swell, curl, p);
      oRow.push({ ...op, ...project(op.x, op.y, op.z), u, v });
      iRow.push({ ...ip, ...project(ip.x, ip.y, ip.z), u, v });
    }
    outerGrid.push(oRow);
    innerGrid.push(iRow);
  }

  // Sunlit from upper-south-west for vibrant 3D contrast at every angle
  const Lx = -0.20, Ly = 0.32, Lz = 0.92;
  const drawables = [];

  // Grounded floor-water sheet connecting the wave base seamlessly to the leading foam splash
  for (let iu = 0; iu < NU; iu++) {
    const u0 = (iu / NU) * 2 - 1;
    const u1 = ((iu + 1) / NU) * 2 - 1;
    const w0 = Math.max(0.25, 1 - u0 * u0);
    const w1 = Math.max(0.25, 1 - u1 * u1);
    const f0 = innerGrid[2][iu];
    const f1 = innerGrid[2][iu + 1];
    const lead0 = project(13 + w0 * 6, u0 * 25, 0.4);
    const lead1 = project(13 + w1 * 6, u1 * 25, 0.4);
    const depth = (f0.depth + f1.depth + lead0.depth + lead1.depth) * 0.25 - 1.2;
    drawables.push({
      kind: "poly",
      pts: [f0, f1, lead1, lead0],
      col: pal.mid,
      depth
    });
  }

  // Smooth cel-shaded 3D quads (ZERO backface culling holes & ZERO checkerboard noise!)
  const pushQuad = (p00, p10, p11, p01, isInner, vMid) => {
    const e1x = p10.wx - p00.wx, e1y = p10.wy - p00.wy, e1z = p10.wz - p00.wz;
    const e2x = p01.wx - p00.wx, e2y = p01.wy - p00.wy, e2z = p01.wz - p00.wz;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen; ny /= nLen; nz /= nLen;
    if (isInner) { nx = -nx; ny = -ny; nz = -nz; }

    const ndl = nx * Lx + ny * Ly + nz * Lz;
    // Clean, smooth sweeping anime water bands purely along v (no jagged u-checkerboard!)
    const flowPhase = ((vMid * 3.0 - p * 2.2) % 1 + 1) % 1;
    const isHighlightRibbon = flowPhase > 0.78 && flowPhase < 0.90;

    let col;
    if (vMid > 0.89) {
      col = pal.foam;
    } else if (vMid > 0.80 && !isInner) {
      col = pal.highlight;
    } else if (isInner) {
      // Concave hollow barrel interior: dramatic deep ocean shadow high under the arch, bright aqua near the floor!
      if (vMid > 0.56) {
        col = pal.shadow;
      } else if (vMid > 0.34) {
        col = pal.deep;
      } else {
        col = isHighlightRibbon ? pal.foamShade : pal.mid;
      }
    } else {
      // Outer sculpted wave back/arch: smooth 3-band anime cel shading (bright cyan crown -> rich blue mid -> deep base)
      if (vMid < 0.18) {
        col = isHighlightRibbon ? pal.foamShade : pal.highlight;
      } else if (isHighlightRibbon && vMid > 0.35 && vMid < 0.76) {
        col = pal.highlight;
      } else if (ndl > 0.45) {
        col = pal.highlight;
      } else if (ndl > 0.05) {
        col = pal.mid;
      } else {
        col = pal.deep;
      }
    }
    const depth = (p00.depth + p10.depth + p11.depth + p01.depth) * 0.25;
    drawables.push({ kind: "poly", pts: [p00, p10, p11, p01], col, depth });
  };

  for (let iv = 0; iv < NV; iv++) {
    const vMid = (iv + 0.5) / NV;
    for (let iu = 0; iu < NU; iu++) {
      pushQuad(outerGrid[iv][iu], outerGrid[iv][iu + 1], outerGrid[iv + 1][iu + 1], outerGrid[iv + 1][iu], false, vMid);
      if (iv >= 2) {
        pushQuad(innerGrid[iv][iu], innerGrid[iv][iu + 1], innerGrid[iv + 1][iu + 1], innerGrid[iv + 1][iu], true, vMid);
      }
    }
  }

  // Sculpted side end-caps (u = -1 and u = +1): crisp thick C-curve profile on Left/Right views!
  for (const sideIdx of [0, NU]) {
    for (let iv = 2; iv < NV; iv++) {
      const o0 = outerGrid[iv][sideIdx], o1 = outerGrid[iv + 1][sideIdx];
      const i1 = innerGrid[iv + 1][sideIdx], i0 = innerGrid[iv][sideIdx];
      const vMid = (iv + 0.5) / NV;
      const col = vMid > 0.86 ? pal.foam : vMid > 0.58 ? pal.highlight : vMid > 0.28 ? pal.mid : pal.deep;
      const depth = (o0.depth + o1.depth + i1.depth + i0.depth) * 0.25;
      drawables.push({ kind: "poly", pts: [o0, o1, i1, i0], col, depth });
    }
  }

  // Thick breaking foam lip cap along v = NV
  for (let iu = 0; iu < NU; iu++) {
    const o0 = outerGrid[NV][iu], o1 = outerGrid[NV][iu + 1];
    const i1 = innerGrid[NV][iu + 1], i0 = innerGrid[NV][iu];
    const depth = (o0.depth + o1.depth + i1.depth + i0.depth) * 0.25;
    drawables.push({ kind: "poly", pts: [o0, o1, i1, i0], col: pal.foam, depth });
  }

  // 3. Continuous billowing white-foam crest & grounded leading splash collar (strict 3D depth — never pokes through back wall!)
  const crownIdx = Math.round(NV * 0.72);
  for (let iu = 0; iu <= NU; iu++) {
    const u = (iu / NU) * 2 - 1;
    const edge = Math.abs(u);
    const wing = edge < 0.72 ? 1.0 : Math.max(0.25, Math.cos(((edge - 0.72) / 0.28) * Math.PI * 0.5));
    const lip = outerGrid[NV][iu];
    const crown = outerGrid[crownIdx][iu];
    const wobble = Math.sin(iu * 1.9 + p * 12.0);

    // Front breaking lip foam (sits strictly at lip's true 3D depth -> naturally occluded by back wall when moving UP!)
    drawables.push({
      kind: "puff",
      sx: lip.sx + wobble * 0.9,
      sy: lip.sy - 0.8,
      r: (3.2 + (iu % 3) * 0.8) * Math.sqrt(wing) * swell,
      col: pal.foam,
      shade: pal.foamShade,
      depth: lip.depth + 0.15
    });

    // High breaking crown spray (sits right on the top ridge of the arch -> visible cleanly from UP, SIDE & DIAGONAL!)
    drawables.push({
      kind: "puff",
      sx: crown.sx,
      sy: crown.sy - 2.0,
      r: (2.6 + ((iu * 3) % 3) * 0.7) * Math.sqrt(wing) * swell,
      col: pal.foam,
      shade: pal.foamShade,
      depth: crown.depth + 0.15
    });

    // Churning floor-level leading foam collar fused seamlessly with the floor water sheet
    const leadFoot = project(14 + (1 - u * u) * 5.0, u * 25, 1.8);
    drawables.push({
      kind: "puff",
      sx: leadFoot.sx,
      sy: leadFoot.sy,
      r: (3.4 + (iu % 2) * 0.9) * Math.sqrt(wing) * Math.min(1, swell * 1.2),
      col: pal.foam,
      shade: pal.foamShade,
      depth: leadFoot.depth + 0.15
    });
  }

  // 4. Wind-swept crest spray wisps & flying pixel droplets bursting off the curling crest!
  for (let iu = 1; iu < NU; iu += 2) {
    const u = (iu / NU) * 2 - 1;
    const cPt = outerGrid[crownIdx][iu];
    const sprayBack = project(cPt.x - 7 - (iu % 3) * 3, cPt.y, cPt.z + 4 + (iu % 2) * 2);
    drawables.push({
      kind: "poly",
      pts: [
        { sx: cPt.sx - 1, sy: cPt.sy - 1 },
        { sx: cPt.sx + 2, sy: cPt.sy - 2 },
        { sx: sprayBack.sx, sy: sprayBack.sy }
      ],
      col: pal.foam,
      depth: cPt.depth + 0.22
    });
  }
  const dropCount = p > 0.70 ? 20 : 12;
  for (let i = 0; i < dropCount; i++) {
    const seed = (i * 0.6180339) % 1;
    const u = (seed * 2 - 1) * 0.88;
    const burst = (p * 2.3 + i * 0.19) % 1;
    const lx = 20 + burst * (15 + (i % 4) * 3);
    const ly = u * 25;
    const lz = Math.max(1, (46 * swell) * (1 - burst * burst * 0.90) + ((i % 3) - 1) * 3);
    const dp = project(lx, ly, lz);
    drawables.push({
      kind: "drop",
      sx: dp.sx,
      sy: dp.sy,
      sz: i % 3 === 0 ? 2 : 1,
      col: i % 2 === 0 ? pal.foam : pal.highlight,
      depth: dp.depth + 0.25
    });
  }

  drawables.sort((a, b) => a.depth - b.depth);

  ctx.save();
  for (const item of drawables) {
    if (item.kind === "poly") {
      ctx.fillStyle = rgbCss(item.col);
      ctx.beginPath();
      for (let i = 0; i < item.pts.length; i++) {
        const pt = item.pts[i];
        if (i === 0) ctx.moveTo(pt.sx, pt.sy); else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgbCss(item.col);
      ctx.lineWidth = 0.85;
      ctx.stroke();
    } else if (item.kind === "puff") {
      if (item.r < 0.8) continue;
      ctx.fillStyle = rgbCss(item.shade);
      ctx.beginPath();
      ctx.arc(Math.round(item.sx), Math.round(item.sy + 0.8), item.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgbCss(item.col);
      ctx.beginPath();
      ctx.arc(Math.round(item.sx), Math.round(item.sy - 0.6), item.r * 0.82, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === "drop") {
      ctx.fillStyle = rgbCss(item.col);
      ctx.fillRect(Math.round(item.sx), Math.round(item.sy), item.sz, item.sz);
    }
  }
  ctx.restore();

  // 5. Crisp 16-bit Pixel-Art Finish Pass: hard-alpha snap + 1px dark ink silhouette outline!
  if (typeof ctx.getImageData === "function" && typeof ctx.putImageData === "function") {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const a = d[i * 4 + 3];
      if (a >= 135) {
        d[i * 4 + 3] = Math.round(255 * alphaFade);
        mask[i] = 1;
      } else if (a >= 30 && d[i * 4] < 24 && d[i * 4 + 1] < 32) {
        d[i * 4 + 3] = Math.round(a * alphaFade);
      } else {
        d[i * 4 + 3] = 0;
      }
    }
    const [ir, ig, ib] = pal.ink;
    const outlineAlpha = Math.round(255 * alphaFade);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx]) continue;
        if (mask[idx - 1] || mask[idx + 1] || mask[idx - width] || mask[idx + width]) {
          d[idx * 4] = ir;
          d[idx * 4 + 1] = ig;
          d[idx * 4 + 2] = ib;
          d[idx * 4 + 3] = outlineAlpha;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}

/**
 * Create a live PixiJS-ready volumetric 3D wave instance that updates its crisp
 * pixel canvas as the wave travels at any continuous 360-degree angle.
 */
export function createVolumetricWaveSprite({ PIXI, layer, follow, angle = 0, paletteKey = "water", durationSec = 0.85, scale = 1.65, leadOffset = 0, yOffset = 12, doc = globalThis.document }) {
  if (!PIXI || !layer || typeof follow !== "function") return null;
  const width = 136, height = 116;
  const canvas = doc?.createElement?.("canvas");
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  canvas.width = width;
  canvas.height = height;

  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 0.70);
  sprite.scale.set(scale);
  layer.addChild(sprite);

  let age = 0;
  let lastRenderAt = -1;
  let curAngle = angle;
  let prevX = null, prevY = null;
  let dead = false;

  const drawNow = (phase) => {
    renderVolumetricWave3D(ctx, { width, height, angle: curAngle, phase, paletteKey });
    texture.source?.update?.();
  };

  const placeAt = (pos) => {
    const ox = leadOffset ? Math.cos(curAngle) * leadOffset : 0;
    const oy = leadOffset ? Math.sin(curAngle) * leadOffset * 0.56 : 0;
    sprite.position.set(Math.round(pos.x + ox), Math.round(pos.y + yOffset + oy));
  };

  const pos0 = follow();
  if (pos0) {
    if (Number.isFinite(pos0.angle)) curAngle = pos0.angle;
    placeAt(pos0);
    drawNow(0.08);
  }

  return {
    update(dt) {
      if (dead) return false;
      age += dt;
      const pos = age <= durationSec + 0.25 ? follow() : null;
      if (!pos && age > durationSec) {
        this.dispose();
        return false;
      }
      if (pos) {
        if (Number.isFinite(pos.angle)) curAngle = pos.angle;
        else if (prevX !== null && Math.hypot(pos.x - prevX, pos.y - prevY) > 0.5) {
          curAngle = Math.atan2(pos.y - prevY, pos.x - prevX);
        }
        prevX = pos.x; prevY = pos.y;
        placeAt(pos);
      }
      // Step volumetric 3D pixel frames cleanly at ~24 fps for snappy pixel-art motion & low CPU cost
      const phase = clamp(age / Math.max(0.2, durationSec), 0, 1);
      if (age - lastRenderAt >= 1 / 24 || phase >= 0.98) {
        lastRenderAt = age;
        drawNow(phase);
      }
      if (!pos && age >= durationSec * 0.96) {
        this.dispose();
        return false;
      }
      return true;
    },
    dispose() {
      if (dead) return;
      dead = true;
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
      texture.destroy(true);
      canvas.width = 0;
      canvas.height = 0;
    }
  };
}

// ============================================================================
// Move #2: Sculpted 3D Volumetric Pixel-Art Tornado / Elemental Storm Vortex
// True 3D S-curving tapered helical funnel + hollow dark vortex throat +
// grounded swirling vortex collar + orbiting 3D debris + 1px dark ink outline.
// Supports continuous 360-degree lean/sway angles & all 8 elemental palettes!
// ============================================================================

const TORNADO_PALETTES = Object.freeze({
  wind: {
    crest: [246, 255, 250],
    highlight: [176, 244, 224],
    mid: [94, 198, 178],
    deep: [44, 134, 128],
    shadow: [22, 74, 78],
    debris: [210, 255, 226],
    ink: [14, 42, 46]
  },
  water: {
    crest: [246, 254, 255],
    highlight: [122, 222, 255],
    mid: [38, 152, 236],
    deep: [18, 92, 182],
    shadow: [10, 46, 108],
    debris: [220, 248, 255],
    ink: [10, 24, 54]
  },
  ice: {
    crest: [252, 255, 255],
    highlight: [192, 242, 255],
    mid: [112, 206, 244],
    deep: [52, 136, 198],
    shadow: [26, 70, 128],
    debris: [238, 252, 255],
    ink: [16, 36, 68]
  },
  nature: {
    crest: [236, 255, 212],
    highlight: [148, 234, 126],
    mid: [68, 184, 96],
    deep: [32, 122, 68],
    shadow: [18, 68, 42],
    debris: [182, 248, 118],
    ink: [12, 40, 24]
  },
  dark: {
    crest: [242, 216, 255],
    highlight: [190, 116, 250],
    mid: [124, 56, 196],
    deep: [68, 26, 128],
    shadow: [34, 12, 72],
    debris: [226, 166, 255],
    ink: [18, 6, 38]
  },
  fire: {
    crest: [255, 252, 218],
    highlight: [255, 194, 78],
    mid: [242, 108, 36],
    deep: [184, 42, 24],
    shadow: [108, 18, 20],
    debris: [255, 224, 118],
    ink: [48, 10, 14]
  },
  earth: {
    crest: [252, 238, 202],
    highlight: [224, 184, 120],
    mid: [176, 128, 72],
    deep: [122, 82, 44],
    shadow: [72, 46, 24],
    debris: [236, 204, 148],
    ink: [38, 24, 12]
  },
  thunder: {
    crest: [255, 254, 212],
    highlight: [255, 228, 92],
    mid: [126, 152, 242],
    deep: [64, 78, 178],
    shadow: [32, 38, 104],
    debris: [255, 242, 134],
    ink: [18, 20, 56]
  }
});

/**
 * Render a TRUE 3D volumetric pixel-art Tornado / Storm Funnel at ANY lean/sway angle (0..360 deg)
 * onto a crisp pixel canvas (`width=136, height=136`).
 */
export function renderVolumetricTornado3D(ctx, {
  width = 136,
  height = 136,
  angle = 0,
  phase = 0.45,
  paletteKey = "wind"
} = {}) {
  const pal = TORNADO_PALETTES[paletteKey] ?? TORNADO_PALETTES.wind;
  ctx.clearRect(0, 0, width, height);

  const p = clamp(phase, 0, 1);
  // Rapid rise -> roaring full storm -> crisp collapse
  const growth = p < 0.16 ? Math.sin((p / 0.16) * Math.PI * 0.5)
    : p < 0.84 ? 1.0
      : Math.max(0.08, 1 - (p - 0.84) / 0.16);
  const alphaFade = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
  if (growth <= 0.05 || alphaFade <= 0.02) return;

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.80);
  const Y_PITCH = 0.56;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const spin = p * Math.PI * 10.5;

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

  // 1. Grounded vortex shadow (Z = 0)
  ctx.save();
  ctx.fillStyle = "rgba(10, 20, 36, 0.34)";
  ctx.beginPath();
  const sCenter = project(0, 0, 0);
  ctx.ellipse(sCenter.sx, sCenter.sy + 2, 26 * growth, 26 * growth * Y_PITCH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const drawItems = [];

  // 2. Organic billowing ground vortex dust/spray collar (depth-sorted 3D cloud puffs, NO scalloped pie skirt!)
  const basePuffs = 16;
  for (let i = 0; i < basePuffs; i++) {
    const a = (i / basePuffs) * Math.PI * 2 + spin * 1.15;
    const rad = (16.5 + Math.sin(i * 2.1 + spin) * 4.5) * growth;
    const z = (2.8 + (i % 3) * 1.6) * growth;
    const pp = project(Math.cos(a) * rad, Math.sin(a) * rad, z);
    const pr = (4.6 + (i % 3) * 1.4) * growth;
    const col = pp.wy > 4 ? pal.crest : pp.wy > -6 ? pal.highlight : pal.mid;
    drawItems.push({
      depth: pp.depth - 1.2,
      kind: "puff",
      x: pp.sx,
      y: pp.sy,
      rx: pr * 1.25,
      ry: pr * 0.78,
      color: col
    });
  }

  // 3. True 3D S-curving tapered tornado spine (leans gracefully along `angle` in full 360° 3D!)
  const spineAt = (t) => {
    const z = t * 74 * growth;
    const leanFwd = (Math.pow(t, 1.45) * 17 + Math.sin(t * Math.PI * 2.1 - spin * 0.55) * 4.0 * t) * growth;
    const swayLat = (Math.cos(t * Math.PI * 1.8 - spin * 0.55) * 3.2 * t) * growth;
    // Sleek iconic tornado silhouette: tight whipping tip -> fluid waist -> flaring storm crown
    const radius = (6.8 + Math.pow(t, 1.32) * 24.5 + Math.sin(t * Math.PI * 5.0 - spin * 1.4) * 1.8) * growth;
    return { x: leanFwd, y: swayLat, z, r: radius };
  };

  // Smooth cel-shaded 3D layered wind-torus bands (zero quad-grid mosaic!)
  const BANDS = 22;
  const U_SEGS = 28;
  for (let ib = 0; ib < BANDS; ib++) {
    const t0 = ib / BANDS;
    const t1 = Math.min(1, (ib + 1.22) / BANDS); // slight vertical overlap for zero seams
    const sp0 = spineAt(t0);
    const sp1 = spineAt(t1);
    const tiltSpin = spin * 1.45 + t0 * Math.PI * 4.2;

    // Subtle helical wobble per tier
    const off0x = Math.cos(tiltSpin) * 1.4 * growth;
    const off0y = Math.sin(tiltSpin) * 1.4 * growth;
    const off1x = Math.cos(tiltSpin + 0.5) * 1.4 * growth;
    const off1y = Math.sin(tiltSpin + 0.5) * 1.4 * growth;

    for (let iu = 0; iu < U_SEGS; iu++) {
      const a0 = (iu / U_SEGS) * Math.PI * 2;
      const a1 = ((iu + 1) / U_SEGS) * Math.PI * 2;
      const aMid = (a0 + a1) * 0.5;
      const p00 = project(sp0.x + off0x + Math.cos(a0) * sp0.r, sp0.y + off0y + Math.sin(a0) * sp0.r, sp0.z);
      const p10 = project(sp0.x + off0x + Math.cos(a1) * sp0.r, sp0.y + off0y + Math.sin(a1) * sp0.r, sp0.z);
      const p11 = project(sp1.x + off1x + Math.cos(a1) * sp1.r, sp1.y + off1y + Math.sin(a1) * sp1.r, sp1.z);
      const p01 = project(sp1.x + off1x + Math.cos(a0) * sp1.r, sp1.y + off1y + Math.sin(a0) * sp1.r, sp1.z);

      // Smooth anime 3-band cel-shading (lit cleanly from top-left, zero blocky checkerboard!)
      const nx = Math.cos(aMid) * cosA - Math.sin(aMid) * sinA;
      const ny = Math.cos(aMid) * sinA + Math.sin(aMid) * cosA;
      const tMid = (t0 + t1) * 0.5;
      const spiralPhase = Math.sin(aMid - tMid * 9.5 + spin * 1.6);

      let col;
      if (ny < -0.25) {
        // Back inner hollow face (only peeks inside top vortex throat)
        col = tMid > 0.78 ? pal.shadow : pal.deep;
      } else {
        const shade = -nx * 0.52 + ny * 0.28 + tMid * 0.18;
        if (spiralPhase > 0.76 && ny > 0.15) col = pal.crest;
        else if (shade > 0.34) col = pal.highlight;
        else if (shade > -0.14) col = pal.mid;
        else col = pal.deep;
      }
      drawItems.push({
        depth: (p00.depth + p10.depth + p11.depth + p01.depth) * 0.25,
        kind: "quad",
        pts: [p00, p10, p11, p01],
        color: col
      });
    }
  }

  // 4. Layered billowing storm-cloud crown ring around the top lip (replaces dark flat bowl!)
  const topSp = spineAt(0.97);
  // Subtle sunken swirling eye core inside the crown
  const eyeCenter = project(topSp.x, topSp.y, topSp.z - 2 * growth);
  drawItems.push({
    depth: eyeCenter.depth - 0.8,
    kind: "puff",
    x: eyeCenter.sx,
    y: eyeCenter.sy,
    rx: topSp.r * 0.72,
    ry: topSp.r * 0.72 * Y_PITCH,
    color: pal.deep
  });
  drawItems.push({
    depth: eyeCenter.depth - 0.6,
    kind: "puff",
    x: eyeCenter.sx,
    y: eyeCenter.sy + 1,
    rx: topSp.r * 0.36,
    ry: topSp.r * 0.36 * Y_PITCH,
    color: pal.shadow
  });

  // Fluffy spiraling crown cloud puffs ringing the upper vortex lip
  const crownPuffs = 16;
  for (let i = 0; i < crownPuffs; i++) {
    const a = (i / crownPuffs) * Math.PI * 2 + spin * 0.9;
    const r = topSp.r * (0.94 + 0.08 * Math.sin(i * 3 + spin));
    const pp = project(topSp.x + Math.cos(a) * r, topSp.y + Math.sin(a) * r, topSp.z + 1.5 * growth);
    const pr = (5.4 + (i % 3) * 1.4) * growth;
    const nx = Math.cos(a) * cosA - Math.sin(a) * sinA;
    const ny = Math.cos(a) * sinA + Math.sin(a) * cosA;
    const col = (-nx * 0.5 + ny * 0.4) > 0.22 ? pal.crest : ny > -0.2 ? pal.highlight : pal.mid;
    drawItems.push({
      depth: pp.depth + 0.5,
      kind: "puff",
      x: pp.sx,
      y: pp.sy,
      rx: pr * 1.25,
      ry: pr * 0.82,
      color: col
    });
  }

  // 5. Three sleek sweeping outer wind-whip arcs orbiting the funnel!
  for (let r = 0; r < 3; r++) {
    const startA = r * ((Math.PI * 2) / 3) + spin * 1.5;
    const steps = 16;
    for (let s = 0; s < steps; s++) {
      const t0 = 0.06 + (s / steps) * 0.86;
      const t1 = 0.06 + ((s + 1) / steps) * 0.86;
      const sp0 = spineAt(t0);
      const sp1 = spineAt(t1);
      const ang0 = startA + t0 * Math.PI * 2.8;
      const ang1 = startA + t1 * Math.PI * 2.8;
      const rad0 = sp0.r + (3.5 + t0 * 2.5) * growth;
      const rad1 = sp1.r + (3.5 + t1 * 2.5) * growth;
      const thick = (2.6 - Math.abs(s / steps - 0.5) * 2.6) * growth;
      const p0 = project(sp0.x + Math.cos(ang0) * rad0, sp0.y + Math.sin(ang0) * rad0, sp0.z);
      const p1 = project(sp1.x + Math.cos(ang1) * rad1, sp1.y + Math.sin(ang1) * rad1, sp1.z);
      const p1b = project(sp1.x + Math.cos(ang1) * rad1, sp1.y + Math.sin(ang1) * rad1, sp1.z + thick);
      const p0b = project(sp0.x + Math.cos(ang0) * rad0, sp0.y + Math.sin(ang0) * rad0, sp0.z + thick);
      drawItems.push({
        depth: (p0.depth + p1.depth) * 0.5 + 1.4,
        kind: "quad",
        pts: [p0, p1, p1b, p0b],
        color: s > 3 && s < 12 ? pal.crest : pal.highlight
      });
    }
  }

  // 6. 14 Orbiting 3D elemental debris flecks (leaves / ice crystals / foam / embers / wind blades)
  for (let i = 0; i < 14; i++) {
    const t = ((i / 14) + p * 0.9) % 1;
    const sp = spineAt(t);
    const orbitA = i * 2.39996 + spin * (1.35 + (i % 3) * 0.25);
    const orbitR = sp.r + (6 + (i % 4) * 3.5) * growth;
    const dp = project(sp.x + Math.cos(orbitA) * orbitR, sp.y + Math.sin(orbitA) * orbitR, sp.z + (i % 3) * 2);
    drawItems.push({
      depth: dp.depth + 0.8,
      kind: "debris",
      x: dp.sx,
      y: dp.sy,
      sz: i % 3 === 0 ? 3.0 : 2.0,
      color: i % 2 === 0 ? pal.debris : pal.crest
    });
  }

  // Strict Painter's depth sort
  drawItems.sort((a, b) => a.depth - b.depth);

  for (const item of drawItems) {
    if (item.kind === "quad") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
      ctx.lineTo(item.pts[1].sx, item.pts[1].sy);
      ctx.lineTo(item.pts[2].sx, item.pts[2].sy);
      ctx.lineTo(item.pts[3].sx, item.pts[3].sy);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === "puff") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.beginPath();
      ctx.ellipse(item.x, item.y, Math.max(1, item.rx), Math.max(1, item.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === "debris") {
      ctx.fillStyle = rgbCss(item.color);
      ctx.fillRect(Math.round(item.x - item.sz * 0.5), Math.round(item.y - item.sz * 0.5), Math.round(item.sz), Math.round(item.sz));
    }
  }

  // 7. Crisp 1px pixel-art dark ink outline + hard alpha quantization
  if (typeof ctx.getImageData === "function") {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const a = d[i * 4 + 3];
      if (a >= 140) {
        d[i * 4 + 3] = Math.round(255 * alphaFade);
        mask[i] = 1;
      } else if (a >= 30 && d[i * 4] < 24 && d[i * 4 + 1] < 32) {
        d[i * 4 + 3] = Math.round(a * alphaFade);
      } else {
        d[i * 4 + 3] = 0;
      }
    }
    const [ir, ig, ib] = pal.ink;
    const outlineAlpha = Math.round(255 * alphaFade);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (mask[idx]) continue;
        if (mask[idx - 1] || mask[idx + 1] || mask[idx - width] || mask[idx + width]) {
          d[idx * 4] = ir;
          d[idx * 4 + 1] = ig;
          d[idx * 4 + 2] = ib;
          d[idx * 4 + 3] = outlineAlpha;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}

/**
 * Create a live PixiJS-ready 3D Volumetric Tornado / Storm Vortex instance!
 */
export function createVolumetricTornadoSprite({ PIXI, layer, x = 0, y = 0, follow = null, angle = 0, paletteKey = "wind", durationSec = 1.05, scale = 1.55, doc = globalThis.document }) {
  if (!PIXI || !layer) return null;
  const width = 136, height = 136;
  const canvas = doc?.createElement?.("canvas");
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  canvas.width = width;
  canvas.height = height;

  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 0.80);
  sprite.scale.set(scale);
  sprite.position.set(Math.round(x), Math.round(y + 10));
  layer.addChild(sprite);

  let age = 0;
  let lastRenderAt = -1;
  let curAngle = angle;
  let dead = false;

  const drawNow = (phase) => {
    renderVolumetricTornado3D(ctx, { width, height, angle: curAngle, phase, paletteKey });
    texture.source?.update?.();
  };
  drawNow(0.06);

  return {
    update(dt) {
      if (dead) return false;
      age += dt;
      if (typeof follow === "function") {
        const pos = follow();
        if (pos) {
          sprite.position.set(Math.round(pos.x), Math.round(pos.y + 10));
          if (Number.isFinite(pos.angle)) curAngle = pos.angle;
        }
      }
      const phase = clamp(age / Math.max(0.25, durationSec), 0, 1);
      if (age - lastRenderAt >= 1 / 24 || phase >= 0.98) {
        lastRenderAt = age;
        drawNow(phase);
      }
      if (age >= durationSec) {
        this.dispose();
        return false;
      }
      return true;
    },
    dispose() {
      if (dead) return;
      dead = true;
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
      texture.destroy(true);
      canvas.width = 0;
      canvas.height = 0;
    }
  };
}
