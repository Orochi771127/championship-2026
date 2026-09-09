import assert from "node:assert/strict";
import test from "node:test";
import { advanceWorldClockUnits, createWorldClock, endWorldClockDay, projectWorldClockDisplay, UNITS_PER_DAY } from "../src/championship/time/championshipWorldClock.js";
import { createRaisingHomeRuntime } from "../src/championship/raising/createRaisingHomeRuntime.js";
import { createRaisingHomeInitialState, RAISING_HOME_COMMANDS } from "../src/championship/raising/raisingHomeDefinition.js";
import { createRaisingHomeSaveDocumentR2, deserializeRaisingHomeSaveR2, digestCanonicalRaisingHomeDataR2, restoreRaisingHomeSnapshotR2, serializeRaisingHomeSaveR2, stageRaisingResidentRelease } from "../src/championship/raising/raisingHomePersistenceR2.js";
import { createChampionshipSaveCoordinatorR2 } from "../src/championship/kernel/ChampionshipSaveCoordinatorR2.js";
import { createChampionshipSavePortR2 } from "../src/championship/kernel/ChampionshipSavePortR2.js";

function advance(runtime, units, subunits = 0) {
  return runtime.advanceClock({ units, subunits, expectedClockRevision: runtime.getSnapshot().clockRevision });
}

test("integer sub-minute arithmetic carries every calendar slot without rounding or invented history", () => {
  const start = createWorldClock({ year: 98, season: 3, dayOfSeason: 7, clockMinutes: 1439, clockUnits: 399, clockSubunits: 999 });
  assert.deepEqual(advanceWorldClockUnits(start, 0, { subunits: 1 }), { year: 99, season: 0, dayOfSeason: 0, clockMinutes: 0, clockUnits: 0, clockSubunits: 0 });
  const unknown = advanceWorldClockUnits({ ...start, year: null }, UNITS_PER_DAY * 32);
  assert.equal(unknown.year, null);
  assert.equal(unknown.season, 3);
  const noDate = advanceWorldClockUnits({ year: null, season: null, dayOfSeason: null, clockMinutes: 1439 }, 400);
  assert.equal(noDate.clockMinutes, 0);
  assert.equal(noDate.season, null);
  assert.equal(noDate.dayOfSeason, null);
  assert.equal(projectWorldClockDisplay(noDate).dayNumber, null);
  assert.equal(projectWorldClockDisplay(noDate).seasonName, null);
});

test("clock units are exact across 30/60/120 frame chunks using absolute microsecond deltas", () => {
  function simulate(fps) {
    let clock = createWorldClock({ year: 4, clockMinutes: 1438 });
    let previous = 0;
    for (let frame = 1; frame <= fps * 3; frame += 1) {
      const now = Math.round(frame * 1000000 / fps);
      const delta = now - previous;
      clock = advanceWorldClockUnits(clock, Math.floor(delta / 1000), { subunits: delta % 1000 });
      previous = now;
    }
    return clock;
  }
  const expected = advanceWorldClockUnits(createWorldClock({ year: 4, clockMinutes: 1438 }), 3000);
  for (const fps of [30, 60, 120]) assert.deepEqual(simulate(fps), expected);
});

test("Training divisor consumes the raw saved remainder without scene-dependent scaling", () => {
  // Synthetic arithmetic/storage edge. Original Training entry/exit wrappers
  // clear the raw accumulator; this does not model those stop side effects.
  const initial = createRaisingHomeInitialState();
  const runtime = createRaisingHomeRuntime({ initialSnapshot: { ...initial, clockUnits: 300 } });
  const entered = runtime.advanceClock({ units: 16, divisor: 200, expectedClockRevision: 0 });
  assert.equal(entered.accepted, true);
  assert.equal(entered.snapshot.clockMinutes, 421);
  assert.equal(entered.snapshot.clockUnits, 116);
  assert.equal(entered.snapshot.clockSubunits, 0);
  const exited = runtime.advanceClock({ units: 16, divisor: 400, expectedClockRevision: 1 });
  assert.equal(exited.accepted, true);
  assert.equal(exited.snapshot.clockMinutes, 421);
  assert.equal(exited.snapshot.clockUnits, 132);
  const saved = deserializeRaisingHomeSaveR2(serializeRaisingHomeSaveR2(exited.snapshot).serialized);
  assert.equal(saved.durableState.clockUnits, 132);
  assert.equal(Object.hasOwn(saved.durableState, "divisor"), false);
  assert.equal(runtime.advanceClock({ units: 16, divisor: 100, expectedClockRevision: 2 }).accepted, false);
  const second = createRaisingHomeRuntime({ initialSnapshot: { ...initial, clockUnits: 300 } });
  const zero = second.advanceClock({ units: 0, divisor: 200, expectedClockRevision: 0 });
  assert.equal(zero.code, "RAISING_HOME_CLOCK_NO_CHANGE");
  assert.equal(second.getSnapshot().clockUnits, 300);
});

