// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102, real time): the ranch on the device's clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type: 'json'};
import {REALTIME_AGE_UNITS_PER_SECOND,REALTIME_OFFLINE_CAP_SECONDS,isNightNap,localMinuteOfDay,offlineGrowthSeconds,
  realtimeClockAdvance,realtimeDayPeriod,takeAgeUnits} from '../src/championship/time/realtimeClock.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';

const HOUR = 3_600_000;
// A local time of day on a fixed local date, independent of the machine's time zone.
const at = (hour, minute = 0, dayOffset = 0) => new Date(2026, 10, 2 + dayOffset, hour, minute, 0).getTime();

test('the clock moves to the device time: same day, across midnight, never backwards', () => {
  assert.equal(realtimeClockAdvance({clockMinutes: 13 * 60, lastMs: at(13), nowMs: at(15, 30)}), 150);
  assert.equal(realtimeClockAdvance({clockMinutes: 23 * 60, lastMs: at(23), nowMs: at(1, 0, 1)}), 120);
  assert.equal(realtimeClockAdvance({clockMinutes: 9 * 60, lastMs: at(9), nowMs: at(9, 0, 3)}), 3 * 1440);
  assert.equal(realtimeClockAdvance({clockMinutes: 21 * 60, lastMs: at(10), nowMs: at(10), rollForward: true}), 13 * 60, 'on loading, a clock ahead moves on to the next day');
  assert.equal(realtimeClockAdvance({clockMinutes: 21 * 60, lastMs: at(10), nowMs: at(10)}), 0, 'while playing it waits instead');
  assert.equal(realtimeClockAdvance({clockMinutes: 12 * 60, lastMs: at(12), nowMs: at(11)}), 0, 'a device clock set back never rewinds the world');
});

test('the night nap is 22:00-07:00; four parts of the day; offline growth counts at most twelve hours', () => {
  assert.deepEqual([21 * 60 + 59, 22 * 60, 3 * 60, 6 * 60 + 59, 7 * 60].map(isNightNap), [false, true, true, true, false]);
  assert.deepEqual([6 * 60, 12 * 60, 18 * 60, 23 * 60].map(realtimeDayPeriod), ['MORNING', 'DAY', 'DUSK', 'NIGHT']);
  assert.equal(offlineGrowthSeconds(at(8), at(10)), 7200);
  assert.equal(offlineGrowthSeconds(at(8), at(8, 0, 2)), REALTIME_OFFLINE_CAP_SECONDS);
  assert.equal(offlineGrowthSeconds(at(10), at(8)), 0);
});

test('growth pace: an egg reaches 成熟期 in about a day and a half of real time', () => {
  const life = generation => lifecycle.species[species.records.findIndex((r, i) => i >= 8 && r.generationIndex === generation)].life;
  const seconds = 60 / REALTIME_AGE_UNITS_PER_SECOND[0] + [1, 2, 3].reduce((sum, g) => sum + life(g) / REALTIME_AGE_UNITS_PER_SECOND[g], 0);
  assert.ok(seconds > 1.3 * 86400 && seconds < 1.6 * 86400, `${(seconds / 86400).toFixed(2)} days`);
  assert.ok(life(1) / REALTIME_AGE_UNITS_PER_SECOND[1] <= 1800 + 1, '幼年期 I about thirty minutes');
  const acc = new Map();
  let units = 0;
  for (let frame = 0; frame < 75; frame++) units += takeAgeUnits(acc, 'p', 0.8 / 60);
  assert.equal(units, 1, '0.8 units a second is one unit every 75 frames');
});

function harness(clock) {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const cages = JSON.parse(readFileSync('docs/contracts/championship/raising-home-presentation.v1.json', 'utf8')).cages;
  const make = policy => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: species, clockPolicy: policy,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => new Date(clock.ms).toISOString()});
  return {data, cages, make};
}

