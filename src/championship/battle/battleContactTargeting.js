// Contact targeting -- OVL19 0x0211C714..0x0211C954, the bounded caller that
// ends at the DamageResolver call site 0x0211C92C.
//
// Independently re-dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
//
// OVL19 has exactly three direct calls to the resolver 0x021149A8 --
// 0x0211C92C, 0x0211D9E0 and 0x0211D9FC. A full BL scan of the overlay finds no
// call to the RNG helper 0x020431D4 anywhere in 0x0211C714..0x0211C92C, so this
// stage rolls nothing. It selects targets and rejects them; it does not decide
// whether an attack connects.
//
// Traced control flow:
//
//   ldr r1, [sl, #32]        action record (the same record battleDamageCore
//   ldr r0, [r1, #80]        reads power from at +0x4A)
//   sub r0, r0, #2
//   cmp r0, #1
//   bhi 0x0211C958           action +0x50 must be 2 or 3 (unsigned) or this
//                            path is not taken at all
//   ldr r0, [r1, #84]
//   mov r6, #1
//   cmp r0, #0
//   cmpne r0, #1
//   movne r6, #0             action +0x54 in {0,1} => single-target walk
//
//   loop (r5 = 0..2, cmp r5, #3):
//     ldreq r0, [sl, #228] / ldreq r0, [r0, #84] / ldreq r9, [r0, r5, lsl #2]
//     ldrne r9, [sl, #232]           single mode re-reads the same pointer
//     cmp r9, #0
//     beq  next                      REJECT: null target, both modes
//     ldr  r0, [r9, #16]             target -> combatant
//     ldr  r0, [r0, #80]             combatant +0x50 current HP
//     cmp  r0, #0
//     bgt  build                     HP > 0 continues
//     cmp  r6, #0
//     bne  done                      REJECT: single mode ends on a downed target
//     b    next                      REJECT: multi mode skips to the next slot
//     ... builds/updates the effect record at sl+672, stride 436 ...
//     bl   0x021149A8                DamageResolver(target, session, spatial)
//     cmp  r6, #0
//     bne  done                      single mode stops after one resolve
//   next: add r5, r5, #1
//   done: mov r0, #2 ; str r0, [sl, #4]
//
// The same HP gate is enforced a second time at the resolver entry
// (0x021149BC ldr r5,[r4,#80]; cmp r5,#0; addle sp,sp,#28 -> early return),
// so a downed target is rejected on both sides of the call.
//
// WHY THERE IS NO HIT ROLL HERE
// -----------------------------
// Not caution -- evidence. Four independent checks, 2026-08-31:
//
//   1. A full BL scan of OVL19 finds no call to the RNG helper 0x020431D4 in
//      the whole bounded caller region 0x0211C714..0x0211C92C.
//   2. The resolver 0x021149A8 calls that helper exactly twice, at 0x02114CB8
//      and 0x02114CE4. The first is the x3/2 critical branch, the second is the
//      %100 then damage += damage*roll/1000 variance. Neither can skip damage.
//   3. The resolver has exactly five exits (0x021149D8, 0x02114A34, 0x02114A4C,
//      0x02114E8C, 0x02115670) returning 0, 1 or 2. Every early exit is a
//      deterministic state compare -- target HP <= 0, a runtime state in
//      {0,1,2,9,10,11,12}, or +0x17C in 18..21. None of them is a roll, and
//      none of them is a distinct "missed" result code.
//   4. All 3,197 extracted original text records contain no MISS, no dodge and
//      no accuracy vocabulary. The nine keyword hits are false positives:
//      mithril, two action names, and two idioms.
//
// So the original resolves contact, not accuracy: an effect that reaches a
// living target deals damage. Preserving that IS the faithful behavior. Adding
// an accuracy/evasion roll would make the remake play differently from the
// original, which is why the Stage 6 gate prohibits it.
//
// WHAT THIS FILE MUST NOT DO
// --------------------------
// No hit/miss probability, no accuracy or evasion, no Sense mechanic, no TP.
// This module models the walk and its two proven rejections. It opens no
// screen and writes no save field.
//
// The meaning of the 0x02054A4C early-out at 0x0211C730 is UNKNOWN: the control
// flow (a non-zero result returns before any targeting) is proven, the
// subsystem it queries is not traced. It is an opaque input here, not named.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_CONTACT_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_CONTACT_CALLER = "OVL19:0x0211C714";
export const BATTLE_CONTACT_RESOLVER_CALL_SITE = "OVL19:0x0211C92C";

