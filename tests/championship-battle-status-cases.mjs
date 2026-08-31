// Negative status — OVL19 mapping / duration / proc / DoT. One slot, no name-driven gameplay.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { BATTLE_CRIT_RNG_CHANNEL } from "../src/championship/battle/battleDamageResolver.js";
import {
  BATTLE_STATUS_DURATION_BY_RUNTIME_CODE,
  BATTLE_STATUS_EVIDENCE,
  BATTLE_STATUS_ID13_PROC_THRESHOLDS,
  BATTLE_STATUS_NORMAL_PROC_THRESHOLDS,
  BATTLE_STATUS_PROC_DELTA_MAX,
  BATTLE_STATUS_PROC_DELTA_MIN,
  BATTLE_STATUS_GATE_CLEAR_THEN_NORMAL,
  BATTLE_STATUS_GATE_FORCE_STATE,
  BATTLE_STATUS_GATE_NORMAL,
  BATTLE_STATUS_GATE_SPECIAL,
  BATTLE_STATUS_RESISTANCE_SENTINEL,
  applyNegativeStatus,
  mapActionStatusToRuntimeCode,
  negativeStatusActionGate,
  statusProcThreshold,
  statusResistanceIndex,
  tickNegativeStatus,
  tryApplyNegativeStatus
} from "../src/championship/battle/battleStatus.js";

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

test("action field_5C 1..13 maps to the runtime codes at 0x02115418", () => {
  assert.equal(BATTLE_STATUS_EVIDENCE, "VERIFIED_BINARY");
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(mapActionStatusToRuntimeCode),
    [5, 7, 10, 9, 11, 8, 6, 12, 13, 2, 1, 4, 14]
  );
});

test("duration table at 0x0212FECC is u16: 0, then 600 for 1..11, 900 for 12..14", () => {
  assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[0], 0);
  for (let code = 1; code <= 11; code += 1) {
    assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[code], 600, `code ${code}`);
  }
  assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[12], 900);
  assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[13], 900);
  assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[14], 900);
  assert.deepEqual(applyNegativeStatus({ runtimeCode: 5, currentHp: 100 }), {
    runtimeCode: 5,
    remainingDuration: 600
  });
  assert.deepEqual(applyNegativeStatus({ runtimeCode: 14, currentHp: 100 }), {
    runtimeCode: 14,
    remainingDuration: 900
  });
  assert.deepEqual(applyNegativeStatus({ runtimeCode: 0, currentHp: 100 }), {
    runtimeCode: 0,
    remainingDuration: 0
  });
  assert.deepEqual(applyNegativeStatus({ runtimeCode: 7, currentHp: 0 }), {
    runtimeCode: 0,
    remainingDuration: 0
  });
});

test("one slot overwrites; it does not stack", () => {
  const first = applyNegativeStatus({ runtimeCode: 7, currentHp: 50 });
  const second = applyNegativeStatus({ runtimeCode: 1, currentHp: 50 });
  assert.equal(first.runtimeCode, 7);
  assert.equal(second.runtimeCode, 1);
  assert.equal(second.remainingDuration, 600);
});

test("proc thresholds are the stride-8 first words, not advertised percentages", () => {
  assert.equal(BATTLE_STATUS_PROC_DELTA_MIN, -4);
  assert.equal(BATTLE_STATUS_PROC_DELTA_MAX, 4);
  assert.deepEqual([...BATTLE_STATUS_NORMAL_PROC_THRESHOLDS], [0, 5, 10, 15, 20, 25, 30, 35, 40]);
  assert.deepEqual([...BATTLE_STATUS_ID13_PROC_THRESHOLDS], [0, 0, 0, 0, 5, 6, 8, 12, 24]);
  assert.equal(statusProcThreshold({ actionStatusId: 1, attackerIndex: 5, resistanceIndex: 5 }), 20);
  assert.equal(statusProcThreshold({ actionStatusId: 1, attackerIndex: 9, resistanceIndex: 5 }), 40);
  assert.equal(statusProcThreshold({ actionStatusId: 1, attackerIndex: 0, resistanceIndex: 5 }), 0);
  assert.equal(statusProcThreshold({ actionStatusId: 13, attackerIndex: 5, resistanceIndex: 5 }), 5);
  assert.equal(statusProcThreshold({ actionStatusId: 13, attackerIndex: 0, resistanceIndex: 5 }), 0);
  assert.equal(statusProcThreshold({ actionStatusId: 13, attackerIndex: 9, resistanceIndex: 5 }), 24);
});

