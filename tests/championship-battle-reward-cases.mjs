// Battle reward transaction — OVL8 0x0210D0C8 payout decision, 0x0210EAB0 credit,
// ARM9 0x020F126C match table. Data and traced gates only; no invented formula.

import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_MATCH_PAYOUTS,
  BATTLE_MATCH_TABLE_RECORD_COUNT,
  BATTLE_MATCH_TABLE_STRIDE,
  BATTLE_REWARD_CREDIT_SITE,
  BATTLE_REWARD_EVIDENCE,
  BATTLE_REWARD_MODE_MAX,
  BATTLE_REWARD_OUTCOME_SITE,
  BATTLE_REWARD_PAID,
  BATTLE_REWARD_SUPPRESSED_INDEX,
  BATTLE_REWARD_SUPPRESSED_MODE,
  BATTLE_REWARD_TABLE_SOURCE,
  BATTLE_REWARD_WALLET_CAP,
  BATTLE_REWARD_WITHHELD_LOSS,
  BATTLE_REWARD_WITHHELD_SUPPRESSED,
  creditBattleReward,
  matchPayout,
  resolveBattleReward,
  resolveBattleWon
} from "../src/championship/battle/battleRewardTransaction.js";

test("constants are the dumped OVL8/ARM9 immediates", () => {
  assert.equal(BATTLE_REWARD_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_REWARD_OUTCOME_SITE, "OVL8:0x0210D0C8");
  assert.equal(BATTLE_REWARD_CREDIT_SITE, "OVL8:0x0210EAB0");
  assert.equal(BATTLE_REWARD_TABLE_SOURCE, "ARM9:0x020F126C");
  assert.equal(BATTLE_REWARD_WALLET_CAP, 9999999);
  assert.equal(BATTLE_MATCH_TABLE_RECORD_COUNT, 86);
  assert.equal(BATTLE_MATCH_TABLE_STRIDE, 28);
  assert.equal(BATTLE_REWARD_MODE_MAX, 5);
  assert.equal(BATTLE_REWARD_SUPPRESSED_MODE, 1);
  assert.equal(BATTLE_REWARD_SUPPRESSED_INDEX, 61);
});

test("the mode-1 payout table is 51 contiguous match ids 101..151", () => {
  assert.equal(BATTLE_MATCH_PAYOUTS.length, 51);
  const ids = BATTLE_MATCH_PAYOUTS.map(([matchId]) => matchId);
  assert.equal(ids[0], 101);
  assert.equal(ids[ids.length - 1], 151);
  for (let index = 0; index < ids.length; index += 1) {
    assert.equal(ids[index], 101 + index, `match id at ${index}`);
  }
  for (const [matchId, bits] of BATTLE_MATCH_PAYOUTS) {
    assert.ok(Number.isSafeInteger(bits) && bits > 0, `payout for ${matchId}`);
  }
});

test("payout lookup returns the dumped values and null off the table", () => {
  assert.equal(matchPayout(101), 3000);
  assert.equal(matchPayout(110), 50000);
  assert.equal(matchPayout(139), 82800);
  assert.equal(matchPayout(150), 100000);
  assert.equal(matchPayout(151), 400000);
  assert.equal(matchPayout(100), null);
  assert.equal(matchPayout(152), null);
});

test("group ratios are how the data was authored, not a rule the product applies", () => {
  const base = BATTLE_MATCH_PAYOUTS.slice(0, 10).map(([, bits]) => bits);
  const group15 = BATTLE_MATCH_PAYOUTS.slice(10, 20).map(([, bits]) => bits);
  // The x1.5 group holds for all ten.
  for (let index = 0; index < 10; index += 1) {
    assert.equal(group15[index], base[index] * 1.5, `x1.5 at ${index}`);
  }
  // The x1.4 group breaks at its last two entries, which is why no ratio is coded.
  const group14 = BATTLE_MATCH_PAYOUTS.slice(30, 40).map(([, bits]) => bits);
  for (let index = 0; index < 8; index += 1) {
    assert.equal(group14[index], base[index] * 1.4, `x1.4 at ${index}`);
  }
  assert.notEqual(group14[8], base[8] * 1.4);
  assert.notEqual(group14[9], base[9] * 1.4);
  assert.equal(group14[8], 82800);
  assert.equal(group14[9], 90000);
});

