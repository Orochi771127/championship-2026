// Extends the normal intercepted Continue/Home/Database flow; no runtime hooks.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const rules=JSON.parse(fs.readFileSync('src/data/championship/catalogs/raising-lifecycle.r1.json','utf8')).rules;
module.exports=async function routes(page,{theme,locale,report,output,size}) {
 const detail=page.locator('.cm-vs2-database__detail'),list=page.locator('.cm-vs2-shop__list');
 const filter=page.locator('.cm-vs2-database__stage'),buttons=detail.locator('.cm-dex-routes__target');
 const open=async id=>{await size(page,1366,768);await filter.selectOption('');await list.locator(`[data-species-index="${id}"]`).click();};
 const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('.cm-dex-portrait')].every(e=>e.dataset.art!=='loading'));
 const knownTargetName=await list.locator('[data-species-index="20"] strong').textContent();
 const fullSource=rules.findIndex(r=>r.length===5)+8;
 for(const source of [8,9,fullSource]){
  await open(source);await ready();assert.equal(await buttons.count(),rules[source-8].length);
  const first=buttons.first();assert.equal(await first.getAttribute('data-branch-offset'),String((source-8)*5));
  assert.equal(await first.getAttribute('data-history'),source===9?'RECORDED':'NOT_RECORDED');
  assert.equal(await first.isEnabled(),source===9);
  if(source===8){assert.equal(await first.locator('.cm-dex-routes__name').textContent(),'????');assert.ok(!(await first.getAttribute('aria-label')).includes(knownTargetName));}
  assert.equal(await detail.locator('img[alt]:not([alt=""]), img[title]').count(),0);
  for(const [width,height] of [[1366,768],[1366,480],[1024,420],[390,844],[1366,768]]){
   await size(page,width,height);
   const evidence=await detail.evaluate(e=>({overflow:document.documentElement.scrollWidth>innerWidth,images:[...e.querySelectorAll('.cm-dex-portrait img')].map(i=>({src:i.getAttribute('src'),hidden:i.hidden,filter:getComputedStyle(i).filter,revealed:i.parentElement.dataset.revealed})),buttons:[...e.querySelectorAll('.cm-dex-routes__target')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,revealed:b.dataset.revealed,history:b.dataset.history};}),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}));
   assert.equal(evidence.overflow,false);assert.equal(evidence.images.length,rules[source-8].length+1);assert.ok(evidence.images.length<=6);
   assert.ok(evidence.buttons.every(b=>b.width>=44&&b.height>=44));
   assert.ok(evidence.images.every(i=>i.src?.includes('/assets/production/characters/accepted-20261010/')));
   assert.ok(evidence.images.filter(i=>i.revealed==='false').every(i=>i.filter==='brightness(0)'));
   if(height===480){await detail.hover();await page.mouse.wheel(0,700);await page.clock.runFor(100);assert.ok(await detail.evaluate(e=>e.scrollTop)>0);}
   report.routes.push({theme,locale,source,viewport:[width,height],...evidence});
   if(['zh-Hant','th'].includes(locale)&&[768,844].includes(height))await page.screenshot({path:path.join(output,`${theme}-${locale}-routes-${source}-${width}x${height}.png`)});
  }
 }
 await filter.selectOption('1');await list.locator('[data-species-index="9"]').click();await ready();
 await buttons.first().focus();assert.equal(await buttons.first().evaluate(e=>e===document.activeElement),true);
 await buttons.first().click();assert.equal(await filter.inputValue(),'2');
 const target=await list.locator('[aria-pressed="true"]').getAttribute('data-species-index');
 assert.equal(await detail.locator('h2').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),target);
 for(const id of [160,211,222]){
  await open(id);await ready();assert.equal(await buttons.count(),0);assert.equal(await detail.locator('.cm-dex-routes').count(),1);
  if(id!==160){assert.equal(await detail.locator('.cm-dex-portrait').getAttribute('data-art'),'missing');assert.ok(!(await detail.locator('.cm-dex-portrait').textContent()).includes('????'));assert.equal(await detail.locator('input').count(),0);}
 }
 for(const id of [96,97]){
  // Exact selected identity comes from the existing 96/97 ->226/227 aliases.
  await open(id);await ready();const src=await detail.locator('.cm-dex-routes__source img').getAttribute('src');
  assert.ok(src.includes('/accepted-20261010/'));assert.equal(await detail.locator('.cm-dex-routes__source .cm-dex-portrait').getAttribute('data-art'),'ready');
 }
 await open(10);assert.equal(await detail.locator('.cm-dex-routes, img, input').count(),0);
 await filter.selectOption('0');await list.locator('[data-species-index="0"]').click();assert.equal(await detail.locator('.cm-dex-routes').count(),0);
 // Hold a selected-source manifest, switch away, then let its old callback run.
 if(theme==='warm'&&locale==='zh-Hant'){
  await open(211);let release,received;const gate=new Promise(r=>{release=r;}),request=new Promise(r=>{received=r;});
  const match='**/m001_zurumon-early64-raw-v2-r03/hud-r01/manifest.json';
  const hold=async route=>{received();await gate;try{await route.fallback();}catch(error){if(!/cancel|closed|disposed|abort/i.test(error.message))throw error;}};
  await page.route(match,hold);await open(8);await request;await open(9);release();await ready();
  assert.equal(await list.locator('[aria-pressed="true"]').getAttribute('data-species-index'),'9');
  assert.ok(!(await detail.locator('.cm-dex-routes__source img').getAttribute('src')).includes('m001_zurumon'));
  await page.unroute(match,hold);report.routeLifecycle={delayedManifestIgnored:true,selection:'9'};
 }
 await size(page,1366,768);await filter.selectOption('');
 report.routeOperations.push({theme,locale,independentHistory:true,registeredZeroOwned:true,unknownSourceMasked:true,eggsNoRoutes:true,missing211222:true,acceptedAliases9697:true,routeFocus:true,routeStageNavigation:true,shortScroll:true});
};
