import * as THREE from '../../../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../../node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { ranchNativeToWorld, ranchSurfaceHeight, ranchPickWalkSurface, ranchSpriteScreenQuad, ranchSpriteUvs, RANCH_ELEVATION } from './ranchThreeCoordinates.js';
import { currentQualityTier, prefersReducedMotion } from './presentationPreferences.js';
import { ranchSharedBoundaries } from '../cage/ranchConnections.js';

const MANIFEST = 'assets/production/cage/three-20261021/manifest.json';
const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const up = new THREE.Vector3(-Math.sin(RANCH_ELEVATION)*Math.SQRT1_2, Math.cos(RANCH_ELEVATION), -Math.sin(RANCH_ELEVATION)*Math.SQRT1_2);
const direction = new THREE.Vector3(Math.cos(RANCH_ELEVATION)*Math.SQRT1_2, Math.sin(RANCH_ELEVATION), Math.cos(RANCH_ELEVATION)*Math.SQRT1_2);

/** Bounded rendering adapter, driven only by the existing Pixi scene ticker.
 * The native simulation, pointer targets, camera pan/zoom and save stay owned
 * by the existing presenter. No requestAnimationFrame or new game authority.
 */
export async function createRanchThreeScene({ stage, placements, field, signal,connections=[],cagePlacements=[] }) {
  const response = await fetch(MANIFEST, { signal });
  if (!response.ok) throw Error(`RANCH_3D_MANIFEST_HTTP_${response.status}`);
  const manifest = await response.json(), specs = new Map(manifest.fields.map(f => [f.fieldId, f]));
  const surfaceResponse=await fetch('assets/production/cage/three-20261021/walk-surfaces.json',{signal});
  if(!surfaceResponse.ok)throw Error('RANCH_3D_WALK_SURFACES_REQUIRED');
  const walkSurfaces=await surfaceResponse.json();
  const missing = [...new Set(placements.map(p => p.fieldId))].filter(id => !specs.has(id));
  if (missing.length) throw Error(`RANCH_3D_MODELS_PENDING:${missing.join(',')}`);
  if (!field.productGrid || field.fold) throw Error('RANCH_3D_PRODUCT_GRID_REQUIRED');
  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:currentQualityTier()!=='saver', powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, currentQualityTier()==='saver'?1:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.shadowMap.enabled=currentQualityTier()!=='saver';
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const canvas=renderer.domElement;
  canvas.className='cm-ranch-three-canvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'0'});
  const pixi=stage.app.canvas, previousStyle={position:pixi.style.position,zIndex:pixi.style.zIndex};
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,600);
  camera.up.copy(up);
  scene.add(new THREE.HemisphereLight(0xdbeeff,0x6b7650,2));
  const sun=new THREE.DirectionalLight(0xffeed5,2.6);sun.castShadow=renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;
  sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=150;
  sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;
  scene.add(sun,sun.target);
  const models=new Map(), instances=[], textures=new Map(), sprites=new Map();
  const modelBitmaps=new Set();
  const lavaMaterials=new Set(), smokeNodes=[];
  let sceneClock=0;
  const textureCap=currentQualityTier()==='saver'?512:currentQualityTier()==='high'?2048:1024;
  let disposed=false, lost=false, width=0,height=0,frames=0, lastRenderMs=0;
  const loader=new GLTFLoader();
  const draco=new DRACOLoader().setDecoderPath('node_modules/three/examples/jsm/libs/draco/');
  loader.setDRACOLoader(draco);
  try {
    // Fetch through the view lifetime; GLTFLoader.load alone cannot abort.
    for(const id of new Set(placements.map(p=>p.fieldId))) {
      const spec=specs.get(id);
      if(!/^assets\/production\/cage\/three-20261021\/field_[a-z0-9_]+\.glb$/.test(spec.url)
        ||!/^[a-f0-9]{64}$/.test(spec.sha256)||!Number.isSafeInteger(spec.bytes))throw Error(`RANCH_3D_MODEL_SELECTION_INVALID:${id}`);
      const url=spec.url;
      const r=await fetch(url,{signal});if(!r.ok)throw Error(`RANCH_3D_MODEL_HTTP_${r.status}:${id}`);
      const bytes=await r.arrayBuffer();
      if(bytes.byteLength!==spec.bytes)throw Error(`RANCH_3D_MODEL_SIZE_MISMATCH:${id}`);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const hash=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
      if(hash!==spec.sha256)throw Error(`RANCH_3D_MODEL_HASH_MISMATCH:${id}`);
      const gltf=await loader.parseAsync(bytes,new URL('.',new URL(url,location.href)).href);
      models.set(id,gltf);signal?.throwIfAborted();
      // Keep full-resolution authoring exports on disk. Bound resident GPU
      // texture memory for the selected device tier before first upload.
      const maps=new Set();gltf.scene.traverse(o=>{for(const m of [].concat(o.material??[]))for(const v of Object.values(m))if(v?.isTexture&&v.image)maps.add(v);});
      const resized=new Map();
      for(const t of maps){
        const original=t.image;
        if(Math.max(original.width,original.height)>textureCap){
          if(!resized.has(original))resized.set(original,await createImageBitmap(original,{resizeWidth:textureCap,resizeHeight:textureCap,resizeQuality:'high'}));
          t.image=resized.get(original);t.needsUpdate=true;
        }
        if(t.image?.close)modelBitmaps.add(t.image);
      }
      for(const original of resized.keys())original.close?.();
      gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
        for(const m of [].concat(o.material)){m.transparent=false;m.alphaTest=.12;m.depthWrite=true;}
      }});
    }
    const unit=field.nativePixelWorldScale, wrap=field.wrapWidthPx/unit;

    // Detect compatible boundaries between same-theme adjacent placements to dissolve borders
    const taggedPlacements=placements.map((p,idx)=>({...p,ownerIndex:p.ownerIndex??idx}));
    let sharedEdges=[];
    try {
      const boundaries=ranchSharedBoundaries(taggedPlacements).filter(b=>b.compatible);
      sharedEdges=boundaries.map(b=>({
        left:b.left,right:b.right,
        a:ranchNativeToWorld(b.a[0],b.a[1]),
        b:ranchNativeToWorld(b.b[0],b.b[1])
      }));
    } catch(_){/* fall back to distinct bounded cages */}

    for(const p of taggedPlacements.filter(p=>p.fragmentOfSlot===undefined&&!p.foldCap)) {
      for(const shift of [-wrap,0,wrap]) {
        const object=models.get(p.fieldId).scene.clone(true);
        const point=ranchNativeToWorld(p.x/unit+shift,p.y/unit);
        object.position.set(point.x,point.y,point.z);scene.add(object);

        // Direction A: Hexagonal checkerboard layering for unplaced slots (field_cm29_01)
        const isLid=p.structuralRole==='LID'||p.fieldId==='field_cm29_01';
        if(isLid&&Number.isInteger(p.slotIndex)&&p.slotIndex>=0){
          const row=p.slotIndex<40?Math.floor(p.slotIndex/20)*2+p.slotIndex%2:4+Math.floor((p.slotIndex-40)/10);
          const col=p.slotIndex<40?Math.floor((p.slotIndex%20)/2):(p.slotIndex-40)%10;
          if((row+col)%2!==0){
            object.traverse(o=>{
              if(o.isMesh&&o.material){
                o.material=o.material.clone();
                o.material.color=new THREE.Color(1.30,1.38,1.52);
              }
            });
          }
        }

        // Dissolve outer rim joints, fascia and border lights between same-theme neighbors
        const myEdges=sharedEdges.filter(e=>e.left===p.ownerIndex||e.right===p.ownerIndex);
        if(myEdges.length>0){
          object.traverse(o=>{
            if(!o.name)return;
            const isBorder=o.name.includes('joint')||o.name.includes('fascia')||o.name.includes('rim-light');
            if(!isBorder)return;
            const wx=point.x+o.position.x, wz=point.z+o.position.z;
            for(const e of myEdges){
              const dx=e.b.x-e.a.x, dz=e.b.z-e.a.z, lenSq=dx*dx+dz*dz;
              const t=lenSq>0?Math.max(0,Math.min(1,((wx-e.a.x)*dx+(wz-e.a.z)*dz)/lenSq)):0;
              const dist=Math.hypot(wx-e.a.x-t*dx, wz-e.a.z-t*dz);
              if(dist<2.2){o.visible=false;break;}
            }
          });
        }

        // Collect dynamic lava materials and smoke nodes
        object.traverse(o=>{
          if(o.isMesh&&o.material){
            for(const m of [].concat(o.material)){
              if(m.emissiveMap&&(m.name?.includes('cm07')||m.name?.includes('terrain-pbr'))){
                m.emissiveMap.wrapS=THREE.RepeatWrapping;
                m.emissiveMap.wrapT=THREE.RepeatWrapping;
                m.emissiveMap.needsUpdate=true;
                lavaMaterials.add(m);
              }
            }
          }
          if(o.name&&o.name.startsWith('volcano-smoke')){
            smokeNodes.push({node:o,baseY:o.position.y,offset:smokeNodes.length*1.8});
          }
        });

        const clips=models.get(p.fieldId).animations;
        const mixer=clips.length?new THREE.AnimationMixer(object):null;
        if(mixer)for(const clip of clips)mixer.clipAction(clip).play();
        instances.push({object,p,shift,mixer});
      }
    }
    // Owner direction: navigation connections are invisible; original bridges and floors remain model geometry.
    signal?.throwIfAborted();
    Object.assign(pixi.style,{position:'relative',zIndex:'1'});pixi.parentElement.insertBefore(canvas,pixi);
  } catch(error) { dispose();throw error; }
  function contextLost(event){event.preventDefault();lost=true;}
  function contextRestored(){lost=false;}
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);

  function materialFor(pixiTexture) {
    if(!pixiTexture)return null;
    const source=pixiTexture.source, image=source?.resource;
    if(!image)return null;
    let entry=textures.get(source);
    if(!entry){
      const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;
      // Pixi's atlas UVs start at the top. ImageBitmap ignores WebGL's flipY,
      // so use unflipped upload + top-origin UVs for every source type.
      texture.flipY=false;
      texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
      const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.15,side:THREE.DoubleSide,toneMapped:false});
      entry={texture,material};textures.set(source,entry);
    }
    return entry.material;
  }
  function syncSprite(key, sprite, root, bounds, pixelScale) {
    if(!sprite || sprite.destroyed || !sprite.visible || !root.visible)return;
    const material=materialFor(sprite.texture);if(!material)return;
    let item=sprites.get(key);
    if(!item){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.quaternion.copy(camera.quaternion);scene.add(mesh);item={mesh,sprite};sprites.set(key,item);}
    item.seen=true;item.mesh.visible=true;item.mesh.material=material;item.sprite=sprite;
    // Pixi computes the same cell trim, native anchor, flip and animation frame
    // used by input/feedback. Convert its four displayed corners, not an atlas
    // rectangle guessed from a species size.
    // getBounds() uses the untrimmed original canvas. Pixi renders the trimmed
    // visualBounds quad; mapping the frame onto orig stretches packed sprites.
    const box=ranchSpriteScreenQuad(sprite);
    const foot=root.threeGroundScreen??root;
    const ground=ranchNativeToWorld((foot.x-bounds.x)/pixelScale,(foot.y-bounds.y)/pixelScale,(root.threeGroundHeight??0)+.035);
    const position=new THREE.Vector3(ground.x,ground.y,ground.z);
    position.addScaledVector(right,(box.x+box.width/2-root.x)/(16*pixelScale));
    position.addScaledVector(up,-(box.y+box.height/2-root.y)/(16*pixelScale));
    // Native sprite anchors can sit a few pixels above the bottom of the
    // visible feet. Move only along the orthographic view ray so the complete
    // quad clears its supporting floor without changing its screen position.
    const bottomY=position.y-box.height/(32*pixelScale)*up.y;
    position.addScaledVector(direction,Math.max(0,((root.threeGroundHeight??0)+.015-bottomY)/direction.y));
    item.mesh.position.copy(position);item.mesh.scale.set(box.width/(16*pixelScale),box.height/(16*pixelScale),1);
    item.mesh.quaternion.copy(camera.quaternion);
    const projected=position.clone().project(camera);
    item.projectionError=Math.hypot((projected.x+1)*width/2-box.x-box.width/2,(1-projected.y)*height/2-box.y-box.height/2+.035*Math.cos(RANCH_ELEVATION)*16*pixelScale);
    const u=sprite.texture.uvs,flip=sprite.scale.x*root.scale.x<0;
    const values=ranchSpriteUvs(u,flip);
    item.mesh.geometry.attributes.uv.array.set(values);item.mesh.geometry.attributes.uv.needsUpdate=true;
    sprite.renderable=false;
  }
  function render({bounds,actors,food,waste,covered=false,deltaMS=0}) {
    if(disposed||lost){for(const item of sprites.values())if(!item.sprite.destroyed)item.sprite.renderable=true;canvas.style.visibility='hidden';return false;}
    if(document.hidden)return true;
    canvas.style.visibility='';
    const start=performance.now(),screen=stage.app.screen;
    if(width!==screen.width||height!==screen.height){width=screen.width;height=screen.height;renderer.setSize(width,height);}
    const pixelScale=bounds.scale*field.nativePixelWorldScale;
    const center=ranchNativeToWorld((width/2-bounds.x)/pixelScale,(height/2-bounds.y)/pixelScale);
    camera.left=-width/(32*pixelScale);camera.right=-camera.left;camera.top=height/(32*pixelScale);camera.bottom=-camera.top;
    camera.position.set(center.x,center.y,center.z).addScaledVector(direction,200);
    camera.lookAt(center.x,center.y,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    sun.position.set(center.x-15,35,center.z+8);sun.target.position.set(center.x,0,center.z);
    for(const {object,p,shift,mixer} of instances){
      const x=bounds.x+(p.x/field.nativePixelWorldScale+shift)*pixelScale,y=bounds.y+p.y/field.nativePixelWorldScale*pixelScale;
      object.visible=x+p.worldWidthPx*bounds.scale>-80&&x<width+80&&y+p.worldHeightPx*bounds.scale>-80&&y<height+180;
      if(mixer&&object.visible&&!prefersReducedMotion())mixer.update(Math.min(50,Math.max(0,deltaMS))/1000);
    }
    const deltaSec=Math.min(50,Math.max(0,deltaMS))/1000;
    sceneClock+=deltaSec;
    if(!prefersReducedMotion()){
      for(const m of lavaMaterials){
        if(m.emissiveMap){
          m.emissiveMap.offset.x=(sceneClock*0.016)%1;
          m.emissiveMap.offset.y=(sceneClock*0.010)%1;
        }
        m.emissiveIntensity=1.15+0.35*Math.sin(sceneClock*2.2);
      }
      for(const s of smokeNodes){
        s.node.position.y=s.baseY+0.07*Math.sin(sceneClock*1.5+s.offset);
        s.node.rotation.y=(sceneClock*0.35+s.offset)%(Math.PI*2);
      }
    }
    for(const item of sprites.values())item.seen=false;
    for(const [id,entry] of actors){
      // Evolution is a screen-space presentation owned by the existing scene.
      if(covered||entry.evolutionActive){if(entry.sprite)entry.sprite.renderable=true;continue;}
      syncSprite(id,entry.sprite,entry.root,bounds,pixelScale);
    }
    for(const [id,root] of food??[])syncSprite('food:'+id,root.children?.[1],root,bounds,pixelScale);
    for(const [id,sprite] of waste??[])syncSprite('waste:'+id,sprite,sprite,bounds,pixelScale);
    for(const [key,item] of sprites){if(!item.seen){item.mesh.visible=false;if(item.sprite.destroyed){scene.remove(item.mesh);item.mesh.geometry.dispose();sprites.delete(key);}else item.sprite.renderable=true;}}
    const usedMaterials=new Set([...sprites.values()].map(item=>item.mesh.material));
    for(const [source,entry] of textures)if(!usedMaterials.has(entry.material)){
      entry.texture.dispose();entry.material.dispose();textures.delete(source);
    }
    renderer.render(scene,camera);frames++;lastRenderMs=performance.now()-start;
    canvas.dataset.frames=String(frames);canvas.dataset.drawCalls=String(renderer.info.render.calls);
    canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.actors=String([...sprites.values()].filter(i=>i.mesh.visible).length);
    canvas.dataset.actorProjectionError=String(Math.max(0,...[...sprites.values()].filter(i=>i.mesh.visible).map(i=>i.projectionError??0)));
    canvas.dataset.animatedInstances=String(instances.filter(i=>i.mixer&&i.object.visible).length);
    canvas.dataset.textureCount=String(renderer.info.memory.textures);
    canvas.dataset.passageAppearance='invisible';canvas.dataset.navigationConnections=String(connections.length);
    return true;
  }
  function dispose(){
    if(disposed)return;disposed=true;
    lavaMaterials.clear();smokeNodes.length=0;
    for(const {mesh,sprite} of sprites.values()){if(!sprite.destroyed)sprite.renderable=true;mesh.geometry.dispose();}
    for(const {texture,material} of textures.values()){texture.dispose();material.dispose();}
    for(const {object,mixer} of instances)if(mixer){mixer.stopAllAction();mixer.uncacheRoot(object);}
    const geometries=new Set(),materials=new Set(),maps=new Set();
    for(const gltf of models.values())gltf.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material??[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of maps)t.dispose();
    for(const bitmap of modelBitmaps)bitmap.close();modelBitmaps.clear();
    draco.dispose();
    renderer.dispose();renderer.forceContextLoss();canvas.remove();Object.assign(pixi.style,previousStyle);
    canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
  }
  function groundHeight(x,y){
    let height=0;const unit=field.nativePixelWorldScale;
    for(const {p,shift} of instances){
      const triangles=walkSurfaces[p.fieldId];if(!triangles)continue;
      height=Math.max(height,ranchSurfaceHeight(x-p.x/unit-shift,y-p.y/unit,triangles));
    }
    return height;
  }
  function pickGroundNative(point){
    let best={...point,height:0};const unit=field.nativePixelWorldScale;
    for(const {p,shift} of instances){
      const picked=ranchPickWalkSurface(point.x-p.x/unit-shift,point.y-p.y/unit,walkSurfaces[p.fieldId]);
      if(picked.height>best.height)best={...point,y:picked.y+p.y/unit,height:picked.height};
    }
    return {x:best.x,y:best.y};
  }
  return {render,dispose,groundHeight,pickGroundNative,getDiagnostics:()=>({mode:'TRUE_3D_FIXED_CAMERA_2D_ACTORS',passageAppearance:'invisible',navigationConnections:connections.length,frames,lastRenderMs,models:models.size,textureCap,animatedInstances:instances.filter(i=>i.mixer).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},lost})};
}
