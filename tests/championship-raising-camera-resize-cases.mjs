import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  initialRaisingReferenceViewport, sampleRaisingReferenceViewport, desktopRaisingViewportWidth, raisingFieldViewport, raisingNativeScreenPixels, resizeRaisingCamera,
  raisingNativeToScreen, raisingScreenToNative, wrapRaisingCamera,
  RAISING_TOP_HEADROOM_NATIVE
} from '../src/championship/presentation/intRh2/raisingFieldViewport.js';

// Controlled transform/callback coverage only. These are FIELD HOST dimensions,
// not screenshots or actual browser/Pixi layout measurements. Wide hosts leave
// a side panel plus the existing HUD/tool rows in their labelled outer window.
const views = [
  { label: 'portrait 390x844', width: 390, height: 675, desktopRaising: false },
  { label: 'landscape 844x390', width: 588, height: 221, desktopRaising: true },
  { label: 'landscape 932x430', width: 676, height: 261, desktopRaising: true },
  { label: 'short desktop 1366x480', width: 1046, height: 311, desktopRaising: true }
];
const base = Object.freeze({ worldWidthPx: 2688, worldHeightPx: 768,
  nativePixelWorldScale: 4, presentationMode: 'NATIVE_RANCH' });
const ring = Object.freeze({ ...base, wrapWidthPx: 2688 });
const fold = Object.freeze({ ...base, fold: Object.freeze({ ringPx: 4608,
  splitPx: 2688, bandOffsetPx: 704, capPx: 96, annexWidthPx: 1920 }) });
const locked = Object.freeze({ ...base, expansionPreview: Object.freeze({ bandOffsetPx: 704 }) });
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const fitAt = (field, view, camera) => raisingFieldViewport(field, { ...view, scrollY: camera.cameraY }, 12, camera.cameraX);
function centre(field, view, camera) {
  const fit = fitAt(field, view, camera);
  return { x: (view.width / 2 - fit.x) / fit.scale, y: (view.height / 2 - fit.y) / fit.scale };
}
function assertBounds(field, view, camera) {
  const fit = fitAt(field, view, camera);
  assert.ok(Number.isFinite(camera.cameraX) && Number.isFinite(camera.cameraY));
  assert.ok(camera.cameraX >= 0 && camera.cameraY >= (fit.scrollMinY ?? 0));
  if (field.wrapWidthPx) assert.ok(camera.cameraX < field.wrapWidthPx);
  else assert.ok(camera.cameraX <= Math.max(0, field.worldWidthPx - (view.width - 24) / fit.scale));
  assert.ok(camera.cameraY <= fit.scrollMaxY);
  close(fit.scrollY, camera.cameraY);
  close(fit.scale * field.nativePixelWorldScale, 2);
}

test('rotation preserves the wrapped world centre and phone-reference zoom, repeatedly', () => {
  const original = { cameraX: 2600, cameraY: 0 };
  let camera = original, view = views[0];
  const focal = centre(ring, view, camera);
  for (let cycle = 0; cycle < 20; cycle++) {
    for (const next of [...views.slice(1), views[0]]) {
      camera = resizeRaisingCamera(ring, view, next, camera);
      const actual = centre(ring, next, camera);
      close(wrapRaisingCamera(actual.x, ring.wrapWidthPx), wrapRaisingCamera(focal.x, ring.wrapWidthPx));
      close(actual.y, focal.y, 1); // board y is deliberately whole-screen-pixel aligned
      assertBounds(ring, next, camera);
      view = next;
    }
  }
  close(camera.cameraX, original.cameraX);
  close(camera.cameraY, original.cameraY, 0.5);
});

test('locked and expanded rows preserve stacked-world focus and remain geometrically identical', () => {
  for (const field of [locked, fold]) {
    const before = JSON.stringify(field), original = { cameraX: 900, cameraY: 73 };
    const focal = centre(field, views[0], original);
    for (const next of views.slice(1)) {
      const camera = resizeRaisingCamera(field, views[0], next, original);
      const actual = centre(field, next, camera);
      close(actual.x, focal.x);
      close(actual.y, focal.y, 1);
      assertBounds(field, next, camera);
      const back = resizeRaisingCamera(field, next, views[0], camera);
      close(back.cameraX, original.cameraX);
      close(back.cameraY, original.cameraY, 0.5);
    }
    assert.equal(JSON.stringify(field), before, 'resize must not write world geometry');
  }
});

