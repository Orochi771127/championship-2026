const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');const {login}=require('./championship-browser-opening.cjs');
const fast=false,report={errors:[],missing:[],requests:[],naturalTicker:true,unmodifiedCompiledArtifact:true};
const out=path.resolve(process.env.AW12_BUILD_OUTPUT||'../browser-built-r7'),root=path.resolve('dist/github-playtest');fs.mkdirSync(out,{recursive:true});
const origin='https://orochi771127.github.io',prefix='/championship-2026/';
const write=()=>fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(report,null,2)+'\n');
async function seed(){
 const [save,identity,raising,capture,sources,profile]=await Promise.all([
 import('../src/championship/app/championshipStandaloneSave.js'),import('../src/championship/raising/raisingInstanceIdentity.js'),
 import('../src/championship/app/championshipRaisingProduction.js'),import('../src/championship/hunt/capture/nativeHuntIndividual.js'),
 import('../src/championship/hunt/capture/nativeHuntSources.js'),import('../src/championship/raising/nativeIndividualProfile.js')]);
 const b=save.deserializeChampionshipModernSave(fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
 const assigned=identity.allocateRaisingInstanceIdentity(b.instanceIdentity,{creature:b.creature,residents:JSON.parse(b.raisingHome).payload?.residents??[],collection:b.raising.collection,assignments:b.raising.assignments,interactions:b.raising.interactions});
 const burst=await import('../src/championship/contracts/productBurstEvolution.js');
 assert.ok(burst.burstFormsFor(76).some(f=>f.form===144));
 const species=sources.nativeHuntSpeciesByIndex(76);assert.ok(species);
 const nativeProfile=profile.nativeIndividualProfile(capture.createNativeHuntIndividual({species,rng:{next:()=>7},traitOverride:fast?2:-1,nameOverride:'AW12 QA'}),'species-076');
 let next=raising.recordEnclosedCreature(b.raising,{instanceId:assigned.instanceId,speciesId:'species-076',displayName:'AW12 QA',enclosedAt:'2026-11-09T00:00:00.000Z',originGateId:null,cageId:null});
 next={...next,collection:next.collection.map(e=>e.instanceId===assigned.instanceId?{...e,successAuthority:'QA_FULL_SAVE_FIXTURE',nativeProfile}:e)};
 report.instanceId=assigned.instanceId;
 const learned=burst.learnAwakening(burst.normalizeBurstEvolution(b.progression.burstEvolution),assigned.instanceId,144);
 const appearance=burst.setAwakeningAppearance(learned,assigned.instanceId,144);assert.ok(appearance);
 report.fixture={canonicalBase:76,learnedAppearance:144,traitOverride:fast?2:null,authority:'ISOLATED_QA_FIXTURE_NOT_PLAYER_PROGRESSION'};
 return save.serializeChampionshipModernSave(save.createChampionshipModernSave({...b,raisingHomeSerialized:b.raisingHome,raising:next,instanceIdentity:assigned.state,progression:{...b.progression,burstEvolution:appearance}}));
}

(async()=>{
 const fixture=await seed(),browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference'}),page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')(report.consoleErrors??=[]).push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});if(r.url().includes('aw12-two-set'))report.requests.push({url:r.url(),status:r.status()});});
 await context.addInitScript(seed=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true,reducedMotion:'off'}));},fixture);
 await context.route(origin+prefix+'**',async route=>{
  const u=new URL(route.request().url()),rel=decodeURIComponent(u.pathname.slice(prefix.length))||'index.html',p=path.resolve(root,rel);
  assert.ok(p.startsWith(root+path.sep));
  if(!fs.existsSync(p)){report.missing.push({local:rel});return route.fulfill({status:404,body:'missing artifact'});}
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.wasm':'application/wasm','.svg':'image/svg+xml'};
  await route.fulfill({path:p,contentType:types[path.extname(p)]||'application/octet-stream'});
 });
 try{
  await page.goto(origin+prefix+'championship.html?arenaQa=1',{waitUntil:'domcontentloaded'});await login(page);await page.locator('#cm-continue').click();
  await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');await page.waitForTimeout(8000);
  report.ranch=await page.locator('.int-rh2-field-host').evaluate(e=>({...e.dataset}));
  for(const [width,height] of [[1366,768],[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`ranch-${width}x${height}.png`)});}
  await page.setViewportSize({width:1366,height:768});await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();await page.locator('#cm-data-arena').click();await page.locator('.da-mode[data-mode="RELAY"]').click();
  await page.locator('button[data-partner="relay-species-076"]').last().click();await page.locator('.da-panel--select .da-btn--primary').click();await page.locator('.da-panel--brief .da-btn--primary').click();await page.waitForFunction(()=>globalThis.__dataArenaQA?.state()==='PLAY');
  report.arena=[];
  for(let i=0;i<240;i++){
   const s=await page.evaluate(()=>({snapshot:__dataArenaQA.snapshot(),animation:__dataArenaQA.diagnostics().scene?.playerAnimation}));report.arena.push(s);
   if(await page.locator('button[data-burst="READY"]:visible').count())await page.keyboard.press('KeyB');
   if(s.animation?.reviewed?.assetId?.startsWith('aw12-r6-')){report.aw12ArenaObserved=true;break;}
   if(i%2)await page.keyboard.press('ArrowUp');else await page.keyboard.press('ArrowDown');await page.waitForTimeout(500);
  }
  assert.equal(report.aw12ArenaObserved,true);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(700);await page.keyboard.up('ArrowRight');
  for(const [width,height] of [[1366,768],[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`arena-${width}x${height}.png`)});}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
  const paths=[...new Set(report.requests.map(r=>new URL(r.url).pathname))];assert.equal(paths.length,6);assert.ok(report.requests.every(r=>r.status===200));report.aw12RequestedFileCount=paths.length;report.pass=true;
 }catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{write();await context.close();await browser.close();}
})();
