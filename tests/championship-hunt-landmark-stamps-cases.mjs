// hm16 灼熱沙漠 / hm17 澄澈綠洲 / hm18 臨界遺跡 (2026-11-26 refinement batch 1).
// Their 2026-10 extension strips were almost empty sand. Each map now carries copies of its own
// landmarks (rock outcrops, palms on rocks, ruin blocks, pillars, flags) in the extension; the
// tiles under every copy are blocked, day and night, and no open area is cut off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { createNativeHuntEnvironment } from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import expansions from '../src/data/championship/catalogs/hunt-art-expansions-20261023.json' with { type: 'json' };
import scene from '../src/data/championship/catalogs/hunt-scene.r1.json' with { type: 'json' };
import landmarks from '../scripts/data/hunt-extension-landmark-blocks-20261126.json' with { type: 'json' };

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const EXPECTED = {
  hm16: { directory: /hm16-three-v7-20261126\/$/, stamps: 16 },
  hm17: { directory: /hm17-three-v5-20261126\/$/, stamps: 16 },
  hm18: { directory: /hm18-three-v4-20261126\/$/, stamps: 18 },
};
const regions = (isBlocked) => {
  const seen = new Uint8Array(180 * 180); let count = 0;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || isBlocked(i % 180, Math.floor(i / 180))) continue;
    count++; const stack = [i]; seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % 180, y = Math.floor(j / 180);
      for (const [u, v] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const k = v * 180 + u;
        if (u >= 0 && v >= 0 && u < 180 && v < 180 && !seen[k] && !isBlocked(u, v)) { seen[k] = 1; stack.push(k); }
      }
    }
  }
  return count;
};

test('the three maps bind the landmark folders and their bytes match the pinned hashes', () => {
  for (const [key, want] of Object.entries(EXPECTED)) {
    const map = MAPS[key];
    assert.match(map.directory, want.directory, key);
    assert.equal(map.worldSize, 2880);
    const raw = fs.readFileSync(map.directory + map.manifest.file);
    assert.equal(sha(raw), map.manifest.sha256, key);
    const manifest = JSON.parse(raw);
    for (const asset of [manifest.glb, manifest.groundHeights]) {
      const bytes = fs.readFileSync(map.directory + asset.file);
      assert.equal(bytes.length, asset.bytes, `${key} ${asset.file}`);
      assert.equal(sha(bytes), asset.sha256, `${key} ${asset.file}`);
    }
  }
});

test('every landmark copy stands in the extension, off the edge, and far enough from the others', () => {
  assert.deepEqual(Object.keys(landmarks.fields).sort(), ['field_hm16_01', 'field_hm17_01', 'field_hm18_01']);
  for (const [fieldId, { blocked, stamps }] of Object.entries(landmarks.fields)) {
    const key = fieldId.slice(6, 10);
    assert.equal(stamps.length, EXPECTED[key].stamps, fieldId);
    assert.equal(new Set(blocked.map(String)).size, blocked.length, `${fieldId} no duplicate tile`);
    for (const [x, y] of blocked) {
      assert.ok(x >= 128 || y >= 128, `${fieldId} ${x},${y} outside the original grid`);
      assert.ok(x >= 3 && y >= 3 && x <= 176 && y <= 176, `${fieldId} ${x},${y} off the map edge`);
    }
    for (let i = 0; i < stamps.length; i++) for (let j = i + 1; j < stamps.length; j++)
      assert.ok(Math.hypot(stamps[i][0] - stamps[j][0], stamps[i][1] - stamps[j][1]) >= 13, `${fieldId} copies ${i} and ${j} too close`);
  }
});

test('the tiles under the copies are blocked day and night; the core and the open regions are unchanged', () => {
  for (const [fieldId, { blocked }] of Object.entries(landmarks.fields)) {
    const set = new Set(blocked.map(([x, y]) => y * 180 + x));
    for (const id of [fieldId, fieldId.replace('_01', '_02')]) {
      const data = expansions.environments[id];
      assert.ok(data, id);
      const env = createNativeHuntEnvironment(data);
      for (const [x, y] of blocked) assert.equal(env.readTerrain(x, y), 1, `${id} ${x},${y} blocked`);
      // The original 128 x 128 terrain is the delivered one.
      const core = createNativeHuntEnvironment({ ...scene.environments[id], base: { widthTiles: 128, heightTiles: 128, originTile: [0, 0] } });
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++)
        assert.equal(env.readTerrain(x, y), core.readTerrain(x, y), `${id} core ${x},${y}`);
      // Taking the copies away gives the same number of separate open regions: nothing is cut off.
      const before = regions((x, y) => env.isBlocked(x, y) && !set.has(y * 180 + x));
      assert.equal(regions((x, y) => env.isBlocked(x, y)), before, `${id} regions`);
      // The extension stays mostly open ground for running, wires and traps.
      let open = 0, total = 0;
      for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
        if (x < 128 && y < 128) continue;
        total++; if (!env.isBlocked(x, y)) open++;
      }
      assert.ok(open / total > 0.7, `${id} extension open ${(open / total).toFixed(3)}`);
    }
  }
});
