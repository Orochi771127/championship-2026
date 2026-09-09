import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { createNativeHuntIndividual, updateNativeHuntIndividual } from "../src/championship/hunt/capture/nativeHuntIndividual.js";
import { expandNativeHuntCandidates, generateNativeHuntIndividualPool } from "../src/championship/hunt/capture/nativeHuntIndividualPool.js";

const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json", "utf8"));
const speciesByIndex = (i) => cpu.speciesInputs[i];
function compareIndividual(actual, expected, message) {
  assert.equal(actual.name, expected.name, `${message}: name`);
  assert.deepEqual(actual.narrowFields, expected.narrowFields, `${message}: narrow fields`);
  for (const [offset, value] of Object.entries(expected.fields)) {
    assert.equal(actual.fields[offset], value, `${message}: +${offset}`);
  }
}
function checkedRng(vector) {
  const source = restoreChannelRng(vector.rngBefore);
  let cursor = 0;
  return {
    next(channel) {
      const call = vector.rolls[cursor++];
      assert.ok(call, `unexpected RNG draw ${cursor}, channel ${channel}`);
      assert.equal(channel, call.channel, `RNG call ${cursor}: channel`);
      const value = source.next(channel);
      assert.equal(value, call.value, `RNG call ${cursor}: result`);
      return value;
    },
    assertFinished() {
      assert.equal(cursor, vector.rolls.length);
      assert.deepEqual(source.snapshot(), vector.rngAfter);
    },
  };
}

test("all 228 original species match constructor, post-update and continuing RNG", () => {
  assert.equal(cpu.individualVectors.length, 228);
  const rng = checkedRng({ rngBefore:cpu.individualRngBefore, rngAfter:cpu.individualRngAfter, rolls:cpu.individualVectors.flatMap(v => v.rolls) });
  for (const vector of cpu.individualVectors) {
    const actual = createNativeHuntIndividual({ species: speciesByIndex(vector.speciesIndex), rng });
    compareIndividual(actual, vector.before, `species ${vector.speciesIndex} constructor`);
    updateNativeHuntIndividual(actual, { speciesByIndex, rng });
    compareIndividual(actual, vector.after, `species ${vector.speciesIndex} post-update`);
  }
  rng.assertFinished();
});

test("complete pool selection executes constructor and post-update without a scripted draw schedule", () => {
  assert.equal(cpu.poolVectors.length, 4);
  for (const vector of cpu.poolVectors) {
    const rng = checkedRng(vector);
    const candidates = expandNativeHuntCandidates(vector.candidateInput);
    assert.deepEqual(candidates, vector.candidates);
    const result = generateNativeHuntIndividualPool({ baseCount: vector.baseCount, candidates, speciesByIndex, rng, released:vector.released });
    assert.equal(result.releasedCandidateConsumed, vector.released !== null);
    assert.equal(result.records.length, vector.records.length);
    result.records.forEach((r, i) => compareIndividual(r, vector.records[i], `${vector.case} individual ${i}`));
    rng.assertFinished();
  }
  assert.notDeepEqual(cpu.poolVectors[0].records, cpu.poolVectors[1].records);
});

test("candidate weights follow native modifier bytes, including odd rounding and exhausted entries", () => {
  assert.equal(cpu.candidateVectors.length, 6);
  for (const vector of cpu.candidateVectors) assert.deepEqual(expandNativeHuntCandidates(vector.input), vector.candidates, vector.case);
});

test("carried individual remains slot zero, preserves existing stats and returns the original history write", () => {
  const v = JSON.parse(fs.readFileSync("docs/research/HUNT_CARRIED_POOL_CPU_CHECK_2026-09-06.json", "utf8")).poolVectors[0];
  const rng = checkedRng(v), before = structuredClone(v.carried);
  const result = generateNativeHuntIndividualPool({ baseCount:v.baseCount, candidates:v.candidates, speciesByIndex,
    rng, carried:v.carried, released:v.released });
  assert.equal(result.records.length, v.records.length);
  result.records.forEach((r,i) => compareIndividual(r,v.records[i],`carried pool ${i}`));
  assert.deepEqual(result.historyWrite, v.historyWrite);
  assert.deepEqual(v.carried, before);
  rng.assertFinished();
});

test("invalid carried and released inputs fail before any RNG consumption", () => {
  const v = cpu.poolVectors[0];
  let draws = 0;
  const args = { baseCount:v.baseCount, candidates:v.candidates, speciesByIndex, rng: { next() { draws++; throw new Error("unexpected draw"); } } };
  assert.throws(() => generateNativeHuntIndividualPool({ ...args, carried:{} }), /CARRIED_RECORD_INPUT_REQUIRED/);
  assert.throws(() => generateNativeHuntIndividualPool({ ...args, released:{} }), /RELEASED_RECORD_INPUT_REQUIRED/);
  assert.throws(() => generateNativeHuntIndividualPool({ ...args, candidates:[] }), /ENCOUNTER_INPUT_REQUIRED/);
  assert.equal(draws, 0);
});
