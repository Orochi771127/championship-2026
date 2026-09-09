// Battle state graph — what each of the 27 states does and where it goes.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// battleStateMachine is the dispatcher; this is the map. Every row was extracted
// mechanically from the handler's own bytes — the `mov r1,#N / bl 0x02114984`
// pairs give the transitions, the `str` to +0x170 gives the period a state arms
// on entry, and the `bl` targets give what it reaches. Two handlers were then
// read by hand and are implemented below; the extraction agreed with both.
//
// THE SHAPE OF THE GRAPH
// ----------------------
// State 1 is the hub. It is the negative-status action gate, and it fans out to
// 3, 8, 9, 10, 12 and 13. State 2 — AI action selection, which nothing in the
// ROM ever names with a literal — fans out to 3, 4, 5, 6 and 7. The 4/5/6/7
// group leads into 14, 15 and 16, and all three of those come back to 1.
// State 11 waits out a status and then returns to 1, or drops to 0 if the
// combatant is dead. State 0 is an idle that arms a 60-frame period and does
// nothing else, forever.
//
// WHERE DAMAGE ACTUALLY HAPPENS — AND A CORRECTION
// ------------------------------------------------
// Not one of the 27 handlers calls the damage resolver or the contact walk. The
// resolver at 0x021149A8 has three call sites: 0x0211C92C, inside the contact
// walk itself, and 0x0211D9E0 and 0x0211D9FC, which are both inside
// 0x0211D71C — a battle-script CALL_NATIVE target. So the state machine
// schedules and the move's script executes: the attack is bytecode, and damage
// lands through a native the script calls.
//
// An earlier assessment in this lane ranked the 67 natives as presentation
// plumbing and deprioritised them. That was drawn from the two most-CALLED
// natives, which are a 16-byte yield and a 40-byte roll. By size the picture is
// different: the median native is 52 bytes, but 0x0211D71C is 2,124 and is the
// one the damage resolver hangs off. Most of the set is plumbing; the exception
// is the attack itself.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// Twenty-four of the twenty-seven handler bodies. The graph says where a state
// goes and what it reaches, not what it means, and no state is given a name it
// has not earned. The three implemented below are the three small enough to
// read whole and confirm line by line.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  BATTLE_STATE_COUNT,
  BATTLE_STATE_HANDLERS,
  BATTLE_STATE_INERT_STATES,
  getBattleStateHandler
} from "./battleStateMachine.js";

export const BATTLE_STATE_GRAPH_EVIDENCE = "VERIFIED_BINARY";

/** The CALL_NATIVE target the damage resolver hangs off, 2,124 bytes. */
export const BATTLE_SCRIPT_DAMAGE_NATIVE = 0x0211d71c;

/** The three call sites of the resolver at OVL19 0x021149A8. */
export const BATTLE_DAMAGE_RESOLVER_CALL_SITES = deepFreeze([
  { site: 0x0211c92c, within: "CONTACT_WALK" },
  { site: 0x0211d9e0, within: "SCRIPT_NATIVE_0x0211D71C" },
  { site: 0x0211d9fc, within: "SCRIPT_NATIVE_0x0211D71C" }
]);

/**
 * `entryPeriod` is what the handler writes to +0x170 on its entry frame:
 * a number when it is a literal, "COMPUTED" when the value is worked out, and
 * null when the handler never writes the field at all.
 */
