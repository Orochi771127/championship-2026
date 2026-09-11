import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initializeWildHp, createNativeRope, stepNativeRope, createWildCaptureFlow, CAPTURE_REPLAY_AUTHORITY } from "../src/championship/hunt/capture/wildCaptureFlow.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { restoreLegacyIndividual } from "./fixtures/championship-legacy-collection.mjs";
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const native = read("docs/research/HUNT_CAPTURE_NATIVE_REPLAY_2026-09-05.json");
const catalog = read("src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("docs/contracts/championship/raising-home-presentation.v1.json");
const record = () => ({ wildIndex: 0, speciesId: "species-008", traceId: "YDIJ_NATIVE_CAPTURE_008_B7_37",
  hpInitialization: { baseHp: native.input.baseHp, nextRungHp: native.input.nextRungHp, randomB7: native.input.randomB7 },
  rope: { generation: native.input.generation, coefficient: native.input.coefficient,
    durabilityByte: native.input.durabilityByte, temperament71: native.input.temperament71 }, gCost: native.input.gCost });
const replay = () => ({ mode: "NATIVE_DATAFLOW_REPLAY", records: [record()] });
const input = { dxQ12: native.input.dxQ12, dyQ12: 0 };
function storage() {
  const map = new Map();
  return { fail: false, writes: 0, getItem: (key) => map.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error("quota"); this.writes++; map.set(key, value); }, removeItem: (key) => map.delete(key) };
}
const appFor = (store, extra = {}) => createChampionshipStandaloneApp({ storage: store, catalog, cages, huntCaptureReplay: replay(), ...extra });
async function enter(app) { app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate(); await app.beginHunt(); }
function down(app) {
  const runtime = app.getHuntRuntime(), id = runtime.getWildCreatures()[0].wildId;
  assert.equal(runtime.attachNativeRope(id), true);
  for (const [tick, hp, durability, accumulatorQ12] of native.pullFrames) {
    const frame = runtime.tickNativeRope(id, input);
    assert.equal(frame.currentHp, hp, `native tick ${tick}`);
    if (frame.rope) assert.deepEqual([frame.rope.durability, frame.rope.accumulatorQ12], [durability, accumulatorQ12]);
  }
  return { runtime, id };
}
function card(app) {
  const { runtime, id } = down(app);
  assert.equal(runtime.completeNativeDownAnimation(id), true);
  assert.equal(runtime.collectNativeHand(id).accepted, true);
  for (let i = 0; i < 11; i++) runtime.tickNativeCardInsertionPhase(id);
  return { runtime, id };
}

