// VS4 -- Shop catalog, visibility, Bits wallet and purchase transaction.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  BITS_WALLET_CAP,
  SHOP_CATEGORY_COUNTS,
  SHOP_RECORD_COUNT,
  getShopCatalog,
  listShopRecords
} from "../src/championship/shop/shopCatalog.js";
import { createShopRuntime, STARTING_BITS, STARTING_BITS_EVIDENCE } from "../src/championship/shop/shopRuntime.js";
import { createHuntInventory } from "../src/championship/hunt/loadout/huntInventory.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  CHAMPIONSHIP_SCREENS,
  createChampionshipScreenStack
} from "../src/championship/app/championshipScreenStack.js";

const entities = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({
    storage,
    catalog: entities,
    cages: presentation.cages,
    now: () => "2026-08-30T10:00:00.000Z"
  });
}

test("the shop catalog is 118 rows with the original category split", () => {
  const catalog = getShopCatalog();
  assert.equal(catalog.recordCount, SHOP_RECORD_COUNT);
  assert.equal(listShopRecords().length, 118);
  const counts = { TRAINING_GOODS: 0, HUNT_ITEMS: 0, PLUGINS: 0, CAGES: 0 };
  for (const record of listShopRecords()) counts[record.category] += 1;
  assert.deepEqual(counts, { ...SHOP_CATEGORY_COUNTS });
  assert.equal(BITS_WALLET_CAP, 9_999_999);
  assert.equal(catalog.records.some((record) => /[\u3040-\u30ff]/.test(record.displayName)), false, "ROM Japanese must not enter the product catalog");
});

test("type-0 rows start visible/seen; locked rows stay hidden", () => {
  const shop = createShopRuntime({ huntInventory: createHuntInventory() });
  const frame = shop.getFrame();
  const initial = listShopRecords().filter((record) => record.unlockKind === "INITIAL_AVAILABLE");
  assert.equal(initial.length, 15);
  assert.equal(frame.listings.length, 15);
  assert.equal(frame.listings.every((row) => row.visibility === "SEEN"), true);
  assert.equal(shop.getBits(), STARTING_BITS);
  assert.equal(STARTING_BITS_EVIDENCE, "PRODUCT_AUTHORED");
});

test("a purchase subtracts Bits and raises quantity; a short wallet mutates nothing", () => {
  const shop = createShopRuntime({ huntInventory: createHuntInventory() });
  const feed = listShopRecords()[0];
  assert.equal(feed.unitPriceBits, 5);
  assert.deepEqual(shop.buy(0, 1), { ok: false, reason: "INSUFFICIENT_FUNDS" });
  assert.equal(shop.getFrame().listings[0].owned, 50);

  shop.creditBits(5);
  const bought = shop.buy(0, 1);
  assert.equal(bought.ok, true);
  assert.equal(bought.cost, 5);
  assert.equal(shop.getBits(), 0);
  assert.equal(shop.getFrame().listings[0].owned, 51);
});

test("maxOwned and hidden rows refuse the buy without writing", () => {
  const shop = createShopRuntime({ huntInventory: createHuntInventory(), bits: 90_000 });
  const hidden = listShopRecords().find((record) => record.unlockKind !== "INITIAL_AVAILABLE");
  assert.equal(shop.buy(hidden.shopRecordIndex, 1).reason, "UNAVAILABLE");

  const rope = listShopRecords().find((record) => record.productItemId === "championship:2026:hunt-item:rope-i");
  assert.equal(rope.maxOwned, 1);
  assert.equal(shop.buy(rope.shopRecordIndex, 1).reason, "MAX_OWNED");
});

test("a mapped Hunt SKU grant lands in the Shop-owned Hunt inventory", () => {
  const inventory = createHuntInventory({ entries: [] });
  const shop = createShopRuntime({ huntInventory: inventory, bits: 5 });
  const shot = listShopRecords().find((record) => record.productItemId === "championship:2026:hunt-item:shot-i");
  assert.equal(shot.initialOwned, 20);
  assert.equal(inventory.getQuantity(shot.productItemId), 0);
  const bought = shop.buy(shot.shopRecordIndex, 1);
  assert.equal(bought.ok, true);
  assert.equal(inventory.getQuantity(shot.productItemId), 1);
});

