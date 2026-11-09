import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {normalizeCyberGacha, applyGachaBoost, spendGachaItem, settleGachaBattleWin, smeltGachaShardTier, shardTierSmeltPlan,
  GACHA_COUNTER_FIELDS} from '../src/championship/gacha/cyberGacha.js';
import {resolveGachaEffect, speciesCounterFields, evolutionRouteGaps, evolutionGapCounter, beaconBattleWords, FACTION_COUNTER,
  RACE_COUNTER, SHARD_CATALYST_WAIVER} from '../src/championship/gacha/gachaItemExecutor.js';
import {PRODUCT_GROWTH_RULES} from '../src/championship/raising/productGrowthPolicy.js';
import {speciesTaxonomy} from '../src/championship/contracts/speciesTaxonomy.js';
import {getAutomationItem} from '../src/championship/gacha/ranchAutomation.js';

// GACHA_FULL_EFFECTS_20261109 (Owner 2026-11-09): every chip and metal acts on the partner's own native words,
// beacons add battles and points, the Bits machine pays supply boxes into the shop stacks the toolbar reads,
// shards smelt up a tier and the royal ranch is UR.

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

function harness(random) {
  const data = new Map(), storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages,
    catalog: read('src/data/championship/catalogs/creature-species.r1.json'), gachaRandom: random,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-09T00:00:00.000Z'});
  return {data, cages, make};
}
async function qaApp(cyberGacha, random = Math.random, mutate = null) {
  const {data, cages, make} = harness(random);
  const first = make();
  await first.newGame();
  first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  save.progression.cyberGacha = {version: 1, welcome: true, ...cyberGacha};
  mutate?.(save);
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}
/** The saved native profile of one partner, wherever the save keeps it. */
function savedProfile(save, instanceId) {
  let found = null;
  const walk = node => {
    if (found || !node || typeof node !== 'object') return;
    if ((node.instanceId === instanceId || node.creatureId === instanceId) && node.nativeProfile?.fields) { found = node.nativeProfile; return; }
    for (const value of Object.values(node)) walk(value);
  };
  walk(save);
  return found;
}
const baseProfile = (speciesIndex, extra = {}) => ({
  version: 1, name: 'T',
  fields: {'000': speciesIndex, '058': 100, '050': 10, '05c': 40, '054': 0, '060': 50, '064': 50, '068': 50, '06c': 50, '020': 50,
    '010': 20, '018': 3, '040': 70, '18c': 0, '024': 0, '028': 0, ...Object.fromEntries(GACHA_COUNTER_FIELDS.map(f => [f, 0])), ...extra},
  narrowFields: {'03c': 0, '03d': 4}
});

test('race and faction counters come from the three-axis taxonomy, in the native counter order', () => {
  assert.deepEqual(GACHA_COUNTER_FIELDS, ['104', '108', '100', '10c', '110', '114', '118', '124', '120', '128', '11c']);
  assert.deepEqual(FACTION_COUNTER, {LUMEN: '104', IRON: '108', RIFT: '100'});
  assert.equal(Object.keys(RACE_COUNTER).length, 8);
  for (const index of [30, 40, 60, 90, 120]) {
    const taxonomy = speciesTaxonomy(index), fields = speciesCounterFields(index);
    assert.equal(fields.race, RACE_COUNTER[taxonomy?.race] ?? null, `species ${index}`);
    assert.equal(fields.faction, FACTION_COUNTER[taxonomy?.faction] ?? null, `species ${index}`);
  }
});

