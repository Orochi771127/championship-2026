// Battle AI action selection -- OVL19 0x021159D4, the routine that decides what
// a combatant does when its cooldown expires.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
// Stage 4 names this `ai_decision_routine`; Stage 4's B07/B08 record that the
// structure is verified while the human-readable strategy labels are not. This
// module therefore reproduces the structure exactly and names nothing it cannot
// prove. Buckets are keyed by the state code the original passes to 0x02114984,
// which is a ROM fact, not a chosen label.
//
// The literal pool at 0x02115F14 confirms every table address used below:
//   0x0212FFF4  reserve percent, stride 16   0x0212FF88  action ladder, stride 12
//   0x0212FE40  action ladder override        0x0212FE84  move ladder, stride 6
//   0x0212FE38  move ladder override          0x020CFF9C  ARM9 action table, stride 104
//
// Address arithmetic is MLA (base + index*stride). A disassembler that does not
// decode MLA renders it as a bare MUL and silently drops the base -- every table
// address here was confirmed against the literal pool as well as the opcode.
//
// THE ROLL IS 0..102, NOT 0..215
// ------------------------------
// `mov r0, #216; bl 0x020431D4` passes a CHANNEL id, not a modulus. The helper
// keeps a cursor and a seed per channel (217 channels; the header at 0x020BD230
// holds count 0xD9, the cursor array and the seed array) and returns
//   (seed[channel] + table[cursor]) mod 103
// walking a fixed 103-entry table at 0x020BD23C and wrapping the cursor at 103.
// So every threshold in this file is out of 103. Callers must inject an
// rng.next(216) that yields 0..102, or the ladder skews.
//
// THE LADDER (0x02115A5C onward), roll = rng.next(216) once
//   roll >= T2  -> targeted path, state 7, but only while roll < T3
//   roll >= T0  -> mid ladder
//   otherwise   -> bucket 5, taken only if its cost clears the reserve
//   mid: roll >= T1 -> late ladder; else bucket 6, same cost gate
//   late: roll >= T2 -> move ladder; else bucket 4, COMMITTED WITHOUT A COST GATE
//
// The missing cost gate on bucket 4 is not an oversight in this translation.
// 0x02115B44..0x02115B58 picks and commits with no `ldrh [action,#0x48]` compare,
// unlike 0x02115AA8 and 0x02115AFC. Preserve the asymmetry.
//
// RESERVE (0x021159F0..0x02115A30)
//   reserve = min( trunc(metricBase * reservePercent[profile][scalar] / 100),
//                  metricLimit )
// A candidate is taken only when its +0x48 field is strictly below the reserve.
//
// Those two metrics are no longer anonymous. battleActionResource traces the
// charge at 0x0211C244, which reads the action's +0x48 as a COST and subtracts
// it from stats +0x54. So:
//   metricBase  is stats +0x5C, the resource MAXIMUM
//   metricLimit is stats +0x54, the resource CURRENT
// and the reserve reads as: never commit to an action costing more than a
// profile-scaled slice of full capacity, and never more than is actually held.
// The parameter names are kept as-is so existing callers and tests do not move;
// the meaning is documented here rather than renamed under them.
//
// SAME-FRAME TIES RESOLVE BY SLOT INDEX
// -------------------------------------
// The per-frame combatant pass at 0x0210D6E4..0x0210D90C walks six fixed slots
// with `add r8, r8, #1; cmp r8, #6; blt`, updating the negative-status tick and
// DoT, the positive-effect tick, +0x24 and the cooldown +0x28 in that order.
// A sweep of OVL19 finds nineteen loops bounded by 6 and every one of them
// counts upward; none descends, sorts by speed, or randomises. So when two
// combatants' cooldowns reach zero on the same frame, the lower slot index is
// serviced first. There is no priority or speed tiebreak -- speed only changes
// WHEN a cooldown reaches zero, through the 90 - 2*speedIndex rebuild.
//
// NEGATIVE STATUS 2 REPLACES BOTH LADDER ROWS
//   0x02115A3C / 0x02115EA4 compare combatant +0x158 against 2 and swap the row
//   for a fixed override. It is a different decision profile, not a modifier.
//
// THE STATE-7 CASCADE (0x02115B64 onward)
// ---------------------------------------
// 0x021144CC is NOT a target selector, despite how its call sites read. It is a
// first-fit affordability scan: it walks a per-group list of action ids and
// returns the first whose ARM9 record (0x020CFF9C, stride 104) has +0x48
// strictly below the reserve, or 0 when none qualifies. Groups live at
// combatant + 0xE8 + group*12 with a count byte at + 0xF0 + group*12.
//
// The real target choice is inlined at 0x02115BE8 and scans the roster at
// combatant +0x54: skip a null entry or one whose HP is exactly 0, then keep the
// entry with the greatest parallel metric at roster +0x44 + index*4. `movgt`
// means ties keep the earlier entry, and the running best starts at 0, so a
// metric that is 0 or negative is never selected.
//
// Note the HP test here is `!= 0`, not `> 0`. A combatant on negative HP is a
// legal target for this scan even though battleContactTargeting rejects it. The
// asymmetry is in the ROM; do not normalise it.
//
// The cascade tries six groups in the order 2, 1, 4, 3, 6, 5 and falls to the
// move ladder when all of them decline. Each group pairs one scan with one way
// of choosing a target, and the four targeting styles are genuinely different:
//
//   group 2  0x02115B70  guard [[+0x54]+0x40] > 0        target SELF
//   group 1  0x02115BC4                                   target max metric +0x44,
//                                                         skipping null and HP == 0
//   group 4  0x02115C70  guard [[+0x54]+0x50] > 0        target SELF
//   group 3  0x02115CC4                                   target max metric +0x54,
//                                                         skipping ONLY null
//   group 6  0x02115D64  declines when +0x160 already     target SELF
//                        equals effectByActionId[id]
//   group 5  0x02115DBC  collects living entries whose    target uniform random
//                        +0x160 is 0, at most three       among those collected
//
// Group 3 applies no HP test at all: 0x02115CFC..0x02115D18 checks the pointer
// and nothing else, so a defeated entry is a legal target there. Group 1 rejects
// HP exactly 0, and group 5 requires HP > 0. Three different liveness rules in
// one cascade -- all three are in the ROM, none of them is a typo here.
//
// Group 6's decline is the duplicate-effect check: 0x021300D4 maps an action id
// to the positive effect code it would apply, and the group is skipped when the
// combatant already carries that code. Because the table's first ten entries are
// 0, an action with no effect is always declined by a combatant with no effect.
//
// +0x64 is the target and +0x178 is the chosen action id; +0x174 holds the
// pointer built from that id. An earlier reading of +0x178 as the target was
// wrong -- the caller multiplies it by 104 into the action table.
//
// NOT TRACED, THEREFORE NOT IMPLEMENTED
// -------------------------------------
// Strategy names, metric names beyond role-based ones, the 596-action table, and
// any claim about which bucket or group holds which kind of action.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_AI_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_AI_ROUTINE = "OVL19:0x021159D4";

