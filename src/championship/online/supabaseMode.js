// Supabase adapter (OWNER_APPROVED_ADAPTATION 2026-10-28): the cloud twin of
// localSimulationMode.js with the same surface. Every write goes through the
// SECURITY DEFINER RPCs of supabase/migrations/001_championship_online.sql,
// so RLS and the server's own checks apply; the game never writes tables
// directly. Room updates arrive over a private Broadcast channel
// (`pvp:<matchId>`) with a slow poll as the fallback.

export const SUPABASE_MODE = "SUPABASE";
export const ONLINE_SESSION_STORAGE_KEY = "championship-online";
// Owner 2026-10-29: the OAuth providers a guest pass can be linked to (Supabase manual linking).
export const OAUTH_PROVIDERS = Object.freeze(["google", "facebook", "discord"]);
const POLL_MS = 3000;

/**
 * Where an OAuth round trip returns: this page without its query or hash, plus
 * `cm_link=<provider>` so an error return still names the provider (the
 * Redirect URLs allow-list entry ends in `**`, see the setup guide).
 */
export function oauthReturnUrl(win = globalThis, provider = null) {
  const location = win?.location;
  if (!location?.origin || !location.pathname) return undefined;
  return `${location.origin}${location.pathname}${provider ? `?cm_link=${encodeURIComponent(provider)}` : ""}`;
}

function failure(error) {
  const code = error?.code ?? error?.status ?? null;
  const reason = code === "42501" || code === 401 ? "AUTH_REQUIRED" : code === "PGRST202" ? "RPC_MISSING" : `RPC_${String(code ?? "ERROR").replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}`;
  return Object.freeze({ ok: false, reason, message: String(error?.message ?? error ?? "") });
}

/**
 * `sessionStorage` is the guarded product port ({ getItem, setItem, removeItem })
 * so the auth session never reaches localStorage behind the firewall's back.
 */
