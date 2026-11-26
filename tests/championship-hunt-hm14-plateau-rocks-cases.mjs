// 2026-11-26 hunt refinement batch 6: the extension plateaus of hm14 裂岩地帶 were per-tile boxes
// with stair-stepped edges and only bushes on top. They are now rounded mesas built in Blender
// (smooth outline, steep wall with a round lip, flat top), and their tops carry copies of the
// original area's own boulders. Walkability does not change; only blocked tiles get new heights.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { projectionForManifest } from '../src/championship/presentation/vs2/huntThree/projection.mjs';
import { createNativeHuntEnvironment } from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import expansions from '../src/data/championship/catalogs/hunt-art-expansions-20261023.json' with { type: 'json' };
import rocks from '../scripts/data/hunt-hm14-plateau-rocks-20261126.json' with { type: 'json' };

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const map = MAPS.hm14, manifest = JSON.parse(fs.readFileSync(map.directory + map.manifest.file, 'utf8'));

test('hm14 binds the folder with rocks, and its bytes match the pinned hashes', () => {
  assert.ok(map.directory.endsWith('hm14-three-c4-20261126/'));
  assert.equal(sha(fs.readFileSync(map.directory + map.manifest.file)), map.manifest.sha256);
  const glb = fs.readFileSync(map.directory + manifest.glb.file);
  assert.equal(sha(glb), manifest.glb.sha256);
  assert.equal(glb.length, rocks.glbBytes);
  assert.equal(sha(fs.readFileSync(map.directory + manifest.groundHeights.file)), manifest.groundHeights.sha256);
  assert.ok(rocks.glbBytes < 7_000_000 && rocks.glbBytes - rocks.glbBytesBefore < 800_000);
  assert.ok(rocks.addedVertices <= 84_000, 'the rock budget');
  const heights = JSON.parse(fs.readFileSync(map.directory + manifest.groundHeights.file, 'utf8'));
  assert.match(heights.source, /rounded extension mesas/);
  assert.equal(heights.heights.length, 180 * 180);
});

test('the Blender mesas are lighter than the boxes they replace and still cover the blocked tiles', () => {
  const m = rocks.mesas;
  assert.ok(m.vertices < m.oldPlateauVertices, `${m.vertices} vertices replace ${m.oldPlateauVertices}`);
  assert.ok(m.triangles < 60_000);
  assert.ok(m.blockedPictureCovered >= 0.94, 'the mesas still draw over at least 94 % of the blocked tiles they stand for');
  assert.ok(m.pictureOutsideBlocked <= 0.05, 'and hardly reach over walkable ground');
  assert.ok(m.propsReseated > 0, 'what stood on the plateaus was set down on the new surface');
  // Walkable ground keeps its height exactly: the [x, y, height] rows of every open tile hash to the
  // digest taken from the ground heights before the mesas.
  const env = createNativeHuntEnvironment(expansions.environments.field_hm14_01);
  const heights = JSON.parse(fs.readFileSync(map.directory + manifest.groundHeights.file, 'utf8')).heights;
  const open = heights.filter(([x, y]) => !env.isBlocked(x, y));
  assert.equal(open.length, rocks.openGround.tiles);
  assert.equal(sha(JSON.stringify(open)), rocks.openGround.sha256, 'no walkable tile changed height');
});

test('every rock stands on a blocked tile of the extension, day and night', () => {
  assert.equal(rocks.rocks.length, rocks.rim + rocks.top);
  assert.ok(rocks.rim >= 120 && rocks.top >= 1);
  const projection = projectionForManifest(manifest);
  for (const fieldId of ['field_hm14_01', 'field_hm14_02']) {
    const env = createNativeHuntEnvironment(expansions.environments[fieldId]);
    for (const [x, z, radius, kind] of rocks.rocks) {
      assert.ok(kind === 'rim' || kind === 'top');
      assert.ok(radius > 0.2 && radius < 1.4, 'a boulder, not a cliff');
      const [sx, sy] = projection.screen([x, rocks.topHeight, z]);
      const tx = Math.floor(sx / 16), ty = Math.floor(sy / 16);
      assert.ok(tx >= 128 || ty >= 128, `${fieldId} rock at ${tx},${ty} is in the extension`);
      assert.ok(tx >= 0 && ty >= 0 && tx < 180 && ty < 180);
      assert.equal(env.isBlocked(tx, ty), true, `${fieldId} rock at ${tx},${ty} stands on a blocked tile`);
    }
  }
});

test('rocks keep their distance from each other', () => {
  const list = rocks.rocks;
  let close = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
    if (Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1]) < 1.2) close++;
  assert.equal(close, 0, 'no two rocks closer than 1.2 units');
});
