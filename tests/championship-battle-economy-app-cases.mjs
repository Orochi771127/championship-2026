import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createBattleRuntime } from "../src/championship/app/battleRuntime.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { createShopRuntime } from "../src/championship/shop/shopRuntime.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const AUTUMN_DAY4_SCHEDULE = Object.freeze({ entryMode: 0, scheduleSlotA: 2, scheduleSlotB: 3, progressCounter: 0 });

function memoryStorage() {
  const data = new Map();
  return {
    failWrites: false,
    writes: 0,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) {
      if (this.failWrites) throw new Error("TEST_STORAGE_FULL");
      this.writes += 1;
      data.set(key, String(value));
    },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-09-05T10:00:00.000Z" });
}

async function startMatchDateFixture(app) {
  await app.newGame();
  // These economy tests explicitly advance the same app clock from Spring
  // Day 1 to Autumn Day 4, the catalog date of MATCH 00. No product date default.
  app.advanceClock({ units: 19 * 1440 * 400 });
  assert.deepEqual(app.getBattleSchedule(), AUTUMN_DAY4_SCHEDULE);
}

function enter(app, attemptId = "battle:1") {
  return app.enterMatch({ attemptId, recordIndex: 0, mode: 0, battleType: 0 });
}

function outcome(attemptId = "battle:1", won = true) {
  return { attemptId, ended: true, matchIndex: 0, mode: 0, battleType: 0, outcomeEntries: [won ? 1 : 0] };
}

test("150 fee and 7000 reward use the one wallet, with manual save and fresh Continue", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await startMatchDateFixture(app);
  app.creditBits(150); // Controlled fixture; production New Game remains unchanged.
  app.openBattle();
  assert.equal(enter(app).ok, true);
  assert.equal(app.getShopFrame().bits, 0);
  assert.equal(storage.writes, 0, "registration does not invent an autosave checkpoint");
  const settled = app.finishMatch(outcome());
  assert.equal(settled.receipt.rewardBits, 7000);
  assert.equal(settled.receipt.credited, 7000);
  assert.equal(app.getShopFrame().bits, 7000);
  assert.equal(storage.writes, 0, "settlement retains the existing manual save policy");
  app.exitBattle();
  app.openShop();
  assert.equal(app.getShopFrame().bits, 7000);
  app.leaveScreen();
  assert.equal(app.save().phase, "SAVED");
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  const restored = createApp(storage);
  await restored.continueGame();
  assert.equal(restored.getShopFrame().bits, 7000);
  assert.deepEqual(restored.getBattleReceipt(), settled.receipt);
  assert.equal(restored.finishMatch(outcome()).duplicate, true);
  assert.equal(restored.getShopFrame().bits, 7000);
  await app.dispose();
  await restored.dispose();
});

test("insufficient funds and leaving selection do not charge or allocate attempts", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  assert.equal(app.getShopFrame().bits, 0);
  app.creditBits(149);
  app.openBattle();
  const rejected = enter(app);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "INSUFFICIENT_FUNDS");
  assert.equal(app.getScreen(), "BATTLE_SELECT");
  assert.equal(app.getBattleEconomyState().nextSequence, 1);
  app.leaveScreen();
  assert.equal(app.getShopFrame().bits, 149);
  assert.equal(app.getBattleReceipt(), null);
  await app.dispose();
});

test("duplicate confirmation and result notifications never charge or credit twice", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  app.creditBits(1000);
  app.openBattle();
  enter(app);
  assert.equal(enter(app).duplicate, true);
  assert.equal(app.getShopFrame().bits, 850);
  assert.equal(app.finishMatch({ ...outcome(), ended: false }).ok, false);
  assert.equal(app.finishMatch({ ...outcome(), matchIndex: 1 }).ok, false);
  const result = app.finishMatch(outcome());
  assert.equal(result.ok, true);
  assert.equal(app.getShopFrame().bits, 7850);
  assert.equal(app.finishMatch(outcome()).duplicate, true);
  assert.equal(app.getShopFrame().bits, 7850);
  app.exitBattle();
  app.openBattle();
  assert.equal(enter(app).duplicate, true, "old menu callback cannot buy a new attempt");
  assert.equal(app.getScreen(), "BATTLE_SELECT");
  assert.equal(app.getShopFrame().bits, 7850);
  enter(app, "battle:2");
  assert.equal(app.getShopFrame().bits, 7700);
  assert.equal(app.finishMatch(outcome()).duplicate, true, "previous result only returns its existing receipt");
  assert.equal(app.getBattleEconomyState().active.attemptId, "battle:2", "the new match remains unsettled");
  assert.equal(app.getShopFrame().bits, 7700);
  app.exitBattle();
  await app.dispose();
});

