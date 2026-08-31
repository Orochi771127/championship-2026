// VS4 -- Cage editor: 36 definitions, hex slots 14–20, Shop ownership.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CAGE_DEFINITION_COUNT,
  CAGE_SHOP_COUNT,
  MAX_SLOT_COUNT,
  STARTING_SLOT_COUNT,
  WAITING_ROOM_DEFINITION_INDEX,
  listCageDefinitions,
  slotCountForTamerRank
} from "../src/championship/cage/cageCatalog.js";
import {
  CAGE_TRAINING_CHANNELS,
  CAGE_TRAINING_MAGNITUDE_PARITY,
  CAGE_CAPACITY_RULE,
  CAGE_CAPACITY_OVERFILL_CONSEQUENCE,
  evaluateCageOccupancy,
  getCageTraining
} from "../src/championship/cage/cageEffects.js";
import { createCageEditRuntime } from "../src/championship/cage/cageEditRuntime.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { CHAMPIONSHIP_SCREENS } from "../src/championship/app/championshipScreenStack.js";
import { SHOP_PURCHASE_DOMAIN, listShopRecords } from "../src/championship/shop/shopCatalog.js";

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
    cages: presentation.cages
  });
}

test("Cage catalog is 35 shop cages plus Waiting Room", () => {
  const shopCages = listShopRecords().filter((record) => record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP);
  assert.equal(shopCages.length, CAGE_SHOP_COUNT);
  const records = listCageDefinitions();
  assert.equal(records.length, CAGE_DEFINITION_COUNT);
  assert.equal(records[WAITING_ROOM_DEFINITION_INDEX].alwaysOwned, true);
  assert.equal(records[WAITING_ROOM_DEFINITION_INDEX].moduleId, "championship:2026:cage:waiting-room");
});

test("tamer rank table first word is ranch slot count 14/16/18/20", () => {
  assert.equal(slotCountForTamerRank(0), 14);
  assert.equal(slotCountForTamerRank(1), 14);
  assert.equal(slotCountForTamerRank(2), 16);
  assert.equal(slotCountForTamerRank(4), 18);
  assert.equal(slotCountForTamerRank(6), 20);
  assert.equal(slotCountForTamerRank(9), 20);
  assert.equal(slotCountForTamerRank(99), 20);
});

test("one module fills one hex and locked slots refuse placement", () => {
  const runtime = createCageEditRuntime();
  const waiting = "championship:2026:cage:waiting-room";
  runtime.selectModule(waiting, [], 0);
  assert.equal(runtime.placeAt(14, [], 0).lastVerdict.reason, "SLOT_LOCKED");
  assert.equal(runtime.placeAt(0, [], 0).lastVerdict.reason, "PLACED");
  runtime.selectModule(waiting, [], 0);
  assert.equal(runtime.placeAt(1, [], 0).lastVerdict.reason, "ALREADY_PLACED");
  runtime.removePlacement(waiting, [], 0);
  runtime.selectModule(waiting, [], 0);
  const atRankTwo = runtime.placeAt(14, [], 2);
  assert.equal(atRankTwo.lastVerdict.reason, "PLACED");
  assert.equal(atRankTwo.unlockedCount, 16);
});

test("New Game opens Cage Edit with 14 hexes and starter ownership", async () => {
  const app = createApp();
  await app.newGame();
  assert.equal(app.openCageEdit(), CHAMPIONSHIP_SCREENS.CAGE_EDIT);
  const frame = app.getCageEditFrame();
  assert.equal(frame.definitionCount, 36);
  assert.equal(frame.maxSlotCount, MAX_SLOT_COUNT);
  assert.equal(frame.unlockedCount, STARTING_SLOT_COUNT);
  assert.equal(frame.slotCountEvidence, "VERIFIED_BINARY");
  assert.equal(frame.placementModel, "ONE_MODULE_PER_HEX_SLOT");
  assert.equal(frame.slots.filter((slot) => slot.unlocked).length, 14);
  assert.equal(frame.slots.filter((slot) => !slot.unlocked).length, 6);
  assert.ok(frame.ownedCount >= 4);
  assert.ok(frame.tray.some((row) => row.moduleId === "championship:2026:cage:waiting-room"));
  await app.dispose();
});

test("placing, confirming and saving round-trips; BACK discards a draft", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.openCageEdit();
  const waiting = "championship:2026:cage:waiting-room";
  app.selectCageModule(waiting);
  assert.equal(app.placeCageAt(0).lastVerdict.reason, "PLACED");
  assert.equal(app.placeCageAt(1).lastVerdict.reason, "NOTHING_SELECTED");
  app.leaveScreen();
  app.openCageEdit();
  assert.equal(app.getCageEditFrame().placements.length, 0);

  app.selectCageModule(waiting);
  app.placeCageAt(3);
  app.confirmCageEdit();
  app.leaveScreen();
  app.save();
  await app.dispose();

  const reloaded = createApp(storage);
  await reloaded.continueGame();
  reloaded.openCageEdit();
  const restored = reloaded.getCageEditFrame();
  assert.equal(restored.placements.length, 1);
  assert.equal(restored.placements[0].moduleId, waiting);
  assert.equal(restored.placements[0].slotIndex, 3);
  await reloaded.dispose();
});

test("a pre-cage save still continues with an empty ranch", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  delete saved.cageEdit;
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  await app.dispose();

  const reloaded = createApp(storage);
  const resumed = await reloaded.continueGame();
  assert.ok(resumed);
  reloaded.openCageEdit();
  assert.equal(reloaded.getCageEditFrame().placements.length, 0);
  await reloaded.dispose();
});

