// Multi-round tournament structure — OVL10 setup, OVL19/OVL8 bookkeeping.
//
// Independently decoded from YDIJ ROM SHA-256 8ad375ba…c5d1; the receipt is
// docs/research/CHAMPIONSHIP_ROUNDS_2026-09-10.json.
//
// WHERE THE ROUND COUNT COMES FROM
// --------------------------------
// Seven OVL10 entries store the session's total-round slot (+0xCA8). Five write
// an immediate 1 — those are the ordinary single title matches. The other two
// load it as a byte from an ARM9 descriptor reached through the OVL10 table at
// 0x02114D48, one word per category:
//
//   02112250  ldr r3,[r0,#8] / ldrb r3,[r3] / str r3,[r2,#0xca8]   category 0
//   0211220C  ldr r3,[r0,#0xc] / ldrb r1,[r2] / str r1,[r0,#0xca8] category 1
//
// Category 0's descriptor gives 3 rounds and 50,000; category 1's gives 5 and
// 300,000, and that entry also copies the prize into the session's +0xC94.
//
// THE ROUND LOOP
// --------------
// +0xCA4 is the cursor and +0xCAC the per-round flag array; OVL19 0x0210E280
// writes the flag then advances the cursor (battleOutcome's recordRoundOutcome),
// and OVL8 0x0210D0C8 walks flags[0..cursor-1] so one lost round removes the
// whole payout (payoutAllowed). OVL19 0x0210D204 marks the last round when the
// cursor has reached total - 1.
//
// THE OPPONENT, AND WHAT IS STILL MISSING
// ---------------------------------------
// OVL10 0x02110A90 takes (category, cursor). It reads the category record's
// +0x0C as an array of 8-byte {u8 poolSize, u32 poolPointer} records indexed by
// the round, draws a uniform index over poolSize, and reads a 20-byte team
// record — the same three-preset shape the ordinary opponent table uses. The
// BSS pools are filled by ARM9 020998D4 from static team records 71..98.
// All 28 copies and 824 selector prefixes were executed independently; see
// CHAMPIONSHIP_POOLS_CPU_2026-09-10.json. The original selector uses channel 0.
import { recordRoundOutcome, payoutAllowed } from "./battleOutcome.js";
import { deepFreeze } from "../contracts/championshipContracts.js";
import pools from '../../data/championship/catalogs/championship-pools.r1.json' with {type:'json'};
import {expandOpponentTeam} from './battleMatchSelection.js';

export const CHAMPIONSHIP_ROUNDS_EVIDENCE = "VERIFIED_BINARY";
export const CHAMPIONSHIP_CATEGORY_TABLE_SITE = "OVL10:0x02114D48";
export const CHAMPIONSHIP_OPPONENT_SELECTOR_SITE = "OVL10:0x02110A90";
export const CHAMPIONSHIP_FINAL_ROUND_SITE = "OVL19:0x0210D204";
/** 0211110C stores 10 into the arena slot before the tournament opponent call. */
export const CHAMPIONSHIP_ARENA_INDEX = 10;

export const NATIVE_CHAMPIONSHIP_CATEGORIES = deepFreeze([
  { category: 0, id: "CHAMPIONSHIP", descriptor: "020A9AB4", rounds: 3, prize: 50000,
    poolSizes: [6, 6, 4], setupSite: "OVL10:0x02112250" },
  { category: 1, id: "WORLD", descriptor: "020A9AA4", rounds: 5, prize: 300000,
    poolSizes: [4, 3, 2, 2, 1], setupSite: "OVL10:0x0211220C" },
]);

