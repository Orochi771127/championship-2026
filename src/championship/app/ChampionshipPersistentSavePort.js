// Championship Modern -- standalone persistence port.
//
// WHY THIS IS NOT A ChampionshipSavePort
// --------------------------------------
// ChampionshipSavePort and ChampionshipSavePortR2 are frozen zero-write research
// contracts: assertChampionshipSavePort() refuses any port whose policy is not
// MEMORY_ONLY_DISCARD_ON_EXIT, and assertChampionshipSavePortR2() refuses any port
// whose capabilities.persistentWrite is not false. A persistent port therefore
// CANNOT be injected through session savePort / raisingSavePort without weakening
// those assertions, which stay untouched.
//
// So persistence lives one layer out, at the standalone application boundary,
// through the controller's duck-typed `persistence` facade
// ({ getStatus, subscribe, save, retry, exportRecovery }). The R2 session keeps
// its zero-write ports and keeps reporting persistentWrites === 0; this port owns
// the only durable write in the product, and it writes only its own key.

import { serializeRaisingHomeSaveR2 } from "../raising/raisingHomePersistenceR2.js";
import {
  CHAMPIONSHIP_MODERN_SAVE_KEY,
  createChampionshipModernSave,
  deserializeChampionshipModernSave,
  serializeChampionshipModernSave
} from "./championshipStandaloneSave.js";

export const CHAMPIONSHIP_PERSISTENT_SAVE_PORT_KIND = "CHAMPIONSHIP_MODERN_PERSISTENT_SAVE_PORT";
export const CHAMPIONSHIP_PERSISTENT_SAVE_PORT_POLICY = "STANDALONE_LOCAL_PERSISTENCE";

export function createChampionshipPersistentSavePort({
  storage,
  now = () => new Date().toISOString()
} = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function"
    || typeof storage.removeItem !== "function") {
    throw new TypeError("Championship persistent save port requires a Storage-like object");
  }
  const key = CHAMPIONSHIP_MODERN_SAVE_KEY;

  const listeners = new Set();
  // Phase vocabulary matches the R2 DOM view (DIRTY / CLEAN / SAVED / RESTORED /
  // RECOVERED / SAVE_FAILED) so the existing presentation renders it unchanged.
  let status = Object.freeze({
    phase: "DIRTY",
    lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED",
    canRetry: false,
    revision: 0,
    savedAt: null,
    error: null,
    committedWrites: 0
  });
  let lastRequest = null;

  function publish(next) {
    status = Object.freeze({ ...status, ...next });
    for (const listener of [...listeners]) {
      try { listener(status); } catch { /* a failing observer must not break persistence */ }
    }
    return status;
  }

  function commit(request) {
    // serializeRaisingHomeSaveR2 returns { document, serialized, digest, bytes };
    // the canonical STRING is what the envelope stores, so the existing R2 digest
    // and byte-budget validation still runs over it on the way back in.
    const { serialized } = serializeRaisingHomeSaveR2(request.snapshot, { revision: request.revision });
    const save = createChampionshipModernSave({
      sessionId: request.sessionId,
      creature: request.creature,
      raisingHomeSerialized: serialized,
      raising: request.raising ?? null,
      progression: { interactionCount: request.interactionCount, revision: request.revision },
      flags: { newGameCompleted: true },
      updatedAt: now()
    });
    const text = serializeChampionshipModernSave(save);
    storage.setItem(key, text);
    return { save, text };
  }

  return Object.freeze({
    kind: CHAMPIONSHIP_PERSISTENT_SAVE_PORT_KIND,
    policy: CHAMPIONSHIP_PERSISTENT_SAVE_PORT_POLICY,
    storageKey: key,
    capabilities: Object.freeze({ persistentRead: true, persistentWrite: true, persistentDelete: true }),

    getStatus() {
      return status;
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A persistence observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    save(request) {
      lastRequest = request;
      try {
        const { save: written } = commit(request);
        return publish({
          phase: "SAVED",
          lastCode: "CHAMPIONSHIP_MODERN_SAVE_OK",
          canRetry: false,
          revision: written.progression.revision,
          savedAt: written.updatedAt,
          error: null,
          committedWrites: status.committedWrites + 1
        });
      } catch (error) {
        return publish({
          phase: "SAVE_FAILED",
          lastCode: "CHAMPIONSHIP_MODERN_SAVE_FAILED",
          canRetry: true,
          error: error.message
        });
      }
    },

    retry() {
      if (!lastRequest) return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED", canRetry: false, error: null });
      return this.save(lastRequest);
    },

    exportRecovery() {
      const text = storage.getItem(key);
      return Object.freeze({ key, text: typeof text === "string" ? text : null });
    },

    /** Reads the stored save. A malformed save is reported, never thrown past the app. */
    read() {
      let text;
      try {
        text = storage.getItem(key);
      } catch (error) {
        return Object.freeze({ present: false, save: null, error: `STORAGE_UNAVAILABLE: ${error.message}` });
      }
      if (typeof text !== "string" || text.length === 0) {
        return Object.freeze({ present: false, save: null, error: null });
      }
      try {
        const save = deserializeChampionshipModernSave(text);
        publish({
          phase: "RESTORED",
          lastCode: "CHAMPIONSHIP_MODERN_SAVE_RESTORED",
          canRetry: false,
          revision: save.progression.revision,
          savedAt: save.updatedAt,
          error: null
        });
        return Object.freeze({ present: true, save, error: null });
      } catch (error) {
        return Object.freeze({ present: false, save: null, error: error.message });
      }
    },

    clear() {
      storage.removeItem(key);
      return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED", canRetry: false, revision: 0, savedAt: null, error: null });
    }
  });
}
