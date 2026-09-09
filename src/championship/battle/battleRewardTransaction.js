// Battle reward transaction -- OVL8 0x0210D0C8 outcome/reward, 0x0210EAB0 credit.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
// OVL8 ram 0x0210B300 size 0x47C0; the systems mode map names OVL8
// "Battle result / rank / reward".
//
// THE HEADLINE: THERE IS NO REWARD FORMULA
// ----------------------------------------
// The Bits payout is not computed from level, damage, turns or margin. It is a
// per-match constant read straight out of an ARM9 table. The traced chain is:
//
//   ARM9 0x0208CE8C   str r0, [r6, #0x6BC]   payout <- matchTable[i].+0x14
//   ARM9 0x0208C4D4   str r2, [r1, #0xC94]   session payout <- +0x6BC
//   OVL8 0x0210D190   str r1, [r5, #0x408]   pending  <- session payout
//   OVL8 0x0210EABC   add r1, r2, r1         wallet   <- wallet + pending
//   OVL8 0x0210EAD4   strcs r0, [r4, #0x4C8] clamp to 9,999,999 (unsigned)
//
// The match table is ARM9 0x020F126C, stride 28, 86 records. Field +0x00 is the
// mode 0..5 that OVL8's jump table at 0x0210D1A0 switches on, +0x10 is the match
// id and +0x14 is the payout. Address arithmetic is MLA (r = index*28 + base),
// which a naive disassembler renders as a bare MUL -- the operands were checked
// by hand.
//
// The mode-1 payouts are grouped in tens and the groups are near-multiples of
// the first group (x1.5, x1.2, x1.4, x1.3), but the last entry of several groups
// breaks the ratio (139, 140, 150, 151). So the ratios are how the data was
// authored, NOT a rule the game evaluates. This module ships the table.
//
// GATES BEFORE THE PAYOUT (OVL8 0x0210D0C8)
// -----------------------------------------
//   +0x7FC starts at 1, and is cleared to 0 if ANY of the ctx +0xCA4 entries
//   at ctx +0xCAC is zero. That is the win flag.
//   0x0210D128  pending := 0                     unconditional default
//   0x0210D170  mode == 1 && index == 61 -> return, pending stays 0
//   0x0210D184  win flag == 0        -> return, pending stays 0
//   0x0210D190  otherwise pending := session payout
//
// So a loss pays nothing, and the payout is credited whole or not at all.
//
// OVL8's category 0 -> 0210D3EC is the championship; category 1 -> 0210D1C0
// is the 61-title progression. nativeTitleProgression.js now implements those
// writers and 0210E328 rank commit against the 2026-09-09 CPU oracle. Their
// effects do not change this per-match payout or introduce a first-clear bonus.
//
// Also not here: Bits spent (that is the Shop's side), battle income for modes
// whose match rows carry payout 0, and any screen.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_REWARD_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_REWARD_OUTCOME_SITE = "OVL8:0x0210D0C8";
export const BATTLE_REWARD_CREDIT_SITE = "OVL8:0x0210EAB0";
export const BATTLE_REWARD_TABLE_SOURCE = "ARM9:0x020F126C";

/** ldr r0, =0x0098967F ; cmp ; strcs -- unsigned clamp on the wallet at +0x4C8. */
export const BATTLE_REWARD_WALLET_CAP = 9999999;

/** Match table geometry: 86 records of 28 bytes at ARM9 0x020F126C. */
export const BATTLE_MATCH_TABLE_RECORD_COUNT = 86;
export const BATTLE_MATCH_TABLE_STRIDE = 28;

/** cmp r0, #5 ; addls pc, pc, r0, lsl #2 -- the OVL8 payout jump table. */
export const BATTLE_REWARD_MODE_MAX = 5;

/** cmp r0, #1 ; ldreq r0,[r1,#0xCA0] ; cmpeq r0, #61 -- pays nothing. */
export const BATTLE_REWARD_SUPPRESSED_MODE = 1;
export const BATTLE_REWARD_SUPPRESSED_INDEX = 61;

/**
 * Mode-1 match payouts: [matchId, bits], ARM9 0x020F126C +0x10 / +0x14,
 * the 51 records whose +0x00 is 1. Independently dumped 2026-08-31.
 */
export const BATTLE_MATCH_PAYOUTS = deepFreeze([
  [101, 3000], [102, 4400], [103, 8000], [104, 10000], [105, 13000],
  [106, 15000], [107, 27000], [108, 33000], [109, 46000], [110, 50000],
  [111, 4500], [112, 6600], [113, 12000], [114, 15000], [115, 19500],
  [116, 22500], [117, 40500], [118, 49500], [119, 69000], [120, 75000],
  [121, 3600], [122, 5280], [123, 9600], [124, 12000], [125, 15600],
  [126, 18000], [127, 32400], [128, 39600], [129, 55200], [130, 60000],
  [131, 4200], [132, 6160], [133, 11200], [134, 14000], [135, 18200],
  [136, 21000], [137, 37800], [138, 46200], [139, 82800], [140, 90000],
  [141, 3900], [142, 5720], [143, 10400], [144, 13000], [145, 16900],
  [146, 19500], [147, 35100], [148, 42900], [149, 59800], [150, 100000],
  [151, 400000]
]);

