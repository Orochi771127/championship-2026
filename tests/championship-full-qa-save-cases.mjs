import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import {
  CHAMPIONSHIP_MODERN_SAVE_KEY,
  CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES,
  deserializeChampionshipModernSave
} from "../src/championship/app/championshipStandaloneSave.js";
import { BITS_WALLET_CAP, SHOP_PURCHASE_DOMAIN, listShopRecords }
  from "../src/championship/shop/shopCatalog.js";
import { nativeHuntSpeciesByIndex } from "../src/championship/hunt/capture/nativeHuntSources.js";
import { slotCountForTamerRank } from "../src/championship/cage/cageCatalog.js";
import { FULL_QA_STACKABLE_QUANTITY, FULL_QA_ULTIMATES, createFullQaSaveText }
  from "../scripts/lib/championshipFullQaSave.mjs";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const cages = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8")).cages;
const storage = () => {
  const data = new Map();
  return {
    data,
    port: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }
  };
};
const appFor = (port) => createChampionshipStandaloneApp({ storage: port, locks: null, catalog, cages,
  rngClock: () => ({ hour: 12, minute: 34, second: 56 }), now: () => "2026-09-13T00:00:00.000Z" });

async function fixture() {
  const s = storage();
  const first = appFor(s.port);
  await first.newGame();
  assert.equal(first.save().phase, "SAVED");
  const base = JSON.parse(s.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const text = createFullQaSaveText(base, { cageIds: cages.map((entry) => entry.cageId) });
  await first.dispose();
  s.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, text);
  const restored = appFor(s.port);
  await restored.continueGame();
  return { s, restored, text };
}

test("full QA save is a bounded canonical save with five visible Ultimate residents", async (t) => {
  const { restored, text } = await fixture();
  t.after(() => restored.dispose());
  assert.ok(Buffer.byteLength(text) < CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES);
  const save = deserializeChampionshipModernSave(text);
  assert.equal(save.raising.collection.length, FULL_QA_ULTIMATES.length);
  assert.deepEqual(save.raising.collection.map((entry) => entry.displayName), FULL_QA_ULTIMATES.map((entry) => entry.displayName));
  assert.ok(save.raising.collection.every((entry) => nativeHuntSpeciesByIndex(entry.nativeProfile.fields["000"]).generation === 6));
  assert.equal(restored.getRaisingInstances().filter((entry) => entry.source.kind === "COLLECTION").length, 5);
  assert.ok(restored.getRaisingInstances().filter((entry) => entry.source.kind === "COLLECTION")
    .every((entry) => nativeHuntSpeciesByIndex(entry.profile?.speciesIndex).generation === 6));
});

test("full QA save opens current progression and keeps enough inventory for repeated tests", async (t) => {
  const { restored, text } = await fixture();
  t.after(() => restored.dispose());
  const save = deserializeChampionshipModernSave(text);
  const records = listShopRecords();
  assert.equal(save.shop.bits, BITS_WALLET_CAP);
  assert.equal(restored.getShopFrame().bits, BITS_WALLET_CAP);
  assert.equal(restored.getShopFrame().listings.length, records.length);
  assert.ok(restored.getGates().every((gate) => gate.state === "AVAILABLE"));
  assert.ok(restored.getChampionshipCategories().every((entry) => entry.unlocked && entry.registered));
  assert.equal(save.progression.battleBadges.length, 62);
  assert.equal(save.progression.registeredSpecies.length, 216);
  assert.equal(restored.getCageEditFrame().unlockedCount, slotCountForTamerRank(restored.getTamerRank()));
  assert.equal(save.shop.cageOwned.length, records.filter((entry) => entry.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP).length);
  for (const record of records.filter((entry) => entry.purchaseDomain === SHOP_PURCHASE_DOMAIN.INVENTORY)) {
    assert.equal(save.shop.quantities[record.shopRecordIndex], record.maxOwned === 1 ? 1 : Math.min(record.maxOwned, FULL_QA_STACKABLE_QUANTITY));
  }
  assert.equal(restored.save().phase, "SAVED");
});
