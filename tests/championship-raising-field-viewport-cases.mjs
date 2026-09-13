import assert from 'node:assert/strict';
import test from 'node:test';
import { raisingFieldViewport, raisingRegionBounds, raisingNativeToScreen, raisingScreenToNative, wrapRaisingCamera, raisingEdgeScroll } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
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

test('periodic ranch aligns actor and drop target on both sides of the waiting-area seam',()=>{
  const field={worldWidthPx:2688,worldHeightPx:768,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
  const viewport={width:390,height:330};
  for(const camera of [-20,0,2600,2688,5390])for(const x of [0,10,670]){
    const screen=raisingNativeToScreen([x*4096,80*4096],field,viewport,camera);
    const native=raisingScreenToNative(screen,field,viewport,camera);
    assert.ok(Math.abs(native.x-x)<1e-7);assert.ok(Math.abs(native.y-80)<1e-7);
  }
  assert.equal(wrapRaisingCamera(-4,2688),2684);
  assert.deepEqual(raisingFieldViewport(field,viewport,12,0),raisingFieldViewport(field,viewport,12,2688));
  const fit=raisingFieldViewport(field,viewport);
  assert.ok(fit.y-64*4*fit.scale>=12-1e-7,'large sprites retain headroom at unchanged ground-relative scale');
});

test('edge scroll continues at stationary pointer, respects direction and stops outside the field',()=>{
  const viewport={width:390,height:330};
  assert.equal(raisingEdgeScroll({x:195,y:100},viewport,16),0);
  assert.ok(raisingEdgeScroll({x:5,y:100},viewport,16)<0);
  assert.ok(raisingEdgeScroll({x:385,y:100},viewport,16)>0);
  for(const p of [{x:-1,y:100},{x:391,y:100},{x:2,y:-1},{x:388,y:331}])assert.equal(raisingEdgeScroll(p,viewport,16),0);
  assert.equal(raisingEdgeScroll({x:390,y:100},viewport,1000),9,'background resume does not jump the camera');
});
