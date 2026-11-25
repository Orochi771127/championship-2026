// Owner 2026-11-25: hunt partners should look like they live in the map. The maps get a
// light layer of ambient life in their own 3D space (snow, fireflies, pollen, embers, dust),
// one bounded draw per map, off in saver quality and with reduced motion.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { HUNT_AMBIENT_MAX, huntAmbientKind, huntAmbientAllowed, createHuntAmbientLife, huntAmbientRandom } from '../src/championship/presentation/vs2/huntThree/ambientLife.mjs';

const doc = (dataset = {}, reduce = false) => ({ documentElement: { dataset }, defaultView: { matchMedia: () => ({ matches: reduce }) } });

test('every bound hunt map has a day layer, bounded in size', () => {
  for (const [key, map] of Object.entries(MAPS)) {
    for (const fieldId of map.fields) {
      const kind = huntAmbientKind(key, fieldId);
      if (fieldId.endsWith('_01')) assert.ok(kind, `${fieldId} day layer`);
      if (kind) assert.ok(kind.count > 0 && kind.count <= HUNT_AMBIENT_MAX, `${fieldId} count ${kind.count}`);
    }
  }
});

test('each map gets the life that fits it', () => {
  assert.equal(huntAmbientKind('hm13', 'field_hm13_01').name, 'snow');
  assert.equal(huntAmbientKind('hm13', 'field_hm13_02').name, 'snow');
  assert.equal(huntAmbientKind('hm03', 'field_hm03_01').name, 'pollen');
  assert.equal(huntAmbientKind('hm03', 'field_hm03_02').name, 'fireflies');
  assert.equal(huntAmbientKind('hm15', 'field_hm15_01').name, 'embers');
  assert.equal(huntAmbientKind('hm10', 'field_hm10_02'), null);
  assert.equal(huntAmbientKind('unknown', 'field_x_01'), null);
  const fireflies = huntAmbientKind('hm01', 'field_hm01_02');
  assert.ok(fireflies.additive && fireflies.round, 'fireflies glow');
});

test('off in saver quality and with reduced motion', () => {
  assert.equal(huntAmbientAllowed(doc()), true);
  assert.equal(huntAmbientAllowed(doc({ quality: 'saver' })), false);
  assert.equal(huntAmbientAllowed(doc({ motion: 'reduced' })), false);
  assert.equal(huntAmbientAllowed(doc({}, true)), false);
});

test('one Points draw that follows the camera, hides when not allowed, and cleans up', () => {
  const scene = new THREE.Scene();
  let reduced = false;
  const page = { documentElement: { dataset: {} }, defaultView: { matchMedia: () => ({ matches: reduced }) } };
  const life = createHuntAmbientLife({ THREE, scene, mapKey: 'hm13', fieldId: 'field_hm13_01', doc: page });
  const points = scene.children.find(child => child.isPoints);
  assert.ok(points, 'points added');
  assert.equal(points.geometry.getAttribute('aSeed').count, huntAmbientKind('hm13', 'field_hm13_01').count);
  assert.equal(points.material.depthTest, true, 'props in front hide it');
  assert.equal(points.material.depthWrite, false, 'never hides partners');
  life.update({ now: 2500, center: [3, 0, -4], halfWidth: 8, halfHeight: 6, pixelRatio: 2 });
  const u = points.material.uniforms;
  assert.equal(u.uTime.value, 2.5);
  assert.deepEqual(u.uCenter.value.toArray(), [3, 0, -4]);
  assert.ok(u.uRadius.value >= 8, 'covers the view');
  assert.equal(u.uSize.value, 4, 'pixel size follows the map scale');
  assert.equal(points.visible, true);
  reduced = true;
  life.update({ now: 2600, center: [3, 0, -4], halfWidth: 8, halfHeight: 6 });
  assert.equal(points.visible, false, 'reduced motion hides it');
  life.dispose();
  assert.equal(scene.children.includes(points), false);
});

test('the layer is the same on every visit', () => {
  const a = huntAmbientRandom(7), b = huntAmbientRandom(7);
  for (let i = 0; i < 20; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
  const none = createHuntAmbientLife({ THREE, scene: new THREE.Scene(), mapKey: 'hm10', fieldId: 'field_hm10_02' });
  assert.equal(none.kind, null);
  none.update({ now: 1, center: [0, 0, 0], halfWidth: 1, halfHeight: 1 });
});

test('the hunt map updates the layer every frame and disposes it', () => {
  const source = fs.readFileSync('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs', 'utf8');
  assert.match(source, /const ambientLife=createHuntAmbientLife\(\{THREE,scene,mapKey:manifest\.map\?\?'hm02',fieldId/);
  assert.match(source, /ambientLife\.update\(\{now,center,halfWidth,halfHeight/);
  assert.match(source, /cleanup\('ambient life',\(\)=>ambientLife\.dispose\(\)\)/);
  assert.match(source, /ambient:ambientLife\.diagnostics\(\)/);
});
