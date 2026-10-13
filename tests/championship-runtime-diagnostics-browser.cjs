// Existing QA fixture in a fresh context; approved origin served only from the
// selected local artifact/source. No personal profile, 8732 or telemetry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'.');
const output=require('./browser-qa-output.cjs')('runtime-diagnostics');fs.mkdirSync(output,{recursive:true});
const key='championshipModernSave:v1';
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
const selected=JSON.parse(fs.readFileSync('src/data/championship/accepted-original-character-selection.r1.json'));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();
 page.setDefaultTimeout(30000);const failures=[];let failingCage=false;
 const server=http.createServer((request,response)=>{
   const relative=decodeURIComponent(new URL(request.url,'http://local').pathname).slice(1);
   if(failingCage&&relative==='assets/production/cage/final-intake-20261008/manifest.json'){response.writeHead(503);response.end('controlled failure');return;}
   let file=path.resolve(root,relative);
   // Source loopback URLs use preview paths; supply only the same folder's
   // already approved public bytes when that preview is absent from Git.
   const prefix='assets/production/internal-character-review/';
   if(!fs.existsSync(file)&&relative.startsWith(prefix)){
     const rest=relative.slice(prefix.length),folder=rest.split('/')[0];
     if(selected.characters.some(c=>c.folder===folder))file=path.resolve(root,selected.root+rest);
   }
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){failures.push(relative);response.writeHead(404);response.end('missing');return;}
   response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(response);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/`;
 const seed=JSON.parse(fs.readFileSync('qa/championship-full-qa-save.json'));seed.creature.displayName='PRIVATE_SENTINEL';
 await page.addInitScript(({seed,key})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
   localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({muted:true,reducedMotion:'on'}));
 },{seed,key});
 async function title(){await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);}
 async function download(name){
   await page.locator('#cm-title-settings').click();await page.locator('.cm-settings__category[data-category="data"]').click();
   const next=page.waitForEvent('download');await page.locator('[data-action="export-diagnostics"]').click();
   const file=await next;await file.saveAs(path.join(output,name));
   const text=fs.readFileSync(path.join(output,name),'utf8'),log=JSON.parse(text);
   assert.ok(Buffer.byteLength(text)<=8192);assert.ok(log.events.length<=32);assert.doesNotMatch(text,/PRIVATE_SENTINEL|PRIVATE_ERROR|PRIVATE_QUERY/);
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');
   await page.locator('dialog.cm-settings').waitFor({state:'hidden'});
   return log;
 }
 const checks=[];
 try{
   await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await title();
   const original=await page.evaluate(key=>localStorage.getItem(key),key);
   await page.evaluate(()=>dispatchEvent(new ErrorEvent('error',{error:new Error('PRIVATE_ERROR?name=PRIVATE_QUERY')})));
   await page.reload({waitUntil:'domcontentloaded'});await title();
   const first=await download('navigation.json');
   assert.ok(new Set(first.events.filter(e=>e.type==='BOOT').map(e=>e.document)).size>=2);
   assert.ok(first.events.some(e=>e.type==='BOOT'&&e.navigation==='reload'));
   assert.ok(first.events.some(e=>e.type==='ERROR'));
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),original);checks.push('TITLE export, document reload, privacy and unchanged saved bytes');
   failingCage=true;
   await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='error');
   await page.locator('[data-load-action="reload"]').click();await page.waitForURL(url=>url.href.startsWith(base));
   await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false&&document.querySelector('#cm-root').hidden);
   const failed=await download('explicit-reload.json');
   assert.ok(failed.events.some(e=>e.type==='LOAD_FAILED'&&e.area==='raising'));
   assert.ok(failed.events.some(e=>e.type==='DOCUMENT_RELOAD'&&e.source==='raising-load-reload'));
   assert.ok(failed.events.some(e=>e.type==='PAGE_HIDE'));
   checks.push('controlled Raising load failure and explicit reload survive in next document');
   failingCage=false;await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
   const supported=await page.locator('.int-rh2-field-host canvas').evaluate(canvas=>{
     const gl=canvas.getContext('webgl2');window.__qaLoss=gl?.getExtension('WEBGL_lose_context');window.__qaLoss?.loseContext();return !!window.__qaLoss;
   });assert.equal(supported,true);
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('championshipModernSave:runtimeDiagnostics:v1')).events.some(e=>e.type==='CONTEXT_LOST'));
   await page.waitForTimeout(200);await page.evaluate(()=>window.__qaLoss.restoreContext());
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('championshipModernSave:runtimeDiagnostics:v1')).events.some(e=>e.type==='CONTEXT_RESTORED'));
   await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="saveQuit"]').click();
   await page.locator('#cm-login').waitFor({state:'visible'});
   const final=await download('context-and-return.json');
   assert.ok(final.events.some(e=>e.type==='CONTEXT_LOST'&&e.renderer==='PIXI'));
   assert.ok(final.events.some(e=>e.type==='CONTEXT_RESTORED'));
   assert.ok(final.events.some(e=>e.type==='TITLE_RETURN'&&e.source==='save-and-quit'&&e.phase==='done'));
   checks.push('same Pixi context loss/restoration and completed Save & Quit are distinguishable');
   assert.deepEqual(failures,[]);console.log('RUNTIME_DIAGNOSTICS_BROWSER_PASS',checks.length);
 }catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
 finally{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({root,checks,failures,physicalSafari:'UNVERIFIED'},null,2));await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
