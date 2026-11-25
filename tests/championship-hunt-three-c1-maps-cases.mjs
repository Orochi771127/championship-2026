// HM10/HM11/HM13/HM14 3D hunt maps: field mapping, hash chain and loader admission.
// Owner 2026-11-25 「我每一張地圖其實都要擴大」: like the other eleven maps they now play
// on 180x180 fields (2880 world) with the untrimmed candidate geometry (c2). On 2026-11-26
// hm10/hm13 (c3) dress their extension areas with their own props, which block their tiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS, huntThreeProductionRequest } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { ORIGINAL_HUNT_FIELD_BINDINGS } from '../src/championship/gate/originalHuntFieldBindings.js';
import { createNativeHuntEnvironment } from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import expansions from '../src/data/championship/catalogs/hunt-art-expansions-20261023.json' with { type: 'json' };
import scene from '../src/data/championship/catalogs/hunt-scene.r1.json' with { type: 'json' };
import propBlocks from '../scripts/data/hunt-extension-prop-blocks-20261126.json' with { type: 'json' };

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const loopback = new URL('http://127.0.0.1:8732/championship.html');
const EXPECTED = {
  hm10: { fields: ['field_hm10_01'], biome: 'Factory' },
  hm11: { fields: ['field_hm11_01'], biome: 'Sewer' },
  hm13: { fields: ['field_hm13_01', 'field_hm13_02'], biome: 'Ice' },
  hm14: { fields: ['field_hm14_01', 'field_hm14_02'], biome: 'Crag' },
};

test('the four maps bind every native day/night field of their gate at the expanded 2880 world', () => {
  for (const [key, want] of Object.entries(EXPECTED)) {
    const map = MAPS[key];
    assert.ok(map, key);
    assert.deepEqual(map.fields, want.fields);
    assert.equal(map.worldSize, 2880);
    assert.match(map.directory, /-three-(c2-20261125|c3-20261126)\/$/);
    assert.equal(map.appearanceApproved, true);
    const gate = ORIGINAL_HUNT_FIELD_BINDINGS[want.biome];
    assert.ok(gate, want.biome);
    assert.deepEqual([...new Set([gate.dayFieldId, gate.nightFieldId])].sort(), [...want.fields].sort());
    for (const fieldId of want.fields) assert.equal(huntThreeProductionRequest(loopback, fieldId)?.key, key);
  }
});

test('manifest, GLB and ground-height bytes match their pinned hashes', () => {
  for (const key of Object.keys(EXPECTED)) {
    const map = MAPS[key];
    const raw = fs.readFileSync(map.directory + map.manifest.file);
    assert.equal(raw.length, map.manifest.bytes, key);
    assert.equal(sha(raw), map.manifest.sha256, key);
    const manifest = JSON.parse(raw);
    assert.equal(manifest.schema, 'HUNT_AUTHORED_MAP.v1');
    assert.equal(manifest.map, key);
    assert.deepEqual(manifest.fields, map.fields);
    for (const asset of [manifest.glb, manifest.groundHeights].filter(Boolean)) {
      const bytes = fs.readFileSync(map.directory + asset.file);
      assert.equal(bytes.length, asset.bytes, key + ' ' + asset.file);
      assert.equal(sha(bytes), asset.sha256, key + ' ' + asset.file);
    }
    assert.ok(manifest.groundHeights || (Number.isFinite(manifest.flatSupport?.height) && Array.isArray(manifest.flatSupport.exclusions)), key);
    if (manifest.groundHeights) {
      const grid = JSON.parse(fs.readFileSync(map.directory + manifest.groundHeights.file, 'utf8'));
      assert.equal(grid.width, 180); assert.equal(grid.height, 180); assert.equal(grid.tileSize, 16);
      assert.equal(grid.heights.length, 180 * 180);
      assert.ok(grid.heights.every(([x, y, h]) => [x, y, h].every(Number.isFinite)));
    }
  }
});

