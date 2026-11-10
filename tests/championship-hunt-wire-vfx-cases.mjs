// HUNT_WIRE_VFX_20261111 (Owner: the hunt wires were 「一個很便宜的線」 too): a pixel steel cable with one
// look per native wire kind, a hum/pulse/strike when a partner meets it, a deploy shoot-out and an expiry flicker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUNT_WIRE_VFX, wireKind, wireTier, lightningPath } from '../src/championship/presentation/vs2/huntWireVfx.js';
import { createNativeHuntWire } from '../src/championship/hunt/capture/nativeHuntWire.js';

const read = (path) => readFileSync(path, 'utf8');
const Q = 4096;

test('each native wire item has its own look: standard steel, magnetic field, electric bolts', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(wireKind), ['BLOCK', 'BLOCK', 'BIND', 'BIND', 'DAMAGE', 'DAMAGE']);
  const glows = Object.values(HUNT_WIRE_VFX.kinds).map((k) => k.glow);
  assert.equal(new Set(glows).size, 3, 'three distinct colours');
  assert.ok(!glows.includes(HUNT_WIRE_VFX.invalid), 'the too-short preview colour is not a wire colour');
});

test('a lightning bolt starts and ends on the posts and stays within its amplitude', () => {
  let seed = 7; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bolt = lightningPath([0, 0], [100, 0], { segments: 10, amp: 6, random });
  assert.equal(bolt.length, 11);
  assert.deepEqual(bolt[0], { x: 0, y: 0 }); assert.deepEqual(bolt.at(-1), { x: 100, y: 0 });
  assert.ok(bolt.every((p) => Math.abs(p.y) <= 6 && Number.isInteger(p.x) && Number.isInteger(p.y)), 'pixel-snapped, inside the amplitude');
  assert.ok(bolt.some((p) => p.y !== 0), 'it is jagged');
});

test('the wire publishes its slot, time left and a short hit flag when a partner meets it; rules unchanged', () => {
  const host = { environment: { readTerrain: () => 0 }, actors: [], emit() {}, stopRope() {} };
  const wire = createNativeHuntWire(host, { consume: () => true, request() {} });
  assert.equal(wire.begin({ quantity: 1, nativeItemIndex: 0 }), true);
  wire.tick({ kind: 'WIRE', q12: [100 * Q, 100 * Q, 0] });
  wire.tick({ kind: 'WIRE', q12: [160 * Q, 140 * Q, 0], released: true });
  wire.tick(null);
  let [object] = wire.getObjects();
  assert.equal(object.state, 5); assert.equal(object.slot, 0); assert.equal(object.remaining, 600);
  assert.equal(object.hit, false); assert.equal(object.hitPoint, null);
  const mid = [(object.from[0] + object.to[0]) / 2, (object.from[1] + object.to[1]) / 2];
  const actor = { bounds: { rect: [-10, -20, 10, 0] }, speciesIndex: 0, positionQ12: [mid[0] * 2048, mid[1] * 2048, 0], currentHp: 10, maxHp: 10, aiState: 0 };
  const result = wire.collide(actor, actor.positionQ12);
  assert.equal(result.obstacle, 1, 'a standard wire still blocks');
  [object] = wire.getObjects();
  assert.equal(object.hit, true); assert.deepEqual(object.hitPoint, mid);
  for (let i = 0; i < 14; i++) wire.tick(null);
  [object] = wire.getObjects();
  assert.equal(object.hit, false, 'the hit flag fades after 14 ticks'); assert.equal(object.remaining, 586);
});

test('the hunt field draws wires through the VFX module, not a bare line', () => {
  const field = read('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  assert.match(field, /createHuntWireVfx\(\{ PIXI, layer: strokeLayer \}\)/);
  assert.match(field, /wireVfx\.update\(\{objects:view\.tools\.objects\?\?\[\]/);
  assert.match(field, /wireVfx\.destroy\(\)/);
  assert.match(field, /o\.kind==='WIRE'/);
});

test('a β wire runs as a twin cable; α is the single cable', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(wireTier), [0, 1, 0, 1, 0, 1]);
  assert.ok(HUNT_WIRE_VFX.twinGap > 0);
  const source = read('src/championship/presentation/vs2/huntWireVfx.js');
  assert.match(source, /twin: twin \? rope\(steel/);
  assert.match(source, /entry\.tier !== tier/, 'a wire laid with another tier is rebuilt');
});
