// VS3 -- Hunt tether distance bands for the web/mobile rebuild.
//
// 2026-08-30 ROM pass: original hypot pull radii are shutter-mode 40 / 80 / 256
// px, not these four windows. 160 px is a spawn-offset step, not a rope band.
// Keep this classifier as a product HUD/AI bucket only. It does not invent
// pull strength, stamina drain, or capture odds.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const TETHER_BANDS = deepFreeze([40, 80, 160]);
export const TETHER_DISTANCE_EVIDENCE = "PRODUCT_AUTHORED";

export function classifyTetherDistance(distancePx) {
  if (!Number.isFinite(distancePx) || distancePx < 0) {
    throw new TypeError("Tether distance must be a non-negative finite number");
  }
  if (distancePx < TETHER_BANDS[0]) return "UNDER_40";
  if (distancePx < TETHER_BANDS[1]) return "FROM_40_TO_80";
  if (distancePx < TETHER_BANDS[2]) return "FROM_80_TO_160";
  return "OVER_160";
}
