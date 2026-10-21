  // TEST ONLY: observe actual draw callbacks without changing sorting or IDs.
  function captureNormalDrawTrace(){
    const callbacks=[],draws=[];
    scene.traverse(object=>{
      if(!object.isMesh&&!object.isLine&&!object.isPoints&&!object.isSprite)return;
      const previous=object.onBeforeRender;
      callbacks.push([object,previous]);
      object.onBeforeRender=function(rendererArg,sceneArg,cameraArg,geometry,material,group){
        previous?.apply(this,arguments);
        const ancestry=[];for(let p=this;p;p=p.parent)ancestry.push({childIndex:p.parent?p.parent.children.indexOf(p):0,id:p.id,name:p.name,type:p.type,renderOrder:p.renderOrder});
        draws.push({mainRenderer:rendererArg===renderer,mainCamera:cameraArg===camera,targetIsDefault:rendererArg.getRenderTarget()===null,ancestry,order:draws.length,objectId:this.id,name:this.name,type:this.type,materialId:material.id,materialName:material.name,transparent:material.transparent,depthTest:material.depthTest,depthWrite:material.depthWrite,depthFunc:material.depthFunc,renderOrder:this.renderOrder,group:group?{start:group.start,count:group.count,materialIndex:group.materialIndex}:null,matrixWorld:this.matrixWorld.toArray(),geometry:{positionCount:geometry?.attributes?.position?.count??null,indexCount:geometry?.index?.count??null}});
      };
    });
    try{
      renderer.render(scene,camera);
      return {sortObjects:renderer.sortObjects,targetIsDefault:renderer.getRenderTarget()===null,camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()},draws,threePng:renderer.domElement.toDataURL('image/png'),sceneClock,frames,scope:'ACTUAL_CALLBACK_ORDER_NO_SORT_OR_ID_OVERRIDE'};
    }finally{for(const[object,callback]of callbacks)object.onBeforeRender=callback;}
  }
