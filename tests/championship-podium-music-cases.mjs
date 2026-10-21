import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAudioBus} from '../src/championship/presentation/audioBus.js';
import {createMusicPresentation} from '../src/championship/presentation/musicPresentation.js';
import {ORIGINAL_MUSIC_CUES,selectOriginalMusic} from '../src/championship/presentation/originalMusicCatalog.js';
import {resolveSceneMusic} from '../src/championship/presentation/sceneMusicCatalog.js';
import {playCeremonyCue} from '../src/championship/presentation/ceremony/ceremonyAudio.js';

const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
class Events {visibilityState='visible';listeners=new Map();addEventListener(t,f){this.listeners.set(t,[...(this.listeners.get(t)??[]),f]);}removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)??[]).filter(x=>x!==f));}emit(t){for(const f of this.listeners.get(t)??[])f({isTrusted:true});}}
function param(){return {value:1,events:[],cancelScheduledValues(t){this.events.push(['cancel',t]);},setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);},exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['exp',v,t]);},setTargetAtTime(v,t){this.value=v;this.events.push(['target',v,t]);}};}
function fixture(){
 const doc=new Events(),win=new Events(),media=[],contexts=[],timers=new Map(),promises=[];let sequence=0,delay=false;
 class Context {
  currentTime=0;state='running';sampleRate=44100;destination={};gains=[];sources=[];listeners=new Set();
  constructor(){contexts.push(this);}createGain(){const n={gain:param(),connect(){},disconnect(){}};this.gains.push(n);return n;}
  createMediaElementSource(){return {connect(){},disconnect(){}};}
  createOscillator(){const n={frequency:param(),connect(){},disconnect(){},start(){},stop(){}};this.sources.push(n);return n;}
  createBufferSource(){return this.createOscillator();}createBuffer(_c,n){return {getChannelData:()=>new Float32Array(n)};}createBiquadFilter(){return {frequency:param(),Q:param(),connect(){},disconnect(){}};}
  addEventListener(type,fn){if(type==='statechange')this.listeners.add(fn);}removeEventListener(type,fn){this.listeners.delete(fn);}changeState(value){this.state=value;for(const fn of this.listeners)fn();}
  resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 }
 class Media {
  paused=true;currentTime=0;duration=60;readyState=4;src='';loads=0;plays=0;buffered={length:1,end:()=>60};
  constructor(){media.push(this);}canPlayType(){return 'probably';}load(){this.loads++;if(this.src)this.onloadedmetadata?.();}removeAttribute(){this.src='';}pause(){this.paused=true;}
  play(){this.plays++;if(delay)return new Promise((resolve,reject)=>promises.push({resolve:()=>{if(this.src)this.paused=false;resolve();},reject}));this.paused=false;return Promise.resolve();}
 }
 const bus=createAudioBus({AudioContextClass:Context,eventTarget:doc});
 const music=createMusicPresentation({bus,cues:ORIGINAL_MUSIC_CUES,AudioClass:Media,baseUrl:'https://example.test/',doc,win,timers:{setTimeout(fn,ms){timers.set(++sequence,{fn,ms});return sequence;},clearTimeout(id){timers.delete(id);}}});
 return {doc,win,media,contexts,timers,promises,bus,music,delay(value){delay=value;},fire(){for(const [id,t] of [...timers]){if(timers.delete(id))t.fn();}},async start(id='podium_geometry'){music.setScene(id);doc.emit('pointerdown');await flush();},dispose(){music.dispose();bus.dispose();}};
}

