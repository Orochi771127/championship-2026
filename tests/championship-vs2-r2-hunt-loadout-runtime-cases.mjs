// VS2-R2 -- the Original Hunt Loadout runtime.
//
// Two things are under test. That the recovered structure is preserved exactly -
// five equipment classes, four plugin positions, the rope's single-item cap and
// durability, the plugin-to-HUD capability mapping. And that nothing beyond it
// was invented: no item effect, no carry limit, no confirmation requirement.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  HUNT_ANALYZER_FIELD_HUD_NODES,
  HUNT_ANALYZER_FIELD_ORDER,
  HUNT_CHECKER_TARGETS,
  HUNT_COUNTED_CLASSES,
  HUNT_EQUIPMENT_CLASS_ORDER,
  HUNT_EQUIPMENT_CLASS_RULES,
  HUNT_HUD_COUNTER_COUNT,
  HUNT_LOADOUT_UNKNOWNS,
  HUNT_PLUGIN_POSITION_COUNT
} from "../src/championship/hunt/loadout/huntLoadoutContract.js";
import {
  HUNT_STARTING_INVENTORY,
  getHuntCatalogItem
} from "../src/championship/hunt/loadout/huntEquipmentCatalog.js";
import { createHuntInventory } from "../src/championship/hunt/loadout/huntInventory.js";
import { createHuntLoadout } from "../src/championship/hunt/loadout/huntLoadoutRuntime.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

const ROPE = "championship:2026:hunt-item:rope-i";
const SHOT = "championship:2026:hunt-item:shot-i";
const WIRE = "championship:2026:hunt-item:wire-i";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()].sort(); }
  };
}

function stockedInventory() {
  const inventory = createHuntInventory({ tamerRank: 6, battleBadges: [7, 17, 34, 54] });
  inventory.grant(WIRE, 5);
  inventory.grant("championship:2026:hunt-plugin:analyzer-hp", 1);
  inventory.grant("championship:2026:hunt-plugin:checker-shot", 1);
  inventory.grant("championship:2026:hunt-plugin:radar-generation", 1);
  inventory.grant("championship:2026:hunt-plugin:memory-checker", 1);
  return inventory;
}

// ---------------------------------------------------------------------------
// Recovered structure
// ---------------------------------------------------------------------------

