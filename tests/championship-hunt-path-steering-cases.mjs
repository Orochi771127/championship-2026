import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearHuntPathSteering,
  huntLineOfSightClear,
  planHuntSteerRoute,
  prepareHuntPathSteering
} from '../src/championship/hunt/capture/huntPathSteering.js';
import { stepNativeHuntMovement } from '../src/championship/hunt/capture/nativeHuntMovement.js';

const Q = 4096;

function makeGrid(width, height, blockedRects = []) {
  const grid = new Uint8Array(width * height);
  for (const [x0, y0, x1, y1] of blockedRects) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) grid[y * width + x] = 1;
      }
    }
  }
  return {
    width,
    height,
    readTerrain: (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 1 : grid[y * width + x]),
    readAttribute: () => 0,
    queryControllers: () => ({ obstacle: 0, secondaryBlocked: false, sideEffectsClosed: true }),
    camera: [0, 0]
  };
}

test('planHuntSteerRoute skips unobstructed paths and pulls smooth obstacle detours around rocks/ponds', () => {
  // Vertical boulder wall at x=10..11, y=5..15
  const env = makeGrid(24, 24, [[10, 5, 11, 15]]);

  // Open sightline -> returns null (leaves native movement untouched)
  assert.equal(huntLineOfSightClear([20, 20], [160, 20], env), true);
  assert.equal(planHuntSteerRoute([20, 20], [160, 20], env), null);

  // Blocked straight line across boulder wall -> returns smooth string-pulled waypoints around it
  assert.equal(huntLineOfSightClear([52, 84], [132, 84], env), false);
  const route = planHuntSteerRoute([52, 84], [132, 84], env);
  assert.ok(Array.isArray(route) && route.length >= 2 && route.length <= 6, `expected compact string-pulled detour, got ${route?.length}`);
  for (const [wx, wy] of route) {
    assert.equal(env.readTerrain(Math.floor(wx / 8), Math.floor(wy / 8)), 0);
  }
});

test('prepareHuntPathSteering guides a wild actor cleanly around a boulder wall using native movement without getting stuck', () => {
  const env = makeGrid(24, 24, [[10, 5, 11, 14]]);
  const actor = {
    actorActive: 1,
    wildActive: 1,
    hidden: false,
    passage: null,
    cardState: null,
    tutorialScripted: false,
    bound: 0,
    followTarget: 0,
    followFlag: 0,
    followTicks: 0,
    aiState: 2,
    positionQ12: [52 * Q, 84 * Q, 0],
    destinationQ12: [132 * Q, 84 * Q, 0],
    directionQ12: [0, 0, 0],
    speedQ12: 4096,
    pull13: 0,
    facing: 1,
    terrainPose: 7,
    distanceAccumulatorQ12: 0,
    drowsy: 0,
    poisoned: 0
  };

  let reachedRightSide = false;
  for (let tick = 0; tick < 260; tick++) {
    prepareHuntPathSteering(actor, env);
    const step = stepNativeHuntMovement(actor, 0, env);
    Object.assign(actor, step.state);
    const tx = Math.floor((actor.positionQ12[0] >> 12) / 8);
    const ty = Math.floor((actor.positionQ12[1] >> 12) / 8);
    assert.equal(env.readTerrain(tx, ty), 0, `actor never enters blocked wall at tick ${tick}`);
    if (Math.hypot(actor.positionQ12[0] / Q - 132, actor.positionQ12[1] / Q - 84) <= 12) {
      reachedRightSide = true;
      break;
    }
  }
  assert.equal(reachedRightSide, true, 'wild actor navigated around the rock barrier to reach destination');

  // Non-walking / bound state clears steering cleanly.
  actor.bound = 1;
  assert.equal(prepareHuntPathSteering(actor, env), false);
  assert.equal(actor.huntSteer, undefined);
  clearHuntPathSteering(actor);
});
