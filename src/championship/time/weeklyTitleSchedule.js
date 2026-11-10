// Weekly title schedule with time slots -- OWNER_APPROVED_ADAPTATION 2026-11-10 (WEEKLY_SEASON_20261110).
//
// NOT original behaviour. Natively (titleEventSchedule.js, battleMatchSelection.js) the 61 scanned title records
// sit on a season x day grid of 4 x 8 (field14 / field18) and are open all day. Under the real-time clock a season
// is one real week (time/monthlyCalendar.js), so the Owner asked for the eight days to be fitted into seven and for
// each day's titles to open in time slots:
//   * Days 1-7 keep their native day. The ten titles of native day 8 move to the lightest day of the same season
//     (spring 1/2/4, summer 4/6, autumn 3/4/6, winter 5/7), so every season keeps its own titles.
//   * Slots follow the ranch day (07:00-22:00; 22:00-07:00 is the night nap): one title on a day is open all day;
//     two split into the day slot (07:00-17:00, the lower rank tier) and the evening (17:00-22:00, the higher);
//     three take morning / afternoon / evening by rank tier; on a four-title day the two lowest share the morning.
//   * Winter overtime (days 29-31) replays winter's last day. The championship (autumn day 5) stays all day.
// The rank-tier gate (field10 <= rank >> 1) and the five-title list cap are the native ones.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { BATTLE_MATCH_LIST_CAP, getMatchRecord } from "../battle/battleMatchSelection.js";
import { MONTHLY_DAYS_PER_SEASON, MONTHLY_SEASONS } from "./monthlyCalendar.js";

export const WEEKLY_TITLE_SCHEDULE_AUTHORITY = "OWNER_APPROVED_ADAPTATION_20261110_WEEKLY_SEASON";

/** Minutes of the day [opens, closes). */
export const WEEKLY_TITLE_SLOTS = deepFreeze({
  MORNING: { opens: 7 * 60, closes: 12 * 60 },
  AFTERNOON: { opens: 12 * 60, closes: 17 * 60 },
  EVENING: { opens: 17 * 60, closes: 22 * 60 },
  DAYTIME: { opens: 7 * 60, closes: 17 * 60 },
  ALL_DAY: { opens: 7 * 60, closes: 22 * 60 }
});
export const WEEKLY_TITLE_SLOT_ORDER = Object.freeze(["ALL_DAY", "DAYTIME", "MORNING", "AFTERNOON", "EVENING"]);

/** The championship (native autumn day 5) keeps its native day and opens all day. */
export const WEEKLY_CHAMPIONSHIP = deepFreeze({ season: 2, dayOfSeason: 4, slot: "ALL_DAY" });

// [recordIndex, season, dayOfSeason (0-6), slot]. Records moved from native day 8 are marked "moved".
const ROWS = [
  // Spring -- days 1-7 of the month.
  [25, 0, 0, "DAYTIME"] /* moved */, [50, 0, 0, "EVENING"],
  [29, 0, 1, "DAYTIME"] /* moved */, [12, 0, 1, "EVENING"],
  [8, 0, 2, "DAYTIME"], [48, 0, 2, "EVENING"],
  [16, 0, 3, "DAYTIME"], [34, 0, 3, "EVENING"] /* moved */,
  [4, 0, 4, "MORNING"], [42, 0, 4, "AFTERNOON"], [51, 0, 4, "EVENING"],
  [17, 0, 5, "DAYTIME"], [33, 0, 5, "EVENING"],
  [55, 0, 6, "MORNING"], [22, 0, 6, "MORNING"], [18, 0, 6, "AFTERNOON"], [41, 0, 6, "EVENING"],
  // Summer -- days 8-14.
  [2, 1, 0, "ALL_DAY"],
  [9, 1, 1, "DAYTIME"], [20, 1, 1, "EVENING"],
  [15, 1, 2, "MORNING"], [39, 1, 2, "AFTERNOON"], [58, 1, 2, "EVENING"],
  [37, 1, 3, "DAYTIME"], [35, 1, 3, "EVENING"] /* moved */,
  [30, 1, 4, "DAYTIME"], [43, 1, 4, "EVENING"],
  [24, 1, 5, "DAYTIME"], [46, 1, 5, "EVENING"] /* moved */,
  [38, 1, 6, "DAYTIME"], [13, 1, 6, "EVENING"],
  // Autumn -- days 15-21; the championship is on day 5 (the 19th).
  [5, 2, 0, "DAYTIME"], [40, 2, 0, "EVENING"],
  [26, 2, 1, "MORNING"], [10, 2, 1, "MORNING"], [44, 2, 1, "AFTERNOON"], [52, 2, 1, "EVENING"],
  [3, 2, 2, "MORNING"] /* moved */, [45, 2, 2, "AFTERNOON"], [32, 2, 2, "EVENING"],
  [0, 2, 3, "MORNING"], [27, 2, 3, "AFTERNOON"] /* moved */, [28, 2, 3, "EVENING"],
  [56, 2, 4, "DAYTIME"], [53, 2, 4, "EVENING"],
  [31, 2, 5, "MORNING"], [21, 2, 5, "AFTERNOON"], [14, 2, 5, "EVENING"] /* moved */,
  [1, 2, 6, "MORNING"], [54, 2, 6, "AFTERNOON"], [59, 2, 6, "EVENING"],
  // Winter -- days 22-28, and 29-31 replay day 7.
  [57, 3, 0, "ALL_DAY"],
  [47, 3, 1, "ALL_DAY"],
  [23, 3, 2, "MORNING"], [36, 3, 2, "AFTERNOON"], [6, 3, 2, "EVENING"],
  [7, 3, 3, "ALL_DAY"],
  [49, 3, 4, "ALL_DAY"] /* moved */,
  [11, 3, 5, "ALL_DAY"],
  [19, 3, 6, "DAYTIME"], [60, 3, 6, "EVENING"] /* moved */
];

