// Battle damage core -- OVL19 resolver at 0x021149A8, rewritten in JS.
//
// WHAT THIS FILE IS ALLOWED TO CLAIM (2026-08-31 ROM dump, SHA-256 8ad375ba…c5d1)
// -----------------------------------------------------------------------------
// Original loads a 0..26 *index*, looks up a 27-entry curve, then:
//
//   A        = curve[min(attackerIndex, 26)]
//   D        = curve[min(defenderIndex, 26)]
//   coreTerm = trunc_toward_zero((5 * A) / 2) - D
//   power    = u16 at the action record +0x4A
//   damage   = trunc_toward_zero((coreTerm * power) / 100)
//
// The 27 values live in ARM9 records of stride 16 starting at 0x020CA00C.
// OVL19's literal pool at 0x02115674 holds three bases (0x020CA00C / 014 / 00E);
// the first five halfwords of each record are the same sequence, so one JS
// array is enough for this core. `/100` is the signed-div magic 0x51EB851F
// stored next to that pool at 0x02115684.
//
// Indices are *curve steps*, not named RPG stats. Do not call them Attack or
// Defense in code. The original only clamps the high side (`cmp #26; movgt #26`).
// A negative index would walk before the table; this module rejects that
// rather than inventing a 0-clamp.
//
// WHAT IT MUST NOT DO
// -------------------
// Hit/miss, TP, the 1.5× branch, field-matrix ±120%, global percent, or
// RNG variance. Those run later in the same resolver. This function stops
// after the curve × power /100 term. It writes no HP and opens no screen.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_DAMAGE_CORE_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_DAMAGE_CORE_RESOLVER = "OVL19:0x021149A8";
export const ACTION_POWER_FIELD_OFFSET = 0x4a;
export const BATTLE_STAT_CURVE_MAX_INDEX = 26;

// ARM9 0x020CA00C, 27 records, stride 16. Independently dumped 2026-08-31.
export const BATTLE_STAT_CURVE = deepFreeze([
  10, 14, 18, 22, 26, 30, 38, 46, 54, 66, 78, 90, 102, 117, 132,
  147, 162, 180, 198, 216, 234, 252, 270, 290, 310, 330, 350
]);

function battleDamageError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleDamageError";
  return error;
}

/**
 * Original only raises an index that is greater than 26. Below 0 is invalid
 * product input — the ARM would read before the table.
 */
function clampCurveIndex(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw battleDamageError(`${label} must be a safe integer`);
  }
  if (value < 0) {
    throw battleDamageError(`${label} must be >= 0`);
  }
  return value > BATTLE_STAT_CURVE_MAX_INDEX ? BATTLE_STAT_CURVE_MAX_INDEX : value;
}

function requireActionPower(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) {
    throw battleDamageError("power must be a u16 (0..65535), matching ldrh at action+0x4A");
  }
  return value;
}

/**
 * Curve × power /100 term only. Callers that already applied a +1 buff to an
 * index should pass the adjusted index; this function does not look up buffs.
 *
 * @param {{ attackerIndex: number, defenderIndex: number, power: number }} input
 */
export function resolveBattleDamageCore(input) {
  if (!input || typeof input !== "object") {
    throw battleDamageError("resolveBattleDamageCore requires { attackerIndex, defenderIndex, power }");
  }
  const attackerIndex = clampCurveIndex(input.attackerIndex, "attackerIndex");
  const defenderIndex = clampCurveIndex(input.defenderIndex, "defenderIndex");
  const power = requireActionPower(input.power);

  const attackCurve = BATTLE_STAT_CURVE[attackerIndex];
  const defenseCurve = BATTLE_STAT_CURVE[defenderIndex];
  // Same as add r5, r1, r1, lsl #2 then toward-zero /2, then rsb with D.
  const coreTerm = Math.trunc((5 * attackCurve) / 2) - defenseCurve;
  // Same as mul by power then signed /100 (magic 0x51EB851F).
  const damageCore = Math.trunc((coreTerm * power) / 100);

  return deepFreeze({
    attackerIndex,
    defenderIndex,
    attackCurve,
    defenseCurve,
    coreTerm,
    power,
    damageCore,
    evidence: BATTLE_DAMAGE_CORE_EVIDENCE
  });
}
