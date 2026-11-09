// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution.
// A 成熟期 partner bursts in battle into a former 覺醒體 (tier 1) or 究極體 (tier 2) and returns afterwards.
// Which forms a 成熟期 may take, their unlock conditions and the battle rules live in
// product-burst-evolution.r1.json (scripts/build-product-burst-evolution.mjs). This module is pure: it reads
// tables, evaluates conditions on a native profile and keeps the per-partner unlock record.
import table from '../../data/championship/product-burst-evolution.r1.json' with {type:'json'};
import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import curveCatalog from '../../data/championship/catalogs/creature-stat-curve.r1.json' with {type:'json'};
import {deepFreeze} from './championshipContracts.js';
import {isKnownSpeciesIndex,productSpeciesRecord} from './productSpeciesData.js';

export const BURST_RULES = deepFreeze(table.rules);
// Awakening raising (OWNER_APPROVED_ADAPTATION 2026-11-02): a 成熟期 raises its forms on the ranch and learns
// each in a ceremony; items push a target; battle extras and bloodline perks ride on the burst.
export const AWAKENING_RULES = BURST_RULES.awakening;
export const BURST_BATTLE_RULES = BURST_RULES.battle;
export const BLOODLINE_BURST_PERKS = BURST_RULES.bloodlinePerks;
export const AWAKENING_TRAINING_RULES = BURST_RULES.training;
export const BURST_VERSION = 2;
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

// Owner 2026-11-08 (BURST_TRUE_FORM_20261108): a burst form fights with its own HP curve. The ratio of the two
// species' native HP curve values (stats +0x30) scales the partner's own maximum, capped so a burst stays one
// 20-second window rather than a second life bar. Unknown species keep their HP.
export const BURST_HP_RATIO_CAP = 3;
const curveHp = index => { const curve = isKnownSpeciesIndex(index) ? productSpeciesRecord(index)?.statCurveIndex : null; return Number.isInteger(curve) ? curveCatalog.rows[curve]?.[0] ?? null : null; };
/** Maximum-HP ratio of a burst form over the 成熟期 it bursts from, in [1, BURST_HP_RATIO_CAP]. */
export function burstHpRatio(baseSpeciesIndex, formSpeciesIndex) {
  const base = curveHp(baseSpeciesIndex), form = curveHp(formSpeciesIndex);
  return base > 0 && form > 0 ? Math.min(BURST_HP_RATIO_CAP, Math.max(1, form / base)) : 1;
}

// Native counters the evolution thresholds 0..10 read (OVL18 02112734, same order as nativeEvolutionRequirements).
const COUNTERS = ['104', '108', '100', '10c', '110', '114', '118', '124', '120', '128', '11c'];
/** Profile field of each point condition, in BURST_CONDITION_IDS order. */
export const BURST_CONDITION_FIELDS = Object.freeze([...COUNTERS]);
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
  return deepFreeze(conditionRows(profile, form?.thresholds));
}
function conditionRows(profile, t) {
  const f = profile?.fields, n = profile?.narrowFields;
  if (!f || !n || !Array.isArray(t) || t.length !== 26) return {met: false, rows: []};
  const rows = [];
  t.slice(0, 11).forEach((value, i) => { if (value) rows.push({id: BURST_CONDITION_IDS[i], operator: 'GTE', value, current: signed(f[COUNTERS[i]])}); });
  if (t[22]) rows.push({id: 'BATTLE_COUNT', operator: 'GTE', value: t[22], current: signed(f['024'])});
  if (t[23]) rows.push({id: 'EVOLUTION_WIN_PERCENT', operator: 'GTE', value: t[23], current: winPercent(f)});
  if (t[24]) rows.push({id: 'REBIRTH_COUNT', operator: 'GTE', value: t[24], current: n['03c']});
  if (t[25]) rows.push({id: 'CARE_MISTAKE_VALUE', operator: 'LTE', value: t[25], current: n['03d']});
  for (const row of rows) row.met = row.operator === 'GTE' ? row.current >= row.value : row.current <= row.value;
  return {met: rows.every(row => row.met), rows};
}

