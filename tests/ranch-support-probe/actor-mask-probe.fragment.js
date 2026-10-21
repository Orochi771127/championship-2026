  // TEST-ONLY injected probe. Never ship this module as the production renderer.
  let actorMaskTarget=null;
  const actorMaskMaterials=new Map();
  function actorMaskMaterial(original,reference){
    let pair=actorMaskMaterials.get(original);
    if(!pair){pair={};actorMaskMaterials.set(original,pair);}
    const mode=reference?'reference':'visible';
    if(pair[mode])return pair[mode];
    if(original.transparent)throw Error('ACTOR_MASK_UNSUPPORTED_TRANSPARENT_MATERIAL');
    const material=original.clone();
    material.depthTest=!reference;material.depthWrite=!reference;material.colorWrite=true;
    material.onBeforeCompile=(shader,webglRenderer)=>{
      // Preserve the actual material hook, including the candidate floor-depth
      // code and its original uniform references. Do not reimplement alphaTest.
      original.onBeforeCompile.call(original,shader,webglRenderer);
      const marker='#include <opaque_fragment>';
      if(!shader.fragmentShader.includes(marker))throw Error('ACTOR_MASK_OPAQUE_SHADER_SEAM_MISSING');
      shader.fragmentShader=shader.fragmentShader.replace(marker,
        marker+'\n// Test ID output; original alphaTest/discard has already run.\ngl_FragColor=vec4(1.0);');
    };
    material.customProgramCacheKey=()=>original.customProgramCacheKey.call(original)+'|TEST_ACTOR_ID_MASK_V1';
    pair[mode]=material;return material;
  }
  function captureActorMaskState(){
    const objects=[],materials=new Map();
    scene.traverse(o=>{
      objects.push({id:o.id,name:o.name,type:o.type,geometryType:o.geometry?.type??null,positionCount:o.geometry?.attributes?.position?.count??null,indexCount:o.geometry?.index?.count??null,parent:o.parent?.id??null,visible:o.visible,renderOrder:o.renderOrder,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrix.toArray(),matrixWorld:o.matrixWorld.toArray(),materialIds:[].concat(o.material??[]).map(m=>m.id)});
      for(const m of [].concat(o.material??[]))if(!materials.has(m.id))materials.set(m.id,{id:m.id,version:m.version,visible:m.visible,colorWrite:m.colorWrite,depthWrite:m.depthWrite,depthTest:m.depthTest,depthFunc:m.depthFunc,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,side:m.side,blending:m.blending});
    });
    const t=renderer.getRenderTarget();
    return {sceneClock,frames,width,height,renderer:{target:t?{uuid:t.uuid,width:t.width,height:t.height}:null,viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),clearColor:renderer.getClearColor(new THREE.Color()).toArray(),clearAlpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,shadowAutoUpdate:renderer.shadowMap.autoUpdate,shadowNeedsUpdate:renderer.shadowMap.needsUpdate,outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping},camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray(),inverse:camera.matrixWorldInverse.toArray()},objects,materials:[...materials.values()]};
  }
  function actorMaskGpuReadout(material){
    const gl=renderer.getContext(),target=renderer.getRenderTarget();
    const framebuffer={viewport:Array.from(gl.getParameter(gl.VIEWPORT)),scissorBox:Array.from(gl.getParameter(gl.SCISSOR_BOX)),scissorTest:gl.isEnabled(gl.SCISSOR_TEST),depthBits:gl.getParameter(gl.DEPTH_BITS),stencilBits:gl.getParameter(gl.STENCIL_BITS),samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),
      target:target?{width:target.width,height:target.height,samples:target.samples,depthBuffer:target.depthBuffer,stencilBuffer:target.stencilBuffer,depthTexture:target.depthTexture?{type:target.depthTexture.type,format:target.depthTexture.format}:null}:null};
    if(target){
      const attachment=target.stencilBuffer?gl.DEPTH_STENCIL_ATTACHMENT:gl.DEPTH_ATTACHMENT;
      const kind=gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,attachment,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
      framebuffer.attachmentType=kind;
      if(kind===gl.RENDERBUFFER){
        const previous=gl.getParameter(gl.RENDERBUFFER_BINDING),buffer=gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,attachment,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
        try{gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);framebuffer.renderbuffer={internalFormat:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_INTERNAL_FORMAT),width:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_WIDTH),height:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_HEIGHT),samples:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_SAMPLES)};}
        finally{gl.bindRenderbuffer(gl.RENDERBUFFER,previous);}
      }
    }
    const props=renderer.properties.get(material),program=props.currentProgram?.program;
    const uniforms={},shaders=[];
    if(program){
      for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
        const info=gl.getActiveUniform(program,i);if(!info.name.startsWith('uRanch'))continue;
        const value=gl.getUniform(program,gl.getUniformLocation(program,info.name));uniforms[info.name]=ArrayBuffer.isView(value)?Array.from(value):value;
      }
      for(const shader of gl.getAttachedShaders(program)??[]){const source=gl.getShaderSource(shader);shaders.push({type:gl.getShaderParameter(shader,gl.SHADER_TYPE),source,hasFloorProxy:source.includes('vRanchWorldPosition')&&source.includes('uRanchFloor'),hasFragDepth:source.includes('gl_FragDepth')});}
    }
    return {framebuffer,programAvailable:Boolean(program),material:{id:material.id,depthTest:material.depthTest,depthWrite:material.depthWrite,depthFunc:material.depthFunc,alphaTest:material.alphaTest},uniforms,shaders,limit:'GL uniforms reflect most recent use of shared program; original readout is prior normal render, mask readout immediately after mask render.'};
  }
  function captureActorMask({key,reference=false,control=null,debugGPU=false,target='offscreen',thinHeight=null}={}){
    if(!['offscreen','default'].includes(target))throw Error('ACTOR_MASK_UNKNOWN_TARGET');
    if(control==='thin-ground'&&![0,.014,.015,.0155,.016,.0165,.02].includes(thinHeight))throw Error('ACTOR_MASK_UNAPPROVED_THIN_HEIGHT');
    if(![null,'blocked','clear','thin-ground'].includes(control))throw Error('ACTOR_MASK_UNKNOWN_CONTROL');
    if(control&&!camera.isOrthographicCamera)throw Error('ACTOR_MASK_CONTROL_REQUIRES_ORTHOGRAPHIC');
    if(disposed||lost)throw Error('ACTOR_MASK_SCENE_NOT_READY');
    const item=sprites.get(key);
    if(!item?.mesh.visible)throw Error('ACTOR_MASK_VISIBLE_TARGET_REQUIRED:'+key);
    if([...sprites.values()].filter(value=>value.mesh.visible).length!==1)throw Error('ACTOR_MASK_REQUIRES_EXACTLY_ONE_VISIBLE_SPRITE');
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(!actorMaskTarget||actorMaskTarget.width!==size.x||actorMaskTarget.height!==size.y){
      actorMaskTarget?.dispose();
      actorMaskTarget=new THREE.WebGLRenderTarget(size.x,size.y,{depthBuffer:true,stencilBuffer:false,samples:0});
    }
    const mesh=item.mesh,oldMaterial=mesh.material,oldOrder=mesh.renderOrder;
    const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
    const oldAutoClear=renderer.autoClear,oldShadowUpdate=renderer.shadowMap.autoUpdate;
    const oldBackground=scene.background,oldRenderInfo={...renderer.info.render};
    const materialFlags=new Map();
    let controlMesh=null;
    const maskMaterial=actorMaskMaterial(oldMaterial,reference);
    const originalGpu=debugGPU?actorMaskGpuReadout(oldMaterial):null;
    try{
      // All real scene geometry participates in depth exactly as authored, but
      // cannot contribute RGB. Render the target last in the opaque list so
      // later depth-only surfaces cannot leave already-painted white pixels.
      mesh.material=maskMaterial;mesh.renderOrder=Number.MAX_SAFE_INTEGER;
      scene.traverseVisible(object=>{
        if(object.isGroup&&object.renderOrder!==0)throw Error('ACTOR_MASK_UNSUPPORTED_NONZERO_GROUP_RENDER_ORDER');
        if(object===mesh)return;
        for(const material of [].concat(object.material??[])){
          if(material.transparent&&material.depthWrite)throw Error('ACTOR_MASK_UNSUPPORTED_TRANSPARENT_DEPTH_WRITER');
          if(!materialFlags.has(material)){materialFlags.set(material,{colorWrite:material.colorWrite,depthWrite:material.depthWrite});material.colorWrite=false;if(control)material.depthWrite=false;}
        }
      });
      if(control==='blocked'){
        // Known occluder: a full-frustum plane immediately behind the near
        // plane, independent of scene columns or guessed terrain semantics.
        const distance=camera.near+(camera.far-camera.near)*1e-6;
        controlMesh=new THREE.Mesh(new THREE.PlaneGeometry((camera.right-camera.left)/camera.zoom*1.02,(camera.top-camera.bottom)/camera.zoom*1.02),
          new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,depthFunc:THREE.AlwaysDepth,side:THREE.DoubleSide}));
        controlMesh.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
        controlMesh.position.copy(camera.getWorldPosition(new THREE.Vector3())).addScaledVector(camera.getWorldDirection(new THREE.Vector3()),distance);
        controlMesh.position.add(new THREE.Vector3((camera.left+camera.right)/2,(camera.top+camera.bottom)/2,0).applyQuaternion(controlMesh.quaternion));
        controlMesh.renderOrder=Number.MAX_SAFE_INTEGER-1;controlMesh.frustumCulled=false;
        scene.add(controlMesh);
      }
      if(control==='thin-ground'){
        // Calibration only: one known horizontal plane, not a claim about
        // authored map triangles or foot-based support sampling.
        controlMesh=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),
          new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide}));
        controlMesh.rotation.x=-Math.PI/2;controlMesh.position.set(mesh.position.x,thinHeight,mesh.position.z);
        controlMesh.renderOrder=Number.MAX_SAFE_INTEGER-1;controlMesh.frustumCulled=false;scene.add(controlMesh);
      }
      scene.background=null;renderer.setClearColor(0x000000,1);
      renderer.autoClear=true;renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(target==='default'?null:actorMaskTarget);renderer.render(scene,camera);
      const maskGpu=debugGPU?actorMaskGpuReadout(maskMaterial):null;
      const bottomUp=new Uint8Array(size.x*size.y*4);
      if(target==='default'){const gl=renderer.getContext();gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,bottomUp);}
      else renderer.readRenderTargetPixels(actorMaskTarget,0,0,size.x,size.y,bottomUp);
      const rgba=new Uint8Array(bottomUp.length),stride=size.x*4;
      let whitePixels=0;
      for(let y=0;y<size.y;y++){
        const row=bottomUp.subarray((size.y-1-y)*stride,(size.y-y)*stride);rgba.set(row,y*stride);
        for(let x=0;x<size.x;x++)if(row[x*4]>=128)whitePixels++;
      }
      return {kind:'TEST_ONLY_SINGLE_SPRITE_OPAQUE_TERRAIN_DEPTH_MASK',otherSpriteInteractions:'NOT_TESTED',nonDepthWritingParticleColor:'NOT_TESTED',equalDepthTieOrder:'NOT_EQUIVALENT_TO_NORMAL_COMPOSITION',key,reference,control,target,thinHeight:control==='thin-ground'?thinHeight:null,normalFramebufferPixelsOverwritten:target==='default',width:size.x,height:size.y,
        cssWidth:width,cssHeight:height,whitePixels,rgba,gpuDebug:debugGPU?{original:originalGpu,mask:maskGpu}:null};
    }finally{
      mesh.material=oldMaterial;mesh.renderOrder=oldOrder;
      for(const [material,flags] of materialFlags){material.colorWrite=flags.colorWrite;material.depthWrite=flags.depthWrite;}
      if(controlMesh){scene.remove(controlMesh);controlMesh.geometry.dispose();controlMesh.material.dispose();}
      scene.background=oldBackground;renderer.setClearColor(oldColor,oldAlpha);
      renderer.autoClear=oldAutoClear;renderer.shadowMap.autoUpdate=oldShadowUpdate;
      renderer.setRenderTarget(oldTarget);Object.assign(renderer.info.render,oldRenderInfo);
      // Bound test-only material/program references across streamed atlas pages.
      while(actorMaskMaterials.size>8){
        const stale=[...actorMaskMaterials.keys()].find(original=>original!==oldMaterial);
        if(!stale)break;for(const material of Object.values(actorMaskMaterials.get(stale)))material.dispose();actorMaskMaterials.delete(stale);
      }
    }
  }
  function disposeActorMaskProbe(){
    actorMaskTarget?.dispose();actorMaskTarget=null;
    for(const pair of actorMaskMaterials.values())for(const material of Object.values(pair))material.dispose();
    actorMaskMaterials.clear();
  }
