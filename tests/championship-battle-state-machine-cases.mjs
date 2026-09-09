// Battle state machine — OVL19 0x021156F8 dispatch, 27 states at 0x0213040C.
//
// The join these cases exist to protect: state 3's handler ends on the cooldown
// at +0x28, which battleFrameLoop is the thing that ticks down. That is how a
// spent cooldown becomes an action, and it is the last link B4 was missing.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_STATE_ACTION_GATE,
  BATTLE_STATE_AI_SELECT,
  BATTLE_STATE_CODES_SET_BY_ROM,
  BATTLE_STATE_CODE_OFFSET,
  BATTLE_STATE_COOLDOWN_GATE,
  BATTLE_STATE_COUNT,
  BATTLE_STATE_COUNTER_OFFSET,
  BATTLE_STATE_DEFEATED,
  BATTLE_STATE_DISPATCH_ENTER,
  BATTLE_STATE_DISPATCH_SITE,
  BATTLE_STATE_DISPATCH_SUSPENDED,
  BATTLE_STATE_DISPATCH_THROTTLED,
  BATTLE_STATE_DISPATCH_UPDATE,
  BATTLE_STATE_ENTRY_COUNTER,
  BATTLE_STATE_EVIDENCE,
  BATTLE_STATE_FRAME_FUNCTION,
  BATTLE_STATE_FRAME_PHASE_ORDER,
  BATTLE_STATE_HANDLERS,
  BATTLE_STATE_INERT_STATES,
  BATTLE_STATE_PERIOD_OFFSET,
  BATTLE_STATE_SET_SITE,
  BATTLE_STATE_SUSPEND_MASK,
  BATTLE_STATE_TABLE_BASE,
  BATTLE_STATE_TABLE_STRIDE,
  cooldownGateAllowsAction,
  dispatchBattleState,
  enterBattleState,
  getBattleStateHandler,
  stateThrottleRemainder
} from "../src/championship/battle/battleStateMachine.js";

import { BATTLE_FRAME_DEATH_STATE, BATTLE_FRAME_LOOP_SITE } from "../src/championship/battle/battleFrameLoop.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// OVL19 loads at 0x0210B300 and is 0x26920 long.
const OVL19_LOW = 0x0210b300;
const OVL19_HIGH = 0x0210b300 + 0x26920;

test("the dispatcher's shape is the immediates the ROM uses", () => {
  assert.equal(BATTLE_STATE_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_STATE_DISPATCH_SITE, "OVL19:0x021156F8");
  assert.equal(BATTLE_STATE_SET_SITE, "OVL19:0x02114984");
  assert.equal(BATTLE_STATE_TABLE_BASE, 0x0213040c);
  assert.equal(BATTLE_STATE_TABLE_STRIDE, 8);
  assert.equal(BATTLE_STATE_COUNT, 27);
  assert.equal(BATTLE_STATE_ENTRY_COUNTER, -255, "mvn r1,#0xfe");
  assert.equal(BATTLE_STATE_SUSPEND_MASK, 2);
  assert.equal(BATTLE_STATE_CODE_OFFSET, 0x168);
  assert.equal(BATTLE_STATE_COUNTER_OFFSET, 0x16c);
  assert.equal(BATTLE_STATE_PERIOD_OFFSET, 0x170);
});

test("all 27 handlers are OVL19 code and the 28th entry would not be", () => {
  assert.equal(BATTLE_STATE_HANDLERS.length, BATTLE_STATE_COUNT);
  for (const [state, handler] of BATTLE_STATE_HANDLERS.entries()) {
    assert.ok(handler >= OVL19_LOW && handler < OVL19_HIGH, `state ${state} -> 0x${handler.toString(16)}`);
    assert.equal(handler % 4, 0, `state ${state} handler must be ARM-aligned`);
  }
  assert.equal(new Set(BATTLE_STATE_HANDLERS).size, BATTLE_STATE_COUNT, "no two states share a handler");
  // Entry 27 would begin here, and the words there are 0x001F0000 / 0x01FF03E0.
  assert.equal(BATTLE_STATE_TABLE_BASE + BATTLE_STATE_COUNT * BATTLE_STATE_TABLE_STRIDE, 0x021304e4);
  assert.equal(0x001f0000 >= OVL19_LOW, false, "the word after the table is not an OVL19 address");
});

