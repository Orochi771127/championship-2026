// VS3 -- memory-card capacity gate (original event 0x16 compare).
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTURE_CAPACITY_SCOPE,
  ORIGINAL_OVER_CAPACITY_EVENT,
  PRODUCT_SPECIES_G_COST,
  SPECIES_G_COST_EVIDENCE,
  evaluateBringHomeCapacity,
  evaluateMemoryCardCapacity,
  maxGFromInventory,
  usedGFromCollectionCount
} from "../src/championship/hunt/capture/memoryCardCapacity.js";
import { createHuntInventory } from "../src/championship/hunt/loadout/huntInventory.js";
import { createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { ENCLOSURE_HIT_RADIUS_PX } from "../src/championship/hunt/capture/huntEnclosureSession.js";

const fieldActor = { actorId: "championship:2026:actor:tamer", displayName: "Tamer" };

function drawClosedLoop(runtime, cx, cy, radius = 36) {
  runtime.extendEnclosureStroke(cx + radius, cy);
  runtime.extendEnclosureStroke(cx + radius, cy + radius);
  runtime.extendEnclosureStroke(cx - radius, cy + radius);
  runtime.extendEnclosureStroke(cx - radius, cy - radius);
  runtime.extendEnclosureStroke(cx + radius, cy - radius);
  runtime.extendEnclosureStroke(cx + 2, cy + 2);
}

test("owned memory cards encode max G as last occupied slot: 32 / 64 / 96", () => {
  assert.equal(maxGFromInventory(createHuntInventory({ entries: [] })), 0);
  assert.equal(maxGFromInventory(createHuntInventory({
    entries: [{ itemId: "championship:2026:hunt-memory:card-32", quantity: 1 }]
  })), 32);
  assert.equal(maxGFromInventory(createHuntInventory({
    entries: [
      { itemId: "championship:2026:hunt-memory:card-32", quantity: 1 },
      { itemId: "championship:2026:hunt-memory:card-96", quantity: 1 }
    ]
  })), 96);
});

test("over capacity is a compare against max, not a close-stroke subtract", () => {
  const reject = evaluateMemoryCardCapacity({ maxG: 32, usedG: 32, incomingG: 1 });
  assert.equal(reject.allowed, false);
  assert.equal(reject.reason, "OVER_CAPACITY");
  assert.equal(reject.originalEvent, ORIGINAL_OVER_CAPACITY_EVENT);
  assert.equal(reject.remainingG, 0);
  assert.equal(reject.costEvidence, SPECIES_G_COST_EVIDENCE);
  assert.equal(reject.scope, CAPTURE_CAPACITY_SCOPE);

  const allow = evaluateMemoryCardCapacity({ maxG: 32, usedG: 0, incomingG: PRODUCT_SPECIES_G_COST });
  assert.equal(allow.allowed, true);
  assert.equal(allow.remainingG, 32);
  assert.equal(allow.projectedG, 1);
});

test("no owned card rejects the first bring-home (max 0)", () => {
  const inventory = createHuntInventory({ entries: [] });
  const gate = evaluateBringHomeCapacity(inventory, 0);
  assert.equal(gate.maxG, 0);
  assert.equal(gate.allowed, false);
  assert.equal(usedGFromCollectionCount(4), 4);
});

test("a circle leaves the wild untouched before any capacity transaction", () => {
  const world = createHuntWorld(listChampionshipGates()[0]);
  const runtime = createHuntRuntime({ world, fieldActor });
  const target = runtime.getWildCreatures()[0];
  const before = runtime.getWildCreatures().length;
  assert.ok(ENCLOSURE_HIT_RADIUS_PX >= 48);
  runtime.beginEnclosureStroke(target.worldX, target.worldY);
  drawClosedLoop(runtime, target.worldX, target.worldY);
  const verdict = runtime.endEnclosureStroke();
  assert.equal(verdict.outcome, "TOOL_TRACE_REQUIRED");
  assert.equal(runtime.getWildCreatures().length, before);
  assert.equal(runtime.getWildCreatures().length, before);
  assert.equal(runtime.getWildCreatures().some((wild) => wild.wildId === target.wildId), true);
  assert.equal(runtime.endEnclosureStroke(), null);
});
