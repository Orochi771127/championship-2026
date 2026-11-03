// DIAMOND_ECONOMY_20261102 (OWNER_APPROVED_ADAPTATION): the Bits shop's zoo and ranch lose their free
// feeding and cleaning; ranch automation comes from the gachapon (two SR cores, two royal cages) and the
// furnace's directed recipes; diamonds buy land from 20 to 100 cells, +10 per 1,000; story, rank and
// encyclopedia rewards and the founder box pay diamonds to players who never pay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {FRIENDS_PLAYTEST_POLICY, creditTestDiamonds, normalizeFriendsPlaytestState} from '../src/championship/app/friendsPlaytestPolicy.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {GACHA_AUTOMATION_SHARE, GACHA_CHIPS, automationForgePlan, claimGachaBundle, forgeAutomationItem, forgeShardPool,
  grantGachaAutomation, mountAutomationCore, normalizeCyberGacha, pullCyberGacha, recordGachaClaims, settleRanchAutomation,
  setGachaBondCarry, unmountAutomationCore} from '../src/championship/gacha/cyberGacha.js';
import {AUTOMATION_ITEMS, AUTOMATION_RECIPES, AUTOMATION_RULES, autoFeedAffection, automationEffectLines, cageAutomation,
  royalCopiesByDefinition, royalSleepBonus, royalTotal} from '../src/championship/gacha/ranchAutomation.js';
import {DIAMOND_REWARDS, FOUNDER_PACK, LAND_EXPANSION, dueDiamondMilestones, founderPackUnlocked, landExpansionTier, landExpansionPrice,
  landMemoryBonusG} from '../src/championship/gacha/diamondRewards.js';
import {PRODUCT_CAGE_CHANNEL_OVERRIDES, getCageTraining, productCageChannels} from '../src/championship/cage/cageEffects.js';
import {cageUiSummary} from '../src/championship/presentation/cageUiArt.js';
import {getCageDefinitionByModuleId} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_CAGE_PROGRAMS, REALTIME_TRAINING_POLICY, TRAINING_KIND_OF_CONDITION} from '../src/championship/raising/productTrainingPolicy.js';
import {enterNativeRaisingTraining} from '../src/championship/raising/nativeRaisingTraining.js';
import {settleNativeRaisingCage} from '../src/championship/raising/nativeRaisingOvernight.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const moduleOf = definition => `championship:2026:cage:${definition}`;

function harness() {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = (extra = {}) => createChampionshipStandaloneApp({playtestPolicy: FRIENDS_PLAYTEST_POLICY, storage, locks: null, cages,
    catalog: species, ...extra});
  return {data, cages, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

// ---------------------------------------------------------------- the shop's cages lose their automation

test('the Bits shop zoo and ranch no longer feed or clean: the product shows and trains the beast family instead', () => {
  for (const definition of [24, 25]) {
    // The original text stays the evidence...
    assert.equal(getCageTraining(definition).channels[0].id, 'AUTO_CARE');
    // ...but the product channel, the shop/editor summary and the real-time training program changed.
    assert.deepEqual(productCageChannels(definition).map(c => c.id), ['FAMILY_BEAST']);
    assert.deepEqual(PRODUCT_CAGE_CHANNEL_OVERRIDES[definition].map(c => c.id), ['FAMILY_BEAST']);
    const summary = cageUiSummary(moduleOf(definition));
    assert.doesNotMatch(summary, /自動餵食|清潔/, summary);
    assert.match(summary, /獸屬性上升/);
    assert.ok(PRODUCT_CAGE_PROGRAMS[definition].every(p => p.commands.some(([kind]) => kind === 4)) || PRODUCT_CAGE_PROGRAMS[definition].some(p => p.commands[0][0] === 4));
    assert.equal(REALTIME_TRAINING_POLICY.cagePrograms[definition], PRODUCT_CAGE_PROGRAMS[definition]);
  }
  assert.equal(TRAINING_KIND_OF_CONDITION.BEAST_ATTRIBUTE, 4, 'kind 4 is the beast point condition');
  // Other cages keep their original summary.
  assert.equal(productCageChannels(7)[0].id, getCageTraining(7).channels[0].id);
  // Nothing about a plain zoo or ranch instance runs by itself.
  for (const instanceId of ['cage:instance:7', 'cage:legacy:25']) {
    const auto = cageAutomation(normalizeCyberGacha({version: 1}), instanceId);
    assert.equal(auto.clean, false); assert.equal(auto.feed, false); assert.equal(auto.royal, false);
  }
});

test('a real-time training in the ranch raises beast points; the native writer without the overlay still trains nothing', () => {
  const profile = nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(34), rng: {next: () => 7}}));
  const rng = {next: () => 0};
  const product = enterNativeRaisingTraining(structuredClone(profile), {definition: 25, season: 0, programs: PRODUCT_CAGE_PROGRAMS[25],
    pointScale: REALTIME_TRAINING_POLICY.pointScale}, rng);
  assert.ok(product.commands.some(c => c.kind === 4 && c.delta > 0), JSON.stringify(product.commands));
  assert.ok(product.profile.fields['110'] > profile.fields['110'], 'beast counter (0x110) went up');
  const native = enterNativeRaisingTraining(structuredClone(profile), {definition: 25, season: 0}, rng);
  assert.deepEqual(native.commands, [], 'the original ranch program is empty');
});

