import {publicMapManifestPath} from '../src/championship/presentation/publicMapRequests.js';
import {isOriginalRuntimeLocation} from '../src/championship/presentation/originalRuntimeLocation.js';
// Owner 2026-10-06: original cage fields replaced the licensed pixel fields at runtime.
// Owner 2026-11-02: those 10/06 Blender fields are deleted; the UI bundle is now the renders
// of the 3D cage GLBs (cage-ui role). Art only: collision, walkability, ranch placement and
// cage training stay in the Cage runtime and are covered by their own cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import manifest from '../assets/production/cage/ui-three-20261102/manifest.json' with { type: 'json' };
import uiMap from '../assets/production/public-runtime/cage-ui.map.v1.json' with { type: 'json' };
import licensed from '../assets/production/cage/licensed-runtime-v1/manifest.json' with { type: 'json' };
import { validateRuntimeMapArtBundle } from '../src/championship/presentation/runtimeMapArtBundle.js';
import { getOriginalCageVisualBinding } from '../src/championship/presentation/originalCageVisualBindings.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { cageUiImage } from '../src/championship/presentation/cageUiArt.js';
import threeUi from '../assets/production/public-runtime/cage-ui-three.v1.json' with { type: 'json' };

const sha = (path) => createHash('sha256').update(fs.readFileSync(path)).digest('hex');

test('the cage UI bundle validates in the runtime loader and every frame matches its hash', () => {
  const checked = validateRuntimeMapArtBundle(manifest);
  assert.equal(checked.family, 'CAGE');
  assert.equal(manifest.rights.status, 'PROJECT_ORIGINAL');
  assert.equal(manifest.rights.romDerivedPixels, false);
  assert.equal(manifest.fields.length, 37);
  for (const field of manifest.fields) {
    assert.equal(field.frames.length, 1, field.fieldId);
    for (const frame of field.frames) {
      assert.ok(frame.src.startsWith('assets/production/cage/ui-three-20261102/frames/'), frame.src);
      assert.equal(sha(frame.src), frame.sha256, frame.src);
    }
  }
  // The public cage-ui map is the projection of exactly these frames.
  assert.deepEqual(uiMap.fields.map((f) => [f.fieldId, f.frames.map((x) => x.src)]), manifest.fields.map((f) => [f.fieldId, f.frames.map((x) => x.src)]));
  assert.equal(fs.existsSync('assets/production/cage/original-opus-v1'), false);
});

test('every cage definition binds to a field of the bundle', () => {
  const ids = new Set(manifest.fields.map((field) => field.fieldId));
  const definitions = listCageDefinitions();
  assert.equal(definitions.length, 36);
  for (const definition of definitions) {
    const binding = getOriginalCageVisualBinding(definition.cageDefinitionIndex);
    assert.ok(ids.has(binding.fieldId), binding.fieldId);
    // Owner 2026-11-02: the UI shows the 3D render of the field the cage binds to.
    assert.equal(cageUiImage(definition.moduleId),threeUi.fields.find(f=>f.fieldId===binding.fieldId).frame.src);
  }
});

test('sizes match the fields they replace; renders are one static frame', () => {
  const old = new Map(licensed.fields.map((field) => [field.fieldId, field]));
  for (const field of manifest.fields) {
    const before = old.get(field.fieldId);
    for (const key of ['worldWidthPx', 'worldHeightPx', 'nativeWidthPx', 'nativeHeightPx', 'visualRole']) {
      assert.equal(field[key], before[key], `${field.fieldId}:${key}`);
    }
    assert.deepEqual(field.frames.map((frame) => frame.durationMs), [null], field.fieldId);
  }
});

test('the ranch loader reads the new bundle; the licensed bundle stays stored but unused', () => {
  const main = fs.readFileSync('src/championship/app/main.js', 'utf8');
  const expression = main.match(/const CAGE_ART_MANIFEST_URL = ([\s\S]*?);/)[1];
  const select = hostname => Function('isOriginalRuntimeLocation','publicMapManifestPath', 'return '+expression)(()=>isOriginalRuntimeLocation({hostname}),publicMapManifestPath);
  for (const host of ['localhost','127.0.0.1','[::1]'])
    assert.equal(select(host), 'assets/production/public-runtime/cage-final.map.v1.json');
  for (const host of ['orochi771127.github.io','example.com','localhost.evil.test'])
    assert.equal(select(host), 'assets/production/public-runtime/cage-ui.map.v1.json');
  assert.equal(Function('isOriginalRuntimeLocation','publicMapManifestPath','return '+expression)(()=>isOriginalRuntimeLocation('https://orochi771127.github.io/championship-2026/'),publicMapManifestPath), 'assets/production/public-runtime/cage-final.map.v1.json');
  assert.doesNotMatch(main, /cage\/licensed-runtime-v1/);
  assert.ok(fs.existsSync('assets/production/cage/licensed-runtime-v1/manifest.json'));
});
