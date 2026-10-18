import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioBus} from '../src/championship/presentation/audioBus.js';
import {createMusicPresentation} from '../src/championship/presentation/musicPresentation.js';
import {ORIGINAL_MUSIC_CUES,selectOriginalMusic,selectDataArenaMusic} from '../src/championship/presentation/originalMusicCatalog.js';
import {resolveSceneMusic} from '../src/championship/presentation/sceneMusicCatalog.js';
import {normalizePreferences} from '../src/championship/app/settings/preferenceSchema.js';

class Events {visibilityState='visible';listeners=new Map();addEventListener(t,f){this.listeners.set(t,[...(this.listeners.get(t)??[]),f]);}removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)??[]).filter(x=>x!==f));}emit(t){for(const f of this.listeners.get(t)??[])f({isTrusted:true});}}
const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
const node=()=>({gain:param(),connect(){},disconnect(){}});
const settle=async()=>{for(let n=0;n<5;n++)await Promise.resolve();};
function fixture(){
 const doc=new Events(),win=new Events(),media=[],contexts=[];
 class Context {state='running';sampleRate=48000;currentTime=0;destination={};resumes=0;constructor(){contexts.push(this);}createGain(){return node();}createMediaElementSource(){return node();}resume(){this.resumes++;this.state='running';return Promise.resolve();}close(){return Promise.resolve();}}
 class Media {paused=true;currentTime=0;duration=133;src='';preservesPitch=true;webkitPreservesPitch=true;plays=0;constructor(){media.push(this);}load(){}removeAttribute(){this.src='';}pause(){this.paused=true;}play(){this.plays++;this.paused=false;return Promise.resolve();}}
 const bus=createAudioBus({AudioContextClass:Context,eventTarget:doc,levels:{masterVolume:80,musicVolume:40}});
 const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,doc,win,AudioClass:Media,baseUrl:'https://example.test/',resolveCue:(id,scene)=>resolveSceneMusic(id,scene,{})});
 return {bus,music,doc,win,media,contexts,dispose(){music.dispose();bus.dispose();}};
}
test('missing, invalid, explicit default and tutorial raising use Quiet Evening; explicit player choices persist',()=>{
 for(const input of [{},{raisingMusic:'default'},{raisingMusic:'stale'},{raisingMusic:'victory'}]){
  const prefs=normalizePreferences(input);
  for(const screen of ['RAISING_HOME','CAGE_EDIT'])for(const tutorial of [false,true])assert.equal(resolveSceneMusic(selectOriginalMusic({screen,tutorial}).id,'raising',prefs),'a_quiet_evening_training');
 }
 for(const id of ['moon','lofi','a_quiet_evening_training'])assert.equal(resolveSceneMusic('moon','raising',{raisingMusic:id}),id);
 for(const id of ['login','core','moon','harbor','victory','defeat','draw',null])assert.equal(resolveSceneMusic(id,null,{}),id);
});
test('all ordinary battle types use actual field identity and preserve result stingers and fallback fields',()=>{
 assert.equal(selectDataArenaMusic('HARBOR'),'unison_under_fire');
 assert.equal(selectDataArenaMusic('TOURNAMENT'),'federation_siege');
 assert.equal(selectDataArenaMusic('UNKNOWN'),'battle_normal');
 for(const [arenaIndex,id] of [[3,'titan_s_final_strike'],[4,'south_pole_siege'],[5,'mirage_of_the_arena'],[7,'inferno_overdrive']]){
  for(const type of ['freeBattle','practice','password','link'])assert.equal(selectOriginalMusic({screen:'BATTLE_FIELD',chosen:{arenaIndex,[type]:true}}).id,id);
  assert.equal(resolveSceneMusic(id,null,{battleMusic:'federation_siege'}),'federation_siege');
 }
 for(const arenaIndex of [0,1,2,6,8,9,10])assert.equal(selectOriginalMusic({screen:'BATTLE_FIELD',chosen:{arenaIndex}}).id,'battle_normal');
 assert.equal(selectOriginalMusic({screen:'BATTLE_FIELD',chosen:{championship:true,arenaIndex:4,cursor:2,totalRounds:3}}).id,'battle_final');
 assert.equal(selectOriginalMusic({screen:'BATTLE_RESULT',outcome:{ended:true,winningTeam:0},attemptId:1}).id,'victory');
});
test('repeated background/page cache returns keep rate, pitch, gains, context and one source stable',async()=>{
 const f=fixture();f.music.setScene('moon',null,'raising');f.doc.emit('pointerdown');await settle();
 const a=f.media[0],context=f.contexts[0];a.currentTime=28;
 const gain=f.bus.gains();
 for(let n=0;n<12;n++){
  f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.win.emit('pagehide');assert.equal(f.music.inspect().voices,0);
  context.state=n%2?'suspended':'interrupted';a.playbackRate=.92;a.defaultPlaybackRate=1.07;a.preservesPitch=false;a.webkitPreservesPitch=false;
  f.doc.visibilityState='visible';f.win.emit('pageshow');f.doc.emit('visibilitychange');await settle();
  assert.equal(f.music.inspect().voices,1);assert.equal(a.playbackRate,1);assert.equal(a.defaultPlaybackRate,1);assert.equal(a.preservesPitch,true);assert.equal(a.webkitPreservesPitch,true);
  assert.equal(context.state,'running');assert.equal(context.sampleRate,48000);assert.equal(a.currentTime,28);assert.deepEqual(f.bus.gains(),gain);
 }
 assert.equal(f.contexts.length,1);assert.equal(f.media.length,1);assert.equal(f.music.inspect().starts,1);f.dispose();
});
test('visible interrupted graph resumes even when native media still reports playing',async()=>{
 const f=fixture();f.music.setScene('login');f.doc.emit('pointerdown');await settle();const a=f.media[0],context=f.contexts[0],plays=a.plays;
 context.state='interrupted';f.win.emit('pageshow');await settle();assert.equal(context.state,'running');assert.equal(a.plays,plays);assert.equal(f.music.inspect().voices,1);f.dispose();
});
