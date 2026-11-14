// HUNT_TOOL_TIERS_20261103 (OWNER_APPROVED_ADAPTATION): one shop card per hunt tool,
// upgraded in place (α -> β -> γ); ropes counted (/99) and spent one at a time when
// they snap; the three memory cards become one card with seven sizes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createShopRuntime } from "../src/championship/shop/shopRuntime.js";
import { HUNT_TOOL_FAMILIES, getHuntToolFamily, migrateHuntToolQuantities, ropeEmergencyBits } from "../src/championship/shop/huntToolTiers.js";
import { getShopRecord, SHOP_RECORD_COUNT } from "../src/championship/shop/shopCatalog.js";
import { createHuntInventory } from "../src/championship/hunt/loadout/huntInventory.js";
import { getHuntCatalogItem } from "../src/championship/hunt/loadout/huntEquipmentCatalog.js";
import { createHuntLoadout } from "../src/championship/hunt/loadout/huntLoadoutRuntime.js";
import { normalizeShopSlice } from "../src/championship/app/championshipStandaloneSave.js";
import { huntFamilyEntries, huntFamilyName } from "../src/championship/app/huntToolFamilyCards.js";
import { backpackSections } from "../src/championship/app/ranchBackpack.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { nativeHuntToolSpecies } from "../src/championship/hunt/capture/nativeHuntToolRules.js";

const ITEM = index => getShopRecord(index).productItemId;
const family = (shop, id) => shop.getFrame().huntFamilies.find(f => f.familyId === id);
function snapshotWith(rows, bits = 9_000_000) {
  const shop = createShopRuntime({ bits, allItemsVisible: true });
  const save = shop.toSave();
  const quantities = new Array(SHOP_RECORD_COUNT).fill(0);
  for (const [index, quantity] of Object.entries(rows)) quantities[index] = quantity;
  return { ...save, quantities, toolTiers: undefined };
}
const legacy = (rows, extra = {}) => {
  const { toolTiers, ...snapshot } = snapshotWith(rows);
  return createShopRuntime({ snapshot, allItemsVisible: true, ...extra });
};

test("every tiered hunt tool is one family; the shop's hunt tab shows each once", () => {
  assert.deepEqual(HUNT_TOOL_FAMILIES.map(f => f.kind).filter(k => k === "ROPE").length, 4);
  assert.equal(HUNT_TOOL_FAMILIES.filter(f => f.kind === "GEAR").length, 13);
  const rows = new Set(HUNT_TOOL_FAMILIES.flatMap(f => f.records));
  assert.equal(rows.size, HUNT_TOOL_FAMILIES.flatMap(f => f.records).length, "no row in two families");
  for (const f of HUNT_TOOL_FAMILIES) for (const r of f.records) assert.equal(getShopRecord(r).category, "HUNT_ITEMS");
  const shop = createShopRuntime({ bits: 100_000, allItemsVisible: true }), frame = shop.getFrame();
  const hunt = frame.listings.filter(row => row.category === "HUNT_ITEMS");
  assert.equal(hunt.length, 49);
  const cards = huntFamilyEntries(hunt, frame.huntFamilies);
  assert.equal(cards.length, 26, "49 rows become 18 family cards and 8 single tools");
  const names = cards.map(card => (card.family ? huntFamilyName(card.family) : card.row.shopRecordIndex));
  assert.equal(new Set(names).size, names.length);
  for (const forbidden of ["手槍 β", "捕捉繩 β", "記憶卡 64Ｇ"]) assert.ok(!names.includes(forbidden), forbidden);
});

test("an old save keeps what it held: ropes become 15 of the best tier, ammo moves to the top tier, the last card wins", () => {
  const shop = legacy({ 4: 1, 6: 1, 12: 1, 15: 1, 16: 19, 17: 3, 30: 6, 34: 10, 50: 1, 51: 1, 52: 1 });
  const save = shop.toSave();
  assert.equal(family(shop, "rope-swift").tier, 2);
  assert.equal(family(shop, "rope-swift").owned, 15);
  assert.deepEqual([4, 5, 6].map(i => save.quantities[i]), [0, 0, 15]);
  assert.equal(family(shop, "rope-clone").tier, 2);
  assert.equal(family(shop, "rope-ultimate").tier, 2);
  assert.equal(family(shop, "rope-tough").tier, -1);
  assert.equal(family(shop, "shot-pistol").tier, 1, "a held β makes the family β");
  assert.equal(family(shop, "shot-pistol").owned, 22, "19 α + 3 β, nothing lost");
  assert.deepEqual([16, 17].map(i => save.quantities[i]), [0, 22]);
  assert.equal(family(shop, "wire-magnet").tier, 0);
  assert.equal(family(shop, "wire-magnet").owned, 6);
  assert.deepEqual([50, 51, 52].map(i => save.quantities[i]), [0, 0, 1]);
  assert.equal(shop.memoryCardCapacityG(), 96);
  assert.deepEqual(save.toolTiers["memory-card"], 2);
  // A migrated save is never migrated twice.
  const again = createShopRuntime({ snapshot: save, allItemsVisible: true });
  assert.deepEqual(again.toSave(), save);
});

