// Launch pool — the twelve in-flight objects a battle shares.
//
// The fact worth protecting is the three-way join on +0x154: the script natives
// compare-and-set it, the charge refuses on it, and the candidate array ends
// exactly there. Three traces that never looked at each other, one field.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_LAUNCH_ACCEPTED,
  BATTLE_LAUNCH_ACTION_OFFSET,
  BATTLE_LAUNCH_IN_USE_BIT,
  BATTLE_LAUNCH_LOCK_OFFSET,
  BATTLE_LAUNCH_POOL_ALLOCATOR_SITE,
  BATTLE_LAUNCH_POOL_BASE_OFFSET,
  BATTLE_LAUNCH_POOL_CHARGE_SITE,
  BATTLE_LAUNCH_POOL_EVIDENCE,
  BATTLE_LAUNCH_POOL_SIZE,
  BATTLE_LAUNCH_REFUSED_COST,
  BATTLE_LAUNCH_REFUSED_LOCKED,
  allocateLaunchObject,
  chargeLaunch,
  freeLaunchObjects,
  isLaunchObjectInUse,
  launchWasInitialised,
  releaseLaunchObject
} from "../src/championship/battle/battleLaunchPool.js";

import {
  BATTLE_TURN_INFLIGHT_SLOT_COUNT,
  BATTLE_TURN_LAUNCH_RELEASED,
  resolveLaunch
} from "../src/championship/battle/battleTurnStates.js";

import {
  BATTLE_ACTION_RESOURCE_COST_OFFSET,
  canAffordAction
} from "../src/championship/battle/battleActionResource.js";

import {
  BATTLE_BUCKET_ARRAY_END,
  BATTLE_BUCKET_LIST_OFFSET
} from "../src/championship/battle/battleCandidateBuckets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const freePool = () => new Array(BATTLE_LAUNCH_POOL_SIZE).fill(0);

test("the pool is twelve objects and bit 0 is the in-use flag", () => {
  assert.equal(BATTLE_LAUNCH_POOL_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_LAUNCH_POOL_ALLOCATOR_SITE, "OVL19:0x0210F8C4");
  assert.equal(BATTLE_LAUNCH_POOL_SIZE, 12);
  assert.equal(BATTLE_LAUNCH_POOL_BASE_OFFSET, 0x47948);
  assert.equal(BATTLE_LAUNCH_IN_USE_BIT, 1);

  assert.equal(isLaunchObjectInUse(0), false);
  assert.equal(isLaunchObjectInUse(1), true);
  assert.equal(isLaunchObjectInUse(0xfffe), false, "only bit 0 counts");
  assert.equal(isLaunchObjectInUse(0xffff), true);
  // `bic #1` leaves every other bit alone.
  assert.equal(releaseLaunchObject(0xffff), 0xfffe);
  assert.equal(releaseLaunchObject(0), 0);
});

test("the allocator returns the lowest free object and never displaces it", () => {
  assert.equal(allocateLaunchObject(freePool()), 0);
  const pool = freePool();
  pool[0] = 1;
  pool[1] = 1;
  assert.equal(allocateLaunchObject(pool), 2, "the first free one, not the last");
  assert.equal(freeLaunchObjects(pool), 10);

  const full = new Array(BATTLE_LAUNCH_POOL_SIZE).fill(1);
  assert.equal(allocateLaunchObject(full), -1);
  assert.equal(freeLaunchObjects(full), 0);
  assert.throws(() => allocateLaunchObject([0, 0]), /POOL_MUST_BE_12_LONG/);
});

test("twelve shared objects against three slots each is four combatants' worth", () => {
  // A combatant holds at most three, so the pool can be exhausted by four of
  // the six even before anyone is refused for cost.
  assert.equal(BATTLE_LAUNCH_POOL_SIZE / BATTLE_TURN_INFLIGHT_SLOT_COUNT, 4);
  const pool = freePool();
  for (let taken = 0; taken < BATTLE_LAUNCH_POOL_SIZE; taken += 1) {
    const index = allocateLaunchObject(pool);
    assert.equal(index, taken, `allocation ${taken}`);
    pool[index] = 1;
  }
  assert.equal(allocateLaunchObject(pool), -1, "the thirteenth finds nothing");
  // Releasing one puts exactly that index back at the front of the queue.
  pool[5] = releaseLaunchObject(pool[5]);
  assert.equal(allocateLaunchObject(pool), 5);
});

