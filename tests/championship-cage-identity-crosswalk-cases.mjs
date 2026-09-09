import assert from "node:assert/strict";
import test from "node:test";

import cages from "../src/data/championship/catalogs/cage-definitions.r1.json" with { type: "json" };
import { listCageDefinitions, WAITING_ROOM_DEFINITION_INDEX } from "../src/championship/cage/cageCatalog.js";
import { getCageTraining } from "../src/championship/cage/cageEffects.js";
import { listShopRecords } from "../src/championship/shop/shopCatalog.js";
import {
  getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS,
  ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS
} from "../src/championship/presentation/originalCageVisualBindings.js";
import { cageName, cageEffectLabel } from "../src/championship/text/zhHant.js";

// Independent ROM witnesses: ShopItemTable itemIndex -> name/description,
// OVL15's indexed text reader, and the parallel ARM9 field-pointer column.
// These expectations deliberately do not derive identity from translated text.
const NAME_IDS = [
  494, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507,
  508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520,
  523, 524, 525, 527, 528, 530, 532, 533, 521
];

test("all cage text identities agree with existing shop and visual identities", () => {
  assert.equal(cages.records.length, 36);
  const definitions = listCageDefinitions();
  const shops = listShopRecords().filter((record) => record.category === "CAGES");
  assert.equal(shops.length, 35);
  for (const [index, nameId] of NAME_IDS.entries()) {
    const row = cages.records[index];
    assert.equal(row.cageIndex, index);
    assert.equal(row.nameStringIndex, nameId, `cage ${index}: wrong ROM name row`);
    assert.equal(row.descriptionStringIndex, nameId + 40);
    // Observed for all 36 referenced fields, not permission to bind unused art.
    const expectedField = `field_cm${String(nameId - 493).padStart(2, "0")}_01`;
    assert.equal(getOriginalCageVisualBinding(index).fieldId, expectedField);
    assert.equal(row.fieldId, expectedField);
    const shop = shops.find((record) => record.itemIndex === index);
    assert.equal(row.shopRecordIndex, shop?.shopRecordIndex ?? null);
    assert.equal(definitions[index].shopRecordIndex, row.shopRecordIndex);
    assert.equal(getCageTraining(index).magnitudeParity, "UNKNOWN_REQUIRES_TRACE");
  }
});

test("vacant lot, track, mini cages and cave retain their own effects and Chinese names", () => {
  const witnesses = [
    [0, "あきち", "空地", "DEFENSE", 2],
    [1, "うんどうじょう", "運動場", "HP", 6],
    [4, "ジム", "健身房", "ATTACK", 8],
    [15, "ミニほけんしつ", "小保健室", "RECOVER_HP_STRESS", 2],
    [30, "ミニジム", "小健身房", "ATTACK", 2],
    [34, "どうくつ", "洞窟", "RESIST_DARK", 2]
  ];
  for (const [index, japanese, chinese, channel, capacity] of witnesses) {
    assert.equal(cages.records[index].name, japanese);
    assert.equal(cageName(index, japanese), chinese);
    assert.equal(getCageTraining(index).channels[0].id, channel);
    assert.equal(getCageTraining(index).capacity, capacity);
  }
  assert.equal(cageEffectLabel("STAT_UP", "DEFENSE"), "防禦上升");
});

test("Waiting Room remains definition 35; lid and unused fields never become shop cages", () => {
  assert.equal(WAITING_ROOM_DEFINITION_INDEX, 35);
  const waiting = cages.records[35];
  assert.equal(waiting.name, "ひかえしつ");
  assert.equal(waiting.shopRecordIndex, null);
  assert.deepEqual(waiting.effect, { kind: "NONE", target: null });
  assert.equal(waiting.capacity, null);
  assert.equal(cageName(35, waiting.name), "等候室");
  assert.ok(cages.records.every((row) => row.name !== "ふた"));
  const nonDefinitions = [
    ...ORIGINAL_CAGE_STRUCTURAL_VISUALS.map((row) => row.fieldId),
    ...ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS
  ];
  assert.equal(nonDefinitions.length, 4);
  for (const row of cages.records) assert.ok(!nonDefinitions.includes(row.fieldId));
  assert.equal(getOriginalCageVisualBinding(36), null);
});