test("every state code the ROM sets is inside the table", () => {
  assert.deepEqual([...BATTLE_STATE_CODES_SET_BY_ROM],
    [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23]);
  for (const state of BATTLE_STATE_CODES_SET_BY_ROM) {
    assert.ok(state >= 0 && state < BATTLE_STATE_COUNT, `state ${state}`);
    assert.doesNotThrow(() => getBattleStateHandler(state));
  }
  // 2 is reachable only from inside the machine, never from a literal `mov r1`.
  assert.equal(BATTLE_STATE_CODES_SET_BY_ROM.includes(BATTLE_STATE_AI_SELECT), false);
});

test("the three named states are the routines already translated here", () => {
  assert.equal(BATTLE_STATE_ACTION_GATE, 1);
  assert.equal(getBattleStateHandler(BATTLE_STATE_ACTION_GATE), 0x021157bc, "the status action gate");
  assert.equal(BATTLE_STATE_AI_SELECT, 2);
  assert.equal(getBattleStateHandler(BATTLE_STATE_AI_SELECT), 0x021159d4, "AI action selection");
  assert.equal(BATTLE_STATE_COOLDOWN_GATE, 3);
  assert.equal(getBattleStateHandler(BATTLE_STATE_COOLDOWN_GATE), 0x02115f38, "the cooldown gate");
});

test("the defeated state is the one the frame loop sets on death", () => {
  assert.equal(BATTLE_STATE_DEFEATED, 0x17);
  assert.equal(BATTLE_STATE_DEFEATED, BATTLE_FRAME_DEATH_STATE);
  assert.equal(getBattleStateHandler(BATTLE_STATE_DEFEATED), 0x021170d0);
  assert.ok(BATTLE_STATE_CODES_SET_BY_ROM.includes(BATTLE_STATE_DEFEATED));
});

test("eight table entries do nothing, and none of them is ever set", () => {
  assert.deepEqual([...BATTLE_STATE_INERT_STATES], [17, 18, 19, 20, 21, 22, 24, 25]);
  // Six consecutive `bx lr` at 0x021170B8..0x021170CC, then two more at
  // 0x02117104 and 0x02117108 past state 23's body.
  assert.deepEqual(
    BATTLE_STATE_INERT_STATES.map((state) => getBattleStateHandler(state)),
    [0x021170b8, 0x021170bc, 0x021170c0, 0x021170c4, 0x021170c8, 0x021170cc,
     0x02117104, 0x02117108]
  );
  for (const state of BATTLE_STATE_INERT_STATES) {
    assert.equal(BATTLE_STATE_CODES_SET_BY_ROM.includes(state), false, `state ${state}`);
    assert.equal(dispatchBattleState({ state, counter: -1, period: 1 }).inert, true);
  }
  assert.equal(dispatchBattleState({ state: 1, counter: -1, period: 1 }).inert, false);
});

test("entering a state arms the counter at the value the ROM writes", () => {
  assert.deepEqual(enterBattleState(3), { state: 3, counter: -255 });
  assert.throws(() => enterBattleState(27), /OUT_OF_RANGE_UNTRACED/);
  assert.throws(() => enterBattleState(-1), /OUT_OF_RANGE_UNTRACED/);
});

test("a state runs on entry, then only on multiples of its own period", () => {
  const entered = enterBattleState(BATTLE_STATE_COOLDOWN_GATE);
  const seen = [];
  let counter = entered.counter;
  for (let frame = 0; frame < 9; frame += 1) {
    const step = dispatchBattleState({ state: entered.state, counter, period: 4 });
    seen.push(step.outcome);
    counter = step.counter;
  }
  assert.deepEqual(seen, [
    BATTLE_STATE_DISPATCH_ENTER,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_UPDATE,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_THROTTLED,
    BATTLE_STATE_DISPATCH_UPDATE
  ]);
  assert.equal(counter, 9, "the counter ticks on every one of those frames");

  // The entry frame leaves the counter at 1, so a handler sees 0 while running.
  const first = dispatchBattleState({ state: 1, counter: -255, period: 4 });
  assert.equal(first.outcome, BATTLE_STATE_DISPATCH_ENTER);
  assert.equal(first.counter, 1);
  assert.equal(first.handler, 0x021157bc);
});

