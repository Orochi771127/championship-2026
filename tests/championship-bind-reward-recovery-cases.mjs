// First-bind gift recovery (docs/reports/system-sweep-2026-11-08/, S4; Owner 2026-11-08).
// The cloud ledger records the claim first and the save is paid afterwards. If the
// page closed in between, or the local write was refused or failed, the account
// read "claimed" while the save had no Bits, and nothing ever asked again.
// The ledger's save reference is the same for every save (the app's session id is
// a constant), so the ledger repeats its answer for any save of the account: a
// recovery keyed only on "linked and unpaid" would pay every new game again. The
// recovery is therefore keyed on this device's pending marker, written just before
// the claim and settled once the open save holds the gift. No network, no DOM.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { resolveOnlineServiceConfig } from "../src/championship/online/onlineServiceConfig.js";
import { createChampionshipCloudService, BIND_REWARD_PENDING_ENTRY } from "../src/championship/online/championshipCloudService.js";
import { sha256Hex } from "../src/championship/online/cloudSaveEnvelope.js";
import { createChampionshipOnlineSessionPort } from "../src/championship/app/ChampionshipPersistentSavePort.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY, deserializeChampionshipModernSave } from "../src/championship/app/championshipStandaloneSave.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { ONLINE_BIND_REWARD_BITS } from "../src/championship/app/onlineBindRewardPolicy.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const CONFIGURED = resolveOnlineServiceConfig({ file: { supabaseUrl: PROJECT, supabaseAnonKey: "sb_publishable_x" }, runtime: null });
const UNCONFIGURED = resolveOnlineServiceConfig({ file: { supabaseUrl: "", supabaseAnonKey: "" }, runtime: null });
const noWin = { addEventListener() {}, removeEventListener() {} };
function memoryStorage({ failWrites = () => false } = {}) {
  const data = new Map();
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => { if (failWrites(k)) throw new Error("QuotaExceededError"); data.set(k, String(v)); },
    removeItem: k => data.delete(k) };
}

