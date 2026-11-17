// TAMER_TALENTS_T2_20261118: eight more talent nodes read where the game works a value out.
//   breeder  自動化 (core clock), 藥膳 (supplement numbers), 長效 (battles a carried supplement lasts)
//   trader   賞金 (battle purse), 巡邏 (patrol pod), 塔 (tower first clear), 熟客 (first supplement a day), 補給帶 (two carried)
// Plan: docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 4.2, 4.4 and 6.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {burstBasesFor} from '../src/championship/contracts/productBurstEvolution.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {BATTLE_CREATURE_STAT_MAP} from '../src/championship/battle/battleCreatureBuild.js';
import {TALENT_NODES, TALENT_LINES, TALENT_TIER_GATE, TALENT_WIRED_KEYS, talentOpen, talentValue, learnTalent, talentRefusal}
  from '../src/championship/contracts/productTamerTalents.js';
import {SUPPLY_BATTLE_SLOTS, SUPPLY_BATTLE_SLOTS_MAX, SUPPLY_BATTLES_MAX, addSupply, armSupply, disarmSupply, armedSupplies, armedSupplyItems,
  settleArmedSupplies, normalizeTamerSupplies, supplyBoosted, supplyValue, supplySyncExpPercent, applyRecoverySupply, startRanchSupply,
  ranchSupplyGrowthPercent, supplyDiscount, supplyPurchase, supplyOwned} from '../src/championship/contracts/productSupplements.js';
import {TAMER_TALENT_COPY, talentEffectText} from '../src/championship/text/tamerTalentText.js';
import {AUTOMATION_RULES} from '../src/championship/gacha/ranchAutomation.js';
import {patrolRate, PATROL_QUICK_HOURS} from '../src/championship/contracts/productJourney.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const T2_KEYS = ['coreTimePercent', 'supplementPercent', 'supplementBattles', 'battleBitsPercent', 'patrolPercent', 'towerRewardPercent',
  'firstSupplyDiscountPercent', 'supplySlots'];
const nodeOf = key => TALENT_NODES.find(node => node.key === key);
const maxed = ids => ({version: 1, level: 50, exp: 0, nodes: Object.fromEntries(ids.map(id => [id, TALENT_NODES.find(node => node.id === id).max])), keystones: {}, respecs: 0});

// ---- the tree ---------------------------------------------------------------------------------

test('T2 opens eight nodes, each with its own line of copy in five languages', () => {
  for (const key of T2_KEYS) {
    assert.ok(TALENT_WIRED_KEYS.has(key), key);
    assert.ok(talentOpen(nodeOf(key).id), key);
    for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentEffectText(nodeOf(key), 1, locale).length > 0, `${key} ${locale}`);
  }
  assert.equal(TALENT_WIRED_KEYS.size, 18);
  assert.equal(talentEffectText(nodeOf('firstSupplyDiscountPercent'), 2, 'zh-Hant'), '每天第 1 個補品 −30%');
  assert.equal(talentEffectText(nodeOf('supplySlots'), 1, 'zh-Hant'), '+1 格戰前補品');
});

test('the breeder and the trader can now reach tier three with open nodes only', () => {
  const openPoints = (line, tier) => TALENT_NODES.filter(node => node.line === line && node.tier === tier && talentOpen(node.id))
    .reduce((sum, node) => sum + node.max * node.cost, 0);
  for (const line of ['breeder', 'trader']) {
    assert.ok(openPoints(line, 1) >= TALENT_TIER_GATE[2], `${line}: tier two opens`);
    assert.ok(openPoints(line, 1) + openPoints(line, 2) >= TALENT_TIER_GATE[3], `${line}: tier three opens`);
  }
  // Learned in order with points to spare, the belt (three points, one rank) is taken once 14 points are in the line.
  let state = null;
  const learn = id => { const next = learnTalent(state, id, 76); assert.ok(next, `${id}: ${talentRefusal(state, id, 76)}`); state = next; };
  for (const id of ['trader.bounty', 'trader.crystal']) for (let rank = 0; rank < 3; rank++) learn(id);
  assert.equal(talentRefusal(state, 'trader.belt', 76), 'TALENT_TIER_LOCKED');
  for (const id of ['trader.patrol', 'trader.tower', 'trader.regular']) for (let rank = 0; rank < 3; rank++) learn(id);
  learn('trader.belt');
  assert.equal(talentRefusal(state, 'trader.belt', 76), 'TALENT_MAX');
  assert.deepEqual([talentValue(state, 'supplySlots'), talentValue(state, 'battleBitsPercent'), talentValue(state, 'firstSupplyDiscountPercent')], [1, 15, 45]);
  for (const line of TALENT_LINES) assert.ok(openPoints(line, 1) >= 0);
});

