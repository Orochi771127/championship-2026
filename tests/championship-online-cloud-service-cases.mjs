// Online (Owner 2026-10-28): the cloud service facade, its local simulation,
// the Supabase adapter against a fake client, the room session, the config
// guard, the save envelope and the online session port. No network, no DOM.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { resolveOnlineServiceConfig, refuseOnlineKeyReason, refuseOnlineUrlReason } from "../src/championship/online/onlineServiceConfig.js";
import { createLocalSimulationAdapter } from "../src/championship/online/localSimulationMode.js";
import { createSupabaseAdapter } from "../src/championship/online/supabaseMode.js";
import { createChampionshipCloudService } from "../src/championship/online/championshipCloudService.js";
import { createPvpRoomSession, PVP_COUNTDOWN_MS } from "../src/championship/online/pvpRoomSession.js";
import { buildCloudSaveEnvelope, sha256Hex, summarizeSaveText, confirmsSync } from "../src/championship/online/cloudSaveEnvelope.js";
import { createChampionshipOnlineSessionPort, createChampionshipPersistentSavePort, CHAMPIONSHIP_ONLINE_SESSION_KEY } from "../src/championship/app/ChampionshipPersistentSavePort.js";
import { CHAMPIONSHIP_ONLINE_SESSION_STORAGE_KEY, isForbiddenChampionshipStorageKey } from "../src/championship/app/championshipStorageGuard.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { ONLINE_COPY } from "../src/championship/text/onlineText.js";
import { TOOLBAR_PRODUCT_ENTRIES, TOOLBAR_MENU_GROUPS } from "../src/championship/app/championshipToolbar.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${b64({ role })}.sig`;
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const noWin = { addEventListener() {}, removeEventListener() {} };
function memoryStorage() { const data = new Map(); const touched = new Set(); return { getItem: k => { touched.add(k); return data.has(k) ? data.get(k) : null; }, setItem: (k, v) => { touched.add(k); data.set(k, String(v)); }, removeItem: k => { touched.add(k); data.delete(k); }, keys: () => [...data.keys()], touched: () => [...touched].sort() }; }
function fakeTimers() { let now = 0; const q = []; return { setTimer(fn, ms) { const e = { at: now + ms, fn, id: q.length + 1 }; q.push(e); return e.id; }, clearTimer(id) { const i = q.findIndex(e => e.id === id); if (i >= 0) q.splice(i, 1); }, setInterval() { return 0; }, clearInterval() {}, async tick(ms) { const until = now + ms; for (;;) { q.sort((a, b) => a.at - b.at); const n = q[0]; if (!n || n.at > until) break; now = n.at; q.shift(); await n.fn(); await Promise.resolve(); } now = until; await Promise.resolve(); await Promise.resolve(); } }; }

// ---- config guard -----------------------------------------------------------
test("the config stays offline until a Supabase URL and a browser-safe key are both present; secret keys are refused", () => {
  const file = { schemaVersion: 1, supabaseUrl: "", supabaseAnonKey: "" };
  assert.equal(resolveOnlineServiceConfig({ file, runtime: null }).configured, false);
  assert.equal(resolveOnlineServiceConfig({ file: { ...file, supabaseUrl: PROJECT, supabaseAnonKey: "sb_publishable_abc" }, runtime: null }).configured, true);
  assert.equal(resolveOnlineServiceConfig({ file: { ...file, supabaseUrl: PROJECT, supabaseAnonKey: jwt("anon") }, runtime: null }).configured, true);
  assert.equal(resolveOnlineServiceConfig({ file: { ...file, supabaseUrl: PROJECT, supabaseAnonKey: "sb_secret_abc" }, runtime: null }).reason, "SECRET_KEY_FORBIDDEN");
  assert.equal(resolveOnlineServiceConfig({ file: { ...file, supabaseUrl: PROJECT, supabaseAnonKey: jwt("service_role") }, runtime: null }).reason, "SERVICE_ROLE_FORBIDDEN");
  assert.equal(resolveOnlineServiceConfig({ file: { ...file, supabaseUrl: "https://evil.example.com", supabaseAnonKey: "sb_publishable_abc" }, runtime: null }).reason, "URL_NOT_SUPABASE");
  const runtime = resolveOnlineServiceConfig({ file, runtime: { url: PROJECT + "/", anonKey: "sb_publishable_x", roomCodeLength: 9 } });
  assert.equal(runtime.configured, true); assert.equal(runtime.url, PROJECT); assert.equal(runtime.roomCodeLength, 6); assert.equal(runtime.source, "runtime");
  assert.equal(refuseOnlineKeyReason(""), "KEY_EMPTY"); assert.equal(refuseOnlineUrlReason("http://x"), "URL_NOT_SUPABASE");
  // The shipped file is empty: offline first.
  const shipped = JSON.parse(fs.readFileSync("src/data/championship/online-service.v1.json", "utf8"));
  assert.equal(shipped.supabaseUrl, ""); assert.equal(shipped.supabaseAnonKey, "");
});

