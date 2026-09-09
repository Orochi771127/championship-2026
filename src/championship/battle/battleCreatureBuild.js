// Creature build — how an opponent preset becomes something a battle can fight.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// Every module in this lane reads a combatant's stats and none of them said
// where those stats come from. Until this, a battle could only be run on made-up
// inputs, which would have made every traced number -- the 7200-frame limit, the
// 90 - 2*speed cooldown, the crit thresholds, the AI ladder -- meaningless to
// watch, because they would have been computed over invented values.
//
// WHERE A MATCH GETS ITS THREE OPPONENTS  (OVL10 0x021105A8)
// ----------------------------------------------------------
//   021105D4  ldr r1, [pc, #0x4a8]     0x020E39D8, the preset table
//   021105D8  mov r0, #0x44
//   021105DC  mla sb, r2, r0, r1       preset := table[index]
//   021105E8  ldm sb!, {r0, r1, r2, r3}
//   021105EC  stm r8!, {r0, r1, r2, r3}   0x44 bytes copied to the stack
//   02110600  ldrb r0, [sp, #0x1d4]
//   02110604  cmp  r0, #0xe4
//   02110608  beq  #0x2110a30          this preset holds no creature
//   02110630  bl   #0x2062900          build the creature
//   02110A34  cmp  r4, #3              three of them
//
// THE BUILD  (ARM9 0x02062900)
// ----------------------------
// The mapping below was NOT read by eye. The straight-line tail was emulated
// over the decoded instruction stream and the destinations printed, because two
// addresses in this work were computed wrong by hand-reading and one cooldown
// formula with them.
//
//   0206291C  ldr r1, [pc, #0x2e4]     0x020C1374, the species table
//   02062924  mla r8, ip, r0, r1       species := table[preset.byte00], 0x84 each
//   0206294C  str ip, [r6]             creature+0x00 := the species id
//   02062AA4  ldr r0, [pc, #0x160]     0x020CA008, the stat curve
//   02062AB0  lsl r2, r2, #4
//   02062AB4  ldrsh r2, [r0, r2]       curve[species[0x30]] column 0
//   02062AC0  str r2, [r6, #0x58]
//   02062AC4  str r2, [r6, #0x50]      HP: current and maximum, both
//   02062AEC  str r0, [r6, #0x54]      resource, from curve column 1
//   02062BF0  ldrb r0, [r5, #0x3d]
//   02062BF4  str r0, [r6, #0x12c]     and the two AI candidate sources
//
// So a creature is a species id plus ten small level numbers, and every stat is
// a lookup: curve[level]. The HP level comes from the SPECIES record; the other
// nine come from the PRESET. Nothing is computed, which is why nothing is
// invented here either.
//
// THE CURVE
// ---------
// 27 rows of eight u16 at 0x020CA008. Column 0 runs 200 to 7000 and is the HP
// column. Columns 1 through 6 are byte-identical to one another, which is why
// the compiler could keep one base register across five consecutive loads and
// why sharing a column changes no observable value. Column 7 exists, runs 4 to
// 20, and this builder never reads it.
//
// TWO THINGS THAT LOOK LIKE BUGS AND ARE NOT
// ------------------------------------------
// One preset record carries -1 in a level field. Multiplied by 16 that would
// read two bytes in front of the curve. It never happens: that record is one of
// the 27 that name species 0xE4, and 0x02110604 skips those before any level
// field is read. Do not clamp it, and do not "fix" the -1.
//
// The species table has 0xE4 records and 0xE4 is also the absent marker, so the
// marker is one past the last valid id rather than a magic number chosen for it.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// The nine stats other than HP and the resource keep their creature offsets as
// their names: this path proves where each value comes from, not what any of
// them means. The player's own three creatures do not come through here at all
// -- that is a separate source, and this lane has not traced it.

import { deepFreeze } from "../contracts/championshipContracts.js";
import curveCatalog from "../../data/championship/catalogs/creature-stat-curve.r1.json" with { type: "json" };
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };

export const BATTLE_CREATURE_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_CREATURE_BUILD_SITE = "ARM9:0x02062900";
export const BATTLE_CREATURE_EXPAND_SITE = "OVL10:0x021105A8";
export const BATTLE_CREATURE_LOADER_SITE = "OVL19:0x02113D88";

