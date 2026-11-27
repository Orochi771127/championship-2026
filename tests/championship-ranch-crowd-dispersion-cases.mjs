import test from 'node:test';
import assert from 'node:assert/strict';
import { separateGroundFootpoints } from '../src/championship/field/groundFootpointSeparation.js';
import { nativeRaisingActorRadiusQ12, separateNativeRaisingGroundActors } from '../src/championship/raising/nativeGroundSpacing.js';
import {
  actorInConnectedRanchRegion,
  beginRanchExplorationWalk,
  scoreRanchExplorationTarget
} from '../src/championship/raising/ranchExplorationWalk.js';
import { composeProductRanchGround } from '../src/championship/raising/nativeRaisingRanchRing.js';
import { PRODUCT_RANCH_GRID, PRODUCT_WAITING_ROOM_SLOT, legacyGrid100SlotToWorld as W } from '../src/championship/cage/productRanchGrid.js';
import { WAITING_ROOM_MODULE } from '../src/championship/cage/nativeRanchLayout.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';

const Q = 4096;
const pt = (x, y) => [x * Q, y * Q, 0];
const defs = listCageDefinitions();
const moduleOf = (i) => defs[i].moduleId;

test('per-actor dynamic separation radius scales up for large species within [8, 14] px while keeping 8px fallback', () => {
  const smallRadius = nativeRaisingActorRadiusQ12({ speciesIndex: 8 });
  const eggRadius = nativeRaisingActorRadiusQ12({ speciesIndex: 0 });
  const syntheticRadius = nativeRaisingActorRadiusQ12({});
  const largeRadius = nativeRaisingActorRadiusQ12({ speciesIndex: 190 }); // UL07 潛艇龍

  assert.equal(eggRadius, 8 * Q);
  assert.equal(syntheticRadius, 8 * Q);
  assert.ok(smallRadius >= 8 * Q && smallRadius <= 14 * Q);
  assert.ok(largeRadius > 8 * Q && largeRadius <= 14 * Q, `expected large species radius in (8, 14] px, got ${largeRadius / Q}`);

  let entries = [
    { poolSlot: 0, group: 'infirmary', positionQ12: pt(100, 100), radiusQ12: largeRadius },
    { poolSlot: 1, group: 'infirmary', positionQ12: pt(116, 100), radiusQ12: largeRadius }
  ];
  assert.equal(separateGroundFootpoints(entries).unresolved, 1);
  for (let f = 0; f < 30; f++) {
    const r = separateGroundFootpoints(entries);
    entries = entries.map((e, i) => ({ ...e, positionQ12: r.points[i] }));
  }
  const finalDist = Math.hypot(entries[1].positionQ12[0] - entries[0].positionQ12[0], entries[1].positionQ12[1] - entries[0].positionQ12[1]);
  assert.ok(finalDist >= largeRadius * 2 - 2);
});

test('visitors from different home cages standing in the same connected room still separate cleanly', () => {
  const connectedGround = {
    width: 60, height: 30, pixelWidth: 480,
    navigation: { ownerAt: () => ({ ownerIndex: 2 }) },
    readTerrain: () => 0,
    readClearance: () => 4,
    cageAt: () => ({ instanceId: 'cage:meadow:1', ownerIndex: 2, definitionIndex: 1 })
  };
  const visitorA = { poolSlot: 0, speciesIndex: 190, state: 1, cageDefinitionIndex: 1, cageInstanceId: 'cage:home:a', foodSlot: null, positionQ12: pt(120, 120) };
  const visitorB = { poolSlot: 1, speciesIndex: 213, state: 1, cageDefinitionIndex: 1, cageInstanceId: 'cage:home:b', foodSlot: null, positionQ12: pt(120, 120) };

  const res = separateNativeRaisingGroundActors([visitorA, visitorB], connectedGround);
  assert.equal(res.changed, true);
  assert.ok(Math.hypot(visitorB.positionQ12[0] - visitorA.positionQ12[0], visitorB.positionQ12[1] - visitorA.positionQ12[1]) > 0);
});

