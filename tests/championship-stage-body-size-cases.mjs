// Owner 2026-10-30: Awakened/Ultimate were drawn too large and inconsistently. Each partner keeps its own
// designed size (relative size from the original idle cells), within one band per stage; Growth/Mature unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageBodyScale, scaleNativeGeometry} from '../src/championship/presentation/stageBodySize.js';
import {reviewedGeneralDisplayScale} from '../src/championship/presentation/reviewedSelection.js';
const table = JSON.parse(fs.readFileSync(new URL('../src/data/championship/stage-body-size.v1.json', import.meta.url), 'utf8'));
const source = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('table: one scale per Awakened/Ultimate species, references and band recorded', () => {
  assert.equal(table.kind, 'STAGE_BODY_SIZE'); assert.deepEqual(table.reference, {AW: 42, UL: 48}); assert.deepEqual(table.band, [0.55, 1.25]);
  assert.ok(table.rows.length >= 80);
  for (const [id, k] of table.rows) { assert.match(id, /^species-\d{3}$/); assert.ok(k > 0.5 && k < 2, `${id} ${k}`); }
  assert.equal(stageBodyScale('species-034'), 1, 'Growth unchanged');
  assert.equal(stageBodyScale('species-105'), 1, 'Mature unchanged');
  assert.ok(stageBodyScale('species-214') < 0.7, 'a large Ultimate is drawn smaller');
  assert.equal(stageBodyScale('championship:creature:species-214'), stageBodyScale('species-214'));
});

test('original cell geometry scales body, bounds and nothing else', () => {
  const g = {frames: {a: {scale: 4, origin: [96, 152], sourceSize: [256, 256], nativeBounds: [-10, -40, 10, 0]}, b: {blank: true}}};
  const s = scaleNativeGeometry(g, 0.5);
  assert.equal(s.frames.a.scale, 8); assert.deepEqual(s.frames.a.nativeBounds, [-5, -20, 5, 0]);
  assert.deepEqual(s.frames.a.origin, [96, 152]); assert.deepEqual(s.frames.b, {blank: true});
  assert.equal(scaleNativeGeometry(g, 1), g); assert.deepEqual(g.frames.a.nativeBounds, [-10, -40, 10, 0], 'input untouched');
});

test('reviewed art multiplies its selected display scale; every General path uses it', () => {
  assert.equal(reviewedGeneralDisplayScale({speciesId: 'species-159', generalDisplayScale: 0.56}), 0.56 * stageBodyScale('species-159'));
  assert.equal(reviewedGeneralDisplayScale({speciesId: 'species-105'}), 1);
  const loader = source('src/championship/presentation/reviewedCharacterLoader.js');
  assert.match(loader, /const displayScale=usage==='general'\?reviewedGeneralDisplayScale\(entry\):1;/);
  assert.match(loader, /display=reviewedGeneralDisplayScale\(entry\);/);
  assert.match(source('src/championship/presentation/reviewedSelection.js'), /density:\(density\?\?4\)\/reviewedGeneralDisplayScale\(entry\),/);
  assert.match(source('src/championship/presentation/publicCharacterRoster.js'), /scaleNativeGeometry\(runtime\.geometry,stageBodyScale\(config\.speciesId\)\)/);
  assert.match(source('src/championship/app/titleParade.js'), /density: \(runtime\.artProfile\?\.scale \?\? 4\) \/ stageBodyScale\(speciesId\)/);
});
