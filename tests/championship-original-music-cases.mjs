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
  const doc=new Events(),win=new Events(),media=[],pending=[],timers=new Map();let contexts=0,timerId=0,contextRef;
  class Context {state='running';currentTime=0;destination={};constructor(){contexts++;contextRef=this;}createGain(){return node();}createMediaElementSource(){return node();}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}}
  class Media {paused=true;currentTime=0;duration=32;src='';plays=0;constructor(){media.push(this);}canPlayType(){return ogg?'probably':'';}load(){}removeAttribute(){this.src='';}pause(){this.paused=true;}play(){this.plays++;if(delayed)return new Promise(resolve=>pending.push(()=>{this.paused=false;resolve();}));this.paused=false;return Promise.resolve();}}
  const bus=createAudioBus({AudioContextClass:Context,eventTarget:doc,levels:{muted}});
  const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,baseUrl:'https://example.test/game/',doc,win,AudioClass:Media,timers:{setTimeout(f){timers.set(++timerId,f);return timerId;},clearTimeout(id){timers.delete(id);}}});
  return{bus,music,doc,win,media,pending,timers,contexts:()=>contexts,finishFades(){contextRef.currentTime+=1;for(const [id,f]of [...timers]){timers.delete(id);f();}}};
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
  const f=fixture({muted:true});f.music.setScene('battle_final');f.doc.emit('pointerdown');await settle();assert.equal(f.media.length,0);
  f.bus.setLevels({muted:false});f.music.preferencesChanged();await settle();assert.equal(f.media[0].loop,true);
  f.music.setScene('victory','battle:42');await settle();const result=f.media.find(m=>m.src.includes('victory'));assert.equal(result.loop,false);f.finishFades();result.onended();assert.equal(f.music.inspect().playing,null);
  const starts=f.music.inspect().starts;f.music.setScene('victory','battle:42');f.music.setScene('core');await settle();f.music.setScene('victory','battle:42');await settle();assert.equal(f.music.inspect().starts,starts+1);assert.equal(f.music.inspect().playing,null);
  f.music.setScene('defeat','battle:42');await settle();assert.equal(f.music.inspect().starts,starts+1,'even a changed projection cannot judge one attempt twice');
  f.music.setScene('defeat','battle:43');await settle();assert.equal(f.music.inspect().playing,'defeat');f.music.dispose();
});

test('route mapping uses canonical biome, championship last round, outcome and attempt identity',()=>{
  assert.deepEqual(selectOriginalMusic({titleVisible:true}),{id:'login'});assert.deepEqual(selectOriginalMusic({titleVisible:true,openingVisible:true}),{id:'hexagon_cradles'});
  for(const screen of ['RAISING_HOME','SHOP','DATABASE','MEDALS','CAGE_EDIT','DIGIMON_LIST','SCHEDULE','HELP','TAMER_INFO','GATE_SELECT','HUNT_LOADOUT','BATTLE_SELECT','CHAMPIONSHIP'])assert.ok(selectOriginalMusic({screen}).id,screen);
  assert.equal(selectOriginalMusic({screen:'HUNT_FIELD',biome:'Factory'}).id,'forge');assert.equal(selectOriginalMusic({screen:'HUNT_FIELD',biome:'Ice'}).id,'moon');// Owner 2026-11-02: one cue from the New Game story through every tutorial screen; a tutorial battle result keeps its sting.
  for(const screen of ['RAISING_HOME','GATE_SELECT','HUNT_LOADOUT','HUNT_FIELD','HUNT_RESULT','BATTLE_SELECT','BATTLE_FIELD'])assert.equal(selectOriginalMusic({screen,tutorial:true,biome:'Factory'}).id,'hexagon_cradles',screen);
  assert.deepEqual(selectOriginalMusic({screen:'BATTLE_RESULT',tutorial:true,outcome:{ended:true,winningTeam:0},attemptId:'tutorial:1'}),{id:'victory',attemptId:'tutorial:1'});
  assert.equal(selectOriginalMusic({screen:'RAISING_HOME',tutorial:false}).id,'moon');
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

test('shop plays Lucky Draw Counter; its 0-8 s intro plays once and every loop pass resumes on the 8 s downbeat',async()=>{
  assert.equal(selectOriginalMusic({screen:'SHOP'}).id,'lucky_draw_counter');
  const cue=ORIGINAL_MUSIC_CUES.lucky_draw_counter;assert.equal(cue.loopStart,8);assert.equal(57-cue.trimEnd-cue.crossfade,56,'loop hands off at 56.0 s, exactly 24 bars at 120 BPM after 8.0 s');
  const f=fixture();f.music.setScene('lucky_draw_counter');f.doc.emit('pointerdown');await settle();
  const a=f.media[0];assert.match(a.src,/original-music-r1\/bgm_lucky_draw_counter\.mp3$/);assert.equal(a.loop,false);a.onloadedmetadata();assert.equal(a.currentTime,0,'first entry plays the intro');
  // A seek past the hand-off restarts without a prepared slot.
  a.duration=57;a.currentTime=56.2;a.ontimeupdate();await settle();const b=f.media[1];b.onloadedmetadata();assert.equal(b.currentTime,8);assert.equal(f.music.inspect().starts,2);
  // The normal path prepares the next pass ahead of the hand-off.
  f.finishFades();b.duration=57;b.readyState=1;b.currentTime=54;b.ontimeupdate();a.onloadedmetadata();assert.equal(a.currentTime,8);a.readyState=1;a.currentTime=3;
  b.currentTime=56;b.ontimeupdate();await settle();assert.equal(f.music.inspect().starts,3);assert.equal(a.currentTime,8);assert.equal(f.media.length,2);
  f.music.dispose();f.bus.dispose();
});

test('hunt gate select, hunt loadout and battle select play Sweetest Level Up; loop passes resume at 68.8 s after the first full pass',async()=>{
  for(const screen of ['GATE_SELECT','HUNT_LOADOUT','BATTLE_SELECT'])assert.equal(selectOriginalMusic({screen}).id,'sweetest_level_up',screen);
  assert.equal(selectOriginalMusic({screen:'HUNT_FIELD',biome:'Seaside'}).id,'harbor');
  const cue=ORIGINAL_MUSIC_CUES.sweetest_level_up;assert.equal(cue.loopStart,68.8);
  assert.ok(Math.abs(120.8-cue.trimEnd-cue.crossfade-120)<1e-9,'hands off at 120.0 s');assert.ok(Math.abs(120-cue.loopStart-51.2)<1e-9,'32 bars at 150 BPM');
  const f=fixture();f.music.setScene('sweetest_level_up');f.doc.emit('pointerdown');await settle();
  const a=f.media[0];assert.match(a.src,/original-music-r1\/bgm_sweetest_level_up\.mp3$/);a.onloadedmetadata();assert.equal(a.currentTime,0);
  a.duration=120.8;a.currentTime=120.05;a.ontimeupdate();await settle();const b=f.media[1];b.onloadedmetadata();assert.equal(b.currentTime,68.8);assert.equal(f.music.inspect().starts,2);
  f.music.dispose();f.bus.dispose();
});
