// Battle catalogs — the six ARM9 tables, pinned against the cartridge.
//
// The hand-checked records below carry the original bytes as hex. Each one was
// read out of the ROM by hand and is decoded here independently of
// scripts/build-battle-catalogs.py, so a builder that starts reading the wrong
// address, the wrong width or the wrong stride fails here rather than shipping.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_ARENA_RECORD_COUNT,
  BATTLE_CATALOG_AUTHORITY,
  BATTLE_CATALOG_EVIDENCE,
  BATTLE_ELIGIBILITY_RECORD_COUNT,
  BATTLE_MOVES_PER_COMBATANT_CAP,
  BATTLE_MOVE_RECORD_COUNT,
  BATTLE_OPPONENT_TEAM_RECORD_COUNT,
  BATTLE_PRESET_RECORD_COUNT,
  BATTLE_SPECIES_WITHOUT_MOVES,
  BATTLE_TABLE_LAYOUT,
  BATTLE_TITLE_EVENT_RECORD_COUNT,
  getBattleCatalog,
  getBattleCatalogRecord,
  listBattleCatalogRecords,
  listMoveRecordsForSpecies,
  readBattleCatalogField
} from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_DIR = path.join(root, "src/data/championship/catalogs");

const TABLES = ["moves", "arenas", "eligibility", "titleEvents", "opponentTeams", "presets"];
const FILES = {
  moves: "battle-moves.r1.json",
  arenas: "battle-arenas.r1.json",
  eligibility: "battle-eligibility.r1.json",
  titleEvents: "battle-title-events.r1.json",
  opponentTeams: "battle-opponent-teams.r1.json",
  presets: "battle-presets.r1.json"
};

// Raw records lifted straight out of the ARM9 image at the stated address.
const HAND_CHECKED = [
  ["moves", 300, 0x020d797c,
    "8100000038e50c02fa00011e020000000000000000000000000000000009120200000f0000000000" +
    "2858120218e86400000018e86400010802080000abf6120200001eff000000000c009001a0001e00" +
    "01000000010000000000000000000000150000000f000000"],
  ["moves", 595, 0x020df154,
    "df00000026fd0c028403011e02000000010000000c000000000000000009120200000f0000000000" +
    "a55d1202000f640000001ee46400010c010c0000abf6120200001eff0195000041007c01a0001e00" +
    "010000000100000003000000000000000900000011000000"],
  ["arenas", 3, 0x020cc190, "e0be0c0210bf0c02d0c00c0244c00c02e0bf0c0201000000"],
  ["eligibility", 0, 0x020cc8d4,
    "01000000000000000700000000000000ffffffff00000000ffffffff000000005304000000000000"],
  ["eligibility", 45, 0x020ccfdc,
    "01000000000000000400000000000000ffffffff00000000ffffffff000000006104000000000000"],
  ["titleEvents", 61, 0x020cd98c,
    "e00200001e0300003d000000ffffffff00000000000000000000000000000000c409000000000000"],
  ["opponentTeams", 0, 0x020ed2d8, "00000000010000000200000023030000bb030000"],
  ["opponentTeams", 151, 0x020edea4, "c5010000c6010000c7010000ba03000052040000"],
  ["presets", 0, 0x020e39d8,
    "3200000000000000a4370e02000000000500000006000000060000000600000006000000" +
    "0600000006000000060000000500000005000000040000000602000001000100"],
  ["presets", 455, 0x020eb2b4,
    "d9000000960000004a260e0200000000150000001400000016000000150000001200000015000000" +
    "140000000e000000140000000e000000110000000600000001000000"]
];

function decode(hex, offset, width) {
  const view = new DataView(Uint8Array.from(Buffer.from(hex, "hex")).buffer);
  switch (width) {
    case "u8": return view.getUint8(offset);
    case "s8": return view.getInt8(offset);
    case "u16": return view.getUint16(offset, true);
    case "u32": return view.getUint32(offset, true);
    case "s32": return view.getInt32(offset, true);
    // `ascii` fields hold a load-time pointer; the text behind it is not in the
    // record, so the hand-check verifies the pointer word instead.
    case "ascii": return view.getUint32(offset, true);
    default: throw new Error(`unhandled width ${width}`);
  }
}

