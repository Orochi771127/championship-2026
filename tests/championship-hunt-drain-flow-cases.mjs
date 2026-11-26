// 2026-11-26: the factory (hm10) and sewer (hm11) drain outlets run. An original procedural
// flow replaces the delivered "drain phase" GLBs, which are reconstructed reference pixels
// and must stay out of the product.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { projectionForManifest } from '../src/championship/presentation/vs2/huntThree/projection.mjs';
import { DRAIN_STREAMS, drainFlowGeometry, createHuntDrainFlow } from '../src/championship/presentation/vs2/huntThree/drainFlow.mjs';

const manifest = (key) => JSON.parse(fs.readFileSync(MAPS[key].directory + MAPS[key].manifest.file, 'utf8'));

test('only the factory and sewer outlets run, and every ribbon goes down the screen', () => {
  assert.deepEqual(Object.keys(DRAIN_STREAMS).sort(), ['hm10', 'hm11']);
  for (const [key, streams] of Object.entries(DRAIN_STREAMS)) {
    assert.ok(streams.length >= 3, key);
    for (const ribbon of streams) {
      assert.ok(ribbon.length >= 2, key);
      for (let i = 1; i < ribbon.length; i++) assert.ok(ribbon[i][1] > ribbon[i - 1][1], `${key} ribbon runs downward`);
      for (const [x, y, h, w] of ribbon) assert.ok(x >= 0 && x <= 2880 && y >= 0 && y <= 2880 && h >= 0 && w > 0, key);
    }
  }
});

test('the flow lies on the drawn ribbon: each vertex projects back to its screen spot', () => {
  for (const key of ['hm10', 'hm11']) {
    const map = projectionForManifest(manifest(key));
    const g = drainFlowGeometry(map, DRAIN_STREAMS[key]);
    let v = 0;
    for (const ribbon of DRAIN_STREAMS[key]) for (const [x, y, , w] of ribbon) for (const side of [-0.5, 0.5]) {
      const [sx, sy] = map.screen(g.position.slice(v * 3, v * 3 + 3));
      assert.ok(Math.abs(sx - (x + side * w)) < 1e-6 && Math.abs(sy - y) < 1, `${key} vertex ${v} (${sx}, ${sy})`);
      v++;
    }
    assert.equal(g.index.length, DRAIN_STREAMS[key].reduce((n, r) => n + (r.length - 1) * 6, 0));
  }
});

test('one mesh, drawn over the ribbon without hiding partners, gone with reduced motion, disposed', () => {
  const scene = new THREE.Scene();
  let reduced = false;
  const page = { documentElement: { dataset: {} }, defaultView: { matchMedia: () => ({ matches: reduced }) } };
  const flow = createHuntDrainFlow({ THREE, scene, map: projectionForManifest(manifest('hm11')), mapKey: 'hm11', doc: page });
  const mesh = scene.children.find(child => child.isMesh);
  assert.equal(flow.count, 4);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.material.polygonOffset, true);
  flow.update({ now: 1500 });
  assert.equal(mesh.material.uniforms.uTime.value, 1.5);
  assert.equal(mesh.visible, true);
  reduced = true;
  flow.update({ now: 1600 });
  assert.equal(mesh.visible, false);
  flow.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(createHuntDrainFlow({ THREE, scene, map: null, mapKey: 'hm13' }).count, 0);
});

test('no reference-derived drain phase art is published or referenced', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of walk('assets/production/hunt')) assert.doesNotMatch(path.basename(file), /drain-phase/i, file);
  for (const file of walk('src/championship/presentation/vs2/huntThree')) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /drain-phase-\d\.glb|native-drain-phase/, file);
  const source = fs.readFileSync('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs', 'utf8');
  assert.match(source, /const drainFlow=createHuntDrainFlow\(\{THREE,scene,map,mapKey:manifest\.map\?\?'hm02'\}\)/);
  assert.match(source, /drainFlow\.update\(\{now\}\)/);
  assert.match(source, /cleanup\('drain flow',\(\)=>drainFlow\.dispose\(\)\)/);
});
