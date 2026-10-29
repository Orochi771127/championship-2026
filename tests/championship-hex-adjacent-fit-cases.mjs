// Owner 2026-10-29: a cage tapped next to its neighbours lands against them.
// Eight original shapes leave their anchor hex empty, so a tap used as the
// anchor put the cage one hex right of the tap and the gap could never close.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from '../src/championship/cage/ranchSlotGeometry.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
import { PRODUCT_RANCH_GRID, productFieldTileOrigin, productFitPlacement, productGridCell, productGridSlot,
  productPlacementCells, productRanchProblem } from '../src/championship/cage/productRanchGrid.js';
import { hexWorldNeighbours } from '../src/championship/app/hexWorldEditor.js';

const cage = (n) => `championship:2026:cage:${n}`;
const WR = cage('waiting-room'), RANCH = cage(25);
const at = (moduleId, row, column, instanceId) => ({ moduleId, slotIndex: productGridSlot(row, column), instanceId });
const slot = productGridSlot;

// The Owner's screenshot: 運動場, 空地 over 小保健室 on the left, 小運動場 above,
// 競技場 below, and the 牧場 parked one hex right of the gap it should fill.
const neighbours = [
  at(WR, 12, 14, 'cage:instance:wr'),
  at(cage(1), 10, 3, 'cage:instance:sports'),        // 運動場 (10,3) (11,3) (10,4)
  at(cage(0), 10, 5, 'cage:instance:clearing'),      // 空地
  at(cage(15), 11, 4, 'cage:instance:infirmary'),    // 小保健室
  at(cage(27), 9, 6, 'cage:instance:mini-sports'),   // 小運動場
  at(cage(2), 12, 4, 'cage:instance:arena')          // 競技場 (12,4) (13,4) (12,5) (13,5) (12,6)
];
const pushed = at(RANCH, 10, 6, 'cage:instance:ranch');
const gap = [slot(10, 6), slot(11, 5)];
const owned = listCageDefinitions().map((d) => d.shopRecordIndex).filter(Number.isInteger);
const shapeOf = (moduleId) => ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[listCageDefinitions().find((d) => d.moduleId === moduleId).cageDefinitionIndex]];

test('the bug: 牧場 has no cell on its anchor, so the tapped hex stayed empty', () => {
  assert.equal(shapeOf(RANCH) & 1, 0);
  const asAnchor = productPlacementCells({ moduleId: RANCH, slotIndex: slot(10, 6) });
  assert.ok(!asAnchor.includes(slot(10, 6)), 'the old tap-as-anchor left the tapped hex out');
  assert.deepEqual(asAnchor, productPlacementCells(pushed), 'which is exactly the pushed-away position');
  for (const s of gap) assert.ok(![...neighbours, pushed].some((p) => productPlacementCells(p).includes(s)), 'the gap is empty');
});

test('adjacent cages of any ecology are legal side by side, with no buffer hex', () => {
  const tight = at(RANCH, 10, 5, 'cage:instance:ranch');
  assert.deepEqual(productPlacementCells(tight).sort((a, b) => a - b), [slot(10, 6), slot(10, 7), slot(11, 5), slot(11, 6)].sort((a, b) => a - b));
  assert.equal(productRanchProblem([...neighbours, tight]), null, 'grassland 牧場 against 空地 / 小保健室 / 小運動場 / 競技場');
  const touching = new Set(productPlacementCells(tight).flatMap(hexWorldNeighbours));
  for (const p of neighbours.slice(2)) assert.ok(productPlacementCells(p).some((s) => touching.has(s)), `${p.instanceId} touches the 牧場`);
});

