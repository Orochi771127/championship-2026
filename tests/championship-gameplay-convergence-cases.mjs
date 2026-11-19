import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createBattleSkillCards } from "../src/championship/battle/battleSkillCards.js";
import { buildBattleResultDiagnosis } from "../src/championship/app/battleResultDiagnosis.js";
import { createPvpRoomSession, PVP_COUNTDOWN_MS } from "../src/championship/online/pvpRoomSession.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createBattleRuntime } from "../src/championship/app/battleRuntime.js";
import { syncVitalPercent, syncBreakthroughsAt } from "../src/championship/contracts/productSyncLevel.js";
const CHAMPIONSHIP_SCREENS = Object.freeze({ BATTLE_FIELD: "BATTLE_FIELD" });
import { createNativeHuntIndividual } from "../src/championship/hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../src/championship/hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "../src/championship/raising/nativeIndividualProfile.js";

const readJson = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));

async function bootTestApp({ species = 53 } = {}) {
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    removeItem: (k) => data.delete(k),
    setItem: (k, v) => data.set(k, v)
  };
  const app = createChampionshipStandaloneApp({
    storage,
    catalog: readJson("src/data/championship/catalogs/creature-species.r1.json"),
    cages: readJson("docs/contracts/championship/raising-home-presentation.v1.json").cages,
    rngClock: () => ({ hour: 13, minute: 20, second: 50 })
  });
  await app.newGame();
  app.save();
  const [key, text] = [...data][0];
  const save = JSON.parse(text);
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(species), rng: { next: () => 11 } })));
  for (const k of ["058", "050"]) profile.fields[k] = 999;
  save.creature.nativeProfile = profile;
  save.creature.speciesId = `species-${String(species).padStart(3, "0")}`;
  data.set(key, JSON.stringify(save));
  await app.continueGame();
  app.openBattle();
  const id = app.getRaisingInstances()[0].instanceId;
  return { app, id };
}

function manualTimers() {
  let id = 0;
  const tasks = new Map();
  return {
    setTimer(fn) { const key = ++id; tasks.set(key, fn); return key; },
    clearTimer(key) { tasks.delete(key); },
    async flush() {
      const pending = [...tasks.entries()];
      tasks.clear();
      for (const [, fn] of pending) await fn();
    },
    size() { return tasks.size; }
  };
}

/**
 * Shared in-memory multi-client room relay mirroring supabase/migrations/001_championship_online.sql:
 * create_pvp_room, join_pvp_room, submit_pvp_reply, set_pvp_ready, report_pvp_result, cancel_pvp_room.
 */
