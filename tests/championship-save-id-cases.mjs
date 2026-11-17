// The save's own fixed id (Owner 2026-11-08, S5; docs/reports/system-sweep-2026-11-08/).
// Made once per new game, carried unchanged by every write, given in memory to an
// older save when it is opened (Continue stays read-only) and written before a claim
// names it. It lives in `flags`, where an older build drops an unknown entry instead
// of refusing the save. No network, no DOM.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import {
  CHAMPIONSHIP_MODERN_SAVE_KEY, createChampionshipSaveId, deserializeChampionshipModernSave, normalizeChampionshipSaveId
} from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const legacy = fs.readFileSync("qa/championship-full-qa-save.json", "utf8");
function memoryStorage(initial = null) {
  const data = new Map(initial === null ? [] : [[CHAMPIONSHIP_MODERN_SAVE_KEY, initial]]); let writes = 0;
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => { writes++; data.set(k, String(v)); }, removeItem: k => data.delete(k),
    get writes() { return writes; }, raw: () => data.get(CHAMPIONSHIP_MODERN_SAVE_KEY) };
}
const make = storage => createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-11-08T12:00:00.000Z", locks: null });
const stored = storage => deserializeChampionshipModernSave(storage.raw());

test("ids are 128 random bits in one strict shape", () => {
  const a = createChampionshipSaveId(), b = createChampionshipSaveId();
  assert.match(a, /^sv1-[0-9a-f]{32}$/); assert.notEqual(a, b);
  assert.equal(normalizeChampionshipSaveId(a), a);
  for (const bad of ["", "sv1-xyz", "sv2-" + "0".repeat(32), "SV1-" + "a".repeat(32), 42, {}]) assert.throws(() => normalizeChampionshipSaveId(bad), /INVALID_SAVE_ID/);
  assert.throws(() => createChampionshipSaveId({ crypto: null }), /SAVE_ID_RANDOM_UNAVAILABLE/);
});

test("a new game gets its own id, every write carries it and Continue reads it back", async () => {
  const storage = memoryStorage(), app = make(storage);
  await app.newGame(); app.save();
  const id = app.getSaveReference();
  assert.match(id, /^sv1-[0-9a-f]{32}$/);
  assert.equal(stored(storage).flags.saveId, id);
  assert.equal(app.ensureSaveReference(), id);
  app.save();
  assert.equal(stored(storage).flags.saveId, id, "later writes keep it");
  await app.dispose();
  const again = make(storage);
  assert.ok(await again.continueGame());
  assert.equal(again.getSaveReference(), id);
  const writes = storage.writes;
  assert.equal(again.ensureSaveReference(), id);
  assert.equal(storage.writes, writes, "a stored id needs no write");
  await again.dispose();

  const other = make(memoryStorage());
  await other.newGame();
  assert.notEqual(other.getSaveReference(), id, "another new game is another save");
  await other.dispose();
});

test("an older save is opened read-only and stores its id once, before a claim may name it", async () => {
  const storage = memoryStorage(legacy), app = make(storage);
  assert.equal(JSON.parse(legacy).flags.saveId, undefined);
  assert.ok(await app.continueGame());
  assert.equal(storage.raw(), legacy, "Continue does not rewrite the save");
  const id = app.getSaveReference();
  assert.match(id, /^sv1-[0-9a-f]{32}$/);
  assert.equal(app.ensureSaveReference(), id);
  assert.equal(stored(storage).flags.saveId, id, "written before it is handed out");
  await app.dispose();
  const reopened = make(storage);
  assert.ok(await reopened.continueGame());
  assert.equal(reopened.getSaveReference(), id, "the same save keeps the same id");
  await reopened.dispose();
});

test("an id that was never stored is not handed out when the write fails", async () => {
  let failing = false;
  const base = memoryStorage(legacy);
  const storage = { getItem: base.getItem, removeItem: base.removeItem, setItem: (k, v) => { if (failing) throw new Error("QuotaExceededError"); base.setItem(k, v); } };
  const app = make(storage);
  assert.ok(await app.continueGame());
  failing = true;
  assert.equal(app.ensureSaveReference(), null);
  assert.equal(base.raw(), legacy, "nothing was written");
  failing = false;
  assert.match(app.ensureSaveReference(), /^sv1-[0-9a-f]{32}$/);
  await app.dispose();
});

test("a stored id round-trips; a malformed one is refused like any malformed slice", async () => {
  const storage = memoryStorage(), app = make(storage);
  await app.newGame(); app.save(); await app.dispose();
  const text = storage.raw(), parsed = JSON.parse(text);
  assert.equal(deserializeChampionshipModernSave(text).flags.saveId, parsed.flags.saveId);
  assert.throws(() => deserializeChampionshipModernSave(JSON.stringify({ ...parsed, flags: { ...parsed.flags, saveId: "sv1-not-hex" } })), /INVALID_SAVE_ID/);
  // An older build keeps only the flags it knows: an unknown flag is dropped, not refused.
  const unknown = deserializeChampionshipModernSave(JSON.stringify({ ...parsed, flags: { ...parsed.flags, laterFlag: true } }));
  assert.equal(Object.hasOwn(unknown.flags, "laterFlag"), false);
});
