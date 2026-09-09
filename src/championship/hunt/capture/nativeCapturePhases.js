// OVL0 0210C01C / 0210BF2C, AI10 02111644 / 02111744 / 02111800,
// and collection controller 021171F0. These are native update steps, not ms.
// Rendering consumes the returned phases/effects; it cannot accelerate ownership.
const Q12 = 4096;
const freeze = Object.freeze;

function integerSqrt(value) {
  if (value < 0n) throw new TypeError("NATIVE_SQRT_NEGATIVE");
  if (value < 2n) return value;
  let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  for (;;) { const next = (x + value / x) >> 1n; if (next >= x) return x; x = next; }
}

// Nitro 02002A0C and 02002A6C: preserve hardware sqrt/divide rounding.
export function nativeVectorLengthQ12(vector) {
  const square = vector.reduce((sum, n) => sum + BigInt(n) ** 2n, 0n);
  return Number((integerSqrt(square * 4n) + 1n) >> 1n);
}
export function nativeNormalizeQ12(vector) {
  const square = vector.reduce((sum, n) => sum + BigInt(n) ** 2n, 0n);
  if (square === 0n) throw new TypeError("NATIVE_ZERO_VECTOR_NORMALIZATION_REQUIRES_CALLER_GUARD");
  const factor = ((1n << 56n) / square) * integerSqrt(square * 4n);
  return vector.map((n) => Number((factor * BigInt(n) + (1n << 44n)) >> 45n));
}

export const createNativeDownClock = () => freeze({ ticks: 15, shakeX: 0, shakeY: 1, toggle: 0 });
export function stepNativeDownClock(clock, positionQ12) {
  let { ticks, shakeX, shakeY, toggle } = clock;
  const position = [...positionQ12];
  if (ticks > 0) {
    if (ticks % 2 !== 0) {
      toggle = toggle ? 0 : 1;
      position[0] += (toggle ? 1 : -1) * shakeX * Q12;
      position[1] += (toggle ? 1 : -1) * shakeY * Q12;
    }
    ticks--;
  }
  return freeze({ clock: freeze({ ticks, shakeX, shakeY, toggle }), positionQ12: freeze(position) });
}

export function enterNativeAi10(positionQ12, previousPositionQ12) {
  let velocity = positionQ12.map((n, i) => (n - previousPositionQ12[i]) * 3);
  if (nativeVectorLengthQ12(velocity) > 30 * Q12) velocity = nativeNormalizeQ12(velocity).map((n) => n * 5);
  return freeze({ clock: createNativeDownClock(), velocityQ12: freeze(velocity) });
}
export function stepNativeAi10Motion(positionQ12, velocityQ12, isNativeTileBlocked) {
  if (typeof isNativeTileBlocked !== "function") throw new TypeError("NATIVE_AI10_COLLISION_PORT_REQUIRED");
  const candidate = positionQ12.map((n, i) => n + velocityQ12[i]);
  // Native ASR to whole pixels, then signed integer division by eight.
  const tile = candidate.slice(0, 2).map((n) => Math.trunc(Math.floor(n / Q12) / 8) || 0);
  const blocked = isNativeTileBlocked(...tile);
  if (typeof blocked !== "boolean") throw new TypeError("NATIVE_AI10_COLLISION_RESULT_REQUIRED");
  return freeze({ positionQ12: freeze(blocked ? [...positionQ12] : candidate),
    velocityQ12: freeze(velocityQ12.map((n) => Math.trunc(n / 2) || 0)), blocked });
}

export const createNativeHandController = () => freeze({ phase: 0, counter: 0 });
export function stepNativeHandController(controller) {
  let { phase, counter } = controller;
  if (!Number.isInteger(phase) || phase < 0 || phase > 4 || !Number.isInteger(counter) || counter < 0) {
    throw new TypeError("INVALID_NATIVE_HAND_CONTROLLER");
  }
  const effects = [];
  // Phase 4 is post-insertion presentation and has no further card write here.
  if (phase === 4) return freeze({ controller, effects: freeze(effects), insert: false });
  const motionTQ12 = phase === 2 ? Math.trunc(counter * Q12 / 60) : null;
  counter += phase === 2 ? 2 : 1;
  if (phase === 0 && counter === 10) effects.push("HIDE_WILD");
  if (counter > [40, 10, 60, 10][phase]) {
    phase++; counter = 0;
    effects.push([null, "HAND_LIFT", "CARD_FLIGHT", "CARD_ARRIVAL", "INSERT_CARD"][phase]);
  }
  return freeze({ controller: freeze({ phase, counter }), effects: freeze(effects),
    motionTQ12, insert: phase === 4 });
}

// The pull-event prefix of AI8 (02110D00..02110E10), before collision/escape
// and combat decisions. It does NOT replace AI8's unclosed movement host.
export function stepNativeAi8PullEvents(state, events, wildRandom) {
  let { restrictedTicks, movementRestricted, pull13, pull11, escapeCounter } = state;
  if (events.includes(0x13)) {
    pull13 = 1;
    if (restrictedTicks === 0) {
      if (typeof wildRandom !== "function") throw new TypeError("NATIVE_AI8_RNG_PORT_REQUIRED");
      if (wildRandom(80) === 0) { restrictedTicks = wildRandom(60) + 30; movementRestricted = 1; }
    }
    escapeCounter = 0;
  } else pull13 = 0;
  if (restrictedTicks !== 0 && --restrictedTicks <= 0) { restrictedTicks = 0; movementRestricted = 0; }
  pull11 = events.includes(0x11) ? 1 : 0;
  if (pull11) escapeCounter = 0;
  return freeze({ ...state, restrictedTicks, movementRestricted, pull13, pull11, escapeCounter,
    poseRequest: pull11 ? 15 : 11, movementMode: pull11 ? 2 : 3 });
}

// 0210B5E4 selects B2/B3 using channel 0 parity; the range mapping divides
// by 102. The caller supplies the existing native RNG authority.
export function nativeWildRandom(max, nextChannel) {
  if (!Number.isInteger(max) || max < 1 || typeof nextChannel !== "function") throw new TypeError("NATIVE_WILD_RNG_REQUIRED");
  const parity = nextChannel(0);
  const sample = nextChannel(parity % 2 === 0 ? 0xB2 : 0xB3);
  if (!Number.isInteger(parity) || parity < 0 || parity > 102 || !Number.isInteger(sample) || sample < 0 || sample > 102) {
    throw new TypeError("INVALID_NATIVE_RNG_SAMPLE");
  }
  return Math.trunc((max - 1) * sample / 102);
}