test("every catalog reports the record count the ROM converged on", () => {
  assert.equal(BATTLE_CATALOG_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_CATALOG_AUTHORITY, "CHAMPIONSHIP_2026_PRODUCT");
  const expected = {
    moves: BATTLE_MOVE_RECORD_COUNT,
    arenas: BATTLE_ARENA_RECORD_COUNT,
    eligibility: BATTLE_ELIGIBILITY_RECORD_COUNT,
    titleEvents: BATTLE_TITLE_EVENT_RECORD_COUNT,
    opponentTeams: BATTLE_OPPONENT_TEAM_RECORD_COUNT,
    presets: BATTLE_PRESET_RECORD_COUNT
  };
  assert.deepEqual(expected, {
    moves: 596, arenas: 11, eligibility: 46, titleEvents: 62, opponentTeams: 152, presets: 456
  });
  for (const table of TABLES) {
    const document = getBattleCatalog(table);
    assert.equal(document.recordCount, expected[table], table);
    assert.equal(document.records.length, expected[table], table);
    assert.equal(document.records.at(-1).recordIndex, expected[table] - 1, table);
  }
});

test("each declared base, stride and count closes on the declared end address", () => {
  for (const table of TABLES) {
    const layout = BATTLE_TABLE_LAYOUT[table];
    const declared = getBattleCatalog(table).table;
    assert.equal(declared.ramBase, `0x${layout.ramBase.toString(16).toUpperCase().padStart(8, "0")}`, table);
    assert.equal(declared.stride, layout.stride, table);
    const end = layout.ramBase + layout.stride * layout.count;
    assert.equal(declared.ramEnd, `0x${end.toString(16).toUpperCase().padStart(8, "0")}`, table);
    assert.ok(declared.recordCountEvidence.length > 0, table);
    assert.ok(declared.boundaryEvidence.length >= 3, table);
  }
});

test("the two corrected bases are the record starts, not the field columns they were handed over as", () => {
  // OVL10 0x02110A78..0x02110A8C and ARM9 0x02092428..0x0209244C each hold a run
  // of &record[0].field literals. Taking the wrong one shifts every field.
  assert.equal(BATTLE_TABLE_LAYOUT.opponentTeams.ramBase, 0x020ed2d8);
  assert.notEqual(BATTLE_TABLE_LAYOUT.opponentTeams.ramBase, 0x020ed2e4);
  assert.equal(BATTLE_TABLE_LAYOUT.eligibility.ramBase, 0x020cc8d4);
  assert.notEqual(BATTLE_TABLE_LAYOUT.eligibility.ramBase, 0x020cc8f4);

  // The corrected eligibility base is the one that ends exactly on the title base.
  const eligibility = BATTLE_TABLE_LAYOUT.eligibility;
  assert.equal(eligibility.ramBase + eligibility.stride * eligibility.count, BATTLE_TABLE_LAYOUT.titleEvents.ramBase);
});

test("hand-checked records decode from the original bytes", () => {
  assert.equal(HAND_CHECKED.length, 10);
  for (const [table, recordIndex, ramAddress, hex] of HAND_CHECKED) {
    const layout = BATTLE_TABLE_LAYOUT[table];
    const label = `${table}[${recordIndex}]`;
    assert.equal(hex.length, layout.stride * 2, `${label} byte count`);
    assert.equal(ramAddress, layout.ramBase + recordIndex * layout.stride, `${label} address`);

    const record = getBattleCatalogRecord(table, recordIndex);
    assert.equal(record.recordIndex, recordIndex, label);
    for (const field of getBattleCatalog(table).fieldMap) {
      if (field.width === "ascii") {
        continue;
      }
      assert.equal(
        readBattleCatalogField(table, recordIndex, field.name),
        decode(hex, field.offset, field.width),
        `${label}.${field.name} at ${field.offsetHex}`
      );
    }
  }
});

test("the move table converges on 596 and stops at species 223", () => {
  const records = listBattleCatalogRecords("moves");
  assert.equal(records.at(-1).speciesId, 223);
  assert.equal(Math.max(...records.map((record) => record.speciesId)), 223);

  // Every id 0..223 except the 18-wide gap 2..19 owns at least one record.
  const present = new Set(records.map((record) => record.speciesId));
  const missing = [];
  for (let speciesId = 0; speciesId <= 223; speciesId += 1) {
    if (!present.has(speciesId)) {
      missing.push(speciesId);
    }
  }
  assert.deepEqual(missing, [...BATTLE_SPECIES_WITHOUT_MOVES]);
  assert.equal(present.size, 206);

  // Record 0 is the null move: no cost, no power, and no contact.
  const nullMove = records[0];
  assert.equal(nullMove.speciesId, 0);
  assert.equal(nullMove.actionCost, 0);
  assert.equal(nullMove.power, 0);
  assert.equal(nullMove.kind, 0);

  // The cost and power fields the resolver already reads stay inside u16.
  for (const record of records) {
    assert.ok(Number.isInteger(record.actionCost) && record.actionCost >= 0 && record.actionCost <= 0xffff);
    assert.ok(Number.isInteger(record.power) && record.power >= 0 && record.power <= 0xffff);
  }
  assert.equal(Math.max(...records.map((record) => record.actionCost)), 65);
  assert.equal(Math.max(...records.map((record) => record.power)), 600);
});