// ---- envelope ----------------------------------------------------------------
test("the cloud envelope hashes the exact save text and only a server echo confirms a sync", async () => {
  const text = JSON.stringify({ schemaVersion: 5, progression: { revision: 42, nativeOpening: { trainerName: "小光" } }, shop: { bits: 1200 }, creature: { instances: [{}, {}] }, updatedAt: "2026-10-28T00:00:00.000Z" });
  const envelope = await buildCloudSaveEnvelope(text, { deviceLabel: "test" });
  assert.equal(envelope.contentSha256, await sha256Hex(text)); assert.match(envelope.contentSha256, /^[0-9a-f]{64}$/);
  assert.equal(envelope.gameRevision, 42); assert.equal(envelope.summary.trainerName, "小光"); assert.equal(envelope.summary.roster, 2);
  assert.equal(confirmsSync({ ok: true, serverRevision: 1, contentSha256: envelope.contentSha256 }, envelope), true);
  assert.equal(confirmsSync({ ok: true, serverRevision: 1, contentSha256: "0".repeat(64) }, envelope), false);
  assert.equal(summarizeSaveText("not json").valid, false);
  await assert.rejects(() => buildCloudSaveEnvelope("x".repeat(300000)), /TOO_LARGE/);
});

// ---- local simulation --------------------------------------------------------
test("the local simulation answers every panel in memory: identity, friends, defense mirror, rooms, backup and transfer", async () => {
  const timers = fakeTimers();
  const sim = createLocalSimulationAdapter({ random: () => 0.42, now: () => "2026-10-28T00:00:00.000Z", setTimer: timers.setTimer, clearTimer: timers.clearTimer,
    ownDefenseCode: async () => "CM26-PASSWORD-2.OWN", simulateGuestReply: async invite => invite === "INVITE" ? "REPLY" : null });
  const identity = await sim.ensureIdentity({ preferredCode: "TM-AAAA-BBBB", tamerName: "T" });
  assert.equal(identity.tamerCode, "TM-AAAA-BBBB"); assert.equal(identity.isAnonymous, true); assert.equal(identity.simulated, true);
  const friends = await sim.listFriends(); assert.equal(friends[0].status, "pending"); assert.equal(friends[0].direction, "incoming");
  assert.equal((await sim.respondFriendRequest(friends[0].friendshipId, true)).status, "accepted");
  const rivals = await sim.listRivals(); const added = await sim.sendFriendRequest(rivals[1].tamerCode); assert.equal(added.ok, true);
  await timers.tick(2000); assert.equal((await sim.listFriends()).find(f => f.friendshipId === added.friendshipId).status, "accepted");
  assert.equal((await sim.sendFriendRequest("TM-ZZZZ-ZZZZ")).reason, "TAMER_NOT_FOUND");
  const defense = await sim.getFriendDefenseTeam(rivals[0].userId); assert.equal(defense.defenseTeam.passwordCode, "CM26-PASSWORD-2.OWN"); assert.equal(defense.defenseTeam.mirrored, true);
  assert.equal((await sim.pickLadderOpponents(2)).length, 2);
  const room = await sim.createRoom("INVITE", 4); assert.match(room.roomCode, /^[0-9]{4}$/);
  const seen = []; sim.subscribeMatch(room.matchId, m => seen.push(m.status));
  await timers.tick(2000);
  assert.deepEqual(seen, ["joined", "ready"]); assert.equal((await sim.getMatch(room.matchId)).replyCode, "REPLY");
  assert.equal((await sim.setReady(room.matchId)).status, "playing");
  assert.equal((await sim.reportResult(room.matchId, { winnerId: identity.userId })).status, "finished");
  assert.equal((await sim.joinRoom("0000")).ok, false);
  const envelope = await buildCloudSaveEnvelope(JSON.stringify({ schemaVersion: 5, progression: { revision: 1 } }), { deviceLabel: "t" });
  const up = await sim.uploadSave(envelope, null); assert.equal(up.serverRevision, 1);
  assert.equal((await sim.uploadSave(envelope, 0)).reason, "CONFLICT");
  assert.equal((await sim.uploadSave(envelope, null)).reason, "CONFLICT", "an unknown baseline never overwrites an existing cloud copy");
  assert.equal((await sim.uploadSave(envelope, null, { force: true })).serverRevision, 2, "only an explicit force replaces it");
  const code = await sim.createTransferCode(); assert.equal(code.ok, true);
  assert.equal((await sim.redeemTransferCode(code.transferCode.toLowerCase())).payload, envelope.payload);
  assert.equal((await sim.redeemTransferCode(code.transferCode)).reason, "TRANSFER_CODE_INVALID");
});

