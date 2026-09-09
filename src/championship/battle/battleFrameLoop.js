// Battle frame loop — OVL19 0x0210D6E4, the six-slot per-frame update.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is the orchestrator the other battle modules were written against. It
// invents no arithmetic: the status tick is battleStatus.tickNegativeStatus,
// already traced at 0x0210D700, and everything else here is the order the
// original visits things in and the four places it calls out of the loop.
//
// THE LOOP
// --------
//   0210D6E4  add   r1, sl, r8, lsl #2      slot index
//   0210D6F4  ldr   r0, [r0, #0xe20]        roster[slot], base + 0x5E20 + slot*4
//   0210D6FC  beq   #0x210d904              an empty slot is skipped ENTIRELY
//   0210D908  cmp   r8, #6
//   0210D90C  blt   #0x210d6e4
//
// Ascending, and so is every other six-bounded loop in the overlay: all 24 of
// them increment. That is why two combatants ready on the same frame resolve by
// slot number, lowest first — it is not a tie-break rule, it is the iteration.
//
// THE PHASES, IN ORDER
// --------------------
//   1  negative status, 0x0210D700..0x0210D87C
//        remaining <= 0                  -> clear, and phase 1b is skipped
//        otherwise                       -> tickNegativeStatus, then a death test
//   1b threshold, 0x0210D880..0x0210D8B0, reached ONLY when the status code is 0
//        +0x22 strictly above table[stats +0x18]  -> call out, then zero +0x22
//   2  timer, 0x0210D8B4..0x0210D8D8
//        +0x160 non-zero: decrement +0x164 while positive, else call out
//   3  counters, 0x0210D8DC..0x0210D900
//        +0x24 and +0x28 each decrement while strictly positive
//
// Phase 3 runs for a combatant that died in phase 1: the death handler branches
// to 0x0210D8B4, which is phase 2, and falls through. Only an empty slot escapes
// the counters.
//
// THE THRESHOLD TABLE
// -------------------
// 0x0212FE74, u16, indexed by stats +0x18. It is eight entries because the move
// ladder's own table begins at 0x0212FE84, sixteen bytes later — the same table
// battleActionSelection already reads. 9999 in three of the eight slots is the
// original's way of writing "never".
//
// WHAT THIS MODULE REFUSES TO DECIDE
// ----------------------------------
// The loop calls out to four routines. Two of the four have since been read and
// are now applied rather than only announced:
//
//   0x02114984  four instructions. Writes the state to +0x168 AND arms the
//               counter at +0x16C to -255. The death path was setting the state
//               and not the counter, so a defeated combatant never got an entry
//               frame and kept the period its previous state had armed.
//   0x02112820  the notify. Its two stores are traced — the code lands in
//               +0x17C and +0x180 is armed at -255 — so both are applied. The
//               exit routine is bound by battleHitRuntime; the DEFEATED event
//               retains the previous code for that exit callback.
//
// The other two are still only events naming their ROM address: 0x0211452C when
// a status ends or a combatant dies, 0x0211479C when the timer runs out, and
// 0x021145C0 with 1 when the threshold is crossed. A caller decides what they
// mean.
//
// Nothing here selects an action, resolves contact, or applies damage. Those are
// battleActionSelection, battleContactTargeting and battleDamageResolver, and
// this loop is not where the original calls them.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { tickNegativeStatus } from "./battleStatus.js";
import { enterBattleState, notifyBattleState } from "./battleStateMachine.js";

export const BATTLE_FRAME_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_FRAME_LOOP_SITE = "OVL19:0x0210D6E4";

/** cmp r8,#6 at 0x0210D908. Six slots, visited 0 through 5. */
export const BATTLE_FRAME_SLOT_COUNT = 6;

/** roster[slot] is read at base + 0x5E20 + slot*4 (0x0210D6E8 + 0x0210D6F0). */
export const BATTLE_FRAME_ROSTER_BASE_OFFSET = 0x5e20;

/** OVL19 0x0212FE74, u16 x 8, ending where the move ladder's table starts. */
export const BATTLE_FRAME_THRESHOLD_TABLE_BASE = 0x0212fe74;
export const BATTLE_FRAME_THRESHOLD_TABLE = deepFreeze([100, 100, 100, 9999, 50, 9999, 50, 9999]);

/** battleActionSelection's move ladder, and the reason the table above is eight. */
export const BATTLE_FRAME_THRESHOLD_TABLE_END = 0x0212fe84;

