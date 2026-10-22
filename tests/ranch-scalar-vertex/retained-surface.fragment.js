  // TEST ONLY: read current rendered terrain material/texture state, without changing it.
  function captureRetainedSurfaceState(fieldId){
    if(!['field_cm18_01','field_cm34_01'].includes(fieldId))throw Error('RETAINED_FIELD_NOT_APPROVED');
    const before=captureActorMaskState(),gl=renderer.getContext(),surfaces=[];
    if(renderer.getRenderTarget()!==null)throw Error('RETAINED_READ_REQUIRES_DEFAULT_TARGET');
    scene.traverse(o=>{
      if(!o.isMesh||o.name!==fieldId+'-runtime-static')return;
      const ancestry=[];let effectiveVisible=true;for(let p=o;p;p=p.parent){ancestry.push({name:p.name,type:p.type,childIndex:p.parent?p.parent.children.indexOf(p):null,visible:p.visible});effectiveVisible&&=p.visible;}
      const materials=[].concat(o.material).map(m=>{
        const t=m.map,image=t?.image,props=renderer.properties.get(m),program=props.currentProgram?.program,uniforms={};
        if(program)for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
          const info=gl.getActiveUniform(program,i);if(!['map','mapTransform','opacity','alphaTest','uWindTime'].includes(info.name))continue;
          const value=gl.getUniform(program,gl.getUniformLocation(program,info.name));uniforms[info.name]=ArrayBuffer.isView(value)?Array.from(value):value;
        }
        let decodedAlphaProbe=null;
        if(fieldId==='field_cm18_01'&&image){try{
          const x=304,y=492,w=16,h=48,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('RETAINED_ALPHA_CONTEXT_UNAVAILABLE');ctx.drawImage(image,-x,-y);const bytes=ctx.getImageData(0,0,w,h).data;decodedAlphaProbe={x,y,width:w,height:h,alpha:Array.from({length:w*h},(_,i)=>bytes[i*4+3]),sourceWidth:image.width,sourceHeight:image.height,scope:'Original decoded resource pixels, no resize or flip; known second-tread atlas neighborhood.'};
        }catch(error){decodedAlphaProbe={error:String(error)};}}
        return {id:m.id,type:m.type,name:m.name,visible:m.visible,opacity:m.opacity,transparent:m.transparent,alphaTest:m.alphaTest,depthTest:m.depthTest,depthWrite:m.depthWrite,depthFunc:m.depthFunc,side:m.side,alphaToCoverage:m.alphaToCoverage,alphaHash:m.alphaHash,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits,
          map:t?{uuid:t.uuid,channel:t.channel,flipY:t.flipY,magFilter:t.magFilter,minFilter:t.minFilter,wrapS:t.wrapS,wrapT:t.wrapT,anisotropy:t.anisotropy,generateMipmaps:t.generateMipmaps,colorSpace:t.colorSpace,matrixAutoUpdate:t.matrixAutoUpdate,matrix:t.matrix.toArray(),offset:t.offset.toArray(),repeat:t.repeat.toArray(),center:t.center.toArray(),rotation:t.rotation,width:image?.width??null,height:image?.height??null}:null,
          uniforms,gpu:actorMaskGpuReadout(m),decodedAlphaProbe,uniformLimit:'Program uniforms reflect last use; map transform/opacity are shared material state, not a new draw.'};
      });
      surfaces.push({id:o.id,name:o.name,ancestry,effectiveVisible,matrixWorld:o.matrixWorld.toArray(),positionCount:o.geometry.attributes.position.count,indexCount:o.geometry.index?.count??null,materials});
    });
    const after=captureActorMaskState();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('RETAINED_READ_CHANGED_SCENE_STATE');
    return {fieldId,sceneClock,before,after,surfaces};
  }
