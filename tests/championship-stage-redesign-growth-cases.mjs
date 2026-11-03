// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): natural growth ends at 成熟期.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import {PRODUCT_GROWTH_RULES,PRODUCT_HATCH_POOL,growthBranchHistoryIndex,productGeneration} from '../src/championship/contracts/productGrowthRules.js';
import {selectProductHatchSpecies,productLifeThreshold,evaluateProductEvolution,productRebirth,isFinalNaturalStage,
  PRODUCT_NO_LIFE_LIMIT} from '../src/championship/raising/productGrowthPolicy.js';
import {selectNativeHatchSpecies} from '../src/championship/raising/nativeIndividualEvolution.js';
import {createNativeRaisingStarter} from '../src/championship/raising/nativeRaisingStarter.js';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';

const care = JSON.parse(fs.readFileSync('docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json', 'utf8'));
const hatch = JSON.parse(fs.readFileSync('docs/research/RAISING_HATCH_CPU_CHECK_2026-09-08.json', 'utf8'));
const starter = () => createNativeRaisingStarter(restoreChannelRng(care.starterRng));
const as = (index, change = {}) => { const p = structuredClone(starter()); p.fields['000'] = index; Object.assign(p.fields, change); return p; };
const generation = i => productGeneration(i);

test('a fresh egg hatches a 幼年期 I species for every channel value; ancestry keeps the native choice', () => {
  assert.deepEqual({...PRODUCT_HATCH_POOL}, {first: 8, count: 12});
  const seen = new Set();
  for (let roll = 0; roll <= 101; roll++) {
    const calls = [];
    const target = selectProductHatchSpecies(as(0, {'140': 228, '158': 228}), {next: c => { calls.push(c); return roll; }}, 3);
    assert.equal(generation(target), 1, `roll ${roll} -> ${target}`);
    assert.deepEqual(calls, [0x29]);
    seen.add(target);
  }
  assert.equal(seen.size, 12);
  for (const row of hatch.selections.filter(r => r.first !== 228)) {
    const p = as(0, {'140': row.first, '158': row.second});
    const rng = () => ({next: () => row.roll});
    assert.equal(selectProductHatchSpecies(p, rng(), 3), selectNativeHatchSpecies(p, rng(), 3));
  }
});

test('growth tables: native branches up to 成長期, none from 成熟期 on, three appended branches at the end', () => {
  // Natives and the playable originals' own lists (231..240, Owner 2026-11-03).
  assert.equal(PRODUCT_GROWTH_RULES.rules.length, 240 - 8 + 1);
  const appended = [[19, 31], [31, 63], [56, 93]];
  // Playable originals are checked first where the 10-29 proposal placed them; history keeps native slots.
  const inserted = new Map([[23, 231], [30, 237], [37, 234], [42, 235], [49, 236]]);
  PRODUCT_GROWTH_RULES.rules.forEach((list, i) => {
    const source = i + 8, native = lifecycle.rules[i] ?? [];
    if (generation(source) >= 4) { assert.deepEqual([...list], [], `species ${source}`); return; }
    const own = list.filter(r => !(inserted.get(source) === r.target));
    assert.deepEqual(JSON.parse(JSON.stringify(own.slice(0, native.length))), native, `species ${source} keeps native order`);
    const extra = own.slice(native.length).map(r => [source, r.target]);
    if (source < 224) assert.deepEqual(extra, appended.filter(([s]) => s === source));
    if (inserted.has(source)) assert.equal(list.findIndex(r => r.target === inserted.get(source)) < native.length, true);
    for (const rule of list) assert.equal(generation(rule.target), generation(source) + 1);
    // The completed-route slots stay native: native branches keep theirs, the rest follow.
    const slots = list.map((rule, branch) => growthBranchHistoryIndex(source, branch));
    assert.deepEqual([...slots].sort((a, b) => a - b), list.map((_, k) => k), `species ${source} slots`);
    native.forEach((rule, k) => assert.equal(slots[list.findIndex(r => r.target === rule.target && r.kind === rule.kind
      && r.thresholds.every((v, t) => v === rule.thresholds[t]))], k));
  });
  assert.deepEqual([231, 237, 239].map(s => PRODUCT_GROWTH_RULES.rules[s - 8].map(r => r.target)), [[232], [94, 88], [240]]);
  // Every species that could only wait for its lifetime can now evolve early.
  for (const [source] of appended.slice(0, 2)) assert.ok(PRODUCT_GROWTH_RULES.rules[source - 8].some(r => r.kind === 0));
  // MA30 has a source.
  assert.ok(PRODUCT_GROWTH_RULES.rules.some(list => list.some(r => r.target === 93)));
  assert.equal(JSON.stringify(lifecycle.rules[56 - 8]).includes('93'), false, 'the native table is untouched');
});

test('成熟期 never reaches the end of its life and never evolves; earlier stages keep native life and rules', () => {
  assert.equal(productLifeThreshold(as(72), 17280), PRODUCT_NO_LIFE_LIMIT);
  assert.equal(productLifeThreshold(as(160), 24480), PRODUCT_NO_LIFE_LIMIT);
  assert.equal(productLifeThreshold(as(34), 11520), 11520);
  assert.ok(isFinalNaturalStage(72) && isFinalNaturalStage(200) && !isFinalNaturalStage(34));
  const rng = {next: () => { throw new Error('no draw expected'); }};
  for (const lifetime of [false, true]) {
    const result = evaluateProductEvolution(as(72, {'024': 99, '028': 99}), {rank: 9, roster: [72], lifetime, lifeThreshold: PRODUCT_NO_LIFE_LIMIT}, rng);
    assert.equal(result.code, 0);
    assert.equal(result.target, null);
  }
});

test('rebirth is the player choice for 成熟期 only: cycle +1 and the native egg target', () => {
  const mature = as(72);
  const before = mature.narrowFields['03c'];
  const result = productRebirth(mature);
  assert.equal(result.ok, true);
  assert.equal(result.profile.narrowFields['03c'], Math.min(100, before + 1));
  assert.equal(result.target, Math.min(7, before + 1));
  assert.ok(result.target >= 0 && result.target <= 7);
  assert.deepEqual(productRebirth(as(34)), {ok: false, reason: 'NOT_FINAL_STAGE'});
});
