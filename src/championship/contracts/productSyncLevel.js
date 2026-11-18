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

import { arenaMoveRecordIndex } from "./productArenaMoves.js";
import { deepFreeze } from "./championshipContracts.js";
import { normalizePartnerGrade, fusionExp, FUSION_MAX_FODDER } from "./productLineFusion.js";

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

// ---- Stars (ROADMAP_R3_20261118, Owner 2026-11-18) ----
//
// 「同一隻合成的時候有機會提升一顆星的等級，最高是五星」, built as the Owner left it to Claude: a METER, not a
// chance. Fusing a partner of the same species fills the base's star meter (a better grade fills more; a lower
// stage of its own line fills a little, so a form no hunt gate holds can still rise). A full meter is one more
// star, and every star lifts the Sync Level cap by ten: 1 star Lv.10 ... 5 stars Lv.50. Stars are played for and
// are never in the gachapon. EXP a partner cannot take at its cap becomes crystals, as it always did at Lv.50.
export const STAR_MAX = 5;
export const STAR_LEVEL_STEP = 10;
/** Points that fill the meter from this star to the next. */
export const STAR_POINTS_NEEDED = deepFreeze({ 1: 6, 2: 10, 3: 16, 4: 24 });
/** Points one fodder pays: its own species by grade, or a lower stage of the base's line. */
export const STAR_FODDER_POINTS = deepFreeze({ SAME_SPECIES: { S: 4, A: 3, B: 2, C: 2 }, SAME_SPECIES_DEFAULT: 2, LOWER_STAGE: 1 });
/** A fodder that had stars of its own hands over this share of the points it had gathered. */
export const STAR_CARRIED_SHARE = 0.5;
const starOfValue = (value) => (Number.isSafeInteger(value) ? Math.max(1, Math.min(STAR_MAX, value)) : 1);
/** The Sync Level a partner of `star` stars can reach. */
export function starLevelCap(star) {
  return Math.min(SYNC_LEVEL_MAX, STAR_LEVEL_STEP * starOfValue(star));
}
/** The fewest stars a partner of `lv` must have (a save from before stars is read this way, so no level is lost). */
export function starForLevel(lv) {
  return starOfValue(Math.ceil(level(lv) / STAR_LEVEL_STEP));
}
/** Points still needed at `star` (0 at five stars). */
export function starPointsNeeded(star) {
  return STAR_POINTS_NEEDED[starOfValue(star)] ?? 0;
}
/** Points one fodder pays the base: `line` is 1 for the base's own species, less for a lower stage of its line. */
export function starFodderPoints({ line = 0, grade = null } = {}) {
  if (!(line > 0)) return 0;
  if (line < 1) return STAR_FODDER_POINTS.LOWER_STAGE;
  const id = typeof grade === "string" ? grade : grade?.grade;
  return STAR_FODDER_POINTS.SAME_SPECIES[id] ?? STAR_FODDER_POINTS.SAME_SPECIES_DEFAULT;
}
/** Every point a partner has gathered: the meters it filled plus the one it is filling. */
export function starTotalPoints(star, points = 0) {
  let total = count(points);
  for (let s = 1; s < starOfValue(star); s++) total += STAR_POINTS_NEEDED[s];
  return total;
}

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
    const grade = normalizePartnerGrade(entry.grade);
    // UNIFIED_MOVES_20261118: the Data Arena move this partner learned for the auto battle (an arena move id)
    const arenaMove = typeof entry.arenaMove === "string" && arenaMoveRecordIndex(entry.arenaMove) !== null ? entry.arenaMove : null;
    // ROADMAP_R3: stars and the meter. A record from before stars gets the stars its level needs.
    const star = Math.max(starOfValue(entry.star), starForLevel(lv));
    const starPoints = star >= STAR_MAX ? 0 : Math.min(count(entry.starPoints), STAR_POINTS_NEEDED[star] - 1);
    partners[id] = { level: lv, exp: lv >= starLevelCap(star) ? 0 : exp, rebirths: count(entry.rebirths), ...(grade ? { grade } : {}), ...(arenaMove ? { arenaMove } : {}),
      ...(star > 1 ? { star } : {}), ...(starPoints > 0 ? { starPoints } : {}) };
  }
  return { version: 1, partners, crystals: count(value.crystals) };
}

export function syncOf(state, instanceId) {
  const entry = normalizeSyncLevels(state).partners[instanceId];
  const star = entry?.star ?? 1;
  return Object.freeze({ level: entry?.level ?? 1, exp: entry?.exp ?? 0, next: entry?.level >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(entry?.level ?? 1),
    // ROADMAP_R3: `capped` is true while more stars are needed before the next level.
    star, starPoints: entry?.starPoints ?? 0, starNeed: starPointsNeeded(star), cap: starLevelCap(star),
    capped: (entry?.level ?? 1) >= starLevelCap(star) && (entry?.level ?? 1) < SYNC_LEVEL_MAX });
}

