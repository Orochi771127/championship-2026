import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createBattleNativeMemory} from '../src/championship/battle/battleNativeMemory.js';
import {callBattlePresentationHost,beginBattlePresentationEngagement,endBattlePresentationEngagement,writeBattleHitTiming,advanceBattlePresentationTiming} from '../src/championship/battle/battlePresentationHost.js';
import {createBattleImpactEffects} from '../src/championship/battle/battleImpactEffects.js';
import {createBattleSoundEvents} from '../src/championship/battle/battleSoundEvents.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';
import {BATTLE_AUDIO_MANIFEST,validateBattleAudio,mountBattleAudioPresentation} from '../src/championship/presentation/battleAudioPresentation.js';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const oracle=json('docs/research/BATTLE_PRESENTATION_R13_CPU_2026-09-08.json');
const manifest=json(BATTLE_AUDIO_MANIFEST),index=json('assets/production/ART_PRODUCTION_INDEX.json');
const stands=[{x:.5,y:.5,facing:1,evidence:'CONTROLLED_NATIVE_INPUT'}];

test('all native characters materialize NCER geometry, including invisible animation cells',()=>{
  let characters=0,cells=0;
  for(const [speciesId,entity] of Object.entries(BATTLE_SPECIES_ENTITIES)){
    if(!BATTLE_CHARACTER_PROFILES[entity])continue;
    const actors=createBattleNativeActors({slots:[{speciesId:Number(speciesId)}],stands}),m=actors.memory,actor=actors.actorOf(0);
    assert.ok(actor,entity);
    for(const [id,[lx,ly,hx,hy]] of Object.entries(BATTLE_CHARACTER_PROFILES[entity].cells)){
      assert.deepEqual([0,2,4,6].map(o=>m.readS16(actor+0x2000,Number(id)*16+8+o)),[hx,hy,lx,ly],`${entity}:${id}`);cells++;
    }
    characters++;
  }
  assert.ok(characters>=224);assert.ok(cells>13000);
});

test('five impact families match original ARM allocation, copied height and projection outputs',()=>{
  for(const c of oracle.impacts){
    const a=createBattleNativeActors({slots:[{speciesId:81}],stands}),m=a.memory,actor=a.actorOf(0),pool=createBattleImpactEffects();
    m.writeU16(actor+0x1100,0,0);
    [8,c.height,0,0].forEach((v,i)=>m.writeU16(actor+0x2000,8+i*2,v));
    c.xyz.forEach((v,i)=>m.writeU32(actor,0x24+i*4,v));
    for(let i=0;i<c.slot;i++)pool.spawn({owner:1,target:2,type:c.type,point:{x:0,y:0,z:0}});
    const id=pool.spawnNative(m,{owner:1,target:a.address(0),type:c.type,offset:c.offset}),e=pool.snapshot().find(x=>x.id===id);
    assert.equal(e.slot,c.slot);assert.deepEqual(e.nativeCopy,c.copied);
    assert.deepEqual([e.point.x,e.point.y],c.projected.slice(0,2));
    assert.equal(e.depthQ12,c.projected[2]+[0,0,32768,32768,-32768][c.type]);
    pool.advance({exclusiveOwner:2});assert.equal(pool.snapshot().find(x=>x.id===id).frame,0,'unrelated special freezes this impact');
    pool.advance({exclusiveOwner:1});assert.equal(pool.snapshot().find(x=>x.id===id).frame,1);
    pool.advance({exclusiveOwner:1,isOwnerActive:()=>false});assert.equal(pool.snapshot().find(x=>x.id===id).frame,1,'retired action cannot match reused owner lock');
    for(let i=0;i<31;i++)pool.advance();assert.equal(pool.diagnostics().active,0);
  }
});