test("the charge refuses on the lock before it ever looks at the cost", () => {
  assert.equal(BATTLE_LAUNCH_POOL_CHARGE_SITE, "OVL19:0x0211C144");
  assert.equal(BATTLE_LAUNCH_LOCK_OFFSET, 0x154);
  assert.equal(BATTLE_LAUNCH_ACTION_OFFSET, 0xe8);

  // 0x0211C158: a non-zero lock returns zero and charges nothing, whatever the
  // combatant could have afforded.
  const locked = chargeLaunch({ lock: 7, resource: 1000, cost: 1 });
  assert.equal(locked.outcome, BATTLE_LAUNCH_REFUSED_LOCKED);
  assert.equal(locked.charged, 0);
  assert.equal(launchWasInitialised(locked), false);
});

test("the cost gate is battleActionResource's, and a refusal costs nothing", () => {
  assert.equal(BATTLE_ACTION_RESOURCE_COST_OFFSET, 0x48);
  // `blt` refuses only a cost strictly above the balance.
  const exact = chargeLaunch({ lock: 0, resource: 10, cost: 10 });
  assert.equal(exact.outcome, BATTLE_LAUNCH_ACCEPTED);
  assert.equal(exact.resource, 0, "paying down to exactly zero is allowed");
  assert.equal(canAffordAction(10, 10), true);

  const short = chargeLaunch({ lock: 0, resource: 10, cost: 11 });
  assert.equal(short.outcome, BATTLE_LAUNCH_REFUSED_COST);
  assert.equal(short.charged, 0);
  assert.equal(short.resource, 10, "a refused action costs nothing");
  assert.equal(canAffordAction(10, 11), false);
  assert.equal(launchWasInitialised(short), false);
});

test("both refusals reach state 15 as one indistinguishable failure", () => {
  const locked = chargeLaunch({ lock: 1, resource: 100, cost: 1 });
  const broke = chargeLaunch({ lock: 0, resource: 1, cost: 100 });
  assert.notEqual(locked.outcome, broke.outcome, "the reasons differ");
  // But the launch sees only `initialised: false`, and takes the same path.
  const fromLock = resolveLaunch({ allocated: {}, initialised: launchWasInitialised(locked), tally: 0 });
  const fromCost = resolveLaunch({ allocated: {}, initialised: launchWasInitialised(broke), tally: 0 });
  assert.equal(fromLock.outcome, BATTLE_TURN_LAUNCH_RELEASED);
  assert.deepEqual({ ...fromLock }, { ...fromCost });
  assert.equal(fromLock.nextState, 1);
  assert.equal(fromLock.clearBit0, true, "and the object goes back to the pool");
});

test("the lock is the same field three separate traces landed on", () => {
  // The candidate array's nine twelve-byte groups end exactly here.
  assert.equal(BATTLE_BUCKET_LIST_OFFSET + 9 * 12, BATTLE_BUCKET_ARRAY_END);
  assert.equal(BATTLE_BUCKET_ARRAY_END, BATTLE_LAUNCH_LOCK_OFFSET);
  // And the module records the third: the two script natives that set it.
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleLaunchPool.js"), "utf8");
  assert.match(module, /0x0211CEC4 and 0x0211CEFC/);
  assert.match(module, /Three separate\s*\n\/\/ traces, one field/);
});

