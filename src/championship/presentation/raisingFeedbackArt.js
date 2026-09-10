import {isLocalBattleEffectPreview} from './battleEffectArt.js';

export const RAISING_FEEDBACK_ART_ID='art:vfx:raising-feedback:local-reference:v1';
export const RAISING_FEEDBACK_ART_MANIFEST='assets/production/internal-faithful-baseline/raising-feedback-v1/manifest.json';

export function validateRaisingFeedbackArt(manifest,index){
  const entry=index?.entries?.find(e=>e.assetId===RAISING_FEEDBACK_ART_ID);
  if(manifest?.schemaVersion!==1||manifest.assetId!==RAISING_FEEDBACK_ART_ID||!entry
    ||[manifest,entry].some(e=>e.manifestPath!==RAISING_FEEDBACK_ART_MANIFEST||e.runtimeEligible!==true
      ||e.localOnly!==true||e.runtimeScope!=='LOOPBACK_RESEARCH_ONLY'||e.publicReleasePermitted!==false
      ||e.shippingReady!==false||e.rightsStatus!=='ROM_COPYRIGHTED_REFERENCE'))throw new Error('RAISING_FEEDBACK_ART_NOT_REGISTERED');
  if(!Array.isArray(manifest.cells)||manifest.cells.length!==182)throw new Error('RAISING_FEEDBACK_CELLS_INVALID');
  const seen=new Set();
  for(const c of manifest.cells){
    if(!Number.isInteger(c.cell)||c.cell<0||seen.has(c.cell)||c.src!==RAISING_FEEDBACK_ART_MANIFEST.replace('manifest.json',`cell-${String(c.cell).padStart(3,'0')}.png`)
      ||![c.width,c.height].every(n=>Number.isInteger(n)&&n>0)||!Array.isArray(c.origin)||c.origin.length!==2
      ||!c.origin.every(Number.isInteger)||!/^[a-f0-9]{64}$/.test(c.sha256))throw new Error('RAISING_FEEDBACK_CELL_INVALID');
    seen.add(c.cell);
  }
  return structuredClone(manifest);
}

export async function loadRegisteredRaisingFeedbackArt({PIXI,baseUrl,fetchImpl=globalThis.fetch}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const indexResponse=await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json',baseUrl));
  if(!indexResponse.ok)throw new Error('RAISING_FEEDBACK_INDEX_UNAVAILABLE');
  const index=await indexResponse.json();
  if(!index.entries?.some(e=>e.assetId===RAISING_FEEDBACK_ART_ID&&e.runtimeEligible))return null;
  const response=await fetchImpl(new URL(RAISING_FEEDBACK_ART_MANIFEST,baseUrl));
  if(!response.ok)throw new Error('RAISING_FEEDBACK_MANIFEST_UNAVAILABLE');
  const manifest=validateRaisingFeedbackArt(await response.json(),index),cells=new Map(),loaded=[];
  // Reaction and treatment banks only. Other common cells are retained in the
  // private manifest without loading unrelated training lettering into Home.
  const selected=manifest.cells.filter(c=>c.cell<=36||c.cell>=144&&c.cell<=153);
  try{
    for(const c of selected){const texture=await PIXI.Assets.load(c.src);loaded.push(c.src);
      if(texture.width!==c.width||texture.height!==c.height)throw new Error('RAISING_FEEDBACK_DIMENSIONS');
      texture.source.scaleMode='nearest';cells.set(c.cell,{...c,texture});}
  }catch(error){await Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));throw error;}
  let disposal;
  return {getCell:cell=>cells.get(cell)??null,dispose(){return disposal??=Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));}};
}
