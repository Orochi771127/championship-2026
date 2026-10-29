// First-bind reward (OWNER_APPROVED_ADAPTATION 2026-10-29): a one-time Bits gift
// when a guest pass is upgraded to a Google / Facebook / Discord / email account.
//
// The cloud decides who may claim (claim_bind_reward in
// supabase/migrations/001_championship_online.sql keeps one claim per account
// in a ledger the client cannot write); the save records that this save has
// been paid, in its existing `flags` slice, so it is paid once even if the
// player signs in to a second account. The local simulation only previews the
// gift and never pays it. No new storage key, no clock, no real currency.

export const ONLINE_BIND_REWARD_BITS = 5000;
export const ONLINE_BIND_REWARD_PROVIDERS = Object.freeze(["google", "facebook", "discord", "email"]);

/** The save's record of a paid first-bind reward, or null; throws on a malformed record. */
export function normalizeOnlineBindReward(value) {
  if (value == null) return null;
  if (value.version !== 1 || !ONLINE_BIND_REWARD_PROVIDERS.includes(value.provider)) throw new TypeError("INVALID_ONLINE_BIND_REWARD");
  if (!Number.isSafeInteger(value.bits) || value.bits < 0 || value.bits > ONLINE_BIND_REWARD_BITS) throw new TypeError("INVALID_ONLINE_BIND_REWARD_BITS");
  if (typeof value.claimedAt !== "string" || Number.isNaN(Date.parse(value.claimedAt))) throw new TypeError("INVALID_ONLINE_BIND_REWARD_TIME");
  return Object.freeze({ version: 1, provider: value.provider, bits: value.bits, claimedAt: value.claimedAt });
}

/**
 * What a claim would credit: never more than the policy amount, never past
 * the wallet cap, and nothing at all once this save has been paid.
 */
export function planOnlineBindReward({ bits, cap, current, provider, rewardBits = ONLINE_BIND_REWARD_BITS, claimedAt }) {
  if (normalizeOnlineBindReward(current)) return Object.freeze({ ok: false, reason: "BIND_REWARD_ALREADY_CLAIMED" });
  if (!ONLINE_BIND_REWARD_PROVIDERS.includes(provider)) return Object.freeze({ ok: false, reason: "BIND_REWARD_PROVIDER_INVALID" });
  if (!Number.isSafeInteger(bits) || bits < 0 || !Number.isSafeInteger(cap) || bits > cap) throw new TypeError("INVALID_BIND_REWARD_WALLET");
  const offered = Number.isSafeInteger(rewardBits) && rewardBits > 0 ? Math.min(rewardBits, ONLINE_BIND_REWARD_BITS) : 0;
  const next = Math.min(cap, bits + offered);
  return Object.freeze({ ok: true, bits: next, credited: next - bits,
    record: normalizeOnlineBindReward({ version: 1, provider, bits: next - bits, claimedAt }) });
}
