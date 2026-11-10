// HUNT_ROPE_VFX_20261111 (Owner: 「現在就好像一個很便宜的線」): a braided pixel rope bent along the drawn
// path, a cinch on release, a coil on bound partners, a tether that reads the pull band, and a snap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUNT_ROPE_VFX, resamplePath, tetherCurve } from '../src/championship/presentation/vs2/huntRopeVfx.js';

const read = (path) => readFileSync(path, 'utf8');

test('the drawn path is resampled evenly, open or closed', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const open = resamplePath(square, 7), closed = resamplePath(square, 9, true);
  assert.equal(open.points.length, 7); assert.equal(open.length, 30);
  assert.deepEqual(open.points[0], { x: 0, y: 0 }); assert.deepEqual(open.points.at(-1), { x: 0, y: 10 });
  assert.equal(closed.length, 40); assert.deepEqual(closed.points.at(-1), { x: 0, y: 0 }, 'a closed loop ends where it began');
  assert.equal(resamplePath([{ x: 1, y: 1 }], 8), null);
  assert.equal(resamplePath([{ x: 1, y: 1 }, { x: 1, y: 1 }], 8), null);
});

test('the tether sags when slack, runs straight under a strong pull and hums only when asked', () => {
  const slack = tetherCurve([0, 0], [100, 0], { sag: HUNT_ROPE_VFX.bands.SLACK.sag, count: 11 });
  const strong = tetherCurve([0, 0], [100, 0], { sag: HUNT_ROPE_VFX.bands.STRONG.sag, count: 11 });
  assert.deepEqual(slack[0], { x: 0, y: 0 }); assert.deepEqual(slack.at(-1), { x: 100, y: 0 });
  assert.equal(slack[5].y, HUNT_ROPE_VFX.bands.SLACK.sag, 'the deepest sag is mid-rope');
  assert.ok(strong.every((p) => p.y === 0), 'a strong pull is a straight line');
  const hum = tetherCurve([0, 0], [100, 0], { hum: 2, phase: 1, count: 11 });
  assert.ok(hum.some((p) => p.y !== 0) && hum[0].y === 0 && hum.at(-1).y === 0, 'a hum moves only the middle');
  assert.ok(HUNT_ROPE_VFX.bands.SLACK.sag > HUNT_ROPE_VFX.bands.PULL.sag && HUNT_ROPE_VFX.bands.PULL.sag > HUNT_ROPE_VFX.bands.STRONG.sag);
});

test('the hunt field draws the rope through the VFX module, and the controls publish what it needs', () => {
  const field = read('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  assert.match(field, /createHuntRopeVfx\(\{ PIXI, layer: strokeLayer \}\)/);
  assert.match(field, /ropeVfx\.update\(\{tools:view\.tools,wilds:view\.wildCreatures\?\?\[\]/);
  assert.match(field, /ropeVfx\.destroy\(\)/);
  assert.doesNotMatch(field, /strokeGraphic\.moveTo\(\.\.\.rope\.from\)\.lineTo\(\.\.\.rope\.to\)/, 'no bare line tether');
  const controls = read('src/championship/hunt/capture/nativeHuntFieldControls.js');
  assert.match(controls, /snap:ropeSnap,/);
  assert.match(controls, /lassoPath:pointer\?\.kind==="ROPE_STROKE"\?ropeTrail\.map/);
  assert.match(controls, /trail:closure\.trail\?\.map/);
});
