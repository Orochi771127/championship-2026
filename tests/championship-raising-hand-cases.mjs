import test from 'node:test';
import assert from 'node:assert/strict';
import oracle from '../docs/research/RAISING_HAND_CPU_2026-09-10.json' with {type:'json'};
import {classifyNativeRaisingHand,stepNativeRaisingStrokeInput,enterNativeRaisingStroke,stepNativeRaisingStroke,
  nativeRaisingTapWakes,enterNativeRaisingTap,selectNativeRaisingTapReaction,nativeRaisingHandAdmission} from '../src/championship/raising/nativeRaisingHand.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,beginNativeRaisingStroke,releaseNativeRaisingStroke,
  touchNativeRaisingActor,stepNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {constructNativeIndividualForm} from '../src/championship/raising/nativeIndividualEvolution.js';
import lifecycleOracle from '../docs/research/RAISING_LIFECYCLE_CPU_CHECK_2026-09-08.json' with {type:'json'};
import {BATTLE_SPECIES_ENTITIES,BATTLE_CHARACTER_PROFILES} from '../src/data/championship/battleCharacterProfiles.js';
const seed={version:1,...lifecycleOracle.evolution[0].before};

test('hand classification matches 210 original held, release, movement, admission and hit-test boundaries',()=>{
  for(const c of oracle.classifier){const events=[];
    const actual=classifyNativeRaisingHand({held:!!c.held,elapsed:c.elapsed,origin:{x:100,y:100},pointer:{x:100+c.delta[0],y:100+c.delta[1]},
      admit:n=>{events.push(['admission',n]);return !!c.admit;},inside:!!c.inside});
    assert.equal(actual,c.result,JSON.stringify(c));assert.deepEqual(events,c.events);}
});
test('stroke release, 96-pixel radius, 3-pixel movement and idle timeout match 40 original CPU samples',()=>{
  for(const c of oracle.strokeController)assert.deepEqual(stepNativeRaisingStrokeInput({held:!!c.held,elapsed:c.elapsed,
    previous:{x:100,y:100},pointer:{x:c.pointer[0],y:c.pointer[1]},actorScreen:{x:100,y:100}}),{result:c.result,counter:c.counter},JSON.stringify(c));
});
test('stroke entry and 1,920 native updates preserve all eight condition masks, stress, phase, sound and release',()=>{
  for(const c of oracle.strokes){const events=[],p={fields:{'01c':c.stress}};
    ['134','138','13c'].forEach((key,i)=>p.fields[key]=(c.conditionMask>>i)&1);
    const stroke=enterNativeRaisingStroke(p,id=>events.push(['sequence',id]));
    assert.equal(stroke.profile.fields['01c'],c.stressAfter);assert.deepEqual(events,c.entry);
    for(const [tick,phase,music,result,sounds] of c.samples){const frame=stepNativeRaisingStroke(stroke,true);
      assert.equal(stroke.phase,phase,`phase ${c.conditionMask}:${tick}`);assert.equal(frame.music,music);
      assert.equal(frame.complete,result===1);assert.deepEqual(frame.sound===null?[]:[['sound',frame.sound]],sounds);}
    const exit=stepNativeRaisingStroke(stroke,false);assert.equal(exit.complete,c.release===1);assert.equal(exit.music,c.musicAfterExit);}
});
test('all eight personalities retain the original sleep tap thresholds; stroking does not wake sleepers',()=>{
  for(const c of oracle.sleepCommands){let calls=0;
    const rng={next(channel){calls++;assert.equal(channel,0x79);return c.roll;}};
    if(c.command===0x7e){assert.equal(nativeRaisingTapWakes(c.personality,3,rng),c.result===10);assert.equal(calls,1);}
    if(c.command===0x7f)assert.equal(c.result,-1);
    if(c.command===0x80)assert.equal(c.result,6);}
});
test('tap entry counter and 30-tick reset match native byte writes',()=>{
  for(const c of oracle.tapEntry)assert.deepEqual(enterNativeRaisingTap(c),{count:c.after[0],elapsed:c.after[1]},JSON.stringify(c));
});
test('1,536 native tap response branches preserve condition suppression, personality, previous sleep and RNG channels',()=>{
  for(const c of oracle.taps){const tap={count:3,elapsed:0},events=[],rolls=[c.trigger,c.selection];
    const id=selectNativeRaisingTapReaction(tap,{healthy:c.conditionMask===0,previousState:c.previous,personality:c.personality,poolSlot:3},
      {next(channel){events.push(['random',channel]);return rolls.shift();}});
    if(id!==null)events.push(['reaction',id]);
    assert.equal(tap.count,c.count,JSON.stringify(c));assert.deepEqual(events,c.events,JSON.stringify(c));assert.equal(id===null?1:9,c.result);}
});

test('every regular species binding uses its own native stroke sequence; all eight condition masks retain the previous pose',()=>{
  const rng={next:()=>51},ground={readClearance:()=>4,readTerrain:()=>0};
  for(let species=8;species<228;species++)for(let mask=0;mask<8;mask++){
    const profile=structuredClone(constructNativeIndividualForm(seed,species,rng));
    ['134','138','13c'].forEach((key,i)=>profile.fields[key]=(mask>>i)&1);
    const actor=createNativeRaisingActor(profile,3);initializeNativeRaisingActor(actor,profile,[100*4096,100*4096,0],30,rng);
    actor.idleCounter=1000;const before=actor.sequenceId;
    const p=beginNativeRaisingStroke(actor,profile,{foods:[],rng});assert.ok(p);
    assert.equal(actor.state,8);assert.equal(actor.sequenceId,mask?before:28,`${species}:${mask}`);
    assert.ok(BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[species]].sequences.some(s=>s.id===actor.sequenceId));
    assert.equal(nativeRaisingHandAdmission(actor,0x80),false);
    assert.equal(releaseNativeRaisingStroke(actor),true);assert.equal(releaseNativeRaisingStroke(actor),false);
    const context={ageDelta:0,rng,feeding:{foods:[],ground,actors:[actor]},lifecycle:{residents:[p],season:1,rank:0,roster:[species],minute:420,wasteCount:0,rottenFoodCount:0}};
    stepNativeRaisingActor(actor,p,context);assert.equal(actor.state,1);assert.equal(actor.statusMusic,0);
  }
});

test('sleeping stroke retains its sleep state, pose and profile, while hold and release write the growth flag',()=>{
  const rng={next:()=>51},profile=constructNativeIndividualForm(seed,8,rng);
  const actor=createNativeRaisingActor(profile,0);initializeNativeRaisingActor(actor,profile,[409600,409600,0],30,rng);actor.state=4;
  const pose=actor.sequenceId;assert.equal(beginNativeRaisingStroke(actor,profile,{foods:[],rng}),profile);
  assert.equal(actor.state,4);assert.equal(actor.sequenceId,pose);assert.equal(actor.growthFields['430'],1);
  assert.equal(releaseNativeRaisingStroke(actor),true);assert.equal(actor.growthFields['430'],0);
});
