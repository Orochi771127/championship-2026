// Partner grades and line fusion -- OWNER_APPROVED_ADAPTATION 2026-11-17
// (LINE_FUSION_TAMER_TALENTS_DESIGN_20261117, docs/planning/LINE_FUSION_AND_HUNT_HERDS_PLAN_2026-11-17_ZH_TW.md).
//
// NOT original behaviour. The native hunt roll gives each wild individual only a
// 4-10 % spread between its lower bound and lower bound + half a rung, so two
// catches of one species feel the same. A product grade S/A/B/C, rolled from
// product noise keyed by the individual's own native values (the native RNG is
// never read), gives a caught partner a head start inside its own bounds:
//
//   target = lower + unit * floor(q / 100 * 0.4 * (upper - lower) / unit)
//   value  = min(upper, max(native value, target))
//
// for HP 058, TP 05c, attack 060, defense 064, wisdom 068 and speed 06c, whose
// bounds the native writer 02092FC8 stores at 0xa8 + i*8 (upper) and 0xac + i*8
// (lower). The upper bound never moves: a high grade starts faster, the ceiling
// stays the same for every catch.
//
// Pure: numbers in, numbers out. The grade is saved beside the partner's Sync
// record (progression.syncLevels.partners[id].grade).

import { deepFreeze } from "./championshipContracts.js";

export const PARTNER_GRADES = deepFreeze([
  { id: "S", weight: 5, q: [85, 100] },
  { id: "A", weight: 20, q: [65, 84] },
  { id: "B", weight: 35, q: [35, 64] },
  { id: "C", weight: 40, q: [0, 34] }
]);
export const PARTNER_GRADE_IDS = Object.freeze(PARTNER_GRADES.map((entry) => entry.id));
/** Wild instincts whose catches are never below A. */
export const GRADE_FLOOR_A_INSTINCTS = Object.freeze(["ELITE", "ANCESTOR"]);
export const GRADE_HEAD_START_SHARE = 0.4;
/** HP, TP, attack, defense, wisdom, speed: [max word, bound index i, unit]. */
export const GRADE_STATS = deepFreeze([
  { key: "058", bound: 0, unit: 10, current: "050" },
  { key: "05c", bound: 1, unit: 1, current: "054" },
  { key: "060", bound: 2, unit: 1 },
  { key: "064", bound: 3, unit: 1 },
  { key: "068", bound: 4, unit: 1 },
  { key: "06c", bound: 5, unit: 1 }
]);
/** Product noise salts: 0x50 the grade, 0x51..0x56 the six q values. */
export const GRADE_SALT = 0x50;

const hex = (n) => n.toString(16).padStart(3, "0");
const unitNoise = (n) => (Number.isFinite(n) && n >= 0 && n < 1 ? n : 0);
const gradeRule = (id) => PARTNER_GRADES.find((entry) => entry.id === id) ?? null;

/** The grade `noise` in [0, 1) lands on (S first). */
export function gradeFromNoise(noise) {
  let at = unitNoise(noise) * 100;
  for (const entry of PARTNER_GRADES) { if (at < entry.weight) return entry.id; at -= entry.weight; }
  return PARTNER_GRADES[PARTNER_GRADES.length - 1].id;
}

/**
 * One wild partner's grade. `noise(salt)` returns product noise in [0, 1) for a
 * salt; the caller keys it by the individual's own native values.
 */
export function rollPartnerGrade(noise, { instinct = "NORMAL" } = {}) {
  if (typeof noise !== "function") throw new TypeError("GRADE_NOISE_REQUIRED");
  let grade = gradeFromNoise(noise(GRADE_SALT));
  if (GRADE_FLOOR_A_INSTINCTS.includes(instinct) && (grade === "B" || grade === "C")) grade = "A";
  const [lo, hi] = gradeRule(grade).q;
  const q = GRADE_STATS.map((_, i) => Math.min(hi, lo + Math.floor(unitNoise(noise(GRADE_SALT + 1 + i)) * (hi - lo + 1))));
  return deepFreeze({ grade, q });
}

/** Accept only the known shape; anything else is "no grade". */
export function normalizePartnerGrade(value) {
  if (!value || typeof value !== "object") return null;
  const rule = gradeRule(value.grade);
  if (!rule || !Array.isArray(value.q) || value.q.length !== GRADE_STATS.length) return null;
  const [lo, hi] = rule.q;
  if (!value.q.every((n) => Number.isSafeInteger(n) && n >= lo && n <= hi)) return null;
  return { grade: rule.id, q: [...value.q] };
}