export const WEEKLY_TITLE_SCHEDULE = deepFreeze(ROWS.map(([recordIndex, season, dayOfSeason, slot]) => {
  const record = getMatchRecord(recordIndex);
  return {
    recordIndex, season, dayOfSeason, slot, ...WEEKLY_TITLE_SLOTS[slot],
    nativeSeason: record.field14, nativeDayOfSeason: record.field18, unlockThreshold: record.field10
  };
}));

const byRecord = new Map(WEEKLY_TITLE_SCHEDULE.map((entry) => [entry.recordIndex, entry]));

/** Throws unless every scanned record 0..60 appears once, in its native season, inside a seven-day week. */
export function assertWeeklyTitleSchedule(schedule = WEEKLY_TITLE_SCHEDULE) {
  const seen = new Set();
  for (const entry of schedule) {
    if (seen.has(entry.recordIndex)) throw new Error(`WEEKLY_TITLE_DUPLICATE:${entry.recordIndex}`);
    if (entry.season !== entry.nativeSeason) throw new Error(`WEEKLY_TITLE_SEASON:${entry.recordIndex}`);
    if (entry.nativeDayOfSeason < MONTHLY_DAYS_PER_SEASON && entry.dayOfSeason !== entry.nativeDayOfSeason) throw new Error(`WEEKLY_TITLE_DAY:${entry.recordIndex}`);
    if (!(entry.dayOfSeason >= 0 && entry.dayOfSeason < MONTHLY_DAYS_PER_SEASON)) throw new Error(`WEEKLY_TITLE_DAY_RANGE:${entry.recordIndex}`);
    if (!WEEKLY_TITLE_SLOTS[entry.slot]) throw new Error(`WEEKLY_TITLE_SLOT:${entry.recordIndex}`);
    seen.add(entry.recordIndex);
  }
  for (let index = 0; index < 61; index += 1) if (!seen.has(index)) throw new Error(`WEEKLY_TITLE_MISSING:${index}`);
  return schedule;
}
assertWeeklyTitleSchedule();

export function weeklyTitleEntry(recordIndex) { return byRecord.get(recordIndex) ?? null; }

export function weeklySlotOpen(slot, minute) {
  const window = WEEKLY_TITLE_SLOTS[slot];
  return Boolean(window) && Number.isInteger(minute) && minute >= window.opens && minute < window.closes;
}

/** The titles scheduled on a day, all slots, in slot then table order. */
export function weeklyTitlesOnDay(season, dayOfSeason) {
  return WEEKLY_TITLE_SCHEDULE.filter((entry) => entry.season === season && entry.dayOfSeason === dayOfSeason)
    .sort((a, b) => a.opens - b.opens || a.closes - b.closes || a.recordIndex - b.recordIndex);
}

/**
 * The weekly counterpart of selectEligibleMatches: today's titles whose slot is open at `minute` (all of today's
 * titles when `minute` is null), passing the native rank-tier gate, capped at the native five.
 */
export function selectWeeklyEligibleMatches({ season, dayOfSeason, minute = null, progressCounter, listCap = BATTLE_MATCH_LIST_CAP }) {
  if (!Number.isInteger(season) || !Number.isInteger(dayOfSeason) || !Number.isInteger(progressCounter)) return deepFreeze([]);
  const allowance = progressCounter >>> 1;
  return deepFreeze(weeklyTitlesOnDay(season, dayOfSeason)
    .filter((entry) => entry.unlockThreshold <= allowance && (minute === null || weeklySlotOpen(entry.slot, minute)))
    .slice(0, listCap).map((entry) => entry.recordIndex));
}

/** 4 seasons x 7 days of title entries for the schedule board. */
export function weeklyTitleGrid() {
  return deepFreeze(Array.from({ length: MONTHLY_SEASONS }, (_, season) =>
    Array.from({ length: MONTHLY_DAYS_PER_SEASON }, (_, day) => weeklyTitlesOnDay(season, day))));
}

/** Clock text of a slot, e.g. "07:00–17:00". */
export function weeklySlotClock(slot) {
  const window = WEEKLY_TITLE_SLOTS[slot];
  if (!window) return "";
  const hhmm = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  return `${hhmm(window.opens)}–${hhmm(window.closes)}`;
}

/**
 * The day-change calendar on the weekly clock: the native interstitial's registered / unwon counts per day
 * (raising/nativeRaisingCalendar.js), over seven days and the weekly schedule. There is no countdown.
 */
export function projectWeeklyRaisingCalendar({ year, season, dayOfSeason, progressCounter, registered = [], won = [], championship = null }) {
  const days = Array.from({ length: MONTHLY_DAYS_PER_SEASON }, (_, day) => ({ day, registered: 0, unwon: 0 }));
  const registeredSet = new Set(registered), wonSet = new Set(won), allowance = (progressCounter ?? 0) >>> 1;
  for (const entry of WEEKLY_TITLE_SCHEDULE) {
    if (entry.season !== season || entry.unlockThreshold > allowance) continue;
    if (registeredSet.has(entry.recordIndex)) days[entry.dayOfSeason].registered++;
    else if (!wonSet.has(entry.recordIndex)) days[entry.dayOfSeason].unwon++;
  }
  if ((championship?.stage ?? 0) >= 1 && season === WEEKLY_CHAMPIONSHIP.season && (championship.entry || championship.worldEntry)) {
    days[WEEKLY_CHAMPIONSHIP.dayOfSeason].registered++;
  }
  return Object.freeze({ year, season, dayOfSeason, countdown: null, weekly: true, days: Object.freeze(days.map(Object.freeze)) });
}
