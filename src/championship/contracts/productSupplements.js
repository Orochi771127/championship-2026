// Partner supplements -- OWNER_APPROVED_ADAPTATION 2026-11-17 (LINE_FUSION_TAMER_TALENTS_DESIGN_20261117,
// docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md section 6).
//
// NOT original behaviour. Supplements are kept in the bag and given to partners. They are bought with Bits or
// found by playing, and are never a gachapon prize: a supplement changes what a partner can do in a fight, so a
// paid draw must not hand it out.
//
// S1 (this file today): the bag, buying, and the two kinds that act outside battle.
//   recovery  acts at once on the partner's own native words, inside their native range:
//               元氣飲 fills current HP (050) and TP (054) to their maximum (058 / 05c);
//               親密零食 adds 5 affection (020), at most 100.
//   ranch     runs on real time for the whole ranch:
//               成長粉 +15 % training growth for two hours; 安眠香 no night disturbance until the morning.
// S2 adds the pre-battle kind (a modifier on the battle copy, taken back when the battle writes its result).
// T2 (TAMER_TALENTS_T2_20261118) lets four talents act here, each passed in as a number by the caller:
//   藥膳 (bonusPercent)   親密零食, 成長粉 and 同步飲 give that much more; a curve step stays one whole step;
//   長效 (battles)        a carried supplement lasts that many settled battles;
//   補給帶 (slots)        a partner carries that many different supplements;
//   熟客 (discountPercent) the first unit bought each day costs that much less.
//
// Pure: numbers in, numbers out. The saved record lives at progression.tamerSupplies.

import { deepFreeze } from "./championshipContracts.js";

export const SUPPLY_STACK_MAX = 99;
export const SUPPLY_AFFECTION_MAX = 100;
const HOUR_MS = 3600000;

export const SUPPLEMENTS = deepFreeze([
  { id: "supply:vigor", kind: "RECOVERY", bits: 150, effect: { fillVitals: true } },
  { id: "supply:snack", kind: "RECOVERY", bits: 400, effect: { affection: 5 } },
  { id: "supply:growth", kind: "RANCH", bits: 800, effect: { growthPercent: 15, hours: 2 } },
  { id: "supply:sleep", kind: "RANCH", bits: 300, effect: { nightCalm: true } },
  // S2 (2026-11-18): pre-battle supplements. One is put on a partner and is used up by its next settled
  // owned-party battle. It only changes the battle copy (the native curve words 084 attack, 088 defense, 090 speed,
  // at most step 26, as a Sync breakthrough does) and is taken back when the battle writes its result. Password,
  // link and online battles never read it and never use it up.
  { id: "supply:power", kind: "BATTLE", bits: 600, effect: { steps: { "084": 1 } } },
  { id: "supply:guard", kind: "BATTLE", bits: 600, effect: { steps: { "088": 1 } } },
  { id: "supply:gale", kind: "BATTLE", bits: 600, effect: { steps: { "090": 1 } } },
  { id: "supply:sync", kind: "BATTLE", bits: 1000, effect: { syncExpPercent: 50 } }
]);
/** Pre-battle supplements one partner carries into a battle (the talent 補給帶 makes it two). */
export const SUPPLY_BATTLE_SLOTS = 1;
export const SUPPLY_BATTLE_SLOTS_MAX = 2;
/** Settled battles one carried supplement lasts (the talent 長效 adds up to three). */
export const SUPPLY_BATTLES_MAX = 4;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const whole = (value, low, high) => (Number.isSafeInteger(value) ? Math.max(low, Math.min(high, value)) : low);
const percentOf = (value) => (Number.isFinite(value) && value > 0 ? Math.min(100, value) : 0);
/** A supplement's number with the talent 藥膳: `percent` more, rounded to a whole. */
export function supplyBoosted(value, percent = 0) { return Math.round(value * (100 + percentOf(percent)) / 100); }
const CURVE_MAX_STEP = 26;
export const SUPPLEMENT_IDS = Object.freeze(SUPPLEMENTS.map((entry) => entry.id));
const byId = new Map(SUPPLEMENTS.map((entry) => [entry.id, entry]));
export function getSupplement(id) { return byId.get(id) ?? null; }

const count = (value) => (Number.isSafeInteger(value) && value > 0 ? Math.min(value, SUPPLY_STACK_MAX) : 0);

export function createTamerSupplies() { return { version: 1, owned: {}, armed: {}, ranch: {} }; }

