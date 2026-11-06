// Isolated post-deployment verification. All game responses come from live HTTPS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {login}=require('../tests/championship-browser-opening.cjs');
const base='https://orochi771127.github.io/championship-2026/';
const output=path.resolve('.tmp/live-release-smoke');fs.mkdirSync(output,{recursive:true});
const expectedCommit=process.env.EXPECTED_PUBLIC_COMMIT,expectedBuild=process.env.EXPECTED_PUBLIC_BUILD||null;
const report={status:'RUNNING',source:'LIVE_PUBLIC_HTTPS_NO_RESPONSE_REPLACEMENT',base,expectedCommit,expectedBuild,physicalDeviceAccepted:false,ownerProfileAccessed:false,serviceWorkers:'blocked',receiptAttempts:[],verifiedFiles:[],viewports:[],startedAt:new Date().toISOString()};
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchBytes(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200,`HTTP ${response.status}: ${url}`);
 return {bytes:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type'),url:response.url};
}
const screen=(page,id)=>page.waitForFunction(id=>document.querySelector('#cm-root')?.dataset.activeScreen===id,id,{timeout:120000});
async function ranchReady(page){
 await screen(page,'RAISING_HOME');
 await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:120000});
 await page.waitForFunction(()=>{const rows=JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentAssets||'[]');return rows.length>0&&rows.every(row=>row.state==='ready'&&row.hasVisibleSprite&&!row.error);},null,{timeout:120000});
}
async function menu(page,id){await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator(`[data-entry-id="${id}"]`).click();}
const shot=(page,label,stage)=>page.screenshot({path:path.join(output,`${label}-${stage}.png`),timeout:30000});
(async()=>{
 assert.match(expectedCommit||'',/^[a-f0-9]{40}$/,'Explicit published commit required');
 const {decodeBuildManifest}=await import(pathToFileURL(path.resolve('scripts/lib/build-manifest-codec.mjs')).href);
 let receipt;
 // Retry only deployment-receipt propagation, never a failed gameplay assertion.
 for(let attempt=0;attempt<25;attempt++){
  const response=await fetchBytes(base+`pages-build.json?verify=${expectedCommit}&attempt=${attempt}`);
  const current=decodeBuildManifest(JSON.parse(response.bytes));
  report.receiptAttempts.push({at:new Date().toISOString(),commit:current.commit,buildId:current.buildId});write();
  if(current.commit===expectedCommit){receipt=current;break;}await sleep(5000);
 }
 assert.ok(receipt,'Published receipt did not converge to intended merge commit');
 if(expectedBuild)assert.equal(receipt.buildId,expectedBuild);
 assert.equal(receipt.sourcePayloadIncluded,false);
 assert.equal(receipt.externalCharacterAssets.manifestSha256,'0fa8a1bb59f5bed2bbfb9f5f0ab436eaff7bb21c92af9a670cd4f5854f0c4452');
 report.published={commit:receipt.commit,buildId:receipt.buildId,target:receipt.target,fileCount:receipt.fileCount,externalCharacterAssets:receipt.externalCharacterAssets};
 const generated=new Set(receipt.browserBundle.generatedFiles);
 const rows=receipt.files.filter(row=>generated.has(row.path)||['index.html','championship.html'].includes(row.path)||row.path.endsWith('.css'));
 assert.ok(rows.length>2);let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<rows.length){
  const row=rows[next++],response=await fetchBytes(new URL(row.path,base));
  assert.equal(response.bytes.length,row.bytes,'Live byte length: '+row.path);
  assert.equal(sha(response.bytes),row.sha256,'Live SHA-256: '+row.path);
  report.verifiedFiles.push({path:row.path,bytes:row.bytes,sha256:row.sha256,contentType:response.contentType});
 }}));write();
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
 report.browser=browser.version();
 try{
  for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
   const label=`${viewport.width}x${viewport.height}`;
   const result={label,viewport,checks:[],pageErrors:[],consoleErrors:[],httpFailures:[],requestFailures:[],cancelledRequests:[],assetResponses:0,status:'RUNNING'};report.viewports.push(result);
   const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<900,isMobile:viewport.width<900,locale:'zh-TW',serviceWorkers:'block'});
   await context.addInitScript(({save})=>{
    localStorage.setItem('championshipModernSave:v1',save);
    localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true,reducedMotion:'off'}));
   },{save:fs.readFileSync('qa/championship-full-qa-save.json','utf8')});
   const page=await context.newPage();page.setDefaultTimeout(90000);
   page.on('pageerror',error=>result.pageErrors.push(error.message));
   page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
   page.on('response',response=>{
    if(response.status()>=400)result.httpFailures.push({url:response.url(),status:response.status()});
    if(response.url().startsWith(receipt.externalCharacterAssets.assetBaseUrl)&&response.status()===200)result.assetResponses++;
   });
   page.on('requestfailed',request=>{const row={url:request.url(),error:request.failure()?.errorText};if(/ERR_ABORTED|cancel/i.test(row.error||''))result.cancelledRequests.push(row);else result.requestFailures.push(row);});
   try{
    const started=Date.now();await page.goto(base+'championship.html?arenaQa=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);result.titleReadyMs=Date.now()-started;
    await page.waitForFunction(()=>document.querySelectorAll('.cm-title__walker canvas').length>0,null,{timeout:90000});
    await shot(page,label,'title');result.checks.push('Live title and decoded character parade');
    await login(page);await page.locator('#cm-continue').click();await ranchReady(page);
    await shot(page,label,'ranch');result.checks.push('Continue restores isolated QA save and all ranch residents');
    await menu(page,'database');await screen(page,'DATABASE');await page.locator('.cm-vs2-database__stage').selectOption('');
    const row=page.locator('.cm-vs2-database__row[data-species-index="117"]');await row.scrollIntoViewIfNeeded();await row.click();
    await page.locator('.cm-dex-hero[data-art="ready"]').waitFor();await page.locator('.cm-showcase-toggle__option[data-view="motion"]').click();
    await page.locator('.cm-showcase-motion__action[data-action="walk"]').click();
    await page.waitForFunction(()=>{const body=document.querySelector('.cm-showcase-motion .cm-sprite__body');return body&&Number(body.dataset.cells)>1&&body.getAnimations().some(animation=>animation.playState==='running');});
    assert.equal(await page.locator('.cm-showcase-motion[data-error]').count(),0);
    await shot(page,label,'dex');result.checks.push('Reviewed character 117: portrait and running walk animation');
    await page.locator('.cm-vs2-footer button').first().click();await page.locator('.cm-vs2-footer button').first().click();await ranchReady(page);
    await menu(page,'battle');await screen(page,'BATTLE_SELECT');await page.locator('#cm-data-arena').click();
    await page.locator('.da-panel--select').waitFor();await page.locator('.da-panel--select .da-btn--primary').click();await page.locator('.da-panel--brief .da-btn--primary').click();
    await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY'&&window.__dataArenaQA.snapshot().time>0.75,null,{timeout:120000});
    result.arena=await page.evaluate(()=>window.__dataArenaQA.diagnostics());assert.equal(result.arena.frameFault,null);assert.ok(result.arena.bundles.length>0);
    await shot(page,label,'arena');result.checks.push('Arena selection/brief/PLAY: real actor bundles and no frame fault');
    await page.locator('.da-hud__pause').click();await page.locator('.da-panel--pause .da-btn--quiet').click();await screen(page,'BATTLE_SELECT');
    assert.equal(await page.locator('.da-root').count(),0);await page.locator('.cm-vs5-exit:visible').click();await ranchReady(page);
    await shot(page,label,'returned');result.checks.push('Pause/leave Arena disposes overlay and returns to usable ranch');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.ok(result.assetResponses>0,'Live external assets requested');assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.httpFailures,[]);assert.deepEqual(result.requestFailures,[]);assert.deepEqual(result.consoleErrors,[]);
    result.status='PASS';
   }catch(error){result.status='FAIL';result.failure=String(error);await shot(page,label,'failure').catch(()=>{});throw error;}
   finally{write();await context.close();}
  }
 }finally{await browser.close();}
 report.status='PASS_LIVE_PUBLIC_RELEASE';report.finishedAt=new Date().toISOString();write();
 console.log(JSON.stringify({status:report.status,published:report.published,verifiedFiles:report.verifiedFiles.length,viewports:report.viewports.map(row=>({label:row.label,status:row.status,checks:row.checks}))}));
})().catch(error=>{report.status='FAIL';report.failure=error.stack||String(error);write();console.error(error);process.exitCode=1;});