test('field setup uses the exact new file while home/tutorial defaults and explicit choices remain intact',()=>{
 for(const tutorial of [false,true]){
  assert.equal(resolveSceneMusic(selectOriginalMusic({screen:'CAGE_EDIT',tutorial}).id,'raising',{}),'podium_geometry');
  assert.equal(resolveSceneMusic(selectOriginalMusic({screen:'RAISING_HOME',tutorial}).id,'raising',{}),'a_quiet_evening_training');
 }
 assert.equal(resolveSceneMusic('podium_geometry','raising',{raisingMusic:'moon'}),'moon');
 const source=JSON.parse(fs.readFileSync(new URL('../docs/reports/podium-music-2026-10-18/SOURCE_AND_MEASUREMENTS.json',import.meta.url)));
 const bytes=fs.readFileSync(new URL('../assets/production/scene-music-r1/system/podium_geometry.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.runtime?.sha256??source.measurement.sha256);assert.equal(bytes.length,source.runtime?.bytes??1442442);
 assert.equal(source.measurement.bytes,1442442);assert.equal(source.measurement.sha256,'f149580019ec9fd123b52e7fc0824cd6612874a5571e5632995d77531edbeb12');
 assert.equal(source.bpm,null);assert.equal(source.loopStartSeconds,0);assert.ok(source.loopEndSeconds>59&&source.loopEndSeconds<60);
 assert.equal(source.listeningAccepted,false);assert.ok(source.measurement.truePeakDbtp+ORIGINAL_MUSIC_CUES.podium_geometry.gainDb<=-3);
 const old=JSON.parse(fs.readFileSync(new URL('../docs/reports/music-repair-2026-10-18/NINE_TRACK_LEDGER.json',import.meta.url)));
 assert.equal(old.files.length,9);for(const row of old.files){const b=fs.readFileSync(new URL('../'+row.runtimePath,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256);}
});

test('loop preparation stays paused and zero-gain, reuses the second stream and obeys the audio clock',async()=>{
 const f=fixture();try{await f.start();const a=f.media[0],ctx=f.contexts[0];a.currentTime=57.5;ctx.currentTime=10;a.ontimeupdate();
 assert.equal(f.music.inspect().prepared,'podium_geometry');assert.equal(f.media.length,2);const next=f.media[1],loads=next.loads;
 assert.equal(next.paused,true);assert.equal(next.plays,0);ctx.state='interrupted';f.fire();await flush();assert.equal(f.music.inspect().starts,1);
 f.win.emit('pageshow');await flush();a.currentTime=59.3;ctx.currentTime=12;a.ontimeupdate();await flush();
 assert.equal(f.music.inspect().starts,2);assert.equal(next.loads,loads,'prepared MP3 is not reloaded at its seam');assert.equal(f.media.length,2);
 ctx.currentTime=13;f.fire();await flush();assert.equal(f.music.inspect().voices,1);
 }finally{f.dispose();}
});

test('a JS cleanup wake cannot retire an audible tail before the audio-clock fade ends',async()=>{
 const f=fixture();try{await f.start('login');f.music.setScene('podium_geometry');await flush();assert.equal(f.music.inspect().voices,2);
 const ctx=f.contexts[0];ctx.state='suspended';f.fire();assert.equal(f.music.inspect().voices,2);ctx.state='running';ctx.currentTime=.3;f.fire();assert.equal(f.music.inspect().voices,2);
 ctx.currentTime=1;f.fire();assert.equal(f.music.inspect().voices,1);
 }finally{f.dispose();}
});

test('native AudioContext interruptions pause the stream and rearm once on state recovery',async()=>{
 const f=fixture();try{await f.start();const ctx=f.contexts[0],a=f.media[0];a.currentTime=22;
 for(let i=0;i<8;i++){
  ctx.changeState(i%2?'suspended':'interrupted');assert.equal(a.paused,true);assert.equal(f.timers.size,0);
  ctx.changeState('running');await flush();assert.equal(a.paused,false);assert.equal(a.currentTime,22);assert.equal(a.playbackRate,1);
 }
 assert.equal(f.music.inspect().starts,1);assert.equal(f.contexts.length,1);assert.equal(ctx.listeners.size,1);
 }finally{f.dispose();assert.equal(f.contexts[0].listeners.size,0);}
});

test('a failed replacement retains the prior stream and an explicit retry can recover',async()=>{
 const f=fixture();try{await f.start('login');f.delay(true);f.music.setScene('podium_geometry');f.promises.shift().reject(Error('NETWORK'));await flush();
 assert.equal(f.music.inspect().playing,'login');assert.equal(f.music.inspect().retryable,true);assert.equal(f.music.retry(),true);assert.equal(f.music.retry(),false);
 f.promises.shift().resolve();await flush();assert.equal(f.music.inspect().playing,'podium_geometry');f.contexts[0].currentTime=1;f.fire();assert.equal(f.music.inspect().voices,1);
 }finally{f.dispose();}
});

test('a rejected native resume can retry through trusted input without losing position or retaining a stale error',async()=>{
 const f=fixture();try{await f.start();const a=f.media[0];a.currentTime=19;f.win.emit('pagehide');f.delay(true);f.win.emit('pageshow');
 f.promises.shift().reject(Error('AUTOPLAY'));await flush();assert.equal(f.music.inspect().retryable,true);
 f.doc.emit('pointerdown');f.promises.shift().resolve();await flush();assert.equal(a.currentTime,19);assert.equal(f.music.inspect().error,null);assert.equal(f.music.inspect().retryable,false);assert.equal(f.music.inspect().starts,1);
 }finally{f.dispose();}
});

test('hidden, mute and disposal cancel loop preparations and stale wake callbacks cannot restart sound',async()=>{
 const f=fixture();await f.start();const a=f.media[0];a.currentTime=58;a.ontimeupdate();const stale=[...f.timers.values()].map(t=>t.fn);
 f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');for(const fn of stale)fn();assert.equal(f.music.inspect().voices,0);assert.equal(f.music.inspect().prepared,null);assert.equal(f.timers.size,0);
 f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await flush();f.bus.setLevels({muted:true,musicVolume:20});f.music.preferencesChanged();assert.equal(f.music.inspect().voices,0);assert.equal(f.music.retry(),false);
 f.dispose();for(const fn of stale)fn();assert.equal(f.timers.size,0);assert.equal(f.music.inspect().voices,0);assert.ok(f.media.every(m=>m.src===''));
});

test('duck leases use one audio-clock envelope, preserve preferences and release overlapping major effects safely',async()=>{
 const f=fixture();try{await f.start();const ctx=f.contexts[0],duck=ctx.gains[2].gain;const levels=f.bus.levels();
 const releaseA=f.bus.output('sfx').duckMusic({seconds:1.2});assert.equal(typeof releaseA,'function');
 assert.ok(duck.events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-10**(-4/20))<1e-10&&e[2]===.025));
 ctx.currentTime=.5;const releaseB=f.bus.duckMusic({seconds:2});releaseA();assert.deepEqual(duck.events.at(-1),['ramp',1,2.8]);
 ctx.currentTime=.7;releaseB();assert.deepEqual(duck.events.at(-1),['ramp',1,.8999999999999999]);assert.deepEqual(f.bus.levels(),levels);
 f.bus.setLevels({muted:true});assert.equal(f.bus.duckMusic(),null);
 }finally{f.dispose();}
});

test('only existing medal, evolve and versus event cues request modest BGM ducking',async()=>{
 const f=fixture();try{await f.start();const output=f.bus.output('sfx'),names=[];
 for(const name of ['gate','capture','reward','medal','evolve','versus']){
  const before=names.length,run=playCeremonyCue(name,{...output,duckMusic(options){names.push({name,seconds:options.seconds});return ()=>{};}});
  assert.ok(run);assert.equal(names.length-before,['medal','evolve','versus'].includes(name)?1:0);run.stop();
 }
 assert.ok(names.every(n=>n.seconds>0&&n.seconds<3));
 }finally{f.dispose();}
});
