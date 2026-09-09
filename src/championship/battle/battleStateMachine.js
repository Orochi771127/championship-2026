// Battle state machine — OVL19 0x021156F8 dispatch, 27 states at 0x0213040C.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is the half of B4 the frame loop alone did not reach: the thing that
// decides a combatant acts. The frame function at OVL19 0x0210D33C runs two
// six-slot loops in order —
//
//   0x0210D644  state dispatch, this module
//   0x0210D6E4  status / threshold / timer / counters, battleFrameLoop
//
// both ascending, both skipping an empty roster slot.
//
// THE DISPATCH
// ------------
//   021156FC  mov   r5, r0
//   02115700  ldrh  r0, [r5, #0x9a]
//   02115708  lsl   r0, r0, #0x1e
//   0211570C  lsrs  r0, r0, #0x1f      bit 1 of +0x9A
//   02115710  popne                    suspended: no handler, no counter tick
//   02115714  ldr   r0, [r5, #0x16c]
//   0211571C  bge   #0x2115758         counter >= 0 is the update path
//   02115728  str   r1, [r5, #0x16c]   entry: counter = 0, then run
//   02115758  ldr   r1, [r5, #0x170]
//   0211575C  bl    #0x202b558         signed divide; r1 comes back the remainder
//   02115764  bne   #0x2115794         off-beat: skip the handler
//   0211572C  add   r1, r0, r4, lsl #3 &table[state], stride 8
//   02115750  blx   r1
//   02115794  ldr   r0, [r5, #0x16c]
//   02115798  add   r0, r0, #1         every path but the suspended one ticks
//
// So a state's handler runs on the frame it is entered, and after that only on
// frames where the state's own counter is an exact multiple of its period at
// +0x170. A period of 0 takes the divide's zero path at ARM9 0x0202B750, which
// returns a remainder of 0 — so period 0 means every frame, not never.
//
// ENTERING A STATE
// ----------------
//   02114984  str   r1, [r0, #0x168]   the state
//   02114988  mvn   r1, #0xfe
//   0211498C  str   r1, [r0, #0x16c]   the counter, -255
//
// Any negative would do, since the dispatcher overwrites it with 0; -255 is
// what the ROM writes and is kept here rather than normalised to -1.
//
// WHY 27
// ------
// The table's 27th entry would be at 0x021304E4, whose words are 0x001F0000 and
// 0x01FF03E0 — neither is inside OVL19's code, and a little further on the
// bytes are UTF-16LE text. Every one of the 27 before it is. Cross-checked from
// the other side: sweeping all 70 `bl 0x02114984` sites, the literal state codes
// the ROM ever sets are 0, 1, 3..16 and 23, all inside the table.
//
// WHAT THE STATES ALREADY ARE
// ---------------------------
// Three of the handlers are routines this repository already translated, which
// is what makes the machine worth having:
//
//   state 1   0x021157BC  the negative-status action gate  (battleStatus)
//   state 2   0x021159D4  AI action selection              (battleActionSelection)
//   state 3   0x02115F38  ends by gating on the cooldown at +0x28 and, when it
//                         has run out, falling into state 1's routine
//
// That last one is the link the frame loop was missing: battleFrameLoop ticks
// +0x28 down, and state 3 is where a spent cooldown turns into an action.
//
// Eight of the handlers are `bx lr` — 17 through 22, then 24 and 25 on the far
// side of state 23's body. Real table entries that do nothing, and not one is a
// code the ROM ever sets. They are kept because the table keeps them.
//
// THE OTHER PAIR — NOTIFY, 0x02112820
// -----------------------------------
// +0x168/+0x16C is not the only state a combatant carries. 0x02112820 is the
// same idiom over a second pair, and it is what the death path calls straight
// after 0x02114984:
//
//   02112828  ldr   r6, [pc, ...]      a 26-entry template at 0x0211F7D0
//   02112830  mov   r5, r0             the combatant
//   02112834  mov   r4, r1             the code
//   0211283C  ldm/stm                  the template is copied to the stack,
//                                      then overwritten with a default pair
//   02112928  ldr   r1, [r5, #0x17c]   the code it is ALREADY carrying
//   02112930  ldr   r0, [r2, r1, lsl #3]
//   02112938  beq   #0x2112964         a null entry skips the call
//   02112960  blx   r1                 otherwise the old code's exit routine
//   02112964  str   r4, [r5, #0x17c]   and only then the new code
//   02112968  mvn   r0, #0xfe
//   0211296C  str   r0, [r5, #0x180]   armed at -255, same as +0x16C
//
// So +0x17C is the code a combatant was last notified with, and the routine
// runs the OLD code's handler on the way out. There is exactly one exit, so the
// two stores always happen. Both are modelled below; the 26 exit routines are
// NOT — the table is built on the stack from a template and this lane has not
// walked it.
//
// WHAT THIS MODULE DOES NOT DECIDE
// --------------------------------
// What the other twenty handlers do. The dispatcher is traced; the bodies are
// not, and this module reports which handler would run rather than running one.
// It also does not know what +0x9A bit 1 means, only that it suspends, and it
// does not know what any notify code means beyond the number.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_STATE_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_STATE_DISPATCH_SITE = "OVL19:0x021156F8";
export const BATTLE_STATE_SET_SITE = "OVL19:0x02114984";
export const BATTLE_STATE_FRAME_FUNCTION = "OVL19:0x0210D33C";

