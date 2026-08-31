// VS2-R2 -- the product Hunt equipment and plugin catalogue.
//
// STRUCTURE IS RECOVERED; ITEM IDENTITIES ARE NOT
// -----------------------------------------------
// The five equipment classes, the four plugin kinds, the six Analyzer fields, the
// five Checker targets and the Radar filter dimensions are ROM_VERIFIED and are
// followed exactly. The individual ITEMS below are product-authored: the original
// item names and descriptions are ROM text and stay in the research tree, and the
// original tier counts (12 ropes, 12 shots, 6 wires...) are recorded in the
// contract rather than reproduced here.
//
// Numeric stats are product-authored too. The ROM proves that a rope HAS a
// durability, a shot HAS a power and a wire HAS a length; it does not tell us what
// any of them do, so the numbers here are labels on a scale, not simulation
// inputs. Nothing in this build consumes them.

import { deepFreeze } from "../../contracts/championshipContracts.js";
import {
  HUNT_ANALYZER_FIELD_ORDER,
  HUNT_CHECKER_TARGETS,
  HUNT_EQUIPMENT_CLASS_RULES,
  HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE,
  HUNT_UNLOCK_KINDS
} from "./huntLoadoutContract.js";

const PRODUCT = "CHAMPIONSHIP_2026_PRODUCT";

function equipment({ id, equipmentClass, tier, displayName, stat, unlock }) {
  const rules = HUNT_EQUIPMENT_CLASS_RULES[equipmentClass];
  return {
    itemId: `championship:2026:hunt-item:${id}`,
    kind: "EQUIPMENT",
    equipmentClass,
    tier,
    displayName,
    displayNameAuthority: PRODUCT,
    identityEvidence: HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE,
    maxOwned: rules.maxOwned,
    countable: rules.countable,
    // `stat` carries the class's declared value. Its effect is UNKNOWN.
    statLabel: rules.statLabel,
    statValue: stat ?? null,
    statEffect: "UNKNOWN_REQUIRES_TRACE",
    durability: rules.hasDurability ? stat : null,
    unlock
  };
}

function plugin({ id, pluginKind, displayName, capability, unlock }) {
  return {
    itemId: `championship:2026:hunt-plugin:${id}`,
    kind: "PLUGIN",
    pluginKind,
    displayName,
    displayNameAuthority: PRODUCT,
    identityEvidence: HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE,
    maxOwned: 1,
    countable: false,
    // The capability IS recovered: what each plugin kind reveals is ROM_VERIFIED.
    capability: deepFreeze(capability),
    capabilityEvidence: "ROM_VERIFIED",
    unlock
  };
}

const initial = { kind: HUNT_UNLOCK_KINDS.INITIAL_AVAILABLE, parameter: 0 };
const rank = (value) => ({ kind: HUNT_UNLOCK_KINDS.TAMER_RANK_THRESHOLD, parameter: value });
const badge = (value) => ({ kind: HUNT_UNLOCK_KINDS.BATTLE_BADGE_ID_0_BASED, parameter: value });

/** Equipment: three tiers for the three statted classes, two for the trap classes. */
const EQUIPMENT = [
  equipment({ id: "rope-i", equipmentClass: "ROPE", tier: 1, displayName: "Tether I", stat: 10, unlock: initial }),
  equipment({ id: "rope-ii", equipmentClass: "ROPE", tier: 2, displayName: "Tether II", stat: 25, unlock: rank(2) }),
  equipment({ id: "rope-iii", equipmentClass: "ROPE", tier: 3, displayName: "Tether III", stat: 50, unlock: badge(7) }),

  equipment({ id: "shot-i", equipmentClass: "SHOT", tier: 1, displayName: "Hold Shot I", stat: 10, unlock: initial }),
  equipment({ id: "shot-ii", equipmentClass: "SHOT", tier: 2, displayName: "Hold Shot II", stat: 24, unlock: rank(2) }),
  equipment({ id: "shot-iii", equipmentClass: "SHOT", tier: 3, displayName: "Hold Shot III", stat: 40, unlock: badge(17) }),

  equipment({ id: "wire-i", equipmentClass: "WIRE", tier: 1, displayName: "Line I", stat: 24, unlock: initial }),
  equipment({ id: "wire-ii", equipmentClass: "WIRE", tier: 2, displayName: "Line II", stat: 40, unlock: rank(3) }),
  equipment({ id: "wire-iii", equipmentClass: "WIRE", tier: 3, displayName: "Line III", stat: 64, unlock: badge(54) }),

  equipment({ id: "entrap-i", equipmentClass: "ENTRAP", tier: 1, displayName: "Snare I", stat: null, unlock: rank(1) }),
  equipment({ id: "entrap-ii", equipmentClass: "ENTRAP", tier: 2, displayName: "Snare II", stat: null, unlock: badge(34) }),

  equipment({ id: "damage-trap-i", equipmentClass: "DAMAGE_TRAP", tier: 1, displayName: "Charge I", stat: 40, unlock: rank(2) }),
  equipment({ id: "damage-trap-ii", equipmentClass: "DAMAGE_TRAP", tier: 2, displayName: "Charge II", stat: 50, unlock: rank(4) })
];

