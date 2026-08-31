// Shop catalog — 118 original table rows transcribed as product data.
//
// Structure, prices, unlock kinds, initialOwned and maxOwned are
// VERIFIED_BINARY. Display names are product slot labels, not ROM text.
// Runtime never imports the research CSV.

import shopDocument from "../../data/championship/catalogs/shop.r1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";

export const SHOP_RECORD_COUNT = 118;
export const SHOP_CATEGORY_COUNTS = deepFreeze({
  TRAINING_GOODS: 4,
  HUNT_ITEMS: 49,
  PLUGINS: 30,
  CAGES: 35
});
export const BITS_WALLET_CAP = 9_999_999;
export const SHOP_CATALOG_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

export const SHOP_UNLOCK_KINDS = deepFreeze({
  INITIAL_AVAILABLE: "INITIAL_AVAILABLE",
  TAMER_RANK_THRESHOLD: "TAMER_RANK_THRESHOLD",
  BATTLE_BADGE_ID_0_BASED: "BATTLE_BADGE_ID_0_BASED"
});

export const SHOP_VISIBILITY = deepFreeze({
  HIDDEN: 0,
  NEW: 1,
  SEEN: 2
});

export const SHOP_PURCHASE_DOMAIN = deepFreeze({
  INVENTORY: "INVENTORY",
  CAGE_OWNERSHIP: "CAGE_OWNERSHIP"
});

export function getShopCatalog() {
  if (shopDocument.recordCount !== SHOP_RECORD_COUNT || shopDocument.records.length !== SHOP_RECORD_COUNT) {
    throw new Error("SHOP_CATALOG_RECORD_COUNT_MISMATCH");
  }
  return shopDocument;
}

export function listShopRecords() {
  return getShopCatalog().records;
}

export function getShopRecord(shopRecordIndex) {
  const record = listShopRecords()[shopRecordIndex];
  if (!record || record.shopRecordIndex !== shopRecordIndex) {
    throw new Error(`UNKNOWN_SHOP_RECORD: ${shopRecordIndex}`);
  }
  return record;
}
