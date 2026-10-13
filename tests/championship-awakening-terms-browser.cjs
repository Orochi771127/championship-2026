// Public formal artifact, fresh profiles, existing fixture and normal DOM UI.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='https://orochi771127.github.io/championship-2026/',root=path.resolve('dist/github-playtest');
const out=path.resolve('.tmp/awakening-terms-20261013/browser');fs.mkdirSync(out,{recursive:true});
const saveKey='championshipModernSave:v1';let seed;
const names={'zh-Hant':'覺醒體',en:'Awakened',ja:'覚醒体',th:'ร่างตื่นพลัง',vi:'Thức tỉnh'};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const results=[];let browser;
async function stageFiveQaCopy(){
 const [save,identity,raising,capture,sources,profile]=await Promise.all([
  import('../src/championship/app/championshipStandaloneSave.js'),import('../src/championship/raising/raisingInstanceIdentity.js'),
  import('../src/championship/app/championshipRaisingProduction.js'),import('../src/championship/hunt/capture/nativeHuntIndividual.js'),
  import('../src/championship/hunt/capture/nativeHuntSources.js'),import('../src/championship/raising/nativeIndividualProfile.js')]);
 const base=save.deserializeChampionshipModernSave(fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
 const assigned=identity.allocateRaisingInstanceIdentity(base.instanceIdentity,{creature:base.creature,residents:JSON.parse(base.raisingHome).payload?.residents??[],collection:base.raising.collection,assignments:base.raising.assignments,interactions:base.raising.interactions});
 const species=sources.nativeHuntSpeciesByIndex(137);assert.equal(species.generation,5);
 const nativeProfile=profile.nativeIndividualProfile(capture.createNativeHuntIndividual({species,rng:{next:()=>7},nameOverride:'QA'}),'species-137');
 let next=raising.recordEnclosedCreature(base.raising,{instanceId:assigned.instanceId,speciesId:'species-137',displayName:'階段文字 QA',enclosedAt:'2026-10-13T00:00:00.000Z',originGateId:null,cageId:null});
 next={...next,collection:next.collection.map(e=>e.instanceId===assigned.instanceId?{...e,successAuthority:'QA_FULL_SAVE_FIXTURE',nativeProfile}:e)};
 const text=save.serializeChampionshipModernSave(save.createChampionshipModernSave({...base,raisingHomeSerialized:base.raisingHome,raising:next,instanceIdentity:assigned.state}));
 save.deserializeChampionshipModernSave(text);return text;
}
async function menu(page,id,entry){await page.locator(`button[data-menu-id="${id}"]`).click();await page.locator(`[data-entry-id="${entry}"]`).click();}
async function home(page){await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:60000});}
(async()=>{
 seed=await stageFiveQaCopy();
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [locale,name] of Object.entries(names)){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({saveKey,seed,locale})=>{localStorage.setItem(saveKey,seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale,reducedMotion:'on'}));window.__qaReady=false;addEventListener('championship:ready',()=>window.__qaReady=true);},{saveKey,seed,locale});
  await context.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(base)){missing.push('external');return route.abort();}
   const rel=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,rel||'index.html');
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){missing.push(rel);return route.fulfill({status:404,body:'missing QA artifact input'});}
   return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'}).catch(()=>{});
  });
  try{
   await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>__qaReady);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await home(page);
   assert.equal(await page.locator('html').getAttribute('lang'),locale);assert.equal(await page.locator('canvas').count(),1);
   await menu(page,'MANAGEMENT','digimon');await page.locator('.cm-digimon-list').waitFor();
   const buttons=page.locator('.cm-digimon-item__button');let found=false;
   for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();if((await page.locator('.cm-digimon-detail').innerText()).includes(name)){found=true;break;}}
   assert.equal(found,true,`${locale}: fixture stage five visible in Raising roster`);
   await page.locator('.cm-digimon-detail__value').filter({hasText:name}).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,locale+'-raising-roster.png')});await page.locator('.cm-digimon-back').click();await home(page);
   await menu(page,'SYSTEM','shop');await page.locator('[data-category="PLUGINS"]').click();
   const cards=page.locator('.cm-vs2-shop__row');let radar=false;
   for(let i=0;i<await cards.count();i++){
    await cards.nth(i).click();const text=await page.locator('.cm-vs2-shop__detail-description').innerText();
    if(text.toLowerCase().includes(name.toLowerCase())){radar=true;break;}
   }
   assert.equal(radar,true,`${locale}: Awakened radar explanation visible`);
   await page.screenshot({path:path.join(out,locale+'-shop-radar.png')});await page.locator('.cm-vs2-footer button').first().click();await home(page);
   await menu(page,'SYSTEM','database');await page.locator('[data-species-index="137"]').click();
   await page.locator('.cm-vs2-database__detail-title').waitFor();
   await page.screenshot({path:path.join(out,locale+'-database.png')});
   await page.locator('.cm-vs2-footer button').first().click();await page.locator('.cm-vs2-footer button').first().click();await home(page);
   await menu(page,'SYSTEM','help');await page.locator('.cm-help-list').waitFor();
   const stage=['th','vi'].includes(locale)?26:32,stageNode=page.locator(`[data-entry-index="${stage}"]`);
   assert.equal((await stageNode.innerText()).trim(),name);
   await stageNode.scrollIntoViewIfNeeded();if(!['th','vi'].includes(locale))await stageNode.click();
   await page.screenshot({path:path.join(out,locale+'-help.png')});
   // Existing Thai/Vietnamese help tables place this label in the heading run;
   // the terminology patch preserves their current record/heading mapping.
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
   results.push({locale,passed:true,raisingStage:name,radarDescription:true,databaseSpeciesIndex:137,databaseStageField:'existing view has no generation row; no field added',helpStageEntry:stage,seededFixture:'isolated full-QA copy plus one generation-5 individual from existing native constructor',normalDomNavigation:true,viewport:{width:390,height:844},physicalDeviceAccepted:false});console.log('PASS '+locale);
  }catch(e){results.push({locale,passed:false,error:String(e)});await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
  finally{await context.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({artifactBuildId:JSON.parse(fs.readFileSync(path.join(root,'pages-build.json'))).buildId,mockedApprovedOrigin:base,nativeSpeakerReview:{th:false,vi:false},physicalDeviceAccepted:false,results},null,2)+'\n');await browser?.close();});
