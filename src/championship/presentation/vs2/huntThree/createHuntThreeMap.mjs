import {nativeActorRecord,nativeShadowPoint} from './nativeActorAdapter.mjs';
import {createActorTextureCache} from './actorTextureCache.mjs';
import {abortable,createResourceDisposer,shaderFailureGuard,leaseHM02Renderer} from './lifecycle.mjs';
import {projectionForManifest,viewportClip} from './projection.mjs';
import {hm02PilotAllowed} from './hm02Projection.mjs';
import {loadExternalMapAssets,validateExternalManifest} from './externalMapAssets.mjs';
import {withSharedUnpackState} from './sharedGLState.mjs';
import {installSharedPass} from './sharedPass.mjs';
import {installFlatGroundDepthCandidate} from './supportDepth.mjs';

// Caller provides a hash-verified manifest and an explicit appearance approval,
// authored actor support resolver and already-owned Pixi nodes. No gameplay API.
export async function createHuntThreeMap({THREE,GLTFLoader,DRACOLoader,dracoDecoderPath,baseUrl,fieldArt,stage,enabled=false,reviewHarness=false,appearanceApproved=false,fieldId,manifest,resolveSupport,signal,onFallback=()=>{}}) {
  const {app}=stage;
  reviewHarness=reviewHarness===true && ['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname);
  const baked=manifest?.schema==='HUNT_THREE_MAP.v1';
  if(baked){
    if(!enabled||!(manifest.qaApproved===true||reviewHarness||appearanceApproved===true)||app.renderer?.gl?.getContextAttributes?.().stencil!==true||typeof app.renderer.resetState!=='function')return null;
    try{validateExternalManifest(manifest,fieldId);}catch(error){onFallback(error);return null;}
  }else if(!hm02PilotAllowed({enabled,fieldId,manifest,renderer:app.renderer,reviewHarness}))return null;
  if (THREE.REVISION!=='185' || stage.PIXI.VERSION!=='8.19.0' || (!baked&&typeof resolveSupport!=='function')) return null;
  const map=projectionForManifest(manifest), scene=new THREE.Scene();
  let renderer=null, rendererLease=null, shaderGuard=null;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.01,1000);
  const ambient=new THREE.HemisphereLight(0xfff4dd,0x66543b,1.6);
  const sun=new THREE.DirectionalLight(0xffe3b0,2.2);sun.position.set(-30,65,40);
  scene.add(ambient,sun);
  let active=true, view=null, pass=null, gltf=null, prototypeGltf=null, sizeKey='', restoreFallback=null, external=null, frameIndex=0, suspended=false;
  const controller=new AbortController(), resourceDisposer=createResourceDisposer(), batches=new Set(),cleanupErrors=[];
  const cleanup=(label,callback)=>{try{callback();}catch(error){cleanupErrors.push(`${label}: ${error?.message??error}`);}};
  const onAbort=()=>dispose();
  signal?.addEventListener('abort',onAbort,{once:true});
  let offLost=null;
  const actors=new Map(),hidden=new Map();
  const textures=createActorTextureCache({create:cropTexture,...manifest.actorTextureBudget});
  const hide=(node)=>{if(node&&!hidden.has(node)){hidden.set(node,node.renderable);node.renderable=false;}};
  const restore=()=>{for(const [n,v]of hidden)if(!n.destroyed)n.renderable=v;hidden.clear();};
  function releaseExternal(){
    if(!external)return;resourceDisposer.gltf(external.gltf);
    for(const material of external.materialOwners)resourceDisposer.once(material);
    for(const texture of external.textures)resourceDisposer.texture(texture);
    external.textures.length=0;
  }
  function dispose(){
    if(!active)return;active=false;
    cleanup('abort',()=>controller.abort(new DOMException('Pilot disposed','AbortError')));
    cleanup('abort listener',()=>signal?.removeEventListener('abort',onAbort));
    cleanup('shared pass',()=>pass?.dispose());cleanup('borrowed nodes',restore);
    cleanup('context listener',()=>offLost?.());
    for(const a of actors.values())for(const owned of [a.geometry,a.material,a.userData.shadow?.geometry,a.userData.shadow?.material])resourceDisposer.once(owned);
    actors.clear();cleanup('actor textures',()=>textures.dispose());
    for(const batch of batches)resourceDisposer.once(batch);batches.clear();
    cleanup('scene',()=>resourceDisposer.gltf(gltf));cleanup('prototypes',()=>resourceDisposer.gltf(prototypeGltf));cleanup('external assets',releaseExternal);
    cleanup('renderer lease',()=>rendererLease?.release());
    // Notifications run after mandatory ownership cleanup, and cannot strand it.
    cleanup('fallback restore',()=>restoreFallback?.());
  }
  const fail=(error)=>{const notify=active&&!signal?.aborted;dispose();if(notify)cleanup('fallback notification',()=>onFallback(error));};
  offLost=stage.onContextLost(()=>fail(new Error('HM02_CONTEXT_LOST_USE_2D')));
  function cropTexture(texture){
    const image=texture.source?.resource,frame=texture.frame,res=texture.source?.resolution??1;
    if(!image||texture.rotate)throw new Error('HM02_UNSUPPORTED_SPRITE_SOURCE');
    const canvas=document.createElement('canvas');canvas.width=Math.round(frame.width*res);canvas.height=Math.round(frame.height*res);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('HM02_CPU_TEXTURE_CANVAS_UNAVAILABLE');
    ctx.drawImage(image,frame.x*res,frame.y*res,frame.width*res,frame.height*res,0,0,canvas.width,canvas.height);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;
    return t;
  }
  try {
    signal?.throwIfAborted();
    async function verifiedBytes(asset){
      controller.signal.throwIfAborted();
      if(!asset?.url||!asset.sha256)throw new Error('HM02_ASSET_IDENTITY_REQUIRED');
      const r=await abortable(fetch(asset.url,{signal:controller.signal}),controller.signal);if(!r.ok)throw new Error('HM02_ASSET_FETCH_FAILED');
      const b=await abortable(r.arrayBuffer(),controller.signal);
      const digest=await abortable(crypto.subtle.digest('SHA-256',b),controller.signal);
      const h=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      if(h!==asset.sha256)throw new Error('HM02_ASSET_HASH_MISMATCH');
      if(asset.bytes!==undefined&&b.byteLength!==asset.bytes)throw new Error('HM02_ASSET_BYTE_BUDGET_MISMATCH');return b;
    }
    if(baked){
      external=await loadExternalMapAssets({THREE,GLTFLoader,DRACOLoader,dracoDecoderPath,manifest,fieldId,baseUrl,signal:controller.signal,disposer:resourceDisposer});
      if(!active||controller.signal.aborted){releaseExternal();controller.signal.throwIfAborted();throw new Error('HUNT_DISPOSED_DURING_ASSET_HANDOFF');}
      gltf=external.gltf;resolveSupport=external.resolveSupport;scene.add(gltf.scene);
    }else{
    const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:'))return url;throw new Error('HM02_EXTERNAL_GLTF_RESOURCE_FORBIDDEN');});
    async function parse(asset){
      const bytes=await verifiedBytes(asset);controller.signal.throwIfAborted();
      return abortable(new GLTFLoader(manager).parseAsync(bytes,''),controller.signal,resourceDisposer.gltf);
    }
    gltf=await parse(manifest.glb);
    if(!active||controller.signal.aborted){resourceDisposer.gltf(gltf);controller.signal.throwIfAborted();throw new Error('HM02_DISPOSED_DURING_PARSE_HANDOFF');}
    scene.add(gltf.scene);
    prototypeGltf=await parse(manifest.treePrototypes);
    if(!active||controller.signal.aborted){resourceDisposer.gltf(prototypeGltf);controller.signal.throwIfAborted();throw new Error('HM02_DISPOSED_DURING_PARSE_HANDOFF');}
    const placements=JSON.parse(new TextDecoder().decode(await verifiedBytes(manifest.treeInstances)));
    controller.signal.throwIfAborted();
    if(placements.coordinateSpace!=='glTF_Y_UP'||placements.instances.length!==37)throw new Error('HM02_TREE_CONTRACT_MISMATCH');
    for(const prototype of placements.prototypes){
      const root=prototypeGltf.scene.getObjectByName(prototype.nodeName);
      if(!root)throw new Error('HM02_TREE_PROTOTYPE_MISSING');
      const records=placements.instances.filter(i=>i.prototype===prototype.id);
      root.updateWorldMatrix(true,true);
      const inverseRoot=new THREE.Matrix4().copy(root.matrixWorld).invert();
      root.traverse(mesh=>{if(!mesh.isMesh)return;
        const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,records.length);batches.add(batch);
        const relative=new THREE.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld);
        records.forEach((r,i)=>{
          if(!r.position?.every(Number.isFinite)||!r.scale?.every(n=>Number.isFinite(n)&&n>0))throw new Error('HM02_INVALID_TREE_TRANSFORM');
          const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...r.position),new THREE.Quaternion(),new THREE.Vector3(...r.scale));
          batch.setMatrixAt(i,matrix.multiply(relative));
        });batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();scene.add(batch);
      });
    }

    }

    // All await boundaries are complete before touching the shared GL state.
    controller.signal.throwIfAborted();
    try {
      rendererLease=leaseHM02Renderer({THREE,app,onInvalidate:fail});renderer=rendererLease.renderer;
      renderer.autoClear=true;renderer.setClearColor(external?.field.clearColor??0x0a222a,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
      shaderGuard=shaderFailureGuard(renderer);
      if(external)withSharedUnpackState(app.renderer.gl,()=>{for(const texture of external.textures)renderer.initTexture(texture);});
    } finally {app.renderer.resetState();}
    // Export is already Y-up; never double-rotate or rescale.
    pass=installSharedPass({app,threeRenderer:renderer,onFailure:fail,draw(){
      if(suspended||!view)return false;
      const {center,halfWidth,halfHeight}=map.viewport(view,app.screen.width,app.screen.height);
      camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;
      camera.position.set(...center.map((v,i)=>v+500*map.eye[i]));camera.up.set(...map.up);camera.lookAt(...center);camera.updateProjectionMatrix();
      const nextSize=`${app.screen.width}:${app.screen.height}:${app.renderer.resolution}`;
      if(sizeKey!==nextSize){renderer.setPixelRatio(app.renderer.resolution);renderer.setSize(app.screen.width,app.screen.height,false);sizeKey=nextSize;}
      // Clear the complete shared canvas, but clip Three scenery/actors to the
      // same map intersection as the existing Pixi world mask.
      if(external){const phase=fieldArt?.getDiagnostics?.().frameIndex;external.selectPhase(phase);frameIndex=phase;}
      const clip=viewportClip(view,app.screen.width,app.screen.height);
      renderer.setScissorTest(false);renderer.clear();renderer.setScissor(clip.x,clip.y,clip.width,clip.height);
      renderer.setScissorTest(true);renderer.autoClear=false;
      try{shaderGuard.draw(()=>renderer.render(scene,camera));}finally{renderer.autoClear=true;}
    }});
  } catch(error){fail(error);return null;}
  return Object.freeze({
    setFallbackRestore(callback){restoreFallback=callback;},
    sync({view:next,wildNodes,backgroundNodes=[]}) {
      if(!active)return false;
      try {
        restore();
        if(suspended)return false;
        // Validate every actor before hiding any existing fallback art.
        const records=next.wildCreatures.map(wild=>{
          const record=nativeActorRecord(wild,wildNodes.get(wild.wildId),{required:true});
          const support=record.hidden?{verifiedSourceId:'HIDDEN_NO_GROUND_PROOF_NEEDED',groundHeight:manifest.flatSupport?.height??0,offscreen:true}
            :resolveSupport({...record,view:next});
          if(!support?.verifiedSourceId||!Number.isFinite(support.groundHeight))throw new Error('HM02_VERIFIED_ACTOR_SUPPORT_MISSING');
          return {...record,support};
        });
        textures.beginFrame(records.filter(r=>!r.support.offscreen).map(r=>r.sprite.texture));
        view=next;const live=new Set();
        for(const {wild,node,sprite,support,quad,opacity} of records){
          live.add(wild.wildId);let actor=actors.get(wild.wildId);
          if(support.offscreen){if(actor){actor.visible=false;actor.material.map=null;if(actor.userData.shadow)actor.userData.shadow.visible=false;}hide(sprite);hide(node.body);hide(node.contactShadow);continue;}
          if(!actor){const geometry=new THREE.BufferGeometry();geometry.setIndex([0,1,2,0,2,3]);geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,0,0,1,0,1,1],2));
            const material=new THREE.MeshBasicMaterial({alphaTest:0,transparent:true,depthTest:true,depthWrite:true,side:THREE.DoubleSide});installFlatGroundDepthCandidate(material,{THREE,groundHeight:support.groundHeight,eyeDirection:map.eye});
            actor=new THREE.Mesh(geometry,material);actor.userData.supportHeight=support.groundHeight;actors.set(wild.wildId,actor);scene.add(actor);}
          const t=sprite.texture,p=actor.geometry.attributes.position;
          quad.forEach(([dx,dy],i)=>p.setXYZ(i,...map.actorVertex({worldX:wild.worldX,worldY:wild.worldY,worldZ:wild.worldZ??0,supportOffsetY:0,groundHeight:support.groundHeight},dx,dy)));
          if(actor.userData.supportHeight!==support.groundHeight){installFlatGroundDepthCandidate(actor.material,{THREE,groundHeight:support.groundHeight,eyeDirection:map.eye});actor.userData.supportHeight=support.groundHeight;}
          p.needsUpdate=true;actor.geometry.computeBoundingSphere();if(!actor.material.map)actor.material.needsUpdate=true;actor.material.map=textures.get(t);actor.material.opacity=opacity;actor.material.color.set(sprite.tint??0xffffff);actor.visible=sprite.visible&&node.visible&&!support.offscreen;
          const ellipses=node.threeContactEllipses;
          if(!Array.isArray(ellipses))throw new Error('HM02_EXISTING_SHADOW_BINDING_REQUIRED');
          let shadow=actor.userData.shadow;
          if(!shadow){shadow=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x02070a,transparent:true,opacity:.48,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));// Opaque terrain/props render first; ground shadows precede transparent
            // actors, while retaining the opaque foreground depth test.
            shadow.renderOrder=-1;actor.userData.shadow=shadow;scene.add(shadow);}
          const vertices=[];
          for(const e of ellipses)for(let i=0;i<20;i++){
            for(const [dx,dy]of [[0,0],[Math.cos(i*Math.PI/10)*e.radiusX,Math.sin(i*Math.PI/10)*e.radiusY],[Math.cos((i+1)*Math.PI/10)*e.radiusX,Math.sin((i+1)*Math.PI/10)*e.radiusY]]){
              const [x,y]=nativeShadowPoint(wild,node,e.x+dx,e.y+dy);
              vertices.push(...map.ground(x,y,support.groundHeight+.0001));
            }
          }
          if(shadow.geometry.attributes.position?.array.length!==vertices.length){shadow.geometry.dispose();shadow.geometry=new THREE.BufferGeometry();shadow.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));}else{shadow.geometry.attributes.position.array.set(vertices);shadow.geometry.attributes.position.needsUpdate=true;}shadow.geometry.computeBoundingSphere();shadow.visible=actor.visible&&node.contactShadow.visible!==false;shadow.material.opacity=.48*(node.alpha??wild.passageAlpha??1)*(node.contactShadow.alpha??1);
          hide(sprite);hide(node.body);hide(node.contactShadow);
        }
        for(const [id,a]of actors)if(!live.has(id)){scene.remove(a);if(a.userData.shadow)scene.remove(a.userData.shadow);a.geometry.dispose();a.material.dispose();a.userData.shadow?.geometry.dispose();a.userData.shadow?.material.dispose();actors.delete(id);}
        for(const n of backgroundNodes)hide(n);
        // Keep native UI/rings/stamina/tools and pointer mapping on existing Pixi.
        if(!baked){const night=fieldId==='field_hm02_02';ambient.intensity=night?.55:1.6;sun.intensity=night?.35:2.2;}
        return true;
      }catch(error){fail(error);return false;}
    },
    setReviewSuspended(value){
      if(!reviewHarness)throw new Error('HUNT_REVIEW_ONLY');suspended=Boolean(value);
      if(suspended){restore();restoreFallback?.();}
    },
    getDiagnostics(){return {active,threeUsed:active&&!suspended&&view!==null,renderer:'THREE_SHARED_PIXI_WEBGL2_HUNT_UNIFIED',map:manifest.map??'hm02',fieldId,canvasCount:1,contextCount:1,actorCount:actors.size,actorTextureCount:textures.getDiagnostics().entries,actorTextures:textures.getDiagnostics(),assetVersion:manifest.assetVersion??null,treeSelection:manifest.treeSelection??null,horizontalRotationEnabled:false,projectionElevationDegrees:manifest.projection.elevationDegrees,residentFrameTextures:external?.textures.length??0,frameIndex,externalAssets:external?.stats??null,fallback2DRetained:true,fallback2DReleaseApproved:false,qaApproved:false,three:renderer?.info,measuredMobilePerformance:false,cleanupErrors:[...cleanupErrors,...resourceDisposer.getErrors()],sharedPass:pass?.getDiagnostics()??null};},
    dispose
  });
}
