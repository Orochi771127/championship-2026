import assert from "node:assert/strict";
import test from "node:test";

import {
  DAYS_PER_YEAR,
  DAY_START_MINUTES,
  MINUTES_PER_DAY,
  UNITS_PER_DAY,
  WORLD_CLOCK_CASCADE,
  WORLD_SEASONS,
  advanceWorldClock,
  createWorldClock,
  endWorldClockDay,
  formatWorldClockTime,
  projectWorldClockDisplay,
  worldDayNumber,
  worldMinutesForRealSeconds,
  worldSeasonName
} from "../src/championship/time/championshipWorldClock.js";

test("the cascade is the five words read from ARM9 0x020C8A4C", () => {
  assert.deepEqual(WORLD_CLOCK_CASCADE, {
    seasonsPerYear: 4,
    daysPerSeason: 8,
    hoursPerDay: 24,
    minutesPerHour: 60,
    unitsPerMinute: 400
  });
  // The derived figures the contract quotes, so a silent edit to the cascade fails here.
  assert.equal(MINUTES_PER_DAY, 1440);
  assert.equal(DAYS_PER_YEAR, 32);
  assert.equal(UNITS_PER_DAY, 576000);
});

test("season order matches the four palettes OVL1 loads", () => {
  assert.deepEqual([...WORLD_SEASONS], ["Spring", "Summer", "Autumn", "Winter"]);
  assert.equal(worldSeasonName(0), "Spring");
  assert.equal(worldSeasonName(3), "Winter");
});

test("a clock refuses values outside the cascade", () => {
  assert.throws(() => createWorldClock({ season: 4 }), /season/);
  assert.throws(() => createWorldClock({ dayOfSeason: 8 }), /dayOfSeason/);
  assert.throws(() => createWorldClock({ clockMinutes: 1440 }), /clockMinutes/);
  assert.throws(() => createWorldClock({ year: -1 }), /year/);
  // The last legal value of each is accepted, so the bound is not off by one.
  const edge = createWorldClock({ season: 3, dayOfSeason: 7, clockMinutes: 1439 });
  assert.equal(edge.clockMinutes, 1439);
});

test("advancing rolls minutes into days, days into seasons, seasons into years", () => {
  const start = createWorldClock({ year: 0, season: 0, dayOfSeason: 0, clockMinutes: 0 });

  const sameDay = advanceWorldClock(start, 90);
  assert.deepEqual({ ...sameDay }, { year: 0, season: 0, dayOfSeason: 0, clockMinutes: 90, clockUnits: 0, clockSubunits: 0 });

  const nextDay = advanceWorldClock(start, MINUTES_PER_DAY);
  assert.equal(nextDay.dayOfSeason, 1);
  assert.equal(nextDay.clockMinutes, 0);

  // Eight days is one season.
  const nextSeason = advanceWorldClock(start, MINUTES_PER_DAY * 8);
  assert.equal(nextSeason.season, 1);
  assert.equal(nextSeason.dayOfSeason, 0);

  // Thirty-two days is one year, and there are no weeks or months in between.
  const nextYear = advanceWorldClock(start, MINUTES_PER_DAY * DAYS_PER_YEAR);
  assert.deepEqual({ ...nextYear }, { year: 1, season: 0, dayOfSeason: 0, clockMinutes: 0, clockUnits: 0, clockSubunits: 0 });
});

test("a single advance can cross every level at once", () => {
  const start = createWorldClock({ year: 2, season: 3, dayOfSeason: 7, clockMinutes: MINUTES_PER_DAY - 1 });
  const rolled = advanceWorldClock(start, 1);
  assert.deepEqual({ ...rolled }, { year: 3, season: 0, dayOfSeason: 0, clockMinutes: 0, clockUnits: 0, clockSubunits: 0 });
});

test("advancing is arithmetic, so a very large jump is exact and does not spin", () => {
  const start = createWorldClock({ year: 0, clockMinutes: 0 });
  const jump = MINUTES_PER_DAY * DAYS_PER_YEAR * 500;
  const rolled = advanceWorldClock(start, jump);
  assert.deepEqual({ ...rolled }, { year: 99, season: 0, dayOfSeason: 0, clockMinutes: 0, clockUnits: 0, clockSubunits: 0 });
});

test("End Day lands on the next day's start hour and rolls the cascade with it", () => {
  const evening = createWorldClock({ season: 0, dayOfSeason: 7, clockMinutes: 22 * 60 });
  const ended = endWorldClockDay(evening);
  assert.equal(ended.clockMinutes, DAY_START_MINUTES);
  assert.equal(ended.dayOfSeason, 0, "day 7 is the last of a season");
  assert.equal(ended.season, 1);

  // Ending a day before the start hour still advances a whole day, never zero.
  const earlyMorning = createWorldClock({ dayOfSeason: 0, clockMinutes: 1 });
  const next = endWorldClockDay(earlyMorning);
  assert.equal(next.dayOfSeason, 1);
  assert.equal(next.clockMinutes, DAY_START_MINUTES);
});

test("the display projection is what info_bar draws", () => {
  const display = projectWorldClockDisplay({ year: 1, season: 1, dayOfSeason: 4, clockMinutes: 16 * 60 + 10 });
  assert.equal(display.seasonName, "Summer");
  assert.equal(display.dayNumber, 5, "days are shown 1-based");
  assert.equal(display.time, "16:10");
  assert.equal(display.dayOfSeason, 4, "the stored slot stays 0-based");
});

test("clock formatting is zero padded on both halves", () => {
  assert.equal(formatWorldClockTime(0), "00:00");
  assert.equal(formatWorldClockTime(9 * 60 + 40), "09:40");
  assert.equal(formatWorldClockTime(MINUTES_PER_DAY - 1), "23:59");
});

test("day numbering never renders the raw slot", () => {
  assert.equal(worldDayNumber(0), 1);
  assert.equal(worldDayNumber(7), 8);
  assert.throws(() => worldDayNumber(8), /dayOfSeason/);
});

test("real seconds convert through the product tuning knob", () => {
  // The knob says a world day is ten real minutes, so half of that is half a day.
  assert.equal(worldMinutesForRealSeconds(300), MINUTES_PER_DAY / 2);
  assert.equal(worldMinutesForRealSeconds(0), 0);
  assert.throws(() => worldMinutesForRealSeconds(-1), /realSeconds/);
});
