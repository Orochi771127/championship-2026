// Shop runtime — original OVL17 purchase rules, rewritten in JS.
//
// Wallet, visibility (hidden / NEW / seen), inventory quantities and Cage
// ownership stay separate, matching the ROM split. Close-shop NEW→seen is the
// original 1→2 scan. Rank and badge unlocks are evaluated against the
// progression context; this slice does not invent a rank-up event.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  BITS_WALLET_CAP,
  SHOP_PURCHASE_DOMAIN,
  SHOP_RECORD_COUNT,
  SHOP_UNLOCK_KINDS,
  SHOP_VISIBILITY,
  getShopCatalog,
  getShopRecord,
  listShopRecords
} from "./shopCatalog.js";

export const SHOP_RUNTIME_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";
export const STARTING_BITS = 0;
export const STARTING_BITS_EVIDENCE = "PRODUCT_AUTHORED";

function shopError(message) {
  const error = new Error(message);
  error.name = "ChampionshipShopError";
  return error;
}

function initialVisibility(record) {
  return record.unlockKind === SHOP_UNLOCK_KINDS.INITIAL_AVAILABLE
    ? SHOP_VISIBILITY.SEEN
    : SHOP_VISIBILITY.HIDDEN;
}

function isUnlocked(record, { tamerRank = 0, battleBadges = [] } = {}) {
  if (record.unlockKind === SHOP_UNLOCK_KINDS.INITIAL_AVAILABLE) return true;
  if (record.unlockKind === SHOP_UNLOCK_KINDS.TAMER_RANK_THRESHOLD) {
    return Number(tamerRank) >= record.unlockParameter;
  }
  if (record.unlockKind === SHOP_UNLOCK_KINDS.BATTLE_BADGE_ID_0_BASED) {
    return battleBadges.includes(record.unlockParameter);
  }
  return false;
}