/** `mov r0, #216` is a channel id; the helper's modulus is 103. */
export const BATTLE_AI_RNG_CHANNEL = 216;
export const BATTLE_AI_RNG_MODULUS = 103;

/**
 * Six fixed combatant slots, serviced in ascending index order by every
 * per-frame loop in OVL19. Same-frame readiness ties go to the lower slot.
 */
export const BATTLE_AI_SLOT_SERVICE_ORDER = "ASCENDING_SLOT_INDEX";
export const BATTLE_AI_FRAME_PASS = "OVL19:0x0210D6E4";

/** Rows 3+ of every table below are zero, so exactly three profiles exist. */
export const BATTLE_AI_PROFILE_COUNT = 3;
export const BATTLE_AI_RESERVE_SCALAR_COUNT = 8;

/** Combatant +0x158 value that swaps both ladder rows for their override. */
export const BATTLE_AI_OVERRIDE_STATUS_CODE = 2;

/** State codes the original passes to 0x02114984 as r1. */
export const BATTLE_AI_STATE_MOVE = 3;
export const BATTLE_AI_STATE_BUCKET_4 = 4;
export const BATTLE_AI_STATE_BUCKET_5 = 5;
export const BATTLE_AI_STATE_BUCKET_6 = 6;
export const BATTLE_AI_STATE_TARGETED = 7;

