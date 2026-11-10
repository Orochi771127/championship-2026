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
import {
  HUNT_TOOL_FAMILIES,
  HUNT_TOOL_STOCK_CAP,
  ROPE_EMERGENCY_COUNT,
  ROPE_TIER_GRANT,
  ROPE_WEAR_FULL,
  getHuntToolFamily,
  huntToolFamilyOfRecord,
  huntToolMaxOwned,
  huntToolTierCount,
  migrateHuntToolQuantities,
  ropeEmergencyBits
} from "./huntToolTiers.js";

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
  allItemsVisible = false,
  allowRepeatedCages = false,
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
  const cageQuantities = {};
  const maxOwnedOf=record=>allowRepeatedCages&&record.purchaseDomain===SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP?100:huntToolMaxOwned(record);
  // Hunt tool families (HUNT_TOOL_TIERS_20261103): the tier each family reached
  // and how worn its current rope is. Filled from the save or migrated below.
  let toolTiers = {};
  const ropeWear = {};

  if (snapshot) {
    wallet = Math.min(BITS_WALLET_CAP, Math.max(0, snapshot.bits | 0));
    for (let index = 0; index < SHOP_RECORD_COUNT; index += 1) {
      visibility[index] = snapshot.visibility?.[index] ?? initialVisibility(records[index]);
      quantities[index] = snapshot.quantities?.[index] ?? 0;
    }
    for (const recordIndex of snapshot.cageOwned ?? []) {
      cageOwned.add(recordIndex);
      const count=snapshot.cageQuantities?.[recordIndex]??1;
      if(!Number.isSafeInteger(count)||count<1||count>100)throw shopError("INVALID_CAGE_STOCK");
      cageQuantities[recordIndex]=count;
    }
  } else {
    for (const record of records) {
      visibility[record.shopRecordIndex] = initialVisibility(record);
      if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
        if (record.initialOwned > 0) {cageOwned.add(record.shopRecordIndex);cageQuantities[record.shopRecordIndex]=record.initialOwned;}
      } else {
        quantities[record.shopRecordIndex] = initialHuntInventory && record.productItemId
          ? initialHuntInventory.getQuantity(record.productItemId) : record.initialOwned;
      }
    }
  }

  if (snapshot?.toolTiers) {
    toolTiers = { ...snapshot.toolTiers };
    Object.assign(ropeWear, snapshot.ropeWear ?? {});
  } else {
    // One-time migration: tiers from the rows held, every family's stock on its top row.
    // The Hunt inventory follows the rows the migration moved.
    const before = [...quantities];
    toolTiers = migrateHuntToolQuantities(quantities);
    if (huntInventory) {
      for (const family of HUNT_TOOL_FAMILIES) for (const index of family.records) {
        const itemId = records[index].productItemId;
        if (itemId && quantities[index] !== before[index]) huntInventory.setQuantityFromShop(itemId, quantities[index]);
      }
    }
  }
  const tierOf = family => toolTiers[family.familyId] ?? -1;
  const unlockedRow = index => allItemsVisible || visibility[index] !== SHOP_VISIBILITY.HIDDEN;
  // Owner 2026-11-10: a locked row is shown with what opens it (rank or badge); it still cannot be bought.
  const unlockOf = index => unlockedRow(index) ? null
    : { kind: records[index].unlockKind, parameter: records[index].unlockParameter };

  function ownedOf(record) {
    if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
      return cageOwned.has(record.shopRecordIndex) ? cageQuantities[record.shopRecordIndex]??1 : 0;
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

  /** What the next tier of a family costs and whether it is open yet. */
  function nextTierOf(family) {
    // A gear family starts by buying α units; its only upgrade is the β model.
    const tier = tierOf(family), next = family.kind === "GEAR" ? Math.max(tier, 0) + 1 : tier + 1;
    if (next >= huntToolTierCount(family)) return null;
    if (family.kind === "MEMORY") {
      const row = family.records[next];
      return { tier: next, bits: family.priceBits[next], diamonds: family.priceDiamonds[next],
        capacityG: family.capacityG[next], unlocked: row === undefined ? tier >= family.records.length - 1 : unlockedRow(row),
        unlock: row === undefined ? null : unlockOf(row), shopRecordIndex: row ?? null };
    }
    const row = family.records[next];
    return { tier: next, bits: family.kind === "GEAR" && next > 0 ? family.upgradeBits : records[row].unitPriceBits,
      diamonds: null, unlocked: unlockedRow(row), unlock: unlockOf(row), shopRecordIndex: row };
  }

  function familyView(family) {
    const tier = tierOf(family);
    const row = family.records[Math.min(Math.max(tier, 0), family.records.length - 1)];
    const owned = family.kind === "MEMORY" ? (tier >= 0 ? 1 : 0) : quantities[row];
    const view = { familyId: family.familyId, kind: family.kind, tier, tierCount: huntToolTierCount(family),
      shopRecordIndex: row, productItemId: records[row].productItemId ?? null, owned,
      maxOwned: family.kind === "MEMORY" ? 1 : HUNT_TOOL_STOCK_CAP,
      visible: tier >= 0 || unlockedRow(family.records[0]), next: nextTierOf(family) };
    view.unlock = view.visible ? null : unlockOf(family.records[0]);
    if (family.kind === "ROPE") {
      view.refillBits = family.refillBits[Math.max(0, tier)];
      view.wear = (ropeWear[family.familyId] ?? ROPE_WEAR_FULL) / ROPE_WEAR_FULL;
      view.emergencyBits = ropeEmergencyBits(family, tier);
    } else if (family.kind === "GEAR") view.refillBits = records[row].unitPriceBits;
    else view.capacityG = tier >= 0 ? family.capacityG[tier] : 0;
    return view;
  }

  function getFrame() {
    const listings = [], lockedListings = [];
    for (const record of records) {
      const vis = visibility[record.shopRecordIndex];
      if (!allItemsVisible && vis === SHOP_VISIBILITY.HIDDEN) {
        lockedListings.push({
          shopRecordIndex: record.shopRecordIndex, category: record.category, subcategory: record.subcategory,
          displayName: record.displayName, unitPriceBits: record.unitPriceBits, maxOwned: maxOwnedOf(record),
          owned: 0, purchaseDomain: record.purchaseDomain, productItemId: record.productItemId ?? null,
          unlock: unlockOf(record.shopRecordIndex),
          ...(huntToolFamilyOfRecord(record.shopRecordIndex) ? { familyId: huntToolFamilyOfRecord(record.shopRecordIndex).family.familyId } : {})
        });
        continue;
      }
      const owned = ownedOf(record);
      listings.push({
        shopRecordIndex: record.shopRecordIndex,
        category: record.category,
        subcategory: record.subcategory,
        displayName: record.displayName,
        unitPriceBits: record.unitPriceBits,
        maxOwned: maxOwnedOf(record),
        owned,
        visibility: vis === SHOP_VISIBILITY.NEW ? "NEW" : "SEEN",
        purchaseDomain: record.purchaseDomain,
        productItemId: record.productItemId ?? null,
        ...(huntToolFamilyOfRecord(record.shopRecordIndex) ? { familyId: huntToolFamilyOfRecord(record.shopRecordIndex).family.familyId } : {})
      });
    }
    return deepFreeze({
      bits: wallet,
      bitsCap: BITS_WALLET_CAP,
      bitsEvidence: STARTING_BITS_EVIDENCE,
      listings,
      lockedListings,
      huntFamilies: HUNT_TOOL_FAMILIES.map(familyView)
    });
  }

  function refused(reason, extra = {}) { return deepFreeze({ ok: false, reason, ...extra }); }
  /** Move a family's whole stock onto one row (the other rows are emptied). */
  function placeStock(family, tier, stock) {
    family.records.forEach((index, rowTier) => {
      const value = rowTier === tier ? Math.min(HUNT_TOOL_STOCK_CAP, stock) : 0;
      quantities[index] = family.kind === "MEMORY" ? (rowTier === Math.min(tier, family.records.length - 1) ? 1 : 0) : value;
      const itemId = records[index].productItemId;
      if (itemId && huntInventory) huntInventory.setQuantityFromShop(itemId, quantities[index]);
    });
  }
  function stockOf(family) {
    const tier = tierOf(family);
    return tier < 0 ? 0 : quantities[family.records[Math.min(tier, family.records.length - 1)]];
  }

  /**
   * Raise a family one tier. Ropes pay the tier row's own price and get ten
   * new ropes; gear pays the model fee; every unit held moves up 1:1. The
   * memory card's sizes past 96 G may be paid in test diamonds, which the app
   * debits (`currency: "DIAMONDS"` charges no bits here).
   */
  function upgradeFamily(familyId, { currency = "BITS" } = {}) {
    const family = getHuntToolFamily(familyId);
    if (!family) return refused("UNAVAILABLE");
    const next = nextTierOf(family);
    if (!next) return refused("MAX_TIER", { familyId });
    if (!next.unlocked) return refused("TIER_LOCKED", { familyId, tier: next.tier, shopRecordIndex: next.shopRecordIndex });
    if (currency === "DIAMONDS" && !Number.isSafeInteger(next.diamonds)) return refused("UNAVAILABLE", { familyId });
    const cost = currency === "DIAMONDS" ? 0 : next.bits;
    if (cost > wallet) return refused("INSUFFICIENT_FUNDS", { familyId, cost });
    const stock = stockOf(family) + (family.kind === "ROPE" ? ROPE_TIER_GRANT : 0);
    wallet -= cost;
    toolTiers = { ...toolTiers, [familyId]: next.tier };
    placeStock(family, next.tier, family.kind === "MEMORY" ? 1 : stock);
    // A new tier is a new rope.
    if (family.kind === "ROPE") delete ropeWear[familyId];
    publish();
    return deepFreeze({ ok: true, reason: "UPGRADED", familyId, tier: next.tier, cost, currency,
      diamonds: currency === "DIAMONDS" ? next.diamonds : 0, bits: wallet, owned: stockOf(family),
      shopRecordIndex: family.records[Math.min(next.tier, family.records.length - 1)] });
  }

  /** Buy more units of a family's current tier (α for gear never bought). */
  function refillFamily(familyId, quantity = 1, { unitBits = null, kind = "REFILLED" } = {}) {
    const family = getHuntToolFamily(familyId);
    if (!family || family.kind === "MEMORY") return refused("UNAVAILABLE");
    if (!Number.isSafeInteger(quantity) || quantity < 1) return refused("INVALID_QUANTITY");
    let tier = tierOf(family);
    if (tier < 0) {
      // A rope colour is bought as a tier first; gear starts with α units.
      if (family.kind === "ROPE") return refused("TIER_LOCKED", { familyId, tier: 0 });
      if (!unlockedRow(family.records[0])) return refused("UNAVAILABLE", { familyId });
      tier = 0;
    }
    const stock = stockOf(family);
    if (stock + quantity > HUNT_TOOL_STOCK_CAP) return refused("MAX_OWNED", { familyId });
    const price = unitBits ?? (family.kind === "ROPE" ? family.refillBits[tier] : records[family.records[tier]].unitPriceBits);
    const cost = Math.ceil(price * quantity);
    if (cost > wallet) return refused("INSUFFICIENT_FUNDS", { familyId, cost });
    wallet -= cost;
    if (tierOf(family) !== tier) {
      toolTiers = { ...toolTiers, [familyId]: tier };
      placeStock(family, tier, stock + quantity);
    } else {
      // Same row: add to it, and grant the Hunt inventory the units bought, as a plain buy does.
      const index = family.records[tier];
      quantities[index] = stock + quantity;
      if (records[index].productItemId && huntInventory) huntInventory.grant(records[index].productItemId, quantity);
    }
    publish();
    return deepFreeze({ ok: true, reason: kind, familyId, tier, quantity, cost, bits: wallet, owned: stockOf(family),
      shopRecordIndex: family.records[tier] });
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
      if (!allItemsVisible && visibility[shopRecordIndex] === SHOP_VISIBILITY.HIDDEN) {
        return deepFreeze({ ok: false, reason: "UNAVAILABLE" });
      }
      // A row inside a hunt tool family buys through its family: the current
      // tier refills, the next tier upgrades, any other tier is refused.
      const member = huntToolFamilyOfRecord(shopRecordIndex);
      if (member) {
        const { family, tier: rowTier } = member, tier = tierOf(family), next = nextTierOf(family);
        if (family.kind !== "MEMORY" && (rowTier === tier || (tier < 0 && rowTier === 0 && family.kind === "GEAR"))) {
          const receipt = refillFamily(family.familyId, quantity);
          return receipt.ok ? deepFreeze({ ...receipt, reason: "PURCHASED" }) : receipt;
        }
        if (quantity === 1 && next?.tier === rowTier) {
          const receipt = upgradeFamily(family.familyId);
          return receipt.ok ? deepFreeze({ ...receipt, reason: "PURCHASED", quantity: 1 }) : receipt;
        }
        return refused(rowTier <= tier ? "MAX_OWNED" : "TIER_LOCKED", { familyId: family.familyId });
      }
      const owned = ownedOf(record);
      if (owned + quantity > maxOwnedOf(record)) {
        return deepFreeze({ ok: false, reason: "MAX_OWNED" });
      }
      const cost = record.unitPriceBits * quantity;
      if (cost > wallet) {
        return deepFreeze({ ok: false, reason: "INSUFFICIENT_FUNDS" });
      }
      if (record.productItemId && huntInventory) {
        const huntItemMax = huntInventory.getQuantity(record.productItemId) + quantity;
        // shop maxOwned is the purchase cap
        if (huntItemMax > maxOwnedOf(record)) {
          return deepFreeze({ ok: false, reason: "MAX_OWNED" });
        }
      }

      wallet -= cost;
      if (record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP) {
        cageOwned.add(shopRecordIndex);
        cageQuantities[shopRecordIndex]=owned+quantity;
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
      if (!record || record.category !== "HUNT_ITEMS" || maxOwnedOf(record) !== 99) {
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

    upgradeHuntFamily: upgradeFamily,
    refillHuntFamily(familyId, quantity = 1) { return refillFamily(familyId, quantity); },

    /**
     * Ropes ran out on the field: five ropes of this colour's current tier at
     * one and a half times the refill price, so a hunt never dead-ends.
     */
    buyEmergencyRopes(familyId) {
      const family = getHuntToolFamily(familyId);
      if (family?.kind !== "ROPE") return refused("UNAVAILABLE");
      // A colour never bought is bought at α here; a refused bundle leaves the tiers as they were.
      const tiersBefore = toolTiers;
      if (tierOf(family) < 0) toolTiers = { ...toolTiers, [familyId]: 0 };
      const receipt = refillFamily(familyId, ROPE_EMERGENCY_COUNT,
        { unitBits: ropeEmergencyBits(family, tierOf(family)) / ROPE_EMERGENCY_COUNT, kind: "EMERGENCY" });
      if (!receipt.ok) toolTiers = tiersBefore;
      return receipt;
    },

    /** How much of the current rope of this rope's family is left, 0..1 (a fresh rope is 1). */
    getRopeWear(itemId) {
      const member = huntToolFamilyOfRecord(records.find(row => row.productItemId === itemId)?.shopRecordIndex);
      return member?.family.kind === "ROPE" ? (ropeWear[member.family.familyId] ?? ROPE_WEAR_FULL) / ROPE_WEAR_FULL : 1;
    },
    setRopeWear(itemId, fraction) {
      const member = huntToolFamilyOfRecord(records.find(row => row.productItemId === itemId)?.shopRecordIndex);
      if (member?.family.kind !== "ROPE" || !Number.isFinite(fraction)) return false;
      const permille = Math.round(Math.min(1, Math.max(0, fraction)) * ROPE_WEAR_FULL);
      // A rope worn to nothing has snapped; the field spends it and the next one is fresh.
      if (permille >= ROPE_WEAR_FULL || permille < 1) delete ropeWear[member.family.familyId];
      else ropeWear[member.family.familyId] = permille;
      return true;
    },

    /** The memory card's size in G (0 without a card); the three ROM cards are its first sizes. */
    memoryCardCapacityG() {
      const family = getHuntToolFamily("memory-card"), tier = tierOf(family);
      return tier < 0 ? 0 : family.capacityG[tier];
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
      // A gift of a family tool joins the family's current tier (its first gift sets the tier).
      const member=huntToolFamilyOfRecord(shopRecordIndex);
      if(member&&member.family.kind!=='MEMORY'){
        const {family}=member,tier=tierOf(family)<0?member.tier:tierOf(family),before=stockOf(family);
        toolTiers={...toolTiers,[family.familyId]:tier};
        placeStock(family,tier,Math.min(HUNT_TOOL_STOCK_CAP,before+quantity));
        publish();return stockOf(family)-before;
      }
      const previous=quantities[shopRecordIndex];
      quantities[shopRecordIndex]=Math.min(maxOwnedOf(record),(previous+quantity)&65535);
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
        cageOwned: [...cageOwned].sort((a, b) => a - b),
        ...(allowRepeatedCages||snapshot?.cageQuantities?{cageQuantities:{...cageQuantities}}:{}),
        toolTiers: { ...toolTiers },
        ...(Object.keys(ropeWear).length ? { ropeWear: { ...ropeWear } } : {})
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
