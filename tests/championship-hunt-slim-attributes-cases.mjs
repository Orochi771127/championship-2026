// 2026-11-26 hunt refinement batch 4: the five heaviest GLB maps (hm14-hm18) no longer carry
// vertex data that nothing reads. A vertex-colour material with no texture never samples a UV,
// three.js only shades with COLOR_0, and a colour already quantized to 8 bits does not need a
// 12-byte float in memory. Same models: less to download, decode, keep in JS and keep on the GPU.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import report from '../docs/reports/hunt-refinement-2026-11-26/batch4-slim-attributes.json' with { type: 'json' };

const KEYS = ['hm14', 'hm15', 'hm16', 'hm17', 'hm18'];
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const manifestOf = (key) => JSON.parse(fs.readFileSync(MAPS[key].directory + MAPS[key].manifest.file, 'utf8'));
const glbOf = (key) => fs.readFileSync(MAPS[key].directory + manifestOf(key).glb.file);
const jsonOf = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
/** UV sets that some texture of the material reads (a texture-info object is {index, texCoord?}). */
function usedUvSets(material) {
  const used = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (Number.isInteger(o.index) && Object.keys(o).every(k => ['index', 'texCoord', 'scale', 'strength', 'extensions', 'extras'].includes(k))) used.add(o.texCoord ?? 0);
    Object.values(o).forEach(walk);
  };
  walk(material);
  return used;
}
const BYTES = { 5121: 1, 5123: 2, 5126: 4 }, COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

test('the five maps bind the slimmed folders, and manifest and GLB bytes match the pinned hashes', () => {
  assert.deepEqual(Object.keys(report).sort(), KEYS);
  for (const key of KEYS) {
    const map = MAPS[key], raw = fs.readFileSync(map.directory + map.manifest.file);
    assert.ok(map.directory.endsWith(report[key].folder + '/'), key);
    assert.equal(sha(raw), map.manifest.sha256, key);
    const manifest = JSON.parse(raw), glb = glbOf(key);
    assert.equal(glb.length, manifest.glb.bytes, key);
    assert.equal(sha(glb), manifest.glb.sha256, key);
    assert.equal(glb.length, report[key].glbBytes, `${key} report is of this file`);
    assert.ok(report[key].glbBytes < report[key].glbBytesBefore, `${key} got smaller`);
  }
});

test('no primitive carries an unread UV set, a second colour set, or a float colour', () => {
  for (const key of KEYS) {
    const g = jsonOf(glbOf(key));
    let vertices = 0, bytes = 0;
    for (const mesh of g.meshes) for (const prim of mesh.primitives) {
      assert.ok(prim.extensions?.KHR_draco_mesh_compression, `${key} stays Draco`);
      const used = usedUvSets(g.materials[prim.material]);
      const count = g.accessors[prim.attributes.POSITION].count;
      vertices += count;
      for (const [name, index] of Object.entries(prim.attributes)) {
        const acc = g.accessors[index];
        // glTF wants set numbers consecutive from 0, so a set below one that is read may stay.
        if (name.startsWith('TEXCOORD_')) assert.ok(Number(name.slice(9)) <= Math.max(-1, ...used), `${key} ${name} on "${g.materials[prim.material].name}" is read by a texture`);
        if (name.startsWith('COLOR_')) {
          assert.equal(name, 'COLOR_0', `${key} only COLOR_0`);
          assert.notEqual(acc.componentType, 5126, `${key} colour is not a float`);
          assert.equal(acc.normalized, true, `${key} integer colour is normalized`);
        }
        bytes += count * Math.ceil(BYTES[acc.componentType] * COUNT[acc.type] / 4) * 4;   // GL pads each attribute to 4 bytes
      }
      assert.ok(prim.attributes.POSITION !== undefined && prim.attributes.NORMAL !== undefined, `${key} keeps position and normal`);
      const sets = Object.keys(prim.attributes).filter(n => n.startsWith('TEXCOORD_')).map(n => Number(n.slice(9))).sort((x, y) => x - y);
      assert.deepEqual(sets, sets.map((_, i) => i), `${key} UV sets are consecutive from 0`);
    }
    assert.equal(vertices, report[key].vertices, `${key} keeps every vertex`);
    assert.equal(bytes, report[key].vertexBytes, `${key} vertex bytes as reported`);
    assert.ok(report[key].vertexBytes <= report[key].vertexBytesBefore * 0.75, `${key} at least a quarter less vertex memory`);
  }
});

test('together the five maps are 8 MB lighter to download and 50 MB lighter in vertex memory per copy', () => {
  const sum = (field) => KEYS.reduce((n, key) => n + report[key][field], 0);
  assert.ok(sum('glbBytesBefore') - sum('glbBytes') > 8_000_000, `${sum('glbBytesBefore')} -> ${sum('glbBytes')}`);
  assert.ok(sum('vertexBytesBefore') - sum('vertexBytes') > 50_000_000, `${sum('vertexBytesBefore')} -> ${sum('vertexBytes')}`);
  // The heaviest map is now under 7 MB (hm11); hm18 was 9.65 MB.
  for (const key of KEYS) assert.ok(report[key].glbBytes < 6_200_000, key);
});

test('materials, textures and the lava phase picture are untouched', () => {
  for (const key of KEYS) {
    const manifest = manifestOf(key), g = jsonOf(glbOf(key));
    for (const asset of [manifest.groundHeights, manifest.lavaPhase?.texture].filter(Boolean)) {
      const bytes = fs.readFileSync(MAPS[key].directory + asset.file);
      assert.equal(sha(bytes), asset.sha256, `${key} ${asset.file}`);
    }
    if (manifest.lavaPhase) assert.ok(g.materials.some(m => m.name === manifest.lavaPhase.material), `${key} lava material`);
    // A textured material still has the UV set its textures read.
    for (const mesh of g.meshes) for (const prim of mesh.primitives)
      for (const set of usedUvSets(g.materials[prim.material])) assert.ok(prim.attributes[`TEXCOORD_${set}`] !== undefined, `${key} "${g.materials[prim.material].name}" keeps TEXCOORD_${set}`);
  }
});
