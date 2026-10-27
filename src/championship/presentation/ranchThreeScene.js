// Fixed-camera terrain, actors and contact shadows share one depth buffer.
import {createRanchGroundShadows} from './ranchGroundShadows.js';
import {createCm07Ambient} from './cm07Ambient.js';
import {loadSupportMetadata,validateSupportGeometry,eligibleSupportOwner,encodeProjectedTriangle,projectedTriangleTouchesBox,SUPPORT_MAX_TRIANGLES} from './ranchPhysicalSupport.js';
import {CONTACT_HEIGHT_FIELDS,transformContactTriangles,contactHeightAtPoint,loadLogicalBridges,logicalContactHeightAtPoint,projectedContactIntersections,canonicalContactNativeCoordinate} from './ranchContactHeight.js';
import {createRanchSupportOwnerResolver} from './ranchSupportOwner.js';
import {createRanchPlinth} from './ranchPlinth.js';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../../node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { ranchNativeToWorld, ranchSurfaceHeight, ranchPickWalkSurface, ranchSpriteScreenQuad, ranchSpriteUvs, RANCH_LAYOUT_VIEW } from './ranchThreeCoordinates.js';
import { cappedPixelRatio, currentQualityTier, isMobileOrStandaloneEnvironment, prefersReducedMotion } from './presentationPreferences.js';
import { ranchSharedBoundaries } from '../cage/ranchConnections.js';
import { ranchBorderWithinSharedSegments } from './ranchBorderMembership.js';

const MANIFEST = 'assets/production/cage/three-20261021/manifest.json';
const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);

const WATER_FIELDS = new Set();
const FOREST_FIELDS = new Set(['field_cm01_01', 'field_cm14_01', 'field_cm08_01', 'field_cm11_01', 'field_cm12_01', 'field_cm18_01']);
const ICE_FIELDS = new Set(['field_cm21_01']);
const INDUSTRIAL_FIELDS = new Set();

/** Bounded rendering adapter, driven only by the existing Pixi scene ticker.
 * The native simulation, pointer targets, camera pan/zoom and save stay owned
 * by the existing presenter. No requestAnimationFrame or new game authority.
 */