/** OVL19 direct callers of the DamageResolver, from a full BL scan of the overlay. */
export const BATTLE_DAMAGE_RESOLVER_CALL_SITES = deepFreeze([
  "OVL19:0x0211C92C",
  "OVL19:0x0211D9E0",
  "OVL19:0x0211D9FC"
]);

/** cmp r5, #3 -- the walk visits at most three target slots. */
export const BATTLE_CONTACT_TARGET_SLOT_COUNT = 3;

/** sub r0, r0, #2 ; cmp r0, #1 ; bhi -- action +0x50 must be 2 or 3. */
export const BATTLE_CONTACT_ACTION_KINDS = deepFreeze([2, 3]);

/** cmp r0, #0 ; cmpne r0, #1 -- action +0x54 of 0 or 1 selects the single-target walk. */
export const BATTLE_CONTACT_SINGLE_TARGET_SELECTORS = deepFreeze([0, 1]);

/** add r7, sl, #672 then add r7, r7, #436 per slot. */
export const BATTLE_CONTACT_EFFECT_RECORD_BASE_OFFSET = 672;
export const BATTLE_CONTACT_EFFECT_RECORD_STRIDE = 436;

/** The r3 = 0..23 reset loop at 0x0211C73C clears 24 effect slots before the walk. */
export const BATTLE_CONTACT_EFFECT_SLOT_COUNT = 24;

/** mov r0, #2 ; str r0, [sl, #4] on every exit through `done`. */
export const BATTLE_CONTACT_TERMINAL_PHASE = 2;

export const BATTLE_CONTACT_MODE_SINGLE = "SINGLE";
export const BATTLE_CONTACT_MODE_MULTI = "MULTI";

export const BATTLE_CONTACT_PATH_TAKEN = "CONTACT_WALK";
export const BATTLE_CONTACT_PATH_OTHER_HANDLER = "OTHER_HANDLER";
export const BATTLE_CONTACT_PATH_DEFERRED = "DEFERRED";

export const BATTLE_CONTACT_ACCEPTED = "RESOLVE";
export const BATTLE_CONTACT_REJECT_NULL_TARGET = "NULL_TARGET";
export const BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE = "TARGET_HP_NOT_POSITIVE";

function contactError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleContactError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw contactError(`${label} must be a safe integer`);
  }
  return value;
}

/** Unsigned `sub #2; cmp #1; bhi` -- true only for 2 and 3. */
export function isContactActionKind(actionField50) {
  requireSafeInteger(actionField50, "actionField50");
  return actionField50 === 2 || actionField50 === 3;
}

/** `cmp #0; cmpne #1; movne r6,#0` -- single-target walk for 0 and 1 only. */
export function isSingleTargetSelector(actionField54) {
  requireSafeInteger(actionField54, "actionField54");
  return actionField54 === 0 || actionField54 === 1;
}

function readTargetHp(target, slot) {
  // ldr r0, [r9, #16] then ldr r0, [r0, #80]: the HP the resolver also reads.
  const hp = target.currentHp;
  if (!Number.isSafeInteger(hp)) {
    throw contactError(`target slot ${slot} currentHp must be a safe integer`);
  }
  return hp;
}

