// Championship clock arithmetic; no ticker, elapsed source, mode or resident effects.
//
// ARM9 0x020C8A4C supplies 4 / 8 / 24 / 60 / 400. The word at
// 0x0210AA98 stores MINUTES within the year, not 400-unit ticks. The elapsed
// accumulator at clock base +0x08 carries raw converted timer units. Training
// scene entry sets divisor 200; scene exit restores base divisor 400. A scene
// change does not rescale the remainder. New Game and End Day use 07:00;
// natural time stops at/after 22:00.
// The year byte increments only below 99. Unknown legacy years stay null.
//
// This module performs arithmetic without natural-time gating. The existing
// app adapter owns verified elapsed/mode policy. It must never use the old
// approximate 600-second helper as recovered timing.
// Evidence: docs/research/round2-clock-2026-09-05/CLOCK_ROM_TRACE.md
// Contract: docs/contracts/championship/world-clock-runtime.v1.json

import { deepFreeze } from "../contracts/championshipContracts.js";

/** ARM9 0x020C8A4C, first five words. */
export const WORLD_CLOCK_CASCADE = deepFreeze({
  seasonsPerYear: 4,
  daysPerSeason: 8,
  hoursPerDay: 24,
  minutesPerHour: 60,
  unitsPerMinute: 400
});

export const WORLD_CLOCK_CASCADE_EVIDENCE = "ROM_VERIFIED";
export const WORLD_CLOCK_CASCADE_SITE = "ARM9:0x020C8A4C";
export const WORLD_CLOCK_ROM_SHA256 =
  "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";

export const MINUTES_PER_DAY = WORLD_CLOCK_CASCADE.hoursPerDay * WORLD_CLOCK_CASCADE.minutesPerHour;
export const DAYS_PER_YEAR = WORLD_CLOCK_CASCADE.daysPerSeason * WORLD_CLOCK_CASCADE.seasonsPerYear;
export const UNITS_PER_DAY = MINUTES_PER_DAY * WORLD_CLOCK_CASCADE.unitsPerMinute;

/**
 * Season identities.
 *
 * The four names are what the original's status bar shows. OVL1 loads four
 * matching palettes -- spring_col, summer_col, autumn_col, winter_col -- in that
 * order, which is why this array's order is not arbitrary.
 */
export const WORLD_SEASONS = deepFreeze(["Spring", "Summer", "Autumn", "Winter"]);
export const WORLD_SEASON_EVIDENCE = "ROM_VERIFIED_PALETTE_ORDER_AND_OBSERVED_NAMES";

/** ARM9 0x020987A0 initializes start=07:00; New Game and OVL18 End Day consume it. */
export const DAY_START_MINUTES = 7 * 60;
export const DAY_START_EVIDENCE = "ROM_VERIFIED";
export const DAY_END_MINUTES = 22 * 60;
export const WORLD_CLOCK_MAX_YEAR = 99;
/** Browser elapsed precision, not another ROM cascade level. */
export const CLOCK_SUBUNITS_PER_UNIT = 1000;

/** PRODUCT_AUTHORED tuning knob; see the header note. */
export const REAL_SECONDS_PER_WORLD_DAY = 600;
export const REAL_SECONDS_PER_WORLD_DAY_EVIDENCE = "INFERENCE_FROM_HELP_TEXT_APPROXIMATION";

function clockError(message) {
  const error = new Error(message);
  error.name = "ChampionshipWorldClockError";
  return error;
}

function assertField(value, name, max) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max || Object.is(value, -0)) {
    throw clockError(`${name} must be an integer in 0..${max}`);
  }
  return value;
}

/**
 * Validate and freeze a world-clock reading.
 *
 * Null calendar slots retain missing history from legacy saves. They must not
 * be replaced with an invented epoch. The year cap 99 is ROM-verified.
 */
export function createWorldClock({ year = null, season = 0, dayOfSeason = 0, clockMinutes = DAY_START_MINUTES, clockUnits = 0, clockSubunits = 0 } = {}) {
  if (year !== null) assertField(year, "year", WORLD_CLOCK_MAX_YEAR);
  if (season !== null) assertField(season, "season", WORLD_CLOCK_CASCADE.seasonsPerYear - 1);
  if (dayOfSeason !== null) assertField(dayOfSeason, "dayOfSeason", WORLD_CLOCK_CASCADE.daysPerSeason - 1);
  assertField(clockMinutes, "clockMinutes", MINUTES_PER_DAY - 1);
  assertField(clockUnits, "clockUnits", WORLD_CLOCK_CASCADE.unitsPerMinute - 1);
  assertField(clockSubunits, "clockSubunits", CLOCK_SUBUNITS_PER_UNIT - 1);
  return deepFreeze({ year, season, dayOfSeason, clockMinutes, clockUnits, clockSubunits });
}

/**
 * Advance by whole minutes, rolling every level of the cascade.
 *
 * Rolling is arithmetic rather than a loop so that a large jump costs the same
 * as a small one and cannot spin.
 */
