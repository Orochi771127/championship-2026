// Hunt memory-card capacity -- original event 0x16 gate, rewritten in JS.
//
// WHAT THE ROM ACTUALLY DOES (2026-08-30 semantic trace)
// ------------------------------------------------------
// Close-stroke / enclose (event 0x23) does NOT subtract G and does NOT roll
// a percent. A later Hunt path (event 0x16) asks ARM9 0x020676F4 for max G
// from owned Memory Card slots, sums each on-card instance's species G-cost
// byte, adds this creature's cost, and if (sum + this) > max fires event 0x39.
//
// Max G is (owned_slot + 1) << 5, last owned slot wins: 32 / 64 / 96, or 0
// if none are owned. That identity is VERIFIED_BINARY.
//
// The per-species G-cost table is in ARM9 at 0x020C1374, stride 0x84, u8 at
// +0x1D (incoming-creature load uses the same table already biased by +0x1D
// at 0x020C1391). Observed values on the first ~224 pointer-backed rows are
// mostly 12 / 14 / 16 / 18 / 20 / 24 / 32, not 1. Species IDs now map to ROM
// indices, but this column is absent from the product catalog. The legacy
// count helper below remains diagnostic only. The bounded native capture flow
// receives an explicit traced G cost and sums actual on-card records; it never
// calls the legacy unit-cost helper or copies a ROM column into runtime assets.
//
// Remaining G is derived (max - used), not a stored subtract-on-enclose field.

import { deepFreeze } from "../../contracts/championshipContracts.js";
import { HUNT_MEMORY_CARDS } from "../loadout/huntEquipmentCatalog.js";

export const CAPTURE_CAPACITY_SCOPE = "MEMORY_CARD_SUM_VS_MAX";
export const CAPTURE_CAPACITY_MAX_EVIDENCE = "VERIFIED_BINARY";
export const SPECIES_G_COST_EVIDENCE = "PRODUCT_AUTHORED";
export const PRODUCT_SPECIES_G_COST = 1;
export const ORIGINAL_OVER_CAPACITY_EVENT = "0x39";

/**
 * Original max G from owned cards, last occupied slot wins.
 *
 * Slot order follows HUNT_MEMORY_CARDS: 32, then 64, then 96.
 */
export function maxGFromInventory(inventory) {
  if (!inventory || typeof inventory.getQuantity !== "function") return 0;
  let maxG = 0;
  for (const card of HUNT_MEMORY_CARDS) {
    if (inventory.getQuantity(card.itemId) > 0) maxG = card.capacityG;
  }
  return maxG;
}

export function usedGFromCollectionCount(count, unitCost = PRODUCT_SPECIES_G_COST) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new TypeError("Collection count must be a non-negative integer");
  }
  if (!Number.isSafeInteger(unitCost) || unitCost < 0) {
    throw new TypeError("G-cost must be a non-negative integer");
  }
  return count * unitCost;
}

/**
 * Compare already-held G plus this creature against max.
 *
 * `allowed: false` is the original over-capacity reject. It is a gate, not a
 * close-stroke drain.
 */
export function evaluateMemoryCardCapacity({
  maxG,
  usedG,
  incomingG = PRODUCT_SPECIES_G_COST
} = {}) {
  if (!Number.isSafeInteger(maxG) || maxG < 0) {
    throw new TypeError("maxG must be a non-negative integer");
  }
  if (!Number.isSafeInteger(usedG) || usedG < 0) {
    throw new TypeError("usedG must be a non-negative integer");
  }
  if (!Number.isSafeInteger(incomingG) || incomingG < 0) {
    throw new TypeError("incomingG must be a non-negative integer");
  }
  const projected = usedG + incomingG;
  const allowed = projected <= maxG;
  return deepFreeze({
    allowed,
    reason: allowed ? "WITHIN_CAPACITY" : "OVER_CAPACITY",
    originalEvent: allowed ? null : ORIGINAL_OVER_CAPACITY_EVENT,
    maxG,
    usedG,
    incomingG,
    remainingG: Math.max(0, maxG - usedG),
    projectedG: projected,
    maxEvidence: CAPTURE_CAPACITY_MAX_EVIDENCE,
    costEvidence: SPECIES_G_COST_EVIDENCE,
    scope: CAPTURE_CAPACITY_SCOPE
  });
}

export function evaluateBringHomeCapacity(inventory, collectionCount) {
  return evaluateMemoryCardCapacity({
    maxG: maxGFromInventory(inventory),
    usedG: usedGFromCollectionCount(collectionCount),
    incomingG: PRODUCT_SPECIES_G_COST
  });
}
