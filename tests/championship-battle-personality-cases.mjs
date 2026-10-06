// Battle personality wiring (2026-10-05) -- what changes when a battle runs the
// ORIGINAL personality policy, and what a BASELINE battle keeps exactly.
//
// The traced chain this file defends:
//   personality (stats +0x18) -> target selector, 0x021158E4 / table 0x0212FEEC
//   personality (stats +0x18) -> temper threshold, 0x0210D880 (frame loop)
//   team policy (+0x24 + member*4) -> combatant profile +0x18, 0x0210CBB8
//   policy 3 -> personality's profile, 0x021143D8 / table 0x0212FF0C
//   AI ladder fourth threshold is the +0x08 halfword, 0x02115B64
// Owned individuals carry their own 018 personality and the team-init policy 1;
// Free Battle presets carry +0x3C personality and +0x42 policy (4 for all 120).

import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_PERSONALITY_POLICY_PROFILE,
  buildOpponentTeamFromPresets,
  combatantFieldsFor,
  originalPersonalityFields
} from "../src/championship/app/battleRosterSource.js";
import {
  BATTLE_AI_DECISION_MOVE,
  BATTLE_AI_TABLES_BASELINE,
  BATTLE_AI_TABLES_ROM,
  selectBattleAiAction
} from "../src/championship/battle/battleActionSelection.js";
import {
  NORMAL_BATTLE_TARGET_SELECTOR_BY_PERSONALITY,
  normalBattlePersonalityTargetSelector,
  normalBattleTargetSelector
} from "../src/championship/battle/battleNormalFlow.js";
import { BATTLE_PARTY_DEFAULT_TACTIC, buildOwnedBattleCreature } from "../src/championship/battle/battleParty.js";
import { createBattleSession, createSessionCombatant } from "../src/championship/battle/battleSession.js";
import { createBattleRuntime } from "../src/championship/app/battleRuntime.js";
import { listMoveRecordsForCombatant } from "../src/championship/battle/battleCatalogs.js";
import { createNativeHuntIndividual } from "../src/championship/hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../src/championship/hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "../src/championship/raising/nativeIndividualProfile.js";

const HOT_BLOODED = 4; // 熱血: selector 1, temper threshold 50
const CALM = 5; // 冷靜: selector 5, temper threshold 9999 (never)
const ORIGINAL_GUARD_REASONS = new Set(["OWNER_LOCK", "NO_MOVE", "GLOBAL_PRESENTATION_LOCK", "OBJECT_IN_USE", "TARGET_HP", "RESOURCE"]);

function ownedIndividual(instanceId, personality, { species = 217, hp = 9000, tp = 900 } = {}) {
  const nativeProfile = structuredClone(nativeIndividualProfile(
    createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(species), rng: { next: () => 11 } })));
  nativeProfile.fields["018"] = personality;
  nativeProfile.fields["050"] = nativeProfile.fields["058"] = hp;
  nativeProfile.fields["054"] = nativeProfile.fields["05c"] = tp;
  return { instanceId, nativeProfile };
}

/** One Practice match straight through the runtime, sampling the normal-flow history. */
function runPractice({ player, opponent, seed, policy, size = 3, options = {} }) {
  const team = (prefix, personality) => Array.from({ length: size }, (_, i) => ownedIndividual(`${prefix}${i}`, personality, options));
  const runtime = createBattleRuntime({ mode: 5, battleType: 0, seed,
    playerIndividuals: Array.isArray(player) ? player : team("A", player),
    opponentIndividuals: Array.isArray(opponent) ? opponent : team("B", opponent),
    ...(policy ? { personalityPolicy: policy } : {}) });
  try {
    runtime.choosePracticeBattle({ arenaIndex: 7 });
    const source = runtime.startMatch();
    const history = new Set();
    const digest = [];
    let ticks = 0;
    for (; ticks < 60000 && !source.getView().outcome.ended; ticks += 1) {
      source.tick();
      if (ticks % 100 === 0) {
        const view = source.getView();
        for (const entry of view.nativeLifecycle.normalFlow.history) history.add(entry);
        digest.push(view.combatants.map((c) => c.present ? `${c.hp.current}/${c.resource.current}` : "-").join(","));
      }
    }
    const view = source.getView();
    for (const entry of view.nativeLifecycle.normalFlow.history) history.add(entry);
    return { ticks, verdict: view.outcome.verdict, diagnostics: runtime.getPersonalityDiagnostics(), history: [...history], digest };
  } finally {
    runtime.dispose();
  }
}