function roundsError(message) {
  return new Error(`CHAMPIONSHIP_ROUNDS_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw roundsError(`${label}_MUST_BE_AN_INTEGER`);
  return value;
}

export function nativeChampionshipCategory(category) {
  const record = NATIVE_CHAMPIONSHIP_CATEGORIES[requireInteger(category, "CATEGORY")];
  if (!record) throw roundsError(`UNKNOWN_CATEGORY: ${category}`);
  return record;
}

/** A fresh run: no round played, no flag written, nothing owed. */
export function createNativeChampionshipRun(category) {
  const record = nativeChampionshipCategory(category);
  return deepFreeze({ category: record.category, totalRounds: record.rounds,
    prize: record.prize, cursor: 0, flags: [] });
}

export function normalizeNativeChampionshipRun(value) {
  if (!value || typeof value !== "object") throw roundsError("RUN_REQUIRES_AN_OBJECT");
  const record = nativeChampionshipCategory(value.category);
  const cursor = requireInteger(value.cursor ?? 0, "CURSOR");
  if (cursor < 0 || cursor > record.rounds) throw roundsError("CURSOR_OUT_OF_RANGE");
  const flags = Array.isArray(value.flags) ? [...value.flags] : [];
  if (flags.length > record.rounds) throw roundsError("FLAGS_LONGER_THAN_THE_RUN");
  for (const flag of flags) requireInteger(flag, "FLAG");
  if (flags.some((flag) => flag !== 0 && flag !== 1)) throw roundsError("FLAG_MUST_BE_0_OR_1");
  if(flags.length!==cursor)throw roundsError('FLAGS_CURSOR_MISMATCH');
  if(flags.slice(0,-1).includes(0))throw roundsError('ROUNDS_AFTER_LOSS');
  return deepFreeze({ category: record.category, totalRounds: record.rounds,
    prize: record.prize, cursor, flags });
}

/** 0210D204: the cursor has reached the last round of the run. */
export function nativeChampionshipFinalRound(run) {
  const state = normalizeNativeChampionshipRun(run);
  return state.cursor >= state.totalRounds - 1;
}

/** True while another round is still owed — a lost round ends the run early. */
export function nativeChampionshipContinues(run) {
  const state = normalizeNativeChampionshipRun(run);
  return state.cursor < state.totalRounds && payoutAllowed(state.flags, state.cursor);
}

/**
 * One round's result. `verdict` and `battleType` are the values the existing
 * outcome module already judges; this only records and advances.
 */
export function recordNativeChampionshipRound(run, { verdict, battleType = 0 } = {}) {
  const state = normalizeNativeChampionshipRun(run);
  if (state.cursor >= state.totalRounds) throw roundsError("RUN_ALREADY_COMPLETE");
  if(!nativeChampionshipContinues(state))throw roundsError('RUN_ALREADY_ENDED');
  const recorded = recordRoundOutcome({ flags: state.flags, cursor: state.cursor, verdict, battleType });
  const next = normalizeNativeChampionshipRun({ ...state, cursor: recorded.cursor, flags: recorded.flags });
  return deepFreeze({ run: next, won: recorded.won,
    complete: !nativeChampionshipContinues(next),
    payable: nativeChampionshipPayable(next) });
}

/** OVL8 0210D0C8, read at the end of a run: every round played must be a win. */
export function nativeChampionshipPayable(run) {
  const state = normalizeNativeChampionshipRun(run);
  return state.cursor >= state.totalRounds && payoutAllowed(state.flags, state.cursor);
}

/** The pool size 02110A90 draws over for this round. */
export function nativeChampionshipPoolSize(category, round) {
  const record = nativeChampionshipCategory(category);
  const index = requireInteger(round, "ROUND");
  if (index < 0 || index >= record.rounds) throw roundsError("ROUND_OUT_OF_RANGE");
  return record.poolSizes[index];
}

/**
 * Original channel-0 draw over the initialized per-round pool. Returns the
 * existing team/preset identities; owns no RNG, individual pool or battle.
 */
export function selectNativeChampionshipOpponent({ category, round, nextChannel } = {}) {
  const size = nativeChampionshipPoolSize(category, round);
  if (typeof nextChannel !== "function") throw roundsError("OPPONENT_DRAW_REQUIRES_RNG");
  const draw=nextChannel(0);
  if(!Number.isSafeInteger(draw)||draw<0)throw roundsError('OPPONENT_DRAW_OUT_OF_RANGE');
  const index = draw % size;
  if (!Number.isSafeInteger(index) || index < 0 || index >= size) throw roundsError("OPPONENT_DRAW_OUT_OF_RANGE");
  const pool=pools.categories[category].pools[round];
  if(pool.length!==size)throw roundsError('OPPONENT_POOL_SIZE_MISMATCH');
  const teamIndex=pool[index];
  return deepFreeze({category,round,poolSize:size,index,teamIndex,presets:expandOpponentTeam(teamIndex)});
}
