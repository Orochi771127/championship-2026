import assert from "node:assert/strict";
import test from "node:test";

import gateTable from "../src/data/championship/catalogs/gate-table.r1.json" with { type: "json" };
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";

/** The fee column as the cartridge stores it, record 0..16. */
const ROM_FEES = [0, 300, 50, 230, 0, 500, 450, 830, 1000, 110, 1200, 600, 1350, 300, 2800, 4000, 0];

test("the fee column is the ROM's, to the value", () => {
  assert.equal(gateTable.recordCount, 17);
  assert.deepEqual(gateTable.records.map((record) => record.entranceFeeBits), ROM_FEES);
  // An earlier brief circulated 0,364,50,230,0,308,66,574,744,110,816,216,1350,
  // 108,2608,4320,0. Those were hand-converted low halves and are wrong; this
  // assertion exists so that list can never come back.
  assert.notDeepEqual(gateTable.records.map((r) => r.entranceFeeBits), ROM_FEES.map((v, i) => (i === 1 ? 364 : v)));
});

test("the index-to-biome mapping is read from the table, not inferred", () => {
  assert.match(gateTable.mappingEvidence, /C string/);
  const playable = gateTable.records.filter((r) => r.recordIndex !== gateTable.tutorialRecordIndex);
  assert.equal(playable.length, 16);
  assert.equal(new Set(playable.map((r) => r.biomeNodeName)).size, 16, "each biome exactly once");
  // Record 16 is the tutorial and reuses the Grass field at no cost.
  const tutorial = gateTable.records[gateTable.tutorialRecordIndex];
  assert.equal(tutorial.biomeNodeName, "Grass");
  assert.equal(tutorial.entranceFeeBits, 0);
  assert.equal(tutorial.displayName, "チュートリアル");
});

test("record 0 is the free starting gate the footage also shows at zero", () => {
  const first = gateTable.records[0];
  assert.equal(first.biomeNodeName, "Grass");
  assert.equal(first.displayName, "ダイナそうげん");
  assert.equal(first.entranceFeeBits, 0);
});

test("the fee is a rule, and the catalog records where that was proven", () => {
  assert.equal(gateTable.entranceFee.evidence, "ROM_VERIFIED");
  assert.equal(gateTable.entranceFee.compareSite, "OVL12:0x0210F84C");
  assert.equal(gateTable.entranceFee.deductSite, "OVL12:0x0210F874");
  assert.equal(gateTable.entranceFee.walletOffset, "player+0x4C8");
  // The waiver flag's effect is recorded; what SETS it is not modelled.
  assert.equal(gateTable.entranceFee.waiverFlagOffset, "player+0xEB8");
  assert.match(gateTable.entranceFee.waiverNote, /not traced/);
});

test("every product gate carries the fee and name its ROM record holds", () => {
  const byBiome = new Map(
    gateTable.records
      .filter((r) => r.recordIndex !== gateTable.tutorialRecordIndex)
      .map((r) => [r.biomeNodeName, r])
  );
  const gates = listChampionshipGates();
  assert.equal(gates.length, 16);
  for (const gate of gates) {
    const record = byBiome.get(gate.biomeId);
    assert.ok(record, `no ROM record for ${gate.biomeId}`);
    assert.equal(gate.entranceFeeBits, record.entranceFeeBits);
    // displayName is the product's Chinese copy; the cartridge's own string is
    // kept beside it as originalName so the transcription is never lost.
    assert.equal(gate.originalName, record.displayName);
    assert.equal(gate.originalNameEvidence, "ROM_VERIFIED");
    assert.ok(gate.displayName && gate.displayName.length > 0);
    assert.equal(gate.romRecordIndex, record.recordIndex);
  }
});

test("the signed neighbour is transcribed but not called money", () => {
  for (const record of gateTable.records) {
    assert.ok(Number.isSafeInteger(record.field1A));
    // It keeps its byte-offset name precisely because it can go negative.
    assert.ok(!("entranceFeeAlt" in record));
  }
  assert.ok(gateTable.records.some((record) => record.field1A > 0));
});
