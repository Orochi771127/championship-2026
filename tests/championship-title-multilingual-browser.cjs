// Normal UI flow on a fully intercepted public-shaped origin and fresh storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'.'),out=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT||'.tmp/title-multilingual-source');
const base='https://orochi771127.github.io/championship-2026/',key='championshipModernSave:v1';
const locales=['zh-Hant','en','ja','th','vi'],titles={'zh-Hant':'網線拍檔：錦標賽',en:'Cyber Partner: Tournament',ja:'サイバーパートナー：トーナメント',th:'ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์',vi:'Cyber Partner: Giải đấu'};
const logo=l=>l==='zh-Hant'?'assets/production/title-morning-r1/logo-zh-Hant.webp':`assets/production/title-multilingual-r1/logo-${l}.png`;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2','.wav':'audio/wav'};
const report={root,cases:[],flows:[],errors:[],missing:[],freshStorage:true,allRequestsIntercepted:true,owner8732Used:false,physicalDeviceAccepted:false,textScaleMethod:'Root font plus explicit existing h1 computed font multiplier; image pixels unchanged'};
fs.mkdirSync(out,{recursive:true});
async function locale(page,value){await page.locator('#cm-title-settings').click();await page.locator('[data-category="language"]').click();await page.locator(`input[name="cm-setting-locale"][value="${value}"]`).check({force:true});await page.locator('.cm-settings__close').click();}
const ready=page=>page.waitForFunction(()=>document.querySelector('#cm-title > .cm-title__panel').dataset.titleBackgroundState==='ready');
async function matrix(page,phase,initial){
 for(const [width,height] of [[320,568],[390,844],[1366,480]])for(const scale of [1,1.3]){
  await page.setViewportSize({width,height});await page.evaluate(scale=>{document.documentElement.style.fontSize=16*scale+'px';const h=document.querySelector('#cm-title > .cm-title__panel h1');h.style.fontSize='';if(scale!==1)h.style.fontSize=parseFloat(getComputedStyle(h).fontSize)*scale+'px';},scale);
  const s=await page.evaluate(()=>{const t=document.querySelector('#cm-title > .cm-title__panel'),h=t.querySelector('h1'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};},i=t.querySelector('.cm-title__logo-art[data-title-image-visible="true"]');
   const walker=document.createTreeWalker(h,NodeFilter.SHOW_TEXT),glyphs=[];let node;while(node=walker.nextNode()){const r=document.createRange();r.selectNodeContents(node);glyphs.push(...[...r.getClientRects()].map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom})));}
   let painted=null;if(i&&getComputedStyle(i).display!=='none'&&i.naturalWidth){const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const p=x.getImageData(0,0,c.width,c.height).data;let left=c.width,top=c.height,right=0,bottom=0;for(let y=0;y<c.height;y++)for(let z=0;z<c.width;z++)if(p[(y*c.width+z)*4+3]>16){left=Math.min(left,z);right=Math.max(right,z+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}const b=box(i);painted={x:b.x+left/c.width*b.width,right:b.x+right/c.width*b.width,y:b.y+top/c.height*b.height,bottom:b.y+bottom/c.height*b.height};}
   return {locale:document.documentElement.lang,state:t.dataset.titleBackgroundState,panel:box(t),logo:box(t.querySelector('.cm-title__logo')),partners:box(t.querySelector('.cm-title__partners')),entry:box(document.querySelector('.cm-title__entry')),heading:box(h),glyphs,painted,headingShown:getComputedStyle(h).clipPath==='none',headingName:h.getAttribute('aria-label'),headingCount:t.querySelectorAll('h1').length,images:[...t.querySelectorAll('.cm-title__logo-art')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.titleLocale),imageFit:i&&getComputedStyle(i).objectFit,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(s.headingName,titles[s.locale]);assert.equal(s.headingCount,1);assert.equal(s.overflow,false);assert.ok(Math.abs(s.logo.width/s.logo.height-2)<.01);
  assert.ok(s.logo.bottom<=s.partners.y+1&&s.logo.bottom<s.entry.y);
  if(phase==='ready'){assert.deepEqual(s.images,[s.locale]);assert.equal(s.headingShown,false);assert.equal(s.imageFit,'contain');assert.ok(s.painted.x>=s.panel.x-1&&s.painted.right<=s.panel.right+1&&s.painted.y>=0&&s.painted.bottom<s.partners.y,JSON.stringify(s));}
  else{assert.deepEqual(s.images,[]);assert.equal(s.headingShown,true);assert.ok(s.glyphs.every(r=>r.y>=0&&r.bottom<s.partners.y+1&&r.x>=s.panel.x-1&&r.right<=s.panel.right+1),JSON.stringify(s));}
  report.cases.push({initial,phase,viewport:[width,height],textScale:scale,...s});
  if(width===320&&scale===1.3)await page.screenshot({path:path.join(out,`${initial}-${phase}-320-130.png`)});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='';document.querySelector('#cm-title > .cm-title__panel h1').style.fontSize='';});
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const initial of locales){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage(),requests=[],gates=[];let hold=logo(initial),fail=null;
  const seed=fs.readFileSync('qa/championship-full-qa-save.json','utf8');
  await page.addInitScript(({seed,key,initial})=>{localStorage.setItem(key,seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:initial,reducedMotion:'on',muted:true}));},{seed,key,initial});
  page.on('pageerror',e=>report.errors.push(e.message));
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());assert.ok(u.href.startsWith(base));const rel=u.pathname.slice('/championship-2026/'.length),file=path.resolve(root,rel);requests.push(rel);
   if(rel===hold)await new Promise(resolve=>gates.push(resolve));
   if(rel===fail)return route.fulfill({status:404,body:'controlled missing active logo'}).catch(()=>{});
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){report.missing.push(rel);return route.fulfill({status:404,body:'missing QA input'});}
   return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'}).catch(()=>{});
  });
  await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  await matrix(page,'pending',initial);hold=null;gates.splice(0).forEach(r=>r());await ready(page);await matrix(page,'ready',initial);
  assert.deepEqual(requests.filter(r=>locales.some(l=>r===logo(l))),[logo(initial)],'initial fetch only active locale');
  const next=locales[(locales.indexOf(initial)+1)%5];fail=logo(next);await locale(page,next);await page.waitForFunction(()=>document.querySelector('.cm-title__panel').dataset.titleBackgroundState==='error');await matrix(page,'error',initial);
  fail=null;await page.locator('#cm-title-background-retry').click();await ready(page);
  const rapid=locales[(locales.indexOf(initial)+2)%5];hold=logo(rapid);await locale(page,rapid);await page.waitForFunction(()=>document.querySelector('.cm-title__logo-art[data-title-image-visible="true"]').dataset.titleImageState==='loading');await locale(page,initial);
  hold=null;gates.splice(0).forEach(r=>r());await ready(page);await page.locator(`.cm-title__panel [data-title-locale="${rapid}"]`).evaluate(i=>{i.dispatchEvent(new Event('load'));i.dispatchEvent(new Event('error'));});await ready(page);
  for(const value of locales){const start=requests.length;await locale(page,value);await ready(page);assert.ok(requests.slice(start).filter(r=>locales.some(l=>r===logo(l))).every(r=>r===logo(value)),'switch fetches only new active locale');}
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),seed,'all title/fault/switch operations preserve save bytes');
  if(initial==='en'){
   await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:90000});
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   const held=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
   await page.locator('[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="saveQuit"]').click();if(await page.locator('dialog[open] [data-action="save"]').count())await page.locator('dialog[open] [data-action="save"]').click();
   await page.waitForFunction(()=>!document.querySelector('#cm-title').hidden);await ready(page);
   const saved=await page.evaluate(key=>localStorage.getItem(key),key),after=JSON.parse(saved);
   for(const field of ['nativeTitles','championshipRun','registeredSpecies','battleBadges','tamerRank'])assert.deepEqual(after.progression[field],held.progression[field],field);
   // Continue checks Home entry; Save & Quit persists that existing flag and
   // session revision. Those canonical changes are separate from TITLE work.
   const {entryChecked:priorEntry,...priorMessages}=held.progression.nativeMessages;
   const {entryChecked:savedEntry,...savedMessages}=after.progression.nativeMessages;
   assert.deepEqual(savedMessages,priorMessages);assert.equal(savedEntry,true);
   assert.deepEqual(after.raising.collection.map(c=>[c.instanceId,c.speciesId]),held.raising.collection.map(c=>[c.instanceId,c.speciesId]));
   await locale(page,'en');await ready(page);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved,'return title logo work does not write save');
  }
  report.flows.push({initial,activeOnly:true,pendingAnd404Fallback:true,retry:true,rapidSwitch:true,inactiveEventsIgnored:true,titleSaveBytesUnchanged:true,continueReturn:initial==='en'});await ctx.close();console.log('PASS '+initial);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}})().catch(e=>{report.failure=String(e);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});
