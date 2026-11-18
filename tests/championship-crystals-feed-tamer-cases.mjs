// ROADMAP_R1_20261118 (Owner 2026-11-18): the EXP crystals raise the TAMER, one crystal one tamer EXP; a partner
// no longer takes crystals (it grows by fusing its own kind and by the little Sync EXP a battle pays).
// Plan: docs/planning/TAMER_PROGRESSION_ROADMAP_2026-11-18_ZH_TW.md, batch R1.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {TAMER_LEVEL_MAX, TAMER_CRYSTAL_EXP, tamerExpRequired, tamerExpToMax, feedTamerCrystals, tamerTalentPoints}
  from '../src/championship/contracts/productTamerTalents.js';
import {journeyText} from '../src/championship/text/journeyText.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tamer = (level, exp = 0) => ({version: 1, level, exp, nodes: {}, keystones: {}, respecs: 0});

test('one crystal is one tamer EXP, and the whole climb to Lv.50 is 137,370', () => {
  assert.equal(TAMER_CRYSTAL_EXP, 1);
  let total = 0; for (let lv = 1; lv < TAMER_LEVEL_MAX; lv++) total += tamerExpRequired(lv);
  assert.equal(total, 137370);
  assert.equal(tamerExpToMax(null), total);
  assert.equal(tamerExpToMax(tamer(1, 10)), total - 10);
  assert.equal(tamerExpToMax(tamer(TAMER_LEVEL_MAX)), 0);
});

test('pouring spends what is asked, never more than is held or than the tamer can still use', () => {
  const first = feedTamerCrystals(null, 1000, tamerExpRequired(1));
  assert.deepEqual([first.spent, first.state.level, first.state.exp, first.gain.levels], [40, 2, 0, 1]);
  const short = feedTamerCrystals(tamer(3, 5), 12, 999);
  assert.deepEqual([short.spent, short.state.level, short.state.exp], [12, 3, 17], 'only what is held');
  const several = feedTamerCrystals(null, 100000, 3876);
  assert.deepEqual([several.spent, several.state.level], [3876, 11], 'levels carry over');
  const nearTop = tamer(TAMER_LEVEL_MAX - 1, tamerExpRequired(TAMER_LEVEL_MAX - 1) - 7);
  const last = feedTamerCrystals(nearTop, 500, 500);
  assert.deepEqual([last.spent, last.state.level, last.state.exp], [7, TAMER_LEVEL_MAX, 0], 'nothing is spent past the top');
  assert.equal(feedTamerCrystals(tamer(TAMER_LEVEL_MAX), 500, 500), null);
  assert.equal(feedTamerCrystals(null, 0, 40), null);
  assert.equal(feedTamerCrystals(null, 500, 0), null);
  assert.equal(feedTamerCrystals(null, 500, -5), null);
});

async function feedApp(talents, crystals) {
  const data = new Map(), storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z'});
  const first = make(); await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  if (talents) save.progression.tamerTalents = talents;
  save.progression.syncLevels = {version: 1, partners: {}, crystals};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make(); await app.continueGame();
  return {app, storage, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}
const PARTNER = 'championship:2026:instance:0001';

test('app: crystals go to the tamer in one save, raise the points to spend, and a failed save changes nothing', async () => {
  const {app, storage, saved} = await feedApp(null, 5000);
  try {
    const before = app.getTamerTalentFrame();
    assert.deepEqual([before.level, before.exp, before.crystals], [1, 0, 5000]);
    storage.failing = true;
    assert.equal(app.feedTamerCrystals(40).reason, 'SAVE_FAILED');
    storage.failing = false;
    assert.deepEqual([app.getTamerTalentFrame().level, app.getTamerTalentFrame().crystals], [1, 5000]);
    const fed = app.feedTamerCrystals(3876);
    assert.deepEqual([fed.ok, fed.spent, fed.gain.after.level, fed.crystals], [true, 3876, 11, 1124]);
    const frame = app.getTamerTalentFrame();
    assert.deepEqual([frame.level, frame.crystals, frame.points - before.points], [11, 1124, 10], 'ten levels, ten more points');
    assert.equal(tamerTalentPoints({level: 11}) - tamerTalentPoints({level: 1}), 10);
    assert.deepEqual([saved().progression.tamerTalents.level, saved().progression.syncLevels.crystals], [11, 1124]);
    assert.equal(app.getJourneyFrame().crystals, 1124);
    assert.equal(app.feedTamerCrystals(0).reason, 'NO_CRYSTALS');
  } finally { await app.dispose(); }
});

test('app: a partner no longer takes crystals, and a tamer at Lv.50 keeps them', async () => {
  const {app, saved} = await feedApp({version: 1, level: TAMER_LEVEL_MAX, exp: 0, nodes: {}, keystones: {}, respecs: 0}, 900);
  try {
    assert.deepEqual(app.feedSyncCrystals(PARTNER, 100), {ok: false, reason: 'CRYSTALS_FEED_TAMER'});
    assert.equal(app.getSyncLevel(PARTNER).level, 1);
    assert.equal(app.feedTamerCrystals(100).reason, 'TAMER_LEVEL_MAX');
    assert.equal(app.getJourneyFrame().crystals, 900);
    assert.equal(saved().progression.syncLevels.crystals, 900);
  } finally { await app.dispose(); }
});

test('the Journey page pours into the tamer and says so in five languages', () => {
  const screen = source('src/championship/app/journeyScreen.js'), main = source('src/championship/app/main.js');
  assert.match(screen, /row\.dataset\.feedTarget = "tamer";/);
  assert.match(screen, /const result = host\.feedTamer\?\.\(pour\);/);
  assert.doesNotMatch(screen, /host\.feed\(entry\.instanceId/, 'no partner rows any more');
  assert.match(main, /feedTamer: \(amount\) => app\.feedTamerCrystals\(amount\),/);
  assert.match(source('src/championship/app/ui/journey.css'), /\.cm-journey__feed-row\[data-feed-target="tamer"\] \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    for (const key of ['feed.hint', 'feed.tamer', 'feed.some', 'feed.next', 'feed.none', 'feed.max']) assert.ok(journeyText(key, {}, locale).length > 0, `${locale} ${key}`);
    assert.match(journeyText('feed.done', {before: 3, after: 5, spent: '120'}, locale), /Lv\.3 → Lv\.5.*120/, locale);
  }
  assert.equal(journeyText('feed.hint', {}, 'zh-Hant'), '結晶灌給馴獸師，1 結晶 = 1 經驗。');
});