test('tapping the gap moves the 牧場 flush against its neighbours (runtime)', () => {
  const editor = createCageEditRuntime({ snapshot: { layoutVersion: PRODUCT_RANCH_GRID, nextInstanceSequence: 10, placements: [...neighbours, pushed],
    gridAccess: { version: 1, legacyUnlockedSlots: Array.from({ length: 20 }, (_, i) => i), purchasedRows: [], testUnlockedRows: [], legacyGrants: [] } }, publicTestGrid: true });
  for (const tap of gap) {
    const fit = productFitPlacement([...neighbours, pushed], RANCH, tap, { ignoreInstanceId: 'cage:instance:ranch' });
    assert.ok(fit.ok, `tap ${productGridCell(tap).row},${productGridCell(tap).column} fits`);
    assert.ok(fit.cells.includes(tap), 'the tapped hex is one of the 牧場 cells');
    assert.equal(fit.slotIndex, slot(10, 5), 'both gap hexes resolve to the flush position');
  }
  const frame = editor.movePlacement('cage:instance:ranch', productFitPlacement([...neighbours, pushed], RANCH, gap[0], { ignoreInstanceId: 'cage:instance:ranch' }).slotIndex, owned, 4);
  assert.equal(frame.lastVerdict.reason, 'MOVED');
  const moved = frame.placements.find((p) => p.instanceId === 'cage:instance:ranch');
  const cells = productPlacementCells(moved);
  for (const s of gap) assert.ok(cells.includes(s), 'no empty hex is left between the 牧場 and its neighbours');
  // The 2D art and the 3D scene both anchor a cage picture with productFieldTileOrigin.
  const origin = productFieldTileOrigin(moved.slotIndex, ORIGINAL_CAGE_DEFINITION_SHAPES[25]);
  const px = cells.map(productGridCell);
  assert.equal(origin.tileX * 8, Math.min(...px.map((c) => c.x)), 'picture left edge = footprint left edge');
  assert.equal(origin.tileY * 8 + 24, Math.min(...px.map((c) => c.y)), 'picture top = footprint top row');
});

test('a fit never overlaps: a tap on a neighbour is refused and names the hit hex', () => {
  const fit = productFitPlacement([...neighbours, pushed], RANCH, slot(10, 5), { ignoreInstanceId: 'cage:instance:ranch' });
  assert.equal(fit.ok, false);
  assert.ok(fit.conflicts.includes(slot(10, 5)), '空地 is the hex it would cover');
  assert.equal(productFitPlacement([], RANCH, -1), null);
});

test('every cage: each of its cells can sit on the tapped hex, on odd and even rows and columns', () => {
  for (const definition of listCageDefinitions()) {
    const moduleId = definition.moduleId;
    let reference = null;
    for (const [row, column] of [[10, 10], [10, 11], [11, 10], [11, 11]]) {
      const tap = slot(row, column), fit = productFitPlacement([], moduleId, tap);
      assert.ok(fit?.ok && fit.cells.includes(tap), `${moduleId} covers the tap at ${row},${column}`);
      const px = fit.cells.map(productGridCell).sort((a, b) => a.y - b.y || a.x - b.x);
      assert.equal(px[0].slotIndex, tap, `${moduleId}: on an empty board the tap is the top-left cell`);
      // Translation invariance: the same pixel shape at every parity.
      const shape = px.map((c) => `${c.x - px[0].x},${c.y - px[0].y}`).join(' ');
      reference ??= shape;
      assert.equal(shape, reference, `${moduleId} keeps its shape at ${row},${column}`);
      for (let i = 0; i < fit.cells.length; i++) {
        const cell = fit.cells[i], other = productFitPlacement([], moduleId, cell);
        assert.ok(other.cells.includes(cell));
      }
    }
  }
});

test('a cell other than the top-left takes the tap when the top-left would overlap', () => {
  // A single 小保健室 under-left of the tap: the 牧場's top-left fit would cover it.
  const blocker = at(cage(15), 11, 5, 'cage:instance:x');
  const fit = productFitPlacement([blocker], RANCH, slot(10, 6));
  assert.ok(fit.ok && fit.cells.includes(slot(10, 6)));
  assert.ok(!fit.cells.includes(slot(11, 5)));
  assert.ok(fit.contact > 0, 'and it still touches the neighbour');
});