// ---- per-partner awakening record (saved under progression.burstEvolution) ----
// unlocks: forms each partner has learned; preferred: the one it bursts into when the player (or a migrated save)
// chose one, otherwise the highest learned tier. Version 2 (awakening raising, Owner 2026-11-02) adds, all
// optional: energy {id: {form: 0..100}} item energy (100 = filled by a UR metal), waived {id: [forms]} whose
// rebirth gate a UR metal lifted, stars {id: n} transcendence stars, target {id: form} the form items push,
// appearance {id: form} the learned form shown on the ranch, shown {id: {form, until}} the ceremony's
// ten-minute display (epoch ms) and memory [forms] the account has ever learned. Awakening overdrive
// (AWAKENING_OVERDRIVE_20261109, productAwakeningOverdrive.js) adds: overdrive {id: {on, heat, at, fatigueUntil?}}
// the overdrive training switch and core heat (written at `at`, epoch ms), seed {id: percent} an ancestral wild
// partner's head start on its tier-1 awakening, contract {contractId, stake} the sponsor contract armed for the next
// match and escrow {contractId, stake, attemptId, foeBoostPercent} the stake held by the match being fought.
const OPTIONAL_KEYS = ['preferred', 'energy', 'waived', 'stars', 'target', 'appearance', 'shown', 'memory', 'overdrive', 'seed', 'contract', 'escrow'];
const ACCOUNT_KEYS = ['memory', 'contract', 'escrow'];
const CONTRACT_IDS = ['HEART_GUARD', 'IRON_RUSH', 'RIFT_GAMBIT'];
const stakeOf = value => { if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) invalid(); return value; };
const invalid = () => { throw new TypeError('INVALID_BURST_EVOLUTION'); };
const objectOf = value => {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value;
};
const formKey = key => { const form = Number(key); if (!Number.isSafeInteger(form) || !isBurstForm(form)) invalid(); return form; };
export function createBurstEvolutionState() { return deepFreeze({version: BURST_VERSION, unlocks: {}, migrated: false}); }
export function normalizeBurstEvolution(value) {
  if (value == null) return createBurstEvolutionState();
  if (typeof value !== 'object' || ![1, BURST_VERSION].includes(value.version) || typeof value.unlocks !== 'object' || value.unlocks === null
    || Object.keys(value).some(key => !['version', 'unlocks', 'migrated', ...OPTIONAL_KEYS].includes(key))) invalid();
  const unlocks = {};
  for (const [instanceId, forms] of Object.entries(value.unlocks)) {
    if (typeof instanceId !== 'string' || !instanceId || !Array.isArray(forms) || forms.length > 16
      || forms.some(form => !Number.isSafeInteger(form) || !isBurstForm(form))) invalid();
    unlocks[instanceId] = [...new Set(forms)].sort((a, b) => a - b);
  }
  const learned = (instanceId, form) => unlocks[instanceId]?.includes(form) === true;
  const out = {version: BURST_VERSION, unlocks, migrated: value.migrated === true};
  const preferred = {}, energy = {}, waived = {}, stars = {}, target = {}, appearance = {}, shown = {};
  for (const [instanceId, form] of Object.entries(objectOf(value.preferred))) { if (!learned(instanceId, form)) invalid(); preferred[instanceId] = form; }
  for (const [instanceId, forms] of Object.entries(objectOf(value.energy))) {
    const mine = {};
    for (const [key, points] of Object.entries(objectOf(forms))) {
      if (!Number.isSafeInteger(points) || points < 0 || points > 100) invalid();
      if (points) mine[formKey(key)] = points;
    }
    if (Object.keys(mine).length) energy[instanceId] = mine;
  }
  for (const [instanceId, forms] of Object.entries(objectOf(value.waived))) {
    if (!Array.isArray(forms) || forms.length > 16) invalid();
    const list = [...new Set(forms.map(formKey))].sort((a, b) => a - b);
    if (list.length) waived[instanceId] = list;
  }
  for (const [instanceId, count] of Object.entries(objectOf(value.stars))) {
    if (!Number.isSafeInteger(count) || count < 0 || count > AWAKENING_RULES.transcendence.maxStars) invalid();
    if (count) stars[instanceId] = count;
  }
  for (const [instanceId, form] of Object.entries(objectOf(value.target))) target[instanceId] = formKey(form);
  for (const [instanceId, form] of Object.entries(objectOf(value.appearance))) { if (!learned(instanceId, form)) invalid(); appearance[instanceId] = form; }
  for (const [instanceId, entry] of Object.entries(objectOf(value.shown))) {
    const {form, until} = objectOf(entry);
    if (!learned(instanceId, form) || !Number.isFinite(until)) invalid();
    shown[instanceId] = {form, until};
  }
  if (value.memory !== undefined && !Array.isArray(value.memory)) invalid();
  const memory = [...new Set((value.memory ?? []).map(formKey))].sort((a, b) => a - b);
  const overdrive = {}, seed = {};
  for (const [instanceId, entry] of Object.entries(objectOf(value.overdrive))) {
    const {on, heat, at, fatigueUntil} = objectOf(entry);
    if (typeof on !== 'boolean' || !Number.isFinite(heat) || heat < 0 || heat > 100 || !Number.isFinite(at)
      || (fatigueUntil !== undefined && !Number.isFinite(fatigueUntil))) invalid();
    if (on || heat > 0 || fatigueUntil !== undefined) overdrive[instanceId] = {on, heat, at, ...(fatigueUntil !== undefined ? {fatigueUntil} : {})};
  }
  for (const [instanceId, percent] of Object.entries(objectOf(value.seed))) {
    if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) invalid();
    if (percent) seed[instanceId] = percent;
  }
  for (const [key, map] of Object.entries({preferred, energy, waived, stars, target, appearance, shown, overdrive, seed})) if (Object.keys(map).length) out[key] = map;
  if (memory.length) out.memory = memory;
  if (value.contract !== undefined) {
    const {contractId, stake} = objectOf(value.contract);
    if (!CONTRACT_IDS.includes(contractId)) invalid();
    out.contract = {contractId, stake: stakeOf(stake)};
  }
  if (value.escrow !== undefined) {
    const {contractId, stake, attemptId, foeBoostPercent} = objectOf(value.escrow);
    if (!CONTRACT_IDS.includes(contractId) || typeof attemptId !== 'string' || !attemptId || !Number.isSafeInteger(foeBoostPercent)) invalid();
    out.escrow = {contractId, stake: stakeOf(stake), attemptId, foeBoostPercent};
  }
  return deepFreeze(out);
}
const withMap = (state, key, instanceId, value) => {
  const {[instanceId]: dropped, ...rest} = state[key] ?? {};
  return {...state, [key]: value === undefined ? rest : {...rest, [instanceId]: value}};
};
export function burstUnlocksOf(state, instanceId) { return Object.freeze([...(state?.unlocks?.[instanceId] ?? [])]); }
/** A new state with the forms added (null when nothing changes). */
export function unlockBurstForms(state, instanceId, forms) {
  const current = normalizeBurstEvolution(state), have = new Set(current.unlocks[instanceId] ?? []);
  const added = forms.filter(form => isBurstForm(form) && !have.has(form));
  if (!added.length) return null;
  return normalizeBurstEvolution({...current, unlocks: {...current.unlocks, [instanceId]: [...have, ...added]}});
}
export function withBurstMigrated(state) { return normalizeBurstEvolution({...normalizeBurstEvolution(state), migrated: true}); }
/** Forget everything recorded for a partner that left the player (null when nothing is recorded). */
export function forgetBurstUnlocks(state, instanceId) {
  const current = normalizeBurstEvolution(state);
  const perPartner = OPTIONAL_KEYS.filter(key => !ACCOUNT_KEYS.includes(key));
  if (!current.unlocks[instanceId] && !perPartner.some(key => current[key]?.[instanceId] !== undefined)) return null;
  let next = {...current, unlocks: {...current.unlocks}};
  delete next.unlocks[instanceId];
  for (const key of perPartner) if (next[key]) next = withMap(next, key, instanceId, undefined);
  return normalizeBurstEvolution(next);
}
export function preferredBurstForm(state, instanceId) { return state?.preferred?.[instanceId] ?? null; }
/** Choose the unlocked form a partner bursts into (null when unchanged or not unlocked). */
export function preferBurstForm(state, instanceId, form) {
  const current = normalizeBurstEvolution(state);
  if (!current.unlocks[instanceId]?.includes(form) || current.preferred?.[instanceId] === form) return null;
  return normalizeBurstEvolution({...current, preferred: {...(current.preferred ?? {}), [instanceId]: form}});
}