// ---- the supplement rules the talents act on -------------------------------------------------------

test('藥膳: the snack, the growth powder and the Sync drink give that much more; a curve step stays one step', () => {
  assert.deepEqual([supplyBoosted(5, 0), supplyBoosted(5, 10), supplyBoosted(5, 30)], [5, 6, 7]);
  assert.deepEqual([supplyBoosted(15, 30), supplyBoosted(50, 30), supplyBoosted(50, -20), supplyBoosted(50, 1e9)], [20, 65, 50, 100]);
  assert.deepEqual(['supply:snack', 'supply:growth', 'supply:sync', 'supply:power', 'supply:vigor'].map(id => supplyValue(id, 20)), [6, 18, 60, 0, 0]);
  const fed = applyRecoverySupply({fields: {'020': 90}}, 'supply:snack', {bonusPercent: 30});
  assert.equal(fed.profile.fields['020'], 97);
  assert.equal(applyRecoverySupply({fields: {'020': 96}}, 'supply:snack', {bonusPercent: 30}).profile.fields['020'], 100, 'still at most 100');
  const powder = startRanchSupply(addSupply(null, 'supply:growth', 1).state, 'supply:growth', 1000).state;
  assert.deepEqual([ranchSupplyGrowthPercent(powder, 2000), ranchSupplyGrowthPercent(powder, 2000, 30), ranchSupplyGrowthPercent(null, 2000, 30)], [15, 20, 0]);
  assert.deepEqual([supplySyncExpPercent(['supply:sync']), supplySyncExpPercent(['supply:sync'], 30), supplySyncExpPercent(['supply:power'], 30)], [50, 65, 0]);
});

test('長效: a carried supplement lasts more settled battles; once it has been through one it stays until it is used up', () => {
  assert.equal(SUPPLY_BATTLES_MAX, 4);
  let state = addSupply(addSupply(null, 'supply:power', 2).state, 'supply:guard', 1).state;
  state = armSupply(state, 'p1', 'supply:power', {battles: 3}).state;
  assert.deepEqual(armedSupplyItems(state, 'p1'), [{id: 'supply:power', battlesLeft: 3, battles: 3, whole: true}]);
  assert.equal(disarmSupply(state, 'p1', 'supply:power').ok, true, 'a whole one comes off');
  state = settleArmedSupplies(state, ['p1']);
  assert.deepEqual(armedSupplyItems(state, 'p1'), [{id: 'supply:power', battlesLeft: 2, battles: 3, whole: false}]);
  assert.equal(disarmSupply(state, 'p1', 'supply:power').reason, 'SUPPLY_PARTLY_USED', 'no second life from the bag');
  assert.equal(armSupply(state, 'p1', 'supply:guard', {battles: 3}).reason, 'SUPPLY_PARTLY_USED', 'and it is not swapped out');
  assert.equal(supplyOwned(state, 'supply:power'), 1);
  state = settleArmedSupplies(settleArmedSupplies(state, ['p1', 'p1']), ['p1']);
  assert.deepEqual(state.armed, {}, 'three battles and it is gone (a partner named twice still counts one battle)');
  // The save keeps the count and what it started with; odd numbers are clamped.
  assert.deepEqual(normalizeTamerSupplies({version: 1, armed: {p1: [{id: 'supply:power', battlesLeft: 2, battles: 3}], p2: [{id: 'supply:gale', battlesLeft: 9}],
    p3: [{id: 'supply:sync', battlesLeft: 3, battles: 1}], p4: [{id: 'supply:guard'}]}}).armed,
  {p1: [{id: 'supply:power', battlesLeft: 2, battles: 3}], p2: [{id: 'supply:gale', battlesLeft: 4, battles: 4}],
    p3: [{id: 'supply:sync', battlesLeft: 3, battles: 3}], p4: [{id: 'supply:guard', battlesLeft: 1, battles: 1}]});
  assert.equal(armSupply(addSupply(null, 'supply:power', 1).state, 'p1', 'supply:power', {battles: 99}).state.armed.p1[0].battlesLeft, 4);
});

