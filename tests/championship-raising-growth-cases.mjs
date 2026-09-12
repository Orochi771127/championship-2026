import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {nativeIndividualProfile} from "../src/championship/raising/nativeIndividualProfile.js";
import {applyNativeRaisingGrowth} from "../src/championship/raising/nativeRaisingGrowth.js";
import { RECOVERY_CAGE_VFX_DURATION_MS, isRecoveryCageDefinition, recoveryCageVfxFrame,
  shouldStartRecoveryCageVfx } from "../src/championship/presentation/vfx/recoveryCageVfx.js";
const oracle=JSON.parse(fs.readFileSync("docs/research/RAISING_GROWTH_CPU_CHECK_2026-09-08.json","utf8"));
test("growth profile, transient counters, condition edges and RNG agree with 768 complete native calls",()=>{
  for(const [i,row] of oracle.cases.entries()) {
    const calls=[];
    const result=applyNativeRaisingGrowth(nativeIndividualProfile(row.before),row.actorBefore,
      {...row.input,peerCount:0,satietyMaximum:8},{next:channel=>{calls.push({kind:"rng",channel});return row.input.roll;}});
    assert.deepEqual(result.profile,nativeIndividualProfile(row.after),`profile case ${i}`);
    assert.deepEqual(result.actorFields,row.actorAfter,`actor case ${i}`);
    assert.deepEqual(calls,row.calls.filter(c=>c.kind==="rng"),`RNG case ${i}`);
    assert.deepEqual(result.events,row.calls.filter(c=>c.kind==="audio"),`audio case ${i}`);
  }
});

test("infirmary VFX acknowledges only a real HP increase in the verified recovery cage",()=>{
  assert.equal(isRecoveryCageDefinition(15),true);
  assert.equal(isRecoveryCageDefinition(14),false);
  assert.equal(shouldStartRecoveryCageVfx(
    {currentHp:80,cageDefinitionIndex:15},{currentHp:81,cageDefinitionIndex:15}),true);
  assert.equal(shouldStartRecoveryCageVfx(
    {currentHp:80,cageDefinitionIndex:14},{currentHp:81,cageDefinitionIndex:14}),false);
  assert.equal(shouldStartRecoveryCageVfx(
    {currentHp:80,cageDefinitionIndex:15},{currentHp:80,cageDefinitionIndex:15}),false);
  assert.equal(recoveryCageVfxFrame(0).visible,true);
  assert.ok(recoveryCageVfxFrame(180).alpha>0);
  assert.equal(recoveryCageVfxFrame(RECOVERY_CAGE_VFX_DURATION_MS).visible,false);
});
