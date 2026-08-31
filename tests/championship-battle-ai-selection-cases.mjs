// Battle AI action selection — OVL19 0x021159D4 ladder, move ladder 0x02115E8C.
// Structure and dumped tables only. No strategy names, no invented metrics.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BATTLE_AI_ACTION_THRESHOLDS,
  BATTLE_AI_ACTION_THRESHOLDS_OVERRIDE,
  BATTLE_AI_DECISION_ACTION,
  BATTLE_AI_DECISION_MOVE,
  BATTLE_AI_DECISION_TARGETED,
  BATTLE_AI_EVIDENCE,
  BATTLE_AI_MOVE_PRIMARY_Q12,
  BATTLE_AI_MOVE_SECONDARY_Q12,
  BATTLE_AI_MOVE_THRESHOLDS,
  BATTLE_AI_MOVE_THRESHOLDS_OVERRIDE,
  BATTLE_AI_OVERRIDE_STATUS_CODE,
  BATTLE_AI_PROFILE_COUNT,
  BATTLE_AI_Q12_SCALE,
  BATTLE_AI_RESERVE_PERCENT,
  BATTLE_AI_RNG_CHANNEL,
  BATTLE_AI_RNG_MODULUS,
  BATTLE_AI_ROUTINE,
  BATTLE_AI_STATE_BUCKET_4,
  BATTLE_AI_STATE_BUCKET_5,
  BATTLE_AI_STATE_BUCKET_6,
  BATTLE_AI_STATE_MOVE,
  BATTLE_AI_STATE_TARGETED,
  BATTLE_AI_SCAN_NONE,
  BATTLE_AI_EFFECT_BY_ACTION_ID,
  BATTLE_AI_TARGET_ROSTER_MAX_METRIC,
  BATTLE_AI_TARGET_ROSTER_RANDOM_UNAFFECTED,
  BATTLE_AI_TARGET_SELF,
  BATTLE_AI_TARGETED_GROUP_ORDER,
  BATTLE_AI_UNAFFECTED_BUFFER_SIZE,
  collectUnaffectedTargets,
  effectCodeForActionId,
  resolveAiMove,
  resolveAiReserve,
  scanAffordableAction,
  selectBattleAiAction,
  selectMaxMetricTarget
} from "../src/championship/battle/battleActionSelection.js";

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"),
  ".."
);

/** Feeds a fixed script of channel-216 rolls, asserting the channel each time. */
function scriptedRng(...rolls) {
  let index = 0;
  return {
    next(channel) {
      assert.equal(channel, BATTLE_AI_RNG_CHANNEL);
      if (index >= rolls.length) throw new Error("rng script exhausted");
      const roll = rolls[index];
      index += 1;
      return roll;
    },
    get consumed() {
      return index;
    }
  };
}

function action(costField48, id) {
  return { costField48, id };
}

const baseInput = {
  profileIndex: 0,
  sessionScalarIndex: 7,
  negativeStatusCode: 0,
  pendingField24: 0,
  metricBase: 1000,
  metricLimit: 9999
};