test('補給帶: a partner carries two different supplements; a third swaps the first whole one back', () => {
  assert.deepEqual([SUPPLY_BATTLE_SLOTS, SUPPLY_BATTLE_SLOTS_MAX], [1, 2]);
  let state = ['supply:power', 'supply:guard', 'supply:gale'].reduce((bag, id) => addSupply(bag, id, 1).state, null);
  state = armSupply(state, 'p1', 'supply:power', {slots: 2}).state;
  state = armSupply(state, 'p1', 'supply:guard', {slots: 2}).state;
  assert.deepEqual(armedSupplies(state, 'p1'), ['supply:power', 'supply:guard']);
  state = armSupply(state, 'p1', 'supply:gale', {slots: 2}).state;
  assert.deepEqual([armedSupplies(state, 'p1'), state.owned], [['supply:guard', 'supply:gale'], {'supply:power': 1}]);
  // Without the belt again (a respec): putting one on sends the others back until one slot is left.
  const one = armSupply(state, 'p1', 'supply:power', {slots: 1});
  assert.deepEqual([armedSupplies(one.state, 'p1'), one.state.owned], [['supply:power'], {'supply:guard': 1, 'supply:gale': 1}]);
  assert.deepEqual(armedSupplies(armSupply(state, 'p1', 'supply:power', {slots: 9}).state, 'p1'), ['supply:gale', 'supply:power'], 'never more than two');
  assert.equal(normalizeTamerSupplies({version: 1, armed: {p1: [{id: 'supply:power'}, {id: 'supply:guard'}, {id: 'supply:gale'}]}}).armed.p1.length, 2);
});

test('熟客: the first unit bought each day costs less; the day is marked only when the discount is used', () => {
  const deal = {day: '2026-11-18', discountPercent: 45};
  assert.deepEqual([supplyDiscount(null, 'supply:power', deal), supplyDiscount(null, 'supply:vigor', {day: '2026-11-18', discountPercent: 15}),
    supplyDiscount(null, 'supply:power', {day: 'today', discountPercent: 45}), supplyDiscount(null, 'supply:power', {day: '2026-11-18'})], [270, 22, 0, 0]);
  const first = supplyPurchase(null, 'supply:power', 2, 5000, deal);
  assert.deepEqual([first.ok, first.cost, first.discount, first.state.discountDay], [true, 930, 270, '2026-11-18'], 'one unit of the two is cheaper');
  const second = supplyPurchase(first.state, 'supply:power', 1, 5000, deal);
  assert.deepEqual([second.cost, second.discount], [600, 0]);
  assert.equal(supplyPurchase(second.state, 'supply:power', 1, 5000, {day: '2026-11-19', discountPercent: 45}).cost, 330, 'a new day');
  const plain = supplyPurchase(null, 'supply:power', 1, 5000, {day: '2026-11-18', discountPercent: 0});
  assert.deepEqual([plain.cost, plain.state.discountDay], [600, undefined], 'no talent, no mark');
  assert.equal(supplyPurchase(null, 'supply:power', 1, 329, deal).reason, 'SUPPLY_NO_BITS');
  assert.equal(supplyPurchase(null, 'supply:power', 1, 330, deal).ok, true, 'the discounted price is what is checked');
  assert.equal(normalizeTamerSupplies({version: 1, discountDay: 'x'}).discountDay, undefined);
  assert.equal(normalizeTamerSupplies(first.state).discountDay, '2026-11-18');
});

// ---- the app ---------------------------------------------------------------------------------------

function qaHarness(options = {}) {
  const data = new Map(), storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z', ...options});
  return {data, storage, cages, make};
}
async function talentApp(talents, extra = save => save) {
  const {data, storage, cages, make} = qaHarness();
  const first = make();
  await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  if (talents) save.progression.tamerTalents = talents;
  extra(save);
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, storage, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}
const PARTNER = 'championship:2026:instance:0001';
const TRADER = ['trader.bounty', 'trader.crystal', 'trader.patrol', 'trader.tower', 'trader.regular', 'trader.belt'];
const BREEDER = ['breeder.care', 'breeder.nightWatch', 'breeder.syncFusion', 'breeder.lineAffinity', 'breeder.automation', 'breeder.herbal', 'breeder.lasting'];

