// Geometry helper for the translated Hunt enclosure.
//
// A vertex or edge counts as inside so a stroke that starts on the creature
// can still enclose it. This is not an original formula; it is the obvious
// reading of "the circle caught this body".

export function pointInPolygon(x, y, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (pointOnSegment(x, y, a.x, a.y, b.x, b.y)) return true;
  }

  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const xi = points[index].x;
    const yi = points[index].y;
    const xj = points[previous].x;
    const yj = points[previous].y;
    const crosses = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointOnSegment(px, py, ax, ay, bx, by) {
  const ab = Math.hypot(bx - ax, by - ay);
  if (ab < 1e-9) return Math.hypot(px - ax, py - ay) <= 0.75;
  const ap = Math.hypot(px - ax, py - ay);
  const pb = Math.hypot(px - bx, py - by);
  return Math.abs(ap + pb - ab) <= 0.75;
}
