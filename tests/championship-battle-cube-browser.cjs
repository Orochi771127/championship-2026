const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, startGame } = require("./championship-browser-opening.cjs");
const ORIGIN = process.env.CHAMPIONSHIP_QA_ORIGIN || "http://127.0.0.1:8732";
const OUTPUT = "docs/reports/battle-cube-v1";
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
        buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,disabled:b.disabled,height:b.getBoundingClientRect().height}))
      }));
      assert.equal(info.overflow,false); assert.equal(info.diagnostics.textureCount,4);
      assert.ok(info.buttons.every(b=>b.height>=44&&b.disabled));
      report.viewports.push({ ...viewport, ...info });
    }
    const canvas=page.locator('canvas');
    await canvas.focus(); const before=await page.evaluate(()=>window.cube.getDiagnostics().rotation);
    await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs(await page.evaluate(()=>window.cube.getDiagnostics().rotation)-before-Math.PI/2)<1e-6);
    const rect=await canvas.boundingBox();
    await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height*.4);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.4,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    await page.screenshot({path:path.join(OUTPUT,'cube-rotated.png')});
    // Check every face-on direction so reversed/back-side UV text cannot hide.
    for (let i=0;i<4;i++) {
      await page.keyboard.press('ArrowRight');
      await page.screenshot({path:path.join(OUTPUT,`cube-side-${i}.png`)});
    }
    await page.evaluate(()=>{
      window.cube.dispose();window.cube.dispose();
      window.mountCube({available:new Set(['FREE_BATTLE'])});
    });
    await page.evaluate(()=>window.cube.ready);
    await page.click('[data-face-id="FREE_BATTLE"]');
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['FREE_BATTLE']);
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
    assert.equal(await page.locator('button').count(),4);report.failureFallback=true;
    await page.screenshot({path:path.join(OUTPUT,'texture-failure.png')});
    await page.unroute('**/menu-cube-v1/title-match.png');
    assert.deepEqual(errors,[]);
    await context.close();
    const fallbackContext=await browser.newContext({viewport:VIEWPORTS[1]});
    await fallbackContext.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};});
    const flat=await fallbackContext.newPage();await fixture(flat);
    assert.equal(await flat.evaluate(()=>window.cube.getDiagnostics().renderer),'DOM_BATTLE_CUBE_FALLBACK');
    assert.equal(await flat.locator('button').count(),4);assert.equal(await flat.locator('img').count(),4);
    await flat.screenshot({path:path.join(OUTPUT,'webgl-fallback.png')});report.webglFallback=true;await fallbackContext.close();
    // Real application entry, return and repeated mount at the mobile contracts.
    const appContext=await browser.newContext({viewport:VIEWPORTS[1],deviceScaleFactor:2});
    const app=await appContext.newPage();const appErrors=[];app.on('pageerror',e=>appErrors.push(e.message));
    await app.goto(`${ORIGIN}/championship.html`,{waitUntil:'networkidle'});await startGame(app);
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
    assert.equal(await app.locator('.cm-vs5-cube__face:disabled').count(),4);
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
