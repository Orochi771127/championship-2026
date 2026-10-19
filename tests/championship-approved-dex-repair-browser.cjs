// Disposable normal UI flow against exact locally built public bytes.
// No save injection, registration changes or application/private API calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const {resolveAsset,MIME}=require('./alternate-form-browser-support.cjs');
const {clickOptionalComicControl}=require('./championship-dex-portrait-browser.cjs');
const root=path.resolve(process.env.DEX_REPAIR_ROOT||'dist/github-playtest');
const output=path.resolve(process.env.DEX_REPAIR_OUTPUT||'output/playwright/dex-approved-repair');fs.mkdirSync(output,{recursive:true});
const base='https://orochi771127.github.io/championship-2026/';
const manifest=JSON.parse(fs.readFileSync(process.env.DEX_REPAIR_MANIFEST||'docs/art/production/characters/approved-dex-repair-20261019/manifest.json','utf8'));

if(!process.env.DEX_REPAIR_MANIFEST)manifest.entries.push(...JSON.parse(fs.readFileSync('docs/art/production/characters/approved-equipped-201202-20261019/manifest.json','utf8')).entries);
if(!process.env.DEX_REPAIR_MANIFEST)manifest.entries.push(...JSON.parse(fs.readFileSync('docs/art/production/characters/confirmed-dex-next-four-20261019/manifest.json','utf8')).entries);
if(!process.env.DEX_REPAIR_MANIFEST)manifest.entries.push(...JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-140171172-20261020/manifest.json','utf8')).entries);
if(!process.env.DEX_REPAIR_MANIFEST)manifest.entries.push(...JSON.parse(fs.readFileSync('docs/art/production/characters/approved-equipped-159160162-20261020/manifest.json','utf8')).entries);
const registryPath='src/data/championship/database-hero-portraits.public.v1.json';
const registryBytes=fs.readFileSync(fs.existsSync(path.join(root,registryPath))?path.join(root,registryPath):registryPath);
const registry=JSON.parse(registryBytes);
const runtime=JSON.parse(fs.readFileSync(path.join(root,'assets/production/PUBLIC_RUNTIME_INDEX.json'),'utf8'));
for(const row of registry.entries)for(const [role,media]of[['hero',row],['thumbnail',row.thumbnail]]){const asset=runtime.assets.find(a=>a.id===`${row.speciesId}:database-${role}`);assert.equal(asset.src,media.src);assert.equal(asset.sha256,media.sha256);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={status:'RUNNING',hosted:Boolean(process.env.DEX_REPAIR_PUBLIC),pageErrors:[],networkErrors:[],checks:[],captures:[],responseHashes:[],visualReview:'PENDING_SEPARATE_SAVED_IMAGE_REVIEW',physicalDeviceAcceptance:false};
const write=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
async function main(){let browser,context,server,page;const jobs=[];
 try{
  const policy=await import('../src/championship/app/friendsPlaytestPolicy.js');assert.equal(policy.FRIENDS_PLAYTEST_POLICY.fullDexView,true);
  assert.equal(registry.entries.length,Number(process.env.DEX_REPAIR_REGISTRY_COUNT||194));
  report.registrySha256=sha(registryBytes);
  report.build=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json'),'utf8')).buildId;
  browser=await chromium.launch({executablePath:process.env.DEX_REPAIR_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,chromiumSandbox:true});
  context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,locale:'zh-TW',serviceWorkers:'block'});
  if(!process.env.DEX_REPAIR_PUBLIC)await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(base)&&['GET','HEAD'].includes(route.request().method())){
    const parsed=new URL(url),rel=parsed.pathname.slice(new URL(base).pathname.length);
    const file=resolveAsset(root,'/'+rel);if(file)return route.fulfill({status:200,contentType:MIME[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
   }
   report.networkErrors.push({url,error:'NON_BUILD_REQUEST'});return route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('response',r=>{
   if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});
   const asset=manifest.entries.flatMap(e=>[['display',e.display,e.speciesIndex],['thumbnail',e.thumbnail,e.speciesIndex]]).find(([,a])=>r.url()===new URL(a.src,base).href);
   if(asset)jobs.push((async()=>{const bytes=await r.body();assert.equal(r.status(),200);assert.equal(sha(bytes),asset[1].sha256);report.responseHashes.push({speciesIndex:asset[2],role:asset[0],sha256:sha(bytes),status:r.status()});})().catch(e=>report.networkErrors.push({url:r.url(),error:String(e)})));
  });
  await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});
  await page.locator('#cm-login').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});assert.equal(await page.locator('#cm-continue').isEnabled(),false);await page.locator('#cm-new-game').click();
  const story=page.locator('.cm-opening-story'),deadline=Date.now()+120000;
  while(await story.count()){if(Date.now()>deadline)throw Error('Normal comic timeout');await clickOptionalComicControl(page,page.locator('[data-story-action="text"]'));await clickOptionalComicControl(page,story,{position:{x:10,y:10}});await page.waitForTimeout(1200);}
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('#cm-opening-name').fill('Dex Audit');await page.locator('.cm-opening__name button[type="submit"]').click();
  await page.locator('.cm-opening__choices button').first().click();await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('.cm-opening__letter button').click();
  if(await page.locator('[data-egg-confirm]').isVisible())await page.locator('[data-egg-confirm]').click();await page.locator('#cm-opening-name').fill('Partner');await page.locator('.cm-opening__name button[type="submit"]').click();
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();const decline=page.locator('dialog[open] [data-action="decline"]');await decline.waitFor({state:'visible',timeout:15000});await decline.click();await decline.waitFor({state:'hidden'});
  const registration=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('championshipModernSave:v1'))?.progression?.registeredSpecies??[]);
  report.registrationBefore=await registration();assert.deepEqual(report.registrationBefore,[]);
  await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();await page.locator('.cm-toolbar__menu:not([hidden]) button[data-entry-id="database"]').click();await page.locator('#cm-root[data-active-screen="DATABASE"]').waitFor();await page.locator('.cm-vs2-database__stage').selectOption('');
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   for(const e of manifest.entries){
    const detail=page.locator('.cm-vs2-database__detail');if(await detail.isVisible()){await page.locator('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button').click();await detail.waitFor({state:'hidden'});}
    const row=page.locator(`.cm-vs2-database__row[data-species-index="${e.speciesIndex}"]`);await row.scrollIntoViewIfNeeded();
    const thumb=row.locator('img');assert.equal(await thumb.getAttribute('src'),e.thumbnail.src);await thumb.evaluate(im=>im.decode());assert.equal(await thumb.evaluate(im=>im.naturalWidth),e.thumbnail.width);assert.equal(await thumb.getAttribute('loading'),'lazy');
    await row.screenshot({path:path.join(output,`${e.speciesIndex}-${viewport.width}-row.png`)});
    await row.click();const hero=page.locator('.cm-dex-hero[data-art="ready"]');await hero.waitFor({state:'visible',timeout:15000});await hero.scrollIntoViewIfNeeded();
    const actual=await hero.locator('img').evaluate(async im=>{await im.decode();const r=im.getBoundingClientRect();return{src:im.getAttribute('src'),width:im.naturalWidth,height:im.naturalHeight,fit:getComputedStyle(im).objectFit,transform:getComputedStyle(im).transform,box:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(actual.src,e.display.src);assert.equal(actual.width,e.display.width);assert.equal(actual.height,e.display.height);assert.equal(actual.fit,'contain');assert.equal(actual.transform,'none');assert.equal(actual.overflow,false);assert.ok(actual.box.x>=-1&&actual.box.right<=viewport.width+1&&actual.box.y>=-1&&actual.box.bottom<=viewport.height+1);
    const filename=`${e.speciesIndex}-${viewport.width}-hero.png`;await hero.screenshot({path:path.join(output,filename)});report.captures.push({speciesIndex:e.speciesIndex,viewport,filename,...actual});report.checks.push({speciesIndex:e.speciesIndex,viewport:viewport.width,heroAndThumbnail:'PASS'});write();
   }
  }
  await Promise.all(jobs);report.registrationAfter=await registration();assert.deepEqual(report.registrationAfter,report.registrationBefore);assert.equal(report.checks.length,manifest.entries.length*2);assert.equal(new Set(report.responseHashes.map(r=>r.speciesIndex+':'+r.role)).size,manifest.entries.length*2);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.networkErrors,[]);report.status='PASS_AUTOMATED_NORMAL_UI_HASH_AND_LAYOUT';
 }catch(error){report.status='FAIL';report.error=String(error);await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{write();await context?.close();await browser?.close();await server?.close();}
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,responseIdentities:new Set(report.responseHashes.map(r=>r.speciesIndex+':'+r.role)).size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
