// Round 2 individual identity through the one standalone app/save boundary.
// Historical individuals now enter through test-only save fixtures. No live
// circle-to-ownership route is retained to make identity tests pass.

import { restoreLegacyIndividual } from "./fixtures/championship-legacy-collection.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createRaisingPresentationSource } from "../src/championship/app/raisingPresentationSource.js";
import { starterName } from "../src/championship/text/zhHant.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const instanceId = (sequence) => `championship:2026:instance:${String(sequence).padStart(4, "0")}`;

function memoryStorage() {
  const data = new Map();
  return {
    failWrites: false,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) {
      if (this.failWrites) throw new Error("IDENTITY_TEST_STORAGE_FULL");
      data.set(String(key), String(value));
    },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

const appStorage = new WeakMap();
function createApp(storage = memoryStorage()) {
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-09-05T12:00:00.000Z" });
  appStorage.set(app, storage);
  return app;
}

async function openFirstHunt(app) {
  app.openGate();
  app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId);
  app.confirmGate();
  await app.beginHunt();
  assert.equal(app.getScreen(), "HUNT_FIELD");
}

function drawEnclosure(app, target) {
  const x = target.worldX;
  const y = target.worldY;
  assert.equal(app.beginEnclosureStroke(x, y), true);
  for (const [dx, dy] of [[36, 0], [36, 36], [-36, 36], [-36, -36], [36, -36], [2, 2]]) {
    app.extendEnclosureStroke(x + dx, y + dy);
  }
  return app.endEnclosureStroke();
}

async function loadLegacyIndividual(app, name) {
  return restoreLegacyIndividual(app, appStorage.get(app), name);
}

async function savedTwoIndividuals(storage) {
  const app = createApp(storage);
  await app.newGame();
  const first = await loadLegacyIndividual(app, "First");
  const second = await loadLegacyIndividual(app, "Second");
  assert.equal(first.speciesId, second.speciesId, "reentering the current deterministic field yields the same species fixture");
  assert.equal(app.save().phase, "SAVED");
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  await app.dispose();
  return saved;
}

function relabelSavedInstance(save, oldId, newId) {
  save.raising.collection.find((entry) => entry.instanceId === oldId).instanceId = newId;
  for (const dictionary of [save.raising.assignments, save.raising.interactions]) {
    dictionary[newId] = dictionary[oldId];
    delete dictionary[oldId];
  }
}

test("two same-species individuals retain independent identity, care flags and cage assignment through app and Home reload", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const first = await loadLegacyIndividual(app, "Older");
  const second = await loadLegacyIndividual(app, "Younger");
  assert.equal(first.speciesId, second.speciesId);
  assert.notEqual(first.instanceId, second.instanceId);
  app.care(first.instanceId);
  app.care(first.instanceId);
  app.care(second.instanceId);
  app.moveToCage(second.instanceId, presentation.cages[1].cageId);
  const roster = app.getRaisingInstances();
  assert.equal(roster.length, 3, "starter and its resident reference count only once");
  assert.equal(app.getSnapshot().residents.length, 1, "collection membership does not duplicate the R2 resident store");
  assert.deepEqual(roster.slice(1).map((entry) => [entry.instanceId, entry.displayName, entry.interaction.careCount, entry.cageId]), [
    [first.instanceId, "Older", 2, presentation.cages[0].cageId],
    [second.instanceId, "Younger", 1, presentation.cages[1].cageId]
  ]);
  assert.equal(roster[0].profileEvidence,"ROM_VERIFIED_INDIVIDUAL_FIELDS");
  assert.equal(roster[0].profile.currentHp,app.getCreature().nativeProfile.fields["050"]);
  for (const entry of roster.slice(1)) {
    assert.equal(entry.profile, null);
    assert.equal(entry.profileEvidence, "UNKNOWN_REQUIRES_TRACE");
  }
  assert.equal(app.resolveRaisingInstance(first.speciesId), null, "species does not identify one individual");
  assert.equal(app.save().phase, "SAVED");
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  await app.dispose();

  const restored = createApp(storage);
  await restored.continueGame();
  assert.deepEqual(restored.getRaisingInstances(), roster);
  assert.deepEqual(restored.getInstanceIdentityState(), { nextSequence: 3 });
  const home = createRaisingPresentationSource(restored);
  const frame = home.getFrame();
  assert.deepEqual(frame.residents.map((entry) => [entry.creatureId, entry.displayName]), roster.map((entry) =>
    [entry.instanceId, entry.source.kind === "STARTER" ? starterName(entry.displayName) : entry.displayName]));
  assert.deepEqual(restored.getRaisingInstances(), roster, "localized starter display does not write into saved names");
  assert.ok(frame.residents.slice(1).every((entry) => entry.stats === null), "Legacy individuals cannot acquire invented stats");
  assert.equal(frame.residents[0].stats.currentHp,roster[0].profile.currentHp);
  await restored.dispose();
});

