import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY, CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION,
  deserializeChampionshipModernSave } from "../src/championship/app/championshipStandaloneSave.js";
import { nativeHuntSpeciesByIndex, nativeHuntCatalogForBiome, NATIVE_HUNT_MODIFIER_COUNTS,
  resolveNativeHuntPoolSources } from "../src/championship/hunt/capture/nativeHuntSources.js";
import { createNativeHuntPersistentState, projectNativeHuntPersistentSave,
  restoreNativeHuntPersistentSave } from "../src/championship/hunt/capture/nativeHuntPersistentState.js";
import { expandNativeHuntCandidates, generateNativeHuntIndividualPool } from "../src/championship/hunt/capture/nativeHuntIndividualPool.js";
import { restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const historyCpu = read("docs/research/HUNT_HISTORY_CPU_CHECK_2026-09-06.json");
const poolCpu = read("docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json");
const catalog = read("src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("docs/contracts/championship/raising-home-presentation.v1.json");
function storage() {
  const map = new Map();
  return { fail: false, keys: () => [...map.keys()], getItem: k => map.get(k) ?? null,
    removeItem: k => map.delete(k), setItem(k, v) { if (this.fail) throw Error("FULL"); map.set(k, v); } };
}
const appFor = s => createChampionshipStandaloneApp({ storage: s, catalog, cages,
  rngClock: () => ({ hour: 13, minute: 20, second: 50 }) });
// CPU save probes retain original packed-byte padding. The product codec
// projects only the functional entries and explicitly rejects padded rows.
const withoutPadding = rows => rows.map((row, i) => row.slice(0, NATIVE_HUNT_MODIFIER_COUNTS[i]));

test("formal source catalog matches all original individual/speed inputs and ordered history catalogs", () => {
  const actorCpu = read("docs/research/HUNT_ACTOR_ENTRY_CPU_CHECK_2026-09-06.json");
  for (const expected of poolCpu.speciesInputs) {
    const source = nativeHuntSpeciesByIndex(expected.speciesIndex);
    const { movementBase, ...individual } = source;
    assert.deepEqual(individual, expected);
    assert.equal(movementBase, actorCpu.speciesInputs.find(s => s.speciesIndex === expected.speciesIndex).movementBase);
    assert.ok(Object.isFrozen(source.ancestors));
  }
  assert.deepEqual(NATIVE_HUNT_MODIFIER_COUNTS, historyCpu.packedSpeciesCatalogs.map(c => c.length));
  for (let i = 0; i < 16; i++) assert.deepEqual(nativeHuntCatalogForBiome(i),
    historyCpu.packedSpeciesCatalogs[i].map(n => ({ speciesIndex: n & 0xfff, releaseMatchValue: n & 0x700 })));
});

test("128 normal field/season source selections match 640 original CPU candidate expansions", () => {
  const cpu = read("docs/research/HUNT_POOL_SOURCES_CPU_CHECK_2026-09-06.json");
  assert.equal(cpu.cases.length, 640);
  for (const row of cpu.cases) {
    const modifiers = NATIVE_HUNT_MODIFIER_COUNTS.map(n => Array(n).fill(row.modifier));
    const input = resolveNativeHuntPoolSources({ ...row, modifiers });
    assert.equal(input.baseCount, row.baseCount);
    assert.deepEqual(expandNativeHuntCandidates(input.candidateInput), row.candidates);
    input.candidateInput.reductionBytes[0] = 255;
    assert.equal(modifiers[row.nativeHuntIndex >> 1][0], row.modifier);
  }
  const modifiers = createNativeHuntPersistentState().modifiers;
  for (const bad of [{}, {nativeHuntIndex:0,season:null,modifiers}, {nativeHuntIndex:32,season:0,modifiers},
    {nativeHuntIndex:0,season:0,modifiers:null}]) assert.throws(() => resolveNativeHuntPoolSources(bad));
});

test("generated source species replace research inputs without changing actual native pool or RNG results", () => {
  for (const v of poolCpu.poolVectors) {
    const rng = restoreChannelRng(v.rngBefore);
    const actual = generateNativeHuntIndividualPool({ baseCount: v.baseCount,
      candidates: expandNativeHuntCandidates(v.candidateInput), speciesByIndex: nativeHuntSpeciesByIndex,
      released: v.released, rng });
    assert.deepEqual(actual.records, v.records, v.case);
    assert.deepEqual(rng.snapshot(), v.rngAfter, v.case);
  }
});

test("persistent codec matches original save/load including trait8, omitted fourth slot and low-four-bit modifiers", () => {
  assert.deepEqual(createNativeHuntPersistentState().history, historyCpu.initialHistory);
  for (const v of historyCpu.saveVectors) {
    assert.throws(() => projectNativeHuntPersistentSave({ history: v.historyBefore, modifiers: v.modifiersBefore }));
    const state = { history: v.historyBefore, modifiers: withoutPadding(v.modifiersBefore) };
    const before = structuredClone(state);
    const saved = projectNativeHuntPersistentSave(state);
    assert.equal(saved.history.entries.length, 3);
    assert.ok(saved.history.entries.every(e => !Object.hasOwn(e, "trait")));
    const restored = restoreNativeHuntPersistentSave(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(restored.history.entries.slice(0, 3), v.historyAfter.entries.slice(0, 3));
    assert.deepEqual(restored.history.entries[3], historyCpu.initialHistory.entries[3]);
    assert.deepEqual(restored.modifiers, withoutPadding(v.modifiersAfter));
    assert.deepEqual(state, before);
  }
});

test("normal New Game, Gate roundtrip, Save and Continue preserve one app-owned history at the existing key", async () => {
  const s = storage(), app = appFor(s);
  assert.equal(app.getHuntPersistentState(), null);
  await app.newGame();
  const before = app.getHuntPersistentState();
  assert.deepEqual(before, createNativeHuntPersistentState());
  const external = app.getHuntPersistentState(); external.modifiers[0][0] = 8; external.history.cursor = 2;
  app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate(); await app.beginHunt(); app.exitHunt();
  assert.deepEqual(app.getHuntPersistentState(), before);
  assert.equal(app.save().phase, "SAVED");
  const stored = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(stored.schemaVersion, 5); assert.deepEqual(s.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.deepEqual(stored.huntHistory, projectNativeHuntPersistentSave(before));
  await app.dispose();
  const restored = appFor(s); await restored.continueGame();
  assert.deepEqual(restored.getHuntPersistentState(), before);
  const entryRng=restoreChannelRng(stored.gameplayRng);entryRng.next(0x26);entryRng.next(0x26);
  assert.deepEqual(restored.getGameplayRngState(), {version:1,...entryRng.snapshot()});
  await restored.dispose();
});

test("nonempty original CPU history survives app Continue, failed write and retry without reseeding or zeroing", async () => {
  const s = storage(), initial = appFor(s); await initial.newGame(); initial.save(); await initial.dispose();
  const payload = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const v = historyCpu.saveVectors[0];
  payload.huntHistory = projectNativeHuntPersistentSave({ history: v.historyBefore, modifiers: withoutPadding(v.modifiersBefore) });
  const bytes = JSON.stringify(payload); s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, bytes);
  const app = appFor(s); assert.equal(app.canContinue().loadable, true); await app.continueGame();
  const expected = restoreNativeHuntPersistentSave(payload.huntHistory);
  assert.deepEqual(app.getHuntPersistentState(), expected);
  const rngBefore = app.getGameplayRngState(); s.fail = true;
  assert.equal(app.save().phase, "SAVE_FAILED"); assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), bytes);
  assert.deepEqual(app.getHuntPersistentState(), expected); assert.deepEqual(app.getGameplayRngState(), rngBefore);
  s.fail = false; assert.equal(app.save().phase, "SAVED");
  assert.deepEqual(JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY)).huntHistory, payload.huntHistory);
  await app.dispose();
});