test('the native overnight writer keeps its traced zoo/ranch behaviour for parity replays (product play never runs it)', () => {
  // Real-time play has no overnight settlement; the NATIVE parity writer is left exactly as traced.
  const source = readFileSync(new URL('../src/championship/raising/nativeRaisingOvernight.js', import.meta.url), 'utf8');
  assert.match(source, /definition!==24&&definition!==25/);
  assert.equal(typeof settleNativeRaisingCage, 'function');
});

// ---------------------------------------------------------------- automation items, pity forging, mounting

test('automation items: SR cores, an SSR royal ranch and a UR stellar zoo, each with its own art and effect lines', () => {
  assert.deepEqual(AUTOMATION_ITEMS.map(i => [i.id, i.rarity]), [['auto:clean-core', 'SR'], ['auto:feed-core', 'SR'], ['auto:royal-ranch', 'SSR'], ['auto:stellar-zoo', 'UR']]);
  for (const item of AUTOMATION_ITEMS) {
    assert.ok(readFileSync(new URL('../' + item.art, import.meta.url)).length > 1000, item.art);
    assert.ok(automationEffectLines(item).length >= 2, item.id);
  }
  assert.deepEqual(AUTOMATION_ITEMS.filter(i => i.edition).map(i => i.baseDefinition), [25, 24]);
  assert.match(automationEffectLines(AUTOMATION_ITEMS[0]).map(l => l.text).join(), /0 照顧失誤/);
  assert.equal(automationEffectLines(AUTOMATION_ITEMS[0])[1].params.n, 50);
  assert.equal(automationEffectLines(AUTOMATION_ITEMS[1])[1].params.n, 2.4);
});

test('the premium machine pays automation at the top of each SR+ roll; R tiers and metals keep their rolls', () => {
  const state = normalizeCyberGacha({version: 1, tickets: 10});
  // rarity roll 0.7 -> SR; category roll 0.99 -> automation; pick 0 -> the clean core.
  const sr = pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random: seq([0.7, 0.99, 0])});
  assert.deepEqual(sr.prizes.map(p => [p.kind, p.id, p.rarity]), [['AUTOMATION', 'auto:clean-core', 'SR']]);
  assert.equal(sr.state.automation['auto:clean-core'], 1);
  const ssr = pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random: seq([0.9, 0.95, 0])});
  assert.deepEqual(ssr.prizes.map(p => p.id), ['auto:royal-ranch']);
  const ur = pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random: seq([0.99, 0.9, 0])});
  assert.deepEqual(ur.prizes.map(p => p.id), ['auto:stellar-zoo']);
  // A low category roll still gives a metal in every tier.
  assert.equal(pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random: seq([0.7, 0.01, 0])}).prizes[0].kind, 'METAL');
  assert.equal(pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random: seq([0.1, 0.99, 0])}).prizes[0].kind, 'CHIP', 'R has no automation');
  // Overall rates: cores 2.1% each, royal ranch 1.5%, stellar zoo 0.3%.
  assert.equal(GACHA_AUTOMATION_SHARE, 0.15);
  assert.equal(Math.round(0.28 * GACHA_AUTOMATION_SHARE / 2 * 1000) / 10, 2.1);
  assert.equal(Math.round(0.1 * GACHA_AUTOMATION_SHARE * 1000) / 10, 1.5);
  assert.equal(Math.round(0.02 * GACHA_AUTOMATION_SHARE * 1000) / 10, 0.3);
});