export async function createRanchThreeScene({ stage, placements, field, signal,connections=null,cagePlacements=[],supportAudit=null }) {
  const supportFieldIds=new Set(['field_cm02_01','field_cm09_01','field_cm19_01','field_cm21_01','field_cm35_01','field_cm39_01','field_cm18_01','field_cm34_01']);
  if(!supportAudit&&placements.some(p=>supportFieldIds.has(p.fieldId))){
    const supportResponse=await fetch('assets/production/cage/three-20261021/physical-ground-tops.r2.json',{signal});
    if(!supportResponse.ok)throw Error('RANCH_SUPPORT_METADATA_HTTP');
    supportAudit={metadataText:await supportResponse.text()};
  }
  const supportFields=supportAudit?await loadSupportMetadata(supportAudit.metadataText):new Map();
  let logicalBridges=[];
  if(placements.some(p=>p.fieldId==='field_cm18_01')){
    let logicalText=supportAudit?.logicalBridgeText;
    if(logicalText==null){const response=await fetch('assets/production/cage/three-20261021/logical-stair-bridges.r1.json',{signal});if(!response.ok)throw Error('RANCH_LOGICAL_BRIDGES_HTTP');logicalText=await response.text();}
    logicalBridges=await loadLogicalBridges(logicalText,supportFields);
  }
  const verifiedSupport=new Map(),supportPlacements=[];
  let supportOwnerResolver=null;
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
  renderer.setPixelRatio(cappedPixelRatio(currentQualityTier()==='saver'?1:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.shadowMap.enabled=currentQualityTier()!=='saver';
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const canvas=renderer.domElement;
  canvas.className='cm-ranch-three-canvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'0'});
  const pixi=stage.app.canvas, previousStyle={position:pixi.style.position,zIndex:pixi.style.zIndex};
  // The camera pitch is the field's view; the world stays on the 52-degree layout.
  const view=field.view??RANCH_LAYOUT_VIEW,groundY=view.groundScaleY;
  const up=new THREE.Vector3(...view.up),direction=new THREE.Vector3(...view.direction);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,600);
  camera.up.copy(up);
  // Owner 2026-10-27 HD-2D: a warm key light and a cool blue-violet fill under
  // it, so lit faces and shaded sides of rock, trees and buildings separate.
  scene.add(new THREE.HemisphereLight(0xd8e8ff,0x3e4270,1.8));
  const sun=new THREE.DirectionalLight(0xffe2b4,2.95);sun.castShadow=renderer.shadowMap.enabled;
  const shadowMapDim=(currentQualityTier()==='high'&&!isMobileOrStandaloneEnvironment())?2048:1024;
  sun.shadow.mapSize.set(shadowMapDim,shadowMapDim);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;
  sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=150;
  sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;
  scene.add(sun,sun.target);
  const models=new Map(), instances=[], textures=new Map(), sprites=new Map();
  const groundShadows=createRanchGroundShadows(scene);
  const modelBitmaps=new Set();
  const lavaMaterials=new Set(), dynamicShaders=new Set(), smokeNodes=[];
  const authoredDepthMaterials=new Set();
  let cm07Ambient=null,plinth=null;
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
      if(supportFields.has(id)){
        const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
        verifiedSupport.set(id,await validateSupportGeometry(supportFields.get(id),hash,meshes));
      }
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
    // The hex cage world does not wrap: one copy of each cage (wrapWidthPx null).
    const unit=field.nativePixelWorldScale, wrap=field.wrapWidthPx?field.wrapWidthPx/unit:null;

    // Detect compatible boundaries between same-theme adjacent placements to dissolve borders
    const taggedPlacements=placements.map((p,idx)=>({...p,ownerIndex:p.ownerIndex??idx}));
    supportPlacements.push(...taggedPlacements.filter(p=>p.fragmentOfSlot===undefined&&!p.foldCap));
    let sharedEdges=[],passageEdges={open:[],closed:[]};
    // Owner 2026-10-27: border art opens only where the walk rule opened a
    // passage (same ecology, same height, safe exits on both sides). Without
    // a navigation frame (tutorial baseline) the compatible edges open as before.
    const passageIds=Array.isArray(connections)?new Set(connections.map(c=>c.id)):null;
    try {
      const all=ranchSharedBoundaries(taggedPlacements);
      const isOpen=b=>passageIds?passageIds.has(b.id):b.compatible;
      passageEdges={open:all.filter(isOpen).map(b=>({a:b.a,b:b.b})),closed:all.filter(b=>!isOpen(b)).map(b=>({a:b.a,b:b.b}))};
      const boundaries=all.filter(isOpen);
      sharedEdges=boundaries.map(b=>({
        left:b.left,right:b.right,
        a:ranchNativeToWorld(b.a[0],b.a[1]),
        b:ranchNativeToWorld(b.b[0],b.b[1])
      }));
    } catch(_){/* fall back to distinct bounded cages */}

    // Owner 2026-10-27 diorama plinth: below the walk plane, GLBs untouched.
    if(!wrap){plinth=createRanchPlinth({placements:taggedPlacements,towardSun:[-15,35,8],passages:passageEdges});scene.add(plinth.group);}
    for(const p of taggedPlacements.filter(p=>p.fragmentOfSlot===undefined&&!p.foldCap)) {
      for(const shift of wrap?[-wrap,0,wrap]:[0]) {
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

        // Remove only complete authored strips on compatible shared boundaries.
        // Classify in unwrapped placement-local coordinates: all wrap copies agree.
        const myEdges=sharedEdges.filter(e=>e.left===p.ownerIndex||e.right===p.ownerIndex);
        if(myEdges.length>0){
          const unwrapped=ranchNativeToWorld(p.x/unit,p.y/unit);
          const localEdges=myEdges.map(e=>({
            a:{x:e.a.x-unwrapped.x,z:e.a.z-unwrapped.z},
            b:{x:e.b.x-unwrapped.x,z:e.b.z-unwrapped.z}
          }));
          object.updateMatrixWorld(true);
          object.traverse(o=>{
            if(!o.isMesh||!o.geometry||!o.name)return;
            const isBorder=o.name.includes('joint')||o.name.includes('fascia')||o.name.includes('rim-light');
            if(!isBorder)return;
            if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
            const box=o.geometry.boundingBox;if(!box||box.isEmpty())return;
            const corners=[];
            for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
              // Full child hierarchy transforms, not point + child.position.
              const v=object.worldToLocal(o.localToWorld(new THREE.Vector3(x,y,z)));
              corners.push({x:v.x,z:v.z});
            }
            if(ranchBorderWithinSharedSegments(corners,localEdges))o.visible=false;
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
              if(p.fieldId!=='field_cm07_01'&&(m.name?.includes('cm07')||m.name?.includes('terrain-pbr'))){
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

              // CM19: preserve the atlas and support surface; only authored water
              // vertices receive ripples. Positive phase on Y travels downward.
              if(p.fieldId==='field_cm19_01'&&o.geometry.getAttribute('_water_mask')){
                dynamicShaders.add(m);
                if(!m.userData.springWaterHooked){
                  m.userData.springWaterHooked=true;
                  m.onBeforeCompile=shader=>{
                    shader.uniforms.uWaterTime={value:0};m.userData.shader=shader;
                    shader.vertexShader='attribute float _water_mask;\nvarying float vSpringWater;\nvarying vec3 vSpringPosition;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSpringWater=_water_mask;vSpringPosition=position;');
                    shader.fragmentShader='uniform float uWaterTime;\nvarying float vSpringWater;\nvarying vec3 vSpringPosition;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
                      if(vSpringWater>0.5){
                        float ripple=sin(vSpringPosition.x*16.0+uWaterTime*0.7)*cos(vSpringPosition.z*13.0-uWaterTime*0.45);
                        float glint=pow(max(0.0,ripple),8.0)*0.07;
                        if(vSpringWater>1.5&&vSpringWater<2.5)glint=0.035+0.035*sin(vSpringPosition.y*20.0+uWaterTime*2.0);
                        if(vSpringWater>2.5)glint=0.03+0.02*sin(uWaterTime*2.4+vSpringPosition.x*8.0);
                        diffuseColor.rgb+=vec3(0.35,0.65,0.7)*glint;
                      }`);
                  };
                  m.customProgramCacheKey=()=> 'cm19-authored-water-r1';m.needsUpdate=true;
                }
              }

              // Existing instrument displays / culture tanks only. A zero mask
              // keeps floors and rigid equipment completely outside this effect.
              if(['field_cm03_01','field_cm05_01','field_cm06_01','field_cm13_01','field_cm15_01','field_cm17_01','field_cm20_01','field_cm22_01','field_cm23_01','field_cm24_01','field_cm27_01','field_cm28_01','field_cm29_01','field_cm40_01'].includes(p.fieldId)&&o.geometry.getAttribute('_ambient_mask')){
                dynamicShaders.add(m);
                if(!m.userData.instrumentAmbientHooked){
                  m.userData.instrumentAmbientHooked=true;
                  m.onBeforeCompile=shader=>{
                    shader.uniforms.uAmbientTime={value:0};m.userData.shader=shader;
                    shader.vertexShader='uniform float uAmbientTime;\nattribute float _ambient_mask;\nvarying float vAmbientMask;\nvarying vec3 vAmbientPosition;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
                      vAmbientMask=_ambient_mask;vAmbientPosition=position;
                      if(_ambient_mask>2.5&&_ambient_mask<3.5)transformed.y+=sin(uAmbientTime*0.75+position.y*2.0)*0.055;`);
                    // Rounded desert rocks need a small receiver offset to avoid
                    // self-shadow bands; the support plane and its shadows stay fixed.
                    if(p.fieldId==='field_cm20_01')shader.vertexShader=shader.vertexShader.replace('#include <shadowmap_vertex>',`#include <shadowmap_vertex>
                      #if NUM_DIR_LIGHT_SHADOWS > 0
                        if(position.y>0.05)vDirectionalShadowCoord[0].z-=0.0009*vDirectionalShadowCoord[0].w;
                      #endif`);
                    shader.fragmentShader='uniform float uAmbientTime;\nvarying float vAmbientMask;\nvarying vec3 vAmbientPosition;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
                      if(vAmbientMask>0.5&&vAmbientMask<1.5){
                        float idle=0.05+0.035*sin(uAmbientTime*0.9+vAmbientPosition.x*0.6);
                        totalEmissiveRadiance+=diffuseColor.rgb*idle;
                      }else if(vAmbientMask>1.5&&vAmbientMask<2.5){
                        totalEmissiveRadiance+=diffuseColor.rgb*(0.025+0.012*sin(uAmbientTime*0.6+vAmbientPosition.y*2.0));
                      }else if(vAmbientMask>8.5){
                        float sheen=pow(max(0.0,sin(vAmbientPosition.x*0.7+vAmbientPosition.z*0.45-uAmbientTime*0.18)),24.0);
                        float sheenPatch=pow(max(0.0,cos(vAmbientPosition.z*0.6-vAmbientPosition.x*0.2)),8.0);
                        totalEmissiveRadiance+=diffuseColor.rgb*sheen*sheenPatch*0.035;
                      }else if(vAmbientMask>7.5){
                        vec2 sandUv=vec2(vAmbientPosition.x-uAmbientTime*0.065,vAmbientPosition.z)*vec2(22.0,95.0);
                        vec2 sandCell=floor(sandUv);
                        float seed=fract(sin(dot(sandCell,vec2(127.1,311.7)))*43758.5453);
                        float grain=smoothstep(0.985,1.0,seed)*(1.0-smoothstep(0.1,0.45,abs(fract(sandUv.y)-0.5)));
                        float gust=pow(max(0.0,sin(vAmbientPosition.x*0.7+vAmbientPosition.z*1.3-uAmbientTime*0.22)),6.0);
                        totalEmissiveRadiance+=diffuseColor.rgb*grain*gust*0.08;
                      }else if(vAmbientMask>6.5){
                        float ripple=sin(vAmbientPosition.x*16.0+uAmbientTime*0.7)*cos(vAmbientPosition.z*13.0-uAmbientTime*0.45);
                        totalEmissiveRadiance+=vec3(0.025,0.04,0.045)*pow(max(0.0,ripple),8.0);
                      }else if(vAmbientMask>5.5){
                        float lavaFlow=0.5+0.5*sin(vAmbientPosition.x*4.0+vAmbientPosition.z*6.0-uAmbientTime*0.45);
                        if(diffuseColor.r>diffuseColor.g*1.6&&diffuseColor.r>diffuseColor.b*3.0)totalEmissiveRadiance+=diffuseColor.rgb*(0.12+0.035*lavaFlow);
                      }else if(vAmbientMask>4.5){
                        float arc=0.12+0.06*sin(uAmbientTime*4.0+vAmbientPosition.y*2.0);
                        totalEmissiveRadiance+=diffuseColor.rgb*arc;
                      }else if(vAmbientMask>3.5){
                        float flame=0.65+0.08*sin(uAmbientTime*3.4+vAmbientPosition.x)+0.04*sin(uAmbientTime*6.1);
                        totalEmissiveRadiance+=diffuseColor.rgb*flame;
                      }`);
                  };
                  m.customProgramCacheKey=()=>p.fieldId==='field_cm20_01'?'authored-instrument-ambient-r4-sand':'authored-instrument-ambient-r4';m.needsUpdate=true;
                }
              }

              // Authored plant weights keep merged scenery rigid outside vegetation.
              if(['field_cm02_01','field_cm04_01','field_cm08_01','field_cm09_01','field_cm10_01','field_cm11_01','field_cm12_01','field_cm14_01','field_cm16_01','field_cm18_01','field_cm25_01','field_cm26_01','field_cm30_01','field_cm31_01','field_cm32_01','field_cm34_01','field_cm39_01'].includes(p.fieldId)&&o.geometry.getAttribute('_wind_weight')){
                dynamicShaders.add(m);
                if(!m.userData.rootedWindHooked){
                  m.userData.rootedWindHooked=true;
                  m.userData.rootedWindTime={value:0};
                  m.onBeforeCompile=shader=>{
                    shader.uniforms.uWindTime=m.userData.rootedWindTime;m.userData.shader=shader;
                    shader.vertexShader='uniform float uWindTime;\nattribute float _wind_weight;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
                      float flex=clamp(_wind_weight,0.0,1.0)*0.018;
                      transformed.x+=sin(uWindTime*1.5+position.x*0.8+position.z*0.4)*flex;
                      transformed.z+=cos(uWindTime*1.1+position.z*0.7)*flex*0.6;`);
                    if(['field_cm09_01','field_cm25_01','field_cm26_01','field_cm39_01'].includes(p.fieldId)){
                      shader.vertexShader='attribute float _coast_water;\nvarying float vCoastWater;\nvarying vec3 vCoastPosition;\n'+shader.vertexShader;
                      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoastWater=_coast_water;vCoastPosition=position;');
                      shader.fragmentShader='uniform float uWindTime;\nvarying float vCoastWater;\nvarying vec3 vCoastPosition;\n'+shader.fragmentShader;
                      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
                        if(vCoastWater>0.5&&diffuseColor.b>diffuseColor.r*1.2){
                          float wave=sin(vCoastPosition.x*12.0+vCoastPosition.z*8.0+sin(vCoastPosition.z*3.0)-uWindTime*1.1);
                          float crossWave=sin(vCoastPosition.x*4.0-vCoastPosition.z*6.0-uWindTime*0.7);
                          float glint=pow(max(0.0,wave),9.0)*(0.5+0.5*crossWave);
                          diffuseColor.rgb+=vec3(0.015,0.025,0.03)*glint;
                          roughnessFactor=clamp(roughnessFactor+wave*0.025,0.25,1.0);
                        }`);
                    }
                  };
                  m.customProgramCacheKey=()=>['field_cm09_01','field_cm25_01','field_cm26_01','field_cm39_01'].includes(p.fieldId)?'authored-rooted-water-r1':'cm02-rooted-canopy-r1';m.needsUpdate=true;
                }
                // Thin coplanar ground sheets receive prop shadows but do not
                // cast shadows onto one another. Preserve the actual geometry.
                const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
                depth.onBeforeCompile=shader=>{
                  shader.uniforms.uWindTime=m.userData.rootedWindTime;
                  shader.vertexShader='uniform float uWindTime;\nattribute float _wind_weight;\nvarying float vAuthoredHeight;\n'+shader.vertexShader;
                  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
                    vAuthoredHeight=position.y;
                    float flex=clamp(_wind_weight,0.0,1.0)*0.018;
                    transformed.x+=sin(uWindTime*1.5+position.x*0.8+position.z*0.4)*flex;
                    transformed.z+=cos(uWindTime*1.1+position.z*0.7)*flex*0.6;`);
                  shader.fragmentShader='varying float vAuthoredHeight;\n'+shader.fragmentShader;
                  shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nif(vAuthoredHeight<0.05)discard;');
                };
                depth.customProgramCacheKey=()=> 'cm02-authored-prop-depth-r1';
                o.customDepthMaterial=depth;authoredDepthMaterials.add(depth);
              }

              // Forest / Grassland Wind Sway (CM01, CM03, CM14)
              if(FOREST_FIELDS.has(p.fieldId)&&!['field_cm08_01','field_cm11_01','field_cm12_01','field_cm14_01','field_cm18_01'].includes(p.fieldId)&&(p.fieldId!=='field_cm01_01'
                ||o.name==='field_cm01_01-canopy'||o.name==='field_cm01_01-grass')){
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
                      float windElev=max(0.0,position.y-${p.fieldId==='field_cm01_01'?(o.name==='field_cm01_01-canopy'?'1.2':'0.0'):'0.35'});
                      if(windElev>0.0){
                        float flex=${p.fieldId==='field_cm01_01'?'min(0.018,windElev*windElev*0.018)':'windElev*windElev*0.022'};
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
                    shader.vertexShader='varying vec2 vRanchIceUv;\n'+shader.vertexShader;
                    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',
                      '#include <uv_vertex>\nvRanchIceUv=uv;');
                    shader.fragmentShader='uniform float uIceTime;\nvarying vec2 vRanchIceUv;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace(
                      '#include <normal_fragment_maps>',
                      `#include <normal_fragment_maps>
                      vec3 ranchIceViewDir=isOrthographic?vec3(0.0,0.0,1.0):normalize(vViewPosition);
                      float fresnel=pow(1.0-max(0.0,dot(normal,ranchIceViewDir)),2.8);
                      float shimmer=sin(uIceTime*3.5+vRanchIceUv.x*65.0)*cos(uIceTime*2.8+vRanchIceUv.y*65.0);
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
          if(p.fieldId!=='field_cm07_01'&&o.name&&o.name.startsWith('volcano-smoke')){
            smokeNodes.push({node:o,baseY:o.position.y,offset:smokeNodes.length*1.8});
          }
        });

        // Dynamic Suite: Particles and Machinery
        if(currentQualityTier()!=='saver'){
          if(p.fieldId==='field_cm23_01'){
            const outlets=[[7.4784,2.484,-0.2998],[13.517,0.06,1.8498]];
            const ps=createParticleSystem({count:4,color:0xc6ccc4,size:0.40,opacity:0.16,
              initParticle:i=>({x:outlets[i%2][0],y:outlets[i%2][1],z:outlets[i%2][2]}),
              updateParticle:(pt,dt,t,i)=>{const a=outlets[i%2],phase=(t*0.22+i*0.37)%1;pt.x=a[0]-phase*0.32;pt.z=a[2]+phase*0.32;pt.y=a[1]+phase*0.24;}
            });
            ps.mat.blending=THREE.NormalBlending;
            ps.mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
              float radius=length(gl_PointCoord-vec2(0.5))*2.0;
              diffuseColor.a*=1.0-smoothstep(0.1,1.0,radius);`);};
            ps.mat.customProgramCacheKey=()=> 'cm23-soft-vent-r1';
            object.add(ps.points);dynamicParticles.push(ps);
          }
          if(p.fieldId==='field_cm19_01'){
            const vents=[[9.2,-2.47],[13.03,-4.96],[15.55,-8.38]];
            const ps=createParticleSystem({count:6,color:0xcbd9d3,size:0.62,opacity:0.12,
              initParticle:i=>({x:vents[i%3][0],y:0.12+(i%2)*0.28,z:vents[i%3][1]}),
              updateParticle:(pt,dt,t,i)=>{const v=vents[i%3],phase=(t*0.16+i*0.37)%1;pt.x=v[0]+Math.sin(t*0.35+i)*0.12;pt.z=v[1]+Math.cos(t*0.3+i)*0.08;pt.y=0.10+phase*0.65;}
            });
            ps.mat.blending=THREE.NormalBlending;
            ps.mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
              float radius=length(gl_PointCoord-vec2(0.5))*2.0;
              diffuseColor.a*=1.0-smoothstep(0.15,1.0,radius);`);};
            ps.mat.customProgramCacheKey=()=> 'cm19-soft-mist-r1';
            object.add(ps.points);dynamicParticles.push(ps);
          }
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
        let supportMesh=null;
        if(verifiedSupport.has(p.fieldId)){const meshes=[];object.traverse(o=>{if(o.isMesh)meshes.push(o);});if(meshes.length!==1)throw Error('SUPPORT_INSTANCE_MESH_COUNT');supportMesh=meshes[0];}
        instances.push({object,p,shift,mixer,supportMesh,supportTriangles:verifiedSupport.get(p.fieldId),contactSheets:supportFields.get(p.fieldId)?.supportSheets??null});
      }
    }
      cm07Ambient=createCm07Ambient(instances.filter(i=>i.p.fieldId==='field_cm07_01').map(i=>i.object));
      supportOwnerResolver=createRanchSupportOwnerResolver({placements:supportPlacements,instances,unit:field.nativePixelWorldScale,wrapWidthNative:(field.wrapWidthPx??field.worldWidthPx)/field.nativePixelWorldScale});
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
  // LOCAL EXPERIMENT ONLY. A 2.5D depth proxy, not anatomical foot inference.
  // Upper fragments retain the RO vertical plane; submerged fragments use the
  // same orthographic screen ray intersected with the verified support plane.
  // Never changes native state, sprite screen coordinates, UVs or jump lift.
  function depthEnvelopeMaterial(base) {
    const material=base.clone();
    const uniforms={
      uRanchSupportTexture:{value:new THREE.DataTexture(new Float32Array(SUPPORT_MAX_TRIANGLES*16),4,SUPPORT_MAX_TRIANGLES,THREE.RGBAFormat,THREE.FloatType)},
      uRanchSupportCount:{value:0},uRanchSupportMax:{value:0},uRanchBufferSize:{value:new THREE.Vector2(1,1)},
      uRanchFloor:{value:0},
      uRanchDirection:{value:direction},
      uRanchViewProjection:{value:new THREE.Matrix4()}
    };
    const supportTexture=uniforms.uRanchSupportTexture.value;
    supportTexture.minFilter=THREE.NearestFilter;supportTexture.magFilter=THREE.NearestFilter;supportTexture.generateMipmaps=false;supportTexture.needsUpdate=true;
    material.userData.depthEnvelopeUniforms=uniforms;
    material.addEventListener('dispose',()=>supportTexture.dispose());
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vRanchWorldPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvRanchWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      // Only verified point-contact treads/mat use fixed-function per-sample
      // depth. Project the entire original quad to ONE contacted scalar plane;
      // the existing lower-only screen discard restricts its accepted coverage.
      // Never clamp individual vertices: that would fold the interpolation.
      if(material.userData.scalarPointDepth){
        shader.vertexShader='uniform float uRanchFloor;\nuniform vec3 uRanchDirection;\nuniform mat4 uRanchViewProjection;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
          vec3 ranchPointWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
          vec3 ranchPointProxy=ranchPointWorld+uRanchDirection*((uRanchFloor-ranchPointWorld.y)/uRanchDirection.y);
          vec4 ranchPointClip=uRanchViewProjection*vec4(ranchPointProxy,1.0);
          // Preserve stock clip XY/W bit-for-bit; only hardware-interpolated Z changes.
          gl_Position.z=(ranchPointClip.z/ranchPointClip.w)*gl_Position.w;`);
        return;
      }
      shader.fragmentShader='varying vec3 vRanchWorldPosition;\nuniform float uRanchFloor;\nuniform vec3 uRanchDirection;\nuniform mat4 uRanchViewProjection;\n'+shader.fragmentShader;
      shader.fragmentShader=`uniform sampler2D uRanchSupportTexture;
        uniform int uRanchSupportCount;uniform float uRanchSupportMax;uniform vec2 uRanchBufferSize;
        float ranchSupportEdge(vec4 edge,vec2 p){return (edge.z-edge.x)*(p.y-edge.y)-(edge.w-edge.y)*(p.x-edge.x);}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
        // Preserve the rasterizer's exact original depth above the support.
        gl_FragDepth=gl_FragCoord.z;
        float fragmentFloor=uRanchFloor;
        if(uRanchSupportCount>0 && vRanchWorldPosition.y<uRanchSupportMax+0.015){
          vec2 supportPixel=gl_FragCoord.xy/uRanchBufferSize;
          for(int i=0;i<72;i++){
            if(i>=uRanchSupportCount)break;
            vec4 info=texelFetch(uRanchSupportTexture,ivec2(3,i),0);
            if(ranchSupportEdge(texelFetch(uRanchSupportTexture,ivec2(0,i),0),supportPixel)*info.y>=0.0 &&
               ranchSupportEdge(texelFetch(uRanchSupportTexture,ivec2(1,i),0),supportPixel)*info.z>=0.0 &&
               ranchSupportEdge(texelFetch(uRanchSupportTexture,ivec2(2,i),0),supportPixel)*info.w>=0.0){fragmentFloor=max(fragmentFloor,info.x+0.015);}
          }
        }
        if(vRanchWorldPosition.y<fragmentFloor){
          float clearance=(fragmentFloor-vRanchWorldPosition.y)/uRanchDirection.y;
          vec3 proxy=vRanchWorldPosition+uRanchDirection*clearance;
          vec4 clip=uRanchViewProjection*vec4(proxy,1.0);
          gl_FragDepth=clamp(clip.z/clip.w*0.5+0.5,0.0,1.0);
        }`);
    };
    material.customProgramCacheKey=()=>material.userData.scalarPointDepth?'ranch-scalar-point-vertex-depth-v1':'ranch-test-physical-support-v1';
    return material;
  }
  function syncPhysicalSupport(item,root,box){
    const started=performance.now(),uniforms=item.mesh.material.userData.depthEnvelopeUniforms;
    uniforms.uRanchSupportCount.value=0;uniforms.uRanchSupportMax.value=0;
    renderer.getDrawingBufferSize(uniforms.uRanchBufferSize.value);
    const eligibility=eligibleSupportOwner(root.threeSupportOwner,instances);
    item.physicalSupport={status:eligibility.status,candidateCount:0,rawCount:0,buildMs:0,owner:root.threeSupportOwner??null};
    if(!eligibility.instance){item.physicalSupport.buildMs=performance.now()-started;return;}
    const instance=eligibility.instance;
    // Raised treads/mat use actual admitted point contact only. Never promote a
    // neighboring higher tread into a generic projected-pixel support override.
    if(CONTACT_HEIGHT_FIELDS.has(instance.p.fieldId)){item.physicalSupport={...item.physicalSupport,status:'ADMITTED_POINT_CONTACT_ONLY_NO_PROJECTED_TOP_OVERRIDE',buildMs:performance.now()-started};return;}
    const {supportMesh,supportTriangles}=instance;
    supportMesh.updateWorldMatrix(true,false);
    // Fail closed for unknown tilt/scale: this pilot admits horizontal transforms only.
    const m=supportMesh.matrixWorld.elements;
    if(Math.abs(m[1])+Math.abs(m[9])>1e-12||m[5]<=0)throw Error('SUPPORT_INSTANCE_TILTED');
    const buffer=uniforms.uRanchBufferSize.value,marginX=1/buffer.x,marginY=1/buffer.y;
    const boxN={minX:box.x/width-marginX,maxX:(box.x+box.width)/width+marginX,minY:1-(box.y+box.height)/height-marginY,maxY:1-box.y/height+marginY};
    const data=uniforms.uRanchSupportTexture.value.image.data;let count=0,maxHeight=-Infinity;
    if(instance.supportProjectionFrame!==frames){
      instance.supportProjection=supportTriangles.map(triangle=>{
        const world=triangle.vertices.map(v=>new THREE.Vector3(...v).applyMatrix4(supportMesh.matrixWorld));
        if(world.some(v=>Math.abs(v.y-world[0].y)>1e-10))throw Error('SUPPORT_WORLD_NON_HORIZONTAL');
        const projected=world.map(v=>{const q=v.clone().project(camera);return [Math.fround((q.x+1)*.5),Math.fround((q.y+1)*.5)];});
        return {projected,height:world[0].y,encoded:encodeProjectedTriangle(projected,world[0].y)};
      });
      instance.supportProjectionFrame=frames;
    }
    let changed=false;
    for(const triangle of instance.supportProjection){
      if(!projectedTriangleTouchesBox(triangle.projected,boxN))continue;
      if(count>=SUPPORT_MAX_TRIANGLES)throw Error('SUPPORT_CANDIDATE_OVERFLOW');
      for(let j=0;j<16;j++)if(data[count*16+j]!==triangle.encoded[j]){data[count*16+j]=triangle.encoded[j];changed=true;}
      maxHeight=Math.max(maxHeight,triangle.height);count++;
    }
    if(changed)uniforms.uRanchSupportTexture.value.needsUpdate=true;
    uniforms.uRanchSupportCount.value=count;uniforms.uRanchSupportMax.value=count?maxHeight:0;
    item.physicalSupport={...item.physicalSupport,status:'VERIFIED_OWNER_PROJECTED_TOPS',candidateCount:count,rawCount:supportTriangles.length,textureUpload:changed,maxHeight:count?maxHeight:null,buildMs:performance.now()-started,bufferSize:buffer.toArray()};
  }
  function syncScalarPointDepth(item,root,supportHeight) {
    // This compile-time variant cannot leak into the six projected-support fields.
    const contact=root.threeGroundContact,owner=root.threeSupportOwner;
    const scalarPointDepth=Number.isFinite(supportHeight) && CONTACT_HEIGHT_FIELDS.has(owner?.fieldId) && item.physicalSupport.status==='ADMITTED_POINT_CONTACT_ONLY_NO_PROJECTED_TOP_OVERRIDE' &&
      (contact?.authority==='EXACT_ADMITTED_AUTHORED_POINT'||contact?.authority==='EXACT_ADMITTED_DERIVED_LOGICAL_POINT') &&
      contact.height===supportHeight && contact.owner?.fieldId===owner?.fieldId &&
      contact.owner?.ownerIndex===owner?.ownerIndex && contact.owner?.shift===owner?.shift;
    if(Boolean(item.mesh.material.userData.scalarPointDepth)!==scalarPointDepth){
      item.mesh.material.userData.scalarPointDepth=scalarPointDepth;
      item.mesh.material.needsUpdate=true;
    }
    item.recoveryDepthMode=scalarPointDepth?'SCALAR_POINT_VERTEX_DEPTH':'FRAGMENT_DEPTH_ENVELOPE';
  }
  function partitionMaterial(base,upper,threshold) {
    // Baseline stock quad is never discarded: preserve every original covered sample.
    if(upper)return base.clone();
    const material=depthEnvelopeMaterial(base);
    const previousHook=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
    material.onBeforeCompile=function(shader,webglRenderer){
      previousHook.call(this,shader,webglRenderer);
      shader.uniforms.uRanchPartitionY=threshold;
      shader.fragmentShader='uniform float uRanchPartitionY;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
        'if(gl_FragCoord.y>=uRanchPartitionY)discard;\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey=()=>previousKey.call(material)+'|ranch-stock-plus-lower-recovery-v1';
    return material;
  }
  function syncSpritePartition(item,uvs) {
    const mesh=item.mesh,upper=item.upperMesh,u=mesh.material.userData.depthEnvelopeUniforms;
    const ceiling=Math.max(u.uRanchFloor.value,u.uRanchSupportCount.value>0?u.uRanchSupportMax.value+.015:-Infinity);
    const cut=(ceiling-mesh.position.y)/mesh.scale.y;
    const projected=new THREE.Vector3(mesh.position.x,ceiling,mesh.position.z).project(camera);
    // gl_FragCoord uses physical drawing-buffer coordinates, lower-left origin.
    // Only the recovery overlay uses this threshold; baseline stock coverage is untouched.
    item.partitionThreshold.value=(projected.y+1)*.5*u.uRanchBufferSize.value.y;
    upper.position.copy(mesh.position);upper.scale.copy(mesh.scale);upper.quaternion.copy(mesh.quaternion);
    for(const part of [mesh,upper]){
      part.geometry.attributes.uv.array.set(uvs);part.geometry.attributes.uv.needsUpdate=true;
    }
    // Keep baseline and recovery quads active. Opaque depth testing selects the
    // nearest accepted sample; the recovery pass cannot erase baseline coverage.
    upper.visible=true;mesh.visible=true;
    item.partition={ceiling,cut,physicalScreenY:item.partitionThreshold.value,upperVertices:upper.geometry.attributes.position.count,lowerVertices:mesh.geometry.attributes.position.count,kind:'FULL_STOCK_BASELINE_PLUS_LOWER_RECOVERY',recoveryDepthMode:item.recoveryDepthMode};
  }
  function disposeSpriteItem(item){
    for(const mesh of [item.mesh,item.upperMesh]){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  }
  function syncSprite(key, sprite, root, bounds, pixelScale) {
    if(!sprite || sprite.destroyed || !sprite.visible || !root.visible)return;
    const material=materialFor(sprite.texture);if(!material)return;
    let item=sprites.get(key);
    if(!item){
      const partitionThreshold={value:0};
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),partitionMaterial(material,false,partitionThreshold));
      mesh.quaternion.copy(rotY);
      scene.add(mesh);
      const upperMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),partitionMaterial(material,true,partitionThreshold));
      scene.add(upperMesh);
      // Test diagnostics must treat the pair as one logical sprite, never hide this companion.
      mesh.userData.ranchSpriteCompanionId=upperMesh.id;upperMesh.userData.ranchSpritePrimaryId=mesh.id;
      item={mesh,upperMesh,sprite,partitionThreshold};
      sprites.set(key,item);
    }
    item.seen=true;item.mesh.visible=true;item.sprite=sprite;
    if(item.mesh.material.map!==material.map){
      item.mesh.material.dispose();item.mesh.material=partitionMaterial(material,false,item.partitionThreshold);
      item.upperMesh.material.dispose();item.upperMesh.material=partitionMaterial(material,true,item.partitionThreshold);
    }
    const box=ranchSpriteScreenQuad(sprite);item.screenQuad={...box};
    const foot=root.threeGroundScreen??root;
    const groundHeight=root.threeGroundHeight??0;
    const ground=ranchNativeToWorld((foot.x-bounds.x)/pixelScale,(foot.y-bounds.y)/(pixelScale*groundY),groundHeight);

    const worldW=box.width/(16*pixelScale);
    const worldH=(box.height/(16*pixelScale))/view.cos;
    const dx=(box.x+box.width/2-root.x)/(16*pixelScale);
    // Align base of sprite with foot anchor; ensure it sits slightly above floor to prevent z-fighting
    const y_bottom=groundHeight+0.015+(root.y-(box.y+box.height))/(16*pixelScale*view.cos);

    item.mesh.scale.set(worldW,worldH,1);
    item.mesh.position.set(ground.x+right.x*dx, y_bottom+worldH/2, ground.z+right.z*dx);
    item.mesh.quaternion.copy(rotY);
    const uniforms=item.mesh.material.userData.depthEnvelopeUniforms;
    // Explicit override is a fixture/review hook, not a guessed model maxY.
    const supportHeight=root.threeVerifiedSupportHeight??groundHeight;
    uniforms.uRanchFloor.value=supportHeight+.015;
    uniforms.uRanchViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    item.envelopeNativeExtent=Math.max(0,(supportHeight+.015-y_bottom)*view.screenLift);
    // Real-presenter path never accepts an externally supplied diagnostic token.
    root.threeSupportOwner=supportOwnerResolver?.resolve(root.threeGroundAdmission,(foot.x-bounds.x)/pixelScale)??null;
    syncPhysicalSupport(item,root,box);
    syncScalarPointDepth(item,root,supportHeight);
    item.supportStatus='UNCHANGED_NATIVE_ORIGIN';
    item.surfaceStatus=root.threeVerifiedSupportHeight!==undefined?'EXPLICIT_VERIFIED_HEIGHT':'EXISTING_WALK_SURFACE_ONLY';

    const projected=item.mesh.position.clone().project(camera);
    item.projectionError=Math.hypot((projected.x+1)*width/2-box.x-box.width/2,(1-projected.y)*height/2-box.y-box.height/2);
    const u=sprite.texture.uvs,flip=sprite.scale.x*root.scale.x<0;
    const values=ranchSpriteUvs(u,flip);
    syncSpritePartition(item,values);
    sprite.renderable=false;
  }

  let wasHidden=false;
  function render({bounds,actors,food,waste,covered=false,deltaMS=0}) {
    if(disposed||lost){groundShadows.reset();for(const item of sprites.values())if(!item.sprite.destroyed)item.sprite.renderable=true;canvas.style.visibility='hidden';return false;}
    if(document.hidden){wasHidden=true;return true;}
    const effectiveDeltaMS=wasHidden?0:deltaMS;
    wasHidden=false;
    canvas.style.visibility='';
    const start=performance.now(),screen=stage.app.screen;
    if(width!==screen.width||height!==screen.height){width=screen.width;height=screen.height;renderer.setSize(width,height);}
    const pixelScale=bounds.scale*field.nativePixelWorldScale;
    const center=ranchNativeToWorld((width/2-bounds.x)/pixelScale,(height/2-bounds.y)/(pixelScale*groundY));
    camera.left=-width/(32*pixelScale);camera.right=-camera.left;camera.top=height/(32*pixelScale);camera.bottom=-camera.top;
    camera.position.set(center.x,center.y,center.z).addScaledVector(direction,200);
    camera.lookAt(center.x,center.y,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    sun.position.set(center.x-15,35,center.z+8);sun.target.position.set(center.x,0,center.z);
    for(const {object,p,shift,mixer} of instances){
      const x=bounds.x+(p.x/field.nativePixelWorldScale+shift)*pixelScale,y=bounds.y+p.y/field.nativePixelWorldScale*pixelScale*groundY;
      object.visible=x+p.worldWidthPx*bounds.scale>-80&&x<width+80&&y+p.worldHeightPx*bounds.scale>-80&&y<height+180;
      if(mixer&&object.visible&&!prefersReducedMotion())mixer.update(Math.min(50,Math.max(0,effectiveDeltaMS))/1000);
    }
    const deltaSec=Math.min(50,Math.max(0,effectiveDeltaMS))/1000;
    sceneClock+=deltaSec;
    cm07Ambient?.update({elapsedSeconds:sceneClock,visible:!covered,reducedMotion:prefersReducedMotion()});
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
          if(m.userData.shader.uniforms.uAmbientTime)m.userData.shader.uniforms.uAmbientTime.value=sceneClock;
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
    groundShadows.reset();
    for(const item of sprites.values())item.seen=false;
    for(const [id,entry] of actors){
      // Evolution is a screen-space presentation owned by the existing scene.
      if(covered||entry.evolutionActive){if(entry.sprite)entry.sprite.renderable=true;continue;}
      syncSprite(id,entry.sprite,entry.root,bounds,pixelScale);
      groundShadows.sync(id,entry,bounds,pixelScale,sprites.get(id)?.seen===true,view);
    }
    for(const [id,root] of food??[])syncSprite('food:'+id,root.children?.[1],root,bounds,pixelScale);
    for(const [id,sprite] of waste??[])syncSprite('waste:'+id,sprite,sprite,bounds,pixelScale);
    for(const [key,item] of sprites){if(!item.seen){item.mesh.visible=false;item.upperMesh.visible=false;if(item.sprite.destroyed){disposeSpriteItem(item);sprites.delete(key);}else item.sprite.renderable=true;}}
    const usedMaps=new Set([...sprites.values()].map(item=>item.mesh.material.map));
    for(const [source,entry] of textures)if(!usedMaps.has(entry.texture)){
      entry.texture.dispose();entry.material.dispose();textures.delete(source);
    }
    groundShadows.prune();
    renderer.render(scene,camera);frames++;lastRenderMs=performance.now()-start;
    canvas.dataset.frames=String(frames);canvas.dataset.drawCalls=String(renderer.info.render.calls);
    canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.actors=String([...sprites.values()].filter(i=>i.mesh.visible||i.upperMesh.visible).length);
    canvas.dataset.depthEnvelopeMaxNative=String(Math.max(0,...[...sprites.values()].filter(i=>i.mesh.visible||i.upperMesh.visible).map(i=>i.envelopeNativeExtent??0)));
    canvas.dataset.depthEnvelopeUnverifiedSurfaces=String([...sprites.values()].filter(i=>(i.mesh.visible||i.upperMesh.visible)&&i.surfaceStatus!=='EXPLICIT_VERIFIED_HEIGHT').length);
    canvas.dataset.actorProjectionError=String(Math.max(0,...[...sprites.values()].filter(i=>i.mesh.visible||i.upperMesh.visible).map(i=>i.projectionError??0)));
    canvas.dataset.animatedInstances=String(instances.filter(i=>i.mixer&&i.object.visible).length);
    canvas.dataset.textureCount=String(renderer.info.memory.textures);
    canvas.dataset.viewPitch=String(view.pitch);canvas.dataset.plinthEdges=String(plinth?.edges??0);
    canvas.dataset.passageAppearance='invisible';canvas.dataset.navigationConnections=String(connections?.length??0);canvas.dataset.passageThresholds=String(plinth?.thresholds??0);
    return true;
  }
  function dispose(){
    if(disposed)return;disposed=true;groundShadows.dispose();plinth?.dispose();plinth=null;supportOwnerResolver?.dispose();supportOwnerResolver=null;
    cm07Ambient?.dispose();cm07Ambient=null;
    lavaMaterials.clear();dynamicShaders.clear();smokeNodes.length=0;
    for(const material of authoredDepthMaterials)material.dispose();authoredDepthMaterials.clear();
    for(const ps of dynamicParticles)ps.dispose();dynamicParticles.length=0;
    for(const g of dynamicMachines){g.geometry.dispose();g.material.dispose();}dynamicMachines.length=0;
    for(const b of dynamicBeacons){b.geometry.dispose();b.material.dispose();}dynamicBeacons.length=0;
    for(const item of sprites.values()){if(!item.sprite.destroyed)item.sprite.renderable=true;disposeSpriteItem(item);}
    for(const {texture,material} of textures.values()){texture.dispose();material.dispose();}
    for(const {object,mixer} of instances)if(mixer){mixer.stopAllAction();mixer.uncacheRoot(object);}
    const geometries=new Set(),materials=new Set(),maps=new Set();
    const collect=root=>root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material??[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}});
    collect(scene);
    for(const gltf of models.values())collect(gltf.scene);
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of maps)t.dispose();
    sun.shadow.map?.dispose();
    for(const bitmap of modelBitmaps)bitmap.close();modelBitmaps.clear();
    draco.dispose();
    renderer.dispose();renderer.forceContextLoss();canvas.remove();Object.assign(pixi.style,previousStyle);
    canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
  }
  function updateContactTriangles(instance){
    const mesh=instance.supportMesh;mesh.updateWorldMatrix(true,false);
    const matrix=Array.from(mesh.matrixWorld.elements),key=matrix.join(',');
    if(instance.contactMatrixKey!==key){instance.contactTriangles=transformContactTriangles(instance.supportTriangles,matrix);instance.logicalContactTriangles=instance.p.fieldId==='field_cm18_01'?transformContactTriangles(logicalBridges,matrix):[];instance.contactMatrixKey=key;}
  }
  function contactHeight(x,y,admission){
    if(disposed)return {height:null,status:'DENIED_DISPOSED_CONTACT_SCENE',owner:null};
    const owner=supportOwnerResolver?.resolve(admission,x)??null,eligible=eligibleSupportOwner(owner,instances,{requireRenderVisible:false});
    if(!eligible.instance||!CONTACT_HEIGHT_FIELDS.has(eligible.instance.p.fieldId))return {height:null,status:eligible.status,owner};
    const instance=eligible.instance;updateContactTriangles(instance);
    const point=ranchNativeToWorld(x,y,0),hit=contactHeightAtPoint(instance.contactTriangles,point.x,point.z);
    if(!hit){
      const logical=logicalContactHeightAtPoint(instance.logicalContactTriangles,point.x,point.z);
      if(logical)return {...logical,status:'VERIFIED_ADMITTED_DERIVED_LOGICAL_CONTACT',owner,supportSheet:logical.bridgeId,sourceComponent:null,queryNative:[x,y]};
      return {height:null,status:'OUTSIDE_AUTHORED_AND_LOGICAL_CONTACT',owner};
    }
    const sheets=instance.contactSheets?.filter(sheet=>sheet.indices.includes(hit.sourceTriangleIndex))??[];
    if(sheets.length!==1)throw Error('CONTACT_SHEET_NOT_UNIQUE');
    return {...hit,status:'VERIFIED_ADMITTED_AUTHORED_CONTACT',owner,supportSheet:sheets[0].id,sourceComponent:sheets[0].component,queryNative:[x,y]};
  }
  function legacyGroundHeight(x,y){
    let height=0;const unit=field.nativePixelWorldScale;
    for(const {p,shift} of instances){
      const triangles=walkSurfaces[p.fieldId];if(!triangles)continue;
      height=Math.max(height,ranchSurfaceHeight(x-p.x/unit-shift,y-p.y/unit,triangles));
    }
    return height;
  }
  function groundContact(x,y,admission=null){
    const authored=contactHeight(x,y,admission);
    return authored.height!==null?{...authored,authority:authored.kind==='DERIVED_LOGICAL_STAIR_CONTACT_HEIGHT'?'EXACT_ADMITTED_DERIVED_LOGICAL_POINT':'EXACT_ADMITTED_AUTHORED_POINT'}:{...authored,height:legacyGroundHeight(x,y),authority:'EXISTING_WALK_SURFACE_FALLBACK'};
  }
  function groundHeight(x,y,admission=null){return groundContact(x,y,admission).height;}
  function pickGroundNative(point,readAdmission=null){
    let best={...point,height:0};const unit=field.nativePixelWorldScale;
    for(const {p,shift} of instances){
      const picked=ranchPickWalkSurface(point.x-p.x/unit-shift,point.y-p.y/unit,walkSurfaces[p.fieldId],view.lift);
      if(picked.height>best.height)best={...point,y:picked.y+p.y/unit,height:picked.height};
    }
    // Test candidate ray intersections before querying ownership. Querying the
    // base-height screen point first can select the adjacent native cell.
    if(!disposed&&typeof readAdmission==='function'){
      const candidates=[];
      for(const instance of instances){
        if(!CONTACT_HEIGHT_FIELDS.has(instance.p.fieldId)||!instance.supportMesh)continue;
        updateContactTriangles(instance);
        for(const hit of projectedContactIntersections([...instance.contactTriangles,...instance.logicalContactTriangles],point.x,point.y,view)){
          // Native admission is discontinuous at exact 8px cell boundaries.
          // Canonicalize roundoff near representable Q12 points BEFORE admission,
          // never accept a denied cell by tolerance or change general pointer precision.
          const recovered={...hit,x:canonicalContactNativeCoordinate(hit.x),y:canonicalContactNativeCoordinate(hit.y)};
          const admitted=readAdmission(recovered.x,recovered.y),contact=contactHeight(recovered.x,recovered.y,admitted);
          if(contact.height===null||contact.owner?.ownerIndex!==instance.p.ownerIndex||contact.owner?.fieldId!==instance.p.fieldId||contact.owner?.shift!==instance.shift||Math.abs(contact.height-hit.height)>1e-9)continue;
          candidates.push({...recovered,ownerIndex:instance.p.ownerIndex,shift:instance.shift});
        }
      }
      candidates.sort((a,b)=>b.rayDepth-a.rayDepth||a.ownerIndex-b.ownerIndex||a.shift-b.shift||(a.sourceTriangleIndex??Infinity)-(b.sourceTriangleIndex??Infinity)||String(a.bridgeId).localeCompare(String(b.bridgeId))||(a.logicalTriangleIndex??0)-(b.logicalTriangleIndex??0));
      const baselineWorld=ranchNativeToWorld(best.x,best.y,best.height),baselineRayDepth=baselineWorld.x*direction.x+baselineWorld.y*direction.y+baselineWorld.z*direction.z;
      if(candidates[0]&&candidates[0].rayDepth>baselineRayDepth)best=candidates[0];
    }
    return {x:best.x,y:best.y};
  }
  return {render,dispose,groundHeight,pickGroundNative,getDiagnostics:()=>({spriteDiagnostics:[...sprites].filter(([key,item])=>item.mesh.visible||item.upperMesh.visible).map(([key,item])=>({key,partition:item.partition,companionId:item.upperMesh.id,physicalSupport:item.physicalSupport,screenQuad:item.screenQuad,worldCenter:item.mesh.position.toArray(),worldScale:item.mesh.scale.toArray(),projectionError:item.projectionError,envelopeNativeExtent:item.envelopeNativeExtent??null,supportStatus:item.supportStatus??'NATIVE_ORIGIN',depthTest:item.mesh.material.depthTest,depthWrite:item.mesh.material.depthWrite})),mode:'TRUE_3D_FIXED_CAMERA_2D_ACTORS',passageAppearance:'invisible',navigationConnections:connections?.length??0,frames,lastRenderMs,models:models.size,textureCap,animatedInstances:instances.filter(i=>i.mixer).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},lost}),groundContact,contactHeight};
}

