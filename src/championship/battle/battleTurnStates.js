// Turn states — what a committed action passes through before it lands.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// State 1 chooses and commits. The states between that and damage are these,
// and the shape they make is:
//
//   1   gate, select, commit, cooldown
//   4   approach geometry, then 14
//   5   approach geometry, then 15
//   6   wait for a free launch slot, then 15
//   7   wait for a free launch slot, then 16
//   14  launch, then back to 1
//   15  launch, then back to 1
//   16  launch, then back to 1
//
// THE THREE LAUNCH SLOTS
// ----------------------
// Combatant +0x78, +0x7C and +0x80 hold in-flight objects. State 15 walks them
// at 0x02116CF8 looking for a zero, allocates into the first one it finds
// (0x02116D10), and gives up if the allocation returns null. The predicate at
// 0x02114464 is the other half of the same fact: it walks the same three words
// and answers whether any is free. States 6 and 7 gate on it.
//
// So a combatant can have at most three actions in flight, and a fourth waits.
//
// THE WAIT-TO-LAUNCH STATES
// -------------------------
// 6 and 7 are small enough to read whole and are implemented below. Both are:
// a free slot advances to the launch state, and otherwise the combatant waits
// out its cooldown and re-enters the action gate to choose again. State 7 also
// notifies 1 on its entry frame, which state 6 does not.
//
// THE LAUNCH STATES' SHARED HEAD
// ------------------------------
// 14, 15 and 16 open the same way on their entry frame, and abort straight back
// to state 1 on either of two conditions. The first differs between them:
//
//   14, 15   +0x17C is 8, 9, 10 or 11      0x02116ABC / 0x02116CC4
//   16       +0x17C is 12                  0x02116EAC
//   all      +0x180 is negative            0x02116AD0 / 0x02116CD8 / 0x02116EB4
//
// THE LAUNCH SEQUENCE
// -------------------
// Past that head, state 15 (0x02116CF4..0x02116E38) is:
//
//   walk the three slots for a free one, i = 0..2      0x02116CF8
//   allocate into it                                   0x02116D10
//   a null allocation ends the handler                 0x02116D1C
//   a global flag set -> release the slot, clear bit 0
//   of the new object, and go back to state 1          0x02116D34
//   initialise it from the combatant, the move record
//   at +0x174 and the committed action at +0x5C        0x02116D70
//   a failed initialise -> the same release and return 0x02116E00
//   aim it                                             0x02116D8C
//   notify with the move record's own +0x10            0x02116D9C
//   add 120 to the signed halfword at +0x1C            0x02116DF0
//
// The notify code is the move field plus eight: 0 raises 8, 1 raises 9, 2
// raises 10, 3 raises 11, and anything above 3 raises nothing because the
// `addls` does not take. B1 catalogued that field from this very read site and
// recorded the four-arm jump; this is the mapping it produces, and every one of
// the 596 move records holds a value inside 0..3, so every launch notifies.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// States 4 and 5 are approach geometry: 0x02116250 tests an angle against
// 0x4000 and 0xC000 — the quarter and three-quarter turns of a 16-bit angle —
// and offsets a target by 0x10000 in one direction or the other before calling
// a DS math routine at 0x02003098. The world positions and that routine are not
// traced, so the geometry is described and not implemented.
//
// The allocator at 0x0210F8C4 and the initialiser at 0x0211C098 are the caller's
// to provide: the second places the object at the midpoint of a box in Q12 world
// units, which needs the position model this lane has not traced. What +0x17C,
// +0x180 and +0x1C mean is not decided either; they keep their offsets. The
// bodies of 14 and 16 past their shared head are not read.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_TURN_EVIDENCE = "VERIFIED_BINARY";

/** Combatant +0x78, +0x7C, +0x80. */
export const BATTLE_TURN_INFLIGHT_SLOT_COUNT = 3;
export const BATTLE_TURN_INFLIGHT_SLOT_OFFSET = 0x78;

/** Walks the three slots and answers whether any is free. */
export const BATTLE_TURN_FREE_SLOT_SITE = "OVL19:0x02114464";
/** Fills the first free one. */
export const BATTLE_TURN_LAUNCH_ALLOCATOR_SITE = "OVL19:0x0210F8C4";

export const BATTLE_TURN_WAIT_STATES = deepFreeze([
  { state: 6, handler: 0x02116438, launchState: 15, notifiesOnEntry: null },
  { state: 7, handler: 0x02116474, launchState: 16, notifiesOnEntry: 1 }
]);

export const BATTLE_TURN_APPROACH_STATES = deepFreeze([
  { state: 4, handler: 0x021161f0, launchState: 14 },
  { state: 5, handler: 0x02116314, launchState: 15 }
]);

