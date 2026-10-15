import {productEvolutionOptions} from '../contracts/productSpeciesData.js';
// Read-only join of ordered candidates and the existing five-slot history.
// No resolver, eligibility, RNG, writer or save normalization runs here.
import lifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';

function validOffset(value) {
  if (!Number.isInteger(value) || value < 0) return false;
  return Boolean(lifecycle.rules[Math.floor(value / 5)]?.[value % 5]);
}
export function projectDatabaseEvolutionRoutes(sourceSpeciesIndex, {
  sourceRegistered = false, registeredSpecies = [], evolutionBranches = [], productEvolutionBranches = []
} = {}) {
  if (!sourceRegistered || !Number.isInteger(sourceSpeciesIndex) || sourceSpeciesIndex < 8) return deepFreeze([]);
  const candidates = lifecycle.rules[sourceSpeciesIndex - 8] ?? [];
  const valid = Array.isArray(evolutionBranches) ? evolutionBranches.filter(validOffset) : [];
  const uncertain = !Array.isArray(evolutionBranches) || valid.length !== evolutionBranches.length;
  const nativeRoutes=candidates.map((rule, branchIndex) => {
    const legacyBranchOffset = (sourceSpeciesIndex - 8) * 5 + branchIndex;
    const historyState = valid.includes(legacyBranchOffset) ? 'RECORDED' : uncertain ? 'UNKNOWN' : 'NOT_RECORDED';
    const targetRegistered = registeredSpecies.includes(rule.target);
    return {
      sourceSpeciesIndex, branchIndex, targetSpeciesIndex:rule.target,
      targetSpeciesId:`species-${String(rule.target).padStart(3,'0')}`,
      legacyBranchOffset, historyState, targetRegistered,
      // A contradictory old/invalid registration snapshot stays masked. The
      // completion flag remains its own fact and never registers the target.
      revealed:historyState === 'RECORDED' && targetRegistered
    };
  });
  const extras=nativeRoutes.flatMap(route=>productEvolutionOptions(route.targetSpeciesIndex).slice(1).map(target=>{
    const productRouteId=`${sourceSpeciesIndex}:${route.targetSpeciesIndex}:${target}`,recorded=productEvolutionBranches.includes(productRouteId),targetRegistered=registeredSpecies.includes(target);
    return {...route,targetSpeciesIndex:target,targetSpeciesId:`species-${target}`,legacyBranchOffset:null,productRouteId,historyState:recorded?'RECORDED':'NOT_RECORDED',targetRegistered,revealed:recorded&&targetRegistered};
  }));
  return deepFreeze([...nativeRoutes,...extras]);
}