// ---- awakening raising (OWNER_APPROVED_ADAPTATION 2026-11-02) ----
/** The table entry of a form (alternates are reached through their base form's entry). */
function entryOfForm(form) {
  for (const base of basesByForm.get(form) ?? []) {
    const entry = burstFormsFor(base).find(f => f.form === form || f.alternates?.includes(form));
    if (entry) return entry;
  }
  return null;
}
/** The forms learned together with this one: the form, and its alternates when it is a base form. */
export function awakeningFormsOf(form) {
  const entry = entryOfForm(form);
  return Object.freeze(entry && entry.form === form ? [form, ...(entry.alternates ?? [])] : [form]);
}
export function rememberedAwakenings(state) { return Object.freeze([...(state?.memory ?? [])]); }
export function awakeningEnergyOf(state, instanceId, form) { return state?.energy?.[instanceId]?.[form] ?? 0; }
export function awakeningWaived(state, instanceId, form) { return state?.waived?.[instanceId]?.includes(form) === true; }
export function transcendStarsOf(state, instanceId) { return state?.stars?.[instanceId] ?? 0; }
export function awakeningTargetOf(state, instanceId) { return state?.target?.[instanceId] ?? null; }
export function awakeningAppearanceOf(state, instanceId) { return state?.appearance?.[instanceId] ?? null; }
export function awakeningShownOf(state, instanceId) { return state?.shown?.[instanceId] ?? null; }
export function awakeningSeedOf(state, instanceId) { return state?.seed?.[instanceId] ?? 0; }
export function overdriveOf(state, instanceId) { return state?.overdrive?.[instanceId] ?? null; }
export function sponsorContractOf(state) { return state?.contract ?? null; }
export function sponsorEscrowOf(state) { return state?.escrow ?? null; }
/** The overdrive record of a partner replaced (null removes it). */
export function withOverdrive(state, instanceId, record) {
  return normalizeBurstEvolution(withMap(normalizeBurstEvolution(state), 'overdrive', instanceId, record === null ? undefined : record));
}
/** An ancestral wild partner's head start on its tier-1 awakening (percent, at most 100). */
export function withAwakeningSeed(state, instanceId, percent) {
  return normalizeBurstEvolution(withMap(normalizeBurstEvolution(state), 'seed', instanceId, percent > 0 ? Math.min(100, percent | 0) : undefined));
}
/** The sponsor contract armed for the next match (null disarms it). */
export function withSponsorContract(state, contract) {
  const {contract: dropped, ...rest} = normalizeBurstEvolution(state);
  return normalizeBurstEvolution(contract ? {...rest, contract} : rest);
}
/** The stake held by the match being fought (null releases it). */
export function withSponsorEscrow(state, escrow) {
  const {escrow: dropped, ...rest} = normalizeBurstEvolution(state);
  return normalizeBurstEvolution(escrow ? {...rest, escrow} : rest);
}