test("a gear upgrade is a one-time model fee, and every α unit moves up 1:1", () => {
  const shop = legacy({ 16: 19, 30: 6 });
  const bits = shop.getBits();
  const pistol = family(shop, "shot-pistol");
  assert.equal(pistol.next.tier, 1);
  assert.equal(pistol.next.bits, 300);
  const receipt = shop.upgradeHuntFamily("shot-pistol");
  assert.equal(receipt.ok, true);
  assert.equal(receipt.reason, "UPGRADED");
  assert.equal(shop.getBits(), bits - 300);
  assert.equal(family(shop, "shot-pistol").tier, 1);
  assert.equal(family(shop, "shot-pistol").owned, 19);
  assert.deepEqual([16, 17].map(i => shop.toSave().quantities[i]), [0, 19]);
  assert.equal(family(shop, "shot-pistol").next, null, "β is the top for gear");
  assert.equal(shop.upgradeHuntFamily("shot-pistol").reason, "MAX_TIER");
  // Refills now buy β at the β price.
  const refill = shop.refillHuntFamily("shot-pistol", 10);
  assert.equal(refill.cost, 10 * getShopRecord(17).unitPriceBits);
  assert.equal(family(shop, "shot-pistol").owned, 29);
  assert.equal(shop.refillHuntFamily("shot-pistol", 71).reason, "MAX_OWNED", "the cap is still 99");
  // The magnetic wire: 6 α become 6 β.
  shop.upgradeHuntFamily("wire-magnet");
  assert.equal(family(shop, "wire-magnet").owned, 6);
  assert.equal(family(shop, "wire-magnet").shopRecordIndex, 31);
});

test("ropes: buying a colour or a tier pays its row once and adds ten; single ropes refill cheaply", () => {
  const shop = createShopRuntime({ bits: 1_000_000, allItemsVisible: true });
  assert.equal(family(shop, "rope-swift").tier, 0, "the starting rope");
  assert.equal(family(shop, "rope-swift").owned, 15, "the starting 1/1 rope became 15");
  assert.equal(family(shop, "rope-swift").refillBits, 20);
  assert.equal(shop.refillHuntFamily("rope-tough", 1).reason, "TIER_LOCKED", "a colour is bought as a tier first");
  let receipt = shop.upgradeHuntFamily("rope-tough");
  assert.equal(receipt.cost, 9000);
  assert.equal(family(shop, "rope-tough").owned, 10);
  receipt = shop.upgradeHuntFamily("rope-swift");
  assert.equal(receipt.cost, 2500);
  assert.equal(family(shop, "rope-swift").tier, 1);
  assert.equal(family(shop, "rope-swift").owned, 25, "15 held + 10 new");
  assert.equal(family(shop, "rope-swift").refillBits, 35);
  receipt = shop.refillHuntFamily("rope-swift", 10);
  assert.equal(receipt.cost, 350);
  assert.equal(family(shop, "rope-swift").owned, 35);
  assert.deepEqual(HUNT_TOOL_FAMILIES.filter(f => f.kind === "ROPE").map(f => f.refillBits),
    [[20, 35, 50], [80, 110, 150], [200, 260, 320], [450, 600, 800]]);
  assert.equal(ropeEmergencyBits(getHuntToolFamily("rope-swift"), 0), 150, "five at one and a half times");
  // A refused emergency bundle never unlocks a colour for free.
  const poor = createShopRuntime({ bits: 0, allItemsVisible: true });
  assert.equal(poor.buyEmergencyRopes("rope-ultimate").reason, "INSUFFICIENT_FUNDS");
  assert.equal(family(poor, "rope-ultimate").tier, -1);
});

