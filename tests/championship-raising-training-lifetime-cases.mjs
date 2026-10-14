// Controlled caller regression only. No player save, ROM execution or visual
// claim. The original CPU selector vector supplies the profile; a one-command
// training timeline exercises the actual state-11 completion path.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeRaisingActor,initializeNativeRaisingActor,stepNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {evaluateNativeEvolution,NATIVE_RAISING_LIFECYCLE_RULES as rules} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {createNativeTrainingTimeline} from '../src/championship/raising/nativeRaisingTraining.js';

const receipt=JSON.parse(readFileSync(new URL('../docs/research/RAISING_LIFECYCLE_CPU_CHECK_2026-09-08.json',import.meta.url)));
const vector=receipt.evolution.find(row=>row.speciesIndex===34&&row.rank===0&&row.lifetime===0&&row.result===2&&row.after.fields['04c']===1);
assert.ok(vector,'existing original CPU selector vector is required');
const baseLife=rules.species[34].life,extendedLife=vector.actor['428'];

function harness(profile){
  const draws=[],rng={next(channel){draws.push(channel);return 51;}};
  const actor=createNativeRaisingActor(profile,0);
  initializeNativeRaisingActor(actor,profile,[409600,409600,0],35,rng);
  actor.evolutionChecked=true;
  // Flat ground is a declared boundary stub; no movement or food is requested.
  const feeding={ground:{readTerrain:()=>0,readClearance:()=>3,width:84,height:24,pixelWidth:672},foods:[],signals:new Map(),actors:[actor]};
  const lifecycle={rank:0,minute:600,season:0,roster:[34],residents:[profile],wasteCount:0,rottenFoodCount:0,spawnWaste:()=>true};
  const step=()=>{
    lifecycle.residents=[profile];
    const result=stepNativeRaisingActor(actor,profile,{ageDelta:0,rng,feeding,lifecycle});
    profile=result.profile;return result;
  };
  return {actor,draws,rng,step,get profile(){return profile;},set profile(value){profile=value;}};
}

function train(){
  const h=harness({version:1,...structuredClone(vector.before)});
  h.actor.state=11;
  h.actor.training=createNativeTrainingTimeline([{kind:0,delta:0,outcome:'APPLIED'}]);
  let frames=0;
  while(h.actor.state===11&&frames++<200)h.step();
  assert.equal(h.actor.state,1,'training completed through the actual caller');
  assert.ok(frames>60&&frames<200,'the normal label timeline was not skipped');
  return h;
}

function prepareIdle(h,age){
  const p=structuredClone(h.profile);
  p.fields['18c']=age;p.fields['00c']=0;p.fields['190']=0;p.fields['178']=10000;
  h.profile=p;h.actor.state=1;h.actor.evolutionChecked=true;h.actor.idleCounter=1000000;h.actor.idleElapsed=0;
}

test('training completion carries both selector profile and extended lifetime into the live actor',()=>{
  const h=train();
  const selected=evaluateNativeEvolution({version:1,...structuredClone(vector.before)},{rank:0,roster:[34]},h.rng);
  assert.equal(selected.code,2);assert.equal(selected.actor['428'],extendedLife);
  assert.equal(h.profile.fields['04c'],selected.profile.fields['04c']);
  assert.equal(h.actor.growthFields['428'],extendedLife);
  assert.equal(h.profile.fields['020'],vector.before.fields['020']+1,'training affection still increments once');
  assert.equal(h.profile.narrowFields['03c'],vector.before.narrowFields['03c'],'training does not rebirth');
  assert.deepEqual(h.draws,[38,38,38,38],'no selector RNG or extra RNG consumption was added');
});

for(const age of [baseLife,baseLife+1,extendedLife,extendedLife+1]){
  test(`live and reconstructed training results agree at age ${age}`,()=>{
    const live=train();prepareIdle(live,age);
    const restored=harness(structuredClone(live.profile));prepareIdle(restored,age);
    assert.equal(live.actor.growthFields['428'],restored.actor.growthFields['428']);
    live.draws.length=0;restored.draws.length=0;
    const a=live.step(),b=restored.step();
    assert.deepEqual(a.profile,b.profile,'the same age and native profile yield the same writes');
    assert.equal(!!a.evolutionStarted,!!b.evolutionStarted);
    assert.equal(live.actor.evolution?.target,restored.actor.evolution?.target);
    assert.deepEqual(live.draws,restored.draws,'lifetime selection preserves RNG order');
    if(age<=extendedLife){
      assert.equal(!!a.evolutionStarted,false,'strict greater-than lifetime boundary is preserved');
      assert.equal(a.profile.narrowFields['03c'],vector.before.narrowFields['03c']);
    }else{
      assert.equal(a.evolutionStarted,true);
      assert.equal(live.actor.evolution.target,7,'existing forced rebirth target is preserved');
      assert.equal(a.profile.narrowFields['03c'],vector.before.narrowFields['03c']+1);
    }
  });
}
