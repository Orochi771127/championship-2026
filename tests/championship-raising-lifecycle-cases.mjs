import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateNativeEvolution,evaluateNativeRebirth} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {allocateNativeRaisingWaste} from '../src/championship/raising/nativeRaisingWaste.js';
import {createNativeRaisingActor,beginNativeRaisingEvolution,stepNativeRaisingEvolution} from '../src/championship/raising/nativeRaisingActor.js';
import {settleNativeRaisingCage} from '../src/championship/raising/nativeRaisingOvernight.js';
import {enterNativeRaisingSleep,exitNativeRaisingSleep,enterNativeRaisingMorning} from '../src/championship/raising/nativeRaisingSleep.js';
import {applyNativeRaisingGrowth} from '../src/championship/raising/nativeRaisingGrowth.js';
import {applyNativeTrainingCommand,createNativeTrainingTimeline,stepNativeTrainingTimeline} from '../src/championship/raising/nativeRaisingTraining.js';
import {projectNativeRaisingCalendar} from '../src/championship/raising/nativeRaisingCalendar.js';
const receipt=JSON.parse(readFileSync(new URL('../docs/research/RAISING_LIFECYCLE_CPU_CHECK_2026-09-08.json',import.meta.url)));

test('eight-day calendar registration, title wins and championship countdown match 1024 original CPU cases',()=>{
  const calendar=JSON.parse(readFileSync(new URL('../docs/research/RAISING_CALENDAR_CPU_CHECK_2026-09-09.json',import.meta.url)));
  for(const {input,output} of calendar.vectors){const actual=projectNativeRaisingCalendar(input);
    assert.equal(actual.countdown,output.countdown,JSON.stringify(input));assert.deepEqual(actual.days,output.days,JSON.stringify(input));}
});
test('lifetime disappearance completes the original state-21 sequence and releases only after its effect ends',()=>{
  const p={version:1,...receipt.evolution.find(row=>row.speciesIndex===21).before};
  for(const row of receipt.disappearanceTimelines){const actor=createNativeRaisingActor(p,0),rng={next:()=>51};beginNativeRaisingEvolution(actor,{target:-1},rng);
    for(const [i,expected] of row.frames.entries()) {const result=stepNativeRaisingEvolution(actor,p,rng);
      assert.equal(!!result.disappeared,expected.result===0,`frame ${i+1}`);if(!result.disappeared)assert.equal(actor.evolution.phase,expected.phase);
    }
  }
});
test('training label lanes and completion follow original CPU frames for zero through ten commands',()=>{
  for(const row of receipt.trainingTimelines){const t=createNativeTrainingTimeline(Array.from({length:row.count},()=>({kind:0,delta:0})));
    for(const [i,expected] of row.frames.entries()) {const done=stepNativeTrainingTimeline(t);
      assert.equal(done,expected.result===1,`count ${row.count} frame ${i+1}`);assert.equal(t.phase,expected.phase);assert.equal(t.emitted,expected.emitted);
    }
  }
});

test('all 28 Cage training writers match native seasonal, level, bound and blocked outcomes',()=>{
  for(const [i,row] of receipt.training.entries()){let cursor=0;const calls=[];
    const actual=applyNativeTrainingCommand({version:1,...row.before},row,{next(channel){calls.push(['rng',channel]);return row.rolls[cursor++];}});
    assert.deepEqual(actual.profile,{version:1,...row.after},`training ${i}, kind ${row.kind}`);
    assert.deepEqual(calls,row.calls.filter(c=>c[0]==='rng'));assert.equal(cursor,row.rolls.length);
  }
});