/** Accept only the known shape; anything else is an empty bag. */
export function normalizeTamerSupplies(value) {
  const state = createTamerSupplies();
  if (!value || typeof value !== "object" || value.version !== 1) return state;
  for (const id of SUPPLEMENT_IDS) {
    const owned = count(value.owned?.[id]);
    if (owned) state.owned[id] = owned;
    const until = value.ranch?.[id];
    if (byId.get(id).kind === "RANCH" && Number.isSafeInteger(until) && until > 0) state.ranch[id] = until;
  }
  for (const [instanceId, list] of Object.entries(value.armed ?? {})) {
    if (typeof instanceId !== "string" || !instanceId || instanceId.length > 120 || !Array.isArray(list)) continue;
    const kept = [];
    for (const item of list) {
      if (kept.length >= SUPPLY_BATTLE_SLOTS_MAX) break;
      if (byId.get(item?.id)?.kind !== "BATTLE" || kept.some((entry) => entry.id === item.id)) continue;
      // `battles` is what it had when it was put on: one that has already been through a battle is not whole.
      const battlesLeft = whole(item.battlesLeft, 1, SUPPLY_BATTLES_MAX);
      kept.push({ id: item.id, battlesLeft, battles: whole(item.battles, battlesLeft, SUPPLY_BATTLES_MAX) });
    }
    if (kept.length) state.armed[instanceId] = kept;
  }
  // 熟客: the day whose first-purchase discount is used.
  if (typeof value.discountDay === "string" && DAY.test(value.discountDay)) state.discountDay = value.discountDay;
  return state;
}

/** The pre-battle supplements a partner carries, as ids. */
export function armedSupplies(state, instanceId) {
  return (normalizeTamerSupplies(state).armed[instanceId] ?? []).map((item) => item.id);
}

/** The pre-battle supplements a partner carries, with the settled battles each has left. */
export function armedSupplyItems(state, instanceId) {
  return (normalizeTamerSupplies(state).armed[instanceId] ?? []).map((item) => ({ ...item, whole: item.battlesLeft === item.battles }));
}

/**
 * Put one pre-battle supplement from the bag on a partner, for `battles` settled battles (長效). With every one
 * of its `slots` taken (補給帶), a whole one it carried goes back to the bag (refused when the bag already holds
 * 99 of it). One that has already been through a battle cannot go back: it stays until it is used up.
 */
export function armSupply(state, instanceId, id, { slots = SUPPLY_BATTLE_SLOTS, battles = 1 } = {}) {
  const entry = byId.get(id), current = normalizeTamerSupplies(state);
  if (!entry || entry.kind !== "BATTLE") return { ok: false, reason: "SUPPLY_NOT_BATTLE" };
  if (typeof instanceId !== "string" || !instanceId) return { ok: false, reason: "UNKNOWN_INDIVIDUAL" };
  const carried = current.armed[instanceId] ?? [];
  if (carried.some((item) => item.id === id)) return { ok: false, reason: "SUPPLY_ALREADY_ACTIVE" };
  let next = spendSupply(current, id);
  if (!next) return { ok: false, reason: "SUPPLY_NONE_OWNED" };
  const room = whole(slots, SUPPLY_BATTLE_SLOTS, SUPPLY_BATTLE_SLOTS_MAX), lasts = whole(battles, 1, SUPPLY_BATTLES_MAX);
  let kept = carried;
  while (kept.length >= room) {
    const back = kept.find((item) => item.battlesLeft === item.battles);
    if (!back) return { ok: false, reason: "SUPPLY_PARTLY_USED" };
    const returned = addSupply(next, back.id, 1);
    if (returned.added !== 1) return { ok: false, reason: "SUPPLY_STACK_FULL" };
    next = returned.state; kept = kept.filter((item) => item !== back);
  }
  return { ok: true, state: { ...next, armed: { ...next.armed, [instanceId]: [...kept, { id, battlesLeft: lasts, battles: lasts }] } } };
}

/** Take a whole pre-battle supplement off a partner, back into the bag. */
export function disarmSupply(state, instanceId, id) {
  const current = normalizeTamerSupplies(state), carried = current.armed[instanceId] ?? [];
  const item = carried.find((entry) => entry.id === id);
  if (!item) return { ok: false, reason: "SUPPLY_NONE_OWNED" };
  if (item.battlesLeft !== item.battles) return { ok: false, reason: "SUPPLY_PARTLY_USED" };
  const returned = addSupply(current, id, 1);
  if (returned.added !== 1) return { ok: false, reason: "SUPPLY_STACK_FULL" };
  const armed = { ...returned.state.armed }, left = carried.filter((item) => item.id !== id);
  if (left.length) armed[instanceId] = left; else delete armed[instanceId];
  return { ok: true, state: { ...returned.state, armed } };
}