/** The two arguments the death handler passes out, at 0x0210D7A8 and 0x0210D7B4. */
export const BATTLE_FRAME_DEATH_STATE = 0x17;
export const BATTLE_FRAME_DEATH_NOTIFY = 0x12;

export const BATTLE_FRAME_EVENT_STATUS_EXPIRED = "STATUS_EXPIRED";
export const BATTLE_FRAME_EVENT_DEFEATED = "DEFEATED";
export const BATTLE_FRAME_EVENT_TIMER_ELAPSED = "TIMER_ELAPSED";
export const BATTLE_FRAME_EVENT_THRESHOLD_CROSSED = "THRESHOLD_CROSSED";

/** Which ROM routine each event stands for; battleHitRuntime binds the writers. */
export const BATTLE_FRAME_EVENT_SITES = deepFreeze({
  [BATTLE_FRAME_EVENT_STATUS_EXPIRED]: "OVL19:0x0211452C",
  [BATTLE_FRAME_EVENT_DEFEATED]: "OVL19:0x0211452C + 0x02114984 + 0x02112820",
  [BATTLE_FRAME_EVENT_TIMER_ELAPSED]: "OVL19:0x0211479C",
  [BATTLE_FRAME_EVENT_THRESHOLD_CROSSED]: "OVL19:0x021145C0"
});

/** Exactly the fields the loop body touches; anything else is refused. */
export const BATTLE_FRAME_COMBATANT_FIELDS = deepFreeze([
  "statusCode",       // +0x158
  "statusRemaining",  // +0x15C
  "currentHp",        // stats +0x50
  "maxHp",            // stats +0x58
  "field22",          // +0x22, the u16 the threshold compares
  "field18",          // stats +0x18, the threshold table index
  "field160",         // +0x160, gates the timer
  "field164",         // +0x164, the timer
  "field24",          // +0x24
  "field28",          // +0x28
  "field3C",          // +0x3C, zeroed on death
  // The four the death path's two call-outs write. They were left off this list
  // while both routines were only announced; 0x02114984 and 0x02112820's stores
  // are traced now, so the fields they land in belong here.
  "state",            // +0x168, via 0x02114984
  "stateCounter",     // +0x16C, armed at -255 by the same routine
  "field17C",         // +0x17C, the notify code, via 0x02112820
  "field180"          // +0x180, armed at -255 by the same routine
]);