/** OVL19 0x0212FF88, stride 12; the ladder reads +0x00, +0x02, +0x04 and +0x08. */
export const BATTLE_AI_ACTION_THRESHOLDS = deepFreeze([
  [32, 58, 95, 99],
  [17, 31, 88, 92],
  [7, 14, 41, 60]
]);

/** OVL19 0x0212FE40, used whole when +0x158 == 2. */
export const BATTLE_AI_ACTION_THRESHOLDS_OVERRIDE = deepFreeze([0, 10, 10, 20]);

/** OVL19 0x0212FFF4, stride 16, indexed by the session scalar at ctx +0x5E9C. */
export const BATTLE_AI_RESERVE_PERCENT = deepFreeze([
  [0, 40, 50, 60, 70, 80, 90, 100],
  [0, 15, 20, 25, 30, 35, 40, 50],
  [10, 30, 35, 40, 50, 60, 70, 80]
]);

/** OVL19 0x0212FE84, stride 6; the move ladder reads +0x00 and +0x02. */
export const BATTLE_AI_MOVE_THRESHOLDS = deepFreeze([
  [68, 89],
  [48, 96],
  [7, 48]
]);

/** OVL19 0x0212FE38, used whole when +0x158 == 2. */
export const BATTLE_AI_MOVE_THRESHOLDS_OVERRIDE = deepFreeze([0, 20]);

/** Q12 immediates written to +0x184 by the three move tiers. */
export const BATTLE_AI_MOVE_PRIMARY_Q12 = deepFreeze([0x32000, 0x50000, 0x6e000]);

/** Q12 immediate written to +0x188 by all three tiers. */
export const BATTLE_AI_MOVE_SECONDARY_Q12 = 0x1e000;

export const BATTLE_AI_Q12_SCALE = 4096;

export const BATTLE_AI_DECISION_ACTION = "ACTION";
export const BATTLE_AI_DECISION_TARGETED = "TARGETED_ACTION";
export const BATTLE_AI_DECISION_MOVE = "MOVE";

/** ARM9 action table the scan indexes; +0x48 is the field compared to the reserve. */
export const BATTLE_AI_ACTION_TABLE = "ARM9:0x020CFF9C";
export const BATTLE_AI_ACTION_TABLE_STRIDE = 104;
export const BATTLE_AI_ACTION_COST_FIELD_OFFSET = 0x48;

/** Scan groups at combatant + 0xE8 + group*12, count byte at + 0xF0 + group*12. */
export const BATTLE_AI_SCAN_GROUP_STRIDE = 12;
export const BATTLE_AI_SCAN_LIST_BASE_OFFSET = 0xe8;
export const BATTLE_AI_SCAN_COUNT_BASE_OFFSET = 0xf0;

/** 0x021144CC returns 0 when nothing in the group clears the reserve. */
export const BATTLE_AI_SCAN_NONE = 0;

/** The full cascade order at 0x02115B64 onward. */
export const BATTLE_AI_TARGETED_GROUP_ORDER = deepFreeze([2, 1, 4, 3, 6, 5]);

export const BATTLE_AI_TARGET_SELF = "SELF";
export const BATTLE_AI_TARGET_ROSTER_MAX_METRIC = "ROSTER_MAX_METRIC";
export const BATTLE_AI_TARGET_ROSTER_RANDOM_UNAFFECTED = "ROSTER_RANDOM_UNAFFECTED";

