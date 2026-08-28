// VS2-R2 -- Original Hunt Loadout structural constants.
//
// Every value in this file is ROM_VERIFIED structure recovered in
// docs/contracts/championship/VS2_HUNT_LOADOUT_RUNTIME_CONTRACT.v1.json, or is
// marked otherwise at its declaration. Nothing here is a product design choice.
//
// WHAT IS PRESERVED
// -----------------
// The five equipment classes, their countability, the plugin kinds and what each
// kind reveals, the four plugin positions, the four Hunt HUD counters, and the
// three Shop-side unlock kinds.
//
// WHAT IS NOT HERE
// ----------------
// Per-item runtime effect. The research register's own verdict on this system is
// "all equipment semantics" unknown: durability exists but nothing proves what
// consumes it, power and length exist but nothing proves what they do. Those live
// nowhere in this build, because inventing them is the one thing this programme
// is designed to prevent.
//
// No original item name or description text appears in this repository. Those are
// ROM strings and stay in the research tree.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const HUNT_LOADOUT_STRUCTURE_EVIDENCE = "ROM_VERIFIED";
export const HUNT_LOADOUT_ITEM_IDENTITY_EVIDENCE = "PRODUCT_AUTHORED";

/**
 * The five equipment classes.
 *
 * Corroborated from two independent sides: the equip screen's touch regions
 * (col_rope, col_shot, col_wire, col_entrap, col_damage_trap) and the ROM's own
 * five Checker items, which are named for the classes they count.
 */
export const HUNT_EQUIPMENT_CLASSES = deepFreeze({
  ROPE: "ROPE",
  SHOT: "SHOT",
  WIRE: "WIRE",
  ENTRAP: "ENTRAP",
  DAMAGE_TRAP: "DAMAGE_TRAP"
});

export const HUNT_EQUIPMENT_CLASS_ORDER = deepFreeze(["ROPE", "SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);

/**
 * Per-class rules.
 *
 * ROPE is the odd one out in the ROM and stays the odd one out here: a single
 * equipped tether with a durability value, capped at one owned. The other four
 * cap at 99 and are the four classes the Hunt HUD counts.
 */
export const HUNT_EQUIPMENT_CLASS_RULES = deepFreeze({
  ROPE: { maxOwned: 1, countable: false, hasDurability: true, statLabel: "durability" },
  SHOT: { maxOwned: 99, countable: true, hasDurability: false, statLabel: "power" },
  WIRE: { maxOwned: 99, countable: true, hasDurability: false, statLabel: "length" },
  ENTRAP: { maxOwned: 99, countable: true, hasDurability: false, statLabel: null },
  DAMAGE_TRAP: { maxOwned: 99, countable: true, hasDurability: false, statLabel: "power" }
});

/** The four countable classes, in Hunt HUD counter order. */
export const HUNT_COUNTED_CLASSES = deepFreeze(["SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);
export const HUNT_HUD_COUNTER_COUNT = 4;

export const HUNT_PLUGIN_KINDS = deepFreeze({
  ANALYZER: "ANALYZER",
  CHECKER: "CHECKER",
  RADAR_SEARCH: "RADAR_SEARCH",
  MEMORY_CHECKER: "MEMORY_CHECKER"
});

/**
 * Four positions.
 *
 * The gear slot strip (main screen, col_slot0..3) and the plugin strip (sub
 * screen, plugin0..3) share the same x and the same 19px pitch, so they are
 * modelled as ONE set of four positions viewed on two screens. Whether the
 * original had four or eight is open trace item HL-6; if it resolves to eight,
 * this constant is the single place that changes.
 */
export const HUNT_PLUGIN_POSITION_COUNT = 4;
export const HUNT_PLUGIN_POSITION_MODEL = "ONE_SET_OF_FOUR_VIEWED_ON_TWO_SCREENS";
export const HUNT_PLUGIN_POSITION_MODEL_EVIDENCE = "PARTIAL_HL6_OPEN";

/**
 * What an Analyzer reveals.
 *
 * The six single-purpose Analyzer items in the ROM name exactly these six fields,
 * and the Hunt HUD carries exactly these six readouts. One for one.
 */
export const HUNT_ANALYZER_FIELDS = deepFreeze({
  GENERATION: "GENERATION",
  FAMILY: "FAMILY",
  ALIGNMENT: "ALIGNMENT",
  HP: "HP",
  PERSONALITY: "PERSONALITY",
  CAPACITY: "CAPACITY"
});

export const HUNT_ANALYZER_FIELD_ORDER = deepFreeze([
  "GENERATION", "FAMILY", "ALIGNMENT", "HP", "PERSONALITY", "CAPACITY"
]);

/** Hunt HUD node names, recorded so the handoff is traceable back to evidence. */
export const HUNT_ANALYZER_FIELD_HUD_NODES = deepFreeze({
  GENERATION: "gen",
  FAMILY: "type",
  ALIGNMENT: "align_text",
  HP: "hp",
  PERSONALITY: "mind",
  CAPACITY: "size"
});

/** What a Checker counts. Five ROM items: four classes plus ALL. */
export const HUNT_CHECKER_TARGETS = deepFreeze(["SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP", "ALL"]);

/** What a Radar filters by. The ROM set varies generation and alignment. */
export const HUNT_RADAR_FILTER_DIMENSIONS = deepFreeze(["GENERATION", "ALIGNMENT"]);
export const HUNT_RADAR_MARKER_CAPACITY = 24;
export const HUNT_RADAR_MARKER_CAPACITY_EVIDENCE = "PARTIAL";

/** Shop-side availability. Availability is never a Loadout-side rule. */
export const HUNT_UNLOCK_KINDS = deepFreeze({
  INITIAL_AVAILABLE: "INITIAL_AVAILABLE",
  TAMER_RANK_THRESHOLD: "TAMER_RANK_THRESHOLD",
  BATTLE_BADGE_ID_0_BASED: "BATTLE_BADGE_ID_0_BASED"
});

export const HUNT_UNLOCK_KIND_EVIDENCE = deepFreeze({
  INITIAL_AVAILABLE: "ROM_VERIFIED",
  TAMER_RANK_THRESHOLD: "HIGH_CONFIDENCE",
  BATTLE_BADGE_ID_0_BASED: "ROM_VERIFIED"
});

/**
 * Everything the original does that this build deliberately does not.
 *
 * Exposed as data rather than prose so a test can assert it stays honest.
 */
export const HUNT_LOADOUT_UNKNOWNS = deepFreeze([
  { id: "HL-1", field: "confirmationFlow", detail: "No confirm or cancel node exists in any of the eleven loadout scenes." },
  { id: "HL-2", field: "launcher", detail: "Assets exist inside the loadout family; behaviour is unknown. Not modelled." },
  { id: "HL-3", field: "releaseMenu", detail: "menu_top_release_scene semantics unknown. Not modelled." },
  { id: "HL-4", field: "classGrouping", detail: "Which Shop subcategories fall under ENTRAP and DAMAGE_TRAP, and where lures sit." },
  { id: "HL-6", field: "positionModel", detail: "Whether the gear slots and plugin positions are one set of four or two." },
  { id: "HL-7", field: "carryLimit", detail: "How many units of a consumable may enter a single Hunt. No limit is applied." },
  { id: "HL-8", field: "persistence", detail: "Whether the selected loadout persists. It does not: no save field was added." },
  { id: "HL-9", field: "itemEffect", detail: "Per-item runtime effect. Durability, power and length are carried as declared values and consumed by nothing." }
]);
