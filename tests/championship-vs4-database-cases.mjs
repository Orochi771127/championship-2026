// VS4 -- Database encyclopedia: 224 slots, separate from CreatureInstance.
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

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/entities.r1.json", "utf8"));
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
  app.selectGate(app.getGates()[0].gateId);
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

test("the encyclopedia is 224 slots: 8 eggs and 216 regular", () => {
  const slots = listDatabaseSlots();
  assert.equal(slots.length, DATABASE_SLOT_COUNT);
  assert.equal(DATABASE_SLOT_COUNT, 224);
  assert.equal(slots.filter((slot) => slot.kind === "EGG").length, DATABASE_EGG_COUNT);
  assert.equal(slots.filter((slot) => slot.kind === "REGULAR").length, DATABASE_REGULAR_COUNT);
  assert.equal(slots.some((slot) => /[\u3040-\u30ff]/.test(slot.displayName)), false);
  assert.equal(DATABASE_UNLOCK_EVIDENCE, "UNKNOWN_REQUIRES_TRACE");
});

test("only the opening partner registers at New Game, not the extra home prototypes", () => {
  const frame = projectDatabase({
    starterSpeciesId: "championship:creature:greyshade-cat",
    collection: []
  });
  assert.equal(frame.registeredCount, 1);
  const greyshade = frame.entries.find((row) => row.speciesId === "championship:creature:greyshade-cat");
  const blazetail = frame.entries.find((row) => row.speciesId === "championship:creature:blazetail-kit");
  assert.equal(greyshade.state, "REGISTERED");
  assert.equal(greyshade.source, "STARTER");
  assert.equal(blazetail.state, "UNDISCOVERED");
});

test("Home can enter Database and Database can only go back", () => {
  const stack = createChampionshipScreenStack();
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.DATABASE), true);
  stack.enter(CHAMPIONSHIP_SCREENS.DATABASE);
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.SHOP), false);
  assert.equal(stack.back(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
});

test("New Game exposes one registered slot through the app", async () => {
  const app = createApp();
  await app.newGame();
  assert.equal(app.openDatabase(), CHAMPIONSHIP_SCREENS.DATABASE);
  const frame = app.getDatabaseFrame();
  assert.equal(frame.slotCount, 224);
  assert.equal(frame.registeredCount, 1);
  assert.equal(frame.entries.filter((row) => row.state === "REGISTERED").length, 1);
  assert.equal(frame.entries.find((row) => row.speciesId === "championship:creature:blazetail-kit").state, "UNDISCOVERED");
  app.selectDatabaseSpecies(8);
  assert.equal(app.getDatabaseFrame().selected.source, "STARTER");
  assert.equal(app.getDatabaseFrame().selected.instances.length, 0);
  assert.equal(app.leaveScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});

test("a brought-home Hunt instance registers its species and survives continue", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await enterFirstHunt(app);
  const target = app.getHuntRuntime().getWildCreatures()[0];
  app.beginEnclosureStroke(target.worldX, target.worldY);
  drawClosedLoop(app, target.worldX, target.worldY);
  assert.equal(app.endEnclosureStroke().outcome, "ENCLOSED");
  app.confirmHuntResult();
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

test("Database adds no save field", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), [
    "cageEdit", "creature", "flags", "progression", "raising", "raisingHome", "saveKind", "schemaVersion", "sessionId", "shop", "updatedAt"
  ]);
  await app.dispose();
});

test("the presentation source opens Database without a second router", async () => {
  const app = createApp();
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openDatabase();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.DATABASE);
  assert.equal(source.getFrame().database.slotCount, 224);
  source.intents.leaveScreen();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});
