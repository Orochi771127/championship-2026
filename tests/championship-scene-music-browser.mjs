// Real Chromium media/decoder + production settings/transport modules, followed by
// a separately labelled controlled-save normal-game smoke. No public writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const LOCALES = ['zh-Hant', 'en', 'ja', 'th', 'vi'];
const SIZES = [[320,568], [390,844], [844,390], [1366,768]];
const PREF = 'championshipModernSave:preferences:v1';
const SAVE = 'championshipModernSave:v1';
const TRACKS = JSON.parse(await fs.readFile('assets/production/scene-music-r1/manifest.json','utf8')).files.map(f=>({...f,scene:f.category,path:'assets/production/scene-music-r1/'+f.path,zh:f.titles.zh,en:f.titles.en}));
const NAMES = {
 moon:['空靈月湖畔','Ethereal Moon Lakefront'],lofi:['林卡拉慢拍','Linkara Lo-fi'],
 battle_normal:['錦標賽對戰','Championship Battle'],battle_final:['錦標賽決戰','Championship Final'],
 ...Object.fromEntries(TRACKS.map(t=>[t.id,[t.zh,t.en]]))
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const choice = (key,value) => `[data-setting="${key}"] input[value="${value}"]`;
const sourceForTrack = track => track.scene === 'battle'
 ? {id:'battle_normal',scene:null} : {id:'moon',scene:'raising'};
function checkLabels(rows, locale) {
 assert.deepEqual(rows.map(r=>r.id).sort(), Object.keys(NAMES).sort(), 'Exactly the allowed scene choices');
 for (const row of rows) {
  assert.equal(row.name,NAMES[row.id][locale.startsWith('zh')?0:1]);
  assert.equal(row.lang,locale.startsWith('zh')?'zh-Hant':'en');
  assert.ok(row.width>0 && row.labelWidth>=40 && row.labelHeight>=40,'Usable label touch target');
  assert.ok(row.right<=row.containerRight+1 && row.left>=row.containerLeft-1,'No option overflow');
  assert.ok(row.textScrollWidth<=row.textClientWidth+1,'Track name wraps rather than clips horizontally');
 }
}
function checkHeader(header) {
 assert.ok(header,'Mounted settings header exists');
 const {back,title,close}=header;
 const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
 for(const part of [back,title,close].filter(p=>p.visible)){
  assert.ok(part.bounds.left>=header.bounds.left-1&&part.bounds.right<=header.bounds.right+1,'Header control stays inside header');
  for(const rect of part.textRects)assert.ok(rect.left>=part.bounds.left-1&&rect.right<=part.bounds.right+1,'Header text does not escape its allocated control');
 }
 if(back.visible)for(const a of back.textRects)for(const b of title.textRects)assert.equal(overlap(a,b),false,'Back and category text must not overlap');
 for(const rect of title.textRects)assert.equal(overlap(rect,close.bounds),false,'Category text must not overlap close control');
}
function headerSnapshot() {
 const header=document.querySelector('.cm-settings__header');if(!header)return null;
 const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
 const read=selector=>{const e=header.querySelector(selector),style=getComputedStyle(e),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),textRects=[];let node;while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);textRects.push(...[...range.getClientRects()].map(rect));}return {text:e.textContent,visible:style.visibility!=='hidden'&&style.display!=='none',bounds:rect(e.getBoundingClientRect()),textRects,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,font:style.font};};
 return {bounds:rect(header.getBoundingClientRect()),columns:getComputedStyle(header).gridTemplateColumns,back:read('.cm-settings__back'),title:read('.cm-settings__title'),close:read('.cm-settings__close')};
}
function checkNativeMedia(sample, track) {
 const playing=sample.media.filter(m=>!m.paused&&m.currentSrc.endsWith('/'+track.path));
 assert.equal(playing.length,1,`${track.id}: one native active source`);
 const media=playing[0];
 assert.equal(media.error,null);assert.ok(media.readyState>=2,'Browser has decoded current data');
 assert.ok(Number.isFinite(media.duration)&&Math.abs(media.duration-track.seconds)<1,'Duration agrees with original MP3');
 assert.ok(media.currentTime>0.12,'Playback clock advances, not a request-count-only claim');
 assert.ok(media.buffered.length,'Actual media buffer exists');
 assert.equal(sample.contexts.length,1,'Music feeds one shared AudioContext');
 assert.equal(sample.contexts[0].state,'running','Native graph is running after trusted input');
 assert.ok(sample.maxVoices<=2,'No third overlapping music voice');
 assert.ok(sample.mediaCreated<=2,'Transport creates at most two native media elements');
 return media;
}
// HTTP byte ranges matter for native media seeking. Python's simple server
// ignores Range; this test-only loopback server models seekable static hosting.
function parseByteRange(header, size) {
 if(header===undefined)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);
 if(!match||(!match[1]&&!match[2])||size<1)return false;
 let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
 if([start,end].some(n=>n!==null&&!Number.isSafeInteger(n)))return false;
 if(start===null){if(end<1)return false;start=Math.max(0,size-end);end=size-1;}
 else {if(start>=size||end!==null&&end<start)return false;end=end===null?size-1:Math.min(end,size-1);}
 return {start,end};
}
async function serveRangeRoot(port=8765, root='.') {
 assert.ok(Number.isInteger(port)&&port>0&&port<65536);const base=realpathSync(root);
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4','.mp4':'video/mp4','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname,file,stat;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').includes('..'))throw Error('Invalid path');file=realpathSync(path.resolve(base,'.'+pathname));if(!file.startsWith(base+path.sep))throw Error('Outside root');stat=statSync(file);if(!stat.isFile())throw Error('Not a file');}
  catch{res.writeHead(404);res.end('Not found');return;}
  const range=parseByteRange(req.headers.range,stat.size),headers={'Content-Type':types[path.extname(file)]??'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
  if(range===false){res.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`,'Content-Length':0});res.end();return;}
  const start=range?.start??0,end=range?.end??stat.size-1,status=range?206:200;
  headers['Content-Length']=Math.max(0,end-start+1);if(range)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  res.writeHead(status,headers);console.log(JSON.stringify({method:req.method,path:pathname,range:req.headers.range??null,status,bytes:headers['Content-Length']}));
  if(req.method==='HEAD'||stat.size===0){res.end();return;}const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});console.log(`Scene-music range server listening on 127.0.0.1:${port}`);
}
function selfTest() {
 assert.deepEqual(sourceForTrack({scene:'raising',id:'podium_geometry'}),{id:'moon',scene:'raising'});
 assert.deepEqual(sourceForTrack({scene:'battle',id:'magma_breach'}),{id:'battle_normal',scene:null});
 assert.equal(parseByteRange(undefined,100),null);assert.deepEqual(parseByteRange('bytes=0-15',100),{start:0,end:15});assert.deepEqual(parseByteRange('bytes=90-',100),{start:90,end:99});assert.deepEqual(parseByteRange('bytes=-12',100),{start:88,end:99});assert.deepEqual(parseByteRange('bytes=90-500',100),{start:90,end:99});for(const h of ['bytes=100-','bytes=90-50','bytes=-0','bytes=-','bytes=0-1,3-4','bad'])assert.equal(parseByteRange(h,100),false);
 const rows=Object.entries(NAMES).map(([id,n])=>({id,name:n[1],lang:'en',width:100,labelWidth:200,labelHeight:44,left:10,right:200,containerLeft:0,containerRight:390,textScrollWidth:150,textClientWidth:150}));
 checkLabels(rows,'th');assert.throws(()=>checkLabels(rows.map(r=>({...r,name:r.name+' 中文'})),'th'));
 const track=TRACKS[0],sample={media:[{paused:false,currentSrc:'http://localhost/'+track.path,error:null,readyState:4,duration:track.seconds,currentTime:1,buffered:[[0,10]]}],contexts:[{state:'running'}],mediaCreated:2,maxVoices:2};
 checkNativeMedia(sample,track);assert.throws(()=>checkNativeMedia({...sample,media:[{...sample.media[0],readyState:0}]},track));
 assert.throws(()=>checkNativeMedia({...sample,media:[{...sample.media[0],currentTime:0}]},track));
 assert.throws(()=>checkNativeMedia({...sample,maxVoices:3},track));assert.throws(()=>checkNativeMedia({...sample,mediaCreated:3},track));
 const box=(left,right)=>({left,right,top:0,bottom:44}),part=(left,right)=>({visible:true,bounds:box(left,right),textRects:[box(left+2,right-2)]});const header={bounds:box(0,320),back:part(0,90),title:part(100,260),close:part(276,320)};checkHeader(header);assert.throws(()=>checkHeader({...header,title:{...header.title,textRects:[box(80,240)]}}));
 console.log('PASS browser-runner assertion self-test only; no browser was launched');
}
// Read-only instrumentation wraps native constructors. Never substitutes media,
// play(), decoder, AudioContext, clocks, gain values, or autoplay policy.
function observeNativeAudio() {
 const media=[],contexts=[],events=[],samples=[];let maxVoices=0;
 const isMusic=m=>/\/(original-music-r1|scene-music-r1)\//.test(m.currentSrc||m.src);
 const snapshot=()=>({mediaCreated:media.length,media:media.filter(isMusic).map((m,id)=>({id,src:m.src,currentSrc:m.currentSrc,paused:m.paused,ended:m.ended,seeking:m.seeking,seekable:Array.from({length:m.seekable.length},(_,i)=>[m.seekable.start(i),m.seekable.end(i)]),loop:m.loop,readyState:m.readyState,networkState:m.networkState,currentTime:m.currentTime,duration:Number.isFinite(m.duration)?m.duration:null,error:m.error?{code:m.error.code,message:m.error.message}:null,buffered:Array.from({length:m.buffered.length},(_,i)=>[m.buffered.start(i),m.buffered.end(i)])})),contexts:contexts.map(c=>({state:c.state,sampleRate:c.sampleRate,currentTime:c.currentTime})),maxVoices});
 globalThis.Audio=new Proxy(globalThis.Audio,{construct(Target,args){const m=Reflect.construct(Target,args);media.push(m);for(const type of ['loadedmetadata','loadeddata','canplay','playing','pause','seeking','seeked','timeupdate','waiting','stalled','ended','error','emptied'])m.addEventListener(type,()=>{events.push({type,time:performance.now(),src:m.currentSrc||m.src,position:m.currentTime,seeking:m.seeking,readyState:m.readyState,error:m.error?.code??null});if(events.length>1000)events.shift();});return m;}});
 for(const key of ['AudioContext','webkitAudioContext'])if(globalThis[key])globalThis[key]=new Proxy(globalThis[key],{construct(Target,args){const c=Reflect.construct(Target,args);contexts.push(c);return c;}});
 const timer=setInterval(()=>{const active=media.filter(m=>isMusic(m)&&!m.paused);maxVoices=Math.max(maxVoices,active.length);samples.push({time:performance.now(),voices:active.length,srcs:active.map(m=>m.currentSrc||m.src)});if(samples.length>2500)samples.shift();},10);
 globalThis.nativeAudioQA={snapshot,events,samples,clearSamples(){samples.length=0;},
  // Controlled transport harness only: seek near a real decoded loop boundary.
  seekNearEnd(){const m=media.find(m=>isMusic(m)&&!m.paused);if(!m||!Number.isFinite(m.duration))throw Error('No decoded active media');const before={src:m.currentSrc,time:m.currentTime,duration:m.duration,seekable:Array.from({length:m.seekable.length},(_,i)=>[m.seekable.start(i),m.seekable.end(i)])},target=m.duration-0.65,at=performance.now();m.currentTime=target;return {before,target,immediateTime:m.currentTime,seeking:m.seeking,at};},
  stop(){clearInterval(timer);}};
}
async function mountHarness(options) {
 const [{createPreferenceStore},{createPreferenceEnvironment},{createSettingsPanel},{createAudioBus},{createMusicPresentation},{ORIGINAL_MUSIC_CUES,selectOriginalMusic},{resolveSceneMusic},{createChampionshipPreferencePort},{serializePreferences}]=await Promise.all([
  import('/src/championship/app/settings/preferenceStore.js'),import('/src/championship/app/settings/preferenceEnvironment.js'),import('/src/championship/app/settings/settingsPanel.js'),import('/src/championship/presentation/audioBus.js'),import('/src/championship/presentation/musicPresentation.js'),import('/src/championship/presentation/originalMusicCatalog.js'),import('/src/championship/presentation/sceneMusicCatalog.js'),import('/src/championship/app/ChampionshipPersistentSavePort.js'),import('/src/championship/app/settings/preferenceSchema.js')]);
 if(options.seed){localStorage.setItem('championshipModernSave:preferences:v1',serializePreferences(options.seed));localStorage.setItem('championshipModernSave:v1','QA_PROGRESS_SENTINEL_DO_NOT_TOUCH');}
 const store=createPreferenceStore({port:createChampionshipPreferencePort({storage:localStorage})});
 const environment=createPreferenceEnvironment({store});
 const audio=createAudioBus({levels:store.get()});
 store.subscribe(values=>audio.setLevels(values));
 const states=[];
 const music=createMusicPresentation({bus:audio,cues:ORIGINAL_MUSIC_CUES,baseUrl:location.origin+'/',resolveCue:(id,scene)=>resolveSceneMusic(id,scene,store.get()),onState:s=>{document.documentElement.dataset.musicState=JSON.stringify(s);states.push({...s,time:performance.now()});if(states.length>2000)states.shift();}});
 store.subscribe((_,changed)=>{if(changed.some(id=>['muted','masterVolume','sfxVolume','musicVolume','raisingMusic','battleMusic'].includes(id)))music.preferencesChanged();});
 const panel=createSettingsPanel({store,environment,audio,confirm:async()=>null});
 document.querySelector('#open').onclick=()=>panel.open({from:document.querySelector('#open'),category:'sound'});
 music.setScene('moon',null,'raising');
 globalThis.musicQA={store,audio,music,panel,states,
  project(screen,extra={}){const cue=selectOriginalMusic({screen,...extra});music.setScene(cue.id,cue.attemptId,['RAISING_HOME','CAGE_EDIT'].includes(screen)?'raising':null);},
  inspect:()=>({preferences:store.get(),status:store.status(),music:music.inspect(),gains:audio.gains(),native:nativeAudioQA.snapshot(),progress:localStorage.getItem('championshipModernSave:v1')}),
  dispose(){panel.dispose();music.dispose();audio.dispose();environment.dispose();store.dispose();nativeAudioQA.stop();}};
}
function labelsSnapshot() {
 return [...document.querySelectorAll('[data-setting="raisingMusic"] input,[data-setting="battleMusic"] input')].filter(i=>i.value!=='default').map(i=>{
  const label=i.closest('label'),name=label.querySelector('.cm-choice__name'),rect=label.getBoundingClientRect(),r=name.getBoundingClientRect(),container=i.closest('.cm-settings__content').getBoundingClientRect();
  return {id:i.value,name:name.textContent,lang:name.lang,width:r.width,labelWidth:rect.width,labelHeight:rect.height,left:rect.left,right:rect.right,containerLeft:container.left,containerRight:container.right,textScrollWidth:name.scrollWidth,textClientWidth:name.clientWidth};
 });
}
async function category(page,id) {
 if(await page.locator('.cm-settings__back:visible').count())await page.locator('.cm-settings__back').click();
 await page.locator(`.cm-settings__category[data-category="${id}"]`).click();
}
async function select(page,key,value,{touch=false}={}) {
 const input=page.locator(choice(key,value));await input.scrollIntoViewIfNeeded();
 if(touch)await input.locator('xpath=..').tap();else await input.locator('xpath=..').click();
 assert.equal(await page.locator(choice(key,value)).isChecked(),true);
}
async function muted(page,value) {const input=page.locator('[data-setting="muted"] input');if(await input.isChecked()!==value)await input.locator('xpath=..').click();assert.equal(await page.locator('[data-setting="muted"] input').isChecked(),value);}
async function waitCue(page,id) {
 await page.waitForFunction(expected=>{const s=JSON.parse(document.documentElement.dataset.musicState||'{}');return s.playing===expected&&s.pending===null&&s.voices===1&&!s.error;},id,{timeout:30000});
 await page.waitForTimeout(250);
}
async function nativeEvidence(page,id) {await waitCue(page,id);return page.evaluate(()=>({state:JSON.parse(document.documentElement.dataset.musicState),...nativeAudioQA.snapshot()}));}
async function assertBounded(page) {const s=await page.evaluate(()=>nativeAudioQA.snapshot());assert.ok(s.maxVoices<=2);assert.ok(s.mediaCreated<=2);assert.equal(s.contexts.length,1);return s;}
async function main() {
 const base=process.argv[2];assert.ok(base,'Usage: node tests/championship-scene-music-browser.mjs LOOPBACK_BASE_URL [OUTPUT_DIR]');
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Isolated loopback origin required');
 const output=path.resolve(process.argv[3]??require('./browser-qa-output.cjs')('scene-music'));await fs.mkdir(output,{recursive:true});
 const report={status:'RUNNING',commit:process.env.GITHUB_SHA??null,candidateHead:process.env.BGM_QA_HEAD_SHA??null,baseCommit:process.env.BGM_QA_BASE_SHA??null,
  scope:{matrix:'Actual Chromium + unmodified production Settings/store/environment/audioBus/music modules. Scene inputs and progress sentinel controlled by test harness.',normalGame:'Existing owned-party fixture seeds isolated save; production app, normal visible UI and real renderer thereafter.'},
  limits:['No physical iOS/Android or listening/seamless-loop approval.','Lifecycle harness dispatches pagehide/pageshow, not physical mobile backgrounding.','Tutorial and championship-final routing use production selector in harness, not complete tutorial/tournament progression.','Missing selected file is bounded silent failure + valid-selection recovery, not automatic fallback to another track.'],
  layouts:[],media:[],transport:[],normalGame:[],sourceHashes:[],errors:[]};
 const write=()=>fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
 for(const file of ['src/championship/app/main.js','src/championship/app/settings/settingsPanel.js','src/championship/app/ui/settings.css','src/championship/app/settings/preferenceSchema.js','src/championship/presentation/musicPresentation.js','src/championship/presentation/sceneMusicCatalog.js','src/championship/presentation/originalMusicCatalog.js','src/championship/presentation/audioBus.js','tests/fixtures/championship-owned-party.html','tests/championship-scene-music-browser.mjs','.github/workflows/scene-music-browser.yml'])report.sourceHashes.push({file,sha256:sha256(await fs.readFile(file))});
 for(const t of TRACKS){const bytes=await fs.readFile(t.path);assert.equal(bytes.length,t.bytes);assert.equal(sha256(bytes),t.sha256);}
 const html=await fs.readFile('championship.html','utf8'),styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('\n');
 const fixture=`<!doctype html><html><head><base href="${base}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${styles}<style>body:has(.cm-settings) #open { opacity:0; }</style></head><body><button id="open">Open Settings</button></body></html>`;
 const {chromium}=require('playwright');let browser,current;
 try{browser=await chromium.launch({headless:true,...(process.env.BGM_QA_CHROMIUM_EXECUTABLE?{executablePath:process.env.BGM_QA_CHROMIUM_EXECUTABLE}:{})});}
 catch(e){report.status='BLOCKED_BROWSER_LAUNCH';report.error=String(e);await write();throw e;}
 async function fresh(viewport={width:1366,height:768},options={}) {
  const context=await browser.newContext({viewport,hasTouch:true,locale:'zh-TW',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);current=page;
  await page.addInitScript(observeNativeAudio);page.on('pageerror',e=>report.errors.push(String(e)));
  // Never allow test execution to reach a public site or connected player profile.
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.route('**/tests/fixtures/scene-music-review.html',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.goto(new URL('tests/fixtures/scene-music-review.html',base).href);await page.evaluate(mountHarness,options);return {context,page};
 }
 try {
  for(const [width,height] of SIZES)for(const locale of LOCALES){
   const {context,page}=await fresh({width,height},{seed:{muted:true,locale,textScale:130}});
   try{await page.locator('#open').click();await page.evaluate(()=>document.fonts.ready);const rows=await page.evaluate(labelsSnapshot),header=await page.evaluate(headerSnapshot);report.layouts.push({width,height,locale,textScale:130,rows,header,status:'PENDING'});await write();checkLabels(rows,locale);checkHeader(header);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await select(page,'raisingMusic','a_quiet_evening_training',{touch:true});await select(page,'battleMusic','federation_siege',{touch:true});
    const radio=page.locator(choice('battleMusic','federation_siege'));await radio.focus();await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator(choice('battleMusic','unison_under_fire')).isChecked(),true);
    assert.equal(await page.evaluate(()=>document.activeElement?.value),'unison_under_fire','Native radio focus survives rerender');
    await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.value),'unison_under_fire','Tab leaves checked radio group');
    await page.keyboard.press('Escape');if(width<768){assert.equal(await page.locator('.cm-settings').getAttribute('data-view'),'list');await page.keyboard.press('Escape');}
    assert.equal(await page.locator('.cm-settings').count(),0);assert.equal(await page.locator('#open').evaluate(e=>e===document.activeElement),true,'Closing restores opener focus');
    await page.locator('#open').click();await page.locator(choice('battleMusic','federation_siege')).scrollIntoViewIfNeeded();
    if(locale==='zh-Hant'||locale==='vi')await page.screenshot({path:path.join(output,`settings-${width}x${height}-${locale}-130.png`)});
    const snapshot=await page.evaluate(()=>musicQA.inspect());assert.equal(snapshot.native.media.length,0,'Muted settings must not lazily load music');Object.assign(report.layouts.at(-1),{status:'PASS',keyboard:true,touch:true});
   }catch(error){report.failureDiagnostic={scope:'production-settings-layout-harness',width,height,locale,error:String(error.stack??error),header:await page.evaluate(headerSnapshot).catch(e=>({diagnosticError:String(e)}))};await write();await page.screenshot({path:path.join(output,'layout-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
  }
  // Fresh-profile gate: no audio request before real input, or while any saved
  // effective-volume gate is zero. Trusted clicks/keys, never synthetic unlock.
  for(const gate of [{muted:true},{masterVolume:0},{musicVolume:0}]){
   const {context,page}=await fresh(undefined,{seed:{...gate,raisingMusic:'a_quiet_evening_training'}}),requests=[];page.on('request',r=>{if(/scene-music-r1\/.*mp3/.test(r.url()))requests.push(r.url());});
   try{await page.waitForTimeout(250);assert.equal((await page.evaluate(()=>musicQA.inspect())).native.media.length,0);
    await page.locator('#open').click();await page.waitForTimeout(250);assert.equal(requests.length,0);assert.equal((await page.evaluate(()=>musicQA.inspect())).native.media.length,0);
    await select(page,'raisingMusic','lofi');await select(page,'raisingMusic','a_quiet_evening_training');
    if(gate.muted)await muted(page,false);else {const key=Object.keys(gate)[0];await page.locator(`[data-setting="${key}"] input`).focus();await page.keyboard.press('End');}
    const evidence=await nativeEvidence(page,'a_quiet_evening_training');checkNativeMedia(evidence,TRACKS[0]);report.transport.push({case:'saved-volume-gate',gate,evidence});
   }catch(error){report.failureDiagnostic={scope:'saved-volume-gate-harness',gate,error:String(error.stack??error),live:await page.evaluate(()=>({snapshot:musicQA.inspect(),events:nativeAudioQA.events.slice(-200)})).catch(e=>({diagnosticError:String(e)}))};await write();await page.screenshot({path:path.join(output,'volume-gate-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
  }
  const {context,page}=await fresh(undefined,{seed:{locale:'zh-Hant',masterVolume:65,sfxVolume:35,musicVolume:45}});
  try{
   await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>musicQA.inspect())).native.media.length,0,'No autoplay bypass');
   await page.locator('#open').click();await waitCue(page,'a_quiet_evening_training');
   for(const t of TRACKS){
    await page.evaluate(({id,scene})=>musicQA.music.setScene(id,null,scene),sourceForTrack(t));
    await select(page,t.scene+'Music',t.id);const evidence=await nativeEvidence(page,t.id);checkNativeMedia(evidence,t);
    // Full response byte identity is additional evidence, not the decoder claim.
    const fetched=await page.evaluate(async pathname=>{const r=await fetch('/'+pathname,{cache:'reload'});const b=await r.arrayBuffer();return {status:r.status,bytes:b.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')};},t.path);
    assert.equal(fetched.status,200);assert.equal(fetched.bytes,t.bytes);assert.equal(fetched.sha256,t.sha256);report.media.push({id:t.id,fetched,evidence});
    const rangeProbe=await page.evaluate(async pathname=>{const r=await fetch('/'+pathname,{headers:{Range:'bytes=0-15'},cache:'reload'}),b=await r.arrayBuffer();return {status:r.status,acceptRanges:r.headers.get('Accept-Ranges'),contentRange:r.headers.get('Content-Range'),bytes:b.byteLength};},t.path);report.transport.push({case:'http-byte-range-probe',id:t.id,...rangeProbe});await write();assert.deepEqual(rangeProbe,{status:206,acceptRanges:'bytes',contentRange:`bytes 0-15/${t.bytes}`,bytes:16},'Native seek fixture must support actual byte ranges');
    const loopStarts=(await page.evaluate(()=>musicQA.inspect())).music.starts,seek=await page.evaluate(()=>nativeAudioQA.seekNearEnd());const loopRecord={case:'real-decoded-loop-boundary-seek',id:t.id,beforeStarts:loopStarts,rangeProbe,seek,status:'PENDING'};report.transport.push(loopRecord);await write();
    assert.ok(seek.before.seekable.some(([a,b])=>a<=seek.target&&b>=seek.target),'Native target lies inside seekable range');
    await page.waitForFunction(starts=>JSON.parse(document.documentElement.dataset.musicState).starts>starts,loopStarts,{timeout:10000});await waitCue(page,t.id);const loop=await page.evaluate(()=>musicQA.inspect());const seekEvents=await page.evaluate(at=>nativeAudioQA.events.filter(e=>e.time>=at&&['seeking','seeked','timeupdate','ended','playing'].includes(e.type)),seek.at);
    assert.ok(seekEvents.some(e=>e.type==='seeked'&&e.src===seek.before.src&&e.position>=seek.target-.2),'Observe native seeked at the requested end boundary');assert.ok(loop.music.position<5,'Real loop restarts near cue head');await assertBounded(page);Object.assign(loopRecord,{status:'PASS',after:loop.music,seekEvents});
   }
   for(const id of ['battle_normal','battle_final']){await select(page,'battleMusic',id);await waitCue(page,id);report.transport.push({case:'existing-battle-choice',id,native:await assertBounded(page)});}await select(page,'battleMusic','federation_siege');
   await page.evaluate(()=>musicQA.music.setScene('moon',null,'raising'));await waitCue(page,'a_quiet_evening_training');
   const before=await page.evaluate(()=>musicQA.inspect());
   for(const locale of LOCALES){await category(page,'language');await select(page,'locale',locale);await category(page,'sound');checkLabels(await page.evaluate(labelsSnapshot),locale);const after=await page.evaluate(()=>musicQA.inspect());assert.equal(after.music.starts,before.music.starts,'Locale must not restart effective cue');assert.equal(after.music.playing,'a_quiet_evening_training');assert.ok(after.music.position>=before.music.position);assert.equal(after.preferences.masterVolume,65);assert.equal(after.preferences.musicVolume,45);assert.equal(after.preferences.sfxVolume,35);assert.equal(after.preferences.muted,false);}
   await select(page,'raisingMusic','a_quiet_evening_training');assert.equal((await page.evaluate(()=>musicQA.inspect())).music.starts,before.music.starts,'Reselect same cue does not restart');
   for(const sequence of [['moon','lofi','a_quiet_evening_training'],['moon','lofi','moon']]){await page.evaluate(()=>nativeAudioQA.clearSamples());for(const id of sequence)await select(page,'raisingMusic',id);await waitCue(page,sequence.at(-1));report.transport.push({case:'rapid-selection',sequence,native:await assertBounded(page)});}
   await waitCue(page,'moon');await page.evaluate(()=>nativeAudioQA.clearSamples());await select(page,'raisingMusic','a_quiet_evening_training');await waitCue(page,'a_quiet_evening_training');
   const fade=await page.evaluate(()=>nativeAudioQA.samples);assert.ok(fade.some(s=>s.voices===2),'Observe actual dual-stream crossfade');assert.equal(fade.at(-1).voices,1);assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,1);report.transport.push({case:'raising-immediate-crossfade',samples:fade.filter((s,i)=>i%8===0)});
   await assertBounded(page);
   await page.locator('.cm-settings__content .cm-settings__action').click();await page.waitForTimeout(650);await assertBounded(page);
   const stable=await page.evaluate(()=>musicQA.inspect());assert.ok(Math.abs(stable.gains.master-.65)<.02&&Math.abs(stable.gains.music-.45)<.02&&Math.abs(stable.gains.sfx-.35)<.02,'Shared bus retains separate category levels');
   await muted(page,true);await select(page,'raisingMusic','lofi');await select(page,'raisingMusic','a_quiet_evening_training');assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,0);
   await muted(page,false);await waitCue(page,'a_quiet_evening_training');
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,0);
   await select(page,'raisingMusic','lofi');assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,0);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));await waitCue(page,'lofi');
   for(const [scene,expected] of [['battle_normal','federation_siege'],['battle_final','federation_siege'],['login','login'],['moon','a_quiet_evening_training']]){
    if(scene==='moon')await select(page,'raisingMusic','a_quiet_evening_training');await page.evaluate(({scene})=>musicQA.music.setScene(scene,null,scene==='moon'?'raising':null),{scene});await waitCue(page,expected);report.transport.push({case:'scene-switch',source:scene,expected,evidence:await assertBounded(page)});
   }
   await select(page,'raisingMusic','default');await page.evaluate(()=>musicQA.project('RAISING_HOME',{tutorial:true}));await waitCue(page,'a_quiet_evening_training');await page.evaluate(()=>musicQA.project('RAISING_HOME'));await waitCue(page,'a_quiet_evening_training');
   await page.evaluate(()=>musicQA.project('CAGE_EDIT'));await waitCue(page,'podium_geometry');checkNativeMedia(await nativeEvidence(page,'podium_geometry'),TRACKS.find(t=>t.id==='podium_geometry'));
   await muted(page,true);assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,0);await muted(page,false);await waitCue(page,'podium_geometry');
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal((await page.evaluate(()=>musicQA.inspect())).music.voices,0);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));await waitCue(page,'podium_geometry');
   report.transport.push({case:'field-setup-default-mute-background-return',native:await assertBounded(page)});
   await page.evaluate(()=>musicQA.project('RAISING_HOME'));await waitCue(page,'a_quiet_evening_training');await select(page,'raisingMusic','a_quiet_evening_training');await waitCue(page,'a_quiet_evening_training');
   await page.evaluate(()=>musicQA.project('BATTLE_FIELD',{chosen:{championship:true,cursor:2,totalRounds:3}}));await waitCue(page,'federation_siege');
   for(const id of ['victory','defeat','draw']){await page.evaluate(id=>musicQA.music.setScene(id,'test-result-'+id),id);await waitCue(page,id);const result=await page.evaluate(()=>musicQA.inspect());assert.equal(result.native.media.find(m=>!m.paused)?.loop,false);const starts=result.music.starts;
    await page.evaluate(id=>{musicQA.music.setScene(id,'test-result-'+id);musicQA.store.set('battleMusic','unison_under_fire');},id);assert.equal((await page.evaluate(()=>musicQA.inspect())).music.starts,starts,'Result ignores BGM choice and repeated projection');
    await page.evaluate(()=>nativeAudioQA.seekNearEnd());await page.waitForFunction(()=>{const s=musicQA.inspect().music;return s.playing===null&&s.pending===null&&s.voices===0&&!s.error;},null,{timeout:10000});
    await page.evaluate(id=>musicQA.music.setScene(id,'test-result-'+id),id);await page.waitForTimeout(250);const ended=await page.evaluate(()=>musicQA.inspect());assert.equal(ended.music.starts,starts,'Finished result cannot replay same attempt');assert.equal(ended.music.voices,0);report.transport.push({case:'result-one-shot-real-ended',id,state:ended.music});
   }
   await page.evaluate(()=>musicQA.music.setScene('moon',null,'raising'));await waitCue(page,'a_quiet_evening_training');
   await page.waitForTimeout(450);const persisted=await page.evaluate(()=>musicQA.inspect());assert.equal(persisted.progress,'QA_PROGRESS_SENTINEL_DO_NOT_TOUCH');
   await page.reload();await page.evaluate(mountHarness,{});await page.locator('#open').click();let restored=await page.evaluate(()=>musicQA.inspect());
   for(const key of ['raisingMusic','battleMusic','masterVolume','sfxVolume','musicVolume','muted','locale'])assert.equal(restored.preferences[key],persisted.preferences[key],key+' persists');assert.equal(restored.progress,persisted.progress);
   // Network missing-file negative control, not an automatic fallback claim.
   await select(page,'battleMusic','unison_under_fire');await page.evaluate(()=>musicQA.music.setScene('battle_normal'));await waitCue(page,'unison_under_fire');
   await page.route('**/scene-music-r1/battle/federation_siege.mp3',r=>r.fulfill({status:404,body:'intentional isolated QA 404'}));await select(page,'battleMusic','federation_siege');
   await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.musicState||'{}').error?.startsWith('MUSIC_MEDIA_ERROR'),null,{timeout:30000});const failed=await page.evaluate(()=>musicQA.inspect());assert.equal(failed.music.voices,1);assert.equal(failed.music.playing,'unison_under_fire');assert.equal(failed.music.retryable,true);
   await page.unroute('**/scene-music-r1/battle/federation_siege.mp3');assert.equal(await page.evaluate(()=>musicQA.music.retry()),true);checkNativeMedia(await nativeEvidence(page,'federation_siege'),TRACKS[2]);report.transport.push({case:'replacement-404-retains-old-and-retry-recovers',native:await assertBounded(page)});
   await select(page,'battleMusic','unison_under_fire');await waitCue(page,'unison_under_fire');
   await page.locator('.cm-settings__reset').click();restored=await page.evaluate(()=>musicQA.inspect());assert.equal(restored.preferences.raisingMusic,'default');assert.equal(restored.preferences.battleMusic,'default');assert.equal(restored.progress,persisted.progress);
   await page.waitForTimeout(450);await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.account={...d.account,raisingMusic:'removed_track',battleMusic:'not-a-file.mp3'};localStorage.setItem(key,JSON.stringify(d));},PREF);
   await page.reload();await page.evaluate(mountHarness,{});restored=await page.evaluate(()=>musicQA.inspect());assert.equal(restored.preferences.raisingMusic,'default');assert.equal(restored.preferences.battleMusic,'default');assert.equal(restored.progress,persisted.progress);await page.locator('#open').click();await waitCue(page,'a_quiet_evening_training');
   report.transport.push({case:'persistence-reset-invalid-id-and-404-recovery',status:'PASS',progressBytesUnchanged:true});
  }catch(error){report.failureDiagnostic={scope:'production-module-transport-harness',error:String(error.stack??error),live:await page.evaluate(()=>({snapshot:musicQA.inspect(),states:musicQA.states.slice(-100),events:nativeAudioQA.events.slice(-200),samples:nativeAudioQA.samples.slice(-100)})).catch(e=>({diagnosticError:String(e)}))};await write();await page.screenshot({path:path.join(output,'transport-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
  report.normalGame=await normalGame(browser,base,output);
  assert.deepEqual(report.errors,[]);report.status='PASS_REAL_CHROMIUM_HARNESS_AND_CONTROLLED_NORMAL_GAME';await write();
 }catch(e){report.status='FAIL';report.error=String(e.stack??e);await write();if(current&&!current.isClosed())await current.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
 finally{await browser.close();}
 console.log(JSON.stringify({status:report.status,layoutCases:report.layouts.length,decodedMP3s:report.media.length,output}));
}
async function titleReady(page) {
 // Some valid title routes have no film node. Wait for the real boot gate,
 // then skip the optional film only when its visible control is mounted.
 await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
 if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});await page.waitForTimeout(450);}
 await page.waitForFunction(()=>{const film=document.querySelector('#cm-opening-film');return !film||film.hidden;});
 await page.locator('#cm-login:visible').waitFor();await page.waitForFunction(()=>!document.querySelector('#cm-login').disabled);
}
async function enterGame(page) {
 await titleReady(page);await page.locator('#cm-login').click();await page.locator('#cm-continue:visible').click();
 await page.locator('#cm-root[data-active-screen="RAISING_HOME"]:visible').waitFor();
 await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:180000});
 assert.ok(await page.locator('.int-rh2-field-host canvas').count()>0);assert.equal(await page.locator('[data-field-fallback="true"]').count(),0);
}
async function menu(page,group,entry) {
 await page.locator(`.cm-toolbar button[data-menu-id="${group}"]:visible`).click();
 await page.locator(`.cm-toolbar__menu[data-menu-id="${group}"]:not([hidden]) button[data-entry-id="${entry}"]`).click();
}
async function closeGameSettings(page) {
 await page.locator('dialog.cm-settings[open] .cm-settings__close').click();
 await page.locator('dialog.cm-settings').waitFor({state:'detached'});
 // Settings owns a same-document history entry; let its asynchronous back finish
 // before reopening it or reloading, rather than racing the next modal's entry.
 await page.waitForFunction(()=>!history.state?.cmSettings);
}
async function normalGame(browser,base,output) {
 const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true,locale:'zh-TW',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(90000);
 const evidence={status:'RUNNING',fixture:'tests/fixtures/championship-owned-party.html#prepare-practice',errors:[],steps:[]};
 page.on('pageerror',e=>evidence.errors.push(String(e)));await page.addInitScript(observeNativeAudio);
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 try{
  await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);await page.locator('#prepare-practice').click();await page.locator('#status').filter({hasText:'受控存檔已準備'}).waitFor();
  await page.goto(new URL('championship.html?presentation=developer',base).href);await enterGame(page);await waitCue(page,'a_quiet_evening_training');
  await menu(page,'MANAGEMENT','cageEdit');await page.locator('#cm-root[data-active-screen="CAGE_EDIT"]').waitFor();checkNativeMedia(await nativeEvidence(page,'podium_geometry'),TRACKS.find(t=>t.id==='podium_geometry'));evidence.steps.push({case:'actual-cage-edit-podium-default',native:await assertBounded(page)});
  await page.locator('#cm-root .cm-vs2-cage-edit .cm-vs2-footer button').first().click();await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();await waitCue(page,'a_quiet_evening_training');evidence.steps.push({case:'actual-cage-edit-return-quiet-evening',native:await assertBounded(page)});
  await menu(page,'SYSTEM','settings');await category(page,'sound');await select(page,'raisingMusic','a_quiet_evening_training');checkNativeMedia(await nativeEvidence(page,'a_quiet_evening_training'),TRACKS[0]);await select(page,'battleMusic','unison_under_fire');
  const before=JSON.parse(await page.locator('html').getAttribute('data-music-state'));await category(page,'language');await select(page,'locale','en');await category(page,'sound');checkLabels(await page.evaluate(labelsSnapshot),'en');assert.equal(JSON.parse(await page.locator('html').getAttribute('data-music-state')).starts,before.starts);await closeGameSettings(page);
  evidence.steps.push({case:'actual-raising-settings-immediate-change-locale',native:await assertBounded(page)});await page.screenshot({path:path.join(output,'normal-game-raising-selected.png')});
  await menu(page,'MANAGEMENT','digimon');await page.locator('#cm-root[data-active-screen="DIGIMON_LIST"]').waitFor();await waitCue(page,'moon');await page.locator('#cm-root .cm-screen-back:visible').first().click();await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:180000});await waitCue(page,'a_quiet_evening_training');
  await menu(page,'SYSTEM','battle');await page.locator('[data-face-id="PRACTICE_BATTLE"]').click();const rows=page.locator('.cm-vs5-practice-member');await rows.nth(1).waitFor({state:'visible',timeout:30000});assert.ok(await rows.count()>=2,'Controlled fixture provides two owned eligible residents');await rows.nth(0).locator('button').nth(0).click();await rows.nth(1).locator('button').nth(1).click();await page.locator('.cm-vs5-footer .cm-vs5-action--primary').click();
  await page.locator('#cm-root[data-active-screen="BATTLE_FIELD"]').waitFor();await page.locator('#cm-root .cm-vs5-field[aria-busy="false"]').waitFor({timeout:180000});assert.equal(await page.locator('#cm-root[data-field-fallback="true"]').count(),0);checkNativeMedia(await nativeEvidence(page,'unison_under_fire'),TRACKS[1]);evidence.steps.push({case:'actual-normal-practice-battle',native:await assertBounded(page)});await page.screenshot({path:path.join(output,'normal-game-battle-selected.png')});
  await page.locator('#cm-root .cm-vs5-exit:visible').click();await page.waitForFunction(()=>document.querySelector('#cm-root')?.dataset.activeScreen!=='BATTLE_FIELD'||document.querySelector('dialog[open] [data-action="leave"]'));const confirmation=page.locator('dialog[open] [data-action="leave"]');if(await confirmation.count())await confirmation.click();
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();await waitCue(page,'a_quiet_evening_training');evidence.steps.push({case:'actual-practice-exit-raising-return',native:await assertBounded(page)});
  await menu(page,'SYSTEM','settings');await category(page,'sound');await select(page,'battleMusic','federation_siege');await closeGameSettings(page);await menu(page,'SYSTEM','saveQuit');await titleReady(page);await waitCue(page,'login');await page.reload();await titleReady(page);
  await page.locator('#cm-title-settings').click();await category(page,'sound');assert.equal(await page.locator(choice('raisingMusic','a_quiet_evening_training')).isChecked(),true);assert.equal(await page.locator(choice('battleMusic','federation_siege')).isChecked(),true);await closeGameSettings(page);evidence.steps.push({case:'actual-save-quit-reload-preferences',status:'PASS'});
  await page.locator('#cm-login:visible').click();await page.locator('#cm-data-arena:visible').click();await page.locator('.da-root[data-state="SELECT"] .da-panel--select').waitFor();await page.locator('.da-root[data-state="SELECT"] .da-panel--select .da-btn--primary').click();await page.locator('.da-root[data-state="BRIEF"] .da-panel--brief').waitFor();await page.locator('.da-root[data-state="BRIEF"] .da-panel--brief .da-btn--primary').click();await page.locator('.da-root[data-state="PLAY"]').waitFor({timeout:180000});checkNativeMedia(await nativeEvidence(page,'federation_siege'),TRACKS[2]);
  evidence.steps.push({case:'actual-data-arena-battle-selection',native:await assertBounded(page)});await page.screenshot({path:path.join(output,'normal-data-arena-selected.png')});await page.locator('.da-root[data-state="PLAY"] .da-hud__pause').click();await page.locator('.da-root[data-state="PAUSE"] .da-panel--pause .da-btn--quiet').click();await page.locator('.da-root').waitFor({state:'detached'});await waitCue(page,'login');evidence.steps.push({case:'actual-data-arena-exit-title-return',native:await assertBounded(page)});
  assert.deepEqual(evidence.errors,[]);evidence.status='PASS_ACTUAL_RAISING_PRACTICE_BATTLE_DATA_ARENA_AND_RETURN';return evidence;
 }catch(e){evidence.status='FAIL';evidence.error=String(e.stack??e);evidence.live=await page.evaluate(()=>({screen:document.querySelector('#cm-root')?.dataset.activeScreen,arenaState:document.querySelector('.da-root')?.dataset.state,historyState:history.state,controls:[...document.querySelectorAll('.cm-toolbar [data-menu-id],dialog[open],#cm-login,#cm-continue,#cm-data-arena,#cm-title-settings,.da-root .da-btn--primary,.da-panel--pause .da-btn--quiet')].slice(0,30).map(e=>({tag:e.tagName,id:e.id,classes:e.className,menuId:e.dataset.menuId,hidden:!!e.closest('[hidden]'),visible:e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden',disabled:e.disabled??null})),musicState:document.documentElement.dataset.musicState,native:nativeAudioQA.snapshot(),events:nativeAudioQA.events.slice(-200),samples:nativeAudioQA.samples.slice(-100)})).catch(error=>({diagnosticError:String(error)}));await fs.writeFile(path.join(output,'normal-game-result.json'),JSON.stringify(evidence,null,2)+'\n');await page.screenshot({path:path.join(output,'normal-game-failure.png')}).catch(()=>{});throw e;}
 finally{await context.close();}
}
if(process.argv.includes('--self-test'))selfTest();else if(process.argv[2]==='--serve')await serveRangeRoot(Number(process.argv[3]??8765),process.argv[4]??'.');else await main();