export function createSupabaseAdapter({ library, url, anonKey, sessionStorage = null, win = globalThis, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, setIntervalFn = globalThis.setInterval, clearIntervalFn = globalThis.clearInterval } = {}) {
  if (!library?.createClient) throw new TypeError("SUPABASE_LIBRARY_REQUIRED");
  const client = library.createClient(url, anonKey, {
    auth: {
      storage: sessionStorage ?? undefined, storageKey: ONLINE_SESSION_STORAGE_KEY,
      persistSession: Boolean(sessionStorage), autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce"
    },
    realtime: { params: { eventsPerSecond: 5 } },
    global: { headers: { "x-championship-client": "web" } }
  });
  let identity = null;

  async function rpc(name, args = {}) {
    try {
      const { data, error } = await client.rpc(name, args);
      if (error) return failure(error);
      return data;
    } catch (error) { return failure(error); }
  }
  function userToIdentity(user, profile) {
    const providers = Array.isArray(user?.identities) ? user.identities.map(i => i.provider).filter(p => p && p !== "anonymous") : [];
    return Object.freeze({
      userId: user?.id ?? profile?.userId ?? null, tamerCode: profile?.tamerCode ?? null, tamerName: profile?.tamerName ?? "", rankTitle: profile?.rankTitle ?? "",
      acePartner: profile?.acePartner ?? {}, isAnonymous: user?.is_anonymous === true || (!user?.email && providers.length === 0),
      email: user?.email ?? null, providers: Object.freeze(providers), hasDefenseTeam: profile?.hasDefenseTeam === true,
      bindRewardClaimed: profile?.bindRewardClaimed === true, simulated: false
    });
  }
  async function currentUser() {
    const { data } = await client.auth.getSession();
    return data?.session?.user ?? null;
  }

  return Object.freeze({
    mode: SUPABASE_MODE,
    client,
    async ensureIdentity({ preferredCode = null, tamerName = "", rankTitle = "", acePartner = null } = {}) {
      let user = await currentUser();
      if (!user) {
        const { data, error } = await client.auth.signInAnonymously();
        if (error) throw Object.assign(new Error(error.message), { reason: "ANONYMOUS_SIGNIN_FAILED" });
        user = data.user;
      }
      const profile = await rpc("ensure_tamer_profile", { p_tamer_name: tamerName, p_rank_title: rankTitle, p_preferred_code: preferredCode, p_ace_partner: acePartner });
      if (profile?.ok === false) throw Object.assign(new Error(profile.message ?? profile.reason), { reason: profile.reason });
      identity = userToIdentity(user, profile);
      return identity;
    },
    async currentIdentity() { const user = await currentUser(); return user ? (identity ?? userToIdentity(user, null)) : null; },
    /** Guest → permanent: the uid is kept, so cloud rows and the local save stay the player's. */
    async bindEmail(email) {
      const { error } = await client.auth.updateUser({ email });
      return error ? failure(error) : Object.freeze({ ok: true, step: "OTP_SENT", email });
    },
    async verifyEmailOtp(email, token) {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: "email_change" });
      if (error) return failure(error);
      const profile = await rpc("ensure_tamer_profile", {});
      identity = userToIdentity(data?.user ?? await currentUser(), profile?.ok === false ? null : profile);
      return Object.freeze({ ok: true, identity });
    },
    /** Guest → Google / Facebook / Discord. The uid is kept; the browser leaves for the provider and comes back here. */
    async bindProvider(provider, { redirectTo = oauthReturnUrl(win, provider) } = {}) {
      if (!OAUTH_PROVIDERS.includes(provider)) return Object.freeze({ ok: false, reason: "PROVIDER_UNSUPPORTED" });
      const { error } = await client.auth.linkIdentity({ provider, options: { redirectTo } });
      return error ? failure(error) : Object.freeze({ ok: true, redirect: true, provider });
    },
    /** A provider account that already owns a tamer: sign in to it (this device's save stays until the player chooses). */
    async signInWithProvider(provider, { redirectTo = oauthReturnUrl(win, provider) } = {}) {
      if (!OAUTH_PROVIDERS.includes(provider)) return Object.freeze({ ok: false, reason: "PROVIDER_UNSUPPORTED" });
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      return error ? failure(error) : Object.freeze({ ok: true, redirect: true, provider });
    },
    async bindGoogle(options = {}) { return this.bindProvider("google", options); },
    /** First-bind gift: the server ledger answers once per account (and again only for the same save). */
    async claimBindReward(saveRef) { return rpc("claim_bind_reward", { p_save_ref: saveRef }); },
    async bindRewardStatus() { const data = await rpc("get_bind_reward_status"); return data?.ok === false ? null : data; },
    /** New device: sign in to an existing email account (guest progress on this device stays local). */
    async signInWithEmailOtp(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      return error ? failure(error) : Object.freeze({ ok: true, step: "OTP_SENT", email });
    },
    async verifyLoginOtp(email, token) {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
      if (error) return failure(error);
      const profile = await rpc("ensure_tamer_profile", {});
      identity = userToIdentity(data?.user ?? await currentUser(), profile?.ok === false ? null : profile);
      return Object.freeze({ ok: true, identity });
    },
    async signOut() { const { error } = await client.auth.signOut(); identity = null; return error ? failure(error) : Object.freeze({ ok: true }); },

    async uploadSave(envelope, expectedRevision = null, { force = false } = {}) {
      return rpc("upload_cloud_save", { p_payload: envelope.payload, p_content_sha256: envelope.contentSha256, p_game_revision: envelope.gameRevision,
        p_summary: envelope.summary, p_device_label: envelope.deviceLabel, p_expected_revision: expectedRevision, p_force: Boolean(force) });
    },
    async downloadSave() { return rpc("download_cloud_save"); },
    async createTransferCode() { return rpc("create_transfer_code"); },
    async redeemTransferCode(code) { return rpc("redeem_transfer_code", { p_code: code }); },

    async findTamer(code) { const data = await rpc("find_tamer_by_code", { p_code: code }); return data?.ok === false ? null : data; },
    async sendFriendRequest(code) { return rpc("send_friend_request", { p_code: code }); },
    async respondFriendRequest(friendshipId, accept) { return rpc("respond_friend_request", { p_friendship_id: friendshipId, p_accept: Boolean(accept) }); },
    async removeFriend(friendshipId) { return rpc("remove_friend", { p_friendship_id: friendshipId }); },
    async listFriends() { const data = await rpc("list_friend_cards"); return Array.isArray(data) ? data : []; },
    async setDefenseTeam(team) { return rpc("set_defense_team", { p_team: team }); },
    async getFriendDefenseTeam(userId) { const data = await rpc("get_friend_defense_team", { p_user_id: userId }); return data?.ok === false ? null : data; },
    async pickLadderOpponents(limit = 5) { const data = await rpc("pick_ladder_opponents", { p_limit: limit }); return Array.isArray(data) ? data : []; },

    async createRoom(inviteCode, codeLength = 4, mode = "room") { return rpc("create_pvp_room", { p_invite_code: inviteCode, p_code_length: codeLength, p_mode: mode }); },
    async joinRoom(roomCode) { return rpc("join_pvp_room", { p_room_code: roomCode }); },
    async submitReply(matchId, replyCode) { const out = await rpc("submit_pvp_reply", { p_match_id: matchId, p_reply_code: replyCode }); await this.announce(matchId); return out; },
    async setReady(matchId) { const out = await rpc("set_pvp_ready", { p_match_id: matchId }); await this.announce(matchId); return out; },
    async getMatch(matchId) { const data = await rpc("get_pvp_match", { p_match_id: matchId }); return data?.ok === false ? null : data; },
    async reportResult(matchId, result) { const out = await rpc("report_pvp_result", { p_match_id: matchId, p_result: result }); await this.announce(matchId); return out; },
    async cancelRoom(matchId) { const out = await rpc("cancel_pvp_room", { p_match_id: matchId }); await this.announce(matchId); return out; },
    /** Tells the other side to re-read the match row. */
    async announce(matchId) {
      try { const channel = client.channel(`pvp:${matchId}`, { config: { private: true } }); await channel.httpSend?.("state", { at: Date.now() }); client.removeChannel(channel); } catch { /* polling covers it */ }
    },
    /**
     * Room updates: a Broadcast nudge re-reads the row (a slow poll covers a lost
     * socket). With `presence` the same private channel also tracks who is in the
     * room and reports the roles present through `onPresence(roles)`.
     */
    subscribeMatch(matchId, listener, { presence = null, onPresence = null } = {}) {
      let last = null, disposed = false;
      const push = match => { if (disposed || !match) return; const key = JSON.stringify([match.status, match.hostReady, match.guestReady, Boolean(match.replyCode), match.winnerId]); if (key !== last) { last = key; listener(match); } };
      const refresh = async () => { try { push(await this.getMatch(matchId)); } catch { /* next tick */ } };
      let channel = null;
      try {
        channel = client.channel(`pvp:${matchId}`, { config: { private: true, broadcast: { self: false }, ...(presence ? { presence: { key: presence.role ?? "player" } } : {}) } });
        channel.on("broadcast", { event: "state" }, () => { void refresh(); });
        if (presence && typeof onPresence === "function") channel.on("presence", { event: "sync" }, () => {
          if (disposed) return;
          try { onPresence(Object.keys(channel.presenceState?.() ?? {})); } catch { /* presence is advisory */ }
        });
        const join = () => channel.subscribe(status => { if (status === "SUBSCRIBED" && presence && !disposed) void channel.track?.({ role: presence.role ?? "player", at: Date.now() }); });
        // A private channel needs the session's JWT first; join either way so a missing setAuth never leaves the room unsubscribed.
        const auth = client.realtime?.setAuth?.();
        if (typeof auth?.then === "function") auth.then(join, join); else join();
      } catch { channel = null; }
      const poll = setIntervalFn(refresh, POLL_MS);
      void refresh();
      return () => { disposed = true; clearIntervalFn(poll); if (channel) client.removeChannel(channel); };
    },
    async deleteMyData() { return rpc("delete_my_online_data"); },
    dispose() { try { client.removeAllChannels?.(); } catch { /* fine */ } }
  });
}