function frameError(message) {
  return new Error(`BATTLE_FRAME_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw frameError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** A combatant with every field the loop touches, defaulted to inert. */
export function createFrameCombatant(overrides = {}) {
  const combatant = {
    statusCode: 0,
    statusRemaining: 0,
    currentHp: 1,
    maxHp: 1,
    field22: 0,
    field18: 0,
    field160: 0,
    field164: 0,
    field24: 0,
    field28: 0,
    field3C: 0,
    state: 0,
    stateCounter: 0,
    field17C: 0,
    field180: 0
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (!BATTLE_FRAME_COMBATANT_FIELDS.includes(key)) {
      throw frameError(`UNKNOWN_COMBATANT_FIELD: ${key}`);
    }
    combatant[key] = value;
  }
  for (const key of BATTLE_FRAME_COMBATANT_FIELDS) {
    requireInteger(combatant[key], key.toUpperCase());
  }
  return combatant;
}

function thresholdFor(field18) {
  if (field18 < 0 || field18 >= BATTLE_FRAME_THRESHOLD_TABLE.length) {
    // The original applies no bound check and would read into the move ladder's
    // table at 0x0212FE84. Refuse rather than return a neighbouring table's word.
    throw frameError(`THRESHOLD_INDEX_OUT_OF_RANGE_UNTRACED: ${field18}`);
  }
  return BATTLE_FRAME_THRESHOLD_TABLE[field18];
}

/**
 * One slot's turn through the loop body. Returns the updated combatant and the
 * events the original would have called out for.
 */
export function stepFrameSlot(input, slot = 0) {
  const combatant = createFrameCombatant(input);
  const events = [];
  let diedThisFrame = false;

  // --- phase 1 / 1b -------------------------------------------------------
  if (combatant.statusCode !== 0) {
    if (combatant.statusRemaining <= 0) {
      combatant.statusCode = 0;
      combatant.statusRemaining = 0;
      events.push({ type: BATTLE_FRAME_EVENT_STATUS_EXPIRED, slot });
    } else {
      const ticked = tickNegativeStatus({
        runtimeCode: combatant.statusCode,
        remainingDuration: combatant.statusRemaining,
        currentHp: combatant.currentHp,
        maxHp: combatant.maxHp
      });
      // The tick clearing a code with time still on its clock is how the status
      // path reports a death: battleStatus clamps the HP itself, so the shared
      // test below would never see a negative from this route.
      if (ticked.runtimeCode === 0) diedThisFrame = true;
      combatant.statusCode = ticked.runtimeCode;
      combatant.statusRemaining = ticked.remainingDuration;
      combatant.currentHp = ticked.currentHp;
    }
  } else if (combatant.field22 > thresholdFor(combatant.field18)) {
    events.push({ type: BATTLE_FRAME_EVENT_THRESHOLD_CROSSED, slot, argument: 1 });
    combatant.field22 = 0;
  }

  // 0210D700 checks the status first. Only a due damage tick reaches the
  // HP<0 branches at 0210D790 / 0210D834. Ordinary hits clamp HP immediately
  // in 02114FAC and enter reaction 15; they must land before notification 18.
  // The older unconditional negative-HP fallback incorrectly skipped that
  // distinction. A non-damage status or a tick that is not due leaves HP alone.
  if (diedThisFrame) {
    combatant.currentHp = 0;
    // 0x0210D7A0 calls 0x0211452C, which is the same routine BATTLE_FRAME_EVENT_
    // SITES names for a status expiring, so dying clears the status too.
    combatant.statusCode = 0;
    combatant.statusRemaining = 0;
    combatant.field3C = 0;
    // 0x0210D7AC passes 0x17 to the state setter. Living hit reactions also use
    // this state; HP and the notification decide whether recovery is required.
    //
    // CORRECTION. Only the state was being written. 0x02114984 is four
    // instructions and the second pair is `mvn r1,#0xfe / str r1,[r0,#0x16c]`,
    // so entering a state ALWAYS arms the counter at -255 as well. Without it
    // the dispatcher saw a counter still climbing from whatever state the
    // combatant came out of: no entry frame, so state 0x17 never armed its own
    // period of 4 and ran against its predecessor's instead.
    const entered = enterBattleState(BATTLE_FRAME_DEATH_STATE);
    combatant.state = entered.state;
    combatant.stateCounter = entered.counter;
    // 0x0210D7B8 then notifies 0x12. The two stores are all that is translated;
    // the exit routine the notify runs first is named on the event, not run.
    const notified = notifyBattleState(BATTLE_FRAME_DEATH_NOTIFY, combatant.field17C);
    combatant.field17C = notified.code;
    combatant.field180 = notified.counter;
    events.push({
      type: BATTLE_FRAME_EVENT_DEFEATED,
      slot,
      state: BATTLE_FRAME_DEATH_STATE,
      notify: BATTLE_FRAME_DEATH_NOTIFY,
      exitHandlerFor: notified.exitHandlerFor
    });
  }

  // --- phase 2 ------------------------------------------------------------
  if (combatant.field160 !== 0) {
    if (combatant.field164 > 0) {
      combatant.field164 -= 1;
    } else {
      events.push({ type: BATTLE_FRAME_EVENT_TIMER_ELAPSED, slot });
    }
  }

  // --- phase 3 ------------------------------------------------------------
  if (combatant.field24 > 0) {
    combatant.field24 -= 1;
  }
  if (combatant.field28 > 0) {
    combatant.field28 -= 1;
  }

  return { combatant: deepFreeze(combatant), events: deepFreeze(events) };
}

/**
 * One frame over the whole roster. `slots` is six entries, each a combatant or
 * null; an empty slot is skipped whole, counters included.
 */
export function stepBattleFrame(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.slots)) {
    throw frameError("STEP_REQUIRES_A_SLOTS_ARRAY");
  }
  if (input.slots.length !== BATTLE_FRAME_SLOT_COUNT) {
    throw frameError(`SLOTS_MUST_BE_${BATTLE_FRAME_SLOT_COUNT}_LONG`);
  }

  const slots = [];
  const events = [];
  for (let slot = 0; slot < BATTLE_FRAME_SLOT_COUNT; slot += 1) {
    const entry = input.slots[slot];
    if (entry === null || entry === undefined) {
      slots.push(null);
      continue;
    }
    const stepped = stepFrameSlot(entry, slot);
    slots.push(stepped.combatant);
    events.push(...stepped.events);
  }
  return deepFreeze({ slots: deepFreeze(slots), events: deepFreeze(events) });
}
