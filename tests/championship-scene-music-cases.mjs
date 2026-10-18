import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createMusicPresentation} from '../src/championship/presentation/musicPresentation.js';
import {ORIGINAL_MUSIC_CUES,selectOriginalMusic} from '../src/championship/presentation/originalMusicCatalog.js';
import {SCENE_MUSIC_TRACKS,musicChoicesForScene,musicTrackTitle,resolveSceneMusic} from '../src/championship/presentation/sceneMusicCatalog.js';
import {createAudioBus} from '../src/championship/presentation/audioBus.js';
import {createPreferenceStore} from '../src/championship/app/settings/preferenceStore.js';
import {DEFAULT_PREFERENCES,normalizePreferences,parsePreferences,createPreferencesDocument} from '../src/championship/app/settings/preferenceSchema.js';
import {CHAMPIONSHIP_PREFERENCES_KEY,createChampionshipPreferencePort} from '../src/championship/app/ChampionshipPersistentSavePort.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale} from '../src/championship/text/locale.js';
import {inspectSceneMusicLocaleCopy,buildLocaleCoverage} from '../scripts/check-locale-coverage.mjs';

class Events {
  listeners=new Map();visibilityState='visible';
  addEventListener(t,f){const a=this.listeners.get(t)??[];a.push(f);this.listeners.set(t,a);}
  removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)??[]).filter(x=>x!==f));}
  emit(t){for(const f of this.listeners.get(t)??[])f({isTrusted:true});}
}
const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
const node=()=>({gain:param(),connect(){},disconnect(){}});
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture({muted=false,delayed=false,ogg=true,levels={}}={}){
  const doc=new Events(),win=new Events(),media=[],pending=[],timers=new Map();let contexts=0,timerId=0,delayPlay=delayed,contextRef;const preferences={...DEFAULT_PREFERENCES};
  class Context {state='running';currentTime=0;destination={};constructor(){contexts++;contextRef=this;}createGain(){return node();}createMediaElementSource(){return node();}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
  class Media {paused=true;currentTime=0;duration=32;src='';plays=0;constructor(){media.push(this);}canPlayType(){return ogg?'probably':'';}load(){}removeAttribute(){this.src='';}pause(){this.paused=true;}play(){this.plays++;if(delayPlay)return new Promise(resolve=>pending.push(()=>{if(this.src)this.paused=false;resolve();}));this.paused=false;return Promise.resolve();}}
  const bus=createAudioBus({AudioContextClass:Context,eventTarget:doc,levels:{muted,...levels}});
  const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,resolveCue:(id,scene)=>resolveSceneMusic(id,scene,preferences),baseUrl:'https://example.test/game/',doc,win,AudioClass:Media,timers:{setTimeout(f){timers.set(++timerId,f);return timerId;},clearTimeout(id){timers.delete(id);}}});
  return{bus,music,doc,win,media,pending,timers,preferences,delay(value){delayPlay=value;},choose(id,value){preferences[id]=value;music.preferencesChanged();},dispose(){music.dispose();bus.dispose();},contexts:()=>contexts,finishFades(){contextRef.currentTime+=1;for(const [id,f]of [...timers]){timers.delete(id);f();}}};
}