test('directed forging is the pity path: fixed chips and shards in, that exact item out; locked chips and star-core shards never go in', () => {
  assert.deepEqual(AUTOMATION_RECIPES.map(r => [r.id, r.chips, r.shards]),
    [['auto:clean-core', 5, 2], ['auto:feed-core', 5, 2], ['auto:royal-ranch', 5, 6], ['auto:stellar-zoo', 5, 10]]);
  assert.ok(forgeShardPool().every(m => m.family !== 'supernova'));
  let state = normalizeCyberGacha({version: 1, chips: {'chip:hp': 3, 'chip:attack': 1, 'chip:core-omega': 9, 'chip:personality': 9},
    metals: {'metal:emma-shard': 1, 'metal:beta-shard': 1, 'metal:supernova-shard': 9}});
  assert.equal(automationForgePlan(state, 'auto:clean-core').reason, 'NOT_ENOUGH_CHIPS', 'Ω and reshape chips are locked out');
  const precious = normalizeCyberGacha({version: 1, chips: {'chip:chrono': 9, 'chip:core-beta': 9}, metals: {'metal:emma-shard': 9}});
  assert.equal(automationForgePlan(precious, 'auto:clean-core').reason, 'NOT_ENOUGH_CHIPS', 'SSR chips are never melted down');
  state = normalizeCyberGacha({...state, chips: {...state.chips, 'chip:defense': 1}});
  const plan = automationForgePlan(state, 'auto:clean-core');
  assert.equal(plan.ok, true, plan.reason);
  assert.deepEqual([...plan.chips].sort(), ['chip:attack', 'chip:defense', 'chip:hp', 'chip:hp', 'chip:hp'].sort());
  assert.deepEqual([...plan.shards].sort(), ['metal:beta-shard', 'metal:emma-shard']);
  assert.equal(automationForgePlan(state, 'auto:royal-ranch').reason, 'NOT_ENOUGH_SHARDS', 'star-core shards do not count');
  const forged = forgeAutomationItem(state, 'auto:clean-core');
  assert.equal(forged.ok, true);
  assert.equal(forged.state.automation['auto:clean-core'], 1);
  assert.equal(forged.state.chips['chip:hp'] ?? 0, 0);
  assert.equal(forged.state.metals['metal:supernova-shard'], 9, 'the star-core shards are untouched');
  assert.equal(forged.prize.rarity, 'SR');
});

