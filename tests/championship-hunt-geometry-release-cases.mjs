// 2026-11-26 hunt refinement batch 5: three.js keeps a JS copy of every vertex and index array
// after uploading it (13-34 MB per hunt map that nothing reads again). Each map array now goes in
// its own upload callback, the moment its GL buffer exists. Bounds are made first.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { releaseGeometryCopiesOnUpload } from '../src/championship/presentation/vs2/huntThree/geometryRelease.mjs';

/** What WebGLAttributes does on first use: read the array, make the buffer, call the upload callback. */
const upload = (attribute) => { const bytes = attribute.array.byteLength; attribute.onUploadCallback(); return bytes; };
const plane = () => new THREE.PlaneGeometry(4, 2, 3, 3);

test('every attribute and the index drop their array on upload, and only then', () => {
  const geometry = plane(), root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  geometry.boundingBox = null; geometry.boundingSphere = null;
  const total = Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) + geometry.index.array.byteLength;
  const release = releaseGeometryCopiesOnUpload([root]);
  assert.deepEqual(release.diagnostics(), { geometries: 1, attributes: 4, pendingBytes: total, releasedBytes: 0 });
  // Bounds exist before any array goes, so culling never needs the positions again.
  assert.ok(geometry.boundingSphere && geometry.boundingSphere.radius > 2 && geometry.boundingBox);
  assert.ok(geometry.attributes.position.array, 'nothing is dropped before its upload');

  const positionBytes = upload(geometry.attributes.position);
  assert.equal(geometry.attributes.position.array, null);
  assert.ok(geometry.attributes.normal.array && geometry.attributes.uv.array && geometry.index.array, 'the others wait for their own upload');
  assert.equal(release.diagnostics().releasedBytes, positionBytes);
  assert.equal(geometry.attributes.position.count, 16, 'the draw count does not come from the array');

  upload(geometry.attributes.normal); upload(geometry.attributes.uv); upload(geometry.index);
  assert.deepEqual(release.diagnostics(), { geometries: 1, attributes: 4, pendingBytes: 0, releasedBytes: total });
  assert.equal(geometry.index.count, 54);
  // A second callback (three never does this) is harmless.
  geometry.index.onUploadCallback();
  assert.equal(release.diagnostics().releasedBytes, total);
  geometry.dispose();
});

test('shared geometry and shared attributes are hooked once; instanced batches are covered', () => {
  const geometry = plane(), root = new THREE.Group();
  const twin = new THREE.BufferGeometry();
  twin.setAttribute('position', geometry.attributes.position);          // the same attribute object in two geometries
  const batch = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 5);
  root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), new THREE.Mesh(twin, new THREE.MeshBasicMaterial()));
  const release = releaseGeometryCopiesOnUpload([root, batch, null, undefined]);
  const d = release.diagnostics();
  assert.equal(d.geometries, 2);
  assert.equal(d.attributes, 4, 'position, normal, uv, index: each once');
  assert.ok(batch.instanceMatrix.array, 'instance matrices are not geometry and stay');
  const matrixHook = batch.instanceMatrix.onUploadCallback;
  assert.equal(matrixHook, THREE.BufferAttribute.prototype.onUploadCallback);
});

test('an earlier upload callback still runs; morph geometry and interleaved data are left alone', () => {
  const geometry = plane(), root = new THREE.Group();
  let earlier = 0; geometry.attributes.uv.onUpload(() => { earlier++; });
  root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  releaseGeometryCopiesOnUpload([root]);
  upload(geometry.attributes.uv);
  assert.equal(earlier, 1);
  assert.equal(geometry.attributes.uv.array, null);

  const morph = plane(); morph.morphAttributes.position = [morph.attributes.position.clone()];
  const interleaved = new THREE.BufferGeometry(), buffer = new THREE.InterleavedBuffer(new Float32Array(18), 6);
  interleaved.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  interleaved.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  const other = new THREE.Group();
  other.add(new THREE.Mesh(morph, new THREE.MeshBasicMaterial()), new THREE.Mesh(interleaved, new THREE.MeshBasicMaterial()));
  const release = releaseGeometryCopiesOnUpload([other]);
  assert.deepEqual(release.diagnostics(), { geometries: 2, attributes: 0, pendingBytes: 0, releasedBytes: 0 });
  assert.equal(morph.attributes.position.onUploadCallback, THREE.BufferAttribute.prototype.onUploadCallback);
});

test('the hunt map hooks its loaded scene and tree batches before the first upload, and reports it', () => {
  const map = fs.readFileSync('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs', 'utf8');
  const hook = map.indexOf('geometryRelease=releaseGeometryCopiesOnUpload([gltf?.scene,...batches]);');
  const lease = map.indexOf('rendererLease=leaseHM02Renderer(');
  assert.ok(hook > 0 && lease > hook, 'hooked after loading, before the renderer is leased');
  assert.ok(map.indexOf('scene.add(batch)') < hook && map.indexOf('scene.add(gltf.scene)') < hook);
  assert.ok(map.includes('geometry:geometryRelease?.diagnostics()??null,'));
  // The map never needs the arrays again: a lost context or a retired renderer ends the Three map.
  assert.ok(map.includes("offLost=stage.onContextLost(()=>fail(new Error('HM02_CONTEXT_LOST_USE_2D')));"));
  assert.ok(map.includes('rendererLease=leaseHM02Renderer({THREE,app,onInvalidate:fail});'));
  // three calls the callback right after gl.bufferData, from its own local reference to the array.
  const three = fs.readFileSync('node_modules/three/src/renderers/webgl/WebGLAttributes.js', 'utf8');
  const create = three.slice(three.indexOf('function createBuffer('), three.indexOf('function updateBuffer('));
  assert.ok(create.indexOf('const array = attribute.array;') < create.indexOf('gl.bufferData( bufferType, array, usage );'));
  assert.ok(create.indexOf('gl.bufferData( bufferType, array, usage );') < create.indexOf('attribute.onUploadCallback();'));
  assert.ok(!create.slice(create.indexOf('attribute.onUploadCallback();')).includes('attribute.array'), 'nothing reads attribute.array after the callback');
});
