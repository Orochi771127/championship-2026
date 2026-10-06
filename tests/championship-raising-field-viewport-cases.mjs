import assert from 'node:assert/strict';
import test from 'node:test';
import { raisingFieldViewport, raisingRegionBounds, raisingNativeToScreen, raisingScreenToNative, wrapRaisingCamera, raisingEdgeScroll,
  raisingNativeScreenPixels, RAISING_MIN_NATIVE_SCREEN_PIXELS, RAISING_MAX_NATIVE_SCREEN_PIXELS, RAISING_MIN_VISIBLE_NATIVE_WIDTH,
  RAISING_TALLEST_BODY_NATIVE, RAISING_TOP_EDGE_FOOT_OVERHANG_NATIVE, RAISING_TOP_HEADROOM_NATIVE } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
import { BATTLE_CHARACTER_GEOMETRY } from '../src/data/championship/battleCharacterGeometry.js';
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
  // 2026-09-29: no band is held back for a readout; the board sits in the
  // middle of the frame and cards float over the margin instead.
  assert.ok(Math.abs(fit.y+fit.height/2-viewport.height/2)<=0.5,'the ranch is centred in the frame');
  assert.ok(fit.y>=12-1e-7&&fit.y+fit.height<=viewport.height-12+1e-7,'and fits inside it');
});

test('edge scroll continues at stationary pointer, respects direction and stops outside the field',()=>{
  const viewport={width:390,height:330};
  assert.equal(raisingEdgeScroll({x:195,y:100},viewport,16),0);
  assert.ok(raisingEdgeScroll({x:5,y:100},viewport,16)<0);
  assert.ok(raisingEdgeScroll({x:385,y:100},viewport,16)>0);
  for(const p of [{x:-1,y:100},{x:391,y:100},{x:2,y:-1},{x:388,y:331}])assert.equal(raisingEdgeScroll(p,viewport,16),0);
  assert.equal(raisingEdgeScroll({x:390,y:100},viewport,1000),9,'background resume does not jump the camera');
});

