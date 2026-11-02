// Owner 2026-11-02 "floating islands over a data sea": a beach's own water pours over
// the free outer edges it reaches; the ranch ambience is the data sea far below.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import { ranchWaterfallSpans, createRanchWaterfalls, RANCH_WATERFALL } from '../src/championship/presentation/ranchWaterfalls.js';
import { createRanchPlinth, ranchPlinthOutline, RANCH_PLINTH } from '../src/championship/presentation/ranchPlinth.js';
import { ranchNativeToWorld } from '../src/championship/presentation/ranchThreeCoordinates.js';

const v = (x, z) => new THREE.Vector3(x, 0, z);
const edge = { a: v(0, 0), b: v(4, 0), out: v(0, 1), depth: RANCH_PLINTH.depth };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('water that runs along a free outer edge becomes a span; inland, across or tiny water does not', () => {
  const [span, ...rest] = ranchWaterfallSpans([edge], [{ a: { x: 1, z: 0.05 }, b: { x: 3, z: 0.05 } }]);
  assert.equal(rest.length, 0);
  assert.ok(near(span.a.x, 1) && near(span.b.x, 3) && span.out.z === 1 && span.depth === RANCH_PLINTH.depth);
  assert.equal(ranchWaterfallSpans([edge], [{ a: { x: 1, z: 1 }, b: { x: 3, z: 1 } }]).length, 0);
  assert.equal(ranchWaterfallSpans([edge], [{ a: { x: 1, z: 0 }, b: { x: 1.2, z: 2 } }]).length, 0);
  assert.equal(ranchWaterfallSpans([edge], [{ a: { x: 1, z: 0 }, b: { x: 1 + RANCH_WATERFALL.minLength / 2, z: 0 } }]).length, 0);
  // An edge facing away from the fixed camera gets no fall (only its lip would show).
  assert.equal(ranchWaterfallSpans([edge], [{ a: { x: 1, z: 0 }, b: { x: 3, z: 0 } }], { facing: v(0, -1) }).length, 0);
  assert.equal(ranchWaterfallSpans([edge], [{ a: { x: 1, z: 0 }, b: { x: 3, z: 0 } }], { facing: v(0.9, 0.2) }).length, 1);
  const merged = ranchWaterfallSpans([edge], [{ a: { x: -1, z: 0 }, b: { x: 2, z: 0 } }, { a: { x: 2.05, z: 0 }, b: { x: 6, z: 0 } }]);
  assert.equal(merged.length, 1);
  assert.ok(near(merged[0].a.x, 0) && near(merged[0].b.x, 4));
});

test('one merged mesh: pours from the lip, down the cliff, then falls free; never pickable', () => {
  const spans = ranchWaterfallSpans([edge, { ...edge, a: v(0, 5), b: v(4, 5) }], [{ a: { x: 0, z: 0 }, b: { x: 4, z: 0 } }, { a: { x: 0, z: 5 }, b: { x: 4, z: 5 } }]);
  const falls = createRanchWaterfalls(spans, { bevel: RANCH_PLINTH.bevel });
  assert.equal(falls.spans, 2);
  assert.equal(createRanchWaterfalls([], { bevel: RANCH_PLINTH.bevel }), null);
  const y = falls.mesh.geometry.getAttribute('position').array.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...y) <= RANCH_WATERFALL.lip + 1e-5);
  assert.ok(Math.min(...y) <= -(RANCH_PLINTH.depth + RANCH_WATERFALL.fall) + 1e-5);   // float32 positions
  const material = falls.mesh.material;
  assert.ok(material.transparent && !material.depthWrite);
  const hits = []; falls.mesh.raycast(new THREE.Raycaster(), hits); assert.equal(hits.length, 0);
  falls.animate(2.5); assert.equal(material.uniforms.uTime.value, 2.5);
  falls.dispose();
});

test('plinth: no water, no waterfall; a cage whose water reaches its outer edge gets one', () => {
  const cage = { ownerIndex: 0, moduleId: 'championship:2026:cage:1', slotIndex: 226, fieldId: 'field_cm01_01' };
  const dry = createRanchPlinth({ placements: [cage], towardSun: [-15, 35, 8] });
  assert.equal(dry.waterfalls, 0);
  const [outer] = ranchPlinthOutline([cage]).edges;
  const a = ranchNativeToWorld(...outer.a), b = ranchNativeToWorld(...outer.b);
  const wet = createRanchPlinth({ placements: [cage], towardSun: [-15, 35, 8], water: [{ a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z } }] });
  assert.equal(wet.waterfalls, 1);
  assert.ok(wet.group.getObjectByName('ranch-waterfalls'));
  wet.animate(1); wet.dispose(); dry.dispose();
});

