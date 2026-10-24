import {abortable} from './lifecycle.mjs';
import {ownDracoLifecycle} from './dracoLifecycle.mjs';
import {actorWorldBounds} from './actorBounds.mjs';
import {createMapProjection} from './projection.mjs';
import {HM01_ENTER_SUPPORT} from './hm01SupportCorridors.mjs';

const categories=new Set(['standable_ground','water','foreground_structure','foreground_vegetation']);
export function validateIdentity(asset){
  if(!asset||!/^[A-Za-z0-9_-]+\.(?:glb|webp|json)$/.test(asset.file??'')
    ||!/^[a-f0-9]{64}$/.test(asset.sha256??'')||!Number.isSafeInteger(asset.bytes)||asset.bytes<1)
    throw new Error('HUNT_THREE_ASSET_IDENTITY_REQUIRED');
  return asset;
}
export function validateExternalManifest(manifest,fieldId){
  if(manifest?.schema!=='HUNT_THREE_MAP.v1'||!['hm01','hm08'].includes(manifest.map)
    ||!manifest.fields?.[fieldId]||!new RegExp(`^field_${manifest.map}_0[12]$`).test(fieldId))
    throw new Error('HUNT_THREE_FIELD_MANIFEST_MISMATCH');
  createMapProjection(manifest.projection);
  const size=manifest.map==='hm01'?2880:2048,phases=manifest.map==='hm01'?2:1;
  if(manifest.projection.worldSize.some(n=>n!==size)||Object.keys(manifest.fields).sort().join(',')!==`field_${manifest.map}_01,field_${manifest.map}_02`)
    throw new Error('HUNT_THREE_WORLD_SIZE_MISMATCH');
  validateIdentity(manifest.glb);validateIdentity(manifest.groundHeights);
  if(manifest.glb.compression?.extension!=='KHR_draco_mesh_compression'
    ||manifest.glb.materials!==0||manifest.glb.textures!==0||manifest.groundSupport?.walkableHeightUnits!==0
    ||manifest.groundSupport?.measured?.miss!==0||!Array.isArray(manifest.glb.meshes))throw new Error('HUNT_THREE_GEOMETRY_CONTRACT');
  const names=new Set();
  for(const mesh of manifest.glb.meshes){
    if(names.has(mesh.node)||!categories.has(mesh.category)||mesh.primitives!==1)throw new Error('HUNT_THREE_MESH_CONTRACT');
    names.add(mesh.node);
  }
  for(const [id,field] of Object.entries(manifest.fields)){
    if(field.variant!==(id.endsWith('01')?'day':'night')||field.frames?.length!==phases)throw new Error('HUNT_THREE_PHASE_CONTRACT');
    for(const frame of field.frames){validateIdentity(frame);if(frame.width!==size||frame.height!==size)throw new Error('HUNT_THREE_FRAME_SIZE');}
  }
  return manifest.fields[fieldId];
}
export async function verifiedExternalBytes(asset,baseUrl,signal,{fetcher=fetch,digest=crypto.subtle}={}){
  validateIdentity(asset);signal?.throwIfAborted();
  const response=await abortable(fetcher(new URL(asset.file,baseUrl),{signal}),signal);
  if(!response.ok)throw new Error('HUNT_THREE_ASSET_FETCH_FAILED:'+asset.file);
  const bytes=await abortable(response.arrayBuffer(),signal);
  if(bytes.byteLength!==asset.bytes)throw new Error('HUNT_THREE_ASSET_BYTE_MISMATCH:'+asset.file);
  const hash=await abortable(digest.digest('SHA-256',bytes),signal);
  if(Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')!==asset.sha256)
    throw new Error('HUNT_THREE_ASSET_HASH_MISMATCH:'+asset.file);
  return bytes;
}
export function validateGeometryOnlyGlb(bytes,manifest){
  const view=new DataView(bytes);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2
    ||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw new Error('HUNT_THREE_INVALID_GLB');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
  if((json.images?.length??0)||(json.textures?.length??0)||(json.materials?.length??0)
    ||json.buffers?.some(b=>b.uri)||json.extensionsRequired?.join(',')!=='KHR_draco_mesh_compression'
    ||json.meshes?.length!==manifest.glb.meshes.length)throw new Error('HUNT_THREE_GEOMETRY_ONLY_REQUIRED');
  for(const record of manifest.glb.meshes){
    const node=json.nodes?.find(n=>n.name===record.node),mesh=json.meshes[node?.mesh],primitive=mesh?.primitives?.[0];
    if(!mesh||mesh.primitives.length!==1||!primitive?.extensions?.KHR_draco_mesh_compression
      ||node.extras?.webCategory!==record.category||json.accessors[primitive.indices]?.count!==record.triangles*3
      ||json.accessors[primitive.attributes.POSITION]?.count!==record.vertices)throw new Error('HUNT_THREE_MESH_CONTRACT');
  }
  return json;
}
export function createVerifiedGridSupport(manifest,heights){
  const size=manifest.projection.worldSize[0]/16;
  if(heights.field!==`field_${manifest.map}_01`||heights.tile!==8||heights.grid?.length!==size
    ||heights.grid.some(row=>row.length!==size||row.some(h=>h!==null&&(!Number.isFinite(h)||Math.abs(h)>.03001))))
    throw new Error('HUNT_THREE_SUPPORT_GRID_CONTRACT');
  return ({wild,node,view})=>{
    const box=actorWorldBounds(wild,node,32),visible=view.visibleMapRect??view.viewRect;
    if(visible&&(box.right<visible.left||box.left>visible.right||box.bottom<visible.top||box.top>visible.bottom))
      return {verifiedSourceId:'OFFSCREEN_NO_GROUND_PROOF_NEEDED',groundHeight:0,offscreen:true};
    // Null is not evidence for support. The sole exception is an exact-GLB,
    // continuously covered HM01 corridor during native ENTER, proved separately.
    const h=heights.grid[Math.floor(wild.worldY/16)]?.[Math.floor(wild.worldX/16)];
    if(h===null||h===undefined){
      const proof=HM01_ENTER_SUPPORT;
      const region=manifest.map==='hm01'&&manifest.glb.sha256===proof.glbSHA256
        &&manifest.groundHeights.sha256===proof.heightGridSHA256&&wild.passage===proof.requiredNativePhase
        ?proof.regions.find(({bounds:b})=>wild.worldX>=b.left&&wild.worldX<b.right&&wild.worldY>=b.top&&wild.worldY<b.bottom):null;
      return region?{groundHeight:region.flatSupportHeight,verifiedSourceId:`${region.id} GLB SHA256 ${proof.glbSHA256}`} : null;
    }
    return {groundHeight:0,verifiedSourceId:`${manifest.groundHeights.file} SHA256 ${manifest.groundHeights.sha256}`,sampleHeight:h};
  };
}
export function configureDraco({THREE,GLTFLoader,DRACOLoader,decoderPath,baseUrl}){
  const path=new URL(decoderPath),base=new URL(baseUrl);
  if(path.origin!==base.origin||path.search||path.hash||!path.pathname.endsWith('/node_modules/three/examples/jsm/libs/draco/gltf/'))
    throw new Error('HUNT_THREE_UNTRUSTED_DECODER_PATH');
  const allowed=new Set(['draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js'].map(name=>new URL(name,path).href));
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{
    if(allowed.has(url))return url;throw new Error('HUNT_THREE_EXTERNAL_GLTF_RESOURCE_FORBIDDEN');
  });
  const draco=new DRACOLoader(manager).setDecoderPath(path.href).setWorkerLimit(1);
  draco.setDecoderConfig({type:'wasm'});
  ownDracoLifecycle(draco,THREE.REVISION);
  return {loader:new GLTFLoader(manager).setDRACOLoader(draco),draco};
}
export async function loadExternalMapAssets({THREE,GLTFLoader,DRACOLoader,dracoDecoderPath,manifest,fieldId,baseUrl,signal,disposer}){
  const field=validateExternalManifest(manifest,fieldId),textures=[];
  let gltf=null,draco=null;const stats={downloadBytes:0,decodedTextureBytes:0};
  const read=async asset=>{const bytes=await verifiedExternalBytes(asset,baseUrl,signal);stats.downloadBytes+=bytes.byteLength;return bytes;};
  try{
    const bytes=await read(manifest.glb);validateGeometryOnlyGlb(bytes,manifest);
    const configured=configureDraco({THREE,GLTFLoader,DRACOLoader,decoderPath:dracoDecoderPath,baseUrl});draco=configured.draco;
    try{gltf=await abortable(configured.loader.parseAsync(bytes,''),signal,disposer.gltf);}
    finally{draco.dispose();draco=null;}
    signal?.throwIfAborted();
    const heights=JSON.parse(new TextDecoder().decode(await read(manifest.groundHeights)));
    const resolveSupport=createVerifiedGridSupport(manifest,heights);
    for(const frame of field.frames){
      const bytes=await read(frame);
      const bitmap=await abortable(createImageBitmap(new Blob([bytes],{type:'image/webp'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'}),signal,b=>b.close?.());
      if(signal?.aborted){bitmap.close?.();signal.throwIfAborted();}
      if(bitmap.width!==frame.width||bitmap.height!==frame.height){bitmap.close?.();throw new Error('HUNT_THREE_FRAME_SIZE');}
      let texture;try{texture=new THREE.Texture(bitmap);}catch(error){bitmap.close?.();throw error;}
      textures.push(texture);texture.flipY=false;texture.premultiplyAlpha=false;texture.unpackAlignment=4;
      texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
      stats.decodedTextureBytes+=frame.width*frame.height*4;
    }
    const ground=new THREE.MeshBasicMaterial({map:textures[0]});
    // Scenery coverage mask is NOT the native-actor alpha policy.
    const foreground=new THREE.MeshBasicMaterial({map:textures[0],alphaTest:.5,side:THREE.DoubleSide});
    const materialOwners=[ground,foreground];
    try{
      let count=0;
      gltf.scene.traverse(mesh=>{
        if(!mesh.isMesh)return;count++;
        const category=mesh.userData.webCategory??mesh.parent?.userData?.webCategory;
        const record=manifest.glb.meshes.find(m=>m.node===mesh.name&&m.category===category);
        if(!record)throw new Error('HUNT_THREE_MESH_CONTRACT');
        for(const old of [].concat(mesh.material??[]))disposer.once(old);
        mesh.material=category.startsWith('foreground')?foreground:ground;mesh.frustumCulled=true;
      });
      if(count!==manifest.glb.meshes.length)throw new Error('HUNT_THREE_MESH_CONTRACT');
    }catch(error){for(const m of materialOwners)disposer.once(m);throw error;}
    return {gltf,textures,materialOwners,field,stats,resolveSupport,
      selectPhase(index){if(!Number.isInteger(index)||!textures[index])throw new Error('HUNT_THREE_NATIVE_PHASE_OUT_OF_RANGE');ground.map=textures[index];foreground.map=textures[index];}};
  }catch(error){disposer.gltf(gltf);for(const t of textures)disposer.texture(t);throw error;}
  finally{draco?.dispose();}
}