test("verified stop clears raw elapsed atomically without inventing a minute or resident update", () => {
  const initial = createRaisingHomeInitialState();
  const runtime = createRaisingHomeRuntime({ initialSnapshot: { ...initial, clockUnits: 300, clockSubunits: 999 } });
  const publications = [];
  runtime.subscribe((publication) => publications.push(publication));
  const stopped = runtime.advanceClock({ units: 0, divisor: 200, clearElapsed: true, expectedClockRevision: 0 });
  assert.equal(stopped.accepted, true);
  assert.equal(stopped.snapshot.clockMinutes, 420);
  assert.equal(stopped.snapshot.clockUnits, 0);
  assert.equal(stopped.snapshot.clockSubunits, 0);
  assert.equal(stopped.snapshot.clockRevision, 1);
  assert.deepEqual(stopped.snapshot.residents, initial.residents);
  assert.equal(publications.length, 1);
  const noChange = runtime.advanceClock({ units: 0, clearElapsed: true, expectedClockRevision: 1 });
  assert.equal(noChange.code, "RAISING_HOME_CLOCK_NO_CHANGE");
  assert.equal(publications.length, 1);
  for (const clearElapsed of [null, 1, "true"]) {
    assert.equal(runtime.advanceClock({ units: 0, clearElapsed, expectedClockRevision: 1 }).accepted, false);
  }
  const finalMinute = createRaisingHomeRuntime({ initialSnapshot: { ...initial, clockMinutes: 1319, clockUnits: 199 } });
  const ended = finalMinute.advanceClock({ units: 16, divisor: 200, clearElapsed: true, expectedClockRevision: 0 });
  assert.equal(ended.accepted, true);
  assert.equal(ended.snapshot.clockMinutes, 1320);
  assert.equal(ended.snapshot.clockUnits, 0);
  assert.equal(ended.snapshot.clockSubunits, 0);
  const paused = createRaisingHomeRuntime({ initialSnapshot: { ...initial, paused: true, clockUnits: 10 } });
  assert.equal(paused.advanceClock({ units: 16, clearElapsed: true, expectedClockRevision: 0 }).code, "RAISING_HOME_PAUSED");
  assert.equal(paused.advanceClock({ units: 0, clearElapsed: true, expectedClockRevision: 0 }).accepted, true);
  assert.equal(paused.getSnapshot().clockMinutes, 420);
});

test("clock updates preserve all residents and do not spend the 256 player command IDs", () => {
  const runtime = createRaisingHomeRuntime({ sessionId: "round2-clock-budget" });
  const initial = runtime.getSnapshot();
  let publications = 0;
  runtime.subscribe((publication) => { publications += 1; assert.equal(publication.kind, "clock"); });
  for (let count = 0; count < 1000; count += 1) assert.equal(advance(runtime, 1).accepted, true);
  assert.equal(publications, 1000);
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.clockRevision, 1000);
  assert.equal(snapshot.tick, initial.tick);
  assert.deepEqual(snapshot.residents, initial.residents);
  assert.deepEqual(snapshot.eventLog, initial.eventLog);
  assert.equal(snapshot.feedback, initial.feedback);
  assert.equal(snapshot.clockMinutes, 422);
  assert.equal(snapshot.clockUnits, 200);
  assert.equal(runtime.dispatch({ commandId: "player-after-clock", expectedRevision: snapshot.revision, type: RAISING_HOME_COMMANDS.SELECT_RESIDENT, residentId: snapshot.selectedResidentId }).accepted, true);
});

