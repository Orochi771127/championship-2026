import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createClockChannelRng, restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY, deserializeChampionshipModernSave } from "../src/championship/app/championshipStandaloneSave.js";
import { prepareNativeHuntEntry } from "../src/championship/hunt/capture/nativeHuntEntryTransaction.js";
import { createNativeRaisingStarter } from "../src/championship/raising/nativeRaisingStarter.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const receipt = read("../docs/research/GAMEPLAY_RNG_CLOCK_CPU_CHECK_2026-09-06.json");
const catalog = read("../src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("../docs/contracts/championship/raising-home-presentation.v1.json");
const clock = { hour: 13, minute: 20, second: 50 };
function storage() {
  const map = new Map();
  return { fail: false, getItem: (k) => map.get(k) ?? null, removeItem: (k) => map.delete(k),
    setItem(k,v) { if (this.fail) throw Error("FULL"); map.set(k,v); }, keys: () => [...map.keys()] };
}
const appFor = (s, rngClock = () => clock) => createChampionshipStandaloneApp({ storage: s, catalog, cages, rngClock });
const channels = [0, 178, 179, 180, 181, 182, 183, 197, 196, 216];

test("RTC input matches original BCD decoding and all 217 seeded channels, including midnight", () => {
  assert.equal(receipt.cases.length, 6);
  for (const row of receipt.cases) assert.deepEqual(createClockChannelRng(row.clock).snapshot(), row.rng);
  for (const bad of [{}, {hour:24,minute:0,second:0}, {hour:1,minute:60,second:0}, {hour:1,minute:0,second:-1}]) {
    assert.throws(() => createClockChannelRng(bad), /RTC_HOUR_MINUTE_SECOND_REQUIRED/);
  }
});

test("app owns advancing channels across Gate visits and Save/Continue; clock is read once", async () => {
  const s = storage(); let reads = 0;
  const app = appFor(s, () => { reads++; return clock; });
  await app.newGame();
  let native = restoreChannelRng(receipt.cases.find((r) => r.clock.second === 50).rng);
  assert.deepEqual(app.getCreature().nativeProfile,createNativeRaisingStarter(native));
  // Native Home construction consumes facing and direction on the physical
  // slot's channel. It does not replace or reseed the shared generator.
  native.next(0x26);native.next(0x26);
  for (let i=0; i<240; i++) {
    const c = channels[i % channels.length];
    assert.equal(app.nextGameplayRandom(c), native.next(c));
  }
  const beforeGate = app.getGameplayRngState();
  // Gate navigation never draws; actual native generation continues the same
  // sequence. Its full original-CPU entry comparison has a separate test.
  app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate();
  assert.deepEqual(app.getGameplayRngState(), beforeGate);
  const candidate = prepareNativeHuntEntry({biomeId:app.getConfirmedGate().biomeId,clock:app.getCalendar(),
    rngSnapshot:beforeGate,persistentState:app.getHuntPersistentState()});
  native = candidate.rng;
  await app.beginHunt(); app.exitHunt();
  const afterGate = {version:1,...native.snapshot()};
  assert.deepEqual(app.getGameplayRngState(), afterGate);
  assert.notDeepEqual(afterGate,beforeGate);
  assert.equal(reads, 1);
  const copy = app.getGameplayRngState(); copy.cursors[0] = 0; copy.seeds[1] = 1;
  assert.deepEqual(app.getGameplayRngState(), afterGate);
  assert.equal(app.save().phase, "SAVED");
  assert.deepEqual(s.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  await app.dispose();
  const restored = appFor(s, () => { throw Error("Continue must not reseed"); });
  assert.equal(restored.canContinue().loadable, true);
  await restored.continueGame();
  native.next(0x26);native.next(0x26);
  for (let i=0; i<1200; i++) {
    const c = channels[i % channels.length];
    assert.equal(restored.nextGameplayRandom(c), native.next(c));
  }
  assert.equal(restored.savePort.getStatus().phase, "DIRTY");
  assert.deepEqual(restored.getGameplayRngState(), {version:1,...native.snapshot()});
  await restored.dispose();
});

test("v1/v2/v3 migration preserves missing history; inspection and navigation never create a replacement seed", async () => {
  for (const version of [1,2,3]) {
    const s = storage(), initial = appFor(s); await initial.newGame(); initial.save(); await initial.dispose();
    const legacy = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    legacy.schemaVersion = version; delete legacy.gameplayRng; delete legacy.huntHistory;
    // Historical v1/v2/v3 profiles predate the original individual/Home child.
    delete legacy.creature.nativeProfile;delete legacy.raising.nativeHome;
    if (version < 3) delete legacy.instanceIdentity;
    if (version < 2) delete legacy.battleEconomy;
    const text = JSON.stringify(legacy); s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, text);
    let reads = 0;
    const app = appFor(s, () => { reads++; return clock; });
    assert.equal(app.canContinue().loadable, true);
    assert.equal(app.inspectSave().save.gameplayRng, null);
    assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), text);
    await app.continueGame();
    assert.equal(app.getGameplayRngState(), null); assert.equal(reads, 0);
    assert.throws(() => app.nextGameplayRandom(217), /CHANNEL_OUT_OF_RANGE/);
    assert.equal(reads, 0);
    assert.equal(app.nextGameplayRandom(0), createClockChannelRng(clock).next(0));
    assert.equal(reads, 1); assert.equal(app.save().phase, "SAVED");
    assert.equal(JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY)).schemaVersion, 5);
    await app.dispose();
  }
});

test("failed writes retain current RNG; retry saves the latest sequence without rerolling", async () => {
  const s = storage(), app = appFor(s); await app.newGame(); app.save();
  const old = s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  app.nextGameplayRandom(180); s.fail = true;
  assert.equal(app.save().phase, "SAVE_FAILED");
  assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), old);
  app.nextGameplayRandom(180);
  const current = app.getGameplayRngState(); s.fail = false;
  assert.equal(app.save().phase, "SAVED");
  assert.deepEqual(deserializeChampionshipModernSave(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY)).gameplayRng, current);
  await app.dispose();
});

test("malformed or missing v4 RNG fails before replacing an open session", async () => {
  const s = storage(), app = appFor(s); await app.newGame(); app.save();
  const saved = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const before = app.getGameplayRngState(), session = app.getSession();
  const mutations = [
    (x) => delete x.gameplayRng,
    (x) => x.gameplayRng.version = 2,
    (x) => x.gameplayRng.cursors.pop(),
    (x) => x.gameplayRng.cursors[0] = -1,
    (x) => x.gameplayRng.cursors[0] = 104,
    (x) => x.gameplayRng.seeds[0] = 1.5,
    (x) => x.gameplayRng.replay = [1,2,3]
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(saved); mutate(bad); const text = JSON.stringify(bad);
    assert.throws(() => deserializeChampionshipModernSave(text));
    s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, text);
    assert.equal(app.canContinue().loadable, false);
    assert.equal(await app.continueGame(), null);
    assert.equal(app.getSession(), session); assert.deepEqual(app.getGameplayRngState(), before);
  }
  await app.dispose();
});
