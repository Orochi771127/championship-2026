// Existing adult/date fixture -> actual standalone Continue/menu/party/HUD/result.
// This is controlled browser acceptance, not proof of naturally raising an adult.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const output=require('./browser-qa-output.cjs')('owned-battle');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let releaseLoading;
 const base=process.env.CHAMPIONSHIP_QA_ORIGIN||'http://127.0.0.1:8732';
 try{
  await page.goto(base+'/tests/fixtures/championship-owned-party.html');
  await page.locator('#prepare').click();await page.getByText('受控存檔已準備；請登入、繼續遊戲並從工具列參賽。',{exact:true}).waitFor();
  await page.goto(base+'/championship.html');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('[data-screen="RAISING_HOME"]').waitFor();
  await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();
  await page.locator('.cm-vs5-match[data-record-index="0"] button').click();
  const party=page.locator('.cm-vs5-party');await party.locator('button[data-instance-id]').first().click();
  let hit,done;const intercepted=new Promise(r=>hit=r),handled=new Promise(r=>done=r);
  const held=new Promise(r=>releaseLoading=r),match='**/battle/licensed-runtime-v1/manifest.json';
  await page.route(match,async route=>{hit();await held;try{await route.continue();}finally{done();}});
  await party.getByRole('button',{name:'決定',exact:true}).click();
  await intercepted;
  assert.equal(await page.getByRole('status').filter({hasText:'正在準備對戰場地'}).isVisible(),true);
  const before=await page.locator('.cm-vs5-roster').allTextContents();
  await page.waitForTimeout(2200);
  assert.deepEqual(await page.locator('.cm-vs5-roster').allTextContents(),before,'loading must not advance the battle');
  await page.screenshot({path:path.join(output,'battle-loading.png')});
  releaseLoading();await handled;await page.unroute(match);
  await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').waitFor();
  assert.equal(await page.locator('.cm-vs5-field__loading').count(),0);
  // The canvas exists before scene assets are ready; wait for the published
  // readiness boundary and a paint, not merely the canvas element.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:path.join(output,'battle-hud.png')});
  // Virtual wall time still drives each normal Pixi/native update. No battle
  // state, damage, roster, RNG or outcome is patched after fixture creation.
  await page.clock.install();
  let elapsed=0;
  while(await page.locator('[data-screen="BATTLE_RESULT"]').count()===0 && elapsed<600000){
   await page.clock.runFor(1000);elapsed+=1000;
  }
  await page.locator('#cm-root[data-screen="BATTLE_RESULT"]').waitFor({timeout:10000});
  await page.screenshot({path:path.join(output,'battle-result.png')});
  const resultText=await page.locator('#cm-root').innerText();
  const panels=[];
  while(await page.getByRole('button',{name:'下一頁',exact:true}).count()){
   panels.push(await page.locator('#cm-root').innerText());
   await page.getByRole('button',{name:'下一頁',exact:true}).click();
  }
  panels.push(await page.locator('#cm-root').innerText());
  await page.screenshot({path:path.join(output,'battle-final-panel.png')});
  await page.getByRole('button',{name:'返回牧場',exact:true}).click();
  await page.locator('[data-screen="RAISING_HOME"]').waitFor();
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,fixture:'tests/fixtures/championship-owned-party.html',ordinaryEntry:true,naturalAdultProgression:false,delayedLoading:true,simulatedMilliseconds:elapsed,resultText,panels,returnedHome:true,errors},null,2));
  console.log('CHAMPIONSHIP_OWNED_BATTLE_BROWSER_PASS');
 }catch(e){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
 finally{releaseLoading?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
