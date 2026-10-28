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
// the only durable write of game progress, and it writes only its own key. The
// one other durable document, player preferences, is written by the small
// preference port below: same file, same guard, a different key, no progress.

import { serializeRaisingHomeSaveR2 } from "../raising/raisingHomePersistenceR2.js";
import {
  CHAMPIONSHIP_MODERN_SAVE_KEY,
  CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES,
  createChampionshipModernSave,
  deserializeChampionshipModernSave,
  serializeChampionshipModernSave
} from "./championshipStandaloneSave.js";
import {
  CHAMPIONSHIP_ONLINE_SESSION_STORAGE_KEY,
  CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY,
  assertAllowedChampionshipStorageKey
} from "./championshipStorageGuard.js";

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

// The preferences document (2026-09-29): theme, language, volume and the
// like. It is not part of the game save and never carries progress, so a
// settings change can never overwrite a save and a save can never reset a
// setting. It shares this boundary so the product still has exactly one
// place that writes durable storage, and the same key policy guards both.
export const CHAMPIONSHIP_PREFERENCES_KEY = "championshipModernSave:preferences:v1";

// Technical recovery evidence only. Separate from progress and preferences;
// every writer still passes through this product storage boundary.
export const CHAMPIONSHIP_DIAGNOSTICS_KEY = 'championshipModernSave:runtimeDiagnostics:v1';
export function createChampionshipDiagnosticPort(storage) {
  const guarded = guardChampionshipStorage(storage);
  return Object.freeze({
    read() { return guarded.getItem(CHAMPIONSHIP_DIAGNOSTICS_KEY); },
    write(text) {
      if (typeof text !== 'string' || new TextEncoder().encode(text).length > 8192)
        throw new Error('DIAGNOSTIC_BYTE_LIMIT');
      guarded.setItem(CHAMPIONSHIP_DIAGNOSTICS_KEY, text);
    }
  });
}

/**
 * Raw access to the stored preferences text. Parsing, defaults and migration
 * live in settings/preferenceSchema.js; this only moves text across the
 * storage boundary and reports what the browser said.
 */
export function createChampionshipPreferencePort({ storage } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function"
    || typeof storage.removeItem !== "function") {
    throw new TypeError("Championship preference port requires a Storage-like object");
  }
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_PREFERENCES_KEY);
  const guarded = guardChampionshipStorage(storage);
  return Object.freeze({
    storageKey: key,
    /** { text, error } -- a blocked or unavailable Storage is reported, not thrown. */
    read() {
      try { return Object.freeze({ text: guarded.getItem(key), error: null }); }
      catch (error) { return Object.freeze({ text: null, error: `STORAGE_UNAVAILABLE: ${error.message}` }); }
    },
    /** { ok, error } -- quota, private mode and blocked storage all land here. */
    write(text) {
      try { guarded.setItem(key, text); return Object.freeze({ ok: true, error: null }); }
      catch (error) { return Object.freeze({ ok: false, error: error?.message ?? String(error) }); }
    }
  });
}

// Data Arena (OWNER_APPROVED_ADAPTATION 2026-10-15): the mode's own records
// (schema dataArena.v1), beside the save and never inside it. Arena results
// are records only and feed nothing in the Championship economy.
export const CHAMPIONSHIP_DATA_ARENA_KEY = "championshipModernSave:dataArena:v1";
export function createChampionshipDataArenaPort({ storage } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("Championship Data Arena port requires a Storage-like object");
  }
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_DATA_ARENA_KEY);
  const guarded = guardChampionshipStorage(storage);
  return Object.freeze({
    storageKey: key,
    read() {
      try { return Object.freeze({ text: guarded.getItem(key), error: null }); }
      catch (error) { return Object.freeze({ text: null, error: `STORAGE_UNAVAILABLE: ${error.message}` }); }
    },
    write(text) {
      try { guarded.setItem(key, text); return Object.freeze({ ok: true, error: null }); }
      catch (error) { return Object.freeze({ ok: false, error: error?.message ?? String(error) }); }
    }
  });
}

// Guest identity (Owner 2026-10-28): the local guest id that a later account
// binding upgrades. Beside the save and never inside it; text only, parsed by
// futureSystemsPort.js.
export const CHAMPIONSHIP_GUEST_IDENTITY_KEY = "championshipModernSave:guestIdentity:v1";
export function createChampionshipGuestIdentityPort({ storage } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("Championship guest identity port requires a Storage-like object");
  }
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_GUEST_IDENTITY_KEY);
  const guarded = guardChampionshipStorage(storage);
  return Object.freeze({
    storageKey: key,
    read() {
      try { return Object.freeze({ text: guarded.getItem(key), error: null }); }
      catch (error) { return Object.freeze({ text: null, error: `STORAGE_UNAVAILABLE: ${error.message}` }); }
    },
    write(text) {
      try { guarded.setItem(key, text); return Object.freeze({ ok: true, error: null }); }
      catch (error) { return Object.freeze({ ok: false, error: error?.message ?? String(error) }); }
    }
  });
}

