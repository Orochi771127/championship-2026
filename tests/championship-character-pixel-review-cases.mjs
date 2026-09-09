import assert from "node:assert/strict";
import test from "node:test";
import { resolvePreviewUrl, validatePreviewData, collectCoverage, masterMembers, patchConsumers,
  rasterizeSlot, createPixelReviewPlayer } from "../docs/art/production/characters/appearance-refresh-v1/pixel-v2/review/pixel-review-model.js";

function fixture() {
  const entityId = "m201_agumon";
  const key = (side, cell) => `${entityId}/${side}/cell_${String(cell).padStart(3, "0")}`;
  const slot = (side, cell, masterId, status, nativeBounds) => ({ side, cell, masterId, status, nativeBounds });
  return { schemaVersion: 2, entityId, designVersion: "test-only", palette: ["#00000000", "#AA0000", "#00BB00"],
    canvas: { width: 40, height: 32, origin: [20, 16], scale: 2 },
    masters: { a: { indices: [[0, 1], [2, 1]], patchRefs: [{ id: "shared", at: [0, 0] }] },
      c: { indices: [[1, 2], [2, 1]], patchRefs: [{ id: "shared", at: [0, 0] }] } },
    slots: { [key("main", 0)]: slot("main", 0, "a", "AUTHORED", [-1, -2, 1, 0]),
      [key("main", 1)]: slot("main", 1, "b", "UNAUTHORED", null),
      [key("sub", 0)]: slot("sub", 0, "a", "AUTHORED", [2, -2, 4, 0]),
      [key("sub", 1)]: slot("sub", 1, "c", "AUTHORED", [-1, -2, 1, 0]) },
    sides: Object.fromEntries(["main", "sub"].map((side) => [side, { sequences: [{ id: 0, playbackMode: side === "main" ? 1 : 2,
      loopStartFrame: 0, frames: [{ frameIndex: 0, cell: 0, ticks: 2, texture: key(side, 0) },
        { frameIndex: 1, cell: 1, ticks: 3, texture: key(side, 1) }] }] }])) };
}

test("coverage is derived from authored indices/slot status, not claimed manifest totals", () => {
  const data = fixture(); data.coverage = { authoredMasters: 999, authoredSlots: 999 };
  validatePreviewData(data);
  assert.deepEqual(collectCoverage(data), { authoredMasters: 2, totalMasters: 3, authoredSlots: 3, totalSlots: 4, totalSequences: 2, masterIds: ["a", "b", "c"] });
});

test("UNAUTHORED always renders a genuinely empty RGBA buffer without old pixels", () => {
  const data = fixture(); data.masters.b = data.masters.a;
  const result = rasterizeSlot(data, "m201_agumon/main/cell_001");
  assert.equal(result.authored, false); assert.ok(result.rgba.every((n) => n === 0));
});