export function advanceWorldClock(clock, minutes) {
  assertField(minutes, "minutes", Number.MAX_SAFE_INTEGER);
  return advanceClockByBigInt(clock, BigInt(minutes) * BigInt(WORLD_CLOCK_CASCADE.unitsPerMinute));
}

/** Pure arithmetic only: caller owns elapsed-rate and mode/day-end policy. */
export function advanceWorldClockUnits(clock, units, { subunits = 0, divisor = WORLD_CLOCK_CASCADE.unitsPerMinute } = {}) {
  assertField(units, "units", Number.MAX_SAFE_INTEGER);
  assertField(subunits, "subunits", CLOCK_SUBUNITS_PER_UNIT - 1);
  if (divisor !== 200 && divisor !== 400) throw clockError("divisor must be the verified 200 or 400");
  return advanceClockByBigInt(clock, BigInt(units), subunits, divisor);
}

function advanceClockByBigInt(clock, units, subunits = 0, divisor = WORLD_CLOCK_CASCADE.unitsPerMinute) {
  const current = createWorldClock(clock);
  const totalSubunits = current.clockSubunits + subunits;
  const clockSubunits = totalSubunits % CLOCK_SUBUNITS_PER_UNIT;
  const totalUnits = BigInt(current.clockUnits) + units + BigInt(Math.floor(totalSubunits / CLOCK_SUBUNITS_PER_UNIT));
  const clockUnits = Number(totalUnits % BigInt(divisor));
  const totalMinutes = BigInt(current.clockMinutes) + totalUnits / BigInt(divisor);
  const clockMinutes = Number(totalMinutes % 1440n);
  const totalDays = current.dayOfSeason === null ? null : BigInt(current.dayOfSeason) + totalMinutes / 1440n;
  const dayOfSeason = totalDays === null ? null : Number(totalDays % 8n);
  const totalSeasons = current.season === null || totalDays === null ? null : BigInt(current.season) + totalDays / 8n;
  const season = totalSeasons === null ? null : Number(totalSeasons % 4n);
  const years = current.year === null || totalSeasons === null ? null : BigInt(current.year) + totalSeasons / 4n;
  const year = years === null ? null : Number(years > BigInt(WORLD_CLOCK_MAX_YEAR) ? BigInt(WORLD_CLOCK_MAX_YEAR) : years);
  return createWorldClock({ year, season, dayOfSeason, clockMinutes, clockUnits, clockSubunits });
}

/**
 * The player's own day advance.
 *
 * The Raising Home toolbar submenu carries an End Day entry, so the calendar is
 * not purely a running clock: a day can be closed on demand. This lands on the
 * next day at DAY_START_MINUTES and rolls season and year with it.
 */
export function endWorldClockDay(clock) {
  const current = createWorldClock(clock);
  const remaining = MINUTES_PER_DAY - current.clockMinutes;
  return advanceWorldClock({ ...current, clockUnits: 0, clockSubunits: 0 }, remaining + DAY_START_MINUTES);
}

/** How many whole world minutes `realSeconds` of wall time is worth. */
export function worldMinutesForRealSeconds(realSeconds) {
  if (!Number.isFinite(realSeconds) || realSeconds < 0) throw clockError("realSeconds must be a non-negative number");
  return Math.floor((realSeconds / REAL_SECONDS_PER_WORLD_DAY) * MINUTES_PER_DAY);
}

export function worldSeasonName(season) {
  if (season === null) return null;
  assertField(season, "season", WORLD_CLOCK_CASCADE.seasonsPerYear - 1);
  return WORLD_SEASONS[season];
}

/** Days are shown 1-based; the stored slot is 0-based. Never render the slot. */
export function worldDayNumber(dayOfSeason) {
  if (dayOfSeason === null) return null;
  return assertField(dayOfSeason, "dayOfSeason", WORLD_CLOCK_CASCADE.daysPerSeason - 1) + 1;
}

export function formatWorldClockTime(clockMinutes) {
  assertField(clockMinutes, "clockMinutes", MINUTES_PER_DAY - 1);
  const hours = Math.floor(clockMinutes / WORLD_CLOCK_CASCADE.minutesPerHour);
  const minutes = clockMinutes % WORLD_CLOCK_CASCADE.minutesPerHour;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** The four fields the original's info_bar draws, ready for presentation. */
export function projectWorldClockDisplay(clock) {
  const current = createWorldClock(clock);
  return deepFreeze({
    year: current.year,
    season: current.season,
    seasonName: worldSeasonName(current.season),
    dayOfSeason: current.dayOfSeason,
    dayNumber: worldDayNumber(current.dayOfSeason),
    clockMinutes: current.clockMinutes,
    clockUnits: current.clockUnits,
    clockSubunits: current.clockSubunits,
    time: formatWorldClockTime(current.clockMinutes)
  });
}