test("HP initialization and every soft-pull update match actual original ARM execution", () => {
  for (const vector of native.hpInitializationVectors) {
    assert.deepEqual(initializeWildHp(vector), { currentHp: vector.currentHp, maxHp: vector.maxHp });
  }
  const hp = initializeWildHp(record().hpInitialization);
  assert.equal(hp.currentHp, native.output.initialHp);
  let rope = createNativeRope({ ...record().rope, maxHp: hp.maxHp }), currentHp = hp.currentHp;
  assert.equal(rope.damageQ12, native.output.damageQ12);
  for (const [tick, expectedHp, expectedDurability, expectedAccumulator] of native.pullFrames) {
    const next = stepNativeRope(rope, currentHp, input);
    rope = next.rope; currentHp = next.currentHp;
    assert.deepEqual([tick, currentHp, rope.durability, rope.accumulatorQ12], [tick, expectedHp, expectedDurability, expectedAccumulator]);
  }
});
for (const vector of native.ropeBoundaryVectors) test(`Rope ${vector.distance}px / ${vector.damageQ12} Q12 matches native boundaries and remainder`, () => {
  let hp = 500, rope = { ...createNativeRope({ ...record().rope, maxHp: 500 }), damageQ12: vector.damageQ12 };
  for (const expected of vector.frames) {
    const next = stepNativeRope(rope, hp, { dxQ12: vector.distance * 4096, dyQ12: 0, movementBlocked: vector.movementBlocked });
    hp = next.currentHp; rope = next.rope;
    assert.deepEqual([hp, rope.durability, rope.accumulatorQ12], expected);
  }
});
test("untraced AI events reject before changing HP, and cancellation releases the tether", () => {
  const r = record(), flow = createWildCaptureFlow({ ...r, wildId: "wild:one", hp: initializeWildHp(r.hpInitialization) });
  flow.attach(); const before = flow.snapshot();
  assert.throws(() => flow.tickPull({ dxQ12: 80 * 4096, dyQ12: 0 }), /AI_PULL_EVENT_TRACE_REQUIRED/);
  assert.deepEqual(flow.snapshot(), before);
  flow.release(); assert.equal(flow.snapshot().state, "WILD");
  assert.equal(flow.tickPull(input), null);
  assert.throws(() => initializeWildHp({ ...r.hpInitialization, randomB7: 103 }), /RNG_B7/);
  assert.throws(() => createNativeRope({ ...r.rope, maxHp: 210, coefficient: 0 }), /COEFFICIENT/);
});
test("HP zero, down animation, hand event and insertion are separate ownership boundaries", async () => {
  const store = storage(), app = appFor(store); await app.newGame(); app.save(); await enter(app);
  const beforeSave = store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), beforeIdentity = app.getInstanceIdentityState();
  const { runtime, id } = down(app);
  assert.equal(runtime.getOnCardEntries().length, 0);
  assert.equal(runtime.collectNativeHand(id).reason, "TARGET_NOT_READY");
  assert.equal(app.exitHunt(), "HUNT_FIELD");
  runtime.completeNativeDownAnimation(id);
  assert.deepEqual(runtime.collectNativeHand(id), { accepted: true, event: 0x20 });
  assert.equal(runtime.collectNativeHand(id).accepted, false);
  assert.equal(app.exitHunt(), "HUNT_FIELD");
  for (let i = 0; i < 10; i++) assert.equal(runtime.tickNativeCardInsertionPhase(id), false);
  assert.ok(runtime.getWildCreatures().some((wild) => wild.wildId === id));
  assert.equal(runtime.tickNativeCardInsertionPhase(id), true);
  assert.equal(runtime.tickNativeCardInsertionPhase(id), false);
  assert.equal(runtime.getWildCreatures().some((wild) => wild.wildId === id), false);
  assert.equal(runtime.getOnCardEntries()[0].sourceVitals.currentHp, native.output.cardHp);
  assert.equal(app.getRaisingState().collection.length, 0);
  assert.equal(app.getInstanceIdentityState(), beforeIdentity);
  assert.equal(store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), beforeSave);
  await app.dispose();
});
test("an absent memory card leaves a ready wild in the field without allocating or saving", async () => {
  const app = appFor(storage(), { huntStartingInventory: [] }); await app.newGame(); await enter(app);
  const { runtime, id } = down(app); runtime.completeNativeDownAnimation(id);
  assert.deepEqual(runtime.collectNativeHand(id), { accepted: false, reason: "OVER_CAPACITY", event: 0x39 });
  assert.equal(runtime.getCaptureRecord(id).state, "HAND_READY");
  assert.equal(runtime.getOnCardEntries().length, 0); assert.equal(app.getRaisingState().collection.length, 0);
  await app.dispose();
});
test("result confirmation atomically saves the captured source HP, name, stable ID, and home membership", async () => {
  const store = storage(), app = appFor(store); await app.newGame(); await enter(app);
  const { runtime } = card(app);
  assert.equal(app.exitHunt(), "HUNT_RESULT"); assert.equal(app.getRaisingState().collection.length, 0);
  app.setHuntResultName("Native One");
  const beforeWrites = store.writes;
  assert.equal(app.confirmHuntResult(), "RAISING_HOME");
  const entry = app.getRaisingState().collection[0];
  assert.equal(entry.displayName, "Native One"); assert.equal(entry.successAuthority, CAPTURE_REPLAY_AUTHORITY);
  assert.deepEqual(entry.capturedVitals, { currentHp: 210, maxHp: 210, traceId: record().traceId });
  assert.equal(runtime.getOnCardEntries().length, 0); assert.equal(store.writes, beforeWrites + 1);
  assert.equal(app.confirmHuntResult(), "RAISING_HOME"); assert.equal(store.writes, beforeWrites + 1);
  await app.dispose(); const restored = appFor(store); await restored.continueGame();
  assert.deepEqual(restored.getRaisingState().collection[0], entry);
  assert.ok(restored.resolveRaisingInstance(entry.instanceId));
  await enter(restored); card(restored); restored.exitHunt(); restored.confirmHuntResult();
  const second = restored.getRaisingState().collection[1];
  assert.notEqual(second.instanceId, entry.instanceId); assert.equal(second.speciesId, entry.speciesId);
  await restored.dispose();
});
test("failed Home save retains the card and unallocated ID; retry commits exactly once", async () => {
  const store = storage(), app = appFor(store); await app.newGame(); app.save(); await enter(app);
  const { runtime } = card(app); app.exitHunt();
  const raising = app.getRaisingState(), identity = app.getInstanceIdentityState(), saved = store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  store.fail = true;
  assert.equal(app.confirmHuntResult(), "HUNT_RESULT");
  assert.equal(app.getHuntResult().commitError, "SAVE_FAILED");
  assert.equal(app.getRaisingState(), raising); assert.equal(app.getInstanceIdentityState(), identity);
  assert.equal(runtime.getOnCardEntries().length, 1); assert.equal(store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), saved);
  assert.throws(() => app.save(), /REQUIRES_CAPTURE_HOME_COMMIT/);
  store.fail = false; assert.equal(app.persistenceFacade().retry().phase, "SAVED");
  assert.equal(app.getScreen(), "RAISING_HOME");
  assert.equal(app.getRaisingState().collection.length, raising.collection.length + 1);
  assert.equal(app.getInstanceIdentityState().nextSequence, identity.nextSequence + 1);
  await app.dispose();
});

