// BM05 battle canvas (Owner 2026-11-12): 「戰鬥地圖是不是是畫太小了」 — the play area keeps its
// picture, data and size; a ring of scenery round it lets the camera pull back and keep every
// fighter between the HUD rows, upright, sideways and on a desktop.
//
// What these cases pin:
//   1. the canvas record and its rectangle in the play area's coordinates (3456x2240 since 2026-11-15);
//   2. the canvas cover: the canvas fills the screen, and the shot never pulls back further than
//      the whole play area needs;
//   3. a framed shot keeps its visible region inside the canvas picture, and a view wider than
//      the picture is centred on it;
//   4. the per-frame clamp follows the same rules;
//   5. a storm backdrop on a canvas arena reaches every canvas edge;
//   6. a short landscape screen puts the HUD on two edge rows with two-line cards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {BATTLE_FIELD_CANVASES, battleFieldCanvasRect} from '../src/championship/presentation/battleFieldAmbient.js';
import {battleFxCanvasCover, battleFxFrameShot, clampBattleCameraToMap} from '../src/championship/presentation/battleFx/battleFxCamera.js';

const art = {x: 0, y: 0, width: 1664, height: 1088};
const canvas = {...battleFieldCanvasRect('field_bm05_01')};
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('the BM05 canvas sits round the unchanged play area', () => {
  const record = BATTLE_FIELD_CANVASES.field_bm05_01;
  assert.equal(record.rightsStatus, 'PROJECT_ORIGINAL');
  assert.match(record.src, /^assets\/production\/battle\/original-opus-canvas-r1\/fields\/field_bm05_01\/frame-00\.webp$/);
  assert.ok(fs.existsSync(new URL(`../${record.src}`, import.meta.url)), 'the canvas picture is in the repository');
  assert.ok(fs.existsSync(new URL(`../${record.seaMask}`, import.meta.url)), 'the canvas sea mask is in the repository');
  assert.deepEqual(canvas, {x: -896, y: -576, width: 3456, height: 2240});
  // Wide enough that a phone held sideways (844 px over a 176 px window) never reaches an edge.
  assert.ok(canvas.width >= 3456 && canvas.width <= 4096 && canvas.height <= 4096, 'within the iOS texture limit');
  // The play area lies wholly inside the picture.
  assert.ok(canvas.x <= art.x && canvas.y <= art.y && canvas.x + canvas.width >= art.width && canvas.y + canvas.height >= art.height);
  assert.equal(battleFieldCanvasRect('field_unknown_01'), null);
});

test('every wired canvas matches its own record and stays small enough for a phone', () => {
  const ids = Object.keys(BATTLE_FIELD_CANVASES);
  assert.ok(ids.length >= 4, 'BM01, BM02, BM05 and BM06 at least');
  for (const id of ids) {
    const record = BATTLE_FIELD_CANVASES[id], folder = new URL(`../assets/production/battle/original-opus-canvas-r1/fields/${id}/`, import.meta.url);
    const meta = JSON.parse(fs.readFileSync(new URL('canvas.json', folder), 'utf8'));
    assert.equal(record.src, `assets/production/battle/original-opus-canvas-r1/fields/${id}/frame-00.webp`, id);
    assert.deepEqual(meta.canvasWorldPx, [record.widthPx, record.heightPx], `${id} size`);
    assert.deepEqual(meta.playOffsetWorldPx, [record.offsetX, record.offsetY], `${id} play offset`);
    assert.equal(meta.rightsStatus, 'PROJECT_ORIGINAL', id); assert.equal(meta.romDerivedPixels, false, id);
    assert.equal(record.rightsStatus, 'PROJECT_ORIGINAL', id);
    const bytes = fs.statSync(new URL('frame-00.webp', folder)).size;
    assert.ok(bytes <= 520_000, `${id} picture ${bytes} bytes`);
    for (const kind of ['seaMask', 'waterMask', 'lavaMask']) if (record[kind]) assert.ok(fs.existsSync(new URL(`../${record[kind]}`, import.meta.url)), `${id} ${kind}`);
  }
});