/** Roster metric fields, named by their offset because their meaning is unproven. */
export const BATTLE_AI_ROSTER_METRIC_44 = "metric44";
export const BATTLE_AI_ROSTER_METRIC_54 = "metric54";

/** Group 5 buffers at most three collected entries on the stack. */
export const BATTLE_AI_UNAFFECTED_BUFFER_SIZE = 3;

/**
 * OVL19 0x021300D4, u32 by action id: the positive effect code an action would
 * apply. Group 6 declines when the combatant's +0x160 already equals this.
 */
export const BATTLE_AI_EFFECT_BY_ACTION_ID = deepFreeze([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7
]);

function aiError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleAiError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw aiError(`${label} must be a safe integer`);
  return value;
}

function requireProfileIndex(value) {
  requireSafeInteger(value, "profileIndex");
  if (value < 0 || value >= BATTLE_AI_PROFILE_COUNT) {
    throw aiError(`profileIndex must be 0..${BATTLE_AI_PROFILE_COUNT - 1}`);
  }
  return value;
}

function requireRoll(rng, label) {
  if (!rng || typeof rng.next !== "function") {
    throw aiError("selection requires rng.next(channel)");
  }
  const roll = rng.next(BATTLE_AI_RNG_CHANNEL);
  requireSafeInteger(roll, label);
  if (roll < 0 || roll >= BATTLE_AI_RNG_MODULUS) {
    throw aiError(`${label} must be 0..${BATTLE_AI_RNG_MODULUS - 1}; the helper works modulo 103`);
  }
  return roll;
}

/**
 * reserve = min(trunc(metricBase * percent / 100), metricLimit), the value the
 * ladder compares a candidate's +0x48 against.
 */
export function resolveAiReserve(input) {
  if (!input || typeof input !== "object") {
    throw aiError("resolveAiReserve requires a plain object");
  }
  const profileIndex = requireProfileIndex(input.profileIndex);
  const scalarIndex = requireSafeInteger(input.sessionScalarIndex, "sessionScalarIndex");
  if (scalarIndex < 0 || scalarIndex >= BATTLE_AI_RESERVE_SCALAR_COUNT) {
    throw aiError(`sessionScalarIndex must be 0..${BATTLE_AI_RESERVE_SCALAR_COUNT - 1}`);
  }
  const metricBase = requireSafeInteger(input.metricBase, "metricBase");
  const metricLimit = requireSafeInteger(input.metricLimit, "metricLimit");

  const percent = BATTLE_AI_RESERVE_PERCENT[profileIndex][scalarIndex];
  const scaled = Math.trunc((metricBase * percent) / 100);
  // cmp r0, r6 ; movle r6, r0 -- the limit wins on a tie.
  return scaled >= metricLimit ? metricLimit : scaled;
}

function actionRow(profileIndex, negativeStatusCode) {
  return negativeStatusCode === BATTLE_AI_OVERRIDE_STATUS_CODE
    ? BATTLE_AI_ACTION_THRESHOLDS_OVERRIDE
    : BATTLE_AI_ACTION_THRESHOLDS[profileIndex];
}

function moveRow(profileIndex, negativeStatusCode) {
  return negativeStatusCode === BATTLE_AI_OVERRIDE_STATUS_CODE
    ? BATTLE_AI_MOVE_THRESHOLDS_OVERRIDE
    : BATTLE_AI_MOVE_THRESHOLDS[profileIndex];
}

function readBucket(buckets, state) {
  const list = buckets[state];
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw aiError(`candidateBuckets[${state}] must be an array`);
  return list;
}

function pickCandidate(list, rng, label) {
  // bl 0x0202B558 is signed divide; the remainder comes back in r1.
  const roll = requireRoll(rng, label);
  return { candidate: list[roll % list.length], index: roll % list.length, roll };
}

