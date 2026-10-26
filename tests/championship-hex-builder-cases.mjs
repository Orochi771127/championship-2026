// Owner 2026-10-27: facility builder, passages, partner visits, menus, bag and journal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { composeProductRanchGround } from '../src/championship/raising/nativeRaisingRanchRing.js';
import { ranchSafeExits } from '../src/championship/cage/ranchConnections.js';
import { RANCH_ECOLOGY_GROUPS } from '../src/championship/cage/ranchEcology.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { hexWorldPassageView, hexWorldPassageGain, ranchSynergyPartners } from '../src/championship/app/hexWorldPassages.js';
import { hexWorldCellLayers, hexWorldNeighbours } from '../src/championship/app/hexWorldEditor.js';
import { beginRanchExplorationWalk } from '../src/championship/raising/ranchExplorationWalk.js';
import { CAGE_DISPLAY_CAPACITY_OVERRIDES } from '../src/championship/cage/cageEffects.js';
import { SHOP_DESCRIPTIONS_ZH } from '../src/championship/text/catalogs.zhHant.js';
import { TOOLBAR_MENU_GROUPS, TOOLBAR_PRODUCT_ENTRIES, TOOLBAR_QUICK_ENTRIES } from '../src/championship/app/championshipToolbar.js';
import { backpackSections } from '../src/championship/app/ranchBackpack.js';
import { ranchDiscoveryReward, ranchDiscoveryTotals } from '../src/championship/app/ranchDiscoveryJournal.js';
import { shopItemName } from '../src/championship/text/zhHant.js';

const WR = 'championship:2026:cage:waiting-room', cage = (n) => `championship:2026:cage:${n}`;
// 運動場 (3 cells) with a 小運動場 against it, the waiting room apart.
const sports = [
  { moduleId: WR, slotIndex: 300, instanceId: 'cage:instance:wr' },
  { moduleId: cage(1), slotIndex: 199, instanceId: 'cage:instance:a' },
  { moduleId: cage(27), slotIndex: 201, instanceId: 'cage:instance:b' }
];

test('safe exits agree with the runtime passages on every shared edge', () => {
  const layouts = [sports, [...sports.slice(0, 2), { moduleId: cage(15), slotIndex: 201, instanceId: 'cage:instance:c' }]];
  for (const placements of layouts) {
    const ground = composeProductRanchGround({ placements, landCapacity: 100 }), { exits } = ranchSafeExits(ground);
    for (const b of ground.navigation.boundaries) {
      const sides = exits.get(b.id) ?? new Set();
      if (b.reason === 'CONNECTED') assert.ok(sides.has(b.left) && sides.has(b.right), `${b.id} connected without both exits`);
      if (b.reason === 'NO_SAFE_EXIT') assert.ok(!(sides.has(b.left) && sides.has(b.right)), `${b.id} closed with both exits`);
    }
  }
});

test('the editor reads the ranch passages, and previews the passage a placement would open', () => {
  const view = hexWorldPassageView(sports);
  assert.equal(view.connections.length, 1);
  assert.deepEqual([...view.connections[0].instances].sort(), ['cage:instance:a', 'cage:instance:b']);
  assert.ok(view.exits.every((e) => e.instanceId !== 'cage:instance:wr'), 'the waiting room never offers an exit');
  assert.ok(view.outlines.every((o) => o.edges.length >= 6));
  const gain = hexWorldPassageGain(sports.slice(0, 2), sports[2]);
  assert.equal(gain.length, 1);
  assert.equal(gain[0].id, view.connections[0].id);
  assert.deepEqual(hexWorldPassageGain(sports.slice(0, 2), { moduleId: cage(15), slotIndex: 201, instanceId: 'x:y:z' }), [], 'another ecology never joins');
  assert.equal(hexWorldPassageView([{ moduleId: cage(1), slotIndex: 199 }, { moduleId: cage(1), slotIndex: 199 }]), null, 'an impossible layout shows nothing');
});

test('synergy labels come from the ranch ecology groups', () => {
  for (const [type, ids] of Object.entries(RANCH_ECOLOGY_GROUPS)) for (const id of ids) {
    const partners = ranchSynergyPartners(cage(id));
    assert.equal(partners.type, type);
    assert.deepEqual([...partners.definitions], ids);
    assert.equal(partners.sameTypeOnly, ids.length < 2);
  }
  assert.equal(ranchSynergyPartners(WR).type, null);
  assert.equal(ranchSynergyPartners(cage(12)).sameTypeOnly, true, 'an ungrouped cage joins its own kind');
});

