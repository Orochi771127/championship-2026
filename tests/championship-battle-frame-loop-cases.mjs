// Battle frame loop — OVL19 0x0210D6E4, the six-slot per-frame update.
//
// The loop is the order, not the arithmetic. The status tick is battleStatus's,
// already traced; what these cases pin is which phase runs when, what an empty
// slot escapes, and the four places the original calls out of the loop.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_FRAME_DEATH_NOTIFY,
  BATTLE_FRAME_DEATH_STATE,
  BATTLE_FRAME_EVENT_DEFEATED,
  BATTLE_FRAME_EVENT_SITES,
  BATTLE_FRAME_EVENT_STATUS_EXPIRED,
  BATTLE_FRAME_EVENT_THRESHOLD_CROSSED,
  BATTLE_FRAME_EVENT_TIMER_ELAPSED,
  BATTLE_FRAME_EVIDENCE,
  BATTLE_FRAME_LOOP_SITE,
  BATTLE_FRAME_ROSTER_BASE_OFFSET,
  BATTLE_FRAME_SLOT_COUNT,
  BATTLE_FRAME_THRESHOLD_TABLE,
  BATTLE_FRAME_THRESHOLD_TABLE_BASE,
  BATTLE_FRAME_THRESHOLD_TABLE_END,
  createFrameCombatant,
  stepBattleFrame,
  stepFrameSlot
} from "../src/championship/battle/battleFrameLoop.js";

import { BATTLE_AI_MOVE_THRESHOLDS } from "../src/championship/battle/battleActionSelection.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const types = (events) => events.map((event) => event.type);

test("the loop's shape is the immediates the ROM uses", () => {
  assert.equal(BATTLE_FRAME_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_FRAME_LOOP_SITE, "OVL19:0x0210D6E4");
  assert.equal(BATTLE_FRAME_SLOT_COUNT, 6);
  assert.equal(BATTLE_FRAME_ROSTER_BASE_OFFSET, 0x5e20);
  assert.equal(BATTLE_FRAME_DEATH_STATE, 0x17);
  assert.equal(BATTLE_FRAME_DEATH_NOTIFY, 0x12);
  // Every event names the ROM routine it stands in for, none of which is traced.
  assert.deepEqual(Object.keys(BATTLE_FRAME_EVENT_SITES).sort(), [
    BATTLE_FRAME_EVENT_DEFEATED,
    BATTLE_FRAME_EVENT_STATUS_EXPIRED,
    BATTLE_FRAME_EVENT_THRESHOLD_CROSSED,
    BATTLE_FRAME_EVENT_TIMER_ELAPSED
  ].sort());
  for (const site of Object.values(BATTLE_FRAME_EVENT_SITES)) {
    assert.match(site, /^OVL19:0x0[0-9A-F]{7}/);
  }
});

test("the threshold table is eight entries because the move ladder starts there", () => {
  assert.deepEqual([...BATTLE_FRAME_THRESHOLD_TABLE], [100, 100, 100, 9999, 50, 9999, 50, 9999]);
  // u16 entries, so eight of them span sixteen bytes and land on the ladder base.
  assert.equal(
    BATTLE_FRAME_THRESHOLD_TABLE_BASE + BATTLE_FRAME_THRESHOLD_TABLE.length * 2,
    BATTLE_FRAME_THRESHOLD_TABLE_END
  );
  assert.equal(BATTLE_FRAME_THRESHOLD_TABLE_END, 0x0212fe84);
  // And that base is the table battleActionSelection already reads, whose first
  // row begins 68, 89 — the words immediately after this table.
  assert.deepEqual(BATTLE_AI_MOVE_THRESHOLDS[0], [68, 89]);
});

test("an empty slot escapes the whole body, counters included", () => {
  const busy = createFrameCombatant({ field24: 4, field28: 4, field160: 1, field164: 0 });
  const frame = stepBattleFrame({ slots: [null, busy, null, null, null, null] });
  assert.equal(frame.slots[0], null);
  assert.equal(frame.slots[1].field24, 3);
  assert.equal(frame.slots[1].field28, 3);
  // The one live slot fires its timer; the five empty ones produce nothing.
  assert.deepEqual(types(frame.events), [BATTLE_FRAME_EVENT_TIMER_ELAPSED]);
  assert.equal(frame.events[0].slot, 1);
});

test("slots resolve in ascending order, which is the whole tie-break", () => {
  const ready = () => createFrameCombatant({ field160: 1, field164: 0 });
  const frame = stepBattleFrame({ slots: [ready(), ready(), ready(), ready(), ready(), ready()] });
  assert.deepEqual(frame.events.map((event) => event.slot), [0, 1, 2, 3, 4, 5]);
  assert.equal(frame.events.length, BATTLE_FRAME_SLOT_COUNT);
});

