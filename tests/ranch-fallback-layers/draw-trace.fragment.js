  // TEST ONLY: observe actual draw callbacks without changing sorting or IDs.
  async function captureNormalDrawTrace(){
    const callbacks=[],draws=[],geometries=new Map();let result;
    scene.traverse(object=>{
      if(!object.isMesh&&!object.isLine&&!object.isPoints&&!object.isSprite)return;
      const previous=object.onBeforeRender;
      callbacks.push([object,previous]);
      object.onBeforeRender=function(rendererArg,sceneArg,cameraArg,geometry,material,group){
        previous?.apply(this,arguments);
        const ancestry=[];for(let p=this;p;p=p.parent)ancestry.push({childIndex:p.parent?p.parent.children.indexOf(p):0,id:p.id,name:p.name,type:p.type,renderOrder:p.renderOrder});
        if(geometry&&!geometries.has(geometry))geometries.set(geometry,{id:geometry.id,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{array:a.array??a.data?.array,arrayType:(a.array??a.data?.array)?.constructor?.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,offset:a.offset??null,stride:a.data?.stride??null}])),index:geometry.index?.array});
        const materialSemantic={};
        for(const[key,value]of Object.entries(material)){
          if(['id','uuid','version','userData','_listeners'].includes(key)||key.startsWith('_'))continue;
          if(value===null||['number','boolean','string'].includes(typeof value)){materialSemantic[key]=value;continue;}
          if(value?.isTexture){const image=value.image;materialSemantic[key]={texture:true,width:image?.width??null,height:image?.height??null,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,format:value.format,type:value.type,colorSpace:value.colorSpace,flipY:value.flipY,channel:value.channel,anisotropy:value.anisotropy,generateMipmaps:value.generateMipmaps,premultiplyAlpha:value.premultiplyAlpha,unpackAlignment:value.unpackAlignment,matrixAutoUpdate:value.matrixAutoUpdate,matrix:value.matrix.toArray(),offset:value.offset.toArray(),repeat:value.repeat.toArray(),center:value.center.toArray(),rotation:value.rotation};continue;}
          if(value?.toArray){materialSemantic[key]=value.toArray();continue;}
          if(key==='defines')materialSemantic[key]=value;
        }
        draws.push({geometryId:geometry?.id??null,materialSemantic,mainRenderer:rendererArg===renderer,mainCamera:cameraArg===camera,targetIsDefault:rendererArg.getRenderTarget()===null,ancestry,order:draws.length,objectId:this.id,name:this.name,type:this.type,materialId:material.id,materialName:material.name,transparent:material.transparent,depthTest:material.depthTest,depthWrite:material.depthWrite,depthFunc:material.depthFunc,renderOrder:this.renderOrder,group:group?{start:group.start,count:group.count,materialIndex:group.materialIndex}:null,matrixWorld:this.matrixWorld.toArray(),geometry:{positionCount:geometry?.attributes?.position?.count??null,indexCount:geometry?.index?.count??null}});
      };
    });
    try{
      renderer.render(scene,camera);
      result={sortObjects:renderer.sortObjects,targetIsDefault:renderer.getRenderTarget()===null,camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()},draws,threePng:renderer.domElement.toDataURL('image/png'),sceneClock,frames,scope:'ACTUAL_CALLBACK_ORDER_NO_SORT_OR_ID_OVERRIDE'};
    }finally{for(const[object,callback]of callbacks)object.onBeforeRender=callback;}
    const digest=async data=>{if(!data)return null;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data.buffer,data.byteOffset,data.byteLength))),v=>v.toString(16).padStart(2,'0')).join('');};
    const hashes=new Map();for(const entry of geometries.values()){const attributes={};for(const[name,a]of Object.entries(entry.attributes)){const {array,...shape}=a;attributes[name]={...shape,sha256:await digest(array)};}hashes.set(entry.id,{attributes,indexSha256:await digest(entry.index)});}
    for(const draw of draws){draw.geometryHashes=hashes.get(draw.geometryId)??null;delete draw.geometryId;}
    if(frames!==result.frames||sceneClock!==result.sceneClock)throw Error('TRACE_CLOCK_OR_FRAME_CHANGED_DURING_HASH');
    return result;
  }