test("zero, replay, malformed and paused deltas do not mutate or publish", () => {
  const runtime = createRaisingHomeRuntime();
  let count = 0;
  runtime.subscribe(() => { count += 1; });
  const initial = runtime.getSnapshot();
  assert.equal(advance(runtime, 0).code, "RAISING_HOME_CLOCK_NO_CHANGE");
  for (const units of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(advance(runtime, units).accepted, false);
  assert.equal(advance(runtime, 0, 1000).accepted, false);
  assert.equal(runtime.getSnapshot(), initial);
  assert.equal(count, 0);
  assert.equal(advance(runtime, 1).accepted, true);
  assert.equal(runtime.advanceClock({ units: 1, expectedClockRevision: 0 }).code, "RAISING_HOME_STALE_CLOCK_REVISION");
  const pause = runtime.dispatch({ commandId: "pause", expectedRevision: runtime.getSnapshot().revision, type: RAISING_HOME_COMMANDS.TOGGLE_PAUSE });
  assert.equal(pause.accepted, true);
  const paused = runtime.getSnapshot();
  assert.equal(advance(runtime, 400).code, "RAISING_HOME_PAUSED");
  assert.equal(runtime.getSnapshot(), paused);
});

test("clock observer reentry cannot consume the same elapsed revision twice", () => {
  const runtime = createRaisingHomeRuntime();
  let nested;
  runtime.subscribe(() => { nested = advance(runtime, 1); });
  assert.equal(advance(runtime, 1).accepted, true);
  assert.equal(nested.code, "RAISING_HOME_NOTIFICATION_BUSY");
  assert.equal(runtime.getSnapshot().clockUnits, 1);
});

test("v4 clock precision survives serialization, restore and further advancement", () => {
  const runtime = createRaisingHomeRuntime();
  advance(runtime, 399, 999);
  const encoded = serializeRaisingHomeSaveR2(runtime.getSnapshot(), { revision: 7 });
  const decoded = deserializeRaisingHomeSaveR2(encoded.serialized);
  assert.equal(decoded.document.schemaVersion, 5);
  assert.equal(decoded.serialized, encoded.serialized);
  assert.equal(decoded.digest, encoded.digest);
  const restored = createRaisingHomeRuntime({ initialSnapshot: restoreRaisingHomeSnapshotR2(decoded.document, { sessionId: "round2-restored" }) });
  advance(restored, 0, 1);
  assert.equal(restored.getSnapshot().clockMinutes, 421);
  assert.equal(restored.getSnapshot().clockUnits, 0);
  assert.equal(restored.getSnapshot().clockSubunits, 0);
  assert.equal(restored.getSnapshot().year, 0);
});

function legacyDocument(version) {
  const document = JSON.parse(JSON.stringify(createRaisingHomeSaveDocumentR2(createRaisingHomeInitialState())));
  document.schemaVersion = version;
  for (const key of ["year", "clockUnits", "clockSubunits", "clockRevision"]) delete document.payload[key];
  document.payload.clockMinutes = 480;
  document.payload.season = 3;
  document.payload.dayOfSeason = 7;
  if (version < 3) { delete document.payload.season; delete document.payload.dayOfSeason; }
  if (version === 1) { delete document.payload.paused; delete document.adaptationRef; delete document.payloadDigest; }
  else document.payloadDigest = digestCanonicalRaisingHomeDataR2(document.payload, `raising-payload-v${version}`);
  return document;
}

test("v1/v2/v3 migrations validate original digest domains and keep unknown date/year neutral", () => {
  for (const version of [1, 2, 3]) {
    const source = legacyDocument(version);
    const decoded = deserializeRaisingHomeSaveR2(JSON.stringify(source));
    assert.equal(decoded.migratedFrom, version);
    assert.equal(decoded.document.schemaVersion, 5);
    assert.equal(decoded.durableState.year, null);
    assert.equal(decoded.durableState.clockMinutes, 480);
    assert.equal(decoded.durableState.season, version === 3 ? 3 : null);
    assert.equal(decoded.durableState.dayOfSeason, version === 3 ? 7 : null);
    assert.equal(decoded.durableState.clockUnits, 0);
    assert.equal(decoded.durableState.clockSubunits, 0);
    assert.deepEqual(decoded.durableState.residents, source.payload.residents);
    if (version > 1) {
      source.payload.clockMinutes += 1;
      assert.throws(() => deserializeRaisingHomeSaveR2(JSON.stringify(source)), /payloadDigest/);
    }
  }
});

test("v4 exact clock allowlist and precision bounds reject corrupt saves", () => {
  const valid = createRaisingHomeSaveDocumentR2(createRaisingHomeInitialState());
  for (const [key, value] of [["clockUnits", 400], ["clockSubunits", 1000], ["clockRevision", 1], ["year", 100], ["unknown", 0]]) {
    const document = JSON.parse(JSON.stringify(valid));
    document.payload[key] = value;
    document.payloadDigest = digestCanonicalRaisingHomeDataR2(document.payload, "raising-payload-v5");
    assert.throws(() => deserializeRaisingHomeSaveR2(JSON.stringify(document)), /validation failed/);
  }
  assert.throws(() => createRaisingHomeSaveDocumentR2({ ...createRaisingHomeInitialState(), clockUnits: -0 }), /finite number other than -0/);
});

test("v4 to v5 preserves exact residents/calendar and validates the old digest before migration", () => {
  const runtime = createRaisingHomeRuntime(); advance(runtime, 399, 999);
  const doc = JSON.parse(JSON.stringify(createRaisingHomeSaveDocumentR2(runtime.getSnapshot())));
  doc.schemaVersion = 4;
  doc.payloadDigest = digestCanonicalRaisingHomeDataR2(doc.payload, "raising-payload-v4");
  const migrated = deserializeRaisingHomeSaveR2(JSON.stringify(doc));
  assert.equal(migrated.migratedFrom, 4); assert.equal(migrated.document.schemaVersion, 5);
  assert.deepEqual(migrated.durableState, doc.payload);
  doc.payload.clockSubunits--;
  assert.throws(() => deserializeRaisingHomeSaveR2(JSON.stringify(doc)), /payloadDigest/);
  doc.payload.residents = []; doc.payload.selectedResidentId = null;
  doc.payloadDigest = digestCanonicalRaisingHomeDataR2(doc.payload, "raising-payload-v4");
  assert.throws(() => deserializeRaisingHomeSaveR2(JSON.stringify(doc)), /validation failed/);
});

test("v5 empty resident membership survives restore; unknown/duplicate releases cannot change it", () => {
  const before = createRaisingHomeInitialState();
  const ids = before.residents.map((r) => r.residentId);
  const after = stageRaisingResidentRelease(before, ids);
  assert.equal(before.residents.length, ids.length);
  assert.equal(after.selectedResidentId, null); assert.deepEqual(after.residents, []);
  const decoded = deserializeRaisingHomeSaveR2(serializeRaisingHomeSaveR2(after).serialized);
  const restored = restoreRaisingHomeSnapshotR2(decoded.document, { sessionId: "released-residents" });
  assert.deepEqual(restored.residents, []); assert.equal(restored.selectedResidentId, null);
  assert.throws(() => stageRaisingResidentRelease(before, [ids[0], ids[0]]), /exact existing resident/);
  assert.throws(() => stageRaisingResidentRelease(before, ["unknown-resident"]), /exact existing resident/);
  const forged = JSON.parse(JSON.stringify(decoded.document));
  forged.payload.residents = [{ ...createRaisingHomeSaveDocumentR2(before).payload.residents[0], residentId: "unknown-resident" }];
  forged.payload.selectedResidentId = "unknown-resident";
  forged.payloadDigest = digestCanonicalRaisingHomeDataR2(forged.payload, "raising-payload-v5");
  assert.throws(() => deserializeRaisingHomeSaveR2(JSON.stringify(forged)), /validation failed/);
});

test("End Day shares calendar arithmetic, clears elapsed remainder and never updates residents", () => {
  const initial = createRaisingHomeInitialState();
  const runtime = createRaisingHomeRuntime({ initialSnapshot: { ...initial, year: 98, season: 3, dayOfSeason: 7, clockMinutes: 1320, clockUnits: 399, clockSubunits: 999 } });
  const before = runtime.getSnapshot();
  const ended = runtime.dispatch({ commandId: "end-day", expectedRevision: 0, type: RAISING_HOME_COMMANDS.END_DAY });
  assert.equal(ended.accepted, true);
  for (const [key, value] of Object.entries(endWorldClockDay(before))) assert.equal(ended.snapshot[key], value);
  assert.equal(ended.snapshot.clockMinutes, 420);
  assert.equal(ended.snapshot.year, 99);
  assert.equal(ended.snapshot.clockUnits, 0);
  assert.deepEqual(ended.snapshot.residents, before.residents);
  assert.equal(ended.snapshot.tick, before.tick);
});

test("coordinator dirty clock keeps exact save identity without notifying every frame", () => {
  const savePort = createChampionshipSavePortR2();
  const coordinator = createChampionshipSaveCoordinatorR2({ sessionId: "round2-save-clock", savePort });
  assert.equal(coordinator.save().accepted, true);
  let notifications = 0;
  coordinator.subscribeSaveStatus(() => { notifications += 1; });
  for (let i = 0; i < 300; i += 1) assert.equal(coordinator.advanceRaisingClock({ units: 1, subunits: 1, expectedClockRevision: i }).accepted, true);
  assert.equal(notifications, 1);
  const dirty = coordinator.getSaveStatus();
  assert.equal(dirty.dirty, true);
  assert.equal(dirty.runtimeRevision, 300);
  assert.match(dirty.runtimeDigest, /sha256:/);
  assert.equal(coordinator.save().exactStateSaved, true);
  assert.equal(coordinator.getSaveStatus().dirty, false);
  const second = createChampionshipSaveCoordinatorR2({ sessionId: "round2-save-restore", savePort });
  assert.equal(second.getRaisingHomeSnapshot().clockUnits, 300);
  assert.equal(second.getRaisingHomeSnapshot().clockSubunits, 300);
});
