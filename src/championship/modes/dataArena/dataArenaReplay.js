// Data Arena Deterministic Match Replay Recorder & Playback (2026-11-21).
//
// Because createDataArenaSimulation() is 100 % pure and deterministic from
// (seed, match options, per-step inputs), a full 180-second match replays
// bit-for-bit from run-length-compressed input diffs alone. Zero DOM, zero Pixi.

const INPUT_KEYS = Object.freeze([
  "moveX", "moveY", "aimX", "aimY", "fire", "dash", "guard", "tactical",
  "surge", "ride", "cast", "ult", "autoAim", "switchPartner", "burst", "overLimit", "controlMode"
]);

function compactInput(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of INPUT_KEYS) {
    const val = raw[key];
    if (val === undefined || val === null || val === false || (val === 0 && key !== "cast")) continue;
    out[key] = typeof val === "number" ? Math.round(val * 1000) / 1000 : val;
  }
  return out;
}

function sameInput(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Records a live RELAY match as compact run-length-encoded input frames.
 * Only writes an entry when the normalized input changes or a one-shot action fires.
 */
export function createRelayReplayRecorder(config) {
  const frames = [];
  let stepIndex = 0;
  let lastSerialized = null;
  let finalized = null;

  return Object.freeze({
    record(rawInput) {
      if (finalized) return;
      const clean = compactInput(rawInput);
      // One-shot inputs (dash, guard, tactical, cast, ult, switchPartner, burst, overLimit) always record cleanly;
      // continuous movement/aim compresses whenever identical to previous step.
      if (!lastSerialized || !sameInput(clean, lastSerialized)) {
        frames.push({ s: stepIndex, i: clean });
        lastSerialized = clean;
      }
      stepIndex++;
    },
    finalize(summary = null) {
      if (finalized) return finalized;
      finalized = Object.freeze({
        version: 1,
        config: JSON.parse(JSON.stringify(config)),
        totalSteps: stepIndex,
        frames: Object.freeze(frames.map((f) => Object.freeze({ s: f.s, i: Object.freeze({ ...f.i }) }))),
        summary: summary ? Object.freeze({ ...summary }) : null
      });
      return finalized;
    },
    getStepCount: () => stepIndex
  });
}

/**
 * Feeds recorded inputs deterministically into a simulation instance.
 * Supports pause, variable playback speed (0.5x / 1x / 2x) handled by caller,
 * and read-only progress reporting.
 */
export function createRelayReplayPlayer(replay) {
  const frames = replay?.frames ?? [];
  const totalSteps = Math.max(0, Number(replay?.totalSteps) || 0);
  let cursor = 0;
  let stepIndex = 0;
  let currentInput = {};

  return Object.freeze({
    nextInput() {
      if (stepIndex >= totalSteps) return null;
      while (cursor < frames.length && frames[cursor].s <= stepIndex) {
        currentInput = frames[cursor].i;
        cursor++;
      }
      stepIndex++;
      return currentInput;
    },
    reset() {
      cursor = 0;
      stepIndex = 0;
      currentInput = {};
    },
    isDone: () => stepIndex >= totalSteps,
    getProgress: () => ({
      step: stepIndex,
      totalSteps,
      ratio: totalSteps > 0 ? Math.min(1, stepIndex / totalSteps) : 1
    })
  });
}