function candidateCost(candidate, state) {
  if (!candidate || typeof candidate !== "object") {
    throw aiError(`candidateBuckets[${state}] entries must be objects`);
  }
  return requireSafeInteger(candidate.costField48, `candidateBuckets[${state}].costField48`);
}

/**
 * 0x021144CC. Walks a group's action ids in order and returns the first whose
 * cost is strictly below the reserve, or 0 when none does. No RNG, no shuffle:
 * order matters, so the list order is part of the behavior.
 *
 * @param {{ candidateIds: number[], actionCostById: Record<number, number>, reserve: number }} input
 */
export function scanAffordableAction(input) {
  if (!input || typeof input !== "object") {
    throw aiError("scanAffordableAction requires a plain object");
  }
  const reserve = requireSafeInteger(input.reserve, "reserve");
  const ids = input.candidateIds;
  if (!Array.isArray(ids)) throw aiError("candidateIds must be an array");
  const costs = input.actionCostById;
  if (!costs || typeof costs !== "object") {
    throw aiError("actionCostById must be an object keyed by action id");
  }

  for (const id of ids) {
    requireSafeInteger(id, "candidate action id");
    const cost = costs[id];
    if (!Number.isSafeInteger(cost)) {
      throw aiError(`actionCostById[${id}] must be a safe integer`);
    }
    // cmp r3, r2 ; ldmltia -- strictly below, and it returns immediately.
    if (cost < reserve) return id;
  }
  return BATTLE_AI_SCAN_NONE;
}

/**
 * The inlined roster scan at 0x02115BE8. Returns the index of the entry with the
 * greatest metric, or null when none qualifies.
 *
 * Two variants exist and they differ in liveness as well as in metric:
 *   group 1 reads metric44 and skips a null entry or one whose HP is exactly 0
 *   group 3 reads metric54 and skips ONLY a null entry, so a defeated entry can
 *           be chosen
 * Negative HP passes in both. The running best starts at 0 and the compare is
 * `movgt`, so a metric of 0 or less never wins and ties keep the earlier entry.
 *
 * @param {{
 *   roster: Array<{ currentHp: number, metric44?: number, metric54?: number }|null>,
 *   metricField: string,
 *   skipZeroHp: boolean
 * }} input
 */
export function selectMaxMetricTarget(input) {
  if (!input || typeof input !== "object") {
    throw aiError("selectMaxMetricTarget requires a plain object");
  }
  const roster = input.roster;
  if (!Array.isArray(roster)) throw aiError("roster must be an array");
  const metricField = input.metricField === undefined
    ? BATTLE_AI_ROSTER_METRIC_44
    : input.metricField;
  if (metricField !== BATTLE_AI_ROSTER_METRIC_44 && metricField !== BATTLE_AI_ROSTER_METRIC_54) {
    throw aiError("metricField must be metric44 or metric54");
  }
  const skipZeroHp = input.skipZeroHp === undefined ? true : input.skipZeroHp === true;

  let best = 0;
  let bestIndex = null;
  for (let index = 0; index < roster.length; index += 1) {
    const entry = roster[index];
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== "object") throw aiError(`roster[${index}] must be an object or null`);
    if (skipZeroHp) {
      const currentHp = requireSafeInteger(entry.currentHp, `roster[${index}].currentHp`);
      if (currentHp === 0) continue;
    }
    const metric = requireSafeInteger(entry[metricField], `roster[${index}].${metricField}`);
    if (metric > best) {
      best = metric;
      bestIndex = index;
    }
  }
  return bestIndex === null ? null : { index: bestIndex, metric: best };
}

/**
 * Group 5's collection loop at 0x02115DF0. Keeps living entries (HP > 0 here,
 * not != 0) whose +0x160 positive effect code is 0, stopping at three because
 * the original buffers them in a three-word stack slot.
 *
 * @param {{ roster: Array<{ currentHp: number, positiveEffectCode: number }|null> }} input
 */