test("Cage purchases write ownership, not inventory quantity", () => {
  const shop = createShopRuntime({ bits: 0 });
  const starterCage = listShopRecords().find((record) => record.purchaseDomain === "CAGE_OWNERSHIP" && record.initialOwned === 1);
  assert.ok(starterCage);
  const save = shop.toSave();
  assert.equal(save.cageOwned.includes(starterCage.shopRecordIndex), true);
  assert.equal(save.quantities[starterCage.shopRecordIndex], 0);
});

test("NEW rows become seen on the original 1-to-2 scan", () => {
  const shop = createShopRuntime({
    progression: { tamerRank: 6, battleBadges: [7] },
    bits: 0
  });
  const listed = shop.getFrame().listings.filter((row) => row.visibility === "NEW");
  assert.ok(listed.length > 0);
  shop.markNewSeen();
  assert.equal(shop.getFrame().listings.every((row) => row.visibility === "SEEN"), true);
});

test("raising tamer rank later reveals the same type-1 shop rows", () => {
  const shop = createShopRuntime({ bits: 0 });
  const before = shop.getFrame().listings.length;
  shop.setProgression({ tamerRank: 6, battleBadges: [7] });
  const listed = shop.getFrame().listings;
  assert.ok(listed.length > before);
  assert.ok(listed.some((row) => row.visibility === "NEW"));
});

test("Home can enter Shop and Shop can only go back", () => {
  const stack = createChampionshipScreenStack();
  stack.enter(CHAMPIONSHIP_SCREENS.SHOP);
  assert.equal(stack.current(), CHAMPIONSHIP_SCREENS.SHOP);
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.GATE_SELECT), false);
  assert.equal(stack.back(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
});

test("a purchase persists Bits, quantity and mapped Hunt stock across continue", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  assert.equal(app.openShop(), CHAMPIONSHIP_SCREENS.SHOP);
  assert.equal(app.getShopFrame().listings.length, 15);
  assert.equal(app.buyShopItem(0, 1).reason, "INSUFFICIENT_FUNDS");

  app.creditBits(5);
  const bought = app.buyShopItem(0, 1);
  assert.equal(bought.ok, true);
  assert.equal(app.getShopFrame().bits, 0);
  assert.equal(app.getShopFrame().listings[0].owned, 51);

  const shot = listShopRecords().find((record) => record.productItemId === "championship:2026:hunt-item:shot-i");
  app.creditBits(shot.unitPriceBits);
  assert.equal(app.buyShopItem(shot.shopRecordIndex, 1).ok, true);
  assert.equal(app.getHuntInventory().getQuantity(shot.productItemId), 21);
  app.save();
  await app.dispose();

  const reloaded = createApp(storage);
  const restored = await reloaded.continueGame();
  assert.ok(restored);
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(Object.hasOwn(saved, "shop"), true);
  assert.equal(Object.hasOwn(saved.shop, "catalogKind"), false);
  assert.equal(reloaded.getShopFrame().bits, 0);
  reloaded.openShop();
  assert.equal(reloaded.getShopFrame().listings[0].owned, 51);
  assert.equal(reloaded.getHuntInventory().getQuantity(shot.productItemId), 21);
  assert.equal(reloaded.leaveScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await reloaded.dispose();
});

test("a pre-shop save still continues and reseeds the Shop", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  delete saved.shop;
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  await app.dispose();

  const reloaded = createApp(storage);
  const restored = await reloaded.continueGame();
  assert.ok(restored);
  assert.equal(reloaded.getScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  reloaded.openShop();
  assert.equal(reloaded.getShopFrame().listings.length, 15);
  assert.equal(reloaded.getShopFrame().bits, STARTING_BITS);
  await reloaded.dispose();
});

test("the presentation source opens Shop without a second router", async () => {
  const app = createApp();
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openShop();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.SHOP);
  assert.equal(source.getFrame().shop.listings.length, 15);
  source.intents.leaveScreen();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});
