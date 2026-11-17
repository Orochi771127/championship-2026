import assert from 'node:assert/strict';
import test from 'node:test';
import {armSupply, disarmSupply, armedSupplies, supplyBattleProfile, supplySyncExpPercent, settleArmedSupplies, SUPPLY_BATTLE_SLOTS,
  SUPPLEMENTS, SUPPLEMENT_IDS, SUPPLY_STACK_MAX, getSupplement, createTamerSupplies, normalizeTamerSupplies, supplyOwned, addSupply,
  supplyPurchase, spendSupply, applyRecoverySupply, ranchSupplyActive, startRanchSupply, ranchSupplyGrowthPercent, ranchSupplyNightCalm}
  from '../src/championship/contracts/productSupplements.js';

// Supplements S1 (docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md section 6).

const HOUR = 3600000;
const profile = fields => ({fields: {'050': 120, '058': 300, '054': 10, '05c': 40, '020': 97, ...fields}});

test('the shelf: two that recover, two that run on the ranch, four carried into a battle', () => {
  assert.deepEqual(SUPPLEMENTS.map(s => [s.id, s.kind, s.bits]),
    [['supply:vigor', 'RECOVERY', 150], ['supply:snack', 'RECOVERY', 400], ['supply:growth', 'RANCH', 800], ['supply:sleep', 'RANCH', 300],
      ['supply:power', 'BATTLE', 600], ['supply:guard', 'BATTLE', 600], ['supply:gale', 'BATTLE', 600], ['supply:sync', 'BATTLE', 1000]]);
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
  assert.equal(SUPPLY_STACK_MAX, 99); assert.equal(SUPPLEMENT_IDS.length, 8);
});