test("the roster wires personality and policy only under ORIGINAL, and keeps baseline fields exact", () => {
  const owned = buildOwnedBattleCreature(ownedIndividual("x", HOT_BLOODED));
  assert.equal(owned.personality, HOT_BLOODED);
  assert.equal(owned.tactic, BATTLE_PARTY_DEFAULT_TACTIC);
  assert.equal(BATTLE_PARTY_DEFAULT_TACTIC, 1);

  const baseline = combatantFieldsFor(owned, 0);
  assert.deepEqual(baseline, combatantFieldsFor(owned, 0, "BASELINE"));
  for (const key of ["field18", "profileIndex", "flags9A"]) assert.equal(key in baseline, false, key);

  const original = combatantFieldsFor(owned, 0, "ORIGINAL");
  assert.deepEqual({ field18: original.field18, profileIndex: original.profileIndex, flags9A: original.flags9A },
    { field18: HOT_BLOODED, profileIndex: 1, flags9A: 1 });
  const { field18, profileIndex, flags9A, ...rest } = original;
  assert.deepEqual(rest, baseline, "ORIGINAL adds the three fields and changes nothing else");
});

test("policy 3 takes each personality's profile and clears +0x9A bit 0; other policies keep theirs", () => {
  assert.deepEqual(BATTLE_PERSONALITY_POLICY_PROFILE, [1, 0, 0, 2, 1, 2, 0, 1]);
  for (let personality = 0; personality < 8; personality += 1) {
    assert.deepEqual(originalPersonalityFields({ personality, tactic: 3 }).fields,
      { field18: personality, profileIndex: BATTLE_PERSONALITY_POLICY_PROFILE[personality], flags9A: 0 });
    for (const tactic of [0, 1, 2, 4]) {
      assert.deepEqual(originalPersonalityFields({ personality, tactic }).fields, { field18: personality, profileIndex: tactic, flags9A: 1 });
    }
  }
  // An untraced personality, or a creature built before the wiring, stays baseline.
  for (const creature of [{ personality: 8, tactic: 1 }, { personality: -1, tactic: 1 }, { tactic: 1 }, { personality: 2, tactic: 5 }, { personality: 2 }]) {
    const wiring = originalPersonalityFields(creature);
    assert.equal(wiring.fields, null, JSON.stringify(creature));
    assert.match(wiring.reason, /NOT_0_TO/);
  }
  assert.throws(() => buildOwnedBattleCreature({ ...ownedIndividual("x", 0), tactic: 4 }), /TACTIC_INVALID/);
});

test("Free Battle presets carry the ROM personality (+0x3C) and policy 4 (+0x42)", () => {
  const team = buildOpponentTeamFromPresets([456, 457, 458]);
  for (const creature of team) {
    assert.equal(creature.tactic, 4);
    assert.ok(Number.isInteger(creature.personality) && creature.personality >= 0 && creature.personality <= 7);
    assert.deepEqual(originalPersonalityFields(creature).fields, { field18: creature.personality, profileIndex: 4, flags9A: 1 });
  }
});

test("the target selector is read by personality under ORIGINAL; baseline keeps the profile reading", () => {
  assert.deepEqual(NORMAL_BATTLE_TARGET_SELECTOR_BY_PERSONALITY, [0, 12, 8, 12, 1, 5, 2, 8]);
  for (let personality = 0; personality < 8; personality += 1) {
    assert.equal(normalBattlePersonalityTargetSelector(personality), NORMAL_BATTLE_TARGET_SELECTOR_BY_PERSONALITY[personality]);
  }
  assert.throws(() => normalBattlePersonalityTargetSelector(8), /PERSONALITY_UNTRACED/);
  assert.deepEqual([0, 1, 2].map(normalBattleTargetSelector), [0, 12, 8]);
});

