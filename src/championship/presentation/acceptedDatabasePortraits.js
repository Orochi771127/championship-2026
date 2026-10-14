// Database never asks the research/baseline getPortrait fallback for pixels.
import selection from '../../data/championship/accepted-original-character-selection.r1.json' with {type:'json'};
import policy from '../../data/championship/public-playtest.r1.json' with {type:'json'};
import {originalHudSourceSpecies} from './completedOriginalCharacters.js';

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
export async function loadAcceptedDatabasePortrait(speciesIndex, {
  baseUrl = globalThis.document?.baseURI, fetchImpl = globalThis.fetch, signal
} = {}) {
  const config = acceptedDatabasePortraitConfig(speciesIndex);
  if (!config) return null;
  const url = new URL(`${selection.root}${config.folder}/hud-r01/manifest.json`,baseUrl);
  const response = await fetchImpl(url,{signal});
  if (!response.ok) throw Error('DATABASE_PORTRAIT_UNAVAILABLE');
  const portrait = validateAcceptedDatabasePortrait(await response.json(),config);
  signal?.throwIfAborted();
  return Object.freeze({...portrait,src:new URL(portrait.src,baseUrl).href});
}