/**
 * The dispatch loop runs before the tick loop, inside the frame function. They
 * are not adjacent: the frame runs eleven loops in all and the in-flight update
 * sits between these two. battleInFlight.BATTLE_FRAME_LOOPS has the full list.
 */
export const BATTLE_STATE_FRAME_PHASE_ORDER = deepFreeze([
  { site: "OVL19:0x0210D644", phase: "STATE_DISPATCH" },
  { site: "OVL19:0x0210D6E4", phase: "STATUS_AND_COUNTERS" }
]);

export const BATTLE_STATE_TABLE_BASE = 0x0213040c;
export const BATTLE_STATE_TABLE_STRIDE = 8;
export const BATTLE_STATE_COUNT = 27;

/** mvn r1,#0xfe at 0x02114988. */
export const BATTLE_STATE_ENTRY_COUNTER = -255;

/** bit 1 of the u16 at +0x9A, tested at 0x02115708. */
export const BATTLE_STATE_SUSPEND_MASK = 2;

/** Combatant offsets the dispatcher touches. */
export const BATTLE_STATE_CODE_OFFSET = 0x168;
export const BATTLE_STATE_COUNTER_OFFSET = 0x16c;
export const BATTLE_STATE_PERIOD_OFFSET = 0x170;

/** The notify pair 0x02112820 writes: the code, then a counter armed at -255. */
export const BATTLE_STATE_NOTIFY_SITE = "OVL19:0x02112820";
export const BATTLE_STATE_NOTIFY_CODE_OFFSET = 0x17c;
export const BATTLE_STATE_NOTIFY_COUNTER_OFFSET = 0x180;
/** mvn r0,#0xfe at 0x02112968, the same constant 0x02114988 writes. */
export const BATTLE_STATE_NOTIFY_COUNTER = -255;

/** The handler each state index reaches, in table order. */
export const BATTLE_STATE_HANDLERS = deepFreeze([
  0x021157a8, 0x021157bc, 0x021159d4, 0x02115f38, 0x021161f0, 0x02116314,
  0x02116438, 0x02116474, 0x021164c8, 0x02116634, 0x02116650, 0x0211680c,
  0x0211687c, 0x021169e8, 0x02116aa4, 0x02116cac, 0x02116e94, 0x021170b8,
  0x021170bc, 0x021170c0, 0x021170c4, 0x021170c8, 0x021170cc, 0x021170d0,
  0x02117104, 0x02117108, 0x0211710c
]);

/**
 * Handlers that are a bare `bx lr`: six in a row at 0x021170B8..0x021170CC and
 * two more at 0x02117104 and 0x02117108, on the far side of state 23's body.
 * Eight real table entries that do nothing, and not one of them is a code the
 * ROM ever sets.
 */
export const BATTLE_STATE_INERT_STATES = deepFreeze([17, 18, 19, 20, 21, 22, 24, 25]);

/** Every literal state code any of the 70 `bl 0x02114984` sites passes. */
export const BATTLE_STATE_CODES_SET_BY_ROM = deepFreeze([
  0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23
]);

/** The three states whose handlers this repository has already translated. */
export const BATTLE_STATE_ACTION_GATE = 1;
export const BATTLE_STATE_AI_SELECT = 2;
export const BATTLE_STATE_COOLDOWN_GATE = 3;
/** What battleFrameLoop's death path sets, at 0x0210D7A8. */
export const BATTLE_STATE_DEFEATED = 0x17;

