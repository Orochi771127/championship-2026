import assert from 'node:assert/strict';
import test from 'node:test';
import {SUPPLEMENTS, SUPPLEMENT_IDS, SUPPLY_STACK_MAX, getSupplement, createTamerSupplies, normalizeTamerSupplies, supplyOwned, addSupply,
  supplyPurchase, spendSupply, applyRecoverySupply, ranchSupplyActive, startRanchSupply, ranchSupplyGrowthPercent, ranchSupplyNightCalm}
  from '../src/championship/contracts/productSupplements.js';

// Supplements S1 (docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md section 6).

const HOUR = 3600000;
const profile = fields => ({fields: {'050': 120, '058': 300, '054': 10, '05c': 40, '020': 97, ...fields}});

test('S1 sells four supplements for Bits: two that recover, two that run on the ranch', () => {
  assert.deepEqual(SUPPLEMENTS.map(s => [s.id, s.kind, s.bits]),
    [['supply:vigor', 'RECOVERY', 150], ['supply:snack', 'RECOVERY', 400], ['supply:growth', 'RANCH', 800], ['supply:sleep', 'RANCH', 300]]);
  assert.equal(getSupplement('supply:nope'), null);
});

test('the bag keeps at most 99 of a kind and an unknown shape is an empty bag', () => {
  assert.deepEqual(normalizeTamerSupplies('x'), createTamerSupplies());
  assert.deepEqual(normalizeTamerSupplies({version: 1, owned: {'supply:vigor': 500, bogus: 3, 'supply:snack': -1}, ranch: {'supply:vigor': 9, 'supply:growth': 77}}),
    {version: 1, owned: {'supply:vigor': 99}, armed: {}, ranch: {'supply:growth': 77}}, 'only ranch kinds keep an end time');
  let state = addSupply(null, 'supply:vigor', 98).state;
  assert.equal(addSupply(state, 'supply:vigor', 5).added, 1);
  assert.equal(addSupply(state, 'supply:nope', 1).added, 0);
  assert.equal(supplyOwned(state, 'supply:vigor'), 98);
});

test('buying checks the price and the stack; spending takes one', () => {
  assert.deepEqual(supplyPurchase(null, 'supply:growth', 2, 1599), {ok: false, reason: 'SUPPLY_NO_BITS', cost: 1600});
  const bought = supplyPurchase(null, 'supply:growth', 2, 1600);
  assert.equal(bought.ok, true); assert.equal(bought.cost, 1600); assert.equal(supplyOwned(bought.state, 'supply:growth'), 2);
  assert.equal(supplyPurchase(addSupply(null, 'supply:vigor', 99).state, 'supply:vigor', 1, 10 ** 6).reason, 'SUPPLY_STACK_FULL');
  assert.equal(supplyPurchase(null, 'supply:nope', 1, 10 ** 6).reason, 'SUPPLY_UNKNOWN');
  assert.equal(supplyPurchase(null, 'supply:vigor', 0, 10 ** 6).reason, 'SUPPLY_INVALID_QUANTITY');
  let state = spendSupply(bought.state, 'supply:growth');
  assert.equal(supplyOwned(state, 'supply:growth'), 1);
  state = spendSupply(state, 'supply:growth');
  assert.deepEqual(state.owned, {});
  assert.equal(spendSupply(state, 'supply:growth'), null);
});

test('recovery supplements act inside the native range and refuse when nothing would change', () => {
  const source = profile(), frozen = structuredClone(source);
  const drunk = applyRecoverySupply(source, 'supply:vigor');
  assert.deepEqual([drunk.profile.fields['050'], drunk.profile.fields['054']], [300, 40]);
  assert.deepEqual(source, frozen, 'the source profile is not changed');
  assert.equal(applyRecoverySupply(drunk.profile, 'supply:vigor').reason, 'SUPPLY_NO_EFFECT');
  const fed = applyRecoverySupply(source, 'supply:snack');
  assert.equal(fed.profile.fields['020'], 100, '97 + 5 stops at 100');
  assert.equal(applyRecoverySupply(fed.profile, 'supply:snack').reason, 'SUPPLY_NO_EFFECT');
  assert.equal(applyRecoverySupply(source, 'supply:growth').reason, 'SUPPLY_NOT_RECOVERY');
});

test('ranch supplements run on real time: growth for two hours (extended from its own end), sleep until the morning', () => {
  const now = 1_800_000_000_000;
  let started = startRanchSupply(null, 'supply:growth', now);
  assert.equal(started.until, now + 2 * HOUR);
  assert.equal(ranchSupplyGrowthPercent(started.state, now + HOUR), 15);
  assert.equal(ranchSupplyGrowthPercent(started.state, now + 2 * HOUR), 0, 'over at its end');
  started = startRanchSupply(started.state, 'supply:growth', now + HOUR);
  assert.equal(started.until, now + 4 * HOUR, 'a second one adds its two hours to the first');
  const morning = now + 9 * HOUR;
  const calm = startRanchSupply(started.state, 'supply:sleep', now, {morningMs: morning});
  assert.equal(calm.until, morning); assert.equal(ranchSupplyNightCalm(calm.state, morning - 1), true);
  assert.equal(ranchSupplyNightCalm(calm.state, morning), false);
  assert.equal(startRanchSupply(calm.state, 'supply:sleep', now + HOUR, {morningMs: morning}).reason, 'SUPPLY_ALREADY_ACTIVE');
  assert.equal(startRanchSupply(null, 'supply:sleep', now).reason, 'SUPPLY_NO_EFFECT', 'needs the next morning');
  assert.equal(startRanchSupply(null, 'supply:vigor', now).reason, 'SUPPLY_NOT_RANCH');
  assert.equal(ranchSupplyActive(null, 'supply:growth', now), false);
  assert.equal(SUPPLY_STACK_MAX, 99); assert.equal(SUPPLEMENT_IDS.length, 4);
});
