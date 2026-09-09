// App-owned history/modifiers and their narrow save projection. An old Web
// save with no history stays null; visiting Gate cannot invent a blank past.
import { createNativeHuntHistory, validateNativeHuntHistory, projectNativeHuntHistorySave,
  restoreNativeHuntHistorySave, projectNativeHuntModifierSave } from "./nativeHuntHistory.js";
import { NATIVE_HUNT_HISTORY_DEFAULT_NAME, NATIVE_HUNT_MODIFIER_COUNTS,
  validateNativeHuntModifiers } from "./nativeHuntSources.js";

const baseline = () => createNativeHuntHistory(NATIVE_HUNT_HISTORY_DEFAULT_NAME);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));

export function createNativeHuntPersistentState() {
  return { history: baseline(), modifiers: NATIVE_HUNT_MODIFIER_COUNTS.map(n => Array(n).fill(0)) };
}

export function projectNativeHuntPersistentSave(state) {
  if (state === null) return null;
  if (!exactKeys(state, ["history", "modifiers"])) throw new Error("HUNT_PERSISTENT_STATE_INVALID");
  validateNativeHuntHistory(state.history);
  validateNativeHuntModifiers(state.modifiers);
  return { version: 1, history: projectNativeHuntHistorySave(state.history),
    modifiers: projectNativeHuntModifierSave(state.modifiers) };
}

export function restoreNativeHuntPersistentSave(saved) {
  if (saved === null) return null;
  if (!exactKeys(saved, ["version", "history", "modifiers"]) || saved.version !== 1) {
    throw new Error("HUNT_PERSISTENT_SAVE_INVALID");
  }
  // Saved values must already fit the original codec. Corrupt values do not
  // acquire validity by being masked during deserialization.
  validateNativeHuntModifiers(saved.modifiers, 15);
  return { history: restoreNativeHuntHistorySave(saved.history, baseline()),
    modifiers: saved.modifiers.map(row => [...row]) };
}

export function normalizeNativeHuntPersistentSave(saved) {
  return projectNativeHuntPersistentSave(restoreNativeHuntPersistentSave(saved));
}
