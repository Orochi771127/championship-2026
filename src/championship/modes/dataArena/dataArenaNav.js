// Data Arena -- flow-field navigation over the harbor grid.
//
// One Dijkstra pass from the goal gives every cell its travel cost; a body
// steers toward its cheapest neighbour. The field is rebuilt on a timer and
// whenever the grid's navRevision changes (fire, ice, bridge), so fire and
// ice bridges really change AI routes:
//  walker  : open water is a wall; ice is a road; CRACKING ice and burning
//            cells are very expensive (avoid unless there is no other way).
//  fireproof walker (ember wisp): burning cells cost nothing extra.
//  swimmer : open water is cheaper than land (the mate prefers the channel).

import { DATA_ARENA_GRID_RULES } from "./dataArenaConfig.js";

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function cellCost(grid, i, profile) {
  if (grid.isSolid(i)) return Infinity;
  const water = grid.isWaterTerrain(i);
  const ice = grid.ice[i];
  if (water && ice <= 0) return profile === "swimmer" ? 0.8 : Infinity;
  let cost = 1;
  if (water && ice > 0 && ice <= DATA_ARENA_GRID_RULES.iceWarnSeconds && profile !== "swimmer") cost += 40;
  if (grid.fire[i] > 0 && profile !== "fireproof") cost += 14;
  return cost;
}

/** Minimal binary heap keyed by Float64 priority. */
function createHeap(capacity) {
  // A cell can be pushed once per improving neighbour (8), plus the goal.
  const keys = new Float64Array(capacity * 9 + 1), values = new Int32Array(capacity * 9 + 1);
  let size = 0;
  return {
    get size() { return size; },
    clear() { size = 0; },
    push(key, value) {
      let i = size++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] <= key) break;
        keys[i] = keys[p]; values[i] = values[p]; i = p;
      }
      keys[i] = key; values[i] = value;
    },
    pop(out) {
      out.key = keys[0]; out.value = values[0];
      const key = keys[--size], value = values[size];
      let i = 0;
      for (;;) {
        let child = i * 2 + 1;
        if (child >= size) break;
        if (child + 1 < size && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child]; values[i] = values[child]; i = child;
      }
      keys[i] = key; values[i] = value;
      return out;
    }
  };
}

export function createFlowField(grid, profile) {
  // Float64 on purpose: a float32 store rounds up and re-admits the same path forever.
  const distance = new Float64Array(grid.count).fill(Infinity);
  const heap = createHeap(grid.count);
  const scratch = { key: 0, value: 0 };
  let goalCell = -1, builtRevision = -1, age = Infinity;

  const costs = new Float64Array(grid.count);
  function build(goalX, goalY) {
    const c = Math.min(grid.cols - 1, Math.max(0, grid.cellOf(goalX)));
    const r = Math.min(grid.rows - 1, Math.max(0, grid.cellOf(goalY)));
    goalCell = grid.index(c, r);
    for (let i = 0; i < grid.count; i++) costs[i] = cellCost(grid, i, profile);
    distance.fill(Infinity);
    heap.clear();
    distance[goalCell] = 0;
    heap.push(0, goalCell);
    const cols = grid.cols, rows = grid.rows;
    while (heap.size) {
      const { key, value: i } = heap.pop(scratch);
      if (key > distance[i]) continue;
      const ci = i % cols, ri = (i - ci) / cols;
      for (let d = 0; d < 8; d++) {
        const dc = DIRS[d][0], dr = DIRS[d][1];
        const nc = ci + dc, nr = ri + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        const cost = costs[n];
        if (cost === Infinity) continue;
        // No corner cutting past a blocked orthogonal neighbour.
        if (dc && dr && (costs[ri * cols + nc] === Infinity || costs[nr * cols + ci] === Infinity)) continue;
        const next = key + cost * DIRS[d][2];
        if (next < distance[n]) { distance[n] = next; heap.push(next, n); }
      }
    }
    builtRevision = grid.navRevision;
    age = 0;
  }

  return Object.freeze({
    distance,
    get goalCell() { return goalCell; },
    /** Rebuild when the goal moved cells, the grid changed, or the field aged out. */
    update(goalX, goalY, dt, maxAge = 0.4) {
      age += dt;
      const c = grid.cellOf(goalX), r = grid.cellOf(goalY);
      const goal = grid.inBounds(c, r) ? grid.index(c, r) : goalCell;
      // Grid changes (fire spread, ice) are batched: at most one rebuild per 0.15 s.
      if ((goal !== goalCell && age >= maxAge * 0.5) || (builtRevision !== grid.navRevision && age >= 0.15) || age >= maxAge) build(goalX, goalY);
    },
    /** Unit steering vector at (x, y), or null when unreachable / at goal. */
    direction(x, y) {
      const c = grid.cellOf(x), r = grid.cellOf(y);
      if (!grid.inBounds(c, r)) return null;
      const here = distance[grid.index(c, r)];
      let best = here, bx = 0, by = 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (!grid.inBounds(nc, nr)) continue;
        if (dc && dr && (!Number.isFinite(distance[grid.index(c + dc, r)]) || !Number.isFinite(distance[grid.index(c, r + dr)]))) continue;
        const d = distance[grid.index(nc, nr)];
        if (d < best) { best = d; bx = dc; by = dr; }
      }
      if (best === here) return null;
      // Aim at the neighbour cell's centre so bodies do not hug corners.
      const tx = (c + bx + 0.5) * grid.cell - x, ty = (r + by + 0.5) * grid.cell - y;
      const length = Math.hypot(tx, ty) || 1;
      return { x: tx / length, y: ty / length };
    },
    reachable(x, y) {
      const c = grid.cellOf(x), r = grid.cellOf(y);
      return grid.inBounds(c, r) && Number.isFinite(distance[grid.index(c, r)]);
    }
  });
}
