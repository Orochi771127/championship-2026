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
      else if (burst.phase === 'BURST' && Number.isFinite(burst.phaseFrame)) {
        if (entry.lastPhase !== 'BURST') cue = 'BURST';
        drawScatter(g, shape, burst.phaseFrame, SCATTER_FRAMES);
      } else if (burst.phase === 'WEAK' && Number.isFinite(burst.phaseFrame)) drawScatter(g, shape, burst.phaseFrame, SHATTER_FRAMES, 0.7);
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
