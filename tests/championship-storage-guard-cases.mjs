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
  createChampionshipSessionCheckpointPort,
  guardChampionshipStorage
} from "../src/championship/app/ChampionshipPersistentSavePort.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  ALLOWED_CHAMPIONSHIP_EPHEMERAL_KEYS,
  CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR,
  CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY,
  FORBIDDEN_HISTORICAL_STORAGE_KEYS,
  assertAllowedChampionshipStorageKey,
  forbiddenStorageKeyReason,
  isForbiddenChampionshipStorageKey
} from "../src/championship/app/championshipStorageGuard.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
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

test("session checkpoint key is explicitly registered and survives sessionStorage wipe via dual localStorage backup", () => {
  assert.equal(ALLOWED_CHAMPIONSHIP_EPHEMERAL_KEYS.includes(CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY), true);
  assert.equal(isForbiddenChampionshipStorageKey(CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY), false);

  const local = recordingStorage();
  const session = recordingStorage();
  const checkpointPort = createChampionshipSessionCheckpointPort({
    storage: local,
    sessionStorage: session
  });

  checkpointPort.write({
    screen: "HUNT_FIELD",
    substate: { gateId: "GATE_01" }
  }, { force: true });
  assert.deepEqual(local.keys(), [CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY]);
  assert.deepEqual(session.keys(), [CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY]);

  // Simulate iOS Jetsam process kill wiping sessionStorage while localStorage persists
  session.removeItem(CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY);
  assert.deepEqual(session.keys(), []);

  const recovered = checkpointPort.read();
  assert.equal(recovered?.screen, "HUNT_FIELD");
  assert.equal(recovered?.substate?.gateId, "GATE_01");

  // Explicit clear (e.g. returnToTitle) removes the key from both storages
  checkpointPort.clear();
  assert.deepEqual(local.keys(), []);
  assert.deepEqual(session.keys(), []);
});

// Owner 2026-10-29 social batch: passport binding, the first-bind gift, the
// save chooser and the brag card add no storage key of their own.
test("an offline social cycle (provider rehearsal, gift preview, save chooser, brag card) touches only the product save key", async () => {
  const { createChampionshipCloudService } = await import("../src/championship/online/championshipCloudService.js");
  const { resolveOnlineServiceConfig } = await import("../src/championship/online/onlineServiceConfig.js");
  const { createChampionshipOnlineSessionPort } = await import("../src/championship/app/ChampionshipPersistentSavePort.js");
  const { describeSaveSides } = await import("../src/championship/app/saveConflictArbiter.js");
  const { summarizeSaveText } = await import("../src/championship/online/cloudSaveEnvelope.js");
  const { renderTamerBragCard, exportTamerBragCard } = await import("../src/championship/presentation/tamerBragCardGenerator.js");
  const local = recordingStorage(), session = recordingStorage();
  const app = createChampionshipStandaloneApp({ storage: local, catalog, cages: presentation.cages, now: () => "2026-10-29T12:00:00.000Z", locks: null });
  await app.newGame(); app.save();
  // The online session port exists but stays unused: no cloud is configured.
  const service = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: { supabaseUrl: "", supabaseAnonKey: "" }, runtime: null }),
    sessionStorage: createChampionshipOnlineSessionPort({ storage: local }), win: { addEventListener() {}, removeEventListener() {} }, nav: { onLine: true } });
  assert.equal((await service.bindProvider("google")).simulated, true);
  assert.equal((await service.claimBindReward({ saveRef: "0".repeat(64) })).preview, true, "a simulation never pays");
  assert.equal(app.getOnlineBindReward(), null);
  const text = app.persistenceFacade().exportRecovery().text;
  assert.equal((await service.backupNow(text)).ok, true);
  assert.equal(describeSaveSides({ local: summarizeSaveText(text), remote: summarizeSaveText(text) }).length, 6);
  const context = { save() {}, restore() {}, setTransform() {}, clearRect() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
    setLineDash() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: value => ({ width: String(value).length * 10 }), fillText() {}, strokeText() {}, drawImage() {}, getImageData: () => ({}) };
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const card = await renderTamerBragCard({ tamerName: "阿光", tamerCode: "TM-AAAA-BBBB" }, { createCanvas: (w, h) => ({ width: w, height: h, getContext: () => context,
    toDataURL: () => png, toBlob: done => done(new Blob([Buffer.from(png.split(",")[1], "base64")], { type: "image/png" })) }), loadImage: async () => null });
  assert.match((await exportTamerBragCard(card.canvas)).dataUrl, /^data:image\/png;base64,/);
  await app.dispose(); service.dispose();
  assert.deepEqual(local.touchedKeys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.deepEqual(session.touchedKeys(), [], "sessionStorage is not used at all");
});

test("paying the first-bind gift writes through the save port's one key and nothing else", async () => {
  const storage = recordingStorage();
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-10-29T12:00:00.000Z", locks: null });
  await app.newGame(); app.save();
  assert.equal(app.claimOnlineBindReward({ provider: "email", rewardBits: 5000 }).ok, true);
  await app.dispose();
  assert.deepEqual(storage.touchedKeys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.match(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), /"onlineBindReward":\{"version":1,"provider":"email"/);
});
