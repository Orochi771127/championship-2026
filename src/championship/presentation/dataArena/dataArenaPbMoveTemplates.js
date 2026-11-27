// Data Arena -- Pixel-Snapped Brush Kit & Declarative PB-Rank Move Template Engine (2026-11-27).
//
// Solves two root structural gaps for scaling 324+ moves across 200+ partners at 60fps on 375x812:
//   1. Pixel-Snapped Cel-Shaded Primitives (`createPixelBrushKit`): replaces flat vector circles
//      and skinny wireframe polygons with 2px-grid-snapped 3-tone shaded pixel clouds, filled
//      stepped shock rings, 360-degree tapered slashes, and PB-style white half-hex honeycomb shields.
//   2. 14 Reusable Declarative Choreography Templates (`createPbTemplateEngine`): lets future PB
//      moves author full cast/release/projectile/hit/blocked staging in 6-12 lines of config instead
//      of 60-90 lines of bespoke Graphics code, with full 360-degree rotation and strict particle caps.
//
// Presentation only; pure ASCII; zero setTimeout/setInterval/requestAnimationFrame.

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap2 = (v) => Math.round(v * 0.5) * 2;

function splitRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function mixHex(hex, factor, lift = 0) {
  const [r, g, b] = splitRgb(hex);
  const cr = clamp(Math.round(r * factor + (255 - r) * lift), 0, 255);
  const cg = clamp(Math.round(g * factor + (255 - g) * lift), 0, 255);
  const cb = clamp(Math.round(b * factor + (255 - b) * lift), 0, 255);
  return (cr << 16) | (cg << 8) | cb;
}

export const PB_TEMPLATE_PALETTES = Object.freeze({
  fire:    Object.freeze({ main: 0xff8424, core: 0xfff6c8, deep: 0xc83212, dust: 0x6b584c, pal: "fire" }),
  water:   Object.freeze({ main: 0x38a6ff, core: 0xeafaff, deep: 0x1858b4, dust: 0x86c8e8, pal: "water" }),
  ice:     Object.freeze({ main: 0x7ce2ff, core: 0xffffff, deep: 0x3284c4, dust: 0xb6e8f8, pal: "ice" }),
  thunder: Object.freeze({ main: 0xffd62e, core: 0xfffff2, deep: 0xc6760c, dust: 0xb89c52, pal: "thunder" }),
  wind:    Object.freeze({ main: 0x76e8d4, core: 0xf0fffb, deep: 0x389496, dust: 0xa4c8c4, pal: "wind" }),
  wood:    Object.freeze({ main: 0x52cc58, core: 0xeaffc8, deep: 0x227834, dust: 0x769462, pal: "wood" }),
  earth:   Object.freeze({ main: 0xc8965c, core: 0xfff0cc, deep: 0x6e4c2e, dust: 0x8e7c68, pal: "earth" }),
  metal:   Object.freeze({ main: 0x9cb4cc, core: 0xffffff, deep: 0x48586c, dust: 0x7c8692, pal: "metal" }),
  sun:     Object.freeze({ main: 0xffca48, core: 0xffffff, deep: 0xc67414, dust: 0xd4b672, pal: "sun" }),
  moon:    Object.freeze({ main: 0xa858f0, core: 0xf8e2ff, deep: 0x421878, dust: 0x645478, pal: "moon" }),
  psychic: Object.freeze({ main: 0xff6ad0, core: 0xfff0fc, deep: 0x9c28a8, dust: 0xb884b4, pal: "psychic" }),
  poison:  Object.freeze({ main: 0xb448e8, core: 0xf4dcff, deep: 0x541878, dust: 0x7a5c88, pal: "poison" }),
  dragon:  Object.freeze({ main: 0xff6e48, core: 0xfff2d8, deep: 0x7a26a8, dust: 0x886478, pal: "dragon" }),
  neutral: Object.freeze({ main: 0xdce6f2, core: 0xffffff, deep: 0x708098, dust: 0x9c9284, pal: "neutral" })
});