test("locked tiers stay locked until their own unlock", () => {
  const shop = createShopRuntime({ bits: 1_000_000 });
  const swift = family(shop, "rope-swift");
  assert.equal(swift.next.tier, 1);
  assert.equal(swift.next.unlocked, true, "捕捉繩 β is initially available");
  shop.upgradeHuntFamily("rope-swift");
  assert.equal(family(shop, "rope-swift").next.unlocked, false, "捕捉繩 γ needs battle badge 25");
  assert.equal(shop.upgradeHuntFamily("rope-swift").reason, "TIER_LOCKED");
  shop.setProgression({ battleBadges: [25] });
  assert.equal(shop.upgradeHuntFamily("rope-swift").ok, true);
});

test("the memory card: 32 -> 64 -> 96 G for bits, then 128 / 160 / 200 / 256 G for bits or test diamonds", () => {
  const shop = createShopRuntime({ bits: 9_999_999, allItemsVisible: true });
  assert.equal(shop.memoryCardCapacityG(), 32);
  const sizes = [], prices = [];
  while (family(shop, "memory-card").next) {
    const next = family(shop, "memory-card").next;
    prices.push([next.bits, next.diamonds]);
    const bits = shop.getBits();
    const currency = next.diamonds && sizes.length % 2 ? "DIAMONDS" : "BITS";
    assert.equal(shop.upgradeHuntFamily("memory-card", { currency }).ok, true);
    assert.equal(shop.getBits(), currency === "DIAMONDS" ? bits : bits - next.bits, "diamond sizes charge no bits here");
    sizes.push(shop.memoryCardCapacityG());
  }
  assert.deepEqual(sizes, [64, 96, 128, 160, 200, 256]);
  assert.deepEqual(prices, [[4850, null], [9850, null], [150000, 300], [350000, 500], [800000, 800], [1800000, 1200]]);
  assert.deepEqual([50, 51, 52].map(i => shop.toSave().quantities[i]), [0, 0, 1], "one card");
  assert.equal(shop.upgradeHuntFamily("memory-card").reason, "MAX_TIER");
  // The 64 G row cannot be bought on its own any more.
  assert.equal(shop.buy(51).ok, false);
});

test("the hunt inventory and loadout list one rope per colour and one item per tool", () => {
  const inventory = createHuntInventory({ entries: [{ itemId: ITEM(4), quantity: 1 }, { itemId: ITEM(6), quantity: 1 },
    { itemId: ITEM(13), quantity: 1 }, { itemId: ITEM(16), quantity: 20 }, { itemId: ITEM(17), quantity: 4 }] });
  createShopRuntime({ huntInventory: inventory, initialHuntInventory: inventory, allItemsVisible: true });
  const loadout = createHuntLoadout({ inventory });
  const ropes = loadout.listAvailableEquipment().find(c => c.equipmentClass === "ROPE");
  assert.deepEqual(ropes.items.map(i => [i.itemId, i.quantity]), [[ITEM(6), 15], [ITEM(13), 15]]);
  assert.equal(ropes.countable, true);
  const shots = loadout.listAvailableEquipment().find(c => c.equipmentClass === "SHOT");
  assert.deepEqual(shots.items.map(i => [i.itemId, i.quantity]), [[ITEM(17), 24]]);
  assert.equal(getHuntCatalogItem(ITEM(4)).maxOwned, 99);
});

test("the bag lists each family once, badged by tier, and the memory card by size", () => {
  const shop = legacy({ 4: 1, 5: 1, 16: 19, 17: 3, 50: 1, 51: 1, 52: 1 });
  shop.upgradeHuntFamily("memory-card");
  const hunt = backpackSections(shop.getFrame()).find(s => s.category === "HUNT_ITEMS").items;
  assert.deepEqual(hunt.map(i => i.name), ["捕捉繩 β", "手槍 β", "心核記憶卡 128 G"]);
  assert.deepEqual(hunt.map(i => i.tierBadge), [undefined, undefined, "Lv.4"], "the tier is in the name; the card wears its level");
});

