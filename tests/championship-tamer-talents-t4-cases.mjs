// TAMER_TALENTS_T4_20261118: the rest of the trader line and the breeder's stroll luck.
//   trader   殺價 (shop Bits prices -3 % a rank), 拾荒 (10 % a rank: one basic supplement after a hunt),
//            鑑價 (stroll Bits +10 % a rank)
//   breeder  散步好運 (10 % a rank that a solo stroll find brings one more)
// Plan: docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 4.2 and 4.4.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {createShopRuntime} from '../src/championship/shop/shopRuntime.js';
import {TALENT_NODES, TALENT_WIRED_KEYS, talentOpen} from '../src/championship/contracts/productTamerTalents.js';
import {TAMER_TALENT_COPY, talentEffectText} from '../src/championship/text/tamerTalentText.js';
import {SUPPLY_SCAVENGE_POOL, scavengeSupply, addSupply, supplyOwned} from '../src/championship/contracts/productSupplements.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const T4_KEYS = ['shopBitsPercent', 'scavengePercent', 'strollBitsPercent', 'strollExtraPercent'];
const nodeOf = key => TALENT_NODES.find(node => node.key === key);
const maxed = ids => ({version: 1, level: 50, exp: 0, nodes: Object.fromEntries(ids.map(id => [id, TALENT_NODES.find(node => node.id === id).max])), keystones: {}, respecs: 0});

test('T4 opens four nodes with copy in five languages; every node of the trader line is now open', () => {
  for (const key of T4_KEYS) {
    assert.ok(TALENT_WIRED_KEYS.has(key), key);
    for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentEffectText(nodeOf(key), 1, locale).length > 0, `${key} ${locale}`);
  }
  assert.ok(TALENT_WIRED_KEYS.size >= 30, 'twenty-six before and these four; later batches only add');
  assert.deepEqual(TALENT_NODES.filter(node => node.line === 'trader' && !talentOpen(node.id)).map(node => node.id), []);
  assert.equal(talentEffectText(nodeOf('shopBitsPercent'), 3, 'zh-Hant'), '−9% 商店金幣價格');
  assert.equal(talentEffectText(nodeOf('scavengePercent'), 2, 'zh-Hant'), '狩獵後 20% 撿到補品');
});

// ---- 殺價: one place where the shop works a Bits price out ----

const openShop = progression => createShopRuntime({bits: 100000, allItemsVisible: true, progression: {tamerRank: 9, battleBadges: [], ...progression}});
const rowOf = (shop, index) => shop.getFrame().listings.find(row => row.shopRecordIndex === index);

test('殺價: the shop charges and shows every Bits price at the talent\'s share, rounded up and never free', () => {
  const plain = openShop({}), cheap = openShop({bitsPricePercent: 91});
  const rows = plain.getFrame().listings.filter(row => row.unitPriceBits > 0);
  assert.ok(rows.length > 20);
  for (const row of rows) {
    const other = rowOf(cheap, row.shopRecordIndex);
    assert.equal(row.listPriceBits, row.unitPriceBits, 'without the talent the price is the catalog price');
    assert.equal(other.listPriceBits, row.unitPriceBits, 'the catalog price stays readable');
    assert.equal(other.unitPriceBits, Math.max(1, Math.ceil(row.unitPriceBits * 91 / 100)), `record ${row.shopRecordIndex}`);
  }
  // What is charged is what is shown.
  const protein = rows.find(row => row.unitPriceBits === 300 && !row.familyId) ?? rows.find(row => row.unitPriceBits >= 100 && !row.familyId);
  const receipt = cheap.buy(protein.shopRecordIndex, 2);
  assert.deepEqual([receipt.ok, receipt.cost, receipt.bits], [true, 2 * Math.ceil(protein.unitPriceBits * 91 / 100), 100000 - 2 * Math.ceil(protein.unitPriceBits * 91 / 100)]);
  assert.equal(plain.buy(protein.shopRecordIndex, 2).cost, 2 * protein.unitPriceBits);
  // Hunt tool families: the next tier and the refill are discounted alike.
  const families = shop => shop.getFrame().huntFamilies;
  let checked = 0;
  for (const family of families(plain)) {
    const other = families(cheap).find(entry => entry.familyId === family.familyId);
    if (Number.isSafeInteger(family.next?.bits) && family.next.bits > 0) { assert.equal(other.next.bits, Math.ceil(family.next.bits * 91 / 100), `${family.familyId} next tier`); checked++; }
    if (Number.isSafeInteger(family.refillBits) && family.refillBits > 0) { assert.equal(other.refillBits, Math.ceil(family.refillBits * 91 / 100), `${family.familyId} refill`); checked++; }
    if (Number.isSafeInteger(family.emergencyBits) && family.emergencyBits > 0) assert.equal(other.emergencyBits, Math.ceil(family.emergencyBits * 91 / 100), `${family.familyId} emergency refill`);
    if (family.next) assert.equal(other.next.diamonds, family.next.diamonds, 'diamond prices are not touched');
  }
  assert.ok(checked >= 4, `family prices checked: ${checked}`);
  // The emergency rope refill charges the figure its family shows (its unit price is fractional before the discount).
  const src = source('src/championship/shop/shopRuntime.js');
  assert.match(src, /const cost = unitBits !== null \? priced\(Math\.ceil\(unitBits \* quantity\)\)/);
});

