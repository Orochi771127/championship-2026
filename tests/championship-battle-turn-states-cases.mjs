// Turn states — what a committed action passes through before it lands.
//
// The load-bearing fact is the three launch slots: state 15 fills one and
// states 6 and 7 gate on one being free. Two halves of the same array, read
// from opposite ends, and they agree.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_TURN_ABORT_STATE,
  BATTLE_TURN_APPROACH_STATES,
  BATTLE_TURN_EVIDENCE,
  BATTLE_TURN_FIELD17C_RANGE,
  BATTLE_TURN_FREE_SLOT_SITE,
  BATTLE_TURN_INFLIGHT_SLOT_COUNT,
  BATTLE_TURN_INFLIGHT_SLOT_OFFSET,
  BATTLE_TURN_LAUNCH_ABORT_CODES,
  BATTLE_TURN_LAUNCH_ALLOCATION_FAILED,
  BATTLE_TURN_LAUNCH_ABORTED,
  BATTLE_TURN_LAUNCH_ALLOCATOR_SITE,
  BATTLE_TURN_LAUNCH_DONE,
  BATTLE_TURN_LAUNCH_NOTIFY_BASE,
  BATTLE_TURN_LAUNCH_NO_SLOT,
  BATTLE_TURN_LAUNCH_PROCEED,
  BATTLE_TURN_LAUNCH_RELEASED,
  BATTLE_TURN_LAUNCH_TALLY_STEP,
  BATTLE_TURN_SUSPEND_MASK,
  BATTLE_TURN_WAIT_STATES,
  actionInterrupted,
  commitInterrupted,
  firstFreeLaunchSlot,
  hasFreeLaunchSlot,
  launchNotifyCode,
  launchStateAborts,
  planLaunch,
  resolveLaunch,
  runWaitToLaunchState
} from "../src/championship/battle/battleTurnStates.js";

import { BATTLE_STATE_ACTION_GATE, BATTLE_STATE_SUSPEND_MASK } from "../src/championship/battle/battleStateMachine.js";
import { listStateTransitions } from "../src/championship/battle/battleStateGraph.js";
import { listBattleCatalogRecords } from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const empty = () => [0, 0, 0];

test("the launch slots are three words at +0x78", () => {
  assert.equal(BATTLE_TURN_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_TURN_INFLIGHT_SLOT_COUNT, 3);
  assert.equal(BATTLE_TURN_INFLIGHT_SLOT_OFFSET, 0x78);
  assert.equal(BATTLE_TURN_FREE_SLOT_SITE, "OVL19:0x02114464");
  assert.equal(BATTLE_TURN_LAUNCH_ALLOCATOR_SITE, "OVL19:0x0210F8C4");

  assert.equal(hasFreeLaunchSlot(empty()), true);
  assert.equal(hasFreeLaunchSlot([1, 0, 1]), true);
  assert.equal(hasFreeLaunchSlot([1, 2, 3]), false);
  // The index state 15 would fill is the first zero it meets.
  assert.equal(firstFreeLaunchSlot([1, 0, 0]), 1);
  assert.equal(firstFreeLaunchSlot([1, 2, 3]), -1);
  assert.throws(() => hasFreeLaunchSlot([0, 0]), /SLOTS_MUST_BE_3_LONG/);
});

test("the wait states advance on a free slot and re-enter the gate without one", () => {
  assert.deepEqual(BATTLE_TURN_WAIT_STATES.map((entry) => entry.state), [6, 7]);
  assert.deepEqual(BATTLE_TURN_WAIT_STATES.map((entry) => entry.launchState), [15, 16]);
  // The graph, extracted separately, says the same.
  assert.deepEqual(listStateTransitions(6), [15]);
  assert.deepEqual(listStateTransitions(7), [16]);

  for (const { state, launchState } of BATTLE_TURN_WAIT_STATES) {
    const advanced = runWaitToLaunchState(state, { counter: 1, cooldown: 0, launchSlots: [1, 0, 1] });
    assert.equal(advanced.nextState, launchState, `state ${state}`);
    assert.equal(advanced.waiting, false);

    // No slot and a running cooldown: nothing happens at all.
    const waiting = runWaitToLaunchState(state, { counter: 1, cooldown: 5, launchSlots: [1, 2, 3] });
    assert.equal(waiting.nextState, null);
    assert.equal(waiting.waiting, true);
    assert.equal(waiting.reEntersGate, false);

    // No slot and a spent cooldown: back through the action gate to choose again.
    const gate = runWaitToLaunchState(state, { counter: 1, cooldown: 0, launchSlots: [1, 2, 3] });
    assert.equal(gate.reEntersGate, true);
    assert.equal(gate.nextState, null);
  }
  assert.throws(() => runWaitToLaunchState(4, { launchSlots: empty() }), /NOT_A_WAIT_STATE/);
});