test("ROM tables: the targeted window ends at the +0x08 halfword, and rows 3-4 are read as stored", () => {
  const rng = (rolls) => ({ next: (channel) => { assert.equal(channel, 216); return rolls.shift() ?? 0; } });
  const input = (profileIndex, rolls, tables, buckets = {}) => ({ profileIndex, sessionScalarIndex: 3, negativeStatusCode: 0,
    pendingField24: 0, metricBase: 100, metricLimit: 100, candidateBuckets: buckets, rng: rng(rolls), tables,
    targeted: { scanGroups: {}, actionCostById: {}, roster: [] } });
  // Profile 0, roll 99: past the baseline's 99 (move ladder), inside the ROM's 103 (targeted cascade).
  assert.equal(selectBattleAiAction(input(0, [99, 50], BATTLE_AI_TABLES_BASELINE)).decision, BATTLE_AI_DECISION_MOVE);
  assert.equal(selectBattleAiAction(input(0, [99, 50])).decision, BATTLE_AI_DECISION_MOVE, "tables default to the baseline");
  const romTargeted = selectBattleAiAction(input(0, [99, 50], BATTLE_AI_TABLES_ROM));
  assert.equal(romTargeted.decision, BATTLE_AI_DECISION_MOVE);
  assert.ok(romTargeted.targetedAttempts, "the ROM row sent roll 99 through the targeted cascade first");
  // Profile 2's window widens from [41,60) to [41,93).
  assert.equal(selectBattleAiAction(input(2, [70, 50], BATTLE_AI_TABLES_BASELINE)).targetedAttempts, undefined);
  assert.ok(selectBattleAiAction(input(2, [70, 50], BATTLE_AI_TABLES_ROM)).targetedAttempts);
  // Profile 4 (every Free Battle preset): bucket 6 is cost-gated against a zero
  // reserve at tier 3, so bucket 4 takes the decision without a cost gate.
  const ordinary = [{ actionId: 31, costField48: 0 }];
  const four = selectBattleAiAction(input(4, [5, 0, 0], BATTLE_AI_TABLES_ROM, { 4: ordinary, 6: [{ actionId: 77, costField48: 0 }] }));
  assert.equal(four.state, 4);
  assert.equal(four.action.actionId, 31);
  // Profile 3 is all zero: every roll reaches the move ladder.
  assert.equal(selectBattleAiAction(input(3, [0, 0], BATTLE_AI_TABLES_ROM, { 4: ordinary })).decision, BATTLE_AI_DECISION_MOVE);
  assert.throws(() => selectBattleAiAction(input(4, [0], BATTLE_AI_TABLES_BASELINE)), /profileIndex must be 0\.\.2/);
  assert.throws(() => selectBattleAiAction(input(5, [0], BATTLE_AI_TABLES_ROM)), /profileIndex must be 0\.\.4/);
});

test("the session takes a per-slot policy and refuses unknown policies or slots", () => {
  const roster = Array.from({ length: 6 }, () => createSessionCombatant({}));
  assert.deepEqual(createBattleSession({ roster }).aiPolicyBySlot, Array(6).fill("BASELINE"));
  assert.deepEqual(createBattleSession({ roster, personalityPolicy: "ORIGINAL", baselineSlots: [4] }).aiPolicyBySlot,
    ["ORIGINAL", "ORIGINAL", "ORIGINAL", "ORIGINAL", "BASELINE", "ORIGINAL"]);
  assert.throws(() => createBattleSession({ roster, personalityPolicy: "SOMETHING" }), /PERSONALITY_POLICY_UNKNOWN/);
  assert.throws(() => createBattleSession({ roster, personalityPolicy: "ORIGINAL", baselineSlots: [6] }), /BASELINE_SLOTS/);
  assert.throws(() => createBattleRuntime({ mode: 5, personalityPolicy: "original" }), /PERSONALITY_POLICY_UNKNOWN/);
});

test("BASELINE is the default and runs the same match as before, with no personality behaviour", () => {
  for (const seed of [20, 31]) {
    const implicit = runPractice({ player: HOT_BLOODED, opponent: CALM, seed, options: { hp: 3000, tp: 600 } });
    const explicit = runPractice({ player: HOT_BLOODED, opponent: CALM, seed, policy: "BASELINE", options: { hp: 3000, tp: 600 } });
    assert.deepEqual(explicit.digest, implicit.digest);
    assert.equal(explicit.verdict, implicit.verdict);
    assert.equal(implicit.diagnostics.policy, "BASELINE");
    for (const slot of implicit.diagnostics.slots.filter(Boolean)) {
      assert.deepEqual([slot.policy, slot.field18, slot.profile, slot.flags9A & 1, slot.temper], ["BASELINE", 0, 0, 0, 0]);
    }
    assert.ok(implicit.diagnostics.decisions.every((d) => d.selector === 0 && d.policy === "BASELINE"));
  }
});

