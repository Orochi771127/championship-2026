// Hex cage world (Owner direction 2026-10-26): free honeycomb placement, 100-cell
// cap, same-ecology seams open across the whole shared edge, regions follow edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { WAITING_ROOM_MODULE, originalStartingRanch } from '../src/championship/cage/nativeRanchLayout.js';
import {
  PRODUCT_RANCH_GRID, PRODUCT_RANCH_CELL_CAP, PRODUCT_RANCH_COLUMNS, PRODUCT_WAITING_ROOM_SLOT,
  productGridSlot, productPlacementCells, productRanchProblem, migrateProductRanch, legacyGrid100PlacementCells, legacyGrid100SlotToWorld,
  LEGACY_PRODUCT_RANCH_GRID100
} from '../src/championship/cage/productRanchGrid.js';
import { ranchEcologyType, ranchAllowsPassage, ranchMergesAppearance } from '../src/championship/cage/ranchEcology.js';
import { ranchSharedBoundaries } from '../src/championship/cage/ranchConnections.js';
import { composeProductRanchGround } from '../src/championship/raising/nativeRaisingRanchRing.js';

const moduleOf = i => listCageDefinitions().find(d => d.cageDefinitionIndex === i).moduleId;
const MINI_VOLCANO = moduleOf(31), MINI_MOUNTAIN = moduleOf(32), FOREST = moduleOf(10), JUNGLE = moduleOf(11);
const waiting = { moduleId: WAITING_ROOM_MODULE, slotIndex: PRODUCT_WAITING_ROOM_SLOT, instanceId: 'cage:instance:wait' };
let serial = 0;
const at = (moduleId, row, column) => ({ moduleId, slotIndex: productGridSlot(row, column), instanceId: `cage:instance:t${++serial}` });
const ground = placements => composeProductRanchGround({ layoutVersion: PRODUCT_RANCH_GRID, placements: [waiting, ...placements], landCapacity: PRODUCT_RANCH_CELL_CAP });
const ownerOf = (g, placement) => g.placements.find(p => p.instanceId === placement.instanceId).ownerIndex;
const spot = (g, owner) => {
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++)
    if (g.readClearance(x, y) > 1 && g.readTerrain(x, y) !== 1 && g.cageAt(x * 8 + 4, y * 8 + 4)?.ownerIndex === owner) return [x * 8 + 4, y * 8 + 4];
  return null;
};

test('ecology types: same ecology joins, different looks can share a type, waiting room never joins', () => {
  assert.equal(ranchEcologyType(FOREST), 'forest');
  assert.equal(ranchEcologyType(JUNGLE), 'forest');
  assert.ok(ranchAllowsPassage(FOREST, JUNGLE) && ranchMergesAppearance(FOREST, JUNGLE));
  assert.ok(!ranchAllowsPassage(MINI_VOLCANO, MINI_MOUNTAIN));
  assert.equal(ranchEcologyType(WAITING_ROOM_MODULE), null);
  assert.ok(!ranchAllowsPassage(WAITING_ROOM_MODULE, WAITING_ROOM_MODULE));
});

test('only a full shared edge counts; a corner touch is not adjacent', () => {
  const a = at(MINI_VOLCANO, 4, 4), corner = at(MINI_VOLCANO, 2, 4);
  const tagged = [a, corner].map((p, ownerIndex) => ({ ...p, ownerIndex }));
  assert.equal(ranchSharedBoundaries(tagged).length, 0, 'two rows apart never share an edge');
  const side = at(MINI_VOLCANO, 4, 5);
  assert.equal(ranchSharedBoundaries([a, side].map((p, ownerIndex) => ({ ...p, ownerIndex }))).length, 1);
});

test('two same-type cells: the shared edge opens for passage and appearance', () => {
  const a = at(MINI_VOLCANO, 4, 4), b = at(MINI_VOLCANO, 4, 5);
  const g = ground([a, b]);
  const edge = g.navigation.boundaries.find(e => e.left === ownerOf(g, a) && e.right === ownerOf(g, b) || e.left === ownerOf(g, b) && e.right === ownerOf(g, a));
  assert.ok(edge.merged && edge.compatible, 'seam dissolves and is passable');
  assert.equal(g.navigation.connections.length, 1);
  assert.ok(g.navigation.connections[0].cells.length > 8, 'more than a one-tile path: the whole joint opens');
  assert.equal(g.navigation.regionOf(ownerOf(g, a)), g.navigation.regionOf(ownerOf(g, b)));
});

test('three in a row: a partner can walk from the first cell to the third', () => {
  const cells = [at(MINI_VOLCANO, 4, 4), at(MINI_VOLCANO, 4, 5), at(MINI_VOLCANO, 4, 6)];
  const g = ground(cells);
  const [first, , third] = cells.map(c => ownerOf(g, c));
  assert.deepEqual(g.navigation.connectedOwners(first).sort(), cells.map(c => ownerOf(g, c)).sort());
  const route = g.navigation.plan(spot(g, first), third, 0);
  assert.ok(route?.length > 10, 'route exists');
  for (const [x, y] of route) assert.notEqual(g.readTerrain(Math.floor(x / 8), Math.floor(y / 8)), 1, 'every step is walkable');
  assert.equal(g.navigation.ownerAt(route.at(-1)).ownerIndex, third);
});

