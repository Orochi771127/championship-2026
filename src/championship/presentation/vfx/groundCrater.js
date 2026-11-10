// Ground impact craters (Owner 2026-11-10: the old floor mark -- a flat oval with six
// smooth arcs and white dots -- read as a flower, not a broken floor).
//
// A crater is drawn as HD pixel art on a 64x32 cell grid (2 canvas px per cell, so a
// 128x64 texture like every other ground mark), lit from above:
//   - a bowl in four dithered tones: the far inner wall faces the viewer and catches
//     the light, the near wall and the floor fall into shadow;
//   - a raised lip, lit along the far side, casting a shadow forward onto the floor;
//   - jagged cracks that branch away from the lip, two cells wide near the crater,
//     each with a light bevel under it;
//   - two-tone rock chips with their own small shadows.
// The base is a normal-blend layer of translucent darks, so it takes the floor's own
// colour. A burning hit adds a second, additive "ember" texture (hot seams in the
// cracks and a glowing ring round the pit floor) that the layer cools off well before
// the crater fades.

const TAU = Math.PI * 2;
export const CRATER_W = 64, CRATER_H = 32, CRATER_CELL = 2;
const CX = 32, CY = 15.5, RX = 18, RY = 7.6;

const rgba = (color, alpha) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

/** The crater's shape, crack paths and chips for one seeded variant (shared by base and ember). */
export function craterPlan(r) {
  const a = r() * TAU, b = r() * TAU, c = r() * TAU;
  const radius = (theta) => 1 + 0.12 * Math.sin(3 * theta + a) + 0.08 * Math.sin(5 * theta + b) + 0.06 * Math.sin(9 * theta + c);
  const cells = new Map();          // "x,y" -> {t, dx, dy}
  for (let y = 0; y < CRATER_H; y++) for (let x = 0; x < CRATER_W; x++) {
    const dx = (x + 0.5 - CX) / RX, dy = (y + 0.5 - CY) / RY;
    const theta = Math.atan2(dy, dx), t = Math.hypot(dx, dy) / radius(theta);
    if (t < 1.5) cells.set(`${x},${y}`, {t, dx, dy});
  }
  const cracks = [];
  const count = 6 + Math.floor(r() * 3);
  const walk = (x, y, phi, steps, path, wide) => {
    for (let k = 0; k < steps; k++) {
      phi += (r() - 0.5) * 0.8;
      x += Math.cos(phi); y += Math.sin(phi) * 0.5;
      const cx = Math.round(x), cy = Math.round(y);
      if (cx < 1 || cy < 1 || cx >= CRATER_W - 1 || cy >= CRATER_H - 1) break;
      path.push({x: cx, y: cy, k, steps, wide: wide && k < steps * 0.4, dir: phi});
    }
  };
  for (let i = 0; i < count; i++) {
    const theta = i * TAU / count + (r() - 0.5) * 0.5, edge = radius(theta) * 0.85;
    const sx = CX + Math.cos(theta) * RX * edge, sy = CY + Math.sin(theta) * RY * edge;
    const path = [], steps = 9 + Math.floor(r() * 9);
    walk(sx, sy, theta, steps, path, i % 2 === 0);
    cracks.push(path);
    if (r() < 0.55 && path.length > 6) {
      const fork = path[3 + Math.floor(r() * 3)], branch = [];
      walk(fork.x, fork.y, fork.dir + (r() < 0.5 ? -0.8 : 0.8), 4 + Math.floor(r() * 5), branch, false);
      cracks.push(branch);
    }
  }
  const chips = [];
  for (let i = 0, n = 7 + Math.floor(r() * 4); i < n; i++) {
    const theta = r() * TAU, t = 1.08 + r() * 0.55, roll = r();
    chips.push({x: Math.round(CX + Math.cos(theta) * RX * t), y: Math.round(CY + Math.sin(theta) * RY * t), size: roll < 0.45 ? 3 : roll < 0.75 ? 2 : 1});
  }
  return {cells, cracks, chips};
}

function painter(c) {
  return (x, y, style) => {
    if (x < 0 || y < 0 || x >= CRATER_W || y >= CRATER_H) return;
    c.clearRect(x * CRATER_CELL, y * CRATER_CELL, CRATER_CELL, CRATER_CELL);
    c.fillStyle = style; c.fillRect(x * CRATER_CELL, y * CRATER_CELL, CRATER_CELL, CRATER_CELL);
  };
}

// Four tones per crater, deepest first; dithered where two meet.
const TONES = {
  stone: ['rgba(6,5,10,0.92)', 'rgba(16,14,22,0.84)', 'rgba(34,31,44,0.74)', 'rgba(70,66,84,0.62)'],
  scorched: ['rgba(10,4,2,0.94)', 'rgba(24,9,5,0.86)', 'rgba(46,20,12,0.76)', 'rgba(88,48,32,0.64)']
};

/**
 * The crater itself, normal blend. `scorched` uses burnt tones and a soot ring.
 * @param {CanvasRenderingContext2D} c a 128x64 context
 * @param {{main:number, core:number, edge:number}} p the element palette
 * @param {() => number} r a seeded random
 */
