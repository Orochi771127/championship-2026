// WEEKLY_SEASON_FACTIONS_20261110: one real week per season, title matches by time slot, faction / race copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyCalendarFor } from '../src/championship/time/monthlyCalendar.js';
import { WEEKLY_TITLE_SCHEDULE, WEEKLY_CHAMPIONSHIP, assertWeeklyTitleSchedule, selectWeeklyEligibleMatches, weeklyTitleGrid,
  projectWeeklyRaisingCalendar } from '../src/championship/time/weeklyTitleSchedule.js';
import { getMatchRecord } from '../src/championship/battle/battleMatchSelection.js';
import { advanceRaisingHomeClock, createRaisingHomeInitialState } from '../src/championship/raising/raisingHomeDefinition.js';
import { nativeHuntRadarMask, productHuntRadarMatches } from '../src/championship/hunt/loadout/nativeHuntPluginRules.js';
import { speciesTaxonomy } from '../src/championship/contracts/speciesTaxonomy.js';
import { cageEffectLabel, titleEventText } from '../src/championship/text/zhHant.js';

const at = (iso) => new Date(iso).getTime();

test('a month runs four seven-day seasons and winter overtime', () => {
  assert.deepEqual(monthlyCalendarFor(at('2026-11-01T09:00')), { year: 10, season: 0, dayOfSeason: 0, dayOfMonth: 1, overtime: false, month: 11 });
  assert.equal(monthlyCalendarFor(at('2026-11-07T21:00')).season, 0);
  assert.deepEqual([monthlyCalendarFor(at('2026-11-08T09:00')).season, monthlyCalendarFor(at('2026-11-08T09:00')).dayOfSeason], [1, 0]);
  assert.deepEqual([monthlyCalendarFor(at('2026-11-19T09:00')).season, monthlyCalendarFor(at('2026-11-19T09:00')).dayOfSeason], [2, 4]);
  for (const day of [28, 29, 30]) {
    const c = monthlyCalendarFor(at(`2026-11-${day}T09:00`));
    assert.deepEqual([c.season, c.dayOfSeason, c.overtime], [3, 6, day > 28]);
  }
  // Every fourth month is a world-championship year; the year stays under the native cap 99.
  const worldMonths = Array.from({ length: 12 }, (_, m) => monthlyCalendarFor(new Date(2027, m, 3).getTime()).year % 4 === 3).filter(Boolean);
  assert.equal(worldMonths.length, 3);
  assert.ok(monthlyCalendarFor(new Date(2040, 0, 1).getTime()).year < 99);
});

test('all 61 scanned titles fit seven days without leaving their season', () => {
  assertWeeklyTitleSchedule();
  assert.equal(WEEKLY_TITLE_SCHEDULE.length, 61);
  const moved = WEEKLY_TITLE_SCHEDULE.filter((entry) => entry.nativeDayOfSeason === 7);
  assert.deepEqual(moved.map((entry) => entry.recordIndex).sort((a, b) => a - b), [3, 14, 25, 27, 29, 34, 35, 46, 49, 60]);
  for (const entry of WEEKLY_TITLE_SCHEDULE) assert.equal(entry.season, getMatchRecord(entry.recordIndex).field14);
  const grid = weeklyTitleGrid();
  assert.deepEqual(grid.map((days) => days.length), [7, 7, 7, 7]);
  assert.ok(grid.flat().every((day) => day.length <= 5), 'a day never offers more than the native five');
  assert.deepEqual(WEEKLY_CHAMPIONSHIP, { season: 2, dayOfSeason: 4, slot: 'ALL_DAY' });
});

