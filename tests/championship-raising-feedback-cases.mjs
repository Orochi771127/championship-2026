import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeRaisingFeedbackPosition,stepNativeRaisingStatusFeedback} from '../src/championship/raising/nativeRaisingFeedback.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,interruptNativeRaisingFeeding,projectNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {beginNativeActivityReaction} from '../src/championship/raising/nativeRaisingActivity.js';
const cpu=JSON.parse(fs.readFileSync('docs/research/RAISING_FEEDBACK_CPU_2026-09-10.json'));

test('56 encoded reactions retain original fixed-frame selection and native placement',()=>{
  for(const row of cpu.placements){
    assert.deepEqual(nativeRaisingFeedbackPosition(row.positionQ12,row.width,row.height,row.flip,row.encoded&127),row.outputPositionQ12);
    const call=row.calls[0];assert.equal(call.sequence,row.encoded&127);
    assert.equal(call.address,row.encoded>>8?'020479A4':'02047904');
    if(row.encoded>>8)assert.equal(call.frame,row.encoded>>8);
  }
});

test('all 96 native status combinations and 23136 updates retain rotation and sleep priority',()=>{
  for(const row of cpu.statuses){
    const actor={state:row.state,statusMusic:row.music,growthFields:{'418':row.hungry,'404':row.stress}};
    const profile={fields:{'134':row.sick,'138':row.wound}};
    let sample=0;
    for(let tick=1;tick<=row.updates;tick++){
      stepNativeRaisingStatusFeedback(actor,profile);
      if(row.samples[sample+1]?.[0]<=tick)sample++;
      assert.equal(actor.statusCode,row.samples[sample][1],`tick ${tick}: ${JSON.stringify(row)}`);
    }
  }
});

test('re-entering idle preserves a partially played Main frame and only spends the native idle draw',()=>{
  const rng={calls:[],next(channel){this.calls.push(channel);return 51;}};
  const native=createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(34),rng});
  const profile=nativeIndividualProfile(native),actor=createNativeRaisingActor(profile,0);
  initializeNativeRaisingActor(actor,profile,[100*4096,80*4096,0],0,rng);
  actor.animator.advanceNative(7*4096);const before=actor.animator.getSnapshot(),count=rng.calls.length;
  interruptNativeRaisingFeeding(actor,[],rng);
  assert.deepEqual(actor.animator.getSnapshot(),before);assert.deepEqual(rng.calls.slice(count),[0x26]);
  beginNativeActivityReaction(actor,27,{readClearance:()=>4},()=>{});
  assert.equal(projectNativeRaisingActor(actor).feedback.cell,35);
  assert.equal(projectNativeRaisingActor(actor).feedback.active,0);
  interruptNativeRaisingFeeding(actor,[],rng);assert.equal(projectNativeRaisingActor(actor).feedback,null);
});
