import {loadLicensedCharacterRoster} from './licensedCharacterRoster.js';
import {loadPixiCharacterRuntimeBundle} from './pixiCharacterRuntimeBundle.js';

const ENTITY='m001_zurumon';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const M001_REVIEW_RUNTIME='assets/production/internal-character-review/m001-r05-anchored/runtime.review.json';
export function isM001CharacterArtReview(href){
  const url=new URL(href);
  return ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    && url.searchParams.get('characterArtReview')==='m001';
}

/** Explicit local review through the existing roster. Never replaces other species. */
export async function loadM001CharacterArtReview(options,href){
  if(!isM001CharacterArtReview(href))throw Error('M001_REVIEW_REQUIRES_LOOPBACK_OPT_IN');
  let reviewed=false;
  const roster=await loadLicensedCharacterRoster({...options,loadBundle:async args=>{
    if(new URL(args.runtimeUrl).pathname.split('/').at(-2)!==ENTITY)
      return loadPixiCharacterRuntimeBundle(args);
    const bundle=await loadPixiCharacterRuntimeBundle({...args,
      runtimeUrl:new URL(M001_REVIEW_RUNTIME,new URL('/championship.html',href)).href,
      cachePrefix:'m001-original-local-review:'});
    try{
      const runtime=bundle.runtime,profile=runtime.artProfile;
      if(runtime.entityId!==ENTITY||profile.reviewOnly!==true||profile.runtimeEligible!==false
        ||profile.publicReleasePermitted!==false||profile.scale!==1
        ||JSON.stringify(profile.logicalCanvas)!=='[64,64]'
        ||profile.anchor.x!==31/64||profile.anchor.y!==38/64)throw Error('M001_REVIEW_PROFILE_DRIFT');
      const response=await fetch(args.runtimeUrl);
      if(!response.ok)throw Error('M001_BASELINE_MOTION_UNAVAILABLE');
      const baseline=await response.json();
      for(const side of ['main','sub']){
        if(JSON.stringify(canonical(runtime.sides[side].animations))!==JSON.stringify(canonical(baseline.sides[side].animations)))
          throw Error('M001_REVIEW_MOTION_DRIFT');
        for(const animation of runtime.sides[side].animations)for(const frame of animation.frames){
          const g=runtime.reviewGeometry?.frames[frame.texture];
          if(!g||g.scale!==1||JSON.stringify(g.origin)!=='[31,38]'||JSON.stringify(g.sourceSize)!=='[64,64]')
            throw Error('M001_REVIEW_ORIGIN_DRIFT');
        }
      }
      reviewed=true;
      return {...bundle,createActor(actorOptions){return bundle.createActor({...actorOptions,
        nativeGeometry:actorOptions.nativeFramePresentation?runtime.reviewGeometry:null,
        battleGeometry:actorOptions.battleGeometry?runtime.reviewGeometry:null});}};
    }catch(error){await bundle.dispose();throw error;}
  }});
  return Object.freeze({...roster,
    createActor(options){
      const actor=roster.createActor(options);
      if(!reviewed||actor?.entityId!==ENTITY)return actor;
      return Object.freeze({...actor,nativeSizing:actor.nativeSizing?Object.freeze({...actor.nativeSizing,
        packedPixelsPerNativePixel:1,evidence:'ORIGINAL_M001_64PX_LOCAL_REVIEW'}):null});
    },
    getDiagnostics(){return {...roster.getDiagnostics(),originalArtReview:{entityId:ENTITY,
      loaded:reviewed,reviewOnly:true,humanApproved:false,runtimeEligible:false}};}
  });
}
