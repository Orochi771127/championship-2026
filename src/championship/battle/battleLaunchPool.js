// Launch pool — the twelve in-flight objects a battle shares.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// State 15 allocates into one of a combatant's three launch slots. This is where
// the object comes from, and why a launch can be refused.
//
// THE POOL
// --------
//   0210F8CC  add  r1, r0, ip, lsl #2
//   0210F8D0  add  r1, r1, #0x47000
//   0210F8D4  ldr  r2, [r1, #0x948]      pool[i] at globalCtx + 0x47948 + i*4
//   0210F8DC  ldr  r1, [r2]
//   0210F8E0  lsl  r1, r1, #0x1f
//   0210F8E4  lsrs r1, r1, #0x1f         bit 0 of the object's first word
//   0210F8E8  cmpeq r3, #0               keep only the FIRST free one
//   0210F8F0  cmp  ip, #0xc              twelve objects
//
// Twelve objects for the whole battle, and a combatant may hold three of them,
// so four combatants launching at once can exhaust the pool. The scan walks all
// twelve even after it has found one — there is no early exit, it just refuses
// to overwrite what it already has.
//
// Bit 0 of the first word is the in-use flag, and the two release paths in state
// 15 clear it with `bic r1, r1, #1`. Allocation and release are two ends of the
// same bit.
//
// WHY A LAUNCH IS REFUSED
// -----------------------
// The initialiser at 0x0211C098 ends by storing the action into the new object
// at +0xE8 and tail-calling 0x0211C144 — which is the action-resource charge
// battleActionResource already translates. That routine opens with:
//
//   0211C150  ldr r1, [r6, #0x154]
//   0211C158  cmp r1, #0
//   0211C164  movne r0, #0               occupied: refuse, charge nothing
//
// and then applies the cost gate battleActionResource models. So a launch is
// refused for one of two reasons, and both look identical to state 15: the
// combatant's +0x154 is already taken, or it cannot afford the action's +0x48.
//
// +0x154 IS THE SAME FIELD THREE THINGS TOUCH
// -------------------------------------------
// The two script natives at 0x0211CEC4 and 0x0211CEFC acquire and release it.
// R9 corrected CEFC: it clears only when the supplied object owns the lock. It is what
// the charge refuses on. And it is where the nine-group candidate array stops:
// +0xE8 plus nine twelve-byte groups lands exactly on +0x154. Three separate
// traces, one field.
//
// WHERE A LAUNCHED OBJECT STARTS  (OVL19 0x0211C098)
// ---------------------------------------------------
// The initialiser's body is now read, and the position model it needed turns
// out to be the sprite's own geometry:
//
//   0211C0BC  ldr   r0, [r4, #4]
//   0211C0C4  bl    #0x2047e58        the current animation cell
//   0211C0C8  ldr   r3, [r4, #0x2c]   the three-word position block
//   0211C0D0  ldrsh r1, [r0]          cell x0
//   0211C0CC  ldrsh r2, [r0, #4]      cell x1
//   0211C0D4  ldr   ip, [r3]          position x
//   0211C0E0  add   r1, r1, r1, lsr #31
//   0211C0E4  asr   r1, r1, #1        toward-zero midpoint
//   0211C0E8  add   r1, ip, r1, lsl #12
//   0211C0F4  ldrsh r2, [r0, #6]      cell y1
//   0211C0F8  ldrsh r1, [r0, #2]      cell y0
//   0211C120  ldr   r6, [r2, #8]      position z, carried unchanged
//   0211C12C  str   r4, [r7, #0xe8]   and the action lands on the object
//
// So a launch starts at the owner's position plus the CENTRE of its current
// sprite cell, in x and y, with z untouched. The three-word block at +0x2C is
// the same one the getters at 0x0211CE7C, 0x0211CE94 and 0x0211CEAC read, and
// 0x0211D418 writes.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What an in-flight object is, beyond bit 0 of its first word and the action at
// its +0xE8. What +0x154 means, only that it gates one launch at a time.
//
// And the cell box itself. This was recorded as the ONE routine the rest of the
// stage waited on, modelled here as an input. It has since been read:
// battleSpriteCellBox translates 0x02047E58 whole, along with the bank lookup at
// 0x0202DD54 it goes through, and `cellBoxToLaunchCell` produces exactly the
// shape `launchPosition` takes below. What is still outside is narrower than it
// looked -- not the routine, only WHICH bank [obj+0xC8] reaches and WHICH cell
// index [obj+0x70] holds. Those are the OVL9 resource manager's and the art
// lane's, and the remake's own art is not generated yet.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_LAUNCH_POOL_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_LAUNCH_POOL_ALLOCATOR_SITE = "OVL19:0x0210F8C4";
export const BATTLE_LAUNCH_POOL_INITIALISER_SITE = "OVL19:0x0211C098";
export const BATTLE_LAUNCH_POOL_CHARGE_SITE = "OVL19:0x0211C144";

/** cmp ip,#0xC at 0x0210F8F0. */
export const BATTLE_LAUNCH_POOL_SIZE = 12;
/** globalCtx + 0x47000 + 0x948 + i*4. */
export const BATTLE_LAUNCH_POOL_BASE_OFFSET = 0x47948;

/** Bit 0 of the object's first word, set on use and cleared by `bic #1`. */
export const BATTLE_LAUNCH_IN_USE_BIT = 1;

/** The action is stored into the new object here, at 0x0211C12C. */
export const BATTLE_LAUNCH_ACTION_OFFSET = 0xe8;