test("a status with no time left clears, and skips the threshold phase", () => {
  const expired = createFrameCombatant({
    statusCode: 7, statusRemaining: 0, field22: 9999, field18: 0, field24: 2
  });
  const { combatant, events } = stepFrameSlot(expired, 3);
  assert.equal(combatant.statusCode, 0);
  assert.equal(combatant.statusRemaining, 0);
  // 0x0210D878 branches straight to phase 2, so +0x22 is untouched this frame.
  assert.equal(combatant.field22, 9999);
  assert.deepEqual(types(events), [BATTLE_FRAME_EVENT_STATUS_EXPIRED]);
  assert.equal(events[0].slot, 3);
  // Phase 3 still runs.
  assert.equal(combatant.field24, 1);
});

test("the damage-over-time tick decrements first, then tests the new value", () => {
  // Codes 7 and 13 lose 3% of max on every 180th remaining value.
  for (const statusCode of [7, 13]) {
    const onTick = stepFrameSlot(createFrameCombatant({
      statusCode, statusRemaining: 181, currentHp: 100, maxHp: 100
    })).combatant;
    assert.equal(onTick.statusRemaining, 180);
    assert.equal(onTick.currentHp, 97, `code ${statusCode} loses 3%`);

    const offTick = stepFrameSlot(createFrameCombatant({
      statusCode, statusRemaining: 180, currentHp: 100, maxHp: 100
    })).combatant;
    assert.equal(offTick.statusRemaining, 179);
    assert.equal(offTick.currentHp, 100);
  }

  // Code 14 loses 5% every tenth.
  const fast = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 100, maxHp: 100
  })).combatant;
  assert.equal(fast.statusRemaining, 10);
  assert.equal(fast.currentHp, 95);
});

test("the death test is `hp < 0`, so landing exactly on zero survives", () => {
  const survives = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 5, maxHp: 100
  }));
  assert.equal(survives.combatant.currentHp, 0);
  assert.equal(survives.combatant.statusCode, 14, "the slot keeps its status");
  assert.deepEqual(types(survives.events), []);

  const dies = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 4, maxHp: 100
  }), 5);
  assert.equal(dies.combatant.currentHp, 0, "negative HP is stored back as zero");
  assert.equal(dies.combatant.statusCode, 0);
  assert.equal(dies.combatant.statusRemaining, 0);
  assert.equal(dies.combatant.field3C, 0);
  assert.deepEqual(types(dies.events), [BATTLE_FRAME_EVENT_DEFEATED]);
  assert.deepEqual(dies.events[0], {
    type: BATTLE_FRAME_EVENT_DEFEATED, slot: 5,
    state: BATTLE_FRAME_DEATH_STATE, notify: BATTLE_FRAME_DEATH_NOTIFY,
    // 0x02112820 runs the OLD code's exit routine before storing the new one.
    // That routine is not translated, so the event names the code it was for.
    exitHandlerFor: 0
  });
});

test("dying arms the entry counter, not just the state", () => {
  // 0x02114984 is four instructions and the second pair is
  // `mvn r1,#0xfe / str r1,[r0,#0x16c]`. Setting +0x168 without +0x16C left a
  // defeated combatant with a counter still climbing from its previous state,
  // so the dispatcher never gave state 0x17 an entry frame and it ran against
  // whatever period the state before it had armed.
  const dies = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 4, maxHp: 100, state: 3, stateCounter: 40
  }), 1);
  assert.equal(dies.combatant.state, BATTLE_FRAME_DEATH_STATE);
  assert.equal(dies.combatant.stateCounter, -255);

  // And the notify pair 0x02112820 writes: the code, then -255.
  assert.equal(dies.combatant.field17C, BATTLE_FRAME_DEATH_NOTIFY);
  assert.equal(dies.combatant.field180, -255);
  assert.equal(dies.events[0].exitHandlerFor, 0);

  // A combatant that was already carrying a code reports it as the one whose
  // exit routine the ROM would have run on the way through.
  const carrying = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 4, maxHp: 100, field17C: 9
  }), 2);
  assert.equal(carrying.events[0].exitHandlerFor, 9);
  assert.equal(carrying.combatant.field17C, BATTLE_FRAME_DEATH_NOTIFY);
});

test("a survivor's state fields are left exactly as they came in", () => {
  const lives = stepFrameSlot(createFrameCombatant({
    statusCode: 0, currentHp: 10, maxHp: 100, state: 3, stateCounter: 7, field17C: 4, field180: 2
  }));
  assert.equal(lives.combatant.state, 3);
  assert.equal(lives.combatant.stateCounter, 7);
  assert.equal(lives.combatant.field17C, 4);
  assert.equal(lives.combatant.field180, 2);
});