test('chips resolve into native words: race/faction/every points, fatigue, growth age and care mistakes', () => {
  const species = [...Array(240).keys()].find(i => speciesTaxonomy(i)?.race && speciesTaxonomy(i)?.faction && evolutionRouteGaps(baseProfile(i), PRODUCT_GROWTH_RULES).length);
  const profile = baseProfile(species);
  const own = speciesCounterFields(species);
  const attack = applyGachaBoost(profile, resolveGachaEffect({attack: 18, raceExp: 15}, profile, {table: PRODUCT_GROWTH_RULES}));
  assert.equal(attack.fields['060'], 68);
  assert.equal(attack.fields[own.race], 15);
  const defense = applyGachaBoost(profile, resolveGachaEffect({defense: 18, factionExp: 15}, profile, {table: PRODUCT_GROWTH_RULES}));
  assert.deepEqual([defense.fields['064'], defense.fields[own.faction]], [68, 15]);
  const hp = applyGachaBoost(profile, resolveGachaEffect({hp: 120, fatigue: true}, profile, {table: PRODUCT_GROWTH_RULES}));
  assert.deepEqual([hp.fields['058'], hp.fields['050'], hp.fields['040']], [220, 220, 0]);
  const speed = resolveGachaEffect({speed: 18, wisdom: 12, age: 0.15}, profile, {table: PRODUCT_GROWTH_RULES, lifeThreshold: 1000});
  assert.equal(speed.ageMinutes, 150);
  const sped = applyGachaBoost(profile, speed);
  assert.deepEqual([sped.fields['06c'], sped.fields['068'], sped.fields['18c']], [68, 62, 150]);
  const old = baseProfile(species, {'18c': 990});
  assert.equal(resolveGachaEffect({age: 0.15}, old, {table: PRODUCT_GROWTH_RULES, lifeThreshold: 1000}).ageMinutes, 9, 'never past the life threshold');
  assert.equal(resolveGachaEffect({age: 0.15}, profile, {table: PRODUCT_GROWTH_RULES, lifeThreshold: 0xffffffff}).ageMinutes, undefined, '成熟期 has no life limit');
  const beta = applyGachaBoost(profile, resolveGachaEffect({all: 25, careMistakes: -1}, profile, {table: PRODUCT_GROWTH_RULES}));
  assert.equal(beta.narrowFields['03d'], 3);
  const omega = applyGachaBoost(profile, resolveGachaEffect({all: 50, hp: 350, bond: 100, careMistakes: 'CLEAR', everyExp: 20}, profile, {table: PRODUCT_GROWTH_RULES}));
  assert.equal(omega.narrowFields['03d'], 0);
  assert.equal(omega.fields['020'], 100);
  assert.ok(GACHA_COUNTER_FIELDS.every(field => omega.fields[field] === 20));
  assert.equal(profile.fields['060'], 50, 'input is not mutated');
});

test('a basic shard adds 25 to the counter the next evolution lacks most', () => {
  const species = [...Array(240).keys()].find(i => evolutionRouteGaps(baseProfile(i), PRODUCT_GROWTH_RULES).some(r => r.unmet.some(row => row.kind === 'COUNTER')));
  const profile = baseProfile(species);
  const gap = evolutionGapCounter(profile, PRODUCT_GROWTH_RULES);
  const need = Math.max(...evolutionRouteGaps(profile, PRODUCT_GROWTH_RULES).flatMap(r => r.unmet.filter(row => row.kind === 'COUNTER' && row.field === gap).map(row => row.need)));
  assert.ok(need > 0);
  const next = applyGachaBoost(profile, resolveGachaEffect({all: 10}, profile, {table: PRODUCT_GROWTH_RULES, gapExp: 25}));
  assert.equal(next.fields[gap], 25);
  assert.equal(next.fields['060'], 60);
});

test('beacons add battles and wins (β/γ/Ω) or race and faction points (α) to every fighter', () => {
  const species = [...Array(240).keys()].find(i => speciesTaxonomy(i)?.race && speciesTaxonomy(i)?.faction);
  const own = speciesCounterFields(species);
  let state = spendGachaItem(normalizeCyberGacha({version: 1, chips: {'chip:bounty-beta': 1, 'chip:bounty-alpha': 1}}), 'chip:bounty-beta').state;
  const win = settleGachaBattleWin(state, {bits: 1000, random: seq([0])});
  assert.deepEqual([win.battles, win.exp, win.bonusBits], [2, 0, 1000]);
  const fought = beaconBattleWords(baseProfile(species, {'024': 4, '028': 1}), win);
  assert.deepEqual([fought.fields['024'], fought.fields['028']], [6, 3]);
  state = spendGachaItem(win.state, 'chip:bounty-alpha').state;
  const alpha = settleGachaBattleWin(state, {bits: 1000, random: seq([0])});
  assert.deepEqual([alpha.battles, alpha.exp, alpha.bonusBits], [0, 8, 500]);
  const pointed = beaconBattleWords(baseProfile(species), alpha);
  assert.deepEqual([pointed.fields[own.race], pointed.fields[own.faction], pointed.fields['024']], [8, 8, 0]);
  assert.equal(settleGachaBattleWin(normalizeCyberGacha({version: 1, armed: {bounty: 'chip:bounty-gamma'}}), {bits: 0, random: seq([0])}).battles, 3);
});

