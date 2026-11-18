// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): natural growth ends at 成熟期.
// 覺醒體 and 究極體 become burst forms a 成熟期 partner takes only in battle, so in the ranch:
//   * a fresh egg (no ancestry) hatches a 幼年期 I species, never a 幼年期 II one;
//   * 成熟期 neither evolves nor reaches the end of its life; rebirth is the player's choice;
//   * a few species that could only wait for their lifetime gain an ordinary branch (appended, so the
//     native branch positions that history records keep their meaning).
// The native functions and tables stay exactly as traced; this module is the product layer around them.
import {PRODUCT_FINAL_NATURAL_GENERATION,PRODUCT_GROWTH_RULES,PRODUCT_HATCH_POOL,productGeneration} from '../contracts/productGrowthRules.js';
import {normalizeNativeIndividualProfile} from './nativeIndividualProfile.js';
import {selectNativeHatchSpecies} from './nativeIndividualEvolution.js';
import {evaluateNativeEvolution,evaluateNativeRebirth} from './nativeRaisingLifecycle.js';
import {evolutionLevelShort,EVOLUTION_LEVEL_RECHECK_MINUTES} from '../contracts/productSyncLevel.js';

export {PRODUCT_FINAL_NATURAL_GENERATION,PRODUCT_GROWTH_RULES};
export const PRODUCT_NO_LIFE_LIMIT = 0xffffffff;
const ABSENT = 228;

export function isFinalNaturalStage(speciesIndex) {
  const generation = productGeneration(speciesIndex);
  return Number.isInteger(generation) && generation >= PRODUCT_FINAL_NATURAL_GENERATION;
}

/** Same draw as the native selector (one channel value), over the 幼年期 I pool when there is no ancestry. */
export function selectProductHatchSpecies(profile, rng, poolSlot) {
  const {fields: f} = normalizeNativeIndividualProfile(profile);
  if (f['140'] !== ABSENT) return selectNativeHatchSpecies(profile, rng, poolSlot);
  if (!Number.isInteger(poolSlot) || poolSlot < 0 || poolSlot > 15) throw new TypeError('INVALID_RAISING_POOL_SLOT');
  return Math.trunc(32766 * rng.next(0x26 + poolSlot) / 102) % PRODUCT_HATCH_POOL.count + PRODUCT_HATCH_POOL.first;
}

/** Life threshold for the actor (+0x428): 成熟期 and later never reach the end of their life. */
export function productLifeThreshold(profile, nativeThreshold) {
  return isFinalNaturalStage(normalizeNativeIndividualProfile(profile).fields['000']) ? PRODUCT_NO_LIFE_LIMIT : nativeThreshold;
}

/** Native evaluation over the product growth tables. */
// GACHA_FULL_EFFECTS_20261109: land expansion adds capacityBonusG to every rank's ranch capacity.
const bonusTables = new Map();
function growthTableWithBonus(bonus) {
  if (!Number.isSafeInteger(bonus) || bonus <= 0) return PRODUCT_GROWTH_RULES;
  if (!bonusTables.has(bonus)) bonusTables.set(bonus, Object.freeze({...PRODUCT_GROWTH_RULES,
    ranks: Object.freeze(PRODUCT_GROWTH_RULES.ranks.map(rank => Object.freeze({...rank, capacity: rank.capacity + bonus})))}));
  return bonusTables.get(bonus);
}
// ROADMAP_R2_20261118: with `syncLevel` given, a partner the native rules would evolve (code 1) waits while
// its level is under its stage's gate. The native result is thrown away whole, so nothing of the profile moves:
// in the day's check it reads as "not yet" (code 0); at the end of its life it reads as "life goes on" (code 2)
// and is asked again an hour later, so waiting for a level never costs the partner its life. Every other native
// result -- no route, a full cage, a licence too low, a rebirth -- passes through untouched. Without
// `syncLevel` (the tutorial, the friends playtest) the gate is off.
export function evaluateProductEvolution(profile, {capacityBonusG = 0, syncLevel = null, ...context}, rng) {
  const result = evaluateNativeEvolution(profile, {...context, table: growthTableWithBonus(capacityBonusG)}, rng);
  if (syncLevel === null || result.code !== 1) return result;
  const waiting = normalizeNativeIndividualProfile(profile);
  const short = evolutionLevelShort(productGeneration(waiting.fields['000']), syncLevel);
  if (!short) return result;
  const lifetime = context.lifetime === true;
  return {profile: waiting, code: lifetime ? 2 : 0, target: null, levelBlocked: short,
    actor: {...result.actor, '1e8': 0, '1f0': 0, '1f4': 0,
      '428': lifetime ? (waiting.fields['18c'] + EVOLUTION_LEVEL_RECHECK_MINUTES) >>> 0 : context.lifeThreshold ?? result.actor['428']}};
}

/**
 * The player's own rebirth of a 成熟期 partner: the native rebirth record (cycle +1, egg target) with force,
 * so the native evolution presentation carries it back to an egg.
 */
export function productRebirth(profile) {
  const p = normalizeNativeIndividualProfile(profile);
  if (!isFinalNaturalStage(p.fields['000'])) return {ok: false, reason: 'NOT_FINAL_STAGE'};
  const result = evaluateNativeRebirth(p, true);
  return {ok: true, profile: result.profile, target: result.target};
}
