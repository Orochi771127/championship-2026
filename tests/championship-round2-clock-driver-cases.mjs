import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createChampionshipClockDriver } from "../src/championship/app/championshipClockDriver.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    writes: 0,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-09-05T13:00:00.000Z" });
}

function clock(app) {
  const snapshot = app.getSnapshot();
  return Object.fromEntries(["year", "season", "dayOfSeason", "clockMinutes", "clockUnits", "clockSubunits"].map((key) => [key, snapshot[key]]));
}

function driverHarness(app, { active = true } = {}) {
  const listeners = new Set();
  const flags = { visible: true, contextLost: false, modal: false };
  let milliseconds = 0;
  const ticker = {
    adds: 0, removes: 0,
    add(listener) { this.adds += 1; listeners.add(listener); },
    remove(listener) { this.removes += 1; listeners.delete(listener); }
  };
  const driver = createChampionshipClockDriver({
    app, ticker, now: () => milliseconds,
    isVisible: () => flags.visible,
    isContextLost: () => flags.contextLost,
    isModalOpen: () => flags.modal
  });
  driver.setActive(active);
  return {
    driver, ticker, flags,
    tickAt(value) { milliseconds = value; for (const listener of [...listeners]) listener(); },
    listenerCount() { return listeners.size; }
  };
}

test("the same seven seconds at 30/60/120 presentation fps yield one nominal native Training clock", async () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const storage = memoryStorage();
    const app = createApp(storage);
    await app.newGame();
    const residents = app.getSnapshot().residents;
    const raising = app.getRaisingState();
    const harness = driverHarness(app);
    harness.tickAt(0);
    for (let frame = 1; frame <= fps * 7; frame += 1) harness.tickAt(frame * 1000 / fps);
    results.push(clock(app));
    assert.deepEqual(app.getSnapshot().residents, residents);
    assert.deepEqual(app.getRaisingState(), raising);
    assert.equal(app.getSnapshot().tick, 0);
    assert.equal(storage.writes, 0);
    assert.equal(harness.ticker.adds, 1);
    harness.driver.dispose();
    assert.equal(harness.listenerCount(), 0);
    assert.equal(harness.ticker.removes, 1);
    await app.dispose();
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
  // Independent receipt from the traced hardware cadence and raw divisor 200.
  const nativeFrames = Number(7000000n * 33513982n / (560190n * 1000000n));
  const rawUnits = nativeFrames * 16;
  assert.deepEqual(results[0], { year: 0, season: 0, dayOfSeason: 0, clockMinutes: 420 + Math.floor(rawUnits / 200), clockUnits: rawUnits % 200, clockSubunits: 0 });
});

test("manual save restores accepted raw clock precision without offline accrual or another save key", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const harness = driverHarness(app);
  harness.tickAt(0);
  harness.tickAt(1000);
  // Exercise the durable browser-precision field through the same app seam.
  assert.equal(app.advanceClock({ units: 0, subunits: 777, divisor: 200 }).accepted, true);
  const savedClock = clock(app);
  assert.ok(savedClock.clockUnits > 0);
  assert.equal(storage.writes, 0);
  assert.equal(app.save().phase, "SAVED");
  assert.equal(storage.writes, 1);
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  harness.driver.dispose();
  await app.dispose();
  const restored = createApp(storage);
  assert.ok(await restored.continueGame());
  assert.deepEqual(clock(restored), savedClock);
  const fresh = driverHarness(restored);
  fresh.tickAt(7200000);
  assert.deepEqual(clock(restored), savedClock, "restored driver establishes a fresh measurement baseline");
  fresh.tickAt(7200020);
  assert.equal(restored.getSnapshot().clockSubunits, 777);
  assert.equal(restored.getSnapshot().clockMinutes, savedClock.clockMinutes);
  assert.equal(restored.getSnapshot().clockUnits, savedClock.clockUnits + 16);
  assert.equal(storage.writes, 1, "elapsed clock updates never create automatic checkpoints");
  fresh.driver.dispose();
  await restored.dispose();
});

