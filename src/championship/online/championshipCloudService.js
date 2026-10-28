// Championship cloud service (OWNER_APPROVED_ADAPTATION 2026-10-28): the one
// facade the account panel, the friends drawer and the PvP lobby talk to.
//
// Offline first. Without a configured cloud, or without a network, every
// call is answered by the local simulation adapter so the panels work right
// now; with a Supabase project configured the same calls go to the cloud. The
// game never depends on the answer: the local save stays the authority, cloud
// copies are explicit backups/restores, and "已同步" is only shown after the
// server echoed the hash (cloudSaveEnvelope.confirmsSync).

import { resolveOnlineServiceConfig } from "./onlineServiceConfig.js";
import { createLocalSimulationAdapter, LOCAL_SIMULATION_MODE } from "./localSimulationMode.js";
import { buildCloudSaveEnvelope, confirmsSync } from "./cloudSaveEnvelope.js";
import { loadSupabaseLibrary } from "./supabaseLoader.js";
import { createSupabaseAdapter, SUPABASE_MODE } from "./supabaseMode.js";
import { onlineText } from "../text/onlineText.js";

export const CLOUD_SYNC_STATES = Object.freeze(["LOCAL_ONLY", "SYNCING", "SYNCED", "OFFLINE", "FAILED", "CHOICE"]);