// ---- Supabase adapter against a fake client ----------------------------------
function fakeLibrary(log) {
  let session = null;
  const rpcAnswers = { ensure_tamer_profile: args => ({ userId: "u1", tamerCode: args.p_preferred_code ?? "TM-SERV-0001", tamerName: args.p_tamer_name, rankTitle: "", acePartner: {}, isAnonymous: true, hasDefenseTeam: false }),
    upload_cloud_save: args => args.p_expected_revision === 7 ? { ok: false, reason: "CONFLICT", serverRevision: 9 } : { ok: true, serverRevision: (args.p_expected_revision ?? 0) + 1, contentSha256: args.p_content_sha256, updatedAt: "2026-10-28T00:00:00.000Z" },
    list_friend_cards: () => [{ friendshipId: "f1", status: "accepted", tamerCode: "TM-FRND-0001" }], create_pvp_room: args => ({ ok: true, matchId: "m1", roomCode: "1234", seed: 5, status: "open" }),
    join_pvp_room: () => ({ ok: true, matchId: "m1", roomCode: "1234", inviteCode: "INV", seed: 5 }), submit_pvp_reply: () => ({ ok: true, status: "ready" }), set_pvp_ready: () => ({ ok: true, status: "playing" }),
    get_pvp_match: () => ({ matchId: "m1", status: "playing", replyCode: "REP", hostReady: true, guestReady: true }), delete_my_online_data: () => ({ ok: true }) };
  return { createClient(url, key, options) {
    log.push(["createClient", url, key, options.auth.storageKey, options.auth.persistSession, options.auth.flowType]);
    return {
      auth: { async getSession() { return { data: { session } }; }, async signInAnonymously() { session = { user: { id: "u1", is_anonymous: true, identities: [{ provider: "anonymous" }] } }; log.push(["anon"]); return { data: session, error: null }; },
        async updateUser(attrs) { log.push(["updateUser", attrs]); return { error: null }; }, async verifyOtp(args) { log.push(["verifyOtp", args.type]); session = { user: { id: "u1", email: args.email, is_anonymous: false, identities: [{ provider: "email" }] } }; return { data: session, error: null }; },
        async linkIdentity(args) { log.push(["link", args.provider]); return { error: null }; }, async signInWithOtp() { return { error: null }; }, async signOut() { session = null; return { error: null }; } },
      async rpc(name, args) { log.push(["rpc", name]); const answer = rpcAnswers[name]; return answer ? { data: answer(args ?? {}), error: null } : { data: null, error: { code: "PGRST202", message: "missing" } }; },
      channel() { const ch = { on() { return ch; }, subscribe() { return ch; }, async httpSend() {} }; return ch; }, removeChannel() {}, realtime: { async setAuth() {} }
    };
  } };
}

