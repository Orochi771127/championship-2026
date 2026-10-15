// TEMPORARY public friends-playtest policy, not production economic/progression rules.
// Explicitly disabled only by a future owner-approved operational release. No clock,
// expiry, release counter, network-account entitlement, real currency or rank writes.
export const FRIENDS_PLAYTEST_POLICY = Object.freeze({
  enabled: true, version: 1, grantId: 'friends-playtest:coins:v1', grantCoins: 100000,
  initialTestDiamonds: 10000, shopOpen: true, huntOpen: true, fullDexView: true, lateMedalPreview: true
});
export function normalizeFriendsPlaytestState(value) {
  if (value == null) return null;
  if (![1,2].includes(value.version) || !Array.isArray(value.grants) || value.grants.some(id => id !== FRIENDS_PLAYTEST_POLICY.grantId)) {
    throw new TypeError('INVALID_FRIENDS_PLAYTEST_STATE');
  }
  const diamonds = value.diamonds ?? 0, purchases = value.purchases ?? [];
  if (!Number.isSafeInteger(diamonds) || diamonds < 0 || diamonds > 10000 || !Array.isArray(purchases) || purchases.some(row => ![2,3,4].includes(row)) || new Set(purchases).size !== purchases.length) throw new TypeError('INVALID_TEST_DIAMOND_WALLET');
  return Object.freeze({version: value.version, grants: Object.freeze([...new Set(value.grants)]), diamonds, purchases:Object.freeze([...purchases])});
}
export function grantFriendsPlaytestCoins(bits, state, cap, policy = FRIENDS_PLAYTEST_POLICY) {
  const current = normalizeFriendsPlaytestState(state);
  if (!policy?.enabled || current?.grants.includes(policy.grantId)) return {bits, state:current, granted:0};
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > cap) throw new TypeError('INVALID_PLAYTEST_WALLET');
  // Called only for a newly created local save. Existing saves never enter here.
  const next = Math.min(cap, policy.grantCoins);
  return {bits:next, granted:next-bits, state:normalizeFriendsPlaytestState({version:2,grants:[...(current?.grants??[]),policy.grantId], diamonds:policy.initialTestDiamonds, purchases:[]})};
}
// Actual tournament requirements, never an arbitrary half of ID order. Advanced
// rank (6/8), plus rank-4 three-creature specialized teams/arena conditions.
// This yields 31 of the original 61. Rank-0/2 medals always remain naturally earned.
export function isLateMedalPreview(event, condition) {
  if (!event?.scannedByGame) return false;
  if (event.unlockThreshold >= 3) return true;
  return event.unlockThreshold === 2 && condition.slots === 3 &&
    (condition.family !== 0 || condition.generation !== 7 || condition.attribute !== 0 ||
      condition.minimum03c > 0 || condition.minimum010 > 0 || condition.individual018 !== -1 ||
      condition.species014 !== 0 || condition.field14 !== 0 || condition.field10 !== -1);
}

// Separate simulated currency. Never calls Wallet, payment APIs or real entitlements.
export function purchaseTestRanchRow(wallet, row) {
  const state = normalizeFriendsPlaytestState(wallet);
  if (![2,3,4].includes(row)) return {ok:false,reason:'INVALID_TEST_ROW',state};
  if (state?.purchases.includes(row)) return {ok:false,reason:'ALREADY_OPEN',state};
  if (!state || state.diamonds < 1000) return {ok:false,reason:'INSUFFICIENT_TEST_DIAMONDS',state};
  return {ok:true,state:normalizeFriendsPlaytestState({...state,diamonds:state.diamonds-1000,purchases:[...state.purchases,row]}),receipt:Object.freeze({row,amount:1000,currency:'TEST_DIAMONDS',idempotencyKey:`friends-playtest:ranch-row:${row}`,testOnly:true})};
}

// Owner-approved existing-tester catch-up. Version2 records that allocation was
// handled; never replenish a spent new-save wallet or overwrite prior purchases.
export function migrateFriendsPlaytestDiamonds(value, policy = FRIENDS_PLAYTEST_POLICY) {
  const state = normalizeFriendsPlaytestState(value);
  if (!policy?.enabled || state?.version === 2) return {state,changed:false,granted:0};
  const initialized = state && (state.grants.includes(policy.grantId) || state.diamonds > 0 || state.purchases.length > 0);
  const granted = initialized ? 0 : policy.initialTestDiamonds;
  return {state:normalizeFriendsPlaytestState({version:2,grants:state?.grants??[],diamonds:initialized?state.diamonds:granted,purchases:state?.purchases??[]}),changed:true,granted};
}
