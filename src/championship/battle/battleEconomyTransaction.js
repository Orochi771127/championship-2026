// App-owned battle economy transitions. These functions hold no state and never
// write storage. The sequence/receipt protocol is a bounded web persistence
// safeguard; reward arithmetic remains in the original traced reward module.
import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  BATTLE_REWARD_WALLET_CAP,
  resolveBattleReward,
  creditBattleReward
} from "./battleRewardTransaction.js";

const STATE_KEYS = ["nextSequence", "settledThrough", "active", "lastReceipt"];
const ATTEMPT_KEYS = ["attemptId", "sequence", "matchIndex", "mode", "battleType", "entryFee", "payout", "expectedRounds"];
const RECEIPT_KEYS = ["attemptId", "sequence", "matchIndex", "mode", "battleType", "entryFee", "payout", "status", "outcome", "won", "rewardBits", "credited", "walletAfter", "clamped"];
const SPEC_KEYS = ATTEMPT_KEYS.filter((key) => key !== "sequence");
const MAX_ROUNDS = 256; // Data budget, not an original tournament rule.

function fail(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleEconomyError";
  throw error;
}

function keys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`INVALID_${label}`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`UNEXPECTED_BATTLE_ECONOMY_KEY: ${label}.${key}`);
  }
}

function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`INVALID_${label}`);
  return value;
}

function walletValue(wallet) { return integer(wallet, "BATTLE_WALLET", 0, BATTLE_REWARD_WALLET_CAP); }

function sequenceOf(attemptId) {
  if (typeof attemptId !== "string" || !/^battle:[1-9][0-9]{0,15}$/.test(attemptId)) fail("INVALID_BATTLE_ATTEMPT_ID");
  return integer(Number(attemptId.slice(7)), "BATTLE_ATTEMPT_SEQUENCE", 1, Number.MAX_SAFE_INTEGER - 1);
}

function context(value) {
  const sequence = sequenceOf(value.attemptId);
  if (value.sequence !== undefined && value.sequence !== sequence) fail("BATTLE_ATTEMPT_ID_MISMATCH");
  return {
    attemptId: value.attemptId,
    sequence,
    matchIndex: integer(value.matchIndex, "BATTLE_MATCH_INDEX", 0, 65535),
    mode: integer(value.mode, "BATTLE_REWARD_MODE", 0, 5),
    battleType: integer(value.battleType, "BATTLE_TYPE", 0, 255),
    entryFee: integer(value.entryFee, "BATTLE_ENTRY_FEE", 0, BATTLE_REWARD_WALLET_CAP),
    payout: integer(value.payout, "BATTLE_PAYOUT", 0, 0xffffffff)
  };
}

function normalizeAttempt(value) {
  keys(value, ATTEMPT_KEYS, "BATTLE_ATTEMPT");
  integer(value.sequence, "BATTLE_ATTEMPT_SEQUENCE", 1, Number.MAX_SAFE_INTEGER - 1);
  return { ...context(value), expectedRounds: integer(value.expectedRounds, "BATTLE_EXPECTED_ROUNDS", 1, MAX_ROUNDS) };
}

function normalizeReceipt(value) {
  keys(value, RECEIPT_KEYS, "BATTLE_RECEIPT");
  integer(value.sequence, "BATTLE_RECEIPT_SEQUENCE", 1, Number.MAX_SAFE_INTEGER - 1);
  const normalized = context(value);
  if (!["SETTLED", "ABANDONED"].includes(value.status)) fail("INVALID_BATTLE_RECEIPT_STATUS");
  if (typeof value.won !== "boolean" || typeof value.clamped !== "boolean") fail("INVALID_BATTLE_RECEIPT_FLAGS");
  const rewardBits = integer(value.rewardBits, "BATTLE_REWARD_BITS", 0, 0xffffffff);
  const credited = integer(value.credited, "BATTLE_CREDITED", 0, BATTLE_REWARD_WALLET_CAP);
  const walletAfter = walletValue(value.walletAfter);
  if (credited > rewardBits || walletAfter < credited) fail("INVALID_BATTLE_RECEIPT_CREDIT");
  if (value.status === "ABANDONED") {
    if (value.outcome !== "ABANDONED" || value.won || rewardBits !== 0 || credited !== 0 || value.clamped) fail("INVALID_BATTLE_ABANDONMENT");
  } else {
    const reward = resolveBattleReward({ ...normalized, outcomeEntries: [value.won ? 1 : 0] });
    const credit = creditBattleReward({ wallet: walletAfter - credited, pending: reward.pending });
    if (reward.pending !== rewardBits || reward.outcome !== value.outcome
        || credit.credited !== credited || credit.wallet !== walletAfter || credit.clamped !== value.clamped) fail("INVALID_BATTLE_RECEIPT_REWARD");
  }
  return { ...normalized, status: value.status, outcome: value.outcome, won: value.won, rewardBits, credited, walletAfter, clamped: value.clamped };
}

export function createBattleEconomyState() {
  return deepFreeze({ nextSequence: 1, settledThrough: 0, active: null, lastReceipt: null });
}

