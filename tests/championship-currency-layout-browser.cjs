// Controlled component geometry plus a separate normal-onboarding flow.
// The fixture does NOT prove save/gameplay state. The normal flow never injects state.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {resolveAsset,serveBuild}=require('./alternate-form-browser-support.cjs');
const repo=path.resolve(process.env.HUD_SOURCE_ROOT||process.cwd()),out=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'.tmp/browser-qa','currency-layout');
fs.mkdirSync(out,{recursive:true});
const diagnostic=process.env.HUD_DIAGNOSTIC_ONLY==='1',engine=process.env.HUD_BROWSER||'chromium';
const evidence={status:'RUNNING',engine,diagnostic,scope:'Component fixture is geometry only; normal onboarding is separately recorded.',cases:[],normal:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');
const styles=[...fs.readFileSync(path.join(repo,'championship.html'),'utf8').matchAll(/<link rel="stylesheet" href="([^\"]+)"/g)].map(m=>`<link rel="stylesheet" href="${m[1]}">`).join('');
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${styles}<body><main id="cm-root" data-active-screen="RAISING_HOME"></main><script type="module">
import {createChampionshipStatusBar} from './src/championship/app/championshipStatusBar.js';
import {mountInteractiveTutorialPreview} from './src/championship/app/interactiveTutorialPreview.js';
import {mountPortraitFrame} from './src/championship/app/portraitFrame.js';
import {setLocale,formatNumber} from './src/championship/text/locale.js';
import {uiText} from './src/championship/text/uiText.js';
document.documentElement.dataset.theme='arena';
let tutorial={finished:true,checkpoint:{stage:'raising',message:0}},listeners=[];
const fixtureApp={getSession:()=>({}),getInteractiveTutorial:()=>tutorial,subscribeRaising:f=>{listeners.push(f);return()=>{}},exitInteractiveTutorial:async()=>{tutorial={...tutorial,finished:true};listeners.forEach(f=>f())}};
window.saveOpens=0;window.matchOpens=0;
const bar=createChampionshipStatusBar({root:document.body,onOpenSave:()=>window.saveOpens++,onOpenMatches:()=>window.matchOpens++});
mountPortraitFrame({responsiveRaising:true});
mountInteractiveTutorialPreview({app:fixtureApp,preview:false});
window.fixtureRender=({locale='zh-Hant',bits=100000,diamonds=10000,phase='RESTORED',tutorialOn=false,matches=0})=>{
 setLocale(locale);document.documentElement.lang=locale;
 tutorial={...tutorial,finished:!tutorialOn};listeners.forEach(f=>f());
 bar.render({screen:'RAISING_HOME',seasonName:'Spring',dayNumber:1,time:'07:00',bits,testDiamonds:diamonds,todayMatches:matches,save:{phase}});bar.relabel();
 return {bitsLabel:uiText('持有 {bits} 位元幣',{bits}),diamondLabel:uiText('CAGE_TEST_DIAMOND_BALANCE',{amount:formatNumber(diamonds)})};
window.fixtureRender({});window.fixtureReady=true;
</script>`;
const geometry=()=>{
 const names=['season','day','time','currencies','bits','diamond','matches','save'];
 const rect=e=>{if(!e||e.hidden||getComputedStyle(e).display==='none')return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,client:e.clientWidth,text:e.innerText,label:e.getAttribute('aria-label')}};
 const parts=Object.fromEntries(names.map(n=>[n,rect(document.querySelector('.cm-status-bar__'+n))]));
 const bar=rect(document.querySelector('.cm-status-bar')),guide=rect(document.querySelector('.cm-tutorial-guidance'));
 return {width:innerWidth,height:innerHeight,bar,guide,parts,overflow:document.documentElement.scrollWidth>innerWidth,font:parseFloat(getComputedStyle(document.querySelector('.cm-status-bar__compact-value')||document.querySelector('.cm-status-bar__bits-value')).fontSize)};
};
const intersects=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
(async()=>{
 let browser,server,publicServer,context;
 try{
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://local');if(url.pathname==='/hud-fixture.html'){res.setHeader('Content-Type','text/html');return res.end(fixture);}
   const file=path.resolve(repo,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(repo+path.sep)){res.statusCode=403;return res.end();}
   try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const launch=engine==='webkit'?{headless:true}:{channel:'chromium',headless:true,chromiumSandbox:true};
  browser=await (engine==='webkit'?webkit:chromium).launch(launch);evidence.version=browser.version();evidence.launch={...launch,customArgs:[]};
  for(const [width,height] of [[320,740],[390,844],[430,932],[568,320],[844,390],[1280,900]]){
   context=await browser.newContext({viewport:{width,height},hasTouch:width<1000,locale:'zh-TW'});const page=await context.newPage();
   page.on('pageerror',e=>evidence.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/hud-fixture.html`);await page.waitForFunction(()=>window.fixtureReady);
   for(const locale of ['zh-Hant','en','ja','th','vi'])for(const matches of [0,1]){
    let baseline=null;
    for(const [bits,diamonds] of [[0,0],[100000,10000],[999999,999999],[1000001,1000001],[9999999,9999999],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]])for(const tutorialOn of [true,false])for(const phase of ['RESTORED','SAVED','DIRTY','SAVING','SAVE_FAILED']){
     const params={locale,bits,diamonds,tutorialOn,phase,matches};const labels=await page.evaluate(p=>window.fixtureRender(p),params);
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     const g=await page.evaluate(geometry);evidence.cases.push({params,...g});
     if(!diagnostic){
      assert.equal(g.overflow,false,JSON.stringify(params));
      for(const n of ['season','day','time','currencies','bits','diamond','matches','save']){const q=g.parts[n];if(q)assert.ok(q.x>=-1&&q.right<=width+1,`${n} outside viewport ${JSON.stringify(params)}`);}
      for(const [a,b] of [['currencies','time'],['currencies','day'],['currencies','season'],['currencies','save'],['currencies','matches'],['save','matches']])assert.ok(!intersects(g.parts[a],g.parts[b]),`${a}/${b} overlap`);
      if(g.guide)assert.ok(g.guide.y>=g.bar.bottom-1,'Tutorial must clear measured HUD');
      if(width===430&&locale==='zh-Hant'&&!matches)assert.ok(Math.abs((g.parts.currencies.y+g.parts.currencies.h/2)-(g.parts.season.y+g.parts.season.h/2))<2,'Working 430px normal one-row HUD must stay one row');
      assert.equal(g.parts.bits.label,labels.bitsLabel);assert.equal(g.parts.diamond.label,labels.diamondLabel);
      if(width<=600){assert.ok(g.font>=14);assert.ok(g.parts.diamond.h>=44);if(g.parts.save)assert.ok(g.parts.save.w>=44&&g.parts.save.h>=44);if(phase==='SAVE_FAILED'){assert.ok(g.parts.save?.label,'Save failure remains visible with an accessible explanation');assert.equal(await page.locator('.cm-status-bar__save').getAttribute('data-state'),'SAVE_FAILED');}assert.ok(g.parts.bits.scroll<=g.parts.bits.client+1);assert.ok(g.parts.diamond.scroll<=g.parts.diamond.client+1);
       const key=[g.bar.h,g.parts.currencies.y,g.parts.currencies.w];if(baseline)assert.deepEqual(key,baseline,'Wallet/save/tutorial must not change mobile row geometry');else baseline=key;
      }
     }
     if(locale==='zh-Hant'&&!matches&&bits===100000&&(phase==='RESTORED'||phase==='DIRTY'))await page.screenshot({path:path.join(out,`${width}-${tutorialOn?'tutorial':'normal'}-${phase}.png`)});
    }
   }
   // Real component click/keyboard/focus behavior with exact readouts.
   if(!diagnostic){const labels=await page.evaluate(()=>window.fixtureRender({bits:Number.MAX_SAFE_INTEGER,diamonds:Number.MAX_SAFE_INTEGER,phase:'SAVE_FAILED',matches:1}));
    for(const [selector,label] of [['.cm-status-bar__bits',labels.bitsLabel],['.cm-status-bar__diamond',labels.diamondLabel]]){await page.locator(selector).click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('#cm-dialog-title').innerText(),label);await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'detached'});}
    await page.locator('.cm-status-bar__save').click();assert.equal(await page.evaluate(()=>window.saveOpens),1);await page.locator('.cm-status-bar__save').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.saveOpens),2);
    await page.locator('.cm-status-bar__matches').click();assert.equal(await page.evaluate(()=>window.matchOpens),1);
   }
   await context.close();context=null;write();
  }
  // Normal app onboarding, actual tutorial enter/exit and unchanged real save.
  // Existing friends-playtest harness is deliberately untouched (PR34 ownership).
  if(process.env.CHAMPIONSHIP_QA_ARTIFACT){
   const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT),publicBase='https://orochi771127.github.io/championship-2026/';
   publicServer=await serveBuild(root);context=await browser.newContext({viewport:{width:430,height:932},hasTouch:true,locale:'zh-TW',serviceWorkers:'block'});
   await context.route('**/*',async route=>{const u=route.request().url();if(u.startsWith(publicServer.origin+'/'))return route.continue();if(u.startsWith(publicBase)){const relative=new URL(u).pathname.slice(new URL(publicBase).pathname.length);if(resolveAsset(root,'/'+relative)){const response=await route.fetch({url:publicServer.origin+'/'+relative,maxRedirects:0});return route.fulfill({response});}}return route.abort();});
   const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>evidence.errors.push('normal: '+e.message));
   await page.goto(publicBase+'championship.html');await page.locator('#cm-login').waitFor();await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
   if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});await page.waitForTimeout(400);}
   await page.locator('#cm-login').click();await page.locator('#cm-new-game').click();
   const story=page.locator('.cm-opening-story'),deadline=Date.now()+120000;
   while(await story.count()){if(Date.now()>deadline)throw Error('Opening comic timeout');const text=page.locator('[data-story-action="text"]');if(await text.isVisible())await text.click();if(await story.isVisible())await story.click({position:{x:10,y:10}});await page.waitForTimeout(1200);}
   await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('#cm-opening-name').fill('介面測試');await page.locator('.cm-opening__name button[type="submit"]').click();await page.locator('.cm-opening__choices button').first().click();
   await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('.cm-opening__letter button').click();if(await page.locator('[data-egg-confirm]').isVisible())await page.locator('[data-egg-confirm]').click();await page.locator('#cm-opening-name').fill('小夥伴');await page.locator('.cm-opening__name button[type="submit"]').click();
   await page.locator('dialog[open] [data-action="accept"]').click();
   for(let step=0;step<20&&!(await page.locator('.cm-tutorial-guidance').isVisible()&&await page.locator('dialog[open]').count()===0);step++){const next=page.locator('dialog[open] [data-action="next"]');if(await next.isVisible())await next.click();else await page.waitForTimeout(100);}
   await page.locator('.cm-tutorial-guidance').waitFor({state:'visible'});await page.locator('dialog[open]').waitFor({state:'detached'});
   const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('championshipModernSave:v1')));
   const before=await save();assert.equal(before.shop.bits,100000);assert.equal(before.flags.friendsPlaytest.diamonds,10000);
   evidence.normal.push({stage:'tutorial-on',geometry:await page.evaluate(geometry)});await page.screenshot({path:path.join(out,'normal-flow-tutorial-on.png'),fullPage:true});
   await page.locator('.cm-tutorial-guidance [data-tutorial-action="exit"]').click();await page.locator('.cm-tutorial-guidance').waitFor({state:'hidden'});
   const after=await save();assert.equal(after.shop.bits,100000);assert.equal(after.flags.friendsPlaytest.diamonds,10000);evidence.normal.push({stage:'tutorial-off',geometry:await page.evaluate(geometry)});await page.screenshot({path:path.join(out,'normal-flow-tutorial-off.png'),fullPage:true});
   if(!diagnostic){assert.equal(evidence.normal[0].geometry.bar.h,evidence.normal[1].geometry.bar.h);assert.equal(evidence.normal[0].geometry.parts.currencies.y,evidence.normal[1].geometry.parts.currencies.y);}
  }
  assert.deepEqual(evidence.errors,[]);evidence.status='PASS';write();
 }catch(error){evidence.status='FAIL';evidence.failure=error.stack;write();throw error;}
 finally{await context?.close();await browser?.close();await publicServer?.close();if(server)await new Promise(r=>server.close(r));}
})();
