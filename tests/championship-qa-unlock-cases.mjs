import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { applyQaUnlock, qaUnlockPlan, qaUnlockRequested, QA_UNLOCK_PARAMETER, QA_UNLOCK_VALUE }
  from "../src/championship/app/qaUnlock.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { isGateUnlocked } from "../src/championship/gate/gateAdmission.js";
import { BITS_WALLET_CAP, SHOP_RECORD_COUNT } from "../src/championship/shop/shopCatalog.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { TAMER_RANK_TABLE_LAST_INDEX } from "../src/championship/cage/cageCatalog.js";
import { TITLE_EVENT_SCAN_LIMIT } from "../src/championship/battle/titleEventSchedule.js";

test("the acceptance grant is off unless the address asks for it by name", () => {
  for (const search of ["", "?", "?presentation=developer", "?qa", "?qa=", "?qa=1", "?qa=UNLOCK",
    "?unlock=qa", "?x=qa%3Dunlock", null, undefined, 42, {}]) {
    assert.equal(qaUnlockRequested(search), false, `refused: ${String(search)}`);
  }
  assert.equal(qaUnlockRequested(`?${QA_UNLOCK_PARAMETER}=${QA_UNLOCK_VALUE}`), true);
  assert.equal(qaUnlockRequested("?gateMode=fallback&qa=unlock"), true);
});

test("the grant is derived from the gate catalog, so it cannot drift below what the gates need", () => {
  const gates = listChampionshipGates();
  const plan = qaUnlockPlan(gates);
  assert.equal(plan.gateCount, gates.length);
  assert.equal(plan.bits, BITS_WALLET_CAP);
  // The real check: every gate in the catalog must read as unlocked under the
  // plan. A catalog that adds a harder gate fails here rather than silently
  // leaving a tester unable to reach it.
  for (const gate of gates) {
    assert.equal(
      isGateUnlocked(gate, { tamerRank: plan.tamerRank, battleBadges: [...plan.battleBadges] }),
      true,
      `${gate.gateId} must be reachable under the acceptance grant`
    );
  }
  // Owner asks for the full rank/title set, not merely gate prerequisites.
  assert.equal(plan.tamerRank, TAMER_RANK_TABLE_LAST_INDEX);
  assert.deepEqual([...plan.battleBadges], Array.from({ length: TITLE_EVENT_SCAN_LIMIT }, (_, i) => i));
  assert.equal(plan.bits >= Math.max(...gates.map((g) => g.entranceFeeBits)), true);
});

test("missing gates still grant the known full rank and ordinary title set", () => {
  for (const input of [[], null, undefined, "gates", [null, {}]]) {
    const plan = qaUnlockPlan(input);
    assert.equal(plan.tamerRank, TAMER_RANK_TABLE_LAST_INDEX);
    assert.equal(plan.battleBadges.length, TITLE_EVENT_SCAN_LIMIT);
  }
});

test("the grant goes through the application's own seams and reports what it did", () => {
  const calls = [];
  const app = {
    getShopFrame: () => ({ bits: 250 }),
    creditBits(amount) { calls.push(["creditBits", amount]); return { bits: 250 + amount }; },
    setTamerRank(rank) { calls.push(["setTamerRank", rank]); return rank; },
    setBattleBadges(badges) { calls.push(["setBattleBadges", badges]); return badges; }
  };
  const gates = [
    { gateId: "a", unlockKind: 0, unlockParameter: 0, entranceFeeBits: 0 },
    { gateId: "b", unlockKind: 1, unlockParameter: 8, entranceFeeBits: 4000 },
    { gateId: "c", unlockKind: 2, unlockParameter: 45, entranceFeeBits: 10 }
  ];
  const granted = applyQaUnlock(app, gates);
  assert.deepEqual(calls, [
    ["creditBits", BITS_WALLET_CAP - 250],
    ["setTamerRank", TAMER_RANK_TABLE_LAST_INDEX],
    ["setBattleBadges", [...qaUnlockPlan(gates).battleBadges]]
  ]);
  assert.equal(granted.bits, BITS_WALLET_CAP);
  assert.deepEqual(granted.failures, []);
});

