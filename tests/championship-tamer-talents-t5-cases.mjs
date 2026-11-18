// TAMER_TALENTS_T5_20261118: the breeder's 安撫 and the first three keystones.
//   breeder    安撫 (everything that pulls a partner's mood down pulls 10 % less a rank)
//   commander  純色陣營 (three of one faction: that resonance's bonus +50 %), 三色指揮 (Tri-core 114 % / 114 % / 125 %)
//   trader     賞金獵人 (the bounty beacon's extra Bits +50 %)
// Plan: docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 4.2 to 4.4.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {TALENT_NODES, TALENT_KEYSTONES, TALENT_WIRED_KEYS, TALENT_WIRED_KEYSTONES, KEYSTONE_RULES, talentOpen, keystoneRefusal, chooseKeystone, hasKeystone,
  commanderCappedTalents} from '../src/championship/contracts/productTamerTalents.js';
import {TAMER_TALENT_COPY, talentEffectText, talentKeystoneText} from '../src/championship/text/tamerTalentText.js';
import {createBattleTaxonomyAdaptation, normalizeBattleCommander, BATTLE_TAXONOMY_V1} from '../src/championship/battle/battleTaxonomyAdaptation.js';
import {speciesTaxonomy} from '../src/championship/contracts/speciesTaxonomy.js';
import {partnerMoodScore} from '../src/championship/raising/ranchPartnerLife.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const KEYSTONES = ['commander.pureFaction', 'commander.triColor', 'trader.bountyHunter'];
const lineNodes = line => TALENT_NODES.filter(node => node.line === line && talentOpen(node.id)).map(node => node.id);
const maxed = (ids, keystones = {}) => ({version: 1, level: 50, exp: 0, nodes: Object.fromEntries(ids.map(id => [id, TALENT_NODES.find(node => node.id === id).max])), keystones, respecs: 0});

test('T5 opens 安撫 and three keystones, each with a line of copy in five languages', () => {
  assert.ok(TALENT_WIRED_KEYS.has('moodDecayPercent'));
  assert.equal(talentEffectText(TALENT_NODES.find(node => node.key === 'moodDecayPercent'), 3, 'zh-Hant'), '−30% 心情扣分');
  for (const id of KEYSTONES) {
    assert.ok(TALENT_WIRED_KEYSTONES.has(id) && talentOpen(id), id);
    for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentKeystoneText(id, locale).length > 0, `${id} ${locale}`);
  }
  for (const key of TALENT_KEYSTONES.filter(entry => !TALENT_WIRED_KEYSTONES.has(entry.id))) assert.equal(talentOpen(key.id), false, `${key.id} stays shown as not open`);
  // A line takes one of its two, at 22 points in the line's nodes.
  const state = maxed(lineNodes('commander'));
  assert.equal(keystoneRefusal(maxed(lineNodes('commander').slice(0, 5)), 'commander.triColor', 76), 'TALENT_TIER_LOCKED');
  const taken = chooseKeystone(state, 'commander.triColor', 76);
  assert.ok(hasKeystone(taken, 'commander.triColor'));
  assert.equal(keystoneRefusal(taken, 'commander.pureFaction', 76), 'TALENT_KEYSTONE_TAKEN');
});

