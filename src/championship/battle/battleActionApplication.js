// Action application — OVL19 0x0211D71C, the script native that lands an attack.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is where a move stops being a schedule and becomes damage. The state
// machine never calls the damage resolver; a move's bytecode does, through this
// native. It is the largest of the 67 CALL_NATIVE targets at 2,124 bytes, and
// the script blob calls it from exactly one site.
//
// THE SCRIPT CONTRACT
// -------------------
//   0211D720  mov  r1, #2
//   0211D728  bl   0x02054A34        argument 2
//   0211D734  asr  r1, r1, #0xc      Q12 -> integer
//   0211D738  bl   0x0211D740
//   0211D754  bl   0x02054A34        argument 0, the action object
//   0211D764  bl   0x02054A34        argument 1
//
// Three arguments. Argument 0 is the action, argument 1 is either 0 or a
// parameter block, and argument 2 is a Q12 number the entry truncates to an
// integer — called `kind` here because the only thing traced about it is that
// 13 is special.
//
// THE TARGET WALK
// ---------------
//   0211D790  ldr  r5, [r0, #0xe20]  roster[slot], base + 0x5E20 + slot*4
//   0211DF38  cmp  r0, #6
//   0211DF3C  blt  #0x211d77c
//
// The same six-slot roster the frame loop walks, ascending, and the routine
// returns the number of slots that survived every rejection. Four rejections,
// in this order:
//
//   0211D794  the slot is empty
//   0211D79C  the slot IS the attacker, which is action +0xE4
//   0211D7B8  attacker +0x54 equals target +0x54 — unless the attacker's status
//             at +0x158 is exactly 5, which skips this check entirely
//   0211D7EC  the attacker's +0x94 is non-zero and the target's is zero
//
// None of +0x54, +0x94 or the value 5 is traced further, so none is named.
//
// THE TWO RESOLVER PATHS
// ----------------------
//   argument 1 == 0   parameters are the three words at [action +0x00] + 0x28
//                     (0x020648F0 is `add r0,r0,#4; bx lr`, then +0x24)
//                     resolver(target, action, thoseThreeWords)   @ 0x0211D9E0
//   argument 1 != 0   resolver(target, action, argument1 + 0x24)  @ 0x0211D9FC
//
// Either way the resolver is battleDamageResolver's 0x021149A8, with the roster
// slot as the defender and the action object second.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What `kind` selects, beyond 13 taking a different path at 0x0211DA04. What
// +0x54, +0x94 and status 5 mean. The three parameter words themselves — this
// module locates them and hands them on, it does not interpret them. And the
// rest of the 2,088-byte body: the action object carries its own script VM at
// +0x2A0, which this routine starts and steps at 0x0211DD68 and 0x0211DF04, and
// that nested script is not traced.

import { deepFreeze } from "../contracts/championshipContracts.js";

/** 0211B9A4. Inclusive native box contact, with z subtracted from screen y. */
export function battleNativeBoxContact(a,p,b,q) {
  const at=(v,edge)=>(v+(edge<<12))|0;
  return !(at(p[0],a.lowX)>at(q[0],b.highX)
    || ((at(p[1],a.lowY)-p[2])|0)>((at(q[1],b.highY)-q[2])|0)
    || at(p[0],a.highX)<at(q[0],b.lowX)
    || ((at(p[1],a.highY)-p[2])|0)<((at(q[1],b.lowY)-q[2])|0));
}

/** 0211D7FC..D914: the unarmed parameter path expands the attacker's box. */
export function battleNativeMeleeContact(a,p,facing,b,q) {
  const quarter=v=>(v+((v>>1)>>>30))>>2;
  const short=v=>(v<<16)>>16;
  const point=[...p],box={...a};
  point[0]=(point[0]+(facing===1?1:-1)*(quarter(a.highX-a.lowX)<<12))|0;
  box.lowY=short(a.lowY-quarter(a.highY-a.lowY));
  box.highY=short(a.highY-quarter(a.highY-box.lowY)*-1);
  return battleNativeBoxContact(box,point,b,q);
}

export const BATTLE_ACTION_APPLY_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_ACTION_APPLY_NATIVE = 0x0211d71c;
export const BATTLE_ACTION_APPLY_BODY = 0x0211d740;

/** cmp r0,#6 at 0x0211DF38 — the same roster the frame loop walks. */
export const BATTLE_ACTION_APPLY_SLOT_COUNT = 6;
export const BATTLE_ACTION_APPLY_ROSTER_BASE_OFFSET = 0x5e20;

/** The three script arguments, by index. */
export const BATTLE_ACTION_APPLY_ARG_ACTION = 0;
export const BATTLE_ACTION_APPLY_ARG_PARAMETERS = 1;
export const BATTLE_ACTION_APPLY_ARG_KIND = 2;

/** Argument 2 arrives in Q12 and is truncated with `asr #0xc`. */
export const BATTLE_ACTION_APPLY_KIND_SHIFT = 12;

/** cmp sl,#0xd at 0x0211DA04: 13 alone skips the write to action +0x20. */
export const BATTLE_ACTION_APPLY_KIND_SPECIAL = 13;

/** cmp r0,#5 at 0x0211D7A8: this status bypasses the same-side rejection. */
export const BATTLE_ACTION_APPLY_SIDE_BYPASS_STATUS = 5;

/** Offsets the walk reads. Named for the offset; none of them is traced. */
export const BATTLE_ACTION_APPLY_ATTACKER_OFFSET = 0xe4;
export const BATTLE_ACTION_APPLY_SIDE_OFFSET = 0x54;
export const BATTLE_ACTION_APPLY_GUARD_OFFSET = 0x94;
export const BATTLE_ACTION_APPLY_STATUS_OFFSET = 0x158;

