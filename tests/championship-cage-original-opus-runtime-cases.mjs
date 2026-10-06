// Owner 2026-10-06: the original Blender cage fields (opus rounds r1-r17) replace the
// licensed pixel fields at runtime. Art only: collision, walkability, ranch placement and
// cage training stay in the Cage runtime and are covered by their own cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import manifest from '../assets/production/cage/original-opus-v1/manifest.json' with { type: 'json' };
import licensed from '../assets/production/cage/licensed-runtime-v1/manifest.json' with { type: 'json' };
import { validateRuntimeMapArtBundle } from '../src/championship/presentation/runtimeMapArtBundle.js';
import { getOriginalCageVisualBinding } from '../src/championship/presentation/originalCageVisualBindings.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { cageUiImage } from '../src/championship/presentation/cageUiArt.js';

const sha = (path) => createHash('sha256').update(fs.readFileSync(path)).digest('hex').toUpperCase();

test('the original cage bundle validates in the runtime loader and every frame matches its hash', () => {
  const checked = validateRuntimeMapArtBundle(manifest);
  assert.equal(checked.family, 'CAGE');
  assert.equal(manifest.rights.status, 'PROJECT_ORIGINAL');
  assert.equal(manifest.rights.romDerivedPixels, false);
  assert.equal(manifest.fields.length, 37);
  for (const field of manifest.fields) {
    for (const frame of field.frames) {
      assert.ok(frame.src.startsWith('assets/production/cage/original-opus-v1/'), frame.src);
      assert.equal(sha(frame.src), frame.sha256, frame.src);
    }
  }
});

test('every cage definition binds to a field of the new bundle', () => {
  const ids = new Set(manifest.fields.map((field) => field.fieldId));
  const definitions = listCageDefinitions();
  assert.equal(definitions.length, 36);
  for (const definition of definitions) {
    const binding = getOriginalCageVisualBinding(definition.cageDefinitionIndex);
    assert.ok(ids.has(binding.fieldId), binding.fieldId);
    assert.ok(cageUiImage(definition.moduleId).startsWith('assets/production/cage/original-opus-v1/'));
  }
});

test('sizes and animated ground timings match the fields they replace', () => {
  const old = new Map(licensed.fields.map((field) => [field.fieldId, field]));
  for (const field of manifest.fields) {
    const before = old.get(field.fieldId);
    for (const key of ['worldWidthPx', 'worldHeightPx', 'nativeWidthPx', 'nativeHeightPx', 'visualRole']) {
      assert.equal(field[key], before[key], `${field.fieldId}:${key}`);
    }
    assert.equal(field.frames.length, before.frames.length, field.fieldId);
    field.frames.forEach((frame, index) => assert.equal(frame.durationMs, before.frames[index].durationMs));
  }
});

test('the ranch loader reads the new bundle; the licensed bundle stays stored but unused', () => {
  const main = fs.readFileSync('src/championship/app/main.js', 'utf8');
  assert.match(main, /const CAGE_ART_MANIFEST_URL = "assets\/production\/cage\/original-opus-v1\/manifest\.json"/);
  assert.doesNotMatch(main, /cage\/licensed-runtime-v1/);
  assert.ok(fs.existsSync('assets/production/cage/licensed-runtime-v1/manifest.json'));
});