/** A form's thresholds for one partner: a form the account remembers halves its point and battle thresholds. */
function thresholdsFor(form, remembered) {
  if (!remembered) return form.thresholds;
  const t = [...form.thresholds], keep = AWAKENING_RULES.memoryThresholdPercent / 100;
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 22]) if (t[i]) t[i] = Math.max(1, Math.ceil(t[i] * keep));
  return t;
}

/**
 * One form's awakening for a partner. Progress rows (points, battles, win rate) give the raised share; gates
 * must hold on their own: its tier-1 form learned (tier 2), and the rebirth count, where transcendence stars
 * count as rebirths and a UR metal waives it. percent = raised share + item energy (shards and SSR metals at
 * most itemCap; a UR metal fills the form). Ready when it reaches 100 with every gate met.
 */
export function awakeningProgress(profile, form, {learned = [], energy = 0, remembered = false, stars = 0, waived = false} = {}) {
  const {rows} = conditionRows(profile, thresholdsFor(form, remembered));
  const progress = rows.filter(row => row.operator === 'GTE' && row.id !== 'REBIRTH_COUNT');
  const gates = rows.filter(row => !progress.includes(row));
  for (const row of gates) if (row.id === 'REBIRTH_COUNT') {
    row.rebirths = row.current; row.stars = stars; row.waived = waived; row.current += stars;
    row.met = waived || row.current >= row.value;
  }
  const raised = progress.length ? progress.reduce((sum, row) => sum + Math.min(1, Math.max(0, row.current) / row.value), 0) / progress.length : 1;
  const full = energy >= 100, item = full ? 100 : Math.min(AWAKENING_RULES.itemCap, Math.max(0, energy));
  const percent = full ? 100 : Math.min(100, Math.floor(raised * 100 + 1e-9) + item);
  const viaMet = form.tier !== 2 || !Number.isInteger(form.via) || learned.includes(form.via);
  const isLearned = learned.includes(form.form);
  return deepFreeze({form: form.form, tier: form.tier, via: form.via ?? null, alternates: [...(form.alternates ?? [])], remembered,
    rows: progress, gates, viaMet, raised, energy: item, full, percent, learned: isLearned,
    ready: !isLearned && percent >= 100 && viaMet && gates.every(row => row.met), glow: !isLearned && percent >= AWAKENING_RULES.glowPercent});
}
// A UR fill (100) stays a fill; otherwise the seed shares the item cap with shards and metals.
const energyWithSeed = (energy, seed) => energy >= 100 ? 100 : Math.min(AWAKENING_RULES.itemCap, energy + seed);
/** Every form of a partner's 成熟期 with its awakening, tier 1 first. */
export function partnerAwakenings(profile, state, instanceId) {
  // The account remembers every form it learned, those of saves written before the memory existed included.
  const learned = burstUnlocksOf(state, instanceId);
  const memory = new Set([...rememberedAwakenings(state), ...Object.values(state?.unlocks ?? {}).flat()]);
  // An ancestral wild partner's head start (seed) counts as energy on its tier-1 forms until one is learned.
  const seed = learned.some(form => burstFormTier(form) === 1) ? 0 : awakeningSeedOf(state, instanceId);
  return Object.freeze(burstFormsFor(profile?.fields?.['000']).map(form => awakeningProgress(profile, form, {learned,
    energy: energyWithSeed(awakeningEnergyOf(state, instanceId, form.form), form.tier === 1 ? seed : 0), remembered: memory.has(form.form),
    stars: transcendStarsOf(state, instanceId), waived: awakeningWaived(state, instanceId, form.form)})));
}
/**
 * The form items push for this partner: its chosen target while still to learn, otherwise the first form it
 * can work toward (tier 1 first, a tier-2 form once its tier-1 form is learned). Null when all are learned.
 */
