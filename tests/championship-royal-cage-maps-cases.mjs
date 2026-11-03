// Owner 2026-11-03: 全自動皇家牧場 and 全自動星際動物園 are their own maps (own footprint,
// walk data, Blender GLB and UI pictures), run by the ranch's and the zoo's rules, and older
// saves that placed them as a ranch / zoo move onto them without losing anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import ground from '../src/data/championship/catalogs/ranch-three-ground.r1.json' with {type: 'json'};
import threeManifest from '../assets/production/cage/three-20261021/manifest.json' with {type: 'json'};
import uiThree from '../assets/production/public-runtime/cage-ui-three.v1.json' with {type: 'json'};
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {cageRuleDefinitionIndex, getCageDefinition, getCageDefinitionByModuleId, listGachaCageDefinitions} from '../src/championship/cage/productCageCatalog.js';
import {cageDefinitionShape} from '../src/championship/cage/cageShapes.js';
import {PRODUCT_RANCH_GRID, PRODUCT_WAITING_ROOM_SLOT, productPlacementCells} from '../src/championship/cage/productRanchGrid.js';
import {migrateRoyalCagePlacements} from '../src/championship/cage/royalCageMigration.js';
import {ranchEcologyType} from '../src/championship/cage/ranchEcology.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {getCageVisualBinding, getOriginalCageVisualBinding} from '../src/championship/presentation/originalCageVisualBindings.js';
import {cageUiImage, cageUiSummary, cageUiThumbnail} from '../src/championship/presentation/cageUiArt.js';
import {cageName} from '../src/championship/text/zhHant.js';
import {cageAutomation, royalCopiesByDefinition} from '../src/championship/gacha/ranchAutomation.js';

const ROYAL = 'championship:2026:cage:royal-ranch', STELLAR = 'championship:2026:cage:stellar-zoo';
const moduleOf = (definition) => `championship:2026:cage:${definition}`;
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const WAITING = {moduleId: 'championship:2026:cage:waiting-room', slotIndex: PRODUCT_WAITING_ROOM_SLOT, instanceId: 'cage:waiting-room'};

function harness() {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = (extra = {}) => createChampionshipStandaloneApp({playtestPolicy: FRIENDS_PLAYTEST_POLICY, storage, locks: null, cages, catalog: species, ...extra});
  return {data, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('the royal maps are their own modules: the waiting room\'s four hexes, the base cage\'s rules, their own field', () => {
  assert.equal(listCageDefinitions().length, 36, 'the original catalog is unchanged');
  assert.deepEqual(listGachaCageDefinitions().map(d => [d.cageDefinitionIndex, d.moduleId, d.gachaEdition, d.ruleDefinitionIndex, d.shopRecordIndex]),
    [[36, ROYAL, 'ROYAL_RANCH', 25, null], [37, STELLAR, 'STELLAR_ZOO', 24, null]]);
  for (const [index, moduleId, fieldId, rule] of [[36, ROYAL, 'field_royal_ranch_01', 25], [37, STELLAR, 'field_stellar_zoo_01', 24]]) {
    assert.equal(getCageDefinitionByModuleId(moduleId).cageDefinitionIndex, index);
    assert.equal(getCageDefinition(index).moduleId, moduleId);
    assert.equal(cageDefinitionShape(index), cageDefinitionShape(35), 'the waiting room\'s shape');
    assert.equal(productPlacementCells({moduleId, slotIndex: 200}).length, 4);
    assert.equal(cageRuleDefinitionIndex(index), rule);
    assert.equal(getOriginalCageVisualBinding(index), null, 'the ROM table stays 36 entries');
    assert.equal(getCageVisualBinding(index).fieldId, fieldId);
    assert.equal(ranchEcologyType(moduleId), `cage-${index}`, 'joins only its own kind');
    assert.match(cageUiSummary(moduleId), /自動餵食與清潔/);
    assert.equal(cageUiImage(moduleId), `assets/production/cage/ui-three-20261102/frames/${fieldId}.webp`);
    assert.equal(cageUiThumbnail(moduleId), `assets/production/cage/ui-three-20261102/thumbnails/${fieldId}.webp`);
  }
  assert.deepEqual([cageName(36), cageName(37)], ['全自動皇家牧場', '全自動星際動物園']);
});

test('walk data, GLBs and UI pictures are installed with their hashes; each map carries an animation loop and per-edge rims', () => {
  for (const [index, fieldId] of [[36, 'field_royal_ranch_01'], [37, 'field_stellar_zoo_01']]) {
    const field = ground.fields.find(f => f.definitionIndex === index);
    assert.deepEqual([field.width, field.height], [30, 25]);
    const cells = field.runs.flatMap(([n, ...v]) => Array(n).fill(v));
    assert.equal(cells.length, 750);
    assert.ok(cells.filter(([owner, terrain]) => owner === 1 && terrain === 0).length > 300, 'a wide lawn / deck');
    assert.deepEqual(field.clearanceRuns.flatMap(([n, v]) => Array(n).fill(v)), cells.map(c => c[2]));
    const spec = threeManifest.fields.find(f => f.fieldId === fieldId);
    const bytes = readFileSync(spec.url);
    assert.equal(bytes.length, spec.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), spec.sha256);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    assert.ok(json.extensionsUsed.includes('KHR_draco_mesh_compression'));
    assert.ok(json.animations.length > 0, 'motion is in the GLB');
    const names = json.nodes.map(n => n.name);
    assert.ok(names.filter(n => /-rim-joint-e\d+$/.test(n)).length >= 12, 'one rim node per outer edge');
    assert.ok(json.materials.every(m => !m.alphaMode || m.alphaMode === 'OPAQUE'), 'opaque materials');
    assert.ok(bytes.length < 700000, 'web budget');
    const ui = uiThree.fields.find(f => f.fieldId === fieldId);
    assert.equal(ui.modelSha256, spec.sha256, 'the UI pictures were rendered from this GLB');
  }
});

test('a royal ranch lays out its own map but the simulation runs it by the ranch\'s rules', () => {
  const placements = [WAITING, {moduleId: ROYAL, slotIndex: 205, instanceId: 'cage:instance:1'}, {moduleId: STELLAR, slotIndex: 251, instanceId: 'cage:instance:2'}];
  const g = composeProductRanchGround({layoutVersion: PRODUCT_RANCH_GRID, placements, landCapacity: 100});
  const royal = g.placement('cage:instance:1'), stellar = g.placement('cage:instance:2');
  assert.deepEqual([royal.definitionIndex, royal.fieldDefinitionIndex, stellar.definitionIndex, stellar.fieldDefinitionIndex], [25, 36, 24, 37]);
  let walk = 0;
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.readTerrain(x, y) !== 1 && g.cageAt(x * 8, y * 8)?.instanceId === 'cage:instance:1') walk++;
  assert.equal(walk, ground.fields.find(f => f.definitionIndex === 36).runs.filter(r => r[1] === 1 && r[2] === 0).reduce((s, r) => s + r[0], 0));
});

