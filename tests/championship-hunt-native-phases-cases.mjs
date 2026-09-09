import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { enterNativeAi10, stepNativeAi10Motion, stepNativeDownClock, stepNativeHandController,
  stepNativeAi8PullEvents, nativeWildRandom } from "../src/championship/hunt/capture/nativeCapturePhases.js";
import { sampleNativeRopeStroke, recognizeNativeRopeStroke, expireNativeRopeSlots, isNativeHuntEdgeTouch } from "../src/championship/hunt/capture/nativeRopeStroke.js";
import { createWildCaptureFlow } from "../src/championship/hunt/capture/wildCaptureFlow.js";
const receipt = JSON.parse(fs.readFileSync("docs/research/HUNT_NATIVE_PHASE_REPLAY_2026-09-05.json", "utf8"));
const signed = (n) => n | 0;
const clock = (a) => ({ ticks: a[0], shakeX: signed(a[1]), shakeY: signed(a[2]), toggle: a[3] });
const fields = (target) => ({ restrictedTicks: target.aiFields["0x1b0"], movementRestricted: target.movementRestricted,
  pull13: target.aiFields["0x58"], pull11: target.aiFields["0x84"], escapeCounter: target.aiFields["0x98"] });

test("AI8 event 11/13 prefix matches every native call and consumes stun RNG in exact order", () => {
  let before, events = [], random = [], count = 0, starts = 0;
  for (const e of receipt.events) {
    if (e.pc === "0x2110cac") { before = e; events = []; random = []; }
    if (e.pc === "0x2110d0c" && e.r0) events.push(0x13);
    if (e.pc === "0x2110dc8" && e.r0) events.push(0x11);
    if (e.wildRandom) random.push(e.wildRandom);
    if (e.pc !== "0x2110e10") continue;
    const next = stepNativeAi8PullEvents(fields(before.target), events, (max) => {
      const value = random.shift(); assert.equal(value?.max, max); return value.value;
    });
    const { poseRequest, movementMode, ...actual } = next;
    assert.deepEqual(actual, fields(e.target), `frame ${e.tick}`);
    assert.equal(random.length, 0);
    if (before.target.aiFields["0x1b0"] === 0 && next.restrictedTicks > 0) starts++;
    count++;
  }
  assert.equal(count, 207); assert.ok(starts >= 1);
});

test("AI10 entry normalization and every collision-checked motion match the live target", () => {
  let entry, before, blocked, count = 0;
  for (const e of receipt.events) {
    if (e.pc === "0x2111744") entry = e.target;
    if (e.pc === "0x2111800") {
      before = e.target;
      if (entry) {
        const next = enterNativeAi10(entry.worldQ12, [entry.aiFields["0x6c"], entry.aiFields["0x70"]].map(signed));
        assert.deepEqual(next.velocityQ12, [before.aiFields["0x78"], before.aiFields["0x7c"]].map(signed));
        assert.deepEqual(next.clock, clock(before.downClock)); entry = null;
      }
    }
    if (e.collisionBlocked !== undefined) blocked = e.collisionBlocked;
    if (e.pc !== "0x21118b4") continue;
    const next = stepNativeAi10Motion(before.worldQ12, [before.aiFields["0x78"], before.aiFields["0x7c"]].map(signed), () => blocked);
    assert.deepEqual(next.positionQ12, e.target.worldQ12, `frame ${e.tick}`);
    assert.deepEqual(next.velocityQ12, [e.target.aiFields["0x78"], e.target.aiFields["0x7c"]].map(signed));
    count++;
  }
  assert.equal(count, 15);
  const blockedMotion = stepNativeAi10Motion([1, -4097], [-3, 5], (x, y) => { assert.deepEqual([x, y], [0, 0]); return true; });
  assert.deepEqual(blockedMotion.positionQ12, [1, -4097]);
  assert.deepEqual(blockedMotion.velocityQ12, [-1, 2]);
});

test("wild shake countdown uses native odd-tick ordering and matches every observed update", () => {
  let before, active = 0;
  for (const e of receipt.events) {
    if (e.pc === "0x210bf2c") before = e.target;
    if (e.pc !== "0x210bfb8") continue;
    const next = stepNativeDownClock(clock(before.downClock), before.worldQ12);
    assert.deepEqual(next.clock, clock(e.target.downClock), `frame ${e.tick}`);
    assert.deepEqual(next.positionQ12, e.target.worldQ12);
    if (before.downClock[0]) active++;
  }
  assert.equal(active, 15);
});

