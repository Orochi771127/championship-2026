import {actorWorldBounds} from './actorBounds.mjs';

export function createFlatSupportResolver(manifest) {
  const support=manifest.flatSupport;
  if(!Number.isFinite(support?.height)||support.verifiedSourceId!==`terrain-props.glb SHA256 ${manifest.glb.sha256}`||!Array.isArray(support.exclusions))
    throw new Error('HM02_FLAT_SUPPORT_REGIONS_UNVERIFIED');
  for(const r of support.exclusions)if(![r.left,r.top,r.right,r.bottom].every(Number.isFinite)||r.left>r.right||r.top>r.bottom)
    throw new Error('HM02_INVALID_SUPPORT_EXCLUSION');
  return ({wild,node,view})=>{
    const box=actorWorldBounds(wild,node,32),visible=view.visibleMapRect??view.viewRect;
    if(visible&&(box.right<visible.left||box.left>visible.right||box.bottom<visible.top||box.top>visible.bottom))
      return {verifiedSourceId:'OFFSCREEN_NO_GROUND_PROOF_NEEDED',groundHeight:support.height,offscreen:true};
    // This deliberately remains a conservative sprite/roof projection test.
    // It is NOT a semantic support footprint or proof that roof-overlap is bad.
    // Do not remove/reduce it until actual geometry+navigation review exists.
    if(support.exclusions.some(r=>box.left<=r.right&&box.right>=r.left&&box.top<=r.bottom&&box.bottom>=r.top))return null;
    return {verifiedSourceId:support.verifiedSourceId,groundHeight:support.height};
  };
}
