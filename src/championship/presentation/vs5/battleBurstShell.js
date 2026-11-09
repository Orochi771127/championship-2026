// Burst evolution shell -- OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102).
//
// A product-authored effect in the game's own hex motif (Owner direction: wrap the partner up, then blow it
// open). Hex plates fly in and close over the 成熟期 from the feet up, the finished shell pulses and its
// seams light, a white flash bursts it, and the plates scatter off the burst form. When the form ends a
// smaller shell shatters off it. Every pose is a pure function of the battle's own counters (wrapFrame,
// phaseFrame), so it holds with the battle and replays identically; no timer or Math.random is used.

const WRAP_END = 42, CRACK_END = 63;            // wrapFrame 0..41 wrap, 42..62 crack, 63..71 flash
// A tier-2 chain (wrapFrames > 72) then shows its tier-1 form in a ring of light and flashes again.
const CHAIN_START = 72;
const SCATTER_FRAMES = 30, SHATTER_FRAMES = 24;
const PALETTE = Object.freeze({
  1: {plate: 0x5b9cf0, edge: 0x1e3a8a, seam: 0xbfe3ff, flash: 0xffffff},
  2: {plate: 0x4f7ee0, edge: 0x1b2f73, seam: 0xffd36b, flash: 0xfff4d0}
});

// Deterministic per-plate noise in [0, 1).
function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x6b43a9b5, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOutCubic = t => 1 - (1 - t) ** 3;

/** Unit-radius hex cells (about seventy) covering a disc, ordered from the feet (bottom) up. */
function shellCells(size = 0.135) {
  const cells = [], w = Math.sqrt(3) * size, span = Math.ceil(1 / w) + 2;
  for (let q = -span; q <= span; q++) for (let r = -span; r <= span; r++) {
    const x = w * (q + r / 2), y = 1.5 * size * r;
    if (Math.hypot(x, y) > 1 + size * 0.25) continue;
    cells.push({x, y, size});
  }
  return cells.sort((a, b) => b.y - a.y || a.x - b.x).map((cell, index) => Object.freeze({...cell, index}));
}
const CELLS = shellCells();

function hexPath(g, cx, cy, radius, rotation, squashX = 1) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const a = rotation + Math.PI / 6 + i * Math.PI / 3;
    points.push(cx + Math.cos(a) * radius * squashX, cy + Math.sin(a) * radius);
  }
  g.poly(points);
}

/**
 * Where one plate sits on the sphere: a disc cell pushed out toward the rim reads as a curved shell.
 * Returns screen offsets (unit radius), a light 0..1 (lit from the upper left) and a foreshortening factor.
 */
