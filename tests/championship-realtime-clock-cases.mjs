// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102, real time): the ranch on the device's clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type: 'json'};
import {REALTIME_AGE_UNITS_PER_SECOND,REALTIME_OFFLINE_CAP_SECONDS,realtimeAgeRate,isNightNap,localMinuteOfDay,offlineGrowthSeconds,
  realtimeClockAdvance,realtimeDayPeriod,realtimeRecoveryEffect,takeAgeUnits} from '../src/championship/time/realtimeClock.js';
import {nativeCageConditionEffects} from '../src/championship/raising/nativeRaisingOvernight.js';
import {SHOP_DESCRIPTIONS_ZH} from '../src/championship/text/catalogs.zhHant.js';
import {SHOP_DESCRIPTIONS_EN} from '../src/championship/text/catalogs.en.js';
import {SHOP_DESCRIPTIONS_JA} from '../src/championship/text/catalogs.ja.js';
import {SHOP_DESCRIPTIONS_TH} from '../src/championship/text/catalogs.th.js';
import {SHOP_DESCRIPTIONS_VI} from '../src/championship/text/catalogs.vi.js';
import cageDefinitions from '../src/data/championship/catalogs/cage-definitions.r1.json' with {type: 'json'};
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

test('egg hatch times (Owner 2026-11-09): the new game egg in 30 s, a reborn egg in 3 min', () => {
  assert.equal(61 / realtimeAgeRate(0, {starterEgg: true}), 30, 'the crack starts once the age passes 60');
  assert.equal(61 / realtimeAgeRate(0), 180);
  assert.equal(realtimeAgeRate(1, {starterEgg: true}), REALTIME_AGE_UNITS_PER_SECOND[1], 'only an egg takes the starter pace');
  const acc = new Map();
  let units = 0;
  for (let frame = 0; frame < 30 * 60; frame++) units += takeAgeUnits(acc, 'starter', realtimeAgeRate(0, {starterEgg: true}) / 60);
  assert.equal(units, 61, 'thirty seconds of frames pass the egg lifespan of 60 units');
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
  const make = (policy, options = {}) => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: species, clockPolicy: policy,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => new Date(clock.ms).toISOString(), ...options});
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

test('night disturbance: handling a sleeping partner costs 育成妨礙 and affection; care does not; once per wake', async () => {
  const clock = {ms: at(9)};
  const {data, cages, make} = harness(clock);
  const first = make('REALTIME_V1');
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  saved.raising.collection.forEach(entry => { entry.nativeProfile.fields['020'] = 50; entry.nativeProfile.narrowFields['03d'] = 0; });
  saved.updatedAt = new Date(at(23)).toISOString();
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  clock.ms = at(23);
  const app = make('REALTIME_V1');
  await app.continueGame();
  try {
    for (let i = 0; i < 120; i++) app.advanceNaturalClock({frames: 1});
    const asleep = saved.raising.collection.map(e => e.instanceId).filter(id => app.getRaisingActorFrame(id)?.state === 4);
    assert.ok(asleep.length >= 2, 'partners nap at 23:00');
    const stored = id => {
      app.save();
      const entry = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).raising.collection.find(c => c.instanceId === id);
      return {care: entry.nativeProfile.narrowFields['03d'], bond: entry.nativeProfile.fields['020']};
    };
    const events = [], off = app.subscribePartnerLife(event => events.push(event));
    const [a, b] = asleep;
    app.touchRaisingPartner(a);
    assert.notEqual(app.getRaisingActorFrame(a).state, 4, 'the tap wakes it');
    assert.deepEqual(stored(a), {care: 1, bond: 45}, '育成妨礙 +1 and affection -5');
    assert.ok(events.some(event => event.kind === 'disturbed' && event.partnerId === a));
    app.touchRaisingPartner(a);
    assert.deepEqual(stored(a), {care: 1, bond: 45}, 'awake for ten minutes: no second count');
    app.treatRaisingResident(b, 0);
    assert.notEqual(app.getRaisingActorFrame(b).state, 4, 'treatment wakes it too');
    assert.deepEqual(stored(b), {care: 0, bond: 50}, 'care never counts as 育成妨礙');
    off();
  } finally { await app.dispose(); }
});