/** The battle copy with the carried supplements' curve steps (never past step 26). The profile is not changed. */
export function supplyBattleProfile(profile, ids = []) {
  const steps = {};
  for (const id of ids) for (const [key, value] of Object.entries(byId.get(id)?.effect?.steps ?? {})) steps[key] = (steps[key] ?? 0) + value;
  if (!Object.keys(steps).length) return profile;
  const next = structuredClone(profile);
  for (const [key, value] of Object.entries(steps)) next.fields[key] = Math.min(CURVE_MAX_STEP, Math.max(next.fields[key] | 0, (next.fields[key] | 0) + value));
  return next;
}

/** The number a supplement's line prints: its affection, growth or Sync EXP share with 藥膳 in it (0 for the rest). */
export function supplyValue(id, bonusPercent = 0) {
  const effect = byId.get(id)?.effect ?? {};
  return supplyBoosted(effect.affection ?? effect.growthPercent ?? effect.syncExpPercent ?? 0, bonusPercent);
}

/** Sync EXP the carried supplements add, in percent (`bonusPercent` more with the talent 藥膳). */
export function supplySyncExpPercent(ids = [], bonusPercent = 0) {
  return ids.reduce((sum, id) => sum + supplyBoosted(byId.get(id)?.effect?.syncExpPercent ?? 0, bonusPercent), 0);
}

/** After a settled battle: what each of these partners carried has one battle less, and is used up at none. */
export function settleArmedSupplies(state, instanceIds = []) {
  const current = normalizeTamerSupplies(state);
  if (!instanceIds.some((id) => current.armed[id])) return current;
  const armed = { ...current.armed };
  for (const id of new Set(instanceIds)) {
    const left = (armed[id] ?? []).filter((item) => item.battlesLeft > 1).map((item) => ({ ...item, battlesLeft: item.battlesLeft - 1 }));
    if (left.length) armed[id] = left; else delete armed[id];
  }
  return { ...current, armed };
}

/** The basic supplements a hunt may turn up (the trader talent 拾荒): the three that cost 400 Bits or less. */
export const SUPPLY_SCAVENGE_POOL = Object.freeze(SUPPLEMENTS.filter((entry) => entry.bits <= 400).map((entry) => entry.id));
/**
 * One hunt's scavenge: `chanceRoll` under `percent` finds one basic supplement, `pickRoll` says which (both in
 * [0, 1)). Returns the new bag and the id, or null when nothing is found or the bag already holds 99 of it.
 */
export function scavengeSupply(state, { percent = 0, chanceRoll = 1, pickRoll = 0 } = {}) {
  const share = percentOf(percent);
  if (!share || !(chanceRoll >= 0) || chanceRoll * 100 >= share) return null;
  const id = SUPPLY_SCAVENGE_POOL[Math.min(SUPPLY_SCAVENGE_POOL.length - 1, Math.floor(Math.max(0, Math.min(0.999999, pickRoll)) * SUPPLY_SCAVENGE_POOL.length))];
  const added = addSupply(state, id, 1);
  return added.added === 1 ? { state: added.state, id } : null;
}

export function supplyOwned(state, id) { return normalizeTamerSupplies(state).owned[id] ?? 0; }

/** `quantity` more of `id`, up to 99 a kind. Returns the state and how many were really added. */
export function addSupply(state, id, quantity = 1) {
  const current = normalizeTamerSupplies(state);
  if (!byId.has(id) || !Number.isSafeInteger(quantity) || quantity < 1) return { state: current, added: 0 };
  const before = current.owned[id] ?? 0, after = Math.min(SUPPLY_STACK_MAX, before + quantity);
  return { state: { ...current, owned: { ...current.owned, [id]: after } }, added: after - before };
}

/** Bits the day's first unit of `id` costs less (熟客): 0 once `day`'s discount is used or without the talent. */
export function supplyDiscount(state, id, { day = null, discountPercent = 0 } = {}) {
  const entry = byId.get(id), percent = percentOf(discountPercent);
  if (!entry || !percent || typeof day !== "string" || !DAY.test(day)) return 0;
  if (normalizeTamerSupplies(state).discountDay === day) return 0;
  return Math.floor(entry.bits * percent / 100);
}

