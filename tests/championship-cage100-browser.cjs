// Isolated normal public-game flow. Never opens a persistent/private browser profile.
const {chromium}=require('playwright');
const {serveBuild,resolveAsset}=require('./alternate-form-browser-support.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),artifact=path.join(root,'dist/github-playtest');
const live=process.env.CAGE100_TARGET==='live';
const output=path.join(root,'.tmp/browser-qa/cage100',...(live?['live']:[]));fs.mkdirSync(output,{recursive:true});
const saveKey='championshipModernSave:v1',publicBase='https://orochi771127.github.io/championship-2026/';
const report={scope:'normal UI in fresh isolated browser context; no injected save or private app state',target:live?'actual public GitHub Pages':'local public artifact',errors:[],assertions:[],started:new Date().toISOString()};
const write=()=>fs.writeFileSync(path.join(output,'normal-flow.json'),JSON.stringify(report,null,2));
(async()=>{
 let server,browser,context,page;
 try{
  if(!live)server=await serveBuild(artifact);browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:true});
  report.browser=browser.version();report.launch={channel:'chromium',headless:true,chromiumSandbox:true,customArgs:[]};
  context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,locale:'zh-TW',serviceWorkers:'block'});
  await context.tracing.start({screenshots:true,snapshots:true});
  await context.route('**/*',async route=>{
   const url=route.request().url();if(live&&url.startsWith(publicBase))return route.continue();if(server&&url.startsWith(server.origin+'/'))return route.continue();
   if(url.startsWith(publicBase)){const u=new URL(url),relative=u.pathname.slice(new URL(publicBase).pathname.length);if(resolveAsset(artifact,'/'+relative)){const response=await route.fetch({url:server.origin+'/'+relative+u.search,maxRedirects:0});return route.fulfill({response});}}
   report.errors.push({type:'network-blocked',url});return route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(live?180000:90000);page.on('pageerror',e=>{report.errors.push({type:'pageerror',message:e.message});write();});
  if(live){const receipt=await context.request.get(publicBase+'pages-build.json?cage100Verification='+Date.now());assert.ok(receipt.ok());const b=await receipt.json();report.publicBuild={buildId:b.buildId,sourceCommit:b.sourceCommit??b.gitCommit??b.commit};if(process.env.CAGE100_EXPECTED_COMMIT)assert.equal(report.publicBuild.sourceCommit,process.env.CAGE100_EXPECTED_COMMIT);if(process.env.CAGE100_EXPECTED_BUILD)assert.equal(b.buildId,process.env.CAGE100_EXPECTED_BUILD);write();}
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
  const screen=name=>page.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();
  const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  const menu=async(group,entry)=>{await page.locator(`button.cm-toolbar__cell[data-menu-id="${group}"]`).click();await page.locator(`.cm-toolbar__menu:not([hidden]) button[data-entry-id="${entry}"]`).click();};
  const home=async()=>{await screen('RAISING_HOME');await page.locator('#cm-root[data-active-screen="RAISING_HOME"] canvas').first().waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');assert.equal(await page.locator('[data-field-fallback="true"]').count(),0);};
  const login=async()=>{await page.locator('#cm-login').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});};
  const saveQuit=async()=>{await menu('SYSTEM','saveQuit');await page.locator('#cm-login').waitFor({state:'visible'});};
  await page.goto(publicBase+'championship.html',{waitUntil:'domcontentloaded'});await login();assert.equal(await page.locator('#cm-continue').isEnabled(),false);await page.locator('#cm-new-game').click();
  const story=page.locator('.cm-opening-story'),deadline=Date.now()+120000;
  while(await story.count()){
   if(Date.now()>deadline)throw Error('Opening comic did not finish');
   for(const target of [page.locator('[data-story-action="text"]'),story]){
    if(!await target.isVisible())continue;
    try{await target.click({position:{x:10,y:10},timeout:3000});}catch(error){if(error.name!=='TimeoutError'||await target.isVisible())throw error;}
   }
   await page.waitForTimeout(1000);
  }
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();
  await page.locator('#cm-opening-name').fill('百格驗收');await page.locator('.cm-opening__name button[type="submit"]').click();
  await page.locator('.cm-opening__choices button').first().click();
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('.cm-opening__letter button').click();
  if(await page.locator('[data-egg-confirm]').isVisible())await page.locator('[data-egg-confirm]').click();
  await page.locator('#cm-opening-name').fill('驗收夥伴');await page.locator('.cm-opening__name button[type="submit"]').click();
  await home();const decline=page.locator('dialog[open] [data-action="decline"]');await decline.waitFor({state:'visible',timeout:15000});await decline.click();await decline.waitFor({state:'hidden'});
  await page.waitForFunction(key=>Boolean(localStorage.getItem(key)),saveKey);
  let state=await saved();assert.equal(state.shop.bits,8000000);assert.equal(state.flags.friendsPlaytest.diamonds,20000);
  report.assertions.push({newSaveBits:state.shop.bits,newSaveDiamonds:state.flags.friendsPlaytest.diamonds});write();console.log('Fresh normal onboarding complete');
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');assert.equal(await page.locator('.cm-vs2-cage-slot').count(),100);assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),20);
  for(let row=2;row<10;row++){
   await page.locator(`button[data-locked-test-row="${row}"]`).click();const dialog=page.locator('dialog[data-variant="ranch-row-purchase"]');await dialog.waitFor({state:'visible'});await dialog.locator('[data-action="buy"]').click();await dialog.waitFor({state:'detached'});
   assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),(row+1)*10);
  }
  state=await saved();assert.equal(state.flags.friendsPlaytest.diamonds,12000);assert.equal(await page.locator('[data-locked-test-row]').count(),0);await shot('01-100-cells');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await menu('SYSTEM','shop');await screen('SHOP');
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/catalogs/shop.r1.json'),'utf8')).records.filter(r=>r.category==='CAGES');const record=catalog.find(r=>r.itemIndex===23);
  await page.locator('.cm-vs2-shop__tab[data-category="CAGES"]').click();await page.locator('.cm-vs2-shop__row').nth(catalog.indexOf(record)).click();
  const detail=await page.locator('.cm-vs2-shop__detail-meta').innerText();const price=Number(detail.replaceAll(',','').match(/\d+/)[0]);assert.ok(price>0);
  assert.equal(price,record.unitPriceBits);
  const before=await saved();for(let i=0;i<3;i++){await page.locator('.cm-vs2-shop__buy').click();await page.waitForTimeout(260);}
  state=await saved();assert.equal(state.shop.cageQuantities[record.shopRecordIndex],3);assert.equal(state.shop.bits,before.shop.bits-price*3);await shot('02-repeat-purchase');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  for(const slot of [10,12,99]){await page.locator('.cm-vs2-cage-tray__item').filter({has:page.locator('img[src*="field_cm24_01"]')}).click();await page.locator(`.cm-vs2-cage-slot[data-slot-index="${slot}"]`).click();}
  await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer .cm-vs2-action--primary').click();
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();state=await saved();
  const moduleId=`championship:2026:cage:${record.itemIndex}`,copies=state.cageEdit.placements.filter(p=>p.moduleId===moduleId);assert.equal(copies.length,3);assert.equal(new Set(copies.map(p=>p.instanceId)).size,3);
  const money=state.shop.bits,stock=state.shop.cageQuantities[record.shopRecordIndex];await page.reload({waitUntil:'domcontentloaded'});await login();await page.locator('#cm-continue').click();await home();
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');await page.locator('.cm-vs2-cage-slot[data-slot-index="12"]').click();await page.locator('.cm-vs2-cage-slot[data-slot-index="14"]').click();
  await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer .cm-vs2-action--primary').click();
  await page.locator('.cm-vs2-cage-slot[data-slot-index="99"]').click();await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer .cm-vs2-action--primary').click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('03-mobile-editor');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await shot('04-mobile-ranch');await saveQuit();state=await saved();
  assert.equal(state.shop.bits,money);assert.equal(state.shop.cageQuantities[record.shopRecordIndex],stock);const remaining=state.cageEdit.placements.filter(p=>p.moduleId===moduleId);assert.equal(remaining.length,2);assert.equal(remaining.find(p=>p.slotIndex===14).instanceId,copies.find(p=>p.slotIndex===12).instanceId);
  report.assertions.push({totalCells:100,initialOpenCells:20,landRowsPurchased:8,landCostDiamonds:8000,diamondsRemaining:12000,unitPrice:price,purchasedCopies:3,uniquePlacementIds:3,afterWithdrawalPlaced:2,owned:stock,moneyAfterReload:money,movedCopyRetainedId:true,mobileViewport:{width:390,height:844},mobileDocumentOverflow:false});
  assert.deepEqual(report.errors,[]);report.passed=true;report.completed=new Date().toISOString();write();console.log(JSON.stringify({passed:true,assertions:report.assertions}));
 }catch(error){report.passed=false;report.failure={message:error.message,stack:error.stack};write();if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{await context?.tracing.stop({path:path.join(output,'normal-flow-trace.zip')}).catch(()=>{});await context?.unrouteAll({behavior:'wait'});await context?.close();await browser?.close();await server?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
