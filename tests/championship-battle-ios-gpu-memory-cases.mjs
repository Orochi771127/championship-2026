// Owner 2026-11-04 (iPhone): entering a battle on 島嶼 sent the page back to the title on the
// first move, then iOS showed 「重複發生問題」. The lagoon's sprite mask made Pixi render the
// whole lagoon into an offscreen filter texture that is never clipped to the viewport; a
// pushed-in camera grew it to 8192 x 4096 with 4x MSAA (measured 1,283 MB of WebGL memory,
// against ~40 MB on the other arenas). The same session's black bars are the bare letterbox
// past the arena's top and bottom edges under the HUD rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {waterLookup} from '../src/championship/presentation/battleFieldAmbient.js';

const source = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('the lagoon never renders through a sprite mask: caustics use the single-pass masked mesh', () => {
  const ambient = source('src/championship/presentation/battleFieldAmbient.js');
  const lagoon = ambient.slice(ambient.indexOf('// --- BM04 lagoon'), ambient.indexOf('// --- BM05 polar sea'));
  assert.ok(lagoon.length > 0);
  assert.doesNotMatch(lagoon, /\.mask\s*=/, 'no sprite mask on the lagoon water fx');
  assert.doesNotMatch(lagoon, /new PIXI\.TilingSprite/, 'no full-field tiling sprite under a mask');
  assert.match(lagoon, /maskedTiling\(PIXI, renderer, \{ tile: tex\(ambient\.caustics\.src\), mask: maskTexture, rect,/);
  // Glints and fighter ripples keep to the water by the mask lookup instead.
  assert.match(ambient, /if \(onWater && !onWater\(x, y\)\) continue;/);
  assert.match(ambient, /const wet = waterFx \? \(onWater\?\.\(x, y\) \?\? true\) :/);
  // The caustic meshes and the scan sweep are released with the other masked layers.
  assert.match(ambient, /\[flowLayer, waveLayer, gust, scan, \.\.\.causticLayers\.map\(c => c\.t\)\]\) layer\?\.destroy\(\);/);
});

test('the cyberspace floor scan sweep is one masked mesh, not a sprite-masked strip (126 MB measured)', () => {
  const ambient = source('src/championship/presentation/battleFieldAmbient.js');
  const scan = ambient.slice(ambient.indexOf('  let scan = null;'), ambient.indexOf('  const rotors ='));
  assert.ok(scan.length > 0);
  assert.doesNotMatch(scan, /\.mask\s*=/);
  assert.match(scan, /scan = maskedScan\(PIXI, renderer, \{ mask: tex\(ambient\.floorMask\.src\), rect: ambient\.floorMask \}\);/);
  // The only sprite masks left in the ambient layers are the non-WebGL fallbacks.
  const spriteMasks = [...ambient.matchAll(/fx\.mask = maskSprite;/g)].length;
  assert.equal(spriteMasks, 2, 'maskedTiling and maskedScan fallbacks only');
  assert.equal([...ambient.matchAll(/\.mask = /g)].length, 4, 'two fallbacks plus the Graphics stencils for crust and ice');
});

test('waterLookup reads the mask as the shader does (alpha x red) and degrades to "everywhere"', () => {
  const previous = globalThis.document;
  try {
    // A 2 x 1 mask scaled 4x: the left half is water, the right half land.
    let size = null;
    globalThis.document = {createElement: () => ({
      set width(v) { size = {...size, w: v}; }, set height(v) { size = {...size, h: v}; },
      getContext: () => ({drawImage() {}, getImageData: (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; if (i < w / 2) { data[k] = 255; data[k + 3] = 255; } }
        return {data};
      }})
    })};
    const water = waterLookup({width: 2, height: 1, source: {resource: {}}}, 4);
    assert.equal(typeof water, 'function');
    assert.equal(water(1, 2), true, 'left half is water');
    assert.equal(water(7, 2), false, 'right half is land');
    assert.equal(water(-1, 2), false, 'outside the mask is not water');
    assert.equal(water(9, 2), false);
    // No document (or unreadable pixels): no lookup, so callers keep every point.
    delete globalThis.document;
    assert.equal(waterLookup({width: 2, height: 1, source: {resource: {}}}), null);
    globalThis.document = {createElement: () => { throw new Error('tainted'); }};
    assert.equal(waterLookup({width: 2, height: 1, source: {resource: {}}}), null);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('the HP number over a floating HUD bar has no plate, so the green HP shows (Owner 2026-11-04)', () => {
  const css = source('src/championship/app/ui/screenLayout.css');
  const lift = css.indexOf('.cm-vs5-shell[data-hud="floating"] :is(.cm-vs5-fighter__hp, .cm-vs5-meter__value) { z-index: 2; }');
  const clear = css.indexOf(':root .cm-vs5-shell[data-hud="floating"] .cm-vs5-meter > .cm-vs5-fighter__hp { background: none; box-shadow: none; }');
  assert.ok(lift > 0, 'the number still draws over the fill');
  assert.ok(clear > lift, 'and, inside a bar, without its dark arcade plate');
});

test('the arena art continues past its top and bottom edges instead of black bars', () => {
  const field = source('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js');
  assert.match(field, /bleed\.label = "arena edge bleed";/);
  assert.match(field, /for \(const y of \[0, worldHeightPx \* 2\]\)/, 'one copy above, one below');
  assert.match(field, /bleed\.scale\.y = -Math\.abs\(bleed\.scale\.y\);/, 'mirrored so the edge is seamless');
  assert.match(field, /new stage\.PIXI\.Sprite\(base\.texture\)/, 'the same texture: no new GPU memory');
});