test('complete catalog has one categorized Chinese/English record per actual cue, including all existing encodings',()=>{
 assert.equal(SCENE_MUSIC_TRACKS.length,Object.keys(ORIGINAL_MUSIC_CUES).length);
 assert.equal(new Set(SCENE_MUSIC_TRACKS.map(t=>t.id)).size,SCENE_MUSIC_TRACKS.length);
 for(const [id,cue] of Object.entries(ORIGINAL_MUSIC_CUES)){
  const t=SCENE_MUSIC_TRACKS.find(t=>t.id===id);assert.ok(t,id);assert.ok(t.categories.length);assert.ok(t.titles.zh);assert.ok(t.titles.en);assert.match(cue.path,/^\.\/assets\/production\//);assert.ok(Number.isFinite(cue.gainDb));
 }
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets/production/original-music-r1/manifest.json',import.meta.url)));
 const paths=Object.values(ORIGINAL_MUSIC_CUES).flatMap(c=>[c.path,c.fallbackPath].filter(Boolean)).filter(p=>p.includes('/original-music-r1/')).map(p=>p.split('/').at(-1));
 assert.deepEqual(paths.sort(),[...manifest.files.map(f=>f.path),...manifest.compatibleEncodings.map(f=>f.file)].sort());
 for(const scene of ['raising','battle'])for(const t of musicChoicesForScene(scene))assert.equal(ORIGINAL_MUSIC_CUES[t.id].loop,true);
 assert.deepEqual(musicChoicesForScene('result'),[]);
});
test('all Chinese locales show Chinese and en/ja/th/vi show only English for every track',()=>{
 for(const t of SCENE_MUSIC_TRACKS){for(const locale of ['zh-Hant','zh-TW','zh-Hans'])assert.equal(musicTrackTitle(t.id,locale),t.titles.zh);for(const locale of ['en','ja','th','vi'])assert.equal(musicTrackTitle(t.id,locale),t.titles.en);}assert.equal(musicTrackTitle('missing','en'),'');
});
test('canonical title registration covers all 24 bilingual records, not stray literals or other files',()=>{
 const file='src/championship/presentation/sceneMusicCatalog.js',checked=inspectSceneMusicLocaleCopy(SCENE_MUSIC_TRACKS);
 assert.equal(checked.keys.length,24);assert.deepEqual(checked.gaps,[]);
 for(const track of SCENE_MUSIC_TRACKS)for(const locale of ['zh-Hant','en','ja','th','vi']){
  const title=musicTrackTitle(track.id,locale);
  assert.equal(title,track.titles[locale==='zh-Hant'?'zh':'en']);
  assert.equal(checked.covers({file,text:title}),true);
  assert.equal(checked.covers({file:'src/championship/app/not-a-dictionary.js',text:title}),false);
 }
 assert.equal(checked.covers({file,text:'這是尚未翻譯的新顯示文字'}),false);
});
test('every missing or blank Chinese/English music title remains a canonical locale gap',()=>{
 const file='src/championship/presentation/sceneMusicCatalog.js';
 for(const track of SCENE_MUSIC_TRACKS)for(const language of ['zh','en'])for(const value of [undefined,' ',42]){
  const broken=structuredClone(SCENE_MUSIC_TRACKS),titles=broken.find(entry=>entry.id===track.id).titles;
  if(value===undefined)delete titles[language];else titles[language]=value;
  const expected=(language==='zh'?['zh-Hant']:['en','ja','th','vi']).map(locale=>`${locale}:SCOPED_COPY[${file}:${track.id}]`);
  assert.deepEqual(inspectSceneMusicLocaleCopy(broken).gaps,expected);
 }
});
test('global locale gate registers all scene titles with zero missing titles or raw display literals',async()=>{
 const report=await buildLocaleCoverage(),file='src/championship/presentation/sceneMusicCatalog.js';
 assert.deepEqual(report.scopedCopy.find(row=>row.file===file),{file,keyCount:24,gaps:[]});
 assert.equal(report.counts.missing,0,JSON.stringify(report.missing));
 assert.equal(report.counts.uiCopyMissing,0);assert.equal(report.counts.catalogGaps,0);
});
test('music control copy exists deliberately in all five UI languages',()=>{
 const keys=['MUSIC_RAISING_PICK','MUSIC_RAISING_PICK_HINT','MUSIC_BATTLE_PICK','MUSIC_BATTLE_PICK_HINT','MUSIC_SCENE_DEFAULT','MUSIC_SCENE_DEFAULT_HINT','MUSIC_SCENE_PICK_NOTE','MUSIC_TEST_SFX'];
 for(const locale of ['zh-Hant','en','ja','th','vi']){setLocale(locale);for(const key of keys){assert.notEqual(uiText(key),key);assert.ok(uiText(key));}}setLocale('zh-Hant');
});
test('old, invalid and cross-scene preference IDs preserve scene defaults without inventing paths',()=>{
 for(const input of [{},{raisingMusic:'bogus',battleMusic:'../other.mp3'},{raisingMusic:'victory',battleMusic:'moon'}]){
  const prefs=normalizePreferences(input);assert.equal(prefs.raisingMusic,'default');assert.equal(prefs.battleMusic,'default');
  for(const [screen,tutorial,id]of [['RAISING_HOME',false,'a_quiet_evening_training'],['RAISING_HOME',true,'a_quiet_evening_training'],['CAGE_EDIT',false,'podium_geometry']])assert.equal(resolveSceneMusic(selectOriginalMusic({screen,tutorial}).id,'raising',prefs),id);
  assert.equal(resolveSceneMusic('battle_normal',null,prefs),'battle_normal');assert.equal(resolveSceneMusic('battle_final',null,prefs),'battle_final');
 }assert.equal(parsePreferences('{"schemaVersion":1,"account":{"locale":"en"}}').preferences.raisingMusic,'default');
});
test('choice scope preserves title, system, film silence and result stingers; arena shares battle choice',()=>{
 const prefs={raisingMusic:'lofi',battleMusic:'battle_final'};assert.equal(resolveSceneMusic('moon','raising',prefs),'lofi');
 for(const id of ['moon','login','core','harbor','plains',null,'victory','defeat','draw'])assert.equal(resolveSceneMusic(id,null,prefs),id);
 assert.equal(resolveSceneMusic(null,'raising',prefs),null);assert.equal(resolveSceneMusic('victory','raising',prefs),'victory');assert.equal(resolveSceneMusic('battle_normal',null,prefs),'battle_final');
});
test('selection persists through existing preferences only, reloads and resets without touching game save',()=>{
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,'unchanged-player-progress']]),writes=[];
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v);},removeItem(k){data.delete(k);}};
 const make=()=>createPreferenceStore({port:createChampionshipPreferencePort({storage}),setTimer:()=>1,clearTimer(){}});
 const first=make();first.set('raisingMusic','lofi');first.set('battleMusic','battle_final');first.flush();assert.deepEqual(writes,[CHAMPIONSHIP_PREFERENCES_KEY]);
 const saved=JSON.parse(data.get(CHAMPIONSHIP_PREFERENCES_KEY));assert.equal(saved.account.raisingMusic,'lofi');assert.equal(saved.account.battleMusic,'battle_final');assert.equal(saved.device.raisingMusic,undefined);
 const next=make();assert.equal(next.get().raisingMusic,'lofi');assert.equal(next.get().battleMusic,'battle_final');next.resetCategory('sound');next.flush();assert.equal(next.get().raisingMusic,'default');assert.equal(next.get().battleMusic,'default');
 assert.equal(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),'unchanged-player-progress');assert.ok(writes.every(k=>k===CHAMPIONSHIP_PREFERENCES_KEY));assert.deepEqual(createPreferencesDocument(DEFAULT_PREFERENCES).account,{});first.dispose();next.dispose();
});
test('selection waits for trusted gesture with no audio context, media element or source request',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.choose('raisingMusic','lofi');for(const fn of f.doc.listeners.get('pointerdown')??[])fn({isTrusted:false});await settle();assert.equal(f.contexts(),0);assert.equal(f.media.length,0);f.doc.emit('keydown');await settle();assert.equal(f.music.inspect().playing,'lofi');assert.equal(f.contexts(),1);f.dispose();
});
for(const levels of [{muted:true},{musicVolume:0},{masterVolume:0}])test(`silent levels ${JSON.stringify(levels)} defer selection until audible`,async()=>{
 const f=fixture({levels});f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');f.choose('raisingMusic','lofi');await settle();assert.equal(f.media.length,0);f.bus.setLevels({muted:false,masterVolume:80,musicVolume:25,sfxVolume:65});f.music.preferencesChanged();await settle();assert.equal(f.music.inspect().playing,'lofi');assert.equal(f.bus.gains().musicEffective,.2);assert.equal(f.bus.levels().sfxVolume,65);f.dispose();
});
test('active selection fades at most two slots, retires old stream and restores scene default',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();f.choose('raisingMusic','lofi');await settle();assert.equal(f.music.inspect().playing,'lofi');assert.equal(f.music.inspect().voices,2);f.finishFades();assert.equal(f.music.inspect().voices,1);assert.equal(f.media.find(m=>m.src.includes('moon')),undefined);f.choose('raisingMusic','default');await settle();f.finishFades();assert.equal(f.music.inspect().playing,'a_quiet_evening_training');assert.equal(f.media.length,2);f.dispose();
});
test('same effective selection and every locale preserve source, position and start count',async()=>{
 const f=fixture();f.choose('raisingMusic','moon');f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();const a=f.media[0];a.currentTime=18;f.choose('raisingMusic','moon');for(const locale of ['zh-Hant','en','ja','th','vi']){f.preferences.locale=locale;f.music.preferencesChanged();await settle();}assert.equal(a.currentTime,18);assert.equal(a.plays,1);assert.equal(f.music.inspect().starts,1);assert.equal(f.media.length,1);f.dispose();
});
test('same effective cue still records a new scene before a later preference change',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();f.music.setScene('moon');f.choose('raisingMusic','lofi');await settle();assert.equal(f.music.inspect().playing,'moon');f.music.setScene('moon',null,'raising');await settle();assert.equal(f.music.inspect().playing,'lofi');f.dispose();
});
test('hidden and pagehide changes stay silent, then resume only latest choice',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.choose('raisingMusic','lofi');await settle();assert.equal(f.music.inspect().voices,0);f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await settle();f.finishFades();assert.equal(f.music.inspect().playing,'lofi');f.win.emit('pagehide');f.choose('raisingMusic','moon');await settle();assert.equal(f.music.inspect().voices,0);f.win.emit('pageshow');await settle();f.finishFades();assert.equal(f.music.inspect().playing,'moon');f.dispose();
});
test('late resume cannot make hidden or muted music audible',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.delay(true);f.doc.visibilityState='visible';f.doc.emit('visibilitychange');assert.equal(f.pending.length,1);f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.pending.shift()();await settle();assert.equal(f.music.inspect().voices,0);f.doc.visibilityState='visible';f.doc.emit('visibilitychange');f.bus.setLevels({muted:true});f.music.preferencesChanged();f.pending.shift()();await settle();assert.equal(f.music.inspect().voices,0);f.dispose();
});
test('rapid delayed selection cannot let stale streams win or allocate a third slot',async()=>{
 const f=fixture({delayed:true});f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');const old=f.pending.shift();f.choose('raisingMusic','lofi');const second=f.pending.shift();f.choose('raisingMusic','moon');const last=f.pending.shift();old();second();await settle();assert.equal(f.music.inspect().playing,null);last();await settle();assert.equal(f.music.inspect().playing,'moon');f.choose('raisingMusic','lofi');f.pending.shift()();await settle();f.finishFades();assert.equal(f.music.inspect().playing,'lofi');assert.equal(f.music.inspect().voices,1);assert.ok(f.media.length<=2);f.dispose();
});
test('arena normal/final calls share choice, preserve once-only results and clear on exit',async()=>{
 const f=fixture();f.choose('battleMusic','battle_final');f.music.setScene('battle_normal','arena:1');f.doc.emit('pointerdown');await settle();assert.equal(f.music.inspect().playing,'battle_final');const starts=f.music.inspect().starts;f.music.setScene('battle_final','arena:1');await settle();assert.equal(f.music.inspect().starts,starts);f.music.setScene('victory','arena-result:1');await settle();assert.equal(f.music.inspect().playing,'victory');f.choose('battleMusic','battle_normal');await settle();assert.equal(f.music.inspect().playing,'victory');f.finishFades();f.media.find(m=>m.src.includes('victory')).onended();f.music.preferencesChanged();await settle();assert.equal(f.music.inspect().playing,null);f.music.setScene('moon',null,'raising');await settle();assert.equal(f.music.inspect().playing,'a_quiet_evening_training');f.dispose();
});
test('settings use native radio groups and literal localized titles without relabeling SFX preview as BGM',()=>{
 const s=fs.readFileSync(new URL('../src/championship/app/settings/settingsPanel.js',import.meta.url),'utf8');assert.match(s,/radioGroup\("raisingMusic"/);assert.match(s,/radioGroup\("battleMusic"/);assert.match(s,/if \(choice\.literal\) name\.textContent = choice\.name/);assert.match(s,/musicTrackTitle\(track\.id, store\.get\(\)\.locale\)/);assert.match(s,/MUSIC_TEST_SFX/);
});
test('new original MP3 bytes and scene assignments match the verified import manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets/production/scene-music-r1/manifest.json',import.meta.url)));
 assert.equal(manifest.files.length,10);assert.equal(SCENE_MUSIC_TRACKS.length,24);
 for(const file of manifest.files){
  const data=fs.readFileSync(new URL(`../assets/production/scene-music-r1/${file.path}`,import.meta.url));
  assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);
  assert.deepEqual(ORIGINAL_MUSIC_CUES[file.id],manifest.cues[file.id]);
  assert.ok(musicChoicesForScene(file.category).some(t=>t.id===file.id));
  assert.equal(musicTrackTitle(file.id,'zh-Hant'),file.titles.zh);assert.equal(musicTrackTitle(file.id,'ja'),file.titles.en);
  assert.ok(file.measuredIntegratedLufs+file.playbackGainDb<=-23.9);assert.ok(file.measuredTruePeakDbtp+file.playbackGainDb<=-2);
 }
});
for(const [scene,id]of [['raising','a_quiet_evening_training'],['battle','unison_under_fire'],['battle','federation_siege']])test(`new ${scene} track ${id} is selected lazily, loops, and restores its original scene`,async()=>{
 const f=fixture();f.choose(scene+'Music',id);const source=scene==='raising'?'moon':'battle_normal';f.music.setScene(source,null,scene);assert.equal(f.media.length,0);f.doc.emit('pointerdown');await settle();
 assert.equal(f.music.inspect().playing,id);assert.ok(f.media[0].src.endsWith(`/${scene}/${id}.mp3`));assert.equal(f.media[0].volume,1);
 f.media[0].currentTime=59.3;f.media[0].duration=60;f.media[0].ontimeupdate();await settle();f.finishFades();assert.equal(f.music.inspect().playing,id);assert.equal(f.music.inspect().voices,1);assert.equal(f.music.inspect().starts,2);
 f.choose(scene+'Music','default');await settle();f.finishFades();assert.equal(f.music.inspect().playing,scene==='raising'?'a_quiet_evening_training':source);f.dispose();
});
test('failed selected stream is released and a subsequent valid selection recovers without overlap',async()=>{
 const f=fixture();f.choose('raisingMusic','a_quiet_evening_training');f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();const a=f.media[0];a.error={code:2};a.onerror();assert.equal(f.music.inspect().voices,0);assert.equal(a.src,'');assert.equal(a.oncanplaythrough,null);f.choose('raisingMusic','moon');await settle();f.finishFades();assert.equal(f.music.inspect().playing,'moon');assert.equal(f.music.inspect().voices,1);assert.equal(f.music.inspect().error,null);f.dispose();
});
test('dispose releases all streams and detaches lifecycle listeners',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();f.choose('raisingMusic','a_quiet_evening_training');await settle();f.dispose();assert.equal(f.music.inspect().voices,0);assert.ok(f.media.every(m=>m.src===''));for(const handlers of [...f.doc.listeners.values(),...f.win.listeners.values()])assert.equal(handlers.length,0);assert.equal(f.timers.size,0);
});
test('same effective cue publishes changed scene metadata without allocating or restarting audio',()=>{
 const states=[];const bus={levels:()=>({muted:false,masterVolume:100,musicVolume:100}),resume(){}};
 const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,doc:null,win:null,onState:s=>states.push(s)});
 music.setScene('moon',null,'raising');music.setScene('moon');assert.equal(states.at(-1).scene,null);assert.equal(states.at(-1).requestedCue,'moon');assert.equal(states.at(-1).starts,0);assert.equal(states.at(-1).slots,0);
 const count=states.length;music.setScene('moon');assert.equal(states.length,count,'identical repeated routing is still a no-op');music.dispose();
});