test('camera mode save/restore and original nine follow vectors match ARM CPU',()=>{
  for(const c of oracle.camera){
    const m=createBattleNativeMemory(),w=0x2300000;
    m.writeU32(w,0x1f108,1);m.writeU32(w,0x1f10c,c.mode);
    callBattlePresentationHost(m,w,0x021117c4,[w,0,12]);
    assert.equal(callBattlePresentationHost(m,w,0x02111808,[]),c.active);
    callBattlePresentationHost(m,w,0x021117e8,[w]);
    assert.deepEqual([m.readU32(w,0x1f108),m.readU32(w,0x1f10c)],c.restored);
    assert.equal(m.readU32(w,0x1f080)-w,c.vectorOffset);assert.equal(m.readU32(w,0x1f0c8),c.speed);
    assert.deepEqual([m.readU32(w,0x1f0a0)|0,m.readU32(w,0x1f0a4)|0],c.offset);
  }
});

test('54 original PCM wave files retain declared hashes, channels, rate and sample counts',()=>{
  validateBattleAudio(manifest,index);
  for(const s of manifest.sounds){const b=fs.readFileSync(s.src);
    assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt16LE(34),16);
    assert.equal(b.readUInt32LE(24),s.sampleRate);assert.equal(b.readUInt32LE(40),s.sampleFrames*2);
    assert.equal(createHash('sha256').update(b.subarray(44)).digest('hex'),s.pcmSha256);
  }
  assert.throws(()=>validateBattleAudio(manifest,{entries:[]}),/NOT_REGISTERED/);
});

test('special owner/target engagement, support modes and release match 16 original ARM cases',()=>{
  for(const c of oracle.engagements){
    const slots=Array.from({length:6},(_,i)=>({speciesId:81,currentHp:i===2?0:100,state:i===3?7:0,
      stateCounter:0,field17C:i===3?15:0,field84:c.preserve?12:3}));
    const actors=createBattleNativeActors({slots,stands:Array(6).fill(stands[0])});
    for(let i=0;i<6;i++)actors.memory.writeU32(actors.actorOf(i),0xd4,0x800000);
    const action={index:0,move:{pointer1C:0x02120900,kind:c.kind,targetMode:c.targetMode}};
    beginBattlePresentationEngagement({slots,actors,slot:0,targetSlot:3,action,notify:(i,n)=>{slots[i].field17C=n;slots[i].field180=-255;}});
    assert.deepEqual(slots.map(s=>s.field94===0x11000000),c.after.locks);
    assert.deepEqual(slots.map((s,i)=>actors.memory.readU32(actors.actorOf(i),0xd4)|0),c.after.depth);
    assert.equal(slots[3].state,c.after.targetState);assert.equal(slots[3].stateCounter,c.after.targetCounter);
    assert.equal(slots[3].field17C,c.after.notification);
    assert.equal(endBattlePresentationEngagement({slots,actors,slot:1,object:0x11000000}),false,'other owner cannot release the lock');
    endBattlePresentationEngagement({slots,actors,slot:0,object:0x11000000});
    assert.deepEqual(slots.map((s,i)=>actors.memory.readU32(actors.address(i),0x94)),c.releasedLocks);
    assert.deepEqual(slots.map((s,i)=>actors.memory.readU32(actors.actorOf(i),0xd4)|0),c.releasedDepth);
  }
  assert.deepEqual(oracle.frameBranches,[
    {engaged:0,terminal:0x0210d5fc,objectUpdates:0,notifications:0,animationFlags:[]},
    {engaged:1,terminal:0x0210da00,objectUpdates:1,notifications:2,animationFlags:[1,0,0,1,0,0]}
  ]);
});

test('sound dispatch preserves native IDs, silent cases, stop handle and native frames',()=>{
  const h=createBattleSoundEvents(),m=createBattleNativeMemory();h.attach(m);
  h.call(0x0203ea30,[0,127,0],0);h.call(0x0203ea30,[0xff00,127,0],1);assert.equal(h.snapshot().emitted,0);
  h.call(0x0203ea30,[0xff01,127,0],2,50);h.call(0x0203ea30,[0x200,127,0],3,51);h.call(0x0203eae8,[6],4,51);
  assert.deepEqual(h.snapshot().events.map(x=>[x.kind,x.frame]),[['STREAM',2],['SEQUENCE',3],['STOP_SEQUENCE',4]]);
  assert.equal(h.snapshot().events[2].fadeFrames,6);h.clear();assert.equal(h.snapshot().emitted,0);
});

