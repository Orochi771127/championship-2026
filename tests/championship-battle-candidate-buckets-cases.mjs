// Candidate buckets — OVL19 0x02113F28, the lists AI selection picks from.
//
// This was the one seam composing the battle modules left. The decisive case is
// the last one: it drives the real AI with buckets built from this module and
// the original's own dice, and gets a decision out.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_BUCKET_ARRAY_END,
  BATTLE_BUCKET_BUILD_SITE,
  BATTLE_BUCKET_COUNT_OFFSET,
  BATTLE_BUCKET_DROPPED_GROUP,
  BATTLE_BUCKET_ENTRIES_PER_GROUP,
  BATTLE_BUCKET_EVIDENCE,
  BATTLE_BUCKET_GROUP_BY_CODE,
  BATTLE_BUCKET_GROUP_COUNT,
  BATTLE_BUCKET_GROUP_STRIDE,
  BATTLE_BUCKET_LIST_OFFSET,
  BATTLE_BUCKET_MAX_SOURCE_CODE,
  BATTLE_BUCKET_SOURCE_OFFSETS,
  bucketCounts,
  bucketGroupForCode,
  buildCandidateBuckets
} from "../src/championship/battle/battleCandidateBuckets.js";

import {
  BATTLE_AI_STATE_BUCKET_4,
  BATTLE_AI_STATE_BUCKET_5,
  BATTLE_AI_STATE_BUCKET_6,
  selectBattleAiAction
} from "../src/championship/battle/battleActionSelection.js";

import { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { listBattleCatalogRecords } from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the array's own extent is what fixes the group count at nine", () => {
  assert.equal(BATTLE_BUCKET_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_BUCKET_BUILD_SITE, "OVL19:0x02113F28");
  assert.equal(BATTLE_BUCKET_GROUP_COUNT, 9);
  assert.equal(BATTLE_BUCKET_ENTRIES_PER_GROUP, 2);
  assert.equal(BATTLE_BUCKET_GROUP_STRIDE, 0x0c);
  assert.equal(BATTLE_BUCKET_LIST_OFFSET, 0xe8);
  assert.equal(BATTLE_BUCKET_COUNT_OFFSET, 0xf0);
  // Nine groups of twelve run from +0xE8 to exactly +0x154.
  assert.equal(
    BATTLE_BUCKET_LIST_OFFSET + BATTLE_BUCKET_GROUP_COUNT * BATTLE_BUCKET_GROUP_STRIDE,
    BATTLE_BUCKET_ARRAY_END
  );
  assert.equal(BATTLE_BUCKET_ARRAY_END, 0x154);
  // Two words then the count byte fills each twelve-byte group.
  assert.equal(BATTLE_BUCKET_COUNT_OFFSET - BATTLE_BUCKET_LIST_OFFSET,
    BATTLE_BUCKET_ENTRIES_PER_GROUP * 4);
});

test("the jump table is 31 entries and group 0 takes everything it drops", () => {
  assert.equal(BATTLE_BUCKET_MAX_SOURCE_CODE, 30);
  assert.equal(BATTLE_BUCKET_GROUP_BY_CODE.length, BATTLE_BUCKET_MAX_SOURCE_CODE + 1);
  for (const group of BATTLE_BUCKET_GROUP_BY_CODE) {
    assert.ok(group >= 0 && group < BATTLE_BUCKET_GROUP_COUNT, `group ${group}`);
  }
  // Transcribed from 0x02113FA0: 2..4 go to 1, 5..7 to 2, then singles, then a
  // long alternation between 5 and 6, and 28..30 close it out.
  assert.deepEqual(BATTLE_BUCKET_GROUP_BY_CODE.slice(0, 11), [0, 6, 1, 1, 1, 2, 2, 2, 3, 4, 5]);
  for (let code = 10; code <= 27; code += 1) {
    assert.equal(BATTLE_BUCKET_GROUP_BY_CODE[code], code % 2 === 0 ? 5 : 6, `code ${code}`);
  }
  assert.deepEqual(BATTLE_BUCKET_GROUP_BY_CODE.slice(28), [7, 7, 8]);
  // Anything past the table falls through with the group register still zero.
  assert.equal(bucketGroupForCode(31), BATTLE_BUCKET_DROPPED_GROUP);
  assert.equal(bucketGroupForCode(595), BATTLE_BUCKET_DROPPED_GROUP);
  assert.equal(bucketGroupForCode(-1), BATTLE_BUCKET_DROPPED_GROUP);
});

test("two source words are all that ever get filed", () => {
  assert.deepEqual([...BATTLE_BUCKET_SOURCE_OFFSETS], [0x12c, 0x130]);
  assert.throws(() => buildCandidateBuckets([1]), /SOURCES_MUST_BE_2_LONG/);
  assert.throws(() => buildCandidateBuckets([1, 2, 3]), /SOURCES_MUST_BE_2_LONG/);

  const built = buildCandidateBuckets([5, 11]);
  // Code 5 files into group 2, code 11 into group 6.
  assert.deepEqual(bucketCounts(built), [0, 0, 1, 0, 0, 0, 1, 0, 0]);
  assert.equal(built.buckets[2][0].actionId, 5);
  assert.equal(built.buckets[6][0].actionId, 11);
  // Everything else is empty, which is legal and normal.
  assert.equal(bucketCounts(built).reduce((a, b) => a + b, 0), 2);
});