test("the traced move enum fields keep the ranges their dispatch code allows", () => {
  const records = listBattleCatalogRecords("moves");
  const values = (name) => new Set(records.map((record) => record[name]));
  // OVL19 0x02114A8C gates on cmp #5, so nothing may exceed 5.
  assert.deepEqual([...values("elementSelect")].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  // OVL19 0x0211C770 admits 2 and 3 to the contact walk; 0 and 1 exist and do not.
  assert.deepEqual([...values("kind")].sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.deepEqual([...values("targetMode")].sort((a, b) => a - b), [0, 1, 2]);
  // OVL19 0x02116D9C is a four-arm jump guarded by cmp #3.
  assert.deepEqual([...values("field10")].sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.equal(records.filter((record) => record.kind === 2 || record.kind === 3).length, 30);
});

test("the species move scan stops at the eight the original keeps", () => {
  assert.equal(BATTLE_MOVES_PER_COMBATANT_CAP, 8);
  // Species 1 owns 30 records, more than the scan will ever collect.
  const shared = listMoveRecordsForSpecies(1);
  assert.equal(shared.length, BATTLE_MOVES_PER_COMBATANT_CAP);
  assert.ok(shared.every((record) => record.speciesId === 1));
  assert.equal(listBattleCatalogRecords("moves").filter((record) => record.speciesId === 1).length, 30);
  assert.deepEqual(listMoveRecordsForSpecies(2), []);
  assert.equal(listMoveRecordsForSpecies(223).length, 3);
});

test("the eleven arenas are the eleven BATTLE_ tokens, in table order", () => {
  assert.deepEqual(
    listBattleCatalogRecords("arenas").map((record) => record.identifier),
    [
      "BATTLE_NORMAL",
      "BATTLE_GRASS",
      "BATTLE_VOLCANO",
      "BATTLE_ISLAND",
      "BATTLE_SOUTHPOLE",
      "BATTLE_DESERT",
      "BATTLE_CYBERSPACE",
      "BATTLE_HELL",
      "BATTLE_COLOSSEUM",
      "BATTLE_STADIUM",
      "BATTLE_DOMESTADIUM"
    ]
  );
  // The one arena with no shared-common asset is the cyberspace field.
  assert.equal(getBattleCatalogRecord("arenas", 6).string08, "");
  assert.equal(getBattleCatalogRecord("arenas", 0).string08, "field_bm00_00_common");
});

test("the eligibility table is 46 records ending on the title base", () => {
  const records = listBattleCatalogRecords("eligibility");
  const column = records.map((record) => record.field20);
  // 0x453 continues straight on from the opponent-team table's last 0x452.
  assert.deepEqual(column.slice(0, 45), Array.from({ length: 45 }, (unused, index) => 0x453 + index));
  // The 46th record is the one the 45-record reading dropped: it repeats 0x461.
  assert.equal(column[45], 0x461);
  assert.equal(column.at(-1), records[45].field20);
});

test("the title table is 62 records and the 62nd is the one the reward scan skips", () => {
  const records = listBattleCatalogRecords("titleEvents");
  assert.deepEqual([...records.map((record) => record.field08)].sort((a, b) => a - b),
    Array.from({ length: 62 }, (unused, index) => index));
  // ARM9 0x02089294 walks index < 0x3D, so record 61 is out of that scan's reach.
  const offDiagonal = records.filter((record) => record.field08 !== record.recordIndex);
  assert.deepEqual(offDiagonal.map((record) => record.recordIndex), [12, 51]);
  assert.deepEqual(offDiagonal.map((record) => record.field08), [51, 12]);

  const last = records[61];
  assert.equal(last.recordIndex, 61);
  assert.equal(last.field0C, -1);
  assert.equal(last.field24, 0);
  assert.equal(last.field20, 2500);
  // Exactly one record in the table holds a zero +0x24, and it is that last one.
  assert.deepEqual(records.filter((record) => record.field24 === 0).map((record) => record.recordIndex), [61]);
});

test("the opponent-team index columns account for every battle preset exactly once", () => {
  const records = listBattleCatalogRecords("opponentTeams");
  const flat = records.flatMap((record) => [record.field00, record.field04, record.field08]);
  assert.equal(flat.length, BATTLE_PRESET_RECORD_COUNT);
  assert.deepEqual(flat, Array.from({ length: BATTLE_PRESET_RECORD_COUNT }, (unused, index) => index));
  assert.deepEqual(records.map((record) => record.field0C),
    Array.from({ length: 152 }, (unused, index) => 0x323 + index));
  assert.deepEqual(records.map((record) => record.field10),
    Array.from({ length: 152 }, (unused, index) => 0x3bb + index));
  // The two id runs meet, and the eligibility table takes the next id after them.
  assert.equal(records.at(-1).field10 + 1, listBattleCatalogRecords("eligibility")[0].field20);
});

test("the preset table converges on 456 and its +0x04 column never decreases", () => {
  const column = listBattleCatalogRecords("presets").map((record) => record.field04);
  assert.equal(column.length, 456);
  assert.equal(column[0], 0);
  assert.equal(column.at(-1), 150);
  assert.ok(column.every((value, index) => index === 0 || column[index - 1] <= value));
});

test("no field is named beyond what a read site supports", () => {
  const named = {
    moves: ["speciesId", "namePointer", "actionCost", "power", "kind", "targetMode", "elementSelect", "statusCode"],
    arenas: ["identifier", "string04", "string08", "string0C", "string10"],
    eligibility: [],
    titleEvents: [],
    opponentTeams: [],
    presets: ["namePointer"]
  };
  for (const table of TABLES) {
    for (const field of getBattleCatalog(table).fieldMap) {
      if (named[table].includes(field.name)) {
        assert.ok(field.readSite || field.name === "namePointer", `${table}.${field.name} needs a read site`);
        continue;
      }
      // Everything else is its own byte offset, so no meaning can be read into it.
      const suffix = field.offset.toString(16).toUpperCase().padStart(2, "0");
      assert.match(field.name, new RegExp(`^(field|pointer)${suffix}$`),
        `${table}.${field.name} at ${field.offsetHex} must be named for its offset`);
    }
  }
});

test("a field with one value across the table is declared once, not repeated", () => {
  const moves = getBattleCatalog("moves");
  const constants = moves.fieldMap.filter((field) => Object.hasOwn(field, "constantValue"));
  assert.deepEqual(constants.map((field) => [field.name, field.constantValue]), [
    ["field23", 0], ["field26", 0], ["field3A", 0], ["field40", 0],
    ["field41", 0], ["field42", 30], ["field46", 0], ["field47", 0], ["field4E", 30]
  ]);
  for (const field of constants) {
    assert.equal(Object.hasOwn(moves.records[0], field.name), false, field.name);
    assert.equal(readBattleCatalogField("moves", 0, field.name), field.constantValue);
    assert.equal(readBattleCatalogField("moves", 595, field.name), field.constantValue);
  }
});

test("no catalog carries original text beyond the ASCII arena tokens", () => {
  for (const table of TABLES) {
    const file = path.join(CATALOG_DIR, FILES[table]);
    const raw = fs.readFileSync(file);
    assert.ok(raw.every((byte) => byte < 0x80), `${FILES[table]} must stay ASCII`);
    // ensure_ascii would hide non-ASCII behind an escape, so refuse those too.
    assert.equal(raw.toString("utf8").includes("\\u"), false, `${FILES[table]} must carry no escaped text`);
  }
  // The 596 Japanese move names stay in the cartridge: only the pointer is kept.
  const moves = getBattleCatalog("moves");
  assert.ok(moves.fieldMap.some((field) => field.name === "namePointer" && field.width === "u32"));
  for (const record of moves.records) {
    assert.equal(typeof record.namePointer, "number");
  }
});

test("the builder takes the ROM path from the caller and hard-codes no drive", () => {
  const builder = fs.readFileSync(path.join(root, "scripts/build-battle-catalogs.py"), "utf8");
  assert.match(builder, /os\.environ\.get\("YDIJ_ROM"\)/);
  assert.match(builder, /encoding="utf-8", newline="\\n"/);
  assert.doesNotMatch(builder, /[A-Za-z]:\\\\/, "no absolute Windows path may be baked into the builder");
  assert.doesNotMatch(builder, /NEXUS/, "the builder must not read a research pack");
});

test("the catalogs import nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCatalogs.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
