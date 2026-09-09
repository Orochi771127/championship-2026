import assert from "node:assert/strict";
import test from "node:test";

import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  RANCH_COVER_NODES,
  RANCH_COVER_PITCH_PX,
  SLOTS_PER_COVER,
  layoutRanchTiles,
  ranchBoardCell,
  ranchCoverForSlot
} from "../src/championship/cage/ranchSlotGeometry.js";
import { MAX_SLOT_COUNT, STARTING_SLOT_COUNT } from "../src/championship/cage/cageCatalog.js";

test("the cover nodes are the three the ROM carries, at their traced pitch", () => {
  assert.equal(RANCH_COVER_NODES.length, 3);
  assert.deepEqual(RANCH_COVER_NODES.map((node) => node.x), [170, 194, 218]);
  assert.ok(RANCH_COVER_NODES.every((node) => node.y === 8));
  assert.equal(RANCH_COVER_PITCH_PX, 24);
});

test("three covers span exactly the six unlockable slots", () => {
  assert.equal(MAX_SLOT_COUNT - STARTING_SLOT_COUNT, RANCH_COVER_NODES.length * SLOTS_PER_COVER);
});

test("native upper-row anchors match the last three cover positions", () => {
  // Native lower-row offsets are independently checked against ARM execution.
  const columnX = [];
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    columnX.push(ranchBoardCell(column * BOARD_ROWS).x);
  }
  assert.equal(columnX.length, 10);
  assert.deepEqual(columnX.slice(-3), RANCH_COVER_NODES.map((node) => node.x));
});

test("slots fill column-major, so unlocking two reveals one more column", () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((slot) => {
      const cell = ranchBoardCell(slot);
      return [cell.column, cell.row];
    }),
    [[0, 0], [0, 1], [1, 0], [1, 1]]
  );
});

test("the starting board hides exactly the covered columns", () => {
  const hidden = [];
  for (let slot = 0; slot < MAX_SLOT_COUNT; slot += 1) {
    if (ranchBoardCell(slot).hiddenByCover) hidden.push(slot);
  }
  assert.equal(hidden.length, MAX_SLOT_COUNT - STARTING_SLOT_COUNT);
  assert.ok(hidden.every((slot) => slot >= STARTING_SLOT_COUNT));
  assert.equal(ranchCoverForSlot(0), null);
  assert.equal(ranchCoverForSlot(MAX_SLOT_COUNT - 1).node, "cover1");
});

test("a slot outside the traced cap is refused rather than wrapped", () => {
  assert.throws(() => ranchBoardCell(MAX_SLOT_COUNT), /RANCH_SLOT_OUT_OF_RANGE/);
  assert.throws(() => ranchBoardCell(-1), /RANCH_SLOT_OUT_OF_RANGE/);
});

test("field tiles pack edge to edge with no gap and no overlap", () => {
  const layout = layoutRanchTiles([
    { slotIndex: 0, fieldId: "a", worldWidthPx: 384, worldHeightPx: 448 },
    { slotIndex: 1, fieldId: "b", worldWidthPx: 768, worldHeightPx: 448 },
    { slotIndex: 2, fieldId: "c", worldWidthPx: 384, worldHeightPx: 448 }
  ], { maxRowWidthPx: 1536 });

  assert.deepEqual(layout.tiles.map((tile) => tile.x), [0, 384, 1152]);
  assert.ok(layout.tiles.every((tile) => tile.y === 0));
  assert.equal(layout.widthPx, 1536);
  assert.equal(layout.heightPx, 448);
  assert.equal(layout.evidence, "PRODUCT_AUTHORED");
});

test("a tile that will not fit starts a new row below the tallest so far", () => {
  const layout = layoutRanchTiles([
    { slotIndex: 0, fieldId: "a", worldWidthPx: 1200, worldHeightPx: 800 },
    { slotIndex: 1, fieldId: "b", worldWidthPx: 800, worldHeightPx: 448 }
  ], { maxRowWidthPx: 1536 });

  assert.deepEqual(layout.tiles.map((tile) => [tile.x, tile.y]), [[0, 0], [0, 800]]);
  assert.equal(layout.heightPx, 1248);
});

test("layout is driven by slot order alone, so it is the same on every device", () => {
  const tiles = [
    { slotIndex: 2, fieldId: "c", worldWidthPx: 384, worldHeightPx: 448 },
    { slotIndex: 0, fieldId: "a", worldWidthPx: 384, worldHeightPx: 448 },
    { slotIndex: 1, fieldId: "b", worldWidthPx: 384, worldHeightPx: 448 }
  ];
  const first = layoutRanchTiles(tiles);
  const shuffled = layoutRanchTiles([...tiles].reverse());
  assert.deepEqual(first.tiles.map((tile) => tile.fieldId), ["a", "b", "c"]);
  assert.deepEqual(first.tiles, shuffled.tiles);
});

test("every placed position is an integer, because the art is hard edged", () => {
  const layout = layoutRanchTiles([
    { slotIndex: 0, fieldId: "a", worldWidthPx: 383.4, worldHeightPx: 447.6 },
    { slotIndex: 1, fieldId: "b", worldWidthPx: 384, worldHeightPx: 448 }
  ]);
  for (const tile of layout.tiles) {
    assert.ok(Number.isInteger(tile.x), `x ${tile.x}`);
    assert.ok(Number.isInteger(tile.y), `y ${tile.y}`);
    assert.ok(Number.isInteger(tile.widthPx));
    assert.ok(Number.isInteger(tile.heightPx));
  }
});

test("a tile with an unusable size is refused rather than silently skipped", () => {
  assert.throws(
    () => layoutRanchTiles([{ slotIndex: 0, fieldId: "bad", worldWidthPx: 0, worldHeightPx: 448 }]),
    /RANCH_TILE_SIZE_INVALID/
  );
});