test("status applies only when the channel-216 roll is strictly below the threshold", () => {
  const applied = tryApplyNegativeStatus({
    actionStatusId: 11,
    attackerIndex: 5,
    resistanceIndex: 5,
    currentHp: 80,
    rng: scriptedRng([19])
  });
  assert.deepEqual(applied, { applied: true, runtimeCode: 1, remainingDuration: 600 });
  const missed = tryApplyNegativeStatus({
    actionStatusId: 11,
    attackerIndex: 5,
    resistanceIndex: 5,
    currentHp: 80,
    rng: scriptedRng([20])
  });
  assert.deepEqual(missed, { applied: false, runtimeCode: 0, remainingDuration: 0 });
});

test("DoT 7/13 ticks on remaining%180==0 after decrement, losing trunc(maxHP*3/100)", () => {
  const tick = tickNegativeStatus({
    runtimeCode: 7,
    remainingDuration: 181,
    currentHp: 1000,
    maxHp: 1000
  });
  assert.equal(tick.remainingDuration, 180);
  assert.equal(tick.currentHp, 970);
  assert.equal(tick.runtimeCode, 7);
  const quiet = tickNegativeStatus({
    runtimeCode: 7,
    remainingDuration: 180,
    currentHp: 1000,
    maxHp: 1000
  });
  assert.equal(quiet.remainingDuration, 179);
  assert.equal(quiet.currentHp, 1000);
});

test("DoT 14 ticks on remaining%10==0 after decrement, losing trunc(maxHP*5/100)", () => {
  const tick = tickNegativeStatus({
    runtimeCode: 14,
    remainingDuration: 11,
    currentHp: 200,
    maxHp: 200
  });
  assert.equal(tick.remainingDuration, 10);
  assert.equal(tick.currentHp, 190);
});

test("remaining already 0 at the start of a tick clears without a DoT", () => {
  const expired = tickNegativeStatus({
    runtimeCode: 7,
    remainingDuration: 0,
    currentHp: 500,
    maxHp: 500
  });
  assert.deepEqual(expired, {
    runtimeCode: 0,
    remainingDuration: 0,
    currentHp: 500
  });
});

test("DoT that would take HP below 0 floors to 0 and clears the slot", () => {
  const killed = tickNegativeStatus({
    runtimeCode: 14,
    remainingDuration: 1,
    currentHp: 2,
    maxHp: 200
  });
  assert.deepEqual(killed, {
    runtimeCode: 0,
    remainingDuration: 0,
    currentHp: 0
  });
});

test("status resistance source follows the OVL19 jump at 0x021152F4", () => {
  assert.equal(BATTLE_STATUS_RESISTANCE_SENTINEL, 999);
  const selected = {
    selectedDefenseIndex: 7,
    defenseIndex0x9C: 3,
    defenseIndex0xA0: 4,
    defenseIndex0xA4: 5
  };
  assert.equal(statusResistanceIndex({ actionStatusId: 1, ...selected }), 7);
  assert.equal(statusResistanceIndex({ actionStatusId: 2, ...selected }), 4);
  assert.equal(statusResistanceIndex({ actionStatusId: 3, ...selected }), 5);
  assert.equal(statusResistanceIndex({ actionStatusId: 4, ...selected }), 7);
  assert.equal(statusResistanceIndex({ actionStatusId: 5, ...selected }), 3);
  assert.equal(statusResistanceIndex({ actionStatusId: 6, ...selected }), 999);
  assert.equal(statusResistanceIndex({ actionStatusId: 7, ...selected }), 7);
  assert.equal(statusResistanceIndex({ actionStatusId: 8, ...selected }), 7);
  assert.equal(statusResistanceIndex({ actionStatusId: 9, ...selected }), 4);
  assert.equal(statusResistanceIndex({ actionStatusId: 10, ...selected }), 4);
  assert.equal(statusResistanceIndex({ actionStatusId: 11, ...selected }), 999);
  assert.equal(statusResistanceIndex({ actionStatusId: 12, ...selected }), 999);
  assert.equal(statusResistanceIndex({ actionStatusId: 13, ...selected }), 3);
});

