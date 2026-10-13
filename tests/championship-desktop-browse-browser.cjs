// Fresh contexts; all requests are served from this checkout/artifact on an
// isolated intercepted origin. Never contacts Owner's 8732 or player storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {login}=require('./championship-browser-opening.cjs');
// Public-shaped URL chooses the approved production art. Entirely intercepted;
// fresh Chromium storage never reads/writes the user's public/Owner profile.
const origin='https://orochi771127.github.io',base=origin+'/championship-2026/',key='championshipModernSave:v1';
const baseline=process.argv.includes('--before');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'.');
const output=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT||path.join('docs/reports/desktop-browse-2026-10-13',baseline?'before':'after'));
const seedObject=JSON.parse(fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
// Controlled UI masking case: species10 is not owned by this fixture. Do not
// alter the canonical QA save or infer a capture/evolution event.
seedObject.progression.registeredSpecies=seedObject.progression.registeredSpecies.filter(i=>i!==10);
const seed=JSON.stringify(seedObject);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.jpg':'image/jpeg','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2'};
fs.mkdirSync(output,{recursive:true});
async function menu(page,id){await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator(`[data-entry-id="${id}"]`).click();await page.waitForFunction(id=>document.getElementById('cm-root')?.dataset.activeScreen===id,id.toUpperCase());}
async function size(page,width,height){await page.setViewportSize({width,height});await page.waitForTimeout(80);await page.clock.runFor(34);}
async function sample(page){return page.evaluate(()=>{
 const box=s=>{const e=document.querySelector(s);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 const screen=document.getElementById('cm-root').dataset.activeScreen;
 const list=document.querySelector('.cm-vs2-shop__list');
 return {screen,viewport:[innerWidth,innerHeight],portrait:document.body.hasAttribute('data-portrait-frame'),shell:box('.cm-vs2-shell'),list:box('.cm-vs2-shop__list'),detail:box(screen==='SHOP'?'.cm-vs2-shop__detail':'.cm-vs2-database__detail'),footer:box('.cm-vs2-footer'),rows:list.children.length,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,scrollTop:list.scrollTop,selected:document.querySelector('.cm-vs2-database__row[aria-pressed="true"]')?.dataset.speciesIndex,overflow:document.documentElement.scrollWidth>innerWidth,focus:document.activeElement?.className};
});}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),report={schemaVersion:1,generatedAt:new Date().toISOString(),origin,allRequestsIntercepted:true,freshStorage:true,root,baseline,physicalDeviceAccepted:false,cases:[],operations:[],filters:[],errors:[],missing:[]};
 try{
  for(const theme of ['warm','classic']){
   const ctx=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(({seed,key,theme})=>{localStorage.setItem(key,seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({theme,locale:'zh-Hant',reducedMotion:'on',muted:true}));},{seed,key,theme});
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());assert.equal(u.origin,origin,'no external or Owner origin');
    assert.ok(u.pathname.startsWith('/championship-2026/'));
    const rel=decodeURIComponent(u.pathname).slice('/championship-2026/'.length)||'championship.html',file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){report.missing.push(rel);await route.fulfill({status:404,body:'Missing isolated QA input'});return;}
    await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await login(page);await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:90000});
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   for(const locale of (baseline?['zh-Hant']:(process.env.CHAMPIONSHIP_QA_LOCALES?.split(',')||['zh-Hant','en','ja','th','vi']))){
    if(locale!=='zh-Hant'){
     await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="settings"]').click();
     await page.locator('.cm-settings__category[data-category="language"]').click();
     await page.locator(`input[name="cm-setting-locale"][value="${locale}"]`).check({force:true});
     await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    }
   for(const id of ['shop','database']){
    await menu(page,id);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),locale);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
    if(id==='database')await page.locator('.cm-vs2-database__row[data-state="REGISTERED"]').first().click();
    for(const [width,height] of (baseline?[[1366,768]]:[[1366,768],[1366,480],[1024,420],[390,844],[1366,768]])){
     await size(page,width,height);
     const s=await sample(page);report.cases.push({theme,locale,...s});
     if(!baseline){
      assert.equal(s.overflow,false);assert.ok(s.footer.y+s.footer.height<=height+1);assert.ok(s.footer.height>=44);
      assert.equal(s.portrait,false);assert.ok(s.shell.width<=width);
      if(width>=1024){
       assert.ok(s.shell.width>=1020,JSON.stringify({theme,locale,...s}));assert.ok(s.list&&s.detail,'both panes visible');
       assert.ok(s.list.width>350&&s.detail.width>280&&s.list.height>=44&&s.detail.height>=44);
       if(id==='shop')assert.ok(s.detail.x+s.detail.width<=s.list.x+1);
       else assert.ok(s.list.x+s.list.width<=s.detail.x+1);
      }else if(id==='database')assert.equal(s.list,null,'phone keeps detail-only flow');
      if(id==='database'){assert.equal(s.rows,224);assert.equal(s.selected,report.cases.find(c=>c.theme===theme&&c.locale===locale&&c.screen==='DATABASE').selected);}
     }
     if(locale==='zh-Hant'||locale==='th')await page.screenshot({path:path.join(output,`${theme}-${locale}-${id}-${width}x${height}.png`)});
     if(!baseline&&id==='shop'&&height===480){
      const detail=page.locator('.cm-vs2-shop__detail');
      if(await detail.evaluate(e=>e.scrollHeight>e.clientHeight)){
       await detail.hover();await page.mouse.wheel(0,400);await page.clock.runFor(100);assert.ok(await detail.evaluate(e=>e.scrollTop)>0,'short detail scrolls');
      }
     }
    }
    if(!baseline){
     if(id==='shop'){
      const list=page.locator('.cm-vs2-shop__list');await list.locator('button').nth(1).click();
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-selected')),'true','selection retains focus');
      await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-selected')),'true','keyboard focus follows selection');
      await page.locator('[data-category="CAGES"]').click();
      await list.hover();await page.mouse.wheel(0,1200);await page.clock.runFor(100);
      assert.ok(await list.evaluate(e=>e.scrollTop)>0,'desktop shelf scrolls');
      await list.locator('button').last().click();assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-selected')),'true');
      await size(page,390,844);
      assert.equal(await page.locator('.cm-vs2-shop__arrow').first().isVisible(),true,'phone shelf arrows preserved');
     }else{
      const list=page.locator('.cm-vs2-shop__list');await list.hover();await page.mouse.wheel(0,1200);await page.clock.runFor(100);
      const top=await list.evaluate(e=>e.scrollTop);assert.ok(top>0,'book scrolls independently');
      const row=page.locator('.cm-vs2-database__row').nth(110);await row.click();
      const selected=await row.getAttribute('data-species-index');
      assert.equal(await row.getAttribute('aria-pressed'),'true');assert.equal(await row.evaluate(e=>e===document.activeElement),true);
      await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'),'keyboard navigation remains available');
      await page.locator('.cm-vs2-footer button').first().click();
      assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),selected,'close restores entry focus');
      assert.equal(await row.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}),true,'return keeps the entry visible after column count changes');
      await row.click();await size(page,390,844);
      assert.equal(await list.isHidden(),true);assert.equal(await page.evaluate(()=>document.activeElement?.className),'cm-vs2-database__detail-title','hidden list focus moves to detail');
      await page.locator('.cm-vs2-footer button').first().click();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),selected);
      await row.click();
      await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),selected,'Escape restores phone entry focus');
      await size(page,1366,768);
      await page.locator('.cm-vs2-database__row[data-species-index="189"]').click();
      const input=page.locator('.cm-vs2-database__detail input').first(),name=await input.inputValue();await input.focus();
      for(const [w,h] of [[1366,480],[390,844],[1366,768]]){
       await size(page,w,h);assert.equal(await input.evaluate(e=>e===document.activeElement),true,'resize retains the live name input');assert.equal(await input.inputValue(),name);
       const b=await input.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=w+1&&b.y+b.height<=h+1,'focused input stays readable');
      }
      const savedBefore=await page.evaluate(key=>localStorage.getItem(key),key);
      const filter=page.locator('.cm-vs2-database__stage'),counts=[8,12,14,38,64,51,37];
      const codes=await list.locator('button').evaluateAll(rows=>Object.fromEntries(rows.map(e=>[e.dataset.speciesIndex,e.dataset.displayCode])));
      for(let stage=0;stage<7;stage++){
       await filter.focus();await filter.selectOption(String(stage));
       assert.equal(await list.locator('button').count(),counts[stage]);
       assert.equal(await filter.evaluate(e=>e===document.activeElement),true,'filter retains keyboard focus');
       const filtered=await list.locator('button').evaluateAll(rows=>rows.map(e=>[e.dataset.speciesIndex,e.dataset.displayCode]));
       assert.ok(filtered.every(([id,code])=>codes[id]===code),'filter cannot renumber');
       assert.ok((await filter.locator(`option[value="${stage}"]`).textContent()).length>0);
       await list.locator('button').first().click();
       assert.equal(await list.isVisible(),true,'desktop filtered list remains beside detail');
       await page.keyboard.press('Escape');
       assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('cm-vs2-database__row')),true);
      }
      await filter.selectOption('0');
      for(let egg=0;egg<8;egg++){
       const row=list.locator(`[data-species-index="${egg}"]`);await row.click();
       assert.equal(await row.getAttribute('data-state'),'NOT_TRACKED');
       const image=page.locator('.cm-vs2-database__egg');
       await image.evaluate(e=>e.decode());
       assert.ok((await image.getAttribute('src')).startsWith('assets/production/characters/accepted-20261010/'));
       assert.ok((await page.locator('.cm-vs2-database__detail').textContent()).includes(`EG0${egg+1}`));
       if(egg===0&&(locale==='zh-Hant'||locale==='th'))await page.screenshot({path:path.join(output,`${theme}-${locale}-egg-desktop.png`)});
       await size(page,390,844);assert.equal(await filter.isHidden(),true);
       if(egg===0&&(locale==='zh-Hant'||locale==='th'))await page.screenshot({path:path.join(output,`${theme}-${locale}-egg-phone.png`)});
       await page.keyboard.press('Escape');
       assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),String(egg),'egg close restores row focus');
       assert.equal(await filter.inputValue(),'0','phone return retains stage');
       await size(page,1366,480);
      }
      await filter.selectOption('1');
      const unknown=list.locator('[data-species-index="10"]');
      assert.equal(await unknown.getAttribute('data-state'),'UNDISCOVERED');
      assert.equal(await unknown.locator('strong').textContent(),'????');
      await unknown.click();
      const privateText=await page.locator('.cm-vs2-database__detail').textContent();
      assert.ok(privateText.includes(codes[10]));
      assert.equal(await page.locator('.cm-vs2-database__detail input, .cm-vs2-database__detail img').count(),0,'unknown exposes no identity or instance');
      assert.equal(await page.locator('.cm-vs2-database__detail h2').textContent(),(await unknown.getAttribute('aria-label')).split(' · ').at(-1));
      await size(page,390,844);
      if(locale==='zh-Hant'||locale==='th')await page.screenshot({path:path.join(output,`${theme}-${locale}-unknown-phone.png`)});
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>document.activeElement?.dataset.speciesIndex),'10');
      await filter.focus();await filter.selectOption('5');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await filter.evaluate(e=>e.getBoundingClientRect().height>=44),true);
      await list.locator('button').first().click();await size(page,1366,768);
      await filter.focus();await filter.selectOption('6');
      assert.equal(await page.locator('.cm-vs2-database__detail').isHidden(),true,'filter clears a selection excluded by stage');
      assert.equal(await filter.evaluate(e=>e===document.activeElement),true);
      await filter.selectOption('');
      assert.equal(await list.locator('button').count(),224);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),savedBefore,'browse/filter/egg do not write save');
      report.filters.push({theme,locale,stageCounts:counts,stableCodes:true,eightEggs:true,unknownMasking:true,filterFocus:true,phoneReturn:true,saveUnchanged:true});
      if(locale==='zh-Hant'||locale==='th')await page.screenshot({path:path.join(output,`${theme}-${locale}-stage-filter.png`)});
      // Restore a selected regular detail for the existing two-step exit.
      await list.locator('[data-species-index="189"]').click();
     }
     report.operations.push({theme,locale,screen:id,selectionFocus:true,scrolling:true,closeReturn:true,...(id==='database'?{inputResizeFocus:true,phoneDetailFocus:true}: {keyboardSelection:true,phoneArrows:true})});
    }
    if(!baseline&&id==='shop')await page.keyboard.press('Escape');
    else await page.locator('.cm-vs2-footer button').first().click();
    if(id==='database')await page.locator('.cm-vs2-footer button').first().click();
    await page.waitForFunction(()=>document.getElementById('cm-root').dataset.activeScreen==='RAISING_HOME');
    if(!baseline)assert.equal(await page.evaluate(()=>document.activeElement?.dataset.menuId),'SYSTEM','return restores the System menu focus');
    assert.equal(await page.evaluate(()=>document.body.hasAttribute('data-desktop-browse')),false,'browse attribute released on return');
    await size(page,1366,768);
   }
   console.log(`${theme}/${locale} passed`);
   }
   await ctx.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
  fs.writeFileSync(path.join(output,'browser-summary.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({baseline,cases:report.cases.length,errors:report.errors,missing:report.missing}));
 }finally{fs.writeFileSync(path.join(output,'browser-summary.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