/**
 * What buying `quantity` of `id` costs in Bits and why it may be refused. With the talent 熟客 the first unit
 * bought on `day` costs `discountPercent` less; the day is then marked used.
 */
export function supplyPurchase(state, id, quantity, bits, { day = null, discountPercent = 0 } = {}) {
  const entry = byId.get(id);
  if (!entry) return { ok: false, reason: "SUPPLY_UNKNOWN" };
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: "SUPPLY_INVALID_QUANTITY" };
  if (supplyOwned(state, id) + quantity > SUPPLY_STACK_MAX) return { ok: false, reason: "SUPPLY_STACK_FULL" };
  const discount = supplyDiscount(state, id, { day, discountPercent }), cost = entry.bits * quantity - discount;
  if (!(bits >= cost)) return { ok: false, reason: "SUPPLY_NO_BITS", cost };
  const bought = addSupply(state, id, quantity).state;
  return { ok: true, cost, discount, state: discount > 0 ? { ...bought, discountDay: day } : bought };
}

/** One `id` leaves the bag; null when none is owned. */
export function spendSupply(state, id) {
  const current = normalizeTamerSupplies(state), owned = current.owned[id] ?? 0;
  if (owned < 1) return null;
  const next = { ...current.owned };
  if (owned === 1) delete next[id]; else next[id] = owned - 1;
  return { ...current, owned: next };
}

/**
 * A recovery supplement on one partner's native profile. Returns the new profile, or the reason nothing would
 * change (a full partner does not drink; a partner at 100 affection does not take the snack).
 */
export function applyRecoverySupply(profile, id, { bonusPercent = 0 } = {}) {
  const entry = byId.get(id);
  if (!entry || entry.kind !== "RECOVERY" || !profile?.fields) return { ok: false, reason: "SUPPLY_NOT_RECOVERY" };
  const next = structuredClone(profile), f = next.fields;
  if (entry.effect.fillVitals) {
    if ((f["050"] | 0) >= (f["058"] | 0) && (f["054"] | 0) >= (f["05c"] | 0)) return { ok: false, reason: "SUPPLY_NO_EFFECT" };
    f["050"] = f["058"]; f["054"] = f["05c"];
  } else if (entry.effect.affection) {
    if ((f["020"] | 0) >= SUPPLY_AFFECTION_MAX) return { ok: false, reason: "SUPPLY_NO_EFFECT" };
    f["020"] = Math.min(SUPPLY_AFFECTION_MAX, (f["020"] | 0) + supplyBoosted(entry.effect.affection, bonusPercent)); // 藥膳
  }
  return { ok: true, profile: next };
}

/** Is the ranch supplement `id` running at `nowMs`? */
export function ranchSupplyActive(state, id, nowMs) {
  const until = normalizeTamerSupplies(state).ranch[id];
  return Number.isSafeInteger(until) && until > nowMs;
}

/**
 * Start a ranch supplement. 成長粉 runs `hours` from now (a running one is extended from its own end); 安眠香 runs
 * until `morningMs`, the next 07:00 the caller works out. Returns the state with its end time, or the refusal.
 */
export function startRanchSupply(state, id, nowMs, { morningMs = null } = {}) {
  const entry = byId.get(id), current = normalizeTamerSupplies(state);
  if (!entry || entry.kind !== "RANCH") return { ok: false, reason: "SUPPLY_NOT_RANCH" };
  let until;
  if (entry.effect.hours) until = Math.max(nowMs, current.ranch[id] ?? 0) + entry.effect.hours * HOUR_MS;
  else {
    if (!Number.isSafeInteger(morningMs) || morningMs <= nowMs) return { ok: false, reason: "SUPPLY_NO_EFFECT" };
    if (ranchSupplyActive(current, id, nowMs)) return { ok: false, reason: "SUPPLY_ALREADY_ACTIVE" };
    until = morningMs;
  }
  return { ok: true, until, state: { ...current, ranch: { ...current.ranch, [id]: until } } };
}

/** Training growth the running ranch supplements add, in percent (0 when none runs). */
export function ranchSupplyGrowthPercent(state, nowMs, bonusPercent = 0) {
  return ranchSupplyActive(state, "supply:growth", nowMs) ? supplyBoosted(getSupplement("supply:growth").effect.growthPercent, bonusPercent) : 0;
}
export function ranchSupplyNightCalm(state, nowMs) { return ranchSupplyActive(state, "supply:sleep", nowMs); }