test('tier smelting: three R shards become a 時之合金碎片, three SR shards a whole 時之合金; spare copies go first', () => {
  const state = normalizeCyberGacha({version: 1, metals: {'metal:emma-shard': 1, 'metal:beta-shard': 3, 'metal:chrono-ore-shard': 2, 'metal:chrono-metal-shard': 1}});
  // Spare copies first, then the largest stack (the forge's own order).
  assert.deepEqual([...shardTierSmeltPlan(state, 'R').shards], ['metal:beta-shard', 'metal:beta-shard', 'metal:beta-shard']);
  const r = smeltGachaShardTier(state, 'R');
  assert.equal(r.prize.id, 'metal:chrono-alloy-shard');
  const sr = smeltGachaShardTier(r.state, 'SR');
  assert.equal(sr.ok, true, sr.reason);
  assert.equal(sr.prize.id, 'metal:chrono-alloy');
  assert.equal(sr.state.metals['metal:chrono-alloy-shard'] ?? 0, 0, 'the fresh alloy shard went in with the two chrono shards');
  assert.equal(smeltGachaShardTier(normalizeCyberGacha({version: 1}), 'R').reason, 'NOT_ENOUGH_SHARDS');
  assert.equal(smeltGachaShardTier(state, 'SSR').reason, 'UNKNOWN_TIER');
});

test('the royal ranch is UR, the same grade and recipe as the stellar zoo', () => {
  assert.equal(getAutomationItem('auto:royal-ranch').rarity, 'UR');
  assert.equal(getAutomationItem('auto:stellar-zoo').rarity, 'UR');
});

test('the app writes each chip into the saved partner and the Bits machine fills the shop stacks the toolbar reads', async () => {
  const {app, saved} = await qaApp({chips: {'chip:attack': 1, 'chip:core-omega': 1, 'chip:memory': 1, 'chip:hp': 1}, tickets: 0}, seq([0.01]));
  try {
    const partner = app.getCyberGachaFrame().partners.find(p => p.inRanch) ?? app.getCyberGachaFrame().partners[0];
    const id = partner.instanceId, index = partner.speciesIndex, own = speciesCounterFields(index);
    const before = savedProfile(saved(), id) ?? (() => { throw new Error('no saved profile for ' + id); })();
    const attack = app.gachaUseItem('chip:attack', id);
    assert.equal(attack.ok, true, attack.reason);
    let after = savedProfile(saved(), id);
    assert.equal(after.fields['060'], Math.min(999, before.fields['060'] + 18));
    const raceField = own.race ?? Object.keys(attack.counters)[0];
    assert.equal(after.fields[raceField], Math.min(9999, (before.fields[raceField] | 0) + 15));
    assert.deepEqual(attack.counters, {[raceField]: 15});
    const capacity = app.gachaUseItem('chip:memory', id);
    assert.equal(capacity.ok, true, capacity.reason);
    assert.equal(savedProfile(saved(), id).fields['010'], Math.min(99, before.fields['010'] + 2), 'the capacity word is a tournament minimum: it rises');
    const hp = app.gachaUseItem('chip:hp', id);
    assert.equal(hp.ok, true, hp.reason);
    assert.equal(savedProfile(saved(), id).fields['040'], 0, 'training fatigue cleared');
    const omega = app.gachaUseItem('chip:core-omega', id);
    assert.equal(omega.ok, true, omega.reason);
    after = savedProfile(saved(), id);
    assert.equal(after.narrowFields['03d'], 0);
    assert.equal(after.fields['020'], 100);
    assert.ok(GACHA_COUNTER_FIELDS.every(field => after.fields[field] >= 20));
    assert.ok(Array.isArray(app.getCyberGachaFrame().partners[0].routes));

    app.openShop();
    const feedBefore = saved().shop.quantities?.[0] ?? null;
    const pull = app.gachaPull('BITS', 1);
    assert.equal(pull.ok, true, pull.reason);
    assert.deepEqual([pull.prizes[0].id, pull.prizes[0].name, pull.prizes[0].quantity], ['pack:feed', '特選飼料補給箱', 10]);
    if (feedBefore !== null) assert.equal(saved().shop.quantities[0], Math.min(99, feedBefore + 10), 'feed lands in the stack the ranch toolbar reads');
  } finally { await app.dispose(); }
});