test("v1..v4 lack Hunt history: migrate as null and keep R2 bytes, wallet and v4 RNG unchanged", async () => {
  for (const version of [1, 2, 3, 4]) {
    const s = storage(), initial = appFor(s); await initial.newGame(); initial.save(); await initial.dispose();
    const legacy = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    legacy.schemaVersion = version; delete legacy.huntHistory;
    delete legacy.creature.nativeProfile;delete legacy.raising.nativeHome;
    if (version < 4) delete legacy.gameplayRng;
    if (version < 3) delete legacy.instanceIdentity;
    if (version < 2) delete legacy.battleEconomy;
    const bytes = JSON.stringify(legacy); s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, bytes);
    const app = appFor(s); assert.equal(app.canContinue().loadable, true);
    assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), bytes);
    await app.continueGame(); assert.equal(app.getHuntPersistentState(), null);
    assert.deepEqual(app.getGameplayRngState(), legacy.gameplayRng ?? null);
    app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate(); await app.beginHunt(); app.exitHunt();
    assert.equal(app.getHuntPersistentState(), null); assert.equal(app.save().phase, "SAVED");
    const saved = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.equal(saved.schemaVersion, CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION); assert.equal(saved.huntHistory, null);
    assert.deepEqual(saved.shop, legacy.shop); assert.deepEqual(saved.gameplayRng, legacy.gameplayRng ?? null);
    assert.equal(deserializeChampionshipModernSave(bytes).raisingHome, legacy.raisingHome);
    await app.dispose();
  }
});

test("malformed current Hunt slices fail before replacing an open session or touching its state", async () => {
  const s = storage(), app = appFor(s); await app.newGame(); app.save();
  const original = JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const session = app.getSession(), history = app.getHuntPersistentState(), rng = app.getGameplayRngState();
  const mutations = [x => delete x.huntHistory, x => x.huntHistory.version = 2,
    x => x.huntHistory.history.entries.push({}), x => x.huntHistory.history.cursor = 3,
    x => x.huntHistory.history.entries[0].trait = 3, x => x.huntHistory.history.entries[0].name = "123456",
    x => x.huntHistory.modifiers.pop(), x => x.huntHistory.modifiers[0].pop(),
    x => x.huntHistory.modifiers[0][0] = 16, x => x.huntHistory.modifiers[0][0] = -1,
    x => x.huntHistory.encounter = [1, 2, 3], x => x.huntHistory.history.entries[0].romOffset = 100];
  for (const mutate of mutations) {
    const bad = structuredClone(original); mutate(bad); const bytes = JSON.stringify(bad);
    assert.throws(() => deserializeChampionshipModernSave(bytes)); s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, bytes);
    assert.equal(app.canContinue().loadable, false); assert.equal(await app.continueGame(), null);
    assert.equal(app.getSession(), session); assert.deepEqual(app.getHuntPersistentState(), history);
    assert.deepEqual(app.getGameplayRngState(), rng); assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), bytes);
  }
  await app.dispose();
});
