// HM10/HM11/HM13/HM14 3D hunt maps: field mapping, hash chain and loader admission.
// These four keep their native 128x128 fields; the 2880 candidate geometry is
// clipped to the 2048 core and drawn through the shared authored-map path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS, huntThreeProductionRequest } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { ORIGINAL_HUNT_FIELD_BINDINGS } from '../src/championship/gate/originalHuntFieldBindings.js';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const loopback = new URL('http://127.0.0.1:8732/championship.html');
const EXPECTED = {
  hm10: { fields: ['field_hm10_01'], biome: 'Factory' },
  hm11: { fields: ['field_hm11_01'], biome: 'Sewer' },
  hm13: { fields: ['field_hm13_01', 'field_hm13_02'], biome: 'Ice' },
  hm14: { fields: ['field_hm14_01', 'field_hm14_02'], biome: 'Crag' },
};

test('the four maps bind every native day/night field of their gate at the native 2048 world', () => {
  for (const [key, want] of Object.entries(EXPECTED)) {
    const map = MAPS[key];
    assert.ok(map, key);
    assert.deepEqual(map.fields, want.fields);
    assert.equal(map.worldSize, 2048);
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