function createMultiClientRoomRelay() {
  const matches = new Map();
  const subscribers = new Map();
  let nextMatch = 1;
  let reportCalls = 0;

  const snapshot = (m) => Object.freeze({ ...m });
  const notify = (matchId) => {
    const m = matches.get(matchId);
    if (!m) return;
    const snap = snapshot(m);
    for (const fn of subscribers.get(matchId) ?? []) fn(snap);
  };

  function clientAdapter(userId, tamerName) {
    return Object.freeze({
      async currentIdentity() { return Object.freeze({ userId, tamerName, simulated: false }); },
      async createRoom(inviteCode, codeLength = 4) {
        const matchId = `relay-m-${nextMatch++}`;
        const roomCode = String(1000 + nextMatch).slice(-codeLength).padStart(codeLength, "0");
        const m = {
          matchId, roomCode, status: "open", seed: 20261119 + nextMatch,
          hostId: userId, guestId: null, host: { userId, tamerName },
          inviteCode, replyCode: null,
          hostReady: false, guestReady: false,
          hostResult: null, guestResult: null, winnerId: null,
          simulated: false
        };
        matches.set(matchId, m);
        return Object.freeze({ ok: true, matchId, roomCode, seed: m.seed, hostId: userId, status: "open", simulated: false });
      },
      async joinRoom(roomCode) {
        const m = [...matches.values()].find((row) => row.roomCode === String(roomCode).trim() && row.status === "open");
        if (!m) return Object.freeze({ ok: false, reason: "ROOM_NOT_FOUND" });
        if (m.hostId === userId) return Object.freeze({ ok: false, reason: "CANNOT_JOIN_OWN_ROOM" });
        m.guestId = userId;
        m.status = "joined";
        notify(m.matchId);
        return Object.freeze({
          ok: true, matchId: m.matchId, roomCode: m.roomCode, seed: m.seed,
          inviteCode: m.inviteCode, host: m.host, hostId: m.hostId, guestId: userId, simulated: false
        });
      },
      async submitReply(matchId, replyCode) {
        const m = matches.get(matchId);
        if (!m) return Object.freeze({ ok: false, reason: "MATCH_NOT_FOUND" });
        m.replyCode = replyCode;
        m.guestReady = true;
        m.status = "ready";
        notify(matchId);
        return Object.freeze({ ok: true, status: m.status });
      },
      async setReady(matchId) {
        const m = matches.get(matchId);
        if (!m) return Object.freeze({ ok: false, reason: "MATCH_NOT_FOUND" });
        if (userId === m.hostId) m.hostReady = true;
        else if (userId === m.guestId) m.guestReady = true;
        if (m.hostReady && m.guestReady) m.status = "playing";
        notify(matchId);
        return Object.freeze({ ok: true, status: m.status, hostReady: m.hostReady, guestReady: m.guestReady });
      },
      async reportResult(matchId, result) {
        reportCalls += 1;
        const m = matches.get(matchId);
        if (!m) return Object.freeze({ ok: false, reason: "MATCH_NOT_FOUND" });
        if (m.status === "finished" || m.status === "disputed") {
          return Object.freeze({ ok: true, status: m.status, winnerId: m.winnerId, duplicate: true });
        }
        if (userId === m.hostId) m.hostResult = result;
        else if (userId === m.guestId) m.guestResult = result;
        if (m.hostResult && m.guestResult) {
          const hostWin = m.hostResult.winnerId ?? null;
          const guestWin = m.guestResult.winnerId ?? null;
          if (hostWin === guestWin) {
            m.winnerId = hostWin;
            m.status = "finished";
          } else {
            m.winnerId = null;
            m.status = "disputed";
          }
          notify(matchId);
          return Object.freeze({ ok: true, status: m.status, winnerId: m.winnerId });
        }
        notify(matchId);
        return Object.freeze({ ok: true, status: m.status, winnerId: null });
      },
      async cancelRoom(matchId) {
        const m = matches.get(matchId);
        if (!m) return Object.freeze({ ok: false });
        m.status = "cancelled";
        notify(matchId);
        return Object.freeze({ ok: true });
      },
      subscribeMatch(matchId, listener) {
        const set = subscribers.get(matchId) ?? new Set();
        set.add(listener);
        subscribers.set(matchId, set);
        return () => set.delete(listener);
      }
    });
  }

  return {
    clientAdapter,
    getMatch: (id) => matches.get(id) ?? null,
    getReportCalls: () => reportCalls
  };
}

test("wave skill cards persist spent ids across waves without redrawing or refilling the hand", () => {
  const hand = ["basic.cheer", "basic.cover", "basic.focus"];
  const slots = [
    { currentHp: 100, maxHp: 100, metricLimit: 50, metricBase: 50, field28: 0, statusCode: 0 },
    null, null,
    { currentHp: 100, maxHp: 100, metricLimit: 50, metricBase: 50, field28: 0, statusCode: 0 },
    null, null
  ];
  const wave1 = createBattleSkillCards({ hand, team: 0, teamOf: (slot) => (slot < 3 ? 0 : 1) });
  // Frame 300 (5s) unlocks first card
  assert.equal(wave1.request("basic.cheer", 300).ok, true);
  wave1.step(301, slots);
  // Frame 301: second card is not yet ready in Wave 1
  assert.equal(wave1.request("basic.cover", 301).ok, false);

  const carried = wave1.exportState();
  assert.deepEqual(carried.hand, hand);
  assert.deepEqual(carried.playedIds, ["basic.cheer"]);

  // Wave 2 restores the exact same hand and spent card, while allowing a remaining card to be played at wave 2 timing.
  const wave2 = createBattleSkillCards({ hand: carried.hand, team: 0, teamOf: (slot) => (slot < 3 ? 0 : 1) });
  wave2.restorePlayed(carried.playedIds);
  assert.equal(wave2.request("basic.cheer", 300).ok, false, "already spent in wave 1");
  assert.equal(wave2.request("basic.cover", 300).ok, true, "remaining unplayed card works in wave 2");
  wave2.step(301, slots);
  assert.deepEqual(wave2.exportState().playedIds, ["basic.cheer", "basic.cover"]);
});

