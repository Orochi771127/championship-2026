// Pure translation of the bounded OVL0 / ARM9 capture dataflow.
// Inputs are explicit native observations, never prototype equipment stats or
// fabricated encounter RNG. See HUNT_CAPTURE_DATAFLOW.v1.json. One instance is
// owned by the existing Hunt runtime; it is not a save, store, or ticker.
import { createNativeDownClock, stepNativeDownClock, createNativeHandController, stepNativeHandController } from "./nativeCapturePhases.js";
const Q12 = 4096;
export const CAPTURE_REPLAY_AUTHORITY = "ROM_DATAFLOW_REPLAY_NOT_FIELD_PARITY";

function integer(value, name, min = 0, max = 0x7fffffff) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`INVALID_CAPTURE_${name}`);
  return value;
}
const frozen = (value) => Object.freeze(value);

// ARM9 020622EC..02062374, RNG stream B7's result is an external input.
export function initializeWildHp({ baseHp, nextRungHp, randomB7 }) {
  integer(baseHp, "BASE_HP", 1, 32767);
  integer(nextRungHp, "NEXT_HP", baseHp, 65535);
  integer(randomB7, "RNG_B7", 0, 102);
  const divisor = Math.trunc(Math.trunc((nextRungHp - baseHp) / 2) / 10);
  // This ROM's signed divmod helper returns remainder zero for denominator
  // zero; CPU replay verifies the capped final rung, including nonzero RNG.
  const remainder = divisor === 0 ? 0 : randomB7 % divisor;
  const hp = baseHp + 10 * remainder;
  return frozen({ currentHp: hp, maxHp: hp });
}

// 0211585C..0211597C and Nitro FX_Div 02002738 (rounded Q12).
export function createNativeRope({ maxHp, generation, coefficient, durabilityByte, temperament71 }) {
  integer(maxHp, "MAX_HP", 1, 32767);
  integer(generation, "GENERATION", 1, 5);
  integer(coefficient, "ROPE_COEFFICIENT", 1, 65535);
  integer(durabilityByte, "ROPE_DURABILITY", 1, 255);
  integer(temperament71, "TEMPERAMENT_71", 0, 255);
  const divisor = coefficient * (generation === 1 ? 3 : 6);
  const damageQ12 = Math.floor((maxHp * Q12 / divisor) + 0.5);
  return frozen({ damageQ12, accumulatorQ12: 0, durability: durabilityByte * 60,
    maxDurability: durabilityByte * 60, temperament71, band: "SLACK" });
}

// One invocation of 02114F54, not one browser frame. Native dx/dy are Q12.
// AI movement/event 11 consumption stays outside this numerical writer.
export function stepNativeRope(rope, currentHp, { dxQ12, dyQ12, movementBlocked = false }) {
  integer(currentHp, "HP");
  integer(dxQ12, "DX_Q12", -0x100000, 0x100000); integer(dyQ12, "DY_Q12", -0x100000, 0x100000);
  if (typeof movementBlocked !== "boolean") throw new TypeError("INVALID_CAPTURE_MOVEMENT_BLOCKED");
  const square = (n) => Number((BigInt(n) * BigInt(n) + 2048n) >> 12n);
  const distanceSquaredQ12 = square(dxQ12) + square(dyQ12);
  let { durability, accumulatorQ12 } = rope;
  if (durability > rope.maxDurability) durability -= (durability - rope.maxDurability) >> 4;
  let band = "SLACK", damage = 0, event = null;
  if (distanceSquaredQ12 < 0x640000) {
    durability = Math.min(rope.maxDurability, durability + 10);
  } else {
    const strong = distanceSquaredQ12 >= 0x1900000; // 80^2 Q12
    band = strong ? "STRONG" : "PULL";
    durability -= 1 + (rope.temperament71 === 2 ? (strong ? 2 : 1) : 0);
    accumulatorQ12 += rope.damageQ12 * (strong ? 2 : 1);
    if (accumulatorQ12 >= Q12) {
      damage = accumulatorQ12 >> 12;
      // Original subtracts ONE Q12 unit, even after damage > 1. Do not replace
      // this with modulo or subtract damage * Q12.
      accumulatorQ12 -= Q12;
    }
    if (strong) {
      event = movementBlocked ? 0x13 : 0x11;
      if (movementBlocked) durability -= 1;
    }
  }
  if (distanceSquaredQ12 > 0x6400000) durability = 0; // strictly > 160^2
  if (durability <= 0) { durability = 0; band = "BROKEN"; }
  return frozen({ currentHp: Math.max(0, currentHp - damage), damage, event,
    rope: frozen({ ...rope, durability, accumulatorQ12, band }) });
}

