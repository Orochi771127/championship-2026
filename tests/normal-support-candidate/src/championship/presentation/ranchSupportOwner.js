// Resolve semantic XY ownership to the actual rendered placement and wrap clone.
// Native ground owner indices and sorted art-plan owner indices are NOT equal.
export function resolveRanchSupportOwner(admission,{placements,instances,unit,wrapWidthNative,displayNativeX}){
  if(admission?.kind!=='CURRENT_GROUND_XY_ADMISSION_V1'||!Number.isFinite(displayNativeX)||!(unit>0)||admission.wrapWidthNative!==wrapWidthNative||admission.terrain===1||!Number.isInteger(admission.navigationComponent)||admission.navigationComponent<0)return null;
  const {originNative,localNative,positionNative}=admission;
  if(![originNative,localNative,positionNative].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return null;
  const candidates=placements.filter(p=>p.fragmentOfSlot===undefined&&!p.foldCap&&p.instanceId===admission.instanceId&&p.moduleId===admission.moduleId&&p.slotIndex===admission.slotIndex&&p.cageDefinitionIndex===admission.definitionIndex&&p.x/unit===originNative[0]&&p.y/unit===originNative[1]);
  if(candidates.length!==1)return null;
  const p=candidates[0],unwrappedX=originNative[0]+localNative[0];
  const normalized=((unwrappedX%wrapWidthNative)+wrapWidthNative)%wrapWidthNative;
  if(Math.abs(normalized-positionNative[0])>1e-7||Math.abs(originNative[1]+localNative[1]-positionNative[1])>1e-7)return null;
  const wrapCount=Math.round((displayNativeX-unwrappedX)/wrapWidthNative),shift=wrapCount*wrapWidthNative;
  if(!Number.isSafeInteger(wrapCount)||Math.abs(displayNativeX-unwrappedX-shift)>1e-5)return null;
  const matches=instances.filter(i=>i.p===p&&i.shift===shift&&i.supportMesh);
  if(matches.length!==1)return null;
  return Object.freeze({ownerIndex:p.ownerIndex,fieldId:p.fieldId,shift,groundComponent:'NOMINAL_GROUND'});
}

// One immutable render-plan lifetime. A new Three scene builds a new index;
// disposal clears it, so old layouts cannot retain an eligible lookup.
export function createRanchSupportOwnerResolver({placements,instances,unit,wrapWidthNative}){
  const byInstance=new Map();
  for(const p of placements){
    if(p.fragmentOfSlot!==undefined||p.foldCap||typeof p.instanceId!=='string')continue;
    let bucket=byInstance.get(p.instanceId);if(!bucket){bucket={placements:[],instances:[]};byInstance.set(p.instanceId,bucket);}
    bucket.placements.push(p);
  }
  for(const instance of instances){const bucket=byInstance.get(instance.p.instanceId);if(bucket)bucket.instances.push(instance);}
  let disposed=false;
  return Object.freeze({resolve(admission,displayNativeX){
    if(disposed)return null;const bucket=byInstance.get(admission?.instanceId);if(!bucket)return null;
    return resolveRanchSupportOwner(admission,{...bucket,unit,wrapWidthNative,displayNativeX});
  },dispose(){disposed=true;byInstance.clear();}});
}
