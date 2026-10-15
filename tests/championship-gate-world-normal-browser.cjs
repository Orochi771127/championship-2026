const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startGame,openHunt,RAISING_HOME,GATE_CONFIRM}=require('./championship-browser-opening.cjs');
const URL=process.env.CHAMPIONSHIP_QA_URL||'http://127.0.0.1:18743/championship.html';
const OUTPUT=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'output/playwright','gate-normal');
fs.mkdirSync(OUTPUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHAMPIONSHIP_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  // Film/music requests can outlive document readiness. The existing opening
  // helper then waits for the real LOGIN button and native film-ended state.
  await page.goto(URL,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'domcontentloaded'});await startGame(page);
  await page.waitForSelector(RAISING_HOME);await openHunt(page);
  assert.equal(await page.locator('.cm-vs2-gate3d__canvas').count(),1);
  await page.locator('.cm-vs2-gate3d__toggle').click();
  await page.locator('.cm-vs2-gate[data-gate-id="championship:2026:gate:savanna"]').click();
  assert.equal(await page.locator(GATE_CONFIRM).isDisabled(),true);
  assert.equal(await page.locator('.cm-vs2-preview__name').innerText(),'驅動莽原');
  await page.locator('.cm-vs2-gate[data-gate-id="championship:2026:gate:grass"]').click();
  assert.equal(await page.locator(GATE_CONFIRM).isDisabled(),false);
  await page.locator('.cm-vs2-gate3d__toggle').click();
  await page.screenshot({path:path.join(OUTPUT,'normal-selected.png')});
  await page.locator(GATE_CONFIRM).click();await page.waitForSelector('[data-screen="HUNT_LOADOUT"]');
  assert.equal(await page.locator('.cm-vs2-gate3d__canvas').count(),0);
  assert.equal(await page.locator('[data-equipment-class]').count(),5);
  await page.locator('.cm-vs2-footer .cm-vs2-action').first().click();
  await page.waitForSelector('[data-screen="GATE_SELECT"]');
  await page.waitForSelector('.cm-vs2-gate3d__canvas');
  assert.equal(await page.locator('.cm-vs2-gate3d__canvas').count(),1);
  await page.locator('.cm-vs2-footer .cm-vs2-action').first().click();
  await page.waitForSelector(RAISING_HOME);
  assert.equal(await page.locator('.cm-vs2-gate3d__canvas').count(),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(OUTPUT,'validation.json'),JSON.stringify({url:URL,normalOpening:true,lockedSavannaPreview:true,
   grassAdmission:true,loadout:true,gateRemount:true,rendererAfterHome:0,errors,verdict:'PASS'},null,2));
  console.log('GATE_WORLD_NORMAL_BROWSER_PASS NewGame/Ranch/Gate/List/LockedPreview/Loadout/Return');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