test('the app catalyst takes the route the player picks, waives what it lacks and inscribes the 時之 bloodline', async () => {
  // The QA ranch holds 成熟期 partners only: the first one goes back to 成長期 (species 34) for this case.
  const {app, saved} = await qaApp({metals: {'metal:chrono-ore-shard': 2, 'metal:chrono-ore': 1}, tickets: 0}, Math.random, save => {
    const entry = save.raising.collection[0];
    entry.speciesId = 'species-034';
    entry.nativeProfile.fields['000'] = 34;
    // A fresh partner: no evolution points, no battles, low stats.
    for (const field of [...GACHA_COUNTER_FIELDS, '024', '028']) entry.nativeProfile.fields[field] = 0;
    for (const field of ['060', '064', '068', '06c']) entry.nativeProfile.fields[field] = 5;
  });
  try {
    const frame = app.getCyberGachaFrame();
    const partner = frame.partners.find(p => p.inRanch && p.routes.length);
    assert.ok(partner, 'the QA ranch holds a partner below 成熟期 with an evolution route');
    // Product routes ask for one or two conditions, so a shard (waiver 2) reaches every one of them.
    assert.ok(partner.routes.every(r => r.unmetCount >= 1 && r.unmetCount <= SHARD_CATALYST_WAIVER));
    assert.equal(app.gachaUseItem('metal:chrono-ore-shard', partner.instanceId, {mode: 'CATALYST', form: 9999}).reason, 'NO_EVOLUTION_ROUTE');
    const route = partner.routes.at(-1);
    const used = app.gachaUseItem('metal:chrono-ore-shard', partner.instanceId, {mode: 'CATALYST', form: route.target});
    assert.equal(used.ok, true, used.reason);
    assert.deepEqual([used.kind, used.target, used.waived], ['CATALYST', route.target, route.unmetCount]);
    assert.equal(saved().progression.cyberGacha.bloodlines[partner.instanceId], 'chronoOre');
    assert.equal(saved().progression.cyberGacha.metals['metal:chrono-ore-shard'], 1);
  } finally { await app.dispose(); }
});

test('the sure wire downs the first roped partner at once with +15% stats, then the rope is ordinary again', async () => {
  const {createNativeHuntFieldControls} = await import('../src/championship/hunt/capture/nativeHuntFieldControls.js');
  const {HUNT_EQUIPMENT_ITEMS} = await import('../src/championship/hunt/loadout/huntEquipmentCatalog.js');
  const Q = 4096, point = (x, y) => [x * Q, y * Q, 0];
  const pool = read('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json');
  const make = boosts => {
    const individual = structuredClone(pool.poolVectors[0].records[0]);
    const record = {speciesIndex: individual.fields['000'], individual, positionQ12: point(80, 80), facing: 1,
      ai: {state: 1, speedQ12: 4096, field054: 1, field1e0: 0, field1d8: 600}};
    return createNativeHuntFieldControls({records: [record, structuredClone(record)], wildIds: ['left', 'right'],
      environment: {width: 128, height: 128, readTerrain: () => 0, readDirectionCell: () => ({blendQ12: 205, unknownDirection: 0, escapeBoundary: false})},
      rng: {next: () => 51}, loadout: {getSelectedEquipment: () => [{...HUNT_EQUIPMENT_ITEMS.find(i => i.equipmentClass === 'ROPE'), quantity: 1}]},
      consumeItem: () => true, maxCardG: 32, boosts});
  };
  const pull = (controls, a) => {
    a.bound = 1;
    controls.selectTool('ROPE');
    const [x, y] = [a.positionQ12[0] / 2048, a.positionQ12[1] / 2048];
    controls.pointerDown(x, y);
    controls.pointerMove?.(x + 30, y);
    controls.tick(17);
  };
  const sure = make({sureCapture: true, captureStatPercent: 15});
  const [first, second] = sure.actors;
  const attack = first.individual.fields['060'];
  pull(sure, first);
  assert.equal(first.currentHp, 0, 'the first roped partner drops at once');
  assert.equal(first.gachaSureCaught, true);
  assert.equal(first.individual.fields['060'], Math.min(999, attack + Math.round(attack * 0.15)));
  sure.cancel();
  const hp = second.currentHp;
  pull(sure, second);
  assert.ok(second.currentHp > 0 && second.currentHp <= hp, 'the charge is spent: the next rope pulls as usual');
  assert.notEqual(second.gachaSureCaught, true);
  const plain = make(null);
  pull(plain, plain.actors[0]);
  assert.ok(plain.actors[0].currentHp > 0, 'without the cartridge no rope downs at once');
});

