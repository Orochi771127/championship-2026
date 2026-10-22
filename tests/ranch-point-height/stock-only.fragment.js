  // TEST ONLY; injected exclusively into exact stock-plus-recovery 8a65 source.
  function captureStockOnlyNormal(key='audit'){
    const item=sprites.get(key);
    if(!item?.mesh||!item.upperMesh||item.partition?.kind!=='FULL_STOCK_BASELINE_PLUS_LOWER_RECOVERY')throw Error('EXACT_RECOVERY_LOGICAL_PAIR_REQUIRED');
    if(!item.mesh.visible||!item.upperMesh.visible)throw Error('BOTH_RECOVERY_PARTS_MUST_BE_VISIBLE');
    if(renderer.getRenderTarget()!==null)throw Error('NORMAL_DEFAULT_TARGET_REQUIRED');
    const lower=item.mesh,upper=item.upperMesh;
    const state=()=>({sceneClock,frames,lowerVisible:lower.visible,upperVisible:upper.visible,lowerMaterial:lower.material.id,upperMaterial:upper.material.id,lowerGeometry:lower.geometry.id,upperGeometry:upper.geometry.id,lowerWorld:lower.matrixWorld.toArray(),upperWorld:upper.matrixWorld.toArray(),cameraWorld:camera.matrixWorld.toArray(),cameraProjection:camera.projectionMatrix.toArray(),targetIsDefault:renderer.getRenderTarget()===null});
    const before=state(),visibility=lower.visible;let stockOnly,restored;
    try{lower.visible=false;stockOnly=captureNormalDrawingBuffer();}
    finally{lower.visible=visibility;restored=captureNormalDrawingBuffer();}
    const after=state();
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('STOCK_CONTROL_STATE_RESTORATION_FAILED');
    return {stockOnly,restored,before,after,scope:'SAME_CONTEXT_LOWER_RECOVERY_VISIBILITY_ONLY_NO_TIME_OR_SCENE_SYNC'};
  }