test("a full native 16-slot home pool retains the on-card individual without partial commit", async () => {
  const store = storage(), app = appFor(store); await app.newGame();
  while (app.getRaisingInstances().length < 16) await restoreLegacyIndividual(app, store);
  app.save(); const saved = store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  await enter(app); const { runtime } = card(app); app.exitHunt();
  assert.equal(app.confirmHuntResult(), "HUNT_RESULT");
  assert.equal(app.getHuntResult().commitError, "HOME_ROSTER_FULL");
  assert.equal(runtime.getOnCardEntries().length, 1);
  assert.equal(app.getRaisingInstances().length, 16);
  assert.equal(store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), saved);
  await app.dispose();
});

test("on-card capacity uses species G and accepts equality; it does not use home collection count", () => {
  for (const [usedG, accepted] of [[20,true],[21,false]]) {
    const r = record(), flow = createWildCaptureFlow({ ...r, wildId: "wild:capacity", hp: { currentHp: 1, maxHp: 210 } });
    flow.attach(); for (let i = 0; i < 2; i++) flow.tickPull(input);
    flow.completeDownAnimation();
    assert.equal(flow.hand({ maxG: 32, usedG }).accepted, accepted);
  }
});

test("card release has an explicit cancellable choice and never resurrects the field target or allocates an ID", async () => {
  const store = storage(), app = appFor(store); await app.newGame(); app.save(); await enter(app);
  const { runtime, id } = card(app); app.exitHunt();
  const identity = app.getInstanceIdentityState(), writes = store.writes;
  const row = app.getHuntResult().rows[0];
  assert.equal(row.kind, "CARD");
  assert.equal(app.requestHuntResultRelease(row.key), true);
  assert.equal(app.confirmHuntResult(), "HUNT_RESULT");
  assert.equal(app.cancelHuntResultRelease(), true);
  assert.equal(runtime.getOnCardEntries().length, 1);
  assert.equal(app.confirmHuntResultRelease(), false);
  app.requestHuntResultRelease(row.key); assert.equal(app.confirmHuntResultRelease(), true);
  assert.equal(runtime.getOnCardEntries().length, 0);
  assert.equal(runtime.getCaptureRecord(id).state, "RELEASED");
  assert.equal(runtime.getWildCreatures().some((wild) => wild.wildId === id), false);
  assert.equal(app.requestHuntResultRelease(row.key), false);
  assert.equal(app.confirmHuntResult(), "RAISING_HOME");
  assert.equal(app.getInstanceIdentityState(), identity); assert.equal(store.writes, writes);
  await app.dispose();
});

