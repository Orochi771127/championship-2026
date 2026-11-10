// Sync Level -- OWNER_APPROVED_ADAPTATION 2026-11-09 (BATTLE_MODE_PRISM_AND_JOURNEY_20261109).
//
// NOT original behaviour. Every partner carries a Sync Level 1..50 and Sync EXP,
// earned in battle. The level is a MODIFIER: it is applied to a copy of the
// individual when a battle is built and taken back off when the battle writes
// its result, so the ROM individual fields, the save words and the battle codes
// never hold a boosted value.
//
// What a level does, by engine:
//   Auto battle  every level +0.6 % max HP and max TP; each breakthrough one more
//                step on the native stat curves (steps, not named stats).
//   Data Arena   every level +0.4 % partner power; each breakthrough +2 %.
// Title matches and championships read the level under a cap by tamer rank.
// Password, link and online battles ignore it and pay no Sync EXP.
//
// Pure: numbers in, numbers out. The saved record lives at progression.syncLevels.

import { deepFreeze } from "./championshipContracts.js";

export const SYNC_LEVEL_MAX = 50;
export const SYNC_REBIRTH_KEEP = 0.3;
const CURVE_MAX_STEP = 26; // BATTLE_STAT_CURVE_MAX_INDEX
const VITAL_MAX = 32767;
const COUNT_MAX = 1e9;

/** EXP needed to go from `level` to `level + 1`. */
export function syncExpRequired(level) {
  return Math.round(80 * Math.pow(Math.max(1, Math.min(SYNC_LEVEL_MAX, level)), 1.35));
}

/**
 * The milestones. `steps` lists the native curve offsets that gain one step in
 * the auto battle; the Data Arena reads `arena` (added partner power).
 */
export const SYNC_BREAKTHROUGHS = deepFreeze([
  { level: 10, id: "STRIKE", steps: ["084"], arena: 0.02 },
  { level: 20, id: "GUARD", steps: ["088"], arena: 0.02 },
  { level: 30, id: "TEMPO", steps: ["08c", "090"], arena: 0.02 },
  { level: 40, id: "SIGNATURE", steps: ["084"], arena: 0.02 },
  { level: 50, id: "CROWN", steps: ["084", "088", "08c", "090"], arena: 0.02 }
]);

/** How much of each kind of battle's level requirement a win pays (a loss pays 40 % of it). */
export const SYNC_BATTLE_SHARE = deepFreeze({ TITLE: 0.5, CHAMPIONSHIP: 0.5, FREE: 0.4, ARENA: 0.4, PRACTICE: 0.12 });

export function syncCapForRank(rank) {
  const value = Number.isSafeInteger(rank) ? Math.max(0, rank) : 0;
  return Math.min(SYNC_LEVEL_MAX, 10 + 5 * value);
}

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, COUNT_MAX) : 0);
const level = (value) => (Number.isSafeInteger(value) ? Math.max(1, Math.min(SYNC_LEVEL_MAX, value)) : 1);

export function createSyncLevelState() {
  return { version: 1, partners: {}, crystals: 0 };
}

/** Accept only the known shape; anything else becomes Lv.1 with no EXP. */
export function normalizeSyncLevels(value) {
  const base = createSyncLevelState();
  if (!value || typeof value !== "object" || value.version !== 1) return base;
  const partners = {};
  for (const [id, entry] of Object.entries(value.partners ?? {})) {
    if (typeof id !== "string" || !id || id.length > 120 || !entry || typeof entry !== "object") continue;
    const lv = level(entry.level);
    const exp = lv >= SYNC_LEVEL_MAX ? 0 : Math.min(count(entry.exp), syncExpRequired(lv) - 1);
    partners[id] = { level: lv, exp, rebirths: count(entry.rebirths) };
  }
  return { version: 1, partners, crystals: count(value.crystals) };
}

export function syncOf(state, instanceId) {
  const entry = normalizeSyncLevels(state).partners[instanceId];
  return Object.freeze({ level: entry?.level ?? 1, exp: entry?.exp ?? 0, next: entry?.level >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(entry?.level ?? 1) });
}

export function syncBreakthroughsAt(lv) {
  return SYNC_BREAKTHROUGHS.filter((entry) => lv >= entry.level);
}

/** Percent bonus to max HP / max TP at a level (0 at Lv.1). */
export function syncVitalPercent(lv) {
  return Math.round((level(lv) - 1) * 0.6 * 10) / 10;
}

/** Data Arena partner power multiplier at a level. */
export function syncArenaPower(lv) {
  const value = level(lv);
  return 1 + (value - 1) * 0.004 + syncBreakthroughsAt(value).reduce((sum, entry) => sum + entry.arena, 0);
}

/** Curve steps a level adds, by native offset. */
export function syncCurveSteps(lv) {
  const steps = {};
  for (const entry of syncBreakthroughsAt(level(lv))) for (const key of entry.steps) steps[key] = (steps[key] ?? 0) + 1;
  return steps;
}

