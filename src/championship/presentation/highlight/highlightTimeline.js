// The important-highlight template's clock: five named phases, their tunable
// durations and the one rule that decides whether an event earns them.
//
// Pure presentation arithmetic. Nothing here reads or writes game state; the
// caller hands in a settled receipt that the app has already written, and the
// template only decides how long each beat of its presentation lasts.
//
// Phases (2026-09-29 redesign, product-authored):
//   PREPARE  預備      the stage dims and quiets
//   BUILD    遞進      the three stair marks light one after another
//   CHARGE   蓄力      energy gathers to the centre (0.6 - 1.0 s)
//   BURST    爆發      flash, shock ring, pixel shards
//   REVEAL   揭曉與結算 the verdict plate lands and the real amount counts up

export const HIGHLIGHT_PHASES = Object.freeze(["PREPARE", "BUILD", "CHARGE", "BURST", "REVEAL"]);

/** The brief asks for a 0.6 - 1.0 s charge; any override is held inside it. */
export const HIGHLIGHT_CHARGE_RANGE_MS = Object.freeze([600, 1000]);

/**
 * Tunable parameters. Durations are milliseconds.
 * - stairSteps: marks lit during BUILD (the pixel-stair signature has three).
 * - particleCount: pixel shards in the bounded Three.js burst (hard cap 160).
 * - countUpMs: how long REVEAL takes to count the settled amount up.
 * - tickLimit: most count-up ticks the audio plays, however large the amount.
 * - audioGain: master gain of the synthesized cues (0 mutes them).
 */
export const HIGHLIGHT_DEFAULTS = Object.freeze({
  prepareMs: 420,
  buildMs: 720,
  chargeMs: 800,
  burstMs: 280,
  revealMs: 1500,
  countUpMs: 900,
  stairSteps: 3,
  particleCount: 96,
  tickLimit: 14,
  audioGain: 0.16,
  reducedRevealMs: 240
});

const PARTICLE_CAP = 160;

/**
 * The "compact" highlight preference (settings round, 2026-09-29): the same
 * five phases, each shorter, about 2.4 s instead of 3.7 s. The settled figure,
 * the count-up's end value and every cue's meaning are unchanged; only how
 * long the choreography takes differs. CHARGE stays inside its 0.6 s floor.
 */
export const HIGHLIGHT_COMPACT = Object.freeze({
  prepareMs: 200,
  buildMs: 360,
  chargeMs: 600,
  burstMs: 220,
  revealMs: 1000,
  countUpMs: 600
});

/**
 * Timing overrides for one run from the player's presentation preferences.
 * `quality` is a QUALITY_TIERS entry (presentationPreferences.js); `mode` is
 * "full" or "compact". Unknown or missing values fall back to the defaults.
 */
export function highlightOverrides({ mode = "full", quality = null } = {}) {
  const overrides = mode === "compact" ? { ...HIGHLIGHT_COMPACT } : {};
  if (quality && Number.isFinite(quality.highlightParticles)) overrides.particleCount = quality.highlightParticles;
  if (quality && Number.isFinite(quality.highlightStairs)) overrides.stairSteps = quality.highlightStairs;
  return overrides;
}

function finite(value, name, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`HIGHLIGHT_${name}_NOT_A_NUMBER`);
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve the timing for one run. Reduced motion keeps only a short reveal:
 * the change still reads as a change, but nothing travels, flashes or bursts.
 */
