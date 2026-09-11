// The guided tutorial's cursor, over the step catalogue built from the observed
// original run. `tutorialStep` already exists in the opening save (see
// nativeOpeningState.js); nothing wrote or read it before this module.
//
// The catalogue holds indices and structure only. What each step says is
// product-authored copy in ../text/, layered on the original's record ids the
// same way the mail and catalog copy is.
//
// Each step either waits to be acknowledged or waits for one named action, read
// from what the original's own line instructs. The cartridge's internal advance
// predicate is not traced. These event names are an ENGINEERING_PROPOSAL
// inferred from observed text, not verified cartridge predicates. This module
// is not bound to normal onboarding until that source contract is closed.
import catalogue from "../../data/championship/catalogs/tutorial-steps.r1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";

export const TUTORIAL_CONTRACT = catalogue.contract;
export const TUTORIAL_STEP_COUNT = catalogue.stepCount;
export const TUTORIAL_PHASES = deepFreeze(["RAISING", "GATE", "HUNT"]);
/** The opening save's "finished or skipped" cursor; nativeOpeningState allows -1. */
export const TUTORIAL_FINISHED = -1;

const STEPS = deepFreeze(catalogue.steps.map((step) => ({ ...step })));

function tutorialError(message) {
  return new Error(`TUTORIAL_${message}`);
}

function requireStep(step) {
  if (!Number.isInteger(step)) throw tutorialError("STEP_MUST_BE_AN_INTEGER");
  if (step === TUTORIAL_FINISHED) return step;
  if (step < 0 || step >= TUTORIAL_STEP_COUNT) throw tutorialError(`STEP_OUT_OF_RANGE: ${step}`);
  return step;
}

/** A new game starts on the first step; a save that never had one keeps null. */
export function createTutorialCursor() {
  return 0;
}

export function tutorialFinished(step) {
  return requireStep(step) === TUTORIAL_FINISHED;
}

export function tutorialStepAt(step) {
  if (tutorialFinished(step)) return null;
  return STEPS[requireStep(step)];
}

/** Every step of one phase, in order — what a phase's own screen has to teach. */
export function tutorialStepsForPhase(phase) {
  if (!TUTORIAL_PHASES.includes(phase)) throw tutorialError(`UNKNOWN_PHASE: ${phase}`);
  return deepFreeze(STEPS.filter((step) => step.phase === phase));
}

/**
 * What the player has to do to leave this step: `ACKNOWLEDGE` for a remark, or
 * the one action the original's line asks for.
 */
export function tutorialExpectedAction(step) {
  return tutorialStepAt(step)?.advance ?? null;
}

/**
 * Advance one step. `action` must match what the step expects; anything else
 * leaves the cursor where it is and says so, so a stray tap cannot skip a
 * lesson and an untaught action cannot be mistaken for the taught one.
 */
export function advanceTutorial(step, action) {
  const current = tutorialStepAt(step);
  if (!current) return deepFreeze({ ok: false, reason: "TUTORIAL_ALREADY_FINISHED", step });
  if (typeof action !== "string" || action.length === 0) throw tutorialError("ACTION_REQUIRED");
  if (action !== current.advance) {
    return deepFreeze({ ok: false, reason: "TUTORIAL_ACTION_MISMATCH", step,
      expected: current.advance, received: action });
  }
  const next = step + 1 >= TUTORIAL_STEP_COUNT ? TUTORIAL_FINISHED : step + 1;
  return deepFreeze({ ok: true, step: next, finished: next === TUTORIAL_FINISHED,
    phase: current.phase, completed: current.step });
}

/** Leaving the tutorial early is the player's call, and it is not resumable. */
export function skipTutorial(step) {
  requireStep(step);
  return TUTORIAL_FINISHED;
}
