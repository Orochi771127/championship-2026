// Original normal encounter order, through same-species grouping. The caller
// owns Gate/time/history/environment and the continuing gameplay RNG. This
// module never loads a ROM, research receipt, renderer, seed or recorded wild.
import { expandNativeHuntCandidates, generateNativeHuntIndividualPool } from "./nativeHuntIndividualPool.js";
import { initializeNativeHuntAi, nativeHuntInitialSpeed, groupNativeHuntActors } from "./nativeHuntActorInitialization.js";
import { initializeNativeHuntPosition } from "./nativeHuntSpawn.js";

export function generateNativeHuntEncounter({ baseCount, candidateInput, speciesByIndex, rng,
  released = null, carried = null, environment, sceneEffect } = {}) {
  // Carried slot0 shares normal registration, then 0211AA60..AA98 queues
  // request45 and immediately updates EVERY active actor (02065CE8). Its AI
  // dispatch is not closed by ordinary placement; reject before any RNG.
  if (carried !== null) throw new Error("HUNT_GENERATION_CARRIED_ACTOR_REQUIRES_TRACE");
  if (typeof environment?.readTerrain !== "function" || typeof environment?.isBlocked !== "function"
    || !Number.isInteger(environment.width) || environment.width < 1 || environment.width > 256
    || !Number.isInteger(environment.height) || environment.height < 1 || environment.height > 256) {
    throw new Error("HUNT_GENERATION_ENVIRONMENT_REQUIRED");
  }
  if (!sceneEffect || !Number.isInteger(sceneEffect.threshold) || sceneEffect.threshold < 0 || sceneEffect.threshold > 255
    || typeof sceneEffect.primaryPresent !== "boolean" || typeof sceneEffect.secondaryPresent !== "boolean"
    || !Number.isInteger(sceneEffect.parameter) || sceneEffect.parameter < 0 || sceneEffect.parameter > 65535) {
    throw new Error("HUNT_GENERATION_SCENE_EFFECT_REQUIRED");
  }
  const candidates = expandNativeHuntCandidates(candidateInput);
  // Validate all speed inputs before any RNG, including a released candidate.
  for (const i of new Set([...candidates, ...(released ? [released.speciesIndex] : [])])) {
    nativeHuntInitialSpeed(speciesByIndex(i), 0);
  }
  const pool = generateNativeHuntIndividualPool({ baseCount, candidates, speciesByIndex, rng, released, carried });
  const actors = pool.records.map((individual, index) => {
    const speciesIndex = individual.fields["000"];
    const ai = initializeNativeHuntAi(rng);
    const placement = initializeNativeHuntPosition({ rng, widthPixels:environment.width * 8,
      heightPixels:environment.height * 8, terrain:environment });
    // 0206489C: registration binds the individual to the entity slot. Pool
    // construction's 0xffffffff is not the final registered record identity.
    individual.fields["004"] = index;
    return { speciesIndex, individual, ai:{ ...ai, speedQ12:nativeHuntInitialSpeed(speciesByIndex(speciesIndex), individual.fields["018"]) },
      facing:placement.facing, positionQ12:placement.positionQ12, repair:placement.repair };
  });
  // 0204331C runs even when the effect resource is absent. This is an actual scene
  // probability decision, not a padding draw added to match a recorded stream.
  // Resource presence is a functional input; native resource pointers are not
  // runtime identifiers and never enter this module or its output.
  const sceneEffectTriggered = rng.next(0) < sceneEffect.threshold && sceneEffect.primaryPresent;
  const grouped = groupNativeHuntActors(actors, { rng, readTerrain:environment.readTerrain, firstIndex:carried === null ? 0 : 1 });
  return { ...pool, actors:grouped, sceneEffect:{ ...sceneEffect, triggered:sceneEffectTriggered } };
}
