const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startGame,openHunt,RAISING_HOME,GATE_CONFIRM}=require('./championship-browser-opening.cjs');
const URL=process.env.CHAMPIONSHIP_QA_URL||'http://127.0.0.1:18743/dist/github-playtest/championship.html';
const OUTPUT=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'output/playwright','hunt-tool-normal');
fs.mkdirSync(OUTPUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHAMPIONSHIP_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'domcontentloaded'});await startGame(page);await page.waitForSelector(RAISING_HOME);
  await openHunt(page);await page.locator('.cm-vs2-gate3d__toggle').click();
  await page.locator('.cm-vs2-gate[data-gate-id="championship:2026:gate:grass"]').click();await page.locator(GATE_CONFIRM).click();
  await page.waitForSelector('[data-screen="HUNT_LOADOUT"]');await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
  await page.waitForSelector('[data-screen="HUNT_FIELD"]');
  await page.waitForSelector('.cm-vs2-field__canvas[aria-busy="false"]',{timeout:60000});
  const hand=page.locator('.cm-hunt-tools [data-tool="HAND"]'),image=hand.locator('img');
  await image.evaluate(img=>img.decode());
  assert.match(await image.getAttribute('src'),/toolbar-point64-r1-20261009\/hand-rest\.png$/);
  await hand.click();assert.equal(await hand.getAttribute('aria-pressed'),'true');
  await page.waitForTimeout(250);assert.equal(await image.isVisible(),true);
  await page.screenshot({path:path.join(OUTPUT,'normal-field.png')});
  await page.locator('.cm-vs2-hud__exit').click();await page.waitForSelector(RAISING_HOME);
  assert.equal(await page.locator('.cm-hunt-tools').count(),0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(OUTPUT,'validation.json'),JSON.stringify({normalOpening:true,grassEntry:true,
   realHuntField:true,handOriginalArt:true,selectHandler:true,returnHome:true,errors,verdict:'PASS'},null,2));
  console.log('HUNT_TOOL_NORMAL_BROWSER_PASS NewGame/Ranch/Gate/Loadout/Hunt/Hand/Return');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
