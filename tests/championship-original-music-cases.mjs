import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicPresentation} from '../src/championship/presentation/musicPresentation.js';
import {ORIGINAL_MUSIC_CUES,selectOriginalMusic} from '../src/championship/presentation/originalMusicCatalog.js';
import {createAudioBus,effectiveGain} from '../src/championship/presentation/audioBus.js';
import {normalizePreferences,DEFAULT_PREFERENCES} from '../src/championship/app/settings/preferenceSchema.js';

class Events {
  listeners=new Map();visibilityState='visible';
  addEventListener(t,f){const a=this.listeners.get(t)??[];a.push(f);this.listeners.set(t,a);}
  removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)??[]).filter(x=>x!==f));}
  emit(t){for(const f of this.listeners.get(t)??[])f({isTrusted:true});}
}
const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
const node=()=>({gain:param(),connect(){},disconnect(){}});
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture({muted=false,delayed=false,ogg=true}={}){
  const doc=new Events(),win=new Events(),media=[],pending=[],timers=new Map();let contexts=0,timerId=0;
  class Context {state='running';currentTime=0;destination={};constructor(){contexts++;}createGain(){return node();}createMediaElementSource(){return node();}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
  class Media {paused=true;currentTime=0;duration=32;src='';plays=0;constructor(){media.push(this);}canPlayType(){return ogg?'probably':'';}load(){}removeAttribute(){this.src='';}pause(){this.paused=true;}play(){this.plays++;if(delayed)return new Promise(resolve=>pending.push(()=>{this.paused=false;resolve();}));this.paused=false;return Promise.resolve();}}
  const bus=createAudioBus({AudioContextClass:Context,eventTarget:doc,levels:{muted}});
  const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,baseUrl:'https://example.test/game/',doc,win,AudioClass:Media,timers:{setTimeout(f){timers.set(++timerId,f);return timerId;},clearTimeout(id){timers.delete(id);}}});
  return{bus,music,doc,win,media,pending,timers,contexts:()=>contexts,finishFades(){for(const [id,f]of [...timers]){timers.delete(id);f();}}};
}

test('music waits for a gesture, streams only the selected cue, and uses the shared bus',async()=>{
  const f=fixture();f.music.setScene('login');assert.equal(f.contexts(),0);assert.equal(f.media.length,0);
  f.doc.emit('pointerdown');await settle();assert.equal(f.music.inspect().playing,'login');assert.equal(f.contexts(),1);assert.equal(f.media.length,1);
  const first=f.media[0];first.currentTime=19;f.music.setScene('login');f.doc.emit('pointerdown');await settle();assert.equal(first.plays,1);assert.equal(first.currentTime,19);
  f.music.setScene('moon');await settle();assert.equal(f.music.inspect().voices,2);f.finishFades();assert.equal(f.music.inspect().voices,1);assert.equal(f.media.length,2);assert.equal(f.contexts(),1);
  f.music.dispose();f.bus.dispose();
});

test('rapid route changes cancel stale resources and never allocate a third music source',async()=>{
  const f=fixture({delayed:true});f.music.setScene('login');f.doc.emit('pointerdown');const old=f.pending.shift();f.music.setScene('moon');const latest=f.pending.shift();old();await settle();assert.equal(f.music.inspect().playing,null);latest();await settle();assert.equal(f.music.inspect().playing,'moon');
  f.music.setScene('plains');f.pending.shift()();await settle();f.music.setScene('forge');f.pending.shift()();await settle();assert.ok(f.music.inspect().voices<=2);assert.equal(f.media.length,2);f.finishFades();assert.equal(f.music.inspect().playing,'forge');f.music.dispose();
});

test('background and mute pause at the existing position; loop crossfade still works after resume',async()=>{
  const f=fixture();f.music.setScene('login');f.doc.emit('pointerdown');await settle();const a=f.media[0];a.currentTime=21;
  f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');assert.equal(a.paused,true);assert.equal(f.music.inspect().voices,0);
  f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await settle();assert.equal(a.currentTime,21);assert.equal(a.paused,false);
  f.bus.setLevels({muted:true});f.music.preferencesChanged();assert.equal(a.paused,true);f.bus.setLevels({muted:false,musicVolume:50,masterVolume:80});f.music.preferencesChanged();await settle();assert.equal(f.bus.gains().musicEffective,.4);
  a.duration=60;a.currentTime=59;a.ontimeupdate();await settle();assert.equal(f.music.inspect().starts,2);assert.ok(f.music.inspect().voices<=2);f.music.dispose();
});

