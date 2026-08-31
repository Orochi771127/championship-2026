// Battle resolver — OVL19 post-core modifiers, not a battle screen.
//
// Order from the original: core → global% → field cells → (if damage > 0)
// critical ×1.5 → variance +0..9.9% → HP subtract. Hit/miss and TP stay out.

import assert from "node:assert/strict";
import test from "node:test";

import { resolveBattleDamageCore } from "../src/championship/battle/battleDamageCore.js";
import {
  BATTLE_CRIT_RNG_CHANNEL,
  BATTLE_CRIT_THRESHOLDS,
  BATTLE_FIELD_MATRIX,
  BATTLE_FIELD_MATRIX_SIZE,
  BATTLE_FIELD_SCALE_PERCENT,
  BATTLE_GLOBAL_PERCENT_DEFAULT,
  BATTLE_RESOLVER_EVIDENCE,
  applyBattleHp,
  baseActionCooldown,
  cooldownReady,
  fieldMatrixCell,
  rebuildDecisionCooldown,
  resolveBattleDamage,
  seedStateEntryCooldown,
  speedBuffCooldown,
  tickActionCooldown
} from "../src/championship/battle/battleDamageResolver.js";

function scriptedRng(values) {
  const queue = [...values];
  return {
    next(channel) {
      assert.equal(channel, BATTLE_CRIT_RNG_CHANNEL);
      if (queue.length === 0) throw new Error("RNG_EXHAUSTED");
      return queue.shift();
    }
  };
}

test("the field matrix is the 11x11 signed table at 0x0213007C", () => {
  assert.equal(BATTLE_FIELD_MATRIX_SIZE, 11);
  assert.equal(BATTLE_FIELD_MATRIX.length, 11);
  assert.deepEqual(BATTLE_FIELD_MATRIX[0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(fieldMatrixCell(1, 1), 1);
  assert.equal(fieldMatrixCell(1, 2), -1);
  assert.equal(BATTLE_FIELD_SCALE_PERCENT, 120);
  assert.equal(BATTLE_GLOBAL_PERCENT_DEFAULT, 100);
  assert.deepEqual([...BATTLE_CRIT_THRESHOLDS], [2, 3, 5, 7]);
  assert.equal(BATTLE_CRIT_RNG_CHANNEL, 216);
  assert.equal(BATTLE_RESOLVER_EVIDENCE, "VERIFIED_BINARY");
});

test("global percent 100 leaves the core unchanged; 15 truncates toward zero", () => {
  const core = resolveBattleDamageCore({ attackerIndex: 5, defenderIndex: 5, power: 100 });
  assert.equal(core.damageCore, 45);
  const full = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(full.damage, 45);
  assert.equal(full.globalPercent, 100);
  const reduced = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    globalPercent: 15,
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(reduced.damage, 6);
});

test("a positive field cell scales by 120% and a negative cell on the second lookup also scales 120%", () => {
  const boosted = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    firstFieldCell: 1,
    secondFieldCell: 0,
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(boosted.damage, 54);
  const stacked = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    firstFieldCell: 1,
    secondFieldCell: -1,
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(stacked.damage, 64);
  const zeroField = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    firstFieldCell: fieldMatrixCell(0, 0),
    secondFieldCell: fieldMatrixCell(0, 0),
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(zeroField.damage, 45);
});

test("critical applies 1.5x only when the channel-216 roll is below the tier threshold", () => {
  const hit = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    critTier: 0,
    rng: scriptedRng([1]),
    applyVariance: false
  });
  assert.equal(hit.critical, true);
  assert.equal(hit.damage, 67);
  const miss = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    critTier: 0,
    rng: scriptedRng([2]),
    applyVariance: false
  });
  assert.equal(miss.critical, false);
  assert.equal(miss.damage, 45);
});

test("variance adds trunc(damage * (roll % 100) / 1000) after the critical branch", () => {
  const resolved = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    critTier: 0,
    rng: scriptedRng([2, 50])
  });
  assert.equal(resolved.critical, false);
  assert.equal(resolved.varianceBonus, 2);
  assert.equal(resolved.damage, 47);
});

test("non-positive damage skips critical and variance", () => {
  const resolved = resolveBattleDamage({
    attackerIndex: 0,
    defenderIndex: 26,
    power: 100,
    rng: scriptedRng([0, 0])
  });
  assert.equal(resolved.damage, -325);
  assert.equal(resolved.critical, false);
  assert.equal(resolved.varianceBonus, 0);
});

test("HP write subtracts resolved damage and leaves a non-positive current HP alone", () => {
  assert.equal(applyBattleHp(200, 47), 153);
  assert.equal(applyBattleHp(0, 47), 0);
  assert.equal(applyBattleHp(-3, 10), -3);
});

test("action cooldown is 90 - 2*speedIndex; Speed buff is trunc(base * 80 / 100)", () => {
  assert.equal(baseActionCooldown(0), 90);
  assert.equal(baseActionCooldown(10), 70);
  assert.equal(baseActionCooldown(26), 38);
  assert.equal(speedBuffCooldown(90), 72);
  assert.equal(speedBuffCooldown(71), 56);
});

test("a cooldown above 0 decrements by 1, matching OVL19 +0x28", () => {
  assert.equal(tickActionCooldown(74), 73);
  assert.equal(tickActionCooldown(1), 0);
  assert.equal(tickActionCooldown(0), 0);
  assert.equal(cooldownReady(1), false);
  assert.equal(cooldownReady(0), true);
  assert.equal(rebuildDecisionCooldown(10, 0), 70);
  assert.equal(rebuildDecisionCooldown(10, 3), 56);
});

test("state-entry cooldown seed is 30 + (RNG216 rem 31), or fixed 42", () => {
  const skipped = seedStateEntryCooldown({ field16C: 1, field17C: 1, rng: scriptedRng([0]) });
  assert.equal(skipped.seeded, false);
  const fixed = seedStateEntryCooldown({ field16C: 0, field17C: 0, rng: scriptedRng([]) });
  assert.deepEqual(fixed, { seeded: true, cooldown: 42 });
  const rolled = seedStateEntryCooldown({
    field16C: 0,
    field17C: 1,
    rng: scriptedRng([99, 5])
  });
  assert.deepEqual(rolled, { seeded: true, cooldown: 35 });
});

test("optional buff fields raise curve indices inside the resolver the way OVL19 does", () => {
  const plain = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    applyCritical: false,
    applyVariance: false
  });
  const buffed = resolveBattleDamage({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100,
    positiveEffectCode: 1,
    negativeRuntimeCode: 0,
    actionElementSelector: 0,
    applyCritical: false,
    applyVariance: false
  });
  assert.equal(plain.attackerIndex, 5);
  assert.equal(buffed.attackerIndex, 6);
  assert.equal(buffed.defenderIndex, 5);
  assert.equal(buffed.damage > plain.damage, true);
});
