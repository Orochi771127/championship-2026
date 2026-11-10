// Controlled normal-UI check of the exact reduced public bundle. Only the game
// URLs are fulfilled from disk; character requests pass through the live
// immutable HTTPS host, with their exact response bytes verified before delivery.
// Fresh contexts use the repository QA save (or a genuine New Game), never an
// owner's browser profile. This is Chromium/SwiftShader, not device acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const {login,playOpening}=require('./championship-browser-opening.cjs');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/character-bridge-external');
const output=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'.tmp/external-character-browser');
const base='https://orochi771127.github.io/championship-2026/';
const contract=JSON.parse(fs.readFileSync('docs/contracts/championship/EXTERNAL_CHARACTER_ASSETS.v1.json','utf8'));
const manifestBytes=fs.readFileSync(contract.manifestPath),manifest=JSON.parse(manifestBytes);
const assetBase=contract.assetBaseUrl,selected=new Map(manifest.files.map(row=>[assetBase+row.path,row]));
const localPaths=new Set(contract.localPaths??[]);
const localSelected=new Map(JSON.parse(fs.readFileSync('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json','utf8')).files
 .filter(row=>localPaths.has(row.path)).map(row=>[row.path,row]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
 '.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml',
 '.mp4':'video/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
fs.mkdirSync(output,{recursive:true});
const report={schemaVersion:1,status:'RUNNING',controlledPublicOrigin:true,liveCharacterHost:assetBase,
 liveCharacterTransport:'LIVE_HTTPS_PASSTHROUGH_EXACT_RESPONSE_BYTES',
 physicalDeviceAccepted:false,viewports:[],errors:[],responseHashes:[],missing:[],unexpected:[]};
const write=()=>fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(report,null,2)+'\n');
const screen=(page,id)=>page.waitForFunction(id=>document.querySelector('#cm-root')?.dataset.activeScreen===id,id,{timeout:120000});
const menu=async(page,id)=>{await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator(`[data-entry-id="${id}"]`).click();};
const shot=(page,name)=>page.screenshot({path:path.join(output,name+'.png')});

async function isolated(browser,viewport,label,{seed=true}={}){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900,
  deviceScaleFactor:1,locale:'zh-TW',serviceWorkers:'block',reducedMotion:'no-preference'});
 const jobs=[],requests=[];
 await context.addInitScript(({save})=>{
  if(save)localStorage.setItem('championshipModernSave:v1',save);
  localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true,reducedMotion:'off'}));
 },{save:seed?fs.readFileSync('qa/championship-full-qa-save.json','utf8'):null});
 await context.route('**/*',async route=>{
  const url=route.request().url();requests.push(url);
  if(selected.has(url)){
   const expected=selected.get(url);
   const job=(async()=>{
    let response;
    try{
     assert.equal(route.request().method(),'GET','Character delivery is read-only');
     // APIResponse owns its body independently of Chromium's decoded-image
     // cache. Nothing is read from local character assets or substituted here.
     response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:60000});
     const bytes=await response.body();assert.equal(response.url(),url);assert.equal(response.status(),200);
     assert.equal(bytes.length,expected.bytes);
     const digest=sha(bytes);assert.equal(digest,expected.sha256,'Live character response differs from the selected release: '+expected.path);
     const headers={...response.headers()},contentType=headers['content-type']||'';
     assert.equal(contentType.split(';')[0].trim(),mime[path.extname(expected.path)],'Live character MIME differs: '+expected.path);
     // APIResponse.body() has already decoded transport compression. Preserve
     // MIME/cache/origin headers and the exact entity bytes; do not double-decode
     // JSON or retain an encoded/chunked Content-Length when passing them on.
     const contentEncoding=headers['content-encoding']||null;
     delete headers['content-encoding'];delete headers['transfer-encoding'];
     headers['content-length']=String(bytes.length);
     await route.fulfill({status:response.status(),headers,body:bytes});
     report.responseHashes.push({label,path:expected.path,status:response.status(),bytes:bytes.length,
      sha256:digest,contentType,upstreamContentEncoding:contentEncoding});
    }catch(error){
     report.errors.push({label,kind:'live-response-verification',url,message:String(error)});
     await route.abort().catch(()=>{});
    }finally{await response?.dispose();}
   })();jobs.push(job);return job;
  }
  if(url.startsWith(base)&&['GET','HEAD'].includes(route.request().method())){
   const relative=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length));
   // A missed boundary must fail, even if someone copied source assets back in.
   if(relative.startsWith(manifest.assetPrefix)&&!localPaths.has(relative)){
    report.unexpected.push({label,url,reason:'GAME_LOCAL_CHARACTER_REQUEST'});
    return route.fulfill({status:404,body:'Character files belong to the verified external release'});
   }
   const file=path.resolve(root,relative||'index.html');
   if(localPaths.has(relative)){
    const bytes=fs.readFileSync(file),expected=localSelected.get(relative);
    assert.ok(expected,'Every local character addition is selected');
    assert.equal(sha(bytes),expected.sha256,'Local character response matches its exact approved bytes');
   }
   if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())
    return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
   report.missing.push({label,url});return route.fulfill({status:404,body:'Missing built game input'});
  }
  report.unexpected.push({label,url,reason:'OUTSIDE_APPROVED_BUILD_AND_RELEASE'});return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',error=>report.errors.push({label,kind:'pageerror',message:error.message}));
 page.on('requestfailed',request=>{const failure=request.failure()?.errorText||'';
  if(!failure.includes('ERR_ABORTED'))report.errors.push({label,kind:'requestfailed',url:request.url(),failure});});
 page.on('response',response=>{
  if(response.status()>=400)report.errors.push({label,kind:'http',url:response.url(),status:response.status()});
 });
 return {page,context,requests,async settle(){
  let count=0;while(count<jobs.length){const pending=jobs.slice(count);count=jobs.length;await Promise.all(pending);}
 }};
}