/** The entry-frame abort each launch state applies to +0x17C. */
export const BATTLE_TURN_LAUNCH_ABORT_CODES = deepFreeze({
  14: deepFreeze([8, 9, 10, 11]),
  15: deepFreeze([8, 9, 10, 11]),
  16: deepFreeze([12])
});

/** All three also abort when +0x180 is negative. */
export const BATTLE_TURN_ABORT_STATE = 1;

/** 0x02114490: +0x17C in 18..21, else bit 1 of the halfword at +0x9A. */
export const BATTLE_TURN_SUSPEND_MASK = 2;
export const BATTLE_TURN_FIELD17C_RANGE = deepFreeze([0x12, 0x15]);

function turnError(message) {
  return new Error(`BATTLE_TURN_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw turnError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

function requireSlots(slots) {
  if (!Array.isArray(slots) || slots.length !== BATTLE_TURN_INFLIGHT_SLOT_COUNT) {
    throw turnError(`SLOTS_MUST_BE_${BATTLE_TURN_INFLIGHT_SLOT_COUNT}_LONG`);
  }
  return slots;
}

/** OVL19 0x02114464. True when any of the three launch slots is empty. */
export function hasFreeLaunchSlot(slots) {
  return requireSlots(slots).some((slot) => !slot);
}

/** The index state 15 would fill at 0x02116D18, or -1 when all three are taken. */
export function firstFreeLaunchSlot(slots) {
  return requireSlots(slots).findIndex((slot) => !slot);
}

/**
 * OVL19 0x02114490. `sub r1,#0x12 / cmp r1,#3 / movls r0,#1` — +0x17C in
 * 18..21 answers yes outright; otherwise the answer is the suspend bit.
 */
export function actionInterrupted(input) {
  if (!input || typeof input !== "object") {
    throw turnError("PREDICATE_REQUIRES_AN_OBJECT");
  }
  const field17C = requireInteger(input.field17C ?? 0, "FIELD17C");
  const [low, high] = BATTLE_TURN_FIELD17C_RANGE;
  if (field17C >= low && field17C <= high) {
    return true;
  }
  return (requireInteger(input.flags9A ?? 0, "FLAGS9A") & BATTLE_TURN_SUSPEND_MASK) !== 0;
}

/** OVL19 0x021144B0. No committed action answers yes; otherwise the above. */
export function commitInterrupted(input) {
  if (!input || typeof input !== "object") {
    throw turnError("PREDICATE_REQUIRES_AN_OBJECT");
  }
  if (requireInteger(input.committedAction ?? 0, "COMMITTED_ACTION") === 0) {
    return true;
  }
  return actionInterrupted(input);
}

/**
 * States 6 and 7, read whole. A free launch slot advances; otherwise the
 * combatant waits out its cooldown and re-enters the action gate.
 */
export function runWaitToLaunchState(state, input) {
  const definition = BATTLE_TURN_WAIT_STATES.find((entry) => entry.state === state);
  if (!definition) {
    throw turnError(`NOT_A_WAIT_STATE: ${state}`);
  }
  if (!input || typeof input !== "object") {
    throw turnError("WAIT_REQUIRES_AN_OBJECT");
  }
  const counter = requireInteger(input.counter ?? 0, "COUNTER");
  const cooldown = requireInteger(input.cooldown ?? 0, "COOLDOWN");
  const slots = requireSlots(input.launchSlots);

  const notify = definition.notifiesOnEntry !== null && counter === 0
    ? definition.notifiesOnEntry
    : null;

  if (hasFreeLaunchSlot(slots)) {
    return deepFreeze({ notify, nextState: definition.launchState, waiting: false, reEntersGate: false });
  }
  if (cooldown > 0) {
    // `ldr r0,[r4,#0x28] / cmp r0,#0 / popgt` — nothing else happens this frame.
    return deepFreeze({ notify, nextState: null, waiting: true, reEntersGate: false });
  }
  return deepFreeze({ notify, nextState: null, waiting: false, reEntersGate: true });
}

/**
 * The entry-frame head of states 14, 15 and 16. Returns the state to abort to,
 * or null to carry on into the launch body this module does not implement.
 */
export function launchStateAborts(state, input) {
  const codes = BATTLE_TURN_LAUNCH_ABORT_CODES[state];
  if (!codes) {
    throw turnError(`NOT_A_LAUNCH_STATE: ${state}`);
  }
  if (!input || typeof input !== "object") {
    throw turnError("LAUNCH_REQUIRES_AN_OBJECT");
  }
  if (requireInteger(input.counter ?? 0, "COUNTER") !== 0) {
    // `ldr r0,[r5,#0x16c] / cmp r0,#0 / bne` — only the entry frame tests this.
    return null;
  }
  const field17C = requireInteger(input.field17C ?? 0, "FIELD17C");
  const field180 = requireInteger(input.field180 ?? 0, "FIELD180");
  if (codes.includes(field17C) || field180 < 0) {
    return BATTLE_TURN_ABORT_STATE;
  }
  return null;
}

/** 0x02116D9C: the move record's own +0x10 plus eight, or nothing above 3. */
export const BATTLE_TURN_LAUNCH_NOTIFY_BASE = 8;
export const BATTLE_TURN_LAUNCH_NOTIFY_MAX_FIELD = 3;

/** 0x02116DF0: `ldrsh` at +0x1C, plus 120, stored back as a halfword. */
export const BATTLE_TURN_LAUNCH_TALLY_OFFSET = 0x1c;
export const BATTLE_TURN_LAUNCH_TALLY_STEP = 0x78;

export const BATTLE_TURN_LAUNCH_NO_SLOT = "NO_FREE_SLOT";
export const BATTLE_TURN_LAUNCH_PROCEED = "LAUNCH";
export const BATTLE_TURN_LAUNCH_ABORTED = "ABORT_TO_GATE";
export const BATTLE_TURN_LAUNCH_ALLOCATION_FAILED = "ALLOCATION_FAILED";
export const BATTLE_TURN_LAUNCH_RELEASED = "RELEASED_TO_GATE";
export const BATTLE_TURN_LAUNCH_DONE = "LAUNCHED";

/** The move field plus eight, or null when the jump table does not take. */
export function launchNotifyCode(moveField10) {
  requireInteger(moveField10, "MOVE_FIELD10");
  if (moveField10 < 0 || moveField10 > BATTLE_TURN_LAUNCH_NOTIFY_MAX_FIELD) {
    return null;
  }
  return moveField10 + BATTLE_TURN_LAUNCH_NOTIFY_BASE;
}

/**
 * The decision state 15 reaches before it touches the allocator: abort, wait,
 * or take a numbered slot. The allocation itself is the caller's.
 */
export function planLaunch(state, input) {
  const aborted = launchStateAborts(state, input);
  if (aborted !== null) {
    return deepFreeze({ outcome: BATTLE_TURN_LAUNCH_ABORTED, nextState: aborted, slotIndex: -1 });
  }
  const slotIndex = firstFreeLaunchSlot(input.launchSlots);
  if (slotIndex < 0) {
    // 0x02116E2C walks all three and falls out; the handler simply returns.
    return deepFreeze({ outcome: BATTLE_TURN_LAUNCH_NO_SLOT, nextState: null, slotIndex: -1 });
  }
  return deepFreeze({ outcome: BATTLE_TURN_LAUNCH_PROCEED, nextState: null, slotIndex });
}

/**
 * What follows the allocation. `allocated` is the object the caller's allocator
 * returned, `globalAbort` the flag tested at 0x02116D34, `initialised` whether
 * 0x0211C098 accepted it, and `moveField10` the record's own +0x10.
 */
export function resolveLaunch(input) {
  if (!input || typeof input !== "object") {
    throw turnError("RESOLVE_REQUIRES_AN_OBJECT");
  }
  const tally = requireInteger(input.tally ?? 0, "TALLY");
  if (!input.allocated) {
    // `cmp r0,#0 / beq` at 0x02116D1C: the slot was already written with the
    // null, so it stays clear, and the handler returns without a transition.
    return deepFreeze({
      outcome: BATTLE_TURN_LAUNCH_ALLOCATION_FAILED,
      nextState: null, releaseSlot: true, clearBit0: false, notify: null, tally
    });
  }
  if (input.globalAbort === true || input.initialised === false) {
    // 0x02116D40 and 0x02116E00 are the same three lines: clear bit 0 of the
    // object, zero the slot, and go back to the action gate.
    return deepFreeze({
      outcome: BATTLE_TURN_LAUNCH_RELEASED,
      nextState: BATTLE_TURN_ABORT_STATE, releaseSlot: true, clearBit0: true, notify: null, tally
    });
  }
  return deepFreeze({
    outcome: BATTLE_TURN_LAUNCH_DONE,
    nextState: null,
    releaseSlot: false,
    clearBit0: false,
    notify: launchNotifyCode(requireInteger(input.moveField10 ?? 0, "MOVE_FIELD10")),
    // `ldrsh` then `strh`, so the tally wraps as a signed halfword.
    tally: ((tally + BATTLE_TURN_LAUNCH_TALLY_STEP) << 16) >> 16
  });
}