export function awakeningFocus(awakenings, target = null) {
  const open = awakenings.filter(a => !a.learned);
  return open.find(a => a.form === target) ?? open.find(a => a.viaMet) ?? open[0] ?? null;
}
/**
 * Item energy for one partner's form. A shard or an SSR metal adds `amount`, up to itemCap; a UR metal fills the
 * form and waives its rebirth gate. Null when nothing changes (already at the cap or filled).
 */
/** What one gacha metal adds to an awakening of this tier: {amount, fill}; amount 0 means it is no awakening item. */
export function awakeningItemEnergy(metal, tier) {
  const shard = metal.id.endsWith('-shard'), fill = !shard && metal.rarity === AWAKENING_RULES.fillRarity;
  return {fill, amount: fill ? 100 : shard ? AWAKENING_RULES.shardEnergy[metal.rarity] ?? 0 : AWAKENING_RULES.metalEnergy[metal.rarity]?.[tier] ?? 0};
}
export function feedAwakeningEnergy(state, instanceId, form, {amount = 0, fill = false} = {}) {
  const current = normalizeBurstEvolution(state);
  if (!isBurstForm(form)) throw new TypeError('INVALID_BURST_FORM');
  const before = awakeningEnergyOf(current, instanceId, form);
  const after = fill ? 100 : before >= AWAKENING_RULES.itemCap ? before : Math.min(AWAKENING_RULES.itemCap, before + Math.max(0, amount | 0));
  if (after === before && (!fill || awakeningWaived(current, instanceId, form))) return null;
  let next = withMap(current, 'energy', instanceId, {...(current.energy?.[instanceId] ?? {}), [form]: after});
  if (fill) next = withMap(next, 'waived', instanceId, [...new Set([...(current.waived?.[instanceId] ?? []), form])]);
  return normalizeBurstEvolution(next);
}
/** One more transcendence star (it counts as a rebirth for awakening gates); null at the maximum. */
export function addTranscendStar(state, instanceId) {
  const current = normalizeBurstEvolution(state), stars = transcendStarsOf(current, instanceId);
  if (stars >= AWAKENING_RULES.transcendence.maxStars) return null;
  return normalizeBurstEvolution(withMap(current, 'stars', instanceId, stars + 1));
}
export function setAwakeningTarget(state, instanceId, form) {
  const current = normalizeBurstEvolution(state);
  if (form !== null && !isBurstForm(form)) throw new TypeError('INVALID_BURST_FORM');
  if (awakeningTargetOf(current, instanceId) === form) return null;
  return normalizeBurstEvolution(withMap(current, 'target', instanceId, form === null ? undefined : form));
}
/** The learned form shown on the ranch, or null for the 成熟期 itself. Null result when unchanged or not learned. */
export function setAwakeningAppearance(state, instanceId, form) {
  const current = normalizeBurstEvolution(state);
  if (form !== null && !current.unlocks[instanceId]?.includes(form)) return null;
  if (awakeningAppearanceOf(current, instanceId) === form) return null;
  return normalizeBurstEvolution(withMap(current, 'appearance', instanceId, form === null ? undefined : form));
}
/**
 * Learn a form in its ceremony: it and its alternates unlock, the account remembers them, their item energy and
 * waiver are spent, and the form is shown on the ranch until `shownUntil` (epoch ms).
 */
