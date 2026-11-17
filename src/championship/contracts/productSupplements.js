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
/** Pre-battle supplements one partner carries into a battle. */
export const SUPPLY_BATTLE_SLOTS = 1;
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
      if (kept.length >= SUPPLY_BATTLE_SLOTS) break;
      if (byId.get(item?.id)?.kind === "BATTLE" && !kept.some((entry) => entry.id === item.id)) kept.push({ id: item.id, battlesLeft: 1 });
    }
    if (kept.length) state.armed[instanceId] = kept;
  }
  return state;
}

/** The pre-battle supplements a partner carries, as ids. */
export function armedSupplies(state, instanceId) {
  return (normalizeTamerSupplies(state).armed[instanceId] ?? []).map((item) => item.id);
}

/**
 * Put one pre-battle supplement from the bag on a partner. With its slot taken, the one it carried goes back to
 * the bag (refused when the bag already holds 99 of it).
 */
export function armSupply(state, instanceId, id) {
  const entry = byId.get(id), current = normalizeTamerSupplies(state);
  if (!entry || entry.kind !== "BATTLE") return { ok: false, reason: "SUPPLY_NOT_BATTLE" };
  if (typeof instanceId !== "string" || !instanceId) return { ok: false, reason: "UNKNOWN_INDIVIDUAL" };
  const carried = current.armed[instanceId] ?? [];
  if (carried.some((item) => item.id === id)) return { ok: false, reason: "SUPPLY_ALREADY_ACTIVE" };
  let next = spendSupply(current, id);
  if (!next) return { ok: false, reason: "SUPPLY_NONE_OWNED" };
  let kept = carried;
  if (carried.length >= SUPPLY_BATTLE_SLOTS) {
    const back = carried[0], returned = addSupply(next, back.id, 1);
    if (returned.added !== 1) return { ok: false, reason: "SUPPLY_STACK_FULL" };
    next = returned.state; kept = carried.slice(1);
  }
  return { ok: true, state: { ...next, armed: { ...next.armed, [instanceId]: [...kept, { id, battlesLeft: 1 }] } } };
}

/** Take a pre-battle supplement off a partner, back into the bag. */
export function disarmSupply(state, instanceId, id) {
  const current = normalizeTamerSupplies(state), carried = current.armed[instanceId] ?? [];
  if (!carried.some((item) => item.id === id)) return { ok: false, reason: "SUPPLY_NONE_OWNED" };
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

/** Sync EXP the carried supplements add, in percent. */
export function supplySyncExpPercent(ids = []) {
  return ids.reduce((sum, id) => sum + (byId.get(id)?.effect?.syncExpPercent ?? 0), 0);
}

/** After a settled battle: what each of these partners carried is used up. */
export function settleArmedSupplies(state, instanceIds = []) {
  const current = normalizeTamerSupplies(state);
  if (!instanceIds.some((id) => current.armed[id])) return current;
  const armed = { ...current.armed };
  for (const id of instanceIds) delete armed[id];
  return { ...current, armed };
}

export function supplyOwned(state, id) { return normalizeTamerSupplies(state).owned[id] ?? 0; }

/** `quantity` more of `id`, up to 99 a kind. Returns the state and how many were really added. */
export function addSupply(state, id, quantity = 1) {
  const current = normalizeTamerSupplies(state);
  if (!byId.has(id) || !Number.isSafeInteger(quantity) || quantity < 1) return { state: current, added: 0 };
  const before = current.owned[id] ?? 0, after = Math.min(SUPPLY_STACK_MAX, before + quantity);
  return { state: { ...current, owned: { ...current.owned, [id]: after } }, added: after - before };
}

/** What buying `quantity` of `id` costs in Bits and why it may be refused. */
export function supplyPurchase(state, id, quantity, bits) {
  const entry = byId.get(id);
  if (!entry) return { ok: false, reason: "SUPPLY_UNKNOWN" };
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, reason: "SUPPLY_INVALID_QUANTITY" };
  if (supplyOwned(state, id) + quantity > SUPPLY_STACK_MAX) return { ok: false, reason: "SUPPLY_STACK_FULL" };
  const cost = entry.bits * quantity;
  if (!(bits >= cost)) return { ok: false, reason: "SUPPLY_NO_BITS", cost };
  return { ok: true, cost, state: addSupply(state, id, quantity).state };
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
export function applyRecoverySupply(profile, id) {
  const entry = byId.get(id);
  if (!entry || entry.kind !== "RECOVERY" || !profile?.fields) return { ok: false, reason: "SUPPLY_NOT_RECOVERY" };
  const next = structuredClone(profile), f = next.fields;
  if (entry.effect.fillVitals) {
    if ((f["050"] | 0) >= (f["058"] | 0) && (f["054"] | 0) >= (f["05c"] | 0)) return { ok: false, reason: "SUPPLY_NO_EFFECT" };
    f["050"] = f["058"]; f["054"] = f["05c"];
  } else if (entry.effect.affection) {
    if ((f["020"] | 0) >= SUPPLY_AFFECTION_MAX) return { ok: false, reason: "SUPPLY_NO_EFFECT" };
    f["020"] = Math.min(SUPPLY_AFFECTION_MAX, (f["020"] | 0) + entry.effect.affection);
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
export function ranchSupplyGrowthPercent(state, nowMs) {
  return ranchSupplyActive(state, "supply:growth", nowMs) ? getSupplement("supply:growth").effect.growthPercent : 0;
}
export function ranchSupplyNightCalm(state, nowMs) { return ranchSupplyActive(state, "supply:sleep", nowMs); }
