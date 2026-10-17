import manifest from '../../data/championship/database-hero-portraits.public.v1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {publicRuntimeAsset} from './publicRuntimeAssets.js';

// Dedicated encyclopedia illustrations, never animation/HUD replacements.
export const DATABASE_HERO_PORTRAITS = deepFreeze(manifest);
const entries = new Map(manifest.entries.map(entry=>{
  const asset=publicRuntimeAsset(`${entry.speciesId}:database-hero`);
  if(!asset||asset.src!==entry.src||asset.sha256!==entry.sha256||asset.width!==entry.width||asset.height!==entry.height)throw Error('DATABASE_HERO_NOT_PUBLICLY_SELECTED');
  return [entry.speciesIndex,entry];
}));
export function databaseHeroPortrait(speciesIndex) {
  return Number.isSafeInteger(speciesIndex) ? entries.get(speciesIndex) ?? null : null;
}