test('REALTIME_V1: the ranch clock is the device time, runs past 22:00 and rolls the calendar at midnight', async () => {
  const clock = {ms: at(13, 20)};
  const {make} = harness(clock);
  const app = make('REALTIME_V1');
  try {
    await app.newGame();
    assert.equal(app.getClockPolicy(), 'REALTIME_V1');
    assert.equal(app.getCalendar().clockMinutes, localMinuteOfDay(clock.ms));
    clock.ms = at(21, 59);
    app.advanceNaturalClock({frames: 1});
    assert.equal(app.getCalendar().clockMinutes, 21 * 60 + 59);
    const day = app.getCalendar().dayOfSeason;
    clock.ms = at(22, 30);
    app.advanceNaturalClock({frames: 1});
    assert.equal(app.getClockRunState().reason, 'NORMAL_RAISING', 'no 22:00 day end');
    assert.equal(app.getDayPeriod().nightNap, true);
    clock.ms = at(0, 15, 1);
    app.advanceNaturalClock({frames: 1});
    assert.equal(app.getCalendar().clockMinutes, 15);
    assert.equal(app.getCalendar().dayOfSeason, (day + 1) % 8, 'midnight starts the next day');
  } finally { await app.dispose(); }
});

test('NATIVE stays the default: the fast clock still stops at 22:00', async () => {
  const clock = {ms: at(13, 20)};
  const {make} = harness(clock);
  const app = make(undefined);
  try {
    await app.newGame();
    assert.equal(app.getClockPolicy(), 'NATIVE');
    assert.equal(app.getCalendar().clockMinutes, 7 * 60);
    assert.equal(app.getDayPeriod(), null);
  } finally { await app.dispose(); }
});

test('REALTIME_V1 load: up to twelve hours of growth while closed, partners nap at night, a touch wakes one, rest lays them down', async () => {
  const clock = {ms: at(9)};
  const {data, cages, make} = harness(clock);
  const first = make('REALTIME_V1');
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  // One partner is a 成長期 with no age yet; the save was written twenty hours ago.
  const grower = saved.raising.collection[0];
  grower.nativeProfile.fields['000'] = 34; grower.speciesId = 'species-034'; grower.nativeProfile.fields['18c'] = 0;
  saved.updatedAt = new Date(at(9) - 20 * HOUR).toISOString();
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  clock.ms = at(23);
  const app = make('REALTIME_V1');
  await app.continueGame();
  try {
    const profileOf = id => app.getRaisingInstances().find(e => e.instanceId === id);
    const life = lifecycle.species[34].life;
    const grown = Math.min(life, Math.floor(REALTIME_AGE_UNITS_PER_SECOND[3] * REALTIME_OFFLINE_CAP_SECONDS));
    assert.equal(app.getCalendar().clockMinutes, 23 * 60, 'the clock shows the device time after loading');
    const stored = () => { app.save(); return JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).raising.collection.find(e => e.instanceId === grower.instanceId).nativeProfile.fields['18c']; };
    assert.ok(stored() >= grown, `twelve hours of 成長期 growth (${stored()} >= ${grown})`);
    assert.ok(profileOf(grower.instanceId));
    // Night: idle partners lie down within a few frames.
    for (let i = 0; i < 120; i++) app.advanceNaturalClock({frames: 1});
    const ids = saved.raising.collection.slice(1).map(e => e.instanceId);
    const states = () => ids.map(id => app.getRaisingActorFrame(id)?.state);
    assert.ok(states().filter(s => s === 4).length >= 3, `most partners asleep at night: ${states()}`);
    const napper = ids.find(id => app.getRaisingActorFrame(id)?.state === 4);
    app.touchRaisingPartner(napper);
    assert.notEqual(app.getRaisingActorFrame(napper).state, 4, 'a touch wakes it');
    for (let i = 0; i < 60; i++) app.advanceNaturalClock({frames: 1});
    assert.notEqual(app.getRaisingActorFrame(napper).state, 4, 'and it stays up for a while');
    // Day: 「讓拍檔休息」 lays the idle ones down without moving the clock.
    clock.ms = at(11, 0, 1);
    app.advanceNaturalClock({frames: 1});
    const before = app.getCalendar().clockMinutes;
    assert.equal(app.endDay().code, 'REST');
    assert.equal(app.getCalendar().clockMinutes, before);
  } finally { await app.dispose(); }
});
