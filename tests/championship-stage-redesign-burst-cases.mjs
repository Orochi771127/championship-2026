// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution data, unlocks,
// metals, encyclopedia and the return of saved 覺醒體/究極體 partners to 成熟期.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import table from '../src/data/championship/product-burst-evolution.r1.json' with {type:'json'};
import {BURST_RULES,burstFormsFor,burstBasesFor,burstTierForRank,burstMultiplier,evaluateBurstConditions,normalizeBurstEvolution,
  createBurstEvolutionState,unlockBurstForms,forgetBurstUnlocks,earnedBurstForms,metalUnlockableForms,legacyBurstMigration} from '../src/championship/contracts/productBurstEvolution.js';
import {projectDatabaseBurst} from '../src/championship/database/databaseBurstEvolution.js';
import {fuseGachaShards,shardFusionTarget,normalizeCyberGacha,GACHA_METALS} from '../src/championship/gacha/cyberGacha.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {FULL_QA_ULTIMATES,createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {createNativeRaisingStarter} from '../src/championship/raising/nativeRaisingStarter.js';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const gen = i => species.records[i]?.generationIndex;
const native = g => species.records.map((r, i) => [r, i]).filter(([r, i]) => r.generationIndex === g && i >= 8 && i < 224).map(([, i]) => i);
const care = read('docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json');
const profileOf = (index, change = {}, narrow = {}) => {
  const p = structuredClone(createNativeRaisingStarter(restoreChannelRng(care.starterRng)));
  p.fields['000'] = index; Object.assign(p.fields, change); Object.assign(p.narrowFields, narrow); return p;
};

test('every 成熟期 bursts into its own former routes; every 覺醒體/究極體 is reached by one to three 成熟期', () => {
  assert.equal(spawnSync(process.execPath, ['scripts/build-product-burst-evolution.mjs', '--check'], {encoding: 'utf8'}).status, 0, 'table is current');
  assert.deepEqual({...BURST_RULES.tierMultiplier}, {1: 1.4, 2: 1.7});
  assert.equal(BURST_RULES.oncePerBattle, true);
  for (const base of native(4)) {
    const forms = burstFormsFor(base);
    assert.ok(forms.some(f => f.tier === 1), `${base} has a tier-1 form`);
    for (const f of forms) {
      assert.equal(gen(f.form), f.tier === 1 ? 5 : 6);
      assert.equal(f.thresholds.length, 26);
      if (f.tier === 2) assert.ok(forms.some(t => t.tier === 1 && t.form === f.via), `${base}: ${f.form} comes through its tier-1 ${f.via}`);
    }
  }
  for (const form of [...native(5), ...native(6)]) {
    const bases = burstBasesFor(form);
    assert.ok(bases.length >= 1 && bases.length <= 3, `${form}: ${bases}`);
  }
  assert.deepEqual([...burstBasesFor(229)], [...burstBasesFor(211)], 'the alternate battle form rides on its base form');
  assert.deepEqual([...burstBasesFor(230)], [...burstBasesFor(222)]);
  assert.equal(table.bases.length, native(4).length);
});

test('no rank gate (awakening raising, Owner 2026-11-02) and the approved multipliers', () => {
  assert.deepEqual([0, 3, 4, 5, 6, 9].map(burstTierForRank), [2, 2, 2, 2, 2, 2], 'a raised form is usable at any tamer rank');
  assert.equal(burstMultiplier(1), 1.4);
  assert.equal(burstMultiplier(2), 1.7);
  assert.equal(burstMultiplier(0), 1);
});

test('conditions read the partner itself; tier 2 needs its tier-1 form; metals unlock by tier', () => {
  const base = 72, [t1] = burstFormsFor(base).filter(f => f.tier === 1), t2 = burstFormsFor(base).find(f => f.tier === 2);
  const empty = evaluateBurstConditions(profileOf(base, {'024': 0, '028': 0, '114': 0}), t1);
  assert.equal(empty.met, false);
  const ready = profileOf(base, {'024': 40, '028': 30, '114': 99, '110': 99, '10c': 99});
  assert.equal(evaluateBurstConditions(ready, t1).met, true);
  const earned = earnedBurstForms(ready, []);
  assert.ok(earned.includes(t1.form));
  if (t2) assert.equal(earned.includes(t2.form), earned.includes(t2.via), 'tier 2 only with its tier-1 form');
  assert.deepEqual([...metalUnlockableForms(base, 'SSR', [])], burstFormsFor(base).filter(f => f.tier === 1).map(f => f.form));
  if (t2) {
    assert.deepEqual([...metalUnlockableForms(base, 'UR', [])], [], 'a UR waits for the tier-1 form');
    assert.deepEqual([...metalUnlockableForms(base, 'UR', [t2.via])], [t2.form]);
  }
  assert.deepEqual([...metalUnlockableForms(base, 'SR', [])], []);
});

test('the unlock record normalizes, refuses unknown forms and forgets a partner', () => {
  let state = createBurstEvolutionState();
  state = unlockBurstForms(state, 'p1', [137, 137, 152]);
  assert.deepEqual([...state.unlocks.p1], [137, 152]);
  assert.equal(unlockBurstForms(state, 'p1', [137]), null);
  assert.throws(() => normalizeBurstEvolution({version: 1, unlocks: {p1: [72]}, migrated: false}), /INVALID_BURST_EVOLUTION/);
  assert.throws(() => normalizeBurstEvolution({version: 1, unlocks: {}, extra: 1}), /INVALID_BURST_EVOLUTION/);
  assert.deepEqual({...forgetBurstUnlocks(state, 'p1').unlocks}, {});
});