test("constants are the dumped OVL19 tables", () => {
  assert.equal(BATTLE_AI_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_AI_ROUTINE, "OVL19:0x021159D4");
  assert.equal(BATTLE_AI_PROFILE_COUNT, 3);
  assert.equal(BATTLE_AI_RNG_CHANNEL, 216);
  assert.equal(BATTLE_AI_RNG_MODULUS, 103);
  assert.equal(BATTLE_AI_OVERRIDE_STATUS_CODE, 2);
  assert.deepEqual(BATTLE_AI_ACTION_THRESHOLDS.map((row) => [...row]), [
    [32, 58, 95, 99],
    [17, 31, 88, 92],
    [7, 14, 41, 60]
  ]);
  assert.deepEqual([...BATTLE_AI_ACTION_THRESHOLDS_OVERRIDE], [0, 10, 10, 20]);
  assert.deepEqual(BATTLE_AI_MOVE_THRESHOLDS.map((row) => [...row]), [[68, 89], [48, 96], [7, 48]]);
  assert.deepEqual([...BATTLE_AI_MOVE_THRESHOLDS_OVERRIDE], [0, 20]);
  assert.deepEqual([...BATTLE_AI_MOVE_PRIMARY_Q12], [204800, 327680, 450560]);
  assert.equal(BATTLE_AI_MOVE_SECONDARY_Q12, 122880);
  assert.equal(BATTLE_AI_RESERVE_PERCENT.length, 3);
  assert.deepEqual([...BATTLE_AI_RESERVE_PERCENT[0]], [0, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual([...BATTLE_AI_RESERVE_PERCENT[1]], [0, 15, 20, 25, 30, 35, 40, 50]);
  assert.deepEqual([...BATTLE_AI_RESERVE_PERCENT[2]], [10, 30, 35, 40, 50, 60, 70, 80]);
});

test("Q12 move distances decode to 50, 80 and 110", () => {
  assert.deepEqual(
    BATTLE_AI_MOVE_PRIMARY_Q12.map((value) => value / BATTLE_AI_Q12_SCALE),
    [50, 80, 110]
  );
  assert.equal(BATTLE_AI_MOVE_SECONDARY_Q12 / BATTLE_AI_Q12_SCALE, 30);
});

test("reserve is metricBase * percent / 100, truncated, capped by metricLimit", () => {
  assert.equal(
    resolveAiReserve({ ...baseInput, profileIndex: 0, sessionScalarIndex: 7, metricBase: 1000 }),
    1000
  );
  assert.equal(
    resolveAiReserve({ ...baseInput, profileIndex: 1, sessionScalarIndex: 1, metricBase: 1000 }),
    150
  );
  // trunc, not round: 333 * 35 / 100 = 116.55
  assert.equal(
    resolveAiReserve({ ...baseInput, profileIndex: 2, sessionScalarIndex: 2, metricBase: 333 }),
    116
  );
  // movle: the limit wins, including on a tie.
  assert.equal(
    resolveAiReserve({ ...baseInput, profileIndex: 0, sessionScalarIndex: 7, metricBase: 1000, metricLimit: 400 }),
    400
  );
  assert.equal(
    resolveAiReserve({ ...baseInput, profileIndex: 0, sessionScalarIndex: 7, metricBase: 1000, metricLimit: 1000 }),
    1000
  );
  // percent 0 yields 0, so nothing can ever clear the reserve on that scalar.
  assert.equal(resolveAiReserve({ ...baseInput, sessionScalarIndex: 0, metricBase: 5000 }), 0);
});

test("a roll below T0 takes bucket 5 when the candidate clears the reserve", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: { 5: [action(10, "a"), action(20, "b")] },
    rng: scriptedRng(31, 1)
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_ACTION);
  assert.equal(result.state, BATTLE_AI_STATE_BUCKET_5);
  assert.equal(result.action.id, "b");
  assert.equal(result.bucketIndex, 1);
  assert.equal(result.reserve, 1000);
});

test("a candidate whose cost reaches the reserve falls through to the next bucket", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    metricBase: 100,
    sessionScalarIndex: 7,
    candidateBuckets: { 5: [action(100, "too-costly")], 6: [action(1, "cheap")] },
    rng: scriptedRng(31, 0, 0)
  });
  // reserve is 100; cost 100 is not strictly below it.
  assert.equal(result.reserve, 100);
  assert.equal(result.state, BATTLE_AI_STATE_BUCKET_6);
  assert.equal(result.action.id, "cheap");
  assert.equal(result.attempted[0].outcome, "COST_ABOVE_RESERVE");
});

test("bucket 4 commits with no cost gate, unlike buckets 5 and 6", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    metricBase: 0,
    candidateBuckets: { 4: [action(9999, "expensive")] },
    rng: scriptedRng(60, 0)
  });
  // reserve is 0, so a gated bucket could never fire; bucket 4 still commits.
  assert.equal(result.reserve, 0);
  assert.equal(result.state, BATTLE_AI_STATE_BUCKET_4);
  assert.equal(result.action.id, "expensive");
});

test("the affordability scan is first-fit and strictly below the reserve", () => {
  const actionCostById = { 10: 90, 11: 40, 12: 5 };
  // 90 is not below 90; 40 is, and the scan stops there.
  assert.equal(
    scanAffordableAction({ candidateIds: [10, 11, 12], actionCostById, reserve: 90 }),
    11
  );
  // Order matters: no shuffle, so reordering changes the answer.
  assert.equal(
    scanAffordableAction({ candidateIds: [12, 11, 10], actionCostById, reserve: 90 }),
    12
  );
  assert.equal(
    scanAffordableAction({ candidateIds: [10, 11, 12], actionCostById, reserve: 5 }),
    BATTLE_AI_SCAN_NONE
  );
  assert.equal(scanAffordableAction({ candidateIds: [], actionCostById, reserve: 999 }), 0);
});

