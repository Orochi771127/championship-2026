// Owner 2026-11-25: hunt partners should look like they live in the map. Batch B: they
// touch the ground they stand on, following the native tile kind and the map's biome.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHuntGroundContact, huntGroundKind, huntWaterlinePx, huntWaterTint, HUNT_GROUND_CONTACT } from '../src/championship/presentation/vs2/huntThree/groundContact.mjs';
import { createMapProjection } from '../src/championship/presentation/vs2/huntThree/projection.mjs';

const map = createMapProjection({ kind: 'BLENDER_LOCKED_ORTHOGRAPHIC', elevationDegrees: 52, azimuthDegrees: 45, nativePxPerUnit: 16, worldPxPerNativePx: 2,
  cameraForwardGltf: [-0.43533840411808733, -0.788010753606722, -0.43533840411808733], cameraUpGltf: [-0.5572077475232349, 0.6156614753256583, -0.5572077475232349],
  worldSize: [2880, 2880], nativeSize: [1440, 1440], orthoScaleUnits: 90 });
const quad = [[-12, -30], [-12, 0], [12, 0], [12, -30]];
const partner = () => ({ material: new THREE.MeshBasicMaterial({ map: new THREE.Texture() }) });

test('ground kind follows the native tile, then the map biome', () => {
  assert.equal(huntGroundKind(2, 'hm16'), 'water');
  assert.equal(huntGroundKind(3, 'hm13'), 'ice');
  assert.equal(huntGroundKind(0, 'hm16'), 'sand');
  assert.equal(huntGroundKind(0, 'hm13'), 'snow');
  assert.equal(huntGroundKind(0, 'hm10'), null);
  assert.equal(huntGroundKind(1, 'hm01'), null);
  assert.equal(huntGroundKind(null, 'hm01'), null);
});

test('waterline scales with small drawings and caps for large ones', () => {
  assert.equal(huntWaterlinePx(10), 3);
  assert.ok(Math.abs(huntWaterlinePx(20) - 5.6) < 1e-9);
  assert.equal(huntWaterlinePx(200), HUNT_GROUND_CONTACT.waterDepthPx);
  assert.notEqual(huntWaterTint('hm11'), huntWaterTint('hm06'));
});

test('wading sets the partner waterline; leaving the water clears it; a jump clears it', () => {
  const scene = new THREE.Scene(), gc = createHuntGroundContact({ THREE, scene, map, mapKey: 'hm05' });
  const actor = partner(); actor.material.userData.hmWater = { value: 0 };
  const wild = { worldX: 500, worldY: 500, worldZ: 0 };
  gc.update('a', { wild, kind: 'water', actor, quad, groundHeight: 0, visible: true, now: 0 });
  assert.ok(Math.abs(actor.material.userData.hmWater.value - huntWaterlinePx(30)) < 1e-9);
  gc.update('a', { wild: { ...wild, worldZ: 6 }, kind: 'water', actor, quad, groundHeight: 0, visible: true, now: 16 });
  assert.equal(actor.material.userData.hmWater.value, 0);
  gc.update('a', { wild, kind: null, actor, quad, groundHeight: 0, visible: true, now: 32 });
  assert.equal(actor.material.userData.hmWater.value, 0);
  gc.dispose();
});

test('ice mirrors the current drawing below the feet and hides off the ice', () => {
  const scene = new THREE.Scene(), gc = createHuntGroundContact({ THREE, scene, map, mapKey: 'hm13' });
  const actor = partner(), wild = { worldX: 800, worldY: 800 };
  gc.update('b', { wild, kind: 'ice', actor, quad, groundHeight: 0, visible: true, now: 0 });
  assert.equal(gc.diagnostics().reflections, 1);
  const mirror = scene.children.find(o => o.material?.map === actor.material.map);
  assert.ok(mirror, 'reflection shares the partner drawing');
  const ys = Array.from({ length: 4 }, (_, i) => mirror.geometry.attributes.position.getY(i));
  assert.ok(ys.every(y => Math.abs(y - 0.003) < 1e-9), 'lies on the ice');
  gc.update('b', { wild, kind: 'snow', actor, quad, groundHeight: 0, visible: true, now: 16 });
  assert.equal(gc.diagnostics().reflections, 0);
  gc.remove('b');
  assert.equal(scene.children.length, 0);
  gc.dispose();
});

test('sand prints follow travel, fade out, and are capped', () => {
  const scene = new THREE.Scene(), gc = createHuntGroundContact({ THREE, scene, map, mapKey: 'hm16' });
  const actor = partner();
  for (let i = 0; i <= 40; i++) gc.update('c', { wild: { worldX: 100 + i * 10, worldY: 300 }, kind: 'sand', actor, quad, groundHeight: 0, visible: true, now: i * 50 });
  assert.equal(gc.diagnostics().prints, HUNT_GROUND_CONTACT.printMax);
  gc.update('c', { wild: { worldX: 500, worldY: 300 }, kind: 'sand', actor, quad, groundHeight: 0, visible: true, now: 40 * 50 + HUNT_GROUND_CONTACT.printLifeMs + 1 });
  assert.equal(gc.diagnostics().prints, 0, 'all prints faded');
  gc.dispose();
  assert.equal(scene.children.length, 0);
});

test('grass tufts grow only on grass tiles of the map art, not on its dirt paths', async () => {
  const { huntGrassTile, HUNT_GRASS_TILE_BITS } = await import('../src/championship/presentation/vs2/huntThree/grassTiles.mjs');
  assert.deepEqual(Object.keys(HUNT_GRASS_TILE_BITS).sort(), ['hm01', 'hm02', 'hm03', 'hm04']);
  for (const key of Object.keys(HUNT_GRASS_TILE_BITS)) {
    let n = 0; for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) n += huntGrassTile(key, x, y);
    assert.ok(n > 15000 && n < 32400, `${key} grass tiles ${n}`);
  }
  assert.equal(huntGrassTile('hm10', 5, 5), false);
  assert.equal(huntGrassTile('hm01', 200, 5), false);
  // A tile is grass or not; the kind follows it.
  let grass = null, bare = null;
  for (let y = 0; y < 180 && !(grass && bare); y++) for (let x = 0; x < 180; x++) { if (huntGrassTile('hm01', x, y)) grass ??= [x, y]; else bare ??= [x, y]; }
  assert.equal(huntGroundKind(0, 'hm01', grass[0] * 16 + 8, grass[1] * 16 + 8), 'grass');
  assert.equal(huntGroundKind(0, 'hm01', bare[0] * 16 + 8, bare[1] * 16 + 8), null);
  assert.equal(huntGroundKind(0, 'hm01'), null, 'no position, no tuft');
});
