const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, startGame } = require("./championship-browser-opening.cjs");
const ORIGIN = process.env.CHAMPIONSHIP_QA_ORIGIN || "http://127.0.0.1:8732";
const OUTPUT = require("./browser-qa-output.cjs")("battle-cube-v1");
// Six mode faces since the 2026-09-15 password/practice wiring; the texture
// pack still covers the four side faces.
const FACE_COUNT = 6;
const VIEWPORTS = [ {width:360,height:800}, {width:390,height:844}, {width:393,height:852}, {width:412,height:915}, {width:430,height:932} ];
fs.mkdirSync(OUTPUT, {recursive:true});

async function fixture(page) {
  await page.goto(`${ORIGIN}/tests/fixtures/battle-cube.html`);
  await page.waitForFunction(() => window.cube);
  await page.evaluate(() => window.cube.ready);
}

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const report = { viewports:[], failureFallback:false, disposalRace:false, webglFallback:false, realAppFlow:false };
  try {
    const context = await browser.newContext({viewport:VIEWPORTS[1],deviceScaleFactor:2});
    const page = await context.newPage();
    const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    await fixture(page);
    assert.equal(await page.evaluate(()=>window.cube.getDiagnostics().textureCount),4);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(()=>Math.abs(document.querySelector('canvas').width-document.querySelector('#host').clientWidth*2)<3);
      const info=await page.evaluate(()=>({
        diagnostics:window.cube.getDiagnostics(),overflow:document.documentElement.scrollWidth>innerWidth,
        buttons:[...document.querySelectorAll('.cm-vs5-cube__face')].map(b=>({text:b.textContent,disabled:b.disabled,height:b.getBoundingClientRect().height}))
      }));
      assert.equal(info.overflow,false); assert.equal(info.diagnostics.textureCount,4);
      assert.equal(info.buttons.length,FACE_COUNT);
      assert.ok(info.buttons.every(b=>b.height>=44&&b.disabled));
      report.viewports.push({ ...viewport, ...info });
    }
    const canvas=page.locator('canvas');
    await canvas.focus(); const before=await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion);
    await page.keyboard.press('ArrowRight');
    const after=await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion);
    const angle=2*Math.acos(Math.min(1,Math.abs(before.reduce((dot,value,i)=>dot+value*after[i],0))));
    assert.ok(Math.abs(angle-Math.PI/12)<1e-6);
    assert.equal(await page.evaluate(()=>window.cube.getDiagnostics().uiLabelTextureCount),2);
    const rect=await canvas.boundingBox();
    await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height*.4);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.4,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    await page.screenshot({path:path.join(OUTPUT,'cube-rotated.png')});
    // Vertical and diagonal motion retain an arbitrary orientation after release.
    for (const [dx,dy] of [[0,70],[65,-55]]) {
      const old=await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion);
      const x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
      const changed=await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion);
      assert.notDeepEqual(changed,old);
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion),changed);
    }
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    // 15-degree arrow steps, including top/bottom faces; no fixed 90-degree snap.
    for (const key of ['ArrowRight','ArrowRight','ArrowUp','ArrowDown']) {
      for(let step=0;step<6;step++)await page.keyboard.press(key);
      await page.screenshot({path:path.join(OUTPUT,`cube-orientation-${key}-${Date.now()}.png`)});
    }
    // Both cancellation paths release their pointer and never become a tap.
    for (const cancel of ['pointercancel','touchcancel']) {
      const result=await page.evaluate(cancel=>{
        const canvas=document.querySelector('canvas'),rect=canvas.getBoundingClientRect();
        const event={pointerId:77,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2};
        // Synthetic pointers cannot own browser capture. Replace only in this
        // targeted cancellation check; real pointer drag coverage is above.
        const set=canvas.setPointerCapture,release=canvas.releasePointerCapture;
        canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
        try {
          canvas.dispatchEvent(new PointerEvent('pointerdown',event));
          const started=window.cube.getDiagnostics().dragging;
          canvas.dispatchEvent(cancel==='touchcancel'?new Event(cancel):new PointerEvent(cancel,event));
          canvas.dispatchEvent(new PointerEvent('pointerup',event));
          return {started,dragging:window.cube.getDiagnostics().dragging,calls:window.selectionCalls.length};
        } finally {canvas.setPointerCapture=set;canvas.releasePointerCapture=release;}
      },cancel);
      assert.deepEqual(result,{started:true,dragging:false,calls:0});
    }
    await page.evaluate(()=>{
      window.cube.dispose();window.cube.dispose();
      window.mountCube({available:new Set(['FREE_BATTLE'])});
    });
    await page.evaluate(()=>window.cube.ready);
    await page.click('[data-face-id="FREE_BATTLE"]');
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['FREE_BATTLE']);
    // Canvas tap selects a mode once; dragging it never dispatches a mode.
    await page.evaluate(()=>{window.cube.dispose();window.selectionCalls=[];window.mountCube({available:null});});
    await page.evaluate(()=>window.cube.ready);
    const activeRect=await page.locator('canvas').boundingBox();
    const cx=activeRect.x+activeRect.width/2,cy=activeRect.y+activeRect.height/2;
    await page.mouse.click(cx,cy);
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),1);
    assert.ok(['CHAMPIONSHIP','TITLE_MATCH','FREE_BATTLE','LINK_BATTLE','PASSWORD_BATTLE','PRACTICE_BATTLE'].includes(await page.evaluate(()=>window.cube.getSelected())));
    await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+50,cy+40,{steps:10});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),1);
    // Reduced motion has no inertia or deferred rotation either.
    await page.emulateMedia({reducedMotion:'reduce'});
    const stable=await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(()=>window.cube.getDiagnostics().rotationQuaternion),stable);
    // Late successful and rejected loads must not resurrect a disposed presenter.
    await page.evaluate(()=>{
      window.cube.dispose();window.pending=[];window.disposals=0;
      window.mountCube({textureLoader:{loadAsync(){return new Promise((resolve,reject)=>window.pending.push({resolve,reject}));}}});
      window.cube.dispose();
      window.pending.forEach((p,i)=>{if(i===3)p.reject(new Error('late failure'));else{const t=window.makeTexture();t.addEventListener('dispose',()=>window.disposals++);p.resolve(t);}});
    });
    await page.evaluate(()=>window.cube.ready);
    assert.deepEqual(await page.evaluate(()=>({released:window.disposals,canvases:document.querySelectorAll('canvas').length,attribute:document.querySelector('#host').hasAttribute('data-cube-textures')})),{released:3,canvases:0,attribute:false});
    report.disposalRace=true;
    await page.route('**/menu-cube-v1/title-match.png',route=>route.abort());
    await fixture(page);
    const failed=await page.evaluate(()=>window.cube.getDiagnostics());
    assert.equal(failed.textureCount,3);assert.equal(failed.textureStates.TITLE_MATCH,'FALLBACK_COLOUR');
    assert.equal(await page.locator('.cm-vs5-cube__face').count(),FACE_COUNT);report.failureFallback=true;
    await page.screenshot({path:path.join(OUTPUT,'texture-failure.png')});
    await page.unroute('**/menu-cube-v1/title-match.png');
    assert.deepEqual(errors,[]);
    await context.close();
    const fallbackContext=await browser.newContext({viewport:VIEWPORTS[1]});
    await fallbackContext.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};});
    const flat=await fallbackContext.newPage();await fixture(flat);
    assert.equal(await flat.evaluate(()=>window.cube.getDiagnostics().renderer),'DOM_BATTLE_CUBE_FALLBACK');
    assert.equal(await flat.locator('.cm-vs5-cube__face').count(),FACE_COUNT);assert.equal(await flat.locator('img').count(),4);
    await flat.screenshot({path:path.join(OUTPUT,'webgl-fallback.png')});report.webglFallback=true;await fallbackContext.close();
    // Real application entry, return and repeated mount at the mobile contracts.
    const appContext=await browser.newContext({viewport:VIEWPORTS[1],deviceScaleFactor:2});
    const app=await appContext.newPage();const appErrors=[];app.on('pageerror',e=>appErrors.push(e.message));
    // Use the repository's isolated QA save: new games now intentionally lock
    // SYSTEM during the onboarding tutorial, which is outside this cube gate.
    await app.goto(`${ORIGIN}/full-qa-save.html`,{waitUntil:'networkidle'});
    await app.click('#install');await app.waitForURL(`${ORIGIN}/championship.html`);
    await startGame(app,{continueGame:true});
    await app.waitForSelector('[data-screen="RAISING_HOME"]');
    report.homeMenus=await app.locator('[data-menu-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.menuId));
    await app.locator('button[data-menu-id="SYSTEM"]').click();
    await app.click('[data-entry-id="battle"]');
    await app.waitForSelector('[data-screen="BATTLE_SELECT"] [data-cube-textures="4"]');
    for(const viewport of VIEWPORTS){
      await app.setViewportSize(viewport);
      await app.screenshot({path:path.join(OUTPUT,`app-${viewport.width}x${viewport.height}.png`),fullPage:true});
      assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    // Every mode is wired in the real application, so no face stays disabled.
    assert.equal(await app.locator('.cm-vs5-cube__face').count(),FACE_COUNT);
    assert.equal(await app.locator('.cm-vs5-cube__face:disabled').count(),0);
    await app.click('.cm-vs5-exit');await app.waitForSelector('[data-screen="RAISING_HOME"]');
    assert.equal(await app.locator('canvas[data-renderer="THREE_BOUNDED_BATTLE_SELECT"]').count(),0);
    await app.locator('button[data-menu-id="SYSTEM"]').click();await app.click('[data-entry-id="battle"]');
    await app.waitForSelector('[data-cube-textures="4"]');
    assert.equal(await app.locator('canvas[data-renderer="THREE_BOUNDED_BATTLE_SELECT"]').count(),1);
    assert.deepEqual(appErrors,[]);report.realAppFlow=true;await appContext.close();
    report.status='PASS';fs.writeFileSync(path.join(OUTPUT,'browser-qa.json'),JSON.stringify(report,null,2)+'\n');
    console.log('BATTLE_CUBE_BROWSER_PASS viewports=5 textures=4 failure_fallback=PASS late_dispose=PASS webgl_fallback=PASS app_reentry=PASS');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
