const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.CHAMPIONSHIP_QA_OUTPUT;
if(!out)throw Error('CHAMPIONSHIP_QA_OUTPUT required');fs.mkdirSync(out,{recursive:true});
const origin=process.env.CHAMPIONSHIP_QA_ORIGIN??'http://127.0.0.1:8741';
const basePath=process.env.CHAMPIONSHIP_QA_BASE_PATH??'';
const report={origin,basePath,artifactProxy:!!(process.env.CHAMPIONSHIP_QA_ARTIFACT_DIR||process.env.CHAMPIONSHIP_QA_PROXY_ORIGIN),physicalDevice:false,normalDomActions:true,views:[],errors:[],rotationRequests:[],failedAssets:[]};
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Users/User/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/rotations-|ranchRotatedArt/.test(r.url()))report.rotationRequests.push(r.url());});
 page.on('response',r=>{if(r.status()>=400)report.failedAssets.push({status:r.status(),url:r.url()});});
 if(process.env.CHAMPIONSHIP_QA_ARTIFACT_DIR){
  const artifactRoot=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT_DIR);
  await page.route(origin+basePath+'/**',async route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(basePath.length+1));
   const file=path.resolve(artifactRoot,relative);
   if(!file.startsWith(artifactRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});
   const contentType={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.mp4':'video/mp4'}[path.extname(file)]??'application/octet-stream';
   await route.fulfill({status:200,contentType,body:fs.readFileSync(file)});
  });
 }else if(process.env.CHAMPIONSHIP_QA_PROXY_ORIGIN)await page.route(origin+basePath+'/**',async route=>{const u=new URL(route.request().url());const local=process.env.CHAMPIONSHIP_QA_PROXY_ORIGIN+u.pathname.slice(basePath.length)+u.search;await route.fulfill({response:await context.request.get(local)});});
 const seed=JSON.parse(fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json'),'utf8'));
 seed.schemaVersion=7;seed.cageEdit={layoutVersion:'PRODUCT_GRID100_INSTANCES_V1',gridAccess:{version:1,legacyUnlockedSlots:Array.from({length:40},(_,i)=>i),purchasedRows:[],testUnlockedRows:[4,5,6,7,8,9],legacyGrants:[]},nextInstanceSequence:3,placements:[{moduleId:'championship:2026:cage:waiting-room',slotIndex:0,instanceId:'cage:waiting'},{moduleId:'championship:2026:cage:1',slotIndex:54,instanceId:'cage:test',rotation:1}]};
 seed.shop.bits=1000;seed.shop.quantities[0]=0;
 const partner=seed.raising.collection[0].instanceId;
 seed.raising.nativeHome.discoveries={version:1,lastAt:Date.now(),carryMs:0,sequence:2,collected:0,participants:[{id:partner,cageId:'cage:test'}],pending:[{id:1,kind:'food',partnerId:partner,cageId:'cage:test'},{id:2,kind:'bits',partnerId:partner,cageId:'cage:test'}]};
 await page.addInitScript(({seed,origin})=>{if(location.origin===origin&&!localStorage.getItem('championshipModernSave:v1'))localStorage.setItem('championshipModernSave:v1',JSON.stringify(seed));},{seed,origin});
 const enter=async()=>{await page.goto(report.origin+basePath+'/championship.html');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.locator('.int-rh2-field-host[data-load-state="ready"]').waitFor({timeout:60000});};
 const editor=async()=>{await page.locator('button[data-menu-id="MANAGEMENT"]').click();await page.locator('[data-entry-id="cageEdit"]').click();await page.locator('.cm-vs2-cage-board').waitFor();};
 await enter();
 await page.locator('[data-action="ranch-discoveries"]').click();
 await page.getByRole('button',{name:'收下發現',exact:true}).click();
 await page.getByRole('button',{name:'繼續散步',exact:true}).click();
 const claimed=await page.evaluate(()=>JSON.parse(localStorage.getItem('championshipModernSave:v1')));
 assert.equal(claimed.raising.nativeHome.discoveries.pending.length,0);
 assert.equal(claimed.shop.quantities[0],2);assert.equal(claimed.shop.bits,1020);
 report.discoveries={normalJournalClaim:true,foodAdded:2,bitsAdded:20};
 const cdp=await context.newCDPSession(page);
 let anchor=54;
 for(const [width,height] of [[390,844],[844,390],[1280,720]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  const zoom=page.locator('.cm-ranch-zoom');
  if((await zoom.textContent()).includes('70'))await zoom.click();
  const canvas=await page.locator('canvas.cm-raising-pixi-canvas').boundingBox();
  const x=canvas.x+canvas.width*.5,y=canvas.y+canvas.height*.5;
  if(width<1024){
   const touch=(type,dx)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x-dx,y,id:1},{x:x+dx,y,id:2}]});
   await touch('touchStart',80);await touch('touchMove',76);
   assert.match(await zoom.textContent(),/100/,'small pinch does not switch');
   await touch('touchMove',50);await touch('touchEnd');
  }else{await page.mouse.move(x,y);await page.mouse.wheel(0,120);}
  await page.waitForTimeout(220);assert.match(await zoom.textContent(),/70/,'normal gesture opens overview');
  await page.screenshot({path:path.join(out,`overview-${width}x${height}.png`)});
  await zoom.click();assert.match(await zoom.textContent(),/100/,'zoom button restores detail');
  await page.screenshot({path:path.join(out,`raising-${width}x${height}.png`)});
  assert.equal(await page.locator('canvas.cm-raising-pixi-canvas').count(),1);
  await editor();assert.equal(await page.locator('[data-rotate-cage],.cm-cage-rotation-controls').count(),0);
  const placed=page.locator(`.cm-vs2-cage-slot[data-slot-index="${anchor}"]`);await placed.scrollIntoViewIfNeeded();
  assert.equal(await placed.getAttribute('data-filled'),'true');await placed.click();
  assert.equal(await placed.getAttribute('data-filled'),'false');
  anchor=anchor===54?74:54;
  const target=page.locator(`.cm-vs2-cage-slot[data-slot-index="${anchor}"]`);await target.scrollIntoViewIfNeeded();await target.click();
  assert.equal(await target.getAttribute('data-filled'),'true');await page.locator('.cm-vs2-action--primary').click();
  await page.screenshot({path:path.join(out,`editor-${width}x${height}.png`)});
  const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.equal(dimensions.width,dimensions.scrollWidth);
  await page.getByRole('button',{name:'返回牧場',exact:true}).click();await page.locator('.int-rh2-field-host[data-load-state="ready"]').waitFor({timeout:60000});
  report.views.push({width,height,withdrawPlaceConfirmReturn:true,noRotationControls:true,noHorizontalOverflow:true,overviewGesture:width<1024?'pinch':'wheel',detailButton:true});
 }
 await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="saveQuit"]').click();await page.locator('#cm-login').waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('championshipModernSave:v1')));
 assert.equal(saved.raising.nativeHome.discoveries.pending.length,0);assert.equal(saved.shop.bits,1020);
 assert.ok(saved.cageEdit.placements.every(p=>!('rotation'in p)));
 assert.equal(saved.cageEdit.placements.find(p=>p.instanceId==='cage:test').slotIndex,anchor);
 await page.goto('about:blank');await enter();await editor();
 assert.equal(await page.locator(`.cm-vs2-cage-slot[data-slot-index="${anchor}"]`).getAttribute('data-filled'),'true');
 assert.equal(await page.locator('[data-rotate-cage]').count(),0);
 report.reload={legacyRotationMigrated:true,savedWithoutRotation:true,anchor,continued:true};
 assert.deepEqual(report.rotationRequests,[]);assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedAssets,[]);
 await context.close();
 }finally{fs.writeFileSync(path.join(out,'fixed-browser.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