export function learnAwakening(state, instanceId, form, {shownUntil = null} = {}) {
  const current = normalizeBurstEvolution(state), forms = awakeningFormsOf(form);
  let next = {...current, unlocks: {...current.unlocks, [instanceId]: [...new Set([...(current.unlocks[instanceId] ?? []), ...forms])]},
    memory: [...new Set([...(current.memory ?? []), ...forms])]};
  const energy = {...(current.energy?.[instanceId] ?? {})};
  for (const f of forms) delete energy[f];
  next = withMap(next, 'energy', instanceId, Object.keys(energy).length ? energy : undefined);
  const waived = (current.waived?.[instanceId] ?? []).filter(f => !forms.includes(f));
  next = withMap(next, 'waived', instanceId, waived.length ? waived : undefined);
  if (forms.includes(awakeningTargetOf(current, instanceId))) next = withMap(next, 'target', instanceId, undefined);
  if (Number.isFinite(shownUntil)) next = withMap(next, 'shown', instanceId, {form, until: shownUntil});
  return normalizeBurstEvolution(next);
}
/** End the ceremony's display early (the player chose a look); null when none is running. */
export function clearAwakeningShown(state, instanceId) {
  const current = normalizeBurstEvolution(state);
  return awakeningShownOf(current, instanceId) ? normalizeBurstEvolution(withMap(current, 'shown', instanceId, undefined)) : null;
}
/** The species a 成熟期 shows on the ranch at `nowMs`: its ceremony form while that lasts, else its chosen appearance. */
export function awakeningDisplayFor(state, instanceId, baseSpeciesIndex, nowMs) {
  const forms = new Set(burstFormsFor(baseSpeciesIndex).flatMap(f => [f.form, ...(f.alternates ?? [])]));
  const shown = awakeningShownOf(state, instanceId);
  if (shown && Number.isFinite(nowMs) && nowMs < shown.until && forms.has(shown.form)) return shown.form;
  const chosen = awakeningAppearanceOf(state, instanceId);
  return chosen !== null && forms.has(chosen) ? chosen : null;
}

