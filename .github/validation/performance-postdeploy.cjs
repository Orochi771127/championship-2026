'use strict';
// One-off release verification. This file stays on the operations branch.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const {chromium,webkit}=require('playwright');
const {startGame,RAISING_HOME}=require('../../tests/championship-browser-opening.cjs');
const root=process.cwd(),output=path.join(root,'.tmp/performance-postdeploy');
const base='https://orochi771127.github.io/championship-2026/';
const expected=process.env.EXPECTED_RELEASE_SHA;
const browserName=process.env.SMOKE_BROWSER||'chromium';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(output,{recursive:true});
async function bytes(url){
  const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
  assert.equal(response.status,200,`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
(async()=>{
  assert.match(expected||'',/^[a-f0-9]{40}$/,'An exact deployed commit is required');
  const {decodeBuildManifest}=await import(pathToFileURL(path.join(root,'scripts/lib/build-manifest-codec.mjs')).href);
  const manifest=decodeBuildManifest(JSON.parse((await bytes(`${base}pages-build.json?release=${expected}`)).toString('utf8')));
  assert.equal(manifest.commit,expected,'Do not verify a stale deployment');
  assert.equal(manifest.target,'GITHUB_PAGES_OWNER_PLAYTEST');
  assert.equal(manifest.sourcePayloadIncluded,false);
  assert.equal(manifest.inputSha256,hash(fs.readFileSync(path.join(root,'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'))));
  const startup=manifest.browserBundle?.startupModules;
  assert.ok(Array.isArray(startup)&&startup.length>0,'A startup module receipt is required');
  const wanted=new Set(['index.html','championship.html',...startup]);
  const rows=manifest.files.filter(row=>wanted.has(row.path));
  assert.equal(rows.length,wanted.size,'Every startup resource must be in the receipt');
  let next=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(next<rows.length){
      const row=rows[next++],body=await bytes(new URL(row.path,base).href);
      assert.equal(body.length,row.bytes,`Published length mismatch: ${row.path}`);
      assert.equal(hash(body),row.sha256,`Published bytes mismatch: ${row.path}`);
    }
  }));
  const result={status:'RUNNING',expected,buildId:manifest.buildId,browser:browserName,
    startupResourcesVerified:rows.length,externalCharacters:manifest.externalCharacterAssets,
    physicalIPhoneTest:false,isolatedQaSave:true,pageErrors:[],consoleErrors:[],failedRequests:[],screenshots:[]};
  const browser=await ({chromium,webkit}[browserName]).launch({headless:true,
    ...(browserName==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const qaSave=fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json'),'utf8');
  await context.addInitScript(save=>{
    if(location.hostname!=='orochi771127.github.io')return;
    if(!sessionStorage.getItem('performanceReleaseQaSeeded')){
      localStorage.setItem('championshipModernSave:v1',save);
      sessionStorage.setItem('performanceReleaseQaSeeded','1');
    }
  },qaSave);
  await context.tracing.start({screenshots:true,snapshots:true});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>result.pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>result.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  const screenshot=async name=>{
    const file=`${browserName}-${name}.png`;
    await page.screenshot({path:path.join(output,file),fullPage:false});result.screenshots.push(file);
  };
  try{
    const response=await page.goto(`${base}?release=${expected}`,{waitUntil:'domcontentloaded',timeout:90000});
    assert.equal(response.status(),200);
    assert.equal(new URL(page.url()).origin,new URL(base).origin);
    await page.getByRole('button',{name:/^進入遊戲$|^进入游戏$|^Enter Game$|^Accéder au jeu$|^ゲームに入る$/}).waitFor({state:'visible',timeout:90000});
    await screenshot('title');
    const started=Date.now();
    await startGame(page,{timeout:90000});
    await page.locator(RAISING_HOME).waitFor({state:'visible',timeout:90000});
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas')).some(canvas=>{
      const r=canvas.getBoundingClientRect();return r.width>0&&r.height>0&&canvas.width>0&&canvas.height>0;
    }),null,{timeout:60000});
    result.continueToRanchMs=Date.now()-started;
    await screenshot('ranch');
    result.visibleText=(await page.locator('body').innerText()).slice(0,5000);
    await page.setViewportSize({width:430,height:932});
    await page.locator(RAISING_HOME).waitFor({state:'visible'});
    await screenshot('ranch-resized');
    result.viewportResizeVerified=true;
    result.retainedLocalSave=await page.evaluate(()=>Boolean(localStorage.getItem('championshipModernSave:v1')));
    assert.equal(result.retainedLocalSave,true);
    assert.equal(result.pageErrors.length,0,`Uncaught page errors: ${JSON.stringify(result.pageErrors)}`);
    assert.equal(result.consoleErrors.length,0,`Console errors: ${JSON.stringify(result.consoleErrors)}`);
    result.status='PASSED';
  }catch(error){
    result.status='FAILED';result.failure=String(error.stack||error);
    await screenshot('failure').catch(()=>{});
    throw error;
  }finally{
    fs.writeFileSync(path.join(output,`${browserName}-report.json`),JSON.stringify(result,null,2)+'\n');
    console.log('POSTDEPLOY_RESULT',JSON.stringify(result));
    await context.tracing.stop({path:path.join(output,`${browserName}-trace.zip`)}).catch(()=>{});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
