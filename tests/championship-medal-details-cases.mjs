import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeMedalDetails, medalDetails } from '../src/championship/app/medalDetails.js';
import { MEDAL_DETAIL_TEXT } from '../src/championship/text/medalDetailText.js';
import { LOCALES, getLocale, setLocale, onLocaleChange, formatList } from '../src/championship/text/locale.js';
import { shopItemName, gateName, generationName, personalityName } from '../src/championship/text/zhHant.js';
import { listShopRecords } from '../src/championship/shop/shopCatalog.js';
import { listChampionshipGates } from '../src/championship/gate/gateCatalog.js';
import { getBattleCatalog } from '../src/championship/battle/battleCatalogs.js';
import { drawNativeTitleBattleArena } from '../src/championship/battle/battleParty.js';
import { uiText } from '../src/championship/text/uiText.js';
import evidence from './fixtures/medal-detail-evidence-20261014.json' with { type: 'json' };

const fact = (details, key) => details.facts.find(row => row.key === key)?.value;
function localeWork(locale, fn) {
  const before = getLocale(); setLocale(locale);
  try { return fn(); } finally { setLocale(before); }
}

test('all 61 detail projections match retained audited conditions, fees, prizes and direct consumers', () => {
  assert.equal(evidence.records.length, 61);
  assert.equal(evidence.sourceCommit, 'b01ed619375641f5578b2bc65883ebfa32ad8914');
  assert.match(evidence.sourceSha256, /^[a-f0-9]{64}$/);
  for (const row of evidence.records) {
    const actual = describeMedalDetails(row.titleId);
    assert.equal(actual.titleId, row.titleId);
    assert.equal(actual.conditionIndex, row.conditionIndex, `condition owner ${row.titleId}`);
    assert.deepEqual(actual.condition, Object.fromEntries(evidence.conditionColumns.map((name, i) => [name, row.conditionValues[i]])), `condition fields ${row.titleId}`);
    assert.equal(actual.fixedArenaIndex, row.fixedArenaIndex, `fixed arena ${row.titleId}`);
    assert.equal(actual.entryFeeBits, row.entryFeeBits, `fee ${row.titleId}`);
    assert.equal(actual.victoryPrizeBits, row.victoryPrizeBits, `prize ${row.titleId}`);
    assert.deepEqual(actual.shopUnlocks.map(v => [v.shopRecordIndex, v.unitPriceBits]), row.shopUnlocks, `Shop ${row.titleId}`);
    assert.deepEqual(actual.gateUnlocks.map(v => [v.recordIndex, v.entranceFeeBits]), row.gateUnlocks, `Gate ${row.titleId}`);
  }
});

test('direct unlock census is 38 products across 35 medals plus 3 Gates, union 36 medals', () => {
  const all = Array.from({ length: 61 }, (_, id) => describeMedalDetails(id));
  assert.equal(all.filter(v => v.shopUnlocks.length).length, 35);
  assert.equal(all.flatMap(v => v.shopUnlocks).length, 38);
  assert.equal(all.flatMap(v => v.gateUnlocks).length, 3);
  assert.equal(all.filter(v => v.shopUnlocks.length || v.gateUnlocks.length).length, 36);
  const categories = all.flatMap(v => v.shopUnlocks).reduce((totals, row) => { totals[row.category] = (totals[row.category] ?? 0) + 1; return totals; }, {});
  assert.deepEqual(categories, { CAGES: 16, HUNT_ITEMS: 13, PLUGINS: 9 });
});

test('invalid, coercible and tutorial IDs do not create medals', () => {
  for (const id of [-1, 61, 62, 1000, 0.5, '0', '57', NaN, Infinity, null, undefined, {}, []]) assert.equal(describeMedalDetails(id), null);
  assert.strictEqual(medalDetails, describeMedalDetails);
});

