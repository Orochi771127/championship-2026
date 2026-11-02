// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution.
// A 成熟期 partner bursts in battle into a former 覺醒體 (tier 1) or 究極體 (tier 2) and returns afterwards.
// Which forms a 成熟期 may take, their unlock conditions and the battle rules live in
// product-burst-evolution.r1.json (scripts/build-product-burst-evolution.mjs). This module is pure: it reads
// tables, evaluates conditions on a native profile and keeps the per-partner unlock record.
import table from '../../data/championship/product-burst-evolution.r1.json' with {type:'json'};
import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import {deepFreeze} from './championshipContracts.js';

export const BURST_RULES = deepFreeze(table.rules);
export const BURST_VERSION = 1;
const byBase = new Map(table.bases.map(entry => [entry.base, deepFreeze(entry.forms.map(form => ({...form})))]));
const basesByForm = new Map();
for (const entry of table.bases) for (const form of entry.forms) for (const index of [form.form, ...(form.alternates ?? [])]) {
  basesByForm.set(index, [...(basesByForm.get(index) ?? []), entry.base]);
}
const generation = index => nativeSpecies.records[index]?.generationIndex ?? null;

/** Forms the 成熟期 species can burst into, tier 1 first (each: form, tier, via, thresholds, alternates?). */
export function burstFormsFor(baseSpeciesIndex) { return byBase.get(baseSpeciesIndex) ?? Object.freeze([]); }
/** 成熟期 species that burst into this form (alternates included). */
export function burstBasesFor(formSpeciesIndex) { return Object.freeze([...(basesByForm.get(formSpeciesIndex) ?? [])]); }
export function isBurstForm(speciesIndex) { return basesByForm.has(speciesIndex); }
export function burstFormTier(speciesIndex) { const g = generation(speciesIndex); return g === 5 ? 1 : g === 6 ? 2 : (basesByForm.has(speciesIndex) ? 2 : null); }

/** The highest tier a tamer rank allows (0 = none). */
export function burstTierForRank(rank) {
  const r = Number.isSafeInteger(rank) ? rank : 0;
  return r >= BURST_RULES.minimumTamerRank[2] ? 2 : r >= BURST_RULES.minimumTamerRank[1] ? 1 : 0;
}
/** Stat multiplier while burst (and while weakened afterwards). */
export function burstMultiplier(tier) { return Number(BURST_RULES.tierMultiplier[tier] ?? 1); }

// Native counters the evolution thresholds 0..10 read (OVL18 02112734, same order as nativeEvolutionRequirements).
const COUNTERS = ['104', '108', '100', '10c', '110', '114', '118', '124', '120', '128', '11c'];
export const BURST_CONDITION_IDS = Object.freeze([
  'VACCINE_ATTRIBUTE', 'DATA_ATTRIBUTE', 'VIRUS_ATTRIBUTE', 'DRAGON_ATTRIBUTE', 'BEAST_ATTRIBUTE', 'AQUATIC_ATTRIBUTE',
  'BIRD_ATTRIBUTE', 'INSECT_PLANT_ATTRIBUTE', 'HOLY_ATTRIBUTE', 'DARK_ATTRIBUTE', 'MACHINE_ATTRIBUTE']);
const signed = n => n | 0;
function winPercent(f) {
  // Native Q12 division and rounding (nativeRaisingLifecycle.passes).
  if ((f['024'] << 12) <= 0) return 0;
  const q = Number((BigInt(f['028'] << 12) << 12n) / BigInt(f['024'] << 12));
  return Number((BigInt(q) * 409600n + 2048n) >> 12n) >> 12;
}

/**
 * Each active condition of one form with the partner's current value. `met` is true when every row is met.
 * Rows: {id, operator, value, current, met}.
 */
export function evaluateBurstConditions(profile, form) {
  const f = profile?.fields, n = profile?.narrowFields;
  if (!f || !n || !Array.isArray(form?.thresholds) || form.thresholds.length !== 26) return deepFreeze({met: false, rows: []});
  const t = form.thresholds, rows = [];
  t.slice(0, 11).forEach((value, i) => { if (value) rows.push({id: BURST_CONDITION_IDS[i], operator: 'GTE', value, current: signed(f[COUNTERS[i]])}); });
  if (t[22]) rows.push({id: 'BATTLE_COUNT', operator: 'GTE', value: t[22], current: signed(f['024'])});
  if (t[23]) rows.push({id: 'EVOLUTION_WIN_PERCENT', operator: 'GTE', value: t[23], current: winPercent(f)});
  if (t[24]) rows.push({id: 'REBIRTH_COUNT', operator: 'GTE', value: t[24], current: n['03c']});
  if (t[25]) rows.push({id: 'CARE_MISTAKE_VALUE', operator: 'LTE', value: t[25], current: n['03d']});
  for (const row of rows) row.met = row.operator === 'GTE' ? row.current >= row.value : row.current <= row.value;
  return deepFreeze({met: rows.every(row => row.met), rows});
}