/** The lock the charge refuses on, at 0x0211C150. */
export const BATTLE_LAUNCH_LOCK_OFFSET = 0x154;

export const BATTLE_LAUNCH_REFUSED_LOCKED = "LOCK_OCCUPIED";
export const BATTLE_LAUNCH_REFUSED_COST = "COST_ABOVE_RESOURCE";
export const BATTLE_LAUNCH_ACCEPTED = "CHARGED";

/** The three-word position block, and the cell box the launch centres on. */
export const BATTLE_LAUNCH_POSITION_OFFSET = 0x2c;
export const BATTLE_LAUNCH_CELL_SITE = "ARM9:0x02047E58";
export const BATTLE_LAUNCH_CELL_FIELDS = deepFreeze({ x0: 0x00, y0: 0x02, x1: 0x04, y1: 0x06 });
/** `lsl #12` — the position is Q12 world units and the cell box is not. */
export const BATTLE_LAUNCH_POSITION_SHIFT = 12;

function poolError(message) {
  return new Error(`BATTLE_LAUNCH_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw poolError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

function requirePool(pool) {
  if (!Array.isArray(pool) || pool.length !== BATTLE_LAUNCH_POOL_SIZE) {
    throw poolError(`POOL_MUST_BE_${BATTLE_LAUNCH_POOL_SIZE}_LONG`);
  }
  return pool;
}

/** Whether an object's first word marks it in use. */
export function isLaunchObjectInUse(firstWord) {
  return (requireInteger(firstWord, "FIRST_WORD") & BATTLE_LAUNCH_IN_USE_BIT) !== 0;
}

/** `bic r1, r1, #1` — the two release paths in state 15. */
export function releaseLaunchObject(firstWord) {
  return requireInteger(firstWord, "FIRST_WORD") & ~BATTLE_LAUNCH_IN_USE_BIT;
}

/**
 * OVL19 0x0210F8C4. `pool` is the twelve first-words. Returns the index of the
 * first free object, or -1. The original walks all twelve regardless; the index
 * it returns is the lowest free one either way.
 */
export function allocateLaunchObject(pool) {
  const firstWords = requirePool(pool);
  let found = -1;
  for (let index = 0; index < BATTLE_LAUNCH_POOL_SIZE; index += 1) {
    // `cmpeq r3, #0 / moveq r3, r2` — a later free object never displaces one
    // already held, and the loop runs to twelve with no early exit.
    if (!isLaunchObjectInUse(firstWords[index]) && found < 0) {
      found = index;
    }
  }
  return found;
}

/** How many of the twelve are free right now. */
export function freeLaunchObjects(pool) {
  return requirePool(pool).filter((word) => !isLaunchObjectInUse(word)).length;
}

/**
 * OVL19 0x0211C144's two gates, in the order it applies them. The cost gate is
 * battleActionResource's: `blt` refuses only a cost strictly above the balance,
 * so paying down to exactly zero is allowed, and a refusal charges nothing.
 */
export function chargeLaunch(input) {
  if (!input || typeof input !== "object") {
    throw poolError("CHARGE_REQUIRES_AN_OBJECT");
  }
  const lock = requireInteger(input.lock ?? 0, "LOCK");
  if (lock !== 0) {
    return deepFreeze({ outcome: BATTLE_LAUNCH_REFUSED_LOCKED, charged: 0, resource: input.resource ?? 0 });
  }
  const resource = requireInteger(input.resource ?? 0, "RESOURCE");
  const cost = requireInteger(input.cost ?? 0, "COST");
  if (cost > resource) {
    return deepFreeze({ outcome: BATTLE_LAUNCH_REFUSED_COST, charged: 0, resource });
  }
  return deepFreeze({ outcome: BATTLE_LAUNCH_ACCEPTED, charged: cost, resource: resource - cost });
}

/**
 * OVL19 0x0211C098's position maths. `position` is the owner's three-word block
 * and `cell` the four signed halfwords 0x02047E58 returns; the cell box is an
 * INPUT because it comes from the animation runtime, not from any battle table.
 *
 * x and y take the box's centre, rounded toward zero as `add r1,r1,r1,lsr#31 /
 * asr r1,#1` does, and z is carried through untouched.
 */
export function launchPosition(position, cell) {
  if (!position || typeof position !== "object") {
    throw poolError("POSITION_REQUIRED");
  }
  if (!cell || typeof cell !== "object") {
    throw poolError("CELL_BOX_REQUIRED");
  }
  const centre = (low, high) => {
    const sum = requireInteger(low, "CELL") + requireInteger(high, "CELL");
    // `add r1, r1, r1, lsr #31` before the shift is the toward-zero correction.
    return sum < 0 ? -((-sum) >> 1) : sum >> 1;
  };
  return deepFreeze({
    x: requireInteger(position.x ?? 0, "X") + (centre(cell.x0 ?? 0, cell.x1 ?? 0) << BATTLE_LAUNCH_POSITION_SHIFT),
    y: requireInteger(position.y ?? 0, "Y") + (centre(cell.y0 ?? 0, cell.y1 ?? 0) << BATTLE_LAUNCH_POSITION_SHIFT),
    // 0x0211C120 reads +0x08 and stores it with no arithmetic at all.
    z: requireInteger(position.z ?? 0, "Z")
  });
}

/** Both refusals look identical to state 15: the initialiser returned zero. */
export function launchWasInitialised(chargeResult) {
  if (!chargeResult || typeof chargeResult !== "object") {
    throw poolError("RESULT_REQUIRED");
  }
  return chargeResult.outcome === BATTLE_LAUNCH_ACCEPTED;
}
