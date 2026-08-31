// Support resolver -- OVL19 0x0211558C (heal / clear / positive slot) and the
// curve-index +1 that runs at 0x02114A50 before the damage lookup.
//
// Independently re-dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
//
// Heal field_5C 14..19 adds a fixed amount to current HP (+0x50), then
// `cmp current, max; strgt max`. Amounts:
//   14 +300, 15 +900, 16 +52+2048=2100, 17 +200, 18 +600, 19 +376+1024=1400
// field_5C 20 calls clear at 0x0211452C (negative slot +0x158/+0x15C → 0).
// field_5C 21..29 call 0x021147E8 with codes 1..9; that stores code at +0x160
// and 900 at +0x164.
//
// Target scope is a separate action field_54 (1 single / 2 all). This module
// does not pick targets or loop a 3v3 party.
//
// Attacker +1: if +0x160==1 or +0x158==1, then index+1, then cmp #26; movgt #26.
// Defender +1: action +0x58 selector 0..5 (and >5 same as 0) chooses which
// defender index to raise, and which positive code (2/5/6/8/9/7) triggers +1.
//
// NOT in this file: hit/miss, Sense downstream, Speed 80% (that is already
// in battleDamageResolver.js), Japanese names, a battle screen.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { BATTLE_STAT_CURVE_MAX_INDEX } from "./battleDamageCore.js";

export const BATTLE_SUPPORT_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_SUPPORT_TARGET_SCOPE_SINGLE = 1;
export const BATTLE_SUPPORT_TARGET_SCOPE_ALL = 2;
export const BATTLE_POSITIVE_EFFECT_DURATION = 900;
export const BATTLE_HEAL_AMOUNT_BY_FIELD_5C = deepFreeze({
  14: 300,
  15: 900,
  16: 2100,
  17: 200,
  18: 600,
  19: 1400
});

// action +0x58 → positive-effect code that raises the matching defender index.
// Selector 0 and any value >5 take the default branch (code 2, combatant +0x88).
const DEFENDER_RAISE_CODE_BY_SELECTOR = deepFreeze([2, 5, 6, 8, 9, 7]);

function supportError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleSupportError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw supportError(`${label} must be a safe integer`);
  }
  return value;
}

function clampRaisedCurveIndex(value, label) {
  const index = requireSafeInteger(value, label);
  if (index < 0) {
    throw supportError(`${label} must be >= 0`);
  }
  return index > BATTLE_STAT_CURVE_MAX_INDEX ? BATTLE_STAT_CURVE_MAX_INDEX : index;
}

export function healAmountForField5C(field5C) {
  requireSafeInteger(field5C, "field5C");
  const amount = BATTLE_HEAL_AMOUNT_BY_FIELD_5C[field5C];
  if (amount === undefined) {
    throw supportError("heal field_5C must be 14..19");
  }
  return amount;
}

/**
 * Original writes current+amount, then if current > max stores max.
 * Does not floor at 0. Pass `amount` or `field5C`.
 */
export function applyBattleHeal(input) {
  if (!input || typeof input !== "object") {
    throw supportError("applyBattleHeal requires { currentHp, maxHp, amount|field5C }");
  }
  const currentHp = requireSafeInteger(input.currentHp, "currentHp");
  const maxHp = requireSafeInteger(input.maxHp, "maxHp");
  const amount = input.amount === undefined
    ? healAmountForField5C(input.field5C)
    : requireSafeInteger(input.amount, "amount");
  const next = currentHp + amount;
  return next > maxHp ? maxHp : next;
}

/** 0x0211452C: str #0 at +0x158 and +0x15C. Presentation writes at +0x6CC stay out. */
export function clearNegativeStatusSlot() {
  return deepFreeze({ runtimeCode: 0, remainingDuration: 0 });
}

export function positiveEffectCodeForField5C(field5C) {
  requireSafeInteger(field5C, "field5C");
  if (field5C < 21 || field5C > 29) {
    throw supportError("positive-effect field_5C must be 21..29");
  }
  return field5C - 20;
}