for (const version of [1, 2]) {
  test(`outer v${version} sparse IDs migrate through Continue and manual v5 save without renumbering or source invention`, async () => {
    const storage = memoryStorage();
    const legacy = await savedTwoIndividuals(storage);
    relabelSavedInstance(legacy, instanceId(1), instanceId(3));
    relabelSavedInstance(legacy, instanceId(2), instanceId(12));
    delete legacy.raising.collection[1].successAuthority;
    delete legacy.instanceIdentity;
    delete legacy.gameplayRng;
    delete legacy.huntHistory;
    if (version === 1) delete legacy.battleEconomy;
    legacy.schemaVersion = version;
    const raw = JSON.stringify(legacy);
    storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, raw);

    const app = createApp(storage);
    assert.equal(app.canContinue().loadable, true);
    assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), raw, "read/Continue validation does not auto-save a migration");
    const inspected = app.inspectSave().save;
    assert.equal(inspected.schemaVersion, 5);
    assert.equal(inspected.raisingHome, legacy.raisingHome, "outer migration preserves the canonical R2 string and digest");
    await app.continueGame();
    const entries = app.getRaisingInstances().slice(1);
    assert.deepEqual(entries.map((entry) => [entry.instanceId, entry.displayName]), [[instanceId(3), "First"], [instanceId(12), "Second"]]);
    assert.equal(entries[0].source.successAuthority, "PRODUCT_AUTHORED_ENCLOSURE");
    assert.equal(entries[1].source.successAuthority, null);
    assert.deepEqual(app.getInstanceIdentityState(), { nextSequence: 13 });
    assert.equal(app.save().phase, "SAVED");
    const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.equal(saved.schemaVersion, 5);
    assert.deepEqual(saved.instanceIdentity, { nextSequence: 13 });
    assert.equal(saved.raising.collection[1].successAuthority, null);
    await app.dispose();

    const fresh = createApp(storage);
    await fresh.continueGame();
    assert.deepEqual(fresh.getRaisingInstances().slice(1), entries);
    assert.equal((await loadLegacyIndividual(fresh, "Third")).instanceId, instanceId(13), "allocation follows the persisted maximum, not collection length");
    assert.deepEqual(fresh.getInstanceIdentityState(), { nextSequence: 14 });
    await fresh.dispose();
  });
}

test("a persisted allocation high-water mark survives a sparse roster and a later legacy-style removal", async () => {
  const storage = memoryStorage();
  const saved = await savedTwoIndividuals(storage);
  saved.instanceIdentity.nextSequence = 80;
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  const app = createApp(storage);
  await app.continueGame();
  const allocated = await loadLegacyIndividual(app, "High Mark");
  assert.equal(allocated.instanceId, instanceId(80));
  assert.equal(app.save().phase, "SAVED");
  await app.dispose();

  // There is no production delete action in this slice. This fixture represents
  // a later roster import/removal while preserving the committed allocator.
  const sparse = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  sparse.raising.collection = sparse.raising.collection.filter((entry) => entry.instanceId !== instanceId(80));
  delete sparse.raising.assignments[instanceId(80)];
  delete sparse.raising.interactions[instanceId(80)];
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(sparse));
  const restored = createApp(storage);
  await restored.continueGame();
  assert.equal((await loadLegacyIndividual(restored, "After Removal")).instanceId, instanceId(81));
  await restored.dispose();
});

