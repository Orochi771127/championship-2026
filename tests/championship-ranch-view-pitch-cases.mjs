// Owner 2026-10-27 diorama camera: 35/40/45 pitch views over the unchanged
// 52-degree world. The Three camera, the Pixi screen mapping and picking must
// agree exactly at every pitch, and the plinth must stay under the walk plane.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.module.js';
import { ranchViewProjection, ranchNativeToWorld, ranchPickWalkSurface, RANCH_ELEVATION, RANCH_VIEW_PITCHES, RANCH_LAYOUT_VIEW, RANCH_DEFAULT_VIEW_PITCH } from '../src/championship/presentation/ranchThreeCoordinates.js';
import { projectedContactIntersections } from '../src/championship/presentation/ranchContactHeight.js';
import { raisingNativeToScreen, raisingScreenToNative, raisingFieldViewport } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
import { ranchPlinthOutline } from '../src/championship/presentation/ranchPlinth.js';

const field = (pitch) => ({ worldWidthPx: 2352, worldHeightPx: 2136, nativePixelWorldScale: 1, presentationMode: 'NATIVE_RANCH',
  productGrid: { sizingHeightNative: 192 }, wrapWidthPx: null, view: ranchViewProjection(pitch) });
const viewport = { width: 1366, height: 768, scrollY: 0 };

test('40 is the Owner-locked camera; 52 stays the layout identity', () => {
  assert.equal(RANCH_DEFAULT_VIEW_PITCH, 40);
  assert.equal(ranchViewProjection().pitch, 40);
  assert.equal(ranchViewProjection(41).pitch, 40);
  assert.equal(RANCH_LAYOUT_VIEW.pitch, 52);
  assert.equal(RANCH_LAYOUT_VIEW.groundScaleY, 1);
  assert.equal(RANCH_LAYOUT_VIEW.lift, 16 * Math.cos(RANCH_ELEVATION));
  assert.deepEqual(RANCH_VIEW_PITCHES, [35, 40, 45, 52]);
});

for (const pitch of RANCH_VIEW_PITCHES) {
  test(`pitch ${pitch}: Three camera, Pixi mapping and picking agree`, () => {
    const view = ranchViewProjection(pitch), f = field(pitch), fit = raisingFieldViewport(f, viewport, 12, 300);
    const pixelScale = fit.scale;
    assert.ok(Math.abs(fit.scaleY - pixelScale * view.groundScaleY) < 1e-12);
    // The scene's own camera set-up (ranchThreeScene render()).
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 600);
    camera.up.set(...view.up);
    const direction = new THREE.Vector3(...view.direction);
    const width = viewport.width, height = viewport.height;
    const center = ranchNativeToWorld((width / 2 - fit.x) / pixelScale, (height / 2 - fit.y) / (pixelScale * view.groundScaleY));
    camera.left = -width / (32 * pixelScale); camera.right = -camera.left; camera.top = height / (32 * pixelScale); camera.bottom = -camera.top;
    camera.position.set(center.x, center.y, center.z).addScaledVector(direction, 200);
    camera.lookAt(center.x, center.y, center.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const [nx, ny, h] of [[400, 700, 0], [520, 760, 0], [610, 820, 1.5], [455, 905, 3]]) {
      const ground = raisingNativeToScreen([nx * 4096, ny * 4096, 0], f, viewport, 300);
      const expected = { x: ground.x, y: ground.y - h * view.screenLift * pixelScale };
      const w = ranchNativeToWorld(nx, ny, h), p = new THREE.Vector3(w.x, w.y, w.z).project(camera);
      const screen = { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
      assert.ok(Math.hypot(screen.x - expected.x, screen.y - expected.y) < 1e-6, `${pitch} ${nx},${ny},${h}`);
      // Screen -> native (view-equivalent) -> walk surface at that height.
      const native = raisingScreenToNative(expected, f, viewport, 300);
      const flat = [[[nx - 50, ny - 50, h], [nx + 50, ny - 50, h], [nx, ny + 50, h]]];
      const picked = ranchPickWalkSurface(native.x, native.y, flat, view.lift);
      assert.ok(Math.abs(picked.x - nx) < 1e-9 && Math.abs(picked.y - ny) < 1e-6 && Math.abs(picked.height - h) < 1e-9, `${pitch} pick`);
    }
  });
  test(`pitch ${pitch}: contact rays use the view's lift and depth`, () => {
    const view = ranchViewProjection(pitch), h = 2;
    const a = ranchNativeToWorld(100, 100, h), b = ranchNativeToWorld(200, 100, h), c = ranchNativeToWorld(150, 200, h);
    const triangle = { vertices: [[a.x, h, a.z], [b.x, h, b.z], [c.x, h, c.z]] };
    const [hit] = projectedContactIntersections([triangle], 150, 140 - h * view.lift, view);
    assert.ok(hit && Math.abs(hit.y - 140) < 1e-9 && Math.abs(hit.height - h) < 1e-12);
    const w = ranchNativeToWorld(150, 140, h);
    assert.ok(Math.abs(hit.rayDepth - (w.x * view.direction[0] + w.y * view.direction[1] + w.z * view.direction[2])) < 1e-9);
  });
}

test('plinth outline: outer edges only, shared edges stay open', () => {
  const single = (slotIndex, ownerIndex = 0, fieldId = 'field_cm29_01') => ({ ownerIndex, moduleId: 'championship:2026:cage:0', slotIndex, fieldId });
  const one = ranchPlinthOutline([single(226)]);
  assert.equal(one.cells.length, 1);
  assert.equal(one.edges.length, 6);
  assert.ok(one.edges.every((e) => e.lid));
  // Two neighbours share one edge: 12 - 2 outer edges remain.
  assert.equal(ranchPlinthOutline([single(226), single(227, 1, 'field_cm01_01')]).edges.length, 10);
  // One three-cell cage (226, 251, 227): three inner edges, 18 - 6 outer.
  const cage = ranchPlinthOutline([{ ownerIndex: 0, moduleId: 'championship:2026:cage:1', slotIndex: 226, fieldId: 'field_cm01_01' }]);
  assert.equal(cage.cells.length, 3);
  assert.equal(cage.edges.length, 12);
  assert.ok(cage.edges.every((e) => !e.lid));
});