// ---- per-partner unlock record (saved under progression.burstEvolution) ----
export function createBurstEvolutionState() { return deepFreeze({version: BURST_VERSION, unlocks: {}, migrated: false}); }
export function normalizeBurstEvolution(value) {
  if (value == null) return createBurstEvolutionState();
  if (typeof value !== 'object' || value.version !== BURST_VERSION || typeof value.unlocks !== 'object' || value.unlocks === null
    || Object.keys(value).some(key => !['version', 'unlocks', 'migrated'].includes(key))) throw new TypeError('INVALID_BURST_EVOLUTION');
  const unlocks = {};
  for (const [instanceId, forms] of Object.entries(value.unlocks)) {
    if (typeof instanceId !== 'string' || !instanceId || !Array.isArray(forms) || forms.length > 16
      || forms.some(form => !Number.isSafeInteger(form) || !isBurstForm(form))) throw new TypeError('INVALID_BURST_EVOLUTION');
    unlocks[instanceId] = [...new Set(forms)].sort((a, b) => a - b);
  }
  return deepFreeze({version: BURST_VERSION, unlocks, migrated: value.migrated === true});
}
export function burstUnlocksOf(state, instanceId) { return Object.freeze([...(state?.unlocks?.[instanceId] ?? [])]); }
/** A new state with the forms added (null when nothing changes). */
export function unlockBurstForms(state, instanceId, forms) {
  const current = normalizeBurstEvolution(state), have = new Set(current.unlocks[instanceId] ?? []);
  const added = forms.filter(form => isBurstForm(form) && !have.has(form));
  if (!added.length) return null;
  return normalizeBurstEvolution({...current, unlocks: {...current.unlocks, [instanceId]: [...have, ...added]}});
}
export function withBurstMigrated(state) { return normalizeBurstEvolution({...normalizeBurstEvolution(state), migrated: true}); }
/** Forget a partner's unlocks (its rebirth or departure). */
export function forgetBurstUnlocks(state, instanceId) {
  const current = normalizeBurstEvolution(state);
  if (!current.unlocks[instanceId]) return null;
  const {[instanceId]: removed, ...rest} = current.unlocks;
  return normalizeBurstEvolution({...current, unlocks: rest});
}

/**
 * Forms a 成熟期 partner has newly earned by its own conditions (tier 2 also needs its tier-1 via form).
 * Alternates come with their base form.
 */
export function earnedBurstForms(profile, unlocked = []) {
  const base = profile?.fields?.['000'], have = new Set(unlocked), earned = [];
  for (const form of burstFormsFor(base)) {
    if (have.has(form.form)) continue;
    if (form.tier === 2 && !have.has(form.via) && !earned.includes(form.via)) continue;
    if (evaluateBurstConditions(profile, form).met) earned.push(form.form, ...(form.alternates ?? []));
  }
  return Object.freeze(earned);
}

/**
 * Burst forms a metal of `rarity` may unlock for this base: SSR -> tier 1, UR -> tier 2 (its tier-1 via first).
 * Returns the forms not yet unlocked, in table order.
 */
export function metalUnlockableForms(baseSpeciesIndex, rarity, unlocked = []) {
  const have = new Set(unlocked), tier = rarity === BURST_RULES.unlockMetalRarity[2] ? 2 : rarity === BURST_RULES.unlockMetalRarity[1] ? 1 : 0;
  if (!tier) return Object.freeze([]);
  return Object.freeze(burstFormsFor(baseSpeciesIndex).filter(form => form.tier === tier && !have.has(form.form)
    && (tier === 1 || have.has(form.via))).map(form => form.form));
}

/**
 * A partner saved as a former 覺醒體/究極體 returns to its 成熟期 ancestor (history slot 0x14C) or, without
 * history, to the first 成熟期 that bursts into it; the form it was (and the tier-1 form a tier-2 form comes
 * through) is unlocked. Returns null for anything else.
 */
export function legacyBurstMigration(profile) {
  const species = profile?.fields?.['000'], g = generation(species);
  if (g !== 5 && g !== 6) return null;
  const ancestor = profile.fields['14c'];
  const bases = burstBasesFor(species);
  const base = generation(ancestor) === 4 && burstFormsFor(ancestor).length ? ancestor : bases[0] ?? null;
  if (base === null) return null;
  const forms = burstFormsFor(base), match = forms.find(form => form.form === species || form.alternates?.includes(species));
  const unlock = match ? [match.form, ...(match.alternates ?? []), ...(match.tier === 2 && match.via ? [match.via] : [])] : [forms[0].form];
  return deepFreeze({base, unlock: [...new Set(unlock)]});
}