test('non-wrapped camera uses the closest legal framing at either horizontal boundary', () => {
  for (const cameraX of [-900, 0, 99999]) for (const next of views.slice(1)) {
    const before = { cameraX, cameraY: 0 };
    const focal = centre(base, views[0], before);
    const after = resizeRaisingCamera(base, views[0], next, before), fit = fitAt(base, next, after);
    const requested = focal.x - (next.width / 2 - 12) / fit.scale;
    const maximum = Math.max(0, base.worldWidthPx - (next.width - 24) / fit.scale);
    close(after.cameraX, Math.min(maximum, Math.max(0, requested)));
    assertBounds(base, next, after);
  }
});

test('vertical bounds still permit full tallest-body headroom and both folded bands', () => {
  const short = views[1], tall = { width: 1046, height: 1100, desktopRaising: true };
  for (const field of [base, locked, fold]) {
    const toShort = resizeRaisingCamera(field, views[0], short, { cameraX: 100, cameraY: 1e6 });
    assertBounds(field, short, toShort);
    const fit = fitAt(field, short, toShort);
    const atTop = fitAt(field, short, { ...toShort, cameraY: fit.scrollMaxY });
    close(atTop.y, RAISING_TOP_HEADROOM_NATIVE * field.nativePixelWorldScale * atTop.scale);
    const atBottom = fitAt(field, short, { ...toShort, cameraY: 0 });
    const worldHeight = field.worldHeightPx + (field.fold?.bandOffsetPx ?? field.expansionPreview?.bandOffsetPx ?? 0);
    close(atBottom.y + worldHeight * atBottom.scale, short.height - 12);
    const toTall = resizeRaisingCamera(field, short, tall, toShort);
    // Free vertical pan preserves the old world focus where the new bounds
    // permit it; a fitting frame no longer forces its offset back to zero.
    const previous = fitAt(field, short, toShort);
    const focalY = (Math.floor(short.height / 2) - previous.y) / previous.scale;
    const origin = raisingFieldViewport(field, tall);
    const requestedY = Math.floor(tall.height / 2) - focalY * origin.scale - origin.y;
    close(toTall.cameraY, Math.max(origin.scrollMinY ?? 0, Math.min(origin.scrollMaxY, requestedY)));
    assertBounds(field, tall, toTall);
  }
});

test('native pointer coordinates round-trip on wrapped ring and both folded bands after every resize', () => {
  for (const field of [ring, fold]) {
    const points = field.fold ? [[40, 40], [400, 96], [772, 100], [1072, 140]]
      : [[20, 40], [400, 96], [660, -7]];
    let camera = { cameraX: 700, cameraY: field.fold ? 73 : 0 }, view = views[0];
    for (const next of [...views.slice(1), views[0]]) {
      camera = resizeRaisingCamera(field, view, next, camera);
      for (const [x, y] of points) {
        const viewport = { ...next, scrollY: camera.cameraY };
        const screen = raisingNativeToScreen([x * 4096, y * 4096], field, viewport, camera.cameraX);
        const native = raisingScreenToNative(screen, field, viewport, camera.cameraX);
        close(native.x, x); close(native.y, y);
        if (field.fold) assert.equal(native.band, x >= field.fold.splitPx / field.nativePixelWorldScale ? 1 : 0);
      }
      view = next;
    }
  }
});

test('focus endpoint is the same world target after portrait-to-wide reframe', () => {
  const targetWorldX = 1800, old = views[0], next = views[2];
  const scale = raisingFieldViewport(ring, old).scale;
  const target = { cameraX: targetWorldX - (old.width / 2 - 12) / scale, cameraY: 0 };
  const resized = resizeRaisingCamera(ring, old, next, target);
  const screen = raisingNativeToScreen([targetWorldX / 4 * 4096, 60 * 4096], ring,
    { ...next, scrollY: resized.cameraY }, resized.cameraX);
  close(screen.x, next.width / 2);
});

