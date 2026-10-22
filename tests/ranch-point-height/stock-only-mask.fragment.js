  // TEST ONLY. Exact source pin and grouped-mask dependency enforced by injector.
  function captureStockOnlyMask({key='audit',reference=false,target='offscreen',debugGPU=false}={}){
    const item=sprites.get(key);
    if(!item?.mesh||!item.upperMesh||item.partition?.kind!=='FULL_STOCK_BASELINE_PLUS_LOWER_RECOVERY')throw Error('EXACT_RECOVERY_LOGICAL_PAIR_REQUIRED');
    if(!item.mesh.visible||!item.upperMesh.visible)throw Error('BOTH_RECOVERY_PARTS_MUST_BE_VISIBLE');
    if(renderer.getRenderTarget()!==null)throw Error('NORMAL_DEFAULT_TARGET_REQUIRED');
    if(!['default','offscreen'].includes(target))throw Error('STOCK_MASK_TARGET_REQUIRED');
    const before=captureActorMaskState(),visibility=item.mesh.visible;let stockOnly,restored;
    try{item.mesh.visible=false;stockOnly=captureActorMask({key,reference,target,debugGPU});}
    finally{item.mesh.visible=visibility;restored=captureNormalDrawingBuffer();}
    const after=captureActorMaskState();
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('STOCK_MASK_STATE_RESTORATION_FAILED');
    return {stockOnly,restored,before,after,scope:'SAME_CONTEXT_STOCK_ONLY_GROUPED_MASK_AT_UNCHANGED_ACTUAL_CONTACT_HEIGHT'};
  }
