import assert from 'node:assert/strict';
import test from 'node:test';
import { raisingFieldViewport, raisingRegionBounds } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
import { getRaisingNativePixelScale } from '../src/championship/presentation/intRh2/raisingNativeSizing.js';

test('portrait and landscape letterboxing keep actor/drop coordinates on the same art plane', () => {
  const field = { worldWidthPx: 400, worldHeightPx: 200, nativePixelWorldScale: 4 };
  const fitted = raisingFieldViewport(field, { width: 424, height: 824 });
  assert.deepEqual(fitted, { x: 12, y: 312, width: 400, height: 200, scale: 1 });
  assert.deepEqual(raisingRegionBounds({x:0,y:.5,w:1,h:.5}, fitted),
    {x:12,y:412,width:400,height:100});
  // Previously this target was at y=412..824 and accepted the empty lower margin.
  const lower = raisingRegionBounds({x:0,y:.5,w:1,h:.5}, fitted);
  assert.ok(700 > lower.y + lower.height);
  const wide = raisingFieldViewport({worldWidthPx:200,worldHeightPx:400}, {width:824,height:424});
  assert.deepEqual(wide, {x:312,y:12,width:200,height:400,scale:1});
});

test('field transform preserves native character/cage scale through phone resizing and composed fields', () => {
  for (const width of [320,360,390,393,412,430]) {
    for (const field of [
      {worldWidthPx:384,worldHeightPx:448,nativePixelWorldScale:4},
      {worldWidthPx:1600,worldHeightPx:800,nativePixelWorldScale:4}
    ]) {
      const screen = {width,height:width*16/9-240};
      const fitted = raisingFieldViewport(field,screen);
      assert.equal(fitted.scale*4,getRaisingNativePixelScale(field,screen));
      assert.ok(fitted.x >= 12 - 1e-8 && fitted.y >= 12 - 1e-8);
      assert.ok(fitted.x+fitted.width <= width-12+1e-8);
      assert.ok(fitted.y+fitted.height <= screen.height-12+1e-8);
    }
  }
});

test('missing art retains the legacy fallback surface without changing stored regions', () => {
  const region = Object.freeze({x:.1,y:.2,w:.8,h:.3});
  const fitted = raisingFieldViewport(null,{width:400,height:600});
  assert.deepEqual(raisingRegionBounds(region,fitted),{x:40,y:120,width:320,height:180});
  assert.deepEqual(region,{x:.1,y:.2,w:.8,h:.3});
});