// The claim_bind_reward ledger (supabase/migrations/001_championship_online.sql): one row per
// account, the same answer again for the same save reference, a refusal for any other one.
function fakeLedger() {
  const rows = new Map(); let requests = 0;
  return {
    rows, get requests() { return requests; },
    claim(userId, saveRef) {
      requests++;
      if (!/^[0-9a-f]{64}$/.test(saveRef ?? "")) return { ok: false, reason: "SAVE_REF_REQUIRED" };
      const row = rows.get(userId);
      if (!row) { rows.set(userId, { saveRef, provider: "google", rewardBits: 5000 }); return { ok: true, repeat: false, rewardBits: 5000, provider: "google" }; }
      if (row.saveRef === saveRef) return { ok: true, repeat: true, rewardBits: row.rewardBits, provider: row.provider };
      return { ok: false, reason: "BIND_REWARD_ALREADY_CLAIMED" };
    }
  };
}
// One device: the browser storage outlives the page, so the online session map does too.
function device() { const storage = memoryStorage(); return { storage, sessionPort: createChampionshipOnlineSessionPort({ storage }) }; }
// A page's cloud service on that device. `live` is the account the stored session belongs to.
function pageCloud(dev, { ledger, live, config = CONFIGURED, online = true }) {
  const log = [];
  const service = createChampionshipCloudService({ config, win: noWin, nav: { onLine: online }, sessionStorage: dev.sessionPort,
    loadLibrary: async () => { log.push("loadLibrary"); return {}; },
    createSupabase: () => Object.freeze({
      mode: "SUPABASE",
      async currentIdentity() { log.push("currentIdentity"); return live ? { userId: live.id, isAnonymous: live.anonymous } : null; },
      async ensureIdentity() { log.push("ensureIdentity"); return { userId: live.id, isAnonymous: live.anonymous, providers: ["google"], simulated: false }; },
      async claimBindReward(saveRef) { log.push("claim"); if (live.offlineAfterCommit) { ledger.claim(live.id, saveRef); throw new Error("network lost after commit"); } return ledger.claim(live.id, saveRef); }
    }) });
  return { service, log };
}
const pending = dev => dev.sessionPort.getItem(BIND_REWARD_PENDING_ENTRY);
const LINKED = { id: "u-1", anonymous: false };
async function newSave(storage) {
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-11-08T12:00:00.000Z", locks: null });
  await app.newGame(); app.save();
  return app;
}
async function reopen(storage) {
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-11-08T13:00:00.000Z", locks: null });
  assert.ok(await app.continueGame());
  return app;
}
const storedSave = storage => deserializeChampionshipModernSave(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
// main.js runBindReward / recoverBindReward: pay what the ledger answered, then settle when the save holds it.
function payAndSettle(app, service, out) {
  if (!out?.ok || out.preview) return null;
  const paid = app.claimOnlineBindReward({ provider: out.provider, rewardBits: out.rewardBits });
  if (paid?.ok || paid?.reason === "BIND_REWARD_ALREADY_CLAIMED") service.settleBindReward();
  return paid;
}
const refOf = async app => sha256Hex(app.getSaveReference());

test("without this device's pending claim nothing is asked: no library, no sign-in, no request", async () => {
  const ledger = fakeLedger(), ref = "a".repeat(64);
  for (const options of [{ config: UNCONFIGURED }, { online: false }, {}]) {
    const { service, log } = pageCloud(device(), { ledger, live: LINKED, ...options });
    const out = await service.recoverBindReward({ saveRef: ref });
    assert.equal(out.ok, false); assert.match(out.reason, /^(CLOUD_NOT_CONFIGURED|NOTHING_PENDING)$/);
    assert.deepEqual(log, []);
  }
  assert.equal(ledger.requests, 0);
});

test("the save reference is shared by every save, so a recovery keyed on 'linked and unpaid' would pay each new game", async () => {
  const a = await newSave(memoryStorage()), b = await newSave(memoryStorage());
  assert.equal(await refOf(a), await refOf(b), "the app's session id is the constant STANDALONE_SESSION_ID");
  const ledger = fakeLedger();
  assert.equal(ledger.claim("u-1", await refOf(a)).ok, true);
  assert.equal(ledger.claim("u-1", await refOf(b)).repeat, true, "the ledger cannot tell the two saves apart");
  await a.dispose(); await b.dispose();
});

test("a claim the page never paid is paid once on the next Continue, and a later new game is not paid again", async () => {
  const ledger = fakeLedger(), dev = device();
  const first = await newSave(dev.storage);
  const before = first.getShopFrame().bits;
  // The OAuth return sent the claim; the network dropped after the ledger committed and the page closed.
  const sent = pageCloud(dev, { ledger, live: { ...LINKED, offlineAfterCommit: true } });
  await assert.rejects(sent.service.claimBindReward({ saveRef: await refOf(first) }), /network lost/);
  assert.equal(ledger.rows.size, 1, "the ledger holds the claim");
  assert.ok(pending(dev), "this device remembers the unpaid claim");
  await first.dispose();
  assert.equal(storedSave(dev.storage).flags.onlineBindReward, undefined, "the save was never paid");

  const second = await reopen(dev.storage);
  const page = pageCloud(dev, { ledger, live: LINKED });
  const out = await page.service.recoverBindReward({ saveRef: await refOf(second) });
  assert.equal(out.ok, true); assert.equal(out.repeat, true);
  const paid = payAndSettle(second, page.service, out);
  assert.equal(paid.ok, true, paid.reason); assert.equal(paid.credited, Math.min(ONLINE_BIND_REWARD_BITS, second.getShopFrame().bitsCap - before));
  assert.equal(storedSave(dev.storage).shop.bits, before + paid.credited);
  assert.equal(pending(dev), null, "settled");
  assert.deepEqual(page.log, ["loadLibrary", "currentIdentity", "claim"], "recovery never signs anyone in");
  await second.dispose();

  // A new game overwrites the device's one save slot. Nothing is pending, so nothing is asked or paid.
  const fresh = await newSave(dev.storage);
  const freshBits = fresh.getShopFrame().bits, requests = ledger.requests;
  const later = pageCloud(dev, { ledger, live: LINKED });
  assert.equal((await later.service.recoverBindReward({ saveRef: await refOf(fresh) })).reason, "NOTHING_PENDING");
  assert.equal(ledger.requests, requests); assert.equal(fresh.getShopFrame().bits, freshBits); assert.equal(fresh.getOnlineBindReward(), null);
  await fresh.dispose();
});

test("a refused or failed local write keeps the claim pending, and the next page pays it", async () => {
  const ledger = fakeLedger();
  let failing = false;
  const storage = memoryStorage({ failWrites: key => failing && key === CHAMPIONSHIP_MODERN_SAVE_KEY });
  const sessionPort = createChampionshipOnlineSessionPort({ storage: memoryStorage() });
  const failingDev = { storage, sessionPort };
  const app = await newSave(storage);
  const before = app.getShopFrame().bits;
  const page = pageCloud(failingDev, { ledger, live: LINKED });
  const granted = await page.service.claimBindReward({ saveRef: await refOf(app) });
  assert.equal(granted.ok, true); assert.equal(granted.repeat, false);
  failing = true;
  const failed = payAndSettle(app, page.service, granted);
  assert.equal(failed.ok, false); assert.equal(failed.reason, "SAVE_FAILED");
  assert.equal(app.getShopFrame().bits, before, "a failed write changes neither the wallet nor the marker");
  assert.ok(pending(failingDev), "still owed");
  failing = false;
  const next = pageCloud(failingDev, { ledger, live: LINKED });
  const again = await next.service.recoverBindReward({ saveRef: await refOf(app) });
  const paid = payAndSettle(app, next.service, again);
  assert.equal(paid.ok, true, paid.reason);
  assert.equal(storedSave(storage).shop.bits, before + paid.credited);
  assert.equal(pending(failingDev), null);
  await app.dispose();
});

test("a final refusal or another account clears the pending claim; a simulation never writes one", async () => {
  const ledger = fakeLedger(), dev = device(), ref = "b".repeat(64);
  ledger.rows.set("u-1", { saveRef: "c".repeat(64), provider: "google", rewardBits: 5000 });
  const page = pageCloud(dev, { ledger, live: LINKED });
  assert.equal((await page.service.claimBindReward({ saveRef: ref })).reason, "BIND_REWARD_ALREADY_CLAIMED");
  assert.equal(pending(dev), null, "the ledger refused for good");

  dev.sessionPort.setItem(BIND_REWARD_PENDING_ENTRY, JSON.stringify({ version: 1, userId: "u-1" }));
  const other = pageCloud(dev, { ledger, live: { id: "u-2", anonymous: false } });
  assert.equal((await other.service.recoverBindReward({ saveRef: ref })).reason, "ACCOUNT_CHANGED");
  assert.equal(pending(dev), null);
  assert.ok(!other.log.includes("claim"), "another account's claim is never sent");

  const simDev = device();
  const sim = createChampionshipCloudService({ config: UNCONFIGURED, win: noWin, nav: { onLine: true }, sessionStorage: simDev.sessionPort });
  await sim.claimBindReward({ saveRef: ref });
  assert.equal(pending(simDev), null, "a preview pays nothing and owes nothing");
});

test("main.js asks once per page after the session opens, and settles when the save holds the gift", () => {
  const source = fs.readFileSync("src/championship/app/main.js", "utf8");
  const body = source.slice(source.indexOf("async function recoverBindReward()"), source.indexOf("// OAuth return (Owner 2026-10-29)"));
  assert.match(body, /if \(bindRewardRecoveryTried \|\| bindRewardRunning \|\| !onlineConfig\.configured\) return null;/);
  assert.match(body, /if \(app\.getOnlineBindReward\?\.\(\)\) \{ bindRewardRecoveryTried = true; onlineService\(\)\.settleBindReward\(\); return null; \}/);
  assert.match(body, /onlineService\(\)\.recoverBindReward\(\{ saveRef: await sha256Hex\(sessionId\) \}\)/);
  assert.equal(source.match(/if \(paid\?\.ok \|\| paid\?\.reason === 'BIND_REWARD_ALREADY_CLAIMED'\) onlineService\(\)\.settleBindReward\(\);/g)?.length, 2, "both payers settle");
  assert.match(source, /if \(returned\) void handleOnlineAuthReturn\(returned\); else void recoverBindReward\(\);/);
  assert.match(source, /else if \(identity && identity\.isAnonymous === false\) await recoverBindReward\(\);/);
});
