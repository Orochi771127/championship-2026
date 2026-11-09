const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { startGame } = require("./championship-browser-opening.cjs");
const ORIGIN = process.env.CHAMPIONSHIP_QA_ORIGIN || "http://127.0.0.1:8732";
const OUTPUT = require("./browser-qa-output.cjs")("battle-cube-v1");
// The battle menu is a prism with one face per mode (Owner 2026-11-09): seven
// faces since Journey joined it in front (2026-11-10). Its faces are the mode keys; the face buttons stay in the
// page, undrawn, for keyboards and screen readers.
const FACE_COUNT = 7;
const STEP = Math.PI * 2 / FACE_COUNT;
const ORDER = ['JOURNEY','CHAMPIONSHIP','TITLE_MATCH','FREE_BATTLE','LINK_BATTLE','PASSWORD_BATTLE','PRACTICE_BATTLE'];
const VIEWPORTS = [ {width:360,height:800}, {width:390,height:844}, {width:393,height:852}, {width:412,height:915}, {width:430,height:932} ];
fs.mkdirSync(OUTPUT, {recursive:true});

async function fixture(page) {
  await page.goto(`${ORIGIN}/tests/fixtures/battle-cube.html`);
  await page.waitForFunction(() => window.cube);
  await page.evaluate(() => window.cube.ready);
}
const diagnostics = page => page.evaluate(() => window.cube.getDiagnostics());
const remount = (page, options = {}) => page.evaluate(async options => {
  window.cube.dispose(); window.selectionCalls = [];
  window.ticker = options.ticker ? window.makeTicker() : null;
  window.mountCube({ available: options.available ? new Set(options.available) : null, ticker: window.ticker });
  await window.cube.ready;
}, options);
async function tapCanvas(page, fx, fy = 0.45) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const report = { viewports:[], keyboard:false, sideTaps:false, swipe:false, tickerSettle:false, disposalRace:false, webglFallback:false, realAppFlow:false };
  try {
    const context = await browser.newContext({viewport:VIEWPORTS[1],deviceScaleFactor:2});
    const page = await context.newPage();
    const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    await fixture(page);
    await remount(page);
    const first = await diagnostics(page);
    assert.equal(first.shape,'PRISM'); assert.equal(first.faceCount,FACE_COUNT); assert.equal(first.textureCount,FACE_COUNT);
    assert.equal(first.frontFace,'JOURNEY'); assert.equal(first.settleDriver,'IMMEDIATE');
    assert.equal(await page.getAttribute('#host','data-prism-sides'),String(FACE_COUNT));
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);
      const info=await page.evaluate(()=>{
        const box=node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height};};
        return {overflow:document.documentElement.scrollWidth>innerWidth, faces:document.querySelectorAll('.cm-vs5-cube__face').length,
          overlay:box(document.querySelector('.cm-vs5-cube__faces')), turns:[...document.querySelectorAll('.cm-vs5-prism__turn')].map(box),
          caption:document.querySelector('.cm-vs5-prism__name').textContent};
      });
      // No key row: the face buttons are undrawn, the two turn keys are full-size targets.
      assert.equal(info.overflow,false); assert.equal(info.faces,FACE_COUNT);
      assert.ok(info.overlay.width<=1&&info.overlay.height<=1, JSON.stringify(info.overlay));
      assert.equal(info.turns.length,2); assert.ok(info.turns.every(b=>b.width>=40&&b.height>=40));
      assert.equal(info.caption,'征途');
      report.viewports.push({ ...viewport, ...info });
    }
    await page.screenshot({path:path.join(OUTPUT,'prism-front.png')});
    // Keyboard: arrows step one face, Enter presses the face in front.
    await page.focus('canvas');
    await page.keyboard.press('ArrowRight');
    assert.equal((await diagnostics(page)).frontFace,'CHAMPIONSHIP');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    assert.equal((await diagnostics(page)).frontFace,'PRACTICE_BATTLE');
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['PRACTICE_BATTLE']);
    assert.equal(await page.evaluate(()=>window.cube.getSelected()),'PRACTICE_BATTLE');
    assert.equal(await page.locator('.cm-vs5-prism__hint').textContent(),'目前選擇');
    // Focusing an undrawn face button turns its face to the front; pressing it selects.
    await page.focus('[data-face-id="LINK_BATTLE"]');
    assert.equal((await diagnostics(page)).frontFace,'LINK_BATTLE');
    assert.equal(await page.getAttribute('#host','data-prism-focus'),'true');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['PRACTICE_BATTLE','LINK_BATTLE']);
    report.keyboard=true;
    // A tap on a side face turns it to the front and presses it: the face is the key.
    await remount(page);
    await tapCanvas(page,0.79);
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['CHAMPIONSHIP']);
    assert.equal((await diagnostics(page)).frontFace,'CHAMPIONSHIP');
    await tapCanvas(page,0.21);
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['CHAMPIONSHIP','JOURNEY']);
    await tapCanvas(page,0.5);
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['CHAMPIONSHIP','JOURNEY','JOURNEY']);
    await page.click('.cm-vs5-prism__turn--next');
    assert.equal((await diagnostics(page)).frontFace,'CHAMPIONSHIP');
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),3);
    report.sideTaps=true;
    // A swipe turns the prism, settles on a face and never presses one.
    await remount(page);
    const box=await page.locator('canvas').boundingBox();
    const y=box.y+box.height*.45;
    await page.mouse.move(box.x+box.width*.3,y);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.62,y,{steps:10});await page.waitForTimeout(250);await page.mouse.up();
    const swiped=await diagnostics(page);
    assert.equal(swiped.frontFace,'PRACTICE_BATTLE');
    assert.ok(Math.abs(swiped.turn-STEP)<1e-9, `settled turn ${swiped.turn}`);
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    // Vertical travel is the page's to scroll; it never turns the prism.
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.3);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.8,{steps:8});await page.mouse.up();
    assert.equal((await diagnostics(page)).turn,swiped.turn);
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    await page.screenshot({path:path.join(OUTPUT,'prism-swiped.png')});
    report.swipe=true;
    // Both cancellation paths release their pointer and never become a press.
    for (const cancel of ['pointercancel','touchcancel']) {
      const result=await page.evaluate(cancel=>{
        const canvas=document.querySelector('canvas'),rect=canvas.getBoundingClientRect();
        const event={pointerId:77,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2};
        // Synthetic pointers cannot own browser capture. Replace only in this
        // targeted cancellation check; real pointer coverage is above.
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
    // Closed modes: their faces refuse, their buttons are disabled, open ones work.
    await remount(page,{available:['FREE_BATTLE']});
    await tapCanvas(page,0.5);
    assert.equal(await page.evaluate(()=>window.selectionCalls.length),0);
    assert.equal(await page.locator('.cm-vs5-cube__face:disabled').count(),FACE_COUNT-1);
    assert.equal(await page.locator('.cm-vs5-prism__hint').isHidden(),true);
    await page.locator('[data-face-id="FREE_BATTLE"]').dispatchEvent('click');
    assert.deepEqual(await page.evaluate(()=>window.selectionCalls),['FREE_BATTLE']);
    assert.equal((await diagnostics(page)).frontFace,'FREE_BATTLE');
    // The settle runs on the injected ticker only while the prism moves.
    await remount(page,{ticker:true});
    await page.click('.cm-vs5-prism__turn--next');
    const moving=await page.evaluate(()=>({...window.cube.getDiagnostics(),listeners:window.ticker.listeners.size}));
    assert.equal(moving.settleDriver,'INJECTED_TICKER'); assert.equal(moving.settling,true); assert.equal(moving.listeners,1);
    assert.equal(moving.frontFace,'JOURNEY');
    await page.evaluate(()=>window.ticker.step(90));
    const rested=await page.evaluate(()=>({...window.cube.getDiagnostics(),listeners:window.ticker.listeners.size}));
    assert.equal(rested.settling,false); assert.equal(rested.listeners,0); assert.equal(rested.frontFace,'CHAMPIONSHIP');
    assert.ok(Math.abs(rested.turn+STEP)<1e-9);
    // Disposing mid-settle leaves the ticker clean.
    await page.click('.cm-vs5-prism__turn--next');
    assert.equal(await page.evaluate(()=>window.ticker.listeners.size),1);
    await page.evaluate(()=>window.cube.dispose());
    assert.equal(await page.evaluate(()=>window.ticker.listeners.size),0);
    // Reduced motion lands at once, without the ticker.
    await page.emulateMedia({reducedMotion:'reduce'});
    await remount(page,{ticker:true});
    await page.click('.cm-vs5-prism__turn--next');
    assert.deepEqual(await page.evaluate(()=>({front:window.cube.getDiagnostics().frontFace,listeners:window.ticker.listeners.size})),{front:'CHAMPIONSHIP',listeners:0});
    await page.emulateMedia({reducedMotion:'no-preference'});
    report.tickerSettle=true;
    // Disposal releases the canvas and every node the prism added.
    await page.evaluate(()=>{window.cube.dispose();window.cube.dispose();});
    assert.deepEqual(await page.evaluate(()=>({canvases:document.querySelectorAll('canvas').length,nodes:document.querySelector('#host').children.length,
      attributes:['data-cube-textures','data-prism-sides','data-prism-focus'].filter(name=>document.querySelector('#host').hasAttribute(name))})),{canvases:0,nodes:0,attributes:[]});
    report.disposalRace=true;
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
    // SYSTEM during the onboarding tutorial, which is outside this gate.
    await app.goto(`${ORIGIN}/full-qa-save.html`,{waitUntil:'networkidle'});
    await app.click('#install');await app.waitForURL(`${ORIGIN}/championship.html`);
    await startGame(app,{continueGame:true});
    await app.waitForSelector('[data-screen="RAISING_HOME"]');
    report.homeMenus=await app.locator('[data-menu-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.menuId));
    await app.locator('button[data-menu-id="SYSTEM"]').click();
    await app.click('[data-entry-id="battle"]');
    await app.waitForSelector(`[data-screen="BATTLE_SELECT"] [data-cube-textures="${FACE_COUNT}"]`);
    for(const viewport of VIEWPORTS){
      await app.setViewportSize(viewport);
      await app.screenshot({path:path.join(OUTPUT,`app-${viewport.width}x${viewport.height}.png`),fullPage:true});
      assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    // Every mode is wired in the real application, so no face stays closed.
    assert.equal(await app.locator('.cm-vs5-cube__face').count(),FACE_COUNT);
    assert.equal(await app.locator('.cm-vs5-cube__face:disabled').count(),0);
    // Turn to Free Battle with the turn key and tap the prism, as a player does.
    for(let turn=0;turn<ORDER.indexOf('FREE_BATTLE');turn++){await app.click('.cm-vs5-prism__turn--next');await app.waitForTimeout(450);}
    assert.equal(await app.getAttribute('.cm-vs5-prism__caption','data-face-id'),'FREE_BATTLE');
    await app.locator('.cm-vs5-cube__canvas').click();
    await app.waitForSelector('[data-battle-mode="FREE_BATTLE"] .cm-vs5-match__enter');
    await app.click('.cm-vs5-exit');await app.waitForSelector('[data-screen="RAISING_HOME"]');
    assert.equal(await app.locator('canvas[data-renderer="THREE_BOUNDED_BATTLE_SELECT"]').count(),0);
    await app.locator('button[data-menu-id="SYSTEM"]').click();await app.click('[data-entry-id="battle"]');
    await app.waitForSelector(`[data-cube-textures="${FACE_COUNT}"]`);
    assert.equal(await app.locator('canvas[data-renderer="THREE_BOUNDED_BATTLE_SELECT"]').count(),1);
    assert.deepEqual(appErrors,[]);report.realAppFlow=true;await appContext.close();
    report.status='PASS';fs.writeFileSync(path.join(OUTPUT,'browser-qa.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`BATTLE_CUBE_BROWSER_PASS viewports=5 faces=${FACE_COUNT} keyboard=PASS side_taps=PASS swipe=PASS ticker_settle=PASS dispose=PASS webgl_fallback=PASS app_reentry=PASS`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