test("defeat keeps the paid fee and awards zero", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  app.creditBits(1000);
  app.openBattle();
  enter(app);
  const result = app.finishMatch(outcome("battle:1", false));
  assert.equal(result.receipt.rewardBits, 0);
  assert.equal(result.receipt.credited, 0);
  assert.equal(app.getShopFrame().bits, 850);
  await app.dispose();
});

test("reward receipt distinguishes nominal reward from wallet cap credit", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  app.creditBits(9_999_989);
  app.openBattle();
  enter(app);
  const result = app.finishMatch(outcome());
  assert.equal(result.receipt.rewardBits, 7000);
  assert.equal(result.receipt.credited, 160);
  assert.equal(result.receipt.clamped, true);
  assert.equal(app.getShopFrame().bits, 9_999_999);
  assert.equal(app.save().phase, "SAVED");
  await app.dispose();
});

test("failed save followed by shopping retries current wallet, inventory and receipt together", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await startMatchDateFixture(app);
  app.creditBits(150);
  app.openBattle();
  enter(app);
  app.finishMatch(outcome());
  app.exitBattle();
  storage.failWrites = true;
  assert.equal(app.save().phase, "SAVE_FAILED");
  app.openShop();
  const purchase = app.buyShopItem(0, 1);
  assert.equal(purchase.ok, true);
  assert.equal(app.savePort.getStatus().phase, "SAVE_FAILED");
  storage.failWrites = false;
  assert.equal(app.persistenceFacade().retry().phase, "SAVED");
  const restored = createApp(storage);
  await restored.continueGame();
  assert.equal(restored.getShopFrame().bits, 6995);
  assert.equal(restored.inspectSave().save.shop.quantities[0], 51);
  assert.equal(restored.getBattleReceipt().credited, 7000);
  assert.equal(restored.finishMatch(outcome()).duplicate, true);
  assert.equal(restored.getShopFrame().bits, 6995);
  await app.dispose();
  await restored.dispose();
});

test("active battles cannot be serialized as resumable games", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await startMatchDateFixture(app);
  app.creditBits(150);
  app.openBattle();
  enter(app);
  assert.throws(() => app.save(), /SAVE_WHILE_BATTLE_ACTIVE/);
  assert.equal(storage.writes, 0);
  app.exitBattle();
  assert.equal(app.getBattleReceipt().status, "ABANDONED");
  assert.equal(app.getShopFrame().bits, 0);
  assert.equal(app.save().phase, "SAVED");
  const restored = createApp(storage);
  await restored.continueGame();
  assert.equal(restored.finishMatch(outcome()).duplicate, true);
  assert.equal(restored.getShopFrame().bits, 0);
  await app.dispose();
  await restored.dispose();
});

test("wallet observers see the paired attempt and cannot settle halfway through debit", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  app.creditBits(150);
  app.openBattle();
  let seen = null;
  const off = app.subscribeShop(() => {
    seen = { bits: app.getShopFrame().bits, active: app.getBattleEconomyState().active?.attemptId,
      blocked: app.finishMatch(outcome()) };
  });
  enter(app);
  off();
  assert.equal(seen.bits, 0);
  assert.equal(seen.active, "battle:1");
  assert.equal(seen.blocked.reason, "TRANSACTION_ACTIVE");
  assert.equal(app.finishMatch(outcome()).ok, true);
  await app.dispose();
});

test("a real deterministic runtime verdict feeds settlement without reading UI winner text", async () => {
  const app = createApp();
  await startMatchDateFixture(app);
  app.creditBits(150);
  app.openBattle();
  const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE, seed: 0x14 });
  runtime.chooseMatch(0);
  const entered = app.enterMatch({ ...runtime.getEconomyContext(), attemptId: "battle:1" });
  assert.equal(entered.ok, true);
  const source = runtime.startMatch();
  for (let i = 0; i < 7201 && !source.getView().outcome.ended; i += 1) source.tick();
  const result = runtime.getSettlementResult();
  assert.equal(result.ended, true);
  assert.equal(result.outcomeEntries.length, 1);
  assert.equal(result.outcomeEntries[0], 1, "known seed records a player win");
  assert.equal(app.finishMatch({ ...result, attemptId: "battle:1" }).receipt.credited, 7000);
  runtime.dispose();
  await app.dispose();
});

test("the wallet rejects a transaction calculated from a stale balance", () => {
  const shop = createShopRuntime({ bits: 1000 });
  assert.equal(shop.applyBitsTransaction({ expectedBits: 999, bits: 0 }).ok, false);
  assert.equal(shop.getBits(), 1000);
  assert.throws(() => shop.applyBitsTransaction({ expectedBits: 1000, bits: -1 }), /INVALID_BITS/);
  assert.equal(shop.getBits(), 1000);
});
