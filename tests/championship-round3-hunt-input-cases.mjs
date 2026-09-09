import assert from "node:assert/strict";
import test from "node:test";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { huntViewportTransform, huntViewportToWorld, huntWorldToViewport, huntWorldToNative } from "../src/championship/hunt/huntFieldCoordinates.js";
import { createHuntFieldPointer } from "../src/championship/presentation/vs2/huntFieldPointer.js";

const fixture = () => createHuntRuntime({ world: createHuntWorld(listChampionshipGates()[0]), fieldActor: { actorId: "test", displayName: "Test" } });
const event = (x, y, pointerId = 1) => ({ global: { x, y }, pointerId, button: 0 });
const adapter = (runtime, width, height) => createHuntFieldPointer({
  getView: () => ({ camera: runtime.getCamera(width, height), transform: huntViewportTransform(width, height),
    toWorldPoint: (point) => huntViewportToWorld(point, runtime.getCamera(width, height), huntViewportTransform(width, height)) }), intents: runtime
});

test("coordinate round-trips preserve native gesture distances on phones and desktop", () => {
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1024, 768]]) {
    const transform = huntViewportTransform(width, height), camera = { left: 300, top: 800 }, world = { x: 510, y: 1000 };
    assert.deepEqual(huntViewportToWorld(huntWorldToViewport(world, camera, transform), camera, transform), world);
    const a = huntViewportToWorld({ x: width * .25, y: width * .25 }, camera, transform);
    const b = huntViewportToWorld({ x: width * .5, y: width * .25 }, camera, transform);
    assert.equal(huntWorldToNative({ x: b.x - a.x, y: b.y - a.y }).x, 64);
  }
  for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => huntViewportTransform(bad, 844));
});

test("the same native drag pans equally across phones without moving an actor", () => {
  const results = [];
  for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    const runtime = fixture();
    runtime.panCamera(-1e6, -1e6, width, height);
    const before = runtime.getPlayer(), pointer = adapter(runtime, width, height);
    pointer.down(event(width / 2, width / 2));
    pointer.move(event(width / 4, width / 4)); pointer.up(event(width / 4, width / 4));
    const camera = runtime.getCamera(width, height);
    results.push([camera.left, camera.top]);
    runtime.tick(16);
    assert.deepEqual(runtime.getPlayer(), before);
    assert.equal(runtime.getEnclosureStroke(), null);
  }
  assert.deepEqual(results, [[128, 128], [128, 128], [128, 128]]);
});

test("camera reaches all edges, reverses at a clamp and matches visible chunks", () => {
  const runtime = fixture();
  for (const [dx, dy] of [[-1e6, -1e6], [1e6, -1e6], [1e6, 1e6], [-1e6, 1e6]]) {
    runtime.panCamera(dx, dy, 390, 844);
    const camera = runtime.getCamera(390, 844);
    assert.equal(dx < 0 ? camera.left : camera.right, dx < 0 ? 0 : 2048);
    assert.equal(dy < 0 ? camera.top : camera.bottom, dy < 0 ? 0 : 2048);
    assert.ok(runtime.getVisibleChunks(390, 844).some((c) => c.leftPx <= camera.left && c.rightPx > camera.left && c.topPx <= camera.top && c.bottomPx > camera.top));
  }
  runtime.panCamera(10, -10, 390, 844);
  assert.equal(runtime.getCamera(390, 844).left, 10);
});

test("a target touch selects one ID and consumes its drag without submitting a tool", () => {
  const runtime = fixture(), target = runtime.getWildCreatures()[0], camera = runtime.getCamera(390, 844);
  const point = huntWorldToViewport({ x: target.worldX, y: target.worldY }, camera, huntViewportTransform(390, 844));
  const pointer = adapter(runtime, 390, 844);
  pointer.down(event(point.x, point.y)); pointer.move(event(point.x - 100, point.y - 100)); pointer.up(event(point.x, point.y));
  assert.equal(runtime.getSelectedWildId(), target.wildId);
  assert.deepEqual(runtime.getCamera(390, 844), camera);
  assert.equal(runtime.getEnclosureStroke(), null);
  assert.deepEqual(runtime.getWildCreatures()[0], target);
});

test("second pointers cannot steal, move, release or cancel the owner; cancel never submits", () => {
  let pans = 0, aborts = 0;
  const pointer = createHuntFieldPointer({
    getView: () => ({ camera: { left: 0, top: 0 }, transform: huntViewportTransform(390, 844), toWorldPoint: (point) => point }),
    intents: { selectWildAt: () => false, panCamera: () => pans++, abortEnclosureStroke: () => aborts++ }
  });
  assert.equal(pointer.down(event(10, 10)), true);
  assert.equal(pointer.down(event(20, 20, 2)), false);
  pointer.move(event(30, 30, 2)); pointer.up(event(30, 30, 2)); pointer.cancel(event(30, 30, 2));
  assert.equal(pointer.getOwner(), 1); assert.equal(pans, 0); assert.equal(aborts, 0);
  pointer.cancel(event(10, 10)); pointer.up(event(10, 10)); pointer.move(event(30, 30));
  assert.equal(pointer.getOwner(), null); assert.equal(pans, 0); assert.equal(aborts, 1);
  pointer.down(event(10, 10, 2)); pointer.cancel();
  assert.equal(pointer.getOwner(), null);
});
