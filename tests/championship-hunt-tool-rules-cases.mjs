import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { nativeRopeParameters, nativeToolEffectiveness, nativeShotReaction, stepNativeRopeController } from "../src/championship/hunt/capture/nativeHuntToolRules.js";
const cpu = JSON.parse(fs.readFileSync("reports/hunt-core-two-stage-2026-09-08/tool-rules-cpu.json", "utf8"));
import { stepNativeWildStatus,stepNativeBindingBounce } from "../src/championship/hunt/capture/nativeWildStatus.js";

test("native poison, delayed stun, blindness, fatigue and recovery boundaries match ARM writes",()=>{
  for(const row of cpu.wildStatus){
    const calls=[];
    const result=stepNativeWildStatus(row.before,max=>{calls.push(["wild",max]);return row.sample;});
    assert.deepEqual(result.state,row.after,JSON.stringify(row.before));
    assert.deepEqual(calls,row.rngCalls);
    assert.equal(result.effects.includes("ENTER_AI17"),row.events.includes(17));
  }
});
test("binding bounce completes on the original seven updates and resets height",()=>{
  for(const row of cpu.bindingBounce){
    const {zQ12,...bounce}=row.before;
    const result=stepNativeBindingBounce(bounce,zQ12);
    assert.deepEqual({...result.bounce,zQ12:result.zQ12},row.after);
  }
});

test("all 228 species × 12 ropes read the same rate as the original ARM branch", () => {
  assert.equal(cpu.ropeRates.length, 228 * 12);
  for (const [species, rope, damageQ12] of cpu.ropeRates) {
    assert.equal(nativeRopeParameters(rope, species, 210).damageQ12, damageQ12, `species ${species} rope ${rope}`);
  }
});
test("13 native effectiveness selectors preserve distraction and blindness override", () => {
  for (const { speciesIndex, override, values } of cpu.effectiveness) {
    for (const [selector, expected] of values.entries()) {
      assert.equal(nativeToolEffectiveness(speciesIndex, selector,
        { distracted:Number(override === 1), blinded:Number(override === 2) }), expected);
    }
  }
});
test("shot shake, wake counter, reaction and conditional RNG match native instructions", () => {
  for (const row of cpu.shotReactions) {
    const rngCalls = [];
    const state = { speciesIndex:row.speciesIndex, shotShakeTicks:850, positionQ12:[300*4096,200*4096,0],
      maxAwakeCounter:359, awakeCounter:7, distracted:0, blinded:0 };
    const result = nativeShotReaction(state, row, {
      nextChannel(channel) { rngCalls.push(["channel", channel]); return row.sample; },
      wildRandom(max) { rngCalls.push(["wild", max]); return row.sample; }
    });
    const label = JSON.stringify(row);
    for (const key of ["shotShakeTicks", "returnAiState", "awakeCounter"]) assert.equal(result[key], row[key], label);
    if (row.statusSelector === 0) assert.deepEqual(result.destinationQ12, row.destinationQ12, label);
    assert.deepEqual(rngCalls, row.rngCalls, label);
  }
});
test("rope cap transitions preserve the original update lag and return transitions", () => {
  let rope = nativeRopeParameters(0, 8, 210), hp = 1000;
  for (const row of cpu.ropeTransitions) {
    const result = stepNativeRopeController(rope, hp, { dxQ12:row.distance*4096, dyQ12:0, movementBlocked:true });
    rope = result.rope; hp = result.currentHp;
    assert.equal(hp, row.hp); assert.equal(rope.durability, row.durability);
    assert.equal(rope.maxDurability, row.cap); assert.equal(rope.accumulatorQ12, row.accumulatorQ12);
    assert.equal(rope.controllerState, row.state);
    // The surrounding state sends 25/13 separately from numerical function.
    assert.equal(result.event, row.events[0] ?? null);
  }
});
