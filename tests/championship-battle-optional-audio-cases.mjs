import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountBattleAudioPresentation,BATTLE_AUDIO_MANIFEST,BATTLE_AUDIO_LOAD_CONCURRENCY} from '../src/championship/presentation/battleAudioPresentation.js';
import {observeBattleFirstRender} from '../src/championship/app/runtimeRecoveryDiagnostics.js';

const metadataPath='assets/production/public-runtime/battle-audio.render.v1.json';
const metadataText=readFileSync(metadataPath,'utf8'),manifest=JSON.parse(metadataText);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<40;i++)await new Promise(setImmediate);};
function audioFixture({fetchSound,decode,metadata,shared=false}={}){
  const view={nativeLifecycle:{sound:{events:[]}},outcome:{ended:false}},observers=new Set(),listeners=new Set(),contexts=[];
  const source={getView:()=>view,subscribe(fn){observers.add(fn);return()=>observers.delete(fn);}};
  class Context {
    state='running';destination={};currentTime=0;nodes=[];gains=[];closeCount=0;
    constructor(){contexts.push(this);}
    createGain(){const gain={gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){this.disconnected=true;}};this.gains.push(gain);return gain;}
    createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};this.nodes.push(node);return node;}
    async decodeAudioData(sound){return decode?decode(sound):{numberOfChannels:sound.channels,duration:sound.sampleFrames/sound.sampleRate};}
    async close(){this.closeCount++;this.state='closed';}
    async resume(){this.state='running';}
  }
  const calls=[],controller=new AbortController();
  const output=shared?{context:new Context(),destination:{}}:null;
  const fetchImpl=async(url,{signal}={})=>{
    const path=new URL(url).pathname.replace('/championship-2026/','');calls.push({path,signal});
    if(path===metadataPath)return metadata?metadata():{ok:true,text:async()=>metadataText};
    const sound=manifest.sounds.find(s=>s.src===path);assert.ok(sound,path);
    return fetchSound?fetchSound(sound,signal):{ok:true,arrayBuffer:async()=>sound};
  };
  const options={source,baseUrl:'https://orochi771127.github.io/championship-2026/championship.html',fetchImpl,
    AudioContextClass:Context,eventTarget:{addEventListener(name){listeners.add(name);},removeEventListener(name){listeners.delete(name);}},output,signal:controller.signal};
  return {view,source,observers,listeners,contexts,calls,controller,options,start:()=>mountBattleAudioPresentation(options)};
}

test('all 54 sounds remain available, with at most four concurrent requests and no new ticker',async()=>{
  let active=0,peak=0;
  const f=audioFixture({fetchSound:async sound=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {ok:true,arrayBuffer:async()=>sound};}});
  const audio=await f.start();assert.equal(peak,BATTLE_AUDIO_LOAD_CONCURRENCY);assert.equal(audio.getDiagnostics().loaded,54);
  assert.equal(f.calls.filter(c=>c.path.endsWith('.wav')).length,54);assert.equal(f.observers.size,1);
  await audio.dispose();await audio.dispose();assert.equal(f.contexts[0].closeCount,1);assert.equal(f.listeners.size,0);assert.equal(f.observers.size,0);
});

test('late audio skips old sounds and stop commands, plays new publications once, and preserves bus ownership',async()=>{
  const gate=deferred();const f=audioFixture({shared:true,fetchSound:async sound=>{await gate.promise;return {ok:true,arrayBuffer:async()=>sound};}});
  const loading=f.start();await flush();
  f.view.nativeLifecycle.sound.events=[{id:1,kind:'SEQUENCE',soundId:0x200,volume:127},{id:2,kind:'STOP_SEQUENCE',fadeFrames:6}];
  gate.resolve();const audio=await loading;audio.update();assert.equal(audio.getDiagnostics().played,0);
  f.view.nativeLifecycle.sound.events.push({id:3,kind:'SEQUENCE',soundId:0x200,volume:127});
  audio.update();audio.update();assert.equal(audio.getDiagnostics().played,1);
  f.controller.abort();await audio.dispose();assert.equal(f.contexts[0].state,'running');assert.equal(f.contexts[0].closeCount,0);
  assert.equal(audio.getDiagnostics().active,0);assert.equal(audio.getDiagnostics().loaded,0);assert.equal(f.contexts[0].gains[0].disconnected,true);
  assert.equal(f.observers.size,0);assert.equal(f.listeners.size,0);
});