/**
 * The form a 成熟期 bursts into in one battle: its chosen form when the rank allows that tier, otherwise the
 * highest unlocked tier the rank allows (table order breaks ties). Returns {form, tier} or null.
 */
export function burstPlanFor(baseSpeciesIndex, unlocked = [], {maxTier = 2, preferred = null} = {}) {
  const have = new Set(unlocked), options = [];
  for (const entry of burstFormsFor(baseSpeciesIndex)) {
    if (entry.tier > maxTier) continue;
    for (const form of [entry.form, ...(entry.alternates ?? [])]) if (have.has(form)) options.push({form, tier: entry.tier});
  }
  if (!options.length) return null;
  const chosen = options.find(option => option.form === preferred);
  if (chosen) return Object.freeze({...chosen});
  const top = Math.max(...options.map(option => option.tier));
  return Object.freeze({...options.find(option => option.tier === top)});
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
 * A partner saved as a former 覺醒體/究極體 (an alternate battle form included) returns to its 成熟期 ancestor
 * (history slot 0x14C) or, without history, to the first 成熟期 that bursts into it; the form it was (and the
 * tier-1 form a tier-2 form comes through) is unlocked. Returns null for anything else.
 */
export function legacyBurstMigration(profile) {
  const species = profile?.fields?.['000'], g = generation(species);
  if (g !== 5 && g !== 6 && !isBurstForm(species)) return null;
  const ancestor = profile.fields['14c'];
  const bases = burstBasesFor(species);
  // The recorded 成熟期 when it bursts into this form; otherwise one that does (rebalancing moved some forms).
  const base = bases.includes(ancestor) ? ancestor : generation(ancestor) === 4 && burstFormsFor(ancestor).length && !bases.length ? ancestor : bases[0] ?? null;
  if (base === null) return null;
  const forms = burstFormsFor(base), match = forms.find(form => form.form === species || form.alternates?.includes(species));
  // The form it was (an alternate also opens its base form) and, for a tier-2 form, the tier-1 form it comes through.
  const unlock = match ? [match.form, ...(match.form !== species ? [species] : []), ...(match.tier === 2 && match.via ? [match.via] : [])] : [forms[0].form];
  return deepFreeze({base, unlock: [...new Set(unlock)], preferred: match ? species : null});
}
