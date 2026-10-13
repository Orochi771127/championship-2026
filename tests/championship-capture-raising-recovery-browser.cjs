// Isolated browser context, hash-selected production build. Never accesses a
// personal browser profile or the player's loopback origin.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { openHunt, liveWilds, captureOneWild, leaveHuntField } = require('./championship-browser-opening.cjs');
const output = require('./browser-qa-output.cjs')('capture-raising-recovery');
const artifact = path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT || 'dist/github-playtest');
const base = 'https://orochi771127.github.io/championship-2026/';
const saveKey = 'championshipModernSave:v1';
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.mp4':'video/mp4', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.svg':'image/svg+xml' };
fs.mkdirSync(output, {recursive:true});
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}, timezoneId:'UTC'});
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const events = [], missing = [], timings = [], titleRequests = [], legacyPixels = [];
  page.on('pageerror',e=>events.push({kind:'pageerror',message:e.message,stack:e.stack}));
  page.on('console',m=>{if(['warning','error'].includes(m.type())||/CHAMPIONSHIP_(TITLE_RETURN|DOCUMENT_RELOAD)/.test(m.text()))events.push({kind:m.type(),message:m.text()});});
  page.on('framenavigated',f=>{if(f===page.mainFrame()){titleRequests.length=0;events.push({kind:'document',url:f.url()});}});
  page.on('requestfailed',r=>events.push({kind:'requestfailed',url:r.url(),error:r.failure()}));
  await context.route('**/*', async route => {
    const url = route.request().url();
    if(url.includes('/title-morning-r1/'))titleRequests.push(url);
    if(/\/internal-faithful-baseline\/characters-v1\/.*\.png(?:\?|$)/.test(url))legacyPixels.push(url);
    if (!url.startsWith(base)) { await route.abort(); return; }
    const relative = decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length));
    const file = path.resolve(artifact,relative || 'index.html');
    if (!file.startsWith(artifact+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      missing.push(url); await route.fulfill({status:404,body:'QA artifact missing'}); return;
    }
    if(process.env.CHAMPIONSHIP_QA_TRACE_DISPOSE && relative==='src/championship/presentation/pixiCharacterRuntimeBundle.js') {
      const body=fs.readFileSync(file,'utf8').replace(/dispose\(\) \{\r?\n      if \(disposal\)/, 'dispose() {\n      console.warn("QA_BUNDLE_DISPOSE",runtime.entityId,new Error().stack);\n      if (disposal)');
      await route.fulfill({body,contentType:'text/javascript'});return;
    }
    await route.fulfill({path:file,contentType:mime[path.extname(file)] || 'application/octet-stream'});
  });
  await page.addInitScript(({seed,key})=>{
    if (!localStorage.getItem(key)) localStorage.setItem(key,seed);
    window.__qa = {events:[],ready:null};
    addEventListener('championship:ready',()=>window.__qa.ready=performance.now());
    addEventListener('unhandledrejection',e=>window.__qa.events.push({kind:'unhandledrejection',reason:String(e.reason),stack:e.reason?.stack}));
    addEventListener('webglcontextlost',()=>window.__qa.events.push({kind:'contextlost'}),true);
    addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>window.__qa.events.push({kind:'screen',screen:document.querySelector('#cm-root')?.dataset.activeScreen,titleHidden:document.querySelector('#cm-title')?.hidden})).observe(document.querySelector('#cm-root'),{attributes:true,attributeFilter:['data-active-screen']}));
  },{seed:fs.readFileSync('qa/championship-full-qa-save.json','utf8'),key:saveKey});
  async function enter() {
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
    if(await page.locator('#cm-film-skip').isVisible()) {
      assert.equal(titleRequests.length,0,'TITLE pixels must not download before the startup film is skipped');
      await page.locator('#cm-film-skip').click();
      await page.waitForFunction(()=>document.querySelector('#cm-opening-film').hidden);
    }
    await page.waitForTimeout(400);
    await page.locator('#cm-login').click();
    await page.locator('#cm-continue').click();
    await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
    const host = page.locator('.int-rh2-field-host');
    await page.waitForFunction(()=>{const s=document.querySelector('.int-rh2-field-host')?.dataset.residentAssets;return s&&JSON.parse(s).every(x=>x.state==='ready');});
    timings.push({phase:'continue-ready',at:await page.evaluate(()=>performance.now()),assets:await host.getAttribute('data-resident-assets')});
  }
  try {
    await page.goto(base+'championship.html?gateMode=fallback&presentation=developer',{waitUntil:'domcontentloaded'});
    await enter();
    await page.screenshot({path:path.join(output,'qa-roster-ready.png')});
    console.log('QA_ROSTER_READY');
    await openHunt(page);
    const gate=process.env.CHAMPIONSHIP_QA_GATE || 'grass';
    await page.locator(`[data-gate-id="championship:2026:gate:${gate}"]`).click();
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
    await page.locator('[data-equipment-class="ROPE"] [data-item-id]').last().click();
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
    await page.locator('.cm-vs2-field__canvas[aria-busy="false"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-wild-screen-positions]')?.dataset.wildScreenPositions);
    console.log('WILDS',JSON.stringify((await liveWilds(page)).map(w=>({id:w.wildId,species:w.speciesId,hp:w.maxHp}))));
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+1000));
    const id=await captureOneWild(page,await page.locator('.cm-vs2-field__canvas canvas').boundingBox(),{controlledClock:true,targetSpeciesId:process.env.CHAMPIONSHIP_QA_TARGET_SPECIES || null,attempts:5});
    await page.clock.resume();
    assert.ok(id,'normal capture did not reach card');
    assert.equal(await leaveHuntField(page),'HUNT_RESULT');
    const before=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),saveKey));
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
    await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
    const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),saveKey));
    assert.equal(after.raising.collection.length,before.raising.collection.length+1);
    await page.screenshot({path:path.join(output,'capture-home.png')});
    console.log('CAPTURE_HOME',after.raising.collection.at(-1).speciesId);
    await page.locator('button[data-menu-id="SYSTEM"]').click();
    await page.locator('[data-entry-id="saveQuit"]').click();
    await page.locator('#cm-login').waitFor({state:'visible'});
    const checkpoint=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),saveKey));
    await page.reload({waitUntil:'domcontentloaded'});
    await enter();
    const restored=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),saveKey));
    // Native Home actor coordinates are assigned on hydration. Preserve all
    // other captured individual data and stable membership exactly.
    const individuals=save=>save.raising.collection.map(c=>{
      const next=structuredClone(c);delete next.nativeProfile.fields['1c0'];delete next.nativeProfile.fields['1c4'];return next;
    });
    assert.deepEqual(individuals(restored),individuals(checkpoint));
    assert.deepEqual(missing,[]);
    assert.deepEqual(legacyPixels,[],'accepted original pixels must not be replaced by the legacy character bank');
    assert.equal(events.some(e=>e.kind==='pageerror'||e.kind==='error'),false,JSON.stringify(events));
    assert.deepEqual(await page.evaluate(()=>window.__qa.events.filter(e=>e.kind==='unhandledrejection'||e.kind==='contextlost')),[]);
    console.log('CAPTURE_RELOAD_PASS');
  } catch(e) {
    events.push({kind:'failure',message:e.message,stack:e.stack});
    await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    console.error(e);process.exitCode=1;
  } finally {
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({artifact,events,missing,legacyPixels,timings,browser:await page.evaluate(()=>window.__qa).catch(()=>null)},null,2));
    await browser.close();
  }
})();