test('cores mount on one cage and come back off; a royal edition already runs both; a confirmed layout settles the bag', () => {
  let state = grantGachaAutomation(grantGachaAutomation(normalizeCyberGacha({version: 1}), 'auto:clean-core', 1).state, 'auto:feed-core', 1).state;
  assert.equal(mountAutomationCore(state, 'auto:royal-ranch', 'cage:instance:3').reason, 'NOT_A_CORE');
  state = mountAutomationCore(state, 'auto:clean-core', 'cage:instance:3').state;
  assert.equal(mountAutomationCore(grantGachaAutomation(state, 'auto:clean-core').state, 'auto:clean-core', 'cage:instance:3').reason, 'ALREADY_MOUNTED');
  state = mountAutomationCore(state, 'auto:feed-core', 'cage:instance:3').state;
  assert.deepEqual(state.mounts, {'cage:instance:3': ['AUTO_CLEAN', 'AUTO_FEED']});
  assert.equal(state.automation, undefined, 'the bag is empty');
  const auto = cageAutomation(state, 'cage:instance:3');
  assert.equal(auto.clean && auto.feed && !auto.royal, true);
  assert.equal(auto.sleepPercent, 100); assert.equal(auto.trainingPoints, 0);
  const off = unmountAutomationCore(state, 'AUTO_FEED', 'cage:instance:3');
  assert.deepEqual(off.state.mounts, {'cage:instance:3': ['AUTO_CLEAN']});
  assert.equal(off.state.automation['auto:feed-core'], 1);
  // Royal cages: placed from the bag by the facility layout; one that leaves goes back, cores on a removed cage too.
  state = grantGachaAutomation(state, 'auto:royal-ranch', 2).state;
  assert.equal(royalTotal(state, 'ROYAL_RANCH'), 2);
  const placed = settleRanchAutomation(state, {editions: {'cage:instance:9': 'ROYAL_RANCH'}, liveInstanceIds: ['cage:instance:3', 'cage:instance:9']});
  assert.deepEqual(placed.state.editions, {'cage:instance:9': 'ROYAL_RANCH'});
  assert.equal(placed.state.automation['auto:royal-ranch'], 1);
  assert.equal(mountAutomationCore(grantGachaAutomation(placed.state, 'auto:clean-core').state, 'auto:clean-core', 'cage:instance:9').reason, 'ROYAL_ALREADY_AUTOMATED');
  const royal = cageAutomation(placed.state, 'cage:instance:9');
  assert.deepEqual([royal.royal, royal.clean, royal.feed, royal.sleepPercent, royal.trainingPoints], [true, true, true, 130, 3]);
  assert.deepEqual([...royalCopiesByDefinition(placed.state)], [[25, 2]], 'both royal ranches count as ranch copies');
  const removed = settleRanchAutomation(placed.state, {editions: {}, liveInstanceIds: []});
  assert.equal(removed.state.automation['auto:royal-ranch'], 2);
  assert.equal(removed.state.automation['auto:clean-core'], 1);
  assert.equal(removed.state.automation['auto:feed-core'], 1);
  assert.equal(removed.state.mounts, undefined);
  assert.equal(settleRanchAutomation(state, {editions: {a: 'STELLAR_ZOO', 'cage:instance:9': 'STELLAR_ZOO'}, liveInstanceIds: ['cage:instance:9']}).reason, 'ROYAL_CAGE_NOT_OWNED');
  assert.throws(() => normalizeCyberGacha({version: 1, editions: {'cage:instance:1': 'GOLD'}}), /INVALID_ROYAL_EDITION/);
  assert.throws(() => normalizeCyberGacha({version: 1, mounts: {'cage:instance:1': ['AUTO_WASH']}}), /INVALID_AUTOMATION_MOUNT/);
});

test('auto-feed is +2.4 affection carried in tenths; royal sleep recovers 30% faster', () => {
  const gains = [];
  let carry = 0;
  for (let i = 0; i < 5; i += 1) { const g = autoFeedAffection(carry); gains.push(g.points); carry = g.carry; }
  assert.deepEqual(gains, [2, 2, 3, 2, 3]);
  assert.equal(gains.reduce((a, b) => a + b, 0), 12, 'five feeds = 5 x 2.4');
  assert.equal(AUTOMATION_RULES.cleanBits, 50);
  assert.equal(AUTOMATION_RULES.hungrySatiety, 2);
  let sleep = 0, extra = 0;
  for (let i = 0; i < 10; i += 1) { const b = royalSleepBonus(1, sleep); sleep = b.carry; extra += b.units; }
  assert.equal(extra, 3, 'ten units of sleep recover thirteen');
  const state = setGachaBondCarry(normalizeCyberGacha({version: 1}), 'creature:1', 4);
  assert.deepEqual(state.bondCarry, {'creature:1': 4});
  assert.equal(setGachaBondCarry(state, 'creature:1', 0).bondCarry, undefined);
  // Carries of partners no longer held are dropped, so the record never outgrows the ranch.
  assert.deepEqual(setGachaBondCarry(state, 'creature:2', 3, ['creature:2']).bondCarry, {'creature:2': 3});
});

// ---------------------------------------------------------------- diamonds: rewards, land, founder box