test("the group-1 roster scan keeps the greatest metric44, skips HP exactly 0", () => {
  const picked = selectMaxMetricTarget({
    roster: [
      { currentHp: 10, metric44: 5 },
      null,
      { currentHp: 10, metric44: 9 },
      { currentHp: 0, metric44: 99 },
      { currentHp: -4, metric44: 7 }
    ],
    metricField: "metric44",
    skipZeroHp: true
  });
  assert.deepEqual(picked, { index: 2, metric: 9 });

  // movgt: ties keep the earlier entry.
  assert.deepEqual(
    selectMaxMetricTarget({
      roster: [{ currentHp: 1, metric44: 4 }, { currentHp: 1, metric44: 4 }],
      metricField: "metric44"
    }),
    { index: 0, metric: 4 }
  );
  // The running best starts at 0, so 0 or negative never wins.
  assert.equal(
    selectMaxMetricTarget({
      roster: [{ currentHp: 1, metric44: 0 }, { currentHp: 1, metric44: -3 }],
      metricField: "metric44"
    }),
    null
  );
  // A negative-HP entry is a legal target here even though contact rejects it.
  assert.deepEqual(
    selectMaxMetricTarget({ roster: [{ currentHp: -1, metric44: 8 }], metricField: "metric44" }),
    { index: 0, metric: 8 }
  );
  assert.equal(selectMaxMetricTarget({ roster: [] }), null);
});

test("the group-3 roster scan reads metric54 and applies no liveness test at all", () => {
  // A defeated entry is a legal group-3 target; group 1 would skip it.
  const roster = [
    { currentHp: 5, metric44: 90, metric54: 2 },
    { currentHp: 0, metric44: 1, metric54: 40 }
  ];
  assert.deepEqual(
    selectMaxMetricTarget({ roster, metricField: "metric54", skipZeroHp: false }),
    { index: 1, metric: 40 }
  );
  assert.deepEqual(
    selectMaxMetricTarget({ roster, metricField: "metric44", skipZeroHp: true }),
    { index: 0, metric: 90 }
  );
  assert.throws(
    () => selectMaxMetricTarget({ roster: [], metricField: "metric99" }),
    /metricField must be metric44 or metric54/
  );
});

test("group 5 collects at most three living entries that carry no positive effect", () => {
  const collected = collectUnaffectedTargets({
    roster: [
      { currentHp: 5, positiveEffectCode: 0 },
      { currentHp: 0, positiveEffectCode: 0 },
      null,
      { currentHp: 5, positiveEffectCode: 3 },
      { currentHp: 5, positiveEffectCode: 0 },
      { currentHp: 5, positiveEffectCode: 0 },
      { currentHp: 5, positiveEffectCode: 0 }
    ]
  });
  // HP > 0 here, unlike the metric scans; and the buffer holds three.
  assert.deepEqual(collected, [0, 4, 5]);
  assert.equal(BATTLE_AI_UNAFFECTED_BUFFER_SIZE, 3);
  assert.deepEqual(collectUnaffectedTargets({ roster: [{ currentHp: -1, positiveEffectCode: 0 }] }), []);
});

test("the effect table maps action ids to the positive effect they would apply", () => {
  assert.deepEqual([...BATTLE_AI_EFFECT_BY_ACTION_ID].slice(0, 10), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(effectCodeForActionId(10), 1);
  assert.equal(effectCodeForActionId(11), 1);
  assert.equal(effectCodeForActionId(12), 2);
  assert.equal(effectCodeForActionId(23), 7);
  assert.equal(effectCodeForActionId(9), 0);
  assert.equal(effectCodeForActionId(999), 0);
});

test("group 2 wins first and targets self without a roster scan", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96),
    targeted: {
      group2Guard: 1,
      scanGroups: { 2: [20], 1: [21], 4: [22] },
      actionCostById: { 20: 1, 21: 1, 22: 1 },
      roster: [{ currentHp: 5, metric: 5 }]
    }
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_TARGETED);
  assert.equal(result.state, BATTLE_AI_STATE_TARGETED);
  assert.equal(result.group, 2);
  assert.equal(result.actionId, 20);
  assert.deepEqual(result.target, { kind: BATTLE_AI_TARGET_SELF });
});

