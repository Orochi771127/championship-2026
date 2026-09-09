import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
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
  assert.equal(restored.creature.speciesId, "species-000");
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

test("the runtime creature catalog is the transcribed cartridge table", () => {
  // Was: three product-authored creatures invented for VS1. Removed 2026-09-03
  // at the Owner's direction because they were never in the ROM.
  assert.equal(catalog.authority, "CHAMPIONSHIP_2026_PRODUCT");
  assert.equal(catalog.catalogKind, "championship:2026:catalog:creature-species");
  assert.equal(catalog.records.length, 228);
  assert.equal(catalog.rom.sha256, "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1");
  assert.equal(catalog.table.stride, 132);

  // Identity is transcribed; every record must carry it.
  for (const record of catalog.records) {
    assert.equal(typeof record.identifier, "string");
    assert.ok(record.identifier.length > 0);
    assert.ok(record.generationIndex >= 0 && record.generationIndex <= 6);
    assert.ok(record.attributeIndex >= 0 && record.attributeIndex <= 4);
  }

  // The family field is a bitmask: zero, or exactly one of eight bits.
  const families = new Set(catalog.records.map((record) => record.familyBits));
  assert.deepEqual([...families].sort((a, b) => a - b), [0, 1, 2, 4, 8, 16, 32, 64, 128]);

  // Eight eggs, which is what the documented 224 = 8 + 216 split requires.
  const eggs = catalog.records.filter((r) => r.generationIndex === 0 && r.familyBits === 0);
  assert.equal(eggs.length, 8);
});