/** The resolver, and where the three parameter words come from on each path. */
export const BATTLE_ACTION_APPLY_RESOLVER = 0x021149a8;
export const BATTLE_ACTION_APPLY_PARAMETER_WORDS = 3;
export const BATTLE_ACTION_APPLY_PARAMETER_OFFSET = 0x24;
export const BATTLE_ACTION_APPLY_OWN_PARAMETER_OFFSET = 0x28;

export const BATTLE_ACTION_APPLY_REJECT_EMPTY = "EMPTY_SLOT";
export const BATTLE_ACTION_APPLY_REJECT_SELF = "SELF";
export const BATTLE_ACTION_APPLY_REJECT_SAME_SIDE = "SAME_SIDE";
export const BATTLE_ACTION_APPLY_REJECT_GUARD = "GUARD_MISMATCH";

/** The rejections in the order the routine applies them. */
export const BATTLE_ACTION_APPLY_REJECTIONS = deepFreeze([
  { reason: BATTLE_ACTION_APPLY_REJECT_EMPTY, site: "OVL19:0x0211D794" },
  { reason: BATTLE_ACTION_APPLY_REJECT_SELF, site: "OVL19:0x0211D79C" },
  { reason: BATTLE_ACTION_APPLY_REJECT_SAME_SIDE, site: "OVL19:0x0211D7B8" },
  { reason: BATTLE_ACTION_APPLY_REJECT_GUARD, site: "OVL19:0x0211D7EC" }
]);

function applyError(message) {
  return new Error(`BATTLE_ACTION_APPLY_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw applyError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** 0x0211D734 `asr r1, r1, #0xc`, arithmetic so a negative Q12 floors. */
export function actionKindFromQ12(value) {
  requireInteger(value, "KIND_Q12");
  return value >> BATTLE_ACTION_APPLY_KIND_SHIFT;
}

/**
 * Which of the four rejections a slot trips, or null if it is a valid target.
 * `attacker` and `target` carry the four offsets the walk reads.
 */
export function rejectActionTarget(attacker, target) {
  if (target === null || target === undefined) {
    return BATTLE_ACTION_APPLY_REJECT_EMPTY;
  }
  if (!attacker || typeof attacker !== "object" || typeof target !== "object") {
    throw applyError("WALK_REQUIRES_COMBATANT_OBJECTS");
  }
  if (attacker === target) {
    return BATTLE_ACTION_APPLY_REJECT_SELF;
  }
  const status = requireInteger(attacker.field158 ?? 0, "FIELD158");
  if (status !== BATTLE_ACTION_APPLY_SIDE_BYPASS_STATUS) {
    if (requireInteger(attacker.field54 ?? 0, "FIELD54") === requireInteger(target.field54 ?? 0, "FIELD54")) {
      return BATTLE_ACTION_APPLY_REJECT_SAME_SIDE;
    }
  }
  const attackerGuard = requireInteger(attacker.field94 ?? 0, "FIELD94");
  if (attackerGuard !== 0 && requireInteger(target.field94 ?? 0, "FIELD94") === 0) {
    return BATTLE_ACTION_APPLY_REJECT_GUARD;
  }
  return null;
}

/**
 * The whole walk. `roster` is six entries, each a combatant or null; `attacker`
 * is what the routine reads from action +0xE4. Returns the slots that would be
 * resolved against, in ascending order, and the count the routine returns.
 */
export function selectActionTargets(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.roster)) {
    throw applyError("WALK_REQUIRES_A_ROSTER_ARRAY");
  }
  if (input.roster.length !== BATTLE_ACTION_APPLY_SLOT_COUNT) {
    throw applyError(`ROSTER_MUST_BE_${BATTLE_ACTION_APPLY_SLOT_COUNT}_LONG`);
  }
  const attacker = input.attacker;
  if (!attacker || typeof attacker !== "object") {
    throw applyError("WALK_REQUIRES_AN_ATTACKER");
  }

  const targets = [];
  const rejected = [];
  for (let slot = 0; slot < BATTLE_ACTION_APPLY_SLOT_COUNT; slot += 1) {
    const reason = rejectActionTarget(attacker, input.roster[slot]);
    if (reason === null) {
      targets.push(slot);
    } else {
      rejected.push({ slot, reason });
    }
  }
  // 0x0211DF40 returns the counter that only a surviving target increments.
  return deepFreeze({ targets: deepFreeze(targets), rejected: deepFreeze(rejected), hitCount: targets.length });
}

/**
 * Which parameter block the routine hands the resolver. Argument 1 of zero
 * means "take the action's own", at [action +0x00] + 0x28; anything else is a
 * caller-supplied block read at +0x24.
 */
export function resolveActionParameterSource(parameterArgument) {
  requireInteger(parameterArgument, "PARAMETER_ARGUMENT");
  if (parameterArgument === 0) {
    return deepFreeze({
      source: "ACTION_OWN",
      site: "OVL19:0x0211D9E0",
      offset: BATTLE_ACTION_APPLY_OWN_PARAMETER_OFFSET,
      words: BATTLE_ACTION_APPLY_PARAMETER_WORDS
    });
  }
  return deepFreeze({
    source: "SCRIPT_ARGUMENT",
    site: "OVL19:0x0211D9FC",
    offset: BATTLE_ACTION_APPLY_PARAMETER_OFFSET,
    words: BATTLE_ACTION_APPLY_PARAMETER_WORDS
  });
}

/** cmp sl,#0xd / strne at 0x0211DA04: every kind but 13 writes action +0x20. */
export function actionKindWritesField20(kind) {
  requireInteger(kind, "KIND");
  return kind !== BATTLE_ACTION_APPLY_KIND_SPECIAL;
}
