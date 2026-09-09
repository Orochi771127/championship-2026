import assert from "node:assert/strict";
import test from "node:test";

import names from "../src/data/championship/catalogs/species-names.r1.json" with { type: "json" };
import species from "../src/data/championship/catalogs/creature-species.r1.json" with { type: "json" };
import {
  DATABASE_EGG_COUNT,
  DATABASE_REGULAR_COUNT,
  DATABASE_SLOT_COUNT
} from "../src/championship/database/databaseCatalog.js";

test("the six stat labels are the bank's own, in the game's order", () => {
  // The training messages substitute from this list, so its order IS the stat order.
  assert.deepEqual(names.statNames, ["HP", "TP", "こうげき", "ぼうぎょ", "かしこさ", "すばやさ"]);
  assert.equal(names.statNameStringStart, 35);
});

test("the name run covers species 8..223 and nothing else", () => {
  assert.equal(names.recordCount, 216);
  assert.equal(names.records[0].recordIndex, 8);
  assert.equal(names.records[names.records.length - 1].recordIndex, 223);
  // Eggs carry no individual name; the four past the run land on kana charts.
  assert.ok(!names.records.some((r) => r.recordIndex < 8 || r.recordIndex > 223));
});

test("the offset is +33, pinned by a name the game printed on screen", () => {
  assert.match(names.mapping.rule, /\+ 33/);
  const byIndex = new Map(names.records.map((r) => [r.recordIndex, r.name]));
  // Koromon is what the cartridge displayed when the Owner's creature evolved.
  assert.equal(byIndex.get(21), "コロモン");
  assert.equal(byIndex.get(8), "ズルモン");
  assert.equal(byIndex.get(100), "ダルクモン");
  for (const record of names.records) {
    assert.equal(record.nameStringIndex, record.recordIndex + 33);
  }
});

test("every name is Japanese text and matches its species record", () => {
  const japanese = /^[぀-ゟ゠-ヿ一-鿿！-｠ー・]+$/;
  for (const record of names.records) {
    assert.match(record.name, japanese, `species ${record.recordIndex} is not Japanese`);
    assert.equal(record.identifier, species.records[record.recordIndex].identifier);
  }
});

test("216 named species agrees with the encyclopedia's own split", () => {
  // databaseCatalog records 224 slots = 8 eggs + 216 regular, derived separately.
  // The name run being exactly 216 long is an independent second witness.
  assert.equal(names.recordCount, DATABASE_REGULAR_COUNT);
  assert.equal(DATABASE_EGG_COUNT + names.recordCount, DATABASE_SLOT_COUNT);
  assert.equal(DATABASE_SLOT_COUNT, 216);
});