test("the Supabase adapter signs in anonymously once, keeps the uid through email binding, and maps RPC answers", async () => {
  const log = [], storage = memoryStorage();
  const port = createChampionshipOnlineSessionPort({ storage });
  const adapter = createSupabaseAdapter({ library: fakeLibrary(log), url: PROJECT, anonKey: "sb_publishable_x", sessionStorage: port, win: noWin, setIntervalFn: () => 0, clearIntervalFn() {} });
  assert.deepEqual(log[0], ["createClient", PROJECT, "sb_publishable_x", "championship-online", true, "pkce"]);
  const identity = await adapter.ensureIdentity({ preferredCode: "TM-AAAA-BBBB", tamerName: "T" });
  assert.equal(identity.userId, "u1"); assert.equal(identity.tamerCode, "TM-AAAA-BBBB"); assert.equal(identity.isAnonymous, true);
  await adapter.ensureIdentity({}); assert.equal(log.filter(e => e[0] === "anon").length, 1, "a second ensure reuses the session");
  assert.equal((await adapter.bindEmail("a@b.c")).step, "OTP_SENT");
  const bound = await adapter.verifyEmailOtp("a@b.c", "123456"); assert.equal(bound.identity.email, "a@b.c"); assert.equal(bound.identity.isAnonymous, false); assert.equal(bound.identity.userId, "u1");
  assert.ok(log.some(e => e[0] === "verifyOtp" && e[1] === "email_change"));
  assert.equal((await adapter.bindGoogle({ redirectTo: "x" })).redirect, true);
  assert.equal((await adapter.uploadSave({ payload: "p", contentSha256: "a".repeat(64), gameRevision: 1, summary: {}, deviceLabel: "d" }, 7)).reason, "CONFLICT");
  assert.deepEqual((await adapter.listFriends()).map(f => f.tamerCode), ["TM-FRND-0001"]);
  assert.equal(await adapter.findTamer("x"), null, "a missing RPC answers null, never a card");
  assert.equal((await adapter.createRoom("INV", 4)).roomCode, "1234");
});

test("the online session port keeps the auth session under one product key and never another", () => {
  assert.equal(CHAMPIONSHIP_ONLINE_SESSION_KEY, CHAMPIONSHIP_ONLINE_SESSION_STORAGE_KEY);
  assert.equal(isForbiddenChampionshipStorageKey(CHAMPIONSHIP_ONLINE_SESSION_KEY), false);
  assert.match(CHAMPIONSHIP_ONLINE_SESSION_KEY, /^championshipModernSave:/);
  const storage = memoryStorage(), port = createChampionshipOnlineSessionPort({ storage });
  assert.equal(port.getItem("championship-online"), null);
  port.setItem("championship-online", "{\"access_token\":\"t\"}"); port.setItem("championship-online-code-verifier", "v");
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_ONLINE_SESSION_KEY]);
  assert.equal(port.getItem("championship-online"), "{\"access_token\":\"t\"}");
  port.removeItem("championship-online"); port.removeItem("championship-online-code-verifier");
  assert.deepEqual(storage.keys(), [], "an emptied session removes the key entirely");
  assert.throws(() => createChampionshipOnlineSessionPort({}), TypeError);
});

