// Desktop offline file-backed Storage adapter for Tauri / Electron + Steam Auto-Cloud.
//
// Plugs directly into the existing single persistence boundary
// (`createChampionshipPersistentSavePort` / `createChampionshipPreferencePort`)
// without introducing a second save format or second persistence authority.
// Reads remain synchronous from the hydrated in-memory mirror; writes flush
// atomically through the host desktop bridge (Tauri `invoke` or Electron IPC)
// into a deterministic Steam Cloud-friendly envelope JSON file.

import {
  ALLOWED_CHAMPIONSHIP_EPHEMERAL_KEYS,
  CHAMPIONSHIP_STORAGE_KEY_PREFIX,
  assertAllowedChampionshipStorageKey
} from './championshipStorageGuard.js';

export const DESKTOP_SAVE_ENVELOPE_SCHEMA = 'championship.desktopSaveEnvelope.v1';
export const DESKTOP_SAVE_ENVELOPE_VERSION = 1;
export const DESKTOP_SAVE_DEFAULT_FILENAME = 'cyber-partner-save.json';

function assertDesktopSaveKey(key) {
  const checked = assertAllowedChampionshipStorageKey(key);
  if (!checked.startsWith(CHAMPIONSHIP_STORAGE_KEY_PREFIX) && !ALLOWED_CHAMPIONSHIP_EPHEMERAL_KEYS.includes(checked)) {
    throw new Error(`DESKTOP_SAVE_KEY_OUT_OF_PRODUCT_NAMESPACE:${checked}`);
  }
  return checked;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Serialize allowed keys from a Map into a Steam Auto-Cloud friendly JSON envelope. */
export function serializeDesktopSaveEnvelope(entries, { updatedAt = Date.now(), appVersion = '0.1.0' } = {}) {
  const keys = {};
  for (const [k, v] of entries instanceof Map ? entries.entries() : Object.entries(entries ?? {})) {
    assertDesktopSaveKey(k);
    if (typeof v !== 'string') throw new TypeError(`DESKTOP_SAVE_VALUE_NOT_STRING:${k}`);
    keys[k] = v;
  }
  return JSON.stringify({
    schema: DESKTOP_SAVE_ENVELOPE_SCHEMA,
    schemaVersion: DESKTOP_SAVE_ENVELOPE_VERSION,
    appVersion,
    updatedAt: Number.isSafeInteger(updatedAt) && updatedAt >= 0 ? updatedAt : Date.now(),
    keys
  });
}

/** Parse and validate a desktop save envelope JSON string back into a key->string map. */
export function deserializeDesktopSaveEnvelope(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('DESKTOP_SAVE_ENVELOPE_EMPTY');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('DESKTOP_SAVE_ENVELOPE_JSON_INVALID'); }
  if (!isPlainObject(parsed) || parsed.schema !== DESKTOP_SAVE_ENVELOPE_SCHEMA || parsed.schemaVersion !== DESKTOP_SAVE_ENVELOPE_VERSION || !isPlainObject(parsed.keys)) {
    throw new Error('DESKTOP_SAVE_ENVELOPE_SCHEMA_INVALID');
  }
  const result = new Map();
  for (const [k, v] of Object.entries(parsed.keys)) {
    assertDesktopSaveKey(k);
    if (typeof v !== 'string') throw new Error(`DESKTOP_SAVE_ENVELOPE_VALUE_INVALID:${k}`);
    result.set(k, v);
  }
  return Object.freeze({
    schema: parsed.schema,
    schemaVersion: parsed.schemaVersion,
    appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '0.1.0',
    updatedAt: Number.isSafeInteger(parsed.updatedAt) ? parsed.updatedAt : 0,
    entries: result
  });
}

/**
 * Create a synchronous Web-Storage-compatible adapter backed by an async desktop
 * file bridge (`{ readText, writeText }`, e.g. Tauri `invoke('read_save')` /
 * `invoke('write_save')` or Electron preload IPC).
 */
export function createDesktopFileSaveAdapter({
  readText = async () => null,
  writeText = async () => {},
  filename = DESKTOP_SAVE_DEFAULT_FILENAME,
  appVersion = '0.1.0',
  now = () => Date.now(),
  onFlushError = null
} = {}) {
  const store = new Map();
  let hydrated = false;
  let flushTask = null;
  let dirty = false;
  let lastFlushError = null;

  function scheduleFlush() {
    dirty = true;
    if (flushTask) return flushTask;
    // Coalesce bursty synchronous setItem/removeItem writes (save + prefs + diagnostics)
    // into minimal atomic disk writes while guaranteeing the final state lands on disk.
    flushTask = Promise.resolve().then(async () => {
      while (dirty) {
        dirty = false;
        const snapshot = serializeDesktopSaveEnvelope(store, { updatedAt: now(), appVersion });
        try {
          await writeText(filename, snapshot);
          lastFlushError = null;
        } catch (error) {
          lastFlushError = error;
          onFlushError?.(error);
        }
      }
    }).finally(() => {
      flushTask = null;
    });
    return flushTask;
  }

  return Object.freeze({
    filename,
    get hydrated() { return hydrated; },
    get lastFlushError() { return lastFlushError; },

    /** Hydrate the synchronous mirror from disk before mounting the standalone app. */
    async hydrate() {
      const raw = await readText(filename);
      store.clear();
      if (typeof raw === 'string' && raw.trim().length > 0) {
        const parsed = deserializeDesktopSaveEnvelope(raw);
        for (const [k, v] of parsed.entries) store.set(k, v);
      }
      hydrated = true;
      return Object.freeze({ hydrated: true, keyCount: store.size });
    },

    /** Wait for all queued disk flushes to finish (use before app exit). */
    async flush() {
      while (flushTask || dirty) {
        await (flushTask ?? scheduleFlush());
      }
    },

    /** Export current in-memory keys as a Steam Cloud-ready JSON envelope string. */
    exportEnvelope() {
      return serializeDesktopSaveEnvelope(store, { updatedAt: now(), appVersion });
    },

    // Standard Web Storage interface accepted by ChampionshipPersistentSavePort.
    getItem(key) {
      return store.get(assertDesktopSaveKey(key)) ?? null;
    },
    setItem(key, value) {
      const allowed = assertDesktopSaveKey(key);
      store.set(allowed, String(value));
      void scheduleFlush();
    },
    removeItem(key) {
      const allowed = assertDesktopSaveKey(key);
      store.delete(allowed);
      void scheduleFlush();
    }
  });
}

/** Detect a Tauri v1/v2 or Electron preload bridge on globalThis, if present. */
export function detectDesktopSaveBridge(env = globalThis) {
  const tauriInvoke = env?.__TAURI__?.core?.invoke ?? env?.__TAURI_INTERNALS__?.invoke ?? null;
  if (typeof tauriInvoke === 'function') {
    return Object.freeze({
      runtime: 'tauri',
      readText: (filename) => tauriInvoke('championship_read_save', { filename }),
      writeText: (filename, content) => tauriInvoke('championship_write_save', { filename, content })
    });
  }
  const electronBridge = env?.championshipDesktopSave ?? env?.electronAPI?.championshipSave ?? null;
  if (electronBridge && typeof electronBridge.readText === 'function' && typeof electronBridge.writeText === 'function') {
    return Object.freeze({
      runtime: 'electron',
      readText: (filename) => electronBridge.readText(filename),
      writeText: (filename, content) => electronBridge.writeText(filename, content)
    });
  }
  return null;
}
