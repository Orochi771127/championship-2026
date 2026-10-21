  // TEST ONLY. Synchronous draw/read avoids preserveDrawingBuffer assumptions.
  function captureNormalDrawingBuffer(){
    if(renderer.getRenderTarget()!==null)throw Error('NORMAL_DEFAULT_FRAMEBUFFER_REQUIRED');
    renderer.render(scene,camera);
    const gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    if(gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null)throw Error('NORMAL_FBO_NOT_DEFAULT');
    if(gl.getParameter(gl.SCISSOR_TEST))throw Error('NORMAL_SCISSOR_UNEXPECTED');
    const vp=Array.from(gl.getParameter(gl.VIEWPORT));if(vp.join(',')!==[0,0,width,height].join(','))throw Error('NORMAL_FULL_VIEWPORT_REQUIRED');
    if(gl.PIXEL_PACK_BUFFER_BINDING!==undefined&&gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)!==null)throw Error('NORMAL_PACK_BUFFER_UNEXPECTED');
    const rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    if(gl.getError()!==gl.NO_ERROR)throw Error('NORMAL_READBACK_GL_ERROR');
    return {rgba,width,height,sceneClock,frames,scope:'ACTUAL_DEFAULT_DRAWING_BUFFER_BOTTOM_UP'};
  }
  async function captureBatchMaterialConfiguration(key){
    const item=sprites.get(key);if(!item?.mesh?.visible)throw Error('BATCH_VISIBLE_TARGET_REQUIRED');
    const material=item.mesh.material,map=material.map;
    const image=map?.image;let imagePixelSha256=null;
    if(image){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;imagePixelSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),v=>v.toString(16).padStart(2,'0')).join('');}
    const uniformValue=value=>{
      if(value?.isTexture){const image=value.image;return {texture:true,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,format:value.format,type:value.type,colorSpace:value.colorSpace,flipY:value.flipY,generateMipmaps:value.generateMipmaps,anisotropy:value.anisotropy,channel:value.channel,matrix:value.matrix.toArray(),offset:value.offset.toArray(),repeat:value.repeat.toArray(),center:value.center.toArray(),rotation:value.rotation,width:image?.width??null,height:image?.height??null,data:image?.data?Array.from(image.data):null};}
      if(value?.toArray)return value.toArray();
      if(typeof value==='number'||typeof value==='boolean'||value===null)return value;
      throw Error('UNSUPPORTED_BATCH_UNIFORM_CONFIGURATION');
    };
    return {imagePixelSha256,materialType:material.type,alphaTest:material.alphaTest,depthTest:material.depthTest,depthWrite:material.depthWrite,depthFunc:material.depthFunc,side:material.side,transparent:material.transparent,blending:material.blending,defines:material.defines??null,map:map?uniformValue(map):null,uniforms:Object.fromEntries(Object.entries(material.userData.depthEnvelopeUniforms??{}).map(([name,u])=>[name,uniformValue(u.value)])),context:{width:renderer.getContext().drawingBufferWidth,height:renderer.getContext().drawingBufferHeight,sortObjects:renderer.sortObjects},physicalSupport:item.physicalSupport?{status:item.physicalSupport.status,owner:item.physicalSupport.owner}:null};
  }