async function ranchReady(page){
 await screen(page,'RAISING_HOME');
 await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
 await page.waitForFunction(()=>{
  const rows=JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentAssets||'[]');
  return rows.length>0&&rows.every(row=>row.state==='ready'&&row.hasVisibleSprite&&!row.error);
 });
}

async function checkDex(page,label,checks){
 await menu(page,'database');await screen(page,'DATABASE');
 await page.locator('.cm-vs2-database__stage').selectOption('');
 // Existing original atlas and newer reviewed crops exercise different loaders.
 for(const species of [21,117]){
  const row=page.locator(`.cm-vs2-database__row[data-species-index="${species}"]`);
  await row.scrollIntoViewIfNeeded();await row.click();
  await page.locator('.cm-dex-hero[data-art="ready"]').waitFor();
  await page.locator('.cm-showcase-toggle__option[data-view="motion"]').click();
  const body=page.locator('.cm-showcase-motion .cm-sprite__body');await body.waitFor();
  await page.locator('.cm-showcase-motion__action[data-action="walk"]').click();
  await page.waitForFunction(()=>{
   const body=document.querySelector('.cm-showcase-motion .cm-sprite__body');
   return body&&Number(body.dataset.cells)>1&&body.getAnimations().some(animation=>animation.playState==='running');
  });
  const before=await body.evaluate(node=>{const s=getComputedStyle(node);return [s.backgroundImage,s.backgroundPosition,s.transform].join('|');});
  await page.waitForFunction(before=>{
   const node=document.querySelector('.cm-showcase-motion .cm-sprite__body');if(!node)return false;
   const s=getComputedStyle(node);return [s.backgroundImage,s.backgroundPosition,s.transform].join('|')!==before;
  },before,{timeout:12000});
  assert.equal(await page.locator('.cm-showcase-motion[data-error]').count(),0);
  for(const action of ['attack','cheer'])await page.locator(`.cm-showcase-motion__action[data-action="${action}"]`).click();
  await page.locator('.cm-showcase-motion__sprite').scrollIntoViewIfNeeded();
  await shot(page,`${label}-dex-${species}`);checks.push(`Dex ${species}: live motion pages, native frames advance, attack/cheer controls`);
  await page.locator('.cm-vs2-footer button').first().click();
 }
 await page.locator('.cm-vs2-footer button').first().click();await ranchReady(page);
}

async function checkHunt(page,label,checks){
 await menu(page,'hunt');await screen(page,'GATE_SELECT');
 await page.locator('.cm-vs2-gate3d__toggle').click();
 await page.locator('.cm-vs2-gate[data-availability="AVAILABLE"]').first().click();
 await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await screen(page,'HUNT_LOADOUT');
 await page.locator('.cm-vs2-loadout__option').first().click();
 await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await screen(page,'HUNT_FIELD');
 await page.locator('.cm-vs2-field__loading').waitFor({state:'detached'});
 await shot(page,`${label}-hunt`);checks.push('normal Gate → Loadout → Hunt field renders with external character pages');
 await page.locator('.cm-vs2-hud__exit').click();await ranchReady(page);
}

async function checkBattle(page,label,checks){
 await menu(page,'battle');await screen(page,'BATTLE_SELECT');
 await page.locator('.cm-vs5-cube__face').filter({hasText:'練習對戰'}).click();
 const rows=page.locator('.cm-vs5-practice-member');await rows.first().waitFor();let first=false,second=false;
 for(let i=0;i<await rows.count()&&!(first&&second);i++){
  const buttons=rows.nth(i).locator('button');
  if(!first&&!await buttons.nth(0).isDisabled()){await buttons.nth(0).click();first=true;continue;}
  if(!second&&!await buttons.nth(1).isDisabled()){await buttons.nth(1).click();second=true;}
 }
 assert.ok(first&&second,'Fixture has two eligible practice members');
 await page.getByRole('button',{name:'開始練習',exact:true}).click();await screen(page,'BATTLE_FIELD');
 await page.locator('#cm-root[data-screen="BATTLE_FIELD"] .cm-vs5-shell[data-loading="false"]').waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.cm-vs5-fighter__mini img')].some(image=>image.complete&&image.naturalWidth>0));
 await shot(page,`${label}-battle`);checks.push('normal practice battle renders characters and decoded HUD portraits');
 await page.locator('.cm-vs5-exit:visible').click();
 const leave=page.locator('dialog[open] [data-action="leave"]');if(await leave.isVisible())await leave.click();
 await ranchReady(page);
}