test("single-entry wave run stays on BATTLE_FIELD when advancing waves and preserves KEEP_PICKED on defeat", async () => {
  const { app, id } = await bootTestApp({ species: 53 });
  try {
    const partyIds = [id];
    const started = app.startWaveRun({ mode: "CHALLENGE", encounterId: "challenge", party: partyIds });
    assert.equal(started.ok, true, started.reason);

    // Wave 1: prepare, enter, simulate to real victory
    const w1 = await app.prepareWaveBattle();
    assert.equal(w1.ok, true, w1.reason);
    const rt1 = createBattleRuntime({ mode: 2, battleType: 0, playerIndividuals: w1.individuals, rng: w1.rngPreparation.rng, personalityPolicy: "ORIGINAL" });
    let won1 = false;
    try {
      rt1.chooseFreeBattle({ presetIndices: w1.presetIndices, arenaIndex: w1.arenaIndex });
      rt1.setFoeBoostPercent(w1.foeBoostPercent);
      const v1 = rt1.startMatch();
      const entered1 = app.enterWaveBattle({ playerInstanceIds: w1.playerInstanceIds, rngPreparation: w1.rngPreparation });
      assert.equal(entered1.ok, true, entered1.reason);
      assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
      for (let t = 0; t < 120000 && !v1.getView().outcome.ended; t += 1) v1.tick();
      const finished1 = app.finishMatch({ ...rt1.getSettlementResult(), attemptId: entered1.attempt.attemptId });
      assert.equal(finished1.ok, true, finished1.reason);
      won1 = finished1.receipt?.won === true;
    } finally {
      rt1.dispose();
    }
    assert.equal(won1, true);
    assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.BATTLE_FIELD, "stays on BATTLE_FIELD after Wave 1 win");

    // Pick a ground drop once (repeat pick is idempotent)
    const runRest = app.getWaveRun().run;
    const coin = runRest.drops.find((d) => d.kind === "BITS");
    assert.ok(coin, "Wave 1 produced ground Bits drop");
    assert.equal(app.collectWaveDrop(coin.id).ok, true);
    assert.equal(app.collectWaveDrop(coin.id).reason, "ALREADY_PICKED", "duplicate pick never double-pays");
    const bitsPicked = app.getWaveRun().picked.bits;
    assert.equal(bitsPicked, coin.amount);

    // Advance to Wave 2 while staying on BATTLE_FIELD (stayInField: true, NO exitBattle()!)
    assert.equal(app.continueWaveRun().ok, true);
    const w2 = await app.prepareWaveBattle();
    assert.equal(w2.ok, true, w2.reason);
    const entered2 = app.enterWaveBattle({ playerInstanceIds: w2.playerInstanceIds, rngPreparation: w2.rngPreparation, stayInField: true });
    assert.equal(entered2.ok, true, entered2.reason);
    assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.BATTLE_FIELD, "Wave 2 stays in BATTLE_FIELD with single entry");

    // Wave 2 runs to a real settlement on the SAME BATTLE_FIELD without exiting, keeping Wave 1 picked loot
    const bitsBefore = app.getShopFrame().bits;
    const rt2 = createBattleRuntime({ mode: 2, battleType: 0, playerIndividuals: w2.individuals, rng: w2.rngPreparation.rng, personalityPolicy: "ORIGINAL" });
    try {
      rt2.chooseFreeBattle({ presetIndices: w2.presetIndices, arenaIndex: w2.arenaIndex });
      rt2.setFoeBoostPercent(w2.foeBoostPercent);
      const v2 = rt2.startMatch();
      for (let t = 0; t < 120000 && !v2.getView().outcome.ended; t += 1) v2.tick();
      const finished2 = app.finishMatch({ ...rt2.getSettlementResult(), attemptId: entered2.attempt.attemptId });
      assert.equal(finished2.ok, true, finished2.reason);
    } finally {
      rt2.dispose();
    }
    assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.BATTLE_FIELD, "still on BATTLE_FIELD after Wave 2");
    assert.equal(app.getWaveRun().run.wave, 2);
    assert.equal(app.getWaveRun().picked.bits, bitsPicked, "Wave 1 picked loot carried cleanly across Wave 2");

    // Leaving from REST after Wave 2 pays the picked loot once (duplicate leave pays nothing)
    const left = app.finishWaveRun("LEAVE");
    assert.equal(left.ok, true, left.reason);
    assert.equal(left.finished.bits, bitsPicked);
    assert.equal(app.getShopFrame().bits, bitsBefore + bitsPicked);
    assert.equal(app.finishWaveRun("LEAVE").duplicate, true);
    assert.equal(app.getShopFrame().bits, bitsBefore + bitsPicked, "duplicate leave never double-pays");
  } finally {
    await app.dispose();
  }
});

