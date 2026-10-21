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
  async function captureColumnGeometryHashes(){
    const names=new Set(['crags-el-basalt','crags-el-basalt-light','crags-el-basalt-mid']),rows=[];const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
    const objects=[];scene.traverse(o=>{if(o.isMesh&&names.has(o.name)){let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;if(visible)objects.push(o);}});
    for(const o of objects){const p=o.geometry.attributes.position,index=o.geometry.index;const positions=new ArrayBuffer(p.count*12),pv=new DataView(positions);for(let i=0;i<p.count;i++){pv.setFloat32(i*12,p.getX(i),true);pv.setFloat32(i*12+4,p.getY(i),true);pv.setFloat32(i*12+8,p.getZ(i),true);}const indices=new ArrayBuffer(index.count*4),iv=new DataView(indices);for(let i=0;i<index.count;i++)iv.setUint32(i*4,index.getX(i),true);rows.push({id:o.id,name:o.name,positionCount:p.count,indexCount:index.count,positionSha256Float32LE:await digest(positions),indexSha256Uint32LE:await digest(indices),matrixWorld:o.matrixWorld.toArray()});}
    return rows;
  }
  async function captureMotionTargetGeometry(key){
    const item=sprites.get(key);if(!item?.mesh?.visible)throw Error('VISIBLE_TARGET_REQUIRED');const mesh=item.mesh,map=mesh.material.map,clock=sceneClock,frame=frames;
    const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
    const attributes={};for(const[name,a]of Object.entries(mesh.geometry.attributes)){const source=a.array??a.data?.array;if(!source)throw Error('TARGET_ATTRIBUTE_ARRAY_REQUIRED');attributes[name]={itemSize:a.itemSize,count:a.count,normalized:a.normalized,arrayType:source.constructor.name,offset:a.offset??null,stride:a.data?.stride??null,sha256:await digest(new Uint8Array(source.buffer,source.byteOffset,source.byteLength))};}
    const index=mesh.geometry.index?.array;const image=map?.image;if(!image)throw Error('TARGET_IMAGE_REQUIRED');const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const result={matrixWorld:mesh.matrixWorld.toArray(),attributes,indexSha256:index?await digest(new Uint8Array(index.buffer,index.byteOffset,index.byteLength)):null,indexArrayType:index?.constructor.name??null,map:{imageSha256:await digest(pixels),width:canvas.width,height:canvas.height,offset:map.offset.toArray(),repeat:map.repeat.toArray(),center:map.center.toArray(),rotation:map.rotation,matrix:map.matrix.toArray(),matrixAutoUpdate:map.matrixAutoUpdate,wrapS:map.wrapS,wrapT:map.wrapT,minFilter:map.minFilter,magFilter:map.magFilter,format:map.format,type:map.type,colorSpace:map.colorSpace,flipY:map.flipY,channel:map.channel}};
    if(sceneClock!==clock||frames!==frame)throw Error('TARGET_HASH_CLOCK_OR_FRAME_DRIFT');return result;
  }