test("only state 7 notifies on its entry frame", () => {
  const seven = runWaitToLaunchState(7, { counter: 0, cooldown: 0, launchSlots: empty() });
  assert.equal(seven.notify, 1, "0x0211648C passes 1");
  // And only on the entry frame.
  assert.equal(runWaitToLaunchState(7, { counter: 3, cooldown: 0, launchSlots: empty() }).notify, null);
  // State 6 never does.
  assert.equal(runWaitToLaunchState(6, { counter: 0, cooldown: 0, launchSlots: empty() }).notify, null);
});

test("the launch states abort on their own code, and all on a negative +0x180", () => {
  assert.deepEqual([...BATTLE_TURN_LAUNCH_ABORT_CODES[14]], [8, 9, 10, 11]);
  assert.deepEqual([...BATTLE_TURN_LAUNCH_ABORT_CODES[15]], [8, 9, 10, 11]);
  assert.deepEqual([...BATTLE_TURN_LAUNCH_ABORT_CODES[16]], [12]);
  assert.equal(BATTLE_TURN_ABORT_STATE, BATTLE_STATE_ACTION_GATE);

  for (const state of [14, 15]) {
    for (const field17C of [8, 9, 10, 11]) {
      assert.equal(launchStateAborts(state, { counter: 0, field17C, field180: 0 }), 1, `${state}/${field17C}`);
    }
    assert.equal(launchStateAborts(state, { counter: 0, field17C: 12, field180: 0 }), null);
  }
  // 16 aborts on 12 and not on 8..11.
  assert.equal(launchStateAborts(16, { counter: 0, field17C: 12, field180: 0 }), 1);
  for (const field17C of [8, 9, 10, 11]) {
    assert.equal(launchStateAborts(16, { counter: 0, field17C, field180: 0 }), null, `16/${field17C}`);
  }
  // A negative +0x180 aborts all three, whatever +0x17C says.
  for (const state of [14, 15, 16]) {
    assert.equal(launchStateAborts(state, { counter: 0, field17C: 0, field180: -1 }), 1, `state ${state}`);
    assert.equal(launchStateAborts(state, { counter: 0, field17C: 0, field180: 0 }), null, `state ${state}`);
  }
  // Only the entry frame tests any of it.
  assert.equal(launchStateAborts(15, { counter: 1, field17C: 8, field180: -99 }), null);
  assert.throws(() => launchStateAborts(6, { counter: 0 }), /NOT_A_LAUNCH_STATE/);
});

test("the two interrupt predicates share a tail and differ at the head", () => {
  assert.deepEqual([...BATTLE_TURN_FIELD17C_RANGE], [0x12, 0x15]);
  assert.equal(BATTLE_TURN_SUSPEND_MASK, BATTLE_STATE_SUSPEND_MASK);

  // 0x02114490: 18..21 answers yes outright.
  for (const field17C of [0x12, 0x13, 0x14, 0x15]) {
    assert.equal(actionInterrupted({ field17C, flags9A: 0 }), true, `+0x17C ${field17C}`);
  }
  for (const field17C of [0x11, 0x16, 0, 8]) {
    assert.equal(actionInterrupted({ field17C, flags9A: 0 }), false, `+0x17C ${field17C}`);
  }
  // Outside that range the answer is the suspend bit, and only bit 1.
  assert.equal(actionInterrupted({ field17C: 0, flags9A: BATTLE_TURN_SUSPEND_MASK }), true);
  assert.equal(actionInterrupted({ field17C: 0, flags9A: 1 }), false);
  assert.equal(actionInterrupted({ field17C: 0, flags9A: 3 }), true);

  // 0x021144B0 adds one head: no committed action answers yes on its own.
  assert.equal(commitInterrupted({ committedAction: 0, field17C: 0, flags9A: 0 }), true);
  assert.equal(commitInterrupted({ committedAction: 7, field17C: 0, flags9A: 0 }), false);
  assert.equal(commitInterrupted({ committedAction: 7, field17C: 0x13, flags9A: 0 }), true);
});