// Active Session Checkpoint (iOS Standalone Web App Silent Reload Auto-Resume):
// Lightweight throttled checkpoint of the active in-game screen and micro-state,
// separate from the durable save so it never mutates or corrupts save progress.
// Dual-backed across sessionStorage + localStorage (registered in
// championshipStorageGuard.js) so it survives iOS Jetsam WebContent process kills,
// and actively removes itself on Save & Quit or TTL expiry.
// Online session (Owner 2026-10-28): one product key holds the JSON map of the
// sub-keys supabase-js asks its storage adapter for (the session and the PKCE
// verifier). The adapter is handed to createClient as `auth.storage`, so the
// library never reaches localStorage itself. Created lazily on the first write
// and removed on sign-out, so offline play keeps exactly the save key.
export const CHAMPIONSHIP_ONLINE_SESSION_KEY = CHAMPIONSHIP_ONLINE_SESSION_STORAGE_KEY;
export function createChampionshipOnlineSessionPort({ storage } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("Championship online session port requires a Storage-like object");
  }
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_ONLINE_SESSION_KEY);
  const guarded = guardChampionshipStorage(storage);
  function readMap() {
    try { const parsed = JSON.parse(guarded.getItem(key) ?? "null"); return parsed && typeof parsed === "object" && parsed.version === 1 ? parsed.entries ?? {} : {}; }
    catch { return {}; }
  }
  function writeMap(entries) {
    try {
      if (!Object.keys(entries).length) { if (typeof storage.removeItem === "function") guarded.removeItem(key); else guarded.setItem(key, ""); }
      else guarded.setItem(key, JSON.stringify({ version: 1, entries }));
    } catch { /* blocked storage: the session lives in memory for this page */ }
  }
  return Object.freeze({
    storageKey: key,
    getItem(name) { const entries = readMap(); return Object.hasOwn(entries, name) ? entries[name] : null; },
    setItem(name, value) { const entries = readMap(); entries[String(name)] = String(value); writeMap(entries); },
    removeItem(name) { const entries = readMap(); delete entries[String(name)]; writeMap(entries); },
    clear() { writeMap({}); }
  });
}

export const CHAMPIONSHIP_SESSION_CHECKPOINT_KEY = CHAMPIONSHIP_SESSION_CHECKPOINT_STORAGE_KEY;
export const CHAMPIONSHIP_SESSION_CHECKPOINT_TTL_MS = 180_000;
export function createChampionshipSessionCheckpointPort({ storage, sessionStorage = null } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("Championship session checkpoint port requires a Storage-like object");
  }
  const key = assertAllowedChampionshipStorageKey(CHAMPIONSHIP_SESSION_CHECKPOINT_KEY);
  const guarded = guardChampionshipStorage(storage);
  const guardedSession = sessionStorage && typeof sessionStorage.getItem === "function" && typeof sessionStorage.setItem === "function"
    ? guardChampionshipStorage(sessionStorage)
    : null;
  let lastWriteMs = 0;
  let lastScreen = null;
  function removeRaw(target, rawStorage) {
    if (!target) return;
    try {
      if (typeof rawStorage?.removeItem === "function") target.removeItem(key);
      else target.setItem(key, "");
    } catch {}
  }
  function parseRaw(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.active !== true || typeof parsed.screen !== "string") return null;
      if (Number.isFinite(parsed.updatedAtMs) && Date.now() - parsed.updatedAtMs > CHAMPIONSHIP_SESSION_CHECKPOINT_TTL_MS) {
        removeRaw(guarded, storage);
        removeRaw(guardedSession, sessionStorage);
        return null;
      }
      return Object.freeze(parsed);
    } catch {
      return null;
    }
  }
  return Object.freeze({
    storageKey: key,
    read() {
      const fromSession = guardedSession ? parseRaw( (() => { try { return guardedSession.getItem(key); } catch { return null; } })() ) : null;
      if (fromSession) return fromSession;
      return parseRaw( (() => { try { return guarded.getItem(key); } catch { return null; } })() );
    },
    write(snapshot, { force = false } = {}) {
      try {
        const nowMs = Date.now();
        const screen = String(snapshot?.screen ?? "RAISING_HOME");
        if (!force && screen === lastScreen && nowMs - lastWriteMs < 2000) {
          return Object.freeze({ ok: true, throttled: true });
        }
        lastWriteMs = nowMs;
        lastScreen = screen;
        const payload = JSON.stringify({
          schemaVersion: 1,
          active: true,
          screen,
          substate: snapshot?.substate ?? null,
          updatedAtMs: nowMs
        });
        guarded.setItem(key, payload);
        try { guardedSession?.setItem(key, payload); } catch {}
        return Object.freeze({ ok: true, throttled: false });
      } catch (error) {
        return Object.freeze({ ok: false, error: error?.message ?? String(error) });
      }
    },
    clear() {
      lastScreen = null;
      lastWriteMs = 0;
      removeRaw(guarded, storage);
      removeRaw(guardedSession, sessionStorage);
      return Object.freeze({ ok: true });
    }
  });
}

