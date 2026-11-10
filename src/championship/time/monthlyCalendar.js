// Monthly championship calendar -- OWNER_APPROVED_ADAPTATION 2026-11-10 (WEEKLY_SEASON_20261110).
//
// NOT original behaviour. The native cascade is 4 seasons x 8 days (championshipWorldClock.js) and stays the
// NATIVE policy. Under the real-time clock (REALTIME_V1) the Owner asked for one real week per season, so that the
// whole title calendar runs once a month:
//   days 1-7 spring, 8-14 summer, 15-21 autumn, 22-28 winter.
// A month longer than 28 days keeps winter going: days 29-31 are winter overtime and replay winter's last day.
// Each calendar month counts as one championship year (`year`), so the native "world championship every fourth
// year" (year % 4 === 3) comes round every fourth month. The year wraps at 96 so it stays under the native cap of
// 99 and keeps its remainder mod 4.

export const MONTHLY_DAYS_PER_SEASON = 7;
export const MONTHLY_SEASONS = 4;
/** Months counted from January 2026; wraps at a multiple of four under the native year cap 99. */
export const MONTHLY_YEAR_EPOCH = 2026;
export const MONTHLY_YEAR_WRAP = 96;

/** Calendar slots of a local date (device time). `overtime` is true on days 29-31. */
export function monthlyCalendarFor(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const dayOfMonth = date.getDate();
  const season = Math.min(MONTHLY_SEASONS - 1, Math.floor((dayOfMonth - 1) / MONTHLY_DAYS_PER_SEASON));
  const dayOfSeason = Math.min(MONTHLY_DAYS_PER_SEASON - 1, dayOfMonth - 1 - season * MONTHLY_DAYS_PER_SEASON);
  const months = (date.getFullYear() - MONTHLY_YEAR_EPOCH) * 12 + date.getMonth();
  const year = ((months % MONTHLY_YEAR_WRAP) + MONTHLY_YEAR_WRAP) % MONTHLY_YEAR_WRAP;
  return Object.freeze({year, season, dayOfSeason, dayOfMonth, overtime: dayOfMonth > MONTHLY_SEASONS * MONTHLY_DAYS_PER_SEASON,
    month: date.getMonth() + 1});
}

/** Whether a stored calendar already matches the date's slots. */
export function monthlyCalendarMatches(clock, target) {
  return Boolean(clock && target && clock.year === target.year && clock.season === target.season && clock.dayOfSeason === target.dayOfSeason);
}

/** First day of the month that `season`/`dayOfSeason` stands for (1-based), for copy such as 「每月 19 日」. */
export function monthlyDayOfMonth(season, dayOfSeason) {
  return season * MONTHLY_DAYS_PER_SEASON + dayOfSeason + 1;
}
