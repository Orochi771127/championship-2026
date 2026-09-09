// The stat ladder -- how the original turns a growth position into a number.
//
// WHAT THE CURVE ACTUALLY IS
// --------------------------
// The 27-row table at ARM9 0x020CA008 is not a per-species stat block. It is a
// LADDER: 27 rungs a stat can stand on, shared by every creature in the game.
//
//     rung 0    HP 200     other stats 10
//     rung 13   HP 2340    other stats 117
//     rung 26   HP 7000    other stats 350
//
// A row is 16 bytes and holds 8 signed halfwords. Column 0 is the HP ladder;
// columns 1 through 6 are byte-identical to one another and form ONE shared
// ladder that every non-HP stat reads. Column 7 is a small stepped value (4, 8,
// 12, 15, 18, 20) with no traced reader.
//
// HOW THE GAME READS IT -- ARM9 0x02062900
// -----------------------------------------
// That routine builds a creature instance. For each stat it does the same three
// steps, and the register trace is unambiguous:
//
//     LDR   rN,[r5,#off]      ; this stat's OWN rung, out of the creature record
//     MOV   rN,rN,LSL #4      ; rung * 16, the row stride
//     LDRH  rV,[rC,rN]        ; rC is a pointer to this stat's COLUMN
//     STR   rV,[r6,#...]      ; the value lands on the instance
//
// The seven column pointers sit in one literal pool and are consecutive +2 byte
// offsets from the table base -- 0x020CA008, 00A, 00C, 00E, 010, 012, 014 -- which
// is what proves they are columns of one table rather than seven tables.
//
// The rung is also copied onto the instance at +0x84, +0x88, +0x8C, +0x90, +0x94,
// +0x98, so the instance carries both the position and the value.
//
// WHY THIS CORRECTS AN EARLIER CONCLUSION
// ---------------------------------------
// speciesBaseStats.js used to say the curve CANNOT be the source of attack,
// defence, wisdom and speed, because columns 1..6 are byte-identical and would
// emit the same number four times. That reasoning assumed one rung shared by every
// stat. The ROM gives each stat its own rung, so identical columns are harmless:
// what separates two stats is which rung each one stands on, not which column it
// reads. The claim is withdrawn.
//
// WHAT IS STILL NOT AVAILABLE
// ---------------------------
// The rungs themselves. They live in the per-creature record -- stride 0x44, 68
// bytes, indexed at OVL10 0x021100E0 -- which is runtime save state, not a ROM
// table. There is nothing to transcribe: a creature's stats are its growth
// positions, and training is what moves them. Reading them needs the save layout,
// which is the next phase, so this module exposes the ladder and refuses to
// pretend it knows where any particular creature stands on it.

import { deepFreeze } from "../contracts/championshipContracts.js";
import statCurve from "../../data/championship/catalogs/creature-stat-curve.r1.json" with { type: "json" };

const ROWS = statCurve.records ?? statCurve.rows;

export const STAT_LADDER_RUNGS = ROWS.length;
export const STAT_LADDER_TABLE_SITE = "ARM9:0x020CA008";
export const STAT_LADDER_READER_SITE = "ARM9:0x02062900";
export const STAT_LADDER_EVIDENCE = "ROM_VERIFIED";

/** Row stride in bytes -- the routine shifts the rung left by 4. */
export const STAT_LADDER_ROW_STRIDE = 16;

/** Column 0 is HP; 1..6 are one shared ladder; 7 has no traced reader. */
export const STAT_LADDER_HP_COLUMN = 0;
export const STAT_LADDER_SHARED_COLUMN = 1;
export const STAT_LADDER_SHARED_COLUMN_RANGE = deepFreeze([1, 6]);
export const STAT_LADDER_UNREAD_COLUMN = 7;

/** The per-creature record the rungs live in. Runtime state, not a ROM table. */
export const CREATURE_RECORD_STRIDE = 0x44;
export const CREATURE_RECORD_INDEX_SITE = "OVL10:0x021100E0";
export const CREATURE_RECORD_RUNG_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

function ladderError(message) {
  const error = new Error(message);
  error.name = "ChampionshipStatLadderError";
  return error;
}

function requireRung(rung) {
  if (!Number.isInteger(rung) || rung < 0 || rung >= STAT_LADDER_RUNGS) {
    throw ladderError(`RUNG_OUT_OF_RANGE: ${rung} is not 0..${STAT_LADDER_RUNGS - 1}`);
  }
  return rung;
}

/** HP for a rung -- column 0, the only column that differs from the rest. */
export function hpForRung(rung) {
  return ROWS[requireRung(rung)][STAT_LADDER_HP_COLUMN];
}

/**
 * Any non-HP stat for a rung.
 *
 * There is deliberately no per-stat variant: attack, defence, wisdom, speed and
 * TP all read the same ladder. Two creatures differ because their rungs differ.
 */
export function statForRung(rung) {
  return ROWS[requireRung(rung)][STAT_LADDER_SHARED_COLUMN];
}

/** The whole ladder, for a UI that wants to show where a stat sits. */
export function statLadder() {
  return deepFreeze(
    ROWS.map((row, rung) => deepFreeze({
      rung,
      hp: row[STAT_LADDER_HP_COLUMN],
      stat: row[STAT_LADDER_SHARED_COLUMN]
    }))
  );
}

/** True when columns 1..6 still agree, which is the premise of one shared ladder. */
export function sharedColumnsAgree() {
  const [first, last] = STAT_LADDER_SHARED_COLUMN_RANGE;
  return ROWS.every((row) => {
    for (let column = first + 1; column <= last; column += 1) {
      if (row[column] !== row[first]) return false;
    }
    return true;
  });
}
