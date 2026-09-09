// Move buckets — the three lists the AI ladder actually picks from.
//
// Two structures were being confused. These cases pin them apart, and pin the
// consequence: the kinds that get bucketed are the kinds that reach the damage
// term, so the ladder is where an ordinary attack comes from.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_MOVE_BUCKETS,
  BATTLE_MOVE_BUCKET_CAP,
  BATTLE_MOVE_BUCKET_EVIDENCE,
  BATTLE_MOVE_BUCKET_SITE,
  BATTLE_MOVE_BUCKET_SKIPPED_KINDS,
  BATTLE_MOVE_LIST_COUNT_OFFSET,
  BATTLE_MOVE_LIST_OFFSET,
  buildMoveBuckets,
  buildMoveBucketsForSpecies,
  classifyMoveBucket
} from "../src/championship/battle/battleMoveBuckets.js";

import {
  BATTLE_AI_RESERVE_PERCENT,
  BATTLE_AI_STATE_BUCKET_4,
  BATTLE_AI_STATE_BUCKET_5,
  BATTLE_AI_STATE_BUCKET_6
} from "../src/championship/battle/battleActionSelection.js";

import { damageRouteForKind } from "../src/championship/battle/battleDamageInputs.js";
import { BATTLE_OUTCOME_TIER_FRAMES, BATTLE_OUTCOME_TIER_MAX } from "../src/championship/battle/battleOutcome.js";
import { BATTLE_MOVES_PER_COMBATANT_CAP } from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moves = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-moves.r1.json"), "utf8")).records;
const presets = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-presets.r1.json"), "utf8")).records;

test("the three buckets are the ladder's three states, at the offsets the loader writes", () => {
  assert.equal(BATTLE_MOVE_BUCKET_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_MOVE_BUCKET_SITE, "OVL19:0x02113E5C");
  assert.deepEqual(BATTLE_MOVE_BUCKETS.map((entry) => entry.state),
    [BATTLE_AI_STATE_BUCKET_4, BATTLE_AI_STATE_BUCKET_5, BATTLE_AI_STATE_BUCKET_6]);
  assert.deepEqual(BATTLE_MOVE_BUCKETS.map((entry) => entry.arrayOffset), [0xc0, 0xcc, 0xd8]);
  assert.deepEqual(BATTLE_MOVE_BUCKETS.map((entry) => entry.countOffset), [0xe4, 0xe5, 0xe6]);
  // The three arrays are three words apart, which is what makes them one block.
  assert.equal(BATTLE_MOVE_BUCKETS[1].arrayOffset - BATTLE_MOVE_BUCKETS[0].arrayOffset, BATTLE_MOVE_BUCKET_CAP * 4);
  assert.equal(BATTLE_MOVE_BUCKETS[2].arrayOffset - BATTLE_MOVE_BUCKETS[1].arrayOffset, BATTLE_MOVE_BUCKET_CAP * 4);
  assert.equal(BATTLE_MOVE_LIST_OFFSET, 0xa0);
  assert.equal(BATTLE_MOVE_LIST_COUNT_OFFSET, 0x9c);
  // Only bucket 4 commits without a cost compare.
  assert.deepEqual(BATTLE_MOVE_BUCKETS.map((entry) => entry.costGate), [false, true, true]);
});

test("the bucketed kinds are exactly the kinds that reach the damage term", () => {
  const bucketedKinds = new Set(BATTLE_MOVE_BUCKETS.map((entry) => entry.kind));
  assert.deepEqual([...bucketedKinds].sort(), [0, 1]);
  for (const kind of bucketedKinds) {
    assert.equal(damageRouteForKind(kind).route, "DAMAGE", `kind ${kind}`);
  }
  // And the skipped kinds are the contact walk's, which route elsewhere.
  assert.deepEqual([...BATTLE_MOVE_BUCKET_SKIPPED_KINDS], [2, 3]);
  for (const kind of BATTLE_MOVE_BUCKET_SKIPPED_KINDS) {
    assert.notEqual(damageRouteForKind(kind).route, "DAMAGE");
    assert.equal(classifyMoveBucket({ kind }), null);
  }
});