test('app 熟客: the shelf shows the day\'s first price, the buy pays it in one save, and the next one is full price', async () => {
  const {app, saved} = await talentApp(maxed(TRADER));
  try {
    const before = app.getSuppliesFrame(), bits = before.bits, power = () => app.getSuppliesFrame().items.find(item => item.id === 'supply:power');
    assert.deepEqual([power().bits, power().price], [600, 330]);
    assert.deepEqual(before.items.map(item => item.price < item.bits), before.items.map(() => true), 'whichever is bought first');
    const bought = app.buySupply('supply:power', 1);
    assert.deepEqual([bought.ok, bought.cost, bought.discount], [true, 330, 270]);
    assert.equal(app.getSuppliesFrame().bits, bits - 330);
    assert.match(saved().progression.tamerSupplies.discountDay, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(app.getSuppliesFrame().items.map(item => item.price), app.getSuppliesFrame().items.map(item => item.bits), 'the day\'s discount is used');
    assert.equal(app.buySupply('supply:power', 1).cost, 600);
  } finally { await app.dispose(); }
});

test('app without the talents: full price, one slot, one battle, the plain numbers', async () => {
  const {app, saved} = await talentApp(null, save => { save.progression.tamerSupplies = {version: 1, owned: {'supply:power': 1, 'supply:guard': 1}, armed: {}, ranch: {}}; });
  try {
    const frame = app.getSuppliesFrame();
    assert.deepEqual([frame.slots, frame.battles], [1, 1]);
    assert.deepEqual(frame.items.map(item => item.price), frame.items.map(item => item.bits));
    assert.deepEqual(['supply:snack', 'supply:growth', 'supply:sync'].map(id => frame.items.find(item => item.id === id).value), [5, 15, 50]);
    assert.equal(app.buySupply('supply:vigor', 1).discount, 0);
    assert.equal(saved().progression.tamerSupplies.discountDay, undefined);
    assert.equal(app.useSupply('supply:power', PARTNER).ok, true);
    assert.equal(app.useSupply('supply:guard', PARTNER).ok, true);
    assert.deepEqual(saved().progression.tamerSupplies.armed, {[PARTNER]: [{id: 'supply:guard', battlesLeft: 1, battles: 1}]}, 'the first went back');
  } finally { await app.dispose(); }
});

test('app 補給帶 and 長效: two supplements on one partner, four battles each, both read by a Sync battle party', async () => {
  const {app, saved} = await talentApp(maxed([...TRADER, ...BREEDER]), save => {
    save.progression.tamerSupplies = {version: 1, owned: {'supply:power': 1, 'supply:gale': 1, 'supply:snack': 1}, armed: {}, ranch: {}};
    save.raising.collection.find(entry => entry.instanceId === PARTNER).nativeProfile.fields['020'] = 50;
  });
  try {
    const frame = app.getSuppliesFrame();
    assert.deepEqual([frame.slots, frame.battles], [2, 4]);
    assert.deepEqual(['supply:snack', 'supply:growth', 'supply:sync'].map(id => frame.items.find(item => item.id === id).value), [7, 20, 65], '藥膳 at three ranks');
    assert.equal(app.useSupply('supply:power', PARTNER).ok, true);
    assert.equal(app.useSupply('supply:gale', PARTNER).ok, true);
    assert.deepEqual(saved().progression.tamerSupplies.armed, {[PARTNER]: [{id: 'supply:power', battlesLeft: 4, battles: 4}, {id: 'supply:gale', battlesLeft: 4, battles: 4}]});
    assert.deepEqual(app.getSuppliesFrame().items.find(item => item.id === 'supply:gale').carried, [{instanceId: PARTNER, battlesLeft: 4, whole: true}]);
    const party = await app.prepareBattleParty(null, [PARTNER], {sync: {capped: false}});
    if (party.ok) assert.deepEqual(party.individuals[0].supplyIds, ['supply:power', 'supply:gale']);
    // 藥膳 on the snack: +7 affection, written with the bag in one save.
    assert.equal(app.useSupply('supply:snack', PARTNER).ok, true);
    assert.equal(saved().raising.collection.find(entry => entry.instanceId === PARTNER).nativeProfile.fields['020'], 57);
  } finally { await app.dispose(); }
});

test('app 巡邏 and 結晶: the patrol pays both shares and the receipt says what was really added', async () => {
  const base = patrolRate(null) * PATROL_QUICK_HOURS;
  const plain = await talentApp(null);
  try {
    const paid = plain.app.quickPatrol();
    assert.deepEqual([paid.ok, paid.crystals], [true, base]);
    assert.equal(plain.app.getJourneyFrame().crystals, base);
  } finally { await plain.app.dispose(); }
  const {app} = await talentApp(maxed(TRADER));
  try {
    const before = app.getJourneyFrame().crystals, paid = app.quickPatrol();
    assert.equal(paid.crystals, Math.round(base * 1.6), '+30 % 巡邏 and +30 % 結晶');
    assert.equal(app.getJourneyFrame().crystals, before + paid.crystals);
  } finally { await app.dispose(); }
});

test('塔 is read on a floor\'s first clear and 賞金 on the tournament prize, both through the same crystal and wallet paths', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /paidCrystals=addSyncCrystals\(rewards\.crystals,\{bonusPercent:talent\('towerRewardPercent'\)\}\)/);
  assert.match(app, /rewards:rewards\?Object\.freeze\(\{\.\.\.rewards,crystals:paidCrystals,tickets,diamonds\}\)/, 'the result shows what was added');
  assert.match(app, /Math\.floor\(run\.prize\*talent\('battleBitsPercent'\)\/100\),BITS_WALLET_CAP-wallet\)/);
  assert.match(app, /talentBits=syncKind\?Math\.floor\(purse\*talent\('battleBitsPercent'\)\/100\):0/, 'owned-party matches only');
});