test('every species and forced lifetime outcome matches the original rebirth selector',()=>{
  for(const row of receipt.rebirth){const result=evaluateNativeRebirth({version:1,...row.before},row.force);
    assert.equal(result.target,row.target);assert.deepEqual(result.profile,{version:1,...row.after});}
});
test('Cage capacity and shared forty-slot waste allocation match the original allocator',()=>{
  for(const row of receipt.waste){const pool=Array.from({length:row.filled},(_,slot)=>({slot,present:true,cageDefinitionIndex:slot<row.cageCount?row.definition:(row.definition+1)%36}));
    assert.deepEqual(allocateNativeRaisingWaste(pool,{speciesIndex:21,cageDefinitionIndex:row.definition,positionQ12:[0x100000,0x80000,0]}),row.output);}
});
test('ordinary evolution and rebirth preserve all original phase boundaries and commit at frame 272',()=>{
  const p={version:1,...receipt.evolution.find(row=>row.speciesIndex===21).before};
  for(const row of receipt.evolutionTimelines){const actor=createNativeRaisingActor(p,0),rng={next:()=>51};
    beginNativeRaisingEvolution(actor,{target:row.target},rng);
    for(const [i,expected] of row.frames.entries()){
      const result=stepNativeRaisingEvolution(actor,p,rng);
      if(expected.result!==-1){assert.equal(result.evolved,true);assert.equal(result.profile.fields['000'],row.target);assert.equal(i+1,272);}
      else{assert.equal(actor.evolution.phase,expected.phase,`target ${row.target} frame ${i+1}`);assert.equal(actor.evolution.elapsed,expected.elapsed);assert.equal(result.changed,false);}
    }
  }
});
test('all original evolution predicates, order, ancestry, rank and capacity outcomes match the original CPU',()=>{
  for(const row of receipt.evolution){let cursor=0;const calls=[];
    const actual=evaluateNativeEvolution({version:1,...row.before},{rank:row.rank,roster:row.roster,lifetime:!!row.lifetime},{next(channel){calls.push(['rng',channel]);return row.rolls[cursor++];}});
    const label=`species ${row.speciesIndex}, rank ${row.rank}, lifetime ${row.lifetime}`;
    assert.equal(actual.code,row.result,label);assert.deepEqual(actual.profile,{version:1,...row.after},label);
    assert.deepEqual(actual.actor,row.actor,label);assert.deepEqual(calls,row.calls.filter(c=>c[0]==='rng'),label);assert.equal(cursor,row.rolls.length,label);
  }
});

test('sleep durations and interrupted/full sleep writes match 880 original entry/exit pairs',()=>{
  for(const row of receipt.sleep){let cursor=0;const channels=[],rng={next(channel){channels.push(['rng',channel]);return row.rolls[cursor++];}};
    assert.deepEqual(enterNativeRaisingSleep({version:1,...row.before},row.poolSlot,rng),{version:1,...row.entered},`entry ${row.speciesIndex}`);
    assert.deepEqual(exitNativeRaisingSleep({version:1,...row.beforeExit},row.poolSlot,rng),{version:1,...row.after},`exit ${row.speciesIndex}`);
    assert.deepEqual(channels,row.calls.filter(c=>c[0]==='rng'));assert.equal(cursor,row.rolls.length);
    cursor=0;channels.length=0;const morning=enterNativeRaisingMorning({version:1,...row.morning.before},row.poolSlot,
      {next(channel){channels.push(['rng',channel]);return row.morning.rolls[cursor++];}});
    assert.deepEqual(morning.profile,{version:1,...row.morning.after});assert.equal(morning.waitFrames,row.morning.waitFrames);
    assert.deepEqual(channels,row.morning.calls.filter(c=>c[0]==='rng'));
  }
});
test('ordered overnight writes, food, illness, peers and Cage effects match 168 original CPU calls',()=>{
  for(const [i,row] of receipt.overnight.entries()){let cursor=0;const calls=[];
    const result=settleNativeRaisingCage(row.before.map(p=>({version:1,...p})),{...row.input,
      spawnWaste(species){calls.push(['wasteSpawn',species,row.input.spawnSuccess]);return row.input.spawnSuccess;},
      rng:{next(channel){calls.push(['rng',channel]);return row.input.rolls[cursor++];}}});
    assert.deepEqual(result.profiles,row.after.map(p=>({version:1,...p})),`profiles ${i}`);
    assert.deepEqual(result.foods,row.foodsAfter,`foods ${i}`);assert.deepEqual(calls,row.calls,`calls ${i}`);
  }
});
test('live growth with populated Cage lists matches original CPU profile, actor and RNG writes',()=>{
  for(const [i,row] of receipt.growth.entries()){let cursor=0;const calls=[];
    const actual=applyNativeRaisingGrowth({version:1,...row.before},row.actorBefore,{...row.input,peerCount:row.residents.length,
      residents:row.residents,satietyMaximum:8},{next(channel){calls.push(['rng',channel]);return row.rolls[cursor++];}});
    assert.deepEqual(actual.profile,{version:1,...row.after},`profile ${i}`);assert.deepEqual(actual.actorFields,row.actorAfter,`actor ${i}`);
    assert.deepEqual(calls,row.calls.filter(c=>c[0]==='rng'),`rng ${i}`);
  }
});
