// EXTERNAL_ASSET_RETRY_20261118: every character asset answers 503 before it is served; the ranch must recover.
//   FAILS=1 (default)  one 503 per file: the ranch loads by itself and never shows the art failure notice;
//   FAILS=3            three 503s per file (more than the retry rule tries): the notice shows, and the ranch's
//                      own 重新載入牧場 key recovers it.
// Normal entry (title -> continue) on an isolated origin (CHAMPIONSHIP_QA_ORIGIN) with the repository's full QA
// save; headless Chromium. Not a device measurement. Writes .tmp/browser-qa/asset-503/report-<FAILS>.json.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(90000);
 const errors=[],seen=new Map(),failed=[],warns=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warns.push(m.text().replace(/\s+/g,' ').slice(0,260));});
 const base=process.env.CHAMPIONSHIP_QA_ORIGIN,FAILS=Number(process.env.FAILS||1),out={fails:FAILS};assert.ok(base,'CHAMPIONSHIP_QA_ORIGIN is required: an isolated origin, never the one a player uses');
 const outDir=require('node:path').join(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'.tmp/browser-qa','asset-503');require('node:fs').mkdirSync(outDir,{recursive:true});
 const state=()=>page.evaluate(()=>{const host=document.querySelector('.int-rh2-field-host');const vis=e=>e&&e.getClientRects().length>0;
   return {load:host?.dataset.loadState??null,screen:document.getElementById('cm-root')?.dataset.activeScreen,
     buttons:[...document.querySelectorAll('button')].filter(vis).map(b=>b.textContent.trim().slice(0,14)).filter(t=>/重試|重新|取消載入|保存並返回|重新整理/.test(t)),
     status:[...document.querySelectorAll('[role=status],[role=alert]')].filter(vis).map(e=>e.textContent.trim().replace(/\s+/g,' ').slice(0,60)).filter(Boolean).slice(0,4)};});
 try{
  await page.goto(base+'/championship.html');
  await page.evaluate(async()=>{const save=await (await fetch('/qa/championship-full-qa-save.json')).json();localStorage.setItem('championshipModernSave:v1',JSON.stringify(save));});
  await page.route(/\/assets\/production\/characters\/.*\.(webp|png|json)(\?.*)?$/,async route=>{
    const url=route.request().url().split('?')[0],n=(seen.get(url)??0)+1;seen.set(url,n);
    if(n<=FAILS){failed.push(url.split('/characters/')[1]);return route.fulfill({status:503,body:'Service Unavailable'});}
    return route.continue();});
  await page.goto(base+'/championship.html');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('[data-screen="RAISING_HOME"]').waitFor();
  const timeline=[];
  for(let i=0;i<12;i++){await page.waitForTimeout(5000);const s=await state();timeline.push(`${(i+1)*5}s ${s.load} ${s.buttons.join('/')} ${s.status.join('|')}`);
    const retry=page.locator('button:visible',{hasText:/^重新載入牧場$/}).first();
    const failedNow=s.status.some(t=>/失敗/.test(t));
    if(failedNow&&await retry.isVisible().catch(()=>false)){await retry.click();timeline.push(`${(i+1)*5}s clicked retry`);continue;}
    if(s.load==='ready'&&!failedNow&&i>=2)break;}
  out.timeline=timeline;out.final=await state();
  out.failedCount=failed.length;out.failedSample=[...new Set(failed)].slice(0,5);out.requestsPerUrl=[...seen.values()].reduce((m,n)=>Math.max(m,n),0);
  out.residents=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('championshipModernSave:v1')).raising.collection.length}catch{return null}});
  await page.screenshot({path:require('node:path').join(outDir,'ranch-'+FAILS+'.png')});
 }catch(e){out.error=String(e.message).slice(0,300);}
 out.pageErrors=errors.slice(0,6);out.warns=[...new Set(warns)].filter(w=>!/503 \(Service Unavailable\)$/.test(w)).slice(0,14);
 require('node:fs').writeFileSync(require('node:path').join(outDir,'report-'+FAILS+'.json'),JSON.stringify(out,null,1));await browser.close();
 assert.equal(out.error,undefined,out.error);
 assert.deepEqual(out.pageErrors,[],'no page error');
 assert.ok(out.failedCount>0,'the 503s were really served');
 assert.equal(out.final.load,'ready');assert.deepEqual(out.final.status,[],'the ranch ends without a failure notice');
 const pressed=out.timeline.filter(line=>/clicked retry/.test(line)).length,noticed=out.timeline.some(line=>/失敗/.test(line));
 if(FAILS<=2){assert.equal(noticed,false,'a passing 503 is never shown to the player');assert.equal(pressed,0);}
 else{assert.equal(noticed,true,'past the retry rule the notice shows');assert.ok(pressed>0,'and the ranch key 重新載入牧場 recovers it');}
 console.log('CHAMPIONSHIP_ASSET_503_RECOVERY_PASS fails='+FAILS+' served503='+out.failedCount+' pressed='+pressed);
})();