function normaliseSlots(input, mode) {
  if (mode === BATTLE_CONTACT_MODE_SINGLE) {
    const target = input.singleTarget === undefined ? null : input.singleTarget;
    if (target !== null && typeof target !== "object") {
      throw contactError("singleTarget must be an object or null");
    }
    // ldrne r9, [sl, #232] sits inside the loop: the same pointer every pass.
    return [target, target, target];
  }
  const slots = input.targetSlots;
  if (!Array.isArray(slots)) {
    throw contactError("targetSlots must be an array for the multi-target walk");
  }
  if (slots.length > BATTLE_CONTACT_TARGET_SLOT_COUNT) {
    throw contactError(`targetSlots holds at most ${BATTLE_CONTACT_TARGET_SLOT_COUNT} entries`);
  }
  const filled = [];
  for (let slot = 0; slot < BATTLE_CONTACT_TARGET_SLOT_COUNT; slot += 1) {
    const target = slots[slot] === undefined ? null : slots[slot];
    if (target !== null && typeof target !== "object") {
      throw contactError(`targetSlots[${slot}] must be an object or null`);
    }
    filled.push(target);
  }
  return filled;
}

/**
 * The bounded walk from 0x0211C714 to the resolver call at 0x0211C92C.
 *
 * Returns the visit record rather than calling the resolver, so the caller
 * decides what to do with each accepted target. Nothing here rolls RNG.
 *
 * @param {{
 *   actionField50: number,
 *   actionField54: number,
 *   singleTarget?: object|null,
 *   targetSlots?: Array<object|null>,
 *   deferredQueueResult?: number
 * }} input
 */
export function planBattleContactTargets(input) {
  if (!input || typeof input !== "object") {
    throw contactError("planBattleContactTargets requires a plain object");
  }

  // cmp r0, #0 ; addne sp / ldmneia sp!, {...pc} -- a non-zero result returns
  // before the effect reset and before any targeting. Phase is not written.
  const deferred = input.deferredQueueResult === undefined ? 0 : input.deferredQueueResult;
  requireSafeInteger(deferred, "deferredQueueResult");
  if (deferred !== 0) {
    return deepFreeze({
      path: BATTLE_CONTACT_PATH_DEFERRED,
      mode: null,
      visits: [],
      accepted: [],
      terminalPhaseWritten: false,
      evidence: BATTLE_CONTACT_EVIDENCE
    });
  }

  if (!isContactActionKind(input.actionField50)) {
    // bhi 0x0211C958: a different handler runs. Phase is not written here.
    return deepFreeze({
      path: BATTLE_CONTACT_PATH_OTHER_HANDLER,
      mode: null,
      visits: [],
      accepted: [],
      terminalPhaseWritten: false,
      evidence: BATTLE_CONTACT_EVIDENCE
    });
  }

  const single = isSingleTargetSelector(input.actionField54);
  const mode = single ? BATTLE_CONTACT_MODE_SINGLE : BATTLE_CONTACT_MODE_MULTI;
  const slots = normaliseSlots(input, mode);

  const visits = [];
  const accepted = [];

  for (let slot = 0; slot < BATTLE_CONTACT_TARGET_SLOT_COUNT; slot += 1) {
    const target = slots[slot];

    if (target === null) {
      // beq next -- both modes advance, so a single-target walk with a null
      // pointer still burns all three passes before falling out of the loop.
      visits.push({ slot, outcome: BATTLE_CONTACT_REJECT_NULL_TARGET });
      continue;
    }

    const currentHp = readTargetHp(target, slot);
    if (currentHp <= 0) {
      visits.push({ slot, outcome: BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE, currentHp });
      if (single) break; // bne done
      continue; // b next
    }

    visits.push({
      slot,
      outcome: BATTLE_CONTACT_ACCEPTED,
      currentHp,
      effectRecordOffset:
        BATTLE_CONTACT_EFFECT_RECORD_BASE_OFFSET + slot * BATTLE_CONTACT_EFFECT_RECORD_STRIDE
    });
    accepted.push(target);
    if (single) break; // cmp r6, #0 ; bne done
  }

  return deepFreeze({
    path: BATTLE_CONTACT_PATH_TAKEN,
    mode,
    visits,
    accepted,
    terminalPhase: BATTLE_CONTACT_TERMINAL_PHASE,
    terminalPhaseWritten: true,
    evidence: BATTLE_CONTACT_EVIDENCE
  });
}