export function createWildCaptureFlow({ wildId, speciesId, hp, rope, gCost, traceId }) {
  if (!wildId || !speciesId || !traceId) throw new TypeError("CAPTURE_REQUIRES_NATIVE_RECORD_IDENTITY");
  integer(gCost, "G_COST", 1, 255);
  integer(hp?.maxHp, "MAX_HP", 1); integer(hp?.currentHp, "HP", 0, hp.maxHp);
  const sourceVitals = frozen({ currentHp: hp.currentHp, maxHp: hp.maxHp });
  let currentHp = hp.currentHp, state = "WILD", activeRope = null, handTicks = 0;
  let displayName = null;
  let nativePhaseClockActive = false, downClock = null, handController = null, wildHidden = false;
  const snapshot = () => frozen({ wildId, speciesId, currentHp, maxHp: hp.maxHp,
    sourceVitals, gCost, state, rope: activeRope, traceId, displayName,
    nativePhase: frozen({ active: nativePhaseClockActive, downClock, handController, wildHidden }),
    successAuthority: CAPTURE_REPLAY_AUTHORITY });
  return frozen({
    snapshot,
    attach() {
      if (state !== "WILD" || currentHp <= 0) return false;
      activeRope = createNativeRope({ ...rope, maxHp: hp.maxHp }); state = "TETHERED"; return true;
    },
    tickPull(input) {
      if (state !== "TETHERED") return null;
      const result = stepNativeRope(activeRope, currentHp, input);
      // Event 11 is a separate AI handler which may also decrement HP. It must
      // be supplied by a closed AI trace before this bounded replay accepts it.
      if (result.event !== null) throw new Error("CAPTURE_AI_PULL_EVENT_TRACE_REQUIRED");
      activeRope = result.rope; currentHp = result.currentHp;
      if (currentHp === 0) { state = "DOWN_ANIMATION"; activeRope = null; }
      else if (activeRope.band === "BROKEN") { state = "WILD"; activeRope = null; }
      return snapshot();
    },
    release() { if (state === "TETHERED") state = "WILD"; activeRope = null; },
    completeDownAnimation() {
      if (state !== "DOWN_ANIMATION" || nativePhaseClockActive) return false;
      state = "HAND_READY"; return true; // 0210CBBC..0210CBE4
    },
    // Invoked once per native update by the existing Hunt owner. AI10 checks
    // the countdown before the wild update decrements it (observed 352..367).
    // Explicit research completion methods cannot bypass an active clock.
    tickNativePhases() {
      nativePhaseClockActive = true;
      if (state === "DOWN_ANIMATION") {
        downClock ??= createNativeDownClock();
        if (downClock.ticks === 0) {
          state = "HAND_READY";
          return frozen({ snapshot: snapshot(), effects: frozen(["HAND_READY"]), inserted: false });
        }
        downClock = stepNativeDownClock(downClock, [0, 0]).clock;
      } else if (state === "HAND_ANIMATION") {
        const next = stepNativeHandController(handController ?? createNativeHandController());
        handController = next.controller;
        if (next.effects.includes("HIDE_WILD")) wildHidden = true;
        if (next.insert) state = "ON_CARD";
        return frozen({ snapshot: snapshot(), effects: next.effects, inserted: next.insert, motionTQ12: next.motionTQ12 });
      }
      return frozen({ snapshot: snapshot(), effects: frozen([]), inserted: false });
    },
    hand({ maxG, usedG }) {
      integer(maxG, "MAX_G"); integer(usedG, "USED_G");
      if (state !== "HAND_READY") return frozen({ accepted: false, reason: "TARGET_NOT_READY" });
      if (usedG + gCost > maxG) return frozen({ accepted: false, reason: "OVER_CAPACITY", event: 0x39 });
      state = "HAND_ANIMATION";
      handController = createNativeHandController();
      return frozen({ accepted: true, event: 0x20 });
    },
    // Boundary from the actual result animation, 02117458..021178A0. No wall
    // clock guess: this is the insertion subphase, after the preceding animation.
    tickCardInsertionPhase() {
      if (state !== "HAND_ANIMATION" || nativePhaseClockActive) return false;
      handTicks += 1;
      if (handTicks <= 10) return false;
      state = "ON_CARD"; return true;
    },
    rename(name) { if (state !== "ON_CARD") return false; displayName = name; return true; },
    releaseFromCard() { if (state !== "ON_CARD") return false; state = "RELEASED"; return true; },
    markHomeCommitted() { if (state !== "ON_CARD") return false; state = "HOME_COMMITTED"; return true; }
  });
}