test("a closed group-2 guard falls to group 1, which needs a roster target", () => {
  const withTarget = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96),
    targeted: {
      group2Guard: 0,
      scanGroups: { 2: [20], 1: [21], 4: [22] },
      actionCostById: { 20: 1, 21: 1, 22: 1 },
      roster: [{ currentHp: 3, metric44: 2 }, { currentHp: 3, metric44: 8 }]
    }
  });
  assert.equal(withTarget.group, 1);
  assert.equal(withTarget.actionId, 21);
  assert.deepEqual(withTarget.target, {
    kind: BATTLE_AI_TARGET_ROSTER_MAX_METRIC,
    metricField: "metric44",
    index: 1,
    metric: 8
  });
  assert.equal(withTarget.attemptedGroups[0].outcome, "GUARD_CLOSED");

  // No qualifying roster entry drops through to group 4, which targets self.
  const noTarget = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96),
    targeted: {
      group2Guard: 0,
      group4Guard: 1,
      scanGroups: { 1: [21], 4: [22] },
      actionCostById: { 21: 1, 22: 1 },
      roster: [{ currentHp: 0, metric44: 50 }]
    }
  });
  assert.equal(noTarget.group, 4);
  assert.equal(noTarget.actionId, 22);
  assert.deepEqual(noTarget.target, { kind: BATTLE_AI_TARGET_SELF });
});

test("group 6 declines an action whose effect the combatant already carries", () => {
  const targeted = {
    group2Guard: 0,
    group4Guard: 0,
    scanGroups: { 6: [10], 5: [30] },
    actionCostById: { 10: 1, 30: 1 },
    roster: [{ currentHp: 5, positiveEffectCode: 0, metric44: 0, metric54: 0 }],
    positiveEffectCode: 1
  };
  // effectCodeForActionId(10) is 1 and the combatant already holds 1 → declined,
  // so the cascade continues to group 5.
  const declined = selectBattleAiAction({
    ...baseInput, candidateBuckets: {}, rng: scriptedRng(96, 0), targeted
  });
  assert.equal(declined.group, 5);
  assert.ok(declined.attemptedGroups.some((e) => e.group === 6 && e.outcome === "EFFECT_ALREADY_HELD"));

  // Holding a different code lets group 6 take it, targeting self.
  const taken = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96),
    targeted: { ...targeted, positiveEffectCode: 4 }
  });
  assert.equal(taken.group, 6);
  assert.deepEqual(taken.target, { kind: BATTLE_AI_TARGET_SELF });
});

test("group 5 picks uniformly among the entries it collected", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96, 7),
    targeted: {
      group2Guard: 0,
      group4Guard: 0,
      scanGroups: { 5: [30] },
      actionCostById: { 30: 1 },
      roster: [
        { currentHp: 5, positiveEffectCode: 0, metric44: 0, metric54: 0 },
        { currentHp: 5, positiveEffectCode: 0, metric44: 0, metric54: 0 }
      ]
    }
  });
  assert.equal(result.group, 5);
  assert.equal(result.target.kind, BATTLE_AI_TARGET_ROSTER_RANDOM_UNAFFECTED);
  // 7 % 2 = 1
  assert.equal(result.target.index, 1);
  assert.deepEqual(result.target.collected, [0, 1]);
});

test("exhausting all six groups falls to the move ladder and records the attempts", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(96, 10),
    targeted: {
      group2Guard: 0,
      group4Guard: 0,
      scanGroups: {},
      actionCostById: {},
      roster: []
    }
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_MOVE);
  assert.equal(result.state, BATTLE_AI_STATE_MOVE);
  assert.deepEqual(
    result.targetedAttempts.map((entry) => entry.group),
    BATTLE_AI_TARGETED_GROUP_ORDER.filter((group) => group !== undefined)
  );
  assert.deepEqual([...BATTLE_AI_TARGETED_GROUP_ORDER], [2, 1, 4, 3, 6, 5]);
});

test("roll at or above T3 goes to the move ladder", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(99, 10)
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_MOVE);
  assert.equal(result.state, BATTLE_AI_STATE_MOVE);
  assert.equal(result.tier, 0);
  assert.equal(result.primary, 50);
  assert.equal(result.secondary, 30);
});

