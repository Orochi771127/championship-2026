// Match selection and eligibility — ARM9 0x0208922C filter, OVL10 driver.
//
// The load-bearing case is `the two schedule columns partition every reachable
// record`: across the 4 x 8 grid the filter compares against, all 61 records the
// scan can reach appear exactly once. That is what makes +0x14 and +0x18 a
// schedule key rather than two fields that happen to be small.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_MATCH_DRIVER_SITE,
  BATTLE_MATCH_ENTRY_FEE_FIELD,
  BATTLE_MATCH_EMPTY_SLOT,
  BATTLE_MATCH_EVIDENCE,
  BATTLE_MATCH_FILTER_SITE,
  BATTLE_MATCH_LIST_CAP,
  BATTLE_MATCH_PAYOUT_FIELD,
  BATTLE_MATCH_SCAN_LIMIT,
  BATTLE_MATCH_SCHEDULE_SLOT_A_MODULUS,
  BATTLE_MATCH_SCHEDULE_SLOT_B_MODULUS,
  BATTLE_MATCH_SPECIAL_ENTRY_MODE,
  BATTLE_MATCH_SPECIAL_RECORD_INDEX,
  expandOpponentTeam,
  getMatchRecord,
  matchEntryFee,
  matchPayout,
  resolveMatchList,
  selectEligibleMatches
} from "../src/championship/battle/battleMatchSelection.js";

import {
  BATTLE_OPPONENT_TEAM_RECORD_COUNT,
  BATTLE_PRESET_RECORD_COUNT,
  BATTLE_TITLE_EVENT_RECORD_COUNT,
  listBattleCatalogRecords
} from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OPEN = 0xffff; // progress counter high enough to clear every requirement

function everyCell(callback) {
  for (let slotA = 0; slotA < BATTLE_MATCH_SCHEDULE_SLOT_A_MODULUS; slotA += 1) {
    for (let slotB = 0; slotB < BATTLE_MATCH_SCHEDULE_SLOT_B_MODULUS; slotB += 1) {
      callback(slotA, slotB);
    }
  }
}

test("the filter's bounds are the immediates the ROM compares against", () => {
  assert.equal(BATTLE_MATCH_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_MATCH_FILTER_SITE, "ARM9:0x0208922C");
  assert.equal(BATTLE_MATCH_DRIVER_SITE, "OVL10:0x0210EC30");
  assert.equal(BATTLE_MATCH_SCAN_LIMIT, 61);
  assert.equal(BATTLE_MATCH_LIST_CAP, 5);
  assert.equal(BATTLE_MATCH_SPECIAL_RECORD_INDEX, 61);
  assert.equal(BATTLE_MATCH_SPECIAL_ENTRY_MODE, 4);
  assert.equal(BATTLE_MATCH_SCHEDULE_SLOT_A_MODULUS, 4);
  assert.equal(BATTLE_MATCH_SCHEDULE_SLOT_B_MODULUS, 8);
  assert.equal(BATTLE_MATCH_EMPTY_SLOT, -1);
  // The scan stops one short of the table, which is the whole point of record 61.
  assert.equal(BATTLE_MATCH_SCAN_LIMIT + 1, BATTLE_TITLE_EVENT_RECORD_COUNT);
});

test("the two schedule columns partition every reachable record", () => {
  const seen = new Map();
  const sizes = [];
  everyCell((slotA, slotB) => {
    const records = selectEligibleMatches({
      scheduleSlotA: slotA, scheduleSlotB: slotB, progressCounter: OPEN, listCap: 99
    });
    sizes.push(records.length);
    for (const recordIndex of records) {
      assert.equal(seen.has(recordIndex), false, `record ${recordIndex} is in two cells`);
      seen.set(recordIndex, [slotA, slotB]);
    }
  });
  // 32 cells, and between them exactly the 61 records the scan can reach.
  assert.equal(sizes.length, 32);
  assert.equal(seen.size, BATTLE_MATCH_SCAN_LIMIT);
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), Array.from({ length: 61 }, (unused, i) => i));

  // One cell of the grid holds no match at all.
  assert.equal(sizes.filter((size) => size === 0).length, 1);
  assert.deepEqual(
    selectEligibleMatches({ scheduleSlotA: 3, scheduleSlotB: 4, progressCounter: OPEN, listCap: 99 }),
    []
  );

  // The busiest cell holds four, so OVL10's cap of five never actually binds.
  assert.equal(Math.max(...sizes), 4);
  assert.ok(Math.max(...sizes) < BATTLE_MATCH_LIST_CAP);
});