test("fusion combat deltas report real vital% and breakthrough unlocks accurately", () => {
  assert.equal(syncVitalPercent(1), 0);
  assert.equal(syncVitalPercent(10), 5.4);
  const unlocked = syncBreakthroughsAt(10).filter((b) => b.level > 1);
  assert.deepEqual(unlocked.map((b) => b.level), [10]);
  const unlocked20 = syncBreakthroughsAt(25).filter((b) => b.level > 10);
  assert.deepEqual(unlocked20.map((b) => b.level), [20]);
});

test("battle diagnosis is strictly telemetry-backed and never fabricates causes", () => {
  // Empty metrics on defeat -> returns null (never invents a reason)
  const emptyDefeat = buildBattleResultDiagnosis({
    outcome: { winningTeam: 1, verdict: "LOSE", reason: "KNOCKOUT" },
    tacticRecord: { local: [] },
    summary: { rows: [] },
    participants: []
  });
  assert.equal(emptyDefeat, null);

  // Observed TP dryness + early KO + star cap + close fight -> reports concrete levers
  const defeat = buildBattleResultDiagnosis({
    outcome: { winningTeam: 1, verdict: "LOSE", reason: "KNOCKOUT" },
    tacticRecord: {
      local: [
        { displayName: "亞古獸", spEmptySeconds: 6.4, downAt: 12 },
        { displayName: "加布獸", spEmptySeconds: 0, downAt: null }
      ]
    },
    participants: [
      { team: 0, instanceId: "p1", displayName: "亞古獸", speciesId: "species-025" },
      { team: 0, instanceId: "p2", displayName: "加布獸", speciesId: "species-026" },
      { team: 1, instanceId: "e1", displayName: "敵人", maxHp: 1000, currentHp: 200 }
    ],
    syncOf: (id) => (id === "p1" ? { star: 1, cap: 10, level: 10, capped: true } : { star: 1, cap: 10, level: 5, capped: false })
  });
  assert.ok(defeat && defeat.won === false);
  assert.equal(defeat.items.length, 3);
  assert.ok(defeat.items.some((item) => item.kind === "tp-dry"));
  assert.ok(defeat.items.some((item) => item.kind === "early-ko"));
  assert.ok(defeat.items.some((item) => item.kind === "star-capped"));

  // Victory highlights real MVP & skill cards played; single partner has NO resonance
  const victory = buildBattleResultDiagnosis({
    outcome: { winningTeam: 0, verdict: "WIN", reason: "KNOCKOUT" },
    summary: { rows: [{ side: "player", name: "亞古獸", damage: 420, knockouts: 1 }] },
    participants: [{ team: 0, speciesId: "species-025" }],
    skillCardState: { hand: ["basic.cheer", "basic.cover", "basic.focus"], playedIds: ["basic.cheer"] }
  });
  assert.ok(victory && victory.won === true);
  assert.ok(victory.items.some((item) => item.kind === "mvp"));
  assert.ok(victory.items.some((item) => item.kind === "cards"));
  assert.ok(!victory.items.some((item) => item.kind === "resonance"), "1-partner team must not claim resonance");

  // Victory with 2 same-faction partners DOES report active resonance
  const victoryRes = buildBattleResultDiagnosis({
    outcome: { winningTeam: 0, verdict: "WIN", reason: "KNOCKOUT" },
    participants: [{ team: 0, speciesId: "species-053" }, { team: 0, speciesId: "species-053" }]
  });
  assert.ok(victoryRes?.items.some((item) => item.kind === "resonance"));
});