test('app 賞金: a won Free Battle pays 15 % more Bits at three ranks and the result names the share', async () => {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const app = createChampionshipStandaloneApp({storage, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages, rngClock: () => ({hour: 13, minute: 20, second: 50})});
  let runtime;
  try {
    await app.newGame(); app.save();
    // A strong 成熟期 (as the owned-party Free Battle case builds it), and the trader's 賞金 at three ranks.
    const adultSpecies = burstBasesFor(217)[0];
    const [key, text] = [...data][0], save = JSON.parse(text), adult = structuredClone(nativeIndividualProfile(
      createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(adultSpecies), rng: {next: () => 11}})));
    adult.fields['050'] = adult.fields['058'] = 30000; adult.fields['054'] = adult.fields['05c'] = 9000;
    for (const entry of BATTLE_CREATURE_STAT_MAP) if (entry.value !== 0x54) adult.fields[entry.value.toString(16).padStart(3, '0')] = 999;
    const ultimate = nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(217), rng: {next: () => 11}}));
    for (const entry of BATTLE_CREATURE_STAT_MAP) if (entry.level !== null) { const k = entry.level.toString(16).padStart(3, '0'); adult.fields[k] = ultimate.fields[k]; }
    save.creature.nativeProfile = adult; save.creature.speciesId = `species-${String(adultSpecies).padStart(3, '0')}`;
    save.progression.tamerTalents = maxed(['trader.bounty']);
    data.set(key, JSON.stringify(save)); await app.continueGame();
    const id = app.getRaisingInstances()[0].instanceId;
    app.openBattle();
    const match = app.getFreeBattleMatches().find(row => row.kind === 'SINGLE'), wallet = app.getShopFrame().bits;
    const prepared = await app.prepareFreeBattle(match.id, [id]); assert.equal(prepared.ok, true);
    runtime = createBattleRuntime({mode: 2, battleType: 0, playerIndividuals: prepared.individuals, rng: prepared.rngPreparation.rng});
    runtime.chooseFreeBattle({presetIndices: match.presetIndices, arenaIndex: prepared.arenaIndex}); const live = runtime.startMatch();
    const entry = app.enterFreeBattle({playerInstanceIds: [id], rngPreparation: prepared.rngPreparation}); assert.equal(entry.ok, true, entry.reason);
    for (let tick = 0; tick < 30000 && !live.getView().outcome.ended; tick++) live.tick();
    const result = runtime.getSettlementResult(); assert.equal(result.verdict, 4);
    const receipt = app.finishMatch({...result, attemptId: entry.attempt.attemptId}); assert.equal(receipt.ok, true, receipt.reason);
    const share = Math.floor(match.payout * 15 / 100), drop = app.getLastBattleGachaDrop();
    assert.ok(match.payout > 0 && share > 0, `payout ${match.payout}`);
    assert.equal(receipt.receipt.credited, match.payout, 'the original receipt is the original purse');
    assert.equal(drop.talentBits, share);
    assert.equal(app.getShopFrame().bits, wallet + match.payout + drop.bonusBits + share);
  } finally { runtime?.dispose(); await app.dispose(); }
});