test('migration: a royal cage saved as a ranch or a zoo moves onto its own map, nearest free, keeping its instance', () => {
  const ranch = {moduleId: moduleOf(25), slotIndex: 202, instanceId: 'cage:instance:3'};
  const zoo = {moduleId: moduleOf(24), slotIndex: 296, instanceId: 'cage:instance:4'};
  const plain = {moduleId: moduleOf(25), slotIndex: 248, instanceId: 'cage:instance:5'};
  const before = [WAITING, ranch, zoo, plain];
  const {placements, moved} = migrateRoyalCagePlacements(before, {'cage:instance:3': 'ROYAL_RANCH', 'cage:instance:4': 'STELLAR_ZOO'});
  assert.deepEqual(moved.map(m => [m.instanceId, m.to]), [['cage:instance:3', ROYAL], ['cage:instance:4', STELLAR]]);
  const after = new Map(placements.map(p => [p.instanceId, p]));
  assert.deepEqual(after.get('cage:instance:5'), plain, 'a ranch without an edition stays a ranch');
  const reused = (from, to) => productPlacementCells(to).filter(s => productPlacementCells(from).includes(s)).length;
  assert.ok(reused(ranch, after.get('cage:instance:3')) >= 3, 'the royal ranch keeps most of its hexes');
  assert.equal(reused(zoo, after.get('cage:instance:4')), 2, 'the stellar zoo grows around its two hexes');
  const cells = placements.flatMap(p => productPlacementCells(p));
  assert.equal(new Set(cells).size, cells.length, 'nothing overlaps');
  assert.deepEqual(migrateRoyalCagePlacements(placements, {'cage:instance:3': 'ROYAL_RANCH', 'cage:instance:4': 'STELLAR_ZOO'}).moved, [], 'idempotent');
});