test("the progress gate is `requirement <= counter >> 1`", () => {
  // Record 2 is the only match in its cell and is the earliest that needs 4.
  const record = getMatchRecord(2);
  assert.equal(record.field10, 4);
  assert.equal(record.field14, 1);
  assert.equal(record.field18, 0);

  const cell = { scheduleSlotA: 1, scheduleSlotB: 0 };
  assert.deepEqual(selectEligibleMatches({ ...cell, progressCounter: 7 }), []);
  assert.deepEqual(selectEligibleMatches({ ...cell, progressCounter: 8 }), [2]);
  assert.deepEqual(selectEligibleMatches({ ...cell, progressCounter: 9 }), [2]);
  // The compare is `<=`, so a requirement of 0 is open from a counter of 0.
  const zeroRequirement = listBattleCatalogRecords("titleEvents")
    .slice(0, BATTLE_MATCH_SCAN_LIMIT)
    .find((entry) => entry.field10 === 0);
  assert.deepEqual(
    selectEligibleMatches({
      scheduleSlotA: zeroRequirement.field14,
      scheduleSlotB: zeroRequirement.field18,
      progressCounter: 0
    }).includes(zeroRequirement.recordIndex),
    true
  );
});

test("the cap keeps the first matches in table order", () => {
  const full = selectEligibleMatches({ scheduleSlotA: 2, scheduleSlotB: 1, progressCounter: OPEN, listCap: 99 });
  assert.equal(full.length, 4);
  assert.deepEqual([...full].sort((a, b) => a - b), [...full], "results come out in table order");
  for (let cap = 0; cap <= full.length; cap += 1) {
    assert.deepEqual(
      selectEligibleMatches({ scheduleSlotA: 2, scheduleSlotB: 1, progressCounter: OPEN, listCap: cap }),
      full.slice(0, cap)
    );
  }
});

test("record 61 is unreachable through the filter and is the table's only zero entry fee", () => {
  everyCell((slotA, slotB) => {
    const records = selectEligibleMatches({
      scheduleSlotA: slotA, scheduleSlotB: slotB, progressCounter: OPEN, listCap: 99
    });
    assert.equal(records.includes(BATTLE_MATCH_SPECIAL_RECORD_INDEX), false, `${slotA},${slotB}`);
  });

  const reachable = listBattleCatalogRecords("titleEvents").slice(0, BATTLE_MATCH_SCAN_LIMIT);
  assert.equal(reachable.filter((entry) => entry.field24 === 0).length, 0,
    "every record the filter can offer charges an entry fee");
  assert.equal(matchEntryFee(BATTLE_MATCH_SPECIAL_RECORD_INDEX), 0);
  assert.equal(matchEntryFee(60), 36000);
  assert.equal(matchPayout(BATTLE_MATCH_SPECIAL_RECORD_INDEX), 2500,
    "its reward source is nonzero; result mode gates decide whether it is paid");
  assert.equal(matchPayout(60), 280000);
});

test("fee and reward match the independent ROM reader/debit/credit fixture", () => {
  // This receipt was produced directly from the owner ROM, without reading any
  // product catalog, and includes the OVL10/OVL8 readers and wallet writers.
  const fixture = JSON.parse(fs.readFileSync(path.join(root,
    "docs/reports/parity-audit/2026-09-05/battle-fee-payout-rom-check.json"), "utf8"));
  assert.equal(fixture.rom.sha256, "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1");
  assert.equal(BATTLE_MATCH_ENTRY_FEE_FIELD, "field24");
  assert.equal(BATTLE_MATCH_PAYOUT_FIELD, "field20");
  for (const record of fixture.records) {
    assert.equal(matchEntryFee(record.recordIndex), record.fields.field24);
    assert.equal(matchPayout(record.recordIndex), record.fields.field20);
  }
  assert.equal(matchEntryFee(0), 150);
  assert.equal(matchPayout(0), 7000);
});