test('殺價: only a share from 50 to 100 is accepted, and a learned rank reaches a live shop through its progression', () => {
  for (const bad of [10, 120, NaN, '91', null, undefined]) {
    const shop = openShop({bitsPricePercent: bad});
    assert.deepEqual(shop.getFrame().listings.map(row => row.unitPriceBits), openShop({}).getFrame().listings.map(row => row.unitPriceBits), String(bad));
  }
  const shop = openShop({}), row = shop.getFrame().listings.find(entry => entry.unitPriceBits >= 100);
  shop.setProgression({bitsPricePercent: 97});
  assert.equal(rowOf(shop, row.shopRecordIndex).unitPriceBits, Math.ceil(row.unitPriceBits * 97 / 100));
  shop.setProgression({tamerRank: 9});
  assert.equal(rowOf(shop, row.shopRecordIndex).unitPriceBits, Math.ceil(row.unitPriceBits * 97 / 100), 'another progression change keeps the share');
  shop.setProgression({bitsPricePercent: 100});
  assert.equal(rowOf(shop, row.shopRecordIndex).unitPriceBits, row.unitPriceBits);
});

// ---- 拾荒 ----

test('拾荒: a hunt turns up one of the three basic supplements at the talent\'s chance', () => {
  assert.deepEqual(SUPPLY_SCAVENGE_POOL, ['supply:vigor', 'supply:snack', 'supply:sleep']);
  assert.equal(scavengeSupply(null, {percent: 30, chanceRoll: 0.3, pickRoll: 0}), null, 'the roll must be under the share');
  assert.equal(scavengeSupply(null, {percent: 0, chanceRoll: 0, pickRoll: 0}), null, 'no talent, nothing');
  assert.equal(scavengeSupply(null, {percent: 30}), null, 'no roll, nothing');
  const picks = [0, 0.34, 0.99].map(pickRoll => scavengeSupply(null, {percent: 30, chanceRoll: 0.299, pickRoll}));
  assert.deepEqual(picks.map(found => found.id), SUPPLY_SCAVENGE_POOL);
  assert.deepEqual(picks.map(found => supplyOwned(found.state, found.id)), [1, 1, 1]);
  const full = addSupply(null, 'supply:vigor', 99).state;
  assert.equal(scavengeSupply(full, {percent: 30, chanceRoll: 0, pickRoll: 0}), null, 'a full stack finds nothing');
  assert.equal(scavengeSupply(full, {percent: 30, chanceRoll: 0, pickRoll: 0.5}).id, 'supply:snack');
});

// ---- the app ----

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