// ---- facade ------------------------------------------------------------------
test("the facade stays in local simulation offline or unconfigured, and reaches the cloud only when configured and online", async () => {
  const log = [];
  const unconfigured = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: { supabaseUrl: "", supabaseAnonKey: "" }, runtime: null }), win: noWin, nav: { onLine: true }, loadLibrary: async () => { throw new Error("must not load"); } });
  const summary = await unconfigured.getIdentitySummary();
  assert.equal(summary.mode, "LOCAL_SIMULATION"); assert.equal(summary.simulated, true); assert.match(summary.tamerCode, /^TM-/); assert.equal(summary.configured, false);
  const configured = resolveOnlineServiceConfig({ file: { supabaseUrl: PROJECT, supabaseAnonKey: "sb_publishable_x" }, runtime: null });
  const offline = createChampionshipCloudService({ config: configured, win: noWin, nav: { onLine: false }, loadLibrary: async () => { throw new Error("must not load"); } });
  assert.equal((await offline.getIdentitySummary()).mode, "LOCAL_SIMULATION");
  const storage = memoryStorage();
  const cloud = createChampionshipCloudService({ config: configured, win: noWin, nav: { onLine: true }, sessionStorage: createChampionshipOnlineSessionPort({ storage }), loadLibrary: async () => fakeLibrary(log),
    hooks: { preferredCode: () => "TM-PREF-0001", tamerName: () => "T" } });
  const id = await cloud.getIdentitySummary();
  assert.equal(id.mode, "SUPABASE"); assert.equal(id.tamerCode, "TM-PREF-0001"); assert.equal(id.simulated, false);
  const text = JSON.stringify({ schemaVersion: 5, progression: { revision: 3 } });
  const first = await cloud.backupNow(text); assert.equal(first.ok, true); assert.equal(cloud.state.syncState, "SYNCED"); assert.equal(cloud.state.lastSync.serverRevision, 1);
  // A library failure falls back to the simulation instead of breaking the panel.
  const broken = createChampionshipCloudService({ config: configured, win: noWin, nav: { onLine: true }, loadLibrary: async () => { throw new Error("SUPABASE_LOADER_FAILED"); } });
  assert.equal((await broken.getIdentitySummary()).mode, "LOCAL_SIMULATION"); assert.equal(broken.state.libraryError, "SUPABASE_LOADER_FAILED");
});

test("an offline app cycle with the service created touches only the save key", async () => {
  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-08-28T12:00:00.000Z" });
  await app.newGame(); app.save();
  const service = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: { supabaseUrl: "", supabaseAnonKey: "" }, runtime: null }), win: noWin, nav: { onLine: true },
    sessionStorage: createChampionshipOnlineSessionPort({ storage }) });
  await service.getIdentitySummary(); await service.listFriends(); await service.backupNow(app.persistenceFacade().exportRecovery().text);
  await app.dispose();
  assert.deepEqual(storage.touched(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  const port = createChampionshipPersistentSavePort({ storage: memoryStorage() });
  assert.equal(port.adoptExternalText("nope").ok, false);
});

