// Owner 2026-11-10: locked shop goods stay listed with what opens them, and a Dex
// partner not yet raised or caught reads as a black silhouette (Owner 2026-11-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopRuntime } from '../src/championship/shop/shopRuntime.js';
import { listShopRecords } from '../src/championship/shop/shopCatalog.js';
import { shopUnlockText } from '../src/championship/app/huntToolFamilyCards.js';
import { tamerRankName, titleEventText } from '../src/championship/text/zhHant.js';
import { setLocale } from '../src/championship/text/locale.js';
import { databaseHeroPortrait } from '../src/championship/presentation/databaseHeroPortraits.js';
import { makeView } from './helpers/dex-conditions-ui-fixture.mjs';

test('a fresh shop lists every hidden row as locked, with its rank or badge, and still refuses to sell it', () => {
  const shop = createShopRuntime();
  const frame = shop.getFrame();
  const initial = listShopRecords().filter(r => r.unlockKind === 'INITIAL_AVAILABLE').length;
  assert.equal(frame.listings.length, initial);
  assert.equal(frame.listings.length + frame.lockedListings.length, listShopRecords().length);
  for (const row of frame.lockedListings) {
    const record = listShopRecords()[row.shopRecordIndex];
    assert.deepEqual(row.unlock, { kind: record.unlockKind, parameter: record.unlockParameter });
    assert.equal(row.owned, 0);
  }
  const cage = frame.lockedListings.find(row => row.category === 'CAGES');
  assert.equal(shop.buy(cage.shopRecordIndex, 1).reason, 'UNAVAILABLE');
  // A hunt tool family still hidden carries the lock of its first tier.
  const hiddenFamily = frame.huntFamilies.find(family => !family.visible);
  assert.ok(hiddenFamily?.unlock);
  for (const family of frame.huntFamilies.filter(f => f.visible)) assert.equal(family.unlock, null);
});

test('reaching a rank moves its rows from locked to listed', () => {
  const shop = createShopRuntime();
  const rankRows = listShopRecords().filter(r => r.unlockKind === 'TAMER_RANK_THRESHOLD' && r.unlockParameter === 1);
  assert.ok(rankRows.length > 0);
  shop.setProgression({ tamerRank: 1, battleBadges: [] });
  const frame = shop.getFrame();
  for (const record of rankRows) {
    assert.ok(frame.listings.some(row => row.shopRecordIndex === record.shopRecordIndex));
    assert.equal(frame.lockedListings.some(row => row.shopRecordIndex === record.shopRecordIndex), false);
  }
});

test('the lock line names the tamer rank or the title badge', () => {
  setLocale('zh-Hant');
  assert.equal(shopUnlockText({ kind: 'TAMER_RANK_THRESHOLD', parameter: 1 }, { short: true }), `${tamerRankName(1)}開放`);
  assert.match(shopUnlockText({ kind: 'TAMER_RANK_THRESHOLD', parameter: 1 }), new RegExp(tamerRankName(1)));
  const title = titleEventText(33, 'name');
  assert.match(shopUnlockText({ kind: 'BATTLE_BADGE_ID_0_BASED', parameter: 33 }, { short: true }), new RegExp(title));
  assert.match(shopUnlockText({ kind: 'BATTLE_BADGE_ID_0_BASED', parameter: 33 }), /頭銜賽/);
  assert.equal(shopUnlockText(null), null);
  for (const locale of ['en', 'ja', 'th', 'vi']) {
    setLocale(locale);
    assert.doesNotMatch(shopUnlockText({ kind: 'TAMER_RANK_THRESHOLD', parameter: 2 }), /尚未開放|即可購買/);
    assert.doesNotMatch(shopUnlockText({ kind: 'BATTLE_BADGE_ID_0_BASED', parameter: 33 }, { short: true }), /贏得|開放/);
  }
  setLocale('zh-Hant');
});

test('an unregistered partner shows a silhouette and "?", never its name or the portrait stage', () => {
  const id = 28, art = databaseHeroPortrait(id);
  assert.ok(art);
  const list = makeView({ selectedSpeciesIndex: null, registeredSpecies: [], collection: [] });
  try {
    const row = list.root.querySelector(`[data-species-index="${id}"]`);
    assert.equal(row.querySelector('.cm-dex-list-thumb'), null);
    assert.equal(row.querySelector('.cm-dex-list-shadow').src, art.thumbnail.src);
    assert.ok(row.className.includes('cm-vs2-database__row--shadow'));
    assert.equal(row.querySelector('strong').textContent, '????');
    list.assertUnchanged();
  } finally { list.dispose(); }
  const detail = makeView({ selectedSpeciesIndex: id, registeredSpecies: [], collection: [] });
  try {
    assert.equal(detail.root.querySelector('.cm-dex-hero'), null);
    const shadow = detail.root.querySelector('.cm-dex-shadow__image');
    assert.equal(shadow.src, art.src);
    assert.ok(shadow.hidden);
    shadow.onload();
    assert.equal(shadow.hidden, false);
    assert.equal(detail.root.querySelector('.cm-dex-shadow__mystery').textContent, '?');
    assert.equal(detail.root.querySelector('.cm-dex-profile'), null);
    detail.assertUnchanged();
  } finally { detail.dispose(); }
});