export function collectUnaffectedTargets(input) {
  if (!input || typeof input !== "object") {
    throw aiError("collectUnaffectedTargets requires a plain object");
  }
  const roster = input.roster;
  if (!Array.isArray(roster)) throw aiError("roster must be an array");

  const collected = [];
  for (let index = 0; index < roster.length; index += 1) {
    const entry = roster[index];
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== "object") throw aiError(`roster[${index}] must be an object or null`);
    const currentHp = requireSafeInteger(entry.currentHp, `roster[${index}].currentHp`);
    if (currentHp <= 0) continue;
    const effect = requireSafeInteger(
      entry.positiveEffectCode,
      `roster[${index}].positiveEffectCode`
    );
    if (effect !== 0) continue;
    if (collected.length >= BATTLE_AI_UNAFFECTED_BUFFER_SIZE) break;
    collected.push(index);
  }
  return collected;
}

/** 0x021300D4 lookup; ids outside the table contribute no effect code. */
export function effectCodeForActionId(actionId) {
  requireSafeInteger(actionId, "actionId");
  const code = BATTLE_AI_EFFECT_BY_ACTION_ID[actionId];
  return code === undefined ? 0 : code;
}

function resolveTargetedCascade(input, reserve, roll) {
  const targeted = input.targeted;
  if (!targeted || typeof targeted !== "object") {
    throw aiError("the targeted path requires a `targeted` input object");
  }
  const groups = targeted.scanGroups;
  if (!groups || typeof groups !== "object") {
    throw aiError("targeted.scanGroups must be an object keyed by group id");
  }
  const costs = targeted.actionCostById;
  const attemptedGroups = [];

  const scan = (group) => scanAffordableAction({
    candidateIds: Array.isArray(groups[group]) ? groups[group] : [],
    actionCostById: costs === undefined ? {} : costs,
    reserve
  });

  const commit = (group, actionId, target) => deepFreeze({
    decision: BATTLE_AI_DECISION_TARGETED,
    state: BATTLE_AI_STATE_TARGETED,
    roll,
    reserve,
    group,
    actionId,
    target,
    attemptedGroups,
    evidence: BATTLE_AI_EVIDENCE
  });

  // Group 2: guarded, and its target is self with no roster scan.
  const guard2 = requireSafeInteger(targeted.group2Guard ?? 0, "targeted.group2Guard");
  if (guard2 > 0) {
    const actionId = scan(2);
    if (actionId !== BATTLE_AI_SCAN_NONE) {
      return commit(2, actionId, { kind: BATTLE_AI_TARGET_SELF });
    }
    attemptedGroups.push({ group: 2, outcome: "NO_AFFORDABLE_ACTION" });
  } else {
    attemptedGroups.push({ group: 2, outcome: "GUARD_CLOSED" });
  }

  const roster = targeted.roster === undefined ? [] : targeted.roster;

  // Group 1: an affordable action plus a metric44 target that is not on 0 HP.
  const actionId1 = scan(1);
  if (actionId1 !== BATTLE_AI_SCAN_NONE) {
    const target = selectMaxMetricTarget({
      roster,
      metricField: BATTLE_AI_ROSTER_METRIC_44,
      skipZeroHp: true
    });
    if (target !== null) {
      return commit(1, actionId1, {
        kind: BATTLE_AI_TARGET_ROSTER_MAX_METRIC,
        metricField: BATTLE_AI_ROSTER_METRIC_44,
        index: target.index,
        metric: target.metric
      });
    }
    attemptedGroups.push({ group: 1, outcome: "NO_TARGET" });
  } else {
    attemptedGroups.push({ group: 1, outcome: "NO_AFFORDABLE_ACTION" });
  }

  // Group 4: guarded by a second roster field, target is self again.
  const actionId4 = scan(4);
  if (actionId4 !== BATTLE_AI_SCAN_NONE) {
    const guard4 = requireSafeInteger(targeted.group4Guard ?? 0, "targeted.group4Guard");
    if (guard4 > 0) {
      return commit(4, actionId4, { kind: BATTLE_AI_TARGET_SELF });
    }
    attemptedGroups.push({ group: 4, outcome: "GUARD_CLOSED" });
  } else {
    attemptedGroups.push({ group: 4, outcome: "NO_AFFORDABLE_ACTION" });
  }

  // Group 3: metric54, and no liveness test at all.
  const actionId3 = scan(3);
  if (actionId3 !== BATTLE_AI_SCAN_NONE) {
    const target = selectMaxMetricTarget({
      roster,
      metricField: BATTLE_AI_ROSTER_METRIC_54,
      skipZeroHp: false
    });
    if (target !== null) {
      return commit(3, actionId3, {
        kind: BATTLE_AI_TARGET_ROSTER_MAX_METRIC,
        metricField: BATTLE_AI_ROSTER_METRIC_54,
        index: target.index,
        metric: target.metric
      });
    }
    attemptedGroups.push({ group: 3, outcome: "NO_TARGET" });
  } else {
    attemptedGroups.push({ group: 3, outcome: "NO_AFFORDABLE_ACTION" });
  }

  // Group 6: self, unless the combatant already carries the effect it would apply.
  const actionId6 = scan(6);
  if (actionId6 !== BATTLE_AI_SCAN_NONE) {
    const held = requireSafeInteger(
      targeted.positiveEffectCode ?? 0,
      "targeted.positiveEffectCode"
    );
    if (held !== effectCodeForActionId(actionId6)) {
      return commit(6, actionId6, { kind: BATTLE_AI_TARGET_SELF });
    }
    attemptedGroups.push({ group: 6, outcome: "EFFECT_ALREADY_HELD" });
  } else {
    attemptedGroups.push({ group: 6, outcome: "NO_AFFORDABLE_ACTION" });
  }

  // Group 5: uniform pick among up to three living, unaffected roster entries.
  const actionId5 = scan(5);
  if (actionId5 !== BATTLE_AI_SCAN_NONE) {
    const collected = collectUnaffectedTargets({ roster });
    if (collected.length > 0) {
      const pickRoll = requireRoll(input.rng, "group 5 target pick");
      const index = collected[pickRoll % collected.length];
      return commit(5, actionId5, {
        kind: BATTLE_AI_TARGET_ROSTER_RANDOM_UNAFFECTED,
        index,
        collected,
        roll: pickRoll
      });
    }
    attemptedGroups.push({ group: 5, outcome: "NO_TARGET" });
  } else {
    attemptedGroups.push({ group: 5, outcome: "NO_AFFORDABLE_ACTION" });
  }

  // 0x02115DD4 / 0x02115E44 both fall to the move ladder.
  return deepFreeze({
    ...resolveAiMove({
      profileIndex: input.profileIndex,
      negativeStatusCode: input.negativeStatusCode,
      rng: input.rng
    }),
    targetedAttempts: attemptedGroups
  });
}