test('the ranch ambience is the data sea: sideways glints that twinkle, a teal glow from below', () => {
  const layer = fs.readFileSync(new URL('../src/championship/app/ui/ambienceLayer.js', import.meta.url), 'utf8');
  assert.match(layer, /datasea: \{[^}]*drift: \[6, 16\][^}]*twinkle: true \}/);
  assert.match(layer, /p\.x \+= p\.vx \* dt;/);
  const main = fs.readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
  assert.match(main, /mountAmbience\(host, \{ theme: 'datasea' \}\)/);
  const css = fs.readFileSync(new URL('../src/championship/app/ui/screenLayout.css', import.meta.url), 'utf8');
  assert.match(css, /\.cm-ambience\[data-theme="datasea"\]::after \{ background: [^}]*rgba\(40, 205, 230, 0\.34\)/);
});

test('lava, icy water and sand pour only from the exact GLB they were measured on', async () => {
  const { ranchCageFalls, RANCH_CAGE_FALLS, RANCH_FALL_KINDS } = await import('../src/championship/presentation/ranchWaterfalls.js');
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/production/cage/three-20261021/manifest.json', import.meta.url), 'utf8'));
  const kinds = {};
  for (const [fieldId, entry] of Object.entries(RANCH_CAGE_FALLS)) {
    const row = manifest.fields.find((f) => f.fieldId === fieldId);
    assert.equal(entry.sha256, row.sha256, `${fieldId} falls were measured on another GLB`);
    const falls = ranchCageFalls(fieldId, row.sha256);
    assert.ok(falls.length > 0 && falls.every((f) => f.edge.length === 4 && f.edge.every(Number.isFinite)));
    kinds[fieldId] = falls[0].kind;
    assert.deepEqual(ranchCageFalls(fieldId, '0'.repeat(64)), []);
  }
  assert.deepEqual(kinds, { field_cm07_01: 'lava', field_cm35_01: 'lava', field_cm21_01: 'icewater', field_cm20_01: 'sand' });
  assert.deepEqual(Object.keys(RANCH_FALL_KINDS), ['water', 'lava', 'icewater', 'sand']);
  // Spans keep their kind; falls of different kinds never merge into one.
  const spans = ranchWaterfallSpans([edge], [{ a: { x: 0, z: 0 }, b: { x: 2, z: 0 }, kind: 'lava' }, { a: { x: 2, z: 0 }, b: { x: 4, z: 0 }, kind: 'sand' }]);
  assert.deepEqual(spans.map((s) => s.kind).sort(), ['lava', 'sand']);
});

test('beach seam strips cover their own side of each joined edge in one mesh of the cage material, reaching 2 cm across', async () => {
  const { createRanchWaterSeam } = await import('../src/championship/presentation/ranchWaterfalls.js');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([.25, .5, .25, .5, .25, .5], 2));
  geometry.setAttribute('_coast_water', new THREE.Float32BufferAttribute([1, 1, 1], 1));
  const material = new THREE.MeshStandardMaterial();
  const cage = new THREE.Group(); cage.add(new THREE.Mesh(geometry, material));
  const seams = [{ edge: { a: { x: 0, z: 0 }, b: { x: 4, z: 0 } }, inside: { x: 2, z: 3 } }, { edge: { a: { x: 4, z: 0 }, b: { x: 4, z: 4 } }, inside: { x: 2, z: 2 } }];
  const seam = createRanchWaterSeam(cage, seams);
  assert.equal(seam.material, material);                       // one mesh, the cage's own material
  const p = seam.geometry.getAttribute('position').array;
  assert.equal(p.length, 2 * 4 * 3);
  const zs = [p[2], p[5], p[8], p[11]].map((z) => +z.toFixed(4)).sort((a, b) => a - b);
  assert.deepEqual(zs, [-.02, -.02, .1, .1]);                   // inside its own cell, 2 cm across the edge
  const xs = [p[12], p[15], p[18], p[21]].map((x) => +x.toFixed(4)).sort((a, b) => a - b);
  assert.deepEqual(xs, [3.9, 3.9, 4.02, 4.02]);
  const hits = []; seam.raycast(new THREE.Raycaster(), hits); assert.equal(hits.length, 0);
  const dry = new THREE.Group(); dry.add(new THREE.Mesh(new THREE.BufferGeometry(), material));
  assert.equal(createRanchWaterSeam(dry, seams), null);
});

test('one type at one height is one map: no border in the ranch or the facility editor (Owner 2026-11-02)', () => {
  const scene = fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js', import.meta.url), 'utf8');
  assert.match(scene, /const joined=b=>b\.merged\|\|isOpen\(b\);/);
  assert.match(scene, /closed:all\.filter\(b=>!joined\(b\)\)/);
  assert.match(scene, /open:all\.filter\(isOpen\)/);          // walking still follows the walk rule
  const editor = fs.readFileSync(new URL('../src/championship/app/hexWorldEditor.js', import.meta.url), 'utf8');
  assert.match(editor, /passages\.closed\.filter\(c => c\.reason === 'NO_SAFE_EXIT'\)/);
  assert.match(editor, /if \(open\.has\(edge\.id\) \|\| joined\.has\(edge\.id\)\) continue;/);
  assert.match(editor, /if \(joined\.has\(e\.id\)\) continue;/);
});
