// Candidate construction only. The existing application commits RNG/history
// after world and runtime creation both succeed. Failure has no caller writes.
import { restoreChannelRng } from "../../battle/battleRngChannel.js";
import { resolveNativeHuntSceneSources } from "./nativeHuntSceneSources.js";
import { resolveNativeHuntPoolSources, nativeHuntSpeciesByIndex } from "./nativeHuntSources.js";
import { validateNativeHuntHistory, selectNativeReleasedHistory, applyNativeCarriedHistoryWrite } from "./nativeHuntHistory.js";
import { generateNativeHuntEncounter } from "./nativeHuntGeneration.js";
import { createNativeHuntIndividual, updateNativeHuntIndividual, validateNativeSpeciesInput } from "./nativeHuntIndividual.js";
import { initializeNativeHuntAi, nativeHuntInitialSpeed } from "./nativeHuntActorInitialization.js";
import { initializeNativeHuntPosition } from "./nativeHuntSpawn.js";

// `resolvePool` picks the encounter tables: the native ones by default, the product overlay from the app.
export function prepareNativeHuntEntry({ biomeId, clock, rngSnapshot, persistentState, carried = null, expansion = null,
  resolvePool = resolveNativeHuntPoolSources } = {}) {
  if (!persistentState) throw Error("HUNT_ENTRY_LEGACY_HISTORY_UNKNOWN");
  validateNativeHuntHistory(persistentState.history);
  if (!Number.isInteger(clock?.clockMinutes) || clock.clockMinutes < 0 || clock.clockMinutes >= 1440) {
    throw Error("HUNT_ENTRY_CLOCK_REQUIRED");
  }
  const scene = resolveNativeHuntSceneSources({ biomeId, hour:Math.floor(clock.clockMinutes / 60), season:clock.season, expansion });
  const pool = resolvePool({ ...scene, modifiers:persistentState.modifiers });
  const released = selectNativeReleasedHistory(persistentState.history, scene.biomeIndex);
  const rng = restoreChannelRng(rngSnapshot);
  const encounter = generateNativeHuntEncounter({ ...pool, ...scene, rng, carried, released:released?.entry ?? null });
  const history = encounter.historyWrite ? applyNativeCarriedHistoryWrite(persistentState.history, encounter.historyWrite)
    : structuredClone(persistentState.history);
  return { scene, encounter, releasedSlot:released?.slot ?? null, rng,
    persistentState:{ history, modifiers:structuredClone(persistentState.modifiers) },
    // The table this encounter drew from, for a lure that adds to it.
    candidates:pool.candidateInput.entries };
}

/**
 * Cyber Gachapon rare lure (OWNER_APPROVED_ADAPTATION 2026-11-02): one more wild
 * partner of this field's rarest candidate -- the lowest table weight, then the
 * latest stage, preferring a species not already out -- joins a prepared entry.
 * The candidates are the table the entry itself drew from. It is built and
 * placed the way the encounter builds its own, from the same continuing RNG,
 * so the native actors before it are untouched.
 */
export function appendNativeRareLureActor(entry, { speciesByIndex = nativeHuntSpeciesByIndex } = {}) {
  const { scene, encounter, rng, candidates } = entry;
  const out = new Set(encounter.actors.map(actor => actor.speciesIndex));
  const ranked = (candidates ?? []).filter(row => row.weight > 0)
    .map((row, order) => ({ speciesIndex:row.speciesIndex, weight:row.weight, order, generation:speciesByIndex(row.speciesIndex).generation }))
    .sort((a, b) => a.weight - b.weight || b.generation - a.generation || a.order - b.order);
  const chosen = ranked.find(row => !out.has(row.speciesIndex)) ?? ranked[0];
  if (!chosen) return entry;
  const species = validateNativeSpeciesInput(speciesByIndex(chosen.speciesIndex));
  const individual = createNativeHuntIndividual({ species, rng });
  updateNativeHuntIndividual(individual, { speciesByIndex, rng });
  individual.fields["004"] = encounter.actors.length;
  const ai = initializeNativeHuntAi(rng);
  const env = scene.environment;
  const placement = initializeNativeHuntPosition({ rng, widthPixels:env.width * 8, heightPixels:env.height * 8, terrain:env });
  const actor = { speciesIndex:chosen.speciesIndex, individual,
    ai:{ ...ai, speedQ12:nativeHuntInitialSpeed(speciesByIndex(chosen.speciesIndex), individual.fields["018"]) },
    facing:placement.facing, positionQ12:placement.positionQ12, repair:placement.repair };
  return { ...entry, rareLure:{ speciesIndex:chosen.speciesIndex },
    encounter:{ ...encounter, records:[...(encounter.records ?? []), individual], actors:[...encounter.actors, actor] } };
}
