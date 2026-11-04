// Owner 2026-11-04 launch readiness (rank table review): with the friends playtest switched off
// the diamond wallet, the 20-cell hex land and its diamond rows keep working; the playtest lifts
// the rank's evolution ceiling; at launch 成熟期 opens from rank 1 (藍階); a cage too full for
// the next form says so on the partner card.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY, productDiamondWallet} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {LAND_EXPANSION} from '../src/championship/gacha/diamondRewards.js';
import {PRODUCT_RAISING_LIFECYCLE_RULES} from '../src/championship/contracts/productSpeciesData.js';
import nativeLifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type: 'json'};

const read = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const source = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const species = read('src/data/championship/catalogs/creature-species.r1.json');
const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
const LAUNCH = Object.freeze({...FRIENDS_PLAYTEST_POLICY, enabled: false});

function harness(policy, productEconomy = true) {
  const data = new Map();
  const storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k)};
  const make = () => createChampionshipStandaloneApp({playtestPolicy: policy, productEconomy, storage, locks: null, cages, catalog: species});
  return {data, make};
}

test('productDiamondWallet: an empty product wallet for any save, an existing one kept as it is', () => {
  assert.deepEqual({...productDiamondWallet(null)}, {version: 2, grants: [], diamonds: 0, purchases: []});
  const kept = productDiamondWallet({version: 2, grants: [FRIENDS_PLAYTEST_POLICY.grantId], diamonds: 1234, purchases: [2]});
  assert.equal(kept.diamonds, 1234); assert.deepEqual([...kept.purchases], [2]);
});

test('the default app keeps the original economy: no wallet, no hex land', async () => {
  const app = harness(null, false).make();
  try {
    await app.newGame(); app.openCageEdit();
    const frame = app.getCageEditFrame();
    assert.equal(frame.productGrid ?? null, null);
    assert.equal(app.expandRanchLand().ok, false, 'no land rows to buy in the original economy');
  } finally { await app.dispose(); }
});

