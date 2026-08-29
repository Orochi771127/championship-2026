// VS3 -- original Hunt tether distance bands, rewritten for web/mobile.
//
// The original rope/tether used four distance windows. Wild-creature AI still
// is not traced, so this module only classifies distance. It does not invent
// pull strength, stamina drain, or capture success odds.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const TETHER_BANDS = deepFreeze([40, 80, 160]);
export const TETHER_DISTANCE_EVIDENCE = "VERIFIED_BINARY";

export function classifyTetherDistance(distancePx) {
  if (!Number.isFinite(distancePx) || distancePx < 0) {
    throw new TypeError("Tether distance must be a non-negative finite number");
  }
  if (distancePx < TETHER_BANDS[0]) return "UNDER_40";
  if (distancePx < TETHER_BANDS[1]) return "FROM_40_TO_80";
  if (distancePx < TETHER_BANDS[2]) return "FROM_80_TO_160";
  return "OVER_160";
}