/**
 * Pay `points` into a partner's star meter. A full meter is one more star and the rest carries on.
 * Returns the new state and `{before, after, gained}`; nothing changes at five stars or for no points.
 */
export function grantStarPoints(state, instanceId, points) {
  const current = normalizeSyncLevels(state);
  const before = current.partners[instanceId] ?? { level: 1, exp: 0, rebirths: 0 };
  let star = before.star ?? 1, held = before.starPoints ?? 0, left = count(Math.round(points));
  const from = { star, points: held, need: starPointsNeeded(star) };
  while (left > 0 && star < STAR_MAX) {
    const need = STAR_POINTS_NEEDED[star] - held;
    if (left < need) { held += left; left = 0; break; }
    left -= need; star += 1; held = 0;
  }
  if (star >= STAR_MAX) held = 0;
  const { star: _star, starPoints: _points, ...rest } = before;
  const after = { ...rest, ...(star > 1 ? { star } : {}), ...(held > 0 ? { starPoints: held } : {}) };
  return { state: { ...current, partners: { ...current.partners, [instanceId]: after } },
    gain: deepFreeze({ instanceId, points: count(Math.round(points)), before: from, after: { star, points: held, need: starPointsNeeded(star) }, gained: star - from.star }) };
}

/** A partner's saved grade (null for a partner caught before grades, hatched or from the gachapon). */
export function partnerGradeOf(state, instanceId) {
  return normalizeSyncLevels(state).partners[instanceId]?.grade ?? null;
}

/** Record a grade once; a partner that already has one keeps it. */
export function recordPartnerGrade(state, instanceId, grade) {
  const current = normalizeSyncLevels(state), normalized = normalizePartnerGrade(grade);
  if (!normalized || typeof instanceId !== "string" || !instanceId || current.partners[instanceId]?.grade) return current;
  const entry = current.partners[instanceId] ?? { level: 1, exp: 0, rebirths: 0 };
  return { ...current, partners: { ...current.partners, [instanceId]: { ...entry, grade: normalized } } };
}

/** The Data Arena move a partner learned for the auto battle (an arena move id), or null. */
export function learnedArenaMoveOf(state, instanceId) {
  return normalizeSyncLevels(state).partners[instanceId]?.arenaMove ?? null;
}

