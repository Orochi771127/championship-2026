const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const BASE=process.env.CHAMPIONSHIP_QA_ORIGIN||'http://127.0.0.1:18743';
const OUTPUT=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'output/playwright','hunt-tools');
fs.mkdirSync(OUTPUT,{recursive:true});
(async()=>{
 const {HUNT_EQUIPMENT_ITEMS}=await import('../src/championship/hunt/loadout/huntEquipmentCatalog.js');
 const {huntToolIconPresentation}=await import('../src/championship/presentation/shopGoodsUiArt.js');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHAMPIONSHIP_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results={variants:[],states:[],fallbacks:[]};
 try{
  const variants=await browser.newContext({viewport:{width:560,height:844},deviceScaleFactor:2});
  const page=await variants.newPage();await page.goto(`${BASE}/tests/fixtures/championship-hunt-tool-art-review.html`);
  await page.waitForFunction(()=>Boolean(window.huntReview));
  for(const item of HUNT_EQUIPMENT_ITEMS){
   await page.evaluate(id=>window.huntReview.setItem(id),item.itemId);
   const image=page.locator(`[data-tool='${item.equipmentClass}'] .cm-hunt-tools__icon`);
   await image.evaluate(img=>img.decode());
   const art=huntToolIconPresentation({id:item.equipmentClass,itemId:item.itemId,shopRecordIndex:item.shopRecordIndex},BASE);
   assert.equal(await image.getAttribute('src'),art.src,item.itemId);
   results.variants.push({itemId:item.itemId,shopRecordIndex:item.shopRecordIndex,src:art.src});
  }
  await variants.close();
  for(const theme of ['modern','classic'])for(const dpr of [2,3]){
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dpr});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${BASE}/tests/fixtures/championship-hunt-tool-art-review.html?normal=1&theme=${theme}`);
   await page.waitForFunction(()=>Boolean(window.huntReview));
   await page.locator('.cm-hunt-tools__icon').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
   const metrics=await page.locator('.cm-hunt-tools__icon').evaluateAll(images=>images.map(img=>{
    const r=img.getBoundingClientRect(),style=getComputedStyle(img);return {src:img.getAttribute('src'),width:r.width,height:r.height,
     naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,sampling:style.imageRendering,fit:style.objectFit};
   }));
   for(const m of metrics){assert.equal(m.width,34);assert.equal(m.height,34);assert.equal(m.sampling,'auto');assert.equal(m.fit,'contain');}
   assert.deepEqual(metrics.map(m=>m.naturalWidth),[64,160,128,160]);
   if(theme==='modern')assert.equal(await page.locator('.cm-hunt-tools .cm-vs2-action[data-tool]').evaluateAll(buttons=>buttons.every(button=>
    button.querySelector('.cm-hunt-tools__icon').getBoundingClientRect().bottom<=button.querySelector('.cm-hunt-tools__label').getBoundingClientRect().top+1)),true,'wrapped counter overlaps its item image');
   await page.locator('.cm-hunt-tools [data-tool="ROPE"]').click();
   assert.equal(await page.locator('.cm-hunt-tools [data-tool="ROPE"]').getAttribute('aria-pressed'),'true');
   await page.evaluate(()=>window.huntReview.refresh());
   assert.equal(await page.locator('.cm-hunt-tools__icon').count(),4,'quantity render removed the icons');
   await page.screenshot({path:path.join(OUTPUT,`${theme}-dpr${dpr}.png`)});
   await page.evaluate(()=>window.huntReview.setQuantity('SHOT',0));
   assert.equal(await page.locator('.cm-hunt-tools [data-tool="SHOT"]').isDisabled(),true);
   assert.match(await page.locator('.cm-hunt-tools [data-tool="SHOT"]').textContent(),/×0/);
   assert.equal(await page.locator('.cm-hunt-tools [data-tool="SHOT"] .cm-hunt-tools__icon').isVisible(),true);
   assert.deepEqual(errors,[]);results.states.push({theme,dpr,metrics,selected:true,disabled:true,counterPreservesArt:true});
   await context.close();
  }
  for(const theme of ['modern','classic']){
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});const page=await context.newPage();
   await page.route('**/items/hunt49/ui--itemiconL_main--000.png',route=>route.fulfill({status:404,body:'missing'}));
   await page.goto(`${BASE}/tests/fixtures/championship-hunt-tool-art-review.html?normal=1&theme=${theme}`);
   await page.waitForFunction(()=>document.querySelector('.cm-hunt-tools [data-tool="ROPE"]')?.dataset.hasToolArt==='false');
   assert.equal(await page.locator('.cm-hunt-tools [data-tool="ROPE"] .cm-hunt-tools__icon').isVisible(),false);
   const text=page.locator('.cm-hunt-tools [data-tool="ROPE"] .cm-hunt-tools__label');assert.equal(await text.isVisible(),true);
   await page.locator('.cm-hunt-tools [data-tool="ROPE"]').click();assert.equal(await page.locator('.cm-hunt-tools [data-tool="ROPE"]').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:path.join(OUTPUT,`${theme}-missing-art.png`)});
   results.fallbacks.push({theme,labelVisible:true,selection:true});await context.close();
  }
  results.verdict='PASS';fs.writeFileSync(path.join(OUTPUT,'validation.json'),JSON.stringify(results,null,2));
  console.log('HUNT_TOOL_ART_BROWSER_PASS variants=46 themes/DPR=4 missing-art=2');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