// ---- The application ----
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
async function supplyApp(edit = save => save) {
  const data = new Map(), storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z'});
  const first = make(); await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose(); edit(save); data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make(); await app.continueGame();
  return {app, storage, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}
const PARTNER = 'championship:2026:instance:0001';

test('buying spends Bits and fills the bag in one save; a failed save changes neither', async () => {
  const {app, storage, saved} = await supplyApp();
  try {
    const before = app.getSuppliesFrame(), bits = before.bits;
    assert.deepEqual(before.items.map(item => [item.id, item.owned]), SUPPLEMENT_IDS.map(id => [id, 0]));
    storage.failing = true;
    assert.deepEqual(app.buySupply('supply:vigor', 2), {ok: false, reason: 'SAVE_FAILED'});
    storage.failing = false;
    assert.equal(app.getSuppliesFrame().bits, bits); assert.equal(app.getSuppliesFrame().items[0].owned, 0);
    const bought = app.buySupply('supply:vigor', 2);
    assert.deepEqual([bought.ok, bought.cost, bought.owned], [true, 300, 2]);
    assert.equal(app.getSuppliesFrame().bits, bits - 300);
    assert.equal(saved().progression.tamerSupplies.owned['supply:vigor'], 2);
    assert.equal(saved().shop.bits ?? saved().shop.wallet?.bits ?? app.getSuppliesFrame().bits, bits - 300);
    assert.equal(app.buySupply('supply:nope').reason, 'SUPPLY_UNKNOWN');
  } finally { await app.dispose(); }
});

test('a recovery supplement writes the partner and leaves the bag in one save; a full partner keeps it', async () => {
  const {app, saved, make} = await supplyApp(save => {
    save.progression.tamerSupplies = {version: 1, owned: {'supply:vigor': 1, 'supply:snack': 1}, armed: {}, ranch: {}};
    const fields = save.raising.collection.find(entry => entry.instanceId === PARTNER).nativeProfile.fields;
    fields['050'] = Math.max(10, fields['058'] - 50); fields['020'] = 40;
  });
  let reloaded = null;
  try {
    const profileOf = source => source.raising.collection.find(entry => entry.instanceId === PARTNER).nativeProfile.fields;
    assert.deepEqual(app.useSupply('supply:vigor', PARTNER), {ok: true, id: 'supply:vigor', instanceId: PARTNER});
    assert.equal(profileOf(saved())['050'], profileOf(saved())['058']);
    assert.equal(saved().progression.tamerSupplies.owned['supply:vigor'], undefined);
    assert.equal(app.useSupply('supply:vigor', PARTNER).reason, 'SUPPLY_NONE_OWNED');
    assert.equal(app.useSupply('supply:snack', PARTNER).ok, true);
    assert.equal(profileOf(saved())['020'], 45);
    await app.dispose();
    reloaded = make(); await reloaded.continueGame();
    assert.deepEqual(reloaded.getSuppliesFrame().items.map(item => item.owned), [0, 0, 0, 0, 0, 0, 0, 0]);
  } finally { await (reloaded ?? app).dispose(); }
});

test('a ranch supplement starts its clock in one save and shows until when it runs', async () => {
  const {app, saved} = await supplyApp(save => { save.progression.tamerSupplies = {version: 1, owned: {'supply:growth': 1}, armed: {}, ranch: {}}; });
  try {
    const used = app.useSupply('supply:growth');
    assert.equal(used.ok, true);
    const item = app.getSuppliesFrame().items.find(entry => entry.id === 'supply:growth');
    assert.equal(item.owned, 0); assert.equal(item.activeUntil, used.until);
    assert.equal(saved().progression.tamerSupplies.ranch['supply:growth'], used.until);
    assert.equal(app.useSupply('supply:growth').reason, 'SUPPLY_NONE_OWNED');
  } finally { await app.dispose(); }
});

// ---- S2: pre-battle supplements ----

test('a partner carries one pre-battle supplement: arming spends it, a second swaps the first back, disarming returns it', () => {
  assert.equal(SUPPLY_BATTLE_SLOTS, 1);
  let state = addSupply(addSupply(null, 'supply:power', 1).state, 'supply:guard', 1).state;
  assert.equal(armSupply(state, 'p1', 'supply:vigor').reason, 'SUPPLY_NOT_BATTLE');
  assert.equal(armSupply(state, 'p1', 'supply:gale').reason, 'SUPPLY_NONE_OWNED');
  let armed = armSupply(state, 'p1', 'supply:power');
  assert.deepEqual([armedSupplies(armed.state, 'p1'), armed.state.owned], [['supply:power'], {'supply:guard': 1}]);
  assert.equal(armSupply(addSupply(armed.state, 'supply:power', 1).state, 'p1', 'supply:power').reason, 'SUPPLY_ALREADY_ACTIVE', 'the same one does not stack');
  armed = armSupply(armed.state, 'p1', 'supply:guard');
  assert.deepEqual([armedSupplies(armed.state, 'p1'), armed.state.owned], [['supply:guard'], {'supply:power': 1}], 'the first went back to the bag');
  const off = disarmSupply(armed.state, 'p1', 'supply:guard');
  assert.deepEqual([off.state.armed, off.state.owned], [{}, {'supply:power': 1, 'supply:guard': 1}]);
  assert.equal(disarmSupply(off.state, 'p1', 'supply:guard').reason, 'SUPPLY_NONE_OWNED');
  // TAMER_TALENTS_T2_20261118: the save keeps up to two (the talent 補給帶) and how many battles each started with (長效).
  assert.deepEqual(normalizeTamerSupplies({version: 1, armed: {p1: [{id: 'supply:power'}, {id: 'supply:guard'}, {id: 'supply:power'}], p2: [{id: 'supply:vigor'}], p3: 'x'}}).armed,
    {p1: [{id: 'supply:power', battlesLeft: 1, battles: 1}, {id: 'supply:guard', battlesLeft: 1, battles: 1}]}, 'battle kinds only, each once');
});

test('a carried supplement adds one curve step on the battle copy, never past step 26, and is used up by the battle', () => {
  const source = {fields: {'084': 3, '088': 26, '090': 7}}, frozen = structuredClone(source);
  assert.deepEqual(supplyBattleProfile(source, ['supply:power']).fields, {'084': 4, '088': 26, '090': 7});
  assert.deepEqual(supplyBattleProfile(source, ['supply:guard']).fields, {'084': 3, '088': 26, '090': 7}, 'already at the top step');
  assert.deepEqual(supplyBattleProfile(source, ['supply:gale']).fields['090'], 8);
  assert.equal(supplyBattleProfile(source, []), source, 'nothing carried: the same profile');
  assert.deepEqual(source, frozen);
  assert.equal(supplySyncExpPercent(['supply:sync']), 50); assert.equal(supplySyncExpPercent(['supply:power']), 0);
  const state = armSupply(addSupply(null, 'supply:sync', 1).state, 'p1', 'supply:sync').state;
  assert.deepEqual(settleArmedSupplies(state, ['p1', 'p2']).armed, {});
  // A partner that did not fight keeps what it carries.
  assert.deepEqual(settleArmedSupplies(state, ['p2']).armed, {p1: [{id: 'supply:sync', battlesLeft: 1, battles: 1}]});
});

test('the app puts a supplement on a partner in one save, shows who carries it, and a battle party reads it only where Sync applies', async () => {
  const {app, saved} = await supplyApp(save => { save.progression.tamerSupplies = {version: 1, owned: {'supply:power': 1}, armed: {}, ranch: {}}; });
  try {
    assert.deepEqual(app.useSupply('supply:power', PARTNER), {ok: true, id: 'supply:power', instanceId: PARTNER, armed: true});
    assert.deepEqual(saved().progression.tamerSupplies.armed, {[PARTNER]: [{id: 'supply:power', battlesLeft: 1, battles: 1}]});
    assert.deepEqual(app.getSuppliesFrame().items.find(item => item.id === 'supply:power').carriedBy, [PARTNER]);
    const plain = await app.prepareBattleParty(null, [PARTNER], {});
    const boosted = await app.prepareBattleParty(null, [PARTNER], {sync: {capped: false}});
    if (plain.ok && boosted.ok) {
      assert.deepEqual(plain.individuals[0].supplyIds, [], 'no Sync, no supplement (password, link and online battles)');
      assert.deepEqual(boosted.individuals[0].supplyIds, ['supply:power']);
      const base = saved().raising.collection.find(entry => entry.instanceId === PARTNER).nativeProfile.fields['084'];
      assert.equal(boosted.individuals[0].nativeProfile.fields['084'], Math.min(26, base + 1));
    }
    assert.deepEqual(app.unequipSupply('supply:power', PARTNER), {ok: true, id: 'supply:power', instanceId: PARTNER});
    assert.deepEqual(saved().progression.tamerSupplies, {version: 1, owned: {'supply:power': 1}, armed: {}, ranch: {}});
  } finally { await app.dispose(); }
});