test("shared master pixels use each slot's signed native bounds, preserving displacement", () => {
  const data = validatePreviewData(fixture());
  const a = rasterizeSlot(data, "m201_agumon/main/cell_000");
  const b = rasterizeSlot(data, "m201_agumon/sub/cell_000");
  const pixel = (r, x, y) => [...r.rgba.slice((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)];
  assert.deepEqual(pixel(a, 20, 12), [170, 0, 0, 255]);
  assert.deepEqual(pixel(a, 21, 13), [170, 0, 0, 255]);
  assert.deepEqual(pixel(b, 26, 12), [170, 0, 0, 255]);
  assert.deepEqual(pixel(a, 18, 12), [0, 0, 0, 0]);
});

test("transparent native padding may exceed the fixed canvas but visible pixels may not", () => {
  const data = fixture();
  data.masters.a.indices = [[0, 1], [0, 1]];
  data.slots["m201_agumon/main/cell_000"].nativeBounds = [-11, -2, -9, 0];
  validatePreviewData(data);
  const result = rasterizeSlot(data, "m201_agumon/main/cell_000");
  assert.deepEqual([...result.rgba.slice(12 * 40 * 4, 12 * 40 * 4 + 4)], [170, 0, 0, 255]);
  data.masters.a.indices[0][0] = 1;
  assert.throws(() => validatePreviewData(data), /PIXELS_OUTSIDE_NATIVE_CANVAS/);
});

test("palette preview recolors every linked instance and reset is lossless without changing the bank", () => {
  const data = fixture(); const original = JSON.stringify(data); const modified = [...data.palette]; modified[1] = "#123456";
  for (const key of masterMembers(data, "a")) {
    const originalRaster = rasterizeSlot(data, key);
    const recolored = rasterizeSlot(data, key, modified);
    assert.notDeepEqual(recolored.rgba, originalRaster.rgba);
    assert.deepEqual(rasterizeSlot(data, key, [...data.palette]).rgba, originalRaster.rgba);
  }
  assert.equal(JSON.stringify(data), original);
  assert.deepEqual(patchConsumers(data), [{ id: "shared", masters: ["a", "c"], slots: [
    "m201_agumon/main/cell_000", "m201_agumon/sub/cell_000", "m201_agumon/sub/cell_001"] }]);
});

test("raw mode 1 holds source ticks then displays missing frame and stops at original end", () => {
  const player = createPixelReviewPlayer(fixture(), "main", 0);
  assert.equal(player.getSnapshot().frameIndex, 0);
  assert.equal(player.stepUnit().frameIndex, 0);
  assert.equal(player.stepUnit().frameIndex, 1);
  assert.equal(player.getSnapshot().authored, false);
  player.stepUnit(); player.stepUnit(); const last = player.stepUnit();
  assert.equal(last.active, 0); assert.equal(last.frameIndex, 1);
  assert.equal(last.authoredFrameReferences, 1); assert.equal(last.totalFrameReferences, 2);
  assert.equal(player.stepUnit().frameIndex, 1);
});

test("raw mode 2 and frame stepping reuse native boundaries without fabricated interpolation", () => {
  const player = createPixelReviewPlayer(fixture(), "sub", 0);
  assert.equal(player.stepFrame().frameIndex, 1); assert.equal(player.getSnapshot().units, 2);
  assert.equal(player.stepFrame().frameIndex, 0); assert.equal(player.getSnapshot().units, 5);
  assert.equal(player.getSnapshot().elapsedQ12, 0); assert.equal(player.getSnapshot().active, 1);
  assert.equal(player.reset().units, 0);
});

test("review scheduler rejects unsupported raw modes through existing source timeline", () => {
  const data = fixture(); data.sides.main.sequences[0].playbackMode = 3;
  assert.throws(() => validatePreviewData(data), /MODE_REQUIRES_TRACE/);
});

for (const [label, change] of [
  ["out of bounds native placement", (data) => { data.slots["m201_agumon/main/cell_000"].nativeBounds = [99, 99, 101, 101]; }],
  ["ragged pixel rows", (data) => { data.masters.a.indices[1].pop(); }],
  ["out of range palette index", (data) => { data.masters.a.indices[1][0] = 99; }],
  ["missing authored pixels", (data) => { delete data.masters.a; }],
  ["sequence references wrong cell", (data) => { data.sides.main.sequences[0].frames[0].cell = 9; }],
  ["oversized canvas", (data) => { data.canvas.width = 2049; }],
  ["semitransparent nonzero palette", (data) => { data.palette[1] = "#FF000080"; }],
  ["opaque index zero", (data) => { data.palette[0] = "#000000FF"; }]
]) test(`invalid ${label} refuses candidate before rendering`, () => { const data = fixture(); change(data); assert.throws(() => validatePreviewData(data)); });

test("manifest URLs remain same-origin in the appearance work program", () => {
  const base = "http://127.0.0.1:8732/docs/art/production/characters/appearance-refresh-v1/pixel-v2/review/index.html";
  assert.equal(resolvePreviewUrl("../m201_agumon/preview-data.json", base), "http://127.0.0.1:8732/docs/art/production/characters/appearance-refresh-v1/pixel-v2/m201_agumon/preview-data.json");
  for (const input of ["https://outside.test/preview-data.json", "//outside.test/preview-data.json", "../../../../../../outside/preview-data.json",
    "../%2e%2e/preview-data.json", "..\\preview-data.json", "../bank/preview-data.json?x=1", "../bank/other.json"]) {
    assert.throws(() => resolvePreviewUrl(input, base));
  }
});
