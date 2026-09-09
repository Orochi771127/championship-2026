import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { initializeNativeHuntAi, nativeHuntInitialSpeed, groupNativeHuntActors } from "../src/championship/hunt/capture/nativeHuntActorInitialization.js";
import { generateNativeHuntEncounter } from "../src/championship/hunt/capture/nativeHuntGeneration.js";
const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_ACTOR_ENTRY_CPU_CHECK_2026-09-06.json", "utf8"));
const pool = JSON.parse(fs.readFileSync("docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json", "utf8"));

function checkedRng(vector) {
  const source = restoreChannelRng(vector.rngBefore);
  let index = 0;
  return { next(channel) {
    const call = vector.rolls[index++];
    assert.ok(call, `unexpected RNG draw ${index}`);
    assert.equal(channel, call.channel, `RNG channel ${index}`);
    const value = source.next(channel);
    assert.equal(value, call.value, `RNG value ${index}`);
    return value;
  }, finish() { assert.equal(index, vector.rolls.length); assert.deepEqual(source.snapshot(), vector.rngAfter); } };
}

test("AI initialization matches 721 original CPU boundary cases, including the zero first heading roll", () => {
  assert.equal(cpu.aiVectors.length, 721);
  for (const v of cpu.aiVectors) {
    let n = 0;
    const result = initializeNativeHuntAi({ next(channel) {
      assert.equal(channel, v.calls[n].channel); return v.draws[n++];
    } });
    assert.equal(n, 3);
    assert.equal(result.field054 >>> 0, v.fields["054"]);
    assert.equal(result.field1d8, v.fields["1d8"]);
    assert.equal(result.field1e0, v.fields["1e0"]);
    assert.equal(result.followTarget, v.fields["1e4"]);
  }
});

test("all 228 species and 9 traits match original CPU initial speed", () => {
  assert.equal(cpu.speedVectors.length, 2052);
  for (const v of cpu.speedVectors) assert.equal(nativeHuntInitialSpeed(cpu.speciesInputs[v.speciesIndex], v.trait), v.speedQ12);
});

test("same-species grouping matches native positions, query order and full RNG, including 64 blocked attempts", () => {
  for (const v of cpu.groupVectors) {
    const rng = checkedRng(v);
    let query = 0;
    const saved = structuredClone(v.before);
    const actual = groupNativeHuntActors(v.before, { rng, firstIndex:v.firstIndex, readTerrain(x,y) {
      const expected = v.queries[query++];
      assert.deepEqual([x >>> 0,y >>> 0], expected.tile);
      return expected.terrain;
    } });
    assert.deepEqual(actual, v.after, v.case);
    assert.deepEqual(v.before, saved, "caller actors remain unchanged");
    assert.equal(query, v.queries.length);
    rng.finish();
  }
});

test("complete generation independently requests all 492 original entry RNG draws and produces the observed actors", () => {
  const v = cpu.entry, source = pool.poolVectors[0];
  assert.deepEqual(v.rngBefore, source.rngBefore);
  const rng = checkedRng(v);
  const repairs = v.events.filter(e => e.kind === "spawn-terrain-repair");
  const repairQueries = repairs.flatMap(e => e.queries);
  const groupQueries = v.events.filter(e => e.kind === "group-terrain-query");
  let repairIndex = 0, groupIndex = 0;
  const environment = { width:128, height:128,
    isBlocked(x,y) { const q = repairQueries[repairIndex++]; assert.deepEqual([x >>> 0,y >>> 0], q.tile); return q.blocked; },
    readTerrain(x,y) { const q = groupQueries[groupIndex++]; assert.deepEqual([x >>> 0,y >>> 0], q.tile); return q.terrain; } };
  const effect = v.events.find(e => e.kind === "scene-effect-input");
  assert.ok(effect, "actual scene effect descriptor is required");
  const result = generateNativeHuntEncounter({ baseCount:source.baseCount, candidateInput:source.candidateInput,
    speciesByIndex:i => ({ ...pool.speciesInputs[i], ...cpu.speciesInputs[i] }), rng, environment,
    sceneEffect:{ primaryPresent:effect.primaryPresent, threshold:effect.threshold, secondaryPresent:effect.secondaryPresent, parameter:effect.parameter } });
  const before = v.events.find(e => e.kind === "group-boundary" && e.pc === "0x211b118");
  const after = v.events.find(e => e.kind === "group-boundary" && e.pc === "0x211b2f0");
  const constructors = v.events.filter(e => e.kind === "ai-constructor");
  const speeds = v.events.filter(e => e.kind === "ai-individual-bind");
  assert.equal(result.actors.length, 15);
  result.actors.forEach((actor,i) => {
    assert.equal(actor.speciesIndex, after.wildRecords[i].speciesIndex);
    assert.equal(actor.individual.fields["050"], after.wildRecords[i].wildHp);
    assert.deepEqual(actor.positionQ12.slice(0,2), after.wildRecords[i].positionQ12);
    assert.equal(actor.ai.field1d8, constructors[i].values["0x1d8"]);
    assert.equal(actor.ai.field1e0, constructors[i].values["0x1e0"]);
    assert.equal(actor.ai.speedQ12, speeds[i].speedQ12);
    assert.equal(actor.individual.name, source.records[i].name);
    assert.deepEqual(actor.individual.narrowFields, source.records[i].narrowFields);
    for (const [key,value] of Object.entries(source.records[i].fields)) assert.equal(actor.individual.fields[key], key === "004" ? i : value);
  });
  assert.equal(Number(result.sceneEffect.triggered), after.sceneEffectActive);
  assert.equal(before.rngOffset, 466);
  assert.equal(repairIndex, repairQueries.length); assert.equal(groupIndex, groupQueries.length);
  rng.finish();
});

test("missing scene/environment sources and unclosed carried actor cannot consume caller RNG", () => {
  const v = pool.poolVectors[0];
  let draws = 0;
  const args = { baseCount:v.baseCount, candidateInput:v.candidateInput,
    speciesByIndex:i => ({ ...pool.speciesInputs[i], ...cpu.speciesInputs[i] }),
    rng:{ next() { draws++; throw new Error("unexpected draw"); } },
    environment:{ width:128, height:128, isBlocked:() => false, readTerrain:() => 0 },
    sceneEffect:{ threshold:30, primaryPresent:false, secondaryPresent:false, parameter:0 } };
  assert.throws(() => generateNativeHuntEncounter({ ...args, sceneEffect:null }), /SCENE_EFFECT_REQUIRED/);
  assert.throws(() => generateNativeHuntEncounter({ ...args, environment:null }), /ENVIRONMENT_REQUIRED/);
  assert.throws(() => generateNativeHuntEncounter({ ...args, carried:{} }), /CARRIED_ACTOR_REQUIRES_TRACE/);
  assert.equal(draws,0);
});
