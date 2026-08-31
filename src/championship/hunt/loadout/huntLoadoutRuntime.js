// VS2-R2 -- the Hunt Loadout runtime.
//
// Five equipment class assignments and four plugin positions, over a Shop-owned
// inventory. This is the domain the original had; the companion selection it
// replaces was a prototype.
//
// WHAT IT DOES NOT DO, ON PURPOSE
// -------------------------------
// It applies no per-item effect. Durability, power and length are carried as
// declared values and consumed by nothing, because the research register's own
// verdict on this system is that "all equipment semantics" are unknown. It
// enforces no carry limit, because none is traced. It requires nothing to be
// equipped before a Hunt, because no confirmation rule is traced and inventing a
// requirement is as much an invention as inventing an effect.
//
// The one thing it does derive is the HUD capability set - and that is derived
// rather than designed, because the mapping from plugin to Hunt HUD readout is
// ROM_VERIFIED on both sides.

import { deepFreeze } from "../../contracts/championshipContracts.js";
import { getHuntCatalogItem, listHuntEquipmentByClass, listHuntPluginsByKind } from "./huntEquipmentCatalog.js";
import { CAPTURE_CAPACITY_SCOPE, maxGFromInventory } from "../capture/memoryCardCapacity.js";
import {
  HUNT_ANALYZER_FIELD_ORDER,
  HUNT_COUNTED_CLASSES,
  HUNT_EQUIPMENT_CLASS_ORDER,
  HUNT_EQUIPMENT_CLASS_RULES,
  HUNT_PLUGIN_KINDS,
  HUNT_PLUGIN_POSITION_COUNT,
  HUNT_PLUGIN_POSITION_MODEL,
  HUNT_RADAR_MARKER_CAPACITY
} from "./huntLoadoutContract.js";

export const HUNT_LOADOUT_CONFIRMATION_RULE = "NO_REQUIREMENT";
export const HUNT_LOADOUT_CONFIRMATION_RULE_EVIDENCE = "PRODUCT_AUTHORED";

function loadoutError(message) {
  const error = new Error(message);
  error.name = "ChampionshipHuntLoadoutError";
  return error;
}

/**
 * Derive what the Hunt HUD can display from the fitted plugins.
 *
 * Every branch here is ROM_VERIFIED correspondence: the six Analyzer fields are
 * the six HUD creature readouts, the Checkers are the four item counters, the
 * Radar drives the map markers and the Memory Checker drives the capacity pair.
 * A HUD field with no plugin behind it stays dark - that is the original rule.
 */
function deriveHudCapabilities(fittedPlugins, inventory) {
  const analyzerFields = new Set();
  const itemCounters = new Set();
  const radarFilters = new Set();
  let radar = false;
  let memoryReadout = false;

  for (const item of fittedPlugins) {
    if (!item) continue;
    const capability = item.capability ?? {};
    for (const field of capability.analyzerFields ?? []) analyzerFields.add(field);
    for (const target of capability.checkerTargets ?? []) itemCounters.add(target);
    if (capability.radar) {
      radar = true;
      if (capability.filterDimension) radarFilters.add(capability.filterDimension);
    }
    if (capability.memoryReadout) memoryReadout = true;
  }

  return deepFreeze({
    evidence: "ROM_VERIFIED",
    // Ordered by the recovered field order so the HUD is stable, not set-ordered.
    analyzerFields: HUNT_ANALYZER_FIELD_ORDER.filter((field) => analyzerFields.has(field)),
    itemCounters: HUNT_COUNTED_CLASSES.filter((target) => itemCounters.has(target)),
    radar,
    radarFilters: [...radarFilters].sort(),
    radarMarkerCapacity: radar ? HUNT_RADAR_MARKER_CAPACITY : 0,
    memoryReadout,
    // Max G is owned-card identity (32/64/96). The plugin only decides whether
    // the HUD shows the pair. Spending is a later compare, not a HUD action.
    captureCapacityG: maxGFromInventory(inventory),
    captureCapacityScope: CAPTURE_CAPACITY_SCOPE,
    note: "A HUD readout with no plugin behind it is not displayed. That gating is the recovered original behaviour, not a product choice."
  });
}

/**
 * Create the loadout for one expedition.
 *
 * Selections are session state. No save field was added, because no original
 * loadout persistence is traced and the standalone envelope is deny-by-default.
 */