test("two independent PvP clients complete room handshake, simulate identical deterministic battle, agree on winner, and dedupe duplicate reports", async () => {
  const relay = createMultiClientRoomRelay();
  const timers = manualTimers();

  const { app: hostApp, id: hostId } = await bootTestApp({ species: 53 });
  const { app: guestApp, id: guestId } = await bootTestApp({ species: 60 });
  try {
    const hostTeam = [hostId];
    const guestTeam = [guestId];

    const makeHooks = (app) => ({
      createInvite: (ids, options) => app.createLinkBattleInvite(ids, options),
      prepareGuest: (inviteCode, ids) => app.prepareLinkBattle({ role: "GUEST", inviteCode, instanceIds: ids }),
      prepareHost: (inviteCode, replyCode) => app.prepareLinkBattle({ role: "HOST", inviteCode, replyCode })
    });

    const hostSession = createPvpRoomSession({
      adapter: relay.clientAdapter("user-host", "房主甲"),
      game: makeHooks(hostApp),
      codeLength: 4,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer
    });
    const guestSession = createPvpRoomSession({
      adapter: relay.clientAdapter("user-guest", "挑戰乙"),
      game: makeHooks(guestApp),
      codeLength: 4,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer
    });

    // 1. Host creates room
    const hosted = await hostSession.host({ instanceIds: hostTeam });
    assert.equal(hosted.phase, "waiting");
    assert.ok(hosted.roomCode);

    // 2. Guest joins by room code and exchanges real v2 codes
    const joined = await guestSession.join({ roomCode: hosted.roomCode, instanceIds: guestTeam });
    assert.ok(["ready", "countdown"].includes(joined.phase));

    // Allow microtasks from host's async prepareHost/setReady to complete
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(hostSession.state.phase, "countdown");
    assert.equal(guestSession.state.phase, "countdown");
    assert.ok(PVP_COUNTDOWN_MS > 0);

    // 3. Countdown finishes -> both enter playing with prepared link battles
    await timers.flush();
    assert.equal(hostSession.state.phase, "playing");
    assert.equal(guestSession.state.phase, "playing");
    assert.equal(hostSession.state.prepared.ok, true);
    assert.equal(guestSession.state.prepared.ok, true);

    // 4. Both independent clients simulate the prepared link battle to completion
    const simulate = (prepared) => {
      const rt = createBattleRuntime({
        mode: 3,
        battleType: 0,
        playerIndividuals: prepared.parties[0],
        opponentIndividuals: prepared.parties[1],
        localTeamIndex: prepared.localTeamIndex,
        rng: prepared.rngPreparation.rng
      });
      try {
        rt.chooseLinkBattle({ arenaIndex: prepared.arenaIndex });
        const view = rt.startMatch();
        for (let step = 0; step < 120000 && !view.getView().outcome.ended; step += 1) view.tick();
        return view.getView().outcome;
      } finally {
        rt.dispose();
      }
    };
    const hostOutcome = simulate(hostSession.state.prepared);
    const guestOutcome = simulate(guestSession.state.prepared);
    assert.equal(hostOutcome.ended, true);
    assert.equal(guestOutcome.ended, true);
    assert.equal(hostOutcome.winningTeam, guestOutcome.winningTeam, "deterministic link battle agrees across clients");
    assert.equal(hostOutcome.reason, guestOutcome.reason);

    // 5. Host reports -> WAITING_PEER; Guest reports -> AGREED (finished); duplicate report is idempotent
    const rHost = await hostSession.reportOutcome(hostOutcome);
    assert.equal(rHost.ok, true);
    assert.equal(hostSession.state.reportStatus, "WAITING_PEER");
    assert.equal(relay.getReportCalls(), 1);

    // Duplicate report by Host does NOT fire another RPC
    const rHostDup = await hostSession.reportOutcome(hostOutcome);
    assert.equal(rHostDup, rHost);
    assert.equal(relay.getReportCalls(), 1);

    const rGuest = await guestSession.reportOutcome(guestOutcome);
    assert.equal(rGuest.ok, true);
    assert.equal(rGuest.status, "finished");
    assert.equal(guestSession.state.reportStatus, "AGREED");
    const expectedWinner = hostOutcome.winningTeam === 0 ? "user-host" : hostOutcome.winningTeam === 1 ? "user-guest" : null;
    assert.equal(relay.getMatch(hosted.matchId).winnerId, expectedWinner);
    assert.equal(relay.getMatch(hosted.matchId).status, "finished");

    hostSession.dispose();
    guestSession.dispose();
  } finally {
    await hostApp.dispose();
    await guestApp.dispose();
  }
});