// ---- room session ------------------------------------------------------------
test("a room carries the invite and reply codes and hands both sides a prepared link battle after the countdown", async () => {
  const timers = fakeTimers();
  const sim = createLocalSimulationAdapter({ random: () => 0.5, setTimer: timers.setTimer, clearTimer: timers.clearTimer, simulateGuestReply: async invite => `REPLY:${invite}` });
  await sim.ensureIdentity({});
  const game = { createInvite: async ids => ({ ok: true, inviteCode: `INV:${ids.join(",")}` }), prepareGuest: async (invite, ids) => ({ ok: true, replyCode: `REPLY:${invite}`, parties: [[], []], localTeamIndex: 1 }), prepareHost: async (invite, reply) => ({ ok: true, parties: [[], []], localTeamIndex: 0, invite, reply }) };
  const session = createPvpRoomSession({ adapter: sim, game, codeLength: 4, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const phases = []; session.subscribe(state => phases.push(state.phase));
  await session.host({ instanceIds: ["a", "b"] });
  assert.equal(session.state.phase, "waiting"); assert.match(session.state.roomCode, /^[0-9]{4}$/);
  await timers.tick(1600); await timers.tick(0);
  assert.equal(session.state.phase, "countdown"); assert.equal(session.state.prepared.reply, "REPLY:INV:a,b");
  await timers.tick(PVP_COUNTDOWN_MS);
  assert.equal(session.state.phase, "playing"); assert.deepEqual(phases, ["idle", "creating", "waiting", "joined", "ready", "countdown", "playing"]);
  const failed = createPvpRoomSession({ adapter: sim, game: { ...game, createInvite: async () => ({ ok: false, reason: "NO_TEAM" }) }, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  assert.equal((await failed.host({ instanceIds: [] })).reason, "NO_TEAM");
  session.dispose(); failed.dispose();
});

test("online copy is complete in five locales and the System menu lists friends and account", () => {
  const keys = Object.keys(ONLINE_COPY["zh-Hant"]);
  for (const locale of ["en", "ja", "th", "vi"]) assert.deepEqual(Object.keys(ONLINE_COPY[locale]).sort(), [...keys].sort(), locale);
  for (const id of ["friends", "account"]) assert.ok(TOOLBAR_PRODUCT_ENTRIES.SYSTEM.some(e => e.id === id && e.action), id);
  assert.ok(TOOLBAR_MENU_GROUPS.SYSTEM.some(group => group.entries.includes("friends") && group.entries.includes("account")));
});

test("a first backup on a device that has never synced stops at the conflict chooser instead of overwriting", async () => {
  const sim = createLocalSimulationAdapter({ random: () => 0.5 });
  const configured = resolveOnlineServiceConfig({ file: { supabaseUrl: PROJECT, supabaseAnonKey: "sb_publishable_x" }, runtime: null });
  const older = JSON.stringify({ schemaVersion: 5, progression: { revision: 2 } }), newer = JSON.stringify({ schemaVersion: 5, progression: { revision: 90 } });
  const make = () => createChampionshipCloudService({ config: configured, win: noWin, nav: { onLine: true }, createLocal: () => sim, loadLibrary: async () => { throw new Error("offline"); } });
  const phone = make(); assert.equal((await phone.backupNow(newer)).ok, true);
  const laptop = make(); // reload / other device: no lastSync baseline
  const blocked = await laptop.backupNow(older);
  assert.equal(blocked.reason, "CONFLICT"); assert.equal(laptop.state.syncState, "CHOICE");
  assert.equal((await sim.downloadSave()).payload, newer, "the newer cloud save is still there");
  const same = await make().backupNow(newer); assert.equal(same.ok, true, "identical content adopts the cloud revision");
  assert.equal((await laptop.backupNow(older, { force: true })).ok, true); assert.equal((await sim.downloadSave()).payload, older);
});

test("a simulated identity is replaced by a cloud identity when connectivity returns", async () => {
  const log = [], handlers = {};
  const win = { addEventListener(type, fn) { handlers[type] = fn; }, removeEventListener() {} }, nav = { onLine: false };
  const configured = resolveOnlineServiceConfig({ file: { supabaseUrl: PROJECT, supabaseAnonKey: "sb_publishable_x" }, runtime: null });
  const service = createChampionshipCloudService({ config: configured, win, nav, sessionStorage: createChampionshipOnlineSessionPort({ storage: memoryStorage() }), loadLibrary: async () => fakeLibrary(log) });
  const offline = await service.getIdentitySummary();
  assert.equal(offline.simulated, true); assert.equal(offline.mode, "LOCAL_SIMULATION");
  nav.onLine = true; handlers.online();
  const online = await service.getIdentitySummary();
  assert.equal(online.mode, "SUPABASE"); assert.equal(online.simulated, false); assert.ok(log.some(e => e[0] === "anon"), "the cloud session was established");
  assert.equal((await service.backupNow(JSON.stringify({ schemaVersion: 5, progression: { revision: 1 } }))).ok, true);
});

test("an imported save must pass Continue's complete validation before it replaces the stored save", async () => {
  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-08-28T12:00:00.000Z" });
  await app.newGame(); app.save();
  const text = app.persistenceFacade().exportRecovery().text;
  const broken = JSON.parse(text), inner = JSON.parse(broken.raisingHome);
  inner.payload.residents = [];
  broken.raisingHome = JSON.stringify(inner);
  const before = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  const refused = app.adoptExternalSaveText(JSON.stringify(broken));
  assert.equal(refused.ok, false); assert.match(refused.reason, /SAVE_NOT_LOADABLE|SAVE_TEXT_INVALID/);
  assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), before, "a refused import leaves the stored save untouched");
  assert.equal(app.adoptExternalSaveText("not json").ok, false);
  assert.equal(app.adoptExternalSaveText(text).ok, true);
  await app.dispose();
});
