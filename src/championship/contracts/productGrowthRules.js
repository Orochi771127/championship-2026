// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): the growth tables the ranch evolves by.
// Native branches up to 成熟期 (generation 4); 成熟期 and later have none, because 覺醒體/究極體 are battle-only
// burst forms. Appended branches follow the native ones, so recorded branch history keeps its native positions.
// Pure data: the encyclopedia reads these too, without the raising engine.
import adaptations from '../../data/championship/product-growth-adaptations.r1.json' with {type:'json'};
import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import {deepFreeze} from './championshipContracts.js';
import {PRODUCT_RAISING_LIFECYCLE_RULES} from './productSpeciesData.js';
import {getProductOriginal} from './productOriginalSpecies.js';

export const PRODUCT_FINAL_NATURAL_GENERATION = adaptations.finalNaturalGeneration;
export const PRODUCT_HATCH_POOL = deepFreeze({...adaptations.hatchPool});
export const productGeneration = index => nativeSpecies.records[index]?.generationIndex ?? getProductOriginal(index)?.generationIndex ?? null;

function buildGrowthRules(native) {
  const rules = native.rules.map((list, i) => {
    const generation = productGeneration(i + 8);
    return generation !== null && generation >= PRODUCT_FINAL_NATURAL_GENERATION ? [] : list;
  });
  for (const branch of adaptations.appendedBranches) {
    const list = rules[branch.source - 8];
    if (!Array.isArray(list) || list.length >= 5 || list.some(r => r.target === branch.target && r.kind === branch.kind)
      || productGeneration(branch.target) !== productGeneration(branch.source) + 1 || branch.thresholds.length !== 26) {
      throw new Error('PRODUCT_GROWTH_BRANCH_INVALID');
    }
    rules[branch.source - 8] = [...list, {target: branch.target, kind: branch.kind, thresholds: [...branch.thresholds]}];
  }
  return {...native, rules};
}

export const PRODUCT_GROWTH_RULES = deepFreeze(buildGrowthRules(PRODUCT_RAISING_LIFECYCLE_RULES));