test("inactive, hidden, modal and lost-context drivers discard suspended elapsed baselines", async () => {
  for (const guard of ["inactive", "hidden", "modal", "contextLost"]) {
    const storage = memoryStorage();
    const app = createApp(storage);
    await app.newGame();
    const harness = driverHarness(app);
    harness.tickAt(0);
    harness.tickAt(20);
    const before = clock(app);
    if (guard === "inactive") harness.driver.setActive(false);
    else if (guard === "hidden") harness.flags.visible = false;
    else harness.flags[guard] = true;
    harness.tickAt(10000);
    assert.deepEqual(clock(app), before, `${guard} cannot advance time`);
    if (guard === "inactive") harness.driver.setActive(true);
    else if (guard === "hidden") harness.flags.visible = true;
    else harness.flags[guard] = false;
    harness.tickAt(10001);
    assert.deepEqual(clock(app), before, `${guard} resume cannot catch up`);
    harness.tickAt(10021);
    assert.equal(app.getSnapshot().clockUnits, before.clockUnits + 16);
    assert.equal(storage.writes, 0);
    harness.driver.dispose();
    await app.dispose();
  }
});

test("long or invalid measured gaps never jump the calendar", async () => {
  const app = createApp();
  await app.newGame();
  const harness = driverHarness(app);
  harness.tickAt(0);
  harness.tickAt(20);
  const before = clock(app);
  harness.tickAt(2021);
  assert.deepEqual(clock(app), before, "an event-loop gap beyond the bounded driver window is suspended");
  harness.tickAt(2041);
  assert.equal(app.getSnapshot().clockUnits, before.clockUnits + 16);
  const after = clock(app);
  harness.tickAt(NaN);
  harness.tickAt(100000);
  assert.deepEqual(clock(app), after, "invalid timestamp cannot poison the next baseline");
  harness.tickAt(99990);
  assert.deepEqual(clock(app), after, "backward timestamp cannot subtract or accrue time");
  harness.tickAt(100010);
  assert.equal(app.getSnapshot().clockUnits, after.clockUnits + 16);
  harness.driver.dispose();
  await app.dispose();
});

test("unknown Schedule mode gates time and returning Home never catches up its elapsed interval", async () => {
  const app = createApp();
  await app.newGame();
  const harness = driverHarness(app);
  harness.tickAt(0);
  harness.tickAt(20);
  const before = clock(app);
  app.openSchedule();
  assert.equal(app.getClockRunState().reason, "MODE_REQUIRES_TRACE");
  harness.tickAt(10000);
  assert.deepEqual(clock(app), before, "unknown mode neither advances nor invents a raw-stop writer");
  app.leaveScreen();
  harness.tickAt(10001);
  assert.deepEqual(clock(app), before);
  harness.tickAt(10021);
  assert.equal(app.getSnapshot().clockUnits, before.clockUnits + 16);
  assert.equal(harness.ticker.adds, 1);
  harness.driver.dispose();
  await app.dispose();
});

test("verified Training and Shop transitions clear only elapsed remainder through the existing clock", async () => {
  const app = createApp();
  await app.newGame();
  app.advanceClock({ units: 199, subunits: 123, divisor: 200 });
  const before = clock(app);
  const residents = app.getSnapshot().residents;
  app.openShop();
  assert.equal(app.getSnapshot().clockMinutes, before.clockMinutes);
  assert.equal(app.getSnapshot().clockUnits, 0);
  assert.equal(app.getSnapshot().clockSubunits, 0);
  assert.equal(app.getClockRunState().running, false);
  // This controlled API update proves the independently verified return stop.
  app.advanceClock({ units: 10, divisor: 400 });
  app.leaveScreen();
  assert.equal(app.getSnapshot().clockUnits, 0);
  assert.equal(app.getSnapshot().clockMinutes, before.clockMinutes);
  assert.deepEqual(app.getSnapshot().residents, residents);
  await app.dispose();
});