test('a title opens only in its slot and keeps the native rank tier', () => {
  // Spring day 7: 挑戰齒輪 / 黑暗戰士 morning, 聖域戰士 afternoon, 決鬥女王 evening.
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: 8 * 60, progressCounter: 9 }), [22, 55]);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: 13 * 60, progressCounter: 9 }), [18]);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: 18 * 60, progressCounter: 9 }), [41]);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: 23 * 60, progressCounter: 9 }), []);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: 6 * 60, progressCounter: 9 }), []);
  // Rank 0 sees only tier-0 titles.
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 0, dayOfSeason: 6, minute: null, progressCounter: 0 }), [55]);
  // A single title is open all day; two split into the day slot and the evening.
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 1, dayOfSeason: 0, minute: 21 * 60 + 59, progressCounter: 9 }), [2]);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 3, dayOfSeason: 6, minute: 16 * 60, progressCounter: 9 }), [19]);
  assert.deepEqual(selectWeeklyEligibleMatches({ season: 3, dayOfSeason: 6, minute: 17 * 60, progressCounter: 9 }), [60]);
});

test('the day-change calendar counts seven days', () => {
  const c = projectWeeklyRaisingCalendar({ year: 10, season: 2, dayOfSeason: 4, progressCounter: 9, registered: [56], won: [5],
    championship: { stage: 1, entry: 1, worldEntry: 0 } });
  assert.equal(c.days.length, 7);
  assert.deepEqual(c.days[4], { day: 4, registered: 2, unwon: 1 });
  assert.equal(c.countdown, null);
});

test('the raising clock follows the device date and stays put when it already matches', () => {
  const start = createRaisingHomeInitialState();
  const aligned = advanceRaisingHomeClock(start, 0, 0, 400, true, { year: 10, season: 3, dayOfSeason: 6 });
  assert.deepEqual([aligned.year, aligned.season, aligned.dayOfSeason], [10, 3, 6]);
  assert.equal(aligned.clockRevision, start.clockRevision + 1);
  assert.equal(advanceRaisingHomeClock(aligned, 0, 0, 400, true, { year: 10, season: 3, dayOfSeason: 6 }), aligned);
  // Minutes and the calendar move together: the eight-day cascade never decides the day.
  const later = advanceRaisingHomeClock(aligned, 400 * 120, 0, 400, true, { year: 11, season: 0, dayOfSeason: 0 });
  assert.deepEqual([later.year, later.season, later.dayOfSeason], [11, 0, 0]);
  assert.throws(() => advanceRaisingHomeClock(aligned, 0, 0, 400, true, { year: 10, season: 4, dayOfSeason: 0 }));
});

test('the three alignment radars find factions, including former free partners', () => {
  const iron = nativeHuntRadarMask([4]), lumen = nativeHuntRadarMask([5]), rift = nativeHuntRadarMask([6]);
  let checked = 0;
  for (let index = 8; index < 229; index += 1) {
    const faction = speciesTaxonomy(index)?.faction ?? null;
    if (!faction) continue;
    assert.equal(productHuntRadarMatches(index, iron), faction === 'IRON', `iron ${index}`);
    assert.equal(productHuntRadarMatches(index, lumen), faction === 'LUMEN', `lumen ${index}`);
    assert.equal(productHuntRadarMatches(index, rift), faction === 'RIFT', `rift ${index}`);
    checked += 1;
  }
  assert.ok(checked > 150);
});

test('copy speaks of factions and races, never vaccine, data or virus', () => {
  assert.equal(cageEffectLabel('FAMILY_UP', 'ワクチン'), '心輝陣營聲望上升');
  assert.equal(cageEffectLabel('FAMILY_UP', 'データ'), '黑鐵陣營聲望上升');
  assert.equal(cageEffectLabel('FAMILY_UP', 'ウイルス'), '裂隙陣營聲望上升');
  assert.equal(cageEffectLabel('FAMILY_UP', 'トリ'), '羽翼族點數上升');
  assert.equal(titleEventText(29, 'name'), '裂隙獵殺者');
  assert.equal(titleEventText(31, 'name'), '黑鐵殺手');
  for (let index = 0; index < 61; index += 1) {
    assert.doesNotMatch(`${titleEventText(index, 'name')}${titleEventText(index, 'description')}`, /疫苗|病毒|資料屬性|種族，/);
  }
});