test("hand controller matches all 94 pre-insertion updates, with one card write at native frame 480", () => {
  const counts = [0, 0, 0, 0], effects = [];
  for (const e of receipt.events.filter((e) => e.handController && e.handController.phase < 4)) {
    const next = stepNativeHandController(e.handController);
    const frame = receipt.frames.find((f) => f.tick === e.tick);
    assert.deepEqual(next.controller, frame.handController, `frame ${e.tick}`);
    assert.equal(next.insert, frame.cardCount === 1);
    effects.push(...next.effects.map((effect) => [e.tick, effect]));
    counts[e.handController.phase]++;
  }
  assert.deepEqual(counts, [41, 11, 31, 11]);
  assert.deepEqual(effects, [[396, "HIDE_WILD"], [427, "HAND_LIFT"], [438, "CARD_FLIGHT"], [469, "CARD_ARRIVAL"], [480, "INSERT_CARD"]]);
  assert.equal(stepNativeHandController({ phase: 4, counter: 0 }).insert, false);
});

const sampler = (s) => ({ last: s.last.map(signed), next: s.next, count: s.count, counter: s.counter,
  slots: s.slots.map((slot) => slot.variant === 0xffffffff ? null : { variant: slot.variant, positionQ12: slot.positionQ12.map(signed) }) });
test("native stylus samples preserve ring slots, Q12 interpolation and the original circle center", () => {
  let before, count = 0, centerCount = 0;
  for (const e of receipt.events) {
    if (e.sampleInput) before = e;
    if (["0x2114040", "0x21141d8", "0x2114298"].includes(e.pc)) {
      const prior = sampler(before.sampler), expected = sampler(e.sampler);
      let cursor = prior.next;
      const actual = sampleNativeRopeStroke(prior, before.sampleInput, before.target.camera, () => {
        const variant = expected.slots[cursor].variant; cursor = (cursor + 1) % 20; return variant;
      });
      assert.deepEqual(actual, expected, `sample frame ${e.tick}`); count++;
    }
    if (e.shapeCenterQ12) {
      assert.deepEqual(recognizeNativeRopeStroke(sampler(e.sampler)).centerQ12, e.shapeCenterQ12);
      centerCount++;
    }
  }
  assert.equal(count, 18); assert.equal(centerCount, 1);
});

test("slot completion is idempotent; edge-zone boundaries use native coordinates", () => {
  const s = sampler(receipt.events.find((e) => e.shapeCenterQ12).sampler);
  const expired = expireNativeRopeSlots(s, [2, 2]);
  assert.equal(expired.count, s.count - 1);
  assert.equal(expired.slots[2], null);
  assert.equal(isNativeHuntEdgeTouch(16, 80), true);
  assert.equal(isNativeHuntEdgeTouch(17, 175), false);
  assert.equal(isNativeHuntEdgeTouch(120, 176), true);
});

test("native clocks close down/hand/card in the existing flow and reject early completion callbacks", () => {
  const flow = createWildCaptureFlow({ wildId: "wild:clock", speciesId: "species-010", traceId: "phase-clock-test",
    hp: { currentHp: 1, maxHp: 210 }, gCost: 12,
    rope: { generation: 1, coefficient: 1, durabilityByte: 10, temperament71: 0 } });
  flow.attach(); flow.tickPull({ dxQ12: 56 * 4096, dyQ12: 0 });
  assert.equal(flow.snapshot().state, "DOWN_ANIMATION");
  for (let i = 0; i < 15; i++) {
    flow.tickNativePhases();
    assert.equal(flow.snapshot().state, "DOWN_ANIMATION");
    assert.equal(flow.completeDownAnimation(), false);
  }
  assert.deepEqual(flow.tickNativePhases().effects, ["HAND_READY"]);
  assert.equal(flow.hand({ maxG: 12, usedG: 0 }).accepted, true);
  for (let i = 0; i < 93; i++) {
    assert.equal(flow.tickNativePhases().inserted, false);
    assert.equal(flow.tickCardInsertionPhase(), false);
    assert.equal(flow.snapshot().nativePhase.wildHidden, i >= 9);
  }
  assert.equal(flow.tickNativePhases().inserted, true);
  assert.equal(flow.snapshot().state, "ON_CARD");
  assert.equal(flow.tickNativePhases().inserted, false);
  assert.equal(flow.snapshot().sourceVitals.currentHp, 1);
});

test("wild RNG selects B2/B3 from channel-zero parity and scales endpoints", () => {
  for (const parity of [0, 1, 102]) {
    const channels = [];
    assert.equal(nativeWildRandom(80, (channel) => { channels.push(channel); return channel === 0 ? parity : 102; }), 79);
    assert.deepEqual(channels, [0, parity % 2 ? 0xB3 : 0xB2]);
  }
});