test('app 殺價: a saved talent prices the shop on load, a newly learned rank at once, and a purchase pays the price shown', async () => {
  const loaded = await talentApp(maxed(['trader.haggle']));
  try {
    const row = loaded.app.getShopFrame().listings.find(entry => entry.listPriceBits >= 100 && !entry.familyId);
    assert.equal(row.unitPriceBits, Math.ceil(row.listPriceBits * 91 / 100), 'three ranks: -9 %');
  } finally { await loaded.app.dispose(); }
  const {app} = await talentApp({version: 1, level: 50, exp: 0, nodes: {}, keystones: {}, respecs: 0});
  try {
    const pick = () => app.getShopFrame().listings.find(entry => entry.listPriceBits >= 100 && !entry.familyId && entry.owned < entry.maxOwned);
    const before = pick();
    assert.equal(before.unitPriceBits, before.listPriceBits);
    assert.equal(app.learnTamerTalent('trader.haggle').ok, true);
    const after = app.getShopFrame().listings.find(entry => entry.shopRecordIndex === before.shopRecordIndex);
    assert.equal(after.unitPriceBits, Math.ceil(before.listPriceBits * 97 / 100), 'one rank: -3 %, without reopening the shop');
    app.openShop();
    const bits = app.getShopFrame().bits, receipt = app.buyShopItem(before.shopRecordIndex, 1);
    assert.deepEqual([receipt.ok, receipt.cost, app.getShopFrame().bits], [true, after.unitPriceBits, bits - after.unitPriceBits]);
    assert.equal(app.respecTamerTalents().ok, true);
    assert.equal(app.getShopFrame().listings.find(entry => entry.shopRecordIndex === before.shopRecordIndex).unitPriceBits, before.listPriceBits, 'a reset puts the catalog price back');
  } finally { await app.dispose(); }
});

test('app without the talents: the shop frame is the catalog and no hunt find is recorded', async () => {
  const {app} = await talentApp(null);
  try {
    assert.deepEqual(app.getShopFrame().listings.filter(row => row.unitPriceBits !== row.listPriceBits), []);
    assert.equal(app.getLastHuntScavenge(), null);
  } finally { await app.dispose(); }
});

test('拾荒, 散步好運 and 鑑價 are read where the hunt ends and where a stroll find is rolled and paid', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /if \(huntCaptureReplay === null && talent\('scavengePercent'\) > 0\) \{\s*const found = scavengeSupply\(suppliesState\(\), \{ percent: talent\('scavengePercent'\), chanceRoll: productRoll\(0x62\), pickRoll: productRoll\(0x63\) \}\);/);
  assert.match(app, /pendingHomeCommit: true, scavenged: lastHuntScavenge\?\.id \?\? null \}\);/, 'the Hunt Result names it');
  assert.match(app, /const luck=talent\('strollExtraPercent'\),extra=luck>0&&find\.quantity<2&&partnerLifeRandom\(\)\*100<luck\?1:0;/, 'no extra draw without the talent, never more than two');
  assert.match(app, /const amount=Math\.round\(spec\.bits\*entry\.quantity\*\(100\+talent\('strollBitsPercent'\)\)\/100\);/);
  assert.match(app, /bitsPricePercent: 100 \+ talent\('shopBitsPercent'\)/);
  assert.match(source('src/championship/app/main.js'), /gate\.showEmptyResult\(\{ find: app\.getLastHuntScavenge\?\.\(\) \?\? null \}\)/);
  assert.match(source('src/championship/app/ui/huntGateCurtain.js'), /if \(find\?\.id\) \{ const line = el\(doc, 'p', 'cm-hunt-gate__note cm-hunt-gate__find'/);
  assert.match(source('src/championship/app/vs3Screens.js'), /scavenged\.hidden = !next\.scavenged;/);
  for (const file of ['uiText.en.js', 'uiText.ja.js', 'uiText.th.js', 'uiText.vi.js'])
    assert.ok(source(`src/championship/text/${file}`).includes('"拾荒：{item} ×1":'), file);
});
