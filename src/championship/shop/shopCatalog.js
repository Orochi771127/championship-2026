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

// The four Raising toolbar tools and the Training Goods item each one spends.
// The original stores Training Goods at PlayerData +0x1E + 2*itemIndex. OVL18
// 0210F0B0 (wound, command 7C, individual +134) debits +0x24 = item 3
// (キズグスリ); 0210F324 (illness, command 7D, individual +138) debits
// +0x22 = item 2 (クスリ). Shop records 2 and 3 hold items 3 and 2, so a tool
// resolves its record by item index, never by record number.
export const RAISING_TOOL_ITEM_INDEX = deepFreeze({ feed: 0, protein: 1, medicine: 2, woundMedicine: 3 });

/** Shop record behind each Raising tool: feed 0, protein 1, woundMedicine 2, medicine 3. */
export const RAISING_TOOL_SHOP_RECORDS = deepFreeze(Object.fromEntries(
  Object.entries(RAISING_TOOL_ITEM_INDEX).map(([tool, itemIndex]) => {
    const record = listShopRecords().find((row) => row.category === "TRAINING_GOODS" && row.itemIndex === itemIndex);
    if (!record) throw new Error(`MISSING_TRAINING_GOODS_ITEM: ${itemIndex}`);
    return [tool, record.shopRecordIndex];
  })
));

/** Owned count of each Raising tool, read from Shop frame listings. */
export function raisingToolStock(listings = []) {
  return Object.fromEntries(Object.entries(RAISING_TOOL_SHOP_RECORDS)
    .map(([tool, record]) => [tool, listings.find((row) => row.shopRecordIndex === record)?.owned]));
}
