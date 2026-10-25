// Browser storage durability for the one local save (2026-10-25 health check).
//
// Asks the browser once per visit, after a save has succeeded, to keep this
// site's data (navigator.storage.persist). Without that grant a browser may
// evict local storage under pressure or after long disuse. It also grades the
// save size against the envelope's byte budget so the Data page can warn early.
// It never reads, writes or migrates the save and adds no storage key.

export const SAVE_SIZE_HIGH_RATIO = 0.75;

/** 'OK' | 'HIGH' (>= 75% of the budget) | null when either value is unknown. */
export function saveSizeLevel(bytes, budget) {
  if (!Number.isSafeInteger(bytes) || !Number.isSafeInteger(budget) || bytes < 0 || budget <= 0) return null;
  return bytes >= budget * SAVE_SIZE_HIGH_RATIO ? 'HIGH' : 'OK';
}

/**
 * state: 'UNSUPPORTED' (no StorageManager), 'UNKNOWN' (not asked yet or the
 * browser threw), 'PERSISTED' or 'NOT_PERSISTED'.
 */
export function createStorageDurability({ storageManager = globalThis.navigator?.storage, onChange = () => {} } = {}) {
  const supported = typeof storageManager?.persist === 'function' && typeof storageManager?.persisted === 'function';
  let state = supported ? 'UNKNOWN' : 'UNSUPPORTED';
  let request = null;
  function settle(next) {
    if (next === state) return;
    state = next;
    try { onChange(state); } catch { /* an observer must not break the request */ }
  }
  return Object.freeze({
    getState: () => state,
    /** Idempotent: the browser is asked at most once per visit. */
    requestOnce() {
      if (!supported) return Promise.resolve(state);
      request ??= (async () => {
        try {
          // An existing grant needs no request, so no browser prompt can appear.
          settle(await storageManager.persisted() || await storageManager.persist() ? 'PERSISTED' : 'NOT_PERSISTED');
        } catch { settle('UNKNOWN'); }
        return state;
      })();
      return request;
    }
  });
}