test('a saved 覺醒體/究極體 returns to its 成熟期 ancestor, or the first 成熟期 that bursts into it', () => {
  const aw = burstFormsFor(72).find(f => f.tier === 1).form;
  const withHistory = legacyBurstMigration(profileOf(aw, {'14c': 72}));
  assert.equal(withHistory.base, 72);
  assert.ok(withHistory.unlock.includes(aw));
  const ul = burstFormsFor(72).find(f => f.tier === 2);
  if (ul) {
    const plan = legacyBurstMigration(profileOf(ul.form, {'14c': 228}));
    assert.equal(plan.base, burstBasesFor(ul.form)[0]);
    const form = burstFormsFor(plan.base).find(f => f.form === ul.form);
    assert.ok(plan.unlock.includes(ul.form) && plan.unlock.includes(form.via));
  }
  assert.equal(legacyBurstMigration(profileOf(72)), null);
  assert.equal(legacyBurstMigration(profileOf(34)), null);
});

test('encyclopedia: a 成熟期 lists its burst forms and conditions; a form lists its 成熟期; names wait for registration', () => {
  const base = projectDatabaseBurst(72, {registeredSpecies: [72]});
  assert.equal(base.kind, 'BASE');
  assert.ok(base.forms.every(f => f.revealed === false && Array.isArray(f.conditions)));
  assert.ok(base.forms.every(f => f.conditions.every(c => ['GTE', 'LTE'].includes(c.operator))));
  const shown = projectDatabaseBurst(72, {fullView: true});
  assert.ok(shown.forms.every(f => f.revealed));
  const form = projectDatabaseBurst(base.forms[0].formSpeciesIndex, {registeredSpecies: [72]});
  assert.equal(form.kind, 'FORM');
  assert.ok(form.bases.some(b => b.baseSpeciesIndex === 72 && b.revealed));
  assert.equal(projectDatabaseBurst(34, {fullView: true}), null);
});

test('three shards of one family fuse into its metal', () => {
  for (const shard of GACHA_METALS.filter(m => m.id.endsWith('-shard'))) {
    const target = shardFusionTarget(shard.id);
    assert.equal(target.family, shard.family);
    assert.ok(['SSR', 'UR'].includes(target.rarity));
  }
  const state = normalizeCyberGacha({...normalizeCyberGacha(null), metals: {'metal:emma-shard': 4}});
  const fused = fuseGachaShards(state, 'metal:emma-shard');
  assert.equal(fused.ok, true);
  assert.equal(fused.state.metals['metal:emma-shard'], 1);
  assert.equal(fused.state.metals['metal:emma'], 1);
  assert.equal(fuseGachaShards(fused.state, 'metal:emma-shard').reason, 'NOT_ENOUGH_SHARDS');
  assert.equal(fuseGachaShards(fused.state, 'metal:emma').reason, 'NOT_A_SHARD');
});

function harness() {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: species, gachaRandom: () => 0.5,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-02T00:00:00.000Z'});
  return {data, cages, make};
}

test('a save holding 究極體 partners loads them as 成熟期 with those forms unlocked; an SSR metal unlocks a tier-1 form', async () => {
  const {data, cages, make} = harness();
  const first = make();
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  // A save written before the redesign: the five partners are still 究極體 and nothing is unlocked or migrated.
  saved.raising.collection.forEach((entry, i) => {
    const ul = FULL_QA_ULTIMATES[i].speciesIndex;
    entry.speciesId = `species-${String(ul).padStart(3, '0')}`;
    entry.nativeProfile.fields['000'] = ul;
  });
  delete saved.progression.burstEvolution;
  const before = saved.raising.collection.map(e => e.nativeProfile.fields['000']);
  assert.ok(before.every(i => gen(i) === 6), 'the legacy save holds 究極體 partners');
  saved.progression.cyberGacha = {...normalizeCyberGacha(saved.progression.cyberGacha ?? null), welcome: true, metals: {'metal:emma': 2}};
  await first.dispose();
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  const app = make();
  await app.continueGame();
  try {
    for (const [i, entry] of saved.raising.collection.entries()) {
      const burst = app.getPartnerBurst(entry.instanceId);
      assert.ok(burst?.length, entry.instanceId);
      assert.ok(burst.some(f => (f.form === before[i] || f.alternates.includes(before[i])) && f.unlocked), `${entry.instanceId} keeps ${before[i]} unlocked`);
    }
    const partners = app.getCyberGachaFrame().partners;
    const target = partners.find(p => (app.getPartnerBurst(p.instanceId) ?? []).some(f => f.tier === 1 && !f.unlocked));
    assert.ok(target, 'a partner with a locked tier-1 form');
    // Awakening raising (Owner 2026-11-02): a metal on a 成熟期 feeds its focus form; it is learned in the ceremony.
    const used = app.gachaUseItem('metal:emma', target.instanceId, {mode: 'CATALYST'});
    assert.equal(used.ok, true, used.reason);
    assert.equal(used.kind, 'AWAKEN_ENERGY');
    assert.equal(used.tier, 1);
    assert.equal(used.amount, 50);
    assert.ok(!app.getPartnerBurst(target.instanceId).some(f => f.form === used.target && f.unlocked), 'energy alone does not teach the form');
    const stored = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.burstEvolution;
    assert.equal(stored.migrated, true);
    assert.equal(stored.version, 2);
    assert.equal(stored.energy[target.instanceId][used.target], 50);
  } finally { await app.dispose(); }
});
