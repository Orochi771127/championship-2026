// VS2-PREP: product-local forbidden storage key guard.
//
// Championship 2026 is standalone. A build installed beside historical data from
// the application it used to be a feature of must be unable to read or write that
// data, by construction rather than by convention.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import {
  createChampionshipPersistentSavePort,
  guardChampionshipStorage
} from "../src/championship/app/ChampionshipPersistentSavePort.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR,
  FORBIDDEN_HISTORICAL_STORAGE_KEYS,
  assertAllowedChampionshipStorageKey,
  forbiddenStorageKeyReason,
  isForbiddenChampionshipStorageKey
} from "../src/championship/app/championshipStorageGuard.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/entities.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

/** Records every key that reaches the underlying Storage, in call order. */
function recordingStorage() {
  const data = new Map();
  const touched = [];
  return {
    getItem(key) { touched.push(["get", key]); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { touched.push(["set", key]); data.set(String(key), String(value)); },
    removeItem(key) { touched.push(["remove", key]); data.delete(String(key)); },
    keys() { return [...data.keys()].sort(); },
    touchedKeys() { return [...new Set(touched.map(([, key]) => key))].sort(); }
  };
}

test("the historical save namespace is refused by exact key and by prefix", () => {
  assert.ok(FORBIDDEN_HISTORICAL_STORAGE_KEYS.length > 0, "the deny-list must not be empty");
  for (const key of FORBIDDEN_HISTORICAL_STORAGE_KEYS) {
    assert.equal(isForbiddenChampionshipStorageKey(key), true, key);
    assert.equal(forbiddenStorageKeyReason(key), "HISTORICAL_SAVE_NAMESPACE_OUT_OF_PRODUCT_SCOPE");
  }
  // Defence in depth: a variant, a later revision, or a typo is refused too.
  for (const variant of ["nexuslinkr2state:v1", "nexusLinkR2State:v2", "nexusLinkPlayer", "nexus:anything", "nexus-link:save"]) {
    assert.equal(isForbiddenChampionshipStorageKey(variant), true, variant);
  }
});

test("the product save key is allowed and unrelated keys are not blanket-refused", () => {
  assert.equal(isForbiddenChampionshipStorageKey(CHAMPIONSHIP_MODERN_SAVE_KEY), false);
  assert.equal(forbiddenStorageKeyReason(CHAMPIONSHIP_MODERN_SAVE_KEY), null);
  assert.equal(assertAllowedChampionshipStorageKey(CHAMPIONSHIP_MODERN_SAVE_KEY), CHAMPIONSHIP_MODERN_SAVE_KEY);
  // The guard is a targeted deny-list, not a global lock: a future Championship
  // key must not require editing the guard to exist.
  assert.equal(isForbiddenChampionshipStorageKey("championshipModernSettings:v1"), false);
});

test("a missing or non-string storage key is refused rather than stringified", () => {
  for (const bad of [undefined, null, "", 7, {}, Symbol.iterator]) {
    assert.equal(isForbiddenChampionshipStorageKey(bad), true, String(bad));
  }
  assert.throws(
    () => assertAllowedChampionshipStorageKey(undefined),
    (error) => error.name === CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR
  );
});

test("the storage facade the port uses refuses forbidden keys on read, write and delete", () => {
  const storage = recordingStorage();
  const guarded = guardChampionshipStorage(storage);

  for (const key of [...FORBIDDEN_HISTORICAL_STORAGE_KEYS, "nexus:anything", undefined]) {
    for (const call of [() => guarded.getItem(key), () => guarded.setItem(key, "x"), () => guarded.removeItem(key)]) {
      assert.throws(call, (error) => error.name === CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR, String(key));
    }
  }
  // Nothing reached the underlying Storage: the facade refuses before it forwards.
  assert.deepEqual(storage.touchedKeys(), []);

  // The product key still passes straight through.
  guarded.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, "ok");
  assert.equal(guarded.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), "ok");
  guarded.removeItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  assert.deepEqual(storage.keys(), []);
});

test("the persistent save port validates its own key at construction", () => {
  const port = createChampionshipPersistentSavePort({ storage: recordingStorage() });
  assert.equal(port.storageKey, CHAMPIONSHIP_MODERN_SAVE_KEY);
  assert.equal(isForbiddenChampionshipStorageKey(port.storageKey), false);
});

test("a full save, restore and clear cycle touches no key but the product's own", async () => {
  const storage = recordingStorage();
  const app = createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-28T12:00:00.000Z"
  });
  const started = await app.newGame();
  const residentId = started.snapshot.residents[0].residentId;
  app.care(residentId);
  app.moveToCage(residentId, presentation.cages[1].cageId);
  app.save();
  app.inspectSave();
  app.savePort.exportRecovery();
  app.savePort.clear();
  await app.dispose();

  assert.deepEqual(storage.touchedKeys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.deepEqual(storage.keys(), []);
});

test("historical data already present in Storage is never read by the product", async () => {
  const storage = recordingStorage();
  // Simulate a browser profile that still holds the historical namespace.
  for (const key of FORBIDDEN_HISTORICAL_STORAGE_KEYS) storage.setItem(key, JSON.stringify({ legacy: true }));

  const app = createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-28T12:00:00.000Z"
  });
  assert.equal(app.inspectSave().present, false, "historical data must not present itself as a Championship save");
  await app.newGame();
  app.save();
  await app.dispose();

  // The historical entries are left untouched: out of scope means neither read
  // nor written, and certainly not deleted on the player's behalf.
  for (const key of FORBIDDEN_HISTORICAL_STORAGE_KEYS) {
    assert.equal(storage.keys().includes(key), true, `${key} must survive untouched`);
  }
  assert.deepEqual(
    storage.touchedKeys().filter((key) => key !== CHAMPIONSHIP_MODERN_SAVE_KEY).sort(),
    [...FORBIDDEN_HISTORICAL_STORAGE_KEYS].sort(),
    "the only non-product keys touched are the ones this test seeded itself"
  );
});