test('安撫: what pulls the mood down pulls 10 % less a rank; what lifts it is unchanged', () => {
  const sick = {fields: {'020': 50, '01c': 60}}; // 10 from affection, -21 from illness
  assert.equal(partnerMoodScore(sick).score, -11);
  assert.equal(partnerMoodScore({...sick, soothePercent: 30}).score, Math.round(10 - 21 * 0.7));
  assert.equal(partnerMoodScore({...sick, soothePercent: 90}).score, Math.round(10 - 21 * 0.7), 'at most 30 %');
  assert.equal(partnerMoodScore({...sick, soothePercent: -40}).score, -11);
  const rough = {fields: {'020': 80}, habitat: 'poor', dirty: true, moments: ['disturbed', 'greeted']}; // 22 - 20 - 10 - 15 + 8
  assert.equal(partnerMoodScore(rough).score, -15);
  assert.equal(partnerMoodScore({...rough, soothePercent: 20}).score, Math.round(22 - 45 * 0.8 + 8));
  const happy = {fields: {'020': 100, '050': 90, '058': 100}, habitat: 'cozy', moments: ['greeted', 'found']};
  assert.equal(partnerMoodScore({...happy, soothePercent: 30}).score, partnerMoodScore(happy).score);
  assert.deepEqual(partnerMoodScore({...sick, soothePercent: 30}).reasons, partnerMoodScore(sick).reasons, 'the reasons shown are the same');
  assert.match(source('src/championship/app/championshipStandaloneApp.js'), /moments,soothePercent:-talent\('moodDecayPercent'\)\}\);/);
});

const ofFaction = faction => Array.from({length: 240}, (_, i) => i).filter(i => speciesTaxonomy(i)?.faction === faction).slice(0, 3);
const LUMEN = ofFaction('LUMEN'), IRON = ofFaction('IRON'), RIFT = ofFaction('RIFT');
const teamOf = slot => (slot < 3 ? 0 : 1);
const adapt = (own, foe, commander) => createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_V1,
  speciesBySlot: [own[0] ?? null, own[1] ?? null, own[2] ?? null, foe[0] ?? null, foe[1] ?? null, foe[2] ?? null], teamOf, commander});
const hit = (adaptation, extra = {}) => adaptation.scaleDamage({attackerSlot: 3, defenderSlot: 0, elementSelector: 0, damage: 1000, ...extra});
const strike = (adaptation, extra = {}) => adaptation.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 0, damage: 1000, ...extra});

test('純色陣營: three partners of one faction make that resonance half as large again, for the commander team only', () => {
  assert.equal(KEYSTONE_RULES.pureFactionPercent, 50);
  const pure = {team: 0, pureFaction: true};
  assert.equal(hit(adapt(LUMEN, [RIFT[0], IRON[0]], null)), 900);
  assert.equal(hit(adapt(LUMEN, [RIFT[0], IRON[0]], pure)), 850, 'damage taken 90 % -> 85 %');
  assert.equal(hit(adapt(LUMEN, [RIFT[0], IRON[0]], {...pure, lumenPercent: 60})), 790, 'on top of 心輝共鳴: 10 x 2.1');
  assert.equal(hit(adapt(LUMEN.slice(0, 2), [RIFT[0], IRON[0]], pure)), 900, 'two are a resonance, not a pure team');
  assert.equal(hit(adapt([LUMEN[0], LUMEN[1], RIFT[0]], [RIFT[0], IRON[0]], pure)), 900);
  assert.equal(strike(adapt([RIFT[0], IRON[0]], LUMEN, pure)), 900, 'the other team being pure is not the commander being pure');
  assert.equal(adapt(RIFT, [LUMEN[0], IRON[0]], pure).critBonus(0), 15);
  const iron = [{metricBase: 100, metricLimit: 100}, {metricBase: 100, metricLimit: 100}, {metricBase: 100, metricLimit: 100}, null, null, null];
  adapt(IRON, [], pure).applyStart(iron);
  assert.equal(iron[0].metricLimit, 130, 'Black Iron opening 120 % -> 130 %');
  assert.deepEqual(normalizeBattleCommander({team: 0, pureFaction: true}), {team: 0, lumenPercent: 0, ironPercent: 0, riftPercent: 0, openingTpPercent: 0,
    lowHpDefensePercent: 0, ultimatePercent: 0, pureFaction: true, triColor: false});
  assert.equal(normalizeBattleCommander({team: 0, pureFaction: 'yes'}), null);
});

