// ROADMAP_R1B_20261118: a shop row, a hunt tool or a hunt gate that asks for a tamer rank opens at that rank OR at
// the tamer level that stands for it (5 levels a rank). The title rules, the ranch land, the generation licence,
// the Sync cap and the burst tier keep reading the rank the titles gave.
// Plan: docs/planning/TAMER_PROGRESSION_ROADMAP_2026-11-18_ZH_TW.md, batch R1b.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {TAMER_LEVELS_PER_RANK, TAMER_LEVEL_RANK_MAX, TAMER_LEVEL_MAX, tamerLevelRank, tamerLevelForRank, tamerExpRequired}
  from '../src/championship/contracts/productTamerTalents.js';
import {CHAMPIONSHIP_GATES} from '../src/championship/gate/gateCatalog.js';
import {listShopRecords} from '../src/championship/shop/shopCatalog.js';
import {shopUnlockText} from '../src/championship/app/huntToolFamilyCards.js';
import {talentText} from '../src/championship/text/tamerTalentText.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale} from '../src/championship/text/locale.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tamer = (level, exp = 0) => ({version: 1, level, exp, nodes: {}, keystones: {}, respecs: 0});

test('five tamer levels stand for one rank, up to rank 9 at Lv.45', () => {
  assert.deepEqual([TAMER_LEVELS_PER_RANK, TAMER_LEVEL_RANK_MAX], [5, 9]);
  assert.deepEqual([1, 4, 5, 9, 10, 44, 45, 50].map(tamerLevelRank), [0, 0, 1, 1, 2, 8, 9, 9]);
  assert.deepEqual([0, 1, 5, 9, 12].map(tamerLevelForRank), [0, 5, 25, 45, 45]);
  assert.deepEqual([undefined, NaN, -3].map(tamerLevelRank), [0, 0, 0]);
  for (let rank = 0; rank <= TAMER_LEVEL_RANK_MAX; rank++) assert.equal(tamerLevelRank(tamerLevelForRank(rank)), rank);
  assert.ok(tamerLevelForRank(TAMER_LEVEL_RANK_MAX) <= TAMER_LEVEL_MAX);
  // Every rank the shop and the gates ask for can be reached by level.
  const asked = [...listShopRecords().filter(r => r.unlockKind === 'TAMER_RANK_THRESHOLD').map(r => r.unlockParameter),
    ...CHAMPIONSHIP_GATES.filter(g => g.unlockKind === 1).map(g => g.unlockParameter)];
  assert.ok(asked.length > 0);
  assert.ok(asked.every(rank => rank >= 1 && rank <= TAMER_LEVEL_RANK_MAX));
});

async function levelApp(talents, {crystals = 0} = {}) {
  const data = new Map(), storage = {getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key), setItem: (key, value) => data.set(key, value)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z'});
  const first = make(); await first.newGame(); first.save();
  // A plain new save: title rank 0 and every rank-gated shop row still hidden (the full QA save shows them all).
  const save = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  await first.dispose();
  assert.equal(save.progression.tamerRank ?? 0, 0);
  if (talents) save.progression.tamerTalents = talents;
  save.progression.syncLevels = {version: 1, partners: {}, crystals};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make(); await app.continueGame();
  return app;
}
const rankGates = rank => CHAMPIONSHIP_GATES.filter(g => g.unlockKind === 1 && g.unlockParameter === rank).map(g => g.gateId);
const gateState = (app, gateId) => app.getGates().find(g => g.gateId === gateId)?.state;

test('app: at title rank 0 a tamer of Lv.10 opens the rank 1 and 2 gates, and nothing the titles own', async () => {
  const low = await levelApp(tamer(4));
  try {
    assert.equal(low.getTamerRank(), 0);
    for (const gateId of [...rankGates(1), ...rankGates(2)]) assert.equal(gateState(low, gateId), 'LOCKED', gateId);
    assert.deepEqual(low.getTamerTalentFrame().unlock, {rank: 0, titleRank: 0, levelRank: 0, nextRank: 1, nextLevel: 5});
  } finally { await low.dispose(); }
  const app = await levelApp(tamer(10));
  try {
    for (const gateId of [...rankGates(1), ...rankGates(2)]) assert.equal(gateState(app, gateId), 'AVAILABLE', gateId);
    for (const gateId of rankGates(3)) {
      assert.equal(gateState(app, gateId), 'LOCKED', gateId);
      const admission = app.getGateAdmission(gateId);
      assert.deepEqual([admission.reason, admission.unlockParameter, admission.unlockLevel], ['GATE_LOCKED', 3, 15]);
    }
    assert.equal(app.getTamerRank(), 0, 'the title rank is not touched');
    assert.equal(app.getTitleProgress().rank, 0);
    assert.equal(app.getSyncCap(), (await import('../src/championship/contracts/productSyncLevel.js')).syncCapForRank(0));
    assert.deepEqual(app.getTamerTalentFrame().unlock, {rank: 2, titleRank: 0, levelRank: 2, nextRank: 3, nextLevel: 15});
  } finally { await app.dispose(); }
});