test('diamond rewards: rank 1-9 and encyclopedia 10/25/50/100 pay 200-500 once; story chapters pay 300', () => {
  assert.deepEqual(dueDiamondMilestones({rank: 0, registeredCount: 9}), []);
  const due = dueDiamondMilestones({rank: 3, registeredCount: 26});
  assert.deepEqual(due.map(d => [d.key, d.amount]), [['dia:rank:1', 300], ['dia:rank:2', 300], ['dia:rank:3', 300], ['dia:dex:10', 200], ['dia:dex:25', 300]]);
  assert.deepEqual(dueDiamondMilestones({rank: 3, registeredCount: 26, claimed: due.map(d => d.key)}), []);
  assert.ok(Object.values(DIAMOND_REWARDS.rank).every(n => n === 0 || (n >= 200 && n <= 500)));
  assert.ok(DIAMOND_REWARDS.dex.every(([, n]) => n >= 200 && n <= 500));
  assert.equal(DIAMOND_REWARDS.storyChapter, 300);
  const claims = recordGachaClaims(normalizeCyberGacha({version: 1}), ['dia:rank:1', 'dia:rank:1']);
  assert.deepEqual(claims.recorded, ['dia:rank:1']);
  // The wallet holds earned diamonds past the playtest grant.
  const wallet = normalizeFriendsPlaytestState({version: 2, grants: [FRIENDS_PLAYTEST_POLICY.grantId], diamonds: 19900, purchases: []});
  assert.equal(creditTestDiamonds(wallet, 500).state.diamonds, 20400);
  assert.equal(creditTestDiamonds(null, 500).granted, 0);
});

test('land: 20 cells, +10 a step at 200 → 2,200 diamonds (8,000 in all), 8 steps to 100; each step lifts the memory card by 8 G', () => {
  assert.deepEqual([LAND_EXPANSION.baseCells, LAND_EXPANSION.cells, LAND_EXPANSION.maxCells], [20, 10, 100]);
  // Owner 2026-11-03: the price climbs step by step.
  assert.deepEqual(LAND_EXPANSION.prices, [200, 400, 600, 800, 1000, 1200, 1600, 2200]);
  assert.equal(LAND_EXPANSION.prices.reduce((a, b) => a + b, 0), 8000);
  assert.deepEqual([20, 30, 40, 50, 60, 70, 80, 90, 100].map(landExpansionPrice), [200, 400, 600, 800, 1000, 1200, 1600, 2200, null]);
  assert.deepEqual([20, 29, 30, 60, 100, 140].map(landExpansionTier), [0, 0, 1, 4, 8, 8]);
  assert.equal(landMemoryBonusG(30, 32), 8);
  assert.equal(landMemoryBonusG(100, 96), 64);
  assert.equal(landMemoryBonusG(100, 0), 0, 'no card, no bonus');
});

test('app: each step opens +10 land cells at its own price (200 → 2,200) and the save keeps them; 100 is the most', async () => {
  const h = harness();
  let app = h.make();
  try {
    await app.newGame();
    app.openCageEdit();
    const start = app.getCageEditFrame();
    assert.equal(start.land.capacity, 20);
    assert.equal(start.land.diamonds, 20000);
    assert.equal(start.land.max, false);
    assert.deepEqual([start.land.price, start.land.tier, start.land.tiers], [200, 0, 8]);
    const first = app.expandRanchLand();
    assert.equal(first.ok, true, first.reason);
    assert.deepEqual([first.before, first.after], [20, 30]);
    assert.equal(app.getCageEditFrame().testDiamonds, 19800);
    assert.equal(app.getCageEditFrame().land.memoryBonusG, 8);
    assert.equal(app.getCageEditFrame().land.price, 400, 'the next step costs more');
    assert.equal(app.getCageEditFrame().lastVerdict.price, 200, 'the receipt names what was paid');
    const saved = h.saved();
    assert.equal(saved.flags.friendsPlaytest.diamonds, 19800, 'debited in the durable save');
    assert.deepEqual(saved.cageEdit.gridAccess.testUnlockedRows, [2]);
    const paid = [200];
    for (let step = 2; step <= 8; step += 1) {
      const before = app.getCageEditFrame().testDiamonds;
      assert.equal(app.expandRanchLand().ok, true, `step ${step}`);
      paid.push(before - app.getCageEditFrame().testDiamonds);
    }
    assert.deepEqual(paid, [200, 400, 600, 800, 1000, 1200, 1600, 2200]);
    const full = app.getCageEditFrame();
    assert.equal(full.land.capacity, 100);
    assert.equal(full.land.max, true);
    assert.equal(full.land.tier, 8);
    assert.equal(full.testDiamonds, 12000);
    const refused = app.expandRanchLand();
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'LAND_AT_MAXIMUM');
    assert.equal(app.getCageEditFrame().testDiamonds, 12000, 'a refused step costs nothing');
    await app.dispose();
    app = h.make();
    await app.continueGame();
    assert.equal(app.getCageEditFrame().land.capacity, 100, 'reload keeps all purchased land');
    assert.equal(app.getCageEditFrame().testDiamonds, 12000);
  } finally { await app.dispose(); }
});

