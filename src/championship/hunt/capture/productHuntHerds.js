// Hunt herds -- OWNER_APPROVED_ADAPTATION 2026-11-17 (LINE_FUSION_TAMER_TALENTS_DESIGN_20261117, plan section 5).
//
// NOT original behaviour. The native generation avoids repeating a species, so most species show a single
// partner and same-line fusion has nothing to catch twice. After the native encounter (and the rare lure) is
// built, the product adds more partners of species that are ALREADY out:
//
//   added = clamp(round(native count x 0.4), 2, 6), and never past 20 partners in all
//
// The species with the fewest partners is filled first (so each tends to reach two); a tie goes to the more
// common species of the table (rare ones stay rare), then to the earlier one. A species only the rare lure
// called is not filled. No species is added, so no extra atlas is decoded.
//
// Each added partner is built and placed the way the encounter builds its own -- createNativeHuntIndividual,
// updateNativeHuntIndividual, AI and position initialisation -- from the same continuing RNG, after every
// native draw. The native actors before it are byte-identical with the herd on or off.

import { nativeHuntSpeciesByIndex } from "./nativeHuntSources.js";
import { createNativeHuntIndividual, updateNativeHuntIndividual, validateNativeSpeciesInput } from "./nativeHuntIndividual.js";
import { initializeNativeHuntAi, nativeHuntInitialSpeed } from "./nativeHuntActorInitialization.js";
import { initializeNativeHuntPosition } from "./nativeHuntSpawn.js";

export const HUNT_HERD_RULES = Object.freeze({ share: 0.4, min: 2, max: 6, total: 20 });

/** How many partners a herd adds to `nativeCount` native ones when `present` are already out. */
export function huntHerdCount(nativeCount, present = nativeCount) {
  if (!Number.isSafeInteger(nativeCount) || nativeCount < 1) return 0;
  const wanted = Math.max(HUNT_HERD_RULES.min, Math.min(HUNT_HERD_RULES.max, Math.round(nativeCount * HUNT_HERD_RULES.share)));
  return Math.max(0, Math.min(wanted, HUNT_HERD_RULES.total - present));
}

/**
 * The species the herd adds, in order.
 * @param {number[]} nativeSpecies species index of every native actor, in actor order
 * @param {{speciesIndex:number, weight:number}[]} candidates the table the encounter drew from
 * @param {number} [present] partners already out (native plus a lured one)
 */
export function planHuntHerd(nativeSpecies, candidates = [], present = nativeSpecies.length) {
  const count = new Map(), order = new Map();
  nativeSpecies.forEach((species, i) => { count.set(species, (count.get(species) ?? 0) + 1); if (!order.has(species)) order.set(species, i); });
  const weight = new Map((candidates ?? []).map(row => [row.speciesIndex, row.weight]));
  const added = [];
  for (let n = huntHerdCount(nativeSpecies.length, present); n > 0; n--) {
    const next = [...count.keys()].sort((a, b) => count.get(a) - count.get(b)
      || (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || order.get(a) - order.get(b))[0];
    if (next === undefined) break;
    added.push(next); count.set(next, count.get(next) + 1);
  }
  return added;
}

/** A prepared hunt entry with its herd added after the native (and lured) actors. */
export function appendProductHuntHerds(entry, { speciesByIndex = nativeHuntSpeciesByIndex } = {}) {
  const { scene, encounter, rng, candidates } = entry;
  // The lured partner is the last actor; a species only it brought is not filled.
  const native = entry.rareLure ? encounter.actors.slice(0, -1) : encounter.actors;
  const plan = planHuntHerd(native.map(actor => actor.speciesIndex), candidates, encounter.actors.length);
  if (plan.length === 0) return entry;
  const env = scene.environment, actors = [...encounter.actors], records = [...(encounter.records ?? [])];
  for (const speciesIndex of plan) {
    const species = validateNativeSpeciesInput(speciesByIndex(speciesIndex));
    const individual = createNativeHuntIndividual({ species, rng });
    updateNativeHuntIndividual(individual, { speciesByIndex, rng });
    individual.fields["004"] = actors.length;
    const ai = initializeNativeHuntAi(rng);
    const placement = initializeNativeHuntPosition({ rng, widthPixels: env.width * 8, heightPixels: env.height * 8, terrain: env });
    actors.push({ speciesIndex, individual, herd: true,
      ai: { ...ai, speedQ12: nativeHuntInitialSpeed(speciesByIndex(speciesIndex), individual.fields["018"]) },
      facing: placement.facing, positionQ12: placement.positionQ12, repair: placement.repair });
    records.push(individual);
  }
  return { ...entry, herd: Object.freeze({ added: Object.freeze([...plan]) }), encounter: { ...encounter, records, actors } };
}