/** One Analyzer per recovered reveal field, plus a combined one. */
const ANALYZERS = [
  ...HUNT_ANALYZER_FIELD_ORDER.map((field, index) => plugin({
    id: `analyzer-${field.toLowerCase()}`,
    pluginKind: "ANALYZER",
    displayName: `${field.charAt(0)}${field.slice(1).toLowerCase()} Analyzer`,
    capability: { analyzerFields: [field] },
    unlock: index === 0 ? initial : rank(index)
  })),
  plugin({
    id: "analyzer-full",
    pluginKind: "ANALYZER",
    displayName: "Full Analyzer",
    capability: { analyzerFields: [...HUNT_ANALYZER_FIELD_ORDER] },
    unlock: badge(54)
  })
];

/** One Checker per recovered target, including ALL. */
const CHECKERS = HUNT_CHECKER_TARGETS.map((target, index) => plugin({
  id: `checker-${target.toLowerCase().replace(/_/g, "-")}`,
  pluginKind: "CHECKER",
  displayName: target === "ALL" ? "Full Checker" : `${target.charAt(0)}${target.slice(1).toLowerCase().replace(/_/g, " ")} Checker`,
  capability: { checkerTargets: target === "ALL" ? [...HUNT_CHECKER_TARGETS.filter((entry) => entry !== "ALL")] : [target] },
  unlock: rank(index + 1)
}));

/** Radar filters vary along the two recovered dimensions. */
const RADARS = [
  plugin({ id: "radar-generation", pluginKind: "RADAR_SEARCH", displayName: "Stage Radar", capability: { radar: true, filterDimension: "GENERATION" }, unlock: initial }),
  plugin({ id: "radar-alignment", pluginKind: "RADAR_SEARCH", displayName: "Attribute Radar", capability: { radar: true, filterDimension: "ALIGNMENT" }, unlock: rank(3) })
];

const MEMORY_CHECKERS = [
  plugin({ id: "memory-checker", pluginKind: "MEMORY_CHECKER", displayName: "Capacity Readout", capability: { memoryReadout: true }, unlock: rank(2) })
];

export const HUNT_EQUIPMENT_ITEMS = deepFreeze(EQUIPMENT);
export const HUNT_PLUGIN_ITEMS = deepFreeze([...ANALYZERS, ...CHECKERS, ...RADARS, ...MEMORY_CHECKERS]);
export const HUNT_CATALOG_ITEMS = deepFreeze([...HUNT_EQUIPMENT_ITEMS, ...HUNT_PLUGIN_ITEMS]);

/**
 * The capture-capacity carrier.
 *
 * The ROM's Memory Card subcategory sets how much can be held during a Hunt, in
 * G. Max identity 32/64/96 is VERIFIED_BINARY. Bring-home compares summed
 * G-cost against that max; per-species costs remain product unit 1.
 */
export const HUNT_MEMORY_CARDS = deepFreeze([
  { itemId: "championship:2026:hunt-memory:card-32", kind: "MEMORY_CARD", displayName: "Card 32G", capacityG: 32, maxOwned: 1, unlock: initial, identityEvidence: HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE },
  { itemId: "championship:2026:hunt-memory:card-64", kind: "MEMORY_CARD", displayName: "Card 64G", capacityG: 64, maxOwned: 1, unlock: rank(3), identityEvidence: HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE },
  { itemId: "championship:2026:hunt-memory:card-96", kind: "MEMORY_CARD", displayName: "Card 96G", capacityG: 96, maxOwned: 1, unlock: rank(5), identityEvidence: HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE }
]);

const BY_ID = new Map([...HUNT_CATALOG_ITEMS, ...HUNT_MEMORY_CARDS].map((item) => [item.itemId, item]));

export function getHuntCatalogItem(itemId) {
  return BY_ID.get(itemId) ?? null;
}

export function listHuntEquipmentByClass(equipmentClass) {
  return HUNT_EQUIPMENT_ITEMS.filter((item) => item.equipmentClass === equipmentClass);
}

export function listHuntPluginsByKind(pluginKind) {
  return HUNT_PLUGIN_ITEMS.filter((item) => item.pluginKind === pluginKind);
}

/**
 * The starting inventory shape.
 *
 * ROM_VERIFIED SHAPE: the shop table's initial_owned column starts the player with
 * one rope, twenty of the first shot, ten of the first lure, one memory card, and
 * no plugins at all. The quantities are the original's; which product item fills
 * each role is product-authored.
 *
 * The lure is deliberately absent. Lures are a real ROM subcategory, but which of
 * the five equipment classes they belong to is open trace item HL-4, and putting
 * ten of something into a class on a guess is exactly the invention this build
 * refuses. It returns when HL-4 closes.
 */
export const HUNT_STARTING_INVENTORY_EVIDENCE = "ROM_VERIFIED_SHAPE";
export const HUNT_STARTING_INVENTORY = deepFreeze([
  { itemId: "championship:2026:hunt-item:rope-i", quantity: 1 },
  { itemId: "championship:2026:hunt-item:shot-i", quantity: 20 },
  { itemId: "championship:2026:hunt-memory:card-32", quantity: 1 }
]);
