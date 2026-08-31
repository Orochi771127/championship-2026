// Battle resolver -- OVL19 0x021149A8 after the curve × power /100 term.
//
// Independently re-dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
//
// Original order:
//   damageCore
//   → trunc(damage * globalPercent / 100)     default global = 100 @ init 0x0210D224
//   → field matrix two signed-byte reads @ 0x0213007C
//        first cell  > 0  → trunc(damage * 120 / 100)
//        second cell < 0  → trunc(damage * 120 / 100)
//   → if damage > 0:
//        RNG channel 216; if roll < threshold[tier] then trunc(damage * 3 / 2)
//        thresholds {2,3,5,7} @ 0x0212FE64; 1.5× uses magic 0x66666667
//        then roll2 % 100; damage += trunc(damage * roll / 1000)  magic 0x10624DD3
//   → currentHP -= damage if currentHP > 0   @ 0x02114F3C
//
// Cooldown (not inside the damage fn, same overlay):
//   +0x28: if > 0 then -= 1, loop of 6 combatants @ 0x0210D8F4
//   rebuild: 90 - 2 * speedIndex   (ARM: 48*index * 0x2AAAAAAB >> 34, then rsb #90)
//   if +0x160 == 3: trunc(cooldown * 80 / 100)
//
// NOT in this file: hit/miss, TP, when global=15 is written, RNG helper
// 0x020431D4's channel-216 distribution, AI, 596-action table, rewards.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { resolveBattleDamageCore } from "./battleDamageCore.js";
import { raiseAttackerCurveIndex, raiseDefenderCurveIndex } from "./battleSupport.js";

export const BATTLE_RESOLVER_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_GLOBAL_PERCENT_DEFAULT = 100;
export const BATTLE_FIELD_SCALE_PERCENT = 120;
export const BATTLE_FIELD_MATRIX_SIZE = 11;
export const BATTLE_CRIT_RNG_CHANNEL = 216;
export const BATTLE_CRIT_THRESHOLDS = deepFreeze([2, 3, 5, 7]);
export const BATTLE_COMBATANT_SLOT_COUNT = 6;

// OVL19 0x0213007C, 11×11 signed bytes. Row-major. Independently dumped 2026-08-31.
export const BATTLE_FIELD_MATRIX = deepFreeze([
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0],
  [0, 0, -1, 1, 0, -1, 0, 0, 0, 0, 0],
  [0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, -1, -1, 1, 0, 0, 0, 0, 0],
  [0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
]);

function resolverError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleDamageError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw resolverError(`${label} must be a safe integer`);
  }
  return value;
}

/** Same toward-zero divide the ARM does with 0x51EB851F then asr #5. */
function truncMulDiv(value, numerator, denominator) {
  return Math.trunc((value * numerator) / denominator);
}

export function fieldMatrixCell(row, column) {
  requireSafeInteger(row, "field row");
  requireSafeInteger(column, "field column");
  if (row < 0 || row >= BATTLE_FIELD_MATRIX_SIZE || column < 0 || column >= BATTLE_FIELD_MATRIX_SIZE) {
    throw resolverError("field matrix index must be 0..10");
  }
  return BATTLE_FIELD_MATRIX[row][column];
}

function applyFieldCells(damage, firstFieldCell, secondFieldCell) {
  if (firstFieldCell > 0) {
    damage = truncMulDiv(damage, BATTLE_FIELD_SCALE_PERCENT, 100);
  }
  if (secondFieldCell < 0) {
    damage = truncMulDiv(damage, BATTLE_FIELD_SCALE_PERCENT, 100);
  }
  return damage;
}

function requireRng(rng) {
  if (!rng || typeof rng.next !== "function") {
    throw resolverError("critical/variance require rng.next(channel)");
  }
  return rng;
}

function readChannel216(rng) {
  const rolled = requireRng(rng).next(BATTLE_CRIT_RNG_CHANNEL);
  if (!Number.isSafeInteger(rolled)) {
    throw resolverError("RNG channel 216 must return a safe integer");
  }
  return rolled;
}

function remainderTowardZero(value, modulus) {
  return value - modulus * Math.trunc(value / modulus);
}

function clampCritTier(tier) {
  requireSafeInteger(tier, "critTier");
  if (tier < 0) throw resolverError("critTier must be >= 0");
  // Original: cmp #4; movge #3.
  return tier >= 4 ? 3 : tier;
}

/**
 * Full post-core resolver. Pass base curve indices plus optional
 * positiveEffectCode / negativeRuntimeCode / actionElementSelector to apply
 * the original +1 before lookup. Hit/miss stays out.
 *
 * applyCritical / applyVariance default on. Tests may turn them off to pin an
 * earlier stage; that is a test seam, not an original skip flag.
 */
