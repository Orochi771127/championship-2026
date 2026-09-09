// OVL16 -- 216 book rows, separate from CreatureInstance and egg resources.
import { restoreLegacyIndividual } from "./fixtures/championship-legacy-collection.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  DATABASE_EGG_COUNT,
  DATABASE_REGULAR_COUNT,
  DATABASE_SLOT_COUNT,
  DATABASE_UNLOCK_EVIDENCE,
  listDatabaseSlots
} from "../src/championship/database/databaseCatalog.js";
import { projectDatabase } from "../src/championship/database/databaseRuntime.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  CHAMPIONSHIP_SCREENS,
  createChampionshipScreenStack
} from "../src/championship/app/championshipScreenStack.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-30T11:00:00.000Z"
  });
}

async function enterFirstHunt(app) {
  await app.newGame();
  app.openGate();
  app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId);
  app.confirmGate();
  app.beginHunt();
}

function drawClosedLoop(host, cx, cy, radius = 36) {
  host.extendEnclosureStroke(cx + radius, cy);
  host.extendEnclosureStroke(cx + radius, cy + radius);
  host.extendEnclosureStroke(cx - radius, cy + radius);
  host.extendEnclosureStroke(cx - radius, cy - radius);
  host.extendEnclosureStroke(cx + radius, cy - radius);
  host.extendEnclosureStroke(cx + 2, cy + 2);
}

test("the original encyclopedia is 216 regular species, with no egg rows", () => {
  const slots = listDatabaseSlots();
  assert.equal(slots.length, DATABASE_SLOT_COUNT);
  assert.equal(DATABASE_SLOT_COUNT, 216);
  assert.equal(slots.filter((slot) => slot.kind === "EGG").length, DATABASE_EGG_COUNT);
  assert.equal(slots.filter((slot) => slot.kind === "REGULAR").length, DATABASE_REGULAR_COUNT);
  assert.equal(slots.some((slot) => /[\u3040-\u30ff]/.test(slot.displayName)), false);
  assert.equal(DATABASE_UNLOCK_EVIDENCE, "ROM_VERIFIED_02116A20_REGISTRATION");
});

test("the opening egg does not register a regular species", () => {
  const frame = projectDatabase({ starterSpeciesId: "species-000", collection: [] });
  assert.equal(frame.registeredCount, 0);
  assert.ok(frame.entries.every(row => row.state === "UNDISCOVERED"));
});

test("Home can enter Database and Database can only go back", () => {
  const stack = createChampionshipScreenStack();
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.DATABASE), true);
  stack.enter(CHAMPIONSHIP_SCREENS.DATABASE);
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.SHOP), false);
  assert.equal(stack.back(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
});

test("New Game exposes an empty book; selectors use species IDs independent of row ordinal", async () => {
  const app = createApp();
  await app.newGame();
  assert.equal(app.openDatabase(), CHAMPIONSHIP_SCREENS.DATABASE);
  const frame = app.getDatabaseFrame();
  assert.equal(frame.slotCount, 216);
  assert.equal(frame.registeredCount, 0);
  assert.throws(() => app.selectDatabaseSpecies(0), /UNKNOWN_DATABASE_SLOT/);
  app.selectDatabaseSpecies(223);
  assert.equal(app.getDatabaseFrame().selected.speciesIndex, 223);
  assert.equal(app.getDatabaseFrame().selected.state, "UNDISCOVERED");
  assert.equal(app.getDatabaseFrame().selected.instances.length, 0);
  assert.equal(app.leaveScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});

test("a historical Hunt instance registers its species and survives continue", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const target = await restoreLegacyIndividual(app, storage, "Legacy", "species-014");
  app.openDatabase();
  const row = app.getDatabaseFrame().entries.find((entry) => entry.speciesId === target.speciesId);
  assert.equal(row.state, "REGISTERED");
  assert.ok(row.instanceCount >= 1);
  app.selectDatabaseSpecies(row.speciesIndex);
  const instanceId = app.getDatabaseFrame().selected.instances[0].instanceId;
  assert.equal(app.renameDatabaseInstance(instanceId, "Ember"), "Ember");
  app.save();
  await app.dispose();

  const reloaded = createApp(storage);
  await reloaded.continueGame();
  reloaded.openDatabase();
  const restored = reloaded.getDatabaseFrame().entries.find((entry) => entry.speciesId === target.speciesId);
  assert.equal(restored.state, "REGISTERED");
  reloaded.selectDatabaseSpecies(restored.speciesIndex);
  assert.equal(reloaded.getDatabaseFrame().selected.instances[0].displayName, "Ember");
  await reloaded.dispose();
});

test("the book stays inside progression in the existing save envelope", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), [
    "battleEconomy", "cageEdit", "creature", "flags", "gameplayRng", "huntHistory", "instanceIdentity", "progression", "raising", "raisingHome", "saveKind", "schemaVersion", "sessionId", "shop", "updatedAt"
  ]);
  // Browsing Database creates no battle transaction or additional save state.
  assert.deepEqual(saved.battleEconomy, { nextSequence: 1, settledThrough: 0, active: null, lastReceipt: null });
  assert.deepEqual(saved.instanceIdentity, { nextSequence: 1 }, "Database browsing does not allocate an individual");
  assert.deepEqual(saved.progression.registeredSpecies, []);
  await app.dispose();
});

test("the presentation source opens Database without a second router", async () => {
  const app = createApp();
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openDatabase();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.DATABASE);
  assert.equal(source.getFrame().database.slotCount, 216);
  source.intents.leaveScreen();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});
