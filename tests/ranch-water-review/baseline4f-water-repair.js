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
const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);

const WATER_FIELDS = new Set(['field_cm04_01', 'field_cm05_01', 'field_cm10_01', 'field_cm09_01', 'field_cm19_01', 'field_cm39_01']);
const FOREST_FIELDS = new Set(['field_cm01_01', 'field_cm03_01', 'field_cm14_01', 'field_cm08_01', 'field_cm11_01', 'field_cm12_01', 'field_cm18_01', 'field_cm32_01']);
const ICE_FIELDS = new Set(['field_cm06_01', 'field_cm16_01', 'field_cm21_01']);
const INDUSTRIAL_FIELDS = new Set(['field_cm17_01', 'field_cm20_01', 'field_cm25_01', 'field_cm15_01', 'field_cm22_01']);

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
  const lavaMaterials=new Set(), dynamicShaders=new Set(), smokeNodes=[];
  const dynamicParticles=[], dynamicMachines=[], dynamicBeacons=[];
  let sceneClock=0;
  const textureCap=currentQualityTier()==='saver'?512:currentQualityTier()==='high'?2048:1024;
  let disposed=false, lost=false, width=0,height=0,frames=0, lastRenderMs=0;
  const loader=new GLTFLoader();
  const draco=new DRACOLoader().setDecoderPath('node_modules/three/examples/jsm/libs/draco/');
  loader.setDRACOLoader(draco);

  function createParticleSystem({count,color,size,opacity,initParticle,updateParticle}){
    const geo=new THREE.BufferGeometry();
    const positions=new Float32Array(count*3);
    const pdata=[];
    for(let i=0;i<count;i++){
      const p=initParticle(i);
      pdata.push(p);
      positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z;
    }
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color,size,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
    const points=new THREE.Points(geo,mat);
    return {points,geo,mat,
      update(dt,t){
        const arr=geo.attributes.position.array;
        for(let i=0;i<count;i++){
          updateParticle(pdata[i],dt,t,i);
          arr[i*3]=pdata[i].x;arr[i*3+1]=pdata[i].y;arr[i*3+2]=pdata[i].z;
        }
        geo.attributes.position.needsUpdate=true;
      },
      dispose(){geo.dispose();mat.dispose();}
    };
  }
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

        // Bounding box for local centers
        const bBox=new THREE.Box3().setFromObject(object);
        const lCenter=bBox.getCenter(new THREE.Vector3()).sub(object.position);
        const lMaxY=bBox.max.y-object.position.y;

        // Dynamic Suite: Shaders
        object.traverse(o=>{
          if(o.isMesh&&o.material){
            for(const m of [].concat(o.material)){
              // Volcano (field_cm07_01): Internal fluid lava churning & heat pulsing
              if(p.fieldId==='field_cm07_01'||m.name?.includes('cm07')||m.name?.includes('terrain-pbr')){
                lavaMaterials.add(m);
                if(!m.userData.lavaHooked){
                  m.userData.lavaHooked=true;
                  m.onBeforeCompile=(shader)=>{
                    shader.uniforms.uLavaTime={value:0};
                    m.userData.shader=shader;
                    shader.fragmentShader='uniform float uLavaTime;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace(
                      '#include <emissivemap_fragment>',
                      `#include <emissivemap_fragment>
                      #ifdef USE_EMISSIVEMAP
                        float lavaMask=clamp(totalEmissiveRadiance.r*1.5,0.0,1.0);
                        if(lavaMask>0.02){
                          vec2 flow1=vEmissiveMapUv*14.0+vec2(uLavaTime*0.14,uLavaTime*0.08);
                          vec2 flow2=vEmissiveMapUv*22.0-vec2(uLavaTime*0.10,uLavaTime*0.15);
                          float fluid=0.5+0.25*(sin(flow1.x+sin(flow1.y))+cos(flow2.x-cos(flow2.y)));
                          float pulse=0.9+0.22*sin(uLavaTime*2.4);
                          vec3 magmaHot=vec3(1.3,1.15,0.45);
                          vec3 magmaDeep=vec3(1.0,0.35,0.08);
                          vec3 fluidHeat=mix(magmaDeep,magmaHot,fluid)*pulse;
                          totalEmissiveRadiance*=fluidHeat;
                        }
                      #endif`
                    );
                  };
                  m.needsUpdate=true;
                }
              }

              // Water / Waterfall (CM04, CM05, CM10)
              if(WATER_FIELDS.has(p.fieldId)){
                dynamicShaders.add(m);
                if(!m.userData.waterHooked){
                  m.userData.waterHooked=true;
                  m.onBeforeCompile=(shader)=>{
                    shader.uniforms.uWaterTime={value:0};
                    m.userData.shader=shader;
                    shader.vertexShader='varying vec2 vRanchWaterUv;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',
                      '#include <uv_vertex>\nvRanchWaterUv=uv;');
                    shader.fragmentShader='uniform float uWaterTime;\nvarying vec2 vRanchWaterUv;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace(
                      '#include <roughnessmap_fragment>',
                      `#include <roughnessmap_fragment>
                      vec2 wUv1=vRanchWaterUv*26.0+vec2(uWaterTime*0.40,uWaterTime*0.20);
                      vec2 wUv2=vRanchWaterUv*36.0-vec2(uWaterTime*0.25,uWaterTime*0.45);
                      float ripple=sin(wUv1.x+sin(wUv1.y))*cos(wUv2.y-cos(wUv2.x));
                      float glint=pow(max(0.0,0.5+0.5*ripple),6.0)*0.35;
                      float flow=sin(vRanchWaterUv.y*45.0-uWaterTime*3.2)*0.08;
                      diffuseColor.rgb+=vec3(0.05,0.12,0.18)*glint+vec3(0.04,0.08,0.12)*max(0.0,flow);`
                    );
                  };
                  m.needsUpdate=true;
                }
              }

              // Forest / Grassland Wind Sway (CM01, CM03, CM14)
              if(FOREST_FIELDS.has(p.fieldId)){
                dynamicShaders.add(m);
                if(!m.userData.windHooked){
                  m.userData.windHooked=true;
                  m.onBeforeCompile=(shader)=>{
                    shader.uniforms.uWindTime={value:0};
                    m.userData.shader=shader;
                    shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace(
                      '#include <begin_vertex>',
                      `#include <begin_vertex>
                      float windElev=max(0.0,position.y-0.35);
                      if(windElev>0.0){
                        float flex=windElev*windElev*0.022;
                        float sway=sin(uWindTime*2.2+position.x*0.7+position.z*0.7);
                        float cross=cos(uWindTime*1.6+position.z*0.9);
                        transformed.x+=(sway*0.6+cross*0.4)*flex;
                        transformed.z+=(sway*0.4+cross*0.6)*flex;
                        transformed.y-=abs(sway)*flex*0.12;
                      }`
                    );
                  };
                  m.needsUpdate=true;
                }
              }

              // Snow / Ice Fresnel Shimmer (CM06, CM16)
              if(ICE_FIELDS.has(p.fieldId)){
                dynamicShaders.add(m);
                if(!m.userData.iceHooked){
                  m.userData.iceHooked=true;
                  m.onBeforeCompile=(shader)=>{
                    shader.uniforms.uIceTime={value:0};
                    m.userData.shader=shader;
                    shader.fragmentShader='uniform float uIceTime;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace(
                      '#include <roughnessmap_fragment>',
                      `#include <roughnessmap_fragment>
                      float fresnel=pow(1.0-max(0.0,dot(geometryNormal,geometryViewDir)),2.8);
                      float shimmer=sin(uIceTime*3.5+vUv.x*65.0)*cos(uIceTime*2.8+vUv.y*65.0);
                      float iceBreath=0.5+0.5*sin(uIceTime*1.8);
                      diffuseColor.rgb+=vec3(0.08,0.16,0.25)*fresnel*(0.7+0.3*iceBreath+0.25*max(0.0,shimmer));
                      roughnessFactor=clamp(roughnessFactor*(0.85+0.15*iceBreath),0.1,1.0);`
                    );
                  };
                  m.needsUpdate=true;
                }
              }
            }
          }
          if(o.name&&o.name.startsWith('volcano-smoke')){
            smokeNodes.push({node:o,baseY:o.position.y,offset:smokeNodes.length*1.8});
          }
        });

        // Dynamic Suite: Particles and Machinery
        if(currentQualityTier()!=='saver'){
          if(WATER_FIELDS.has(p.fieldId)){
            const ps=createParticleSystem({
              count:24,color:0xc0e8ff,size:0.14,opacity:0.75,
              initParticle:()=>({
                x:lCenter.x+(Math.random()-0.5)*5.0,
                y:0.1+Math.random()*0.1,
                z:lCenter.z+(Math.random()-0.5)*5.0,
                vx:(Math.random()-0.5)*0.4,
                vy:0.5+Math.random()*0.6,
                vz:(Math.random()-0.5)*0.4,
                life:0.4+Math.random()*0.6
              }),
              updateParticle:(pt,dt)=>{
                pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.z+=pt.vz*dt;pt.vy-=1.8*dt;pt.life-=dt;
                if(pt.life<=0||pt.y<0.05){
                  pt.x=lCenter.x+(Math.random()-0.5)*5.0;pt.y=0.1;pt.z=lCenter.z+(Math.random()-0.5)*5.0;
                  pt.vx=(Math.random()-0.5)*0.4;pt.vy=0.5+Math.random()*0.6;pt.vz=(Math.random()-0.5)*0.4;
                  pt.life=0.4+Math.random()*0.6;
                }
              }
            });
            object.add(ps.points);dynamicParticles.push(ps);
          }

          if(ICE_FIELDS.has(p.fieldId)){
            const ps=createParticleSystem({
              count:20,color:0xd0f2ff,size:0.18,opacity:0.45,
              initParticle:(i)=>({
                x:lCenter.x+(Math.random()-0.5)*6.0,
                y:0.1+Math.random()*0.5,
                z:lCenter.z+(Math.random()-0.5)*6.0,
                life:1.0+Math.random()*1.5,
                seed:i*1.3
              }),
              updateParticle:(pt,dt,t)=>{
                pt.y+=0.18*dt;pt.x+=Math.sin(t*1.5+pt.seed)*0.08*dt;pt.z+=Math.cos(t*1.2+pt.seed)*0.08*dt;pt.life-=dt;
                if(pt.life<=0||pt.y>1.4){
                  pt.x=lCenter.x+(Math.random()-0.5)*6.0;pt.y=0.1;pt.z=lCenter.z+(Math.random()-0.5)*6.0;
                  pt.life=1.0+Math.random()*1.5;
                }
              }
            });
            object.add(ps.points);dynamicParticles.push(ps);
          }

          if(INDUSTRIAL_FIELDS.has(p.fieldId)){
            const chimX=lCenter.x-1.2, chimY=Math.max(1.8,lMaxY), chimZ=lCenter.z+0.8;
            const ps=createParticleSystem({
              count:20,color:0x788088,size:0.22,opacity:0.45,
              initParticle:(i)=>({
                x:chimX+(Math.random()-0.5)*0.2,
                y:chimY+Math.random()*0.3,
                z:chimZ+(Math.random()-0.5)*0.2,
                life:1.2+Math.random()*0.8,
                seed:i*1.1
              }),
              updateParticle:(pt,dt,t)=>{
                pt.y+=0.45*dt;pt.x+=Math.sin(t*2.0+pt.seed)*0.1*dt;pt.z+=Math.cos(t*1.8+pt.seed)*0.1*dt;pt.life-=dt;
                if(pt.life<=0){
                  pt.x=chimX+(Math.random()-0.5)*0.2;pt.y=chimY;pt.z=chimZ+(Math.random()-0.5)*0.2;
                  pt.life=1.2+Math.random()*0.8;
                }
              }
            });
            object.add(ps.points);dynamicParticles.push(ps);

            const gearGeo=new THREE.CylinderGeometry(0.32,0.32,0.06,10);
            const gearMat=new THREE.MeshStandardMaterial({color:0x5a626a,metalness:0.85,roughness:0.35});
            const gear=new THREE.Mesh(gearGeo,gearMat);
            gear.position.set(lCenter.x-0.6,Math.max(1.0,lMaxY*0.5),lCenter.z-0.5);
            gear.rotation.x=Math.PI/2;
            object.add(gear);dynamicMachines.push(gear);

            const beaconGeo=new THREE.SphereGeometry(0.08,8,8);
            const beaconMat=new THREE.MeshStandardMaterial({color:0x221100,emissive:0xff3300,emissiveIntensity:2.0});
            const beacon=new THREE.Mesh(beaconGeo,beaconMat);
            beacon.position.set(chimX,chimY+0.12,chimZ);
            object.add(beacon);dynamicBeacons.push(beacon);
          }
        }

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
    if(!item){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      mesh.quaternion.copy(rotY);
      scene.add(mesh);
      item={mesh,sprite};
      sprites.set(key,item);
    }
    item.seen=true;item.mesh.visible=true;item.mesh.material=material;item.sprite=sprite;
    const box=ranchSpriteScreenQuad(sprite);
    const foot=root.threeGroundScreen??root;
    const groundHeight=root.threeGroundHeight??0;
    const ground=ranchNativeToWorld((foot.x-bounds.x)/pixelScale,(foot.y-bounds.y)/pixelScale,groundHeight);

    const worldW=box.width/(16*pixelScale);
    const worldH=(box.height/(16*pixelScale))/Math.cos(RANCH_ELEVATION);
    const dx=(box.x+box.width/2-root.x)/(16*pixelScale);
    // Align base of sprite with foot anchor; ensure it sits slightly above floor to prevent z-fighting
    const y_bottom=groundHeight+0.015+(root.y-(box.y+box.height))/(16*pixelScale*Math.cos(RANCH_ELEVATION));

    item.mesh.scale.set(worldW,worldH,1);
    item.mesh.position.set(ground.x+right.x*dx, y_bottom+worldH/2, ground.z+right.z*dx);
    item.mesh.quaternion.copy(rotY);

    const projected=item.mesh.position.clone().project(camera);
    item.projectionError=Math.hypot((projected.x+1)*width/2-box.x-box.width/2,(1-projected.y)*height/2-box.y-box.height/2);
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
        if(m.userData.shader)m.userData.shader.uniforms.uLavaTime.value=sceneClock;
        m.emissiveIntensity=1.15+0.25*Math.sin(sceneClock*2.2);
      }
      for(const m of dynamicShaders){
        if(m.userData.shader){
          if(m.userData.shader.uniforms.uWaterTime)m.userData.shader.uniforms.uWaterTime.value=sceneClock;
          if(m.userData.shader.uniforms.uWindTime)m.userData.shader.uniforms.uWindTime.value=sceneClock;
          if(m.userData.shader.uniforms.uIceTime)m.userData.shader.uniforms.uIceTime.value=sceneClock;
        }
      }
      for(const ps of dynamicParticles)ps.update(deltaSec,sceneClock);
      for(const g of dynamicMachines)g.rotation.z+=deltaSec*1.8;
      for(const b of dynamicBeacons)b.material.emissiveIntensity=Math.sin(sceneClock*8.0)>0.35?3.0:0.2;
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
    lavaMaterials.clear();dynamicShaders.clear();smokeNodes.length=0;
    for(const ps of dynamicParticles)ps.dispose();dynamicParticles.length=0;
    for(const g of dynamicMachines){g.geometry.dispose();g.material.dispose();}dynamicMachines.length=0;
    for(const b of dynamicBeacons){b.geometry.dispose();b.material.dispose();}dynamicBeacons.length=0;
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
