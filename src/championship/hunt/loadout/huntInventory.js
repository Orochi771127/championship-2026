// VS2-R2 -- Hunt inventory.
//
// THE LOADOUT DOES NOT OWN THE INVENTORY
// --------------------------------------
// In the original, items reach the player through the Shop, which commits to an
// InventoryState separate from cage ownership and from shop visibility. The
// loadout screen presents and selects from that inventory; it never mints one.
// This module is that boundary: it reads ownership and quantity, and the only
// mutation it offers is the one the Shop would perform.
//
// Availability is likewise a SHOP-side rule, keyed on Tamer rank and battle
// badges. It is evaluated here so the loadout can explain why something is
// absent, not so the loadout can decide it.
//
// VS4 owns the Shop. Hunt inventory is Shop-owned: New Game still accepts a
// starting bag so capacity tests can pass an empty one; Continue restores
// mapped SKUs from the Shop snapshot.

import { deepFreeze } from "../../contracts/championshipContracts.js";
import {
  HUNT_STARTING_INVENTORY,
  getHuntCatalogItem
} from "./huntEquipmentCatalog.js";
import { HUNT_UNLOCK_KINDS } from "./huntLoadoutContract.js";

export const HUNT_INVENTORY_AUTHORITY = "SHOP_OWNED_INVENTORY_STATE";

function inventoryError(message) {
  const error = new Error(message);
  error.name = "ChampionshipHuntInventoryError";
  return error;
}

/**
 * Is this item purchasable yet?
 *
 * Three unlock kinds, all Shop-side. TAMER_RANK_THRESHOLD is HIGH_CONFIDENCE
 * rather than fully verified in the source catalog, and that distinction is
 * carried through rather than flattened.
 */
export function evaluateHuntItemAvailability(item, { tamerRank = 0, battleBadges = [] } = {}) {
  const unlock = item?.unlock;
  if (!unlock) return deepFreeze({ available: false, reason: "NO_UNLOCK_RULE", evidence: "UNKNOWN_REQUIRES_TRACE" });
  if (unlock.kind === HUNT_UNLOCK_KINDS.INITIAL_AVAILABLE) {
    return deepFreeze({ available: true, reason: "INITIAL_AVAILABLE", evidence: "ROM_VERIFIED" });
  }
  if (unlock.kind === HUNT_UNLOCK_KINDS.TAMER_RANK_THRESHOLD) {
    const available = Number(tamerRank) >= unlock.parameter;
    return deepFreeze({
      available,
      reason: available ? "TAMER_RANK_MET" : "TAMER_RANK_BELOW_THRESHOLD",
      requiredRank: unlock.parameter,
      evidence: "HIGH_CONFIDENCE"
    });
  }
  if (unlock.kind === HUNT_UNLOCK_KINDS.BATTLE_BADGE_ID_0_BASED) {
    const available = battleBadges.includes(unlock.parameter);
    return deepFreeze({
      available,
      reason: available ? "BATTLE_BADGE_HELD" : "BATTLE_BADGE_MISSING",
      requiredBadgeId: unlock.parameter,
      evidence: "ROM_VERIFIED"
    });
  }
  return deepFreeze({ available: false, reason: "UNKNOWN_UNLOCK_KIND", evidence: "UNKNOWN_REQUIRES_TRACE" });
}

/**
 * Create the player's Hunt inventory.
 *
 * `progression` is read-only context the Shop would own: Tamer rank and battle
 * badges. Rank now persists on the product save; badge writes still wait on battle.
 */
export function createHuntInventory({
  entries = HUNT_STARTING_INVENTORY,
  tamerRank = 0,
  battleBadges = []
} = {}) {
  let rank = tamerRank;
  let badges = [...battleBadges];
  const owned = new Map();

  function put(itemId, quantity) {
    const item = getHuntCatalogItem(itemId);
    if (!item) throw inventoryError(`UNKNOWN_HUNT_ITEM: ${itemId}`);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw inventoryError(`INVALID_HUNT_ITEM_QUANTITY: ${itemId}`);
    }
    // The per-item cap is the original's, and it is enforced here rather than
    // trusted: a two-digit readout cannot show a third digit.
    const capped = Math.min(quantity, item.maxOwned);
    if (capped === 0) owned.delete(itemId);
    else owned.set(itemId, capped);
    return capped;
  }

  for (const entry of entries) put(entry.itemId, entry.quantity);

  return Object.freeze({
    authority: HUNT_INVENTORY_AUTHORITY,

    getQuantity(itemId) {
      return owned.get(itemId) ?? 0;
    },

    owns(itemId) {
      return (owned.get(itemId) ?? 0) > 0;
    },

    listOwned() {
      return [...owned.entries()]
        .map(([itemId, quantity]) => ({ item: getHuntCatalogItem(itemId), quantity }))
        .filter((entry) => entry.item !== null);
    },

    /** Availability for an item the player does not yet own. Shop-side rule. */
    availabilityOf(itemId) {
      const item = getHuntCatalogItem(itemId);
      if (!item) return deepFreeze({ available: false, reason: "UNKNOWN_HUNT_ITEM", evidence: "n/a" });
      return evaluateHuntItemAvailability(item, { tamerRank: rank, battleBadges: badges });
    },

    getProgressionContext() {
      return deepFreeze({ tamerRank: rank, battleBadges: [...badges] });
    },

    setProgression(next = {}) {
      if (Number.isSafeInteger(next.tamerRank)) rank = next.tamerRank;
      if (Array.isArray(next.battleBadges)) badges = [...next.battleBadges];
      return this.getProgressionContext();
    },

    /**
     * The only mutation, and it is the Shop's.
     *
     * Exposed now so the loadout reads a real inventory rather than a constant,
     * and so VS4 has the seam it needs. Nothing in VS2 calls it.
     */
    grant(itemId, quantity) {
      return put(itemId, (owned.get(itemId) ?? 0) + quantity);
    },

    // Shop is the quantity authority, including zero after field consumption.
    setQuantityFromShop(itemId, quantity) { return put(itemId, quantity); }
  });
}