export const BATTLE_STATE_PROFILES = deepFreeze([
  { state: 0, handlerBytes: 20, entryPeriod: 60, transitionsTo: [], reaches: [] },
  { state: 1, handlerBytes: 536, entryPeriod: null, transitionsTo: [3, 8, 9, 10, 12, 13], reaches: ["AI_SELECT", "STATUS_CLEAR"] },
  { state: 2, handlerBytes: 1380, entryPeriod: null, transitionsTo: [3, 4, 5, 6, 7], reaches: ["AFFORDABLE_SCAN", "RNG_ROLL"] },
  { state: 3, handlerBytes: 696, entryPeriod: "COMPUTED", transitionsTo: [], reaches: ["ACTION_GATE", "NOTIFY", "RNG_ROLL"] },
  { state: 4, handlerBytes: 292, entryPeriod: 4, transitionsTo: [14], reaches: ["ACTION_GATE", "NOTIFY"] },
  { state: 5, handlerBytes: 292, entryPeriod: 4, transitionsTo: [15], reaches: ["ACTION_GATE", "NOTIFY"] },
  { state: 6, handlerBytes: 60, entryPeriod: null, transitionsTo: [15], reaches: ["ACTION_GATE"] },
  { state: 7, handlerBytes: 84, entryPeriod: null, transitionsTo: [16], reaches: ["ACTION_GATE", "NOTIFY"] },
  { state: 8, handlerBytes: 364, entryPeriod: 4, transitionsTo: [11, 14], reaches: ["ACTION_GATE", "NOTIFY", "RNG_ROLL"] },
  { state: 9, handlerBytes: 28, entryPeriod: null, transitionsTo: [], reaches: ["NOTIFY"] },
  { state: 10, handlerBytes: 444, entryPeriod: 4, transitionsTo: [11, 14], reaches: ["ACTION_GATE", "NOTIFY", "RNG_ROLL"] },
  { state: 11, handlerBytes: 112, entryPeriod: 1, transitionsTo: [0, 1], reaches: ["NOTIFY", "STATUS_CLEAR"] },
  { state: 12, handlerBytes: 364, entryPeriod: "COMPUTED", transitionsTo: [], reaches: ["NOTIFY", "RNG_ROLL"] },
  { state: 13, handlerBytes: 188, entryPeriod: 1, transitionsTo: [], reaches: ["ACTION_GATE", "NOTIFY", "RNG_ROLL"] },
  { state: 14, handlerBytes: 520, entryPeriod: 1, transitionsTo: [1], reaches: ["NOTIFY"] },
  { state: 15, handlerBytes: 488, entryPeriod: 1, transitionsTo: [1], reaches: ["NOTIFY"] },
  { state: 16, handlerBytes: 548, entryPeriod: 1, transitionsTo: [1], reaches: ["NOTIFY", "RNG_ROLL", "THRESHOLD_CALLOUT"] },
  { state: 17, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 18, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 19, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 20, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 21, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 22, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 23, handlerBytes: 52, entryPeriod: 4, transitionsTo: [], reaches: ["ACTION_GATE"] },
  { state: 24, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 25, handlerBytes: 4, entryPeriod: null, transitionsTo: [], reaches: [] },
  { state: 26, handlerBytes: 64, entryPeriod: null, transitionsTo: [], reaches: ["NOTIFY"] }
]);

/** The three whose bodies were read whole and are implemented below. */
export const BATTLE_STATE_BODIES_TRANSLATED = deepFreeze([0, 11, 23]);

/** State 23's test at 0x021170EC: only this notify code falls into state 1. */
export const BATTLE_STATE_DEFEATED_GATE_CODE = 1;

function graphError(message) {
  return new Error(`BATTLE_STATE_GRAPH_${message}`);
}

export function getStateProfile(state) {
  getBattleStateHandler(state);
  return BATTLE_STATE_PROFILES[state];
}

/** Every state reachable in one step, or [] for a state that sets none. */
export function listStateTransitions(state) {
  return getStateProfile(state).transitionsTo;
}

/**
 * OVL19 0x021157A8, read whole:
 *   ldr r1,[r0,#0x16c] / cmp r1,#0 / moveq r1,#0x3c / streq r1,[r0,#0x170]
 * On the entry frame it arms a 60-frame period. It does nothing else, ever, and
 * it names no successor — a combatant in state 0 stays there until something
 * outside the machine moves it.
 */
export function runIdleState(counter) {
  if (!Number.isSafeInteger(counter)) {
    throw graphError("COUNTER_MUST_BE_AN_INTEGER");
  }
  return deepFreeze({ period: counter === 0 ? 60 : null, nextState: null });
}

