// Seeded checkpoint rendered by the normal Continue/UI path in a fresh profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'.'),before=process.argv.includes('--record-before');
const output=require('./browser-qa-output.cjs')('tutorial-cave-visibility');fs.mkdirSync(output,{recursive:true});
const key='championshipModernSave:v1';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
(async()=>{
 const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json')),cages:JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages,rngClock:()=>({hour:1,minute:2,second:3})});
 await app.newGame({trainerName:'QA',eggName:'Egg'});app.save();const seed=JSON.parse(storage.getItem(key));await app.dispose();
 seed.progression.nativeOpening={version:2,trainerName:'QA',tutorialStep:null,checkpoint:{version:1,stage:'hunt-escape-explain',message:0}};
 const missing=[],errors=[],checks=[];
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 const base='https://orochi771127.github.io/championship-2026/';
 await context.route('**/*',async route=>{
  if(!route.request().url().startsWith(base)){await route.abort();return;}
  const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(new URL(base).pathname.length));const file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(relative);await route.fulfill({status:404,body:'missing QA input'});return;}
  await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 await page.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({muted:true,reducedMotion:'on'}));},{seed,key});
 const positions=()=>page.locator('.cm-vs2-field__canvas').evaluate(el=>JSON.parse(el.dataset.wildScreenPositions||'null'));
 try{
  await page.goto(base+(process.env.CHAMPIONSHIP_QA_ARTIFACT?'index.html':'championship.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.waitForFunction(()=>document.querySelector('.cm-vs2-field__canvas')?.dataset.wildScreenPositions!==undefined);
  await page.screenshot({path:path.join(output,before?'before-1544.png':'after-1544.png')});
  const cave=await positions();checks.push({message:1544,positions:cave});
  if(before){assert.equal(cave.length,1);console.log('TUTORIAL_CAVE_BEFORE_VISIBLE',cave.length);}
  else{
   assert.deepEqual(cave,[]);await page.locator('dialog button[data-action="next"]').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('championshipModernSave:v1')).progression.nativeOpening.checkpoint.message===1);
   await page.screenshot({path:path.join(output,'after-1545.png')});assert.deepEqual(await positions(),[]);checks.push({message:1545,positions:[]});
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.cm-vs2-field__canvas')?.dataset.wildScreenPositions!==undefined);assert.deepEqual(await positions(),[]);
   await page.locator('dialog button[data-action="next"]').click();
   await page.waitForFunction(()=>document.querySelector('.cm-tutorial-guidance')?.dataset.stage==='hunt-return-demo');assert.deepEqual(await positions(),[]);
   await page.waitForFunction(()=>document.querySelector('.cm-tutorial-guidance')?.dataset.stage==='hunt-food-intro');assert.equal((await positions()).length,1);checks.push({stage:'hunt-food-intro',positions:await positions()});
   await page.screenshot({path:path.join(output,'returned.png')});console.log('TUTORIAL_CAVE_VISIBILITY_PASS');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }finally{fs.writeFileSync(path.join(output,before?'before.json':'result.json'),JSON.stringify({root,checks,errors,missing,seededCheckpoint:true,physicalSafari:'UNVERIFIED'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