test("the approach states are recorded but not implemented", () => {
  assert.deepEqual(BATTLE_TURN_APPROACH_STATES.map((entry) => entry.state), [4, 5]);
  assert.deepEqual(BATTLE_TURN_APPROACH_STATES.map((entry) => entry.launchState), [14, 15]);
  // The graph agrees on where they go.
  assert.deepEqual(listStateTransitions(4), [14]);
  assert.deepEqual(listStateTransitions(5), [15]);
  // And the module says in as many words why they are not translated.
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleTurnStates.js"), "utf8");
  assert.match(module, /approach geometry/);
  assert.match(module, /0x4000 and 0xC000/);
  assert.match(module, /geometry is described and not implemented/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleTurnStates.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("a launch takes the first free slot, or waits, or aborts", () => {
  const head = { counter: 0, field17C: 0, field180: 0 };
  assert.deepEqual(planLaunch(15, { ...head, launchSlots: [1, 0, 0] }),
    { outcome: BATTLE_TURN_LAUNCH_PROCEED, nextState: null, slotIndex: 1 });
  assert.deepEqual(planLaunch(15, { ...head, launchSlots: [1, 2, 3] }),
    { outcome: BATTLE_TURN_LAUNCH_NO_SLOT, nextState: null, slotIndex: -1 });
  // The head is tested before the slots are even walked.
  assert.deepEqual(planLaunch(15, { ...head, field17C: 9, launchSlots: empty() }),
    { outcome: BATTLE_TURN_LAUNCH_ABORTED, nextState: 1, slotIndex: -1 });
});

test("the notify a launch raises is the move record's own field plus eight", () => {
  assert.equal(BATTLE_TURN_LAUNCH_NOTIFY_BASE, 8);
  assert.deepEqual([0, 1, 2, 3].map(launchNotifyCode), [8, 9, 10, 11]);
  // `addls` does not take above 3, so nothing is raised.
  assert.equal(launchNotifyCode(4), null);
  assert.equal(launchNotifyCode(-1), null);

  // Every one of the 596 records holds a value inside the table's range, so
  // every launch in the game raises one of the four.
  const moves = listBattleCatalogRecords("moves");
  const seen = new Set();
  for (const record of moves) {
    const code = launchNotifyCode(record.field10);
    assert.notEqual(code, null, `move ${record.recordIndex} field10 ${record.field10}`);
    seen.add(code);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [8, 9, 10, 11]);
});

test("a failed allocation leaves the slot clear and changes no state", () => {
  const failed = resolveLaunch({ allocated: null, tally: 50 });
  assert.equal(failed.outcome, BATTLE_TURN_LAUNCH_ALLOCATION_FAILED);
  assert.equal(failed.nextState, null, "the handler simply returns");
  assert.equal(failed.releaseSlot, true);
  assert.equal(failed.notify, null);
  assert.equal(failed.tally, 50, "and nothing is added to +0x1C");
});

test("a global abort and a failed initialise take the identical release path", () => {
  const byFlag = resolveLaunch({ allocated: {}, globalAbort: true, initialised: true, tally: 50 });
  const byInit = resolveLaunch({ allocated: {}, globalAbort: false, initialised: false, tally: 50 });
  for (const result of [byFlag, byInit]) {
    assert.equal(result.outcome, BATTLE_TURN_LAUNCH_RELEASED);
    assert.equal(result.nextState, 1, "back to the action gate");
    assert.equal(result.releaseSlot, true);
    assert.equal(result.clearBit0, true, "bit 0 of the object is cleared first");
    assert.equal(result.notify, null);
    assert.equal(result.tally, 50);
  }
  assert.deepEqual({ ...byFlag }, { ...byInit }, "0x02116D40 and 0x02116E00 are the same three lines");
});

test("a launch adds 120 to +0x1C and wraps it as a signed halfword", () => {
  assert.equal(BATTLE_TURN_LAUNCH_TALLY_STEP, 0x78);
  const done = resolveLaunch({ allocated: {}, initialised: true, moveField10: 2, tally: 100 });
  assert.equal(done.outcome, BATTLE_TURN_LAUNCH_DONE);
  assert.equal(done.notify, 10);
  assert.equal(done.releaseSlot, false);
  assert.equal(done.tally, 220);
  // `ldrsh` in and `strh` out, so it is a halfword the whole way.
  assert.equal(resolveLaunch({ allocated: {}, initialised: true, tally: 32700 }).tally, -32716);
  assert.equal(resolveLaunch({ allocated: {}, initialised: true, tally: -32768 }).tally, -32648);
});
