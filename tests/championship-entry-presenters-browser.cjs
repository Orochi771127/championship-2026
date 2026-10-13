// Normal UI entry into the deferred presenters, using an existing disposable
// QA save and fully intercepted approved-artifact URLs. No game/RNG overrides.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{login}=require('./championship-browser-opening.cjs');
const root=path.resolve('dist/github-playtest'),base='https://orochi771127.github.io/championship-2026/';
const output=path.resolve('docs/reports/title-entry-2026-10-13/presenters-browser.json');
const report={schemaVersion:1,normalUi:true,physicalDeviceAccepted:false,checks:[],errors:[],missing:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
let browser;
async function screen(page,id){await page.waitForFunction(id=>document.getElementById('cm-root')?.dataset.activeScreen===id,id,{timeout:120000});}
async function menu(page,id){await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator(`[data-entry-id="${id}"]`).click();}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(seed=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({theme:'warm',reducedMotion:'on',muted:true}));},fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
 await ctx.route('**/*',async r=>{
  assert.ok(r.request().url().startsWith(base));const relative=decodeURIComponent(new URL(r.request().url()).pathname.slice('/championship-2026/'.length)),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){report.missing.push(relative);return r.fulfill({status:404,body:'Missing QA input'});}
  return r.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await login(page);await page.locator('#cm-continue').click();await screen(page,'RAISING_HOME');
 await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
 await page.locator('.cm-raising-pixi-canvas').evaluate(e=>e.dataset.qaPixiOwner='same');
 const sameCanvas=async()=>assert.equal(await page.locator('canvas[data-qa-pixi-owner="same"]').count(),1);
 await sameCanvas();report.checks.push('normal Continue -> deferred Raising, same Pixi canvas');
 for(const id of ['shop','database']){
  await menu(page,id);await screen(page,id.toUpperCase());
  if(id==='database'){await page.locator('.cm-vs2-database__row').first().click();await page.locator('.cm-vs2-footer button').first().click();}
  await page.locator('.cm-vs2-footer button').first().click();await screen(page,'RAISING_HOME');await sameCanvas();report.checks.push(`deferred ${id} -> Raising`);
 }
 await page.locator('button[data-menu-id="MANAGEMENT"]').click();await page.locator('[data-entry-id="cageEdit"]').click();await screen(page,'CAGE_EDIT');await page.locator('.cm-vs2-footer button').first().click();await screen(page,'RAISING_HOME');await sameCanvas();report.checks.push('deferred Cage edit -> Raising');
 await menu(page,'hunt');await screen(page,'GATE_SELECT');
 await page.locator('.cm-vs2-gate3d__toggle').click();await page.locator('.cm-vs2-gate[data-availability="AVAILABLE"]').first().click();await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await screen(page,'HUNT_LOADOUT');
 await page.locator('.cm-vs2-loadout__option').first().click();await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await screen(page,'HUNT_FIELD');
 await page.locator('.cm-vs2-field__loading').waitFor({state:'detached'});await sameCanvas();await page.locator('.cm-vs2-hud__exit').click();await screen(page,'RAISING_HOME');await sameCanvas();report.checks.push('deferred Gate -> Loadout -> Hunt field -> Raising');
 await menu(page,'battle');await screen(page,'BATTLE_SELECT');await page.locator('.cm-vs5-cube__face').filter({hasText:'練習對戰'}).click();
 const rows=page.locator('.cm-vs5-practice-member');await rows.first().waitFor();let a=false,b=false;
 for(let i=0;i<await rows.count()&&!(a&&b);i++){const buttons=rows.nth(i).locator('button');if(!a&&!(await buttons.nth(0).isDisabled())){await buttons.nth(0).click();a=true;continue;}if(!b&&!(await buttons.nth(1).isDisabled())){await buttons.nth(1).click();b=true;}}
 assert.ok(a&&b);await page.getByRole('button',{name:'開始練習',exact:true}).click();await screen(page,'BATTLE_FIELD');await sameCanvas();
 await screen(page,'BATTLE_RESULT');
 while(await page.getByRole('button',{name:'下一頁',exact:true}).isVisible())await page.getByRole('button',{name:'下一頁',exact:true}).click();
 await page.locator('.cm-vs5-exit:visible').click();await screen(page,'RAISING_HOME');await sameCanvas();report.checks.push('deferred Battle select -> actual practice -> Result -> Raising');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='PASS';console.log(JSON.stringify(report));await ctx.close();
})().catch(e=>{report.status='FAIL';report.error=String(e);console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');await browser?.close();});