test('different types side by side keep their border (v1 default)', () => {
  const a = at(MINI_VOLCANO, 4, 4), b = at(MINI_MOUNTAIN, 4, 5);
  const g = ground([a, b]);
  const edge = g.navigation.boundaries[0];
  assert.equal(edge.reason, 'DIFFERENT_TYPE');
  assert.ok(!edge.merged && !edge.compatible);
  assert.equal(g.navigation.connections.length, 0);
  assert.equal(g.navigation.plan(spot(g, ownerOf(g, a)), ownerOf(g, b), 0), null);
});

test('removing the middle cell splits the region; the empty position is not walkable', () => {
  const left = at(MINI_VOLCANO, 4, 4), middle = at(MINI_VOLCANO, 4, 5), right = at(MINI_VOLCANO, 4, 6);
  const before = ground([left, middle, right]);
  assert.equal(before.navigation.regionOf(ownerOf(before, left)), before.navigation.regionOf(ownerOf(before, right)));
  const after = ground([left, right]);
  assert.notEqual(after.navigation.regionOf(ownerOf(after, left)), after.navigation.regionOf(ownerOf(after, right)));
  assert.equal(after.navigation.connections.length, 0);
  assert.equal(after.navigation.plan(spot(after, ownerOf(after, left)), ownerOf(after, right), 0), null);
  const c = productPlacementCells(middle)[0], row = Math.floor(c / PRODUCT_RANCH_COLUMNS), column = c % PRODUCT_RANCH_COLUMNS;
  const cx = column * 96 + (row % 2) * 48 + 48, cy = row * 88 + 32;
  assert.equal(after.readTerrain(Math.floor(cx / 8), Math.floor(cy / 8)), 1, 'the vacated hex is void');
  assert.equal(after.cageAt(cx, cy), null);
});

test('placement snaps to the lattice and never shifts because of neighbours', () => {
  const a = at(FOREST, 6, 3), b = at(JUNGLE, 6, 6);
  const alone = productPlacementCells(a);
  assert.deepEqual(productPlacementCells(a), alone);
  const g = ground([a, b]);
  assert.equal(g.placement(a.instanceId).slotIndex, a.slotIndex);
  assert.equal(g.placement(b.instanceId).slotIndex, b.slotIndex);
});

test('overlap and the 100-cell cap are refused with a reason', () => {
  const a = at(MINI_VOLCANO, 4, 4);
  assert.equal(productRanchProblem([waiting, a, { ...at(MINI_VOLCANO, 4, 4) }]), 'OCCUPIED');
  // Fill exactly 100 cells (waiting room 4 + 96 single cells), then one more.
  const filled = [waiting];
  for (let i = 0; filled.length < 97; i++) {
    const row = 1 + Math.floor(i / 22), column = 1 + i % 22;
    const p = at(MINI_VOLCANO, row, column);
    if (productPlacementCells(p).some(s => productPlacementCells(waiting).includes(s))) continue;
    filled.push(p);
  }
  assert.equal(filled.reduce((n, p) => n + productPlacementCells(p).length, 0), 100);
  assert.equal(productRanchProblem(filled), null);
  assert.equal(productRanchProblem([...filled, at(MINI_VOLCANO, 22, 22)]), 'CELL_CAP');
  assert.equal(productRanchProblem(filled.slice(0, 20), 10), 'LAND_CAPACITY');
});

test('100 cells compose a connected world quickly', () => {
  const filled = [];
  for (let i = 0; filled.length < 96; i++) filled.push(at(MINI_VOLCANO, 1 + Math.floor(i / 12), 10 + i % 12));
  const t0 = performance.now();
  const g = ground(filled);
  const ms = performance.now() - t0;
  assert.ok(g.navigation.regions.length <= 2, 'the volcano block is one region (plus the waiting room)');
  assert.ok(ms < 4000, `composition took ${ms.toFixed(0)} ms`);
});

test('old 10×10 saves migrate into the world with the same footprints', () => {
  const native = migrateProductRanch(originalStartingRanch(), 20);
  assert.equal(native.layoutVersion, PRODUCT_RANCH_GRID);
  const legacy = { layoutVersion: LEGACY_PRODUCT_RANCH_GRID100, gridAccess: { version: 1, legacyUnlockedSlots: Array.from({ length: 20 }, (_, i) => i), purchasedRows: [], testUnlockedRows: [], legacyGrants: [] },
    nextInstanceSequence: 3, placements: [{ moduleId: WAITING_ROOM_MODULE, slotIndex: 0, instanceId: 'cage:legacy:35' }, { moduleId: FOREST, slotIndex: 4, instanceId: 'cage:instance:1' }] };
  const world = migrateProductRanch(legacy, 20);
  assert.equal(world.nextInstanceSequence, 3);
  for (const [i, p] of legacy.placements.entries()) {
    const before = legacyGrid100PlacementCells(p).map(legacyGrid100SlotToWorld).sort((a, b) => a - b);
    assert.deepEqual(productPlacementCells(world.placements[i]).sort((a, b) => a - b), before, 'same shape, shifted');
    assert.equal(world.placements[i].instanceId, p.instanceId);
  }
  assert.equal(world.placements[0].slotIndex, PRODUCT_WAITING_ROOM_SLOT);
});
