// Owner 2026-11-04 (iPhone): after filling the ranch and rotating the phone the game went back to the
// title, and Continue then failed every time (CONTINUE_FAILED at the ChampionshipCageEditError helper):
// a ranch layout the editor refused locked the whole save. The root cause (a shared hex anchor) is fixed,
// and Continue repairs any layout the editor still refuses instead of locking the save.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {PRODUCT_WAITING_ROOM_SLOT, productRanchProblem, repairProductRanchPlacements} from '../src/championship/cage/productRanchGrid.js';
import {createRuntimeRecoveryDiagnostics} from '../src/championship/app/runtimeRecoveryDiagnostics.js';
import {getCageDefinitionByModuleId} from '../src/championship/cage/cageCatalog.js';

const read = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const source = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const species = read('src/data/championship/catalogs/creature-species.r1.json');
const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
const WAITING = 'championship:2026:cage:waiting-room';

async function savedGame() {
  const data = new Map();
  const storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k)};
  const make = () => createChampionshipStandaloneApp({playtestPolicy: FRIENDS_PLAYTEST_POLICY, productEconomy: true, storage, locks: null, cages, catalog: species});
  const first = make();
  await first.newGame(); first.save(); await first.dispose();
  return {data, make, save: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('repairProductRanchPlacements keeps the largest valid layout in saved order, one waiting room first', () => {
  const broken = [
    {moduleId: WAITING, slotIndex: PRODUCT_WAITING_ROOM_SLOT},
    {moduleId: 'championship:2026:cage:1', slotIndex: 5, instanceId: 'cage-a'},
    {moduleId: 'championship:2026:cage:1', slotIndex: 5, instanceId: 'cage-b'},   // overlaps cage-a
    {moduleId: 'championship:2026:cage:17', slotIndex: 40, instanceId: 'cage-a'}, // duplicate identity
    {moduleId: 'not-a-cage', slotIndex: 3},                                       // unknown module
    {moduleId: WAITING, slotIndex: 60}                                            // second waiting room
  ];
  assert.notEqual(productRanchProblem(broken), null);
  const repair = repairProductRanchPlacements(broken);
  assert.equal(productRanchProblem(repair.placements), null);
  assert.deepEqual(repair.placements.map(p => p.instanceId ?? p.moduleId), [WAITING, 'cage-a']);
  assert.equal(repair.removed.length, 4);
  // No waiting room at all: one is placed on its home cell.
  const lone = repairProductRanchPlacements([{moduleId: 'championship:2026:cage:1', slotIndex: 5, instanceId: 'x-1'}]);
  assert.equal(productRanchProblem(lone.placements), null);
  assert.equal(lone.placements[0].slotIndex, PRODUCT_WAITING_ROOM_SLOT);
});

test('two hex cages sharing one anchor (shapes that do not cover it) save and continue unchanged', async () => {
  // The root cause on 2026-11-04: the editor places cage 4 on cage 0's anchor (their cells are apart) and
  // the save accepts it, but normalizePlacements refused the shared anchor with DUPLICATE_CAGE_PLACEMENT.
  const h = await savedGame(), app = h.make();
  try {
    await app.continueGame();
    app.openShop();
    for (const moduleId of ['championship:2026:cage:0', 'championship:2026:cage:4']) app.buyShopItem(getCageDefinitionByModuleId(moduleId).shopRecordIndex, 1);
    app.leaveScreen(); app.save();
    app.openCageEdit();
    for (let i = 0; i < 8; i++) app.expandRanchLand();
    for (const moduleId of ['championship:2026:cage:0', 'championship:2026:cage:4']) {
      app.selectCageModule(moduleId);
      assert.equal(app.placeCageAt(0).lastVerdict.reason, 'PLACED', moduleId);
    }
    app.confirmCageEdit(); app.leaveScreen(); app.save();
  } finally { await app.dispose(); }
  const anchored = h.save().cageEdit.placements.filter(p => p.slotIndex === 0).map(p => p.moduleId).sort();
  assert.deepEqual(anchored, ['championship:2026:cage:0', 'championship:2026:cage:4']);
  const again = h.make();
  try {
    assert.ok(await again.continueGame(), 'Continue succeeds');
    assert.equal(again.takeRanchLoadRepair(), null, 'nothing needed repairing');
    again.openCageEdit();
    assert.equal(again.getCageEditFrame().placements.filter(p => p.slotIndex === 0).length, 2, 'both cages stay where they were');
  } finally { await again.dispose(); }
});

test('an untouched save reports no repair', async () => {
  const h = await savedGame(), app = h.make();
  try { assert.ok(await app.continueGame()); assert.equal(app.takeRanchLoadRepair(), null); }
  finally { await app.dispose(); }
});

test('the title tells the player once; diagnostics now name the refusing check', () => {
  const main = source('src/championship/app/main.js');
  assert.match(main, /const repair = app\.takeRanchLoadRepair\?\.\(\);/);
  assert.match(main, /recoveryDiagnostics\.record\('RANCH_REPAIRED'/);
  const diagnostics = source('src/championship/app/runtimeRecoveryDiagnostics.js');
  assert.match(diagnostics, /'ChampionshipCageEditError'\]\);/);
  // Longer codes come first: the code is matched with includes().
  assert.ok(diagnostics.indexOf("'INVALID_NATIVE_RANCH_MIGRATION'") < diagnostics.indexOf("'INVALID_NATIVE_RANCH'"));
  assert.ok(diagnostics.indexOf("'INVALID_PRODUCT_RANCH_ACCESS'") < diagnostics.indexOf("'INVALID_PRODUCT_RANCH'"));
  for (const lang of ['en', 'ja', 'th', 'vi']) assert.match(source(`src/championship/text/uiText.${lang}.js`), /"牧場配置已自動整理": "/, lang);
  assert.equal(typeof createRuntimeRecoveryDiagnostics, 'function');
});
