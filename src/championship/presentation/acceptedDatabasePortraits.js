// Database never asks the research/baseline getPortrait fallback for pixels.
import selection from '../../data/championship/accepted-original-character-selection.r1.json' with {type:'json'};
import policy from '../../data/championship/public-playtest.r1.json' with {type:'json'};
import {originalHudSourceSpecies} from './completedOriginalCharacters.js';
import {databaseHeroPortrait} from './databaseHeroPortraits.js';
import {getProductExtension} from '../contracts/productSpeciesExtensions.js';
import {alternateFormAsset} from './alternateFormAssetContracts.js';

export function acceptedDatabasePortraitConfig(speciesIndex) {
  const sourceId = originalHudSourceSpecies(`species-${String(speciesIndex).padStart(3,'0')}`);
  return selection.characters.find(entry=>entry.speciesId === sourceId) ?? null;
}
export function validateAcceptedDatabasePortrait(manifest, config) {
  const approval = policy.acceptedOriginalRuntime;
  const prefix = `${selection.root}${config?.folder}/hud-r01/`;
  const portrait = manifest?.portrait;
  if (!config || approval?.status !== 'OWNER_AUTHORIZED_PUBLIC_PLAYTEST' || approval.selectionId !== selection.selectionId
    || selection.root !== 'assets/production/characters/accepted-20261010/'
    || manifest.entityId !== config.entityId || manifest.sourceBankSha256 !== config.sourceBankSha256
    || manifest.localPackagingProvenance?.publicationStatus !== 'OWNER_AUTHORIZED_HASH_SELECTED_PLAYTEST'
    || manifest.localPackagingProvenance?.ownerReplyId !== approval.ownerReplyId
    || manifest.localPackagingProvenance?.allImageRgbaExact !== true
    || portrait?.speciesId !== config.speciesId || portrait.entityId !== config.entityId
    || portrait.derivation !== 'ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA'
    || portrait.cell !== 0 || portrait.sequenceId !== 0 || portrait.nativeScale !== 2
    || portrait.src !== `${prefix}main-cell_000.webp` || portrait.src.includes('..')
    || !/^[a-f0-9]{64}$/.test(portrait.sha256)
    || portrait.rasterScale !== 4
    || ![portrait.rasterWidth,portrait.rasterHeight].every((value,axis)=>Number.isInteger(value) && value>0 && value<=config.rasterCanvas[axis])
    || portrait.rasterWidth !== portrait.width*4 || portrait.rasterHeight !== portrait.height*4) throw Error('DATABASE_ACCEPTED_PORTRAIT_REQUIRED');
  return Object.freeze({...portrait});
}
// Static encyclopedia previews never promote animation selection or borrow a donor image.
const ILLUSTRATION_PREVIEW_HASHES = Object.freeze({
  211: '20c03ae43a26d960c9a947a9ff8dc03fe8d5cbeed4ba528e39e2f36dd5865634',
  229: 'f1e1a23e891b9345f4b759e910c5f67efd8a844a2de53e14183a1a2fe3310424',
  230: '09ebff7fb323886eae495e557158cdd204a04dc2d18aa686ad0060ac250e2e39'
});
export function acceptedDatabaseIllustrationPreview(speciesIndex) {
  if (![211,229,230].includes(speciesIndex)) return null;
  if (speciesIndex !== 211) {
    const extension = getProductExtension(speciesIndex);
    if (!extension?.runtimeReady || !extension.evolutionReady
      || !alternateFormAsset(extension.entityId)) return null;
  }
  const art = databaseHeroPortrait(speciesIndex);
  if (art?.speciesIndex !== speciesIndex || art.speciesId !== `species-${speciesIndex}`
    || art.src !== `assets/production/database-handpainted-r1-20261015/species-${speciesIndex}.png`
    || art.sha256 !== ILLUSTRATION_PREVIEW_HASHES[speciesIndex]
    || ![art.width,art.height].every(value=>Number.isInteger(value)&&value>0)) return null;
  return Object.freeze({...art,derivation:'SELECTED_PUBLIC_DATABASE_ILLUSTRATION_PREVIEW'});
}
export async function loadAcceptedDatabasePortrait(speciesIndex, {
  baseUrl = globalThis.document?.baseURI, fetchImpl = globalThis.fetch, signal, revealed = true
} = {}) {
  if (!revealed) return null;
  const config = acceptedDatabasePortraitConfig(speciesIndex);
  if (!config) {
    const illustration = acceptedDatabaseIllustrationPreview(speciesIndex);
    if (!illustration) return null;
    signal?.throwIfAborted();
    return Object.freeze({...illustration,src:new URL(illustration.src,baseUrl).href});
  }
  const url = new URL(`${selection.root}${config.folder}/hud-r01/manifest.json`,baseUrl);
  const response = await fetchImpl(url,{signal});
  if (!response.ok) throw Error('DATABASE_PORTRAIT_UNAVAILABLE');
  const portrait = validateAcceptedDatabasePortrait(await response.json(),config);
  signal?.throwIfAborted();
  return Object.freeze({...portrait,src:new URL(portrait.src,baseUrl).href});
}