/** `cmp r4, #3` at OVL10 0x02110A34. */
export const BATTLE_CREATURE_OPPONENTS_PER_MATCH = 3;

/** `mov r0, #0x18c` at OVL19 0x0210CAD8, and 0x1C8 for the creature record. */
export const BATTLE_COMBATANT_SIZE = 0x18c;
export const BATTLE_CREATURE_SIZE = 0x1c8;

/** The id one past the last species, which a preset uses to mean "no creature". */
export const BATTLE_CREATURE_ABSENT_SPECIES = speciesCatalog.absentSpeciesId;
export const BATTLE_CREATURE_SPECIES_COUNT = speciesCatalog.table.recordCount;

export const BATTLE_CREATURE_CURVE = deepFreeze(curveCatalog.rows.map((row) => deepFreeze([...row])));
export const BATTLE_CREATURE_CURVE_ROWS = curveCatalog.table.rowCount;
export const BATTLE_CREATURE_CURVE_COLUMNS = curveCatalog.table.columnCount;

/** Column 0 is HP; the builder never reads column 7. */
export const BATTLE_CREATURE_HP_COLUMN = 0;
export const BATTLE_CREATURE_RESOURCE_COLUMN = 1;
export const BATTLE_CREATURE_UNREAD_COLUMN = 7;

/**
 * Each preset level field, the creature offset that keeps the level unchanged,
 * the offset that receives the looked-up value, and the curve column used. Taken
 * from the emulated destinations, in the order the builder writes them.
 */
export const BATTLE_CREATURE_STAT_MAP = deepFreeze([
  // field14 is the only level the builder does not keep a copy of: it writes the
  // looked-up value to two offsets and the level itself to none.
  { preset: "field14", level: null, value: 0x54, mirror: 0x5c, column: 1 },
  { preset: "field18", level: 0x84, value: 0x60, mirror: null, column: 2 },
  { preset: "field1C", level: 0x88, value: 0x64, mirror: null, column: 3 },
  { preset: "field20", level: 0x8c, value: 0x68, mirror: null, column: 4 },
  { preset: "field24", level: 0x90, value: 0x6c, mirror: null, column: 5 },
  { preset: "field28", level: 0x94, value: 0x70, mirror: null, column: 6 },
  { preset: "field2C", level: 0x98, value: 0x74, mirror: null, column: 6 },
  { preset: "field30", level: 0x9c, value: 0x78, mirror: null, column: 6 },
  { preset: "field34", level: 0xa0, value: 0x7c, mirror: null, column: 6 },
  { preset: "field38", level: 0xa4, value: 0x80, mirror: null, column: 6 }
]);

/** The two AI candidate sources, straight off the preset's bytes. */
export const BATTLE_CREATURE_SOURCE_12C_FIELD = "field3D";
export const BATTLE_CREATURE_SOURCE_130_FIELD = "field3E";