export function createPixelBrushKit(api = {}) {
  const { spawnP, addHero, addDecal, rand = Math.random } = api;

  /** Pixel-stepped filled disc (2px scanline steps, crisp nearest-neighbor silhouette). */
  function pxDisc(g, cx, cy, radius, color, alpha = 1) {
    if (!g || alpha <= 0.02 || radius < 1.5) return;
    const r = Math.min(48, radius);
    const step = r >= 18 ? 4 : 2;
    const sx = snap2(cx), sy = snap2(cy);
    const lim = Math.floor(r / step) * step;
    for (let dy = -lim; dy <= lim; dy += step) {
      const span = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (span < 1) continue;
      const w = Math.max(step, snap2(span * 2));
      g.rect(snap2(sx - span), sy + dy, w, step).fill({ color, alpha });
    }
  }

  /** 3-tone pixel-snapped cloud puff (dark underside -> mid body -> sunlit top highlight). */
  function pxPuff(g, cx, cy, radius, baseHex = 0x8e7e6c, alpha = 0.92) {
    if (!g || alpha <= 0.02 || radius < 2) return;
    const r = Math.min(38, radius);
    const dark = mixHex(baseHex, 0.56, 0);
    const hi = mixHex(baseHex, 1, 0.42);
    pxDisc(g, cx + r * 0.16, cy + r * 0.22, r, dark, alpha * 0.9);
    pxDisc(g, cx, cy, r * 0.86, baseHex, alpha);
    pxDisc(g, cx - r * 0.22, cy - r * 0.26, r * 0.48, hi, alpha * 0.95);
  }

  /** Stepped pixel-art ground shock ring (filled flat-elliptical pixel band, zero skinny wireframes). */
  function pxRing(g, cx, cy, radius, mainHex = 0xff9824, coreHex = 0xfff6d4, alpha = 0.92, thickness = 6) {
    if (!g || alpha <= 0.02 || radius < 4) return;
    const segs = radius > 56 ? 20 : 14;
    const band = Math.max(3, thickness);
    const darkHex = mixHex(mainHex, 0.52, 0);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      const ox = snap2(cx + Math.cos(a) * radius);
      const oy = snap2(cy + Math.sin(a) * radius * 0.44);
      const w = snap2(Math.max(4, (TAU * radius / segs) * 0.95));
      const h = snap2(Math.max(3, band * (0.65 + 0.35 * Math.abs(Math.sin(a)))));
      g.rect(ox - w * 0.5, oy - h * 0.5 + 2, w, h).fill({ color: darkHex, alpha: alpha * 0.72 });
      g.rect(ox - w * 0.5, oy - h * 0.5, w, h).fill({ color: mainHex, alpha });
      if (h >= 4) {
        g.rect(ox - w * 0.35, oy - h * 0.5, Math.max(2, snap2(w * 0.7)), 2).fill({ color: coreHex, alpha: alpha * 0.9 });
      }
    }
  }

  /** Stepped pixel starburst (spiky outer rays + hot white pixel core). */
  function pxBurst(g, cx, cy, radius, rays = 10, mainHex = 0xffb830, coreHex = 0xffffff, alpha = 0.96, seed = 0) {
    if (!g || alpha <= 0.02 || radius < 4) return;
    const pts = [];
    for (let i = 0; i < rays * 2; i++) {
      const a = seed + (i / (rays * 2)) * TAU;
      const r = i % 2 === 0 ? radius * (0.85 + 0.25 * Math.sin(i * 3.1 + seed)) : radius * 0.36;
      pts.push(snap2(cx + Math.cos(a) * r), snap2(cy + Math.sin(a) * r));
    }
    if (typeof g.poly === "function") g.poly(pts).fill({ color: mainHex, alpha });
    pxDisc(g, cx, cy, radius * 0.34, coreHex, alpha);
  }

  /** 360-degree tapered pixel crescent slash (rotates cleanly in all 8 directions). */
  function pxSlash(g, cx, cy, radius, angle = 0, span = 1.25, thickness = 14, mainHex = 0x7ce2ff, coreHex = 0xffffff, alpha = 0.94) {
    if (!g || alpha <= 0.02 || radius < 5) return;
    const segs = 10;
    const outer = [], inner = [], coreO = [], coreI = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const a = angle - span + span * 2 * f;
      const taper = Math.sin(Math.PI * f);
      const rOut = radius;
      const rIn = Math.max(2, radius - thickness * taper);
      const c = Math.cos(a), s = Math.sin(a);
      outer.push(snap2(cx + c * rOut), snap2(cy + s * rOut * 0.86));
      inner.unshift(snap2(cx + c * rIn), snap2(cy + s * rIn * 0.86));
      const rCo = radius - thickness * 0.14 * taper;
      const rCi = Math.max(2, radius - thickness * 0.54 * taper);
      coreO.push(snap2(cx + c * rCo), snap2(cy + s * rCo * 0.86));
      coreI.unshift(snap2(cx + c * rCi), snap2(cy + s * rCi * 0.86));
    }
    if (typeof g.poly === "function") {
      g.poly([...outer, ...inner]).fill({ color: mainHex, alpha: alpha * 0.9 });
      g.poly([...coreO, ...coreI]).fill({ color: coreHex, alpha });
    }
  }

  /** Stepped pixel crater cracks radiating on the ground plane. */
  function pxCrater(g, cx, cy, radius, darkHex = 0x30261e, rimHex = 0x8e7a64, alpha = 0.88, seed = 1) {
    if (!g || alpha <= 0.02 || radius < 6) return;
    const spokes = 7;
    for (let i = 0; i < spokes; i++) {
      const a = seed + (i / spokes) * TAU + Math.sin(i * 4.7) * 0.25;
      const len = radius * (0.65 + 0.35 * ((i * 37) % 10) / 10);
      const mx = snap2(cx + Math.cos(a + 0.14) * len * 0.52);
      const my = snap2(cy + Math.sin(a + 0.14) * len * 0.52 * 0.45);
      const ex = snap2(cx + Math.cos(a) * len);
      const ey = snap2(cy + Math.sin(a) * len * 0.45);
      g.moveTo(snap2(cx), snap2(cy)).lineTo(mx, my).lineTo(ex, ey).stroke({ color: rimHex, width: 4, alpha: alpha * 0.65 });
      g.moveTo(snap2(cx), snap2(cy)).lineTo(mx, my).lineTo(ex, ey).stroke({ color: darkHex, width: 2, alpha });
    }
  }

  /** PB-style white half-hex honeycomb guard dome facing incoming attack angle. */
  function pxHoneycombShield(g, cx, cy, radius = 44, angle = 0, alpha = 0.92, parry = false) {
    if (!g || alpha <= 0.02) return;
    const dir = Math.cos(angle) >= 0 ? 1 : -1;
    const baseCol = parry ? 0x9ef4ff : 0xeef8ff;
    const rimCol = parry ? 0xffe46b : 0xffffff;
    const cellR = Math.max(7, Math.round(radius * 0.24));
    // Half-dome outer arc made of 5 crisp pixel-snapped facets facing the incoming hit.
    const arcPts = [];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI * 0.48 + (i / 6) * Math.PI * 0.96;
      const ax = dir > 0 ? a : Math.PI - a;
      arcPts.push(snap2(cx + Math.cos(ax) * radius), snap2(cy + Math.sin(ax) * radius * 0.96));
    }
    if (typeof g.poly === "function") {
      const dome = [snap2(cx), snap2(cy - radius * 0.92), ...arcPts, snap2(cx), snap2(cy + radius * 0.92)];
      g.poly(dome).fill({ color: baseCol, alpha: (parry ? 0.34 : 0.24) * alpha });
    }
    // 5 honeycomb hexagonal cells tiled across the shield face.
    const offsets = [
      [dir * radius * 0.48, 0],
      [dir * radius * 0.36, -cellR * 1.45],
      [dir * radius * 0.36, cellR * 1.45],
      [dir * radius * 0.14, -cellR * 0.72],
      [dir * radius * 0.14, cellR * 0.72]
    ];
    for (let idx = 0; idx < offsets.length; idx++) {
      const [ox, oy] = offsets[idx];
      const hx = snap2(cx + ox), hy = snap2(cy + oy);
      const pts = [];
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * TAU;
        pts.push(snap2(hx + Math.cos(a) * cellR), snap2(hy + Math.sin(a) * cellR));
      }
      if (typeof g.poly === "function") {
        g.poly(pts)
          .fill({ color: idx === 0 ? rimCol : baseCol, alpha: (idx === 0 ? 0.38 : 0.16) * alpha })
          .stroke({ color: rimCol, width: idx === 0 ? 2.4 : 1.6, alpha: alpha * 0.92 });
      }
    }
    // Crisp bright front rim arc.
    for (let i = 0; i < arcPts.length - 2; i += 2) {
      g.moveTo(arcPts[i], arcPts[i + 1]).lineTo(arcPts[i + 2], arcPts[i + 3])
        .stroke({ color: rimCol, width: parry ? 3.5 : 2.6, alpha });
    }
  }

  /** Standard blocked-hit feedback for any move when hitting an active guard. */
  function pxGuardBlock({ x, y, angle = 0, parry = false }) {
    if (typeof addHero === "function") {
      addHero({
        kind: "PB_SCRIPT",
        life: parry ? 0.42 : 0.34,
        draw(h, t, dt, g) {
          const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
          const r = (parry ? 48 : 42) * (0.88 + 0.24 * Math.min(1, t * 2.5));
          pxHoneycombShield(g.top, x, y, r, angle + Math.PI, fade, parry);
          if (t < 0.4) pxBurst(g.add, x - Math.cos(angle) * 20, y, 22 * (1 - t * 2), 6, parry ? 0xffe46b : 0x9ef4ff, 0xffffff, fade, h.seed);
        }
      });
    }
    if (typeof spawnP === "function") {
      const count = parry ? 10 : 7;
      for (let i = 0; i < count; i++) {
        const a = angle + Math.PI + (rand() - 0.5) * 1.9;
        const spd = (parry ? 230 : 180) + rand() * 110;
        spawnP({
          shape: "streak",
          x: x - Math.cos(angle) * 16,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd * 0.75 - 20,
          size: parry ? 6 : 4.5,
          size1: 1,
          rot: a,
          pal: parry ? "sun" : "white",
          add: true,
          life: 0.2 + rand() * 0.08
        });
      }
    }
  }

  return Object.freeze({
    disc: pxDisc,
    puff: pxPuff,
    ring: pxRing,
    burst: pxBurst,
    slash: pxSlash,
    crater: pxCrater,
    honeycombShield: pxHoneycombShield,
    guardBlock: pxGuardBlock,
    addDecal
  });
}