/** EXP one battle pays a partner of `lv`. */
export function syncBattleExp(lv, { kind, won }) {
  const share = SYNC_BATTLE_SHARE[kind];
  if (!share) return 0;
  return Math.max(1, Math.round(syncExpRequired(lv) * share * (won ? 1 : 0.4)));
}

/**
 * A rebirth (native 03c rebirth count went up) keeps 30 % of the level. The
 * count is remembered so the same rebirth is applied once.
 */
export function reconcileSyncRebirth(state, instanceId, rebirthCount) {
  const current = normalizeSyncLevels(state);
  const entry = current.partners[instanceId];
  const seen = count(rebirthCount);
  if (!entry) return seen > 0 ? { ...current, partners: { ...current.partners, [instanceId]: { level: 1, exp: 0, rebirths: seen } } } : current;
  if (seen <= entry.rebirths) return current;
  const kept = Math.max(1, Math.floor(entry.level * SYNC_REBIRTH_KEEP));
  return { ...current, partners: { ...current.partners, [instanceId]: { level: kept, exp: 0, rebirths: seen } } };
}

/**
 * Add EXP to one partner. Past Lv.50 the EXP becomes high-purity crystals,
 * one crystal point per EXP. Returns the new state and what changed.
 */
export function grantSyncExp(state, instanceId, amount) {
  const current = normalizeSyncLevels(state);
  const before = current.partners[instanceId] ?? { level: 1, exp: 0, rebirths: 0 };
  let lv = before.level, exp = before.exp, left = count(Math.round(amount)), overflow = 0;
  while (left > 0) {
    if (lv >= SYNC_LEVEL_MAX) { overflow += left; left = 0; break; }
    const need = syncExpRequired(lv) - exp;
    if (left < need) { exp += left; left = 0; break; }
    left -= need; lv += 1; exp = 0;
  }
  const after = { level: lv, exp, rebirths: before.rebirths };
  const next = { ...current, partners: { ...current.partners, [instanceId]: after }, crystals: count(current.crystals + overflow) };
  return {
    state: next,
    gain: deepFreeze({
      instanceId, amount: count(Math.round(amount)), overflow,
      before: { level: before.level, exp: before.exp, next: before.level >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(before.level) },
      after: { level: lv, exp, next: lv >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(lv) },
      breakthroughs: SYNC_BREAKTHROUGHS.filter((entry) => entry.level > before.level && entry.level <= lv).map((entry) => entry.id),
      vitalPercent: { before: syncVitalPercent(before.level), after: syncVitalPercent(lv) }
    })
  };
}

/** Spend crystal points on one partner. Refuses more than the balance. */
export function feedSyncCrystals(state, instanceId, amount) {
  const current = normalizeSyncLevels(state);
  const spend = Math.min(count(Math.round(amount)), current.crystals);
  if (spend <= 0) return null;
  const fed = grantSyncExp({ ...current, crystals: current.crystals - spend }, instanceId, spend);
  return fed;
}

/**
 * The battle copy of an individual at `lv`: max/current HP and TP scaled, curve
 * steps added. The original profile is untouched.
 */
export function boostSyncNativeProfile(profile, lv) {
  const value = level(lv);
  const next = structuredClone(profile);
  if (value <= 1) return next;
  const f = next.fields, factor = 1 + syncVitalPercent(value) / 100;
  const scale = (key, cap) => { f[key] = Math.min(cap, Math.round(f[key] * factor)); };
  scale("058", VITAL_MAX); scale("05c", VITAL_MAX);
  f["050"] = Math.min(f["058"], Math.round(f["050"] * factor));
  f["054"] = Math.min(f["05c"], Math.round(f["054"] * factor));
  for (const [key, steps] of Object.entries(syncCurveSteps(value))) f[key] = Math.min(CURVE_MAX_STEP, Math.max(f[key], f[key] + steps));
  return next;
}

/**
 * Take the boost back off a battle result. `original` is the saved profile the
 * battle copy was made from; the result keeps everything the battle wrote
 * (battles, wins, affection, condition) except the boosted vitals and steps.
 */
export function restoreSyncNativeProfile(result, original) {
  const next = structuredClone(result);
  const f = next.fields, o = original.fields;
  const back = (current, boosted, max, floor) => {
    if (!(boosted > 0)) return Math.min(max, current);
    return Math.max(floor, Math.min(max, Math.round(current * max / boosted)));
  };
  f["050"] = back(f["050"], f["058"], o["058"], f["050"] > 0 ? 1 : 0);
  f["054"] = back(f["054"], f["05c"], o["05c"], 0);
  f["058"] = o["058"]; f["05c"] = o["05c"];
  for (const key of ["084", "088", "08c", "090"]) f[key] = o[key];
  return next;
}
