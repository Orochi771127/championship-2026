import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {prepareNativeHuntEntry, appendNativeRareLureActor} from '../src/championship/hunt/capture/nativeHuntEntryTransaction.js';
import {HUNT_HERD_RULES, huntHerdCount, planHuntHerd, appendProductHuntHerds} from '../src/championship/hunt/capture/productHuntHerds.js';

// HUNT_HERDS_20261117 (fusion plan P3, docs/planning/LINE_FUSION_AND_HUNT_HERDS_PLAN_2026-11-17_ZH_TW.md section 5).

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
function makeApp(options = {}) {
  const data = new Map(), storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
  return createChampionshipStandaloneApp({storage, locks: null, cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages,
    catalog: read('src/data/championship/catalogs/creature-species.r1.json'), rngClock: () => ({hour: 13, minute: 20, second: 50}), ...options});
}
const speciesOf = wild => Number(String(wild.speciesId ?? wild.speciesIndex).replace(/\D/g, ''));

test('a herd adds 40 % of the native count, at least two and at most six, and never past twenty in all', () => {
  assert.deepEqual(HUNT_HERD_RULES, {share: 0.4, min: 2, max: 6, total: 20});
  assert.deepEqual([1, 4, 6, 8, 10, 13, 15, 16, 18, 19, 20, 23].map(n => huntHerdCount(n)), [2, 2, 2, 3, 4, 5, 5, 4, 2, 1, 0, 0]);
  assert.equal(huntHerdCount(8, 9), 3, 'a lured partner counts toward the twenty, not toward the share');
  assert.equal(huntHerdCount(17, 18), 2);
  assert.equal(huntHerdCount(0), 0);
});

test('the herd fills the species with the fewest partners first, then the more common one, and adds no species', () => {
  const table = [{speciesIndex: 30, weight: 5}, {speciesIndex: 31, weight: 40}, {speciesIndex: 32, weight: 20}, {speciesIndex: 99, weight: 90}];
  // Native: 30, 31, 31, 32, 30, 31 -> 30 x2, 31 x3, 32 x1; six partners take two more.
  assert.deepEqual(planHuntHerd([30, 31, 31, 32, 30, 31], table), [32, 32], 'the single one first, then the tie 30/32 goes to the commoner 32');
  assert.deepEqual(planHuntHerd([30, 31, 32, 30, 31, 32, 30, 31], table), [32, 31, 32], 'ties go by table weight: 31 (40) before 32 (20) before 30 (5)');
  const plan = planHuntHerd([30, 31, 32, 30, 31, 32, 30, 31, 32, 30], table);
  assert.equal(plan.length, 4);
  assert.ok(plan.every(species => [30, 31, 32].includes(species)), 'species 99 is on the table but not out, so it is never added');
  assert.deepEqual(planHuntHerd([], table), []);
});

test('the herd is built after the untouched native and lured actors, of their species only', async () => {
  const app = makeApp();
  await app.newGame();
  try {
    app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
    const prepare = () => prepareNativeHuntEntry({biomeId: app.getConfirmedGate().biomeId, clock: app.getCalendar(),
      rngSnapshot: app.getGameplayRngState(), persistentState: app.getHuntPersistentState()});
    const native = prepare(), before = structuredClone(native.encounter.actors);
    const herded = appendProductHuntHerds(prepare());
    const count = before.length, added = herded.encounter.actors.length - count;
    assert.equal(added, huntHerdCount(count));
    assert.ok(herded.encounter.actors.length <= 20);
    assert.deepEqual(structuredClone(herded.encounter.actors.slice(0, count)), before, 'the native actors are byte-identical');
    const nativeSpecies = new Set(before.map(actor => actor.speciesIndex));
    for (const [offset, actor] of herded.encounter.actors.slice(count).entries()) {
      assert.ok(nativeSpecies.has(actor.speciesIndex), 'no new species, so no new atlas');
      assert.equal(actor.herd, true);
      assert.equal(actor.individual.fields['000'], actor.speciesIndex);
      assert.equal(actor.individual.fields['004'], count + offset, 'its slot continues the encounter');
      assert.ok(actor.positionQ12 && actor.ai.speedQ12 > 0);
    }
    assert.equal(herded.encounter.records.length, herded.encounter.actors.length);
    assert.deepEqual(herded.herd.added, herded.encounter.actors.slice(count).map(actor => actor.speciesIndex));
    assert.notDeepEqual(herded.rng.snapshot(), native.rng.snapshot(), 'the herd continues the hunt RNG after the native draws');
    // With the rare lure: the lured partner stays where it was and a species only it brought is not filled.
    const lured = appendNativeRareLureActor(prepare()), both = appendProductHuntHerds(lured);
    assert.deepEqual(structuredClone(both.encounter.actors.slice(0, count + 1)), structuredClone(lured.encounter.actors));
    if (!nativeSpecies.has(lured.rareLure.speciesIndex))
      assert.ok(both.encounter.actors.slice(count + 1).every(actor => actor.speciesIndex !== lured.rareLure.speciesIndex));
    assert.ok(both.encounter.actors.length <= 20);
  } finally { await app.dispose(); }
});

async function fieldSpecies(options) {
  const app = makeApp(options);
  await app.newGame();
  try {
    app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
    app.getHuntLoadout().selectEquipment('ROPE', 'championship:2026:hunt-item:rope-i');
    await app.beginHunt();
    return app.getHuntRuntime().getWildCreatures().map(speciesOf);
  } finally { await app.dispose(); }
}

test('a normal hunt shows the herd; with the switch off it shows the native head count', async () => {
  const native = await fieldSpecies({huntHerds: false}), herded = await fieldSpecies({});
  assert.equal(herded.length, native.length + huntHerdCount(native.length));
  assert.deepEqual(herded.slice(0, native.length), native, 'the native partners come first, unchanged');
  assert.deepEqual([...new Set(herded)].sort(), [...new Set(native)].sort(), 'the same species');
  const counts = list => { const map = {}; for (const species of list) map[species] = (map[species] ?? 0) + 1; return Object.values(map); };
  assert.ok(Math.min(...counts(herded)) >= Math.min(2, Math.min(...counts(native)) + 1) || herded.length - native.length < new Set(native).size,
    'single partners are filled first');
});