test('launch (playtest off, product economy on): a new save has the wallet, the 20-cell hex land, and land rows bought with diamonds', async () => {
  const h = harness(LAUNCH);
  const first = h.make();
  try {
    await first.newGame(); first.openCageEdit();
    const frame = first.getCageEditFrame();
    assert.ok(frame.productGrid, 'the hex land is the product ranch, not a playtest grant');
    assert.equal(frame.land.capacity, 20, 'rank 0 opens 20 cells, not the original 14');
    assert.equal(frame.land.available, true);
    assert.equal(frame.testDiamonds, 0, 'no playtest diamonds at launch');
    const refused = first.expandRanchLand();
    assert.equal(refused.ok, false);
    assert.notEqual(refused.reason, 'TEST_ROW_PURCHASE_UNAVAILABLE', 'refused for want of diamonds, not for the playtest flag');
    first.save();
  } finally { await first.dispose(); }
  // The wallet rides the save; earned diamonds (here written in) buy every land step to 100 cells.
  const saved = JSON.parse(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(saved.flags.friendsPlaytest.diamonds, 0);
  saved.flags.friendsPlaytest.diamonds = 8000;
  h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  const app = h.make();
  try {
    assert.ok(await app.continueGame()); app.openCageEdit();
    for (const price of LAND_EXPANSION.prices) {
      const before = app.getCageEditFrame().testDiamonds;
      assert.equal(app.expandRanchLand().ok, true);
      assert.equal(before - app.getCageEditFrame().testDiamonds, price);
    }
    assert.equal(app.getCageEditFrame().land.capacity, 100);
  } finally { await app.dispose(); }
});

test('the playtest keeps its grant on top of the same wallet', async () => {
  const h = harness(FRIENDS_PLAYTEST_POLICY), app = h.make();
  try {
    await app.newGame(); app.openCageEdit();
    assert.equal(app.getCageEditFrame().testDiamonds, FRIENDS_PLAYTEST_POLICY.initialTestDiamonds);
    assert.equal(app.getCageEditFrame().land.capacity, 20);
  } finally { await app.dispose(); }
});

test('launch growth: 成熟期 from rank 1 (藍階); rank 0 still stops at 成長期; capacity unchanged', () => {
  const ranks = PRODUCT_RAISING_LIFECYCLE_RULES.ranks;
  assert.equal(ranks[0].generation, nativeLifecycle.ranks[0].generation, 'rank 0: 成長期 is the ceiling');
  assert.equal(ranks[1].generation, nativeLifecycle.ranks[2].generation, 'rank 1 reaches 成熟期, as rank 2 did');
  assert.deepEqual(ranks.map(r => r.capacity), nativeLifecycle.ranks.map(r => r.capacity));
  assert.deepEqual(ranks.slice(2), nativeLifecycle.ranks.slice(2));
});

test('the playtest lifts the rank ceiling; a full cage is named on the partner card', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  // The public entry keeps the product economy on whatever the playtest flag says.
  assert.match(source('src/championship/app/main.js'), /playtestPolicy: FRIENDS_PLAYTEST_POLICY,\r?\n.*\r?\n\s*productEconomy: true,/);
  assert.match(app, /rank:playtestPolicy\?\.enabled===true\?9:Math\.min\(9,tamerRankValue\)/);
  assert.match(app, /crowded:Boolean\(actor\.capacityBlocked\)/);
  const actor = source('src/championship/raising/nativeRaisingActor.js');
  assert.equal(actor.split('actor.capacityBlocked=Boolean(selection.capacityBlocked);').length - 1, 2, 'both evolution checks record it');
  const view = source('src/championship/app/raisingHomeP1RView.js');
  assert.match(view, /crowdedChip\.hidden = !partner\?\.crowded;/);
  for (const lang of ['en', 'ja', 'th', 'vi']) assert.match(source(`src/championship/text/uiText.${lang}.js`), /"籠舍太擠，暫時無法進化": "/, lang);
});

test('rank unlocks: read from the gate, shop and title tables; every rank row and every gated gate accounted for', async () => {
  const {RANK_UNLOCKS, badgeUnlocks} = await import('../src/championship/app/rankUnlocks.js');
  const {CHAMPIONSHIP_GATES} = await import('../src/championship/gate/gateCatalog.js');
  assert.equal(RANK_UNLOCKS.length, 10);
  // Every rank-gated hunt ground appears at exactly its rank; badge-gated ones under their badge.
  for (const gate of CHAMPIONSHIP_GATES) {
    if (gate.unlockKind === 1) assert.ok(RANK_UNLOCKS[gate.unlockParameter].gates.includes(gate.romRecordIndex), gate.biomeId);
    if (gate.unlockKind === 2) assert.ok(badgeUnlocks(gate.unlockParameter).gates.includes(gate.romRecordIndex), gate.biomeId);
  }
  assert.deepEqual([...RANK_UNLOCKS[0].gates], [0], '戴納草原 is open from the start');
  assert.deepEqual([...RANK_UNLOCKS[8].gates], [15], '臨界遺跡 at 冠軍');
  assert.deepEqual(RANK_UNLOCKS.map(r => r.diamonds), [0, 300, 300, 300, 400, 400, 400, 500, 500, 500]);
  assert.equal(RANK_UNLOCKS.reduce((sum, r) => sum + r.titles, 0) >= 60, true);
  assert.deepEqual([...badgeUnlocks(7).gates], [10], 'badge 7 opens 雪之國度');
});

test('the tamer sheet lists every rank and the badge sheet names what a badge opens', () => {
  const tamer = source('src/championship/app/tamerInfoScreen.js');
  assert.match(tamer, /shell\.append\(table, rankUnlockPanel\(/);
  assert.match(tamer, /license:rank\?generationName\(naturalCeiling\(tamerRank\)\):null/, 'the licence follows the product growth ranks');
  assert.match(tamer, /cage:Number\.isInteger\(landCells\)\?landCells:/);
  assert.match(source('src/championship/app/main.js'), /landCells:app\.getCageEditFrame\?\.\(\)\?\.land\?\.capacity\?\?null,/);
  const medals = source('src/championship/app/medalCollectionScreen.js');
  assert.match(medals, /fact\(uiText\(entry\.earned\?'已解鎖':'獲得後解鎖'\),opened,true\)/);
  assert.match(medals, /button\.dataset\.unlocks='true'/);
  for (const lang of ['en', 'ja', 'th', 'vi']) {
    const table = source(`src/championship/text/uiText.${lang}.js`);
    for (const key of ['階級解鎖一覽', '狩獵場「{name}」', '商店籠舍「{name}」', '獲得後解鎖', '自然進化可達 {stage}']) assert.ok(table.includes(JSON.stringify(key) + ':'), `${lang}: ${key}`);
  }
});

test('badgeUnlockText: badge 7 reads 雪之國度 in Chinese', async () => {
  const {badgeUnlockText} = await import('../src/championship/app/badgeUnlockText.js');
  assert.match(badgeUnlockText(7), /^狩獵場「雪之國度」・商店「[^」]+」$/, 'the gate, then the tool by name');
  assert.equal(badgeUnlockText(2), null, 'a badge that opens nothing has no line');
});
