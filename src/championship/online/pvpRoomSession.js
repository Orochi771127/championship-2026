// Room-code PvP session (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// The game's link battle is already deterministic: both sides swap an invite
// and a reply code and simulate the same host-first battle. This session only
// carries those two codes through a room (Supabase or the local simulation),
// waits until both players are ready, counts down, and hands each side the
// `prepared` link battle the existing onEnter(…, 'LINK_BATTLE') already takes.
// No battle logic, no new transport format, no timers beyond the countdown.

export const PVP_ROOM_STATES = Object.freeze(["idle", "creating", "waiting", "joined", "ready", "countdown", "playing", "finished", "failed", "cancelled"]);
export const PVP_COUNTDOWN_MS = 3000;

export function createPvpRoomSession({ adapter, game, codeLength = 4, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  if (!adapter?.createRoom || !adapter.joinRoom) throw new TypeError("PVP_ADAPTER_REQUIRED");
  if (!game?.createInvite || !game.prepareGuest || !game.prepareHost) throw new TypeError("PVP_GAME_HOOKS_REQUIRED");
  const listeners = new Set();
  // peerOnline (Owner 2026-10-29): the other player's Presence in the room channel; null until known.
  let state = Object.freeze({ phase: "idle", role: null, matchId: null, roomCode: null, seed: null, reason: null, prepared: null, opponent: null, countdownEndsAt: null, peerOnline: null });
  let unsubscribe = null, countdown = null, invite = null, prepared = null, started = false, disposed = false;

  const emit = patch => { state = Object.freeze({ ...state, ...patch }); for (const fn of listeners) { try { fn(state); } catch { /* listener */ } } };
  const fail = (reason, extra = {}) => { cleanup(); emit({ phase: "failed", reason, ...extra }); return state; };
  function cleanup() { unsubscribe?.(); unsubscribe = null; clearTimer(countdown); countdown = null; }
  const watch = matchId => adapter.subscribeMatch(matchId, match => { void onMatch(match); }, {
    presence: { role: state.role }, onPresence: roles => { if (!disposed) emit({ peerOnline: roles.includes(state.role === "host" ? "guest" : "host") }); } });
  function startCountdown() {
    if (started || state.phase === "countdown") return;
    emit({ phase: "countdown", countdownEndsAt: Date.now() + PVP_COUNTDOWN_MS });
    countdown = setTimer(() => { if (disposed) return; started = true; cleanup(); emit({ phase: "playing", prepared }); }, PVP_COUNTDOWN_MS);
  }
  async function onMatch(match) {
    if (disposed || started) return;
    if (["cancelled", "expired"].includes(match.status)) { fail(match.status === "expired" ? "ROOM_EXPIRED" : "ROOM_CANCELLED"); return; }
    if (state.role === "host") {
      if (match.status === "joined" && state.phase === "waiting") emit({ phase: "joined", opponent: match.guestId ?? null });
      if (match.replyCode && !prepared) {
        const result = await game.prepareHost(invite.inviteCode, match.replyCode);
        if (!result?.ok) { fail(result?.reason ?? "HOST_PREPARE_FAILED", { message: result?.message ?? null }); await adapter.cancelRoom(match.matchId); return; }
        prepared = result; emit({ phase: "ready", prepared });
        const ready = await adapter.setReady(match.matchId);
        if (ready?.status === "playing") startCountdown();
      } else if (match.status === "playing" && prepared) startCountdown();
    } else if (match.status === "playing" && prepared) startCountdown();
  }

  return Object.freeze({
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    /** Host: build the invite from the chosen partners and open a room. */
    async host({ instanceIds }) {
      if (state.phase !== "idle") return state;
      emit({ phase: "creating", role: "host" });
      invite = await game.createInvite(instanceIds, { transportVersion: 2 });
      if (!invite?.ok) return fail(invite?.reason ?? "INVITE_FAILED", { message: invite?.message ?? null });
      const room = await adapter.createRoom(invite.inviteCode, codeLength, "room");
      if (!room?.ok) return fail(room?.reason ?? "ROOM_CREATE_FAILED", { message: room?.message ?? null });
      emit({ phase: "waiting", matchId: room.matchId, roomCode: room.roomCode, seed: room.seed ?? null });
      unsubscribe = watch(room.matchId);
      return state;
    },
    /** Guest: join by room code, answer the invite, and wait for the host. */
    async join({ roomCode, instanceIds }) {
      if (state.phase !== "idle") return state;
      emit({ phase: "creating", role: "guest" });
      const room = await adapter.joinRoom(String(roomCode ?? "").trim());
      if (!room?.ok) return fail(room?.reason ?? "ROOM_JOIN_FAILED", { message: room?.message ?? null });
      emit({ phase: "joined", matchId: room.matchId, roomCode: room.roomCode, seed: room.seed ?? null, opponent: room.host ?? null });
      const result = await game.prepareGuest(room.inviteCode, instanceIds);
      if (!result?.ok) { await adapter.cancelRoom(room.matchId); return fail(result?.reason ?? "GUEST_PREPARE_FAILED", { message: result?.message ?? null }); }
      prepared = result;
      const sent = await adapter.submitReply(room.matchId, result.replyCode);
      if (!sent?.ok) return fail(sent?.reason ?? "REPLY_FAILED");
      emit({ phase: "ready", prepared });
      unsubscribe = watch(room.matchId);
      const ready = await adapter.setReady(room.matchId);
      if (ready?.status === "playing") startCountdown();
      return state;
    },
    async report(result) { if (!state.matchId) return null; return adapter.reportResult(state.matchId, result); },
    async cancel() { if (state.matchId && !started) await adapter.cancelRoom(state.matchId); cleanup(); emit({ phase: "cancelled" }); },
    dispose() { disposed = true; cleanup(); listeners.clear(); }
  });
}