test('night disturbance with the hand: one press counts once, its release is no extra tap, a refused hand wakes nobody', async () => {
  const clock = {ms: at(9)};
  const {data, cages, make} = harness(clock);
  const first = make('REALTIME_V1');
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  saved.raising.collection.forEach(entry => { entry.nativeProfile.fields['020'] = 50; entry.nativeProfile.narrowFields['03d'] = 0; });
  saved.updatedAt = new Date(at(23)).toISOString();
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  clock.ms = at(23);
  const app = make('REALTIME_V1', {partnerLife: true});
  await app.continueGame();
  try {
    for (let i = 0; i < 120; i++) app.advanceNaturalClock({frames: 1});
    const asleep = saved.raising.collection.map(e => e.instanceId).filter(id => app.getRaisingActorFrame(id)?.state === 4);
    assert.ok(asleep.length >= 2, 'partners nap at 23:00');
    const stored = id => {
      app.save();
      const entry = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).raising.collection.find(c => c.instanceId === id);
      return {care: entry.nativeProfile.narrowFields['03d'], bond: entry.nativeProfile.fields['020']};
    };
    const events = [], off = app.subscribePartnerLife(event => events.push(event));
    const [a, b] = asleep;
    assert.equal(app.beginRaisingHand(a, {x: 120, y: 100}), true, 'the hand takes hold');
    assert.deepEqual(stored(a), {care: 1, bond: 45}, 'picking it up is 育成妨礙');
    assert.equal(app.beginRaisingHand(b, {x: 160, y: 100}), false, 'a second hand is refused');
    assert.equal(app.getRaisingActorFrame(b).state, 4, 'and that partner sleeps on');
    assert.deepEqual(stored(b), {care: 0, bond: 50});
    const release = app.touchRaisingPartner(a);
    assert.equal(release?.disturbed, true, 'the tap on release belongs to the same press');
    assert.equal(release.gained, 0);
    assert.ok(!events.some(event => event.kind === 'tap'), 'no pleased emote over the cross one');
    assert.deepEqual(stored(a), {care: 1, bond: 45}, 'no second count and no pet');
    assert.equal(app.endRaisingHand(a), true);
    const before = stored(a);
    const pet = app.touchRaisingPartner(a);
    assert.equal(pet?.disturbed, undefined, 'awake now: a later tap is a normal one');
    assert.equal(pet.gained, 1);
    assert.deepEqual(stored(a), {care: 1, bond: before.bond + 1});
    assert.equal(events.filter(event => event.kind === 'disturbed').length, 1);
    off();
  } finally { await app.dispose(); }
});

// OWNER_APPROVED_ADAPTATION 2026-11-03: recovery cages heal on real time, not on the partner's age clock.
test('recovery cages on real time: full HP in about 10 / 7 / 4 minutes at any maximum HP', () => {
  const fullSeconds = (definition, maxHp) => {
    const hp = nativeCageConditionEffects(definition).find(e => e.kind === 1);
    return Math.ceil(maxHp / realtimeRecoveryEffect(hp, maxHp).delta) * hp.interval;
  };
  for (const maxHp of [300, 1090, 1600, 4800]) {
    assert.ok(fullSeconds(15, maxHp) <= 600 && fullSeconds(15, maxHp) > 480, `mini infirmary ${maxHp}: ${fullSeconds(15, maxHp)} s`);
    assert.ok(fullSeconds(28, maxHp) <= 400, `infirmary ${maxHp}`);
    assert.ok(fullSeconds(18, maxHp) <= 240, `hot spring ${maxHp}`);
  }
  const stress = nativeCageConditionEffects(15).find(e => e.kind === 2);
  assert.deepEqual(realtimeRecoveryEffect(stress, 1600), stress, 'stress keeps its native step');
});

test('REALTIME_V1: a partner at HP 57 in the mini infirmary heals fully and calms down within ten minutes', async () => {
  const clock = {ms: at(17, 40)};
  const {data, cages, make} = harness(clock);
  const first = make('REALTIME_V1');
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  const patient = saved.raising.collection[1];
  patient.nativeProfile.fields['050'] = 57; patient.nativeProfile.fields['01c'] = 60;
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  const app = make('REALTIME_V1');
  await app.continueGame();
  try {
    const id = patient.instanceId;
    let placed = false;
    for (let y = 4; y < 2000 && !placed; y += 8) for (let x = 4; x < 2000 && !placed; x += 8)
      placed = app.moveRaisingResidentToGround(id, {x, y}) && app.getRaisingActorFrame(id)?.cageDefinitionIndex === 15;
    assert.ok(placed, 'the QA save has a mini infirmary');
    const fields = () => { app.save(); return JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).raising.collection.find(e => e.instanceId === id).nativeProfile.fields; };
    const maxHp = fields()['058'];
    const minutes = n => { for (let s = 0; s < n * 60; s++) { clock.ms += 1000; app.advanceNaturalClock({frames: 60}); } };
    minutes(5);
    const half = fields();
    assert.ok(half['050'] > maxHp / 2 && half['050'] < maxHp, `half way after five minutes: ${half['050']}/${maxHp}`);
    minutes(5);
    const done = fields();
    assert.equal(done['050'], maxHp, 'full after ten minutes');
    assert.equal(done['01c'], 0, 'stress gone');
    assert.equal(done['13c'], 0, 'no longer collapsed');
  } finally { await app.dispose(); }
});