test('cell layers: sockets touch the land, the Lid only when no land is left', () => {
  const slots = Array.from({ length: 576 }, (_, slotIndex) => ({ slotIndex, moduleId: slotIndex === 226 ? cage(0) : null }));
  const open = hexWorldCellLayers(slots, 5), full = hexWorldCellLayers(slots, 0);
  assert.equal(open.get(226), 'placed');
  assert.deepEqual(hexWorldNeighbours(226).map((slot) => open.get(slot)), Array(6).fill('socket'));
  assert.equal(open.get(0), 'open');
  assert.equal(full.get(0), 'lid');
  assert.equal(full.get(226), 'placed');
});

test('a partner beside a new passage takes its next outing across it once', () => {
  const ground = composeProductRanchGround({ placements: sports, landCapacity: 100 });
  const home = ground.placements.find((p) => p.instanceId === 'cage:instance:a');
  const spot = (() => { for (let y = 0; y < ground.height; y++) for (let x = 0; x < ground.width; x++)
    if (ground.readClearance(x, y) > 1 && ground.readTerrain(x, y) !== 1 && ground.cageAt(x * 8, y * 8)?.ownerIndex === home.ownerIndex) return [x * 8 + 4, y * 8 + 4]; })();
  const actor = { positionQ12: [spot[0] * 4096, spot[1] * 4096, 0], speciesIndex: 1, poolSlot: 0, passageVisit: 'cage:instance:b' };
  const across = ground.placements.find((p) => p.instanceId === 'cage:instance:b').ownerIndex;
  assert.equal(beginRanchExplorationWalk(actor, ground), true);
  assert.equal(actor.explorationTarget, across);
  assert.equal(actor.explorationVisit, true);
  assert.equal(actor.passageVisit, undefined, 'the preference is spent either way');
});

test('zoo and infirmary suggest the count the simulation uses; the simulation is unchanged', () => {
  const lifecycle = JSON.parse(fs.readFileSync('src/data/championship/catalogs/raising-lifecycle.r1.json', 'utf8'));
  for (const [index, count] of Object.entries(CAGE_DISPLAY_CAPACITY_OVERRIDES)) {
    const definition = listCageDefinitions().find((d) => d.cageDefinitionIndex === Number(index));
    assert.equal(definition.training.capacity, count);
    assert.equal(lifecycle.cages[index].capacity, count, 'display follows the simulation');
    assert.match(SHOP_DESCRIPTIONS_ZH[definition.shopRecordIndex], new RegExp(`建議容納 ${count} 隻`));
  }
});

test('the System menu keeps every destination once and adds the bag and the journal', () => {
  const groups = TOOLBAR_MENU_GROUPS.SYSTEM.flatMap((group) => group.entries);
  assert.equal(new Set(groups).size, groups.length);
  for (const id of ['backpack', 'journal']) assert.ok(TOOLBAR_PRODUCT_ENTRIES.SYSTEM.some((entry) => entry.id === id && entry.action));
  assert.deepEqual([...TOOLBAR_QUICK_ENTRIES], ['hunt', 'battle', 'shop', 'database']);
  const source = fs.readFileSync('src/championship/app/championshipToolbar.js', 'utf8');
  assert.match(source, /docked = new Set\(syncDock\(\) \? TOOLBAR_QUICK_ENTRIES : \[\]\)/, 'a shown dock is not repeated in the menu');
  assert.match(source, /if \(shown\) button\.dataset\.entryId = button\.dataset\.quickId;/, 'the shown dock key carries the entry id instead');
  assert.match(source, /quick\.getClientRects\(\)/, 'a dock the theme does not draw counts as hidden');
});

test('the bag lists owned supplies; journal finds name the records they credit', () => {
  const frame = { bits: 40, listings: [
    { shopRecordIndex: 0, category: 'TRAINING_GOODS', owned: 3, maxOwned: 99 },
    { shopRecordIndex: 1, category: 'TRAINING_GOODS', owned: 0, maxOwned: 99 },
    { shopRecordIndex: 4, category: 'HUNT_ITEMS', owned: 1, maxOwned: 1 },
    { shopRecordIndex: 112, category: 'CAGES', owned: 1, maxOwned: 1 }] };
  const sections = backpackSections(frame);
  assert.deepEqual(sections.map((s) => s.category), ['TRAINING_GOODS', 'HUNT_ITEMS']);
  assert.deepEqual(sections[0].items.map((i) => i.shopRecordIndex), [0]);
  assert.equal(ranchDiscoveryReward('food').name, shopItemName(0));
  assert.equal(ranchDiscoveryReward('herb').name, shopItemName(2));
  assert.equal(ranchDiscoveryReward('rare').name, shopItemName(1));
  assert.equal(ranchDiscoveryReward('bits').bits, 20);
  const totals = ranchDiscoveryTotals([{ kind: 'food' }, { kind: 'bits' }, { kind: 'food' }]);
  assert.deepEqual(totals.map((t) => [t.name, t.quantity]), [[shopItemName(0), 4], ['金幣', 20]]);
});