/** Learn `moveId` (an arena move id) for the auto battle, or forget it with null; one per partner. */
export function recordLearnedArenaMove(state, instanceId, moveId) {
  const current = normalizeSyncLevels(state);
  if (typeof instanceId !== "string" || !instanceId) return current;
  if (moveId !== null && arenaMoveRecordIndex(moveId) === null) return current;
  const { arenaMove: _old, ...entry } = current.partners[instanceId] ?? { level: 1, exp: 0, rebirths: 0 };
  return { ...current, partners: { ...current.partners, [instanceId]: { ...entry, ...(moveId ? { arenaMove: moveId } : {}) } } };
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

// ---- Evolution asks for a level (ROADMAP_R2_20261118, Owner 2026-11-18) ----
//
// 「進化的條件也再多一個就是幾等的時候可以進化」: a partner whose own conditions already choose a next form
// evolves only at this Sync Level, keyed by the stage it evolves FROM (the generation index: 2 = 幼年期 II,
// 3 = 成長期). Which form it becomes is still decided by the existing conditions (race and faction counters,
// stats, battles, care); the level never picks a branch. 幼年期 I has no gate, so an egg always gets going.
export const EVOLUTION_LEVEL_GATES = deepFreeze({ 2: 3, 3: 10 });
/** A partner waiting for its level at the end of its life is asked again after this many ranch minutes. */
export const EVOLUTION_LEVEL_RECHECK_MINUTES = 60;
/** The Sync Level a partner of `generation` needs to evolve (1 = no gate). */
export function evolutionLevelGate(generation) {
  return EVOLUTION_LEVEL_GATES[generation] ?? 1;
}
/** `{need, level}` when a partner of `generation` at Sync Level `lv` is too low to evolve, else null. */
export function evolutionLevelShort(generation, lv) {
  const need = evolutionLevelGate(generation), have = level(lv);
  return have >= need ? null : Object.freeze({ need, level: have });
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
  return { ...current, partners: { ...current.partners, [instanceId]: { ...entry, level: kept, exp: 0, rebirths: seen } } };
}

/**
 * Add EXP to one partner. Past Lv.50 the EXP becomes high-purity crystals,
 * one crystal point per EXP. Returns the new state and what changed.
 */
export function grantSyncExp(state, instanceId, amount) {
  const current = normalizeSyncLevels(state);
  const before = current.partners[instanceId] ?? { level: 1, exp: 0, rebirths: 0 };
  // ROADMAP_R3: a partner levels up to its stars' cap; what it cannot take becomes crystals.
  const cap = starLevelCap(before.star ?? 1);
  let lv = before.level, exp = before.exp, left = count(Math.round(amount)), overflow = 0;
  while (left > 0) {
    if (lv >= cap) { overflow += left; left = 0; exp = 0; break; }
    const need = syncExpRequired(lv) - exp;
    if (left < need) { exp += left; left = 0; break; }
    left -= need; lv += 1; exp = 0;
  }
  const after = { ...before, level: lv, exp, rebirths: before.rebirths };
  const next = { ...current, partners: { ...current.partners, [instanceId]: after }, crystals: count(current.crystals + overflow) };
  return {
    state: next,
    gain: deepFreeze({
      instanceId, amount: count(Math.round(amount)), overflow,
      before: { level: before.level, exp: before.exp, next: before.level >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(before.level) },
      after: { level: lv, exp, next: lv >= SYNC_LEVEL_MAX ? 0 : syncExpRequired(lv) },
      cap, capped: lv >= cap && lv < SYNC_LEVEL_MAX,
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

/** All the Sync EXP a partner has gathered: every level it has cleared plus its current EXP. */
export function syncTotalExp(state, instanceId) {
  const entry = normalizeSyncLevels(state).partners[instanceId];
  if (!entry) return 0;
  let total = entry.exp;
  for (let lv = 1; lv < entry.level; lv++) total += syncExpRequired(lv);
  return total;
}

/**
 * Same-line fusion (LINE_FUSION_20261117 P2): each fodder, in order, pays the base Sync EXP worked out
 * from the base's level at that moment; a fodder that was a saved partner loses its Sync record. A base
 * at Lv.50 is paid on its last level's requirement and the EXP becomes crystals, as any overflow does.
 * @param {Array<{instanceId?:string|null, grade?:object|string|null, line:number}>} fodders
 * @returns {{state:object, gains:object[], total:number, overflow:number}|null} null when nothing can be fused
 */
export function fuseSyncPartners(state, baseId, fodders, { bonusPercent = 0 } = {}) {
  let current = normalizeSyncLevels(state);
  if (typeof baseId !== "string" || !baseId || !Array.isArray(fodders) || fodders.length < 1 || fodders.length > FUSION_MAX_FODDER) return null;
  if (fodders.some((fodder) => !(fodder?.line > 0) || fodder.instanceId === baseId)) return null;
  const before = syncOf(current, baseId), gains = [];
  let total = 0, overflow = 0, starPoints = 0;
  // ROADMAP_R3: every fodder's star points first, so a star they give together already lifts the cap for all
  // their EXP and the order the fodder are picked in never wastes any.
  for (const fodder of fodders) {
    const own = fodder.instanceId ? current.partners[fodder.instanceId] : null;
    starPoints += starFodderPoints(fodder) + (fodder.line >= 1 && own ? Math.floor(starTotalPoints(own.star ?? 1, own.starPoints ?? 0) * STAR_CARRIED_SHARE) : 0);
  }
  if (starPoints > 0) current = grantStarPoints(current, baseId, starPoints).state;
  for (const fodder of fodders) {
    const carried = fodder.instanceId ? syncTotalExp(current, fodder.instanceId) : 0;
    const amount = fusionExp({ required: syncExpRequired(syncOf(current, baseId).level), grade: fodder.grade ?? null, line: fodder.line, carried, bonusPercent });
    const granted = grantSyncExp(current, baseId, amount);
    current = granted.state;
    if (fodder.instanceId && current.partners[fodder.instanceId]) {
      const partners = { ...current.partners }; delete partners[fodder.instanceId];
      current = { ...current, partners };
    }
    gains.push(granted.gain); total += amount; overflow += granted.gain.overflow;
  }
  const after = syncOf(current, baseId);
  return { state: current, gains, total, overflow, starPoints,
    summary: deepFreeze({ instanceId: baseId, amount: total, overflow, before, after,
      stars: { points: starPoints, gained: after.star - before.star,
        before: { star: before.star, points: before.starPoints, need: before.starNeed }, after: { star: after.star, points: after.starPoints, need: after.starNeed } },
      breakthroughs: gains.flatMap((gain) => gain.breakthroughs),
      vitalPercent: { before: syncVitalPercent(before.level), after: syncVitalPercent(after.level) } }) };
}