test("the save keeps tiers and rope wear and refuses anything else under them", () => {
  const shop = legacy({ 4: 1, 16: 5 });
  shop.setRopeWear(ITEM(4), 0.4);
  const saved = shop.toSave();
  assert.equal(saved.ropeWear["rope-swift"], 400);
  const reloaded = createShopRuntime({ snapshot: saved, allItemsVisible: true });
  assert.equal(reloaded.getRopeWear(ITEM(4)), 0.4);
  reloaded.setRopeWear(ITEM(4), 1);
  assert.equal(reloaded.toSave().ropeWear, undefined, "a fresh rope is not stored");
  assert.deepEqual(normalizeShopSlice(JSON.parse(JSON.stringify(saved))).toolTiers, saved.toolTiers);
  const check = shopSlice => () => normalizeShopSlice(JSON.parse(JSON.stringify(shopSlice)));
  assert.throws(check({ ...saved, toolTiers: { "rope-swift": 3 } }), /INVALID_HUNT_TOOL_TIERS/);
  assert.throws(check({ ...saved, toolTiers: { "shot-laser": 0 } }), /INVALID_HUNT_TOOL_TIERS/);
  assert.throws(check({ ...saved, ropeWear: { "shot-pistol": 300 } }), /INVALID_ROPE_WEAR/);
});

// ---------------------------------------------------------------- the rope in a live hunt

const FRAME = 1000 * 560190 / 33513982;
const ROPE = n => `championship:2026:hunt-item:rope-${["i", "ii", "iii"][n] ?? String(n).padStart(2, "0")}`;
async function huntWith(ropes, options = {}) {
  const saved = new Map(), storage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) };
  const app = createChampionshipStandaloneApp({ storage, locks: null, catalog: JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8")),
    cages: JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8")).cages, rngClock: () => ({ hour: 13, minute: 20, second: 50 }),
    huntStartingInventory: [...ropes.map(n => ({ itemId: ROPE(n), quantity: 1 })), { itemId: "championship:2026:hunt-memory:card-32", quantity: 1 }], ...options });
  await app.newGame(); app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate();
  return { app };
}

test("the loadout ties on the best rope colour held", async () => {
  const { app } = await huntWith([0, 4, 11]);
  const rope = app.getHuntLoadout().getSelectedEquipment().find(s => s.equipmentClass === "ROPE");
  assert.equal(rope.itemId, ROPE(11), "究極繩 γ, not the starting 捕捉繩 α");
  assert.equal(rope.quantity, 15);
});

test("a live hunt: wear carries from pull to pull; a snap spends one rope and the next comes in fresh", async () => {
  const { app } = await huntWith([0]);
  await app.beginHunt();
  const runtime = app.getHuntRuntime();
  assert.equal(runtime.selectTool("ROPE"), true);
  const rope = () => runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(rope().stock, 15);
  assert.equal(rope().wear, 1);
  const small = runtime.getWildCreatures().find(w => nativeHuntToolSpecies(w.speciesIndex).generation <= 3);
  const at = () => runtime.getWildCreatures().find(w => w.wildId === small.wildId);
  for (let i = 0; i <= 16; i++) {
    const p = at(), angle = (i / 16) * Math.PI * 2, x = p.worldX + 70 * Math.cos(angle), y = p.worldY - 10 + 70 * Math.sin(angle);
    if (i === 0) runtime.toolPointerDown(x, y); else runtime.toolPointerMove(x, y);
    runtime.tick(FRAME);
  }
  let p = at(); runtime.toolPointerUp(p.worldX + 70, p.worldY - 10);
  for (let i = 0; i < 40; i++) runtime.tick(FRAME);
  assert.equal(at().bound, true);
  const pull = distance => {
    const start = at(); runtime.toolPointerDown(start.worldX, start.worldY - 10); runtime.tick(FRAME);
    for (let i = 0; i < 30; i++) { const q = at(); runtime.toolPointerMove(q.worldX + distance, q.worldY - 10); runtime.tick(FRAME); }
    const q = at(); runtime.toolPointerUp(q.worldX + distance, q.worldY - 10); runtime.tick(FRAME);
  };
  pull(120);
  const worn = rope().wear;
  assert.ok(worn > 0 && worn < 1, `the rope wore without snapping (${worn})`);
  assert.equal(rope().stock, 15, "no snap, no rope spent");
  assert.equal(app.getShopFrame().huntFamilies.find(f => f.familyId === "rope-swift").wear, Math.round(worn * 1000) / 1000);
  pull(160);
  assert.ok(rope().wear < worn, "the next pull starts as worn as the last one ended");
  // Pull far past the snap distance.
  p = at(); runtime.toolPointerDown(p.worldX, p.worldY - 10); runtime.tick(FRAME);
  runtime.toolPointerMove(p.worldX + 500, p.worldY); runtime.tick(FRAME); runtime.tick(FRAME);
  assert.equal(runtime.getToolState().notice, "ROPE_REPLACED");
  assert.equal(rope().stock, 14, "the snapped rope is spent");
  assert.equal(rope().wear, 1, "the next rope is fresh");
  assert.equal(rope().swapping, true);
  assert.equal(rope().overheatSeconds, 0, "tying on the next rope is no cooldown");
  runtime.toolPointerUp(p.worldX + 500, p.worldY);
  for (let i = 0; i < 16; i++) runtime.tick(FRAME);
  assert.equal(rope().swapping, false, "0.25 s later the next rope is ready");
  assert.equal(app.getShopFrame().quantities?.[4] ?? app.getShopFrame().huntFamilies[0].owned, 14);
  assert.equal(app.savePort.getStatus().phase, "DIRTY", "the spent rope goes to the save");
});

