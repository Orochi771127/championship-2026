// Isolated actual browser DOM/CSS plus controlled normal-game smoke.
// No production debug route, renderer substitution in the normal game, fake clocks,
// real user profile, runtime source rewriting, or public-host writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const LOCALES=['zh-Hant','en','ja','th','vi'];
const SIZES=[[390,844],[844,390],[1366,768]];
const TOOLS=['hand','feed','protein','clean','woundMedicine','medicine'];
const GENERAL='.int-rh2-hint',TOOL='.cm-toolbar__tool-hint';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const intersects=(a,b)=>a&&b&&a.left<b.right-0.5&&a.right>b.left+0.5&&a.top<b.bottom-0.5&&a.bottom>b.top+0.5;
function geometryCheck(s,kind){
 assert.ok(s.rail?.width>0,'Toolbar rail must be rendered');
 assert.ok(!s.overflow,'No document-level horizontal overflow');
 for(const [name,node] of [['general',s.general],['tool',s.tool]])if(node.visible){
  assert.ok(node.rect.left>=s.safe.left-1&&node.rect.right<=s.width-s.safe.right+1,`${name} outside horizontal safe area`);
  assert.ok(node.rect.top>=s.safe.top-1&&node.rect.bottom<=s.height-s.safe.bottom+1,`${name} outside vertical safe area`);
  assert.ok(node.rect.bottom<=s.rail.top-3.5,`${name} overlaps or touches toolbar`);
  assert.ok(!s.statusBar.visible||!intersects(node.rect,s.statusBar.rect),`${name} overlaps status bar`);
 }
 assert.ok(!(s.general.visible&&s.tool.visible&&intersects(s.general.rect,s.tool.rect)),'General and tool hints overlap');
 if(s.general.visible){
  const overflow=s.general.scrollHeight>s.general.clientHeight+1;
  if(overflow){assert.equal(s.general.scrollable,true,'Overflow general hint enables its own scroll surface');assert.equal(s.general.pointerEvents,'auto');assert.equal(s.general.tabIndex,0);assert.equal(s.general.ariaHidden,'false');}
  else assert.equal(s.general.pointerEvents,'none','Normal general hint must not intercept field input');
 }
 if(kind==='general'){
  assert.ok(s.general.visible,'General hint is visibly rendered');
  assert.ok(s.general.rect.left<s.width/2,'General hint is bottom-left, not centered/right');
  assert.ok(s.rail.top-s.general.rect.bottom<48,'General hint belongs immediately above dock');
 }else if(kind==='tool'){
  assert.ok(s.tool.visible,'Selected tool instruction is rendered');
  assert.ok(Math.abs((s.tool.rect.left+s.tool.rect.right-s.rail.left-s.rail.right)/2)<=2,'Tool instruction is centered over toolbar');
  assert.ok(s.done.visible,'Exit is visible while instruction is shown');
  assert.ok(s.done.rect.width>=40&&s.done.rect.height>=40,'Exit keeps a usable target');
 }
}
function durationCheck(events,kind,hold,reduced=false){
 const visible=events.find(e=>e.kind===kind&&e.phase==='visible');
 const fading=events.find(e=>e.kind===kind&&e.phase==='fading'&&e.time>=(visible?.time??0));
 const hidden=events.find(e=>e.kind===kind&&e.phase==='hidden'&&e.time>(visible?.time??Infinity));
 assert.ok(visible&&hidden,`${kind}: missing observed lifecycle`);
 const elapsed=(reduced?hidden:fading)?.time-visible.time;
 assert.ok(elapsed>=hold-100&&elapsed<=hold+650,`${kind}: hold ${elapsed}ms differs from ${hold}ms`);
 if(reduced)assert.equal(fading,undefined,'Reduced motion must skip fading');
 else {assert.ok(hidden.time-fading.time>=275&&hidden.time-fading.time<=900,`${kind}: fade not 300ms`);
  const sample=events.find(e=>e.kind===kind&&e.phase==='opacity-sample'&&e.time>fading.time&&e.time<hidden.time);
  assert.ok(sample,`${kind}: no real opacity sample during fade`);assert.ok(sample.opacity>0&&sample.opacity<0.95,`${kind}: real CSS opacity does not fade`);
 }
 return {holdObservedMs:elapsed,fadeObservedMs:reduced?0:hidden.time-fading.time,expectedHoldMs:hold,expectedFadeMs:reduced?0:300};
}
function selfTest(){
 assert.equal(intersects({left:0,right:5,top:0,bottom:5},{left:5,right:10,top:0,bottom:5}),false);
 assert.equal(intersects({left:0,right:6,top:0,bottom:5},{left:5,right:10,top:0,bottom:5}),true);
 assert.deepEqual(durationCheck([{kind:'tool',phase:'visible',time:10},{kind:'tool',phase:'fading',time:2010},{kind:'tool',phase:'opacity-sample',time:2130,opacity:0.5},{kind:'tool',phase:'hidden',time:2310}],'tool',2000),{holdObservedMs:2000,fadeObservedMs:300,expectedHoldMs:2000,expectedFadeMs:300});
 assert.throws(()=>durationCheck([{kind:'tool',phase:'visible',time:10},{kind:'tool',phase:'fading',time:4010},{kind:'tool',phase:'hidden',time:4310}],'tool',2000));
 const state={width:390,height:844,safe:{left:0,right:0,top:0,bottom:0},overflow:false,
  rail:{left:0,right:390,top:760,bottom:844,width:390},statusBar:{visible:true,rect:{left:0,right:390,top:0,bottom:60}},
  general:{visible:true,rect:{left:8,right:300,top:700,bottom:750},pointerEvents:'none'},tool:{visible:false}};
 geometryCheck(state,'general');
 assert.throws(()=>geometryCheck({...state,general:{...state.general,rect:{...state.general.rect,top:50}}},'general'),/overlaps status bar/);
 console.log('PASS runner assertions self-test (not browser acceptance)');
}
// This function runs in the browser. It mounts unchanged production DOM owners.
// Only the published presentation-source/field seam is controlled; this matrix
// makes no gameplay or PIXI claim. normalGame() below covers actual game/PIXI.
async function mountHarness(options){
 const [{createRaisingHomeP1RView},{createChampionshipToolbar},{createChampionshipStatusBar},{mountPortraitFrame},locale]=await Promise.all([
  import('/src/championship/app/raisingHomeP1RView.js'),import('/src/championship/app/championshipToolbar.js'),
  import('/src/championship/app/championshipStatusBar.js'),import('/src/championship/app/portraitFrame.js'),import('/src/championship/text/locale.js')]);
 const root=document.getElementById('cm-root');
 document.documentElement.dataset.theme=options.theme??'light';
 document.documentElement.dataset.textScale=options.stress?'130':'100';
 if(options.motion)document.documentElement.dataset.motion=options.motion;else delete document.documentElement.dataset.motion;
 if(options.stress)for(const [k,v] of Object.entries({left:18,right:26,top:12,bottom:20}))document.documentElement.style.setProperty('--safe-'+k,v+'px');
 locale.setLocale(options.locale??'zh-Hant');document.documentElement.lang=locale.getLocale();
 let frame={revision:1,residents:[],selection:{creatureId:null},ranch:{layoutVersion:1},save:{phase:'CLEAN'}};
 const listeners=new Set(),toolChanges=[],calls=[];
 const source={getFrame:()=>frame,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},intents:{
  selectCreature:id=>{calls.push(['select',id]);update({selection:{creatureId:id}});},relocateCreature:(...v)=>calls.push(['relocate',...v]),careForCreature:(...v)=>calls.push(['care',...v]),requestSave:()=>calls.push(['save'])}};
 function update(changes={}){frame={...frame,...changes,revision:frame.revision+1};for(const fn of listeners)fn(frame);}
 let fieldReady=!options.loading,fieldDisposals=0,view;
 const field={get isPlayable(){return fieldReady;},render(){},dispose(){fieldDisposals++;}};
 const status=createChampionshipStatusBar({root:document.body});
 status.render({screen:'RAISING_HOME',seasonName:'Spring',dayNumber:1,time:'09:25',bits:100000,testDiamonds:10000});
 const toolbar=createChampionshipToolbar({root:document.body,responsiveLayout:true,onMenuEntry:entry=>calls.push(['menu',entry.id]),onToolChange:id=>{toolChanges.push({id,time:performance.now()});update();},getFoodStock:()=>({feed:50,protein:10,medicine:10,woundMedicine:10})});
 toolbar.setMode(1);
 const layout=mountPortraitFrame({responsiveRaising:true});
 const events=[];
 const observer=new MutationObserver(records=>{const nodes=new Set(records.map(r=>r.target).filter(n=>n.matches?.('.int-rh2-hint,.cm-toolbar__tool-hint')));for(const n of nodes){const kind=n.matches('.int-rh2-hint')?'general':'tool';events.push({kind,phase:n.dataset.hintPhase,time:performance.now(),hidden:n.hidden,selected:toolbar.getSelectedTool()});if(n.dataset.hintPhase==='fading')setTimeout(()=>{if(n.isConnected&&n.dataset.hintPhase==='fading')events.push({kind,phase:'opacity-sample',time:performance.now(),opacity:Number(getComputedStyle(n).opacity)});},120);}});
 observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-hint-phase']});
 async function mount(){view=await createRaisingHomeP1RView({root,source,mountField:async()=>field,firstRunHint:true});if(options.stress){const h=root.querySelector('.int-rh2-hint');h.textContent=Array(4).fill(h.textContent).join(' ');}}
 await mount();
 globalThis.hintQA={events,toolChanges,calls,toolbar,
  refresh(){for(let i=0;i<20;i++){update();toolbar.setMode(1);}toolbar.relabel();view.relabel();},
  relabel(value){locale.setLocale(value);document.documentElement.lang=locale.getLocale();toolbar.relabel();view.relabel();},
  ready(){fieldReady=true;update();},
  async reenter(){view.dispose();root.dataset.activeScreen='RAISING_HOME';await mount();},
  async exit(){view.dispose();toolbar.setMode(null);root.dataset.activeScreen='TITLE';root.hidden=true;},
  stressTool(){const t=document.querySelector('.cm-toolbar__tool-text');t.textContent=Array(4).fill(t.textContent).join(' ');},
  inspect(){return {tool:toolbar.getSelectedTool(),calls,toolChanges,fieldDisposals,events};},
  dispose(){view.dispose();toolbar.dispose();status.dispose();layout.dispose();observer.disconnect();}
 };
 return {ready:fieldReady,locale:locale.getLocale()};
}
function snapshot(){
 const rect=e=>{const r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};
 const node=s=>{const e=document.querySelector(s),c=e&&getComputedStyle(e),r=rect(e);return {visible:!!(e&&!e.hidden&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0.01&&r.width&&r.height),rect:r,phase:e?.dataset.hintPhase,pointerEvents:c?.pointerEvents,opacity:c?.opacity,transitionDuration:c?.transitionDuration,text:e?.textContent,scrollable:e?.dataset.scroll==='true',scrollHeight:e?.scrollHeight,clientHeight:e?.clientHeight,scrollTop:e?.scrollTop,tabIndex:e?.tabIndex,ariaHidden:e?.getAttribute('aria-hidden')};};
 const safe=k=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-'+k))||0;
 return {width:innerWidth,height:innerHeight,safe:{left:safe('left'),right:safe('right'),top:safe('top'),bottom:safe('bottom')},
  rail:rect(document.querySelector('.cm-toolbar__rail')),statusBar:node('.cm-status-bar'),general:node('.int-rh2-hint'),tool:node('.cm-toolbar__tool-hint'),toolText:node('.cm-toolbar__tool-text'),done:node('.cm-toolbar__tool-done'),
  overflow:document.documentElement.scrollWidth>innerWidth+1,selected:document.querySelector('.cm-toolbar')?.dataset.selectedTool,
  activeTool:document.activeElement?.dataset.toolId??null};
}
async function main(){
 const base=process.argv[2];assert.ok(base,'Usage: node tests/championship-raising-hints-browser.mjs LOOPBACK_BASE_URL [OUTPUT_DIR]');
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'QA may only use an isolated loopback server');
 const output=path.resolve(process.argv[3]??require('./browser-qa-output.cjs')('raising-hints'));
 await fs.mkdir(output,{recursive:true});
 const {chromium}=require('playwright');
 const report={status:'RUNNING',commit:process.env.GITHUB_SHA??null,candidateHead:process.env.HINT_QA_HEAD_SHA??null,baseCommit:process.env.HINT_QA_BASE_SHA??null,
  scope:'Unmodified production DOM modules/CSS with controlled presentation seam, real wall-clock timers; separate controlled owned-party normal game/PIXI smoke.',
  limits:['Not physical Safari/device acceptance','Stress strings and safe areas are synthetic layout inputs','DOM matrix does not assert gameplay'],geometry:[],scrollChecks:[],timings:[],errors:[],sourceHashes:[]};
 for(const file of ['src/championship/app/raisingHomeP1RView.js','src/championship/app/championshipToolbar.js','src/championship/app/transientHint.js','src/championship/app/intRh2Styles.css','src/championship/app/main.js','championship.html'])report.sourceHashes.push({file,sha256:sha256(await fs.readFile(file))});
 const write=()=>fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
 const html=await fs.readFile('championship.html','utf8');
 const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('\n');
 const fixture=`<!doctype html><html><head><base href="${base}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${links}</head><body><div id="cm-root" data-active-screen="RAISING_HOME"></div></body></html>`;
 const launch={headless:true,...(process.env.HINT_QA_CHROMIUM_EXECUTABLE?{executablePath:process.env.HINT_QA_CHROMIUM_EXECUTABLE}:{})};
 report.launch=launch;let browser;try{browser=await chromium.launch(launch);}catch(error){report.status='BLOCKED_BROWSER_LAUNCH';report.error=String(error);await write();throw error;}let current;
 async function harness(viewport,options={}){
  const context=await browser.newContext({viewport,locale:'zh-TW',reducedMotion:options.osMotion??'no-preference',serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.setDefaultTimeout(12000);
  await page.route('**/tests/fixtures/raising-hints-review.html',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.goto(new URL('tests/fixtures/raising-hints-review.html',base).href);
  await page.evaluate(mountHarness,options);await page.evaluate(()=>document.fonts.ready);current=page;
  return {page,context};
 }
 async function shot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});}
 async function waitHidden(page,selector){await page.waitForFunction(s=>document.querySelector(s)?.dataset.hintPhase==='hidden',selector,{timeout:8000});}
 try{
  for(const [width,height] of SIZES)for(const locale of LOCALES)for(const theme of ['light','classic'])for(const stress of [false,true]){
   const {page,context}=await harness({width,height},{locale,theme,stress,motion:'full'});
   try{
    let measured=await page.evaluate(snapshot);report.geometry.push({width,height,locale,theme,stress,state:'general',...measured});geometryCheck(measured,'general');
    if(locale==='zh-Hant'&&!stress||locale==='vi'&&stress)await shot(page,`${width}x${height}-${locale}-${theme}-${stress?'stress':'normal'}-general`);
    await page.locator('[data-tool-id="clean"]').click();if(stress)await page.evaluate(()=>hintQA.stressTool());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    measured=await page.evaluate(snapshot);report.geometry.push({width,height,locale,theme,stress,state:'joint-general-and-tool',...measured});geometryCheck(measured,'tool');assert.equal(measured.general.visible,true,'Both hint lifetimes overlap: general must stay visible, not vacuously avoid collision by hiding');
    if(locale==='zh-Hant'&&!stress||locale==='vi'&&stress)await shot(page,`${width}x${height}-${locale}-${theme}-${stress?'stress':'normal'}-tool`);
    if(measured.general.scrollable){
     const general=page.locator(GENERAL);await general.focus();await page.keyboard.press('End');await page.waitForTimeout(180);
     const scrolled=await page.evaluate(snapshot);assert.ok(scrolled.general.scrollTop>0,'Overflow general hint scrolls via ordinary keyboard input');
     report.scrollChecks.push({width,height,locale,theme,stress,target:'general',scrollTop:scrolled.general.scrollTop,clientHeight:scrolled.general.clientHeight,scrollHeight:scrolled.general.scrollHeight});
    }
    if(measured.toolText.scrollHeight>measured.toolText.clientHeight+1){
     const text=measured.toolText;assert.equal(text.pointerEvents,'auto','Overflow tool text keeps its existing scroll surface');
     assert.ok(text.rect.top>=measured.tool.rect.top-1&&text.rect.bottom<=measured.tool.rect.bottom+1,'Tool text scroll viewport fits within its card');
     await page.mouse.move((text.rect.left+text.rect.right)/2,(text.rect.top+text.rect.bottom)/2);await page.mouse.wheel(0,120);await page.waitForTimeout(180);
     const scrolled=await page.evaluate(snapshot);assert.ok(scrolled.toolText.scrollTop>0,'Overflow tool text scrolls via ordinary wheel input');
     report.scrollChecks.push({width,height,locale,theme,stress,target:'tool-text',scrollTop:scrolled.toolText.scrollTop,clientHeight:scrolled.toolText.clientHeight,scrollHeight:scrolled.toolText.scrollHeight});
    }
   }catch(error){await shot(page,`failure-${width}x${height}-${locale}-${theme}-${stress?'stress':'normal'}`).catch(()=>{});throw error;}finally{await context.close();}
  }
  // One real timer run per lifecycle boundary; no timer or CSS animation mocks.
  {
   const {page,context}=await harness({width:390,height:844},{locale:'zh-Hant',motion:'full',loading:true});
   try{
    await page.waitForTimeout(700);assert.equal((await page.evaluate(snapshot)).general.visible,false,'No unseen first allowance during loading');
    await page.evaluate(()=>hintQA.ready());await page.waitForTimeout(650);await page.evaluate(()=>hintQA.refresh());
    await waitHidden(page,GENERAL);let state=await page.evaluate(()=>hintQA.inspect());report.timings.push({case:'first-ready-with-rerender',...durationCheck(state.events,'general',5000)});
    await page.evaluate(()=>{hintQA.events.length=0;return hintQA.reenter();});await waitHidden(page,GENERAL);state=await page.evaluate(()=>hintQA.inspect());report.timings.push({case:'scene-reentry',...durationCheck(state.events,'general',3000)});
    await page.evaluate(()=>hintQA.events.length=0);await page.locator('[data-tool-id="clean"]').click();await page.locator('.cm-toolbar__tool-done').focus();
    await page.waitForTimeout(700);await page.evaluate(()=>hintQA.refresh());await waitHidden(page,TOOL);state=await page.evaluate(()=>hintQA.inspect());
    report.timings.push({case:'tool-with-relabel-and-focus',...durationCheck(state.events,'tool',2000)});assert.equal(state.tool,'clean');assert.equal((await page.evaluate(snapshot)).activeTool,'clean','Focus restored to persistent selected tool');
    const selected=page.locator('[data-tool-id="clean"]');assert.equal(await selected.getAttribute('aria-pressed'),'true');assert.match(await selected.getAttribute('aria-label'),/完成/);
    await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>hintQA.inspect())).tool,null,'Keyboard can put down expired tool');
    await page.locator('[data-tool-id="clean"]').click();await page.waitForTimeout(1750);await page.locator('[data-tool-id="feed"]').click();
    await page.waitForTimeout(700);assert.equal((await page.evaluate(snapshot)).tool.phase,'visible','Old Clean expiry cannot hide newer Feed');
    await waitHidden(page,TOOL);assert.equal((await page.evaluate(()=>hintQA.inspect())).tool,'feed');
    await page.evaluate(()=>hintQA.refresh());assert.equal((await page.evaluate(snapshot)).tool.visible,false,'Relabel cannot resurrect expired hint');
    await page.locator('[data-tool-id="feed"]').click();
    for(const tool of TOOLS){await page.locator(`[data-tool-id="${tool}"]`).click();assert.equal((await page.evaluate(()=>hintQA.inspect())).tool,tool);await page.locator(`[data-tool-id="${tool}"]`).click();assert.equal((await page.evaluate(()=>hintQA.inspect())).tool,null);}
    await page.locator('[data-tool-id="clean"]').click();await page.locator('[data-menu-id="SYSTEM"]').click();assert.equal((await page.evaluate(snapshot)).tool.visible,false,'Menu suppresses overlapping tool card');await page.keyboard.press('Escape');assert.equal((await page.evaluate(()=>hintQA.inspect())).tool,'clean','Closing menu does not put tool down');
    await page.evaluate(()=>hintQA.exit());await page.waitForTimeout(2500);assert.equal(await page.locator(GENERAL).count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.toolId??null),null,'Stale timer cannot focus hidden toolbar');
   }finally{await context.close();}
  }
  for(const options of [{motion:'reduced',osMotion:'no-preference'},{motion:null,osMotion:'reduce'},{motion:'full',osMotion:'reduce'}]){
   const {page,context}=await harness({width:844,height:390},{locale:'en',...options});
   try{await page.locator('[data-tool-id="clean"]').click();await waitHidden(page,TOOL);const state=await page.evaluate(()=>hintQA.inspect());report.timings.push({case:'initial-motion-preference',...options,...durationCheck(state.events,'tool',2000,options.motion!=='full')});assert.equal(state.tool,'clean');}finally{await context.close();}
  }
  report.normalGame=process.argv.includes('--dom-only')?{status:'NOT_RUN_DOM_ONLY_REQUESTED'}:await normalGame(browser,base,output,report);
  assert.deepEqual(report.errors,[]);report.status=process.argv.includes('--dom-only')?'PASS_ISOLATED_DOM_GEOMETRY_AND_TIMING_ONLY':'PASS_BROWSER_GEOMETRY_TIMING_AND_CONTROLLED_NORMAL_GAME';await write();
 }catch(error){report.status='FAIL';report.error=String(error?.stack??error);await write();if(current&&!current.isClosed())await shot(current,'failure').catch(()=>{});throw error;}
 finally{await browser.close();}
 console.log(JSON.stringify({status:report.status,geometryStates:report.geometry.length,timingCases:report.timings.length,output}));
}
async function enterControlledGame(page,evidence){
 evidence.entryActions=[];
 // The film is installed after login is enabled. Wait for its actual DOM owner,
 // then use only visible controls; the fixture may already be in the game.
 await page.waitForFunction(()=>document.querySelector('#cm-opening-film')||document.querySelector('#cm-root[data-active-screen="RAISING_HOME"]:not([hidden])'));
 const deadline=Date.now()+90000;
 while(Date.now()<deadline){
  if(await page.locator('#cm-root[data-active-screen="RAISING_HOME"]:visible').count())return;
  const skip=page.locator('#cm-film-skip');
  if(await skip.isVisible()){
   await skip.click();evidence.entryActions.push('skip-opening-film');
   await page.locator('#cm-opening-film').waitFor({state:'hidden'});
   // Production intentionally consumes pointer/key events for 350ms after Skip.
   // Respect that guard rather than force-clicking or changing application state.
   await page.waitForTimeout(450);continue;
  }
  const resume=page.locator('#cm-continue');
  if(await resume.isVisible()&&await resume.isEnabled()){
   await resume.click();evidence.entryActions.push('continue-visible-save');return;
  }
  const login=page.locator('#cm-login');
  if(await login.isVisible()&&await login.isEnabled()){
   await login.click();evidence.entryActions.push('enter-visible-title');
  }
  await page.waitForTimeout(300);
 }
 throw new Error('Controlled save did not expose an ordinary visible Continue or Raising screen');
}
async function normalGame(browser,base,output,report){
 const context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-TW',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(90000);
 // Observe native graph creation without replacing the context, nodes, clocks
 // or game state. This records cue events only, not human listening acceptance.
 await context.addInitScript(()=>{
  const ids=new WeakMap();let nextId=0;
  globalThis.menuCueEvidence=[];
  const proto=(globalThis.AudioContext??globalThis.webkitAudioContext)?.prototype;
  if(!proto)return;
  const create=proto.createOscillator;
  proto.createOscillator=function(...args){
   if(!ids.has(this))ids.set(this,++nextId);
   const contextId=ids.get(this),osc=create.apply(this,args),start=osc.start;
   osc.start=function(...times){globalThis.menuCueEvidence.push({contextId,type:this.type,frequency:this.frequency.value,at:performance.now()});return start.apply(this,times);};
   return osc;
  };
 });
 const evidence={status:'RUNNING',fixture:'tests/fixtures/championship-owned-party.html#prepare',errors:[],before:null,after:null};
 page.on('pageerror',e=>evidence.errors.push(String(e)));
 try{
  await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);await page.locator('#prepare').click();await page.locator('#status').filter({hasText:'受控存檔已準備'}).waitFor();
  // The fixture owns this throwaway origin only. Subsequent actions are production UI.
  await page.goto(new URL('championship.html?presentation=developer',base).href);
  await enterControlledGame(page,evidence);
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:180000});
  assert.ok(await page.locator('.int-rh2-field-host canvas').count()>0,'Normal Raising owns a real canvas');
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);
  const feed=page.locator('.cm-toolbar [data-tool-id="feed"]');await feed.click();await page.waitForFunction(()=>document.querySelector('.cm-toolbar__tool-hint')?.dataset.hintPhase==='hidden',null,{timeout:8000});
  assert.equal(await feed.getAttribute('aria-pressed'),'true','Actual game tool survives description expiry');evidence.before=Number(await feed.getAttribute('data-owned'));assert.ok(evidence.before>0);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentScreenPositions??'[]').some(p=>p.groundScreen&&p.speciesIndex===34));
  const point=await page.locator('.int-rh2-field-host').evaluate(h=>{const p=JSON.parse(h.dataset.residentScreenPositions).find(p=>p.groundScreen&&p.speciesIndex===34),r=h.getBoundingClientRect();return {x:r.left+p.groundScreen.x,y:r.top+p.groundScreen.y};});
  const rail=await page.locator('.cm-toolbar__rail').boundingBox();assert.ok(point.x>30&&point.x<1336&&point.y>70&&point.y<rail.y-20,'Controlled resident ground is reachable');
  await page.mouse.click(point.x,point.y);await page.waitForFunction(before=>Number(document.querySelector('.cm-toolbar [data-tool-id="feed"]')?.dataset.owned)===before-1,evidence.before,{timeout:12000});
  evidence.after=Number(await feed.getAttribute('data-owned'));assert.equal(evidence.after,evidence.before-1,'Ordinary feed placement still dispatches once after hint fades');
  await page.screenshot({path:path.join(output,'normal-game-feed-after-expiry.png'),fullPage:false});await feed.click();assert.equal(await feed.getAttribute('aria-pressed'),'false');
  await page.locator('[data-menu-id="MANAGEMENT"]').click();await page.locator('.cm-toolbar__menu:not([hidden]) [data-entry-id="digimon"]').click();await page.locator('#cm-root[data-active-screen="DIGIMON_LIST"]').waitFor();
  await page.locator('#cm-root .cm-screen-back:visible').first().click();await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:180000});
  assert.equal(await page.locator('.cm-toolbar').getAttribute('data-selected-tool'),'');
  evidence.uiMenuCompletion=await menuCompletion(page,output,evidence);
  await page.screenshot({path:path.join(output,'normal-game-return-raising.png'),fullPage:false});assert.deepEqual(evidence.errors,[]);evidence.status='PASS_ACTUAL_RAISING_FEED_AND_RETURN';return evidence;
 }catch(error){evidence.status='FAIL';evidence.error=String(error);report.normalGame=evidence;await page.screenshot({path:path.join(output,'normal-game-failure.png'),fullPage:false}).catch(()=>{});throw error;}finally{await context.close();}
}
async function menuCompletion(page,output,evidence){
 const result={status:'RUNNING',kind:'existing-PR-CI-native-Chromium-events',listeningAccepted:false,layouts:[]};
 // Keep partial observations even when an action fails. These are read-only
 // diagnostics on the fixture-owned origin, not replacement clicks or clocks.
 evidence.uiMenuCompletion=result;
 result.attempts=[];
 async function actionState(button,label,phase){
  const targets=await button.evaluateAll(buttons=>buttons.map(n=>{
   const r=n.getBoundingClientRect(),c=getComputedStyle(n);
   return {tag:n.tagName,id:n.id,class:n.className,hidden:n.hidden,disabled:n.disabled,rect:{x:r.x,y:r.y,width:r.width,height:r.height},display:c.display,visibility:c.visibility,pointerEvents:c.pointerEvents,expanded:n.getAttribute('aria-expanded'),hitStack:document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).slice(0,5).map(e=>({tag:e.tagName,id:e.id,class:e.className}))};
  }));
  const state=await page.evaluate(({targets,label,phase})=>{
   const rect=n=>{const r=n?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
   const describe=n=>n?{tag:n.tagName,id:n.id,class:n.className,hidden:n.hidden,disabled:n.disabled,rect:rect(n),display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility,pointerEvents:getComputedStyle(n).pointerEvents}:null;
   const root=document.querySelector('#cm-root'),bar=document.querySelector('.cm-toolbar');
   return {label,phase,time:performance.now(),url:location.href,viewport:[innerWidth,innerHeight],bodyData:{...document.body.dataset},screen:root?.dataset.activeScreen,root:describe(root),bar:describe(bar),count:targets.length,buttons:targets,lifecycle:describe(document.querySelector('.int-rh2-lifecycle')),calendar:describe(document.querySelector('button.int-rh2-calendar')),cueCount:globalThis.menuCueEvidence.length};
  },{targets,label,phase});
  result.attempts.push(state);console.log('UI_MENU_ACTION_STATE '+JSON.stringify(state));
 }
 const count=()=>page.evaluate(()=>menuCueEvidence.length);
 const pause=()=>page.waitForTimeout(120);
 const system=page.locator('.cm-toolbar__cell[data-menu-id="SYSTEM"]');
 // The normal clock keeps running while menus are reviewed. A date card can
 // legitimately cover the toolbar; acknowledge only its existing visible UI,
 // as the Scene music runner does. Never force-click or edit the game clock.
 async function settleCalendar(){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
   const state=await page.evaluate(()=>{
    const visible=n=>Boolean(n&&!n.hidden&&!n.closest('[hidden]')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
    if(document.querySelector('.cm-settings[open]'))return 'ready';
    const layer=document.querySelector('#cm-root .int-rh2-lifecycle'),calendar=document.querySelector('button.int-rh2-calendar');
    if(visible(calendar)&&!calendar.disabled&&layer?.dataset.phase==='calendar')return 'calendar';
    return visible(layer)||visible(calendar)?'transition':'ready';
   });
   if(state==='ready')return;
   if(state==='calendar'){await page.locator('button.int-rh2-calendar:visible').click();result.calendarAcknowledgements=(result.calendarAcknowledgements??0)+1;}
   await page.waitForTimeout(200);
  }
  throw Error('Normal lifecycle did not release toolbar after visible calendar acknowledgement');
 }
 async function oneCue(button,label){
  for(let attempt=0;attempt<2;attempt++){
   await pause();await settleCalendar();const before=await count();
   await actionState(button,label,'before');
   try{
    await button.click({timeout:1500,noWaitAfter:true});
    await page.waitForTimeout(30);assert.equal(await count(),before+1,label);return;
   }catch(error){
    await actionState(button,label,'failed');
    console.log('UI_MENU_PARTIAL_RESULT '+JSON.stringify(result));
    const shot=await page.screenshot({path:path.join(output,'ui-menu-action-failure.jpg'),type:'jpeg',quality:35}).catch(()=>null);
    if(shot)console.log('UI_MENU_FAILURE_JPEG_BASE64 '+shot.toString('base64'));
    // A new date card may arrive after readiness was observed. Retry once
    // only when the click did not start any cue and that exact card is visible.
    if(attempt||error.name!=='TimeoutError'||await count()!==before||!await page.locator('button.int-rh2-calendar:visible').isVisible())throw error;
    await settleCalendar();result.calendarClickRetries=(result.calendarClickRetries??0)+1;
   }
  }
 }
 for(const size of [{width:390,height:844},{width:1366,height:768}]){
  await page.setViewportSize(size);await page.waitForTimeout(400);
  const layout={...size,menus:[]};
  for(const id of ['MANAGEMENT','SYSTEM']){
   const opener=page.locator(`.cm-toolbar__cell[data-menu-id="${id}"]`);
   await oneCue(opener,`${size.width} ${id} open starts one cue`);
   await page.waitForFunction(()=>[...document.querySelectorAll('.cm-toolbar__entry-icon')].every(n=>n.complete&&n.naturalWidth>0));
   const rows=await page.locator('.cm-toolbar__entry').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.entryId,src:n.querySelector('img')?.getAttribute('src'),width:r.width,height:r.height,left:r.left,right:r.right};}));
   assert.equal(rows.length,id==='MANAGEMENT'?5:8);
   assert.ok(rows.every(r=>r.src&&r.width>=44&&r.height>=44&&r.left>=0&&r.right<=size.width+1));
   for(const row of rows){if(!['database','medals'].includes(row.id))assert.ok(row.src.endsWith('/'+row.id+'.svg'),row.id+' uses its dedicated vector');}
   layout.menus.push({id,rows});
   await page.screenshot({path:path.join(output,`ui-menu-${size.width}-${id.toLowerCase()}.png`)});
   await oneCue(opener,`${size.width} ${id} close starts one cue`);
  }
  result.layouts.push(layout);
 }
 // Repeat the real menu click and then use Escape: automatic close stays silent
 // and the original keyboard focus target remains reachable.
 await oneCue(system,'repeat open');await oneCue(system,'repeat close');await oneCue(system,'keyboard return open');
 const beforeEscape=await count();await page.keyboard.press('Escape');assert.equal(await count(),beforeEscape);
 assert.equal(await system.evaluate(n=>n===document.activeElement),true);
 const feed=page.locator('.cm-toolbar__cell[data-tool-id="feed"]');
 await oneCue(feed,'tool select');await oneCue(feed,'tool toggle back');
 await oneCue(system,'settings menu open');
 await oneCue(page.locator('.cm-toolbar__entry[data-entry-id="settings"]'),'settings entry selects once');
 await page.locator('.cm-settings').waitFor();
 await page.locator('.cm-settings__category[data-category="sound"]').click();
 const muted=page.locator('[data-setting="muted"] input');
 assert.equal(await muted.isChecked(),false);
 await muted.check();await pause();const beforeMute=await count();
 await page.locator('.cm-settings__close').click();
  await settleCalendar();
 await system.click();await pause();await system.click();await pause();
 assert.equal(await count(),beforeMute,'muted close/open/back create no oscillator');
 await settleCalendar();await system.click();await page.locator('.cm-toolbar__entry[data-entry-id="settings"]').click();
 await page.locator('.cm-settings__category[data-category="sound"]').click();await muted.uncheck();
 await oneCue(page.locator('.cm-settings__close'),'unmuted back plays again');
 assert.equal(await system.evaluate(n=>n===document.activeElement),true);
 const events=await page.evaluate(()=>menuCueEvidence);
 assert.equal(new Set(events.map(e=>e.contextId)).size,1,'all UI cues use the existing single native context');
 result.nativeEvents=events;result.status='PASS_NATIVE_UI_EVENTS_MUTE_MENUS_AND_FOCUS';
 return result;
}
if(process.argv.includes('--self-test'))selfTest();else await main();
