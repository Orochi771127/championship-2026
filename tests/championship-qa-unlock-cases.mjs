import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { applyQaUnlock, qaUnlockPlan, qaUnlockRequested, QA_UNLOCK_PARAMETER, QA_UNLOCK_VALUE }
  from "../src/championship/app/qaUnlock.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { isGateUnlocked } from "../src/championship/gate/gateAdmission.js";
import { BITS_WALLET_CAP } from "../src/championship/shop/shopCatalog.js";

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
  // And it must not grant more than the gates ask for.
  const badgeGated = gates.filter((g) => g.unlockKind === 2).map((g) => g.unlockParameter);
  assert.deepEqual([...plan.battleBadges], [...new Set(badgeGated)].sort((a, b) => a - b));
  assert.equal(plan.bits >= Math.max(...gates.map((g) => g.entranceFeeBits)), true);
});

test("an empty or malformed catalog grants nothing rather than throwing", () => {
  for (const input of [[], null, undefined, "gates", [null, {}]]) {
    const plan = qaUnlockPlan(input);
    assert.equal(plan.tamerRank, 0);
    assert.deepEqual([...plan.battleBadges], []);
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
    ["setTamerRank", 8],
    ["setBattleBadges", [45]]
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