test('the canvas cover fills the screen and stops at the whole play area', () => {
  // Upright phone: the canvas height decides.
  const portrait = {width: 430, height: 800};
  close(battleFxCanvasCover(portrait, art, canvas), Math.max(430 / 3456, 800 / 2240, Math.min(430 / 1664, 800 / 1088)));
  // Held sideways: the canvas width decides, so the shot may pull back to a third of the play area's scale.
  const sideways = {width: 844, height: 342};
  close(battleFxCanvasCover(sideways, art, canvas), Math.max(844 / 3456, 342 / 2240, Math.min(844 / 1664, 342 / 1088)));
  // A huge screen never zooms out past showing the whole play area.
  const big = {width: 4000, height: 2600};
  close(battleFxCanvasCover(big, art, canvas), Math.max(4000 / 3456, 2600 / 2240, Math.min(4000 / 1664, 2600 / 1088)));
});

test('a framed shot stays inside the canvas picture and centres a wider view', () => {
  const viewport = {width: 430, height: 800};
  // A group pressed into the play area's corner: the shot may show the canvas past it, never past the picture.
  const shot = battleFxFrameShot({viewport, art, box: {left: 0, top: 0, right: 200, bottom: 200}, boundedMap: true, canvas});
  const halfW = viewport.width / (2 * shot.zoom), halfH = viewport.height / (2 * shot.zoom);
  assert.ok(shot.cx - halfW >= canvas.x - 1e-6 && shot.cx + halfW <= canvas.x + canvas.width + 1e-6);
  assert.ok(shot.cy - halfH >= canvas.y - 1e-6 && shot.cy + halfH <= canvas.y + canvas.height + 1e-6);
  assert.ok(shot.cx - halfW < art.x, 'the shot reaches past the play area onto the canvas');
  // Sideways, pulled back wider than the picture: centred on it, whatever the group.
  const sideways = {width: 844, height: 342};
  const wide = battleFxFrameShot({viewport: sideways, art, box: {left: 1200, top: 300, right: 1660, bottom: 1080}, boundedMap: true,
    insets: {top: 76, bottom: 90}, canvas});
  if (sideways.width / wide.zoom > canvas.width) close(wide.cx, canvas.x + canvas.width / 2, 1e-3);
});

test('the per-frame clamp keeps the picture on screen and centres a wide view', () => {
  const viewport = {width: 844, height: 342};
  const zoom = battleFxCanvasCover(viewport, art, canvas, {top: 76, bottom: 90});
  // A transform pushed far right of the picture comes back to centre (the view is wider than the picture).
  const pushed = clampBattleCameraToMap({viewport, art, transform: {zoom, x: 900, y: 0}, insets: {top: 76, bottom: 90}, canvas});
  close(pushed.centerX, canvas.x + canvas.width / 2, 1e-3);
  // Narrower than the picture: its left edge never comes on screen.
  const upright = {width: 430, height: 800};
  const z2 = 0.6;
  const left = clampBattleCameraToMap({viewport: upright, art, transform: {zoom: z2, x: 5000, y: 0}, canvas});
  assert.ok(left.x <= -canvas.x * left.zoom + 1e-6);
  assert.ok(left.centerX - upright.width / (2 * left.zoom) >= canvas.x - 1e-6);
  // Without a canvas the old rule stands: the play area's own edge.
  const plain = clampBattleCameraToMap({viewport: upright, art, transform: {zoom: 1, x: 5000, y: 0}});
  close(plain.x, 0);
});

test('a storm backdrop on a canvas arena reaches every canvas edge', () => {
  const layer = fs.readFileSync(new URL('../src/championship/presentation/vfx/elementVfxLayer.js', import.meta.url), 'utf8');
  const fx = fs.readFileSync(new URL('../src/championship/presentation/battleFx/battleFxLayer.js', import.meta.url), 'utf8');
  assert.match(layer, /function storm\(\{[^}]*bounds = null\}\)/);
  assert.match(layer, /reach \* 2\.06/);
  assert.match(fx, /bounds: ctx\.canvasRect \?\? null/);
});

test('a short landscape screen puts the HUD on two edge rows with two-line cards', () => {
  const css = fs.readFileSync(new URL('../src/championship/app/vs5Styles.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('@media (orientation: landscape) and (max-height: 560px)'));
  assert.ok(block.length > 0, 'the short landscape block exists');
  assert.match(block, /> \.cm-vs5-roster--opponent \{ grid-row: 1; grid-column: 2;/);
  assert.match(block, /> \.cm-vs5-roster--player \{ grid-row: 3; grid-column: 1;/);
  assert.match(block, /grid-template-areas: "hpbar" "tp"/);
});