test("the last rope of a colour snaps into the next colour; with none left the rope key sells five", async () => {
  // Fifteen lassos on one scripted partner need it to stay within rope reach of the opening camera, so this
  // case keeps the native entry positions (HUNT_SPAWN_SPREAD_20261110 moves the partner it was scripted on).
  const { app } = await huntWith([0, 3], { huntSpawnSpread: false });
  await app.beginHunt();
  const runtime = app.getHuntRuntime();
  const tool = () => runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool().itemId, ROPE(3), "強力繩 was tied on first");
  assert.equal(tool().spares, 1);
  assert.equal(runtime.selectTool("ROPE"), true);
  const small = runtime.getWildCreatures().find(w => nativeHuntToolSpecies(w.speciesIndex).generation <= 3);
  const at = () => runtime.getWildCreatures().find(w => w.wildId === small.wildId);
  const snapOnce = () => {
    for (let i = 0; i < 30; i++) runtime.tick(FRAME);
    for (let i = 0; i <= 16; i++) {
      const p = at(), angle = (i / 16) * Math.PI * 2, x = p.worldX + 70 * Math.cos(angle), y = p.worldY - 10 + 70 * Math.sin(angle);
      if (i === 0) runtime.toolPointerDown(x, y); else runtime.toolPointerMove(x, y);
      runtime.tick(FRAME);
    }
    let p = at(); runtime.toolPointerUp(p.worldX + 70, p.worldY - 10);
    for (let i = 0; i < 40; i++) runtime.tick(FRAME);
    if (!at().bound) return null;
    p = at(); runtime.toolPointerDown(p.worldX, p.worldY - 10); runtime.tick(FRAME);
    runtime.toolPointerMove(p.worldX + 500, p.worldY); runtime.tick(FRAME); runtime.tick(FRAME);
    const notice = runtime.getToolState().notice;
    runtime.toolPointerUp(p.worldX + 500, p.worldY); runtime.tick(FRAME);
    return notice;
  };
  const notices = [];
  for (let tries = 0; tries < 60 && tool().itemId === ROPE(3); tries++) { const n = snapOnce(); if (n) notices.push(n); }
  assert.equal(notices.length, 15, "fifteen snaps spend fifteen ropes");
  assert.deepEqual(notices.slice(0, 14), new Array(14).fill("ROPE_REPLACED"));
  assert.equal(notices[14], "ROPE_SWITCHED", "the last one hands over to the next colour");
  assert.equal(tool().itemId, ROPE(0));
  assert.equal(tool().stock, 15);
  assert.equal(tool().exhausted, false);
  // Snap every 捕捉繩 too: the rope key turns into the emergency refill.
  let last = null;
  for (let tries = 0; tries < 60 && tool().stock > 0; tries++) last = snapOnce() ?? last;
  assert.equal(last, "ROPE_EXHAUSTED");
  assert.equal(tool().exhausted, true);
  assert.equal(tool().enabled, false, "no rope to throw");
  assert.equal(tool().emergencyBits, ropeEmergencyBits(getHuntToolFamily("rope-swift"), 0));
  // With no bits nothing is sold; with bits the rope key sells five of the rope in hand.
  assert.equal(app.buyEmergencyHuntRopes().reason, "INSUFFICIENT_FUNDS");
  app.creditBits(1000);
  const receipt = app.buyEmergencyHuntRopes();
  assert.equal(receipt.ok, true);
  assert.equal(receipt.cost, 150);
  assert.equal(tool().stock, 5);
  assert.equal(tool().exhausted, false);
  assert.equal(runtime.selectTool("ROPE"), true, "the hunt goes on");
});