test("a period of zero means every frame, because the divide returns zero", () => {
  // ARM9 0x0202B558 branches to 0x0202B750 on a zero divisor and leaves the
  // remainder at 0, so the `bne` never skips.
  assert.equal(stateThrottleRemainder(7, 0), 0);
  assert.equal(stateThrottleRemainder(0, 0), 0);
  for (let counter = 0; counter < 5; counter += 1) {
    assert.equal(dispatchBattleState({ state: 1, counter, period: 0 }).outcome, BATTLE_STATE_DISPATCH_UPDATE);
  }
  // Everywhere else it is a signed truncating remainder.
  assert.equal(stateThrottleRemainder(7, 4), 3);
  assert.equal(stateThrottleRemainder(-7, 4), -3);
  assert.equal(stateThrottleRemainder(8, 4), 0);
});

test("the suspend bit stops the handler and freezes the counter", () => {
  const suspended = dispatchBattleState({ state: 1, counter: 5, period: 1, flags9A: BATTLE_STATE_SUSPEND_MASK });
  assert.equal(suspended.outcome, BATTLE_STATE_DISPATCH_SUSPENDED);
  assert.equal(suspended.counter, 5, "0x02115710 returns before the increment");
  assert.equal(suspended.handler, null);

  // Only bit 1 suspends; bit 0 and the rest of the halfword do not.
  for (const flags9A of [0, 1, 4, 0x8000, 0xfffd]) {
    assert.notEqual(dispatchBattleState({ state: 1, counter: 0, period: 1, flags9A }).outcome,
      BATTLE_STATE_DISPATCH_SUSPENDED, `flags 0x${flags9A.toString(16)}`);
  }
  assert.equal(dispatchBattleState({ state: 1, counter: 0, period: 1, flags9A: 3 }).outcome,
    BATTLE_STATE_DISPATCH_SUSPENDED);
});

test("the cooldown gate is the join between the tick loop and an action", () => {
  // 0x021161D0: popgt when +0x28 is above zero, otherwise fall into state 1.
  assert.equal(cooldownGateAllowsAction(0), true);
  assert.equal(cooldownGateAllowsAction(1), false);
  assert.equal(cooldownGateAllowsAction(9), false);
  assert.equal(cooldownGateAllowsAction(-1), true, "`popgt` lets a negative through");
  // And the loop that spends that counter is the other half of the frame.
  assert.equal(BATTLE_FRAME_LOOP_SITE, "OVL19:0x0210D6E4");
});

test("the two frame phases run in the order the frame function calls them", () => {
  assert.equal(BATTLE_STATE_FRAME_FUNCTION, "OVL19:0x0210D33C");
  assert.deepEqual(BATTLE_STATE_FRAME_PHASE_ORDER.map((entry) => entry.phase),
    ["STATE_DISPATCH", "STATUS_AND_COUNTERS"]);
  const sites = BATTLE_STATE_FRAME_PHASE_ORDER.map((entry) => Number.parseInt(entry.site.slice(6), 16));
  assert.ok(sites[0] < sites[1], "the dispatch loop is earlier in the same function");
  assert.equal(BATTLE_STATE_FRAME_PHASE_ORDER[1].site, BATTLE_FRAME_LOOP_SITE);
});

test("out-of-table states and malformed input are refused", () => {
  assert.throws(() => getBattleStateHandler(BATTLE_STATE_COUNT), /OUT_OF_RANGE_UNTRACED/);
  assert.throws(() => getBattleStateHandler(1.5), /STATE_MUST_BE_AN_INTEGER/);
  assert.throws(() => dispatchBattleState(null), /DISPATCH_REQUIRES_AN_OBJECT/);
  assert.throws(() => dispatchBattleState({ state: 1, counter: 1.5 }), /COUNTER_MUST_BE_AN_INTEGER/);
  assert.throws(() => cooldownGateAllowsAction(1.5), /FIELD28_MUST_BE_AN_INTEGER/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleStateMachine.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
