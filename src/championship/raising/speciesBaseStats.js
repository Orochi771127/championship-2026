// Base stats for a species, through the already-traced path.
//
// WHY THIS EXISTS
// ---------------
// The raising status panel had no numbers at all. It turns out it did not need a
// new trace to get some: the chain from a species to its HP was already
// recovered for the battle lane and simply never surfaced on the raising side.
//
//     species record +0x30  ->  statCurveIndex
//     creature-stat-curve    ->  row[statCurveIndex]
//     row column 0           ->  HP        (loaded signed; battle uses this)
//     row column 1           ->  TP        (battle's resource column)
//
// Both catalogs are transcribed from the cartridge, and battleCreatureBuild.js
// already reads exactly these two columns. This module reuses that, it does not
// re-derive it.
//
// A CLAIM THIS FILE USED TO MAKE, NOW WITHDRAWN
// ---------------------------------------------
// It used to say the stat curve CANNOT be the source of attack, defence, wisdom
// and speed, because columns 1 through 6 are byte-identical and would emit the
// same number four times under four labels.
//
// That was wrong, and the error was in the premise, not the observation. The
// columns really are identical -- but the ROM does not read one row for every
// stat. ARM9 0x02062900 gives each stat its OWN row index, shifts it left by 4
// and reads that stat's own column. Identical columns are therefore harmless:
// two stats differ because they stand on different RUNGS of one shared ladder.
// See statLadder.js, which carries the traced reading.
//
// WHAT THIS FILE CAN AND CANNOT DO
// --------------------------------
// The rungs are per-creature, stored in the 68-byte creature record that OVL10
// 0x021100E0 indexes. That is save state, not a ROM table, so there is nothing
// here to look them up from -- a species does not have an attack value, a
// CREATURE has an attack rung. Until the save layout is traced this module keeps
// returning only what a species genuinely determines on its own.
//
// The two values below are kept because battleCreatureBuild.js already reads
// exactly these, and changing them is a battle-lane change, not a raising one.

import { deepFreeze } from "../contracts/championshipContracts.js";
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };
import statCurve from "../../data/championship/catalogs/creature-stat-curve.r1.json" with { type: "json" };

/** Column indices, matching what battleCreatureBuild.js reads. */
export const STAT_CURVE_HP_COLUMN = 0;
export const STAT_CURVE_TP_COLUMN = 1;

export const SPECIES_BASE_STAT_EVIDENCE = "VERIFIED_BINARY";
export const SPECIES_UNDIFFERENTIATED_STATS = deepFreeze([
  "attack", "defense", "wisdom", "speed"
]);
export const SPECIES_UNDIFFERENTIATED_STATS_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

const CURVE_ROWS = statCurve.records ?? statCurve.rows;
const SPECIES_BY_ID = new Map(
  speciesCatalog.records.map((record) => [
    `species-${String(record.recordIndex).padStart(3, "0")}`,
    record
  ])
);

function statsError(message) {
  const error = new Error(message);
  error.name = "ChampionshipSpeciesStatsError";
  return error;
}

/**
 * Base stats for a species id.
 *
 * Returns null for an unknown id rather than throwing: a save written against a
 * different catalog is a real case and must not take the session down. An id
 * that IS known but whose curve index is out of range does throw, because that
 * means the two transcribed catalogs disagree and a silent zero would hide it.
 */
export function speciesBaseStats(speciesId) {
  const record = SPECIES_BY_ID.get(speciesId);
  if (!record) return null;

  const row = CURVE_ROWS[record.statCurveIndex];
  if (!row) {
    throw statsError(`STAT_CURVE_INDEX_OUT_OF_RANGE: ${speciesId} -> ${record.statCurveIndex}`);
  }

  return deepFreeze({
    speciesId,
    statCurveIndex: record.statCurveIndex,
    maxHp: row[STAT_CURVE_HP_COLUMN],
    maxTp: row[STAT_CURVE_TP_COLUMN],
    evidence: SPECIES_BASE_STAT_EVIDENCE,
    // Named so a consumer can see what is missing instead of guessing why the
    // panel has two numbers where the original shows six.
    undifferentiated: SPECIES_UNDIFFERENTIATED_STATS,
    undifferentiatedEvidence: SPECIES_UNDIFFERENTIATED_STATS_EVIDENCE
  });
}