/**
 * The movement ladder at 0x02115E8C. Rolls its own channel-216 value.
 */
export function resolveAiMove(input) {
  const profileIndex = requireProfileIndex(input.profileIndex);
  const negativeStatusCode = requireSafeInteger(input.negativeStatusCode, "negativeStatusCode");
  const row = moveRow(profileIndex, negativeStatusCode);
  const roll = requireRoll(input.rng, "move roll");

  let tier = 2;
  if (roll < row[0]) tier = 0;
  else if (roll < row[1]) tier = 1;

  return deepFreeze({
    decision: BATTLE_AI_DECISION_MOVE,
    state: BATTLE_AI_STATE_MOVE,
    roll,
    tier,
    primaryQ12: BATTLE_AI_MOVE_PRIMARY_Q12[tier],
    secondaryQ12: BATTLE_AI_MOVE_SECONDARY_Q12,
    primary: BATTLE_AI_MOVE_PRIMARY_Q12[tier] / BATTLE_AI_Q12_SCALE,
    secondary: BATTLE_AI_MOVE_SECONDARY_Q12 / BATTLE_AI_Q12_SCALE,
    evidence: BATTLE_AI_EVIDENCE
  });
}

/**
 * The whole decision at 0x021159D4.
 *
 * @param {{
 *   profileIndex: number,
 *   sessionScalarIndex: number,
 *   negativeStatusCode: number,
 *   pendingField24: number,
 *   metricBase: number,
 *   metricLimit: number,
 *   candidateBuckets: Record<number, Array<{ costField48: number }>>,
 *   rng: { next: (channel: number) => number }
 * }} input
 */
