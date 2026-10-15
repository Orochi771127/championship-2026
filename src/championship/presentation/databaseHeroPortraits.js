import manifest from '../../data/championship/database-hero-portraits.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';

// Dedicated encyclopedia illustrations, never animation/HUD replacements.
export const DATABASE_HERO_PORTRAITS = deepFreeze(manifest);
const entries = new Map(manifest.entries.map(entry=>[entry.speciesIndex,entry]));
export function databaseHeroPortrait(speciesIndex) {
  return Number.isSafeInteger(speciesIndex) ? entries.get(speciesIndex) ?? null : null;
}