test('saved mute prevents first audio fetch; result cue plays once per actual attempt and never loops',async()=>{
  const f=fixture({muted:true});f.music.setScene('battle_normal');f.doc.emit('pointerdown');await settle();assert.equal(f.media.length,0);
  f.bus.setLevels({muted:false});f.music.preferencesChanged();await settle();assert.equal(f.media[0].loop,true);
  f.music.setScene('victory','battle:42');await settle();const result=f.media.find(m=>m.src.includes('victory'));assert.equal(result.loop,false);f.finishFades();result.onended();assert.equal(f.music.inspect().playing,null);
  const starts=f.music.inspect().starts;f.music.setScene('victory','battle:42');f.music.setScene('core');await settle();f.music.setScene('victory','battle:42');await settle();assert.equal(f.music.inspect().starts,starts+1);assert.equal(f.music.inspect().playing,null);
  f.music.setScene('defeat','battle:42');await settle();assert.equal(f.music.inspect().starts,starts+1,'even a changed projection cannot judge one attempt twice');
  f.music.setScene('defeat','battle:43');await settle();assert.equal(f.music.inspect().playing,'defeat');f.music.dispose();
});

test('route mapping uses canonical biome, championship last round, outcome and attempt identity',()=>{
  assert.deepEqual(selectOriginalMusic({titleVisible:true}),{id:'login'});assert.deepEqual(selectOriginalMusic({titleVisible:true,openingVisible:true}),{id:'lofi'});
  for(const screen of ['RAISING_HOME','SHOP','DATABASE','MEDALS','CAGE_EDIT','DIGIMON_LIST','SCHEDULE','HELP','TAMER_INFO','GATE_SELECT','HUNT_LOADOUT','BATTLE_SELECT','CHAMPIONSHIP'])assert.ok(selectOriginalMusic({screen}).id,screen);
  assert.equal(selectOriginalMusic({screen:'HUNT_FIELD',biome:'Factory'}).id,'forge');assert.equal(selectOriginalMusic({screen:'HUNT_FIELD',biome:'Ice'}).id,'moon');assert.equal(selectOriginalMusic({screen:'RAISING_HOME',tutorial:true}).id,'lofi');
  assert.equal(selectOriginalMusic({screen:'BATTLE_FIELD',chosen:{practice:true,cursor:2,totalRounds:3}}).id,'battle_normal');assert.equal(selectOriginalMusic({screen:'BATTLE_FIELD',chosen:{championship:true,cursor:2,totalRounds:3}}).id,'battle_final');
  for(const [winningTeam,id]of [[0,'victory'],[1,'defeat'],[null,'draw']])assert.deepEqual(selectOriginalMusic({screen:'BATTLE_RESULT',outcome:{ended:true,winningTeam},attemptId:'battle:3'}),{id,attemptId:'battle:3'});
  assert.equal(selectOriginalMusic({screen:'BATTLE_RESULT',outcome:{ended:true,winningTeam:0}}).id,null);
});

test('music level is independent of SFX and defaults safely for an older preference document',()=>{
  assert.equal(DEFAULT_PREFERENCES.musicVolume,100);assert.equal(effectiveGain({masterVolume:80,musicVolume:25,sfxVolume:90},'music'),.2);
  assert.equal(normalizePreferences({masterVolume:60,sfxVolume:30}).musicVolume,100);
  assert.equal(effectiveGain({muted:true,musicVolume:100},'music'),0);
});

test('a browser without OGG support loads the same combat cue through its AAC encoding',async()=>{
  const f=fixture({ogg:false});f.music.setScene('battle_final');f.doc.emit('pointerdown');await settle();assert.ok(f.media[0].src.endsWith('championship_battle_final_r1.m4a'));assert.equal(f.media[0].loop,true);f.music.dispose();
});

test('initial stream buffering ends at canplaythrough, releases on mute/error, and never prefetches other cues',async()=>{
  const f=fixture();f.music.setScene('login');assert.equal(f.music.inspect().initialBuffering,false);
  f.doc.emit('pointerdown');await settle();assert.equal(f.music.inspect().initialBuffering,true);
  const a=f.media[0];a.readyState=4;a.oncanplaythrough();assert.equal(f.music.inspect().initialBuffering,false);
  assert.equal(f.media.length,1);
  f.music.setScene('moon');await settle();assert.equal(f.music.inspect().initialBuffering,true);
  f.bus.setLevels({muted:true});f.music.preferencesChanged();assert.equal(f.music.inspect().initialBuffering,false);
  f.bus.setLevels({muted:false});f.music.preferencesChanged();await settle();
  const active=f.media.find(m=>m.src.includes('moon'));active.error={code:2};active.onerror();
  assert.equal(f.music.inspect().initialBuffering,false);assert.equal(active.oncanplaythrough,null);
  f.music.dispose();
});
