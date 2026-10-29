// Which species are drawn with reviewed artwork, and their DOM-side frames.
// Kept free of Pixi so DOM presentations (title parade, Dex showcase) can ask
// without loading the texture loader; reviewedCharacterLoader re-exports the gate.
import selection from '../../data/championship/reviewed-animation-selection.v1.json' with {type:'json'};
import {isOriginalLoopbackLocation} from './originalRuntimeLocation.js';
import {reviewedNumericClip} from './reviewedCharacterAnimation.js';

const selected=new Map(selection.characters.map(c=>[c.speciesId,c]));
export function reviewedCharacterSelection(speciesId,href=globalThis.location?.href){
  const entry=selected.get(speciesId?.replace(/^championship:creature:/,''))??null;
  // Owner 2026-10-28: artwork that replaces the original is the only artwork its
  // species has, so it is used everywhere. Owner 2026-10-29 approved publishing the
  // selection, so every playable selected set is public; illustration-only identities
  // (no playable entity, pages not shipped) stay loopback-only.
  return entry&&(isOriginalLoopbackLocation(href)||entry.playableIdentity!==false
    &&(entry.replacesOriginal===true||selection.publicReleasePermitted===true))?entry:null;
}
export const reviewedCharacterSelections=()=>selection.characters;

const sha256=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');

/**
 * General-mode frames of the given native main sequences, for DOM drawing.
 * Resolves null when the species has no reviewed artwork here. Each frame:
 * {url, rect:[x,y,w,h] on its page, place:[dx,dy] of that crop from the pivot in
 * source px, ticks, mirror}. density is source px per native px at the stage display
 * scale; facesRight marks sets drawn facing away from the native cells. A frame with
 * mirror:true (selection generalMirrorFrames) faces opposite to its set: draw the crop
 * flipped horizontally into its place, which is already mirrored about the pivot.
 */
export async function loadReviewedDomFrames(speciesId,{href=globalThis.location?.href,fetchImpl=(...a)=>globalThis.fetch(...a),signal,sequences}){
  const entry=href?reviewedCharacterSelection(speciesId,href):null;
  if(!entry)return null;
  const url=new URL(entry.path,href);
  const response=await fetchImpl(url.href,{signal});
  if(!response.ok)throw Error('REVIEWED_DOM_HTTP_'+response.status);
  const text=await response.text();
  if(await sha256(text)!==entry.sha256)throw Error('REVIEWED_DOM_HASH');
  let document=JSON.parse(text);
  if(Array.isArray(document.frames))document={...document,frames:Object.fromEntries(document.frames.map(({id,...f})=>[id,f]))};
  const out=new Map(),mirrorFrames=new Set(entry.generalMirrorFrames??[]);let density=null;
  for(const id of sequences){
    const clip=reviewedNumericClip(document,'main',id)?.clip;if(!clip?.frames?.length)continue;
    out.set(id,clip.frames.map(step=>{
      const f=document.frames[step.assetId],t=f.trim??[0,0,...f.sourceSize],o=step.offset??[0,0],mirror=mirrorFrames.has(step.assetId);
      density??=f.density;
      return Object.freeze({url:new URL(f.image,url).href,rect:f.frame,
        place:[(mirror?f.origin[0]-t[0]-f.frame[2]:t[0]-f.origin[0])+o[0],t[1]-f.origin[1]+o[1]],
        ticks:Math.max(1,Math.round(step.durationMs*60/1000)),mirror});
    }));
  }
  if(!out.size)return null;
  return Object.freeze({speciesId:entry.speciesId,sequences:out,density:(density??4)/(entry.generalDisplayScale>0?entry.generalDisplayScale:1),
    facesRight:entry.generalMirror===true});
}