export function createChampionshipCloudService({
  config = resolveOnlineServiceConfig(), sessionStorage = null, win = globalThis, nav = globalThis.navigator,
  loadLibrary = loadSupabaseLibrary, createSupabase = createSupabaseAdapter, createLocal = createLocalSimulationAdapter,
  hooks = {}
} = {}) {
  const listeners = new Set();
  let state = Object.freeze({ mode: LOCAL_SIMULATION_MODE, configured: config.configured, configReason: config.reason, online: nav?.onLine !== false,
    identity: null, syncState: "LOCAL_ONLY", lastSync: null, conflict: null, libraryError: null, activeRoom: null });
  const local = createLocal({ ownDefenseCode: hooks.ownDefenseCode, simulateGuestReply: hooks.simulateGuestReply,
    rivalNames: [onlineText("simRivalA"), onlineText("simRivalB"), onlineText("simRivalC")], rivalRanks: [onlineText("simRankCoach"), onlineText("simRankRookie"), onlineText("simRankRookie")] });
  let supabase = null, supabaseLoading = null;
  const emit = patch => { state = Object.freeze({ ...state, ...patch }); for (const fn of listeners) { try { fn(state); } catch { /* listener */ } } };
  const onOnline = () => emit({ online: true, syncState: state.syncState === "OFFLINE" ? "LOCAL_ONLY" : state.syncState });
  const onOffline = () => emit({ online: false, syncState: state.lastSync ? "OFFLINE" : "LOCAL_ONLY" });
  win?.addEventListener?.("online", onOnline); win?.addEventListener?.("offline", onOffline);

  async function adapter() {
    if (!config.configured || !state.online) return local;
    if (supabase) return supabase;
    if (!supabaseLoading) {
      supabaseLoading = (async () => {
        const library = await loadLibrary();
        supabase = createSupabase({ library, url: config.url, anonKey: config.anonKey, sessionStorage, win });
        emit({ mode: SUPABASE_MODE, libraryError: null });
        return supabase;
      })().catch(error => { supabaseLoading = null; emit({ libraryError: error?.message ?? String(error) }); return local; });
    }
    return supabaseLoading;
  }
  const identityArgs = () => ({ preferredCode: hooks.preferredCode?.() ?? null, tamerName: hooks.tamerName?.() ?? "", rankTitle: hooks.rankTitle?.() ?? "", acePartner: hooks.acePartner?.() ?? null });
  async function ensureIdentity() {
    const a = await adapter();
    const identity = await a.ensureIdentity(identityArgs());
    emit({ identity, mode: a.mode });
    return identity;
  }

  /** The identity for the adapter in use. A simulated identity never stands in for a cloud one (and the other way round):
   * when connectivity or configuration switches the adapter, sign in again and drop the old sync baseline. */
  async function identityFor() {
    const a = await adapter();
    const wantSimulated = a.mode !== SUPABASE_MODE;
    if (state.identity && (state.identity.simulated === true) === wantSimulated) return state.identity;
    if (state.identity) emit({ identity: null, lastSync: null, conflict: null, syncState: "LOCAL_ONLY" });
    return ensureIdentity();
  }

  return Object.freeze({
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    adapter,
    /** The licence badge and the panels read this: never throws. */
    async getIdentitySummary() {
      try {
        const identity = await identityFor();
        return Object.freeze({ mode: state.mode, online: state.online, configured: config.configured, tamerCode: identity?.tamerCode ?? null, isAnonymous: identity?.isAnonymous !== false,
          email: identity?.email ?? null, providers: identity?.providers ?? [], simulated: identity?.simulated === true, syncState: state.syncState, lastSync: state.lastSync,
          bindRewardClaimed: identity?.bindRewardClaimed === true });
      } catch (error) {
        return Object.freeze({ mode: state.mode, online: state.online, configured: config.configured, tamerCode: null, isAnonymous: true, email: null, providers: [], simulated: state.mode !== SUPABASE_MODE, syncState: state.syncState, lastSync: state.lastSync, error: error?.reason ?? error?.message ?? String(error) });
      }
    },
    ensureGuest: ensureIdentity,
    async bindEmail(email) { const a = await adapter(); return a.bindEmail(email); },
    async verifyEmailOtp(email, token) { const a = await adapter(); const out = await a.verifyEmailOtp(email, token); if (out?.ok && out.identity) emit({ identity: out.identity }); return out; },
    async bindGoogle() { return this.bindProvider("google"); },
    /**
     * Owner 2026-10-29: link the guest pass to Google / Facebook / Discord. The
     * cloud leaves the page for the provider (redirect: true); the simulation
     * links in memory and answers with the new identity at once.
     */
    async bindProvider(provider) {
      const a = await adapter(); await identityFor();
      const out = await a.bindProvider(provider);
      if (out?.ok && out.identity) emit({ identity: out.identity });
      return out;
    },
    async signInWithProvider(provider) {
      const a = await adapter();
      const out = await a.signInWithProvider(provider);
      if (out?.ok && out.identity) emit({ identity: out.identity, lastSync: null, conflict: null, syncState: "LOCAL_ONLY" });
      return out;
    },
    /** First-bind gift. `saveRef` is the hashed save id the ledger keeps (claim_bind_reward). */
    async claimBindReward({ saveRef = null } = {}) {
      const a = await adapter(); await identityFor();
      const out = await a.claimBindReward(saveRef);
      if (out?.ok && !out.preview && state.identity) emit({ identity: Object.freeze({ ...state.identity, bindRewardClaimed: true }) });
      return out ?? Object.freeze({ ok: false, reason: "BIND_REWARD_UNAVAILABLE" });
    },
    /** Signs in again after an OAuth return or a provider change, so the identity reflects the linked account. */
    async refreshIdentity() { emit({ identity: null }); return ensureIdentity(); },
    async signInWithEmailOtp(email) { const a = await adapter(); return a.signInWithEmailOtp(email); },
    async verifyLoginOtp(email, token) { const a = await adapter(); const out = await a.verifyLoginOtp(email, token); if (out?.ok && out.identity) emit({ identity: out.identity }); return out; },
    async signOut() { const a = await adapter(); const out = await a.signOut(); emit({ identity: null, syncState: "LOCAL_ONLY", lastSync: null, conflict: null }); return out; },

    /** Uploads the serialized save; a revision mismatch becomes a CHOICE, never an overwrite. */
    async backupNow(saveText, { force = false } = {}) {
      const a = await adapter();
      await identityFor();
      emit({ syncState: "SYNCING" });
      let envelope;
      try { envelope = await buildCloudSaveEnvelope(saveText); } catch (error) { emit({ syncState: "FAILED" }); return Object.freeze({ ok: false, reason: error?.message ?? "ENVELOPE_FAILED" }); }
      const result = await a.uploadSave(envelope, force ? null : state.lastSync?.serverRevision ?? null, { force });
      if (result?.ok === false && result.reason === "CONFLICT") {
        // Identical content on both sides is not a conflict: adopt the cloud revision as the baseline.
        if (result.contentSha256 === envelope.contentSha256) {
          emit({ syncState: "SYNCED", conflict: null, lastSync: Object.freeze({ serverRevision: result.serverRevision, contentSha256: result.contentSha256, at: result.updatedAt ?? new Date().toISOString(), simulated: state.mode !== SUPABASE_MODE }) });
          return Object.freeze({ ok: true, serverRevision: result.serverRevision, contentSha256: result.contentSha256, updatedAt: result.updatedAt });
        }
        emit({ syncState: "CHOICE", conflict: result }); return result;
      }
      if (!confirmsSync(result, envelope)) { emit({ syncState: state.online ? "FAILED" : "OFFLINE" }); return Object.freeze({ ok: false, reason: result?.reason ?? "SYNC_UNCONFIRMED", message: result?.message ?? null }); }
      emit({ syncState: "SYNCED", conflict: null, lastSync: Object.freeze({ serverRevision: result.serverRevision, contentSha256: result.contentSha256, at: result.updatedAt ?? new Date().toISOString(), simulated: result.simulated === true }) });
      return result;
    },
    /** Returns the cloud envelope (payload text); the caller validates and writes it through the save port. */
    async restoreFromCloud() {
      const a = await adapter();
      await identityFor();
      const result = await a.downloadSave();
      if (!result?.ok) return Object.freeze({ ok: false, reason: result?.reason ?? "NO_CLOUD_SAVE" });
      emit({ syncState: "SYNCED", conflict: null, lastSync: Object.freeze({ serverRevision: result.serverRevision, contentSha256: result.contentSha256, at: result.updatedAt ?? new Date().toISOString(), simulated: result.simulated === true }) });
      return result;
    },
    /**
     * The cloud copy for the side-by-side chooser, without adopting it: the sync
     * baseline only moves once the player picked a side (adoptCloudBaseline / backupNow).
     */
    async peekCloudSave() {
      const a = await adapter();
      await identityFor();
      const result = await a.downloadSave();
      return result?.ok ? result : Object.freeze({ ok: false, reason: result?.reason ?? "NO_CLOUD_SAVE" });
    },
    /** The player kept the cloud copy: it is now the baseline future backups must match. */
    adoptCloudBaseline(result) {
      if (!Number.isInteger(result?.serverRevision)) return;
      emit({ syncState: "SYNCED", conflict: null, lastSync: Object.freeze({ serverRevision: result.serverRevision, contentSha256: result.contentSha256, at: result.updatedAt ?? new Date().toISOString(), simulated: result.simulated === true }) });
    },
    /** The open room the lobby is waiting in (the brag card prints its code), or null. */
    setActiveRoom(room) {
      const next = room?.roomCode ? Object.freeze({ roomCode: String(room.roomCode), matchId: room.matchId ?? null }) : null;
      if (next?.roomCode !== state.activeRoom?.roomCode) emit({ activeRoom: next });
    },
    async createTransferCode() { const a = await adapter(); await identityFor(); return a.createTransferCode(); },
    async redeemTransferCode(code) { const a = await adapter(); await identityFor(); return a.redeemTransferCode(code); },

    async findTamer(code) { const a = await adapter(); return a.findTamer(code); },
    async listFriends() { const a = await adapter(); await identityFor(); return a.listFriends(); },
    async addFriend(code) { const a = await adapter(); await identityFor(); return a.sendFriendRequest(code); },
    async respondFriendRequest(id, accept) { const a = await adapter(); return a.respondFriendRequest(id, accept); },
    async removeFriend(id) { const a = await adapter(); return a.removeFriend(id); },
    async setDefenseTeam(team) { const a = await adapter(); await identityFor(); return a.setDefenseTeam(team); },
    async getFriendDefenseTeam(userId) { const a = await adapter(); return a.getFriendDefenseTeam(userId); },
    async ladderOpponents(limit = 3) { const a = await adapter(); await identityFor(); return a.pickLadderOpponents(limit); },
    async roomAdapter() { const a = await adapter(); await identityFor(); return a; },
    async deleteMyData() { const a = await adapter(); const out = await a.deleteMyData(); emit({ identity: null, syncState: "LOCAL_ONLY", lastSync: null, conflict: null }); return out; },

    /** Adapters for the existing future-systems ports (futureSystemsPort.js). */
    cloudAdapter() {
      return Object.freeze({
        bindAccount: async ({ provider }) => ["google", "facebook", "discord"].includes(provider) ? this.bindProvider(provider) : Object.freeze({ ok: false, reason: "USE_EMAIL_OTP_FLOW", provider }),
        mergeGuestSave: async ({ save }) => this.backupNow(typeof save === "string" ? save : JSON.stringify(save))
      });
    },
    socialAdapter() {
      return Object.freeze({
        listFriends: async () => this.listFriends(),
        addFriend: async ({ code }) => this.addFriend(code),
        getDefenseTeam: async code => { const found = await this.findTamer(code); return found ? this.getFriendDefenseTeam(found.userId) : null; }
      });
    },
    dispose() { win?.removeEventListener?.("online", onOnline); win?.removeEventListener?.("offline", onOffline); local.dispose?.(); supabase?.dispose?.(); listeners.clear(); }
  });
}

export { LOCAL_SIMULATION_MODE, SUPABASE_MODE };
