// LOCAL FIRST-USE PROTOTYPE: readiness work, not a proven device-crash fix.
// Uses the real canvas/output shader path while it is hidden by the loading
// gate. No new context, resource clone, simulation tick or persistent loop.
export async function prepareBattleVfxGpu({renderer,scene,camera,groups,
  yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),record=()=>{},isActive=()=>true}) {
  if(!Array.isArray(groups)||groups.length<1||groups.length>82||new Set(groups).size!==groups.length)
    throw Error('BATTLE_VFX_WARMUP_GROUP_BOUND');
  const canvas=renderer.domElement,visibility=canvas.style.visibility;
  const context=renderer.getContext(),visible=new Map(),culled=new Map();
  let completed=0,failure=null,clearFailed=false;
  const write=(phase,error)=>{try{record('LOAD',{area:'battle',stage:'gpu-warmup',phase,gpuWarmupGroups:completed,...(error?{error}:{})});}catch{}};
  const check=()=>{
    if(!isActive())throw Error('BATTLE_VFX_WARMUP_CANCELLED');
    if(context.isContextLost())throw Error('BATTLE_VFX_WARMUP_CONTEXT_LOST');
  };
  write('start');
  try{
    check();canvas.style.visibility='hidden';
    for(const group of groups){group.traverse(object=>{
      // Hyper sidecars hide descendants at frame zero. Warm their current
      // skinned/program resources too, without changing animation or pose.
      if(!visible.has(object))visible.set(object,object.visible);
      object.visible=true;
      if('frustumCulled' in object){if(!culled.has(object))culled.set(object,object.frustumCulled);object.frustumCulled=false;}
    });group.visible=false;}
    for(const group of groups){
      await yieldTask();check();group.visible=true;
      try{renderer.render(scene,camera);check();completed++;}finally{group.visible=false;}
    }
  }catch(error){failure=error;}
  finally{
    for(const [object,value]of visible)object.visible=value;
    for(const [object,value]of culled)object.frustumCulled=value;
    try{renderer.clear();if(context.isContextLost())throw Error('BATTLE_VFX_WARMUP_CONTEXT_LOST');}catch(error){clearFailed=true;if(!failure)failure=error;}
    // A failed clear must not expose the last preparation frame; the caller's
    // failure cleanup removes this canvas. Otherwise restore its exact style.
    canvas.style.visibility=clearFailed?'hidden':visibility;
  }
  if(failure){write('error',failure);throw failure;}
  write('done');return Object.freeze({groups:completed,submissionOnly:true});
}
