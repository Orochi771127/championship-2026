// The live preference set and its persistence.
//
// A change applies at once (subscribers run in the same call) and is written a
// moment later, coalesced, so dragging a volume slider is one write, not forty.
// The write goes through the preference port, never straight to Storage, and
// touches only the preferences key: the game save and its autosave are a
// different document and neither can overwrite the other.
//
// A failed write is reported honestly (status SAVE_FAILED with the browser's
// reason) and kept for retry; the settings stay in effect for this session.
// A document written by a newer version is never overwritten.

import {
  DEFAULT_PREFERENCES,
  PREFERENCE_DEFINITIONS,
  coercePreference,
  normalizePreferences,
  parsePreferences,
  preferenceIdsIn,
  serializePreferences
} from "./preferenceSchema.js";

export const PREFERENCE_WRITE_DELAY_MS = 300;

/**
 * @param {object} options
 * @param {{read:()=>{text:string|null,error:string|null}, write:(text:string)=>{ok:boolean,error:string|null}, storageKey:string}} options.port
 * @param {() => string} [options.now]
 * @param {Function} [options.setTimer]
 * @param {Function} [options.clearTimer]
 */
export function createPreferenceStore({
  port,
  now = () => new Date().toISOString(),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id),
  writeDelayMs = PREFERENCE_WRITE_DELAY_MS
} = {}) {
  if (!port || typeof port.read !== "function" || typeof port.write !== "function") {
    throw new TypeError("A preference store needs a preference port");
  }
  const listeners = new Set();
  const statusListeners = new Set();
  let values = DEFAULT_PREFERENCES;
  let timer = null;
  let status = Object.freeze({ phase: "CLEAN", source: "ABSENT", error: null, savedAt: null, writes: 0, readOnly: false });

  function publishStatus(next) {
    status = Object.freeze({ ...status, ...next });
    for (const listener of [...statusListeners]) { try { listener(status); } catch { /* observers never break settings */ } }
  }

  function load() {
    const { text, error } = port.read();
    if (error) {
      values = DEFAULT_PREFERENCES;
      publishStatus({ phase: "UNAVAILABLE", source: "UNAVAILABLE", error, readOnly: false });
      return;
    }
    const parsed = parsePreferences(text);
    values = parsed.preferences;
    publishStatus({
      phase: parsed.status === "NEWER" ? "READ_ONLY" : "CLEAN",
      source: parsed.status,
      error: null,
      readOnly: parsed.status === "NEWER"
    });
  }
  load();

  function notify(changed) {
    for (const listener of [...listeners]) { try { listener(values, changed); } catch { /* as above */ } }
  }

  function writeNow() {
    if (timer !== null) { clearTimer(timer); timer = null; }
    if (status.readOnly) return status;
    const savedAt = now();
    const result = port.write(serializePreferences(values, { updatedAt: savedAt }));
    if (result.ok) publishStatus({ phase: "SAVED", error: null, savedAt, writes: status.writes + 1 });
    else publishStatus({ phase: "SAVE_FAILED", error: result.error ?? "UNKNOWN" });
    return status;
  }

  function schedule() {
    if (status.readOnly) return;
    if (timer !== null) clearTimer(timer);
    publishStatus({ phase: "PENDING" });
    timer = setTimer(() => { timer = null; writeNow(); }, writeDelayMs);
  }

  function apply(next) {
    const normalized = normalizePreferences(next);
    const changed = Object.keys(normalized).filter((id) => normalized[id] !== values[id]);
    if (!changed.length) return [];
    values = normalized;
    notify(changed);
    schedule();
    return changed;
  }

  return Object.freeze({
    storageKey: port.storageKey,

    /** The current set: complete, valid and frozen. */
    get() { return values; },

    /** Set one preference. An invalid value is refused (returns false). */
    set(id, value) {
      if (!PREFERENCE_DEFINITIONS[id]) return false;
      const coerced = coercePreference(id, value);
      if (coerced === undefined) return false;
      apply({ ...values, [id]: coerced });
      return true;
    },

    /** Restore one category's defaults. Progress is not a preference: untouched. */
    resetCategory(category) {
      const next = { ...values };
      for (const id of preferenceIdsIn(category)) next[id] = DEFAULT_PREFERENCES[id];
      return apply(next);
    },

    /** Restore every preference's default. The game save is a different key. */
    resetAll() { return apply(DEFAULT_PREFERENCES); },

    /** Re-read after another tab wrote the same key. Nothing is written back. */
    reload() {
      const before = values;
      if (timer !== null) { clearTimer(timer); timer = null; }
      load();
      const changed = Object.keys(values).filter((id) => values[id] !== before[id]);
      if (changed.length) notify(changed);
      return changed;
    },

    /** Write a pending change now (page hide) or retry a failed one. */
    flush() { return timer !== null || status.phase === "SAVE_FAILED" ? writeNow() : status; },
    retry() { return writeNow(); },

    status() { return status; },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A preference observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    subscribeStatus(listener) {
      if (typeof listener !== "function") throw new TypeError("A preference status observer must be a function");
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },

    dispose() {
      if (timer !== null) { clearTimer(timer); timer = null; }
      listeners.clear();
      statusListeners.clear();
    }
  });
}

/** Test helper and QA seam: the defaults as a plain object. */
export function defaultPreferences() {
  return normalizePreferences({});
}