test("empty buckets fall through the whole ladder to the move decision", () => {
  const result = selectBattleAiAction({
    ...baseInput,
    candidateBuckets: {},
    rng: scriptedRng(5, 95)
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_MOVE);
  assert.equal(result.tier, 2);
  assert.equal(result.primary, 110);
});

test("pendingField24 above zero skips the action ladder entirely", () => {
  const rng = scriptedRng(70);
  const result = selectBattleAiAction({
    ...baseInput,
    pendingField24: 1,
    candidateBuckets: { 5: [action(1, "never")] },
    rng
  });
  assert.equal(result.decision, BATTLE_AI_DECISION_MOVE);
  assert.equal(result.tier, 1);
  assert.equal(result.primary, 80);
  // Exactly one roll: the action ladder never rolled.
  assert.equal(rng.consumed, 1);
});

test("negative status 2 replaces both ladder rows with the override", () => {
  // Override T0 is 0, so the bucket-5 branch can never be entered.
  const action5 = selectBattleAiAction({
    ...baseInput,
    negativeStatusCode: BATTLE_AI_OVERRIDE_STATUS_CODE,
    candidateBuckets: { 5: [action(1, "unreachable")], 4: [action(1, "reachable")] },
    rng: scriptedRng(0, 0)
  });
  assert.notEqual(action5.state, BATTLE_AI_STATE_BUCKET_5);

  // Override T2 is 10, so a roll of 10..19 is the targeted path.
  const targeted = selectBattleAiAction({
    ...baseInput,
    negativeStatusCode: BATTLE_AI_OVERRIDE_STATUS_CODE,
    candidateBuckets: {},
    rng: scriptedRng(15),
    targeted: {
      group2Guard: 1,
      scanGroups: { 2: [30] },
      actionCostById: { 30: 1 },
      roster: []
    }
  });
  assert.equal(targeted.decision, BATTLE_AI_DECISION_TARGETED);
  assert.equal(targeted.group, 2);

  // Override move row is [0, 20], so a roll below 20 is tier 1, never tier 0.
  const moved = resolveAiMove({
    profileIndex: 0,
    negativeStatusCode: BATTLE_AI_OVERRIDE_STATUS_CODE,
    rng: scriptedRng(0)
  });
  assert.equal(moved.tier, 1);
});

test("profile 2 is far more likely to reach the targeted path than profile 0", () => {
  const [, , t2ProfileZero, t3ProfileZero] = BATTLE_AI_ACTION_THRESHOLDS[0];
  const [, , t2ProfileTwo, t3ProfileTwo] = BATTLE_AI_ACTION_THRESHOLDS[2];
  const windowZero = t3ProfileZero - t2ProfileZero;
  const windowTwo = t3ProfileTwo - t2ProfileTwo;
  assert.equal(windowZero, 4);
  assert.equal(windowTwo, 19);
  assert.ok(windowTwo > windowZero);
});

test("a roll outside 0..102 is rejected rather than skewing the ladder", () => {
  assert.throws(
    () => selectBattleAiAction({ ...baseInput, candidateBuckets: {}, rng: scriptedRng(150) }),
    /must be 0\.\.102/
  );
  assert.throws(
    () => selectBattleAiAction({ ...baseInput, candidateBuckets: {}, rng: scriptedRng(-1) }),
    /must be 0\.\.102/
  );
});

test("invalid input is rejected instead of coerced", () => {
  assert.throws(() => selectBattleAiAction(null), /plain object/);
  assert.throws(
    () => selectBattleAiAction({ ...baseInput, profileIndex: 3, candidateBuckets: {}, rng: scriptedRng(0) }),
    /profileIndex must be 0\.\.2/
  );
  assert.throws(
    () => resolveAiReserve({ ...baseInput, sessionScalarIndex: 8 }),
    /sessionScalarIndex must be 0\.\.7/
  );
  assert.throws(
    () => selectBattleAiAction({ ...baseInput, candidateBuckets: {} }),
    /rng\.next\(channel\)/
  );
});

test("the module names no strategy and invents no accuracy or metric semantics", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "src/championship/battle/battleActionSelection.js"),
    "utf8"
  );
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of ["aggressive", "defensive", "cautious", "berserk", "accuracy", "hitChance", "evasion"]) {
    assert.equal(
      new RegExp(banned, "i").test(code),
      false,
      `battleActionSelection.js must not name ${banned}`
    );
  }
});
