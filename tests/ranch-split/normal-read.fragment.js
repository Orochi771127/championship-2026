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
    const item=sprites.get(key);if(!item)throw Error('TARGET_REQUIRED');
    const meshes=[item.mesh,item.upperMesh].filter(Boolean);if(!meshes.some(m=>m.visible))throw Error('VISIBLE_LOGICAL_TARGET_REQUIRED');
    const clock=sceneClock,frame=frames,parts=[];
    const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
    for(const mesh of meshes){
      const map=mesh.material.map,image=map?.image;if(!image)throw Error('TARGET_IMAGE_REQUIRED');
      const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;if(!positions||!uv||positions.count!==uv.count)throw Error('POSITION_UV_PAIR_REQUIRED');
      const vertices=[];for(let i=0;i<positions.count;i++){const local=new THREE.Vector3(positions.getX(i),positions.getY(i),positions.getZ(i));const world=local.clone().applyMatrix4(mesh.matrixWorld),projected=world.clone().project(camera);vertices.push({local:local.toArray(),world:world.toArray(),ndc:projected.toArray(),uv:[uv.getX(i),uv.getY(i)]});}
      const index=mesh.geometry.index,indices=index?Array.from({length:index.count},(_,i)=>index.getX(i)):Array.from({length:positions.count},(_,i)=>i);
      if(indices.length%3)throw Error('TRIANGLE_GEOMETRY_REQUIRED');
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      parts.push({role:item.upperMesh?(mesh===item.upperMesh?'upper':'lower'):'full',visible:mesh.visible,matrixWorld:mesh.matrixWorld.toArray(),vertices,indices,map:{imageSha256:await digest(pixels),width:canvas.width,height:canvas.height,offset:map.offset.toArray(),repeat:map.repeat.toArray(),center:map.center.toArray(),rotation:map.rotation,matrix:map.matrix.toArray(),matrixAutoUpdate:map.matrixAutoUpdate,wrapS:map.wrapS,wrapT:map.wrapT,minFilter:map.minFilter,magFilter:map.magFilter,format:map.format,type:map.type,colorSpace:map.colorSpace,flipY:map.flipY,channel:map.channel}});
    }
    if(sceneClock!==clock||frames!==frame)throw Error('TARGET_HASH_CLOCK_OR_FRAME_DRIFT');
    return {parts,cameraProjection:camera.projectionMatrix.toArray(),cameraInverse:camera.matrixWorldInverse.toArray(),partition:item.partition??null,scope:'ACTUAL_LOGICAL_ACTOR_PARTS_PROJECTED_VERTICES_AND_UV_NOT_IDENTICAL_TOPOLOGY'};
  }
