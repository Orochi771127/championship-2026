// Circle diagnostics must not mutate wild ownership.
import assert from "node:assert/strict";
import test from "node:test";

import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { pointInPolygon } from "../src/championship/hunt/capture/pointInPolygon.js";
import { ENCLOSURE_HIT_RADIUS_PX } from "../src/championship/hunt/capture/huntEnclosureSession.js";

const fieldActor = { actorId: "championship:2026:actor:tamer", displayName: "Tamer" };

function runtimeForFirstGate() {
  const world = createHuntWorld(listChampionshipGates()[0]);
  return createHuntRuntime({ world, fieldActor });
}

function drawClosedLoop(runtime, cx, cy, radius = 36) {
  runtime.extendEnclosureStroke(cx + radius, cy);
  runtime.extendEnclosureStroke(cx + radius, cy + radius);
  runtime.extendEnclosureStroke(cx - radius, cy + radius);
  runtime.extendEnclosureStroke(cx - radius, cy - radius);
  runtime.extendEnclosureStroke(cx + radius, cy - radius);
  runtime.extendEnclosureStroke(cx + 2, cy + 2);
}

test("a point on a polygon edge counts as inside", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 }
  ];
  assert.equal(pointInPolygon(20, 20, square), true);
  assert.equal(pointInPolygon(0, 0, square), true);
  assert.equal(pointInPolygon(80, 80, square), false);
});

test("a stroke on empty ground does not start enclosure", () => {
  const runtime = runtimeForFirstGate();
  assert.equal(runtime.beginEnclosureStroke(8, 8), false);
  assert.equal(runtime.getEnclosureStroke(), null);
});

test("a closed loop around a nearby wild leaves that individual on the field", () => {
  const runtime = runtimeForFirstGate();
  const target = runtime.getWildCreatures()[0];
  assert.ok(target, "the first gate must spawn a wild creature");
  assert.equal(runtime.beginEnclosureStroke(target.worldX, target.worldY), true);
  assert.ok(ENCLOSURE_HIT_RADIUS_PX >= 48);
  drawClosedLoop(runtime, target.worldX, target.worldY);
  const verdict = runtime.endEnclosureStroke();
  assert.equal(verdict.outcome, "TOOL_TRACE_REQUIRED");
  assert.equal(verdict.wildId, target.wildId);
  assert.equal(verdict.speciesId, target.speciesId);
  assert.equal(verdict.successAuthority, "UNKNOWN_REQUIRES_TRACE");
  assert.equal(runtime.getWildCreatures().some((wild) => wild.wildId === target.wildId), true);
  assert.equal(runtime.getEnclosureStroke(), null);
});

test("an unclosed scribble on a wild does not take it", () => {
  const runtime = runtimeForFirstGate();
  const target = runtime.getWildCreatures()[0];
  const before = runtime.getWildCreatures().length;
  runtime.beginEnclosureStroke(target.worldX, target.worldY);
  runtime.extendEnclosureStroke(target.worldX + 30, target.worldY);
  const verdict = runtime.endEnclosureStroke();
  assert.equal(verdict.outcome, "TOOL_TRACE_REQUIRED");
  assert.equal(runtime.getWildCreatures().length, before);
});