test("full Home can replace an exact collection individual; failed save preserves both it and the card", async () => {
  const store = storage(), app = appFor(store); await app.newGame();
  while (app.getRaisingInstances().length < 16) await restoreLegacyIndividual(app, store);
  app.save(); const saved = store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  const old = app.getRaisingState(), first = old.collection[0], second = old.collection[1];
  const identity = app.getInstanceIdentityState();
  await enter(app); const { runtime } = card(app); app.exitHunt(); app.confirmHuntResult();
  assert.equal(app.getHuntResult().commitError, "HOME_ROSTER_FULL");
  const rows = app.getHuntResult().rows;
  assert.equal(rows[0].kind, "CARD");
  for (const row of rows.filter((row) => !row.canRelease)) assert.equal(app.requestHuntResultRelease(row.key), false);
  assert.equal(app.requestHuntResultRelease(`home:${first.speciesId}`), false);
  assert.equal(app.requestHuntResultRelease(`home:${first.instanceId}`), true);
  assert.equal(app.confirmHuntResultRelease(), true);
  assert.equal(app.getRaisingState(), old); // release is still staged
  assert.equal(app.getHuntResult().rows.some((row) => row.id === first.instanceId), false);
  store.fail = true; assert.equal(app.confirmHuntResult(), "HUNT_RESULT");
  assert.equal(app.getRaisingState(), old); assert.equal(app.getInstanceIdentityState(), identity);
  assert.equal(store.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), saved);
  assert.equal(runtime.getOnCardEntries().length, 1);
  store.fail = false; assert.equal(app.persistenceFacade().retry().phase, "SAVED");
  assert.equal(app.getRaisingInstances().length, 16);
  assert.equal(app.resolveRaisingInstance(first.instanceId), null);
  assert.ok(app.resolveRaisingInstance(second.instanceId));
  assert.equal(app.getRaisingState().assignments[first.instanceId], undefined);
  assert.equal(app.getRaisingState().interactions[first.instanceId], undefined);
  assert.equal(app.getInstanceIdentityState().nextSequence, identity.nextSequence + 1);
  const expected = app.getRaisingState(); await app.dispose();
  const restored = appFor(store); await restored.continueGame();
  assert.deepEqual(restored.getRaisingState(), expected); assert.equal(restored.getRaisingInstances().length, 16);
  await restored.dispose();
});

test("starter release removes canonical resident membership and survives save/Continue without resurrection", async () => {
  const store = storage(), app = appFor(store); await app.newGame(); app.save();
  const starter = app.getRaisingInstances().find((entry) => entry.source.kind === "STARTER");
  app.select(starter.instanceId); await enter(app); const { runtime } = card(app); app.exitHunt();
  const before = app.getSnapshot(), raising = app.getRaisingState();
  assert.equal(app.requestHuntResultRelease(`home:${starter.instanceId}`), true);
  app.confirmHuntResultRelease(); store.fail = true;
  assert.equal(app.confirmHuntResult(), "HUNT_RESULT");
  assert.equal(app.getSnapshot(), before); assert.equal(app.getRaisingState(), raising);
  assert.equal(runtime.getOnCardEntries().length, 1);
  store.fail = false;
  const reentrantLifecycle = [];
  const unsubscribe = app.savePort.subscribe((status) => {
    if (status.phase === "SAVED") {
      assert.equal(app.advanceClock({ units: 1 }).code, "HUNT_HOME_COMMIT_ACTIVE");
      reentrantLifecycle.push(app.newGame(), app.continueGame(), app.dispose());
    }
  });
  assert.equal(app.confirmHuntResult(), "RAISING_HOME"); unsubscribe();
  assert.deepEqual(await Promise.all(reentrantLifecycle), [null, null, false]);
  assert.equal(app.getSnapshot().residents.some((entry) => entry.residentId === starter.instanceId), false);
  assert.equal(app.resolveRaisingInstance(starter.instanceId), null);
  assert.equal(app.getSelectedCreatureId(), null);
  assert.equal(app.getRaisingState().assignments[starter.instanceId], undefined);
  const expected = app.getRaisingInstances(); await app.dispose();
  const restored = appFor(store); await restored.continueGame();
  assert.equal(restored.resolveRaisingInstance(starter.instanceId), null);
  assert.deepEqual(restored.getRaisingInstances(), expected);
  assert.equal(restored.getSnapshot().selectedResidentId, null);
  restored.advanceClock({ units: 400 }); assert.equal(restored.save().phase, "SAVED");
  await restored.dispose();
});