test("a combatant that dies this frame still has its counters ticked", () => {
  // The death handler branches to phase 2 and falls through into phase 3.
  const { combatant, events } = stepFrameSlot(createFrameCombatant({
    statusCode: 14, statusRemaining: 11, currentHp: 1, maxHp: 100,
    field160: 1, field164: 0, field24: 3, field28: 2
  }), 2);
  assert.deepEqual(types(events), [BATTLE_FRAME_EVENT_DEFEATED, BATTLE_FRAME_EVENT_TIMER_ELAPSED]);
  assert.equal(combatant.field24, 2);
  assert.equal(combatant.field28, 1);
});

test("the threshold phase runs only with no status, and the compare is strict", () => {
  const base = { statusCode: 0, field18: 0 }; // table[0] is 100
  const over = stepFrameSlot(createFrameCombatant({ ...base, field22: 101 }), 1);
  assert.deepEqual(types(over.events), [BATTLE_FRAME_EVENT_THRESHOLD_CROSSED]);
  assert.equal(over.events[0].argument, 1);
  assert.equal(over.combatant.field22, 0, "crossing zeroes the accumulator");

  const equal = stepFrameSlot(createFrameCombatant({ ...base, field22: 100 }));
  assert.deepEqual(types(equal.events), [], "`bls` skips on equal");
  assert.equal(equal.combatant.field22, 100);

  // 9999 is the original's "never": nothing a u16 holds can cross it.
  const never = stepFrameSlot(createFrameCombatant({ statusCode: 0, field18: 3, field22: 9999 }));
  assert.deepEqual(types(never.events), []);

  // With a status running the phase is unreachable no matter how high +0x22 is.
  const busy = stepFrameSlot(createFrameCombatant({
    statusCode: 7, statusRemaining: 500, field22: 9999, field18: 0, currentHp: 100, maxHp: 100
  }));
  assert.deepEqual(types(busy.events), []);
  assert.equal(busy.combatant.field22, 9999);
});

test("the timer phase is gated by +0x160 and only fires once it is spent", () => {
  const gatedOff = stepFrameSlot(createFrameCombatant({ field160: 0, field164: 0 }));
  assert.deepEqual(types(gatedOff.events), []);
  assert.equal(gatedOff.combatant.field164, 0);

  const counting = stepFrameSlot(createFrameCombatant({ field160: 1, field164: 2 }));
  assert.equal(counting.combatant.field164, 1);
  assert.deepEqual(types(counting.events), []);

  const elapsed = stepFrameSlot(createFrameCombatant({ field160: 1, field164: 0 }));
  assert.equal(elapsed.combatant.field164, 0);
  assert.deepEqual(types(elapsed.events), [BATTLE_FRAME_EVENT_TIMER_ELAPSED]);
});

test("the two counters decrement only while strictly positive", () => {
  const positive = stepFrameSlot(createFrameCombatant({ field24: 1, field28: 1 })).combatant;
  assert.equal(positive.field24, 0);
  assert.equal(positive.field28, 0);

  const floored = stepFrameSlot(createFrameCombatant({ field24: 0, field28: -3 })).combatant;
  assert.equal(floored.field24, 0);
  assert.equal(floored.field28, -3, "a negative value is left alone, as `subgt` leaves it");
});

test("untraced and malformed inputs are refused", () => {
  // The ROM bound-checks nothing here and would read the move ladder's table.
  assert.throws(
    () => stepFrameSlot(createFrameCombatant({ statusCode: 0, field18: 8, field22: 1 })),
    /THRESHOLD_INDEX_OUT_OF_RANGE_UNTRACED/
  );
  assert.throws(() => createFrameCombatant({ nope: 1 }), /UNKNOWN_COMBATANT_FIELD/);
  assert.throws(() => createFrameCombatant({ field24: 1.5 }), /FIELD24_MUST_BE_AN_INTEGER/);
  assert.throws(() => stepBattleFrame({ slots: [null] }), /SLOTS_MUST_BE_6_LONG/);
  assert.throws(() => stepBattleFrame({}), /STEP_REQUIRES_A_SLOTS_ARRAY/);
});

test("the frame result is frozen and the input is not mutated", () => {
  const source = createFrameCombatant({ field24: 2 });
  const frame = stepBattleFrame({ slots: [source, null, null, null, null, null] });
  assert.equal(source.field24, 2, "the caller's object is left alone");
  assert.equal(frame.slots[0].field24, 1);
  assert.equal(Object.isFrozen(frame), true);
  assert.equal(Object.isFrozen(frame.slots[0]), true);
});

test("the loop imports only the battle modules it delegates to", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleFrameLoop.js"), "utf8");
  const specifiers = (module.match(/from "([^"]+)"/g) ?? []).map((line) => line.slice(6, -1));
  assert.deepEqual(specifiers.sort(), [
    "../contracts/championshipContracts.js",
    // The death path applies 0x02114984 and 0x02112820 now that both are read,
    // and both live in the state machine.
    "./battleStateMachine.js",
    "./battleStatus.js"
  ]);
});
