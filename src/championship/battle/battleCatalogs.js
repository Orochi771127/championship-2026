// Battle catalogs — the six original ARM9 tables the battle modules had no data for.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 by
// scripts/build-battle-catalogs.py, which re-reads the cartridge on every run
// and refuses to emit anything whose record count does not converge. Runtime
// imports only the generated JSON; the ROM never enters the bundle.
//
// WHAT A FIELD NAME MEANS HERE
// ----------------------------
// A field is named only where a load instruction was traced and the code around
// it says what the value does. Everything else keeps its byte offset as its
// name — `field34`, `pointer28` — because a plausible name for an untraced
// field is an invention, and an invention is how a rebuild stops playing like
// the original. Each field carries its own `readSite` in the catalog's
// `fieldMap`, so a later pass can promote a name by citing an address rather
// than by guessing.
//
// TWO BASES IN THE BRIEF WERE FIELD COLUMNS, NOT RECORD STARTS
// ------------------------------------------------------------
// The opponent-team table was handed over as 0x020ED2E4 and the eligibility
// table as 0x020CC8F4. Both are columns inside a record, not the record's
// first byte. ARM/Thumb compilers address `table[i].field` by keeping
// `&table[0].field` in the literal pool, so any one of a record's fields can
// look like the table base if you find that literal first:
//
//   OVL10 0x02110A78..0x02110A8C   0x020ED2D8 0x020ED2DC 0x020ED2E0 0x020ED2E4
//   ARM9  0x02092428..0x0209244C   0x020CC8D4 … 0x020CC8F0 0x020CC8F8
//
// The lowest literal in each run is the record base: 0x020ED2D8 and
// 0x020CC8D4. Correcting them moves the opponent-team fields three columns
// left, and turns the eligibility table from 45 records that stop eight bytes
// short of the next table into 46 that end exactly on it.
//
// WHAT IS DELIBERATELY ABSENT
// ---------------------------
// The move table's +0x04 is a pointer into a UTF-16LE Japanese name pool. The
// pointer is transcribed because it is the only stable per-record
// discriminator; the text behind it is not, and must not be. Arena strings are
// ASCII asset tokens and are transcribed as text.
//
// Nothing here is wired into the battle modules or the app. This is the data
// those modules were missing, published as data.

import arenaDocument from "../../data/championship/catalogs/battle-arenas.r1.json" with { type: "json" };
import eligibilityDocument from "../../data/championship/catalogs/battle-eligibility.r1.json" with { type: "json" };
import moveDocument from "../../data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import opponentTeamDocument from "../../data/championship/catalogs/battle-opponent-teams.r1.json" with { type: "json" };
import presetDocument from "../../data/championship/catalogs/battle-presets.r1.json" with { type: "json" };
import titleEventDocument from "../../data/championship/catalogs/battle-title-events.r1.json" with { type: "json" };

export const BATTLE_CATALOG_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_CATALOG_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

/** Record counts, each one converged against the ROM before the JSON was written. */
export const BATTLE_MOVE_RECORD_COUNT = 596;
export const BATTLE_ARENA_RECORD_COUNT = 11;
export const BATTLE_ELIGIBILITY_RECORD_COUNT = 46;
export const BATTLE_TITLE_EVENT_RECORD_COUNT = 62;
export const BATTLE_OPPONENT_TEAM_RECORD_COUNT = 152;
export const BATTLE_PRESET_RECORD_COUNT = 456;

/** ARM9 record bases and strides, as the code forms them. */
export const BATTLE_TABLE_LAYOUT = Object.freeze({
  moves: Object.freeze({ ramBase: 0x020cff9c, stride: 0x68, count: BATTLE_MOVE_RECORD_COUNT }),
  arenas: Object.freeze({ ramBase: 0x020cc148, stride: 0x18, count: BATTLE_ARENA_RECORD_COUNT }),
  eligibility: Object.freeze({ ramBase: 0x020cc8d4, stride: 0x28, count: BATTLE_ELIGIBILITY_RECORD_COUNT }),
  titleEvents: Object.freeze({ ramBase: 0x020cd004, stride: 0x28, count: BATTLE_TITLE_EVENT_RECORD_COUNT }),
  opponentTeams: Object.freeze({ ramBase: 0x020ed2d8, stride: 0x14, count: BATTLE_OPPONENT_TEAM_RECORD_COUNT }),
  presets: Object.freeze({ ramBase: 0x020e39d8, stride: 0x44, count: BATTLE_PRESET_RECORD_COUNT })
});

