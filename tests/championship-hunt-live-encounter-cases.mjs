import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { initializeWildHp, stepNativeRope } from "../src/championship/hunt/capture/wildCaptureFlow.js";
import { liveCaptureReplay } from "./fixtures/championship-live-capture-replay.mjs";
const read = (name) => JSON.parse(fs.readFileSync(`docs/research/${name}_2026-09-05.json`, "utf8"));
const encounter = read("HUNT_LIVE_ENCOUNTER_REPLAY"), touch = read("HUNT_NATIVE_TOUCH_REPLAY");
const world = createHuntWorld(listChampionshipGates()[0]);
const replay = () => liveCaptureReplay(encounter, touch, world.gateId);
const fieldActor = { actorId: "tamer", displayName: "Tamer" };

test("actual Gate 0 record order, B7 outputs, HP and positions replace the six prototype wilds in explicit live replay", () => {
  const runtime = createHuntRuntime({ world, fieldActor, captureReplay: replay() });
  assert.equal(runtime.getWildCreatures().length, 15);
  for (const [index, entry] of encounter.wildRecords.entries()) {
    assert.equal(initializeWildHp(entry.hpInitialization).currentHp, entry.sourceHp);
    const wild = runtime.getWildCreatures()[index];
    assert.equal(wild.speciesId, entry.speciesId);
    assert.deepEqual([wild.worldX, wild.worldY], entry.positionQ12.map((value) => value / 2048));
  }
  const before = runtime.getWildCreatures(); runtime.tick(1000);
  assert.deepEqual(runtime.getWildCreatures(), before);
  const native = runtime.getCaptureRecord(before[7].wildId);
  assert.equal(native.currentHp, 210); assert.equal(native.speciesId, "species-010");
  assert.equal(native.sourceVitals.currentHp, touch.initial.sourceHp);
  const invalid = replay(); invalid.encounter.gateId = "some-other-gate";
  assert.throws(() => createHuntRuntime({ world, fieldActor, captureReplay: invalid }), /LIVE_ENCOUNTER_GATE_REQUIRED/);
});

test("every observed stylus-driven Rope numerical update matches native execution, including event 11 and 13", () => {
  let before = null, input = null, count = 0;
  const emitted = new Set();
  for (const event of touch.events) {
    if (event.pc === "0x2114f54") before = event;
    if (event.input) input = event.input;
    if (!event.afterRope) continue;
    const next = stepNativeRope(before.rope, before.target.hp, input);
    assert.deepEqual([next.currentHp, next.rope.durability, next.rope.accumulatorQ12],
      [event.afterRope.hp, event.afterRope.durability, event.afterRope.accumulatorQ12], `native frame ${event.tick}`);
    if (next.event) emitted.add(next.event);
    count++;
  }
  assert.ok(count > 50); assert.deepEqual([...emitted].sort(), [0x11, 0x13]);
});

test("native touch replay observes HP zero before hand-ready and card insertion without rewriting source HP", () => {
  const zero = touch.frames.find((frame) => frame.hp === 0);
  const ready = touch.frames.find((frame) => frame.ready === 1);
  const inserted = touch.frames.find((frame) => frame.cardCount === 1);
  assert.ok(zero.tick < ready.tick && ready.tick < inserted.tick);
  assert.equal(touch.frames.every((frame) => frame.sourceHp === 210), true);
  assert.deepEqual(touch.card, { speciesIndex: 10, currentHp: 210, maxHp: 210 });
});
