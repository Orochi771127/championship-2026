import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyNativeFoodFrame, applyNativeMedicine, applyNativeRaisingCondition } from "../src/championship/raising/nativeRaisingCare.js";
import { nativeIndividualProfile } from "../src/championship/raising/nativeIndividualProfile.js";
import { createNativeRaisingStarter } from "../src/championship/raising/nativeRaisingStarter.js";
import { restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";

const oracle = JSON.parse(fs.readFileSync("docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json","utf8"));
test("food per-frame writer matches 168 original CPU cases across every generation and protein",()=>{
  for (const row of oracle.bites) {
    const result=applyNativeFoodFrame(nativeIndividualProfile(row.before),{...row.input,satietyMaximum:8,
      animationFrame:1,food:{remaining:row.input.remaining,freshness:100,present:true,protein:row.input.protein}});
    assert.deepEqual(result.profile,nativeIndividualProfile(row.after),JSON.stringify(row.input));
    assert.equal(result.food.remaining,row.remaining);assert.equal(result.food.present,!!row.present);
    assert.equal(result.sound,row.calls.find(c=>c.kind==="audio")?.id??null);
    assert.equal(result.leave,row.calls.some(c=>c.kind==="unregister"));
    assert.equal(result.reaction,row.calls.find(c=>c.kind==="reaction")?.id??null);
  }
});
test("condition writes match all 90 CPU boundaries, including signed lower overflow and unknown kind no-op",()=>{
  for(const row of oracle.conditions) assert.deepEqual(applyNativeRaisingCondition(nativeIndividualProfile(row.before),
    {kind:row.kind,delta:row.delta,satietyMaximum:8}),nativeIndividualProfile(row.after));
});
test("medicine matches 140 CPU cases and draws the per-slot RNG only for the affected condition",()=>{
  for (const row of oracle.medicines) {
    const calls=[];
    const result=applyNativeMedicine(nativeIndividualProfile(row.before),{kind:row.kind,generation:row.generation,poolSlot:0,mode:0,
      rng:{next:channel=>{calls.push(channel);return row.roll;}}});
    assert.deepEqual(result.profile,nativeIndividualProfile(row.after));
    assert.equal(result.success,!!row.success);
    assert.deepEqual(calls,row.calls.filter(c=>c.kind==="rng").map(c=>c.channel));
    if(row.condition)assert.equal(result.reaction,row.reaction);
  }
});
test("new-game individual matches the complete original constructor plus 0206178C starter writes",()=>{
  const result=createNativeRaisingStarter(restoreChannelRng(oracle.starterRng));
  assert.deepEqual(result,nativeIndividualProfile(oracle.starter));
});
test("one animation frame cannot consume repeatedly; frame zero rearms the next bite",()=>{
  const profile=nativeIndividualProfile(oracle.bites[24].before);
  const input={generation:1,satietyMaximum:8,food:{remaining:20,freshness:100,present:true,protein:false},animationFrame:1};
  const first=applyNativeFoodFrame(profile,input);
  const repeated=applyNativeFoodFrame(first.profile,{...input,food:first.food,biteLatched:first.biteLatched});
  assert.deepEqual(repeated.profile,first.profile);assert.equal(repeated.food.remaining,19);
  const reset=applyNativeFoodFrame(repeated.profile,{...input,food:repeated.food,biteLatched:true,animationFrame:0});
  const next=applyNativeFoodFrame(reset.profile,{...input,food:reset.food,biteLatched:reset.biteLatched});
  assert.equal(next.food.remaining,18);
});