/** Strict durable shape. At most one active attempt and one receipt ever exist. */
export function normalizeBattleEconomyState(value) {
  keys(value, STATE_KEYS, "BATTLE_ECONOMY");
  const nextSequence = integer(value.nextSequence, "BATTLE_NEXT_SEQUENCE", 1);
  const settledThrough = integer(value.settledThrough, "BATTLE_SETTLED_THROUGH", 0, Number.MAX_SAFE_INTEGER - 1);
  const active = value.active === null ? null : normalizeAttempt(value.active);
  const lastReceipt = value.lastReceipt === null ? null : normalizeReceipt(value.lastReceipt);
  if ((settledThrough === 0) !== (lastReceipt === null)
      || (lastReceipt && lastReceipt.sequence !== settledThrough)) fail("BATTLE_RECEIPT_SEQUENCE_MISMATCH");
  if (active ? active.sequence !== settledThrough + 1 || nextSequence !== active.sequence + 1
    : nextSequence !== settledThrough + 1) fail("BATTLE_SEQUENCE_GAP");
  return deepFreeze({ nextSequence, settledThrough, active, lastReceipt });
}

export function nextBattleAttemptId(state) {
  return `battle:${normalizeBattleEconomyState(state).nextSequence}`;
}

function reply(state, wallet, { ok = false, duplicate = false, reason = null, attempt = state.active, receipt = null } = {}) {
  return deepFreeze({ ok, duplicate, reason, state, wallet, attempt, receipt });
}

function completedReplay(state, wallet, sequence) {
  return reply(state, wallet, {
    ok: sequence === state.lastReceipt?.sequence,
    duplicate: true,
    reason: "BATTLE_ATTEMPT_ALREADY_FINALIZED",
    attempt: null,
    receipt: sequence === state.lastReceipt?.sequence ? state.lastReceipt : null
  });
}

/** The caller validates eligibility/builds the runtime before applying this debit. */
export function beginBattleAttempt(value, spec, wallet) {
  const state = normalizeBattleEconomyState(value);
  walletValue(wallet);
  keys(spec, SPEC_KEYS, "BATTLE_ENTRY_SPEC");
  const candidate = normalizeAttempt({ ...spec, sequence: sequenceOf(spec.attemptId), expectedRounds: spec.expectedRounds ?? 1 });
  if (candidate.sequence <= state.settledThrough) return completedReplay(state, wallet, candidate.sequence);
  if (state.active) {
    const same = JSON.stringify(candidate) === JSON.stringify(state.active);
    return reply(state, wallet, { ok: same, duplicate: same, reason: same ? "BATTLE_ENTRY_ALREADY_ACCEPTED" : "BATTLE_ATTEMPT_ACTIVE" });
  }
  if (candidate.sequence !== state.nextSequence) return reply(state, wallet, { reason: "BATTLE_ATTEMPT_SEQUENCE_MISMATCH" });
  if (wallet < candidate.entryFee) return reply(state, wallet, { reason: "INSUFFICIENT_FUNDS" });
  const updated = normalizeBattleEconomyState({ ...state, nextSequence: candidate.sequence + 1, active: candidate });
  return reply(updated, wallet - candidate.entryFee, { ok: true, attempt: updated.active });
}

function activeFor(state, attemptId, wallet) {
  const sequence = sequenceOf(attemptId);
  if (sequence <= state.settledThrough) return completedReplay(state, wallet, sequence);
  if (!state.active || state.active.attemptId !== attemptId) return reply(state, wallet, { reason: "BATTLE_ATTEMPT_NOT_ACTIVE" });
  return null;
}

/** Only completed round flags enter this function; no presentation verdict is read. */
export function settleBattleAttempt(value, result, wallet) {
  const state = normalizeBattleEconomyState(value);
  walletValue(wallet);
  keys(result, ["attemptId", "outcomeEntries"], "BATTLE_SETTLEMENT");
  const previous = activeFor(state, result.attemptId, wallet);
  if (previous) return previous;
  if (!Array.isArray(result.outcomeEntries) || result.outcomeEntries.length !== state.active.expectedRounds) {
    return reply(state, wallet, { reason: "BATTLE_RESULT_INCOMPLETE" });
  }
  for (const flag of result.outcomeEntries) integer(flag, "BATTLE_OUTCOME_FLAG", 0, 1);
  const reward = resolveBattleReward({ ...state.active, outcomeEntries: result.outcomeEntries });
  const credit = creditBattleReward({ wallet, pending: reward.pending });
  const { expectedRounds, ...attempt } = state.active;
  const receipt = normalizeReceipt({ ...attempt, status: "SETTLED", outcome: reward.outcome, won: reward.won,
    rewardBits: reward.pending, credited: credit.credited, walletAfter: credit.wallet, clamped: credit.clamped });
  const updated = normalizeBattleEconomyState({ ...state, settledThrough: receipt.sequence, active: null, lastReceipt: receipt });
  return reply(updated, credit.wallet, { ok: true, attempt: null, receipt: updated.lastReceipt });
}

/** Retains the current prototype LEAVE behavior. No original refund rule is inferred. */
export function abandonBattleAttempt(value, result, wallet) {
  const state = normalizeBattleEconomyState(value);
  walletValue(wallet);
  keys(result, ["attemptId"], "BATTLE_ABANDONMENT");
  const previous = activeFor(state, result.attemptId, wallet);
  if (previous) return previous;
  const { expectedRounds, ...attempt } = state.active;
  const receipt = normalizeReceipt({ ...attempt, status: "ABANDONED", outcome: "ABANDONED", won: false,
    rewardBits: 0, credited: 0, walletAfter: wallet, clamped: false });
  const updated = normalizeBattleEconomyState({ ...state, settledThrough: receipt.sequence, active: null, lastReceipt: receipt });
  return reply(updated, wallet, { ok: true, attempt: null, receipt: updated.lastReceipt });
}