for (const conflict of ["duplicate collection", "starter species"]) {
  test(`raw ${conflict} conflict refuses Continue before replacing the current live session`, async () => {
    const storage = memoryStorage();
    const candidate = await savedTwoIndividuals(storage);
    if (conflict === "duplicate collection") candidate.raising.collection[1].instanceId = candidate.raising.collection[0].instanceId;
    else { candidate.creature.speciesId = "species-001"; delete candidate.creature.nativeProfile; }
    const app = createApp(storage);
    await app.newGame();
    app.creditBits(42);
    app.select(app.getCreature().creatureId);
    const currentSession = app.getSession();
    const currentSnapshot = app.getSnapshot();
    const currentRaising = app.getRaisingState();
    const currentIdentity = app.getInstanceIdentityState();
    storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(candidate));
    const rejected = app.canContinue();
    assert.equal(rejected.loadable, false);
    assert.match(rejected.reason, conflict === "duplicate collection" ? /DUPLICATE_INSTANCE_ID/ : /INSTANCE_SPECIES_CONFLICT/);
    await assert.rejects(app.continueGame(), conflict === "duplicate collection" ? /DUPLICATE_INSTANCE_ID/ : /INSTANCE_SPECIES_CONFLICT/);
    assert.equal(app.getSession(), currentSession);
    assert.equal(app.getSnapshot(), currentSnapshot);
    assert.equal(app.getRaisingState(), currentRaising);
    assert.equal(app.getInstanceIdentityState(), currentIdentity);
    assert.equal(app.getShopFrame().bits, 42);
    assert.equal(app.getSelectedCreatureId(), app.getCreature().creatureId);
    app.care(app.getCreature().creatureId);
    assert.equal(app.resolveRaisingInstance(app.getCreature().creatureId).interaction.careCount, 1, "the original session remains operable");
    await app.dispose();
  });
}

test("an exhausted allocator is never touched by a diagnostic stroke and leaves the saved checkpoint unchanged", async () => {
  const storage = memoryStorage();
  const seed = createApp(storage);
  await seed.newGame();
  assert.equal(seed.save().phase, "SAVED");
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  saved.instanceIdentity.nextSequence = Number.MAX_SAFE_INTEGER;
  const raw = JSON.stringify(saved);
  await seed.dispose();
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, raw);
  const app = createApp(storage);
  assert.equal(app.canContinue().loadable, true);
  await app.continueGame();
  await openFirstHunt(app);
  const field = app.getHuntRuntime();
  const before = field.getWildCreatures();
  const target = before[0];
  const identity = app.getInstanceIdentityState();
  const raising = app.getRaisingState();
  const verdict = drawEnclosure(app, target);
  assert.equal(verdict.outcome, "TOOL_TRACE_REQUIRED");
  assert.equal(app.getScreen(), "HUNT_FIELD");
  assert.equal(app.getHuntRuntime(), field);
  assert.deepEqual(field.getWildCreatures().map((wild) => wild.wildId).sort(), before.map((wild) => wild.wildId).sort());
  assert.deepEqual(field.getWildCreatures().find((wild) => wild.wildId === target.wildId), target);
  assert.equal(app.getRaisingState(), raising);
  assert.equal(app.getInstanceIdentityState(), identity);
  assert.equal(app.getHuntResult(), null);
  assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), raw);
  assert.equal(app.beginEnclosureStroke(target.worldX, target.worldY), true, "the unchanged target can be inspected again");
  app.exitHunt();
  await app.dispose();
});

test("a failed manual checkpoint retains the prior roster until retry saves the latest individual and allocation mark together", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  await loadLegacyIndividual(app, "Saved First");
  assert.equal(app.save().phase, "SAVED");
  const checkpoint = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  const second = await loadLegacyIndividual(app, "Unsaved Second");
  storage.failWrites = true;
  assert.equal(app.save().phase, "SAVE_FAILED");
  app.moveToCage(second.instanceId, presentation.cages[1].cageId);
  assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), checkpoint);
  storage.failWrites = false;
  assert.equal(app.persistenceFacade().retry().phase, "SAVED");
  const expected = app.resolveRaisingInstance(second.instanceId);
  await app.dispose();
  const restored = createApp(storage);
  await restored.continueGame();
  assert.deepEqual(restored.resolveRaisingInstance(second.instanceId), expected);
  assert.deepEqual(restored.getInstanceIdentityState(), { nextSequence: 3 });
  assert.equal(restored.getRaisingInstances().length, 3);
  await restored.dispose();
});