test('app: without diamonds the land key refuses and nothing changes', async () => {
  const h = harness();
  const app = h.make();
  try {
    await app.newGame();
    app.openCageEdit();
    for (let i = 0; i < 8; i += 1) app.expandRanchLand();
    const done = app.getCageEditFrame();
    assert.equal(done.land.capacity, 100);
    // Spend down to below one step: a fresh wallet in a new save that cannot pay.
    const h2 = harness();
    const poor = h2.make();
    await poor.newGame();
    poor.save();
    const save = h2.saved();
    save.flags.friendsPlaytest.diamonds = 199;
    h2.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
    await poor.dispose();
    const again = h2.make();
    await again.continueGame();
    again.openCageEdit();
    const refused = again.expandRanchLand();
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'INSUFFICIENT_TEST_DIAMONDS');
    assert.equal(again.getCageEditFrame().land.capacity, 20);
    await again.dispose();
  } finally { await app.dispose(); }
});

test('app: a royal ranch from the bag is placed as a ranch copy, saved with its edition, and comes back after a reload', async () => {
  const h = harness();
  let app = h.make();
  try {
    await app.newGame();
    assert.equal(app.grantAutomationItem('auto:royal-ranch', 1, 'TEST').ok, true);
    app.openCageEdit();
    app.expandRanchLand();
    let frame = app.getCageEditFrame();
    const card = frame.royalTray.find(r => r.id === 'auto:royal-ranch');
    assert.equal(card.available, 1);
    assert.equal(card.moduleId, moduleOf(25));
    assert.equal(frame.tray.some(t => t.moduleId === moduleOf(25)), false, 'no plain ranch was bought');
    // Try open positions until the ranch fits.
    let placedId = null;
    for (const slot of frame.slots.filter(s => !s.moduleId).map(s => s.slotIndex)) {
      app.selectRoyalCage('auto:royal-ranch');
      frame = app.placeCageAt(slot);
      placedId = Object.entries(frame.automation ?? {}).find(([, a]) => a.royal)?.[0] ?? null;
      if (placedId) break;
    }
    assert.ok(placedId, 'placed somewhere');
    assert.equal(getCageDefinitionByModuleId(frame.placements.find(p => p.instanceId === placedId).moduleId).cageDefinitionIndex, 25);
    assert.equal(app.getCageEditFrame().royalTray.find(r => r.id === 'auto:royal-ranch').available, 0);
    app.confirmCageEdit();
    app.save();
    const saved = h.saved();
    assert.deepEqual(saved.progression.cyberGacha.editions, {[placedId]: 'ROYAL_RANCH'});
    assert.equal(saved.progression.cyberGacha.automation?.['auto:royal-ranch'] ?? 0, 0);
    assert.ok(saved.cageEdit.placements.some(p => p.instanceId === placedId && p.moduleId === moduleOf(25)), 'the save holds a ranch the shop never sold');
    assert.equal(app.savePort.getStatus().phase, 'SAVED', 'the stock check counts royal cages');
    assert.ok(app.getCageAutomationFrame().some(b => b.instanceId === placedId && b.royal && b.clean && b.feed), 'the ranch badge');
    await app.dispose();
    app = h.make();
    await app.continueGame();
    const back = app.getCageEditFrame();
    assert.equal(back.automation[placedId].royal, true);
    assert.equal(back.automation[placedId].edition, 'ROYAL_RANCH');
    // Taking it off the board returns it to its card; leaving without confirming changes nothing.
    app.openCageEdit();
    app.removeCagePlacement(placedId);
    assert.equal(app.getCageEditFrame().royalTray[0].available, 1);
    app.leaveScreen();
    assert.equal(app.getCageEditFrame().automation[placedId].royal, true);
  } finally { await app.dispose(); }
});

