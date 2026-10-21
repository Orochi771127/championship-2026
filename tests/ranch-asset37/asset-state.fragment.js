  // TEST ONLY: read actual loaded instances, never change geometry/material/visibility.
  async function captureAssetInventory(fieldId){
    const clock=sceneClock,frame=frames,rows=[];
    const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
    for(const i of instances.filter(i=>i.p.fieldId===fieldId)){
      const meshes=[];i.object.updateWorldMatrix(true,true);
      const objects=[];i.object.traverse(o=>{if(o.isMesh||o.isPoints)objects.push(o);});
      for(const o of objects){
        let effectiveVisible=true;for(let p=o;p;p=p.parent)effectiveVisible&&=p.visible;
        const geometry=o.geometry,attributes={};
        for(const[name,a]of Object.entries(geometry.attributes)){
          const values=new Float32Array(a.count*a.itemSize);for(let n=0;n<a.count;n++)for(let k=0;k<a.itemSize;k++)values[n*a.itemSize+k]=a.getComponent(n,k);
          attributes[name]={count:a.count,itemSize:a.itemSize,normalized:a.normalized,sha256Float32:await digest(values)};
        }
        const index=geometry.index,indices=index?Uint32Array.from({length:index.count},(_,n)=>index.getX(n)):null;
        const bounds=new THREE.Box3().setFromObject(o),corners=[];
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera).toArray());
        const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>({id:m.id,name:m.name,type:m.type,visible:m.visible,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,side:m.side,depthWrite:m.depthWrite,depthTest:m.depthTest,emissiveIntensity:m.emissiveIntensity,map:m.map?{uuid:m.map.uuid,width:m.map.image?.width,height:m.map.image?.height,src:m.map.image?.src??null}:null,uniforms:Object.fromEntries(Object.entries(m.userData.shader?.uniforms??{}).filter(([k,v])=>/^u(Lava|Water|Wind|Ice|Belt|Time)/.test(k)&&typeof v.value==='number').map(([k,v])=>[k,v.value]))}));
        meshes.push({bufferClass:o.isPoints?'GENERATED_DYNAMIC_POINTS':'MODEL_MESH',id:o.id,name:o.name,type:o.type,visible:o.visible,effectiveVisible,matrixWorld:o.matrixWorld.toArray(),attributes,index:index?{count:index.count,sha256Uint32:await digest(indices)}:null,worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},projectedBoxCorners:corners,materials});
      }
      rows.push({placement:i.p,shift:i.shift,visible:i.object.visible,mixerTime:i.mixer?.time??null,meshes});
    }
    if(sceneClock!==clock||frames!==frame)throw Error('ASSET_READ_CLOCK_DRIFT');
    return {fieldId,sceneClock:clock,frames:frame,instances:rows,camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray(),inverse:camera.matrixWorldInverse.toArray()},boundsScope:'CPU_GEOMETRY_BOUNDS_NOT_SHADER_DEFORMED_OR_PARTICLE_ENVELOPE'};
  }