test("the win flag is cleared by any zero entry, and an empty list stays won", () => {
  assert.equal(resolveBattleWon([]), true);
  assert.equal(resolveBattleWon([1, 1, 1]), true);
  assert.equal(resolveBattleWon([1, 0, 1]), false);
  assert.equal(resolveBattleWon([0]), false);
  assert.equal(resolveBattleWon([-1, 2]), true);
});

test("a win pays the whole match payout", () => {
  const result = resolveBattleReward({
    mode: 1,
    matchIndex: 105,
    payout: matchPayout(105),
    outcomeEntries: [1, 1]
  });
  assert.equal(result.won, true);
  assert.equal(result.pending, 13000);
  assert.equal(result.outcome, BATTLE_REWARD_PAID);
});

test("a loss pays nothing", () => {
  const result = resolveBattleReward({
    mode: 1,
    matchIndex: 105,
    payout: 13000,
    outcomeEntries: [1, 0]
  });
  assert.equal(result.won, false);
  assert.equal(result.pending, 0);
  assert.equal(result.outcome, BATTLE_REWARD_WITHHELD_LOSS);
});

test("mode 1 index 61 is suppressed, and that gate precedes the win flag", () => {
  const won = resolveBattleReward({
    mode: 1, matchIndex: 61, payout: 50000, outcomeEntries: [1, 1]
  });
  assert.equal(won.pending, 0);
  assert.equal(won.outcome, BATTLE_REWARD_WITHHELD_SUPPRESSED);
  // Tested before the win flag, so a loss on that match still reports suppressed.
  const lost = resolveBattleReward({
    mode: 1, matchIndex: 61, payout: 50000, outcomeEntries: [0]
  });
  assert.equal(lost.outcome, BATTLE_REWARD_WITHHELD_SUPPRESSED);
  assert.equal(lost.won, false);
  // The same index in another mode is not suppressed.
  const other = resolveBattleReward({
    mode: 2, matchIndex: 61, payout: 7000, outcomeEntries: [1]
  });
  assert.equal(other.pending, 7000);
});

test("credit adds then clamps, and clears pending", () => {
  const plain = creditBattleReward({ wallet: 1000, pending: 3000 });
  assert.deepEqual(
    { wallet: plain.wallet, pending: plain.pending, credited: plain.credited, clamped: plain.clamped },
    { wallet: 4000, pending: 0, credited: 3000, clamped: false }
  );

  // The original clamps after the add, so an overflowing payout is truncated.
  const over = creditBattleReward({ wallet: 9999000, pending: 400000 });
  assert.equal(over.wallet, BATTLE_REWARD_WALLET_CAP);
  assert.equal(over.credited, 999);
  assert.equal(over.clamped, true);
  assert.equal(over.pending, 0);

  // Landing exactly on the cap is not reported as clamped.
  const exact = creditBattleReward({ wallet: 9999998, pending: 1 });
  assert.equal(exact.wallet, BATTLE_REWARD_WALLET_CAP);
  assert.equal(exact.clamped, false);

  const nothing = creditBattleReward({ wallet: 500, pending: 0 });
  assert.equal(nothing.wallet, 500);
  assert.equal(nothing.credited, 0);
});

test("the richest single payout still fits the wallet from zero", () => {
  const credited = creditBattleReward({ wallet: 0, pending: matchPayout(151) });
  assert.equal(credited.wallet, 400000);
  assert.equal(credited.clamped, false);
});

test("invalid input is rejected instead of coerced", () => {
  assert.throws(() => resolveBattleReward(null), /plain object/);
  assert.throws(
    () => resolveBattleReward({ mode: 6, matchIndex: 1, payout: 0, outcomeEntries: [] }),
    /mode must be 0\.\.5/
  );
  assert.throws(
    () => resolveBattleReward({ mode: 1, matchIndex: 1, payout: -1, outcomeEntries: [] }),
    /payout must be >= 0/
  );
  assert.throws(
    () => resolveBattleReward({ mode: 1, matchIndex: 1, payout: 0, outcomeEntries: "no" }),
    /outcomeEntries must be an array/
  );
  assert.throws(() => creditBattleReward({ wallet: -1, pending: 0 }), /wallet must be >= 0/);
  assert.throws(() => matchPayout(1.5), /matchId must be a safe integer/);
});