test("the five equipment classes and four plugin positions are preserved exactly", () => {
  assert.deepEqual([...HUNT_EQUIPMENT_CLASS_ORDER], ["ROPE", "SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);
  assert.equal(HUNT_PLUGIN_POSITION_COUNT, 4);
  // Four countable classes, four Hunt HUD counters. Same fact from both sides.
  assert.deepEqual([...HUNT_COUNTED_CLASSES], ["SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);
  assert.equal(HUNT_HUD_COUNTER_COUNT, HUNT_COUNTED_CLASSES.length);

  const loadout = createHuntLoadout({ inventory: stockedInventory() });
  assert.deepEqual(loadout.listAvailableEquipment().map((entry) => entry.equipmentClass),
    [...HUNT_EQUIPMENT_CLASS_ORDER]);
  assert.equal(loadout.getSelectedPlugins().length, 4);
});

test("the rope is the single equipped class and the rest are countable", () => {
  assert.equal(HUNT_EQUIPMENT_CLASS_RULES.ROPE.maxOwned, 1);
  assert.equal(HUNT_EQUIPMENT_CLASS_RULES.ROPE.countable, false);
  assert.equal(HUNT_EQUIPMENT_CLASS_RULES.ROPE.hasDurability, true);
  for (const className of HUNT_COUNTED_CLASSES) {
    assert.equal(HUNT_EQUIPMENT_CLASS_RULES[className].maxOwned, 99);
    assert.equal(HUNT_EQUIPMENT_CLASS_RULES[className].countable, true);
    assert.equal(HUNT_EQUIPMENT_CLASS_RULES[className].hasDurability, false);
  }
  assert.equal(getHuntCatalogItem(ROPE).durability, 6);
  assert.equal(getHuntCatalogItem(SHOT).durability, null);
});

test("the six analyzer fields map onto the six recovered Hunt HUD nodes", () => {
  assert.equal(HUNT_ANALYZER_FIELD_ORDER.length, 6);
  assert.deepEqual(Object.keys(HUNT_ANALYZER_FIELD_HUD_NODES).sort(), [...HUNT_ANALYZER_FIELD_ORDER].sort());
  assert.deepEqual(
    HUNT_ANALYZER_FIELD_ORDER.map((field) => HUNT_ANALYZER_FIELD_HUD_NODES[field]),
    ["gen", "type", "align_text", "hp", "mind", "size"]
  );
  assert.deepEqual([...HUNT_CHECKER_TARGETS], ["SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP", "ALL"]);
});

// ---------------------------------------------------------------------------
// Inventory: Shop-owned, capped, availability-gated
// ---------------------------------------------------------------------------

test("the starting inventory follows the original initial_owned shape", () => {
  const inventory = createHuntInventory();
  assert.equal(inventory.getQuantity(ROPE), 1);
  assert.equal(inventory.getQuantity(SHOT), 20);
  assert.equal(inventory.getQuantity("championship:2026:hunt-memory:card-32"), 1);
  // No plugin is owned at the start; every HUD readout begins dark.
  assert.equal(inventory.listOwned().every((entry) => entry.item.kind !== "PLUGIN"), true);
  assert.equal(inventory.getQuantity("championship:2026:hunt-item:meat-00"), 10);
  assert.equal(HUNT_STARTING_INVENTORY.length, 4);
});

test("inventory quantity is capped at the per-item maximum", () => {
  const inventory = createHuntInventory();
  inventory.grant(SHOT, 500);
  // A two-digit readout cannot show a third digit, and the ROM caps at 99.
  assert.equal(inventory.getQuantity(SHOT), 99);
  inventory.grant(ROPE, 40);
  assert.equal(inventory.getQuantity(ROPE), 1, "the rope is a single equipped item");
});

test("availability is a Shop-side rule with its three recovered kinds", () => {
  const early = createHuntInventory({ tamerRank: 0, battleBadges: [] });
  assert.equal(early.availabilityOf(ROPE).reason, "INITIAL_AVAILABLE");
  assert.equal(early.availabilityOf("championship:2026:hunt-item:rope-ii").reason, "INITIAL_AVAILABLE");
  assert.equal(early.availabilityOf("championship:2026:hunt-item:rope-03").reason, "TAMER_RANK_BELOW_THRESHOLD");
  assert.equal(early.availabilityOf("championship:2026:hunt-item:rope-iii").reason, "BATTLE_BADGE_MISSING");

  const later = createHuntInventory({ tamerRank: 1, battleBadges: [25] });
  assert.equal(later.availabilityOf("championship:2026:hunt-item:rope-03").available, true);
  // The rank rule is HIGH_CONFIDENCE in the source catalog, not fully verified.
  assert.equal(later.availabilityOf("championship:2026:hunt-item:rope-03").evidence, "HIGH_CONFIDENCE");
  assert.equal(later.availabilityOf("championship:2026:hunt-item:rope-iii").available, true);
  assert.equal(later.availabilityOf("championship:2026:hunt-item:rope-iii").evidence, "ROM_VERIFIED");
});

// ---------------------------------------------------------------------------
// Selection rules
// ---------------------------------------------------------------------------

test("a class holds one item of its own class, and only if owned", () => {
  const loadout = createHuntLoadout({ inventory: stockedInventory() });
  loadout.selectEquipment("ROPE", ROPE);
  assert.equal(loadout.getSelectedEquipment().find((slot) => slot.equipmentClass === "ROPE").itemId, ROPE);

  assert.throws(() => loadout.selectEquipment("WIRE", ROPE), /EQUIPMENT_CLASS_MISMATCH/);
  assert.throws(() => loadout.selectEquipment("SHOT", "championship:2026:hunt-item:shot-iii"), /NOT_OWNED/);
  assert.throws(() => loadout.selectEquipment("LURE", ROPE), /UNKNOWN_EQUIPMENT_CLASS/);

  // Clearing is always allowed: nothing must stay equipped.
  loadout.selectEquipment("ROPE", null);
  assert.equal(loadout.getSelectedEquipment().find((slot) => slot.equipmentClass === "ROPE").itemId, null);
});

test("a plugin occupies exactly one position", () => {
  const loadout = createHuntLoadout({ inventory: stockedInventory() });
  const checker = "championship:2026:hunt-plugin:checker-shot";
  loadout.fitPlugin(0, checker);
  loadout.fitPlugin(2, checker);
  const fitted = loadout.getSelectedPlugins().filter((slot) => slot.itemId === checker);
  assert.equal(fitted.length, 1, "the same plugin cannot fill two positions");
  assert.equal(fitted[0].position, 2);

  assert.throws(() => loadout.fitPlugin(9, checker), /UNKNOWN_PLUGIN_POSITION/);
  assert.throws(() => loadout.fitPlugin(0, ROPE), /UNKNOWN_HUNT_PLUGIN/);
  assert.throws(() => loadout.fitPlugin(0, "championship:2026:hunt-plugin:analyzer-family"), /NOT_OWNED/);
});

// ---------------------------------------------------------------------------
// The recovered handoff: plugins gate the Hunt HUD
// ---------------------------------------------------------------------------

test("the Hunt HUD is dark until a plugin supplies each readout", () => {
  const loadout = createHuntLoadout({ inventory: stockedInventory() });
  const dark = loadout.getHudCapabilities();
  assert.deepEqual(dark.analyzerFields, []);
  assert.deepEqual(dark.itemCounters, []);
  assert.equal(dark.radar, false);
  assert.equal(dark.radarMarkerCapacity, 0);
  assert.equal(dark.memoryReadout, false);

  loadout.fitPlugin(0, "championship:2026:hunt-plugin:analyzer-hp");
  loadout.fitPlugin(1, "championship:2026:hunt-plugin:checker-shot");
  loadout.fitPlugin(2, "championship:2026:hunt-plugin:radar-generation");
  loadout.fitPlugin(3, "championship:2026:hunt-plugin:memory-checker");
  loadout.selectMemoryCard("championship:2026:hunt-memory:card-32");

  const lit = loadout.getHudCapabilities();
  assert.deepEqual(lit.analyzerFields, ["HP"]);
  assert.deepEqual(lit.itemCounters, ["SHOT"]);
  assert.equal(lit.radar, true);
  assert.deepEqual(lit.radarFilters, ["GENERATION"]);
  assert.equal(lit.radarMarkerCapacity, 24);
  assert.equal(lit.memoryReadout, true);
  assert.equal(lit.captureCapacityG, 32);
  assert.equal(lit.evidence, "ROM_VERIFIED");
});

test("analyzer fields report in the recovered order, not selection order", () => {
  const inventory = stockedInventory();
  inventory.grant("championship:2026:hunt-plugin:analyzer-full", 1);
  const loadout = createHuntLoadout({ inventory });
  loadout.fitPlugin(0, "championship:2026:hunt-plugin:analyzer-full");
  assert.deepEqual(loadout.getHudCapabilities().analyzerFields, [...HUNT_ANALYZER_FIELD_ORDER]);
});

// ---------------------------------------------------------------------------
// What was deliberately not invented
// ---------------------------------------------------------------------------

test("no item effect, no carry limit and no confirmation requirement is invented", () => {
  const loadout = createHuntLoadout({ inventory: stockedInventory() });

  // An empty loadout is permitted. Requiring equipment would invent a rule.
  const empty = loadout.getConfirmationState();
  assert.equal(empty.canConfirm, true);
  assert.equal(empty.rule, "NO_REQUIREMENT");
  assert.equal(empty.ruleEvidence, "PRODUCT_AUTHORED");
  assert.equal(empty.originalConfirmationFlow, "UNKNOWN_REQUIRES_TRACE");
  assert.equal(loadout.validate().emptyAllowed, true);

  loadout.selectEquipment("SHOT", SHOT);
  const shot = loadout.getSelectedEquipment().find((slot) => slot.equipmentClass === "SHOT");
  // Quantity is what is owned, not a per-Hunt allowance: no limit is traced.
  assert.equal(shot.quantity, 20);
  assert.equal(shot.quantityIsCarryLimit, false);
  assert.equal(shot.durabilityConsumption, "NOT_APPLICABLE");
  assert.equal(getHuntCatalogItem(SHOT).statEffect, "ROM_VERIFIED_FUNCTIONAL_COLUMN");

  const handoff = loadout.toHuntHandoff();
  assert.equal(handoff.appliedEffects, "NONE");
  assert.match(handoff.appliedEffectsReason, /UNKNOWN_REQUIRES_TRACE/);
});

test("the open unknowns stay declared as data", () => {
  const ids = HUNT_LOADOUT_UNKNOWNS.map((entry) => entry.id);
  for (const required of ["HL-1", "HL-2", "HL-6", "HL-7", "HL-8", "HL-9"]) {
    assert.ok(ids.includes(required), `${required} was dropped from the declared unknowns`);
  }
  for (const entry of HUNT_LOADOUT_UNKNOWNS) {
    assert.ok(entry.field && entry.detail, `${entry.id} lost its explanation`);
  }
});

// ---------------------------------------------------------------------------
// The seam and the prototype boundary
// ---------------------------------------------------------------------------

test("the loadout seam exposes the read-only surface and no companion", async () => {
  const app = createChampionshipStandaloneApp({
    storage: memoryStorage(), catalog, cages: presentation.cages, now: () => "2026-08-28T12:00:00.000Z"
  });
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openGate();
  source.intents.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId);
  source.intents.confirmGate();

  const block = source.getFrame().huntLoadout;
  for (const field of [
    "availableEquipment", "selectedEquipment", "availablePlugins", "selectedPlugins",
    "hudCapabilities", "validation", "confirmationState"
  ]) {
    assert.ok(field in block, `the loadout seam is missing ${field}`);
  }
  assert.equal("party" in block, false, "the companion party survived on the Player Mode seam");
  assert.equal("selectCompanion" in source.intents, false, "a companion intent survived on the seam");

  // Quantity and durability travel with the selection, as the Owner specified.
  source.intents.selectEquipment("ROPE", ROPE);
  const rope = source.getFrame().huntLoadout.selectedEquipment.find((slot) => slot.equipmentClass === "ROPE");
  assert.equal(rope.quantity, 1);
  assert.equal(rope.durability, 6);
  await app.dispose();
});

// Removed 2026-09-03: this test asserted the companion prototype existed but
// stayed developer-only. At the Owner's direction the prototype itself was
// deleted from championshipStandaloneApp.js, which satisfies the guarantee
// outright -- there is no developer-only surface left to keep off the player path.

test("the loadout adds no save field", async () => {
  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({
    storage, catalog, cages: presentation.cages, now: () => "2026-08-28T12:00:00.000Z"
  });
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openGate();
  source.intents.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId);
  source.intents.confirmGate();
  source.intents.selectEquipment("ROPE", ROPE);
  source.intents.requestSave();

  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), [
    "battleEconomy", "cageEdit", "creature", "flags", "gameplayRng", "huntHistory", "instanceIdentity", "progression", "raising", "raisingHome", "saveKind", "schemaVersion", "sessionId", "shop", "updatedAt"
  ].sort());
  // The authorized battle envelope does not make Hunt state durable.
  assert.deepEqual(saved.battleEconomy, { nextSequence: 1, settledThrough: 0, active: null, lastReceipt: null });
  assert.deepEqual(saved.instanceIdentity, { nextSequence: 1 }, "Loadout choices do not allocate an individual");
  const text = JSON.stringify(saved).toLowerCase();
  for (const leak of ["equipment", "plugin", "loadout", "durability", "inventory"]) {
    assert.equal(text.includes(leak), false, `the loadout leaked ${leak} into the save envelope`);
  }
  await app.dispose();
});
