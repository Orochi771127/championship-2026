// What each tamer rank and each title badge opens (Owner 2026-11-04, launch readiness).
//
// Pure data, read from the game's own tables -- the hunt gate table, the shop
// table, the title-event schedule, the product growth ranks and the rank
// diamond rewards -- so the rank overview and the badge sheet never drift from
// the rules that actually gate play. Names are left to the view (localized).

import { deepFreeze } from "../contracts/championshipContracts.js";
import { CHAMPIONSHIP_GATES } from "../gate/gateCatalog.js";
import { listShopRecords } from "../shop/shopCatalog.js";
import { TITLE_EVENT_SCAN_LIMIT, titleEventAt, tamerRankRequiredFor } from "../battle/titleEventSchedule.js";
import { PRODUCT_RAISING_LIFECYCLE_RULES } from "../contracts/productSpeciesData.js";
import { DIAMOND_REWARDS } from "../gacha/diamondRewards.js";

export const TAMER_RANK_COUNT = 10;
const GATE_UNLOCK_RANK = 1, GATE_UNLOCK_BADGE = 2;

function shopGroup(records) {
  const cages = records.filter(r => r.category === "CAGES").map(r => r.shopRecordIndex);
  return { cages, tools: records.filter(r => r.category === "HUNT_ITEMS").length, plugins: records.filter(r => r.category === "PLUGINS").length };
}

/** One row per rank 0..9: what reaching it opens. Rank 0 lists what is open from the start. */
export const RANK_UNLOCKS = deepFreeze(Array.from({ length: TAMER_RANK_COUNT }, (_, rank) => {
  const gates = CHAMPIONSHIP_GATES.filter(gate => rank === 0 ? gate.unlockKind === 0 : gate.unlockKind === GATE_UNLOCK_RANK && gate.unlockParameter === rank)
    .map(gate => gate.romRecordIndex);
  const shop = shopGroup(listShopRecords().filter(r => rank === 0 ? r.unlockKind === "INITIAL_AVAILABLE"
    : r.unlockKind === "TAMER_RANK_THRESHOLD" && r.unlockParameter === rank));
  let titles = 0;
  for (let id = 0; id < TITLE_EVENT_SCAN_LIMIT; id++) {
    const event = titleEventAt(id);
    if (event && tamerRankRequiredFor(event.unlockThreshold) === rank) titles++;
  }
  return { rank, gates, shop, titles, generation: PRODUCT_RAISING_LIFECYCLE_RULES.ranks[rank].generation,
    capacity: PRODUCT_RAISING_LIFECYCLE_RULES.ranks[rank].capacity, diamonds: DIAMOND_REWARDS.rank[rank] ?? 0 };
}));

/** What winning title `titleId` opens: hunt gates and shop records gated by that badge. */
export function badgeUnlocks(titleId) {
  const gates = CHAMPIONSHIP_GATES.filter(gate => gate.unlockKind === GATE_UNLOCK_BADGE && gate.unlockParameter === titleId).map(gate => gate.romRecordIndex);
  const records = listShopRecords().filter(r => r.unlockKind === "BATTLE_BADGE_ID_0_BASED" && r.unlockParameter === titleId);
  return deepFreeze({ gates, shop: shopGroup(records), shopRecords: records.map(r => r.shopRecordIndex) });
}
