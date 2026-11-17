// TAMER_TALENTS_T3_20261118: the commander line in the auto battle and the hunter's elite sense.
//   commander  先手 (opening TP), 好心情 (best mood's TP share), 心輝 / 黑鐵 / 裂隙共鳴 (that resonance's bonus +20 % a rank),
//              逆境 (defence under 30 % HP), 必殺 (signature damage)
//   hunter     野性嗅覺 (elite share +30 % a rank, the hunt's limit unchanged)
// Plan: docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 4.1 and 4.3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {TALENT_NODES, TALENT_TIER_GATE, TALENT_WIRED_KEYS, talentOpen} from '../src/championship/contracts/productTamerTalents.js';
import {TAMER_TALENT_COPY, talentEffectText} from '../src/championship/text/tamerTalentText.js';
import {createBattleTaxonomyAdaptation, normalizeBattleCommander, resonanceBoosted, BATTLE_TAXONOMY_V1, BATTLE_TAXONOMY_ORIGINAL,
  BATTLE_TAXONOMY_REGEN_FRAMES, COMMANDER_LOW_HP_PERCENT} from '../src/championship/battle/battleTaxonomyAdaptation.js';
import {speciesTaxonomy} from '../src/championship/contracts/speciesTaxonomy.js';
import {settleWildInstincts, WILD_INSTINCT_LIMITS} from '../src/championship/contracts/productAwakeningOverdrive.js';
import {moodBattleProfile} from '../src/championship/raising/ranchPartnerLife.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const T3_KEYS = ['openingTpPercent', 'moodCapPercent', 'resonanceLumenPercent', 'resonanceIronPercent', 'resonanceRiftPercent',
  'lowHpDefensePercent', 'ultimatePercent', 'elitePercent'];
const nodeOf = key => TALENT_NODES.find(node => node.key === key);
const maxed = ids => ({version: 1, level: 50, exp: 0, nodes: Object.fromEntries(ids.map(id => [id, TALENT_NODES.find(node => node.id === id).max])), keystones: {}, respecs: 0});
const COMMANDER = TALENT_NODES.filter(node => node.line === 'commander').map(node => node.id);

test('T3 opens eight nodes with copy in five languages; the commander line reaches tier three', () => {
  for (const key of T3_KEYS) {
    assert.ok(TALENT_WIRED_KEYS.has(key), key);
    for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentEffectText(nodeOf(key), 1, locale).length > 0, `${key} ${locale}`);
  }
  assert.ok(TALENT_WIRED_KEYS.size >= 26, 'eighteen before and these eight; later batches only add');
  const openPoints = tier => TALENT_NODES.filter(node => node.line === 'commander' && node.tier === tier && talentOpen(node.id))
    .reduce((sum, node) => sum + node.max * node.cost, 0);
  assert.ok(openPoints(1) >= TALENT_TIER_GATE[2]);
  assert.ok(openPoints(1) + openPoints(2) >= TALENT_TIER_GATE[3]);
  assert.equal(talentEffectText(nodeOf('lowHpDefensePercent'), 3, 'zh-Hant'), 'HP 30% 以下防禦 +15%');
});

// Two species of each faction, found in the taxonomy itself so the case does not depend on a species number.
const ofFaction = faction => Array.from({length: 240}, (_, i) => i).filter(i => speciesTaxonomy(i)?.faction === faction).slice(0, 2);
const LUMEN = ofFaction('LUMEN'), IRON = ofFaction('IRON'), RIFT = ofFaction('RIFT');
const teamOf = slot => (slot < 3 ? 0 : 1);
const adapt = (own, foe, commander, policy = BATTLE_TAXONOMY_V1) => createBattleTaxonomyAdaptation({policy,
  speciesBySlot: [own[0], own[1], null, foe[0], foe[1], null], teamOf, commander});
const hit = (adaptation, extra = {}) => adaptation.scaleDamage({attackerSlot: 3, defenderSlot: 0, elementSelector: 0, damage: 1000, ...extra});
const strike = (adaptation, extra = {}) => adaptation.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 0, damage: 1000, ...extra});

