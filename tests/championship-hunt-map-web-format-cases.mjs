// 2026-11-26 hunt map audit: every hunt map ships in web formats. hm02-hm06 used to ship
// float32 geometry with no mesh compression (14.8 MB of GLB; GitHub Pages does not gzip .glb).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';

const MAP_BUDGET_BYTES = 10.5 * 1024 * 1024;   // largest today: hm18 9.92 MB
const TOTAL_BUDGET_BYTES = 70 * 1024 * 1024;   // all 16 maps today: 64.8 MB

test('every hunt map GLB is Draco-compressed and self-contained; pictures are WebP', () => {
  assert.equal(Object.keys(MAPS).length, 16);
  for (const [key, map] of Object.entries(MAPS)) {
    assert.equal(map.worldSize, 2880, key);
    const files = fs.readdirSync(map.directory);
    const glbs = files.filter(f => f.endsWith('.glb'));
    assert.ok(glbs.length >= 1, key);
    for (const file of glbs) {
      const glb = fs.readFileSync(map.directory + file);
      assert.equal(glb.readUInt32LE(0), 0x46546c67, `${key} ${file} magic`);
      const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
      assert.ok(gltf.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${key} ${file} is Draco-compressed`);
      for (const mesh of gltf.meshes) for (const prim of mesh.primitives)
        assert.ok(prim.extensions?.KHR_draco_mesh_compression, `${key} ${file} ${mesh.name} primitive compressed`);
      assert.ok((gltf.buffers ?? []).every(buffer => !buffer.uri), `${key} ${file} no external buffer`);
      assert.ok((gltf.images ?? []).every(image => Number.isInteger(image.bufferView) && !image.uri), `${key} ${file} images embedded`);
    }
    for (const file of files) {
      const ext = path.extname(file);
      assert.ok(['.glb', '.webp', '.json'].includes(ext), `${key} ${file}: only GLB, WebP and JSON ship`);
      if (ext === '.webp') {
        const head = fs.readFileSync(map.directory + file).subarray(0, 12);
        assert.equal(head.toString('ascii', 0, 4) + head.toString('ascii', 8, 12), 'RIFFWEBP', `${key} ${file}`);
      }
    }
  }
});

test('hunt map downloads stay inside the size budget', () => {
  let total = 0;
  for (const [key, map] of Object.entries(MAPS)) {
    const bytes = fs.readdirSync(map.directory).reduce((n, f) => n + fs.statSync(map.directory + f).size, 0);
    assert.ok(bytes <= MAP_BUDGET_BYTES, `${key} ${(bytes / 1048576).toFixed(2)} MB`);
    total += bytes;
  }
  assert.ok(total <= TOTAL_BUDGET_BYTES, `all maps ${(total / 1048576).toFixed(2)} MB`);
});

test('the compressed hm02-hm06 keep their tree prototypes, instances and pinned hashes', async () => {
  const crypto = await import('node:crypto');
  const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
  for (const key of ['hm02', 'hm03', 'hm04', 'hm05', 'hm06']) {
    const map = MAPS[key];
    const raw = fs.readFileSync(map.directory + map.manifest.file);
    assert.equal(sha(raw), map.manifest.sha256, key);
    const manifest = JSON.parse(raw);
    for (const asset of [manifest.glb, manifest.treePrototypes, manifest.treeInstances]) {
      const bytes = fs.readFileSync(map.directory + asset.file);
      assert.equal(bytes.length, asset.bytes, `${key} ${asset.file}`);
      assert.equal(sha(bytes), asset.sha256, `${key} ${asset.file}`);
    }
    assert.ok(manifest.instanceCount > 0, key);
  }
});