test('specific restrictions reflect individual qualification, with OR family choices and separate arenas', () => localeWork('zh-Hant', () => {
  assert.match(fact(describeMedalDetails(21), 'participation'), /鳥.*龍.*其中一種/);
  assert.match(fact(describeMedalDetails(22), 'participation'), /機械.*暗黑.*其中一種/);
  assert.match(fact(describeMedalDetails(32), 'participation'), /究極體\n限定病毒屬性/);
  assert.match(fact(describeMedalDetails(34), 'teamSize'), /最多 1/);
  assert.match(fact(describeMedalDetails(34), 'participation'), /究極體\n限定資料屬性/);
  for (const id of [15, 35, 36, 37, 38, 39]) {
    assert.equal(fact(describeMedalDetails(id), 'participation'), '無額外隊員限制');
    assert.ok(fact(describeMedalDetails(id), 'arena'));
  }
  assert.equal(fact(describeMedalDetails(43), 'participation'), '限定植物類型');
  assert.equal(fact(describeMedalDetails(44), 'participation'), `限定以下種類：${formatList(['巨核裝豆','鋼豆核','星冠豆爵'])}`);
  assert.match(fact(describeMedalDetails(48), 'participation'), /限定起源組：/);
  assert.match(fact(describeMedalDetails(49), 'participation'), /限定擺錘組：/);
  for (const [id, count] of [[50, 3], [51, 5], [52, 10]]) assert.match(fact(describeMedalDetails(id), 'participation'), new RegExp(`每隻隊員至少轉生為蛋 ${count} 次`));
  assert.match(fact(describeMedalDetails(53), 'participation'), /每隻隊員容量至少 24/);
  assert.equal(fact(describeMedalDetails(54), 'participation'), `限定${personalityName(7)}個性`);
  assert.equal(fact(describeMedalDetails(27), 'participation'), `限定${generationName(5)}`);
}));

test('all 14 caller-fixed stadium titles show arena 9 in every locale without an RNG draw', () => {
  const ids = evidence.records.filter(row => row.conditionIndex === -1).map(row => row.titleId);
  assert.deepEqual(ids, [2, 3, 4, 24, 40, 41, 45, 46, 47, 56, 57, 58, 59, 60]);
  const neverDraw = { next() { assert.fail('Fixed-arena inspection must not consume RNG'); } };
  for (const locale of LOCALES) localeWork(locale, () => {
    for (const id of ids) {
      const details = describeMedalDetails(id);
      assert.equal(details.condition.field10, -1, `qualification is not the arena owner for ${id}`);
      assert.equal(details.fixedArenaIndex, 9);
      assert.equal(drawNativeTitleBattleArena(id, neverDraw), 9);
      assert.equal(fact(details, 'arena'), uiText('STADIUM'));
    }
    for (const row of evidence.records.filter(row => row.fixedArenaIndex === null)) {
      const details = describeMedalDetails(row.titleId);
      assert.equal(details.fixedArenaIndex, null);
      assert.equal(fact(details, 'arena'), undefined, 'Do not invent a fixed arena for a random selection');
    }
  });
});

test('Moon Evolution ID57 shows actual costs and collection value, never invented direct unlocks or equipment', () => localeWork('zh-Hant', () => {
  const moon = describeMedalDetails(57);
  assert.equal(moon.entryFeeBits, 8800);
  assert.equal(moon.victoryPrizeBits, 600000);
  assert.equal(moon.condition.slots, 3);
  assert.equal(moon.conditionIndex, -1);
  assert.equal(moon.fixedArenaIndex, 9);
  assert.equal(fact(moon, 'arena'), '體育場');
  assert.equal(fact(moon, 'participation'), '無額外隊員限制');
  assert.deepEqual(moon.shopUnlocks, []); assert.deepEqual(moon.gateUnlocks, []);
  assert.match(fact(moon, 'functions'), /計入頭銜收藏.*沒有獨立/);
  assert.match(moon.notes.join('\n'), /不是可裝備稱號.*不會.*直接增加攻防/);
  assert.match(moon.notes.join('\n'), /不是佩戴徽章或重看收藏的獎勵/);
}));