const PAYOUT_BY_MATCH_ID = deepFreeze(
  Object.fromEntries(BATTLE_MATCH_PAYOUTS.map(([matchId, bits]) => [matchId, bits]))
);

export const BATTLE_REWARD_PAID = "PAID";
export const BATTLE_REWARD_WITHHELD_LOSS = "WITHHELD_LOSS";
export const BATTLE_REWARD_WITHHELD_SUPPRESSED = "WITHHELD_SUPPRESSED_MATCH";

function rewardError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleRewardError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw rewardError(`${label} must be a safe integer`);
  }
  return value;
}

function requireNonNegative(value, label) {
  requireSafeInteger(value, label);
  if (value < 0) throw rewardError(`${label} must be >= 0`);
  return value;
}

/** Mode-1 payout for a match id, or null when the table has no such row. */
export function matchPayout(matchId) {
  requireSafeInteger(matchId, "matchId");
  const bits = PAYOUT_BY_MATCH_ID[matchId];
  return bits === undefined ? null : bits;
}

/**
 * +0x7FC: starts 1, cleared to 0 by any zero entry. Zero entries to inspect
 * leaves the flag at 1, exactly as the original loop does when the count is 0.
 */
export function resolveBattleWon(outcomeEntries) {
  if (!Array.isArray(outcomeEntries)) {
    throw rewardError("outcomeEntries must be an array");
  }
  for (let index = 0; index < outcomeEntries.length; index += 1) {
    requireSafeInteger(outcomeEntries[index], `outcomeEntries[${index}]`);
    if (outcomeEntries[index] === 0) return false;
  }
  return true;
}

/**
 * The payout decision at 0x0210D0C8. Returns the pending amount, which the
 * credit step later moves into the wallet.
 *
 * @param {{ mode: number, matchIndex: number, payout: number, outcomeEntries: number[] }} input
 */
export function resolveBattleReward(input) {
  if (!input || typeof input !== "object") {
    throw rewardError("resolveBattleReward requires a plain object");
  }
  const mode = requireNonNegative(input.mode, "mode");
  if (mode > BATTLE_REWARD_MODE_MAX) {
    throw rewardError(`mode must be 0..${BATTLE_REWARD_MODE_MAX}`);
  }
  const matchIndex = requireSafeInteger(input.matchIndex, "matchIndex");
  const payout = requireNonNegative(input.payout, "payout");
  const won = resolveBattleWon(input.outcomeEntries);

  // Order matters: the suppressed-match return is tested before the win flag.
  if (mode === BATTLE_REWARD_SUPPRESSED_MODE && matchIndex === BATTLE_REWARD_SUPPRESSED_INDEX) {
    return deepFreeze({
      won,
      pending: 0,
      outcome: BATTLE_REWARD_WITHHELD_SUPPRESSED,
      evidence: BATTLE_REWARD_EVIDENCE
    });
  }
  if (!won) {
    return deepFreeze({
      won: false,
      pending: 0,
      outcome: BATTLE_REWARD_WITHHELD_LOSS,
      evidence: BATTLE_REWARD_EVIDENCE
    });
  }
  return deepFreeze({
    won: true,
    pending: payout,
    outcome: BATTLE_REWARD_PAID,
    evidence: BATTLE_REWARD_EVIDENCE
  });
}

/**
 * The credit at 0x0210EAB0: wallet += pending, pending := 0, then clamp the
 * wallet to 9,999,999. The original clamps after the add, so a payout that
 * would overflow is truncated rather than refused.
 *
 * @param {{ wallet: number, pending: number }} input
 */
export function creditBattleReward(input) {
  if (!input || typeof input !== "object") {
    throw rewardError("creditBattleReward requires a plain object");
  }
  const wallet = requireNonNegative(input.wallet, "wallet");
  const pending = requireNonNegative(input.pending, "pending");

  const added = wallet + pending;
  const clamped = added >= BATTLE_REWARD_WALLET_CAP ? BATTLE_REWARD_WALLET_CAP : added;

  return deepFreeze({
    wallet: clamped,
    pending: 0,
    credited: clamped - wallet,
    clamped: added > BATTLE_REWARD_WALLET_CAP,
    evidence: BATTLE_REWARD_EVIDENCE
  });
}
