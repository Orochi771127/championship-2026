// Local simulation adapter (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// The offline twin of supabaseMode.js: the same adapter surface, answered in
// memory for this page only. It lets every online panel open and be used
// before a Supabase project exists, or while the player is offline. It never
// touches storage or the network, and its "rivals" are mirrors built from the
// player's own partners by the hooks the service injects.

export const LOCAL_SIMULATION_MODE = "LOCAL_SIMULATION";
export const SIMULATED_OAUTH_PROVIDERS = Object.freeze(["google", "facebook", "discord"]);
// Owner 2026-10-29: the same 6-character, 15-minute, single-use code shape as the cloud.
export const TRANSFER_CODE_TTL_MS = 15 * 60 * 1000;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SIM_REWARD_BITS = 5000;

function code(random, prefix, groups = 2, size = 4) {
  let out = prefix;
  for (let g = 0; g < groups; g++) { out += (g ? "-" : "") + Array.from({ length: size }, () => CROCKFORD[Math.floor(random() * 32)]).join(""); }
  return out;
}
/** XXX-XXX (any case, spaces, O→0, I/L→1) into the six code characters. */
export function cleanTransferCode(input) {
  return String(input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function createLocalSimulationAdapter({
  random = Math.random, now = () => new Date().toISOString(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout,
  /** Hooks from the game: a password code for the player's own team, and a guest's reply to an invite. */
  ownDefenseCode = async () => null, simulateGuestReply = async () => null,
  /** Display names and ranks for the simulated rivals come from the caller's locale table. */
  rivalNames = ["Mirror A", "Mirror B", "Mirror C"], rivalRanks = ["", "", ""]
} = {}) {
  const userId = `local-${code(random, "", 2).replace("-", "")}`.toLowerCase();
  let identity = null, defenseTeam = null, cloud = null, transfer = null, rewardPreviewed = false;
  const friends = new Map(), matches = new Map(), listeners = new Map(), presence = new Map();
  const rivals = rivalNames.map((name, index) => ({ userId: `sim-${index + 1}`, tamerCode: code(random, "TM-"), tamerName: name, rankTitle: rivalRanks[index] ?? "",
    acePartner: {}, lastSeenAt: now(), hasDefenseTeam: true, simulated: true }));
  const notify = matchId => { const match = matches.get(matchId); for (const fn of listeners.get(matchId) ?? []) { try { fn(match); } catch { /* listener error */ } } };
  const result = (ok, extra = {}) => Object.freeze({ ok, ...extra });

  return Object.freeze({
    mode: LOCAL_SIMULATION_MODE,
    async ensureIdentity({ preferredCode = null, tamerName = "", rankTitle = "", acePartner = null } = {}) {
      // A simulated link survives a refresh of the card within this page (it is never stored).
      identity = Object.freeze({ userId, tamerCode: preferredCode ?? identity?.tamerCode ?? code(random, "TM-"), tamerName, rankTitle, acePartner: acePartner ?? {},
        isAnonymous: identity?.isAnonymous ?? true, email: null, providers: identity?.providers ?? Object.freeze([]), simulated: true });
      return identity;
    },
    async currentIdentity() { return identity; },
    async bindEmail() { return result(false, { reason: "CLOUD_NOT_CONFIGURED" }); },
    async verifyEmailOtp() { return result(false, { reason: "CLOUD_NOT_CONFIGURED" }); },
    /**
     * Owner 2026-10-29: a rehearsal of the Google / Facebook / Discord link. The
     * guest becomes a "linked" identity for this page only; nothing is sent or stored.
     */
    async bindProvider(provider) {
      if (!SIMULATED_OAUTH_PROVIDERS.includes(provider)) return result(false, { reason: "PROVIDER_UNSUPPORTED" });
      const base = identity ?? await this.ensureIdentity({});
      identity = Object.freeze({ ...base, isAnonymous: false, providers: Object.freeze([...new Set([...(base.providers ?? []), provider])]) });
      return result(true, { linked: true, provider, identity, simulated: true });
    },
    async signInWithProvider(provider) { return this.bindProvider(provider); },
    async bindGoogle() { return this.bindProvider("google"); },
    async signInWithEmailOtp() { return result(false, { reason: "CLOUD_NOT_CONFIGURED" }); },
    async signOut() { identity = null; return result(true); },
    /** The gift is only previewed here: the save is never paid by a simulation. */
    async claimBindReward() {
      if (!identity || identity.isAnonymous !== false) return result(false, { reason: "ACCOUNT_NOT_LINKED", simulated: true });
      if (rewardPreviewed) return result(false, { reason: "BIND_REWARD_ALREADY_CLAIMED", simulated: true });
      rewardPreviewed = true;
      return result(true, { preview: true, simulated: true, rewardBits: SIM_REWARD_BITS, provider: identity.providers[0] ?? null, claimedAt: now() });
    },

    async uploadSave(envelope, expectedRevision = null, { force = false } = {}) {
      // Same rule as the server: an existing copy is replaced only with its known revision or an explicit force.
      if (cloud && !force && (expectedRevision === null || cloud.serverRevision !== expectedRevision))
        return result(false, { reason: "CONFLICT", serverRevision: cloud.serverRevision, contentSha256: cloud.contentSha256, summary: cloud.summary, deviceLabel: cloud.deviceLabel, updatedAt: cloud.updatedAt });
      cloud = { ...envelope, serverRevision: (cloud?.serverRevision ?? 0) + 1, updatedAt: now() };
      return result(true, { serverRevision: cloud.serverRevision, contentSha256: cloud.contentSha256, updatedAt: cloud.updatedAt, simulated: true });
    },
    async downloadSave() { return cloud ? result(true, { ...cloud, simulated: true }) : null; },
    async createTransferCode() {
      if (!cloud) return result(false, { reason: "BACKUP_REQUIRED" });
      transfer = { code: code(random, "", 2, 3), expiresAt: new Date(Date.now() + TRANSFER_CODE_TTL_MS).toISOString() };
      return result(true, { transferCode: transfer.code, expiresAt: transfer.expiresAt, simulated: true });
    },
    async redeemTransferCode(input) {
      const clean = cleanTransferCode(input);
      if (!transfer || Date.parse(transfer.expiresAt) <= Date.now() || transfer.code.replace("-", "") !== clean) return result(false, { reason: "TRANSFER_CODE_INVALID" });
      transfer = null; return result(true, { ...cloud, simulated: true });
    },

    async findTamer(input) {
      const wanted = String(input ?? "").trim().toUpperCase();
      const rival = rivals.find(r => r.tamerCode === wanted);
      return rival ? { ...rival } : null;
    },
    async listRivals() { return rivals.map(r => ({ ...r })); },
    async sendFriendRequest(input) {
      const rival = await this.findTamer(input);
      if (!rival) return result(false, { reason: "TAMER_NOT_FOUND" });
      const existing = [...friends.values()].find(f => f.userId === rival.userId);
      if (existing) return result(true, { status: existing.status, friendshipId: existing.friendshipId });
      const friendshipId = `fr-${friends.size + 1}`;
      friends.set(friendshipId, { friendshipId, status: "pending", direction: "outgoing", ...rival });
      // A simulated rival answers after a moment, so the request list is exercised.
      setTimer(() => { const f = friends.get(friendshipId); if (f && f.status === "pending") f.status = "accepted"; }, 1500);
      return result(true, { status: "pending", friendshipId, simulated: true });
    },
    async respondFriendRequest(friendshipId, accept) {
      const f = friends.get(friendshipId); if (!f) return result(false, { reason: "REQUEST_NOT_FOUND" });
      if (accept) { f.status = "accepted"; return result(true, { status: "accepted" }); }
      friends.delete(friendshipId); return result(true, { status: "declined" });
    },
    async removeFriend(friendshipId) { return result(friends.delete(friendshipId)); },
    async listFriends() {
      if (!friends.size) {
        // First visit: one incoming request waits, so the list is never empty in the simulation.
        const rival = rivals[0];
        friends.set("fr-sim", { friendshipId: "fr-sim", status: "pending", direction: "incoming", ...rival });
      }
      return [...friends.values()].map(f => ({ ...f }));
    },
    async setDefenseTeam(team) { defenseTeam = team ?? null; return result(true, { simulated: true }); },
    async getFriendDefenseTeam(friendUserId) {
      const friend = [...friends.values()].find(f => f.userId === friendUserId && f.status === "accepted") ?? rivals.find(r => r.userId === friendUserId);
      if (!friend) return null;
      const passwordCode = defenseTeam?.passwordCode ?? await ownDefenseCode();
      return passwordCode ? { userId: friend.userId, tamerCode: friend.tamerCode, tamerName: friend.tamerName, rankTitle: friend.rankTitle, defenseTeam: { passwordCode, members: defenseTeam?.members ?? [], mirrored: true } } : null;
    },
    async pickLadderOpponents(limit = 3) {
      const passwordCode = defenseTeam?.passwordCode ?? await ownDefenseCode();
      if (!passwordCode) return [];
      return rivals.slice(0, limit).map(r => ({ ...r, defenseTeam: { passwordCode, members: defenseTeam?.members ?? [], mirrored: true } }));
    },

    async createRoom(inviteCode, codeLength = 4) {
      const matchId = `m-${matches.size + 1}`;
      const roomCode = String(Math.floor(random() * 10 ** codeLength)).padStart(codeLength, "0");
      const match = { matchId, roomCode, mode: "room", status: "open", seed: Math.floor(random() * 2147483647), hostId: userId, guestId: null, inviteCode, replyCode: null,
        hostReady: false, guestReady: false, hostResult: null, guestResult: null, winnerId: null, expiresAt: new Date(Date.now() + 600000).toISOString(), simulated: true };
      matches.set(matchId, match);
      // The simulated challenger joins and answers with a real reply code built from the player's own team.
      setTimer(async () => {
        const live = matches.get(matchId); if (!live || live.status !== "open") return;
        live.guestId = "sim-1"; live.status = "joined"; notify(matchId);
        presence.get(matchId)?.(["host", "guest"]);
        const reply = await simulateGuestReply(inviteCode);
        const again = matches.get(matchId); if (!again || again.status !== "joined") return;
        if (reply) { again.replyCode = reply; again.guestReady = true; again.status = "ready"; }
        else { again.status = "cancelled"; again.reason = "SIMULATED_GUEST_UNAVAILABLE"; }
        notify(matchId);
      }, 1500);
      return result(true, { matchId, roomCode, seed: match.seed, status: "open", expiresAt: match.expiresAt, simulated: true });
    },
    async joinRoom(roomCode) {
      const match = [...matches.values()].find(m => m.roomCode === String(roomCode).trim() && m.status === "open");
      if (!match) return result(false, { reason: "ROOM_NOT_FOUND", simulated: true });
      return result(false, { reason: "CANNOT_JOIN_OWN_ROOM" });
    },
    async submitReply(matchId, replyCode) { const m = matches.get(matchId); if (!m) return result(false, { reason: "MATCH_NOT_FOUND" }); m.replyCode = replyCode; m.guestReady = true; m.status = "ready"; notify(matchId); return result(true, { status: m.status }); },
    async setReady(matchId) {
      const m = matches.get(matchId); if (!m) return result(false, { reason: "MATCH_NOT_FOUND" });
      if (!m.replyCode) return result(false, { reason: "REPLY_PENDING" });
      m.hostReady = true; m.status = m.guestReady ? "playing" : "ready"; notify(matchId);
      return result(true, { status: m.status, hostReady: m.hostReady, guestReady: m.guestReady });
    },
    async getMatch(matchId) { const m = matches.get(matchId); return m ? { ...m } : null; },
    async reportResult(matchId, report) {
      const m = matches.get(matchId); if (!m) return result(false, { reason: "MATCH_NOT_FOUND" });
      m.hostResult = report; m.guestResult = report; m.winnerId = report?.winnerId ?? null; m.status = "finished"; notify(matchId);
      return result(true, { status: "finished", winnerId: m.winnerId });
    },
    async cancelRoom(matchId) { const m = matches.get(matchId); if (!m) return result(false); m.status = "cancelled"; notify(matchId); return result(true); },
    /** `onPresence(roles)` mirrors the cloud's Presence channel: the host alone until the challenger joins. */
    subscribeMatch(matchId, listener, { presence: own = null, onPresence = null } = {}) {
      const set = listeners.get(matchId) ?? new Set(); set.add(listener); listeners.set(matchId, set);
      if (own && typeof onPresence === "function") {
        presence.set(matchId, onPresence);
        const match = matches.get(matchId);
        onPresence(match?.guestId ? ["host", "guest"] : [own.role ?? "host"]);
      }
      return () => { set.delete(listener); if (presence.get(matchId) === onPresence) presence.delete(matchId); };
    },
    async deleteMyData() { identity = null; cloud = null; friends.clear(); matches.clear(); return result(true); },
    dispose() { listeners.clear(); presence.clear(); }
  });
}