test('original ARM hit-pause thresholds, remaining-team lookup and per-frame slowdown gate',()=>{
  const m=createBattleNativeMemory(),world=0x20000000;
  for(const c of oracle.hitTiming){m.writeU32(world,0x1f134,c.initial);
    writeBattleHitTiming(m,world,{damage:c.damage,blocked:!!c.blocked});assert.equal(m.readU32(world,0x1f134),c.pause);}
  for(const c of oracle.timingGates){m.writeU32(world,0x1f134,c.pause);m.writeU32(world,0x1f138,c.slow);
    assert.equal(advanceBattlePresentationTiming(m,world),c.runs);assert.deepEqual([m.readU32(world,0x1f134),m.readU32(world,0x1f138)],c.after);}
  for(const c of oracle.slowdowns){m.writeU32(world,0x1f134,0);m.writeU32(world,0x1f138,0);
    assert.equal(writeBattleHitTiming(m,world,{damage:251,blocked:false,knockedOut:true,remainingTeamMembers:c.remaining}),null);
    assert.equal(m.readU32(world,0x1f134),48);assert.equal(m.readU32(world,0x1f138),c.duration);}
  assert.match(writeBattleHitTiming(m,world,{damage:100,blocked:false,knockedOut:true,remainingTeamMembers:3}),/REQUIRES_CALLER_TRACE/);
});

test('audio preloads before play, deduplicates publications and tears down every voice/listener',async()=>{
  const contexts=[];
  class Context{
    state='running';currentTime=0;destination={};nodes=[];
    constructor(){contexts.push(this);}
    createGain(){return {gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createBufferSource(){const c=this,node={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(at){this.stopped=true;if(at===undefined)this.onended?.();}};c.nodes.push(node);return node;}
    async decodeAudioData(b){return {numberOfChannels:1,duration:b.readUInt32LE(40)/2/b.readUInt32LE(24)};}
    async close(){this.state='closed';} async resume(){this.state='running';}
  }
  const target=new EventTarget(),observers=new Set();let view={nativeLifecycle:{sound:{events:[]}},outcome:{ended:false}};
  const source={getView:()=>view,subscribe(fn){observers.add(fn);return()=>observers.delete(fn);}};
  let requests=0;const fetchImpl=async url=>{requests++;const p=new URL(url).pathname.slice(1);return {ok:true,json:async()=>json(p),arrayBuffer:async()=>fs.readFileSync(p)};};
  assert.equal(await mountBattleAudioPresentation({source,baseUrl:'https://example.com/',fetchImpl,AudioContextClass:Context}),null);assert.equal(requests,0);
  const audio=await mountBattleAudioPresentation({source,baseUrl:'http://127.0.0.1:8738/tests/fixture.html',fetchImpl,AudioContextClass:Context,eventTarget:target});
  assert.equal(audio.getDiagnostics().loaded,54);
  const events=[{id:1,soundId:0xff01,volume:127,kind:'STREAM'},{id:2,soundId:0xff01,volume:127,kind:'STREAM'},
    {id:3,soundId:0x200,volume:127,kind:'SEQUENCE'},{id:4,soundId:0x201,volume:127,kind:'SEQUENCE'},
    {id:5,soundId:0x202,volume:127,kind:'SEQUENCE'},{id:6,kind:'STOP_SEQUENCE',fadeFrames:6}];
  view.nativeLifecycle.sound.events=events;audio.update();audio.update();
  assert.equal(audio.getDiagnostics().played,4);assert.deepEqual(audio.getDiagnostics().missing,[]);
  assert.equal(contexts[0].nodes[3].stopped,true);
  view.outcome.ended=true;audio.update();assert.equal(audio.getDiagnostics().active,0);
  await audio.dispose();await audio.dispose();assert.equal(observers.size,0);assert.equal(audio.getDiagnostics().contextState,'closed');
  assert.equal(audio.getDiagnostics().played,audio.getDiagnostics().released);
});