test('a resonance talent makes that resonance\'s own bonus 20 % larger a rank, for the commander\'s team only', () => {
  assert.equal(LUMEN.length + IRON.length + RIFT.length, 6);
  assert.deepEqual([resonanceBoosted(90, 20), resonanceBoosted(108, 20), resonanceBoosted(115, 60), resonanceBoosted(120, 0)].map(v => Math.round(v * 10) / 10), [88, 109.6, 124, 120]);
  // 心輝: damage taken 90 % -> 84 % at three ranks; 1 % regen -> 1.6 %.
  assert.equal(hit(adapt(LUMEN, RIFT, null)), 900);
  assert.equal(hit(adapt(LUMEN, RIFT, {team: 0, lumenPercent: 60})), 840);
  assert.equal(hit(adapt(LUMEN, RIFT, {team: 1, lumenPercent: 60})), 900, 'the other team\'s talents do not act on this team');
  const slots = boosted => { const list = [{currentHp: 500, maxHp: 1000}, {currentHp: 1000, maxHp: 1000}, null, {currentHp: 500, maxHp: 1000}, null, null];
    adapt(LUMEN, LUMEN, boosted).regen(BATTLE_TAXONOMY_REGEN_FRAMES, list); return [list[0].currentHp, list[3].currentHp]; };
  assert.deepEqual(slots(null), [510, 510]);
  assert.deepEqual(slots({team: 0, lumenPercent: 60}), [516, 510], 'both teams light Lumen; only the commander\'s heals more');
  // 黑鐵: defence 108 % -> 112.8 %; opening TP 120 % -> 132 %.
  assert.equal(hit(adapt(IRON, RIFT, null)), Math.trunc(1000 * 100 / 108));
  assert.equal(hit(adapt(IRON, RIFT, {team: 0, ironPercent: 60})), Math.trunc(1000 * 100 / 112.8));
  const opening = (own, commander, policy) => { const list = [{metricBase: 100, metricLimit: 100}, {metricBase: 50, metricLimit: 50}, null, {metricBase: 100, metricLimit: 100}, null, null];
    adapt(own, IRON, commander, policy).applyStart(list); return [list[0].metricLimit, list[1].metricLimit, list[3].metricLimit]; };
  assert.deepEqual(opening(IRON, null), [120, 60, 120]);
  assert.deepEqual(opening(IRON, {team: 0, ironPercent: 60}), [132, 66, 120]);
  // 裂隙: crit +10 -> +16; signature 115 % -> 124 %.
  assert.deepEqual([adapt(RIFT, LUMEN, null).critBonus(0), adapt(RIFT, LUMEN, {team: 0, riftPercent: 60}).critBonus(0), adapt(RIFT, RIFT, {team: 0, riftPercent: 60}).critBonus(3)], [10, 16, 10]);
  assert.equal(strike(adapt(RIFT, IRON, null), {signature: true}), Math.trunc(1000 * 115 / 108));
  assert.equal(strike(adapt(RIFT, IRON, {team: 0, riftPercent: 60}), {signature: true}), Math.trunc(1000 * 124 / 108));
});

