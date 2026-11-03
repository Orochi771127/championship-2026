// Diamond economy -- OWNER_APPROVED_ADAPTATION 2026-11-02 (DIAMOND_ECONOMY_20261102).
//
// Diamonds buy ranch land (20 → 100 cells, +10 a step at 200 → 2,200) and premium pulls.
// A player who never pays still earns them: every story chapter's first clear,
// every tamer rank reached for the first time and four encyclopedia milestones
// pay 200–500 once each, and the founder box adds 1,000 more. The once-only
// ledger is the gachapon's `claimed` list (keys `dia:*`); the balance is the
// public build's diamond wallet. Pure: numbers in, rewards out.
import { deepFreeze } from "../contracts/championshipContracts.js";

export const LAND_EXPANSION = deepFreeze({
  // Owner 2026-11-03: diamonds for each +10 step, cheapest first (20→30 costs 200 ... 90→100 costs 2,200; 8,000 in all).
  prices: [200, 400, 600, 800, 1000, 1200, 1600, 2200],
  cells: 10,          // one legacy land row
  baseCells: 20,
  maxCells: 100,
  memoryGPerTier: 8   // each step also raises the hunt memory card's capacity
});

export const DIAMOND_REWARDS = deepFreeze({
  storyChapter: 300,
  // First time the tamer rank reaches 1..9.
  rank: [0, 300, 300, 300, 400, 400, 400, 500, 500, 500],
  // Registered species in the encyclopedia.
  dex: [[10, 200], [25, 300], [50, 400], [100, 500]]
});

// The single fixed supporter box (no randomness). In the playtest it is free
// once the player holds a tournament medal; a payment hook can replace the gate later.
export const FOUNDER_PACK = deepFreeze({
  key: "founder:v1",
  diamonds: 1000,
  tickets: 5,
  items: [["auto:feed-core", 1], ["auto:clean-core", 1]],
  frame: "FOUNDER_GOLD",
  unlock: "FIRST_TOURNAMENT_MEDAL"
});

export const diamondRewardKey = Object.freeze({
  story: (chapterId) => `dia:story:${chapterId}`,
  rank: (rank) => `dia:rank:${rank}`,
  dex: (count) => `dia:dex:${count}`
});

/** Rank and encyclopedia rewards now due and not yet in the ledger, in a stable order. */
export function dueDiamondMilestones({ claimed = [], rank = 0, registeredCount = 0 } = {}) {
  const have = new Set(claimed), due = [];
  const reached = Math.max(0, Math.min(DIAMOND_REWARDS.rank.length - 1, Number.isSafeInteger(rank) ? rank : 0));
  for (let r = 1; r <= reached; r += 1) {
    const key = diamondRewardKey.rank(r);
    if (!have.has(key)) due.push(Object.freeze({ key, kind: "RANK", value: r, amount: DIAMOND_REWARDS.rank[r] }));
  }
  for (const [count, amount] of DIAMOND_REWARDS.dex) {
    const key = diamondRewardKey.dex(count);
    if (registeredCount >= count && !have.has(key)) due.push(Object.freeze({ key, kind: "DEX", value: count, amount }));
  }
  return Object.freeze(due);
}

/** How many +10 steps a land capacity holds (0 at 20 cells, 8 at 100). */
export function landExpansionTier(landCapacity) {
  const cells = Number.isFinite(landCapacity) ? landCapacity : LAND_EXPANSION.baseCells;
  const steps = (LAND_EXPANSION.maxCells - LAND_EXPANSION.baseCells) / LAND_EXPANSION.cells;
  return Math.max(0, Math.min(steps, Math.floor((cells - LAND_EXPANSION.baseCells) / LAND_EXPANSION.cells)));
}

/** Diamonds for the next +10 step from this land capacity; null once all 100 cells are open. */
export function landExpansionPrice(landCapacity) {
  return LAND_EXPANSION.prices[landExpansionTier(landCapacity)] ?? null;
}

/** Memory-card capacity a land tier adds; nothing without a card. */
export function landMemoryBonusG(landCapacity, cardMaxG) {
  return cardMaxG > 0 ? landExpansionTier(landCapacity) * LAND_EXPANSION.memoryGPerTier : 0;
}

/** The founder box opens once the player holds any tournament medal. */
export function founderPackUnlocked({ medals = [] } = {}) {
  return Array.isArray(medals) && medals.length > 0;
}
