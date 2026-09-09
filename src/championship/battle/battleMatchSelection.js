// Match selection and eligibility — ARM9 0x0208922C filter, OVL10 driver.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is the seam B1 was missing a consumer for. OVL10 is the screen that
// offers matches; the filter that decides which ones you may enter is in ARM9
// and reads the title-event table B1 transcribed, including both money columns.
//
// THE FILTER
// ----------
//   0208922C  push  {r4, r5, r6, lr}       r0 = out array, r1 = cap
//   02089238  bl    0x0207BC9C             slot A
//   02089240  bl    0x0207BCCC             slot B
//   02089250  ldr   lr, =0x020CD004        the title-event table
//   02089260  ldrh  r2, [r1, #0xe8]        progress counter, u16
//   02089264  cmp   r3, r5 / bhs           stop storing once the cap is reached
//   0208926C  ldr   r1, [lr, #0x14]        record +0x14 must equal slot A
//   02089274  ldr   r1, [lr, #0x18]        record +0x18 must equal slot B
//   02089280  ldr   r1, [lr, #0x10]
//   02089284  cmp   r1, r2, lsr #1         record +0x10 <= counter >> 1
//   02089288  strle ip, [r6, r3, lsl #2]   accept: store the RECORD INDEX
//   02089294  cmp   ip, #0x3d              61 -- records 0..60 only
//
// So: walk records 0..60 in order, keep the first `cap` whose two schedule
// columns match the current slots and whose +0x10 requirement is at most half
// the progress counter, and return how many were kept. Record 61 is outside the
// scan, which is why the entry-fee column's only zero is outside this filter.
//
// THE TWO SCHEDULE SLOTS
// ----------------------
// 0x0207BC9C and 0x0207BCCC are the same shape: divide a clock word by a
// per-slot divisor held in RAM, then take the remainder against a constant from
// ARM9 0x020C8A4C, whose first two words are 4 and 8. The catalogued ranges
// agree exactly -- title +0x14 is 0..3 and +0x18 is 0..7 -- but the divisors
// live in a RAM struct at 0x0210AA94 that nothing in the cartridge initialises
// statically, so the slots are inputs here rather than something this module
// computes. They are named for their offsets, not for a calendar.
//
// THE ONE MATCH THE FILTER NEVER PRODUCES
// ---------------------------------------
// OVL10 0x0210EBFC reads a word in its own BSS. When it is set the screen skips
// the filter entirely and offers a list of exactly one: record 61, at
// 0x0210EC18 `mov r1, #0x3d`. That word is written at exactly one place in the
// whole ROM -- OVL10 0x0210B498 -- and only when the global context's +0xA8 is
// 4. So record 61 is not dead data and not a reward bug: it is the match of one
// entry mode, and the finding that it is the table's only zero-fee record
// is the consistent half of the same fact.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What entry mode 4 means, what the clock divisors are, and what the screen
// does when the filter returns nothing. None of those is traced, so none is
// modelled. The progress counter is taken as an argument because its source
// (session block +0xA00 +0xE8) is outside this module's evidence.

import titleDocument from "../../data/championship/catalogs/battle-title-events.r1.json" with { type: "json" };
import teamDocument from "../../data/championship/catalogs/battle-opponent-teams.r1.json" with { type: "json" };
import presetDocument from "../../data/championship/catalogs/battle-presets.r1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_MATCH_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_MATCH_FILTER_SITE = "ARM9:0x0208922C";
export const BATTLE_MATCH_DRIVER_SITE = "OVL10:0x0210EC30";

/** cmp ip,#0x3d at 0x02089294: the filter walks record indices 0..60. */
export const BATTLE_MATCH_SCAN_LIMIT = 61;

/** OVL10 0x0210EC2C passes `mov r1, #5`, so the screen offers at most five. */
export const BATTLE_MATCH_LIST_CAP = 5;

/** OVL10 0x0210EC18 `mov r1, #0x3d`, the one record the filter cannot reach. */
export const BATTLE_MATCH_SPECIAL_RECORD_INDEX = 61;

/** OVL10 0x0210B478 `cmp r0, #4` on the global context +0xA8. */
export const BATTLE_MATCH_SPECIAL_ENTRY_MODE = 4;

/** ARM9 0x020C8A4C holds 4 then 8; the two schedule columns stay inside them. */
export const BATTLE_MATCH_SCHEDULE_SLOT_A_MODULUS = 4;
export const BATTLE_MATCH_SCHEDULE_SLOT_B_MODULUS = 8;

/** Both the team index and a preset slot use -1 as "none" (OVL10 0x021105CC). */
export const BATTLE_MATCH_EMPTY_SLOT = -1;

/** Schedule/progress fields retain their raw offset names. */
export const BATTLE_MATCH_PROGRESS_FIELD = "field10";
export const BATTLE_MATCH_SLOT_A_FIELD = "field14";
export const BATTLE_MATCH_SLOT_B_FIELD = "field18";
/** OVL10 0x02112608 -> wallet compare/debit; independently rechecked 2026-09-05. */
export const BATTLE_MATCH_ENTRY_FEE_FIELD = "field24";
/** OVL10 title +0x20 -> session +0xC94 -> OVL8 pending reward. */
export const BATTLE_MATCH_PAYOUT_FIELD = "field20";

