// Owner 2026-11-25 「我每一張地圖其實都要擴大」: hm08 南橋峽谷, the last 2048 hunt map, grows to
// 180x180 (2880) on 2026-11-26 from an original east/south canyon added to its authoring
// masters and re-baked day and night.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { validateExternalManifest } from '../src/championship/presentation/vs2/huntThree/externalMapAssets.mjs';
import { createNativeHuntEnvironment } from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import expansions from '../src/data/championship/catalogs/hunt-art-expansions-20261023.json' with { type: 'json' };
import scene from '../src/data/championship/catalogs/hunt-scene.r1.json' with { type: 'json' };

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const map = MAPS.hm08;
const manifestBytes = fs.readFileSync(map.directory + map.manifest.file);
const manifest = JSON.parse(manifestBytes);
const grid = fs.readFileSync('scripts/data/hunt-hm08-extension-grid-20261126.txt', 'utf8').split(/\r?\n/);

test('hm08 is bound at 2880 with pinned, geometry-only assets', () => {
  assert.equal(map.worldSize, 2880);
  assert.match(map.directory, /hm08-three-r2-20261126\/$/);
  assert.equal(manifestBytes.length, map.manifest.bytes);
  assert.equal(sha(manifestBytes), map.manifest.sha256);
  assert.deepEqual(manifest.projection.nativeSize, [1440, 1440]);
  assert.deepEqual(manifest.projection.worldSize, [2880, 2880]);
  assert.equal(manifest.projection.orthoScaleUnits, 90);
  const files = [manifest.glb, manifest.groundHeights, ...Object.values(manifest.fields).flatMap(f => f.frames.flatMap(fr => [fr, fr.mask]))];
  for (const asset of files) {
    const bytes = fs.readFileSync(map.directory + asset.file);
    assert.equal(bytes.length, asset.bytes, asset.file);
    assert.equal(sha(bytes), asset.sha256, asset.file);
  }
  for (const fieldId of map.fields) {
    const field = validateExternalManifest(manifest, fieldId);
    assert.equal(field.frames[0].width, 2880);
  }
  const glb = fs.readFileSync(map.directory + manifest.glb.file);
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  assert.deepEqual(gltf.extensionsRequired, ['KHR_draco_mesh_compression']);
  assert.ok(!gltf.materials?.length && !gltf.textures?.length && !gltf.images?.length);
  assert.ok(!fs.existsSync('assets/production/hunt/hm08-three-r1-20261022'), 'the 2048 assets are gone');
});

test('day and night keep the original 128 grid, and the appended tiles follow the design', () => {
  assert.equal(grid.length >= 180 && grid.every((row, y) => y >= 180 || row.length === 180), true);
  for (const fieldId of ['field_hm08_01', 'field_hm08_02']) {
    const env = createNativeHuntEnvironment(expansions.environments[fieldId]);
    const original = createNativeHuntEnvironment({ ...scene.environments[fieldId], base: { widthTiles: 128, heightTiles: 128, originTile: [0, 0] } });
    assert.equal(env.width, 180); assert.equal(env.height, 180);
    for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
      if (x < 128 && y < 128) assert.equal(env.readTerrain(x, y), original.readTerrain(x, y), `${fieldId} core ${x},${y}`);
      else assert.equal(env.readTerrain(x, y), grid[y][x] === '0' ? 0 : 1, `${fieldId} ext ${x},${y}`);
    }
    assert.equal(expansions.environments[fieldId].caveGroups?.[0]?.caves.length, 2, `${fieldId} keeps both caves`);
  }
});

test('every open tile of the new strips is reachable from the core, and stands at ground height 0', () => {
  const env = createNativeHuntEnvironment(expansions.environments.field_hm08_01);
  const open = (x, y) => x >= 0 && y >= 0 && x < 180 && y < 180 && !env.isBlocked(x, y);
  const seen = new Uint8Array(180 * 180), stack = [];
  for (let y = 0; y < 128 && !stack.length; y++) for (let x = 0; x < 128; x++) if (open(x, y) && open(x + 1, y) && open(x, y + 1)) { stack.push([x, y]); seen[y * 180 + x] = 1; break; }
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [u, v] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (open(u, v) && !seen[v * 180 + u]) { seen[v * 180 + u] = 1; stack.push([u, v]); }
  }
  const heights = JSON.parse(fs.readFileSync(map.directory + manifest.groundHeights.file, 'utf8'));
  assert.equal(heights.grid.length, 180); assert.equal(heights.summary.miss, 0);
  let extOpen = 0;
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
    if ((x < 128 && y < 128) || !open(x, y)) continue;
    extOpen++;
    assert.ok(seen[y * 180 + x], `ext ${x},${y} reachable`);
    assert.ok(Math.abs(heights.grid[y][x]) < 0.01, `ext ${x},${y} on the ground`);
  }
  assert.ok(extOpen > 9000, `${extOpen} open tiles in the new strips`);
});

test('the 2D fallback for hm08 is the same 2880 render', () => {
  const fallback = JSON.parse(fs.readFileSync('assets/production/hunt/three-fallback-20261023/manifest.json', 'utf8'));
  for (const fieldId of ['field_hm08_01', 'field_hm08_02']) {
    const row = fallback.fields.find(f => f.fieldId === fieldId);
    assert.ok(row, fieldId);
    assert.equal(row.worldWidthPx, 2880);
    const bytes = fs.readFileSync(row.frames[0].src);
    assert.equal(sha(bytes), row.frames[0].sha256);
  }
  const main = fs.readFileSync('src/championship/app/main.js', 'utf8');
  assert.match(main, /authoredFallback && authoredFallback !== 'hm01'/);
});