test('no-op resize and transient collapsed hosts cannot invent camera movement', () => {
  const camera = { cameraX: 321, cameraY: 73 };
  assert.deepEqual(resizeRaisingCamera(fold, views[0], views[0], camera), camera);
  for (const invalid of [{ width: 1, height: 1 }, { width: 0, height: 675 }, { width: NaN, height: 100 }]) {
    assert.deepEqual(resizeRaisingCamera(fold, views[0], invalid, camera), camera);
    assert.deepEqual(resizeRaisingCamera(fold, invalid, views[0], camera), camera);
  }
  assert.deepEqual(resizeRaisingCamera(null, views[0], views[1], camera), camera);
  assert.deepEqual(resizeRaisingCamera({ ...base, presentationMode: 'LEGACY' }, views[0], views[1], camera), camera);
});

const sceneSource = readFileSync(new URL('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js', import.meta.url), 'utf8');
function sceneFunction(start, end) {
  const from = sceneSource.indexOf(start), to = sceneSource.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} must remain inspectable`);
  return sceneSource.slice(from, to);
}
const scrollBoundsSource = sceneFunction('  const scrollMinY =', '\n  // World x');
const resizeSource = sceneFunction('  function resize() {', '\n  // A requested pan');
const cancelSource = sceneFunction('  function cancelInput(', '\n  const cancelHiddenInput');

// Execute exact scene callback bodies with explicit boundary stubs. This tests
// wiring and synchronous reentrancy, NOT the full Pixi/browser/domain runtime.
function callbackHarness(extra = {}) {
  const frame = Object.freeze({ selection: Object.freeze({ creatureId: 'resident-1' }), residents: Object.freeze([]) });
  const context = {
    responsiveLayout: true, disposed: false, scene: {}, fieldArt: { field: fold }, cameraX: 900, cameraY: 73, zoom: 1,
    app: { screen: { width: views[1].width, height: views[1].height } },
    view: { ...views[1] }, cameraViewport: { ...views[0], referenceViewport:{width:390,height:675} },
    raisingReference:{reference:{width:390,height:675},measured:true,pending:null},
    initialRaisingReferenceViewport, sampleRaisingReferenceViewport, desktopRaisingViewportWidth,
    cameraFocus: null, evolutionCamera: null, tutorialCameraOffset: 0,
    reducedMotion: false, assetFailures: 0, reportResidentAssets() {}, onFallback(error) { assert.fail(error); },
    PIXI: { Rectangle: class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } } },
    source: { getFrame: () => frame, intents: {} },
    raisingFieldViewport, resizeRaisingCamera, wrapRaisingCamera,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    syncCalls: [], sync(frame, options) { context.syncCalls.push({ frame, options }); },
    drag: null, cameraDrag: null, pointerPreview: null, cleanFeedback: null,
    backdrop: { cursor: 'grab' }, toolPreview: { visible: false }, ...extra
  };
  vm.createContext(context);
  vm.runInContext(`${scrollBoundsSource}\n${resizeSource}\n${cancelSource}`, context);
  return context;
}

test('controlled scene resize snapshots the old viewport and retains source frame/selection', () => {
  const context = callbackHarness();
  const expected = resizeRaisingCamera(fold, views[0], views[1], { cameraX: 900, cameraY: 73 });
  const selection = context.source.getFrame().selection;
  context.resize();
  close(context.cameraX, expected.cameraX); close(context.cameraY, expected.cameraY);
  assert.equal(context.cameraViewport.width, views[1].width);
  assert.equal(context.source.getFrame().selection, selection);
  assert.equal(context.syncCalls.length, 1);
  assert.equal(context.syncCalls[0].frame, context.source.getFrame());
  assert.equal(context.scene.hitArea.width, views[1].width);
  const cameraBefore = [context.cameraX, context.cameraY], viewportBefore = context.cameraViewport;
  context.view = { width: 1, height: 1 };
  context.resize();
  assert.deepEqual([context.cameraX, context.cameraY], cameraBefore);
  assert.equal(context.cameraViewport, viewportBefore);
});

test('controlled scene resize rebases an active card focus destination and remaining easing', () => {
  const cameraFocus = { from: 600, distance: 800, fromY: 60, distanceY: 70, elapsed: 100, duration: 380 };
  const context = callbackHarness({ cameraFocus });
  const target = resizeRaisingCamera(fold, views[0], views[1], { cameraX: 1400, cameraY: 130 });
  context.resize();
  close(context.cameraFocus.from, context.cameraX);
  close(context.cameraFocus.from + context.cameraFocus.distance, target.cameraX);
  close(context.cameraFocus.fromY + context.cameraFocus.distanceY, target.cameraY);
  assert.equal(context.cameraFocus.duration, 280);
  assert.equal(context.cameraFocus.elapsed, 0);
  const focus = context.cameraFocus;
  context.resize();
  assert.equal(context.cameraFocus, focus, 'same-size renderer/DPR notification does not restart easing');
});

test('controlled cancellation clears input before intent publication and keeps selection', () => {
  const root = { cursor: 'grabbing', destroyed: false }, calls = [];
  const context = callbackHarness({
    drag: { creatureId: 'resident-1', entry: { root }, nativeHand: true, carried: true, tutorialCheckpoint: { stage: 'carry' } },
    cameraDrag: { pointerId: 7 }, pointerPreview: { held: true }, cleanFeedback: { point: { x: 20, y: 40 } },
    backdrop: { cursor: 'grabbing' }, toolPreview: { visible: true }
  });
  context.source.intents = {
    endHand(id, options) {
      assert.equal(context.drag, null); assert.equal(context.cameraDrag, null);
      calls.push({ id, options });
    },
    releaseCarry() { assert.fail('native hand has one cancellation owner'); },
    selectCreature() { assert.fail('resize must retain selection'); },
    relocateCreature() { assert.fail('resize must not become a new drop'); }
  };
  context.cancelInput('viewport-resize'); context.cancelInput('viewport-resize');
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 'resident-1');
  assert.equal(calls[0].options.cancelled, true);
  assert.equal(calls[0].options.reason, 'viewport-resize');
  assert.equal(context.pointerPreview, null); assert.equal(context.cleanFeedback, null);
  assert.equal(context.toolPreview.visible, false);
  assert.equal(root.cursor, 'grab'); assert.equal(context.backdrop.cursor, 'grab');
  assert.equal(context.source.getFrame().selection.creatureId, 'resident-1');
});

test('source contract: resize keeps one stage subscription/ticker and loading/disposal guards', () => {
  assert.match(sceneSource, /stage\.onResize\(\(\)=>\{zoomInput\?\.reset\(\);cancelInput\([^)]*\);resize\(\);\}\)/);
  assert.equal((sceneSource.match(/app\.ticker\.add\(updateAnimations\)/g) ?? []).length, 1);
  assert.equal((sceneSource.match(/app\.ticker\.remove\(updateAnimations\)/g) ?? []).length, 1);
  assert.doesNotMatch(resizeSource, /createSceneRoot|new\s+(?:PIXI\.)?Application|setTimeout|setInterval|loadActorTextures|selectCreature|relocateCreature/);
  assert.match(sceneSource, /careArt = [\s\S]*await loadCareArt\(\)[\s\S]*lifetime\.signal\.throwIfAborted\(\)/);
  assert.match(sceneSource, /if \(disposed \|\| token !== entry\.loadToken\)/);
  const disposal = sceneSource.slice(sceneSource.indexOf('    dispose() {'));
  for (const required of ['cancelInput();', 'unobserveResize();', 'unsubscribe();', 'unobserveContextLost();', "app.canvas.removeEventListener('pointercancel',cancelNativePointer)"])
    assert.ok(disposal.includes(required), required);
  assert.doesNotMatch(disposal, /app\.destroy\(/);
});


test('controlled cancellation sends rollback reason only for resize, including the legacy carry seam', () => {
  for (const reason of [undefined, { type: 'blur' }, 'viewport-resize']) {
    const calls = [], context = callbackHarness({
      drag: { creatureId: 'resident-1', entry: { root: { destroyed: false } }, carried: true }
    });
    context.source.intents.releaseCarry = (id, options) => calls.push({ id, options });
    context.cancelInput(reason);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.cancelled, true);
    assert.equal(calls[0].options.reason, reason === 'viewport-resize' ? reason : undefined);
  }
});

test('controlled tutorial resize does not count reframe displacement as player camera progress', () => {
  const context = callbackHarness({ tutorialCameraOffset: 11 });
  const frame = { tutorial: { finished: false }, selection: { creatureId: 'resident-1' } };
  context.source.getFrame = () => frame;
  const before = context.cameraX / fold.nativePixelWorldScale - context.tutorialCameraOffset;
  context.resize();
  close(context.cameraX / fold.nativePixelWorldScale - context.tutorialCameraOffset, before);
  assert.equal(context.source.getFrame(), frame);
});

test('controlled evolution resize keeps current pan position and world destination without resetting phase', () => {
  const context = callbackHarness({ evolutionCamera: { id: 'resident-1', start: 500, target: 1500 } });
  const progress = (context.cameraX - 500) / 1000;
  const target = resizeRaisingCamera(fold, views[0], views[1], { cameraX: 1500, cameraY: context.cameraY });
  context.resize();
  close(context.evolutionCamera.start + (context.evolutionCamera.target - context.evolutionCamera.start) * progress, context.cameraX);
  close(context.evolutionCamera.target, target.cameraX);
  assert.equal(context.evolutionCamera.id, 'resident-1');
});

test('controlled late resident load uses resized camera; disposal ignores the pending result', async () => {
  const loadSource = sceneFunction('  async function loadActorTextures(', '\n  function reportResidentAssets');
  for (const disposeBeforeReady of [false, true]) {
    let resolve, createCount = 0;
    const pending = new Promise(done => { resolve = done; });
    const context = callbackHarness({ characterBundle: {
      ensureSpecies: () => pending,
      createActor: () => { createCount++; return { sprite: {}, nativeSizing: {} }; }
    } });
    vm.runInContext(loadSource, context);
    const entry = { sprite: null, loadToken: 0, shadow: {}, fallback: { destroy() {} },
      root: { removeChild() {}, addChildAt() {} } };
    const root = entry.root;
    const load = context.loadActorTextures(entry, { speciesId: 'championship:creature:species-201' });
    assert.equal(entry.assetState, 'loading');
    context.resize();
    const camera = [context.cameraX, context.cameraY];
    if (disposeBeforeReady) { context.disposed = true; entry.loadToken++; }
    resolve(true); await load;
    assert.deepEqual([context.cameraX, context.cameraY], camera);
    assert.equal(entry.root, root);
    assert.equal(createCount, disposeBeforeReady ? 0 : 1);
    assert.equal(entry.assetState, disposeBeforeReady ? 'loading' : 'ready');
    assert.equal(context.syncCalls.length, disposeBeforeReady ? 1 : 2);
  }
});

test('alternating odd/even host heights cannot accumulate vertical half-pixel drift', () => {
  const original = { cameraX: 900, cameraY: 73 };
  let camera = original, view = views[0];
  const sequence = [{ ...views[1], height: 220 }, { ...views[2], height: 262 },
    { ...views[3], height: 311 }, { ...views[0], height: 674 }, views[0]];
  for (let cycle = 0; cycle < 100; cycle++) for (const next of sequence) {
    camera = resizeRaisingCamera(fold, view, next, camera); view = next;
  }
  close(camera.cameraX, original.cameraX);
  close(camera.cameraY, original.cameraY, 0.5);
  for (const view of views) assert.equal(raisingNativeScreenPixels(fold, view), 2);
});

test('small/short portrait reference keeps exact zoom across wide rotations for different native field heights',()=>{
 for(const nativeHeight of [112,176,192])for(const [width,height] of [[320,399],[360,571],[390,675],[430,763],[320,260],[390,300]]){
  const field={...ring,worldHeightPx:nativeHeight*4};const referenceViewport={width,height};
  const portrait={width,height,referenceViewport};const expected=raisingNativeScreenPixels(field,{width,height});
  for(const [w,h]of[[464,151],[588,221],[676,261],[1046,311],[width,height]]){
   const next={width:w,height:h,desktopRaising:w!==width,referenceViewport};
   assert.equal(raisingNativeScreenPixels(field,next),expected,`${nativeHeight}: ${width}x${height} -> ${w}x${h}`);
   const camera=resizeRaisingCamera(field,portrait,next,{cameraX:700,cameraY:73});
   const fit=fitAt(field,next,camera);assert.ok(camera.cameraY>=(fit.scrollMinY??0)&&camera.cameraY<=(fit.scrollMaxY??0));assert.ok(camera.cameraX>=0);
   const point={x:42,y:67};const p=raisingNativeToScreen([point.x*4096,point.y*4096],field,next,camera.cameraX);
   const back=raisingScreenToNative(p,field,next,camera.cameraX);close(back.x,point.x);close(back.y,point.y);
  }
 }
 const short={...ring,worldHeightPx:448};
 assert.equal(raisingNativeScreenPixels(short,{width:320,height:399}),2);
 assert.equal(raisingNativeScreenPixels(short,{width:464,height:151,desktopRaising:true}),3,'reproduces old unreferenced gate');
});
test('direct landscape fallback uses outer layout dimensions, and desktop keeps canonical policy',()=>{
 for(const [width,height,expected]of[[720,320,{width:320,height:551}],[844,390,{width:390,height:675}],[932,430,{width:430,height:763}],[1366,480,{width:390,height:675}],[1366,768,{width:390,height:675}]]){
  assert.deepEqual(initialRaisingReferenceViewport({width,height}),expected);
 }
 assert.deepEqual(initialRaisingReferenceViewport({width:390,height:844}),{width:390,height:675});
 assert.deepEqual(initialRaisingReferenceViewport({width:1,height:1}),{width:390,height:675});
});
test('reference sampling rejects unmeasured HUD/collapsed/wide hosts and allows late real portrait updates',()=>{
 let s={reference:initialRaisingReferenceViewport({width:720,height:320}),measured:false,pending:null};
 const fallback=s.reference,portrait={width:320,height:399},sample=(v,opts)=>{s=sampleRaisingReferenceViewport(s,v,opts);};
 for(const [v,o]of[[portrait,{portrait:true,ready:false}],[{width:1,height:1},{portrait:true,ready:true}],[{width:464,height:151},{portrait:false,ready:true}]]){sample(v,o);assert.equal(s.reference,fallback);}
 sample(portrait,{portrait:true,ready:true});assert.equal(s.reference,fallback);
 sample(portrait,{portrait:true,ready:true});assert.deepEqual(s.reference,portrait);assert.ok(s.measured);
 const measured=s.reference;sample({width:464,height:151},{portrait:false,ready:true});assert.equal(s.reference,measured);
 sample({width:320,height:350},{portrait:true,ready:true});assert.equal(s.reference,measured);
 sample({width:320,height:350},{portrait:true,ready:true});assert.deepEqual(s.reference,{width:320,height:350},'late translated/large HUD can update actual portrait');
 const settled=s;sample({width:320,height:350},{portrait:true,ready:true});assert.equal(s,settled,'no perpetual reframe');
});
test('reference is dimensions, not a frozen zoom: changed field recomputes native algorithm and ring cap',()=>{
 const referenceViewport={width:390,height:675},a={...ring,worldHeightPx:448},b={...ring,worldHeightPx:768};
 const view={width:1046,height:311,desktopRaising:true,referenceViewport};
 assert.equal(raisingNativeScreenPixels(a,view),3);assert.equal(raisingNativeScreenPixels(b,view),2);
 assert.equal(desktopRaisingViewportWidth(a,12,{width:320,height:399}),1368);
 assert.equal(desktopRaisingViewportWidth(a,12,referenceViewport),2040);
});
test('controlled measured reference adoption cancels once, preserves selection and reprojects old reference focus',()=>{
 const portrait={width:320,height:300,desktopRaising:false};
 const context=callbackHarness({view:portrait,fieldArt:{field:{...ring,worldHeightPx:448}},
  raisingReference:{reference:{width:390,height:675},measured:false,pending:null},
  window:{innerWidth:320,innerHeight:720},document:{body:{hasAttribute:()=>false,dataset:{statusBar:'on',toolbar:'on'},style:{getPropertyValue:()=> '60px'}},getElementById:()=>({hidden:false})}});
 Object.defineProperty(portrait,'referenceViewport',{get:()=>context.raisingReference.reference,enumerable:true});
 const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 vm.runInContext(main.match(/function readRaisingLayoutSample\(\) \{[\s\S]*?\n\}/)[0],context);
 context.getLayoutSample=vm.runInContext('readRaisingLayoutSample',context);
 vm.runInContext(sceneFunction('  function samplePortraitReference() {','\n  // Reframe the existing scene'),context);
 context.resize();const before=context.source.getFrame();let cancelled=0;
 context.source.intents.endHand=()=>{cancelled++;assert.equal(context.drag,null);};
 context.drag={nativeHand:true,creatureId:'resident-1',entry:{root:{}},tutorialCheckpoint:null};
 context.samplePortraitReference();assert.equal(cancelled,0);context.samplePortraitReference();assert.equal(cancelled,1);
 assert.equal(context.source.getFrame(),before);assert.equal(context.source.getFrame().selection.creatureId,'resident-1');
 assert.deepEqual({...context.cameraViewport.referenceViewport},{width:320,height:300});
 assert.equal(raisingNativeScreenPixels(context.fieldArt.field,context.view),2);
 context.samplePortraitReference();context.resize();assert.equal(cancelled,1,'second resize cannot repeat old drop/cancel');
 context.disposed=true;context.view.height=220;context.samplePortraitReference();context.samplePortraitReference();assert.equal(context.raisingReference.reference.height,300);
});
test('resize invalidates pending portrait sample even when the ticker pauses through wide and back',()=>{
 const context=callbackHarness({raisingReference:{reference:{width:390,height:675},measured:false,pending:{width:320,height:300}}});
 context.resize();assert.equal(context.raisingReference.pending,null);
 context.view.width=320;context.view.height=300;context.view.desktopRaising=false;context.resize();
 const next=sampleRaisingReferenceViewport(context.raisingReference,context.view,{portrait:true,ready:true});
 assert.equal(next.measured,false);assert.deepEqual({...next.reference},{width:390,height:675});assert.deepEqual({...next.pending},{width:320,height:300});
});

test('visibility/blur cancellation invalidates a pending reference sample without changing its reference',()=>{
 const context=callbackHarness({raisingReference:{reference:{width:320,height:399},measured:true,pending:{width:320,height:350}}});
 const reference=context.raisingReference.reference;context.cancelInput();
 assert.equal(context.raisingReference.pending,null);assert.equal(context.raisingReference.reference,reference);
 assert.match(sceneSource,/const cancelHiddenInput=\(\)=>\{if\(globalThis.document\?\.hidden\)\{zoomInput\?\.reset\(\);cancelInput\(\);\}\}/);
});

// Exercise the real signed-bound declarations, not a constant-zero stub.
test('controlled resize retains negative fitting-board pan and clamps both out-of-range signs', () => {
  const field={...base,worldHeightPx:384};
  const view={width:390,height:675,desktopRaising:false};
  const bounds=raisingFieldViewport(field,view);
  assert.ok(bounds.scrollMinY<0&&bounds.scrollMaxY>0);
  for(const cameraY of [-60,-1e6,1e6]) {
    const context=callbackHarness({fieldArt:{field},view:{...view},
      cameraViewport:{...view,referenceViewport:{width:390,height:675}},cameraY,
      app:{screen:{width:390,height:675}}});
    context.resize();
    close(context.cameraY,Math.max(bounds.scrollMinY,Math.min(bounds.scrollMaxY,cameraY)));
    assert.equal(context.syncCalls.length,1);
  }
});
