// Support resolver — OVL19 0x0211558C heal / clear / positive slot / curve +1.
// Arithmetic only. No battle screen, no targeting loop, no Sense→accuracy.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { BATTLE_STAT_CURVE_MAX_INDEX } from "../src/championship/battle/battleDamageCore.js";
import {
  BATTLE_HEAL_AMOUNT_BY_FIELD_5C,
  BATTLE_POSITIVE_EFFECT_DURATION,
  BATTLE_SUPPORT_EVIDENCE,
  BATTLE_SUPPORT_TARGET_SCOPE_ALL,
  BATTLE_SUPPORT_TARGET_SCOPE_SINGLE,
  applyBattleHeal,
  applyPositiveEffect,
  clearNegativeStatusSlot,
  clearPositiveEffect,
  healAmountForField5C,
  positiveEffectCodeForField5C,
  raiseAttackerCurveIndex,
  raiseDefenderCurveIndex,
  tickPositiveEffect
} from "../src/championship/battle/battleSupport.js";

test("heal amounts are the six immediates at 0x0211558C–0x021155D8", () => {
  assert.equal(BATTLE_SUPPORT_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(healAmountForField5C(14), 300);
  assert.equal(healAmountForField5C(15), 900);
  assert.equal(healAmountForField5C(16), 2100);
  assert.equal(healAmountForField5C(17), 200);
  assert.equal(healAmountForField5C(18), 600);
  assert.equal(healAmountForField5C(19), 1400);
  assert.deepEqual(
    { ...BATTLE_HEAL_AMOUNT_BY_FIELD_5C },
    { 14: 300, 15: 900, 16: 2100, 17: 200, 18: 600, 19: 1400 }
  );
  assert.equal(BATTLE_SUPPORT_TARGET_SCOPE_SINGLE, 1);
  assert.equal(BATTLE_SUPPORT_TARGET_SCOPE_ALL, 2);
});

test("heal adds then clamps current HP to max HP, matching the strgt at 0x0211565C", () => {
  assert.equal(applyBattleHeal({ currentHp: 50, maxHp: 100, amount: 300 }), 100);
  assert.equal(applyBattleHeal({ currentHp: 50, maxHp: 4000, amount: 2100 }), 2150);
  assert.equal(applyBattleHeal({ currentHp: 100, maxHp: 100, amount: 200 }), 100);
  assert.equal(applyBattleHeal({ currentHp: 80, maxHp: 100, field5C: 14 }), 100);
});

test("field_5C 20 clears the negative slot; field_5C 21..29 map to positive codes 1..9", () => {
  assert.deepEqual(clearNegativeStatusSlot(), { runtimeCode: 0, remainingDuration: 0 });
  assert.equal(positiveEffectCodeForField5C(21), 1);
  assert.equal(positiveEffectCodeForField5C(29), 9);
  assert.deepEqual(applyPositiveEffect(1), {
    effectCode: 1,
    remainingDuration: BATTLE_POSITIVE_EFFECT_DURATION
  });
  assert.equal(BATTLE_POSITIVE_EFFECT_DURATION, 900);
  assert.deepEqual(clearPositiveEffect(), { effectCode: 0, remainingDuration: 0 });
});

test("a positive slot decrements while remaining > 0 and clears on the tick that reaches 0", () => {
  assert.deepEqual(
    tickPositiveEffect({ effectCode: 3, remainingDuration: 900 }),
    { effectCode: 3, remainingDuration: 899 }
  );
  assert.deepEqual(
    tickPositiveEffect({ effectCode: 3, remainingDuration: 1 }),
    { effectCode: 0, remainingDuration: 0 }
  );
  assert.deepEqual(
    tickPositiveEffect({ effectCode: 3, remainingDuration: 0 }),
    { effectCode: 0, remainingDuration: 0 }
  );
  assert.deepEqual(
    tickPositiveEffect({ effectCode: 0, remainingDuration: 12 }),
    { effectCode: 0, remainingDuration: 12 }
  );
});

test("attacker curve index +1 when positive code is 1 or negative runtime is 1, then high-clamp 26", () => {
  assert.equal(
    raiseAttackerCurveIndex({ baseIndex: 5, positiveEffectCode: 0, negativeRuntimeCode: 0 }),
    5
  );
  assert.equal(
    raiseAttackerCurveIndex({ baseIndex: 5, positiveEffectCode: 1, negativeRuntimeCode: 0 }),
    6
  );
  assert.equal(
    raiseAttackerCurveIndex({ baseIndex: 5, positiveEffectCode: 0, negativeRuntimeCode: 1 }),
    6
  );
  assert.equal(
    raiseAttackerCurveIndex({ baseIndex: 5, positiveEffectCode: 1, negativeRuntimeCode: 1 }),
    6
  );
  assert.equal(
    raiseAttackerCurveIndex({
      baseIndex: BATTLE_STAT_CURVE_MAX_INDEX,
      positiveEffectCode: 1,
      negativeRuntimeCode: 0
    }),
    BATTLE_STAT_CURVE_MAX_INDEX
  );
  assert.equal(
    raiseAttackerCurveIndex({
      baseIndex: BATTLE_STAT_CURVE_MAX_INDEX,
      positiveEffectCode: 1,
      negativeRuntimeCode: 0,
      clampHigh: false
    }),
    27
  );
});

test("defender curve index +1 uses action +0x58 selector → resist codes 2,5,6,8,9,7", () => {
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 10, actionElementSelector: 0, positiveEffectCode: 2 }),
    11
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 10, actionElementSelector: 0, positiveEffectCode: 5 }),
    10
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 1, positiveEffectCode: 5 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 2, positiveEffectCode: 6 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 3, positiveEffectCode: 8 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 4, positiveEffectCode: 9 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 5, positiveEffectCode: 7 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({ baseIndex: 4, actionElementSelector: 6, positiveEffectCode: 2 }),
    5
  );
  assert.equal(
    raiseDefenderCurveIndex({
      baseIndex: 26,
      actionElementSelector: 0,
      positiveEffectCode: 2
    }),
    26
  );
});

test("support helpers do not mention hit chance, TP, or a Sense accuracy bonus", () => {
  const source = fs.readFileSync(
    path.join("src", "championship", "battle", "battleSupport.js"),
    "utf8"
  );
  assert.equal(source.includes("hitChance"), false);
  assert.equal(source.includes("accuracy"), false);
  assert.equal(/\bTP\b/.test(source), false);
});

test("support helpers are not wired into the standalone app or screens", () => {
  const appTree = "src/championship/app";
  const offenders = fs.readdirSync(appTree)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => fs.readFileSync(path.join(appTree, name), "utf8").includes("battleSupport"));
  assert.deepEqual(offenders, []);
});