test("proc can take the resistance jump instead of a precomputed index", () => {
  assert.equal(
    statusProcThreshold({
      actionStatusId: 1,
      attackerIndex: 5,
      selectedDefenseIndex: 5,
      defenseIndex0x9C: 0,
      defenseIndex0xA0: 0,
      defenseIndex0xA4: 0
    }),
    20
  );
  assert.equal(
    statusProcThreshold({
      actionStatusId: 11,
      attackerIndex: 5,
      selectedDefenseIndex: 5,
      defenseIndex0x9C: 0,
      defenseIndex0xA0: 0,
      defenseIndex0xA4: 0
    }),
    0
  );
});

test("action gate at 0x021157BC is a runtime-code switch, not reconstructed names", () => {
  assert.equal(negativeStatusActionGate({ runtimeCode: 0 }).family, BATTLE_STATUS_GATE_NORMAL);
  assert.equal(negativeStatusActionGate({ runtimeCode: 2 }).family, BATTLE_STATUS_GATE_NORMAL);
  assert.deepEqual(negativeStatusActionGate({ runtimeCode: 3 }), {
    family: BATTLE_STATUS_GATE_FORCE_STATE,
    clearsNegativeStatus: false,
    nextState: 9,
    resetCooldownFromSpeed: false,
    movementQ12: null
  });
  assert.equal(negativeStatusActionGate({ runtimeCode: 4 }).nextState, 12);
  assert.equal(negativeStatusActionGate({ runtimeCode: 8 }).family, BATTLE_STATUS_GATE_CLEAR_THEN_NORMAL);
  assert.equal(negativeStatusActionGate({ runtimeCode: 8 }).clearsNegativeStatus, true);
  assert.equal(negativeStatusActionGate({ runtimeCode: 9 }).clearsNegativeStatus, true);
  assert.equal(negativeStatusActionGate({ runtimeCode: 10 }).clearsNegativeStatus, true);
  assert.equal(negativeStatusActionGate({ runtimeCode: 12 }).clearsNegativeStatus, true);

  const expired = negativeStatusActionGate({ runtimeCode: 1, auxiliaryTimer24: 0 });
  assert.equal(expired.family, BATTLE_STATUS_GATE_SPECIAL);
  assert.equal(expired.nextState, 8);
  assert.equal(expired.resetCooldownFromSpeed, false);

  const active = negativeStatusActionGate({ runtimeCode: 1, auxiliaryTimer24: 1, speedIndex: 10 });
  assert.equal(active.nextState, 3);
  assert.equal(active.resetCooldownFromSpeed, true);
  assert.equal(active.decisionCooldown, 70);
  assert.deepEqual(active.movementQ12, { field184: 204800, field188: 122880 });

  const specialB = negativeStatusActionGate({ runtimeCode: 5, auxiliaryTimer24: 0 });
  assert.equal(specialB.nextState, 10);
  const specialBActive = negativeStatusActionGate({ runtimeCode: 5, auxiliaryTimer24: 2, speedIndex: 0 });
  assert.equal(specialBActive.nextState, 3);
  assert.equal(specialBActive.decisionCooldown, 90);
});

test("status helpers are not wired into the standalone app or screens", () => {
  const appTree = "src/championship/app";
  const offenders = fs.readdirSync(appTree)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => fs.readFileSync(path.join(appTree, name), "utf8").includes("battleStatus"));
  assert.deepEqual(offenders, []);
  const source = fs.readFileSync(
    path.join("src", "championship", "battle", "battleStatus.js"),
    "utf8"
  );
  assert.equal(/\bBlind\b/.test(source), false);
  assert.equal(/\bFreeze\b/.test(source), false);
});
