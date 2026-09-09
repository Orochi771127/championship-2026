// OVL0 02113F8C sampling and 02114388 shape predicate. Slot expiry is an
// explicit animation-controller input until the original NANR clock is bound.
// No polygon containment or invented success threshold lives in this sampler.
import { nativeVectorLengthQ12, nativeNormalizeQ12 } from "./nativeCapturePhases.js";
const Q12 = 4096;
const freeze = Object.freeze;
const seal = (s) => freeze({ ...s, last: freeze(s.last), slots: freeze(s.slots.map((p) => p && freeze({ ...p, positionQ12: freeze(p.positionQ12) }))) });
export const createNativeRopeStroke = () => seal({ last: [-1, -1], next: 0, count: 0, counter: 0, slots: Array(20).fill(null) });

export function sampleNativeRopeStroke(previous, screen, camera, nextVariant) {
  if (![...screen, ...camera].every(Number.isSafeInteger) || screen.length !== 2 || camera.length !== 2) {
    throw new TypeError("NATIVE_STROKE_INTEGER_COORDINATES_REQUIRED");
  }
  const state = { ...previous, last: [...previous.last], slots: [...previous.slots] };
  const world = screen.map((n, i) => n + camera[i]);
  if (state.last[0] < 0) { state.last = [...world]; state.counter = 60; }
  const target = world.map((n) => n * Q12), origin = state.last.map((n) => n * Q12);
  const delta = target.map((n, i) => n - origin[i]);
  let distance = nativeVectorLengthQ12(delta);
  if (distance <= 5 * Q12 && ++state.counter <= 60) return seal(state);
  state.counter = 0;
  function add(position) {
    if (typeof nextVariant !== "function") throw new TypeError("NATIVE_STROKE_VARIANT_RNG_REQUIRED");
    const variant = nextVariant();
    if (variant !== 0 && variant !== 1) throw new TypeError("INVALID_NATIVE_STROKE_VARIANT");
    state.slots[state.next] = { variant, positionQ12: [...position] };
    state.next = (state.next + 1) % 20;
    state.count++; // Native count is not clamped when the ring overwrites a slot.
  }
  if (distance > 20 * Q12) {
    const step = nativeNormalizeQ12(delta).map((n) => n * 10);
    let position = origin;
    while (distance > 20 * Q12) {
      position = position.map((n, i) => n + step[i]);
      add(position);
      distance -= 20 * Q12;
    }
    state.last = position.map((n) => Math.floor(n / Q12));
  } else { add(target); state.last = world; }
  return seal(state);
}

export function expireNativeRopeSlots(previous, completedIndices) {
  const state = { ...previous, slots: [...previous.slots] };
  for (const index of completedIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= 20) throw new TypeError("INVALID_NATIVE_STROKE_SLOT");
    if (state.slots[index]) { state.slots[index] = null; state.count--; }
  }
  return seal(state);
}

export function recognizeNativeRopeStroke(state) {
  if (state.count < 6) return null;
  // Scan physical slot order and preserve the first strictly extreme point.
  const extremes = [null, null, null, null]; // left, top, right, bottom
  state.slots.forEach((slot, index) => {
    if (!slot) return;
    for (let kind = 0; kind < 4; kind++) {
      const old = extremes[kind], axis = kind % 2;
      if (!old || (kind < 2 ? slot.positionQ12[axis] < old.point[axis] : slot.positionQ12[axis] > old.point[axis])) {
        extremes[kind] = { index, point: slot.positionQ12 };
      }
    }
  });
  if (extremes.some((n) => !n)) return null;
  const indices = extremes.map((n) => n.index);
  const ordered = indices.some((_, rotation) => {
    const a = indices.map((__, offset) => indices[(rotation + offset) % 4]);
    return a.slice(1).every((n, i) => n > a[i]) || a.slice(1).every((n, i) => n < a[i]);
  });
  if (!ordered) return null;
  const distance = (a, b) => nativeVectorLengthQ12(a.point.map((n, i) => n - b.point[i]));
  const d1 = distance(extremes[0], extremes[1]), d2 = distance(extremes[2], extremes[3]);
  if (d1 <= 25 * Q12 || (Math.abs(d1 - d2) >= 15 * Q12 && Math.abs(d1 - 2 * d2) >= 15 * Q12)) return null;
  const centerQ12 = [extremes[0].point[0] + Math.floor((d1 + 1) / 2), extremes[1].point[1] + Math.floor((d2 + 1) / 2)];
  return freeze({ centerQ12: freeze(centerQ12), centerPixels: freeze(centerQ12.map((n) => Math.floor(n / Q12))),
    extremaIndices: freeze(indices) });
}

export const isNativeHuntEdgeTouch = (x, y) => x <= 16 || x >= 240 || y <= 16 || y >= 176;