test('三色指揮: the commander Tri-core gives 114 % attack and defence and 125 % rewards; the other team keeps 108 % and 115 %', () => {
  assert.deepEqual(KEYSTONE_RULES.triColor, {attackPercent: 114, defensePercent: 114, rewardPercent: 125});
  const tri = [LUMEN[0], IRON[0], RIFT[0]], lead = {team: 0, triColor: true};
  const plain = adapt(tri, tri, null), mine = adapt(tri, tri, lead);
  assert.equal(strike(plain), Math.trunc(1000 * 108 / 108));
  assert.equal(strike(mine), Math.trunc(1000 * 114 / 108), 'my attack against their unchanged defence');
  assert.equal(hit(mine), Math.trunc(1000 * 108 / 114), 'their unchanged attack against my defence');
  assert.deepEqual([plain.rewardPercent(0), mine.rewardPercent(0), mine.rewardPercent(1)], [115, 125, 115]);
  assert.equal(adapt(LUMEN, tri, lead).rewardPercent(0), 100, 'no Tri-core lit, nothing to raise');
});

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

test('app: a keystone is taken through the tree in one save and rides the commander line, dropped by the rank cap', async () => {
  // Rank 0 leaves 49 points from the level and a few from the Dex: eight nodes a line (24 points) open each keystone.
  const {app, saved} = await talentApp(maxed([...lineNodes('commander'), ...lineNodes('trader').filter(id => id !== 'trader.belt').slice(0, 8)]), save => { save.progression.tamerRank = 0; });
  try {
    const frame = app.getTamerTalentFrame(), commander = frame.lines.find(line => line.line === 'commander');
    assert.deepEqual(commander.keystones.map(key => [key.id, key.open]), [['commander.pureFaction', true], ['commander.triColor', true]]);
    assert.equal(app.getBattleCommander(2).triColor, false);
    assert.deepEqual(app.learnTamerTalent('commander.triColor'), {ok: true, id: 'commander.triColor'});
    assert.equal(saved().progression.tamerTalents.keystones.commander, 'commander.triColor');
    assert.equal(app.learnTamerTalent('commander.pureFaction').reason, 'TALENT_KEYSTONE_TAKEN');
    assert.deepEqual([app.getBattleCommander(2).triColor, app.getBattleCommander(2).pureFaction], [true, false], 'Free Battle counts the whole line');
    assert.equal(app.getBattleCommander(1).triColor, false, 'rank 0 counts six commander points: no keystone in a title match');
    const hunter = app.learnTamerTalent('trader.bountyHunter');
    assert.equal(hunter.ok, true, `${hunter.reason} with ${app.getTamerTalentFrame().free} points free`);
    assert.equal(app.learnTamerTalent('trader.peddler').reason, 'TALENT_NOT_OPEN');
  } finally { await app.dispose(); }
  assert.equal(hasKeystone(commanderCappedTalents(maxed(lineNodes('commander'), {commander: 'commander.triColor'}), 9), 'commander.triColor'), true, 'rank 9 counts the whole line');
});

test('賞金獵人 is read where the beacon share of a won match is worked out, and the panel prints what a keystone does', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /const hunterBits=drop\.bonusBits>0&&hasKeystone\(talentState\(\),'trader\.bountyHunter'\)\?Math\.floor\(drop\.bonusBits\*KEYSTONE_RULES\.bountyHunterPercent\/100\):0;/);
  assert.match(app, /wallet=Math\.min\(BITS_WALLET_CAP,result\.wallet\+drop\.bonusBits\+hunterBits\);/);
  assert.match(app, /bonusBits:beaconWallet-result\.wallet,talentBits:wallet-beaconWallet/, 'the result page counts it in the beacon share');
  // TALENT_TREE_20261118: the tree shows a keystone's effect in its reading bar (hold) and its accessible name; one not built yet reads 未開放.
  const panel = source('src/championship/app/tamerTalentPanel.js');
  assert.match(panel, /if \(!node\.open\) return \{ name, effect: talentText\("TALENT_NOT_OPEN"\), note: "" \};/);
  assert.match(panel, /if \(node\.keystone\) return \{ name, effect: talentKeystoneText\(node\.id\), note \};/);
});