test('app 自動化: a core\'s hour is stored as one hour and its clock runs 30 % slower at three ranks, so every clock shown is 30 % longer', async () => {
  const seed = read('qa/championship-full-qa-save.json');
  seed.progression.tamerTalents = maxed(['breeder.automation']);
  const data = new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(seed)]]);
  const storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k)};
  const app = createChampionshipStandaloneApp({playtestPolicy: FRIENDS_PLAYTEST_POLICY, storage, locks: null,
    cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json')});
  try {
    await app.continueGame();
    const cageId = app.getCageEditFrame().placements.filter(p => p.instanceId)[0].instanceId;
    assert.equal(app.grantAutomationItem('auto:clean-core', 2, 'TEST').ok, true);
    const deploy = app.gachaDeployCore('auto:clean-core', cageId);
    assert.equal(deploy.ok, true, deploy.reason);
    const stretched = Math.round(AUTOMATION_RULES.runSeconds * 1.3);
    assert.equal(deploy.cleanSeconds, stretched, 'the receipt shows the real time');
    const item = app.getCyberGachaFrame().automation.find(i => i.id === 'auto:clean-core');
    assert.deepEqual([item.runSeconds, item.runCapSeconds], [stretched, Math.round(AUTOMATION_RULES.runCapSeconds * 1.3)]);
    assert.equal(app.getCyberGachaFrame().cages.find(c => c.instanceId === cageId).cleanSeconds, stretched);
    app.save();
    const saved = () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.cyberGacha.runs[cageId].AUTO_CLEAN;
    assert.equal(saved(), AUTOMATION_RULES.runSeconds, 'nothing more than a core\'s hour is stored (a removed cage refunds whole hours)');
    for (let i = 0; i < 60 * 26; i++) app.advanceNaturalClock({frames: 1});
    app.save();
    const used = AUTOMATION_RULES.runSeconds - saved();
    assert.ok(used >= 19 && used <= 20, `26 s of play use 20 s of the core: ${used}`);
  } finally { await app.dispose(); }
});

test('the bag\'s supplement tab shows the price this buy costs, the battles left, and keeps a used one on', () => {
  const bag = source('src/championship/app/ranchBackpack.js');
  assert.match(bag, /const price = item\.price \?\? item\.bits;/);
  assert.match(bag, /buy\.disabled = \(supplies\?\.bits \?\? 0\) < price \|\| item\.owned >= 99;/);
  assert.match(bag, /uiText\('SUPPLY_CARRIED_BATTLES', \{ name, n: formatNumber\(battlesLeft\) \}\)/);
  assert.match(bag, /off\.disabled = !whole;/);
  assert.match(source('src/championship/app/vs5Screens.js'), /gachaDrop\?\.talentBits > 0/);
  assert.match(source('src/championship/app/vs5Screens.js'), /const held = receipt\.walletAfter \+ \(gachaDrop\?\.bonusBits > 0 \? gachaDrop\.bonusBits : 0\) \+ \(gachaDrop\?\.talentBits > 0 \? gachaDrop\.talentBits : 0\);/,
    'the held figure counts the beacon and talent shares that reached the wallet');
  for (const file of ['uiText.js', 'uiText.en.js', 'uiText.ja.js', 'uiText.th.js', 'uiText.vi.js']) {
    const text = source(`src/championship/text/${file}`);
    for (const key of ['SUPPLY_CARRIED_BATTLES', 'SUPPLY_PARTLY_USED']) assert.ok(text.includes(`"${key}":`), `${file} ${key}`);
    for (const key of ['supply:snack:effect', 'supply:growth:effect', 'supply:sync:effect'])
      assert.match(text, new RegExp(`"${key}": "[^"]*\\{value\\}`), `${file} ${key} prints the number it is given`);
    if (file !== 'uiText.js') assert.ok(text.includes('"賞金天賦 +{bits} 位元幣":'), file);
  }
});