/**
 * OVL19 0x0211680C, read whole:
 *   entry frame            -> period = 1
 *   statusRemaining > 0    -> return, keep waiting
 *   otherwise              -> statusClear, then HP > 0 ? state 1 : state 0
 * The dead branch notifies 0x12, the same code battleFrameLoop's death path
 * uses; the live branch notifies 1.
 */
export function runStatusWaitState(input) {
  if (!input || typeof input !== "object") {
    throw graphError("STATUS_WAIT_REQUIRES_AN_OBJECT");
  }
  for (const key of ["counter", "statusRemaining", "currentHp"]) {
    if (!Number.isSafeInteger(input[key])) {
      throw graphError(`${key.toUpperCase()}_MUST_BE_AN_INTEGER`);
    }
  }
  const period = input.counter === 0 ? 1 : null;
  if (input.statusRemaining > 0) {
    return deepFreeze({ period, waiting: true, clearedStatus: false, nextState: null, notify: null });
  }
  const alive = input.currentHp > 0;
  return deepFreeze({
    period,
    waiting: false,
    clearedStatus: true,
    nextState: alive ? 1 : 0,
    notify: alive ? 1 : 0x12
  });
}

/**
 * OVL19 0x021170D0, read whole — thirteen instructions, the state the frame
 * loop's death path puts a combatant into:
 *
 *   021170D4  ldr    r1, [r0, #0x16c]
 *   021170DC  moveq  r1, #4
 *   021170E0  streq  r1, [r0, #0x170]   entry frame: arm 4, return
 *   021170E8  ldr    r1, [r0, #0x17c]
 *   021170EC  cmp    r1, #1
 *   021170F4  strne  r1, [r0, #0x170]   any other notify code: arm 4, return
 *   021170FC  bl     #0x21157bc         code 1: state 1's routine, in place
 *
 * Three things it does NOT do, all of them checked against the bytes rather
 * than assumed. It never calls 0x02114984, so a combatant never leaves state 23
 * by this handler — being down is durable. It runs state 1's routine WITHOUT
 * looking at HP, because 0x021157BC opens on the +0x158 jump table and has no
 * liveness gate of its own. And on the falling-through path it does not rewrite
 * the period, so the 4 armed on the entry frame is what stands.
 *
 * The gate is the notify code at +0x17C, which 0x02112820 writes. The death
 * path notifies 0x12, so a combatant that has just died does NOT take the call;
 * something would have to notify it 1 afterwards. Whether anything ever does is
 * not decided here — the handler is translated, not predicted.
 */
export function runDefeatedState(input) {
  if (!input || typeof input !== "object") {
    throw graphError("DEFEATED_REQUIRES_AN_OBJECT");
  }
  for (const key of ["counter", "field17C"]) {
    if (!Number.isSafeInteger(input[key])) {
      throw graphError(`${key.toUpperCase()}_MUST_BE_AN_INTEGER`);
    }
  }
  if (input.counter === 0) {
    return deepFreeze({ period: 4, runsActionGate: false });
  }
  if (input.field17C !== BATTLE_STATE_DEFEATED_GATE_CODE) {
    return deepFreeze({ period: 4, runsActionGate: false });
  }
  return deepFreeze({ period: null, runsActionGate: true });
}

/** Sanity: the graph must describe exactly the states the machine has. */
export function assertGraphMatchesMachine() {
  if (BATTLE_STATE_PROFILES.length !== BATTLE_STATE_COUNT) {
    throw graphError("PROFILE_COUNT_MISMATCH");
  }
  for (const profile of BATTLE_STATE_PROFILES) {
    if (BATTLE_STATE_HANDLERS[profile.state] === undefined) {
      throw graphError(`UNKNOWN_STATE: ${profile.state}`);
    }
    const inert = BATTLE_STATE_INERT_STATES.includes(profile.state);
    if (inert !== (profile.handlerBytes === 4)) {
      throw graphError(`INERT_DISAGREES_WITH_SIZE: ${profile.state}`);
    }
  }
  return true;
}