// 14 Declarative PB Choreography Templates (body defaults + parameterized pixel-snapped VFX).
export const PB_TEMPLATE_NAMES = Object.freeze([
  "DASH_STRIKE",
  "LEAP_SLAM",
  "SKY_DROP",
  "MULTI_JAB_FINISHER",
  "ORB_SHOT",
  "MULTI_ORB_VOLLEY",
  "CRESCENT_WAVE",
  "BEAM_STREAM",
  "GROUND_ERUPT",
  "VORTEX_LIFT",
  "SELF_BUFF_AURA",
  "COUNTER_STANCE",
  "GUARD_BREAK_SMASH",
  "RECOIL_CHARGE"
]);

export function pbTemplateBodyCue(spec) {
  if (!spec || !spec.template) return null;
  const pal = PB_TEMPLATE_PALETTES[spec.palette] ?? PB_TEMPLATE_PALETTES.neutral;
  const base = {
    key: spec.key ?? spec.id,
    template: spec.template,
    impactFrame: spec.impactFrame ?? false,
    impactStyle: spec.impactStyle ?? "black"
  };
  switch (spec.template) {
    case "DASH_STRIKE":
      return { ...base, windup: { crouch: 0.14, lean: -0.22 }, dash: { lean: 0.48, afterimage: pal.main }, strike: { lean: 0.34, hold: 0.22 }, after: { hop: 40, time: 0.24 }, ...(spec.body ?? {}) };
    case "LEAP_SLAM":
      return { ...base, windup: { crouch: 0.2, hop: 24 }, dash: { arc: 135, lean: 0.45 }, strike: { squash: 0.32, lean: 0.3, hold: 0.28 }, after: { hop: 36, time: 0.24 }, ...(spec.body ?? {}) };
    case "SKY_DROP":
      return { ...base, windup: { tint: pal.main }, skyDrop: { crouchFrac: 0.35, maxLift: 440, stretch: 0.32, fallAt: 0.72, diveBack: 220, diveLift: 185, diveTilt: 0.36, tint: pal.main }, strike: { lift: 18, hold: 0.24 }, after: { hop: 42, time: 0.24 }, ...(spec.body ?? {}) };
    case "MULTI_JAB_FINISHER":
      return { ...base, windup: { crouch: 0.1 }, dash: { lean: 0.36 }, combo: { jab: 14, lean: 0.22 }, strike: { lean: 0.3, hold: 0.2 }, after: { hop: 52, time: 0.26 }, impactFrame: spec.impactFrame ?? "final", ...(spec.body ?? {}) };
    case "ORB_SHOT":
      return { ...base, windup: { lean: -0.16, shake: 1.0 }, strike: { lean: -0.24, hold: 0.24 }, hideShotShadow: true, ...(spec.body ?? {}) };
    case "MULTI_ORB_VOLLEY":
      return { ...base, windup: { hop: 10 }, strike: { lean: 0.16, hold: 0.18 }, hideShotShadow: true, ...(spec.body ?? {}) };
    case "CRESCENT_WAVE":
      return { ...base, windup: { lean: -0.2, hop: 12 }, strike: { lean: 0.32, hold: 0.18 }, hideShotShadow: true, ...(spec.body ?? {}) };
    case "BEAM_STREAM":
      return { ...base, windup: { lean: -0.18, shake: 1.2 }, strike: { lean: 0.28, low: 0.12, hold: 0.46 }, hideShotShadow: true, ...(spec.body ?? {}) };
    case "GROUND_ERUPT":
      return { ...base, windup: { jump: { crouch: 0.24, height: 140, hang: 0.18, camLift: 80 } }, strike: { low: 0.26, hold: 0.26 }, hideShotShadow: true, ...(spec.body ?? {}) };
    case "VORTEX_LIFT":
      return { ...base, windup: { hop: 36, lean: -0.2 }, strike: { lift: 28, hold: 0.9 }, dim: spec.dim ?? 1.2, hideShotShadow: true, target: { lift: { height: 135, up: 0.65, hang: 0.25, down: 0.25, orbit: { radius: 22, turns: 3, delay: 0 } } }, ...(spec.body ?? {}) };
    case "SELF_BUFF_AURA":
      return { ...base, windup: { pump: { count: 2, amount: 0.28 } }, strike: { tint: pal.core, hold: 0.52 }, ...(spec.body ?? {}) };
    case "COUNTER_STANCE":
      return { ...base, windup: { tint: pal.main, crouch: 0.2, shake: 1.2 }, dash: { tint: pal.main, lean: 0.35 }, strike: { lean: 0.38, hold: 0.26 }, dim: spec.dim ?? 0.65, ...(spec.body ?? {}) };
    case "GUARD_BREAK_SMASH":
      return { ...base, windup: { crouch: 0.26, hop: 32, shake: 1.3 }, dash: { arc: 90, lean: 0.5 }, strike: { low: 0.24, squash: 0.28, hold: 0.32 }, after: { hop: 44, time: 0.26 }, impactFrame: spec.impactFrame ?? true, ...(spec.body ?? {}) };
    case "RECOIL_CHARGE":
      return { ...base, windup: { tint: pal.main, crouch: 0.2, lean: -0.24, shake: 1.4 }, dash: { tint: pal.main, lean: 0.66, afterimage: pal.main }, strike: { tint: pal.main, lean: 0.42, hold: 0.26 }, after: { hop: 48, time: 0.28 }, impactFrame: spec.impactFrame ?? true, ...(spec.body ?? {}) };
    default:
      return null;
  }
}