test('balance (Owner 2026-11-09): awakening thresholds scale ×2.5 / ×3, items stop at 40, a win drops a ticket 60% of the time', async () => {
  const {burstFormsFor, evaluateBurstConditions, AWAKENING_RULES} = await import('../src/championship/contracts/productBurstEvolution.js');
  const {GACHA_WIN_TICKET_CHANCE} = await import('../src/championship/gacha/cyberGacha.js');
  assert.deepEqual({...AWAKENING_RULES.thresholdScale}, {1: 2.5, 2: 3});
  assert.deepEqual([AWAKENING_RULES.itemCap, {...AWAKENING_RULES.shardEnergy}, {...AWAKENING_RULES.metalEnergy.SSR}],
    [40, {R: 5, SR: 10, SSR: 15}, {1: 30, 2: 20}]);
  const form = burstFormsFor(72).find(f => f.tier === 1 && f.thresholds[22]);
  const profile = {fields: {'000': 72, '024': 0, '028': 0, ...Object.fromEntries(GACHA_COUNTER_FIELDS.map(f => [f, 0]))}, narrowFields: {'03c': 0, '03d': 0}};
  const battles = evaluateBurstConditions(profile, form).rows.find(row => row.id === 'BATTLE_COUNT');
  assert.equal(battles.value, Math.ceil(form.thresholds[22] * 2.5));
  assert.equal(GACHA_WIN_TICKET_CHANCE, 0.6);
  const state = normalizeCyberGacha({version: 1});
  assert.equal(settleGachaBattleWin(state, {bits: 0, random: seq([0.59])}).tickets, 1);
  assert.equal(settleGachaBattleWin(state, {bits: 0, random: seq([0.6])}).tickets, 0);
  const champion = settleGachaBattleWin(state, {bits: 0, tournamentChampion: true, random: seq([0.9, 0.99])});
  assert.equal(champion.tickets, 0 + 2 + 2, 'a title adds 2-4');
});

test('capacity (Owner 2026-11-09 「連牧場一起調」): partners weigh 18-24 G up to 成熟期 and ranks hold about 4 to 12 of them', async () => {
  const {productPartnerG, PRODUCT_RAISING_LIFECYCLE_RULES, PRODUCT_CAPACITY} = await import('../src/championship/contracts/productSpeciesData.js');
  const {productGeneration} = await import('../src/championship/contracts/productGrowthRules.js');
  assert.deepEqual({...PRODUCT_CAPACITY}, {partnerBonusG: 6, rankScale: 1.375});
  for (let index = 8; index < 228; index++) {
    const generation = productGeneration(index);
    if (generation !== null && generation >= 1 && generation <= 4) {
      const g = productPartnerG(index);
      assert.ok(g >= 18 && g <= 24, `species ${index}: ${g} G`);
    }
  }
  const ranks = PRODUCT_RAISING_LIFECYCLE_RULES.ranks.map(r => r.capacity);
  assert.equal(Math.floor(ranks[0] / 22), 4);
  assert.equal(Math.floor(ranks.at(-1) / 22), 12);
  assert.ok(Math.floor((ranks.at(-1) + 64) / 22) <= 16, 'with the whole land it stays within the 16 native slots');
});

// ---- Owner 2026-11-10: chrono inside the hunt, a one-minute real-time hunt, Data Arena beacons, friends switch ----