test("a successful charge spends exactly the cost and no more", () => {
  const charged = chargeLaunch({ lock: 0, resource: 65, cost: 30 });
  assert.equal(charged.outcome, BATTLE_LAUNCH_ACCEPTED);
  assert.equal(charged.charged, 30);
  assert.equal(charged.resource, 35);
  assert.equal(launchWasInitialised(charged), true);
  assert.throws(() => chargeLaunch(null), /CHARGE_REQUIRES_AN_OBJECT/);
  assert.throws(() => chargeLaunch({ cost: 1.5 }), /COST_MUST_BE_AN_INTEGER/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleLaunchPool.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("a launch starts at the owner's position plus its sprite cell's centre", async () => {
  const {
    BATTLE_LAUNCH_CELL_FIELDS,
    BATTLE_LAUNCH_CELL_SITE,
    BATTLE_LAUNCH_POSITION_OFFSET,
    BATTLE_LAUNCH_POSITION_SHIFT,
    launchPosition
  } = await import("../src/championship/battle/battleLaunchPool.js");

  // The box is four signed halfwords in the order the initialiser reads them.
  assert.deepEqual({ ...BATTLE_LAUNCH_CELL_FIELDS }, { x0: 0x00, y0: 0x02, x1: 0x04, y1: 0x06 });
  assert.equal(BATTLE_LAUNCH_CELL_SITE, "ARM9:0x02047E58");
  assert.equal(BATTLE_LAUNCH_POSITION_SHIFT, 12);

  // A symmetric box leaves the owner's position alone.
  assert.deepEqual({ ...launchPosition({ x: 1000, y: 2000, z: 3000 }, { x0: -8, y0: -8, x1: 8, y1: 8 }) },
    { x: 1000, y: 2000, z: 3000 });

  // An offset box shifts x and y by the centre, in Q12.
  assert.deepEqual({ ...launchPosition({ x: 0, y: 0, z: 7 }, { x0: 0, y0: 0, x1: 16, y1: 32 }) },
    { x: 8 << 12, y: 16 << 12, z: 7 });

  // `add r1, r1, r1, lsr #31 / asr r1, #1` rounds toward zero, both ways.
  assert.equal(launchPosition({ x: 0, y: 0, z: 0 }, { x0: 0, y0: 0, x1: 3, y1: 0 }).x, 1 << 12);
  assert.equal(launchPosition({ x: 0, y: 0, z: 0 }, { x0: -3, y0: 0, x1: 0, y1: 0 }).x, -(1 << 12));

  // z is carried with no arithmetic at all: 0x0211C120 reads +0x08 and stores it.
  assert.equal(launchPosition({ x: 0, y: 0, z: -12345 }, { x0: 99, y0: 99, x1: 99, y1: 99 }).z, -12345);
  assert.throws(() => launchPosition(null, {}), /POSITION_REQUIRED/);
  assert.throws(() => launchPosition({}, null), /CELL_BOX_REQUIRED/);
});

test("the position block is the one the script getters read and the setter writes", async () => {
  const pool = fs.readFileSync(path.join(root, "src/championship/battle/battleLaunchPool.js"), "utf8");
  const { BATTLE_LAUNCH_POSITION_OFFSET } = await import("../src/championship/battle/battleLaunchPool.js");
  const natives = fs.readFileSync(path.join(root, "src/championship/battle/battleScriptNatives.js"), "utf8");

  assert.equal(BATTLE_LAUNCH_POSITION_OFFSET, 0x2c);
  // 0x0211CE7C, 0x0211CE94 and 0x0211CEAC chain through +0x2C to +0x00, +0x04
  // and +0x08; 0x0211D418 writes the pointer. Same block, four routines.
  assert.match(natives, /chainThrough2C\(host, args\[0\], 0x00\)/);
  assert.match(natives, /chainThrough2C\(host, args\[0\], 0x04\)/);
  assert.match(natives, /chainThrough2C\(host, args\[0\], 0x08\)/);
  assert.match(natives, /host\.writeU32\(args\[0\], 0x2c, args\[1\]\)/);

  // And the note that said this was untraced is gone.
  assert.equal(/needs a position model this lane has not traced/.test(pool), false);
  assert.match(pool, /the position model it needed turns\s*\n\/\/ out to be the sprite's own geometry/);
  // The one thing still outside: the box itself comes from the animation runtime.
  assert.match(pool, /not the routine, only WHICH bank/);
});
