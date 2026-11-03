// Owner 2026-10-30: Awakened/Ultimate were drawn too large and inconsistently. Each partner keeps its own
// designed size (relative size from the original idle cells), within one band per stage. Owner 2026-11-03:
// Growth joins by stage band; from Mature up the size follows each partner's species and biology (size class),
// not its stage; no partner is enlarged more than 1.5x.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageBodyScale, scaleNativeGeometry} from '../src/championship/presentation/stageBodySize.js';
import {reviewedGeneralDisplayScale} from '../src/championship/presentation/reviewedSelection.js';
const table = JSON.parse(fs.readFileSync(new URL('../src/data/championship/stage-body-size.v1.json', import.meta.url), 'utf8'));
const source = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('table: Growth by stage band; Mature/Awakened/Ultimate by size class; references recorded', () => {
  assert.equal(table.kind, 'STAGE_BODY_SIZE'); assert.deepEqual(table.reference, {GR: 20.2, sizeClass: 40});
  assert.deepEqual(table.classFactor, {XS: 0.75, H: 0.88, M: 1, L: 1.15, XL: 1.35});
  assert.deepEqual(table.band, {GR: [0.8, 1.1]}); assert.equal(table.maxGrow, 1.5);
  assert.ok(table.rows.length >= 190);
  for (const [id, k] of table.rows) { assert.match(id, /^species-\d{3}$/); assert.ok(k > 0.3 && k < 2, `${id} ${k}`); }
  // Owner 2026-11-03: size follows species and biology, not stage. Every partner from Mature up has one class.
  const classes = Object.values(table.sizeClass).flat();
  assert.equal(new Set(classes).size, classes.length, 'one class each');
  assert.ok(classes.length >= 157);
  const classOf = code => Object.keys(table.sizeClass).find(k => table.sizeClass[k].includes(code));
  assert.equal(classOf('AW41'), 'L', 'MetalGreymon-type 機暴龍 is large');
  assert.equal(classOf('UL06'), 'H', 'the WarGreymon-type 戰暴龍 is a humanoid warrior');
  assert.equal(classOf('UL35'), 'XL', 'the Machinedramon-type 毀滅龍 is a giant');
  assert.equal(classOf('MA11'), 'M'); assert.equal(classOf('MA21'), 'L', 'the wolf is standard, the tyrannosaur large');
  // No partner is enlarged more than 1.5x beyond its live scale: no blurrier than art already live.
  const index = id => Number(id.slice(8)), stageScales = (from, to) => table.rows.filter(([id]) => index(id) >= from && index(id) <= to);
  for (const [id, k] of stageScales(29, 135)) assert.ok(k <= 1.5, `${id} enlarged ${k}`);
  assert.ok(stageBodyScale('species-096') > 1.15, 'MA34 熔岩龍 was redrawn small: drawn larger');
  assert.ok(stageBodyScale('species-065') < 0.7, 'GR37 月亮兔 was redrawn large: drawn smaller');
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
  assert.equal(reviewedGeneralDisplayScale({speciesId: 'species-020'}), 1, 'baby stages keep their size');
  const loader = source('src/championship/presentation/reviewedCharacterLoader.js');
  assert.match(loader, /const displayScale=usage==='general'\?reviewedGeneralDisplayScale\(entry\):1;/);
  assert.match(loader, /display=reviewedGeneralDisplayScale\(entry\);/);
  assert.match(source('src/championship/presentation/reviewedSelection.js'), /density:\(density\?\?4\)\/reviewedGeneralDisplayScale\(entry\),/);
  assert.match(source('src/championship/presentation/publicCharacterRoster.js'), /scaleNativeGeometry\(runtime\.geometry,stageBodyScale\(config\.speciesId\)\)/);
  assert.match(source('src/championship/app/titleParade.js'), /density: \(runtime\.artProfile\?\.scale \?\? 4\) \/ stageBodyScale\(speciesId\)/);
});
