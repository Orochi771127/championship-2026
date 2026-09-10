import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {beginNativeActivityReaction,stepNativeActivityReaction} from '../src/championship/raising/nativeRaisingActivity.js';
import {createNativeRaisingActor,initializeNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';

const cpu=JSON.parse(fs.readFileSync('docs/research/RAISING_REACTION_DISPATCH_CPU_2026-09-10.json'));
const ground={readClearance:()=>4,readTerrain:()=>0};
function resident(species=34){
  const rng={next:()=>51};
  const profile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(species),rng}));
  const actor=createNativeRaisingActor(profile,0);
  initializeNativeRaisingActor(actor,profile,[100*4096,100*4096,0],35,rng);
  return actor;
}
function request(actor,id,force=false,frame=null){
  if(actor.sequenceId===id&&!force)return;
  const bank=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[actor.speciesIndex]];
  const sequence=bank.sequences.find(s=>s.id===id);
  assert.ok(sequence,`${actor.speciesIndex}/${id}`);
  actor.animator=createNativeCharacterAnimationTimeline({...sequence,frames:sequence.frames.map(f=>({...f,texture:`cell:${f.cell}`}))},
    frame===null?{}:{initialSnapshot:{frameIndex:frame,elapsedQ12:0,active:false}});
  actor.sequenceId=id;
}

test('104 original reaction handler variants preserve every flip, alternate request and completion update',()=>{
  let updates=0;
  for(const row of cpu.reactions){
    for(const variant of row.variants??[]){
      const actor=resident();actor.slow=variant.slow;actor.flipBits=variant.flip;
      const events=[];
      const capture=(a,id,...rest)=>{events.push(['sequence',id]);request(a,id,...rest);};
      assert.equal(beginNativeActivityReaction(actor,row.id,ground,capture),row.conditionDelta);
      assert.deepEqual(events,variant.entry.filter(e=>e[0]==='sequence'));
      actor.animator={getSnapshot:()=>({active:true})};
      for(const [tick,flip,result,expected] of variant.samples){
        events.length=0;actor.animator={getSnapshot:()=>({active:tick<73})};
        // Keep a real animator for feedback geometry if an alternate is requested.
        const done=stepNativeActivityReaction(actor,ground,capture);
        assert.equal(actor.flipBits,flip,`reaction ${row.id}, slow ${variant.slow}, tick ${tick}`);
        assert.equal(done,result===1,`completion ${row.id}/${tick}`);
        assert.deepEqual(events,expected.filter(e=>e[0]==='sequence'),`requests ${row.id}/${tick}`);
        const icon=expected.find(e=>e[0]==='feedback');
        if(icon)assert.equal(actor.feedback.encoded,icon[1]);
        updates++;
      }
    }
  }
  assert.equal(updates,cpu.summary.handlerUpdates);
});

test('all 220 adult species bindings execute all 26 timed/animation reactions through their own Main bank',()=>{
  let cases=0;
  const resources=new Set();
  for(let species=8;species<228;species++){
    resources.add(BATTLE_SPECIES_ENTITIES[species]);
    for(const row of cpu.reactions.filter(r=>r.state===9)){
      for(const slow of [0,1]){
        const actor=resident(species);actor.slow=slow;actor.flipBits=0;
        beginNativeActivityReaction(actor,row.id,ground,request);
        let done=false;
        for(let tick=1;tick<=400;tick++){
          actor.animator.advanceNative(4096);
          actor.feedback?.animator.advanceNative(4096);
          done=stepNativeActivityReaction(actor,ground,request);
          const snapshot=actor.animator.getSnapshot();
          assert.ok(BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[species]].cells[snapshot.cell],`${species}/${row.id}/${snapshot.cell}`);
          if(done)break;
        }
        assert.ok(done,`reaction never completes: species ${species}, reaction ${row.id}, slow ${slow}`);
        cases++;
      }
    }
  }
  assert.equal(resources.size,216);
  assert.equal(cases,11440);
});
