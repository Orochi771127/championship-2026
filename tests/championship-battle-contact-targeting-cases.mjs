// Contact targeting — OVL19 0x0211C714..0x0211C954, the bounded caller ending
// at the DamageResolver call site 0x0211C92C.
//
// Structure and the two proven rejections only. No hit/miss, no accuracy, no
// Sense, no TP, no battle screen.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BATTLE_CONTACT_ACCEPTED,
  BATTLE_CONTACT_ACTION_KINDS,
  BATTLE_CONTACT_CALLER,
  BATTLE_CONTACT_EFFECT_RECORD_BASE_OFFSET,
  BATTLE_CONTACT_EFFECT_RECORD_STRIDE,
  BATTLE_CONTACT_EFFECT_SLOT_COUNT,
  BATTLE_CONTACT_EVIDENCE,
  BATTLE_CONTACT_MODE_MULTI,
  BATTLE_CONTACT_MODE_SINGLE,
  BATTLE_CONTACT_PATH_DEFERRED,
  BATTLE_CONTACT_PATH_OTHER_HANDLER,
  BATTLE_CONTACT_PATH_TAKEN,
  BATTLE_CONTACT_REJECT_NULL_TARGET,
  BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE,
  BATTLE_CONTACT_RESOLVER_CALL_SITE,
  BATTLE_CONTACT_SINGLE_TARGET_SELECTORS,
  BATTLE_CONTACT_TARGET_SLOT_COUNT,
  BATTLE_CONTACT_TERMINAL_PHASE,
  BATTLE_DAMAGE_RESOLVER_CALL_SITES,
  isContactActionKind,
  isSingleTargetSelector,
  planBattleContactTargets
} from "../src/championship/battle/battleContactTargeting.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"), "..");

function alive(hp) {
  return { currentHp: hp };
}

test("constants are the dumped OVL19 immediates, not chosen numbers", () => {
  assert.equal(BATTLE_CONTACT_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_CONTACT_CALLER, "OVL19:0x0211C714");
  assert.equal(BATTLE_CONTACT_RESOLVER_CALL_SITE, "OVL19:0x0211C92C");
  // cmp r5, #3
  assert.equal(BATTLE_CONTACT_TARGET_SLOT_COUNT, 3);
  // add r7, sl, #672 ; add r7, r7, #436
  assert.equal(BATTLE_CONTACT_EFFECT_RECORD_BASE_OFFSET, 672);
  assert.equal(BATTLE_CONTACT_EFFECT_RECORD_STRIDE, 436);
  // r3 = 0..23 reset loop at 0x0211C73C
  assert.equal(BATTLE_CONTACT_EFFECT_SLOT_COUNT, 24);
  // mov r0, #2 ; str r0, [sl, #4]
  assert.equal(BATTLE_CONTACT_TERMINAL_PHASE, 2);
  assert.deepEqual([...BATTLE_CONTACT_ACTION_KINDS], [2, 3]);
  assert.deepEqual([...BATTLE_CONTACT_SINGLE_TARGET_SELECTORS], [0, 1]);
});

test("a full BL scan of OVL19 finds exactly three DamageResolver call sites", () => {
  assert.deepEqual([...BATTLE_DAMAGE_RESOLVER_CALL_SITES], [
    "OVL19:0x0211C92C",
    "OVL19:0x0211D9E0",
    "OVL19:0x0211D9FC"
  ]);
});

test("action +0x50 gate is the unsigned sub #2 / cmp #1 / bhi pair", () => {
  assert.equal(isContactActionKind(2), true);
  assert.equal(isContactActionKind(3), true);
  for (const kind of [0, 1, 4, 5, 255]) {
    assert.equal(isContactActionKind(kind), false);
  }
  const other = planBattleContactTargets({
    actionField50: 4,
    actionField54: 0,
    singleTarget: alive(100)
  });
  assert.equal(other.path, BATTLE_CONTACT_PATH_OTHER_HANDLER);
  assert.deepEqual(other.accepted, []);
  assert.equal(other.terminalPhaseWritten, false);
});

test("action +0x54 of 0 or 1 selects the single-target walk", () => {
  assert.equal(isSingleTargetSelector(0), true);
  assert.equal(isSingleTargetSelector(1), true);
  for (const selector of [2, 3, 7]) {
    assert.equal(isSingleTargetSelector(selector), false);
  }
  assert.equal(
    planBattleContactTargets({ actionField50: 2, actionField54: 1, singleTarget: alive(10) }).mode,
    BATTLE_CONTACT_MODE_SINGLE
  );
  assert.equal(
    planBattleContactTargets({ actionField50: 2, actionField54: 2, targetSlots: [alive(10)] }).mode,
    BATTLE_CONTACT_MODE_MULTI
  );
});

