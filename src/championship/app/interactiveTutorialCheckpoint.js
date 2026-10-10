import {TUTORIAL_HUNT_STEPS} from "./interactiveTutorialHuntSteps.js";
import {TUTORIAL_BATTLE_STEPS} from "./interactiveTutorialBattleSteps.js";
import {TUTORIAL_RAISING_STEPS} from "./interactiveTutorialRaisingSteps.js";
// Semantic save boundaries for INTERACTIVE_OPENING_TUTORIAL.v1.
// These are semantic save boundaries, never indices into the legacy 35 steps.
// Five-language preview passed. Browser shell restricts new invitations to loopback.
// Local onboarding acceptance and publication remain separate gates.
export const INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE = true;

const KEYS = ["version", "stage", "message"];
export function normalizeInteractiveTutorialCheckpoint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== KEYS.length
    || Reflect.ownKeys(value).some(key => !KEYS.includes(key))
    || value.version !== 1 || typeof value.stage !== "string" || !Number.isInteger(value.message))
    throw new TypeError("INVALID_INTERACTIVE_TUTORIAL_CHECKPOINT");
  const count = TUTORIAL_RAISING_STEPS[value.stage]?.count ?? TUTORIAL_HUNT_STEPS[value.stage]?.count ?? TUTORIAL_BATTLE_STEPS[value.stage]?.count ?? (["invitation","declined","completed"].includes(value.stage)?1:0);
  if (value.message < 0 || value.message >= count)
    throw new TypeError("INVALID_INTERACTIVE_TUTORIAL_CHECKPOINT");
  return Object.freeze({ version: 1, stage: value.stage, message: value.message });
}

export function interactiveTutorialInProgress(opening) {
  return opening?.version === 2 && !["declined","completed"].includes(opening.checkpoint.stage);
}

export function sameInteractiveTutorialCheckpoint(left, right) {
  const a = normalizeInteractiveTutorialCheckpoint(left);
  const b = normalizeInteractiveTutorialCheckpoint(right);
  return a.version === b.version && a.stage === b.stage && a.message === b.message;
}
