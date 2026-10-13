// Normal settings/Title intents, original routed bytes, fresh isolated storage.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'.'),out=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT||'.tmp/title-visibility');
const base='https://orochi771127.github.io/championship-2026/',logoPath='assets/production/title-morning-r1/logo-zh-Hant.webp';
const baseline=process.argv.includes('--before'),overlay=process.env.TITLE_QA_BASELINE_OVERLAY?path.resolve(process.env.TITLE_QA_BASELINE_OVERLAY):null;
const titles={'zh-Hant':'網線拍檔：錦標賽',en:'Cyber Partner: Tournament',ja:'サイバーパートナー：トーナメント',th:'ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์',vi:'Cyber Partner: Giải đấu'};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
fs.mkdirSync(out,{recursive:true});const report={cases:[],errors:[],missing:[],physicalDeviceAccepted:false};
async function snapshot(page){return page.evaluate(()=>{const t=document.querySelector('#cm-title'),l=t.querySelector('.cm-title__logo'),i=t.querySelector('.cm-title__logo-art'),h=t.querySelector('h1'),r=l.getBoundingClientRect();return {locale:document.documentElement.lang,state:t.querySelector('.cm-title__panel').dataset.titleBackgroundState,logoReady:i.dataset.titleImageState,logoShown:getComputedStyle(i).display!=='none'&&i.complete&&i.naturalWidth>0,headingShown:getComputedStyle(h).clipPath==='none'&&h.getBoundingClientRect().width>1,headingName:h.getAttribute('aria-label'),headingCount:t.querySelectorAll(':scope > .cm-title__panel h1').length,imageHiddenFromAT:i.getAttribute('aria-hidden'),logoBox:[r.x,r.y,r.width,r.height],overflow:document.documentElement.scrollWidth>innerWidth};});}
async function locale(page,value){await page.locator('#cm-title-settings').click();await page.locator('[data-category="language"]').click();await page.locator(`input[name="cm-setting-locale"][value="${value}"]`).check({force:true});await page.locator('.cm-settings__close').click();}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const initial of (baseline?['zh-Hant','en']:(process.env.TITLE_QA_LOCALES?.split(',')||Object.keys(titles)))){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage(),requests=[],gates=[];let hold=initial==='zh-Hant',fail=false;
  const seed=fs.readFileSync('qa/championship-full-qa-save.json','utf8');
  await page.addInitScript(({initial,seed})=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:initial,reducedMotion:'on',muted:true}));},{initial,seed});
  page.on('pageerror',e=>report.errors.push(e.message));
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());assert.ok(u.href.startsWith(base));const relative=u.pathname.slice('/championship-2026/'.length);let file=path.resolve(root,relative);const snapshotFile=overlay&&path.resolve(overlay,relative);if(snapshotFile&&snapshotFile.startsWith(overlay+path.sep)&&fs.existsSync(snapshotFile))file=snapshotFile;requests.push(relative);
   if(relative===logoPath&&hold)await new Promise(resolve=>gates.push(resolve));
   if(relative===logoPath&&fail)return route.fulfill({status:503,body:'controlled missing logo'}).catch(()=>{});
   if(!(file.startsWith(root+path.sep)||(overlay&&file.startsWith(overlay+path.sep)))||!fs.existsSync(file)){report.missing.push(relative);return route.fulfill({status:404,body:'missing isolated QA input'});}
   return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'}).catch(()=>{});
  });
  await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  const first=await snapshot(page);assert.equal(first.headingName,titles[initial]);assert.equal(first.headingShown,baseline?initial!=='zh-Hant':true);assert.equal(first.logoShown,false);assert.equal(first.headingCount,1);assert.equal(first.imageHiddenFromAT,'true');
  if(initial==='zh-Hant'){if(!baseline)await page.waitForFunction(()=>document.querySelector('.cm-title__logo-art').dataset.titleImageState==='loading');await page.screenshot({path:path.join(out,'zh-text-pending.png')});hold=false;for(const release of gates.splice(0))release();}
  await page.waitForFunction(()=>document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='ready');
  const ready=await snapshot(page);assert.equal(ready.logoShown,initial==='zh-Hant');assert.equal(ready.headingShown,initial!=='zh-Hant');assert.deepEqual(ready.logoBox,first.logoBox);assert.equal(ready.overflow,false);
  assert.equal(requests.filter(r=>r===logoPath).length,baseline||initial==='zh-Hant'?1:0);
  await page.setViewportSize({width:1366,height:480});assert.equal((await snapshot(page)).overflow,false);await page.setViewportSize({width:390,height:844});
  if(initial==='en'&&!baseline){
   hold=true;await locale(page,'zh-Hant');await page.waitForFunction(()=>document.querySelector('.cm-title__logo-art').dataset.titleImageState==='loading');assert.equal((await snapshot(page)).headingShown,true);
   await locale(page,'en');hold=false;for(const release of gates.splice(0))release();await page.waitForFunction(()=>document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='ready');assert.equal((await snapshot(page)).headingShown,true);
   fail=true;await locale(page,'zh-Hant');await page.waitForFunction(()=>document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='error');assert.equal((await snapshot(page)).headingShown,true);assert.equal((await snapshot(page)).logoShown,false);
   await page.screenshot({path:path.join(out,'zh-text-error.png')});await locale(page,'en');assert.equal(await page.locator('#cm-title-background-retry').isHidden(),true);
   await locale(page,'zh-Hant');assert.equal(await page.locator('#cm-title-background-retry').isVisible(),true);fail=false;await page.locator('#cm-title-background-retry').click();await page.waitForFunction(()=>document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='ready');
   const completedRequests=requests.filter(r=>r===logoPath).length;
   for(const value of ['en','zh-Hant','ja','zh-Hant','th','vi','zh-Hant','en']){await locale(page,value);assert.equal((await snapshot(page)).headingName,titles[value]);assert.equal((await snapshot(page)).logoShown,value==='zh-Hant');}
   assert.equal(requests.filter(r=>r===logoPath).length,completedRequests,'completed cache survives repeated language changes');
   assert.equal(await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1')),seed);
   await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:30000}).catch(async error=>{console.error(await page.locator('body').innerText());throw error;});
   await page.locator('[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="saveQuit"]').click();if(await page.locator('dialog[open] [data-action="save"]').count())await page.locator('dialog[open] [data-action="save"]').click();
   await page.waitForFunction(()=>!document.querySelector('#cm-title').hidden&&document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='ready');assert.equal(requests.filter(r=>r===logoPath).length,completedRequests);await locale(page,'zh-Hant');await page.waitForFunction(()=>document.querySelector('.cm-title__logo-art').dataset.titleImageState==='ready');assert.equal(requests.filter(r=>r===logoPath).length,completedRequests);
  }
  await page.screenshot({path:path.join(out,`${initial}-title-ready.png`)});report.cases.push({initial,first,ready,logoRequests:requests.filter(r=>r===logoPath).length,titleRequests:requests.filter(r=>r.includes('title-morning-r1/'))});
  for(const release of gates)release();await ctx.close();console.log('PASS '+initial);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}})().catch(e=>{report.failure=String(e);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});