export function resolveHighlightTiming(overrides = {}, { reducedMotion = false } = {}) {
  const merged = { ...HIGHLIGHT_DEFAULTS, ...overrides };
  const timing = {
    prepareMs: finite(merged.prepareMs, "PREPARE", 0, 2000),
    buildMs: finite(merged.buildMs, "BUILD", 0, 3000),
    chargeMs: finite(merged.chargeMs, "CHARGE", HIGHLIGHT_CHARGE_RANGE_MS[0], HIGHLIGHT_CHARGE_RANGE_MS[1]),
    burstMs: finite(merged.burstMs, "BURST", 0, 1000),
    revealMs: finite(merged.revealMs, "REVEAL", 200, 4000),
    countUpMs: finite(merged.countUpMs, "COUNT_UP", 0, 3000),
    stairSteps: Math.round(finite(merged.stairSteps, "STAIR_STEPS", 1, 3)),
    particleCount: Math.round(finite(merged.particleCount, "PARTICLES", 0, PARTICLE_CAP)),
    tickLimit: Math.round(finite(merged.tickLimit, "TICKS", 0, 40)),
    audioGain: finite(merged.audioGain, "AUDIO_GAIN", 0, 0.5),
    reducedMotion: Boolean(reducedMotion)
  };
  timing.countUpMs = Math.min(timing.countUpMs, timing.revealMs);
  if (reducedMotion) {
    const reveal = finite(merged.reducedRevealMs, "REDUCED_REVEAL", 120, 600);
    Object.assign(timing, { prepareMs: 0, buildMs: 0, chargeMs: 0, burstMs: 0, revealMs: reveal, countUpMs: 0, particleCount: 0 });
  }
  timing.totalMs = timing.prepareMs + timing.buildMs + timing.chargeMs + timing.burstMs + timing.revealMs;
  return Object.freeze(timing);
}

function durations(timing) {
  return [timing.prepareMs, timing.buildMs, timing.chargeMs, timing.burstMs, timing.revealMs];
}

/** Where a run is at `elapsedMs`: the phase, its index and 0..1 progress. */
export function phaseAt(elapsedMs, timing) {
  const spans = durations(timing);
  let start = 0;
  const at = Math.max(0, elapsedMs);
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (span > 0 && at < start + span) {
      return Object.freeze({ phase: HIGHLIGHT_PHASES[index], index, progress: (at - start) / span, elapsedInPhase: at - start, done: false });
    }
    start += span;
  }
  return Object.freeze({ phase: "DONE", index: HIGHLIGHT_PHASES.length, progress: 1, elapsedInPhase: 0, done: true });
}

/** Start time of a phase, so a skip or a test can land exactly on it. */
export function phaseStartMs(phase, timing) {
  const index = HIGHLIGHT_PHASES.indexOf(phase);
  if (index < 0) throw new RangeError(`HIGHLIGHT_UNKNOWN_PHASE_${phase}`);
  return durations(timing).slice(0, index).reduce((sum, span) => sum + span, 0);
}

/**
 * The displayed amount while it counts up. Ease-out, whole numbers only, never
 * above the target, and exactly the target once the count is finished: the
 * last frame always shows the settled figure, never a rounded neighbour.
 */
export function countUpValue(target, progress) {
  if (!Number.isSafeInteger(target) || target < 0) throw new RangeError("HIGHLIGHT_COUNT_TARGET");
  if (!(progress < 1)) return target;
  if (!(progress > 0)) return 0;
  const eased = 1 - (1 - progress) ** 3;
  return Math.min(target, Math.floor(target * eased));
}

/**
 * Feedback tier for a battle result, from the app's own settled receipt.
 *
 *   highlight  a won, settled match that paid out, raised the tamer rank or
 *              earned a title -- the important-highlight template runs
 *   result     everything else (a loss, a draw, practice, an abandoned or
 *              unsettled match) -- the ordinary result entrance
 *
 * A receipt from another attempt is never trusted: a practice match that
 * writes no receipt must not replay the previous match's win.
 */
export function classifyBattleResultFeedback({ receipt = null, attemptId = null, progression = null } = {}) {
  const settled = receipt?.status === "SETTLED" && receipt.won === true
    && attemptId !== null && receipt.attemptId === attemptId
    && Number.isSafeInteger(receipt.rewardBits) && receipt.rewardBits >= 0
    && Number.isSafeInteger(receipt.credited) && receipt.credited >= 0
    && Number.isSafeInteger(receipt.walletAfter) && receipt.walletAfter >= receipt.credited;
  if (!settled) return "result";
  const rankUp = Number.isInteger(progression?.rankBefore) && Number.isInteger(progression?.rankAfter)
    && progression.rankAfter > progression.rankBefore;
  const titled = Array.isArray(progression?.earnedTitles) && progression.earnedTitles.length > 0;
  return receipt.rewardBits > 0 || rankUp || titled ? "highlight" : "result";
}
