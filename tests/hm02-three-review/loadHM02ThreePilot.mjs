import {actorWorldBounds} from './hm02ActorBounds.mjs';
// Actual entry from mountHuntField; default performs NO import/fetch/context work.
// Review bypass is loopback-only, explicit, and never changes qaApproved metadata.
export async function loadHM02ThreePilot({stage,fieldArt,fieldSource,signal,onFallback=()=>{}}){
  const url=new URL(globalThis.location.href);
  const reviewHarness=['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.searchParams.get('hm02ThreeReview')==='1';
  if(!reviewHarness)return null;
  const fieldId=fieldArt?.getDiagnostics?.().fieldId;
  if(!['field_hm02_01','field_hm02_02'].includes(fieldId))return null;
  const view=fieldSource.field.getView({viewportWidth:stage.app.screen.width,viewportHeight:stage.app.screen.height});
  if(view.worldWidthPx!==2880||view.worldHeightPx!==2880){onFallback(new Error('HM02_THREE_REQUIRES_REVIEW_180_GRID'));return null;}
  try{
    const [THREE,{GLTFLoader},{createHM02ThreePilot},{default:manifest}]=await Promise.all([
      import('three'),import('../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js'),import('./createHM02ThreePilot.mjs'),import('./manifest.candidate.json',{with:{type:'json'}})
    ]);
    signal?.throwIfAborted();
    const support=manifest.flatSupport;
    if(!Number.isFinite(support?.height)||support.verifiedSourceId!==`terrain-props.glb SHA256 ${manifest.glb.sha256}`||!Array.isArray(support.exclusions))throw new Error('HM02_FLAT_SUPPORT_REGIONS_UNVERIFIED');
    const pilot=await createHM02ThreePilot({THREE,GLTFLoader,stage,enabled:true,reviewHarness,fieldId,manifest,signal,
      resolveSupport({wild,node,view:currentView}){
        // Full source trim footprint, not anatomical feet; exact render bounds
        // only choose whether flat-ground proof applies, never move the origin.
        const box=actorWorldBounds(wild,node,32);
        const visible=currentView.visibleMapRect??currentView.viewRect;
        if(visible&&(box.right<visible.left||box.left>visible.right||box.bottom<visible.top||box.top>visible.bottom))return {verifiedSourceId:'OFFSCREEN_NO_GROUND_PROOF_NEEDED',groundHeight:support.height,offscreen:true};
        if(support.exclusions.some(r=>box.left<=r.right&&box.right>=r.left&&box.top<=r.bottom&&box.bottom>=r.top))return null;
        return {verifiedSourceId:support.verifiedSourceId,groundHeight:support.height};
      },onFallback});
    if(signal?.aborted){pilot?.dispose();return null;}
    return pilot;
  }catch(error){if(!signal?.aborted)onFallback(error);return null;}
}
