// Candidate buckets — OVL19 0x02113F28, the lists AI selection picks from.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// Composing the battle modules left exactly one seam: AI action selection reads
// candidate lists at combatant +0xE8 and a count at +0xF0, and nothing had
// traced who fills them. This is who.
//
// THE ARRAY
// ---------
//   02113F38  add   r2, r6, r5, lsl #2
//   02113F44  str   sb, [r2, #0xe8]      two word entries per group
//   02113F48  cmp   r5, #2
//   02113F54  strb  sb, [r6, #0xf0]      a byte count per group
//   02113F58  cmp   r4, #9               nine groups
//   02113F5C  add   r6, r6, #0xc         twelve bytes apiece
//
// Nine groups of twelve bytes is 108, and 0xE8 + 108 is 0x154 — precisely where
// the next field starts, the one two of the script natives compare-and-set. The
// array's own extent is what fixes the group count at nine.
//
// THE FILL
// --------
//   02113F80  add   r3, r1, sb, lsl #2
//   02113F84  ldr   sl, [r3, #0x12c]     two source words, +0x12C and +0x130
//   02113F88  cmp   sl, #0 / beq         a zero is skipped
//   02113F90  cmp   sl, #0x1e
//   02113F98  addls pc, pc, sl, lsl #2   a 31-entry jump table, 0..30
//   02114058  cmp   r3, #0 / beq         group 0 is never filed
//   02114060  mla   lr, r3, r2, r0       combatant + group*12
//   02114064  ldrb  ip, [lr, #0xf0]      append at the count
//   0211406C  strb  r3, [lr, #0xf0]
//   02114074  str   sl, [r3, #0xe8]      the value stored is the value read
//   0211407C  cmp   sb, #2
//
// So at most two entries are ever filed across the whole array, both taken from
// the same pair of fields, and a source above 30 falls to group 0 and is
// dropped. Most buckets are therefore empty in most frames, which is a legal
// and common state: the AI's `tryBucket` treats an empty list as EMPTY and
// falls through to the move ladder.
//
// WHAT THE ENTRIES ARE
// --------------------
// The stored value is used as a move-table index by the affordability scan at
// 0x02114500, `mla r3, r0, #0x68, base`, and the same +0x12C field is used that
// way at 0x02111344. So an entry is an action id, and its cost is the move
// record's +0x48 — which is what this module resolves through the B1 catalog so
// the lists arrive in the shape battleActionSelection already reads.
//
// The bucket group index and the AI's state code are the same number: the scan
// takes the group in r1 and does `mla r4, r1, #0xc, r0`, and the selection
// passes state codes 4, 5 and 6 straight into it.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What the two source fields mean, or what fills THEM. What any group number
// stands for. The jump table is transcribed, not interpreted.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { listBattleCatalogRecords } from "./battleCatalogs.js";

export const BATTLE_BUCKET_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_BUCKET_BUILD_SITE = "OVL19:0x02113F28";

/** cmp r4,#9 at 0x02113F58. */
export const BATTLE_BUCKET_GROUP_COUNT = 9;
/** cmp r5,#2 at 0x02113F48. */
export const BATTLE_BUCKET_ENTRIES_PER_GROUP = 2;
/** add r6,r6,#0xc at 0x02113F5C. */
export const BATTLE_BUCKET_GROUP_STRIDE = 0x0c;

export const BATTLE_BUCKET_LIST_OFFSET = 0xe8;
export const BATTLE_BUCKET_COUNT_OFFSET = 0xf0;
/** 0xE8 + 9*12, where the array stops and the next field begins. */
export const BATTLE_BUCKET_ARRAY_END = 0x154;

/** cmp sb,#2 at 0x0211407C: two source words, at these offsets. */
export const BATTLE_BUCKET_SOURCE_OFFSETS = deepFreeze([0x12c, 0x130]);

/** cmp sl,#0x1e at 0x02113F90. */
export const BATTLE_BUCKET_MAX_SOURCE_CODE = 30;

/** Group 0 is filed by nothing: `cmp r3,#0 / beq` at 0x02114058. */
export const BATTLE_BUCKET_DROPPED_GROUP = 0;