test('never-finishing metadata aborts promptly; late metadata cannot create an audio graph',async()=>{
  const gate=deferred(),f=audioFixture({metadata:()=>gate.promise});
  const loading=f.start();const rejected=assert.rejects(loading,{name:'AbortError'});
  f.controller.abort();await rejected;assert.equal(f.contexts.length,0);
  gate.resolve({ok:true,text:async()=>metadataText});await flush();assert.equal(f.contexts.length,0);assert.equal(f.calls.length,1);
});

test('never-finishing samples are bounded, cancelled without settlement, and cannot attach after re-entry',async()=>{
  const gate=deferred(),f=audioFixture({fetchSound:()=>gate.promise});
  const loading=f.start();await flush();assert.equal(f.calls.filter(c=>c.path.endsWith('.wav')).length,4);
  const rejected=assert.rejects(loading,{name:'AbortError'});f.controller.abort();await rejected;
  assert.equal(f.contexts[0].state,'closed');assert.equal(f.contexts[0].gains[0].disconnected,true);
  const next=audioFixture();const current=await next.start();assert.equal(next.observers.size,1);
  gate.reject(Error('late abandoned fetch rejection'));await flush();assert.equal(f.observers.size,0);assert.equal(next.observers.size,1);
  await current.dispose();
});

test('sample rejection cancels outstanding peers and releases graph without waiting for them',async()=>{
  const gate=deferred();let count=0;
  const f=audioFixture({fetchSound:()=>++count===1?Promise.reject(Error('SAMPLE_FAIL')):gate.promise});
  await assert.rejects(f.start(),/SAMPLE_FAIL/);assert.ok(count<=4);assert.equal(f.contexts[0].state,'closed');
  assert.ok(f.calls.every(c=>c.signal.aborted));assert.equal(f.observers.size,0);gate.reject(Error('PEER_LATE_FAILURE'));await flush();
});

test('decoder rejection and abort during a non-cancellable decoder do not retain buffers or listeners',async()=>{
  const bad=audioFixture({decode:()=>Promise.reject(Error('DECODE_FAIL'))});await assert.rejects(bad.start(),/DECODE_FAIL/);
  assert.equal(bad.contexts[0].state,'closed');
  const gate=deferred(),f=audioFixture({decode:()=>gate.promise});
  const loading=f.start();await flush();const rejected=assert.rejects(loading,{name:'AbortError'});f.controller.abort();await rejected;
  gate.resolve({numberOfChannels:1,duration:1});await flush();assert.equal(f.observers.size,0);assert.equal(f.listeners.size,0);
  assert.equal(f.contexts[0].state,'closed');assert.equal(f.calls.filter(c=>c.path.endsWith('.wav')).length,4);
});

test('already aborted load makes no requests; completion after verdict never plays old sounds',async()=>{
  const f=audioFixture();f.controller.abort();await assert.rejects(f.start(),{name:'AbortError'});assert.equal(f.calls.length,0);
  const ended=audioFixture();ended.view.outcome.ended=true;ended.view.nativeLifecycle.sound.events=[{id:1,kind:'SEQUENCE',soundId:0x200,volume:127}];
  const audio=await ended.start();audio.update();assert.equal(audio.getDiagnostics().played,0);await audio.dispose();
});