/** The stat a grade's head start aims for (never below the native value, never above the upper bound). */
export function gradeHeadStartValue({ value, lower, upper, unit }, q) {
  if (![value, lower, upper, unit].every(Number.isSafeInteger) || unit < 1 || upper < lower) return value;
  const steps = Math.floor((q / 100) * GRADE_HEAD_START_SHARE * (upper - lower) / unit);
  return Math.min(upper, Math.max(value, lower + unit * steps));
}

/**
 * The individual with its grade's head start written into the six stats. HP and
 * TP fill their current value to the new maximum. The profile is not changed.
 */
export function applyGradeHeadStart(profile, grade) {
  const normalized = normalizePartnerGrade(grade);
  const next = structuredClone(profile);
  if (!normalized || !next?.fields) return { profile: next, gains: [] };
  const f = next.fields, gains = [];
  GRADE_STATS.forEach((stat, i) => {
    const upper = f[hex(0xa8 + stat.bound * 8)] | 0, lower = f[hex(0xac + stat.bound * 8)] | 0, value = f[stat.key] | 0;
    const after = gradeHeadStartValue({ value, lower, upper, unit: stat.unit }, normalized.q[i]);
    if (after > value) {
      f[stat.key] = after >>> 0;
      if (stat.current) f[stat.current] = after >>> 0;
      gains.push({ key: stat.key, before: value, after });
    }
  });
  return { profile: next, gains };
}

// ---- Same-line fusion (plan section 4, P2) ----
//
// A caught or raised partner of the base's own line is spent to feed the base's Sync EXP. Fusion only
// ever writes progression.syncLevels: the base's native individual, the save words and the battle codes
// are untouched, and a fused partner is not written into the native release history.
//
//   one fodder = round(EXP the base needs at its current level x 0.25 x grade x line)
//              + floor(Sync EXP the fodder had gathered x 0.5)

export const FUSION_BASE_SHARE = 0.25;
export const FUSION_CARRIED_EXP_SHARE = 0.5;
export const FUSION_MAX_FODDER = 5;
export const FUSION_LINE = deepFreeze({ SAME_SPECIES: 1, LOWER_STAGE: 0.6 });
export const FUSION_GRADE_MULTIPLIER = deepFreeze({ S: 1.6, A: 1.25, B: 1, C: 0.8 });
/** A fodder at or above this Sync Level asks for a second confirmation. */
export const FUSION_WARN_LEVEL = 10;

/** The fodder's grade multiplier; a partner with no grade counts as 1.0. */
export function fusionGradeMultiplier(grade) {
  return FUSION_GRADE_MULTIPLIER[typeof grade === "string" ? grade : grade?.grade] ?? 1;
}

/**
 * 1 for the base's own species, 0.6 for a lower stage of the base's own line (reached by walking the
 * base's ancestors backwards), 0 for anything else. Side branches are never followed: many lines share
 * their baby stages, and following them would let almost any two partners fuse.
 * @param {(speciesIndex:number)=>readonly number[]} ancestorsOf direct earlier forms of a species
 */
export function fusionLineMultiplier(baseSpecies, fodderSpecies, ancestorsOf) {
  if (!Number.isSafeInteger(baseSpecies) || !Number.isSafeInteger(fodderSpecies)) return 0;
  if (baseSpecies === fodderSpecies) return FUSION_LINE.SAME_SPECIES;
  const seen = new Set([baseSpecies]), queue = [baseSpecies];
  while (queue.length) {
    for (const earlier of ancestorsOf(queue.shift()) ?? []) {
      if (seen.has(earlier)) continue;
      if (earlier === fodderSpecies) return FUSION_LINE.LOWER_STAGE;
      seen.add(earlier); queue.push(earlier);
    }
  }
  return 0;
}

/** Sync EXP one fodder pays a base that needs `required` EXP at its current level. */
export function fusionExp({ required, grade = null, line = 1, carried = 0 } = {}) {
  if (!(required > 0) || !(line > 0)) return 0;
  const own = Number.isSafeInteger(carried) && carried > 0 ? Math.floor(carried * FUSION_CARRIED_EXP_SHARE) : 0;
  return Math.round(required * FUSION_BASE_SHARE * fusionGradeMultiplier(grade) * line) + own;
}
