// Burst evolution shell -- OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102).
//
// A product-authored effect in the game's own hex motif (Owner direction: wrap the partner up, then blow it
// open). Hex plates fly in and close over the 成熟期 from the feet up, the finished shell pulses and its
// seams light, a white flash bursts it, and the plates scatter off the burst form. When the form ends a
// smaller shell shatters off it. Every pose is a pure function of the battle's own counters (wrapFrame,
// phaseFrame), so it holds with the battle and replays identically; no timer or Math.random is used.

const WRAP_END = 42, CRACK_END = 63;            // wrapFrame 0..41 wrap, 42..62 crack, 63..71 flash
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

/** Unit-radius hex cells covering a disc, ordered from the feet (bottom) up. */
function shellCells(rings = 4) {
  const cells = [], size = 1 / (rings + 0.5), w = Math.sqrt(3) * size;
  for (let q = -rings; q <= rings; q++) for (let r = -rings; r <= rings; r++) {
    if (Math.abs(q + r) > rings) continue;
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
 * Returns screen offsets (unit radius), a shade 0..1 and a foreshortening factor.
 */
function onSphere(cell) {
  const d = Math.min(0.999, Math.hypot(cell.x, cell.y));
  const curve = Math.sin(d * Math.PI / 2) / Math.max(d, 1e-6);
  const depth = Math.sqrt(1 - Math.min(1, (d * curve) ** 2) * 0.92);
  return {x: cell.x * curve, y: cell.y * curve, shade: 0.55 + 0.45 * depth, squash: 0.55 + 0.45 * depth};
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

  function drawWrap(g, {x, y, radius, tier, slot}, wrapFrame) {
    const colors = PALETTE[tier] ?? PALETTE[1], n = CELLS.length;
    const crack = clamp01((wrapFrame - WRAP_END) / (CRACK_END - WRAP_END));
    const flash = clamp01((wrapFrame - CRACK_END) / 8);
    const pulse = 1 + 0.035 * Math.sin(crack * Math.PI * 6) * crack;
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
      g.fill({color: colors.plate, alpha: (reducedMotion ? t : Math.min(1, t * 1.6)) * (0.72 + 0.28 * seat.shade) * (1 - flash)});
      g.stroke({width: Math.max(1, radius * 0.025), color: crack > 0 ? colors.seam : colors.edge,
        alpha: (crack > 0 ? 0.5 + 0.5 * crack : 0.9) * (1 - flash)});
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

  function drawScatter(g, {x, y, radius, tier, slot}, frame, total, scale = 1) {
    const colors = PALETTE[tier] ?? PALETTE[1], t = clamp01(frame / total);
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
      g.fill({color: colors.plate, alpha: (1 - t) * (0.72 + 0.28 * seat.shade)});
      g.stroke({width: 1, color: colors.seam, alpha: 0.6 * (1 - t)});
    }
  }

  return Object.freeze({
    /**
     * One combatant's shell for this frame. `burst` is the published combatant.burst; x/y is the body centre in
     * the actor layer. Returns 'BURST' on the frame the shell blows open (the scene shakes the camera then).
     */
    update(slot, {x, y, width, height, zIndex, burst}) {
      if (!burst) { this.retire(slot); return null; }
      const entry = graphicFor(slot), g = entry.g;
      g.clear();
      g.zIndex = zIndex;
      const radius = Math.max(18, Math.max(width, height) * 0.62), shape = {x, y, radius, tier: burst.tier, slot};
      let cue = null;
      if (burst.phase === 'WRAP' && Number.isFinite(burst.wrapFrame)) drawWrap(g, shape, burst.wrapFrame);
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
