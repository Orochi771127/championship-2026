// The title-match schedule -- the original's fixture calendar.
//
// THE PREDICATE IS THE ROM'S, NOT MINE
// ------------------------------------
// ARM9 0x02089230 is the game's own "which title matches are on right now" query.
// It takes an output array and a capacity, asks the clock for the current season
// and day, then walks the 62-record title table at 0x020CD004 at stride 0x28:
//
//     0x0208926C  LDR   r1,[r14,#0x14]        ; field14 = the record's season
//     0x02089270  CMP   r4,r1                 ; current season == it?
//     0x02089274  LDREQ r1,[r14,#0x18]        ; field18 = the record's day
//     0x02089278  CMPEQ r0,r1                 ; current day == it?
//     0x0208927C  BNE   next
//     0x02089280  LDR   r1,[r14,#0x10]        ; field10, 0..4
//     0x02089284  CMP   r1,r2,LSR #1          ; field10 <= (counter >> 1)?
//     0x02089288  STRLE r12,[r6,+r3,LSL #2]   ; emit the RECORD INDEX
//     0x0208928C  ADDLE r3,r3,#0x1
//     0x02089294  CMP   r12,#0x3d             ; and the scan stops at 61
//
// Three details that are easy to get wrong and are reproduced exactly here:
//
//   * The scan bound is 0x3D, so it covers records 0..60. Record 61 is never
//     reached. Record 61 is the tutorial match, which is why it has no place in
//     a calendar of fixtures.
//   * The capacity check sits at the TOP of the body and BRANCHES PAST THE WHOLE
//     MATCH TEST (BHS -> 0x02089290, the index increment). So once the output is
//     full the game stops even ASKING whether a record matches. It does not break
//     out of the loop, it does not overwrite, and it emphatically does not keep a
//     running total of matches it declined to store -- there is no such number
//     anywhere in the routine.
//   * What is emitted is the record index, not a pointer and not field08.
//   * The return value is r3, the number of indices WRITTEN (MOV r0,r3).
//
// THE COUNTER AT +0xAE8 IS THE TAMER RANK
// ---------------------------------------
// An earlier version of this file called the u16 at player+0xAE8 unknown. That was
// wrong, and wrong in the worst way: the identification was already in this
// codebase, in the cage lane. cageCatalog.js documents +0xAE8 as the tamer rank
// and reads the rank table at ARM9 0x020E1E18 (stride 36, first word = ranch slot
// count) as VERIFIED_BINARY.
//
// Two facts make the fit exact rather than merely plausible:
//
//   * That table holds exactly TEN valid ranks -- 14,14,16,16,18,18,20,20,20,20 --
//     and then falls out of range.
//   * The scan compares field10 against rank >> 1. For ranks 0..9 that yields
//     0,0,1,1,2,2,3,3,4,4, i.e. exactly 0..4 -- and 0..4 is exactly the set of
//     values field10 takes across all 62 records.
//
// So field10 is a rank TIER requirement, and the halving is what maps ten ranks
// onto five tiers. A fixture opens once the tamer rank reaches 2 * field10.
//
// OVL8 0210D0C8 / 0210E328 result and rank writers are now compared against
// 600 original CPU vectors in TITLE_PROGRESSION_CPU_CHECK_2026-09-09.json.

import { deepFreeze } from "../contracts/championshipContracts.js";
import titleEvents from "../../data/championship/catalogs/battle-title-events.r1.json" with { type: "json" };
import titleStrings from "../../data/championship/catalogs/battle-title-event-strings.r1.json" with { type: "json" };

/** ARM9 0x02089294 compares the index against 0x3D before continuing. */
export const TITLE_EVENT_SCAN_LIMIT = 0x3d;
export const TITLE_EVENT_SCAN_SITE = "ARM9:0x02089230";
export const TITLE_EVENT_SCAN_EVIDENCE = "ROM_VERIFIED";

/** The record the scan bound excludes. Kept nameable rather than silently dropped. */
export const TITLE_EVENT_UNSCANNED_INDEX = 61;