async function checkArena(page,label,checks){
 await menu(page,'battle');await screen(page,'BATTLE_SELECT');await page.locator('#cm-data-arena').click();
 await page.locator('.da-panel--select').waitFor();
 await page.locator('.da-panel--select .da-btn--primary').click();
 await page.locator('.da-panel--brief .da-btn--primary').click();
 await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY'&&window.__dataArenaQA.snapshot().time>0.75,null,{timeout:120000});
 const diagnostic=await page.evaluate(()=>window.__dataArenaQA.diagnostics());
 assert.equal(diagnostic.frameFault,null);assert.ok(diagnostic.bundles.length>0);
 await shot(page,`${label}-arena`);checks.push('normal Data Arena selection/briefing/PLAY loads selected actor bundles without frame faults');
 await page.locator('.da-hud__pause').click();await page.locator('.da-panel--pause .da-btn--quiet').click();
 await screen(page,'BATTLE_SELECT');assert.equal(await page.locator('.da-root').count(),0);
 await page.locator('.cm-vs5-exit:visible').click();await ranchReady(page);
}

(async()=>{
 assert.equal(contract.status,'VERIFIED');assert.equal(sha(manifestBytes),contract.manifestSha256);
 const {decodeBuildManifest}=await import('../scripts/lib/build-manifest-codec.mjs');
 const receipt=decodeBuildManifest(JSON.parse(fs.readFileSync(path.join(root,'pages-build.json'),'utf8')));
 assert.equal(receipt.externalCharacterAssets?.manifestSha256,contract.manifestSha256);
 assert.equal(receipt.externalCharacterAssets?.assetBaseUrl,assetBase);
 const localRows=receipt.files.filter(row=>row.path.startsWith(manifest.assetPrefix));
 assert.deepEqual(localRows.map(row=>row.path).sort(),[...localPaths].sort());
 assert.equal(localSelected.size,localPaths.size);
 for(const row of localRows)assert.equal(row.sha256,localSelected.get(row.path)?.sha256);
 report.buildId=receipt.buildId;report.assetManifestSha256=contract.manifestSha256;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{}),
  args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
 report.browser=browser.version();
 try{
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
   const label=`${viewport.width}x${viewport.height}`,run=await isolated(browser,viewport,label),{page,context}=run;
   const checks=[];report.viewports.push({viewport,label,checks});
   try{
    await page.goto(base+'championship.html?arenaQa=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
    await page.waitForFunction(()=>document.querySelectorAll('.cm-title__walker canvas').length>0,null,{timeout:90000});
    await shot(page,`${label}-title`);checks.push('Title parade decodes a character from the live immutable host');
    await login(page);await page.locator('#cm-continue').click();await ranchReady(page);
    await shot(page,`${label}-ranch`);checks.push('Continue → Ranch has ready visible resident art');
    await checkDex(page,label,checks);await checkHunt(page,label,checks);
    await checkBattle(page,label,checks);await checkArena(page,label,checks);
    await run.settle();assert.ok(run.requests.some(url=>selected.has(url)));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }catch(error){await shot(page,`${label}-failure`).catch(()=>{});throw error;}
   finally{await run.settle();await context.close();write();}
  }
  const run=await isolated(browser,{width:390,height:844},'new-game',{seed:false});
  try{
   await run.page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await login(run.page);
   assert.equal(await run.page.locator('#cm-continue').isEnabled(),false);
   await playOpening(run.page,{trainerName:'Asset QA',eggName:'Bridge QA',onEggChoice:async page=>{
    const images=page.locator('.cm-opening__egg-option img');assert.equal(await images.count(),8);
    const decoded=await images.evaluateAll(async nodes=>Promise.all(nodes.map(async image=>{
     await image.decode();return {src:image.src,width:image.naturalWidth,height:image.naturalHeight};
    })));
    assert.ok(decoded.every(image=>selected.has(image.src)&&image.width>0&&image.height>0));
    report.openingEggs=decoded;await shot(page,'new-game-eight-eggs');
   }});
   await ranchReady(run.page);await run.settle();
  }finally{await run.settle();await run.context.close();write();}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);assert.deepEqual(report.unexpected,[]);
  assert.equal(report.openingEggs?.length,8);report.status='PASS_CONTROLLED_UI_WITH_LIVE_CHARACTER_HOST';
 }finally{await browser.close();write();}
 console.log(JSON.stringify({status:report.status,buildId:report.buildId,viewports:report.viewports.length,
  liveAssetIdentities:new Set(report.responseHashes.map(row=>row.path)).size,openingEggs:report.openingEggs.length}));
})().catch(error=>{report.status='FAIL';report.failure=error.stack||String(error);write();console.error(error);process.exitCode=1;});