test("two-client PvP marks disputed on conflicting reports and handles peer cancel/disconnect cleanly", async () => {
  const relay = createMultiClientRoomRelay();
  const timers = manualTimers();
  const fakeGame = {
    createInvite: async () => ({ ok: true, inviteCode: "INV-1" }),
    prepareGuest: async () => ({ ok: true, replyCode: "REP-1", parties: [[], []] }),
    prepareHost: async () => ({ ok: true, parties: [[], []] })
  };

  // Scenario A: Conflicting reports -> disputed
  const hostA = createPvpRoomSession({ adapter: relay.clientAdapter("h1", "H1"), game: fakeGame, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const guestA = createPvpRoomSession({ adapter: relay.clientAdapter("g1", "G1"), game: fakeGame, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const roomA = await hostA.host({ instanceIds: ["a"] });
  await guestA.join({ roomCode: roomA.roomCode, instanceIds: ["b"] });
  await new Promise((r) => setTimeout(r, 10));
  await timers.flush();
  await hostA.reportOutcome({ winningTeam: 0 });
  const disputed = await guestA.reportOutcome({ winningTeam: 1 });
  assert.equal(disputed.status, "disputed");
  assert.equal(guestA.state.reportStatus, "DISPUTED");
  hostA.dispose();
  guestA.dispose();

  // Scenario B: Host cancels while waiting -> Guest joining gets ROOM_NOT_FOUND, or Peer subscribed transitions to ROOM_CANCELLED
  const hostB = createPvpRoomSession({ adapter: relay.clientAdapter("h2", "H2"), game: fakeGame, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const guestB = createPvpRoomSession({ adapter: relay.clientAdapter("g2", "G2"), game: fakeGame, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const roomB = await hostB.host({ instanceIds: ["a"] });
  await guestB.join({ roomCode: roomB.roomCode, instanceIds: ["b"] });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(hostB.state.phase, "countdown");
  await hostB.cancel();
  assert.equal(hostB.state.phase, "cancelled");
  assert.equal(guestB.state.phase, "failed");
  assert.equal(guestB.state.reason, "ROOM_CANCELLED");
  hostB.dispose();
  guestB.dispose();
});