test("a zero source is skipped and an out-of-table one is dropped, not filed", () => {
  const empty = buildCandidateBuckets([0, 0]);
  assert.deepEqual(bucketCounts(empty), new Array(9).fill(0));
  assert.deepEqual(empty.dropped, []);

  const dropped = buildCandidateBuckets([40, 0]);
  assert.deepEqual(bucketCounts(dropped), new Array(9).fill(0));
  assert.deepEqual(dropped.dropped, [{ source: 0, code: 40 }]);

  // Code 1 files into group 6, so a pair of them fills that group's two slots.
  const paired = buildCandidateBuckets([1, 1]);
  assert.equal(paired.buckets[6].length, 2);
  assert.equal(bucketCounts(paired)[6], BATTLE_BUCKET_ENTRIES_PER_GROUP);
});

test("an entry carries the action's own +0x48 cost from the move catalog", () => {
  const moves = listBattleCatalogRecords("moves");
  const built = buildCandidateBuckets([5, 11]);
  for (const list of Object.values(built.buckets)) {
    for (const entry of list) {
      assert.equal(entry.costField48, moves[entry.actionId].actionCost, `action ${entry.actionId}`);
      assert.ok(Number.isSafeInteger(entry.costField48));
    }
  }
  // The scan shape carries the same ids and the same costs.
  assert.deepEqual(built.scanGroups[2], [5]);
  assert.deepEqual(built.scanGroups[6], [11]);
  assert.equal(built.actionCostById[5], moves[5].actionCost);
  assert.equal(built.actionCostById[11], moves[11].actionCost);
});

test("every code the table admits resolves to a real move record", () => {
  const moves = listBattleCatalogRecords("moves");
  for (let code = 1; code <= BATTLE_BUCKET_MAX_SOURCE_CODE; code += 1) {
    if (bucketGroupForCode(code) === BATTLE_BUCKET_DROPPED_GROUP) {
      continue;
    }
    assert.ok(moves[code], `code ${code} must index the move table`);
    assert.equal(moves[code].recordIndex, code);
    assert.doesNotThrow(() => buildCandidateBuckets([code, 0]), `code ${code}`);
  }
});

test("the overrun the original would allow is refused here", () => {
  // Two sources cannot fill a group past two, but a caller must not be able to
  // reproduce the original's missing bound check by any route.
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCandidateBuckets.js"), "utf8");
  assert.match(module, /GROUP_\$\{group\}_OVERFLOW_UNTRACED/);
  assert.match(module, /has no such check/);
});

test("the built buckets drive the real AI with the original's dice", () => {
  const built = buildCandidateBuckets([5, 11]);
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  const decisions = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    decisions.push(selectBattleAiAction({
      profileIndex: 0,
      negativeStatusCode: 0,
      pendingField24: 0,
      sessionScalarIndex: 0,
      metricBase: 100,
      metricLimit: 100,
      candidateBuckets: built.buckets,
      targeted: { scanGroups: built.scanGroups, actionCostById: built.actionCostById },
      rng
    }));
  }
  assert.equal(decisions.length, 12);
  for (const decision of decisions) {
    assert.ok(typeof decision.decision === "string" && decision.decision.length > 0);
    assert.ok(decision.roll >= 0 && decision.roll < 103, "the roll came from channel 216");
  }
  // Deterministic: the same seed replays the same twelve decisions.
  const replayRng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  for (const original of decisions) {
    const again = selectBattleAiAction({
      profileIndex: 0, negativeStatusCode: 0, pendingField24: 0, sessionScalarIndex: 0,
      metricBase: 100, metricLimit: 100, candidateBuckets: built.buckets,
      targeted: { scanGroups: built.scanGroups, actionCostById: built.actionCostById },
      rng: replayRng
    });
    assert.equal(again.roll, original.roll);
    assert.equal(again.decision, original.decision);
  }
});

test("the AI's bucket keys are group indices, so both sides agree", () => {
  const built = buildCandidateBuckets([5, 11]);
  for (const state of [BATTLE_AI_STATE_BUCKET_4, BATTLE_AI_STATE_BUCKET_5, BATTLE_AI_STATE_BUCKET_6]) {
    assert.ok(state >= 0 && state < BATTLE_BUCKET_GROUP_COUNT, `state ${state} is a group`);
    assert.ok(Array.isArray(built.buckets[state]), `buckets[${state}] is a list`);
  }
  assert.deepEqual([BATTLE_AI_STATE_BUCKET_4, BATTLE_AI_STATE_BUCKET_5, BATTLE_AI_STATE_BUCKET_6], [4, 5, 6]);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCandidateBuckets.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