export function createShopRuntime({
  catalog = getShopCatalog(),
  huntInventory = null,
  initialHuntInventory = null,
  bits = STARTING_BITS,
  progression = { tamerRank: 0, battleBadges: [] },
  snapshot = null
} = {}) {
  if (!catalog || catalog.records?.length !== SHOP_RECORD_COUNT) {
    throw shopError("SHOP_CATALOG_REQUIRED");
  }
  if (!Number.isSafeInteger(bits) || bits < 0) throw shopError("INVALID_BITS");

  let progressionState = {
    tamerRank: Number.isSafeInteger(progression?.tamerRank) ? progression.tamerRank : 0,
    battleBadges: Array.isArray(progression?.battleBadges) ? [...progression.battleBadges] : []
  };
  const records = catalog.records;
  let wallet = Math.min(bits, BITS_WALLET_CAP);
  const visibility = new Array(SHOP_RECORD_COUNT);
  const quantities = new Array(SHOP_RECORD_COUNT).fill(0);
  const cageOwned = new Set();

  if (snapshot) {
    wallet = Math.min(BITS_WALLET_CAP, Math.max(0, snapshot.bits | 0));
    for (let index = 0; index < SHOP_RECORD_COUNT; index += 1) {
      visibility[index] = snapshot.visibility?.[index] ?? initialVisibility(records[index]);
      quantities[index] = snapshot.quantities?.[index] ?? 0;
    }
    for (const recordIndex of snapshot.cageOwned ?? []) cageOwned.add(recordIndex);
  } else {
    for (const record of records) {
      visibility[record.shopRecordIndex] = initialVisibility(record);
      if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
        if (record.initialOwned > 0) cageOwned.add(record.shopRecordIndex);
      } else {
        quantities[record.shopRecordIndex] = initialHuntInventory && record.productItemId
          ? initialHuntInventory.getQuantity(record.productItemId) : record.initialOwned;
      }
    }
  }

  function ownedOf(record) {
    if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
      return cageOwned.has(record.shopRecordIndex) ? 1 : 0;
    }
    return quantities[record.shopRecordIndex];
  }

  function revealUnlocked() {
    for (const record of records) {
      if (visibility[record.shopRecordIndex] !== SHOP_VISIBILITY.HIDDEN) continue;
      if (!isUnlocked(record, progressionState)) continue;
      visibility[record.shopRecordIndex] = SHOP_VISIBILITY.NEW;
    }
  }

  revealUnlocked();

  const listeners = new Set();
  function publish() {
    const frame = getFrame();
    for (const listener of [...listeners]) {
      try { listener(frame); } catch { /* observers never break the shop */ }
    }
    return frame;
  }

  function getFrame() {
    const listings = [];
    for (const record of records) {
      const vis = visibility[record.shopRecordIndex];
      if (vis === SHOP_VISIBILITY.HIDDEN) continue;
      const owned = ownedOf(record);
      listings.push({
        shopRecordIndex: record.shopRecordIndex,
        category: record.category,
        subcategory: record.subcategory,
        displayName: record.displayName,
        unitPriceBits: record.unitPriceBits,
        maxOwned: record.maxOwned,
        owned,
        visibility: vis === SHOP_VISIBILITY.NEW ? "NEW" : "SEEN",
        purchaseDomain: record.purchaseDomain,
        productItemId: record.productItemId ?? null
      });
    }
    return deepFreeze({
      bits: wallet,
      bitsCap: BITS_WALLET_CAP,
      bitsEvidence: STARTING_BITS_EVIDENCE,
      listings
    });
  }

  return Object.freeze({
    authority: SHOP_RUNTIME_AUTHORITY,

    getBits() {
      return wallet;
    },

    getFrame,

    /** Original 1→2 scan: every NEW row becomes seen. */
    markNewSeen() {
      for (let index = 0; index < SHOP_RECORD_COUNT; index += 1) {
        if (visibility[index] === SHOP_VISIBILITY.NEW) visibility[index] = SHOP_VISIBILITY.SEEN;
      }
      return publish();
    },

    /**
     * Buy `quantity` of one catalog row.
     *
     * Fails with no mutation when the row is hidden, funds are short, or the
     * original maxOwned would be exceeded. Quantity must be >= 1.
     */
    buy(shopRecordIndex, quantity = 1) {
      let record;
      try {
        record = getShopRecord(shopRecordIndex);
      } catch {
        return deepFreeze({ ok: false, reason: "UNAVAILABLE" });
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return deepFreeze({ ok: false, reason: "INVALID_QUANTITY" });
      }
      if (visibility[shopRecordIndex] === SHOP_VISIBILITY.HIDDEN) {
        return deepFreeze({ ok: false, reason: "UNAVAILABLE" });
      }
      const owned = ownedOf(record);
      if (owned + quantity > record.maxOwned) {
        return deepFreeze({ ok: false, reason: "MAX_OWNED" });
      }
      const cost = record.unitPriceBits * quantity;
      if (cost > wallet) {
        return deepFreeze({ ok: false, reason: "INSUFFICIENT_FUNDS" });
      }
      if (record.productItemId && huntInventory) {
        const huntItemMax = huntInventory.getQuantity(record.productItemId) + quantity;
        const catalogItem = record; // shop maxOwned is the purchase cap
        if (huntItemMax > catalogItem.maxOwned) {
          return deepFreeze({ ok: false, reason: "MAX_OWNED" });
        }
      }

      wallet -= cost;
      if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
        cageOwned.add(shopRecordIndex);
      } else {
        quantities[shopRecordIndex] += quantity;
      }
      if (record.productItemId && huntInventory) {
        huntInventory.grant(record.productItemId, quantity);
      }
      publish();
      return deepFreeze({
        ok: true,
        reason: "PURCHASED",
        shopRecordIndex,
        quantity,
        cost,
        bits: wallet,
        owned: ownedOf(record)
      });
    },

    // The native tool controller calls this only when its placement/fire branch
    // consumes a unit. Preview, selection, cancellation and rejected use do not.
    consumeRaisingFood(protein = false) {
      if(typeof protein!=="boolean")return deepFreeze({ok:false,reason:"INVALID_FOOD_KIND"});
      const shopRecordIndex=protein?1:0,before=quantities[shopRecordIndex];
      if(before<1)return deepFreeze({ok:false,reason:"EMPTY"});
      quantities[shopRecordIndex]=before-1;publish();
      return deepFreeze({ok:true,shopRecordIndex,owned:before-1});
    },

    consumeRaisingMedicine(kind) {
      if(kind!==0&&kind!==1)return deepFreeze({ok:false,reason:'INVALID_MEDICINE_KIND'});
      const shopRecordIndex=kind===0?3:2,before=quantities[shopRecordIndex];
      if(before<1)return deepFreeze({ok:false,reason:'EMPTY'});
      quantities[shopRecordIndex]=before-1;publish();
      return deepFreeze({ok:true,shopRecordIndex,owned:before-1});
    },

    consumeHuntItem(itemId, quantity = 1) {
      const record = listShopRecords().find(row => row.productItemId === itemId);
      if (!record || record.category !== "HUNT_ITEMS" || record.maxOwned !== 99) {
        return deepFreeze({ ok:false, reason:"NOT_HUNT_CONSUMABLE" });
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1) return deepFreeze({ ok:false, reason:"INVALID_QUANTITY" });
      const before = quantities[record.shopRecordIndex];
      if (before < quantity) return deepFreeze({ ok:false, reason:"EMPTY" });
      const after = before - quantity;
      huntInventory?.setQuantityFromShop(record.productItemId, after);
      quantities[record.shopRecordIndex] = after;
      publish();
      return deepFreeze({ ok:true, itemId, shopRecordIndex:record.shopRecordIndex, quantity, owned:after });
    },

    /**
     * Live rank / badge context. Original rank is written after battle result
     * (PlayerData +0xAE8). This updates the same unlock scan the shop already runs.
     */
    setProgression(next = {}) {
      progressionState = {
        tamerRank: Number.isSafeInteger(next.tamerRank) ? next.tamerRank : progressionState.tamerRank,
        battleBadges: Array.isArray(next.battleBadges) ? [...next.battleBadges] : progressionState.battleBadges
      };
      revealUnlocked();
      return publish();
    },

    /** Commit an app-coordinated transaction through the existing wallet. */
    applyBitsTransaction({ expectedBits, bits }) {
      if (!Number.isSafeInteger(bits) || bits < 0 || bits > BITS_WALLET_CAP) {
        throw shopError("INVALID_BITS");
      }
      if (wallet !== expectedBits) return deepFreeze({ ok: false, reason: "WALLET_CHANGED", bits: wallet });
      wallet = bits;
      publish();
      return deepFreeze({ ok: true, bits: wallet });
    },

    /** Explicit test / other income seam; battle income uses app transactions. */
    receiveNativeGift(shopRecordIndex,quantity){
      // ARM9 0208C618: inventory writer uses the existing item table and cap.
      const record=getShopRecord(shopRecordIndex);
      if(!Number.isSafeInteger(quantity)||quantity<0||quantity>65535)throw shopError('INVALID_GIFT_QUANTITY');
      if(record.purchaseDomain===SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP)throw shopError('GIFT_IS_NOT_INVENTORY');
      const previous=quantities[shopRecordIndex];
      quantities[shopRecordIndex]=Math.min(record.maxOwned,(previous+quantity)&65535);
      if(record.productItemId&&huntInventory)huntInventory.setQuantityFromShop(record.productItemId,quantities[shopRecordIndex]);
      publish();return quantities[shopRecordIndex]-previous;
    },

    /** Explicit test / other income seam; battle income uses app transactions. */
    creditBits(amount, { evidence = "PRODUCT_AUTHORED" } = {}) {
      if (!Number.isSafeInteger(amount) || amount < 0) throw shopError("INVALID_BITS");
      wallet = Math.min(BITS_WALLET_CAP, wallet + amount);
      publish();
      return deepFreeze({ bits: wallet, evidence });
    },

    toSave() {
      return deepFreeze({
        bits: wallet,
        visibility: [...visibility],
        quantities: [...quantities],
        cageOwned: [...cageOwned].sort((a, b) => a - b)
      });
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A shop observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}

/**
 * Copy Shop-owned mapped Hunt SKUs into an empty Hunt inventory.
 *
 * New Game still seeds Hunt from `HUNT_STARTING_INVENTORY` so capacity tests
 * can pass an empty bag. Continue restores from this snapshot instead, so a
 * purchase survives reload without a second inventory save key.
 */
export function applyMappedHuntInventoryFromShop(shop, huntInventory) {
  if (!shop || !huntInventory) return;
  const snapshot = shop.toSave();
  for (const record of listShopRecords()) {
    if (!record.productItemId) continue;
    const qty = snapshot.quantities[record.shopRecordIndex];
    huntInventory.setQuantityFromShop(record.productItemId, qty);
  }
}

export { listShopRecords, getShopRecord };