test('app: hungry partners in a gachapon royal ranch are fed and cleaned for bits; the same ranch bought with Bits does neither', async () => {
  const h = harness();
  // The QA fixture is built from an ordinary save; the playtest build migrates it into the hex world on load.
  const first = h.make({playtestPolicy: null});
  await first.newGame();
  first.save();
  h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, createFullQaSaveText(h.saved(), {cageIds: h.cages.map(e => e.cageId)}));
  await first.dispose();
  // 1. A plain ranch from the Bits shop and a royal ranch from the bag, side by side.
  let app = h.make();
  let plainId = null, royalId = null;
  try {
    await app.continueGame();
    app.openShop();
    const record = getCageDefinitionByModuleId(moduleOf(25)).shopRecordIndex;
    assert.equal(app.buyShopItem(record).ok, true, 'a ranch bought with Bits');
    app.leaveScreen();
    app.grantAutomationItem('auto:royal-ranch', 1, 'TEST');
    app.openCageEdit();
    app.expandRanchLand(); app.expandRanchLand();
    const place = pick => {
      for (const slot of app.getCageEditFrame().slots.filter(s => !s.moduleId).map(s => s.slotIndex)) {
        pick();
        const before = new Set(app.getCageEditFrame().placements.map(p => p.instanceId));
        const frame = app.placeCageAt(slot);
        const added = frame.placements.find(p => !before.has(p.instanceId));
        if (added) return added.instanceId;
      }
      return null;
    };
    plainId = place(() => app.selectCageModule(moduleOf(25)));
    royalId = place(() => app.selectRoyalCage('auto:royal-ranch'));
    assert.ok(plainId && royalId, `${plainId} / ${royalId}`);
    const frame = app.getCageEditFrame();
    assert.equal(frame.automation[plainId], undefined, 'the Bits ranch runs nothing');
    assert.equal(frame.automation[royalId].royal, true);
    app.confirmCageEdit();
    app.leaveScreen();
    app.save();
  } finally { await app.dispose(); }
  // 2. Half the grown partners move into each ranch, hungry and long past due for a dropping.
  const saved = h.saved();
  const grown = saved.raising.collection.filter(e => (e.nativeProfile?.fields?.['000'] ?? 0) >= 8);
  assert.ok(grown.length >= 2, `grown partners: ${grown.length}`);
  const plainIds = [], royalIds = [];
  grown.forEach((entry, i) => {
    const owner = i % 2 ? plainId : royalId;
    (i % 2 ? plainIds : royalIds).push(entry.instanceId);
    saved.raising.nativeHome.cageAssignments = {...saved.raising.nativeHome.cageAssignments, [entry.instanceId]: owner};
    Object.assign(entry.nativeProfile.fields, {'014': 25, '1c0': 0, '1c4': 0, '008': 1, '190': 99999});
  });
  saved.raising.nativeHome.foods = [];
  saved.raising.nativeHome.waste = [];
  h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  // 3. Run the ranch.
  app = h.make();
  try {
    await app.continueGame();
    for (const id of [...royalIds, ...plainIds]) assert.equal(app.getRaisingActorFrame(id)?.cageInstanceId, royalIds.includes(id) ? royalId : plainId, id);
    const bitsBefore = app.getShopFrame().bits;
    for (let i = 0; i < 600; i += 1) app.advanceNaturalClock({frames: 1});
    app.save();
    const after = h.saved();
    const fieldsOf = id => after.raising.collection.find(e => e.instanceId === id).nativeProfile.fields;
    const events = app.getAutomationEvents();
    for (const id of royalIds) assert.ok((fieldsOf(id)['008'] | 0) > AUTOMATION_RULES.hungrySatiety, `${id} in the royal ranch was fed (satiety ${fieldsOf(id)['008']})`);
    for (const id of plainIds) assert.ok((fieldsOf(id)['008'] | 0) <= AUTOMATION_RULES.hungrySatiety, `${id} in the Bits ranch stays hungry`);
    const feeds = events.filter(e => e.kind === 'FEED'), cleans = events.filter(e => e.kind === 'CLEAN');
    assert.ok(feeds.length >= royalIds.length && feeds.every(e => e.cageInstanceId === royalId && e.affection >= 2), JSON.stringify(feeds));
    assert.ok(cleans.length >= 1 && cleans.every(e => e.cageInstanceId === royalId && e.bits === 50), JSON.stringify(cleans));
    assert.equal(app.getShopFrame().bits, bitsBefore + 50 * cleans.length, '+50 bits per clean');
    const waste = after.raising.nativeHome.waste ?? [];
    assert.equal(waste.filter(w => w.cageInstanceId === royalId).length, 0, 'nothing lies in the royal ranch');
    assert.ok(waste.some(w => w.cageInstanceId === plainId), 'the Bits ranch keeps its droppings');
    for (const id of royalIds) assert.ok(fieldsOf(id)['020'] > grown.find(e => e.instanceId === id).nativeProfile.fields['020'], `${id} grew closer`);
  } finally { await app.dispose(); }
});