function matchError(message) {
  return new Error(`BATTLE_MATCH_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw matchError(`${label.toUpperCase()}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

function titleRecords() {
  const records = titleDocument.records;
  if (records.length !== 62) {
    throw matchError("TITLE_TABLE_RECORD_COUNT_MISMATCH");
  }
  return records;
}

export function getMatchRecord(recordIndex) {
  const record = titleRecords()[recordIndex];
  if (!record || record.recordIndex !== recordIndex) {
    throw matchError(`UNKNOWN_RECORD: ${recordIndex}`);
  }
  return record;
}

/**
 * ARM9 0x0208922C. Returns the record indices the screen may offer, in table
 * order, capped. `progressCounter` is the u16 the original reads at the session
 * block +0xA00 +0xE8; only its halved value is used, and the compare is `<=`.
 */
export function selectEligibleMatches(input) {
  if (!input || typeof input !== "object") {
    throw matchError("SELECT_REQUIRES_AN_OBJECT");
  }
  const slotA = requireInteger(input.scheduleSlotA, "scheduleSlotA");
  const slotB = requireInteger(input.scheduleSlotB, "scheduleSlotB");
  const progressCounter = requireInteger(input.progressCounter, "progressCounter");
  if (progressCounter < 0 || progressCounter > 0xffff) {
    throw matchError("PROGRESS_COUNTER_MUST_BE_A_U16");
  }
  const cap = input.listCap === undefined ? BATTLE_MATCH_LIST_CAP : requireInteger(input.listCap, "listCap");
  if (cap < 0) {
    throw matchError("LIST_CAP_MUST_NOT_BE_NEGATIVE");
  }

  const allowance = progressCounter >>> 1;
  const records = titleRecords();
  const selected = [];
  for (let recordIndex = 0; recordIndex < BATTLE_MATCH_SCAN_LIMIT; recordIndex += 1) {
    if (selected.length >= cap) {
      // The original keeps walking; it just stops storing. Same result.
      continue;
    }
    const record = records[recordIndex];
    if (record[BATTLE_MATCH_SLOT_A_FIELD] !== slotA || record[BATTLE_MATCH_SLOT_B_FIELD] !== slotB) {
      continue;
    }
    if (record[BATTLE_MATCH_PROGRESS_FIELD] <= allowance) {
      selected.push(recordIndex);
    }
  }
  return deepFreeze(selected);
}

/**
 * OVL10 0x0210EBFC. Entry mode 4 replaces the filtered list with a single
 * record; every other mode runs the filter.
 */
export function resolveMatchList(input) {
  if (!input || typeof input !== "object") {
    throw matchError("RESOLVE_REQUIRES_AN_OBJECT");
  }
  const entryMode = requireInteger(input.entryMode, "entryMode");
  if (entryMode === BATTLE_MATCH_SPECIAL_ENTRY_MODE) {
    return deepFreeze({
      source: "ENTRY_MODE_OVERRIDE",
      records: deepFreeze([BATTLE_MATCH_SPECIAL_RECORD_INDEX])
    });
  }
  return deepFreeze({ source: "SCHEDULE_FILTER", records: selectEligibleMatches(input) });
}

/**
 * Title +0x20 supplies the pending reward before the result's outcome/mode
 * gates. This is the advertised reward, not evidence of a wallet credit.
 */
export function matchPayout(recordIndex) {
  return getMatchRecord(recordIndex)[BATTLE_MATCH_PAYOUT_FIELD];
}

/** OVL10 reads title +0x24 into +0xD538, then compares/debits PlayerData+0x4C8. */
export function matchEntryFee(recordIndex) {
  return getMatchRecord(recordIndex)[BATTLE_MATCH_ENTRY_FEE_FIELD];
}

/**
 * OVL10 0x0211057C..0x02110594 loads the team record's +0x00, +0x04 and +0x08
 * and treats each as a preset index, multiplying by 0x44 into the preset table
 * at 0x021105D4. A slot of -1 is skipped, and a team index of -1 yields nothing.
 */
export function expandOpponentTeam(teamIndex) {
  requireInteger(teamIndex, "teamIndex");
  if (teamIndex === BATTLE_MATCH_EMPTY_SLOT) {
    return deepFreeze([]);
  }
  const record = teamDocument.records[teamIndex];
  if (!record || record.recordIndex !== teamIndex) {
    throw matchError(`UNKNOWN_TEAM: ${teamIndex}`);
  }
  const slots = [record.field00, record.field04, record.field08];
  const presets = [];
  for (const slot of slots) {
    if (slot === BATTLE_MATCH_EMPTY_SLOT) {
      continue;
    }
    if (!presetDocument.records[slot] || presetDocument.records[slot].recordIndex !== slot) {
      throw matchError(`TEAM_${teamIndex}_NAMES_UNKNOWN_PRESET_${slot}`);
    }
    presets.push(slot);
  }
  return deepFreeze(presets);
}
