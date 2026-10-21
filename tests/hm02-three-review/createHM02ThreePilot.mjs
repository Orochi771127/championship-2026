import {actorLocalQuad} from './hm02ActorBounds.mjs';
import {abortable,createResourceDisposer,shaderFailureGuard} from './hm02Lifecycle.mjs';
import {projection,hm02PilotAllowed} from './hm02Projection.mjs';
import {installSharedPass} from './hm02SharedPass.mjs';
import {installFlatGroundDepthCandidate} from './hm02FlatGroundDepthCandidate.mjs';

// Candidate only: caller explicitly provides verified manifest, GLTFLoader,
// authored actor support resolver and already-owned Pixi nodes. No gameplay API.
export async function createHM02ThreePilot({THREE,GLTFLoader,stage,enabled=false,reviewHarness=false,fieldId,manifest,resolveSupport,signal,onFallback=()=>{}}) {
  const {app}=stage;
  reviewHarness=reviewHarness===true && ['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname);
  if (!hm02PilotAllowed({enabled,fieldId,manifest,renderer:app.renderer,reviewHarness})) return null;
  if (THREE.REVISION!=='185' || stage.PIXI.VERSION!=='8.19.0' || typeof resolveSupport!=='function') return null;
  const map=projection(manifest.projection), scene=new THREE.Scene();
  let renderer=null, shaderGuard=null;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.01,1000);
  const ambient=new THREE.HemisphereLight(0xfff4dd,0x66543b,1.6);
  const sun=new THREE.DirectionalLight(0xffe3b0,2.2);sun.position.set(-30,65,40);
  scene.add(ambient,sun);
  let active=true, view=null, pass=null, gltf=null, prototypeGltf=null, sizeKey='', restoreFallback=null;
  const controller=new AbortController(), resourceDisposer=createResourceDisposer(), batches=new Set();
  const onAbort=()=>dispose();
  signal?.addEventListener('abort',onAbort,{once:true});
  let offLost=null;
  const actors=new Map(),textures=new Map(),hidden=new Map();
  const hide=(node)=>{if(node&&!hidden.has(node)){hidden.set(node,node.renderable);node.renderable=false;}};
  const restore=()=>{for(const [n,v]of hidden)if(!n.destroyed)n.renderable=v;hidden.clear();};
  function dispose(){
    if(!active)return;active=false;controller.abort(new DOMException('Pilot disposed','AbortError'));signal?.removeEventListener('abort',onAbort);pass?.dispose();restore();restoreFallback?.();offLost?.();
    for(const a of actors.values()){a.geometry.dispose();a.material.dispose();a.userData.shadow?.geometry.dispose();a.userData.shadow?.material.dispose();}actors.clear();
    for(const t of textures.values())t.dispose();textures.clear();
    for(const batch of batches)resourceDisposer.once(batch);batches.clear();
    resourceDisposer.gltf(gltf);resourceDisposer.gltf(prototypeGltf);
    try {renderer?.dispose();} finally {if(renderer)app.renderer.resetState();}

  }
  const fail=(error)=>{const notify=active&&!signal?.aborted;dispose();if(notify)onFallback(error);};
  offLost=stage.onContextLost(()=>fail(new Error('HM02_CONTEXT_LOST_USE_2D')));
  function textureFor(texture){
    if(textures.has(texture))return textures.get(texture);
    const image=texture.source?.resource,frame=texture.frame,res=texture.source?.resolution??1;
    if(!image||texture.rotate)throw new Error('HM02_UNSUPPORTED_SPRITE_SOURCE');
    const canvas=document.createElement('canvas');canvas.width=Math.round(frame.width*res);canvas.height=Math.round(frame.height*res);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('HM02_CPU_TEXTURE_CANVAS_UNAVAILABLE');
    ctx.drawImage(image,frame.x*res,frame.y*res,frame.width*res,frame.height*res,0,0,canvas.width,canvas.height);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;
    textures.set(texture,t);return t;
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
      if(h!==asset.sha256)throw new Error('HM02_ASSET_HASH_MISMATCH');return b;
    }
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

    // All await boundaries are complete before touching the shared GL state.
    controller.signal.throwIfAborted();
    try {
      renderer=new THREE.WebGLRenderer({canvas:app.canvas,context:app.renderer.gl});
      renderer.autoClear=true;renderer.setClearColor(0x0a222a,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
      shaderGuard=shaderFailureGuard(renderer);
    } finally {app.renderer.resetState();}
    // Export is already Y-up; never double-rotate or rescale.
    pass=installSharedPass({app,threeRenderer:renderer,onFailure:fail,draw(){
      if(!view)return;
      const {center,halfWidth,halfHeight}=map.viewport(view,app.screen.width,app.screen.height);
      camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;
      camera.position.set(center[0],center[1]+100*map.s,center[2]+100*map.c);camera.lookAt(...center);camera.updateProjectionMatrix();
      const nextSize=`${app.screen.width}:${app.screen.height}:${app.renderer.resolution}`;
      if(sizeKey!==nextSize){renderer.setPixelRatio(app.renderer.resolution);renderer.setSize(app.screen.width,app.screen.height,false);sizeKey=nextSize;}
      renderer.setScissorTest(false);shaderGuard.draw(()=>renderer.render(scene,camera));
    }});
  } catch(error){fail(error);return null;}
  return Object.freeze({
    setFallbackRestore(callback){restoreFallback=callback;},
    sync({view:next,wildNodes,backgroundNodes=[]}) {
      if(!active)return false;
      try {
        restore();
        // Validate every actor before hiding any existing fallback art.
        const records=next.wildCreatures.map(wild=>{
          const node=wildNodes.get(wild.wildId),sprite=node?.characterSprite,frame=node?.nativeFramePresenter?.getSnapshot();
          const support=resolveSupport({wild,frame,node,view:next});
          if(!sprite||!support?.verifiedSourceId||!Number.isFinite(support.groundHeight))throw new Error('HM02_VERIFIED_ACTOR_SUPPORT_MISSING');
          return {wild,node,sprite,support};
        });
        view=next;const live=new Set();
        for(const {wild,node,sprite,support} of records){
          live.add(wild.wildId);let actor=actors.get(wild.wildId);
          if(support.offscreen){if(actor){actor.visible=false;if(actor.userData.shadow)actor.userData.shadow.visible=false;}hide(sprite);hide(node.body);hide(node.contactShadow);continue;}
          if(!actor){const geometry=new THREE.BufferGeometry();geometry.setIndex([0,1,2,0,2,3]);geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,0,0,1,0,1,1],2));
            const material=new THREE.MeshBasicMaterial({alphaTest:.1,transparent:true,depthTest:true,depthWrite:true,side:THREE.DoubleSide});installFlatGroundDepthCandidate(material,{THREE,groundHeight:support.groundHeight});
            actor=new THREE.Mesh(geometry,material);actor.userData.supportHeight=support.groundHeight;actors.set(wild.wildId,actor);scene.add(actor);}
          const t=sprite.texture,p=actor.geometry.attributes.position;
          actorLocalQuad(node).forEach(([dx,dy],i)=>p.setXYZ(i,...map.actorVertex({worldX:wild.worldX,worldY:wild.worldY,worldZ:wild.worldZ??0,supportOffsetY:0,groundHeight:support.groundHeight},dx,dy)));
          if(actor.userData.supportHeight!==support.groundHeight){installFlatGroundDepthCandidate(actor.material,{THREE,groundHeight:support.groundHeight});actor.userData.supportHeight=support.groundHeight;}
          p.needsUpdate=true;actor.geometry.computeBoundingSphere();if(!actor.material.map)actor.material.needsUpdate=true;actor.material.map=textureFor(t);actor.material.opacity=wild.passageAlpha??1;actor.visible=sprite.visible&&node.visible&&!support.offscreen;
          const ellipses=node.threeContactEllipses;
          if(!Array.isArray(ellipses))throw new Error('HM02_EXISTING_SHADOW_BINDING_REQUIRED');
          let shadow=actor.userData.shadow;
          if(!shadow){shadow=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x02070a,transparent:true,opacity:.48,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));actor.userData.shadow=shadow;scene.add(shadow);}
          const vertices=[];
          for(const e of ellipses)for(let i=0;i<20;i++){
            for(const [dx,dy]of [[0,0],[Math.cos(i*Math.PI/10)*e.radiusX,Math.sin(i*Math.PI/10)*e.radiusY],[Math.cos((i+1)*Math.PI/10)*e.radiusX,Math.sin((i+1)*Math.PI/10)*e.radiusY]]){
              vertices.push(...map.ground(wild.worldX+(e.x+dx)*node.scale.x,wild.worldY+e.y+dy,support.groundHeight+.0001));
            }
          }
          if(shadow.geometry.attributes.position?.array.length!==vertices.length){shadow.geometry.dispose();shadow.geometry=new THREE.BufferGeometry();shadow.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));}else{shadow.geometry.attributes.position.array.set(vertices);shadow.geometry.attributes.position.needsUpdate=true;}shadow.geometry.computeBoundingSphere();shadow.visible=actor.visible;shadow.material.opacity=.48*(wild.passageAlpha??1);
          hide(sprite);hide(node.body);hide(node.contactShadow);
        }
        for(const [id,a]of actors)if(!live.has(id)){scene.remove(a);if(a.userData.shadow)scene.remove(a.userData.shadow);a.geometry.dispose();a.material.dispose();a.userData.shadow?.geometry.dispose();a.userData.shadow?.material.dispose();actors.delete(id);}
        for(const n of backgroundNodes)hide(n);
        // Keep native UI/rings/stamina/tools and pointer mapping on existing Pixi.
        const night=fieldId==='field_hm02_02';ambient.intensity=night?.55:1.6;sun.intensity=night?.35:2.2;
        return true;
      }catch(error){fail(error);return false;}
    },
    getDiagnostics(){return {active,renderer:'THREE_SHARED_PIXI_WEBGL2_HM02_PILOT',canvasCount:1,contextCount:1,actorCount:actors.size,actorTextureCount:textures.size,three:renderer?.info,measuredMobilePerformance:false};},
    dispose
  });
}
