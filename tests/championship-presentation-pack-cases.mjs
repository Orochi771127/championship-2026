// Presentation packs -- skins bind to slots; gameplay does not.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ACTIVE_PRESENTATION_PACK_ID,
  INTERNAL_DEFAULT_PRESENTATION_PACK_ID,
  PRESENTATION_GAMEPLAY_INVARIANTS,
  PRESENTATION_PACK_IDS,
  PRESENTATION_SLOT_IDS,
  getPresentationPack,
  listPresentationPacks,
  resolvePresentationSlot
} from "../src/championship/presentation/presentationPack.js";

const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
const contract = JSON.parse(fs.readFileSync(
  "docs/contracts/championship/CHAMPIONSHIP_PRESENTATION_PACK_CONTRACT.v1.json",
  "utf8"
));
const rightsRegistry = JSON.parse(fs.readFileSync("docs/legal/RIGHTS_EVIDENCE_REGISTRY.json", "utf8"));
const runtimeIds = new Set(index.entries.map((entry) => entry.assetId));

test("the active pack is the temporary prototype currently loaded by Pixi", () => {
  assert.equal(ACTIVE_PRESENTATION_PACK_ID, PRESENTATION_PACK_IDS.TEMPORARY_PROTOTYPE);
  const pack = getPresentationPack();
  assert.equal(pack.runtimeEligible, true);
  assert.equal(pack.role, "CURRENT_RUNTIME");
  for (const slotId of ["raisingHome", "huntField", "gateSelect"]) {
    const resolved = resolvePresentationSlot(slotId);
    assert.equal(resolved.runtimeEligible, true);
    assert.equal(runtimeIds.has(resolved.assetId), true, `${slotId} must point at a registered production bundle`);
  }
});

test("Option A is the default public skin and is not yet runtime-eligible", () => {
  assert.equal(INTERNAL_DEFAULT_PRESENTATION_PACK_ID, PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL);
  const pack = getPresentationPack(PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL);
  assert.equal(pack.role, "DEFAULT_PUBLIC_SKIN");
  assert.equal(pack.visualFamily, "LICENSED_FAITHFUL_HD");
  assert.equal(pack.runtimeEligible, false);
  assert.equal(resolvePresentationSlot("raisingHome", pack.packId).bound, false);
  assert.equal(resolvePresentationSlot("huntField", pack.packId).bound, false);
  assert.equal(resolvePresentationSlot("gateSelect", pack.packId).bound, false);
  assert.equal(listPresentationPacks().length, 3);
});

test("the future cat/dog skin is declared but remains completely unbound", () => {
  const pack = getPresentationPack(PRESENTATION_PACK_IDS.CAT_DOG_FUTURE_SKIN);
  assert.equal(pack.role, "DEFERRED_ALTERNATE_SKIN");
  assert.equal(pack.runtimeEligible, false);
  assert.equal(Object.values(pack.binds).every((value) => value === null), true);
});

test("every pack covers the same full-game visual slots and cannot change gameplay", () => {
  const expectedSlots = [...PRESENTATION_SLOT_IDS].sort();
  assert.deepEqual(PRESENTATION_GAMEPLAY_INVARIANTS, [
    "simulation_entity_ids",
    "damage_or_battle_resolution",
    "ai_decisions",
    "capture_rules_or_probabilities",
    "collision_or_walkability_truth",
    "raising_rules",
    "progression_or_rewards",
    "economy",
    "save_schema_or_saved_truth"
  ]);
  for (const pack of listPresentationPacks()) {
    assert.equal(pack.presentationOnly, true);
    assert.equal(pack.changesSimulation, false);
    assert.deepEqual(Object.keys(pack.binds).sort(), expectedSlots);
    assert.doesNotMatch(JSON.stringify(pack), /damageFormula|captureChance|aiProfile|saveKey|collisionGrid/);
  }
});

test("the owner contract locks internal production, full-game slots and release gates", () => {
  assert.equal(contract.internalProduction.state, "OWNER_AUTHORIZED_INTERNAL_PRODUCTION");
  assert.equal(contract.internalProduction.publicReleasePermitted, false);
  assert.equal(contract.internalProduction.shippingPermitted, false);
  assert.deepEqual(contract.slots.map((slot) => slot.slotId), PRESENTATION_SLOT_IDS);
  assert.deepEqual(contract.gameplayFidelity.packSelectionMustNeverChange, PRESENTATION_GAMEPLAY_INVARIANTS);
  assert.equal(contract.packPolicy.faithfulOriginal, "ACTIVE_INTERNAL_PRODUCTION_DEFAULT_TARGET");
  assert.equal(contract.packPolicy.catDogFutureSkin, "DECLARED_UNBOUND_DEFERRED_UNTIL_FAITHFUL_COMPLETION_REVIEW");
  assert.equal(contract.completionStrategy.gameplayCompletionMustWaitForFinalArt, false);
  assert.equal(contract.completionStrategy.internalRuntimeDefault, PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL);
  assert.equal(contract.completionStrategy.directInternalFaithfulBaseline.permitted, true);
  assert.equal(contract.completionStrategy.directInternalFaithfulBaseline.binding, "DIRECT_NO_USER_FACING_LOADER");
  assert.equal(contract.completionStrategy.directInternalFaithfulBaseline.sourcePayloadCommittedToRepository, false);
  assert.equal(contract.completionStrategy.directInternalFaithfulBaseline.includedInPublicBuildOrRelease, false);
  assert.equal(contract.completionStrategy.directInternalFaithfulBaseline.mayChangeGameplayOrSave, false);
  const rights = rightsRegistry.entries.find((entry) => entry.evidenceId === "LIC-CHAMPIONSHIP-2026-001");
  assert.equal(rights.decisions.internalProductionPermitted, true);
  assert.equal(rights.decisions.internalReviewPermitted, true);
  assert.equal(rights.decisions.directInternalFaithfulBaselineBindingPermitted, true);
  assert.equal(rights.decisions.runtimeIntegrationPermitted, false);
  assert.equal(rights.decisions.shippingPermitted, false);
});

test("unknown packs and slots are refused rather than guessed", () => {
  assert.throws(() => getPresentationPack("championship:pack:unknown"), /UNKNOWN_PRESENTATION_PACK/);
  assert.throws(() => resolvePresentationSlot("battleField"), /UNKNOWN_PRESENTATION_SLOT/);
});