test("the presentation source opens Cage Edit without a second router", async () => {
  const app = createApp();
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openCageEdit();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.CAGE_EDIT);
  assert.equal(source.getFrame().cageEdit.unlockedCount, 14);
  source.intents.selectCageModule("championship:2026:cage:waiting-room");
  source.intents.placeCageAt(0);
  assert.equal(source.getFrame().cageEdit.lastVerdict.reason, "PLACED");
  source.intents.leaveScreen();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});

test("original cage descriptions name a channel and a Digimon capacity, not a tick formula", () => {
  const records = listCageDefinitions();
  assert.equal(records.length, CAGE_DEFINITION_COUNT);
  for (const record of records) {
    assert.equal(record.training, getCageTraining(record.cageDefinitionIndex));
    assert.equal(record.training.magnitudeParity, CAGE_TRAINING_MAGNITUDE_PARITY);
    assert.equal(Object.hasOwn(record.training, "delta"), false);
  }
  const vacantLot = getCageTraining(0);
  assert.equal(vacantLot.channels[0].id, CAGE_TRAINING_CHANNELS.DEFENSE);
  assert.equal(vacantLot.capacity, 2);
  assert.match(vacantLot.summary, /Defense up/);
  assert.match(vacantLot.summary, /Best for 2/);
  assert.equal(getCageTraining(4).channels[0].id, CAGE_TRAINING_CHANNELS.ATTACK);
  assert.equal(getCageTraining(4).capacity, 8);
  const waiting = getCageTraining(WAITING_ROOM_DEFINITION_INDEX);
  assert.equal(waiting.channels.length, 0);
  assert.equal(waiting.capacity, null);
  assert.equal(waiting.summary, "No listed training");
});

test("setTamerRank opens 16 then 20 hexes, persists, and reveals rank-gated shop rows", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const listingsAtRankZero = app.getShopFrame().listings.length;
  app.openCageEdit();
  assert.equal(app.getCageEditFrame().unlockedCount, 14);
  assert.equal(app.placeCageAt(14).lastVerdict.reason, "NOTHING_SELECTED");
  app.selectCageModule("championship:2026:cage:waiting-room");
  assert.equal(app.placeCageAt(14).lastVerdict.reason, "SLOT_LOCKED");

  assert.equal(app.setTamerRank(2), 2);
  assert.equal(app.getCageEditFrame().unlockedCount, 16);
  assert.equal(app.getCageEditFrame().slots.filter((slot) => slot.unlocked).length, 16);
  assert.equal(app.placeCageAt(14).lastVerdict.reason, "PLACED");
  assert.ok(app.getShopFrame().listings.length > listingsAtRankZero);

  app.setTamerRank(6);
  assert.equal(app.getCageEditFrame().unlockedCount, 20);
  const vacantLot = app.getCageEditFrame().tray.find((row) => row.moduleId === "championship:2026:cage:0");
  assert.ok(vacantLot);
  assert.match(vacantLot.trainingSummary, /Defense up/);
  assert.match(vacantLot.trainingSummary, /Best for 2/);

  app.confirmCageEdit();
  app.leaveScreen();
  app.save();
  await app.dispose();

  const reloaded = createApp(storage);
  await reloaded.continueGame();
  assert.equal(reloaded.getTamerRank(), 6);
  reloaded.openCageEdit();
  assert.equal(reloaded.getCageEditFrame().unlockedCount, 20);
  assert.equal(reloaded.getCageEditFrame().placements[0].slotIndex, 14);
  await reloaded.dispose();
});

test("recommended count is a soft cap: overfill is allowed and only named as extra stress", () => {
  const atCap = evaluateCageOccupancy({ capacity: 2, occupantCount: 2 });
  assert.equal(atCap.overRecommended, false);
  assert.equal(atCap.capacityRule, CAGE_CAPACITY_RULE);
  assert.equal(atCap.overfillConsequence, CAGE_CAPACITY_OVERFILL_CONSEQUENCE);
  assert.equal(atCap.stressParity, CAGE_TRAINING_MAGNITUDE_PARITY);

  const over = evaluateCageOccupancy({ capacity: 2, occupantCount: 3 });
  assert.equal(over.overRecommended, true);
  assert.equal(Object.hasOwn(over, "delta"), false);

  const waiting = evaluateCageOccupancy({
    capacity: getCageTraining(WAITING_ROOM_DEFINITION_INDEX).capacity,
    occupantCount: 99
  });
  assert.equal(waiting.capacity, null);
  assert.equal(waiting.overRecommended, false);

  const gym = createCageEditRuntime();
  const frame = gym.getFrame([], 0);
  assert.equal(frame.capacityRule, CAGE_CAPACITY_RULE);
  assert.equal(frame.capacityOverfillConsequence, CAGE_CAPACITY_OVERFILL_CONSEQUENCE);
});

test("a pre-rank save continues at rank 0 and 14 hexes", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  delete saved.progression.tamerRank;
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  await app.dispose();

  const reloaded = createApp(storage);
  const resumed = await reloaded.continueGame();
  assert.ok(resumed);
  assert.equal(reloaded.getTamerRank(), 0);
  reloaded.openCageEdit();
  assert.equal(reloaded.getCageEditFrame().unlockedCount, STARTING_SLOT_COUNT);
  await reloaded.dispose();
});
