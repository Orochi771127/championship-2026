// Candidate construction only. The existing application commits RNG/history
// after world and runtime creation both succeed. Failure has no caller writes.
import { restoreChannelRng } from "../../battle/battleRngChannel.js";
import { resolveNativeHuntSceneSources } from "./nativeHuntSceneSources.js";
import { resolveNativeHuntPoolSources } from "./nativeHuntSources.js";
import { validateNativeHuntHistory, selectNativeReleasedHistory, applyNativeCarriedHistoryWrite } from "./nativeHuntHistory.js";
import { generateNativeHuntEncounter } from "./nativeHuntGeneration.js";

export function prepareNativeHuntEntry({ biomeId, clock, rngSnapshot, persistentState, carried = null } = {}) {
  if (!persistentState) throw Error("HUNT_ENTRY_LEGACY_HISTORY_UNKNOWN");
  validateNativeHuntHistory(persistentState.history);
  if (!Number.isInteger(clock?.clockMinutes) || clock.clockMinutes < 0 || clock.clockMinutes >= 1440) {
    throw Error("HUNT_ENTRY_CLOCK_REQUIRED");
  }
  const scene = resolveNativeHuntSceneSources({ biomeId, hour:Math.floor(clock.clockMinutes / 60), season:clock.season });
  const pool = resolveNativeHuntPoolSources({ ...scene, modifiers:persistentState.modifiers });
  const released = selectNativeReleasedHistory(persistentState.history, scene.biomeIndex);
  const rng = restoreChannelRng(rngSnapshot);
  const encounter = generateNativeHuntEncounter({ ...pool, ...scene, rng, carried, released:released?.entry ?? null });
  const history = encounter.historyWrite ? applyNativeCarriedHistoryWrite(persistentState.history, encounter.historyWrite)
    : structuredClone(persistentState.history);
  return { scene, encounter, releasedSlot:released?.slot ?? null, rng,
    persistentState:{ history, modifiers:structuredClone(persistentState.modifiers) } };
}
