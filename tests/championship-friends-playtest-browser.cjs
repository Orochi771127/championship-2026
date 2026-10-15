// Real public UI, fresh isolated profiles, exact built bytes. No app/state injection,
// fake timers, private gameplay methods, fixture edits or custom browser/GPU flags.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {resolveAsset,serveBuild}=require('./alternate-form-browser-support.cjs');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const output=require('./browser-qa-output.cjs')('friends-playtest');fs.mkdirSync(output,{recursive:true});
const publicBase='https://orochi771127.github.io/championship-2026/',saveKey='championshipModernSave:v1';
const evidence={status:'RUNNING',commit:process.env.GITHUB_SHA||null,assertions:[],console:[],pageErrors:[],networkErrors:[]};
const digits=s=>Number(String(s).replace(/[^0-9]/g,''));
const write=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');
(async()=>{
 const build=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json')));evidence.buildId=build.buildId;assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');assert.equal(build.publicPlaytest?.ownerApproved,true);
 assert.ok(resolveAsset(root,'/championship.html'));assert.ok(resolveAsset(root,'/full-qa-save.html'));
 const server=await serveBuild(root);let browser,context,page;
 async function fresh(label){
  if(context){await context.tracing.stop({path:path.join(output,evidence.context+'-trace.zip')});await context.close();}
  evidence.context=label;
  context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',acceptDownloads:true,serviceWorkers:'block'});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(server.origin+'/'))return route.continue();
   if(url.startsWith(publicBase)){
    const parsed=new URL(url),relative=parsed.pathname.slice(new URL(publicBase).pathname.length);
    if(resolveAsset(root,'/'+relative)){const response=await route.fetch({url:server.origin+'/'+relative+parsed.search,maxRedirects:0});return route.fulfill({response});}
   }
   evidence.networkErrors.push({context:label,url,error:'NON_BUILD_REQUEST_BLOCKED'});return route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('requestfailed',r=>{const error=r.failure()?.errorText;if(error!=='net::ERR_ABORTED')evidence.networkErrors.push({context:label,url:r.url(),error});});
  page.on('pageerror',e=>evidence.pageErrors.push({context:label,error:e.message}));
  page.on('console',m=>evidence.console.push({context:label,type:m.type(),text:m.text()}));
  page.on('response',r=>{if(r.status()>=400)evidence.networkErrors.push({context:label,url:r.url(),status:r.status()});});
 }
 const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey); // Read only.
 async function login(){
  await page.locator('#cm-login').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  if(await page.locator('#cm-film-skip').isVisible()){
   await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});
   await page.waitForTimeout(400); // Respect the real film input guard, never alter clocks.
  }
  await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});
 }
 async function screen(name){await page.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();}
 async function home(){await screen('RAISING_HOME');await page.locator('button.cm-toolbar__cell[data-menu-id="MANAGEMENT"]').waitFor();await page.locator('#cm-root[data-active-screen="RAISING_HOME"] canvas').first().waitFor({state:'visible',timeout:180000});await page.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host');const a=JSON.parse(h?.dataset.residentAssets||'[]');return h?.dataset.loadState==='ready'&&a.length>0&&a.every(x=>x.state==='ready');},{},{timeout:180000});assert.equal(await page.locator('[data-field-fallback="true"]').count(),0);}
 async function menu(group,entry){await page.locator(`button.cm-toolbar__cell[data-menu-id="${group}"]`).click();await page.locator(`.cm-toolbar__menu:not([hidden]) button[data-entry-id="${entry}"]`).click();}
 async function saveQuit(){await menu('SYSTEM','saveQuit');await page.locator('#cm-login').waitFor({state:'visible'});}
 async function continueSaved(){await login();await page.locator('#cm-continue').click();await home();}
 async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile document must not overflow');}
 async function wallet(amount){const button=page.locator('.cm-status-bar__diamond');await button.waitFor({state:'visible'});assert.equal(digits(await button.innerText()),amount);assert.match(await button.getAttribute('aria-label'),/測試/);}
 try{
  browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:true});evidence.browserVersion=browser.version();
  evidence.launch={channel:'chromium',headless:true,chromiumSandbox:true,customArgs:[]};
  await fresh('new-save');await page.goto(publicBase+'championship.html',{waitUntil:'domcontentloaded'});await login();
  assert.equal(await page.locator('#cm-continue').isEnabled(),false,'Fresh profile must have no save');
  await page.locator('#cm-new-game').click();
  // Advance the normal comic using its real click affordance, without touching time/state.
  const story=page.locator('.cm-opening-story');
  const until=Date.now()+120000;
  while(await story.count()){
   if(Date.now()>until)throw Error('Normal opening comic did not finish');
   const text=page.locator('[data-story-action="text"]');if(await text.isVisible())await text.click();
   if(await story.isVisible())await story.click({position:{x:10,y:10}});
   await page.waitForTimeout(1200);
  }
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();
  await page.locator('#cm-opening-name').fill('朋友測試');await page.locator('.cm-opening__name button[type="submit"]').click();
  await page.locator('.cm-opening__choices button').first().click();
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('.cm-opening__letter button').click();
  if(await page.locator('[data-egg-confirm]').isVisible())await page.locator('[data-egg-confirm]').click();
  await page.locator('#cm-opening-name').fill('小夥伴');await page.locator('.cm-opening__name button[type="submit"]').click();
  await home();
  const decline=page.locator('dialog[open] [data-action="decline"]');
  await decline.waitFor({state:'visible',timeout:15000});await decline.click();await decline.waitFor({state:'hidden'});
  // The existing renderer-owned diagnostics are enabled by normal onboarding.
  // Decline must keep the already loaded egg on screen, not merely leave a canvas.
  const settledActors=[];
  for(let sample=0;sample<3;sample++){
   await page.waitForTimeout(250);
   const state=await page.locator('.int-rh2-field-host').evaluate(host=>({height:host.clientHeight,width:host.clientWidth,assets:JSON.parse(host.dataset.residentAssets||'[]'),positions:JSON.parse(host.dataset.residentScreenPositions||'[]')}));
   assert.ok(state.positions.length>0,'Renderer must report the real resident after tutorial decline');
   assert.ok(state.positions.some(p=>state.assets.some(a=>a.creatureId===p.creatureId&&a.state==='ready')&&p.x>0&&p.x<state.width&&p.bodyTop>=0&&p.footY>p.bodyTop&&p.footY<state.height),'Loaded partner body and feet must remain inside the settled viewport');
   settledActors.push(state);
  }
  evidence.assertions.push({settledNewSaveActors:settledActors});write();
  const initial=await saved();assert.equal(initial.shop.bits,100000);assert.equal(initial.flags.friendsPlaytest.diamonds,10000);
  assert.equal(digits(await page.locator('.cm-status-bar__bits-value').innerText()),100000);await wallet(10000);await noOverflow();await shot('01-new-wallet');
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),20);
  for(const [row,balance,total]of [[2,9000,30],[3,8000,40],[4,7000,50]]){
   const button=page.locator(`.cm-cage-expansion [data-buy-test-row="${row}"],button.cm-vs2-action[data-buy-test-row="${row}"]`).first();
   const label=await button.innerText();assert.match(label.replaceAll(',',''),/1000/);assert.match(label,/測試鑽/);assert.match(label,/10/);
   await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box&&box.height>=44,'Row purchase touch target');assert.ok(box.x>=0&&box.x+box.width<=390,'Purchase label/control stays inside mobile viewport');await noOverflow();
   await button.click();await page.waitForFunction(({key,balance})=>JSON.parse(localStorage.getItem(key)).flags.friendsPlaytest.diamonds===balance,{key:saveKey,balance});
   assert.equal(digits(await page.locator('[data-test-diamond-balance]').innerText()),balance);
   assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),total);await shot('row-'+row);
  }
  assert.equal(await page.locator('button.cm-vs2-action[data-buy-test-row]').count(),0);
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await wallet(7000);await saveQuit();
  await page.reload({waitUntil:'domcontentloaded'});await continueSaved();await wallet(7000);
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),50,'Reload must restore all purchased grid rows');await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();
  const afterRows=await saved();assert.equal(afterRows.shop.bits,100000);assert.deepEqual(afterRows.flags.friendsPlaytest.purchases,[2,3,4]);assert.equal(afterRows.flags.friendsPlaytest.diamonds,7000);
  await menu('SYSTEM','shop');await screen('SHOP');
  let purchase;
  for(const tab of await page.locator('.cm-vs2-shop__tab').all()){
   await tab.click();
   for(const [cardIndex,card] of (await page.locator('.cm-vs2-shop__row').all()).entries()){
    await card.click();const buy=page.locator('.cm-vs2-shop__buy');const values=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g)?.map(Number);
    if(await buy.isEnabled()&&values?.[0]>0){purchase={price:values[0],owned:values[1],category:await tab.getAttribute('data-category'),cardIndex,itemName:await page.locator('.cm-vs2-shop__detail-name').innerText()};await buy.click();break;}
   }if(purchase)break;
  }
  assert.ok(purchase,'A normally paid, not fully owned item must be purchasable');
  const purchasedMeta=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g).map(Number);assert.equal(purchasedMeta[1],purchase.owned+1,'Paid purchase must increase actual displayed ownership');
  assert.equal(digits(await page.locator('.cm-vs2-shop__wallet').innerText()),100000-purchase.price);
  await shot('05-shop-purchased');await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();await continueSaved();
  const afterShop=await saved();assert.equal(afterShop.shop.bits,100000-purchase.price);assert.notDeepEqual({quantities:afterShop.shop.quantities,cageOwned:afterShop.shop.cageOwned},{quantities:afterRows.shop.quantities,cageOwned:afterRows.shop.cageOwned},'Persisted inventory, not just wallet, must change');assert.equal(afterShop.flags.friendsPlaytest.diamonds,7000);
  await menu('SYSTEM','shop');await screen('SHOP');await page.locator(`.cm-vs2-shop__tab[data-category="${purchase.category}"]`).click();await page.locator('.cm-vs2-shop__row').nth(purchase.cardIndex).click();
  assert.equal(await page.locator('.cm-vs2-shop__detail-name').innerText(),purchase.itemName);
  const restoredItem=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g).map(Number);assert.equal(restoredItem[1],purchase.owned+1,'Purchased item ownership survives reload');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();
  await menu('SYSTEM','hunt');await screen('GATE_SELECT');
  const listToggle=page.locator('.cm-vs2-gate3d__toggle');if((await listToggle.innerText()).includes('場地列表'))await listToggle.click();
  let fee=0;
  for(const gate of await page.locator('[data-gate-id]').all()){
   if(!await gate.isVisible()||!await gate.isEnabled())continue;await gate.click();
   const confirm=page.getByRole('button',{name:'前往狩獵設定',exact:true});if(!await confirm.isEnabled())continue;await confirm.click();await screen('HUNT_LOADOUT');
   const nums=(await page.locator('.cm-vs2-destination__fee').innerText()).replaceAll(',','').match(/\d+/g)?.map(Number);fee=nums?.[0]||0;
   if(fee>0)break;await page.locator('#cm-root').getByRole('button',{name:'返回選場',exact:true}).click();if((await listToggle.innerText()).includes('場地列表'))await listToggle.click();
  }
  assert.ok(fee>0,'Use a paid gate, not a fee-waiver/free gate');
  await page.getByRole('button',{name:'開始狩獵',exact:true}).click();await screen('HUNT_FIELD');
  await page.locator('.cm-vs2-field__canvas[aria-busy="false"]').waitFor({timeout:180000});
  await page.locator('.cm-vs2-field__loading').waitFor({state:'detached',timeout:5000});
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0,'Hunt must not use an unplayable fallback');
  const huntCanvas=page.locator('.cm-vs2-field__canvas canvas').first();await huntCanvas.waitFor({state:'visible'});
  const huntBox=await huntCanvas.boundingBox();assert.ok(huntBox&&huntBox.width>0&&huntBox.height>0,'Normal Pixi hunt canvas must be visible');await shot('06-paid-hunt');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();
  const afterHunt=await saved();assert.equal(afterHunt.shop.bits,afterShop.shop.bits-fee);assert.equal(afterHunt.flags.friendsPlaytest.diamonds,7000);
  evidence.assertions.push({freshUi:true,rowBalances:[10000,9000,8000,7000],shopPrice:purchase.price,huntFee:fee,finalBits:afterHunt.shop.bits});write();
  // A separate empty browser profile uses the existing QA installer UI, not an edited save.
  await fresh('old-qa');await page.goto(publicBase+'full-qa-save.html',{waitUntil:'domcontentloaded'});
  await page.locator('#install').waitFor();await page.waitForFunction(()=>!document.querySelector('#install').disabled);await page.locator('#install').click();await page.waitForURL(/championship\.html$/);
  const old=await saved();const oldFixture=JSON.parse(fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json')));assert.deepEqual(old.shop,oldFixture.shop,'Installer must preserve fixture economy/inventory');assert.deepEqual(old.cageEdit.placements,oldFixture.cageEdit.placements,'Installer must preserve fixture anchors');await continueSaved();await wallet(0);await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),40);
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();
  const migrated=await saved();assert.deepEqual(migrated.shop,old.shop,'Continue/save must preserve entire old wallet, quantities, visibility and ownership');assert.deepEqual(migrated.cageEdit.placements,old.cageEdit.placements);assert.equal(migrated.flags.friendsPlaytest?.diamonds??0,0);
  evidence.assertions.push({oldQaPreserved:true,oldBits:old.shop.bits,oldPlacements:old.cageEdit.placements});await shot('07-old-save-preserved');
  assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.networkErrors,[]);
  assert.deepEqual(evidence.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[],'No renderer, asset fallback or console error may masquerade as a playable field');
  evidence.status='PASS';write();console.log('CHAMPIONSHIP_FRIENDS_PLAYTEST_BROWSER_PASS');
 }catch(error){evidence.status='FAIL';evidence.failure=error.stack||String(error);await shot('failure').catch(()=>{});write();throw error;}
 finally{if(context){await context.tracing.stop({path:path.join(output,evidence.context+'-trace.zip')}).catch(()=>{});await context.close();}if(browser)await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