test("null target is rejected and advances the slot in both modes", () => {
  const multi = planBattleContactTargets({
    actionField50: 3,
    actionField54: 2,
    targetSlots: [null, alive(40), null]
  });
  assert.equal(multi.path, BATTLE_CONTACT_PATH_TAKEN);
  assert.deepEqual(multi.visits.map((visit) => visit.outcome), [
    BATTLE_CONTACT_REJECT_NULL_TARGET,
    BATTLE_CONTACT_ACCEPTED,
    BATTLE_CONTACT_REJECT_NULL_TARGET
  ]);
  assert.equal(multi.accepted.length, 1);

  // ldrne r9,[sl,#232] is inside the loop, so a null single target still burns
  // all three passes rather than exiting early.
  const single = planBattleContactTargets({
    actionField50: 2,
    actionField54: 0,
    singleTarget: null
  });
  assert.equal(single.visits.length, BATTLE_CONTACT_TARGET_SLOT_COUNT);
  assert.ok(single.visits.every((visit) => visit.outcome === BATTLE_CONTACT_REJECT_NULL_TARGET));
  assert.deepEqual(single.accepted, []);
});

test("HP <= 0 is rejected: multi skips to the next slot, single ends the walk", () => {
  const multi = planBattleContactTargets({
    actionField50: 2,
    actionField54: 5,
    targetSlots: [alive(0), alive(-3), alive(12)]
  });
  assert.deepEqual(multi.visits.map((visit) => visit.outcome), [
    BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE,
    BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE,
    BATTLE_CONTACT_ACCEPTED
  ]);
  assert.equal(multi.accepted.length, 1);
  assert.equal(multi.accepted[0].currentHp, 12);

  // cmp r6, #0 ; bne done
  const single = planBattleContactTargets({
    actionField50: 2,
    actionField54: 0,
    singleTarget: alive(0)
  });
  assert.equal(single.visits.length, 1);
  assert.equal(single.visits[0].outcome, BATTLE_CONTACT_REJECT_TARGET_NOT_ALIVE);
  assert.deepEqual(single.accepted, []);
});

test("exactly HP 1 is alive; the gate is cmp #0 / bgt, not a threshold", () => {
  const plan = planBattleContactTargets({
    actionField50: 2,
    actionField54: 0,
    singleTarget: alive(1)
  });
  assert.equal(plan.visits[0].outcome, BATTLE_CONTACT_ACCEPTED);
  assert.equal(plan.accepted.length, 1);
});

test("single mode stops after one resolve; multi resolves up to three slots", () => {
  const single = planBattleContactTargets({
    actionField50: 3,
    actionField54: 1,
    singleTarget: alive(50)
  });
  assert.equal(single.visits.length, 1);
  assert.equal(single.accepted.length, 1);

  const multi = planBattleContactTargets({
    actionField50: 3,
    actionField54: 9,
    targetSlots: [alive(5), alive(6), alive(7)]
  });
  assert.equal(multi.accepted.length, 3);
  assert.deepEqual(
    multi.visits.map((visit) => visit.effectRecordOffset),
    [672, 672 + 436, 672 + 872]
  );
  assert.equal(multi.terminalPhase, BATTLE_CONTACT_TERMINAL_PHASE);
  assert.equal(multi.terminalPhaseWritten, true);
});

test("the deferred early-out returns before targeting and writes no phase", () => {
  const plan = planBattleContactTargets({
    actionField50: 2,
    actionField54: 0,
    singleTarget: alive(100),
    deferredQueueResult: 1
  });
  assert.equal(plan.path, BATTLE_CONTACT_PATH_DEFERRED);
  assert.deepEqual(plan.visits, []);
  assert.deepEqual(plan.accepted, []);
  assert.equal(plan.terminalPhaseWritten, false);
});

test("more than three multi slots is rejected rather than silently truncated", () => {
  assert.throws(
    () => planBattleContactTargets({
      actionField50: 2,
      actionField54: 4,
      targetSlots: [alive(1), alive(1), alive(1), alive(1)]
    }),
    /at most 3 entries/
  );
});

test("invalid input is rejected instead of coerced", () => {
  assert.throws(() => planBattleContactTargets(null), /plain object/);
  assert.throws(
    () => planBattleContactTargets({ actionField50: 2.5, actionField54: 0 }),
    /actionField50 must be a safe integer/
  );
  assert.throws(
    () => planBattleContactTargets({ actionField50: 2, actionField54: 9 }),
    /targetSlots must be an array/
  );
  assert.throws(
    () => planBattleContactTargets({
      actionField50: 2,
      actionField54: 0,
      singleTarget: { currentHp: "40" }
    }),
    /currentHp must be a safe integer/
  );
});

test("the module invents no hit, accuracy, evasion, Sense or TP surface", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "src/championship/battle/battleContactTargeting.js"),
    "utf8"
  );
  // Comments state what is prohibited; no identifier may implement it.
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of ["hitChance", "accuracy", "evasion", "sense", "hitRate", "toHit"]) {
    assert.equal(
      new RegExp(banned, "i").test(code),
      false,
      `battleContactTargeting.js must not implement ${banned}`
    );
  }
  // Nothing here may roll: the bounded caller region contains no RNG216 call.
  assert.equal(/\brng\b/i.test(code), false, "contact targeting must not take an RNG");
  assert.equal(/\bMath\.random\b/.test(code), false);
});
