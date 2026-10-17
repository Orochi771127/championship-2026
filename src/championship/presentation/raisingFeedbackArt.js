import {loadPublicRenderDescriptor,validatePublicRenderDescriptor} from './publicRenderDescriptors.js';
import {isLocalBattleEffectPreview} from './battleEffectArt.js';

export const RAISING_FEEDBACK_ART_ID='art:vfx:raising-feedback:local-reference:v1';
export const RAISING_FEEDBACK_ART_MANIFEST='assets/production/internal-faithful-baseline/raising-feedback-v1/manifest.json';

export function validateRaisingFeedbackArt(manifest){return structuredClone(validatePublicRenderDescriptor(manifest,'raising-feedback'));}

export async function loadRegisteredRaisingFeedbackArt({PIXI,baseUrl,fetchImpl=globalThis.fetch}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const manifest=validateRaisingFeedbackArt(await loadPublicRenderDescriptor('raising-feedback',{baseUrl,fetchImpl})),cells=new Map(),loaded=[];
  // Reaction, treatment and recovery-star (sequence 32) cells only. Other common cells are retained in the
  // private manifest without loading unrelated training lettering into Home.
  const selected=manifest.cells.filter(c=>c.cell<=36||c.cell>=144&&c.cell<=154);
  // Forty-eight independent cells. Awaiting them one at a time made Home wait
  // for forty-seven round trips in a row, which measured as roughly five
  // seconds of the wait before the cage appeared. Nothing here depends on
  // anything else here, so they load together. Settling rather than racing
  // matters: a rejection must not leave a late success holding a texture that
  // nothing will ever unload.
  const results=await Promise.allSettled(selected.map(async c=>({c,texture:await PIXI.Assets.load(c.src)})));
  for(const r of results)if(r.status==='fulfilled')loaded.push(r.value.c.src);
  try{
    const failed=results.find(r=>r.status==='rejected');
    if(failed)throw failed.reason;
    for(const {c,texture} of results.map(r=>r.value)){
      if(texture.width!==c.width||texture.height!==c.height)throw new Error('RAISING_FEEDBACK_DIMENSIONS');
      texture.source.scaleMode='nearest';cells.set(c.cell,{...c,texture});}
  }catch(error){await Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));throw error;}
  let disposal;
  return {getCell:cell=>cells.get(cell)??null,dispose(){return disposal??=Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));}};
}