/** field10 is a rank tier: the scan compares it against the tamer rank, halved. */
export const TITLE_EVENT_UNLOCK_COLUMN = "field10";
export const TITLE_EVENT_UNLOCK_COUNTER_SITE = "player+0x0AE8 (u16), the tamer rank";
export const TITLE_EVENT_UNLOCK_COUNTER_NAME = "tamerRank";
/** Rank table and the result writer are independently CPU checked. */
export const TITLE_EVENT_UNLOCK_COUNTER_EVIDENCE = "ROM_VERIFIED";
export const TITLE_EVENT_UNLOCK_RANK_TABLE_SITE = "ARM9:0x020E1E18";
/** rank >> 1, so a fixture needs rank 2 * field10. */
export function tamerRankRequiredFor(field10) {
  return field10 * 2;
}

const RECORDS = titleEvents.records;
const STRINGS_BY_INDEX = new Map(titleStrings.records.map((row) => [row.recordIndex, row]));

function scheduleError(message) {
  const error = new Error(message);
  error.name = "ChampionshipTitleScheduleError";
  return error;
}

/** The season/day columns as the ROM stores them, plus the ROM's own name text. */
export function titleEventAt(recordIndex) {
  const record = RECORDS[recordIndex];
  if (!record) return null;
  const strings = STRINGS_BY_INDEX.get(recordIndex);
  return deepFreeze({
    recordIndex,
    name: strings?.name ?? null,
    description: strings?.description ?? null,
    season: record.field14,
    dayOfSeason: record.field18,
    unlockThreshold: record.field10,
    // Untraced columns keep their byte-offset names, so nothing reads as decided.
    field0C: record.field0C,
    field1C: record.field1C,
    field20: record.field20,
    field24: record.field24,
    scannedByGame: recordIndex < TITLE_EVENT_SCAN_LIMIT
  });
}

/**
 * Every fixture on one season/day, using only the two traced date columns.
 *
 * This is the calendar the board draws. It applies no unlock gate: the board's job
 * is to show the season's fixtures, and hiding the ones the player has not yet
 * ranked into would misreport the schedule. The tier is shown, not enforced.
 */
export function titleEventCalendar(season, dayOfSeason) {
  const found = [];
  for (let index = 0; index < TITLE_EVENT_SCAN_LIMIT; index += 1) {
    const record = RECORDS[index];
    if (record.field14 === season && record.field18 === dayOfSeason) found.push(index);
  }
  return deepFreeze(found);
}

/**
 * The ROM's query, reproduced including its capacity behaviour.
 *
 * @param {object} query
 * @param {number} query.season         current season, from the world clock
 * @param {number} query.dayOfSeason    current day within the season
 * @param {number} query.unlockCounter  the u16 at player+0x0AE8; halved before comparing
 * @param {number} query.capacity       output slots, as the caller's array length
 * @returns {{indices: readonly number[], count: number}} count is the ROM's r0
 */
export function scanTitleEventsForToday({ season, dayOfSeason, unlockCounter, capacity } = {}) {
  if (!Number.isInteger(season)) throw scheduleError("season must be an integer");
  if (!Number.isInteger(dayOfSeason)) throw scheduleError("dayOfSeason must be an integer");
  if (!Number.isInteger(unlockCounter) || unlockCounter < 0) {
    throw scheduleError("unlockCounter must be a non-negative integer");
  }
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw scheduleError("capacity must be a non-negative integer");
  }

  const threshold = unlockCounter >>> 1;
  const indices = [];

  for (let index = 0; index < TITLE_EVENT_SCAN_LIMIT; index += 1) {
    // BHS at 0x02089268 jumps to the increment, so a full output skips the match
    // test entirely. The loop still runs to 0x3D; it simply asks nothing.
    if (indices.length >= capacity) continue;
    const record = RECORDS[index];
    if (record.field14 !== season || record.field18 !== dayOfSeason) continue;
    if (record.field10 > threshold) continue;
    indices.push(index);
  }

  return deepFreeze({
    indices: deepFreeze(indices),
    // MOV r0,r3 -- the number written, which is the only count the routine has.
    count: indices.length
  });
}

/** The whole year as a season-major grid, for the board. */
export function titleEventYearGrid({ seasons = 4, daysPerSeason = 8 } = {}) {
  const grid = [];
  for (let season = 0; season < seasons; season += 1) {
    const days = [];
    for (let day = 0; day < daysPerSeason; day += 1) {
      days.push(deepFreeze(titleEventCalendar(season, day).map((index) => titleEventAt(index))));
    }
    grid.push(deepFreeze(days));
  }
  return deepFreeze(grid);
}
