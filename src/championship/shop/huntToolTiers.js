// Hunt tool families: one slot per tool, upgraded in place (α -> β -> γ).
//
// OWNER_APPROVED_ADAPTATION 2026-11-03 (HUNT_TOOL_TIERS_20261103). The Owner
// found the hunt shop, the bag and the hunt loadout listing every tier of the
// same tool side by side (12 ropes, 12 shots, 6 wires, 3 memory cards), so an
// old 捕捉繩 α stayed in the way after a 究極繩 γ was bought. The ROM shop
// table is untouched: each family is a run of its rows, and the family's
// stock lives on the row of its current tier only. What this module adds:
//
//   ROPE    four colour families of three tiers. A rope is now counted
//           (/99) and wears out: a rope that snaps costs one and the next
//           rope comes in fresh. Buying a tier pays the row's own price once
//           and adds ten ropes; single ropes refill at a consumable price.
//   GEAR    shots, wires, meat, decoys, mines and traps with an α and a β.
//           β is a one-time model upgrade; every unit held moves up 1:1.
//   MEMORY  the three memory cards become one card with seven sizes; the
//           last four take bits or test diamonds.
//
// Saved as shop.toolTiers (family -> tier) and shop.ropeWear (family -> the
// current rope's remaining durability in per-mille). A save without
// toolTiers is migrated once from its row quantities.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const HUNT_TOOL_TIER_LETTERS = deepFreeze(["α", "β", "γ"]);
export const HUNT_TOOL_STOCK_CAP = 99;
export const ROPE_TIER_GRANT = 10;
export const ROPE_MIGRATION_STOCK = 15;
export const ROPE_EMERGENCY_COUNT = 5;
export const ROPE_EMERGENCY_MARKUP = 1.5;
export const ROPE_WEAR_FULL = 1000;

const rope = (familyId, first, refillBits) => ({ familyId, kind: "ROPE", records: [first, first + 1, first + 2], refillBits });
const gear = (familyId, first, upgradeBits) => ({ familyId, kind: "GEAR", records: [first, first + 1], upgradeBits });

// Model upgrade fee: about thirty β units (five for the four-figure traps),
// rounded to two significant figures.
export const HUNT_TOOL_FAMILIES = deepFreeze([
  rope("rope-swift", 4, [20, 35, 50]),
  rope("rope-tough", 7, [80, 110, 150]),
  rope("rope-clone", 10, [200, 260, 320]),
  rope("rope-ultimate", 13, [450, 600, 800]),
  gear("shot-pistol", 16, 300),
  gear("shot-rapid", 18, 600),
  gear("shot-sleep", 20, 1500),
  gear("shot-paralyze", 22, 3000),
  gear("shot-shotgun", 24, 3600),
  gear("shot-paralyze-shotgun", 26, 7800),
  gear("wire-standard", 28, 900),
  gear("wire-magnet", 30, 3300),
  gear("wire-shock", 32, 12000),
  gear("meat", 34, 2400),
  gear("decoy", 38, 24000),
  gear("mine", 46, 24000),
  gear("trap", 48, 44000),
  { familyId: "memory-card", kind: "MEMORY", records: [50, 51, 52],
    capacityG: [32, 64, 96, 128, 160, 200, 256],
    // Level 0 is the starting 32 G card; the first three sizes keep their ROM prices.
    priceBits: [2450, 4850, 9850, 150000, 350000, 800000, 1800000],
    priceDiamonds: [null, null, null, 300, 500, 800, 1200] }
]);

const BY_ID = new Map(HUNT_TOOL_FAMILIES.map(family => [family.familyId, family]));
const BY_RECORD = new Map(HUNT_TOOL_FAMILIES.flatMap(family => family.records.map((record, tier) => [record, { family, tier }])));

export const getHuntToolFamily = familyId => BY_ID.get(familyId) ?? null;
/** { family, tier } for a shop row inside a family, else null. */
export const huntToolFamilyOfRecord = shopRecordIndex => BY_RECORD.get(shopRecordIndex) ?? null;
export const isRopeRecord = shopRecordIndex => huntToolFamilyOfRecord(shopRecordIndex)?.family.kind === "ROPE";
/** Ropes are counted now; every other row keeps its ROM cap. */
export const huntToolMaxOwned = record => (isRopeRecord(record.shopRecordIndex) ? HUNT_TOOL_STOCK_CAP : record.maxOwned);
export const huntToolTierCount = family => (family.kind === "MEMORY" ? family.capacityG.length : family.records.length);

/** Price of one emergency bundle of ropes from the given rope family tier. */
export function ropeEmergencyBits(family, tier) {
  return Math.ceil(family.refillBits[Math.max(0, tier)] * ROPE_EMERGENCY_COUNT * ROPE_EMERGENCY_MARKUP);
}

/**
 * Derive family tiers and fold every family's stock onto its current row.
 * `quantities` is the shop's per-row array; it is changed in place.
 * Ropes held as the old 1/1 become ROPE_MIGRATION_STOCK ropes of the top tier owned.
 */
export function migrateHuntToolQuantities(quantities) {
  const tiers = {};
  for (const family of HUNT_TOOL_FAMILIES) {
    const held = family.records.map(record => quantities[record] ?? 0);
    const tier = held.reduce((top, quantity, index) => (quantity > 0 ? index : top), -1);
    tiers[family.familyId] = tier;
    if (tier < 0 || family.kind === "MEMORY") {
      // Memory keeps its rows: last owned card wins, so the lower ones are cleared.
      if (family.kind === "MEMORY") family.records.forEach((record, index) => { quantities[record] = index === tier ? 1 : 0; });
      continue;
    }
    const total = family.kind === "ROPE" ? ROPE_MIGRATION_STOCK : held.reduce((sum, quantity) => sum + quantity, 0);
    family.records.forEach((record, index) => { quantities[record] = index === tier ? Math.min(HUNT_TOOL_STOCK_CAP, total) : 0; });
  }
  return tiers;
}

/** Validated copy of a saved toolTiers object (unknown families and bad tiers are refused). */
export function normalizeHuntToolTiers(value, fail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail("INVALID_HUNT_TOOL_TIERS");
  const out = {};
  for (const [familyId, tier] of Object.entries(value)) {
    const family = getHuntToolFamily(familyId);
    if (!family || !Number.isSafeInteger(tier) || tier < -1 || tier >= huntToolTierCount(family)) throw fail("INVALID_HUNT_TOOL_TIERS");
    out[familyId] = tier;
  }
  return out;
}

/** Validated copy of a saved ropeWear object (rope families, 1..999 per-mille; full ropes are not stored). */
export function normalizeRopeWear(value, fail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail("INVALID_ROPE_WEAR");
  const out = {};
  for (const [familyId, permille] of Object.entries(value)) {
    if (getHuntToolFamily(familyId)?.kind !== "ROPE" || !Number.isSafeInteger(permille) || permille < 1 || permille >= ROPE_WEAR_FULL) {
      throw fail("INVALID_ROPE_WEAR");
    }
    out[familyId] = permille;
  }
  return out;
}