test("New Game and Continue replace session identity without replaying old elapsed frames", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const harness = driverHarness(app);
  harness.tickAt(0);
  harness.tickAt(1000);
  const oldSession = app.getSession();
  await app.newGame();
  assert.notEqual(app.getSession(), oldSession);
  const newClock = clock(app);
  harness.tickAt(100000);
  assert.deepEqual(clock(app), newClock);
  harness.tickAt(100020);
  const checkpoint = clock(app);
  app.save();
  harness.tickAt(101020);
  assert.notDeepEqual(clock(app), checkpoint);
  const previousSession = app.getSession();
  await app.continueGame();
  assert.notEqual(app.getSession(), previousSession);
  assert.deepEqual(clock(app), checkpoint);
  harness.tickAt(500000);
  assert.deepEqual(clock(app), checkpoint);
  harness.tickAt(500020);
  assert.equal(app.getSnapshot().clockUnits, checkpoint.clockUnits + 16);
  assert.equal(harness.ticker.adds, 1, "session replacement reuses one driver on one injected ticker");
  harness.driver.dispose();
  await app.dispose();
});

test("22:00 stops the clock then the active Raising scene closes the calendar day exactly once", async () => {
  for (const rawRemainder of [199, 300]) {
    const app = createApp();
    await app.newGame();
    app.advanceClock({ units: (1319 - 420) * 400 + rawRemainder });
    const residents = app.getSnapshot().residents;
    const harness = driverHarness(app);
    harness.tickAt(0);
    harness.tickAt(20);
    assert.deepEqual(clock(app), { year: 0, season: 0, dayOfSeason: 0, clockMinutes: 1320, clockUnits: 0, clockSubunits: 0 });
    assert.equal(app.getClockRunState().reason, "DAY_END");
    const atDayEnd = clock(app);
    harness.flags.modal=true;
    harness.tickAt(1000);
    assert.deepEqual(clock(app),atDayEnd,'a modal cannot advance a restored or newly reached day end');
    harness.flags.modal=false;
    harness.tickAt(1010);
    assert.deepEqual(clock(app), {year:0,season:0,dayOfSeason:1,clockMinutes:420,clockUnits:0,clockSubunits:0});
    harness.tickAt(1020);
    assert.equal(app.getSnapshot().dayOfSeason,1);
    harness.tickAt(1040);
    assert.equal(app.getSnapshot().clockUnits,0,'the original day transition pauses calendar time');
    for(let time=1060;time<=1500;time+=20)harness.tickAt(time);
    assert.equal(app.getRaisingLifecycleFrame().day.phase,'calendar');
    assert.equal(app.getSnapshot().clockUnits,0,'OVL1 waits for confirmation without advancing the next day');
    assert.equal(app.acknowledgeRaisingCalendar(),true);
    for(let time=1520;time<=2120;time+=20)harness.tickAt(time);
    assert.ok(app.getSnapshot().clockUnits>0,'next day resumes the same elapsed driver after save and fade');
    assert.deepEqual(app.getSnapshot().residents, residents);
    assert.equal(app.getSnapshot().tick, 0);
    harness.driver.dispose();
    await app.dispose();
  }
});

test("more than 256 natural clock publications leave selection, relocation and End Day usable", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  const initial = app.getSnapshot();
  const identity = app.getInstanceIdentityState();
  const harness = driverHarness(app);
  let clockPublications = 0;
  const unsubscribe = app.getSession().subscribeRaisingHome((publication) => {
    if (publication.kind === "clock") clockPublications += 1;
  });
  harness.tickAt(0);
  for (let frame = 1; frame <= 600; frame += 1) harness.tickAt(frame * 1000 / 60);
  assert.ok(clockPublications > 256);
  assert.equal(app.getInteractionCount(), 0);
  assert.equal(app.getSnapshot().tick, 0);
  assert.deepEqual(app.getSnapshot().residents, initial.residents);
  assert.deepEqual(app.getInstanceIdentityState(), identity);
  const residentId = initial.residents[0].residentId;
  assert.equal(app.select(residentId), residentId);
  const cageId = presentation.cages[1].cageId;
  assert.equal(app.moveToCage(residentId, cageId).assignments[residentId], cageId);
  assert.equal(app.endDay().accepted, true);
  assert.deepEqual(clock(app), { year: 0, season: 0, dayOfSeason: 1, clockMinutes: 420, clockUnits: 0, clockSubunits: 0 });
  assert.deepEqual(app.getSnapshot().residents, initial.residents);
  assert.equal(storage.writes, 0);
  unsubscribe();
  harness.driver.dispose();
  await app.dispose();
});