test("ORIGINAL Practice: 熱血 and 冷靜 differ in target selector and temper on paired seeds, with legal actions only", () => {
  // Seeds 21 and 23 cross 熱血's threshold with the side order either way round.
  const seeds = [21, 23];
  // Every individual here is built the same way, so one move list serves all.
  const own = new Set(listMoveRecordsForCombatant(buildOwnedBattleCreature(ownedIndividual("x", 0))).map((move) => move.recordIndex));
  const totals = { BASELINE: { hot: 0, calm: 0 }, ORIGINAL: { hot: 0, calm: 0 } };
  for (const policy of ["BASELINE", "ORIGINAL"]) {
    // The baseline half only has to show the same pairing never tempers.
    for (const seed of policy === "BASELINE" ? seeds.slice(0, 1) : seeds) {
      for (const [player, opponent] of [[HOT_BLOODED, CALM], [CALM, HOT_BLOODED]]) {
        const run = runPractice({ player, opponent, seed, policy });
        const slots = run.diagnostics.slots.filter(Boolean);
        for (const slot of slots) {
          const personality = slot.team === 0 ? player : opponent;
          totals[policy][personality === HOT_BLOODED ? "hot" : "calm"] += slot.temper;
          if (policy === "ORIGINAL") {
            assert.deepEqual([slot.policy, slot.field18, slot.profile, slot.flags9A & 1, slot.fallback], ["ORIGINAL", personality, 1, 1, null]);
          }
          // Legal actions: every chosen action is the combatant's own, and a refused
          // launch is refused by one of the original's launch guards.
          for (const reason of Object.keys(slot.refusedBy)) assert.ok(ORIGINAL_GUARD_REASONS.has(reason), reason);
          for (const decision of run.diagnostics.decisions.filter((d) => d.slot === slot.slot && d.decision === "ACTION")) {
            assert.ok(own.has(decision.actionId), `slot ${slot.slot} chose ${decision.actionId}, not on its move list`);
          }
        }
        const expectedSelector = (slot) => policy === "ORIGINAL"
          ? NORMAL_BATTLE_TARGET_SELECTOR_BY_PERSONALITY[Math.floor(slot / 3) === 0 ? player : opponent] : 0;
        assert.ok(run.diagnostics.decisions.every((d) => d.selector === null || d.selector === expectedSelector(d.slot)));
        // Every launch record names a decision the normal flow selected.
        const selected = new Set(run.history.filter((e) => e.type === "SELECTED").map((e) => e.decisionId));
        for (const launch of run.history.filter((e) => e.type === "LAUNCHED" || e.type === "LAUNCH_REFUSED")) {
          assert.ok(Number.isInteger(launch.decisionId) && selected.has(launch.decisionId), JSON.stringify(launch));
        }
        assert.ok(run.history.filter((e) => e.type === "SELECTED").every((e) => Number.isInteger(e.decisionId)));
      }
    }
  }
  // 冷靜's threshold is 9999 and the baseline reads personality 0's 100: neither tempers here.
  assert.deepEqual(totals.BASELINE, { hot: 0, calm: 0 });
  assert.equal(totals.ORIGINAL.calm, 0);
  assert.ok(totals.ORIGINAL.hot > 0, "熱血's threshold of 50 is crossed in at least one paired match");
});

test("an untraced personality falls back to the baseline reading for that slot only", () => {
  const run = runPractice({ player: [ownedIndividual("odd", 8)], opponent: [ownedIndividual("calm", CALM)], seed: 20,
    policy: "ORIGINAL", options: { hp: 3000, tp: 600 } });
  const [odd, calm] = run.diagnostics.slots.filter(Boolean);
  assert.deepEqual([odd.policy, odd.fallback, odd.field18, odd.profile], ["BASELINE", "PERSONALITY_NOT_0_TO_7", 0, 0]);
  assert.deepEqual([calm.policy, calm.fallback, calm.field18, calm.profile], ["ORIGINAL", null, CALM, 1]);
  assert.ok(run.diagnostics.decisions.filter((d) => d.slot === odd.slot).every((d) => d.policy === "BASELINE" && d.selector === 0));
});

test("ORIGINAL Free Battle: preset opponents run policy 4 and decide from bucket 4 only", () => {
  for (const seed of [20, 21]) {
    const runtime = createBattleRuntime({ mode: 2, battleType: 0, seed, personalityPolicy: "ORIGINAL",
      playerIndividuals: [ownedIndividual("me", HOT_BLOODED, { hp: 6000 })] });
    try {
      runtime.chooseFreeBattle({ presetIndices: [486, 487, 488], arenaIndex: 7 });
      const source = runtime.startMatch();
      for (let tick = 0; tick < 60000 && !source.getView().outcome.ended; tick += 1) source.tick();
      const diagnostics = runtime.getPersonalityDiagnostics();
      const [me, ...opponents] = diagnostics.slots.filter(Boolean);
      assert.deepEqual([me.policy, me.field18, me.profile], ["ORIGINAL", HOT_BLOODED, 1]);
      assert.equal(opponents.length, 3);
      for (const opponent of opponents) {
        assert.deepEqual([opponent.policy, opponent.tactic, opponent.profile, opponent.flags9A & 1], ["ORIGINAL", 4, 4, 1]);
        assert.ok(Object.keys(opponent.byState).every((state) => state === "4" || state === "3"), JSON.stringify(opponent.byState));
      }
    } finally {
      runtime.dispose();
    }
  }
});