test('a chrono cartridge joins the running hunt; the real-time hunt itself is one minute', async () => {
  const {REALTIME_HUNT_BASE_MINUTES} = await import('../src/championship/app/championshipStandaloneApp.js');
  const {huntMinutesToSeconds} = await import('../src/championship/gacha/cyberGacha.js');
  assert.equal(huntMinutesToSeconds(REALTIME_HUNT_BASE_MINUTES), 60);
  const {app, saved} = await qaApp({chips: {'chip:chrono': 2}});
  try {
    assert.equal(app.useHuntChrono().reason, 'NOT_IN_HUNT');
    app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
    await app.beginHunt();
    const before = app.getHuntTimeState();
    assert.deepEqual({...app.getHuntChronoState()}, {owned: 2, used: 0, seconds: 120});
    const used = app.useHuntChrono();
    assert.equal(used.ok, true, used.reason);
    assert.ok(used.time.deadlineMinute > before.deadlineMinute, 'the deadline moved');
    assert.deepEqual([app.getHuntChronoState().owned, app.getHuntChronoState().used], [1, 1]);
    assert.ok(app.getHuntGachaBoosts().includes('chip:chrono'), 'the HUD shows it');
    assert.equal(app.useHuntChrono().ok, true, 'a one-minute hunt may take several');
    assert.equal(app.useHuntChrono().reason, 'NOT_OWNED');
    app.save();
    assert.equal(saved().progression.cyberGacha.chips['chip:chrono'], undefined, 'spent cartridges are saved');
  } finally { await app.dispose(); }
});

test('a Data Arena win spends an armed beacon: tickets 60% of the time, battles on the party, no purse', async () => {
  const {app, saved} = await qaApp({chips: {'chip:bounty-beta': 1}}, seq([0.1]));
  try {
    assert.equal(app.gachaUseItem('chip:bounty-beta').kind, 'ARMED');
    const partner = app.getCyberGachaFrame().partners.find(p => p.stats);
    const before = partner.stats.battleCount;
    const win = app.settleDataArenaWin({tournament: false, partyIds: [partner.instanceId]});
    assert.equal(win.ok, true, win.reason);
    assert.deepEqual([win.granted, win.beacon, win.battles], [1 + 2, 'chip:bounty-beta', 2]);
    assert.equal(app.getCyberGachaFrame().partners.find(p => p.instanceId === partner.instanceId).stats.battleCount, before + 2);
    assert.equal(saved().progression.cyberGacha.armed.bounty, undefined, 'the beacon is used up and saved');
    const plain = app.settleDataArenaWin({tournament: true, partyIds: []});
    assert.equal(plain.beacon, null);
    assert.ok(plain.granted >= 1 + 2 && plain.granted <= 1 + 4, 'a cup adds 2-4');
  } finally { await app.dispose(); }
});

test('the friends mode is off on the public site and a remembered hidden switch elsewhere', async () => {
  const {resolveFriendsPlaytestPolicy} = await import('../src/championship/app/friendsPlaytestPolicy.js');
  const {createChampionshipFriendsSwitchPort, CHAMPIONSHIP_FRIENDS_SWITCH_KEY: FRIENDS_PLAYTEST_SWITCH_KEY} = await import('../src/championship/app/ChampionshipPersistentSavePort.js');
  const raw = () => { const data = new Map(); return {data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)}; };
  const store = (backing = raw()) => ({...createChampionshipFriendsSwitchPort({storage: backing}), data: backing.data});
  const pub = 'orochi771127.github.io';
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, remembered: store()}).enabled, false, 'public default: off');
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, remembered: store()}).shopOpen, false);
  assert.equal(resolveFriendsPlaytestPolicy({hostname: '127.0.0.1', remembered: store()}).enabled, true, 'loopback default: on');
  const s = store();
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, search: '?friends=1', remembered: s}).enabled, true);
  assert.equal(s.data.get(FRIENDS_PLAYTEST_SWITCH_KEY), '1');
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, remembered: s}).enabled, true, 'remembered on this device');
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, search: '?friends=0', remembered: s}).enabled, false);
  assert.equal(resolveFriendsPlaytestPolicy({hostname: '127.0.0.1', remembered: s}).enabled, false, 'a remembered choice wins on loopback too');
  const blocked = createChampionshipFriendsSwitchPort({storage: {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }}});
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, search: '?friends=1', remembered: blocked}).enabled, true, 'blocked storage: the URL still works');
  assert.equal(resolveFriendsPlaytestPolicy({hostname: pub, remembered: blocked}).enabled, false);
});
