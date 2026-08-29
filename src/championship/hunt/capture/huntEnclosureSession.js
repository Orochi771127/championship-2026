// VS3 -- start an enclosure stroke near a wild creature.
//
// Original Hunt capture is a tether and a drawn circle. The original hit
// radius around a body is untraced, so the start-proximity used here is
// product-authored for a finger-sized target. Geometry after that is the
// original stroke grammar.

export const ENCLOSURE_HIT_RADIUS_PX = 48;
export const ENCLOSURE_HIT_RADIUS_EVIDENCE = "PRODUCT_AUTHORED";

export function nearestWildInHitRadius(x, y, wilds, radiusPx = ENCLOSURE_HIT_RADIUS_PX) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Array.isArray(wilds)) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const wild of wilds) {
    if (!Number.isFinite(wild?.worldX) || !Number.isFinite(wild?.worldY)) continue;
    const distance = Math.hypot(wild.worldX - x, wild.worldY - y);
    if (distance <= radiusPx && distance < nearestDistance) {
      nearest = wild;
      nearestDistance = distance;
    }
  }
  return nearest;
}