function creatureError(message) {
  return new Error(`BATTLE_CREATURE_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw creatureError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** The stat curve lookup: `curve[level][column]`, with no clamping. */
export function creatureStatValue(level, column) {
  const row = requireInteger(level, "LEVEL");
  const index = requireInteger(column, "COLUMN");
  if (index < 0 || index >= BATTLE_CREATURE_CURVE_COLUMNS) {
    throw creatureError("COLUMN_OUT_OF_RANGE");
  }
  if (row < 0 || row >= BATTLE_CREATURE_CURVE_ROWS) {
    // The ROM would read outside the table here. It never does, because the one
    // record that could is skipped before its levels are read, so refusing is
    // truer than clamping.
    throw creatureError("LEVEL_OUTSIDE_THE_CURVE");
  }
  return BATTLE_CREATURE_CURVE[row][index];
}

/** The HP curve index a species carries at its +0x30. */
export function speciesStatCurveIndex(speciesId) {
  const id = requireInteger(speciesId, "SPECIES_ID");
  const record = speciesCatalog.records[id];
  if (!record) {
    throw creatureError("UNKNOWN_SPECIES_ID");
  }
  return record.statCurveIndex;
}

/** OVL10 0x02110604 — a preset naming the absent id holds no creature. */
export function presetHoldsCreature(preset) {
  if (!preset || typeof preset !== "object") {
    throw creatureError("PRESET_REQUIRED");
  }
  return (requireInteger(preset.field00, "FIELD00") & 0xff) !== BATTLE_CREATURE_ABSENT_SPECIES;
}

/**
 * The build itself, expressed over the values rather than over a preset record.
 *
 * The ROM only ever reaches this with a preset, but the arithmetic is the ROM's
 * and nothing about it is specific to where the numbers came from. The product's
 * own creatures do not exist in the cartridge, so their levels are declared
 * rather than traced -- and running them through THIS function is what keeps the
 * mechanics original even though the inputs are not.
 *
 * HP and the resource are written to two offsets each at build, so a freshly
 * built creature is at full health by construction rather than by a rule.
 */
export function buildCreatureFromProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw creatureError("PROFILE_REQUIRED");
  }
  const levels = profile.levels;
  if (!levels || typeof levels !== "object") {
    throw creatureError("PROFILE_NEEDS_LEVELS");
  }
  const hp = creatureStatValue(requireInteger(profile.statCurveIndex, "STAT_CURVE_INDEX"), BATTLE_CREATURE_HP_COLUMN);

  const creature = {
    speciesId: profile.speciesId ?? null,
    evidence: profile.evidence ?? "VERIFIED_BINARY",
    // +0x50 and +0x58 both take the same value at 0x02062AC0 / 0x02062AC4.
    currentHp: hp,
    maxHp: hp,
    // The names the rest of the lane already uses for the two AI sources.
    source12C: requireInteger(profile.source12C ?? 0, "SOURCE_12C"),
    source130: requireInteger(profile.source130 ?? 0, "SOURCE_130"),
    levels: {},
    stats: {}
  };

  for (const entry of BATTLE_CREATURE_STAT_MAP) {
    const level = requireInteger(levels[entry.preset], `LEVEL_${entry.preset.toUpperCase()}`);
    const value = creatureStatValue(level, entry.column);
    creature.levels[entry.preset] = level;
    creature.stats[`field${entry.value.toString(16).toUpperCase().padStart(2, "0")}`] = value;
    if (entry.preset === "field14") {
      // The resource is the one stat the rest of the lane already names.
      creature.metricBase = value;
      creature.metricLimit = value;
    }
  }

  return deepFreeze(creature);
}

/**
 * ARM9 0x02062900. Turns one preset record into the creature record a combatant
 * carries at its +0x10, as a plain object keyed by the offsets this lane's other
 * modules already read.
 */
export function buildCreatureFromPreset(preset) {
  if (!presetHoldsCreature(preset)) {
    throw creatureError("PRESET_HOLDS_NO_CREATURE");
  }
  const speciesId = requireInteger(preset.field00, "FIELD00") & 0xff;
  const levels = {};
  for (const entry of BATTLE_CREATURE_STAT_MAP) {
    levels[entry.preset] = preset[entry.preset];
  }
  return buildCreatureFromProfile({
    speciesId,
    evidence: "VERIFIED_BINARY",
    // The HP level is the SPECIES record's, not the preset's.
    statCurveIndex: speciesStatCurveIndex(speciesId),
    levels,
    source12C: requireInteger(preset[BATTLE_CREATURE_SOURCE_12C_FIELD], "SOURCE_12C"),
    source130: requireInteger(preset[BATTLE_CREATURE_SOURCE_130_FIELD], "SOURCE_130")
  });
}

/**
 * OVL10 0x021105A8's loop. Three preset indices become up to three creatures;
 * an index of -1 or a preset holding no creature yields null in that slot rather
 * than shifting the others along.
 */
export function buildOpponentTeam(presetIndices, lookup) {
  if (!Array.isArray(presetIndices) || presetIndices.length !== BATTLE_CREATURE_OPPONENTS_PER_MATCH) {
    throw creatureError(`TEAM_MUST_BE_${BATTLE_CREATURE_OPPONENTS_PER_MATCH}_LONG`);
  }
  if (typeof lookup !== "function") {
    throw creatureError("LOOKUP_MUST_BE_A_FUNCTION");
  }
  return deepFreeze(presetIndices.map((index) => {
    // 0x021105CC: `mvn r0, #0 / cmp r2, r0 / beq` — an empty slot.
    if (index === -1 || index === null || index === undefined) return null;
    const preset = lookup(requireInteger(index, "PRESET_INDEX"));
    if (!preset || !presetHoldsCreature(preset)) return null;
    return buildCreatureFromPreset(preset);
  }));
}