export const BATTLE_STATE_DISPATCH_SUSPENDED = "SUSPENDED";
export const BATTLE_STATE_DISPATCH_ENTER = "ENTER";
export const BATTLE_STATE_DISPATCH_UPDATE = "UPDATE";
export const BATTLE_STATE_DISPATCH_THROTTLED = "THROTTLED";

function stateError(message) {
  return new Error(`BATTLE_STATE_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw stateError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

export function getBattleStateHandler(state) {
  requireInteger(state, "STATE");
  if (state < 0 || state >= BATTLE_STATE_COUNT) {
    // The dispatcher applies no bound check and would read past the table into
    // words that are not code. Refuse rather than hand back a non-address.
    throw stateError(`OUT_OF_RANGE_UNTRACED: ${state}`);
  }
  return BATTLE_STATE_HANDLERS[state];
}

/**
 * ARM9 0x0202B558 with a zero divisor, which reaches 0x0202B750 and returns the
 * remainder untouched at 0. Signed and truncating everywhere else.
 */
export function stateThrottleRemainder(counter, period) {
  requireInteger(counter, "COUNTER");
  requireInteger(period, "PERIOD");
  if (period === 0) {
    return 0;
  }
  const quotient = Math.trunc(counter / period);
  return counter - period * quotient;
}

/** OVL19 0x02114984. Sets the state and arms the counter at -255. */
export function enterBattleState(state) {
  getBattleStateHandler(state);
  return deepFreeze({ state, counter: BATTLE_STATE_ENTRY_COUNTER });
}

/**
 * OVL19 0x02112820. Returns the pair the routine leaves behind: the new code in
 * +0x17C and +0x180 armed at -255.
 *
 * The call it makes first — the OLD code's entry in the 26-slot table — is not
 * translated, so `exitHandlerFor` names the code whose routine would have run
 * and nothing is invented for it. A null entry is skipped by the ROM itself.
 */
export function notifyBattleState(code, currentCode = 0) {
  requireInteger(code, "NOTIFY_CODE");
  requireInteger(currentCode, "NOTIFY_CURRENT_CODE");
  return deepFreeze({
    code,
    counter: BATTLE_STATE_NOTIFY_COUNTER,
    exitHandlerFor: currentCode
  });
}

/**
 * State 3 ends at 0x021161D0: `ldr r0,[r5,#0x28] / cmp r0,#0 / popgt`, and only
 * a spent cooldown falls through into state 1's routine at 0x021157BC. This is
 * the join between battleFrameLoop's counter tick and an action being chosen.
 */
export function cooldownGateAllowsAction(field28) {
  requireInteger(field28, "FIELD28");
  return field28 <= 0;
}

/**
 * One combatant's turn through OVL19 0x021156F8. Returns what the original
 * would have done and the counter it would leave behind; the handler body is
 * reported, not run.
 */
export function dispatchBattleState(input) {
  if (!input || typeof input !== "object") {
    throw stateError("DISPATCH_REQUIRES_AN_OBJECT");
  }
  const state = requireInteger(input.state, "STATE");
  const counter = requireInteger(input.counter, "COUNTER");
  const period = requireInteger(input.period ?? 0, "PERIOD");
  const flags = requireInteger(input.flags9A ?? 0, "FLAGS9A");
  const handler = getBattleStateHandler(state);

  if ((flags & BATTLE_STATE_SUSPEND_MASK) !== 0) {
    // 0x02115710 returns before the increment, so the counter does not move.
    return deepFreeze({
      outcome: BATTLE_STATE_DISPATCH_SUSPENDED,
      state,
      counter,
      handler: null,
      inert: false
    });
  }

  let outcome;
  let runningCounter = counter;
  if (counter < 0) {
    runningCounter = 0;
    outcome = BATTLE_STATE_DISPATCH_ENTER;
  } else if (stateThrottleRemainder(counter, period) !== 0) {
    outcome = BATTLE_STATE_DISPATCH_THROTTLED;
  } else {
    outcome = BATTLE_STATE_DISPATCH_UPDATE;
  }

  const ran = outcome !== BATTLE_STATE_DISPATCH_THROTTLED;
  return deepFreeze({
    outcome,
    state,
    // 0x02115794 increments on all three of these paths.
    counter: runningCounter + 1,
    handler: ran ? handler : null,
    inert: ran ? BATTLE_STATE_INERT_STATES.includes(state) : false
  });
}
