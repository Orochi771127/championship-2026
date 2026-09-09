import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectNativeCageReaction,selectNativePersonalityReaction,selectNativeIdleActivity,nativeRaisingWanderTarget,beginNativeActivityReaction,stepNativeActivityReaction,finishNativeActivityMovement} from '../src/championship/raising/nativeRaisingActivity.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,stepNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';
const cpu=JSON.parse(fs.readFileSync('docs/research/RAISING_ACTIVITY_CPU_CHECK_2026-09-08.json'));
function rolls(values){let i=0;const calls=[];return {calls,next(channel){assert.ok(i<values.length);calls.push(['rng',channel]);return values[i++];}};}
const ground={pixelWidth:672,readTerrain:()=>0,readClearance:()=>4};
test('all 480 original CPU Cage/personality choices retain physical RNG channels and draw count',()=>{
  for(const row of cpu.selectors){const rng=rolls(row.rolls);
    const actual=row.kind==='cage'?selectNativeCageReaction(row.definition,row.field18,0,rng):selectNativePersonalityReaction(row.personality,0,rng);
    assert.equal(actual,row.reaction,JSON.stringify(row));assert.deepEqual(rng.calls,row.calls.filter(c=>c[0]==='rng'));}
});
test('96 roaming targets equal the complete original Q12 and Nitro sine-table calculation',()=>{
  for(const row of cpu.targets){const rng=rolls(row.rolls);
    assert.deepEqual(nativeRaisingWanderTarget({poolSlot:0,positionQ12:row.positionQ12},rng),row.target);
    assert.deepEqual(rng.calls,row.calls);}
});
test('jump and tumble positions and completion match every original native handler frame',()=>{
  for(const row of cpu.trajectories){
    const actor={positionQ12:[...row.positionQ12],directionQ12:[...row.directionQ12],flipBits:1,destinationState:15};
    const request=()=>{};
    if(row.state===13)beginNativeActivityReaction(actor,5,ground,request);else finishNativeActivityMovement(actor,request);
    for(const sample of row.samples){
      const done=stepNativeActivityReaction(actor,ground,request);
      assert.deepEqual(actor.positionQ12,sample.positionQ12,`state ${row.state} tick ${sample.tick}`);
      assert.equal(done,sample.done,`completion state ${row.state} tick ${sample.tick}`);
    }
  }
});
test('64 original peer choices retain reaction/follow/roam decisions and random draws',()=>{
  for(const row of cpu.social){
    const actor={poolSlot:0,speciesIndex:row.species,cageDefinitionIndex:35,positionQ12:[...row.positionQ12],destinationQ12:[...row.positionQ12],state:1,mode:0,ticks:0,desiredAngleQ12:0,idleElapsed:0,idleCounter:0};
    const peer={speciesIndex:row.peerSpecies,cageDefinitionIndex:35,positionQ12:row.peerPositionQ12,state:1,activityReaction:row.peerReaction};
    const rng=rolls([100,...row.rolls]);
    selectNativeIdleActivity(actor,{fields:{'018':0}},{ground,actors:[actor,peer],rng,request:()=>{}});
    const label=JSON.stringify([row.species,row.peerSpecies,row.peerPositionQ12,row.peerReaction]);
    assert.equal(actor.state,row.state,label);assert.equal(actor.mode,row.mode,label);assert.equal(actor.ticks,row.ticks,label);
    assert.equal(actor.desiredAngleQ12,row.desiredAngleQ12,label);assert.deepEqual(actor.destinationQ12,row.target,label);
    assert.deepEqual(rng.calls.slice(1),row.calls.filter(c=>c[0]==='rng'),label);
  }
});
test('adult idle dispatch changes positions and native actions with no food, including every personality',()=>{
  for(let personality=0;personality<8;personality++){
    let seed=0x6891+personality;const rng={next:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%103;}};
    const generated=createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(8),rng});
    let profile=nativeIndividualProfile(generated);profile=structuredClone(profile);profile.fields['018']=personality;
    const actor=createNativeRaisingActor(profile,0);initializeNativeRaisingActor(actor,profile,[100*4096,100*4096,0],35,rng);
    const positions=new Set(),sequences=new Set();
    for(let i=0;i<900;i++){
      const result=stepNativeRaisingActor(actor,profile,{ageDelta:0,rng,feeding:{ground,foods:[],signals:new Map(),actors:[actor]}});
      profile=result.profile;positions.add(actor.positionQ12.join());sequences.add(actor.sequenceId);
    }
    assert.ok(positions.size>30,`personality ${personality} moves`);assert.ok(sequences.size>=2,`personality ${personality} animates`);
    assert.equal(actor.foodSlot,null);
  }
});
test('every available adult Main bank can execute the spontaneous reaction set without a missing frame',()=>{
  let count=0;
  for(let species=8;species<228;species++){
    const bank=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[species]];if(!bank)continue;
    const rng={next:()=>51},profile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(species),rng}));
    const actor=createNativeRaisingActor(profile,0);
    initializeNativeRaisingActor(actor,profile,[409600,409600,0],35,rng);
    // Exercise all actually referenced numeric sequences and fixed jump frames.
    for(const spec of cpu.reactions){
      if(spec.sequence>=0)assert.ok(bank.sequences.find(s=>s.id===spec.sequence)?.frames.length,`${species}/${spec.id}`);
      if(spec.alternate>=0)assert.ok(bank.sequences.find(s=>s.id===spec.alternate)?.frames.length,`${species}/${spec.id}/alternate`);
    }
    assert.ok(bank.sequences.find(s=>s.id===0).frames[1],`jump frame ${species}`);count++;
  }
  assert.equal(count,220);
});