export function selectBattleAiAction(input) {
  if (!input || typeof input !== "object") {
    throw aiError("selectBattleAiAction requires a plain object");
  }
  const profileIndex = requireProfileIndex(input.profileIndex);
  const negativeStatusCode = requireSafeInteger(input.negativeStatusCode, "negativeStatusCode");
  const pendingField24 = requireSafeInteger(input.pendingField24, "pendingField24");
  const buckets = input.candidateBuckets;
  if (!buckets || typeof buckets !== "object") {
    throw aiError("candidateBuckets must be an object keyed by state code");
  }

  // ldr r0,[r7,#36] ; cmp r0,#0 ; bgt 0x02115E8C -- straight to the move ladder.
  if (pendingField24 > 0) {
    return resolveAiMove({ profileIndex, negativeStatusCode, rng: input.rng });
  }

  const reserve = resolveAiReserve(input);
  const row = actionRow(profileIndex, negativeStatusCode);
  const roll = requireRoll(input.rng, "action roll");

  const attempted = [];

  const tryBucket = (state, applyCostGate) => {
    const list = readBucket(buckets, state);
    if (list.length === 0) {
      attempted.push({ state, outcome: "EMPTY" });
      return null;
    }
    const picked = pickCandidate(list, input.rng, `bucket ${state} pick`);
    if (!applyCostGate) {
      attempted.push({ state, outcome: "TAKEN", index: picked.index });
      return picked;
    }
    const cost = candidateCost(picked.candidate, state);
    if (cost >= reserve) {
      // The original still leaves the candidate in +0x174 before falling through.
      attempted.push({ state, outcome: "COST_ABOVE_RESERVE", index: picked.index, cost });
      return null;
    }
    attempted.push({ state, outcome: "TAKEN", index: picked.index, cost });
    return picked;
  };

  const commit = (state, picked) => deepFreeze({
    decision: BATTLE_AI_DECISION_ACTION,
    state,
    roll,
    reserve,
    action: picked.candidate,
    bucketIndex: picked.index,
    attempted,
    evidence: BATTLE_AI_EVIDENCE
  });

  if (roll >= row[2]) {
    // 0x02115B64: the targeted path, and only inside [T2, T3).
    if (roll >= row[3]) {
      return resolveAiMove({ profileIndex, negativeStatusCode, rng: input.rng });
    }
    return resolveTargetedCascade(input, reserve, roll);
  }

  if (roll < row[0]) {
    const picked = tryBucket(BATTLE_AI_STATE_BUCKET_5, true);
    if (picked) return commit(BATTLE_AI_STATE_BUCKET_5, picked);
  }

  if (roll < row[1]) {
    const picked = tryBucket(BATTLE_AI_STATE_BUCKET_6, true);
    if (picked) return commit(BATTLE_AI_STATE_BUCKET_6, picked);
  }

  // 0x02115B1C: below T2 only, and this bucket carries no cost gate.
  if (roll < row[2]) {
    const picked = tryBucket(BATTLE_AI_STATE_BUCKET_4, false);
    if (picked) return commit(BATTLE_AI_STATE_BUCKET_4, picked);
  }

  return resolveAiMove({ profileIndex, negativeStatusCode, rng: input.rng });
}