/**
 * The jump table at 0x02113FA0, one entry per source code 0..30, giving the
 * group each code is filed into. Transcribed, not interpreted.
 */
export const BATTLE_BUCKET_GROUP_BY_CODE = deepFreeze([
  0, 6, 1, 1, 1, 2, 2, 2, 3, 4,
  5, 6, 5, 6, 5, 6, 5, 6, 5, 6,
  5, 6, 5, 6, 5, 6, 5, 6, 7, 7,
  8
]);

function bucketError(message) {
  return new Error(`BATTLE_BUCKET_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw bucketError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** Which group a source code files into; anything past the table is group 0. */
export function bucketGroupForCode(code) {
  requireInteger(code, "CODE");
  if (code < 0 || code > BATTLE_BUCKET_MAX_SOURCE_CODE) {
    // `addls` does not take, so execution falls through with r3 still zero.
    return BATTLE_BUCKET_DROPPED_GROUP;
  }
  return BATTLE_BUCKET_GROUP_BY_CODE[code];
}

/**
 * OVL19 0x02113F28. `sourceCodes` are the two words at stats +0x12C and +0x130.
 * Returns the nine groups keyed by index — the same numbers the AI passes as
 * state codes — with each entry carrying the action id and the +0x48 cost the
 * affordability scan compares.
 */
export function buildCandidateBuckets(sourceCodes) {
  if (!Array.isArray(sourceCodes) || sourceCodes.length !== BATTLE_BUCKET_SOURCE_OFFSETS.length) {
    throw bucketError(`SOURCES_MUST_BE_${BATTLE_BUCKET_SOURCE_OFFSETS.length}_LONG`);
  }
  const moves = listBattleCatalogRecords("moves");
  const groups = [];
  for (let group = 0; group < BATTLE_BUCKET_GROUP_COUNT; group += 1) {
    groups.push([]);
  }

  const dropped = [];
  for (const [index, raw] of sourceCodes.entries()) {
    const code = requireInteger(raw, `SOURCE_${index}`);
    if (code === 0) {
      continue;
    }
    const group = bucketGroupForCode(code);
    if (group === BATTLE_BUCKET_DROPPED_GROUP) {
      dropped.push({ source: index, code });
      continue;
    }
    if (groups[group].length >= BATTLE_BUCKET_ENTRIES_PER_GROUP) {
      // The original has no such check and would write past the group's two
      // words into the next group's count. Two sources cannot reach it, but a
      // caller feeding more must not be allowed to reproduce the overrun.
      throw bucketError(`GROUP_${group}_OVERFLOW_UNTRACED`);
    }
    const record = moves[code];
    if (!record || record.recordIndex !== code) {
      throw bucketError(`CODE_${code}_IS_NOT_A_MOVE_RECORD`);
    }
    groups[group].push(deepFreeze({ actionId: code, costField48: record.actionCost }));
  }

  const buckets = {};
  const scanGroups = {};
  const actionCostById = {};
  for (const [group, list] of groups.entries()) {
    buckets[group] = deepFreeze(list);
    // The affordability scan at 0x021144CC walks the same lists as bare action
    // ids and resolves each cost itself, so both shapes come from one build.
    scanGroups[group] = deepFreeze(list.map((entry) => entry.actionId));
    for (const entry of list) {
      actionCostById[entry.actionId] = entry.costField48;
    }
  }
  return deepFreeze({
    buckets: deepFreeze(buckets),
    scanGroups: deepFreeze(scanGroups),
    actionCostById: deepFreeze(actionCostById),
    dropped: deepFreeze(dropped)
  });
}

/** How many entries a built set holds, the way the +0xF0 bytes would read. */
export function bucketCounts(built) {
  if (!built || typeof built !== "object" || !built.buckets) {
    throw bucketError("COUNTS_REQUIRE_A_BUILT_SET");
  }
  return deepFreeze(
    Array.from({ length: BATTLE_BUCKET_GROUP_COUNT }, (unused, group) => built.buckets[group].length)
  );
}
