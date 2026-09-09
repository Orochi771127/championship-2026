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
import { assertAllowedChampionshipStorageKey } from "./championshipStorageGuard.js";

export const CHAMPIONSHIP_PERSISTENT_SAVE_PORT_KIND = "CHAMPIONSHIP_MODERN_PERSISTENT_SAVE_PORT";
export const CHAMPIONSHIP_PERSISTENT_SAVE_PORT_POLICY = "STANDALONE_LOCAL_PERSISTENCE";

/**
 * Wrap an injected Storage so that every key crossing this boundary is checked
 * against the product storage policy.
 *
 * This is the product's only durable storage boundary, so it is the only place
 * the policy has to hold. The facade forwards, it does not cache: the browser
 * Storage stays the single source of truth.
 */
export function guardChampionshipStorage(storage) {
  return Object.freeze({
    getItem(key) {
      return storage.getItem(assertAllowedChampionshipStorageKey(key));
    },
    setItem(key, value) {
      return storage.setItem(assertAllowedChampionshipStorageKey(key), value);
    },
    removeItem(key) {
      return storage.removeItem(assertAllowedChampionshipStorageKey(key));
    }
  });
}

export function createChampionshipPersistentSavePort({
  storage,
  now = () => new Date().toISOString()
} = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function"
    || typeof storage.removeItem !== "function") {
    throw new TypeError("Championship persistent save port requires a Storage-like object");
  }
  // The product save key is validated at construction rather than trusted as a
  // constant, so a future rename cannot quietly move the product onto a
  // namespace that belongs to another application.
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_MODERN_SAVE_KEY);
  const guarded = guardChampionshipStorage(storage);

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
      shop: request.shop ?? null,
      cageEdit: request.cageEdit ?? null,
      battleEconomy: request.battleEconomy,
      instanceIdentity: request.instanceIdentity,
      gameplayRng: request.gameplayRng,
      huntHistory: request.huntHistory,
      progression: {
        ...(request.nativeTitles!==undefined?{nativeTitles:request.nativeTitles}:{}),
        ...(request.nativeMessages!==undefined?{nativeMessages:request.nativeMessages}:{}),
        ...(request.nativeOpening!=null?{nativeOpening:request.nativeOpening}:{}),
        registeredSpecies: request.registeredSpecies ?? [],
        battleBadges: request.battleBadges ?? [],
        interactionCount: request.interactionCount,
        revision: request.revision,
        tamerRank: request.tamerRank ?? 0
      },
      flags: { newGameCompleted: true },
      updatedAt: now()
    });
    const text = serializeChampionshipModernSave(save);
    guarded.setItem(key, text);
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

    markDirty() {
      // A failed save must keep its visible retry affordance. The application
      // rebuilds a current snapshot for retry instead of replaying old state.
      if (status.phase === "SAVE_FAILED" || status.phase === "DIRTY") return status;
      return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED" });
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
      const text = guarded.getItem(key);
      return Object.freeze({ key, text: typeof text === "string" ? text : null });
    },

    /** Reads the stored save. A malformed save is reported, never thrown past the app. */
    read() {
      let text;
      try {
        text = guarded.getItem(key);
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
      guarded.removeItem(key);
      lastRequest = null;
      return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED", canRetry: false, revision: 0, savedAt: null, error: null });
    }
  });
}
