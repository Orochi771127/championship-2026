// Move buckets — the three lists the AI actually picks an action from.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// battleActionSelection reads three buckets and battleCandidateBuckets builds
// nine groups, and for a while this lane fed the nine into the three. They are
// different structures at different offsets, built by different routines, and
// only these three are what the ladder picks from. The nine groups belong to the
// targeted cascade, which battleSession was already passing correctly.
//
// WHERE THEY ARE BUILT  (OVL19 0x02113E5C, inside the creature loader)
// --------------------------------------------------------------------
//   02113E50  strb r3, [r0, #0xe4]     all three counts cleared
//   02113E54  strb r3, [r0, #0xe5]
//   02113E58  strb r3, [r0, #0xe6]
//   02113E5C  ldrb r2, [r0, #0x9c]     how many moves the species scan found
//   02113E6C  ldr  r5, [r2, #0xa0]     move i
//   02113E70  ldr  r4, [r5, #0x50]     its kind
//   02113E78  beq  #0x2113e88          kind 0
//   02113E80  beq  #0x2113eb0          kind 1
//   02113E84  b    #0x2113f18          anything else is skipped
//
//   kind 0                 -> array +0xC0, count +0xE4   (0x02113E9C)
//   kind 1 with +0x0C == 1 -> array +0xCC, count +0xE5   (0x02113ED0)
//   kind 1 with +0x0C == 2 -> array +0xD8, count +0xE6   (0x02113F08)
//
//   02113E8C  cmp r4, #3
//   02113E90  bhs #0x2113f18           three each, and the fourth is dropped
//
// WHICH BUCKET IS WHICH STATE
// ---------------------------
// The ladder reads the counts back, and the order it reads them in is what pins
// the mapping: 0x02115A80 reads +0xE5 on the first rung, 0x02115AD4 reads +0xE6
// on the second and 0x02115B28 reads +0xE4 on the third. Those rungs are states
// 5, 6 and 4, so bucket 4 is the kind-0 list, bucket 5 is kind 1 sub 1 and
// bucket 6 is kind 1 sub 2.
//
// WHY THIS IS THE MAIN PATH AND NOT A DETAIL
// ------------------------------------------
// battleDamageInputs traces the resolver's switch: kinds 0 and 1 are the ones
// that reach the curve-and-power term, and they are 566 of the 596 records with
// every real power from 30 to 600. Those are exactly the kinds bucketed here.
// The two kinds that are NOT bucketed, 2 and 3, are the contact walk's, and
// their powers are only 0 or 15. So the ladder's three buckets are where an
// ordinary attack comes from.
//
// Bucket 4 carries no cost gate (0x02115B44 picks and commits with no `ldrh
// [action,#0x48]` compare, unlike the other two), which is why a species whose
// kind-0 move costs nothing can act at clock tier 0 when the reserve is still 0.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What +0x0C means beyond selecting between the two kind-1 buckets. Where the
// move list at +0xA0 gets its extra entries from beyond the species scan and the
// +0x12C walk the loader also does. And the order within a bucket is the scan
// order, which the ladder's pick treats as significant.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { listMoveRecordsForSpecies } from "./battleCatalogs.js";

export const BATTLE_MOVE_BUCKET_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_MOVE_BUCKET_SITE = "OVL19:0x02113E5C";

/** `cmp r4, #3 / bhs` — three per bucket, and the fourth is dropped. */
export const BATTLE_MOVE_BUCKET_CAP = 3;

/** On the combatant: the move list the species scan fills, and its count. */
export const BATTLE_MOVE_LIST_OFFSET = 0xa0;
export const BATTLE_MOVE_LIST_COUNT_OFFSET = 0x9c;

/**
 * The three buckets, keyed by the AI ladder state that reads each one. `kind` is
 * the move record's +0x50 and `subKind` its +0x0C where the kind needs one.
 */
export const BATTLE_MOVE_BUCKETS = deepFreeze([
  { state: 4, kind: 0, subKind: null, arrayOffset: 0xc0, countOffset: 0xe4, costGate: false, site: "OVL19:0x02113E9C" },
  { state: 5, kind: 1, subKind: 1, arrayOffset: 0xcc, countOffset: 0xe5, costGate: true, site: "OVL19:0x02113ED0" },
  { state: 6, kind: 1, subKind: 2, arrayOffset: 0xd8, countOffset: 0xe6, costGate: true, site: "OVL19:0x02113F08" }
]);

/** Kinds the classifier drops. They are the contact walk's, not the ladder's. */
export const BATTLE_MOVE_BUCKET_SKIPPED_KINDS = deepFreeze([2, 3]);

function bucketError(message) {
  return new Error(`BATTLE_MOVE_BUCKET_${message}`);
}

/** Which ladder state a move record belongs to, or null when it is skipped. */
export function classifyMoveBucket(record) {
  if (!record || typeof record !== "object") {
    throw bucketError("RECORD_REQUIRED");
  }
  const kind = record.kind;
  if (!Number.isSafeInteger(kind)) {
    throw bucketError("KIND_MUST_BE_AN_INTEGER");
  }
  // `cmp r4,#0 / beq` then `cmp r4,#1 / beq`, and everything else falls out.
  if (kind === 0) return 4;
  if (kind !== 1) return null;
  // 0x02113EB4 and 0x02113EEC test +0x0C against 1 and then 2; a kind-1 move
  // whose +0x0C is neither is dropped like kinds 2 and 3.
  if (record.field0C === 1) return 5;
  if (record.field0C === 2) return 6;
  return null;
}

/**
 * OVL19 0x02113E5C over a move list. Returns the three buckets keyed by ladder
 * state, in the shape battleActionSelection reads: each entry carries the action
 * id it picks and the +0x48 cost its gate compares.
 */
export function buildMoveBuckets(records) {
  if (!Array.isArray(records)) {
    throw bucketError("RECORDS_MUST_BE_AN_ARRAY");
  }
  const buckets = { 4: [], 5: [], 6: [] };
  const dropped = [];
  for (const record of records) {
    const state = classifyMoveBucket(record);
    if (state === null) {
      dropped.push({ recordIndex: record.recordIndex, kind: record.kind });
      continue;
    }
    // The count is compared BEFORE the store, so the fourth is dropped rather
    // than overwriting the third.
    if (buckets[state].length >= BATTLE_MOVE_BUCKET_CAP) {
      dropped.push({ recordIndex: record.recordIndex, kind: record.kind, reason: "BUCKET_FULL" });
      continue;
    }
    buckets[state].push(deepFreeze({
      actionId: record.recordIndex,
      costField48: record.actionCost ?? 0,
      kind: record.kind,
      power: record.power ?? 0
    }));
  }
  return deepFreeze({
    buckets: deepFreeze({
      4: deepFreeze(buckets[4]),
      5: deepFreeze(buckets[5]),
      6: deepFreeze(buckets[6])
    }),
    dropped: deepFreeze(dropped)
  });
}

/**
 * The whole loader path for one species: the scan at 0x02113DBC, capped at the
 * eight slots the list holds, then the classification.
 */
export function buildMoveBucketsForSpecies(speciesId) {
  return buildMoveBuckets(listMoveRecordsForSpecies(speciesId));
}