test('app: crystals that raise the tamer to Lv.5 open the rank 1 shop rows and gates at once', async () => {
  const app = await levelApp(tamer(4), {crystals: 5000});
  try {
    const rankOne = listShopRecords().filter(r => r.unlockKind === 'TAMER_RANK_THRESHOLD' && r.unlockParameter === 1).map(r => r.shopRecordIndex);
    assert.ok(rankOne.length > 0);
    const unlocked = () => app.getShopFrame().listings.filter(row => rankOne.includes(row.shopRecordIndex)).length;
    assert.equal(app.getShopFrame().lockedListings.filter(row => rankOne.includes(row.shopRecordIndex)).length, rankOne.length);
    assert.equal(unlocked(), 0);
    const fed = app.feedTamerCrystals(tamerExpRequired(4));
    assert.deepEqual([fed.ok, fed.gain.after.level], [true, 5]);
    assert.equal(unlocked(), rankOne.length);
    for (const gateId of rankGates(1)) assert.equal(gateState(app, gateId), 'AVAILABLE', gateId);
    assert.equal(app.getTamerRank(), 0);
  } finally { await app.dispose(); }
});

test('the lock copy names both roads in five languages, and stays short', () => {
  try {
    for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
      setLocale(locale);
      const gate = uiText('階級 {rank} 或馴獸師 Lv.{level} 開放。', {rank: 3, level: 15});
      assert.match(gate, /3/); assert.match(gate, /Lv\.15/, locale);
      assert.match(shopUnlockText({kind: 'TAMER_RANK_THRESHOLD', parameter: 2}), /Lv\.10/, locale);
      assert.match(shopUnlockText({kind: 'TAMER_RANK_THRESHOLD', parameter: 2}, {short: true}), /Lv\.10/, locale);
      assert.match(talentText('unlock', {level: 15, rank: 'R'}, locale), /Lv\.15.*R|R.*Lv\.15/, locale);
      assert.ok(uiText('狩獵場、商店：馴獸師每 5 級也算 1 階').length > 0);
    }
    setLocale('zh-Hant');
    for (const line of [uiText('階級 {rank} 或馴獸師 Lv.{level} 開放。', {rank: 9, level: 45}), uiText('狩獵場、商店：馴獸師每 5 級也算 1 階'),
      shopUnlockText({kind: 'TAMER_RANK_THRESHOLD', parameter: 9}), talentText('unlock', {level: 45, rank: '大師'}, 'zh-Hant')]) {
      assert.ok([...line].length <= 24, `${line} is ${[...line].length} characters`);
    }
  } finally { setLocale('zh-Hant'); }
});

test('only the shop, the hunt tools and the gates read the level; the screens say so', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /return \{ tamerRank: unlockRank\(\), battleBadges:/);
  assert.match(app, /return tutorialBaseline \? tamerRankValue : Math\.max\(tamerRankValue, tamerLevelRank\(tamerTalents\?\.level \?\? 1\)\);/);
  assert.doesNotMatch(source('src/championship/app/vs2Screens.js'), /productTamerTalents/, 'the gate screen reads the level from its admission');
  assert.match(app, /function publishScreens\(\) \{\s+syncUnlockRank\(\);/);
  assert.match(app, /function publishRaising\(\) \{\s+syncUnlockRank\(\);/);
  assert.match(app, /getSyncCap\(\)\{return syncCapForRank\(tamerRankValue\);\}/);
  assert.match(app, /burstTierForRank\(tamerRankValue\)/);
  assert.match(app, /slotCountForTamerRank\(tamerRankValue\)/);
  assert.match(source('src/championship/app/tamerInfoScreen.js'), /cm-rank-unlocks__note/);
  assert.match(source('src/championship/app/tamerTalentPanel.js'), /cm-talents__unlock/);
  assert.match(source('src/championship/app/styles.css'), /\.cm-talents__unlock \{/);
  assert.match(source('src/championship/app/styles.css'), /\.cm-rank-unlocks__note \{/);
});
