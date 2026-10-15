// Display-only descriptions of an already-revealed, exact evolution branch.
// This is not an eligibility checker. No individual, actor, resolver, RNG or
// save authority is accepted. Unknown branches return no condition payload.
import lifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {nativeEvolutionRequirements} from '../raising/nativeRaisingLifecycle.js';
import {projectDatabaseEvolutionRoutes} from './databaseEvolutionRoutes.js';

const attributeIds = [
  'VACCINE_ATTRIBUTE', 'DATA_ATTRIBUTE', 'VIRUS_ATTRIBUTE', 'DRAGON_ATTRIBUTE',
  'BEAST_ATTRIBUTE', 'AQUATIC_ATTRIBUTE', 'BIRD_ATTRIBUTE', 'INSECT_PLANT_ATTRIBUTE',
  'HOLY_ATTRIBUTE', 'DARK_ATTRIBUTE', 'MACHINE_ATTRIBUTE'
];
const statIds = [
  'MAX_HP', 'MAX_TP', 'ATTACK', 'DEFENSE', 'WISDOM', 'SPEED',
  'HEAT_RESISTANCE', 'COLD_RESISTANCE', 'LIGHT_RESISTANCE',
  'DARK_RESISTANCE', 'THUNDER_RESISTANCE'
];

// Names/translation, profile fields, species identity and current values are
// deliberately absent. Zero means disabled, not a minimum/maximum of zero.
export const DATABASE_EVOLUTION_CONDITION_DESCRIPTORS = deepFreeze([
  ...attributeIds.map((id, thresholdIndex) => ({
    id, thresholdIndex, unit:'VALUE', valueType:'SIGNED_INTEGER',
    ordinaryOperator:'GTE', lifetimeOperator:null
  })),
  ...statIds.map((id, index) => ({
    id, thresholdIndex:11+index, unit:'VALUE',
    valueType:'NATIVE_TARGET_CURVE_PERCENT_TRUNCATED',
    ordinaryOperator:'GTE', lifetimeOperator:null
  })),
  {id:'BATTLE_COUNT', thresholdIndex:22, unit:'BATTLES', valueType:'SIGNED_INTEGER', ordinaryOperator:'GTE', lifetimeOperator:null},
  {id:'EVOLUTION_WIN_PERCENT', thresholdIndex:23, unit:'PERCENT', valueType:'NATIVE_Q12_INTEGER_PERCENT', ordinaryOperator:'GTE', lifetimeOperator:null},
  {id:'REBIRTH_COUNT', thresholdIndex:24, unit:'TIMES', valueType:'UNSIGNED_NARROW_INTEGER', ordinaryOperator:'GTE', lifetimeOperator:'GTE'},
  {id:'CARE_MISTAKE_VALUE', thresholdIndex:25, unit:'VALUE', valueType:'UNSIGNED_NARROW_INTEGER', ordinaryOperator:'LTE', lifetimeOperator:'GTE'}
]);

const comparison = deepFreeze({state:'NOT_COMPARED', reason:'NO_INDIVIDUAL_CONTEXT'});
const caveatIds = deepFreeze([
  'THRESHOLDS_DO_NOT_GUARANTEE_EVOLUTION', 'ORDERED_BRANCH_SELECTION',
  'TRAINER_RANK_LIMIT', 'ROSTER_CAPACITY_LIMIT', 'CALLER_TIMING_LIMIT',
  'LIFETIME_ANCESTRY_CAN_CHANGE_TARGET'
]);

/**
 * Supply the same registration/history snapshot used for the existing route
 * projection. Only its exact revealed branch can expose condition values.
 * Absence of history is not reconstructed from target registration. A null
 * result must not produce hidden condition DOM, tooltips or accessibility text.
 * This function never computes current values or says a branch is attainable.
 */
export function projectDatabaseEvolutionConditions(sourceSpeciesIndex, branchIndex, options = {}) {
  if (!options || (!options.fullView && options.sourceRegistered !== true)
    || !Number.isInteger(sourceSpeciesIndex) || sourceSpeciesIndex < 8 || sourceSpeciesIndex > 223
    || !Number.isInteger(branchIndex) || branchIndex < 0 || branchIndex > 4
    || !Array.isArray(options.registeredSpecies) || !Array.isArray(options.evolutionBranches)) return null;
  const route = projectDatabaseEvolutionRoutes(sourceSpeciesIndex, options).find(r=>r.branchIndex===branchIndex&&(r.productRouteId??null)===(options.productRouteId??null));
  if (route?.revealed !== true) return null;
  const rule = lifecycle.rules[sourceSpeciesIndex - 8]?.[branchIndex];
  if (!rule || ![0,1].includes(rule.kind) || !Array.isArray(rule.thresholds)
    || rule.thresholds.length !== 26
    || !rule.thresholds.every(value => Number.isInteger(value) && value >= 0)) return null;
  const requirements = nativeEvolutionRequirements(rule);
  const lifetimeOnly = rule.kind === 1;
  const conditions = DATABASE_EVOLUTION_CONDITION_DESCRIPTORS.flatMap(descriptor => {
    const {id, thresholdIndex, unit, valueType} = descriptor;
    const raw = rule.thresholds[thresholdIndex];
    const operator = lifetimeOnly ? descriptor.lifetimeOperator : descriptor.ordinaryOperator;
    if (raw === 0 || operator === null) return [];
    const isStat = thresholdIndex >= 11 && thresholdIndex <= 21;
    const value = isStat ? requirements.stats[thresholdIndex - 11].minimum : raw;
    return [{id, thresholdIndex, operator, value, unit, valueType,
      ...(isStat ? {sourcePercent:raw} : {})}];
  });
  return deepFreeze({
    ruleKind:lifetimeOnly ? 'LIFETIME_ONLY' : 'ORDINARY',
    lifetimeOnly,
    evaluationOrder:branchIndex + 1,
    conditions,
    comparison,
    caveatIds
  });
}