export function createChampionshipPersistentSavePort({
  storage,
  locks = globalThis.window?.navigator?.locks,
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
    committedWrites: 0,
    // Size of the stored text against the envelope budget, for an early warning.
    bytes: null,
    byteBudget: CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES
  });
  const byteLength = (text) => new TextEncoder().encode(text).byteLength;
  let lastRequest = null;
  let baseline;
  let pendingText=null;
  let releaseSessionLock=null, sessionLockTask=null, acquiringSessionLock=null;
  // Captured once, then advanced only by a successful load/write/delete.
  // A stale tab must never adopt another tab's bytes just because it retries.
  try { baseline=guarded.getItem(key); } catch { /* read/save reports unavailable storage */ }

  function publish(next) {
    status = Object.freeze({ ...status, ...next });
    for (const listener of [...listeners]) {
      try { listener(status); } catch { /* a failing observer must not break persistence */ }
    }
    return status;
  }

  function encode(request) {
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
        ...(request.freeBattleMenu!==undefined?{freeBattleMenu:request.freeBattleMenu}:{}),
        ...(request.battleTactics!==undefined?{battleTactics:request.battleTactics}:{}),
        ...(request.nativeTitles!==undefined?{nativeTitles:request.nativeTitles}:{}),
        ...(request.championshipRun!==undefined?{championshipRun:request.championshipRun}:{}),
        ...(request.nativeMessages!==undefined?{nativeMessages:request.nativeMessages}:{}),
        ...(request.nativeOpening!=null?{nativeOpening:request.nativeOpening}:{}),
        registeredSpecies: request.registeredSpecies ?? [],
        battleBadges: request.battleBadges ?? [],
        interactionCount: request.interactionCount,
        revision: request.revision,
        tamerRank: request.tamerRank ?? 0
      },
      flags: { newGameCompleted: true, friendsPlaytest: request.friendsPlaytest ?? null, onlineBindReward: request.onlineBindReward ?? null },
      updatedAt: now()
    });
    const text = serializeChampionshipModernSave(save);
    return { save, text };
  }

  function assertCurrent() {
    if(locks && !releaseSessionLock)throw new Error('CHAMPIONSHIP_SAVE_SESSION_NOT_OWNED');
    const current=guarded.getItem(key);
    if(baseline===undefined)baseline=current;
    if(current!==baseline)throw new Error('CHAMPIONSHIP_MODERN_SAVE_CONFLICT');
  }

  function commit(request) {
    const {save,text}=encode(request);
    pendingText=text;
    assertCurrent();
    guarded.setItem(key, text);
    baseline=text;
    pendingText=null;
    return { save, text };
  }

  return Object.freeze({
    kind: CHAMPIONSHIP_PERSISTENT_SAVE_PORT_KIND,
    policy: CHAMPIONSHIP_PERSISTENT_SAVE_PORT_POLICY,
    storageKey: key,
    capabilities: Object.freeze({ persistentRead: true, persistentWrite: true, persistentDelete: true }),

    // Hold one browser Web Lock for this live save session. This serializes
    // writers across tabs before they load, including truly simultaneous saves.
    // Browsers without Web Locks retain the stale-byte check, but cannot claim
    // atomic cross-tab exclusion. No second storage key or save authority exists.
    async acquireSession() {
      if(!locks || releaseSessionLock)return true;
      if(acquiringSessionLock)return acquiringSessionLock;
      acquiringSessionLock=new Promise((resolve,reject)=>{
        sessionLockTask=locks.request(key,{mode:'exclusive',ifAvailable:true},lock=>{
          if(!lock){resolve(false);return;}
          return new Promise(release=>{releaseSessionLock=release;resolve(true);});
        });
        sessionLockTask.catch(reject);
      });
      try{return await acquiringSessionLock;}finally{acquiringSessionLock=null;}
    },

    async releaseSession() {
      if(acquiringSessionLock)await acquiringSessionLock;
      const release=releaseSessionLock;releaseSessionLock=null;
      release?.();
      if(sessionLockTask)await sessionLockTask;
      sessionLockTask=null;
    },

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

    // Pure candidate construction for app-owned rollback/hydration. No write,
    // lock adoption, retry change or status publication occurs here.
    prepare(request) {
      return encode(request);
    },

    save(request) {
      lastRequest = request;
      pendingText=null;
      try {
        const { save: written, text } = commit(request);
        return publish({
          phase: "SAVED",
          lastCode: "CHAMPIONSHIP_MODERN_SAVE_OK",
          canRetry: false,
          revision: written.progression.revision,
          savedAt: written.updatedAt,
          error: null,
          committedWrites: status.committedWrites + 1,
          bytes: byteLength(text)
        });
      } catch (error) {
        return publish({
          phase: "SAVE_FAILED",
          lastCode: error.message==='CHAMPIONSHIP_MODERN_SAVE_CONFLICT'?error.message:"CHAMPIONSHIP_MODERN_SAVE_FAILED",
          canRetry: error.message!=='CHAMPIONSHIP_MODERN_SAVE_CONFLICT',
          error: error.message
        });
      }
    },

    // An app-owned atomic transaction rolled back; do not resurrect its candidate.
    discardPendingWrite() {
      lastRequest=null;pendingText=null;
      return publish({...status,canRetry:false});
    },

    retry() {
      if (!lastRequest) return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED", canRetry: false, error: null });
      return this.save(lastRequest);
    },

    exportRecovery() {
      let storedText=null,error=null;
      try {storedText=guarded.getItem(key);}catch(e){error=e.message;}
      return Object.freeze({ key, text:pendingText??storedText, pendingText, storedText, error });
    },

    /** Reads the stored save. A malformed save is reported, never thrown past the app. */
    read({adopt=false}={}) {
      let text;
      try {
        text = guarded.getItem(key);
      } catch (error) {
        return Object.freeze({ present: false, save: null, error: `STORAGE_UNAVAILABLE: ${error.message}` });
      }
      if (typeof text !== "string" || text.length === 0) {
        if(adopt)baseline=text;
        return Object.freeze({ present: false, save: null, error: null });
      }
      try {
        const save = deserializeChampionshipModernSave(text);
        if(adopt){baseline=text;pendingText=null;lastRequest=null;}
        if(adopt)publish({
          phase: "RESTORED",
          lastCode: "CHAMPIONSHIP_MODERN_SAVE_RESTORED",
          canRetry: false,
          revision: save.progression.revision,
          savedAt: save.updatedAt,
          error: null,
          bytes: byteLength(text)
        });
        return Object.freeze({ present: true, save, error: null });
      } catch (error) {
        return Object.freeze({ present: false, save: null, error: error.message });
      }
    },

    /** Owner 2026-10-28: adopt a complete save text from the cloud or a transfer
     * code. Validated with the same deserializer Continue uses, written through
     * this one boundary, and published as RESTORED; the app reloads afterwards. */
    adoptExternalText(text) {
      let save;
      try { save = deserializeChampionshipModernSave(text); } catch (error) { return Object.freeze({ ok: false, reason: `SAVE_TEXT_INVALID: ${error.message}` }); }
      try {
        assertCurrent();
        guarded.setItem(key, text);
        baseline = text; pendingText = null; lastRequest = null;
        publish({ phase: "RESTORED", lastCode: "CHAMPIONSHIP_MODERN_SAVE_RESTORED", canRetry: false, revision: save.progression.revision, savedAt: save.updatedAt, error: null, bytes: byteLength(text) });
        return Object.freeze({ ok: true, revision: save.progression.revision, savedAt: save.updatedAt });
      } catch (error) { return Object.freeze({ ok: false, reason: error.message }); }
    },

    clear() {
      assertCurrent();
      guarded.removeItem(key);
      baseline=null;pendingText=null;
      lastRequest = null;
      return publish({ phase: "DIRTY", lastCode: "CHAMPIONSHIP_MODERN_SAVE_UNSAVED", canRetry: false, revision: 0, savedAt: null, error: null, bytes: null });
    }
  });
}
