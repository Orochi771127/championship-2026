// Normal title/menu input against the compiled artifact. Native media, decoder,
// AudioContext and gain nodes are observed, never replaced with fake audio.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const origin=process.env.CHAMPIONSHIP_QA_ORIGIN||'http://127.0.0.1:8742';
const out=path.resolve('docs/reports/data-arena-mode-bgm-2026-10-17/browser');fs.mkdirSync(out,{recursive:true});
const PREF='championshipModernSave:preferences:v1',SAVE='championshipModernSave:v1';
const report={origin,checks:[],evidence:[],errors:[],auditoryListeningConfirmed:false,physicalDevice:false};
const check=(name,ok,detail=null)=>{report.checks.push({name,ok:!!ok,detail});assert(ok,name)};
function observe(){
 const media=[],contexts=[],gains=[];let maxVoices=0;
 const music=m=>/\/(original-music-r1|scene-music-r1)\//.test(m.currentSrc||m.src);
 globalThis.Audio=new Proxy(globalThis.Audio,{construct(T,args){const m=Reflect.construct(T,args);media.push(m);return m}});
 for(const key of ['AudioContext','webkitAudioContext'])if(globalThis[key])globalThis[key]=new Proxy(globalThis[key],{construct(T,args){const c=Reflect.construct(T,args),create=c.createGain;contexts.push(c);c.createGain=function(...a){const g=create.apply(this,a);gains.push(g);return g};return c}});
 setInterval(()=>{maxVoices=Math.max(maxVoices,media.filter(m=>music(m)&&!m.paused).length)},10);
 globalThis.__arenaNativeAudio={reset:()=>{maxVoices=0},snapshot:()=>({maxVoices,mediaCreated:media.length,contexts:contexts.map(c=>({state:c.state,sampleRate:c.sampleRate})),gains:gains.map(g=>g.gain.value),media:media.filter(music).map(m=>({src:m.currentSrc||m.src,paused:m.paused,loop:m.loop,currentTime:m.currentTime,duration:m.duration,readyState:m.readyState,error:m.error?.code??null}))})};
}
(async()=>{const windows=process.platform==='win32';const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||(windows?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':undefined),args:windows?['--use-angle=d3d11','--disable-software-rasterizer']:[]});let page;
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});await ctx.addInitScript(observe);page=await ctx.newPage();page.setDefaultTimeout(45000);
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  page.on('pageerror',e=>report.errors.push({kind:'page',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',text:m.text()})});page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))report.errors.push({kind:'http',url:r.url(),status:r.status()})});
  const state=()=>page.evaluate(()=>JSON.parse(document.documentElement.dataset.musicState||'null'));
  const native=()=>page.evaluate(()=>__arenaNativeAudio.snapshot());
  const prefs=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),PREF);
  const waitMusic=async(id,playing=true)=>{await page.waitForFunction(({id,playing})=>{const s=JSON.parse(document.documentElement.dataset.musicState||'null');if(!s||s.cue!==id)return false;const n=__arenaNativeAudio.snapshot(),active=n.media.filter(m=>!m.paused);return playing?s.playing===id&&active.length===1&&active[0].src.endsWith('/'+id+'.mp3')&&active[0].currentTime>.2&&active[0].readyState>=2:s.voices===0&&active.length===0},{id,playing},{timeout:45000})};
  const login=async()=>{
   await page.waitForSelector('#cm-login',{state:'visible'});
   // This fresh profile uses the normal opening film on initial load/reload.
   // Wait for its actual skip control; an immediate visibility query can race
   // bootstrap and let the still-starting film intercept the login click.
   await page.locator('#cm-film-skip').waitFor({state:'visible',timeout:60000});
   await page.locator('#cm-film-skip').click();await page.waitForSelector('#cm-opening-film',{state:'hidden'});await page.waitForTimeout(400);
   await page.click('#cm-login');await page.waitForSelector('#cm-data-arena',{state:'visible'});
  };
  const settings=async()=>{await page.click('#cm-title-settings');await page.locator('.cm-settings__category[data-category="sound"]').click();};
  const closeSettings=()=>page.locator('dialog.cm-settings[open] .cm-settings__close').click();
  const volume=async(value)=>{const slider=page.locator('[data-setting="musicVolume"] input');await slider.focus();await page.keyboard.press('Home');const step=Number(await slider.getAttribute('step'))||1;for(let v=0;v<value;v+=step)await page.keyboard.press('ArrowRight');assert.equal(Number(await slider.inputValue()),value)};
  const enter=async(mode)=>{await page.click('#cm-data-arena');await page.waitForSelector('.da-panel--select');await page.click(`.da-mode[data-mode="${mode}"]`);await page.click('.da-panel--select .da-btn--primary');await page.waitForSelector('.da-panel--brief');await page.click('.da-panel--brief .da-btn--primary');await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY',null,{timeout:60000})};
  const exit=async()=>{if(await page.evaluate(()=>window.__dataArenaQA.state())==='PLAY')await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__dataArenaQA.state()==='PAUSE');await page.click('.da-panel--pause .da-btn--quiet');await page.waitForFunction(()=>!document.querySelector('.da-root'));};
  await page.goto(origin+'/championship.html?arenaQa=1&arenaSeed=7',{waitUntil:'domcontentloaded'});await login();const saveBefore=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  await settings();const battleChoice=page.locator('[data-setting="battleMusic"] input[value="battle_final"]');await battleChoice.locator('xpath=ancestor::label[1]').click();check('ordinary Battle preference is set through its visible label',await battleChoice.isChecked());await volume(35);await closeSettings();const prefsBefore=await prefs();
  await page.evaluate(()=>__arenaNativeAudio.reset());
  for(const[mode,id,seconds]of[['TOURNAMENT','unison_under_fire',168.071792],['HARBOR','federation_siege',172.408125]]){
   await enter(mode);await waitMusic(id);let a=await native(),s=await state();const active=a.media.find(m=>!m.paused);
   check(mode+' decodes and advances its assigned original MP3',Math.abs(active.duration-seconds)<1&&active.error===null&&active.loop,{music:s,native:a});
   check(mode+' uses one shared AudioContext and a single playing stream',a.contexts.length===1&&a.mediaCreated<=2&&a.maxVoices<=1,a);
   check(mode+' existing volume applies to a real gain node',a.gains.some(v=>Math.abs(v-.35)<.025),a.gains);
   const starts=s.starts;await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__dataArenaQA.state()==='PAUSE');await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.musicState).scenePaused);
   const paused=await state();await page.waitForTimeout(450);s=await state();a=await native();check(mode+' pause stops native audio at its existing position',a.media.every(m=>m.paused)&&Math.abs(s.position-paused.position)<.02,{paused,s});
   await page.click('.da-panel--pause .da-btn--primary');await waitMusic(id);s=await state();check(mode+' resume retains position and avoids a new track start',s.position>=paused.position&&s.starts===starts,{paused,s});
   report.evidence.push({mode,id,music:s,native:await native()});await page.screenshot({path:path.join(out,mode.toLowerCase()+'.png')});
   await exit();await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.musicState).playing==='login');a=await native();s=await state();check(mode+' exit returns title BGM and clears scene pause without overlapping',!s.scenePaused&&a.maxVoices<=1&&a.media.filter(m=>!m.paused).length===1,{music:s,native:a});
  }
  check('mode entry/exit preserves saved ordinary Battle selection and volume',JSON.stringify(await prefs())===JSON.stringify(prefsBefore));
  await settings();await volume(0);await closeSettings();await enter('TOURNAMENT');await waitMusic('unison_under_fire',false);check('saved zero music volume keeps arena native streams silent',(await native()).media.every(m=>m.paused));await exit();
  await settings();await volume(35);await closeSettings();await enter('HARBOR');await waitMusic('federation_siege');await exit();
  await page.reload({waitUntil:'domcontentloaded'});await login();const restored=await prefs();
  // Restoring volume after the intentional zero-volume test makes a legitimate
  // new settings write. Compare every persisted value while retaining the
  // differing updatedAt fields as evidence, rather than requiring old metadata.
  const {updatedAt:beforeAt,...beforeValues}=prefsBefore,{updatedAt:afterAt,...afterValues}=restored;
  check('the existing preference values survive reload',JSON.stringify(afterValues)===JSON.stringify(beforeValues),{beforeAt,afterAt,beforeValues,afterValues});
  await settings();check('reloaded settings controls retain Battle selection and music volume',await page.locator('[data-setting="battleMusic"] input[value="battle_final"]').isChecked()&&Number(await page.locator('[data-setting="musicVolume"] input').inputValue())===35);await closeSettings();
  await page.click('#cm-data-arena');await page.waitForSelector('.da-panel--select');check('mode selection remembers harbor after reload',await page.locator('.da-mode[data-mode="HARBOR"][aria-checked="true"]').count()===1);
  await page.click('.da-panel--select .da-btn--primary');await page.waitForSelector('.da-panel--brief');await page.click('.da-panel--brief .da-btn--primary');await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY');await waitMusic('federation_siege');check('restored harbor mode uses its saved assignment', (await state()).playing==='federation_siege');await exit();
  check('raising progress remains byte-identical',await page.evaluate(key=>localStorage.getItem(key),SAVE)===saveBefore);
  check('no page, console or HTTP errors',report.errors.length===0,report.errors);report.passed=true;await ctx.close();
 }catch(e){report.passed=false;report.failure=e.stack||String(e);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close()}
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
