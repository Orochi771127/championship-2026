// Presentation target hit test. The 48 world-unit radius is product-authored,
// not original tool range or capture eligibility.

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
