// Cage catalog — original 36 CageDefinitions, not the 40 visual fields.
//
// VERIFIED_BINARY from YDIJ OVL15 + ARM9 (ROM SHA-256 8ad375ba…c5d1):
//   • 35 Shop cages plus Waiting Room (definition 35), never sold
//   • Tamer-rank table at ARM9 0x020E1E14/0x020E1E18, stride 36: first word is
//     ranch slot count 14 / 16 / 18 / 20
//   • OVL15 0x0210B36C: switch (slotCount - 14) shows/hides cover1..3
//
// One cage occupies exactly one hex slot. The BAR/ELL tetris masks were a
// product guess and are not in the ROM. Channel identity and the recommended
// Digimon count come from original descriptions (VERIFIED_TEXT). Overfill is
// allowed and only named as "stress rises more easily"; tick magnitudes stay
// UNKNOWN_REQUIRES_TRACE — see cageEffects.js.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { SHOP_PURCHASE_DOMAIN, listShopRecords } from "../shop/shopCatalog.js";
import {
  CAGE_CAPACITY_OVERFILL_CONSEQUENCE,
  CAGE_CAPACITY_RULE,
  CAGE_CAPACITY_RULE_EVIDENCE,
  CAGE_TRAINING_CHANNEL_EVIDENCE,
  CAGE_TRAINING_MAGNITUDE_PARITY,
  getCageTraining
} from "./cageEffects.js";

export const CAGE_DEFINITION_COUNT = 36;
export const CAGE_SHOP_COUNT = 35;
export const WAITING_ROOM_DEFINITION_INDEX = 35;
export const MAX_SLOT_COUNT = 20;
export const STARTING_SLOT_COUNT = 14;
export const SLOT_COUNTS = Object.freeze([14, 16, 18, 20]);
export const SLOT_COUNT_EVIDENCE = "VERIFIED_BINARY";
export const PLACEMENT_MODEL = "ONE_MODULE_PER_HEX_SLOT";
export const PLACEMENT_EVIDENCE = "VERIFIED_BINARY";
export const EFFECT_PARITY = CAGE_TRAINING_MAGNITUDE_PARITY;
export const EFFECT_CHANNEL_EVIDENCE = CAGE_TRAINING_CHANNEL_EVIDENCE;
export const CAPACITY_RULE = CAGE_CAPACITY_RULE;
export const CAPACITY_RULE_EVIDENCE = CAGE_CAPACITY_RULE_EVIDENCE;
export const CAPACITY_OVERFILL_CONSEQUENCE = CAGE_CAPACITY_OVERFILL_CONSEQUENCE;
export const CAGE_CATALOG_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

// Rank 0..9 first-word of the 36-byte tamer table at 0x020E1E18.
// The other eight words exist (evolution / capacity / medal thresholds are
// likely) but have no closed reader+writer, so they are not product rules.
// Rank ≥ 10 is not in that table; the editor keeps the last verified cap (20).
export const TAMER_RANK_SLOT_TABLE = Object.freeze([14, 14, 16, 16, 18, 18, 20, 20, 20, 20]);
export const TAMER_RANK_TABLE_LAST_INDEX = TAMER_RANK_SLOT_TABLE.length - 1;
export const TAMER_RANK_STORE_MAX = 65535;

/**
 * How many hex slots the ranch currently has.
 *
 * This is the original first word of the tamer-rank record, not a product guess.
 * Championship 2026 still starts at rank 0 (14 slots) until rank writes exist.
 */
export function slotCountForTamerRank(tamerRank = 0) {
  if (!Number.isSafeInteger(tamerRank) || tamerRank < 0) return STARTING_SLOT_COUNT;
  if (tamerRank >= TAMER_RANK_SLOT_TABLE.length) return MAX_SLOT_COUNT;
  return TAMER_RANK_SLOT_TABLE[tamerRank];
}

/** Original PlayerData +0xAE8 is a u16. Missing or junk values become rank 0. */
export function normalizeTamerRank(value) {
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return Math.min(value, TAMER_RANK_STORE_MAX);
}

function shopCageRecords() {
  const records = listShopRecords().filter((record) => record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP);
  if (records.length !== CAGE_SHOP_COUNT) {
    throw new Error("CAGE_SHOP_COUNT_MISMATCH");
  }
  const byIndex = new Map();
  for (const record of records) {
    if (byIndex.has(record.itemIndex)) throw new Error(`DUPLICATE_CAGE_ITEM_INDEX: ${record.itemIndex}`);
    byIndex.set(record.itemIndex, record);
  }
  const ordered = [];
  for (let itemIndex = 0; itemIndex < CAGE_SHOP_COUNT; itemIndex += 1) {
    const record = byIndex.get(itemIndex);
    if (!record) throw new Error(`MISSING_CAGE_ITEM_INDEX: ${itemIndex}`);
    ordered.push(record);
  }
  return ordered;
}

let cached = null;

export function listCageDefinitions() {
  if (cached) return cached;
  const shopCages = shopCageRecords();
  const records = shopCages.map((record, cageDefinitionIndex) => ({
    cageDefinitionIndex,
    moduleId: `championship:2026:cage:${record.itemIndex}`,
    displayName: record.displayName,
    shopRecordIndex: record.shopRecordIndex,
    alwaysOwned: false,
    identityEvidence: "VERIFIED_BINARY",
    training: getCageTraining(cageDefinitionIndex)
  }));
  records.push({
    cageDefinitionIndex: WAITING_ROOM_DEFINITION_INDEX,
    moduleId: "championship:2026:cage:waiting-room",
    displayName: "Waiting Room",
    shopRecordIndex: null,
    alwaysOwned: true,
    identityEvidence: "VERIFIED_BINARY",
    training: getCageTraining(WAITING_ROOM_DEFINITION_INDEX)
  });
  cached = deepFreeze(records);
  return cached;
}

export function getCageDefinition(cageDefinitionIndex) {
  const record = listCageDefinitions()[cageDefinitionIndex];
  if (!record) throw new Error(`UNKNOWN_CAGE_DEFINITION: ${cageDefinitionIndex}`);
  return record;
}

export function getCageDefinitionByModuleId(moduleId) {
  return listCageDefinitions().find((record) => record.moduleId === moduleId) ?? null;
}

export function getCageDefinitionByShopRecord(shopRecordIndex) {
  return listCageDefinitions().find((record) => record.shopRecordIndex === shopRecordIndex) ?? null;
}

export function ownedModuleIds(shopCageOwned = []) {
  const owned = new Set();
  for (const record of listCageDefinitions()) {
    if (record.alwaysOwned) owned.add(record.moduleId);
  }
  for (const shopRecordIndex of shopCageOwned) {
    const record = getCageDefinitionByShopRecord(shopRecordIndex);
    if (record) owned.add(record.moduleId);
  }
  return owned;
}
