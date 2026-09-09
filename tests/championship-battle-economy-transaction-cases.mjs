import assert from "node:assert/strict";
import test from "node:test";
import {
  createBattleEconomyState, normalizeBattleEconomyState, nextBattleAttemptId,
  beginBattleAttempt, settleBattleAttempt, abandonBattleAttempt
} from "../src/championship/battle/battleEconomyTransaction.js";

// Independent acceptance values: owner ROM OVL10/OVL8 fee/reward check, record 0.
const match = { matchIndex: 0, mode: 0, battleType: 0, entryFee: 150, payout: 7000, expectedRounds: 1 };
function enter(state = createBattleEconomyState(), wallet = 150, changes = {}) {
  return beginBattleAttempt(state, { ...match, attemptId: nextBattleAttemptId(state), ...changes }, wallet);
}
function finish(entry, outcomeEntries = [1]) {
  return settleBattleAttempt(entry.state, { attemptId: entry.attempt.attemptId, outcomeEntries }, entry.wallet);
}

test("battle entry uses 150 Bits and a win pays 7000 in one immutable transition", () => {
  const original = createBattleEconomyState();
  const entry = enter(original);
  assert.equal(entry.ok, true);
  assert.equal(entry.wallet, 0);
  assert.equal(original.active, null);
  const result = finish(entry);
  assert.equal(result.wallet, 7000);
  assert.deepEqual(result.receipt, {
    attemptId: "battle:1", sequence: 1, matchIndex: 0, mode: 0, battleType: 0,
    entryFee: 150, payout: 7000, status: "SETTLED", outcome: "PAID", won: true,
    rewardBits: 7000, credited: 7000, walletAfter: 7000, clamped: false
  });
  assert.equal(result.state.active, null);
  assert.equal(entry.state.active.attemptId, "battle:1");
  assert.throws(() => { result.receipt.credited = 1; }, TypeError);
});

test("insufficient funds neither debit nor consume the next attempt identity", () => {
  const original = createBattleEconomyState();
  const result = enter(original, 149);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "INSUFFICIENT_FUNDS");
  assert.equal(result.wallet, 149);
  assert.deepEqual(result.state, original);
  assert.equal(enter(result.state, 150).attempt.attemptId, "battle:1");
});

test("same entry request is idempotent; changed context cannot replace an active attempt", () => {
  const entry = enter(createBattleEconomyState(), 1000);
  const spec = { ...match, attemptId: "battle:1" };
  const replay = beginBattleAttempt(entry.state, spec, entry.wallet);
  assert.equal(replay.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.wallet, 850);
  assert.deepEqual(replay.state, entry.state);
  const changed = beginBattleAttempt(entry.state, { ...spec, payout: 9999 }, entry.wallet);
  assert.equal(changed.ok, false);
  assert.equal(changed.reason, "BATTLE_ATTEMPT_ACTIVE");
  assert.equal(changed.wallet, 850);
});

test("missing rounds cannot win vacuously, and only the complete round set is settled", () => {
  const entry = enter(createBattleEconomyState(), 1000, { expectedRounds: 3 });
  for (const flags of [[], [1], [1, 1]]) {
    const incomplete = finish(entry, flags);
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.reason, "BATTLE_RESULT_INCOMPLETE");
    assert.deepEqual(incomplete.state, entry.state);
    assert.equal(incomplete.wallet, 850);
  }
  const loss = finish(entry, [1, 0, 1]);
  assert.equal(loss.receipt.won, false);
  assert.equal(loss.receipt.rewardBits, 0);
  assert.equal(loss.wallet, 850);
  assert.equal(finish(entry, [1, 1, 1]).wallet, 7850);
});

test("suppressed mode and wallet cap retain the traced reward semantics", () => {
  const suppressed = finish(enter(createBattleEconomyState(), 1000, { mode: 1, matchIndex: 61 }));
  assert.equal(suppressed.receipt.outcome, "WITHHELD_SUPPRESSED_MATCH");
  assert.equal(suppressed.receipt.won, true);
  assert.equal(suppressed.wallet, 850);
  const capped = finish(enter(createBattleEconomyState(), 9999990, { entryFee: 0 }));
  assert.equal(capped.receipt.rewardBits, 7000);
  assert.equal(capped.receipt.credited, 9);
  assert.equal(capped.receipt.walletAfter, 9999999);
  assert.equal(capped.receipt.clamped, true);
});

test("duplicate completion after unrelated wallet changes never restores the old wallet", () => {
  const result = finish(enter());
  const replay = settleBattleAttempt(result.state, { attemptId: "battle:1", outcomeEntries: [1] }, 6200);
  assert.equal(replay.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.wallet, 6200);
  assert.deepEqual(replay.receipt, result.receipt);
  assert.deepEqual(replay.state, result.state);
  const debitReplay = beginBattleAttempt(result.state, { ...match, attemptId: "battle:1" }, 6200);
  assert.equal(debitReplay.wallet, 6200);
  assert.equal(debitReplay.duplicate, true);
});

test("many finalized matches keep a bounded receipt and reject older replays", () => {
  let state = createBattleEconomyState();
  for (let i = 0; i < 600; i += 1) state = finish(enter(state, 150)).state;
  assert.equal(state.settledThrough, 600);
  assert.equal(state.lastReceipt.attemptId, "battle:600");
  assert.ok(JSON.stringify(state).length < 600);
  const restored = normalizeBattleEconomyState(JSON.parse(JSON.stringify(state)));
  const replay = settleBattleAttempt(restored, { attemptId: "battle:1", outcomeEntries: [1] }, 1234);
  assert.equal(replay.ok, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.wallet, 1234);
  assert.deepEqual(replay.state, restored);
});

test("prototype Leave closes the identity without inferring a refund or a victory", () => {
  const entry = enter(createBattleEconomyState(), 1000);
  const abandoned = abandonBattleAttempt(entry.state, { attemptId: "battle:1" }, entry.wallet);
  assert.equal(abandoned.wallet, 850);
  assert.equal(abandoned.receipt.status, "ABANDONED");
  assert.equal(abandoned.receipt.rewardBits, 0);
  const replay = settleBattleAttempt(abandoned.state, { attemptId: "battle:1", outcomeEntries: [1] }, 850);
  assert.equal(replay.wallet, 850);
  assert.equal(replay.receipt.status, "ABANDONED");
  assert.equal(nextBattleAttemptId(abandoned.state), "battle:2");
});

test("malformed contexts, flags and sequence gaps are rejected without mutation", () => {
  const initial = createBattleEconomyState();
  assert.throws(() => enter(initial, 99999999), /INVALID_BATTLE_WALLET/);
  assert.throws(() => enter(initial, 150, { entryFee: -1 }), /INVALID_BATTLE_ENTRY_FEE/);
  assert.throws(() => enter(initial, 150, { evidence: {} }), /UNEXPECTED_BATTLE_ECONOMY_KEY/);
  assert.throws(() => normalizeBattleEconomyState({ ...initial, nextSequence: 3 }), /BATTLE_SEQUENCE_GAP/);
  assert.equal(enter(initial, 150, { attemptId: "battle:2" }).ok, false);
  const entry = enter(initial);
  assert.throws(() => finish(entry, [2]), /INVALID_BATTLE_OUTCOME_FLAG/);
  assert.equal(settleBattleAttempt(entry.state, { attemptId: "battle:2", outcomeEntries: [1] }, 0).ok, false);
});