test('Shop eligibility is not a free item, Gate opening is not a fee waiver', () => localeWork('zh-Hant', () => {
  const both = describeMedalDetails(7);
  assert.match(fact(both, 'functions'), /可在商店購買：究極繩 α.*另行付費.*不會免費獲得/);
  assert.match(fact(both, 'functions'), /開放狩獵場：雪之國度.*既有入場費規則/);
  assert.equal(both.gateUnlocks[0].entranceFeeBits, 1200);
  assert.equal(both.shopUnlocks[0].unitPriceBits, 45000);
  assert.equal(both.shopUnlocks[0].unlockEvidence, 'VERIFIED_BINARY');
  assert.equal(both.gateUnlocks[0].unlockEvidence, 'ROM_VERIFIED');
}));

test('five locales have complete isolated copy and reuse current localized catalog names', () => {
  const keys = Object.keys(MEDAL_DETAIL_TEXT['zh-Hant']).sort();
  for (const locale of LOCALES) localeWork(locale, () => {
    assert.deepEqual(Object.keys(MEDAL_DETAIL_TEXT[locale]).sort(), keys);
    for (const key of keys) assert.ok(MEDAL_DETAIL_TEXT[locale][key], `${locale}:${key}`);
    for (let id = 0; id < 61; id++) {
      const details = describeMedalDetails(id);
      for (const row of details.facts) {
        assert.equal(typeof row.label, 'string'); assert.ok(row.label.length);
        assert.equal(typeof row.value, 'string'); assert.ok(row.value.length);
        assert.doesNotMatch(row.value, /\{\w+\}|undefined|null/);
        assert.ok(!row.value.includes(MEDAL_DETAIL_TEXT[locale].unknown), `${locale}/${id}: all present conditions must be mapped`);
      }
      assert.deepEqual(details.facts, [...details.restrictions, ...details.unlocks]);
      for (const unlock of details.shopUnlocks) assert.equal(unlock.name, shopItemName(unlock.shopRecordIndex));
      for (const unlock of details.gateUnlocks) assert.equal(unlock.name, gateName(unlock.recordIndex));
      assert.equal(details.notes.length, 4);
      assert.equal(getLocale(), locale);
    }
    assert.equal(fact(describeMedalDetails(1), 'participation'), MEDAL_DETAIL_TEXT[locale].generation.replace('{value}', generationName(4)));
  });
});

test('the projection is immutable, deterministic and leaves canonical catalogs and locale unchanged', () => {
  const catalogs = () => JSON.stringify({ shops: listShopRecords(), gates: listChampionshipGates(), eligibility: getBattleCatalog('eligibility'), titles: getBattleCatalog('titleEvents') });
  const before = catalogs(), locale = getLocale();
  let localeChanges = 0; const stop = onLocaleChange(() => localeChanges++);
  try {
    const checkFrozen = value => {
      if (!value || typeof value !== 'object') return;
      assert.ok(Object.isFrozen(value));
      for (const child of Object.values(value)) checkFrozen(child);
    };
    for (let id = 0; id < 61; id++) {
      const value = describeMedalDetails(id);
      checkFrozen(value); assert.deepEqual(value, describeMedalDetails(id));
      assert.throws(() => { value.condition.slots = 99; }, TypeError);
    }
    assert.equal(catalogs(), before);
    assert.equal(getLocale(), locale); assert.equal(localeChanges, 0);
  } finally { stop(); }
});

test('detail adapter imports only existing runtime owners, with no research data or mutation facilities', () => {
  const source = readFileSync(new URL('../src/championship/app/medalDetails.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.ok(imports.length);
  for (const path of imports) assert.doesNotMatch(path, /research|audit|fixtures|nexus/i);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|fetch|setLocale|applyBattleTransaction|setBattleBadges|createElement)\b/);
  assert.doesNotMatch(source, /\.next\s*\(/, 'A detail projection must not draw gameplay RNG');
});