test('app: royal cages saved the 11-02 way load onto their own maps, still fed and cleaned, and the save stays valid', async () => {
  const h = harness();
  let app = h.make();
  let royalId = null, stellarId = null;
  try {
    await app.newGame();
    app.grantAutomationItem('auto:royal-ranch', 1, 'TEST');
    app.grantAutomationItem('auto:stellar-zoo', 1, 'TEST');
    app.openCageEdit();
    app.expandRanchLand();
    const place = (id) => {
      for (const slot of app.getCageEditFrame().slots.filter(s => !s.moduleId).map(s => s.slotIndex)) {
        app.selectRoyalCage(id);
        const before = new Set(app.getCageEditFrame().placements.map(p => p.instanceId));
        const added = app.placeCageAt(slot).placements.find(p => !before.has(p.instanceId));
        if (added) return added;
      }
      return null;
    };
    const royal = place('auto:royal-ranch'), stellar = place('auto:stellar-zoo');
    assert.deepEqual([royal?.moduleId, stellar?.moduleId], [ROYAL, STELLAR]);
    royalId = royal.instanceId; stellarId = stellar.instanceId;
    app.confirmCageEdit(); app.leaveScreen(); app.save();
  } finally { await app.dispose(); }
  // Rewrite the save as 2026-11-02 stored it: the royal cages as a ranch and a zoo.
  const saved = h.saved();
  assert.deepEqual([...royalCopiesByDefinition(saved.progression.cyberGacha)].sort(), [[36, 1], [37, 1]]);
  // Far from the starting cages, so the old ranch / zoo shapes are a valid 11-02 layout.
  for (const p of saved.cageEdit.placements) {
    if (p.instanceId === royalId) Object.assign(p, {moduleId: moduleOf(25), slotIndex: 16 * 24 + 4});
    if (p.instanceId === stellarId) Object.assign(p, {moduleId: moduleOf(24), slotIndex: 18 * 24 + 4});
  }
  h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  app = h.make();
  try {
    await app.continueGame();
    const frame = app.getCageEditFrame();
    const byId = new Map(frame.placements.map(p => [p.instanceId, p]));
    assert.equal(byId.get(royalId).moduleId, ROYAL);
    assert.equal(byId.get(stellarId).moduleId, STELLAR);
    for (const id of [royalId, stellarId]) {
      const auto = frame.automation[id];
      assert.deepEqual([auto.royal, auto.clean, auto.feed], [true, true, true], id);
    }
    assert.equal(cageAutomation(h.saved().progression.cyberGacha, stellarId).sleepPercent, 130);
    app.save();
    assert.equal(app.savePort.getStatus().phase, 'SAVED', 'the stock check counts the royal maps');
    const again = h.saved();
    assert.ok(again.cageEdit.placements.some(p => p.instanceId === royalId && p.moduleId === ROYAL));
    assert.ok(again.cageEdit.placements.some(p => p.instanceId === stellarId && p.moduleId === STELLAR));
    assert.deepEqual(again.progression.cyberGacha.editions, {[royalId]: 'ROYAL_RANCH', [stellarId]: 'STELLAR_ZOO'});
  } finally { await app.dispose(); }
});

test('app: the royal maps come only from the shop\'s gachapon; the facility editor lists them only after a pull', async () => {
  const rolls = [];
  const h = harness();
  const app = h.make({gachaRandom: () => (rolls.length ? rolls.shift() : 0.1)});
  try {
    await app.newGame();
    assert.ok(listCageDefinitions().every(d => ![ROYAL, STELLAR].includes(d.moduleId)), 'never sold for Bits');
    app.openCageEdit();
    let frame = app.getCageEditFrame();
    assert.deepEqual(frame.royalTray, [], 'no royal card before a pull');
    assert.ok(!frame.tray.some(t => [ROYAL, STELLAR].includes(t.moduleId)));
    assert.notEqual(app.selectCageModule(ROYAL).selectedModuleId, ROYAL, 'an unowned royal map cannot be picked');
    app.leaveScreen();
    // One premium pull lands on SSR, then on the automation slice: the royal ranch; the next on UR: the stellar zoo.
    app.grantGachaTickets(2, 'TEST');
    app.openShop();
    rolls.push(0.9, 0.95, 0);
    assert.deepEqual(app.gachaPull('PREMIUM', 1).prizes.map(p => p.id), ['auto:royal-ranch']);
    app.leaveScreen();
    app.openCageEdit();
    frame = app.getCageEditFrame();
    assert.deepEqual(frame.royalTray.map(r => [r.id, r.moduleId, r.available]), [['auto:royal-ranch', ROYAL, 1]]);
    app.leaveScreen();
    app.openShop();
    rolls.push(0.99, 0.95, 0);
    app.gachaPull('PREMIUM', 1);
    app.leaveScreen();
    app.openCageEdit();
    frame = app.getCageEditFrame();
    assert.deepEqual(frame.royalTray.map(r => [r.id, r.moduleId, r.available]), [['auto:royal-ranch', ROYAL, 1], ['auto:stellar-zoo', STELLAR, 1]]);
    assert.equal(app.selectRoyalCage('auto:stellar-zoo').selectedModuleId, STELLAR, 'now placeable');
  } finally { await app.dispose(); }
});