test("entry mode 4 replaces the list with that one record", () => {
  const special = resolveMatchList({ entryMode: BATTLE_MATCH_SPECIAL_ENTRY_MODE });
  assert.equal(special.source, "ENTRY_MODE_OVERRIDE");
  assert.deepEqual(special.records, [BATTLE_MATCH_SPECIAL_RECORD_INDEX]);
  // It does not consult the schedule at all, so it needs no slots.
  assert.doesNotThrow(() => resolveMatchList({ entryMode: 4 }));

  const normal = resolveMatchList({
    entryMode: 0, scheduleSlotA: 2, scheduleSlotB: 1, progressCounter: OPEN
  });
  assert.equal(normal.source, "SCHEDULE_FILTER");
  assert.deepEqual(normal.records, selectEligibleMatches({
    scheduleSlotA: 2, scheduleSlotB: 1, progressCounter: OPEN
  }));
  // Every other mode runs the filter; only 4 is special.
  for (const entryMode of [0, 1, 2, 3, 5, 6]) {
    assert.equal(
      resolveMatchList({ entryMode, scheduleSlotA: 0, scheduleSlotB: 0, progressCounter: OPEN }).source,
      "SCHEDULE_FILTER"
    );
  }
});

test("a team expands into the three preset indices its columns hold", () => {
  assert.deepEqual(expandOpponentTeam(0), [0, 1, 2]);
  assert.deepEqual(expandOpponentTeam(151), [453, 454, 455]);
  assert.deepEqual(expandOpponentTeam(BATTLE_MATCH_EMPTY_SLOT), []);

  // Every team resolves, and between them they name each preset exactly once.
  const named = [];
  for (let teamIndex = 0; teamIndex < BATTLE_OPPONENT_TEAM_RECORD_COUNT; teamIndex += 1) {
    const presets = expandOpponentTeam(teamIndex);
    assert.equal(presets.length, 3, `team ${teamIndex}`);
    named.push(...presets);
  }
  assert.equal(named.length, BATTLE_PRESET_RECORD_COUNT);
  assert.deepEqual(named, Array.from({ length: BATTLE_PRESET_RECORD_COUNT }, (unused, i) => i));

  assert.throws(() => expandOpponentTeam(152), /UNKNOWN_TEAM/);
  assert.throws(() => expandOpponentTeam(1.5), /TEAMINDEX_MUST_BE_AN_INTEGER/);
});

test("the inputs the original reads as integers are required as integers", () => {
  const base = { scheduleSlotA: 0, scheduleSlotB: 0, progressCounter: 0 };
  assert.throws(() => selectEligibleMatches(null), /SELECT_REQUIRES_AN_OBJECT/);
  assert.throws(() => selectEligibleMatches({ ...base, scheduleSlotA: 1.5 }), /SCHEDULESLOTA_MUST_BE_AN_INTEGER/);
  assert.throws(() => selectEligibleMatches({ ...base, progressCounter: -1 }), /PROGRESS_COUNTER_MUST_BE_A_U16/);
  assert.throws(() => selectEligibleMatches({ ...base, progressCounter: 0x10000 }), /PROGRESS_COUNTER_MUST_BE_A_U16/);
  assert.throws(() => selectEligibleMatches({ ...base, listCap: -1 }), /LIST_CAP_MUST_NOT_BE_NEGATIVE/);
  assert.throws(() => resolveMatchList({}), /ENTRYMODE_MUST_BE_AN_INTEGER/);
  assert.throws(() => getMatchRecord(62), /UNKNOWN_RECORD/);
  // A slot outside the moduli is simply never matched, not an error: the
  // original computes the slot with a remainder and does no range check.
  assert.deepEqual(selectEligibleMatches({ ...base, scheduleSlotA: 9, progressCounter: OPEN }), []);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMatchSelection.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