test("kind 1 splits on +0x0C, and anything else is dropped", () => {
  assert.equal(classifyMoveBucket({ kind: 0 }), 4);
  assert.equal(classifyMoveBucket({ kind: 0, field0C: 99 }), 4, "kind 0 does not consult it");
  assert.equal(classifyMoveBucket({ kind: 1, field0C: 1 }), 5);
  assert.equal(classifyMoveBucket({ kind: 1, field0C: 2 }), 6);
  assert.equal(classifyMoveBucket({ kind: 1, field0C: 0 }), null, "neither 1 nor 2 is dropped");
  assert.equal(classifyMoveBucket({ kind: 1 }), null);
  assert.throws(() => classifyMoveBucket(null), /RECORD_REQUIRED/);
  assert.throws(() => classifyMoveBucket({ kind: "0" }), /KIND_MUST_BE_AN_INTEGER/);
});

test("each bucket takes three and drops the fourth rather than overwriting", () => {
  const four = [0, 1, 2, 3].map((index) => ({ recordIndex: index, kind: 0, actionCost: index, power: 10 }));
  const built = buildMoveBuckets(four);
  assert.equal(built.buckets[4].length, BATTLE_MOVE_BUCKET_CAP);
  assert.deepEqual(built.buckets[4].map((entry) => entry.actionId), [0, 1, 2], "the first three, in scan order");
  assert.deepEqual(built.dropped.map((entry) => entry.reason), ["BUCKET_FULL"]);
  assert.throws(() => buildMoveBuckets(null), /RECORDS_MUST_BE_AN_ARRAY/);
});

test("a real species produces real attacks, and the free one is in the ungated bucket", () => {
  const speciesId = presets[0].field00 & 0xff;
  const built = buildMoveBucketsForSpecies(speciesId);
  const all = [...built.buckets[4], ...built.buckets[5], ...built.buckets[6]];
  assert.ok(all.length > 0, "the species has bucketed moves");
  for (const entry of all) {
    assert.equal(damageRouteForKind(entry.kind).route, "DAMAGE");
  }
  // Bucket 4 has no cost gate, so whatever sits there can be taken at tier 0
  // when the reserve is still zero. That is why a match is not silent at the
  // start even though two of the three profiles reserve nothing.
  for (const entry of built.buckets[4]) {
    assert.ok(entry.power > 0, "and it is a move with power, not a placeholder");
  }
  assert.ok(all.length <= 3 * BATTLE_MOVE_BUCKET_CAP);
});

test("every species in the table buckets within the list cap", () => {
  const speciesIds = [...new Set(moves.map((record) => record.speciesId))];
  assert.ok(speciesIds.length > 100);
  for (const speciesId of speciesIds) {
    const built = buildMoveBucketsForSpecies(speciesId);
    const total = built.buckets[4].length + built.buckets[5].length + built.buckets[6].length;
    assert.ok(total <= 3 * BATTLE_MOVE_BUCKET_CAP, `species ${speciesId} holds ${total}`);
    for (const state of [4, 5, 6]) {
      assert.ok(built.buckets[state].length <= BATTLE_MOVE_BUCKET_CAP, `species ${speciesId} bucket ${state}`);
    }
  }
  assert.equal(BATTLE_MOVES_PER_COMBATANT_CAP, 8);
});

test("the reserve scalar is the clock tier, not a per-combatant field", () => {
  // 0x021159F0 reads it off the battle context at +0xE9C, which is the tier
  // battleOutcome advances every 900 frames. Two of the three profiles reserve
  // nothing at tier 0, so a match opens passive and grows willing.
  assert.equal(BATTLE_AI_RESERVE_PERCENT[0].length, BATTLE_OUTCOME_TIER_MAX + 1);
  assert.equal(BATTLE_AI_RESERVE_PERCENT[0][0], 0);
  assert.equal(BATTLE_AI_RESERVE_PERCENT[1][0], 0);
  assert.equal(BATTLE_AI_RESERVE_PERCENT[0][BATTLE_OUTCOME_TIER_MAX], 100);
  for (const row of BATTLE_AI_RESERVE_PERCENT) {
    for (let tier = 1; tier < row.length; tier += 1) {
      assert.ok(row[tier] > row[tier - 1], "every profile ramps upward");
    }
  }
  assert.equal(BATTLE_OUTCOME_TIER_FRAMES, 900);

  const session = fs.readFileSync(path.join(root, "src/championship/battle/battleSession.js"), "utf8");
  assert.match(session, /sessionScalarIndex: session\.tier/);
  assert.match(session, /reads this off the BATTLE, not the combatant/);
});

test("the session feeds the ladder its own buckets and the cascade the nine groups", () => {
  const session = fs.readFileSync(path.join(root, "src/championship/battle/battleSession.js"), "utf8");
  assert.match(session, /candidateBuckets: ladder\.buckets/);
  assert.match(session, /scanGroups: built\.scanGroups/);
  assert.match(session, /Two different structures, and they were being confused/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMoveBuckets.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