export function paintCraterBase(c, p, r, {scorched = false} = {}) {
  const plan = craterPlan(r);
  const put = painter(c);
  const tones = TONES[scorched ? 'scorched' : 'stone'];
  for (const [key, {t, dx, dy}] of plan.cells) {
    const [x, y] = key.split(',').map(Number), checker = (x + y) % 2 === 0;
    if (t < 1) {
      // A bowl lit from above: the far wall (above the centre) faces the viewer.
      const light = Math.max(0, Math.min(1, 0.38 - dy * 1.05 + (t - 0.5) * 0.5 - dx * 0.1));
      const level = light * 3.6 + (t < 0.3 ? -0.9 : 0);
      const band = Math.max(0, Math.min(3, Math.floor(level))), between = level - Math.floor(level);
      put(x, y, tones[between > 0.72 && checker ? Math.min(3, band + 1) : band]);
      // The lip's inner edge: a crisp dark line on the far side, a lit edge on the near side.
      if (t > 0.94 && dy < -0.1) put(x, y, tones[0]);
      if (t > 0.88 && dy > 0.2) put(x, y, 'rgba(255,244,228,0.34)');
    } else if (t < 1.1) {
      // The raised lip: lit along the far side, broken and dimmer at the sides and front.
      if (dy < -0.15) put(x, y, 'rgba(255,240,220,0.42)');
      else if (checker) put(x, y, 'rgba(255,240,220,0.22)');
    } else if (dy > 0.05 && t < 1.24) {
      if (checker || t < 1.17) put(x, y, 'rgba(0,0,0,0.34)');              // shadow cast forward
    } else if (scorched && t < 1.42 && checker && r() > (t - 1.1) * 2.2) put(x, y, 'rgba(20,8,4,0.3)');
  }
  // Cracks: dark seam (two cells wide near the crater), a light bevel under it, thin tip.
  for (const path of plan.cracks) for (const cell of path) {
    const tip = cell.k >= cell.steps - 3;
    put(cell.x, cell.y + 1, 'rgba(255,248,236,0.26)');
    if (cell.wide) { put(cell.x + 1, cell.y + 1, 'rgba(255,248,236,0.22)'); put(cell.x + 1, cell.y, 'rgba(6,4,10,0.8)'); }
    put(cell.x, cell.y, tip ? 'rgba(6,4,10,0.6)' : 'rgba(6,4,10,0.92)');
  }
  // Rock chips: lit top-left, dark lower-right, a shadow under each.
  for (const {x, y, size} of plan.chips) {
    for (let i = 0; i < size; i++) put(x + i + 1, y + 1, 'rgba(0,0,0,0.38)');
    if (size >= 2) put(x + 1, y, 'rgba(118,108,100,0.97)');
    if (size >= 3) { put(x + 2, y, 'rgba(84,76,70,0.97)'); put(x + 1, y - 1, 'rgba(232,224,212,0.97)'); }
    put(x, y, 'rgba(214,204,192,0.97)');
  }
  return plan;
}

/** The burning layer, additive: hot seams in the cracks and a glowing ring round the pit floor. */
export function paintCraterEmbers(c, p, r) {
  const plan = craterPlan(r);
  const put = painter(c);
  for (const [key, {t, dy}] of plan.cells) {
    const [x, y] = key.split(',').map(Number), checker = (x + y) % 2 === 0;
    // A small molten pool at the bottom of the pit, thinning out towards the walls.
    const heat = 1 - t / 0.66 + Math.max(0, dy) * 0.15;
    if (heat > 0) {
      const roll = r();
      if (heat > 0.62) put(x, y, rgba(p.core, 0.88));
      else if (heat > 0.32 || roll < heat * 1.6) put(x, y, rgba(p.main, heat > 0.32 ? 0.78 : 0.6));
      else if (checker) put(x, y, rgba(p.edge ?? p.main, 0.38));
    }
  }
  for (const path of plan.cracks) for (const cell of path) {
    const near = cell.k / Math.max(1, cell.steps);
    if (near > 0.62) continue;
    put(cell.x, cell.y, near < 0.3 ? rgba(p.core, 0.95) : rgba(p.main, 0.8));
    if (cell.wide && near < 0.3) put(cell.x + 1, cell.y, rgba(p.main, 0.7));
  }
  return plan;
}

/** Kinds drawn as a crater (the rest keep their own marks). */
export const CRATER_KINDS = Object.freeze(new Set(['scorch', 'crack']));
/** How the ember layer cools: full for the first beat, then out well before the crater fades. */
export function emberWeight(ageMs) {
  if (ageMs < 260) return 1;
  return Math.max(0, 1 - (ageMs - 260) / 1400);
}
/** The landing pop: a quick overshoot from 82 % to full size. */
export function craterPop(ageMs) {
  if (ageMs >= 140) return 1;
  const t = ageMs / 140, back = 1.7;
  return 0.82 + 0.18 * (1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2);
}