export function createPbTemplateEngine(api, px) {
  const { spawnP, addHero, addDecal, rand = Math.random } = api;
  const brush = px ?? createPixelBrushKit(api);
  const live = (life, draw, extra = {}) => addHero({ kind: "PB_SCRIPT", life, draw, ...extra });

  function emitDebris(x, y, pal, count, speed = 170) {
    const n = Math.min(16, count);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.5 + (rand() - 0.5) * 2.5;
      spawnP({
        shape: i % 2 === 0 ? "shard" : "streak",
        x,
        y: y - 4,
        vx: Math.cos(a) * (speed * (0.6 + rand() * 0.8)),
        vy: Math.sin(a) * speed * 0.55,
        vz: 110 + rand() * 110,
        gravity: 420,
        size: 5 + rand() * 3.5,
        size1: 2,
        rot: a,
        vrot: (rand() - 0.5) * 10,
        pal,
        add: i % 2 === 1,
        life: 0.38 + rand() * 0.16
      });
    }
  }

  function buildScript(spec) {
    const pal = PB_TEMPLATE_PALETTES[spec.palette] ?? PB_TEMPLATE_PALETTES.neutral;
    const sc = clamp(spec.scale ?? 1, 0.7, 1.5);
    const tmpl = spec.template;

    const standardBlocked = ({ x, y, angle = 0, parry = false }) => {
      brush.guardBlock({ x, y, angle, parry });
    };

    return Object.freeze({
      cast({ follow, angle = 0, windup = 0.32 }) {
        live(Math.max(0.14, windup), (h, t, dt, g) => {
          const at = follow?.();
          if (!at) return;
          const fy = at.footY ?? at.y + 24;
          if (tmpl === "SELF_BUFF_AURA") {
            brush.ring(g.top, at.x, fy + 3, (24 + 26 * t) * sc, pal.main, pal.core, 0.85 * (1 - t * 0.35), 5);
            for (let i = -1; i <= 1; i++) {
              const px0 = snap2(at.x + i * 16), ph = snap2((34 + 48 * t) * sc);
              g.add.rect(px0 - 4, snap2(fy - ph), 8, ph).fill({ color: pal.main, alpha: 0.48 * t });
            }
            return;
          }
          brush.ring(g.top, at.x, fy + 3, (18 + 20 * t) * sc, pal.main, pal.core, 0.82, 4);
          if (tmpl === "ORB_SHOT" || tmpl === "BEAM_STREAM") {
            const ox = at.x + Math.cos(angle) * 20, oy = at.y - 4 + Math.sin(angle) * 12;
            brush.disc(g.top, ox, oy, (7 + 11 * t) * sc, pal.main, 0.92);
            brush.disc(g.add, ox, oy, (4 + 6 * t) * sc, pal.core, 0.96);
          } else if (tmpl === "MULTI_ORB_VOLLEY") {
            const cnt = spec.orbCount ?? 5;
            for (let i = 0; i < cnt; i++) {
              const a = h.age * 5 + (i / cnt) * TAU;
              brush.disc(g.top, at.x + Math.cos(a) * 28 * sc, at.y - 8 + Math.sin(a) * 14 * sc, 6 * sc, pal.main, 0.94);
              brush.disc(g.add, at.x + Math.cos(a) * 28 * sc, at.y - 8 + Math.sin(a) * 14 * sc, 3 * sc, pal.core, 0.96);
            }
          } else if (tmpl === "COUNTER_STANCE") {
            brush.burst(g.add, at.x, at.y - 6, 22 * sc * t, 6, pal.main, pal.core, 0.85, h.age * 8);
          } else {
            const ox = at.x - Math.cos(angle) * 12;
            brush.puff(g.top, ox, fy - 4, (8 + 8 * t) * sc, pal.dust, 0.72 * (1 - t * 0.4));
          }
        });
      },

      release({ follow, angle = 0 }) {
        if (tmpl === "SELF_BUFF_AURA") {
          live(0.55, (h, t, dt, g) => {
            const at = follow?.();
            if (!at) return;
            const fade = 1 - t;
            const fy = at.footY ?? at.y + 24;
            brush.ring(g.top, at.x, fy + 3, (26 + 68 * t) * sc, pal.main, pal.core, 0.9 * fade, 6 - 3 * t);
            brush.burst(g.add, at.x, at.y - 10, (34 + 24 * t) * sc, 8, pal.main, pal.core, 0.82 * fade, h.seed);
          });
          return;
        }
        const c = Math.cos(angle), s = Math.sin(angle);
        live(tmpl === "SKY_DROP" ? 0.9 : 0.52, (h, t, dt, g) => {
          const at = follow?.();
          if (!at) { h.age = h.life; return; }
          if (at.alpha !== undefined && at.alpha <= 0.4) return;
          if (tmpl === "DASH_STRIKE" || tmpl === "RECOIL_CHARGE" || tmpl === "SKY_DROP" || tmpl === "GUARD_BREAK_SMASH") {
            brush.slash(g.add, at.x + c * 18, at.y + s * 12, 34 * sc, angle, 0.95, 11 * sc, pal.main, pal.core, 0.88);
            h.acc = (h.acc ?? 0) + dt;
            while (h.acc >= 0.025) {
              h.acc -= 0.025;
              spawnP({
                shape: "streak",
                x: at.x - c * 14 + (rand() - 0.5) * 18,
                y: at.y - s * 14 + (rand() - 0.5) * 18,
                vx: -c * 140,
                vy: -s * 140,
                size: 7 * sc,
                size1: 1.5,
                rot: angle + Math.PI,
                pal: pal.pal,
                add: true,
                life: 0.18
              });
            }
          } else if (tmpl === "CRESCENT_WAVE" || tmpl === "BEAM_STREAM") {
            brush.slash(g.add, at.x + c * 22, at.y + s * 14, 42 * sc, angle, 1.15, 12 * sc, pal.main, pal.core, 0.92 * (1 - t));
          }
        });
      },

      projectile({ follow, angle = 0, life = 1.0 }) {
        live(life, (h, t, dt, g) => {
          const at = follow?.();
          if (!at) { h.age = h.life; return; }
          if (tmpl === "CRESCENT_WAVE") {
            brush.slash(g.top, at.x, at.y, 34 * sc, angle, 1.1, 13 * sc, pal.main, pal.core, 0.96);
          } else if (tmpl === "VORTEX_LIFT") {
            for (let k = 0; k < 4; k++) {
              const fy = at.y + 16 - k * 20 * sc;
              const rw = (16 + k * 11) * sc;
              brush.ring(g.top, at.x + Math.sin(h.age * 16 + k) * 6, fy, rw, pal.main, pal.core, 0.82, 5);
            }
          } else {
            brush.disc(g.top, at.x, at.y, 16 * sc, pal.deep, 0.94);
            brush.disc(g.top, at.x, at.y, 12 * sc, pal.main, 0.98);
            brush.disc(g.add, at.x + 2, at.y - 2, 6 * sc, pal.core, 0.98);
          }
        });
      },

      hit({ x, y, groundY = y, angle = 0, heavy = false }) {
        const big = heavy || tmpl === "LEAP_SLAM" || tmpl === "SKY_DROP" || tmpl === "GUARD_BREAK_SMASH" || tmpl === "RECOIL_CHARGE" || tmpl === "GROUND_ERUPT";
        const dustPuffs = Array.from({ length: big ? 7 : 4 }, (_, i) => {
          const a = (i / (big ? 7 : 4)) * TAU + 0.35;
          return { ox: Math.cos(a) * (24 + (i % 2) * 16) * sc, oy: Math.sin(a) * 14 * sc - 10, r: (14 + (i % 3) * 5) * sc };
        });
        live(big ? 0.62 : 0.4, (h, t, dt, g) => {
          const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
          if (t < 0.45) {
            const bf = 1 - t / 0.45;
            brush.burst(g.top, x, y - 4, (big ? 54 : 38) * sc * (0.8 + 0.3 * t), big ? 10 : 8, pal.main, pal.core, 0.96 * bf, h.seed);
            if (tmpl === "DASH_STRIKE" || tmpl === "CRESCENT_WAVE" || tmpl === "COUNTER_STANCE" || tmpl === "MULTI_JAB_FINISHER") {
              brush.slash(g.add, x, y - 4, (big ? 52 : 38) * sc, angle, 1.2, (big ? 15 : 11) * sc, pal.main, pal.core, 0.96 * bf);
            }
          }
          brush.ring(g.top, x, groundY + 4, (24 + (big ? 84 : 52) * t) * sc, pal.main, pal.core, 0.92 * fade, (big ? 7 : 5) * (1 - t * 0.45));
          if (big && t >= 0.14) {
            const ck = clamp((t - 0.14) / 0.6, 0, 1);
            const cf = ck < 0.25 ? ck / 0.25 : 1 - (ck - 0.25) / 0.75;
            for (const pf of dustPuffs) {
              brush.puff(g.top, x + pf.ox * (0.6 + 0.55 * ck), groundY + pf.oy * (0.6 + 0.55 * ck), pf.r * (0.75 + 0.3 * ck), pal.dust, 0.84 * cf);
            }
          }
          if (tmpl === "GROUND_ERUPT" && t < 0.75) {
            brush.crater(g.top, x, groundY + 6, 48 * sc, pal.deep, pal.main, 0.9 * fade, h.seed);
          }
        });
        emitDebris(x, groundY, pal.pal, big ? 12 : 7, big ? 190 : 140);
        if (big && typeof addDecal === "function") {
          addDecal({ x, y: groundY + 6, kind: pal.pal === "ice" ? "frost" : pal.pal === "fire" ? "scorch" : "crack", radius: 44 * sc, pal: pal.pal, life: 4.5 });
        }
      },

      blocked: standardBlocked
    });
  }

  function compileAll(declarativeMap = {}) {
    const out = Object.create(null);
    for (const [id, spec] of Object.entries(declarativeMap)) {
      if (!spec || !spec.template) continue;
      out[spec.key ?? id] = buildScript({ id, ...spec });
    }
    return out;
  }

  return Object.freeze({ buildScript, compileAll, templates: PB_TEMPLATE_NAMES });
}

// Registry for compact declarative PB moves (6-12 lines per move; future batches add entries here).
export const PB_DECLARATIVE_MOVES = Object.freeze({});
