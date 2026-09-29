import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { AUTOSAVE_DEFAULTS, createAutosaveScheduler } from "../src/championship/app/autosaveScheduler.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { STATUS_BAR_SAVE_STATES, statusBarSaveKey } from "../src/championship/app/championshipStatusBar.js";

// A manual clock: timers fire only when the test advances time.
function manualClock() {
  let now = 0, next = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimer(fn, ms) { const id = next++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = until;
    },
    pending: () => timers.size
  };
}

function scheduler(clock, { route, save, timing } = {}) {
  return createAutosaveScheduler({ route, save, timing, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
}

test("a burst of important operations writes once, after the burst", () => {
  const clock = manualClock();
  let writes = 0;
  const autosave = scheduler(clock, { save: () => { writes += 1; return { phase: "SAVED" }; } });
  autosave.request("purchase");
  clock.advance(200);
  autosave.request("purchase");
  clock.advance(200);
  autosave.request("purchase");
  assert.equal(writes, 0, "nothing is written while the burst continues");
  assert.deepEqual(autosave.inspect().pending, ["purchase"]);
  clock.advance(AUTOSAVE_DEFAULTS.quietMs);
  assert.equal(writes, 1);
  assert.deepEqual(autosave.inspect().pending, []);
  assert.equal(autosave.inspect().writes, 1);
  assert.equal(autosave.inspect().lastReason, "purchase");
});

test("a steady stream is still written by the maximum wait", () => {
  const clock = manualClock();
  let writes = 0;
  const autosave = scheduler(clock, { save: () => { writes += 1; return { phase: "SAVED" }; } });
  for (let i = 0; i < 10; i += 1) { autosave.request("rename"); clock.advance(500); }
  assert.ok(writes >= 1, "requests every 500 ms cannot postpone the write forever");
  assert.ok(clock.now() - 0 >= AUTOSAVE_DEFAULTS.maxWaitMs);
});

test("an unsafe screen defers the write until it is safe; nothing is lost or doubled", () => {
  const clock = manualClock();
  let safe = false, writes = 0;
  const autosave = scheduler(clock, { route: () => (safe ? () => { writes += 1; return { phase: "SAVED" }; } : null) });
  autosave.request("settlement");
  clock.advance(AUTOSAVE_DEFAULTS.quietMs + AUTOSAVE_DEFAULTS.retryMs * 3);
  assert.equal(writes, 0);
  assert.ok(autosave.inspect().deferred >= 3);
  assert.deepEqual(autosave.inspect().pending, ["settlement"]);
  safe = true;
  clock.advance(AUTOSAVE_DEFAULTS.retryMs);
  assert.equal(writes, 1);
  clock.advance(10000);
  assert.equal(writes, 1, "one write for one pending change");
});

test("a refusal during an open transaction is retried, a storage failure is not looped", () => {
  const clock = manualClock();
  let busy = true, calls = 0;
  const autosave = scheduler(clock, { save: () => { calls += 1; if (busy) throw new Error("CHAMPIONSHIP_SAVE_WHILE_BATTLE_ACTIVE"); return { phase: "SAVED" }; } });
  autosave.request("settlement");
  clock.advance(AUTOSAVE_DEFAULTS.quietMs);
  assert.equal(autosave.inspect().refused, 1);
  assert.equal(autosave.inspect().lastError, "CHAMPIONSHIP_SAVE_WHILE_BATTLE_ACTIVE");
  busy = false;
  clock.advance(AUTOSAVE_DEFAULTS.retryMs);
  assert.equal(autosave.inspect().writes, 1);

  let failing = 0;
  const failed = scheduler(clock, { save: () => { failing += 1; return { phase: "SAVE_FAILED" }; } });
  failed.request("purchase");
  clock.advance(60000);
  assert.equal(failing, 1, "the port's own status and retry carry a failure");
  assert.equal(failed.inspect().failed, 1);
  assert.equal(failed.inspect().lastPhase, "SAVE_FAILED");
  assert.equal(clock.pending(), 0);
});

test("a save made elsewhere settles the request; flush writes at once; dispose stops", () => {
  const clock = manualClock();
  let writes = 0;
  const save = () => { writes += 1; return { phase: "SAVED" }; };
  const autosave = scheduler(clock, { save });
  autosave.request("cage-layout");
  autosave.settled();
  clock.advance(10000);
  assert.equal(writes, 0, "the page-hide or day-change save already wrote it");
  autosave.request("purchase");
  assert.equal(autosave.flush(), "SAVED");
  assert.equal(writes, 1);
  autosave.request("purchase");
  autosave.dispose();
  clock.advance(10000);
  assert.equal(writes, 1);
});

test("the indicator only states what the port reported", () => {
  assert.equal(statusBarSaveKey({ phase: "SAVED", autosavePending: false }), "SAVED");
  assert.equal(statusBarSaveKey({ phase: "DIRTY", autosavePending: true }), "SAVING");
  // Owner 2026-09-16 removed the standing 「有尚未儲存的變更」 line: a session
  // that has only moved on since its last write shows no indicator at all.
  assert.equal(statusBarSaveKey({ phase: "DIRTY", autosavePending: false }), null);
  assert.equal(statusBarSaveKey({ phase: "SAVE_FAILED", autosavePending: true }), "SAVE_FAILED", "a failure is never hidden behind 保存中");
  assert.equal(statusBarSaveKey(null), null);
  assert.equal(statusBarSaveKey({ phase: "UNKNOWN" }), null);
  assert.equal(STATUS_BAR_SAVE_STATES.SAVED.text, "已存到本機");
  assert.equal(STATUS_BAR_SAVE_STATES.SAVING.text, "保存中");
  assert.equal(STATUS_BAR_SAVE_STATES.SAVE_FAILED.text, "保存失敗");
  for (const state of Object.values(STATUS_BAR_SAVE_STATES)) {
    assert.doesNotMatch(`${state.label}${state.text ?? ""}`, /雲端|同步|帳號|cloud|sync/i, "no local state claims a cloud copy");
  }
});

// ---- The source tells the app which operations were kept --------------------
const entities = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(String(key), String(value)); }, removeItem: (key) => { data.delete(key); } };
}