// Exercise the real main.js mount owner with controlled presentation resources.
// Browser coverage separately runs the same owner with the formal artifact.
const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const binding=main.slice(main.indexOf('    mountField({ host,onReady,onError,progress=null }) {'),main.indexOf('    onExit: tutorial?undefined:'));
function mountFixture({audioLoad,fieldLoad,vfxLoad,sceneLoad}={}){
  const order=[],warnings=[],resources={},diagnostics=[];
  for(const name of ['field','roster','effects','vfx','scene','audio'])resources[name]={released:0,dispose(){this.released++;},getDiagnostics:()=>({failures:[]})};
  const source={getFrame:()=>({combatants:[{present:true,speciesId:'test'}]})};let audioSignal;
  // BATTLE_DYNAMIC_FX (main.js module switch, Owner 2026-10-12) is off here; activeRuntime supplies the local team.
  const context=vm.createContext({AbortController,BATTLE_DYNAMIC_FX:false,RESPONSIVE_BATTLE_CANDIDATE:false,activeRuntime:{localTeamIndex:()=>0,markOpeningReady(){order.push('opening-ready');}},location:{href:'https://orochi771127.github.io/championship-2026/championship.html'},root:{dataset:{}},source,view:{render(){}},console:{warn(...args){warnings.push(args);}},
    settings:{audio:{output:()=>({})}},observeBattleFirstRender,recoveryDiagnostics:{record:(type,row)=>diagnostics.push({type,...row})},ensurePixiStage:async(_host,signal)=>{signal.throwIfAborted();return {app:{renderer:{}}};},
    loadOptionalBattleFieldArt:()=>fieldLoad?fieldLoad():resources.field,
    loadOptionalCharacterReview:async()=>resources.roster,loadRegisteredBattleEffectArt:async()=>resources.effects,
    loadOptionalOriginalVfxReview:async(_stage,art)=>art,
    loadOptionalBattleVfxOverlay:()=>vfxLoad?vfxLoad():resources.vfx,
    mountBattleFieldPixiPresentation:async()=>{order.push('scene');return sceneLoad?sceneLoad():resources.scene;},
    mountBattleAudioPresentation:({signal})=>{order.push('audio');audioSignal=signal;return audioLoad?audioLoad(signal):Promise.resolve(resources.audio);}});
  const mount=vm.runInContext('({'+binding+'}).mountField',context);
  const owner=mount({host:{},onReady(){order.push('ready');},onError(){order.push('error');}});
  return {owner,order,warnings,resources,context,diagnostics,get audioSignal(){return audioSignal;}};
}

test('core ready precedes optional audio completion; late ownership is released on leaving',async()=>{
  const gate=deferred(),f=mountFixture({audioLoad:()=>gate.promise});await flush();assert.deepEqual(f.order,['scene','ready','opening-ready','audio']);
  assert.deepEqual(f.diagnostics.filter(e=>['ready','loading-card','audio'].includes(e.stage)).map(e=>[e.stage,e.phase]),[['ready',undefined],['loading-card','done'],['audio','start']]);
  f.owner.dispose();assert.equal(f.audioSignal.aborted,true);gate.resolve(f.resources.audio);await flush();
  assert.equal(f.resources.audio.released,1);assert.equal(f.resources.scene.released,1);assert.equal(f.resources.vfx.released,1);
});

test('optional audio rejection never reverses core ready and leaves no unhandled rejection',async()=>{
  const f=mountFixture({audioLoad:()=>Promise.reject(Error('AUDIO_UNAVAILABLE'))});await flush();
  assert.deepEqual(f.order,['scene','ready','opening-ready','audio']);assert.equal(f.warnings.length,1);f.owner.dispose();await flush();
});

test('normal optional audio releases with its owner; scene failure never starts it',async()=>{
  const f=mountFixture();await flush();f.owner.dispose();await flush();assert.equal(f.resources.audio.released,1);
  const bad=mountFixture({sceneLoad:()=>{throw Error('CORE_SCENE_FAILURE');}});await flush();
  assert.deepEqual(bad.order,['scene','error']);assert.equal(bad.context.root.dataset.fieldFallback,'true');
  for(const name of ['field','roster','effects','vfx'])assert.equal(bad.resources[name].released,1);
});

test('required VFX stays gated while pending and late completion after cancellation cannot mount a scene',async()=>{
  const gate=deferred(),f=mountFixture({vfxLoad:()=>gate.promise});await flush();assert.deepEqual(f.order,[]);
  f.owner.dispose();gate.resolve(f.resources.vfx);await flush();assert.deepEqual(f.order,[]);assert.equal(f.resources.vfx.released,1);
  const next=mountFixture();await flush();assert.deepEqual(next.order,['scene','ready','opening-ready','audio']);next.owner.dispose();await flush();
});

test('missing/rejected core art and missing/rejected required VFX show errors, never fake ready',async()=>{
  for(const options of [{fieldLoad:()=>null},{fieldLoad:()=>Promise.reject(Error('CORE_FETCH_FAIL'))},
    {vfxLoad:()=>null},{vfxLoad:()=>Promise.reject(Error('VFX_FAIL'))}]){
    const f=mountFixture(options);await flush();assert.deepEqual(f.order,['error']);
    assert.equal(f.context.root.dataset.fieldFallback,'true');assert.equal(f.audioSignal,undefined);
  }
});
