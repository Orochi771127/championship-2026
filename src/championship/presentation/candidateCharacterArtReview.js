import {loadLicensedCharacterRoster} from './licensedCharacterRoster.js';
import {loadPixiCharacterRuntimeBundle} from './pixiCharacterRuntimeBundle.js';

const CANDIDATES=Object.freeze({
  m003:Object.freeze({entityId:'m003_nyokimon',speciesId:'species-010',origin:[23,37],folder:'m003_nyokimon-hf-r03'}),
  m004:Object.freeze({entityId:'m004_bubbmon',speciesId:'species-011',origin:[24,37],folder:'m004_bubbmon-hf-r03'}),
  m005:Object.freeze({entityId:'m005_pitchmon',speciesId:'species-012',origin:[31,38],folder:'m005_pitchmon-hf-r06'}),
  m006:Object.freeze({entityId:'m006_punimon',speciesId:'species-013',origin:[24,38],folder:'m006_punimon-hf-r06'}),
  m007:Object.freeze({entityId:'m007_botamon',speciesId:'species-014',origin:[24,42],folder:'m007_botamon-hf-r06'}),
  m008:Object.freeze({entityId:'m008_poyomon',speciesId:'species-015',origin:[31,38],folder:'m008_poyomon-hf-r03'}),
  m009:Object.freeze({entityId:'m009_mokumon',speciesId:'species-016',origin:[28,38],folder:'m009_mokumon-hf-r06'}),
  m010:Object.freeze({entityId:'m010_yukimibotamon',speciesId:'species-017',origin:[24,42],folder:'m010_yukimibotamon-hf-r01'}),
  m011:Object.freeze({entityId:'m011_yuramon',speciesId:'species-018',origin:[23,42],folder:'m011_yuramon-hf-r02'}),
  m012:Object.freeze({entityId:'m012_petimon',speciesId:'species-019',origin:[32,45],folder:'m012_petimon-hf-r03'}),
  m101:Object.freeze({entityId:'m101_caprimon',speciesId:'species-020',origin:[24,44],folder:'m101_caprimon-hf-r06'}),
  m102:Object.freeze({entityId:'m102_koromon',speciesId:'species-021',origin:[23,38],folder:'m102_koromon-hf-r03'}),
  m103:Object.freeze({entityId:'m103_tanemon',speciesId:'species-022',origin:[22,38],folder:'m103_tanemon-hf-r03'}),
  m104:Object.freeze({entityId:'m104_tunomon',speciesId:'species-023',origin:[22,34],folder:'m104_tunomon-hf-r02'})
});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const loopback=hostname=>['localhost','127.0.0.1','[::1]'].includes(hostname);

export function candidateCharacterReviewConfig(href){
  const url=new URL(href),key=url.searchParams.get('characterArtReview');
  return loopback(url.hostname)?CANDIDATES[key]??null:null;
}

/** Replace one species only in an explicit loopback review. */
export async function loadCandidateCharacterArtReview(options,href){
  const config=candidateCharacterReviewConfig(href);
  if(!config)throw Error('CANDIDATE_REVIEW_REQUIRES_LOOPBACK_OPT_IN');
  let reviewed=false;
  const runtimeUrl=new URL(`assets/production/internal-character-review/${config.folder}/runtime.review.json`,href).href;
  const roster=await loadLicensedCharacterRoster({...options,loadBundle:async args=>{
    if(new URL(args.runtimeUrl).pathname.split('/').at(-2)!==config.entityId)
      return loadPixiCharacterRuntimeBundle(args);
    const bundle=await loadPixiCharacterRuntimeBundle({...args,runtimeUrl,
      cachePrefix:`${config.entityId}-original-local-review:`});
    try{
      const runtime=bundle.runtime,profile=runtime.artProfile,origin=config.origin;
      if(runtime.entityId!==config.entityId||profile.reviewOnly!==true||profile.runtimeEligible!==false
        ||profile.publicReleasePermitted!==false||profile.scale!==1
        ||JSON.stringify(profile.logicalCanvas)!=='[64,64]'
        ||profile.anchor.x!==origin[0]/64||profile.anchor.y!==origin[1]/64)
        throw Error('CANDIDATE_REVIEW_PROFILE_DRIFT');
      const response=await fetch(args.runtimeUrl);
      if(!response.ok)throw Error('CANDIDATE_BASELINE_MOTION_UNAVAILABLE');
      const baseline=await response.json();
      for(const side of ['main','sub']){
        if(JSON.stringify(canonical(runtime.sides[side].animations))!==JSON.stringify(canonical(baseline.sides[side].animations)))
          throw Error('CANDIDATE_REVIEW_MOTION_DRIFT');
        for(const animation of runtime.sides[side].animations)for(const frame of animation.frames){
          const geometry=runtime.reviewGeometry?.frames[frame.texture];
          if(!geometry||geometry.scale!==1||JSON.stringify(geometry.origin)!==JSON.stringify(origin)
            ||JSON.stringify(geometry.sourceSize)!=='[64,64]')throw Error('CANDIDATE_REVIEW_ORIGIN_DRIFT');
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
      if(!reviewed||actor?.entityId!==config.entityId)return actor;
      return Object.freeze({...actor,nativeSizing:actor.nativeSizing?Object.freeze({...actor.nativeSizing,
        packedPixelsPerNativePixel:1,evidence:'ORIGINAL_64PX_CANDIDATE_LOCAL_REVIEW'}):null});
    },
    getDiagnostics(){return {...roster.getDiagnostics(),originalArtReview:{entityId:config.entityId,
      speciesId:config.speciesId,loaded:reviewed,reviewOnly:true,humanApproved:false,runtimeEligible:false}};}
  });
}
