import manifest from '../../data/championship/database-hero-portraits.public.v1.json' with {type:'json'};
import silhouettes from '../../data/championship/database-hero-silhouettes.v1.json' with {type:'json'};
import faces from '../../data/championship/database-hero-faces.v1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {publicRuntimeAsset} from './publicRuntimeAssets.js';
import {getDatabaseIllustration} from '../database/databaseIllustrations.js';

// Dedicated encyclopedia illustrations, never animation/HUD replacements.
const mappedEntries = manifest.entries.map(entry => {
  const illustration = getDatabaseIllustration(entry.speciesIndex);
  return illustration ? {...entry, displayCode: illustration.displayCode} : entry;
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
// Drawn silhouette [x, y, w, h] of each published image (alpha > 32, measured by
// scripts/measure-dex-hero-silhouettes.py) and keyed by its bytes. The Dex detail fits this
// box rather than the canvas, whose aspect and transparent margin differ between batches.
const silhouetteBoxes = new Map(silhouettes.entries.map(row=>[row.sha256,Object.freeze([...row.box])]));
export function databaseHeroSilhouette(hero) {
  const box = hero ? silhouetteBoxes.get(hero.sha256) : null;
  return box && box[0]>=0 && box[1]>=0 && box[2]>0 && box[3]>0 && box[0]+box[2]<=hero.width && box[1]+box[3]<=hero.height ? box : null;
}
// Head of each published image [cx, cy, size] in image pixels (scripts/measure-dex-hero-faces.py:
// catchlight eyes, else the upper body, plus reviewed corrections), keyed by its bytes. The special
// cut-in frames this square so the whole head and face sit in the strip, never the belly or a claw.
const faceBoxes = new Map(faces.entries.map(row=>[row.sha256,Object.freeze([...row.face])]));
export function databaseHeroFace(hero) {
  const face = hero ? faceBoxes.get(hero.sha256) : null;
  return face && face[2]>0 && face[0]>=0 && face[1]>=0 && face[0]<=hero.width && face[1]<=hero.height ? face : null;
}