test('the ranch takes the largest whole pixel scale that fits with its headroom, keeps neighbouring cells in view and retains pointer round trips',()=>{
  const field={worldWidthPx:2688,worldHeightPx:768,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
  // A 192-native-pixel board on a phone, a tablet and a large tablet frame.
  // 2026-10-05: the headroom for the tallest body is fitted with the board, so
  // these step down from 3/5/6 (board only, which cut tall bodies off).
  const screens=[{width:370,height:740,expected:2},{width:800,height:1076,expected:3},{width:1004,height:1262,expected:4}];
  for(const screen of screens){
    const fit=raisingFieldViewport(field,screen);
    const nativeScale=fit.scale*field.nativePixelWorldScale;
    const boardNative=field.worldHeightPx/field.nativePixelWorldScale;
    const headroom=RAISING_TOP_HEADROOM_NATIVE*nativeScale;
    assert.equal(nativeScale,screen.expected);
    assert.equal(nativeScale,raisingNativeScreenPixels(field,screen));
    assert.ok(Number.isInteger(nativeScale)&&nativeScale>=RAISING_MIN_NATIVE_SCREEN_PIXELS&&nativeScale<=RAISING_MAX_NATIVE_SCREEN_PIXELS,
      'every native pixel is the same whole number of screen pixels');
    assert.equal(fit.scrollMaxY,0,'these frames need no vertical scroll');
    assert.ok(fit.y-headroom>=0&&fit.y+fit.height<=screen.height-12+1e-7,'the headroom and the whole board both fit the frame');
    assert.ok((nativeScale+1)*(boardNative+RAISING_TOP_HEADROOM_NATIVE)>screen.height-12,'one more whole step would not fit');
    assert.ok((screen.width-24)/nativeScale>=RAISING_MIN_VISIBLE_NATIVE_WIDTH,'at least 2⅓ board columns stay in view');
    assert.ok(Math.abs((fit.y-headroom+fit.y+fit.height)/2-(screen.height-12)/2)<=0.5,'the headroom and board are centred together');
    for(const camera of [-20,0,2600,5390])for(const point of [
      {x:12,y:fit.y+20},{x:screen.width/2,y:fit.y+fit.height/2},{x:screen.width-12,y:fit.y+fit.height-20}
    ]){
      const native=raisingScreenToNative(point,field,screen,camera);
      const projected=raisingNativeToScreen([native.x*4096,native.y*4096],field,screen,camera);
      assert.ok(Math.abs(projected.x-point.x)<1e-7);
      assert.ok(Math.abs(projected.y-point.y)<1e-7);
    }
  }
});

test('a frame too short for two whole pixels still shows the whole board height',()=>{
  const field={worldWidthPx:2688,worldHeightPx:768,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
  const screen={width:390,height:300};
  const fit=raisingFieldViewport(field,screen);
  const nativeScale=fit.scale*field.nativePixelWorldScale;
  assert.ok(nativeScale<RAISING_MIN_NATIVE_SCREEN_PIXELS);
  assert.ok(Math.abs(fit.height-(screen.height-24))<1e-7,'the board fills the short frame instead of spilling out of it');
  const point={x:screen.width/2,y:fit.y+fit.height/2};
  const native=raisingScreenToNative(point,field,screen,40);
  const back=raisingNativeToScreen([native.x*4096,native.y*4096],field,screen,40);
  assert.ok(Math.abs(back.x-point.x)<1e-7&&Math.abs(back.y-point.y)<1e-7);
});

test('the ranch headroom is the tallest shipped body plus the original top-edge foot overhang',()=>{
  // Recomputed from the geometry the roster loads, so a taller character
  // added later fails here instead of being cut off on the ranch.
  let tallest=0;
  for(const entity of Object.values(BATTLE_CHARACTER_GEOMETRY))
    for(const frame of Object.values(entity.frames))if(!frame.blank&&frame.nativeBounds)tallest=Math.max(tallest,-frame.nativeBounds[1]);
  assert.equal(RAISING_TALLEST_BODY_NATIVE,tallest);
  // OVL18 0x0211208C..B4: tile row = trunc(y/8), so feet at y=-7..-1 still stand on row 0.
  assert.equal(RAISING_TOP_EDGE_FOOT_OVERHANG_NATIVE,7);
  assert.equal(RAISING_TOP_HEADROOM_NATIVE,tallest+7);
});

test('phone and tablet frames keep the tallest body above the board inside the frame at whole pixels',()=>{
  // The composed starting ranch is 176 native pixels tall; 192 is the full ground.
  for(const worldHeightPx of [704,768]){
    const field={worldWidthPx:2688,worldHeightPx,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
    // Browser 390x844 Home, an iPhone with Safari's bars, a larger phone, a
    // 360-wide Android and two tablets.
    for(const screen of [{width:390,height:723},{width:390,height:547},{width:430,height:620},{width:360,height:563},{width:820,height:990},{width:1004,height:1262}]){
      const fit=raisingFieldViewport(field,screen);
      const nativeScale=fit.scale*4;
      assert.ok(Number.isInteger(nativeScale)&&nativeScale>=2,`${screen.width}x${screen.height}: whole pixels`);
      if(fit.scrollMaxY===0){
        // Feet at the top-edge overhang (-7) with the tallest body above them.
        const bodyTop=raisingNativeToScreen([0,-RAISING_TOP_EDGE_FOOT_OVERHANG_NATIVE*4096],field,screen,0).y-RAISING_TALLEST_BODY_NATIVE*nativeScale;
        assert.ok(bodyTop>=-1e-7,`${screen.width}x${screen.height}: the tallest body stays inside the frame`);
        assert.ok(fit.y+fit.height<=screen.height-12+1e-7,`${screen.width}x${screen.height}: the board bottom stays inside the frame`);
      }
    }
  }
});

test('a frame short of room for the headroom keeps two whole pixels and scrolls vertically instead of blurring',()=>{
  const field={worldWidthPx:2688,worldHeightPx:704,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
  const screen={width:375,height:427};
  const fit=raisingFieldViewport(field,screen);
  assert.equal(fit.scale*4,2,'still two whole screen pixels per native pixel');
  assert.equal(fit.scrollY,0);
  assert.ok(Math.abs(fit.y+fit.height-(screen.height-12))<=0.5,'by default the whole board shows, resting on the bottom padding');
  const expectedMax=RAISING_TOP_HEADROOM_NATIVE*2+fit.height-(screen.height-12);
  assert.ok(Math.abs(fit.scrollMaxY-expectedMax)<1e-7&&fit.scrollMaxY>0);
  const lowered=raisingFieldViewport(field,{...screen,scrollY:fit.scrollMaxY});
  assert.ok(Math.abs(lowered.y-RAISING_TOP_HEADROOM_NATIVE*2)<=0.5,'scrolled fully, the headroom is exactly the space above the board');
  assert.equal(raisingFieldViewport(field,{...screen,scrollY:1e6}).y,lowered.y,'scroll is clamped at its maximum');
  assert.equal(raisingFieldViewport(field,{...screen,scrollY:-40}).y,fit.y,'and at zero');
  // Art, residents and input share the scrolled placement.
  for(const scrollY of [0,fit.scrollMaxY/2,fit.scrollMaxY]){
    const view={...screen,scrollY};
    for(const native of [[30,-7],[200,80],[600,159]]){
      const point=raisingNativeToScreen([native[0]*4096,native[1]*4096],field,view,500);
      const back=raisingScreenToNative(point,field,view,500);
      assert.ok(Math.abs(back.x-native[0])<1e-7&&Math.abs(back.y-native[1])<1e-7);
    }
  }
});
