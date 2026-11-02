// Cage training on the real-time clock -- OWNER_APPROVED_ADAPTATION 2026-11-02 (awakening raising).
//
// NOT original behaviour; only the REALTIME_V1 ranch uses it (NATIVE keeps the traced writers untouched).
// - A partner trains when it enters a different cage (native), again every dwellSeconds it stays in one, and
//   once after a battle or a hunt (a minute after its last training at the earliest). Entering cages trains at
//   most once per cooldownSeconds, so moving a partner back and forth earns nothing extra.
// - Point gains (native kinds 0..10) are levelled: each point's best cage gives counterBestGain, the other
//   cages scale with it, so no family needs twice the training of another.
import {NATIVE_RAISING_LIFECYCLE_RULES as rules} from './nativeRaisingLifecycle.js';
import {AWAKENING_TRAINING_RULES, BURST_CONDITION_FIELDS, BURST_CONDITION_IDS} from '../contracts/productBurstEvolution.js';

const POINT_KINDS = 11;
/** Native training kind (0..10, field 0x100 + 4 kind) of each point condition id. */
export const TRAINING_KIND_OF_CONDITION = Object.freeze(Object.fromEntries(BURST_CONDITION_IDS.map((id, i) =>
  [id, (parseInt(BURST_CONDITION_FIELDS[i], 16) - 0x100) / 4])));

// The best single-program gain of each point kind across the cage catalog, and each cage's own best gain.
const cageGains = rules.cages.map(cage => {
  const best = new Array(POINT_KINDS).fill(0);
  for (const program of cage?.programs ?? []) for (const [kind, delta] of program.commands ?? [])
    if (kind < POINT_KINDS && delta > best[kind]) best[kind] = delta;
  return best;
});
const bestByKind = Array.from({length: POINT_KINDS}, (_, kind) => Math.max(0, ...cageGains.map(gains => gains[kind])));

/** Multiplier for a positive point gain of each native kind (0..10). */
export const TRAINING_POINT_SCALE = Object.freeze(bestByKind.map(best => best > 0 ? AWAKENING_TRAINING_RULES.counterBestGain / best : 1));
export function scaledPointGain(kind, delta) {
  return kind < POINT_KINDS && delta > 0 ? Math.max(1, Math.round(delta * TRAINING_POINT_SCALE[kind])) : delta;
}

/**
 * Cages that raise one point condition, best first: [{definition, gain}] with the levelled gain of one training.
 * The waiting room (35) trains nothing and is never listed.
 */
export function recommendedCages(conditionId, {limit = 3} = {}) {
  const kind = TRAINING_KIND_OF_CONDITION[conditionId];
  if (!Number.isInteger(kind)) return Object.freeze([]);
  return Object.freeze(cageGains.map((gains, definition) => ({definition, gain: scaledPointGain(kind, gains[kind])}))
    .filter(entry => entry.definition !== 35 && entry.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.definition - b.definition).slice(0, limit).map(entry => Object.freeze(entry)));
}

export const TRAINING_COOLDOWN_FRAMES = AWAKENING_TRAINING_RULES.cooldownSeconds * 60;
export const TRAINING_DWELL_FRAMES = AWAKENING_TRAINING_RULES.dwellSeconds * 60;
/** The policy the REALTIME_V1 ranch passes to its actors (dueMinimumFrames: the after-match minimum). */
export const REALTIME_TRAINING_POLICY = Object.freeze({cooldownFrames: TRAINING_COOLDOWN_FRAMES, dwellFrames: TRAINING_DWELL_FRAMES,
  dueMinimumFrames: AWAKENING_TRAINING_RULES.afterMatchMinimumSeconds * 60, pointScale: TRAINING_POINT_SCALE});

/**
 * One frame of a partner's real-time training clock (fields on the actor: trainingCooldown, trainingDwell,
 * trainingDue). True when a training is due now: after a battle or hunt (at least dueMinimumFrames after the last
 * training), or after dwellFrames in a training cage while healthy.
 */
export function realtimeTrainingDue(actor, policy, {healthy, trainingCage}) {
  if (actor.trainingCooldown > 0) actor.trainingCooldown--;
  actor.trainingDwell = (actor.trainingDwell ?? 0) + 1;
  return Boolean((actor.trainingDue && policy.cooldownFrames - (actor.trainingCooldown | 0) >= policy.dueMinimumFrames)
    || (actor.trainingDwell >= policy.dwellFrames && trainingCage && healthy));
}
/** A training started: the cooldown and the dwell period start over. */
export function beginRealtimeTraining(actor, policy) { actor.trainingCooldown = policy.cooldownFrames; actor.trainingDwell = 0; actor.trainingDue = false; }
/** Whether entering a different cage trains now (not during the cooldown). */
export function cageEntryTrains(actor) { return !(actor.trainingCooldown > 0); }