/**
 * The move-record scan at OVL19 0x02113D88 keeps at most this many records for
 * one combatant: `ldrb sb,[r0,#0x9c] ; cmp sb,#8 ; bhs` abandons the walk once
 * eight are collected.
 */
export const BATTLE_MOVES_PER_COMBATANT_CAP = 8;

/** Species ids with no move record at all: the 18-wide gap 2..19. */
export const BATTLE_SPECIES_WITHOUT_MOVES = Object.freeze(
  Array.from({ length: 18 }, (unused, index) => index + 2)
);

const DOCUMENTS = new Map([
  ["moves", [moveDocument, BATTLE_MOVE_RECORD_COUNT]],
  ["arenas", [arenaDocument, BATTLE_ARENA_RECORD_COUNT]],
  ["eligibility", [eligibilityDocument, BATTLE_ELIGIBILITY_RECORD_COUNT]],
  ["titleEvents", [titleEventDocument, BATTLE_TITLE_EVENT_RECORD_COUNT]],
  ["opponentTeams", [opponentTeamDocument, BATTLE_OPPONENT_TEAM_RECORD_COUNT]],
  ["presets", [presetDocument, BATTLE_PRESET_RECORD_COUNT]]
]);

function catalogError(message) {
  return new Error(`BATTLE_CATALOG_${message}`);
}

/** One of "moves" | "arenas" | "eligibility" | "titleEvents" | "opponentTeams" | "presets". */
export function getBattleCatalog(name) {
  const entry = DOCUMENTS.get(name);
  if (!entry) {
    throw catalogError(`UNKNOWN_TABLE: ${name}`);
  }
  const [document, expected] = entry;
  if (document.recordCount !== expected || document.records.length !== expected) {
    throw catalogError(`RECORD_COUNT_MISMATCH: ${name}`);
  }
  return document;
}

export function listBattleCatalogRecords(name) {
  return getBattleCatalog(name).records;
}

export function getBattleCatalogRecord(name, recordIndex) {
  const record = listBattleCatalogRecords(name)[recordIndex];
  if (!record || record.recordIndex !== recordIndex) {
    throw catalogError(`UNKNOWN_RECORD: ${name}[${recordIndex}]`);
  }
  return record;
}

/**
 * A field that holds one value across every record is declared once in the
 * `fieldMap` with `constantValue` instead of repeating on all N records, so a
 * reader must go through here rather than through `record[name]` alone.
 */
export function readBattleCatalogField(name, recordIndex, fieldName) {
  const record = getBattleCatalogRecord(name, recordIndex);
  if (Object.hasOwn(record, fieldName)) {
    return record[fieldName];
  }
  const declared = getBattleCatalog(name).fieldMap.find((field) => field.name === fieldName);
  if (!declared) {
    throw catalogError(`UNKNOWN_FIELD: ${name}.${fieldName}`);
  }
  return declared.constantValue;
}

/**
 * Every move record for one species, in table order. The original scan compares
 * record +0x00 against the combatant's own +0x00 and stops after eight, which is
 * why the cap is applied here rather than left to the caller.
 *
 * The cap belongs to this scan alone. A second loop at OVL19 0x02113E04 appends
 * up to two more records from combatant +0x12C and +0x130 without re-checking
 * the count, so the combatant's finished list can hold ten. Those two come from
 * combatant state, not from the species, so they are not this function's to add.
 */
export function listMoveRecordsForSpecies(speciesId) {
  if (!Number.isInteger(speciesId) || speciesId < 0) {
    throw catalogError("INVALID_SPECIES_ID");
  }
  const matches = [];
  for (const record of listBattleCatalogRecords("moves")) {
    if (record.speciesId !== speciesId) {
      continue;
    }
    matches.push(record);
    if (matches.length === BATTLE_MOVES_PER_COMBATANT_CAP) {
      break;
    }
  }
  return matches;
}

/** OVL19 02113E04..02113E48 appends the individual's two learned records. */
export function listMoveRecordsForCombatant(combatant) {
  const moves=listMoveRecordsForSpecies(combatant.speciesId);
  for(const id of [combatant.source12C,combatant.source130]){
    if(id!==undefined&&id!==0)moves.push(getBattleCatalogRecord('moves',id));
  }
  return moves;
}
