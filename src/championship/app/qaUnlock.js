// QA unlock — an explicit, opt-in grant for acceptance testing.
//
// WHY THIS IS A GRANT AND NOT A BYPASS
// ------------------------------------
// The point of QA is to exercise the rules, so this module changes none of
// them. It hands the player the three resources the original's own rules read
// -- money, tamer rank, battle badges -- through the two PRODUCT_AUTHORED seams
// the application already exposes for exactly this purpose (`creditBits`,
// `setTamerRank`) and the badge seam beside them. Gate admission, shop purchase
// caps, cage slot counts and fee debits all still run, and still decide. A
// tester who can open every gate here has proved the admission code works, not
// that it was skipped.
//
// WHAT IT GRANTS IS DERIVED, NOT TYPED IN
// ---------------------------------------
// Owner requests maximum money/rank/badges, not only the minimum needed for
// gates. Use the last native rank and every ordinary title (exclude tutorial),
// plus gate prerequisites. Preserve anything the session has already earned.
//
// OFF UNLESS ASKED FOR
// --------------------
// Nothing here runs without `?qa=unlock` in the address. There is no stored
// flag and no default-on path, and a test pins that.
//
// REVERTING
// ---------
// This changes the running session, not the rules. The product keeps exactly
// one save key, so there is deliberately no second QA slot; saving while
// unlocked persists the granted state. To go back to ordinary progression,
// start a new game without the parameter.

import { BITS_WALLET_CAP } from "../shop/shopCatalog.js";
import { TAMER_RANK_TABLE_LAST_INDEX } from "../cage/cageCatalog.js";
import { TITLE_EVENT_SCAN_LIMIT } from "../battle/titleEventSchedule.js";

export const QA_UNLOCK_PARAMETER = "qa";
export const QA_UNLOCK_VALUE = "unlock";

/**
 * Whether the address asks for the unlock. Pure, so the decision is testable
 * without a browser and cannot be reached by anything but an explicit request.
 *
 * @param {string} search a `location.search` value
 */
export function qaUnlockRequested(search) {
  if (typeof search !== "string" || search === "") return false;
  return new URLSearchParams(search).get(QA_UNLOCK_PARAMETER) === QA_UNLOCK_VALUE;
}

/**
 * What has to be true for every gate in the catalog to be enterable.
 *
 * @param {Array<{unlockKind:number, unlockParameter:number, entranceFeeBits:number}>} gates
 */
export function qaUnlockPlan(gates) {
  const rows = Array.isArray(gates) ? gates : [];
  const rankGated = rows.filter((gate) => gate?.unlockKind === 1).map((gate) => gate.unlockParameter ?? 0);
  const badgeGated = rows.filter((gate) => gate?.unlockKind === 2).map((gate) => gate.unlockParameter ?? 0);
  return Object.freeze({
    // The wallet cap, not the largest fee: the tester also has to be able to
    // buy the shop out, and the cap is the value the shop itself enforces.
    bits: BITS_WALLET_CAP,
    tamerRank: Math.max(TAMER_RANK_TABLE_LAST_INDEX, ...rankGated),
    battleBadges: Object.freeze([...new Set([
      ...Array.from({ length: TITLE_EVENT_SCAN_LIMIT }, (_, index) => index),
      ...badgeGated
    ])].sort((a, b) => a - b)),
    gateCount: rows.length
  });
}

/**
 * Apply the plan through the application's own seams.
 *
 * Returns what was granted so a caller can report it; throws nothing that would
 * stop the game, because a QA convenience must never be able to break a boot.
 *
 * @param {object} app the standalone application
 * @param {Array} gates the gate catalog
 */
export function applyQaUnlock(app, gates) {
  const plan = qaUnlockPlan(gates);
  const granted = { bits: null, tamerRank: null, battleBadges: null, failures: [] };
  const attempt = (name, run) => {
    try { granted[name] = run(); } catch (error) { granted.failures.push(`${name}: ${error.message}`); }
  };
  // Credit the difference, because the seam adds to the wallet rather than
  // setting it, and crediting past the cap is a shop error rather than a clamp.
  attempt("bits", () => {
    const current = app.getShopFrame?.()?.bits ?? 0;
    const room = Math.max(0, plan.bits - current);
    return room === 0 ? current : app.creditBits(room).bits;
  });
  // A grant is additive: Continue must never revoke an earned title or rank.
  attempt("tamerRank", () => app.setTamerRank(Math.max(app.getTamerRank?.() ?? 0, plan.tamerRank)));
  attempt("battleBadges", () => app.setBattleBadges([
    ...new Set([...(app.getBattleBadges?.() ?? []), ...plan.battleBadges])
  ].sort((a, b) => a - b)));
  return Object.freeze({ ...granted, plan });
}