/** 0x021147E8 tail: str code at +0x160, mov #900, str at +0x164. */
export function applyPositiveEffect(effectCode) {
  requireSafeInteger(effectCode, "effectCode");
  if (effectCode < 1 || effectCode > 9) {
    throw supportError("positive effect code must be 1..9");
  }
  return deepFreeze({
    effectCode,
    remainingDuration: BATTLE_POSITIVE_EFFECT_DURATION
  });
}

/** 0x0211479C: str #0 at +0x160 and +0x164. */
export function clearPositiveEffect() {
  return deepFreeze({ effectCode: 0, remainingDuration: 0 });
}

/**
 * Positive-slot tick at 0x0210D8B8: if code==0 skip; else subgt duration #1,
 * and if the result is not >0, clear the slot in the same tick.
 */
export function tickPositiveEffect(slot) {
  if (!slot || typeof slot !== "object") {
    throw supportError("tickPositiveEffect requires { effectCode, remainingDuration }");
  }
  const effectCode = requireSafeInteger(slot.effectCode, "effectCode");
  const remainingDuration = requireSafeInteger(slot.remainingDuration, "remainingDuration");
  if (effectCode === 0) {
    return deepFreeze({ effectCode: 0, remainingDuration });
  }
  if (remainingDuration > 0) {
    const remaining = remainingDuration - 1;
    if (remaining > 0) {
      return deepFreeze({ effectCode, remainingDuration: remaining });
    }
  }
  return clearPositiveEffect();
}

/**
 * 0x02114A58: +1 once if positive code is 1 or negative runtime is 1, then
 * high-clamp at 26. Both flags together still add only one.
 */
export function raiseAttackerCurveIndex(input) {
  if (!input || typeof input !== "object") {
    throw supportError("raiseAttackerCurveIndex requires { baseIndex, positiveEffectCode, negativeRuntimeCode }");
  }
  let index = requireSafeInteger(input.baseIndex, "baseIndex");
  const positiveEffectCode = requireSafeInteger(input.positiveEffectCode, "positiveEffectCode");
  const negativeRuntimeCode = requireSafeInteger(input.negativeRuntimeCode, "negativeRuntimeCode");
  if (positiveEffectCode === 1 || negativeRuntimeCode === 1) {
    index += 1;
  }
  // Damage lookup high-clamps; the leftover r4/sl used by status proc does not.
  if (input.clampHigh === false) {
    if (index < 0) throw supportError("attackerIndex must be >= 0");
    return index;
  }
  return clampRaisedCurveIndex(index, "attackerIndex");
}

/**
 * 0x02114A8C jump on action +0x58. Selector 0 or >5 uses code 2.
 * Codes 5/6/8/9/7 are the matching elemental resist slots — not named stats.
 */
export function raiseDefenderCurveIndex(input) {
  if (!input || typeof input !== "object") {
    throw supportError("raiseDefenderCurveIndex requires { baseIndex, actionElementSelector, positiveEffectCode }");
  }
  let index = requireSafeInteger(input.baseIndex, "baseIndex");
  const selector = requireSafeInteger(input.actionElementSelector, "actionElementSelector");
  const positiveEffectCode = requireSafeInteger(input.positiveEffectCode, "positiveEffectCode");
  if (selector < 0) {
    throw supportError("actionElementSelector must be >= 0");
  }
  const raiseCode = selector <= 5
    ? DEFENDER_RAISE_CODE_BY_SELECTOR[selector]
    : DEFENDER_RAISE_CODE_BY_SELECTOR[0];
  if (positiveEffectCode === raiseCode) {
    index += 1;
  }
  if (input.clampHigh === false) {
    if (index < 0) throw supportError("defenderIndex must be >= 0");
    return index;
  }
  return clampRaisedCurveIndex(index, "defenderIndex");
}