test('先手, 逆境 and 必殺 act for the commander\'s team with or without a resonance, and under the original policy too', () => {
  const lead = {team: 0, openingTpPercent: 15, lowHpDefensePercent: 15, ultimatePercent: 9};
  const start = (own, commander, policy = BATTLE_TAXONOMY_V1) => { const list = [{metricBase: 100, metricLimit: 100}, null, null, {metricBase: 100, metricLimit: 100}, null, null];
    adapt(own, RIFT, commander, policy).applyStart(list); return [list[0].metricLimit, list[3].metricLimit]; };
  assert.deepEqual(start(LUMEN, lead), [115, 100], '先手: +5 % opening TP a rank');
  assert.deepEqual(start(IRON, {...lead, ironPercent: 60}), [147, 100], 'on top of Black Iron\'s own opening');
  assert.deepEqual(start(LUMEN, lead, BATTLE_TAXONOMY_ORIGINAL), [115, 100]);
  assert.deepEqual(start(LUMEN, null, BATTLE_TAXONOMY_ORIGINAL), [100, 100], 'no commander: the original opening');
  // 逆境: only under 30 % HP.
  assert.equal(COMMANDER_LOW_HP_PERCENT, 30);
  const plain = adapt([RIFT[0], IRON[0]], LUMEN, lead); // no resonance on team 0
  assert.equal(hit(plain, {defenderHpPercent: 30}), 1000);
  assert.equal(hit(plain, {defenderHpPercent: 29.9}), Math.trunc(1000 * 100 / 115));
  assert.equal(strike(plain, {defenderHpPercent: 10}), 900, 'the other team gets Lumen\'s own 90 % and nothing from the commander');
  // 必殺: the signature move only.
  assert.equal(strike(adapt([RIFT[0], IRON[0]], [RIFT[0], IRON[0]], lead), {signature: true}), 1090);
  assert.equal(strike(adapt([RIFT[0], IRON[0]], [RIFT[0], IRON[0]], lead)), 1000);
  const original = adapt(LUMEN, LUMEN, lead, BATTLE_TAXONOMY_ORIGINAL);
  assert.equal(strike(original, {signature: true}), 1090);
  assert.equal(hit(original, {defenderHpPercent: 5}), Math.trunc(1000 * 100 / 115));
  assert.equal(hit(original), 1000, 'and no resonance under the original policy');
  assert.equal(strike(adapt(LUMEN, LUMEN, null, BATTLE_TAXONOMY_ORIGINAL), {signature: true}), 1000);
  // Only a team and positive finite shares are a commander.
  assert.equal(normalizeBattleCommander(null), null);
  assert.equal(normalizeBattleCommander({team: 2, ultimatePercent: 9}), null);
  assert.equal(normalizeBattleCommander({team: 0, ultimatePercent: -3, lumenPercent: NaN}), null);
  assert.deepEqual(normalizeBattleCommander({team: 1, ultimatePercent: 500, extra: 7}),
    {team: 1, lumenPercent: 0, ironPercent: 0, riftPercent: 0, openingTpPercent: 0, lowHpDefensePercent: 0, ultimatePercent: 100});
});

test('野性嗅覺: the elite share is 30 % larger a rank and a hunt still holds at most one elite', () => {
  // Elite sits between 98.2 and 99.7 of 100; at three ranks (+90 %) it starts at 96.85.
  assert.deepEqual(settleWildInstincts([0.975, 0.5]), ['NORMAL', 'NORMAL']);
  assert.deepEqual(settleWildInstincts([0.975, 0.5], {elitePercent: 90}), ['ELITE', 'NORMAL']);
  assert.deepEqual(settleWildInstincts([0.97, 0.5], {elitePercent: 30}), ['NORMAL', 'NORMAL'], 'one rank starts at 97.75');
  assert.deepEqual(settleWildInstincts([0.98, 0.5], {elitePercent: 30}), ['ELITE', 'NORMAL']);
  assert.equal(WILD_INSTINCT_LIMITS.ELITE, 1);
  assert.deepEqual(settleWildInstincts([0.975, 0.976, 0.977], {elitePercent: 90}), ['ELITE', 'NORMAL', 'NORMAL'], 'the limit is not raised');
  assert.deepEqual(settleWildInstincts([0.999], {elitePercent: 90}), ['ANCESTOR'], 'the ancestral share keeps its place at the top');
  assert.deepEqual(settleWildInstincts([0.975], {elitePercent: -50}), ['NORMAL']);
  assert.deepEqual(settleWildInstincts([0.975], null), ['NORMAL']);
});