test('strolling exploration & discoveries only activate inside connected cages; isolated cages keep native wandering untouched', () => {
  // Build a ranch with TWO connected meadows (slots 10 & 12) PLUS one isolated clinic (slot 18).
  const g = composeProductRanchGround({
    layoutVersion: PRODUCT_RANCH_GRID,
    unlockedSlots: Array.from({ length: 100 }, (_, i) => i),
    placements: [
      { moduleId: WAITING_ROOM_MODULE, slotIndex: PRODUCT_WAITING_ROOM_SLOT, instanceId: 'cage:waiting' },
      { moduleId: moduleOf(0), slotIndex: W(10), instanceId: 'cage:meadow-a' },
      { moduleId: moduleOf(0), slotIndex: W(12), instanceId: 'cage:meadow-b' },
      { moduleId: moduleOf(15), slotIndex: W(18), instanceId: 'cage:isolated-clinic' }
    ]
  });
  assert.ok(g.navigation.connections.length >= 1, 'connected meadows open a passage');

  const meadowOwner = g.placement('cage:meadow-a');
  const clinicOwner = g.placement('cage:isolated-clinic');
  const firstWalkableOf = (ownerIndex) => {
    for (let i = 0; i < g.owners.length; i++) {
      if (g.owners[i] === ownerIndex && g.terrain[i] !== 1 && g.clearance[i] > 1) {
        return [(i % g.width) * 8 + 4, Math.floor(i / g.width) * 8 + 4];
      }
    }
    throw new Error(`NO_WALKABLE_FOR_${ownerIndex}`);
  };

  const [mx, my] = firstWalkableOf(meadowOwner.ownerIndex);
  const [cx, cy] = firstWalkableOf(clinicOwner.ownerIndex);

  const connectedPartner = { poolSlot: 0, speciesIndex: 34, cageInstanceId: 'cage:meadow-a', positionQ12: pt(mx, my), destinationQ12: pt(mx + 16, my) };
  const isolatedPartner = { poolSlot: 1, speciesIndex: 34, cageInstanceId: 'cage:isolated-clinic', positionQ12: pt(cx, cy), destinationQ12: pt(cx + 16, cy) };

  assert.equal(actorInConnectedRanchRegion(connectedPartner, g), true, 'partner in connected meadow participates in strolling');
  assert.equal(actorInConnectedRanchRegion(isolatedPartner, g), false, 'partner in isolated clinic NEVER triggers strolling discovery');

  // Isolated cage walk never mutates destinationQ12 or increments explorationOrdinal.
  const origDest = [...isolatedPartner.destinationQ12];
  assert.equal(beginRanchExplorationWalk(isolatedPartner, g, { actors: [connectedPartner, isolatedPartner] }), false);
  assert.deepEqual(isolatedPartner.destinationQ12, origDest);
  assert.equal(isolatedPartner.explorationOrdinal, undefined);

  // Connected meadow walk produces a smooth string-pulled 8-way route without crossing walls.
  assert.equal(beginRanchExplorationWalk(connectedPartner, g, { actors: [connectedPartner, isolatedPartner] }), true);
  assert.ok(connectedPartner.explorationRoute.length >= 1, 'connected meadow walk produces waypoints');
  for (const [wx, wy] of connectedPartner.explorationRoute) {
    assert.notEqual(g.readTerrain(Math.floor(wx / 32768), Math.floor(wy / 32768)), 1);
  }
});

test('crowd-aware exploration spreads strollers evenly across connected same-ecology rooms', () => {
  const crowdedRoom = scoreRanchExplorationTarget({ definitionIndex: 1, preference: 0, occupancy: 3 });
  const emptyRoom = scoreRanchExplorationTarget({ definitionIndex: 1, preference: 0, occupancy: 0 });
  assert.ok(emptyRoom > crowdedRoom);
});
