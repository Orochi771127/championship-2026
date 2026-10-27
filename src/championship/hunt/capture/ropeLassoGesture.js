// OWNER_APPROVED_ADAPTATION, 2026-10-27: the rope's circle is read as a lasso.
//
// The native sampler (nativeRopeStroke.js) keeps 20 short-lived points, judges
// only on release, wants a near-round shape and then binds whatever stands in a
// fixed box around a computed centre. Players drew real circles around a
// partner and missed. This tracker reads the whole drawn path instead: a loop
// closes the moment the stroke crosses itself or comes back near an earlier
// point, any oval counts, and a partner is caught when its body sits inside
// the drawn loop. It consumes no RNG, so the native sampler (and the replayed
// random stream) runs unchanged beside it. Units are native field pixels.

export const LASSO_RULES = Object.freeze({
  minStep: 3,         // px between kept points
  maxPoints: 240,     // about four seconds of drawing at the native tick
  closeDistance: 18,  // px: the head this near an earlier point closes the loop
  minLoopPoints: 8,   // an earlier point must be at least this far back
  minLoopSpan: 20,    // px: the loop's longer side
  minLoopNarrow: 8,   // px: the loop's shorter side
  minLoopArea: 160,   // px²
  minPathPerSpan: 2.2, // a real loop's path is at least 2.2x its widest side (flat oval ~2.3x, quarter arc ~1.6x)
  maxGapPerSpan: 0.35, // the closing gap, relative to the loop's widest side
  catchMargin: 16     // px: a body this near the rope still counts as inside
});

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function segmentIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denominator;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denominator;
  return t > 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, y: a.y + t * r.y } : null;
}

/** Signed shoelace area and centroid of a closed polygon. */
export function lassoPolygonShape(polygon) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const cross = p.x * q.y - q.x * p.y;
    area += cross; cx += (p.x + q.x) * cross; cy += (p.y + q.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-9) {
    const n = polygon.length || 1;
    return { area: 0, centroid: { x: polygon.reduce((s, p) => s + p.x, 0) / n, y: polygon.reduce((s, p) => s + p.y, 0) / n } };
  }
  return { area: Math.abs(area), centroid: { x: cx / (6 * area), y: cy / (6 * area) } };
}

const pathLength = (points) => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);

function acceptLoop(polygon, gap = 0) {
  if (polygon.length < 4) return null;
  const xs = polygon.map((p) => p.x), ys = polygon.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), span = Math.max(w, h);
  if (span < LASSO_RULES.minLoopSpan || Math.min(w, h) < LASSO_RULES.minLoopNarrow) return null;
  // The stroke must actually have gone round: long enough for its size, and
  // shut (or crossed) close to where the loop began.
  if (pathLength(polygon) < LASSO_RULES.minPathPerSpan * span || gap > Math.max(10, LASSO_RULES.maxGapPerSpan * span)) return null;
  const shape = lassoPolygonShape(polygon);
  if (shape.area < LASSO_RULES.minLoopArea) return null;
  return Object.freeze({ polygon: Object.freeze(polygon.map((p) => Object.freeze({ x: p.x, y: p.y }))), centroid: Object.freeze(shape.centroid), area: shape.area });
}

/** A drawn path that reports a loop as soon as one closes. */
export function createLassoTracker() {
  let points = [];
  return Object.freeze({
    reset(start = null) { points = start ? [{ x: start.x, y: start.y }] : []; },
    get points() { return points; },
    add(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const head = { x, y }, last = points.at(-1);
      if (last && distance(last, head) < LASSO_RULES.minStep) return null;
      points.push(head);
      if (points.length > LASSO_RULES.maxPoints) points.shift();
      const n = points.length;
      if (n < 4) return null;
      // 1) The newest segment crosses an earlier one.
      const a = points[n - 2], b = points[n - 1];
      for (let i = n - 4; i >= 0; i -= 1) {
        const hit = segmentIntersection(a, b, points[i], points[i + 1]);
        if (!hit) continue;
        const loop = acceptLoop([hit, ...points.slice(i + 1, n - 1)]);
        if (loop) return loop;
      }
      // 2) The head comes back near an earlier point (the circle is nearly shut).
      for (let i = 0; i <= n - 1 - LASSO_RULES.minLoopPoints; i += 1) {
        const gap = distance(points[i], b);
        if (gap > LASSO_RULES.closeDistance) continue;
        const loop = acceptLoop(points.slice(i, n), gap);
        if (loop) return loop;
      }
      return null;
    }
  });
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(x, y, polygon) {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

/** True when a body centred at (x, y) is caught by the loop. */
export function lassoContains(polygon, x, y, margin = LASSO_RULES.catchMargin) {
  if (!Array.isArray(polygon) || polygon.length < 3 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return pointInPolygon(x, y, polygon) || distanceToPolygon(x, y, polygon) <= margin;
}