export function resolveBattleDamage(input) {
  if (!input || typeof input !== "object") {
    throw resolverError("resolveBattleDamage requires a plain object");
  }
  const buffsProvided = input.positiveEffectCode !== undefined
    || input.negativeRuntimeCode !== undefined
    || input.actionElementSelector !== undefined;
  const attackerIndex = buffsProvided
    ? raiseAttackerCurveIndex({
      baseIndex: input.attackerIndex,
      positiveEffectCode: input.positiveEffectCode === undefined ? 0 : input.positiveEffectCode,
      negativeRuntimeCode: input.negativeRuntimeCode === undefined ? 0 : input.negativeRuntimeCode
    })
    : input.attackerIndex;
  const defenderIndex = buffsProvided
    ? raiseDefenderCurveIndex({
      baseIndex: input.defenderIndex,
      actionElementSelector: input.actionElementSelector === undefined ? 0 : input.actionElementSelector,
      positiveEffectCode: input.positiveEffectCode === undefined ? 0 : input.positiveEffectCode
    })
    : input.defenderIndex;
  const core = resolveBattleDamageCore({ ...input, attackerIndex, defenderIndex });
  const globalPercent = input.globalPercent === undefined
    ? BATTLE_GLOBAL_PERCENT_DEFAULT
    : requireSafeInteger(input.globalPercent, "globalPercent");
  if (globalPercent < 0) throw resolverError("globalPercent must be >= 0");

  const firstFieldCell = input.firstFieldCell === undefined
    ? 0
    : requireSafeInteger(input.firstFieldCell, "firstFieldCell");
  const secondFieldCell = input.secondFieldCell === undefined
    ? 0
    : requireSafeInteger(input.secondFieldCell, "secondFieldCell");

  const applyCritical = input.applyCritical !== false;
  const applyVariance = input.applyVariance !== false;

  let damage = truncMulDiv(core.damageCore, globalPercent, 100);
  damage = applyFieldCells(damage, firstFieldCell, secondFieldCell);

  let critical = false;
  let varianceBonus = 0;

  if (damage > 0 && (applyCritical || applyVariance)) {
    const rng = requireRng(input.rng);
    if (applyCritical) {
      const tier = clampCritTier(input.critTier === undefined ? 0 : input.critTier);
      const threshold = BATTLE_CRIT_THRESHOLDS[tier];
      const roll = readChannel216(rng);
      if (roll < threshold) {
        damage = truncMulDiv(damage, 3, 2);
        critical = true;
      }
    }
    if (applyVariance) {
      const roll = remainderTowardZero(readChannel216(rng), 100);
      varianceBonus = truncMulDiv(damage, roll, 1000);
      damage += varianceBonus;
    }
  }

  return deepFreeze({
    ...core,
    globalPercent,
    firstFieldCell,
    secondFieldCell,
    critical,
    varianceBonus,
    damage,
    evidence: BATTLE_RESOLVER_EVIDENCE
  });
}

/** Original: if currentHP > 0 then currentHP -= resolvedDamage. No floor at 0. */
export function applyBattleHp(currentHp, resolvedDamage) {
  requireSafeInteger(currentHp, "currentHp");
  requireSafeInteger(resolvedDamage, "resolvedDamage");
  if (currentHp <= 0) return currentHp;
  return currentHp - resolvedDamage;
}

export function baseActionCooldown(speedIndex) {
  requireSafeInteger(speedIndex, "speedIndex");
  if (speedIndex < 0) throw resolverError("speedIndex must be >= 0");
  return 90 - 2 * speedIndex;
}

export function speedBuffCooldown(baseCooldown) {
  requireSafeInteger(baseCooldown, "baseCooldown");
  return truncMulDiv(baseCooldown, 80, 100);
}

/** Original +0x28: subgt #1. Zero stays zero. */
export function tickActionCooldown(cooldown) {
  requireSafeInteger(cooldown, "cooldown");
  if (cooldown > 0) return cooldown - 1;
  return cooldown;
}

/** 0x021161D4: popgt when +0x28 > 0, else fall into 0x021157BC. */
export function cooldownReady(cooldown) {
  requireSafeInteger(cooldown, "cooldown");
  return cooldown <= 0;
}

/** Normal selection rebuild at 0x0211594C. Speed 80% only on this path. */
export function rebuildDecisionCooldown(speedIndex, positiveEffectCode) {
  const base = baseActionCooldown(speedIndex);
  const effect = positiveEffectCode === undefined ? 0 : requireSafeInteger(positiveEffectCode, "positiveEffectCode");
  if (effect === 3) return speedBuffCooldown(base);
  return base;
}

/**
 * State-entry seed at 0x021169E8. Not the universal battle-start formula.
 * +0x16C != 0: this handler does not write +0x28.
 * +0x17C == 1: original spends one channel-216 on +0x44, then
 *   cooldown = 30 + (second channel-216 rem 31).
 * else: cooldown = 42.
 */
export function seedStateEntryCooldown(input) {
  if (!input || typeof input !== "object") {
    throw resolverError("seedStateEntryCooldown requires { field16C, field17C }");
  }
  const field16C = requireSafeInteger(input.field16C, "field16C");
  const field17C = requireSafeInteger(input.field17C, "field17C");
  if (field16C !== 0) {
    return deepFreeze({ seeded: false });
  }
  if (field17C !== 1) {
    return deepFreeze({ seeded: true, cooldown: 42 });
  }
  const rng = requireRng(input.rng);
  rng.next(BATTLE_CRIT_RNG_CHANNEL);
  const roll = rng.next(BATTLE_CRIT_RNG_CHANNEL);
  if (!Number.isSafeInteger(roll)) {
    throw resolverError("RNG channel 216 must return a safe integer");
  }
  return deepFreeze({
    seeded: true,
    cooldown: 30 + remainderTowardZero(roll, 31)
  });
}
