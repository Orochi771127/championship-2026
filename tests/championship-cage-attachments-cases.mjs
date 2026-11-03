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

test('the feeder and the cleaner are named as attachments', () => {
  assert.deepEqual(AUTOMATION_ITEMS.filter((i) => i.kind === 'CORE').map((i) => i.name).sort(), ['奈米自動清掃機', '智慧自動給食機'].sort());
});

test('an attachment mounts on every kind of placed cage, comes off at no cost and moves to another', async () => {
  const h = harness(); const app = h.make();
  try {
    await app.newGame();
    assert.equal(app.grantAutomationItem('auto:feed-core', 1, 'TEST').ok, true);
    assert.equal(app.grantAutomationItem('auto:clean-core', 1, 'TEST').ok, true);
    const placed = placedCages(app);
    assert.ok(placed.length >= 2, 'a new ranch has several cages');
    const kinds = new Set();
    for (const cage of placed) {
      kinds.add(getCageDefinitionByModuleId(cage.moduleId)?.cageDefinitionIndex ?? cage.moduleId);
      const on = app.gachaMountCore('auto:feed-core', cage.instanceId);
      assert.equal(on.ok, true, `${cage.moduleId}: ${on.reason}`);
      assert.ok(mounts(app).find((c) => c.instanceId === cage.instanceId).feed, cage.moduleId);
      assert.equal(app.getCyberGachaFrame().automation.find((i) => i.id === 'auto:feed-core').owned, 0, 'the feeder left the bag');
      const off = app.gachaUnmountCore('AUTO_FEED', cage.instanceId);
      assert.equal(off.ok, true, off.reason);
      assert.equal(app.getCyberGachaFrame().automation.find((i) => i.id === 'auto:feed-core').owned, 1, 'back in the bag, nothing lost');
    }
    assert.ok(kinds.size >= 2, 'more than one kind of cage took it');
    // Both on one cage, then the cleaner moves to another.
    const [a, b] = placed;
    assert.equal(app.gachaMountCore('auto:feed-core', a.instanceId).ok, true);
    assert.equal(app.gachaMountCore('auto:clean-core', a.instanceId).ok, true);
    assert.equal(app.gachaUnmountCore('AUTO_CLEAN', a.instanceId).ok, true);
    assert.equal(app.gachaMountCore('auto:clean-core', b.instanceId).ok, true);
    const after = mounts(app);
    assert.deepEqual([after.find((c) => c.instanceId === a.instanceId).mounted, after.find((c) => c.instanceId === b.instanceId).mounted], [['AUTO_FEED'], ['AUTO_CLEAN']]);
    // The save keeps where each attachment runs.
    assert.deepEqual(h.saved().progression.cyberGacha.mounts, { [a.instanceId]: ['AUTO_FEED'], [b.instanceId]: ['AUTO_CLEAN'] });
  } finally { await app.dispose(); }
});

test('droppings saved without a cage instance are swept the moment the cage is cleaned, and on load', async () => {
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
    const result = app.gachaMountCore('auto:clean-core', cage.instanceId);
    assert.equal(result.ok, true, result.reason);
    assert.equal(app.getRaisingWasteFrame().length, 0, 'mounting the cleaner clears them at once');
    assert.equal(app.getShopFrame().bits, Math.min(9999999, bitsBefore + 5 * 50), 'each one pays +50 bits');
    // Load again with droppings in an already cleaned cage: none survive the load.
    app.save();
    const again = h.saved();
    again.raising.nativeHome.waste = [{ slot: 0, speciesIndex: 17, cageDefinitionIndex: definition, localPositionQ12: [70 * 4096, 90 * 4096, 0] }];
    h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(again));
    await app.dispose(); app = h.make(); await app.continueGame();
    assert.equal(app.getRaisingWasteFrame().length, 0, 'a cleaned cage starts clean');
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

test('the badge is a drawn gear with devices on the ground; the scrim dots are faint; the bag tabs are not sticky', () => {
  const view = source('src/championship/app/raisingHomeP1RView.js');
  assert.match(view, /function automationGear\(\)/);
  assert.doesNotMatch(view, /node\('img','int-rh2-cage-auto__icon'\)/, 'no item picture beside the running label');
  assert.match(view, /int-rh2-cage-auto__gear/);
  assert.match(view, /int-rh2-cage-device/);
  const tokens = source('src/championship/app/ui/tokens.css');
  const alpha = Number(/--ax-dots: radial-gradient\(rgba\(20, 20, 31, ([0-9.]+)\)/.exec(tokens)?.[1]);
  assert.ok(alpha > 0 && alpha <= 0.05, `scrim dot alpha ${alpha}`);
  const layout = source('src/championship/app/ui/screenLayout.css');
  const tabs = /\.cm-backpack__tabs \{[^}]*\}/.exec(layout)?.[0] ?? '';
  assert.doesNotMatch(tabs, /sticky/);
});
