// VS2-R1 B -- the Original Hunt Loadout evidence contract.
//
// The recovered loadout evidence lives only in this contract; the research tree
// is external and read-only. These cases pin the counts and identities that were
// recovered, keep the unknowns from being quietly upgraded, and hold the line
// that the shipped one-companion loadout is a prototype rather than parity.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const CONTRACT_PATH = "docs/contracts/championship/VS2_HUNT_LOADOUT_RUNTIME_CONTRACT.v1.json";
const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
const contract = JSON.parse(contractText);

// Recovered twice over: as NXR touch-region node names on the equip screen, and
// as the ROM names of the five Checker items that count them.
const EQUIP_CLASSES = Object.freeze(["ROPE", "SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);

test("the five equipment classes are recovered and corroborated from two sides", () => {
  const answer = contract.answers["3_equipmentCategories"];
  assert.equal(answer.evidence, "ROM_VERIFIED");
  assert.deepEqual(answer.classes.map((entry) => entry.id), [...EQUIP_CLASSES]);

  for (const entry of answer.classes) {
    assert.equal(entry.nxrRegion, `col_${entry.id.toLowerCase()}`, `${entry.id} lost its NXR region name`);
  }

  // The corroboration is what makes ENTRAP and DAMAGE_TRAP more than node names:
  // the ROM's own Checker items are called Shot/Wire/Entrap/DamageTrap/All.
  assert.equal(answer.corroboration.evidence, "ROM_VERIFIED");
  assert.match(answer.corroboration.detail, /Entrap Checker/);
  assert.match(answer.corroboration.detail, /Damage Trap Checker/);
});

test("ROPE is the single equipped class and the other four are countable", () => {
  const classes = contract.answers["3_equipmentCategories"].classes;
  const rope = classes.find((entry) => entry.id === "ROPE");
  assert.equal(rope.maxOwned, 1, "the rope is the one equipped tether, not a stack");
  for (const entry of classes.filter((item) => item.id !== "ROPE")) {
    assert.equal(entry.maxOwned, 99);
  }
  // Four countable classes, four Hunt HUD counters. Same fact from both sides.
  assert.equal(contract.answers["6_selectableSlotCounts"].counts.huntHudRemainCounters.value, 4);
});

test("the item catalogue totals match the ROM shop table", () => {
  const catalogue = contract.answers["3_equipmentCategories"].huntItemCatalogue;
  assert.equal(catalogue.evidence, "ROM_VERIFIED");
  const { trainingGoods, huntItems, plugins, cages } = catalogue.totals;
  assert.deepEqual({ trainingGoods, huntItems, plugins, cages }, { trainingGoods: 4, huntItems: 49, plugins: 30, cages: 35 });
  assert.equal(trainingGoods + huntItems + plugins + cages, 118, "the shop table holds 118 records");

  // The ten Hunt subcategories must stay complete and sum to the Hunt total.
  assert.equal(catalogue.huntSubcategories.length, 10);
  assert.equal(catalogue.huntSubcategories.reduce((sum, entry) => sum + entry.items, 0), 49);
  assert.deepEqual(catalogue.huntSubcategories.map((entry) => entry.index), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("availability stays a Shop-side rule with its three unlock types intact", () => {
  const availability = contract.answers["8_availabilityRules"];
  assert.equal(availability.evidence, "ROM_VERIFIED");
  assert.deepEqual(availability.unlockTypes.map((entry) => entry.kind),
    ["INITIAL_AVAILABLE", "TAMER_RANK_THRESHOLD", "BATTLE_BADGE_ID_0_BASED"]);
  assert.equal(availability.unlockTypes.reduce((sum, entry) => sum + entry.count, 0), 118);

  // The source catalog rates the rank rule lower than the other two. Flattening
  // that distinction would overstate what is proven.
  const rank = availability.unlockTypes.find((entry) => entry.kind === "TAMER_RANK_THRESHOLD");
  assert.equal(rank.confidence, "HIGH_CONFIDENCE");
});

test("the slot counts are exactly what the scenes declare", () => {
  const counts = contract.answers["6_selectableSlotCounts"].counts;
  assert.equal(counts.equipClassRegions.value, 5);
  assert.equal(counts.equipCovers.value, 5);
  assert.equal(counts.equipPlatesAndIcons.value, 5);
  assert.equal(counts.gearSlots.value, 4);
  assert.equal(counts.pluginSlots.value, 4);
  assert.equal(counts.gearCategoryTabs.value, 4);
  for (const entry of Object.values(counts)) {
    assert.ok(typeof entry.source === "string" && entry.source.length > 0, "a count lost its source");
  }
});

test("plugins stay information equipment, with the analyzer-to-HUD mapping intact", () => {
  const plugin = contract.answers["5_pluginRole"];
  assert.equal(plugin.evidence, "ROM_VERIFIED");
  assert.match(plugin.finding, /INFORMATION equipment/);
  assert.equal(plugin.catalogue.total, 30);
  assert.equal(plugin.catalogue.subcategories.reduce((sum, entry) => sum + entry.items, 0), 30);

  // Six single-purpose analyzers, six Hunt HUD attribute fields, one for one.
  assert.equal(plugin.analyzerFields.mapping.length, 6);
  const nodes = plugin.analyzerFields.mapping.map((entry) => entry.huntHudNode).join(" ");
  for (const field of ["gen", "type", "align_text", "hp", "mind", "size"]) {
    assert.ok(nodes.includes(field), `the analyzer mapping lost ${field}`);
  }
});

test("the eleven loadout scenes are complete and each carries a role", () => {
  const answer = contract.answers["2_elevenNxrSceneRoles"];
  assert.equal(answer.count, 11);
  assert.equal(answer.scenes.length, 11);
  for (const scene of answer.scenes) {
    assert.match(scene.path, /^ui\/hunt\/setting\//);
    assert.ok(typeof scene.role === "string" && scene.role.length > 0, `${scene.path} lost its role`);
    assert.ok(Number.isInteger(scene.nodeCount) && scene.nodeCount > 0);
  }
});

test("the launcher stays unknown, and is not confused with the NDS system launcher", () => {
  const launcher = contract.answers["4_launcherRole"];
  assert.equal(launcher.evidence, "UNKNOWN_REQUIRES_TRACE");
  // The name collision is the trap. If this warning is edited away, the next
  // reader will bind Hunt loadout behaviour to an NDS system-UI model.
  assert.match(launcher.explicitNonEvidence.warning, /Desktop_Launcher/);
  assert.match(launcher.explicitNonEvidence.detail, /38,176/);
});

test("the untraced loadout fields are not upgraded without a trace", () => {
  for (const key of ["4_launcherRole", "9_confirmationFlow"]) {
    assert.equal(contract.answers[key].evidence, "UNKNOWN_REQUIRES_TRACE", `${key} was upgraded without evidence`);
  }
  assert.equal(contract.answers["1_originalLoadoutScreenSequence"].evidence, "PARTIAL");
  assert.equal(contract.answers["11_savePersistenceRelationship"].evidence, "PARTIAL");
  assert.ok(contract.openTraceItems.length >= 8);
});

test("the recovered structure shipped and the companion stayed a developer prototype", () => {
  // v1 asserted the companion loadout was still the product's loadout. VS2-R2
  // built the recovered structure, so this inverts: the product now implements
  // the original, and the companion may only survive as a developer surface.
  assert.equal(contract.currentProductStatus.value, "ORIGINAL_STRUCTURE_IMPLEMENTED");
  assert.equal(contract.currentProductStatus.companionPrototype.value, "DEVELOPER_PROTOTYPE_ONLY");
  assert.match(contract.currentProductStatus.companionPrototype.rule, /never be promoted/);

  assert.ok(contract.consumerRules.mustNotDo.some((rule) => /add any save field/i.test(rule)));
  assert.ok(contract.consumerRules.mustNotDo.some((rule) => /companion selection to the Player Mode path/i.test(rule)));
  assert.match(contract.answers["11_savePersistenceRelationship"].productRule, /adds no save field/);

  // The live seam must carry the recovered surface and no companion.
  const seam = fs.readFileSync("src/championship/app/gateHuntPresentationSource.js", "utf8");
  for (const field of ["availableEquipment", "selectedEquipment", "availablePlugins", "selectedPlugins", "hudCapabilities", "confirmationState"]) {
    assert.ok(seam.includes(field), `the seam lost ${field}`);
  }
  assert.equal(/selectCompanion|getCompanionCreatureId/.test(seam), false, "a companion surface survived on the seam");
});

test("all eleven Owner loadout questions are answered with an evidence level", () => {
  const keys = Object.keys(contract.answers);
  assert.equal(keys.length, 11);
  for (let index = 1; index <= 11; index += 1) {
    assert.ok(keys.some((key) => key.startsWith(`${index}_`)), `question ${index} is unanswered`);
  }
  for (const [key, answer] of Object.entries(contract.answers)) {
    assert.ok(typeof answer.evidence === "string" && answer.evidence.length > 0, `${key} carries no evidence level`);
  }
});

test("the contract carries provenance without a payload or a machine path", () => {
  assert.equal(/[A-Za-z]:[\\/]/.test(contractText), false, "an absolute machine path entered the contract");
  assert.match(contract.method.provenance, /research\/original-evidence\/README\.md/);
  assert.equal(/base64|data:image/i.test(contractText), false);
});