test('GLBs are Draco geometry with no external resources, and the authored loader admits all four', () => {
  for (const key of Object.keys(EXPECTED)) {
    const map = MAPS[key];
    const manifest = JSON.parse(fs.readFileSync(map.directory + map.manifest.file));
    const glb = fs.readFileSync(map.directory + manifest.glb.file);
    assert.equal(glb.readUInt32LE(0), 0x46546c67, key);
    const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    assert.ok(gltf.extensionsUsed.includes('KHR_draco_mesh_compression'), key);
    assert.ok(gltf.meshes.length > 0 && gltf.nodes.length > 0, key);
    assert.ok((gltf.images ?? []).every((image) => Number.isInteger(image.bufferView) && !image.uri), key);
    assert.ok((gltf.buffers ?? []).every((buffer) => !buffer.uri), key);
  }
  const loader = fs.readFileSync('src/championship/presentation/vs2/huntThree/authoredMapAssets.mjs', 'utf8');
  const admitted = loader.match(/\[('hm02'[^\]]+)\]\.includes\(manifest\.map\)/)[1];
  for (const key of Object.keys(EXPECTED)) assert.ok(admitted.includes(`'${key}'`), key);
});

test('the hunt canvas reports whether Three is drawing, so a silent 2D fallback is observable', () => {
  const source = fs.readFileSync('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js', 'utf8');
  assert.match(source, /app\.canvas\.dataset\.huntThree = active \? "active" : "fallback"/);
});

test('every expanded field keeps its original 128 grid, and the four new maps expand both day and night', () => {
  // (hm01's 2026-10-19 redesign opened a few old-edge wall tiles, so this holds for the four only.)
  for (const fieldId of ['field_hm10_01', 'field_hm11_01', 'field_hm13_01', 'field_hm13_02', 'field_hm14_01', 'field_hm14_02']) {
    const data = expansions.environments[fieldId];
    assert.ok(data, fieldId);
    const expanded = createNativeHuntEnvironment(data), original = createNativeHuntEnvironment(scene.environments[fieldId]);
    assert.equal(expanded.width, 180, fieldId); assert.equal(expanded.height, 180, fieldId);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++)
      assert.equal(expanded.readTerrain(x, y), original.readTerrain(x, y), `${fieldId} terrain ${x},${y}`);
  }
});

test('no expanded field lets a creature escape at the old 2048 edge where the ground continues', () => {
  // 2026-11-25: hm14-hm18 kept the native "escape off the map" cells on x=127 / y=127,
  // so a fleeing creature mid-map was teleported as if it had reached the edge.
  for (const [fieldId, data] of Object.entries(expansions.environments)) {
    const env = createNativeHuntEnvironment(data), bad = [];
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      if (!(x === 127 || y === 127) || env.isBlocked(x, y)) continue;
      const cell = env.readDirectionCell(x, y);
      if (!(cell.escapeBoundary || cell.escapeAnchor)) continue;
      const beyond = [x === 127 ? [x + 1, y] : null, y === 127 ? [x, y + 1] : null].filter(Boolean);
      if (beyond.some(([bx, by]) => !env.isBlocked(bx, by))) bad.push([x, y]);
    }
    assert.deepEqual(bad, [], fieldId);
  }
});

test('props added to the hm10/hm13 extension areas block their tiles, day and night, and split no region', () => {
  const regions = (env) => {
    const seen = new Uint8Array(180 * 180); let count = 0;
    for (let i = 0; i < seen.length; i++) {
      if (seen[i] || env.isBlocked(i % 180, Math.floor(i / 180))) continue;
      count++; const stack = [i]; seen[i] = 1;
      while (stack.length) {
        const j = stack.pop(), x = j % 180, y = Math.floor(j / 180);
        for (const [u, v] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          const k = v * 180 + u;
          if (u >= 0 && v >= 0 && u < 180 && v < 180 && !seen[k] && !env.isBlocked(u, v)) { seen[k] = 1; stack.push(k); }
        }
      }
    }
    return count;
  };
  for (const [fieldId, tiles] of Object.entries(propBlocks.fields)) {
    assert.ok(tiles.length > 50, fieldId);
    const night = fieldId.replace('_01', '_02');
    for (const id of [fieldId, ...(expansions.environments[night] ? [night] : [])]) {
      const env = createNativeHuntEnvironment(expansions.environments[id]);
      for (const [x, y] of tiles) {
        assert.ok(x >= 128 || y >= 128, `${id} ${x},${y} outside the original grid`);
        assert.equal(env.readTerrain(x, y), 1, `${id} ${x},${y} blocked`);
      }
      // Unblocking the prop tiles gives back the same number of separate open regions.
      const open = { isBlocked: (x, y) => env.isBlocked(x, y) && !tiles.some(([a, b]) => a === x && b === y) };
      assert.equal(regions(env), regions(open), `${id} regions`);
    }
  }
});