test("a real purchase and a confirmed layout ask for a save; a refused purchase does not", async () => {
  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({ storage, catalog: entities, cages: presentation.cages, now: () => "2026-09-29T10:00:00.000Z", locks: null });
  await app.newGame();
  const reasons = [];
  const source = createGateHuntPresentationSource(app, { onCommitted: (reason) => reasons.push(reason) });
  source.intents.openShop();
  source.intents.buyShopItem(0, 1);
  assert.deepEqual(reasons, [], "no Bits: the refused purchase is not a change to keep");
  app.creditBits(5);
  source.intents.buyShopItem(0, 1);
  assert.deepEqual(reasons, ["purchase"]);

  // The request goes through the one existing save entry, and Continue sees it.
  const autosave = createAutosaveScheduler({ save: () => app.save() });
  autosave.request(reasons.at(-1));
  assert.equal(autosave.flush(), "SAVED");
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(saved.shop.bits, 0, "the written save holds the spent Bits");
  assert.equal(saved.shop.quantities[0], 51, "and the bought feed");
  source.intents.leaveScreen();
  source.intents.openCageEdit();
  source.intents.confirmCageEdit();
  assert.deepEqual(reasons, ["purchase", "cage-layout"]);
  autosave.dispose();
  await app.dispose();

  const reloaded = createChampionshipStandaloneApp({ storage, catalog: entities, cages: presentation.cages, now: () => "2026-09-29T10:05:00.000Z", locks: null });
  assert.ok(await reloaded.continueGame());
  reloaded.openShop();
  assert.equal(reloaded.getShopFrame().bits, 0);
  assert.equal(reloaded.getShopFrame().listings[0].owned, 51, "the autosaved purchase survived a reload");
  await reloaded.dispose();
});