export function createHuntLoadout({ inventory, memoryCardId = null } = {}) {
  if (!inventory || typeof inventory.getQuantity !== "function" || typeof inventory.availabilityOf !== "function") {
    throw loadoutError("HUNT_LOADOUT_REQUIRES_INVENTORY");
  }

  // One selection per recovered equipment class; null means the class is empty.
  const equipment = new Map(HUNT_EQUIPMENT_CLASS_ORDER.map((className) => [className, null]));
  const pluginPositions = new Array(HUNT_PLUGIN_POSITION_COUNT).fill(null);
  let memoryCard = memoryCardId === null ? null : getHuntCatalogItem(memoryCardId);
  const listeners = new Set();

  function publish() {
    for (const listener of [...listeners]) {
      try { listener(); } catch { /* observers never break the loadout */ }
    }
  }

  function ownedEquipmentFor(className) {
    return listHuntEquipmentByClass(className)
      .map((item) => ({ item, quantity: inventory.getQuantity(item.itemId) }))
      .filter((entry) => entry.quantity > 0);
  }

  function ownedPlugins() {
    return Object.values(HUNT_PLUGIN_KINDS)
      .flatMap((kind) => listHuntPluginsByKind(kind))
      .filter((item) => inventory.owns(item.itemId));
  }

  function fittedPluginItems() {
    return pluginPositions.map((itemId) => (itemId === null ? null : getHuntCatalogItem(itemId)));
  }

  return Object.freeze({
    positionModel: HUNT_PLUGIN_POSITION_MODEL,

    // -----------------------------------------------------------------------
    // Reads
    // -----------------------------------------------------------------------

    /** Everything the player owns, grouped by the five recovered classes. */
    listAvailableEquipment() {
      return HUNT_EQUIPMENT_CLASS_ORDER.map((className) => {
        const rules = HUNT_EQUIPMENT_CLASS_RULES[className];
        return {
          equipmentClass: className,
          countable: rules.countable,
          maxOwned: rules.maxOwned,
          statLabel: rules.statLabel,
          items: ownedEquipmentFor(className).map(({ item, quantity }) => ({
            itemId: item.itemId,
            displayName: item.displayName,
            tier: item.tier,
            quantity,
            statLabel: item.statLabel,
            statValue: item.statValue,
            statEffect: item.statEffect,
            durability: item.durability,
            selected: equipment.get(className) === item.itemId
          }))
        };
      });
    },

    listAvailablePlugins() {
      return ownedPlugins().map((item) => ({
        itemId: item.itemId,
        pluginKind: item.pluginKind,
        displayName: item.displayName,
        capability: item.capability,
        fittedAt: pluginPositions.indexOf(item.itemId)
      }));
    },

    getSelectedEquipment() {
      return HUNT_EQUIPMENT_CLASS_ORDER.map((className) => {
        const itemId = equipment.get(className);
        const item = itemId === null ? null : getHuntCatalogItem(itemId);
        return {
          equipmentClass: className,
          itemId,
          displayName: item?.displayName ?? null,
          // Quantity is the owned count. No per-Hunt carry limit is applied,
          // because none is traced.
          quantity: itemId === null ? 0 : inventory.getQuantity(itemId),
          quantityIsCarryLimit: false,
          durability: item?.durability ?? null,
          durabilityConsumption: "UNKNOWN_REQUIRES_TRACE"
        };
      });
    },

    getSelectedPlugins() {
      return pluginPositions.map((itemId, position) => {
        const item = itemId === null ? null : getHuntCatalogItem(itemId);
        return {
          position,
          itemId,
          pluginKind: item?.pluginKind ?? null,
          displayName: item?.displayName ?? null,
          capability: item?.capability ?? null
        };
      });
    },

    getMemoryCard() {
      return memoryCard === null ? null : deepFreeze({
        itemId: memoryCard.itemId,
        displayName: memoryCard.displayName,
        capacityG: memoryCard.capacityG,
        scope: CAPTURE_CAPACITY_SCOPE
      });
    },

    getHudCapabilities() {
      return deriveHudCapabilities(fittedPluginItems(), inventory);
    },

    /**
     * Why a selection is or is not legal.
     *
     * Reports state; it does not gate entry. The only hard rules are the ones the
     * ROM proves: a class holds one item of its own class, a position holds one
     * plugin, and nothing unowned can be selected.
     */
    validate() {
      const problems = [];
      for (const [className, itemId] of equipment) {
        if (itemId === null) continue;
        if (inventory.getQuantity(itemId) <= 0) problems.push({ code: "NOT_OWNED", equipmentClass: className, itemId });
      }
      const fitted = pluginPositions.filter((itemId) => itemId !== null);
      for (const itemId of fitted) {
        if (!inventory.owns(itemId)) problems.push({ code: "NOT_OWNED", itemId });
      }
      if (new Set(fitted).size !== fitted.length) problems.push({ code: "DUPLICATE_PLUGIN" });

      return deepFreeze({
        valid: problems.length === 0,
        problems,
        equippedClassCount: [...equipment.values()].filter((itemId) => itemId !== null).length,
        fittedPluginCount: fitted.length,
        emptyAllowed: true,
        emptyAllowedEvidence: "PRODUCT_AUTHORED",
        note: "An empty loadout is permitted. No original rule requires anything to be equipped, and requiring something would invent one."
      });
    },

    getConfirmationState() {
      const validation = this.validate();
      return deepFreeze({
        canConfirm: validation.valid,
        rule: HUNT_LOADOUT_CONFIRMATION_RULE,
        ruleEvidence: HUNT_LOADOUT_CONFIRMATION_RULE_EVIDENCE,
        originalConfirmationFlow: "UNKNOWN_REQUIRES_TRACE",
        note: "No confirm or cancel node exists in any of the eleven original loadout scenes. Entry is gated only on the selection being internally consistent."
      });
    },

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /** Fill or clear one equipment class. */
    selectEquipment(equipmentClass, itemId) {
      if (!equipment.has(equipmentClass)) throw loadoutError(`UNKNOWN_EQUIPMENT_CLASS: ${equipmentClass}`);
      if (itemId === null) {
        equipment.set(equipmentClass, null);
        publish();
        return null;
      }
      const item = getHuntCatalogItem(itemId);
      if (!item || item.kind !== "EQUIPMENT") throw loadoutError(`UNKNOWN_HUNT_EQUIPMENT: ${itemId}`);
      if (item.equipmentClass !== equipmentClass) {
        throw loadoutError(`EQUIPMENT_CLASS_MISMATCH: ${itemId} is ${item.equipmentClass}, not ${equipmentClass}`);
      }
      if (inventory.getQuantity(itemId) <= 0) throw loadoutError(`HUNT_EQUIPMENT_NOT_OWNED: ${itemId}`);
      equipment.set(equipmentClass, itemId);
      publish();
      return itemId;
    },

    /** Fit or clear one plugin position. A plugin may occupy only one position. */
    fitPlugin(position, itemId) {
      if (!Number.isInteger(position) || position < 0 || position >= HUNT_PLUGIN_POSITION_COUNT) {
        throw loadoutError(`UNKNOWN_PLUGIN_POSITION: ${position}`);
      }
      if (itemId === null) {
        pluginPositions[position] = null;
        publish();
        return null;
      }
      const item = getHuntCatalogItem(itemId);
      if (!item || item.kind !== "PLUGIN") throw loadoutError(`UNKNOWN_HUNT_PLUGIN: ${itemId}`);
      if (!inventory.owns(itemId)) throw loadoutError(`HUNT_PLUGIN_NOT_OWNED: ${itemId}`);
      // Plugins cap at one owned, so the same plugin cannot fill two positions.
      const existing = pluginPositions.indexOf(itemId);
      if (existing !== -1 && existing !== position) pluginPositions[existing] = null;
      pluginPositions[position] = itemId;
      publish();
      return itemId;
    },

    selectMemoryCard(itemId) {
      if (itemId === null) {
        memoryCard = null;
        publish();
        return null;
      }
      const item = getHuntCatalogItem(itemId);
      if (!item || item.kind !== "MEMORY_CARD") throw loadoutError(`UNKNOWN_HUNT_MEMORY_CARD: ${itemId}`);
      if (!inventory.owns(itemId)) throw loadoutError(`HUNT_MEMORY_CARD_NOT_OWNED: ${itemId}`);
      memoryCard = item;
      publish();
      return itemId;
    },

    clear() {
      for (const className of HUNT_EQUIPMENT_CLASS_ORDER) equipment.set(className, null);
      pluginPositions.fill(null);
      publish();
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A loadout observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * What the Hunt runtime receives.
     *
     * Deliberately small: the tools carried, the HUD capabilities they unlock,
     * and the capacity number. No effect, no limit, no consumption.
     */
    toHuntHandoff() {
      return deepFreeze({
        contract: "VS2_HUNT_LOADOUT_RUNTIME_CONTRACT/v1.1",
        equipment: HUNT_EQUIPMENT_CLASS_ORDER.map((className) => {
          const itemId = equipment.get(className);
          const item = itemId === null ? null : getHuntCatalogItem(itemId);
          return {
            equipmentClass: className,
            itemId,
            quantity: itemId === null ? 0 : inventory.getQuantity(itemId),
            durability: item?.durability ?? null
          };
        }),
        hudCapabilities: deriveHudCapabilities(fittedPluginItems(), inventory),
        appliedEffects: "NONE",
        appliedEffectsReason: "Per-item runtime effect is UNKNOWN_REQUIRES_TRACE. The Hunt runtime receives what is carried, not what it does."
      });
    }
  });
}