function onSphere(cell) {
  const d = Math.min(0.999, Math.hypot(cell.x, cell.y));
  const curve = Math.sin(d * Math.PI / 2) / Math.max(d, 1e-6);
  const x = cell.x * curve, y = cell.y * curve, z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const light = Math.max(0, -0.42 * x - 0.5 * y + 0.76 * z);
  return {x, y, shade: 0.35 + 0.65 * light, squash: 0.55 + 0.45 * z};
}
// A bloodline's colour (#rrggbb) tints the plates (awakening raising, Owner 2026-11-02).
function paletteFor(tier, color) {
  const base = PALETTE[tier] ?? PALETTE[1];
  const tint = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : null;
  return tint === null ? base : {plate: mix(base.plate, tint, 0.92), edge: mix(0x1b1b2e, tint, 0.5), seam: mix(0xffffff, tint, 0.35), flash: base.flash};
}
// Mix two 0xRRGGBB colours: t = 0 gives a, 1 gives b.
function mix(a, b, t) {
  const k = clamp01(t), ch = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function createBattleBurstShell({PIXI, layer, reducedMotion = false}) {
  const shells = new Map();
  function graphicFor(slot) {
    let entry = shells.get(slot);
    if (!entry) {
      entry = {g: new PIXI.Graphics(), lastPhase: null};
      entry.g.label = `burst shell ${slot}`;
      layer.addChild(entry.g);
      shells.set(slot, entry);
    }
    return entry;
  }

  function drawWrap(g, {x, y, radius, tier, slot, color}, wrapFrame) {
    const colors = paletteFor(tier, color), n = CELLS.length;
    const crack = clamp01((wrapFrame - WRAP_END) / (CRACK_END - WRAP_END));
    const flash = clamp01((wrapFrame - CRACK_END) / 8);
    const pulse = 1 + 0.035 * Math.sin(crack * Math.PI * 6) * crack;
    // A dark core closes behind the last plates, so the finished shell is a solid ball.
    const closed = reducedMotion ? clamp01(wrapFrame / 10) : clamp01((wrapFrame - (WRAP_END - 14)) / 12);
    if (closed > 0) {
      g.circle(x, y, radius * pulse * 0.97);
      g.fill({color: colors.edge, alpha: 0.96 * closed * (1 - flash)});
    }
    for (const cell of CELLS) {
      const seat = onSphere(cell);
      // Plates land from the feet up across the wrap; each takes 12 frames to fly in.
      const startAt = reducedMotion ? 0 : (cell.index / n) * (WRAP_END - 12);
      const t = reducedMotion ? clamp01(wrapFrame / 10) : clamp01((wrapFrame - startAt) / 12);
      if (t <= 0) continue;
      const k = easeOutCubic(t);
      const angle = hash(slot * 131 + cell.index, 7) * Math.PI * 2, far = 2.6 + hash(cell.index, slot) * 1.4;
      let px = seat.x * pulse, py = seat.y * pulse;
      // A few plates are pushed loose by the light inside before the burst.
      if (crack > 0 && hash(cell.index, 99) < 0.12) { px *= 1 + 0.18 * crack; py *= 1 + 0.18 * crack; }
      const sx = reducedMotion ? px : px + Math.cos(angle) * far * (1 - k);
      const sy = reducedMotion ? py : py + Math.sin(angle) * far * (1 - k);
      const spin = reducedMotion ? 0 : (1 - k) * (hash(cell.index, 3) - 0.5) * 6;
      hexPath(g, x + sx * radius, y + sy * radius, cell.size * radius * 0.94, spin, seat.squash);
      g.fill({color: mix(colors.edge, colors.plate, seat.shade), alpha: (reducedMotion ? t : Math.min(1, t * 1.8)) * 0.96 * (1 - flash)});
      g.stroke({width: Math.max(1, radius * 0.025), color: crack > 0 ? colors.seam : colors.edge,
        alpha: (crack > 0 ? 0.5 + 0.5 * crack : 0.9) * (1 - flash)});
    }
    if (closed > 0) {
      // A soft highlight on the upper left of the closed shell.
      g.moveTo(x - radius * 0.18 + Math.cos(Math.PI * 1.05) * radius * 0.62, y - radius * 0.2 + Math.sin(Math.PI * 1.05) * radius * 0.62)
        .arc(x - radius * 0.18, y - radius * 0.2, radius * 0.62, Math.PI * 1.05, Math.PI * 1.55);
      g.stroke({width: Math.max(1, radius * 0.07), color: 0xffffff, alpha: 0.28 * closed * (1 - flash)});
    }
    if (crack > 0) {
      // Light leaking through the seams.
      g.circle(x, y, radius * pulse * 0.98);
      g.stroke({width: radius * 0.06 * crack, color: colors.seam, alpha: 0.35 * crack * (1 - flash)});
    }
    if (flash > 0) {
      g.circle(x, y, radius * (1 + flash * 0.9));
      g.fill({color: colors.flash, alpha: 0.85 * (1 - flash * 0.4)});
    }
  }

  // The tactile awakening cocoon (AWAKENING_OVERDRIVE_20261109): the closed shell holds while the player cracks it.
  // crack 0: closed and breathing; 1: one fracture with light leaking through; 2: cracks over the whole
  // shell and the six bloodline light pillars bursting from them. `frame` counts frames since the last crack.
  const PILLARS = [0xa070ff, 0x40d880, 0x4a9cff, 0x40e0e0, 0xff7ac8, 0xffd34d];
  // Real fractures (Owner 2026-11-09: cracks, not straight lines; more 3D). Each crack runs from an impact point in
  // short jagged steps, forks now and then and thins to a hair. It is laid out on the flat disc, then wrapped onto
  // the shell's sphere, so it bends round the ball and narrows toward the rim. Drawn as a sunken groove: a dark lower
  // edge, a lit lip on the light side (upper left), the light leaking through, then a hot core.
  function fracture(seed, ox, oy, angle, length, width, depth, out) {
    let px = ox, py = oy, a = angle;
    const steps = 9, points = [{x: px, y: py, w: width}];
    for (let i = 0; i < steps; i++) {
      a += (hash(seed, i * 5 + 1) - 0.5) * 1.05;
      const step = length / steps * (0.55 + hash(seed, i * 5 + 2) * 0.9);
      px += Math.cos(a) * step; py += Math.sin(a) * step;
      if (Math.hypot(px, py) > 0.97) break;
      const w = width * Math.max(0.12, 1 - (i + 1) / (steps + 1));
      points.push({x: px, y: py, w});
      if (depth < 2 && i > 0 && hash(seed, i * 5 + 3) < 0.3)
        fracture(seed * 31 + i + 7, px, py, a + (hash(seed, i * 5 + 4) < 0.5 ? -1 : 1) * (0.55 + hash(seed, i + 90) * 0.6), length * 0.42, w * 0.72, depth + 1, out);
    }
    out.push(points);
    return out;
  }
  // Impact points and headings (unit disc). Stage 1 is one strike on the upper shell; stage 2 lengthens it and adds four.
  const STRIKES = [[0.08, -0.12, 2.3], [0.1, -0.1, -0.75], [-0.5, 0.05, 1.25], [0.52, 0.12, 1.95], [-0.2, 0.55, -2.4], [0.25, -0.6, 2.5]];
  function cocoonCracks(crack) {
    const out = [];
    STRIKES.slice(0, crack === 1 ? 2 : STRIKES.length).forEach(([sx, sy, heading], i) =>
      fracture(1013 + i * 97, sx, sy, heading, (crack === 1 ? 0.62 : 0.95) * (i < 2 ? 1 : 0.85), i < 2 ? (crack === 1 ? 0.05 : 0.06) : 0.035, 0, out));
    return out;
  }
  // The disc-to-sphere wrap the plates use (onSphere), with the foreshortening at that point.
  function wrap(point) {
    const d = Math.min(0.999, Math.hypot(point.x, point.y)), curve = Math.sin(d * Math.PI / 2) / Math.max(d, 1e-6);
    const x = point.x * curve, y = point.y * curve;
    return {x, y, z: Math.sqrt(Math.max(0, 1 - x * x - y * y))};
  }
  function drawCracks(g, {x, y, radius}, colors, crack, frame, glow) {
    const grow = reducedMotion ? 1 : Math.min(1, frame / 7);
    const passes = [
      // sunken lower edge, lit upper lip, light inside, white-hot core
      {dx: 0.55, dy: 0.7, width: 2.2, color: 0x05060d, alpha: 0.75},
      {dx: -0.5, dy: -0.65, width: 1.5, color: 0xffffff, alpha: 0.4},
      {dx: 0, dy: 0, width: 2.4, color: colors.seam, alpha: 0.38 * glow},
      {dx: 0, dy: 0, width: 1.3, color: 0xfff4c2, alpha: 0.95 * glow},
      {dx: 0, dy: 0, width: 0.5, color: 0xffffff, alpha: glow}
    ];
    const paths = cocoonCracks(crack).map(points => points.slice(0, Math.max(2, Math.ceil(points.length * grow))).map(point => ({...wrap(point), w: point.w})));
    for (const pass of passes) {
      for (const points of paths) {
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i], depth = 0.35 + 0.65 * Math.min(a.z, b.z);
          const width = Math.max(0.8, b.w * radius * pass.width * depth), lift = b.w * radius * depth * 0.6;
          g.moveTo(x + a.x * radius + pass.dx * lift, y + a.y * radius + pass.dy * lift)
            .lineTo(x + b.x * radius + pass.dx * lift, y + b.y * radius + pass.dy * lift);
          g.stroke({width, color: pass.color, alpha: pass.alpha * (0.55 + 0.45 * depth), cap: 'round', join: 'round'});
        }
      }
    }
  }
  function drawCocoon(g, shape, crack, frame) {
    const {x, y, radius, tier, color} = shape, colors = paletteFor(tier, color);
    const kick = reducedMotion ? 0 : Math.max(0, 1 - frame / 10);
    const breathe = reducedMotion ? 0 : Math.sin(frame / 9) * 0.012;
    // The finished shell: the wrap's closed pose, nudged outward on each crack.
    drawWrap(g, {...shape, radius: radius * (1 + breathe + 0.05 * kick)}, WRAP_END - 1);
    if (crack <= 0) {
      g.circle(x, y, radius * 1.04);
      g.stroke({width: Math.max(1, radius * 0.03), color: colors.seam, alpha: 0.25 + 0.2 * Math.sin(frame / 7) ** 2});
      return;
    }
    const glow = 0.7 + 0.3 * Math.sin(frame / (crack === 1 ? 6 : 3)) ** 2;
    // Light leaks out of the shell where it is struck.
    g.circle(x + radius * 0.08, y - radius * 0.12, radius * (crack === 1 ? 0.3 : 0.62)).fill({color: colors.seam, alpha: (crack === 1 ? 0.18 : 0.26) * glow});
    drawCracks(g, shape, colors, crack, frame, glow);
    if (crack >= 2) {
      // Six bloodline pillars shoot up out of the cracks.
      PILLARS.forEach((pillar, i) => {
        const a = -Math.PI / 2 + (i - 2.5) * 0.32, reach = radius * (1.6 + 0.9 * glow) * (reducedMotion ? 1 : Math.min(1, frame / 8 + 0.3));
        const bx = x + Math.cos(a) * radius * 0.6, by = y + Math.sin(a) * radius * 0.6, half = radius * 0.08;
        const ex = bx + Math.cos(a) * reach, ey = by + Math.sin(a) * reach, nx = -Math.sin(a) * half, ny = Math.cos(a) * half;
        g.poly([bx - nx, by - ny, bx + nx, by + ny, ex + nx * 2.4, ey + ny * 2.4, ex - nx * 2.4, ey - ny * 2.4]);
        g.fill({color: pillar, alpha: 0.42 * glow});
      });
      g.circle(x, y, radius * (1.08 + 0.06 * glow));
      g.stroke({width: Math.max(1, radius * 0.05), color: colors.seam, alpha: 0.6 * glow});
    }
  }

  // The chain's middle: the tier-1 form stands in a ring of light, then a second flash grows over it.
  function drawChain(g, {x, y, radius, tier, color}, wrapFrame, wrapFrames) {
    const colors = paletteFor(tier, color), t = clamp01((wrapFrame - CHAIN_START) / Math.max(1, wrapFrames - CHAIN_START));
    const fade = clamp01(1 - (wrapFrame - CHAIN_START) / 4), second = clamp01((t - 0.5) / 0.5);
    if (fade > 0) { g.circle(x, y, radius * 1.9); g.fill({color: colors.flash, alpha: 0.5 * fade}); }
    for (let ring = 0; ring < 2; ring++) {
      const k = reducedMotion ? 0.5 : (t * 1.6 + ring * 0.35) % 1;
      g.circle(x, y, radius * (0.8 + k * 0.9));
      g.stroke({width: Math.max(1, radius * 0.06 * (1 - k)), color: colors.seam, alpha: 0.85 * (1 - k)});
    }
    if (second > 0) { g.circle(x, y, radius * (0.6 + second * 1.2)); g.fill({color: colors.flash, alpha: 0.9 * second}); }
  }

  function drawScatter(g, {x, y, radius, tier, slot, color}, frame, total, scale = 1) {
    const colors = paletteFor(tier, color), t = clamp01(frame / total);
    if (t >= 1) return;
    const k = easeOutCubic(t);
    if (!reducedMotion) {
      g.circle(x, y, radius * (1.1 + k * 1.6) * scale);
      g.stroke({width: Math.max(1, radius * 0.08 * (1 - t)), color: colors.seam, alpha: 0.8 * (1 - t)});
    }
    for (const cell of CELLS) {
      if (scale < 1 && cell.index % 2) continue;
      const seat = onSphere(cell), dir = Math.atan2(seat.y || 0.001, seat.x || 0.001) + (hash(cell.index, slot + 5) - 0.5) * 0.6;
      const travel = reducedMotion ? 0 : k * (1.4 + hash(cell.index, 11) * 1.8) * scale;
      const px = seat.x * scale + Math.cos(dir) * travel, py = seat.y * scale + Math.sin(dir) * travel + (reducedMotion ? 0 : k * k * 0.6);
      hexPath(g, x + px * radius, y + py * radius, cell.size * radius * 0.94 * scale * (1 - 0.4 * t),
        reducedMotion ? 0 : k * (hash(cell.index, 13) - 0.5) * 9, seat.squash);
      g.fill({color: mix(colors.edge, colors.plate, seat.shade), alpha: 0.96 * (1 - t)});
      g.stroke({width: 1, color: colors.seam, alpha: 0.6 * (1 - t)});
    }
  }

  // Over-limit burst (AWAKENING_OVERDRIVE_20261109): twin bloodline flames lick up from the feet while it lasts;
  // an exhausted core circles three dim stars over the head. Poses read the burst's phaseFrame only.
  function drawOverLimit(g, {x, y, radius, tier, color}, frame) {
    const colors = paletteFor(tier, color), feet = y + radius * 0.78, flicker = reducedMotion ? 0.5 : (Math.sin(frame / 3) + 1) / 2;
    for (const [hue, scale, alpha] of [[0xff3b2f, 1.25, 0.42], [colors.plate, 1, 0.6], [0xfff1b8, 0.55, 0.85]]) {
      for (let i = 0; i < 7; i++) {
        const t = (i - 3) / 3, sway = reducedMotion ? 0 : Math.sin(frame / 5 + i * 1.7) * radius * 0.05;
        const height = radius * scale * (0.55 + 0.45 * hash(i, 77) + 0.18 * flicker) * (1 - Math.abs(t) * 0.45);
        const base = radius * 0.12 * scale, cx = x + t * radius * 0.62;
        g.poly([cx - base, feet, cx + base, feet, cx + sway, feet - height]);
        g.fill({color: hue, alpha});
      }
    }
    g.ellipse(x, feet, radius * 0.85, radius * 0.18);
    g.stroke({width: Math.max(1, radius * 0.04), color: 0xff3b2f, alpha: 0.5 + 0.4 * flicker});
  }
  function drawExhausted(g, {x, y, radius}, frame) {
    const head = y - radius * 0.95;
    for (let i = 0; i < 3; i++) {
      const a = (reducedMotion ? 0 : frame / 14) + i * Math.PI * 2 / 3;
      const sx = x + Math.cos(a) * radius * 0.42, sy = head + Math.sin(a) * radius * 0.12, r = radius * 0.09;
      const points = [];
      for (let k = 0; k < 10; k++) { const b = -Math.PI / 2 + k * Math.PI / 5, d = k % 2 ? r * 0.45 : r; points.push(sx + Math.cos(b) * d, sy + Math.sin(b) * d); }
      g.poly(points);
      g.fill({color: 0xb8c0cc, alpha: 0.85});
    }
  }

  return Object.freeze({
    /**
     * One combatant's shell for this frame. `burst` is the published combatant.burst; x/y is the body centre in
     * the actor layer; `color` (#rrggbb) is the partner's bloodline. Returns 'BURST' on the frame the shell blows
     * open (the scene shakes the camera then).
     */
    update(slot, {x, y, width, height, zIndex, burst, color = null}) {
      if (!burst) { this.retire(slot); return null; }
      const entry = graphicFor(slot), g = entry.g;
      g.clear();
      g.zIndex = zIndex;
      const radius = Math.max(18, Math.max(width, height) * 0.62), shape = {x, y, radius, tier: burst.tier, slot, color};
      let cue = null;
      if (burst.phase === 'WRAP' && Number.isFinite(burst.wrapFrame) && burst.wrapFrames > CHAIN_START && burst.wrapFrame >= CHAIN_START)
        drawChain(g, shape, burst.wrapFrame, burst.wrapFrames);
      else if (burst.phase === 'WRAP' && Number.isFinite(burst.wrapFrame)) drawWrap(g, shape, burst.wrapFrame);
      else if (burst.phase === 'COCOON') drawCocoon(g, shape, burst.crack | 0, Math.max(0, burst.crackFrame | 0));
      else if (burst.phase === 'BURST' && Number.isFinite(burst.phaseFrame)) {
        if (entry.lastPhase !== 'BURST') cue = 'BURST';
        if (burst.overLimit) drawOverLimit(g, shape, burst.phaseFrame);
        drawScatter(g, shape, burst.phaseFrame, SCATTER_FRAMES);
      } else if (burst.phase === 'WEAK' && Number.isFinite(burst.phaseFrame)) drawScatter(g, shape, burst.phaseFrame, SHATTER_FRAMES, 0.7);
      else if (burst.phase === 'EXHAUSTED' && Number.isFinite(burst.phaseFrame)) { drawScatter(g, shape, burst.phaseFrame, SHATTER_FRAMES, 0.7); drawExhausted(g, shape, burst.phaseFrame); }
      entry.lastPhase = burst.phase;
      g.visible = !g.destroyed;
      return cue;
    },
    retire(slot) {
      const entry = shells.get(slot);
      if (!entry) return;
      entry.g.destroy();
      shells.delete(slot);
    },
    retireExcept(slots) { for (const slot of [...shells.keys()]) if (!slots.has(slot)) this.retire(slot); },
    dispose() { for (const slot of [...shells.keys()]) this.retire(slot); }
  });
}

export const BATTLE_BURST_SHELL_CELLS = CELLS.length;
/** The wrap frame at which the shell has closed (the cocoon holds this pose). */
export const BATTLE_BURST_SHELL_CLOSED_FRAME = WRAP_END - 1;
