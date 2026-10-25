import {getProductExtension} from '../contracts/productSpeciesExtensions.js';
import manifest from '../../data/championship/database-hero-portraits.public.v1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {publicRuntimeAsset} from './publicRuntimeAssets.js';
import {getDatabaseIllustration} from '../database/databaseIllustrations.js';

// Dedicated encyclopedia illustrations, never animation/HUD replacements.
const mappedEntries = manifest.entries.map(entry => {
  const illustration = getDatabaseIllustration(entry.speciesIndex);
  const extension=getProductExtension(entry.speciesIndex);
  return illustration ? {...entry, displayCode: illustration.displayCode} : extension?.generationIndex===3?{...entry,displayCode:`GR${extension.displaySerial}`}:entry;
});
export const DATABASE_HERO_PORTRAITS = deepFreeze({...manifest, entries: mappedEntries});
const entries = new Map(mappedEntries.map(entry=>{
  const asset=publicRuntimeAsset(`${entry.speciesId}:database-hero`);
  if(!asset||asset.src!==entry.src||asset.sha256!==entry.sha256||asset.width!==entry.width||asset.height!==entry.height)throw Error('DATABASE_HERO_NOT_PUBLICLY_SELECTED');
  if(entry.thumbnail){
    const small=publicRuntimeAsset(`${entry.speciesId}:database-thumbnail`),thumbnail=entry.thumbnail;
    if(!small||small.src!==thumbnail.src||small.sha256!==thumbnail.sha256||small.width!==thumbnail.width||small.height!==thumbnail.height
      ||Math.max(thumbnail.width,thumbnail.height)>128)throw Error('DATABASE_THUMBNAIL_NOT_PUBLICLY_SELECTED');
  }
  return [entry.speciesIndex,entry];
}));
export function databaseHeroPortrait(speciesIndex) {
  return Number.isSafeInteger(speciesIndex) ? entries.get(speciesIndex) ?? null : null;
}
