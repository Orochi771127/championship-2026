import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/entities.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    keys() { return [...data.keys()].sort(); }
  };
}

function createApp(storage) {
  return createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-28T12:00:00.000Z"
  });
}

test("VS1 performs new game, select, care, relocate, save, fresh continue and restore", async () => {
  const storage = memoryStorage();
  const first = createApp(storage);
  const started = await first.newGame();
  const residentId = started.snapshot.residents[0].residentId;
  const targetCageId = presentation.cages[1].cageId;

  assert.equal(first.select(residentId), residentId);
  const cared = first.care(residentId);
  assert.equal(cared.interactions[residentId].careCount, 1);
  const moved = first.moveToCage(residentId, targetCageId);
  assert.equal(moved.assignments[residentId], targetCageId);
  first.save();
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  await first.dispose();

  const second = createApp(storage);
  const restored = await second.continueGame();
  assert.ok(restored, "Continue must open the persisted save in a fresh application");
  assert.equal(restored.creature.speciesId, "championship:creature:greyshade-cat");
  assert.equal(restored.raising.assignments[residentId], targetCageId);
  assert.equal(restored.raising.interactions[residentId].careCount, 1);
  assert.equal(second.getSelectedCreatureId(), null, "selection remains presentation-transient");
  await second.dispose();
});

test("VS1 writes exactly one product save key and malformed data never blocks New Game", async () => {
  const storage = memoryStorage();
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, "not-json");
  const app = createApp(storage);
  assert.equal(app.inspectSave().present, false);
  await app.newGame();
  app.save();
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.doesNotThrow(() => JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY)));
  await app.dispose();
});

test("VS1 product catalog is standalone and contains no later-slice runtime authority", () => {
  assert.equal(catalog.authority, "CHAMPIONSHIP_2026_PRODUCT");
  assert.equal(catalog.records.length, 3);
  for (const record of catalog.records) {
    assert.match(record.speciesId, /^championship:creature:/);
    assert.equal(record.sourceAuthority, "CHAMPIONSHIP_2026_PRODUCT");
  }
});