test('cage shop descriptions name the cage effect in every locale (no stray 防御力 copy)', () => {
  const defense = {ja: /防御力/, th: /พลังป้องกัน/, vi: /phòng thủ/};
  const tables = {ja: SHOP_DESCRIPTIONS_JA, th: SHOP_DESCRIPTIONS_TH, vi: SHOP_DESCRIPTIONS_VI};
  const beast = {zh: /獸種族上升/, en: /Raises the Beast family/, ja: /獣族適性/, th: /เผ่าสัตว์ป่า/, vi: /chủng tộc dã thú/};
  const recover = {zh: /回復生命值/, en: /Recovers HP/, ja: /HPが回復/, th: /ฟื้นฟู HP/, vi: /Hồi HP/};
  for (const cage of cageDefinitions.records.filter(c => c.playerFacing && Number.isInteger(c.shopRecordIndex))) {
    const isDefense = cage.effect.kind === 'STAT_UP' && cage.effect.target === 'DEFENSE';
    for (const [locale, table] of Object.entries(tables))
      assert.equal(defense[locale].test(table[cage.shopRecordIndex]), isDefense, `${locale} cage ${cage.cageIndex}: ${table[cage.shopRecordIndex]}`);
    // DIAMOND_ECONOMY_20261102: the Bits shop zoo and ranch train the beast family instead of caring automatically.
    if (cage.effect.kind === 'AUTO_CARE')
      for (const [locale, table] of Object.entries({zh: SHOP_DESCRIPTIONS_ZH, en: SHOP_DESCRIPTIONS_EN, ...tables}))
        assert.match(table[cage.shopRecordIndex], beast[locale], `${locale} cage ${cage.cageIndex}: ${table[cage.shopRecordIndex]}`);
    if (cage.effect.kind === 'RECOVER')
      for (const [locale, table] of Object.entries({zh: SHOP_DESCRIPTIONS_ZH, en: SHOP_DESCRIPTIONS_EN, ...tables}))
        assert.match(table[cage.shopRecordIndex], recover[locale], `${locale} cage ${cage.cageIndex}`);
  }
});

test('night: a partner fresh out of its egg stays up for the wake window, then naps', async () => {
  // Owner 2026-11-03: at 22:59 a new partner hatched straight into its night nap.
  const clock = {ms: at(23)};
  const {make} = harness(clock);
  const app = make('REALTIME_V1');
  await app.newGame();
  try {
    const id = app.getRaisingInstances()[0].instanceId;
    assert.equal(app.getDayPeriod().nightNap, true);
    for (let i = 0; i < 3; i++) { assert.equal(app.touchRaisingEgg(id), true); app.advanceNaturalClock({frames: 1}); }
    for (let i = 0; i < 60 && app.getRaisingActorFrame(id)?.speciesIndex < 8; i++) app.advanceNaturalClock({frames: 60});
    assert.ok(app.getRaisingActorFrame(id).speciesIndex >= 8, 'hatched');
    for (let i = 0; i < 240; i++) app.advanceNaturalClock({frames: 1});
    assert.notEqual(app.getRaisingActorFrame(id).state, 4, 'awake right after hatching');
    clock.ms += 11 * 60_000;
    for (let i = 0; i < 600 && app.getRaisingActorFrame(id).state !== 4; i++) app.advanceNaturalClock({frames: 1});
    assert.equal(app.getRaisingActorFrame(id).state, 4, 'naps once the wake window has passed');
  } finally { await app.dispose(); }
});

test('REALTIME_V1: a hunt starts at 00:41 and 01:59, before the original 02:00 day (CI found Start doing nothing then)', async () => {
  for (const [hour, minute] of [[0, 41], [1, 59], [13, 0]]) {
    const clock = {ms: at(hour, minute)};
    const {make} = harness(clock);
    const app = make('REALTIME_V1');
    await app.newGame();
    try {
      app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === 'Grass').gateId); app.confirmGate();
      assert.equal(await app.beginHunt(), 'HUNT_FIELD', `${hour}:${minute}`);
      assert.equal(app.getHuntEntryError(), null);
    } finally { await app.dispose(); }
  }
});