test("a seam that refuses is reported, never thrown, so a QA convenience cannot break a boot", () => {
  const app = {
    getShopFrame: () => ({ bits: 0 }),
    creditBits() { throw new Error("CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE"); },
    setTamerRank() { throw new Error("INVALID_TAMER_RANK"); },
    setBattleBadges() { throw new Error("INVALID_BATTLE_BADGES"); }
  };
  const granted = applyQaUnlock(app, listChampionshipGates());
  assert.equal(granted.failures.length, 3);
  assert.equal(granted.bits, null);
});

test("the grant is reachable only from the one guarded call site", () => {
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  // Exactly one call, and it sits behind the request check.
  assert.equal((main.match(/applyQaUnlock\(/g) ?? []).length, 1);
  // The repository stores these files with CRLF, so the guard check is written
  // against whitespace rather than a bare newline.
  assert.match(main, /if \(!qaUnlockRequested\([^)]*\)\) return;\s+const granted = applyQaUnlock\(/);
  // No other source file may reach it, so the grant cannot acquire a second,
  // unguarded entry point.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".js")) continue;
      if (full.endsWith("app/qaUnlock.js") || full.endsWith("app/main.js")) continue;
      if (fs.readFileSync(full, "utf8").includes("qaUnlock")) offenders.push(full);
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("full QA grant survives real app settlement, repeated entry and Save/Continue", async () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const create = () => createChampionshipStandaloneApp({ storage,
    catalog: JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json')),
    cages: JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages });
  const app = create();
  let restored;
  try {
    await app.newGame();
    // The setter must reject anything the sole save schema cannot retain.
    for (const invalid of [[62], [-1], [1.2], Array(1), Array(63).fill(0)]) {
      assert.throws(() => app.setBattleBadges(invalid), /INVALID_BATTLE_BADGES/);
      assert.deepEqual(app.getBattleBadges(), []);
    }
    app.setTamerRank(10); // Legacy states may exceed the table's final rank.
    app.setBattleBadges([61]); // Existing tutorial flag must also be preserved.
    const granted = applyQaUnlock(app, listChampionshipGates());
    assert.deepEqual(granted.failures, []);
    assert.equal(app.getTamerRank(), 10);
    assert.deepEqual(app.getBattleBadges(), Array.from({ length: 62 }, (_, i) => i));
    assert.equal(app.getShopFrame().listings.length, SHOP_RECORD_COUNT, 'all 118 shop records are available');
    app.advanceClock({ units: 19 * 1440 * 400 });
    app.openBattle();
    const before = app.getTitleProgress();
    let observerChecks = 0;
    const off = app.subscribeShop(() => {
      assert.throws(() => app.setBattleBadges([]), /CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE/);
      assert.throws(() => app.setTamerRank(0), /CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE/);
      observerChecks++;
    });
    const entered = await app.enterMatch({ attemptId: 'battle:1', recordIndex: 0, mode: 1, battleType: 0 });
    assert.equal(entered.ok, true);
    const result = { attemptId: 'battle:1', ended: true, matchIndex: 0, mode: 1, battleType: 0, outcomeEntries: [1] };
    assert.equal(app.finishMatch({ ...result, matchIndex: 1 }).ok, false);
    assert.deepEqual(app.getTitleProgress(), before, 'refused settlement preserves granted progression');
    assert.equal(app.finishMatch(result).ok, true);
    assert.equal(app.finishMatch(result).duplicate, true);
    off();
    assert.equal(observerChecks, 3, 'debit, reward and progression publication');
    assert.deepEqual(app.getBattleBadges(), granted.battleBadges);
    assert.equal(app.getTitleProgress().record.battles, before.record.battles + 1);
    app.exitBattle();
    assert.deepEqual(applyQaUnlock(app, listChampionshipGates()).failures, []);
    assert.equal(app.save().phase, 'SAVED');
    restored = create();
    await restored.continueGame();
    assert.equal(restored.getTamerRank(), 10);
    assert.deepEqual(restored.getBattleBadges(), granted.battleBadges);
    assert.deepEqual(restored.getTitleProgress(), app.getTitleProgress());
    assert.equal(data.size, 1);
  } finally { await restored?.dispose(); await app.dispose(); }
});
