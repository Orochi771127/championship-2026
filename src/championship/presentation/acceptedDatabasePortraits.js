// Native role portrait fallback; dedicated hero art remains separate from motion.
import {publicHudCharacterConfig} from './publicCharacterCatalog.js';
import {databaseHeroPortrait} from './databaseHeroPortraits.js';
import {getProductExtension} from '../contracts/productSpeciesExtensions.js';

export function acceptedDatabasePortraitConfig(speciesIndex){
 const extension=getProductExtension(speciesIndex);
 if(extension&&(!extension.runtimeReady||!extension.evolutionReady))return null;
 return publicHudCharacterConfig(`species-${String(speciesIndex).padStart(3,'0')}`);
}
export function validateAcceptedDatabasePortrait(manifest,config){
 const portrait=manifest?.portrait;
 if(!config||manifest.schemaVersion!==1||manifest.entityId!==config.entityId||portrait?.entityId!==config.entityId
  ||portrait.speciesId!==config.speciesId||portrait.cell!==0||portrait.sequenceId!==0||portrait.nativeScale!==2
  ||!portrait.src?.startsWith('assets/production/characters/')||portrait.src.includes('..')
  ||!/^[a-f0-9]{64}$/.test(portrait.sha256)||portrait.rasterScale!==4
  ||portrait.rasterWidth!==portrait.width*4||portrait.rasterHeight!==portrait.height*4)throw Error('DATABASE_ACCEPTED_PORTRAIT_REQUIRED');
 return Object.freeze({...portrait});
}
// Static encyclopedia previews never promote animation selection or borrow a donor image.
const ILLUSTRATION_PREVIEW_HASHES = Object.freeze({
  211: 'e669c90a86a67c7053564e7977a2b99d72458c34c2628786b815e33c90b6a725',
  222: 'a05cfd23e6344551fc82de18d85a84a922966eff1cb6a1c124523004a13c6f33',
  229: '10e56e970dc275ec8e5691de3379f200bde41fe2d207efc14f53af5042aca55f',
  230: 'e729e08f354c47b537596bb0ff1782044ec45b327a23c074224a78dd1029fb8f'
});
export function acceptedDatabaseIllustrationPreview(speciesIndex) {
  if (![211,222,229,230].includes(speciesIndex)) return null;
  if (speciesIndex === 229 || speciesIndex === 230) {
    const extension = getProductExtension(speciesIndex);
    if (!extension?.runtimeReady || !extension.evolutionReady
      || !publicHudCharacterConfig(`species-${speciesIndex}`)) return null;
  }
  const art = databaseHeroPortrait(speciesIndex);
  if (art?.speciesIndex !== speciesIndex || art.speciesId !== `species-${speciesIndex}`
    || art.src !== `assets/production/database-display-20261018/species-${String(speciesIndex).padStart(3,'0')}.display.${ILLUSTRATION_PREVIEW_HASHES[speciesIndex].slice(0,16)}.webp`
    || art.sha256 !== ILLUSTRATION_PREVIEW_HASHES[speciesIndex]
    || ![art.width,art.height].every(value=>Number.isInteger(value)&&value>0)) return null;
  return Object.freeze({...art,derivation:'SELECTED_PUBLIC_DATABASE_ILLUSTRATION_PREVIEW'});
}
export async function loadAcceptedDatabasePortrait(speciesIndex,{
 baseUrl=globalThis.document?.baseURI,fetchImpl=globalThis.fetch,signal,revealed=true
}={}){
 if(!revealed)return null;
 signal?.throwIfAborted();
 const config=acceptedDatabasePortraitConfig(speciesIndex);
 if(!config){const illustration=acceptedDatabaseIllustrationPreview(speciesIndex);if(!illustration)return null;signal?.throwIfAborted();return Object.freeze({...illustration,src:new URL(illustration.src,baseUrl).href});}
 const response=await fetchImpl(new URL(config.hudPath,baseUrl),{signal});if(!response.ok)throw Error('DATABASE_PORTRAIT_UNAVAILABLE');
 const text=await response.text();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==config.hudSha256)throw Error('DATABASE_PORTRAIT_HASH');
 const portrait=validateAcceptedDatabasePortrait(JSON.parse(text),config);signal?.throwIfAborted();
 return Object.freeze({...portrait,src:new URL(portrait.src,baseUrl).href});
}