test('好心情: the best mood\'s TP share grows a point a rank, at most three; other moods are unchanged', () => {
  const profile = {fields: {'05c': 200, '054': 100, '084': 3, '08c': 5}};
  assert.deepEqual(moodBattleProfile(profile, 'superb').fields, {'05c': 220, '054': 110, '084': 4, '08c': 5});
  assert.deepEqual(moodBattleProfile(profile, 'superb', 3).fields, {'05c': 226, '054': 113, '084': 4, '08c': 5});
  assert.deepEqual(moodBattleProfile(profile, 'superb', 9).fields['05c'], 226);
  assert.deepEqual(moodBattleProfile(profile, 'good', 3).fields, moodBattleProfile(profile, 'good').fields);
  assert.deepEqual(moodBattleProfile(profile, 'awful', 3).fields, moodBattleProfile(profile, 'awful').fields);
  assert.equal(moodBattleProfile(profile, 'normal', 3), profile);
});

// ---- the app ---------------------------------------------------------------------------------------

async function talentApp(talents, extra = save => save) {
  const data = new Map(), storage = {getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key), setItem: (key, value) => data.set(key, value)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z'});
  const first = make(); await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  if (talents) save.progression.tamerTalents = talents;
  extra(save); data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make(); await app.continueGame();
  return {app, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}
const PARTNER = 'championship:2026:instance:0001';

test('app: the commander line for a battle follows its mode, capped in title matches and tournaments, absent for password and link', async () => {
  const {app} = await talentApp(maxed(COMMANDER), save => { save.progression.tamerRank = 0; });
  try {
    const full = {lumenPercent: 60, ironPercent: 60, riftPercent: 60, openingTpPercent: 15, lowHpDefensePercent: 15, ultimatePercent: 9};
    assert.deepEqual(app.getBattleCommander(2), full, 'Free Battle counts the whole line');
    assert.deepEqual(app.getBattleCommander(5), full);
    // Rank 0: six points, counted rank by rank across tier one (同步訓練, 先手, 好心情): two ranks of 先手 and nothing above.
    const capped = {lumenPercent: 0, ironPercent: 0, riftPercent: 0, openingTpPercent: 10, lowHpDefensePercent: 0, ultimatePercent: 0};
    assert.deepEqual(app.getBattleCommander(1), capped);
    assert.deepEqual(app.getBattleCommander(0), capped);
    for (const mode of [3, 4, 6, undefined]) assert.equal(app.getBattleCommander(mode), null, `mode ${mode}`);
    const open = await app.prepareBattleParty(null, [PARTNER], {sync: {capped: false}});
    const title = await app.prepareBattleParty(null, [PARTNER], {sync: {capped: true}});
    const password = await app.prepareBattleParty(null, [PARTNER], {});
    if (open.ok && title.ok && password.ok)
      assert.deepEqual([open.individuals[0].moodCap, title.individuals[0].moodCap, password.individuals[0].moodCap], [3, 2, 0]);
  } finally { await app.dispose(); }
});

test('app: without commander talents a battle gets no commander at all', async () => {
  const {app} = await talentApp(null);
  try { for (const mode of [0, 1, 2, 5]) assert.equal(app.getBattleCommander(mode), null); } finally { await app.dispose(); }
});

test('the battle runtime is handed the commander line for the local team, and the hit knows the defender\'s HP share', () => {
  const main = source('src/championship/app/main.js'), runtime = source('src/championship/app/battleRuntime.js'), app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(main, /commander: app\?\.getBattleCommander\?\.\(options\.mode\) \?\? null, \.\.\.options \}\);/);
  assert.match(runtime, /commander:options\.commander\?\{\.\.\.options\.commander,team:localTeamIndex\}:null\}\);/);
  assert.match(runtime, /defenderHpPercent: defender\?\.maxHp > 0 \? defender\.currentHp \* 100 \/ defender\.maxHp : 100/);
  assert.match(app, /elitePercent: talent\('elitePercent'\)/);
  assert.equal(app.match(/p\.supplyIds\?\?\[\],p\.moodCap\?\?0\)/g).length, 2, 'both stale-preparation checks rebuild the copy with the same mood cap');
});
