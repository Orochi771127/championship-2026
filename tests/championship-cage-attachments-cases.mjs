// Owner 2026-11-03: the auto-feeder and the auto-cleaner are attachments for any placed cage (all 37
// kinds), taken off and moved at no cost; a cleaned cage keeps no droppings; the Bits zoo and ranch no
// longer promise auto-care.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { FRIENDS_PLAYTEST_POLICY } from '../src/championship/app/friendsPlaytestPolicy.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from '../src/championship/app/championshipStandaloneSave.js';
import { getCageDefinitionByModuleId } from '../src/championship/cage/cageCatalog.js';
import { shopItemDescription } from '../src/championship/text/zhHant.js';
import { setLocale, LOCALES } from '../src/championship/text/locale.js';
import { AUTOMATION_ITEMS } from '../src/championship/gacha/ranchAutomation.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const source = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const species = read('src/data/championship/catalogs/creature-species.r1.json');
const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;

function harness() {
  const data = new Map(), storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
  const make = () => createChampionshipStandaloneApp({ playtestPolicy: FRIENDS_PLAYTEST_POLICY, storage, locks: null, cages, catalog: species });
  return { data, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)) };
}
const placedCages = (app) => app.getCageEditFrame().placements.filter((p) => p.instanceId);
const mounts = (app) => app.getCyberGachaFrame().cages;

test('the feeder and the cleaner are named as consumable machines (AUTO_CARE_3D_20261103)', () => {
  assert.deepEqual(AUTOMATION_ITEMS.filter((i) => i.kind === 'CORE').map((i) => i.name).sort(), ['奈米掃地機器人', '智慧自動餵食機', '皇家雙效核心'].sort());
});

test('a core deploys on every kind of placed cage for one hour; another core extends it; it never comes back off', async () => {
  const h = harness(); const app = h.make();
  try {
    await app.newGame();
    const placed = placedCages(app);
    assert.ok(placed.length >= 2, 'a new ranch has several cages');
    assert.equal(app.grantAutomationItem('auto:feed-core', placed.length + 1, 'TEST').ok, true);
    assert.equal(app.grantAutomationItem('auto:clean-core', 1, 'TEST').ok, true);
    const kinds = new Set();
    for (const cage of placed) {
      kinds.add(getCageDefinitionByModuleId(cage.moduleId)?.cageDefinitionIndex ?? cage.moduleId);
      const on = app.gachaDeployCore('auto:feed-core', cage.instanceId);
      assert.equal(on.ok, true, `${cage.moduleId}: ${on.reason}`);
      const row = mounts(app).find((c) => c.instanceId === cage.instanceId);
      assert.ok(row.feed && row.feedSeconds === 3600, cage.moduleId);
    }
    assert.ok(kinds.size >= 2, 'more than one kind of cage took it');
    assert.equal(app.getCyberGachaFrame().automation.find((i) => i.id === 'auto:feed-core').owned, 1, 'each deploy used one core');
    const [a, b] = placed;
    assert.equal(app.gachaDeployCore('auto:feed-core', a.instanceId).kind, 'EXTEND');
    assert.equal(app.gachaDeployCore('auto:clean-core', b.instanceId).kind, 'DEPLOY');
    assert.equal(app.gachaUnmountCore, undefined, 'nothing comes back off');
    // The save keeps each machine's seconds left.
    app.save();
    const runs = h.saved().progression.cyberGacha.runs;
    assert.equal(runs[a.instanceId].AUTO_FEED, 7200);
    assert.deepEqual(runs[b.instanceId], { AUTO_CLEAN: 3600, AUTO_FEED: 3600 });
  } finally { await app.dispose(); }
});

test('droppings saved without a cage instance belong to the cage they lie in; the deployed robot sweeps them one by one', async () => {
  const h = harness(); let app = h.make();
  try {
    await app.newGame();
    assert.equal(app.grantAutomationItem('auto:clean-core', 1, 'TEST').ok, true);
    const cage = placedCages(app).find((p) => !/waiting-room/.test(p.moduleId)) ?? placedCages(app)[0];
    const definition = getCageDefinitionByModuleId(cage.moduleId).cageDefinitionIndex;
    app.save();
    // An older save: five droppings in that cage, recorded by definition only.
    const save = h.saved();
    save.raising.nativeHome.waste = [0, 1, 2, 3, 4].map((slot) => ({ slot, speciesIndex: 17, cageDefinitionIndex: definition,
      localPositionQ12: [(60 + slot * 12) * 4096, 90 * 4096, 0] }));
    h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
    await app.dispose(); app = h.make(); await app.continueGame();
    assert.equal(app.getRaisingWasteFrame().length, 5, 'five droppings lie in the cage');
    const bitsBefore = app.getShopFrame().bits;
    const result = app.gachaDeployCore('auto:clean-core', cage.instanceId);
    assert.equal(result.ok, true, result.reason);
    assert.equal(app.getRaisingWasteFrame().length, 5, 'deploying never clears them by magic: the robot has to drive there');
    for (let i = 0; i < 60 * 90 && app.getRaisingWasteFrame().length; i++) app.advanceNaturalClock({ frames: 1 });
    const swept = 5 - app.getRaisingWasteFrame().length;
    assert.ok(swept >= 1, 'the robot swept the old droppings');
    assert.equal(app.getShopFrame().bits, Math.min(9999999, bitsBefore + swept * 50), 'each one pays +50 bits');
  } finally { await app.dispose(); }
});

test('the Bits zoo and ranch no longer promise auto-care in any language', () => {
  try {
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const record of [115, 116]) {
        const text = shopItemDescription(record);
        assert.ok(text, `${locale} ${record}`);
        assert.doesNotMatch(text, /自動照料|排泄物|feeding and droppings|自動で|自動的に世話/u, `${locale} ${record}`);
      }
    }
    setLocale('zh-Hant');
    assert.equal(shopItemDescription(115), '熱鬧的草原生態棲地，空間稍微擁擠。建議容納 4 隻夥伴。（可加掛自動化模組）');
    assert.equal(shopItemDescription(116), '空間寬廣舒適的大型草原棲地。建議容納 8 隻夥伴。（可加掛自動化模組）');
  } finally { setLocale('zh-Hant'); }
});

test('no banner or pictures over the cage, a small drawn tag per machine; the scrim dots are faint; the bag tabs are not sticky', () => {
  const view = source('src/championship/app/raisingHomeP1RView.js');
  assert.doesNotMatch(view, /int-rh2-cage-auto|int-rh2-cage-device/, 'no banner and no item pictures on the ranch floor');
  const tags = view.slice(view.indexOf('function renderCageBadges'), view.indexOf('const field = await mountField'));
  assert.doesNotMatch(tags, /node\('img'|\.src=/, 'the machine tags draw their icons');
  assert.match(view, /int-rh2-care-tag__icon/);
  const tokens = source('src/championship/app/ui/tokens.css');
  const alpha = Number(/--ax-dots: radial-gradient\(rgba\(20, 20, 31, ([0-9.]+)\)/.exec(tokens)?.[1]);
  assert.ok(alpha > 0 && alpha <= 0.05, `scrim dot alpha ${alpha}`);
  const layout = source('src/championship/app/ui/screenLayout.css');
  const tabs = /\.cm-backpack__tabs \{[^}]*\}/.exec(layout)?.[0] ?? '';
  assert.doesNotMatch(tabs, /sticky/);
});