test('app: story chapters, rank and the encyclopedia pay diamonds once; the founder box opens with the first medal', async () => {
  const h = harness();
  const app = h.make();
  try {
    await app.newGame();
    const before = app.getCageEditFrame().testDiamonds;
    const story = app.claimGachaReward('story:test-chapter', 3);
    assert.equal(story.ok, true);
    assert.equal(story.diamonds, 300);
    assert.equal(app.claimGachaReward('story:test-chapter', 3).granted, 0, 'once');
    assert.equal(app.getCageEditFrame().testDiamonds, before + 300);
    app.setTamerRank(2);
    const pending = app.getDiamondRewards().pending;
    assert.deepEqual(pending.filter(p => p.kind === 'RANK').map(p => p.key), ['dia:rank:1', 'dia:rank:2']);
    const paid = app.claimDiamondRewards();
    assert.equal(paid.ok, true);
    assert.equal(paid.granted, pending.reduce((s, p) => s + p.amount, 0));
    assert.deepEqual(app.getDiamondRewards().pending, []);
    assert.equal(app.claimDiamondRewards().granted, 0);
    assert.equal(h.saved().flags.friendsPlaytest.diamonds, before + 300 + paid.granted, 'saved at once');
    // Founder box: locked until a tournament medal, then once.
    assert.equal(app.getFounderPack().unlocked, false);
    assert.equal(app.claimFounderPack().reason, 'FOUNDER_PACK_LOCKED');
    app.setBattleBadges([0]);
    assert.equal(founderPackUnlocked({medals: app.getBattleBadges()}), true);
    const ticketsBefore = app.getCyberGachaFrame().tickets, diamondsBefore = app.getCageEditFrame().testDiamonds;
    const box = app.claimFounderPack();
    assert.equal(box.ok, true, box.reason);
    assert.equal(app.getCageEditFrame().testDiamonds, diamondsBefore + FOUNDER_PACK.diamonds);
    assert.equal(app.getCyberGachaFrame().tickets, ticketsBefore + FOUNDER_PACK.tickets);
    const items = Object.fromEntries(app.getCyberGachaFrame().automation.map(i => [i.id, i.owned]));
    assert.equal(items['auto:feed-core'], 1); assert.equal(items['auto:clean-core'], 1);
    assert.equal(app.hasFounderFrame(), true);
    assert.equal(app.claimFounderPack().reason, 'ALREADY_CLAIMED');
    const bundle = claimGachaBundle(normalizeCyberGacha({version: 1}), {key: FOUNDER_PACK.key, items: FOUNDER_PACK.items, tickets: 5});
    assert.equal(claimGachaBundle(bundle.state, {key: FOUNDER_PACK.key}).reason, 'ALREADY_CLAIMED');
  } finally { await app.dispose(); }
});

test('every new string has all four translations and the gachapon stays emoji-free', async () => {
  const EMOJI = /\p{Extended_Pictographic}/u;
  for (const path of ['src/championship/gacha/ranchAutomation.js', 'src/championship/gacha/diamondRewards.js']) {
    assert.deepEqual(readFileSync(new URL('../' + path, import.meta.url), 'utf8').split('\n').filter(l => EMOJI.test(l)), [], path);
  }
  for (const locale of ['en', 'ja', 'th', 'vi']) {
    const TEXT = (await import(`../src/championship/text/uiText.${locale}.js`))[`TEXT_${locale.toUpperCase()}`];
    for (const key of [...AUTOMATION_ITEMS.map(i => i.name), '全自動飼育運轉中', '擴充土地 +{n}格', '已達最大 100 格領域', '創始馴獸師開拓禮盒', '定向合成（保底）']) {
      assert.equal(typeof TEXT[key], 'string', `${locale}: ${key}`);
      assert.doesNotMatch(TEXT[key], EMOJI);
    }
  }
  assert.ok(GACHA_CHIPS.length > 0);
});
