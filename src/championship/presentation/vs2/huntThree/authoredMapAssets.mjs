import {verifiedExternalBytes,validateIdentity} from './externalMapAssets.mjs';
import {ownDracoLifecycle} from './dracoLifecycle.mjs';
import {abortable} from './lifecycle.mjs';
import {actorWorldBounds} from './actorBounds.mjs';
import {projectionForManifest} from './projection.mjs';

export function configureAuthoredLighting({manifest,scene,ambient,sun,night=false}){
  ambient.color.set(0xdce9ff);ambient.groundColor.set(0x574f3e);ambient.intensity=night?.45:.8;
  sun.color.set(night?0x9eb8ff:0xfff1db);sun.intensity=night?.65:1.7;
  const center=projectionForManifest(manifest).ground(1440,1440);
  sun.position.set(center[0]-30,65,center[2]+40);sun.target.position.set(...center);scene.add(sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;
  sun.shadow.camera.near=.1;sun.shadow.camera.far=250;sun.shadow.bias=-.001;sun.shadow.normalBias=.05;
}

// Adapter for the self-contained material GLBs in the reviewed authoring batch.
// Rendering and actor ownership remain in the existing shared Three/Pixi pass.
export async function loadAuthoredMapAssets({THREE,GLTFLoader,DRACOLoader,dracoDecoderPath,manifest,fieldId,baseUrl,signal,disposer}){
  if(manifest.schema!=='HUNT_AUTHORED_MAP.v1'||!manifest.fields.includes(fieldId)
    ||!['hm02','hm03','hm04','hm05','hm06','hm09','hm10','hm11','hm13','hm14','hm15','hm16','hm17','hm18'].includes(manifest.map))throw Error('HUNT_AUTHORED_FIELD_MISMATCH');
  validateIdentity(manifest.glb);
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw Error('HUNT_AUTHORED_EXTERNAL_RESOURCE');});
  const decoder=ownDracoLifecycle(new DRACOLoader().setDecoderPath(dracoDecoderPath).setWorkerLimit(1),THREE.REVISION).loader;
  const loader=new GLTFLoader(manager).setDRACOLoader(decoder);
  const abortDecoder=()=>decoder.dispose();signal?.addEventListener('abort',abortDecoder,{once:true});
  let gltf=null,prototypes=null;const textures=[];
  try{
    const parse=async asset=>abortable(loader.parseAsync(await verifiedExternalBytes(asset,baseUrl,signal),''),signal,disposer.gltf);
    gltf=await parse(manifest.glb);
    if(manifest.treePrototypes){
      prototypes=await parse(manifest.treePrototypes);
      const placements=JSON.parse(new TextDecoder().decode(await verifiedExternalBytes(manifest.treeInstances,baseUrl,signal)));
      if(placements.coordinateSpace!=='glTF_Y_UP'||placements.instances.length!==manifest.instanceCount)throw Error('HUNT_AUTHORED_INSTANCE_CONTRACT');
      for(const prototype of placements.prototypes){
        const root=prototypes.scene.getObjectByName(prototype.nodeName);
        if(!root)throw Error('HUNT_AUTHORED_PROTOTYPE_MISSING');
        root.updateWorldMatrix(true,true);
        const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
        const records=placements.instances.filter(row=>row.prototype===prototype.id);
        root.traverse(mesh=>{
          if(!mesh.isMesh||!records.length)return;
          // Clone ownership so unloading prototypes cannot dispose live batches.
          const geometry=mesh.geometry.clone();
          const batch=new THREE.InstancedMesh(geometry,mesh.material,records.length);
          const relative=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
          records.forEach((row,index)=>{
            if(row.position?.length!==3||row.scale?.length!==3||!row.position.every(Number.isFinite)||!row.scale.every(n=>Number.isFinite(n)&&n>0))throw Error('HUNT_AUTHORED_INSTANCE_TRANSFORM');
            const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...row.position),new THREE.Quaternion(),new THREE.Vector3(...row.scale));
            batch.setMatrixAt(index,matrix.multiply(relative));
          });
          batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();gltf.scene.add(batch);
        });
      }
      // Retain the prototype scene as an invisible owned child for one disposer.
      prototypes.scene.visible=false;gltf.scene.add(prototypes.scene);prototypes=null;
    }
    let heights=null;
    if(manifest.groundHeights){
      const grid=JSON.parse(new TextDecoder().decode(await verifiedExternalBytes(manifest.groundHeights,baseUrl,signal)));
      if(grid.width!==180||grid.height!==180||grid.tileSize!==16)throw Error('HUNT_AUTHORED_HEIGHT_GRID');
      heights=new Map(grid.heights.map(([x,y,h])=>{if(![x,y,h].every(Number.isFinite))throw Error('HUNT_AUTHORED_HEIGHT_VALUE');return [y*180+x,h];}));
    }else if(!Number.isFinite(manifest.flatSupport?.height)||!Array.isArray(manifest.flatSupport.exclusions))throw Error('HUNT_AUTHORED_SUPPORT_CONTRACT');
    const verifiedSourceId=`terrain-props.glb SHA256 ${manifest.glb.sha256}`;
    const resolveSupport=({wild,node,view})=>{
      const box=actorWorldBounds(wild,node,32),visible=view.visibleMapRect??view.viewRect;
      if(visible&&(box.right<visible.left||box.left>visible.right||box.bottom<visible.top||box.top>visible.bottom))return {verifiedSourceId,groundHeight:0,offscreen:true};
      if(manifest.flatSupport?.exclusions.some(r=>box.left<=r.right&&box.right>=r.left&&box.top<=r.bottom&&box.bottom>=r.top))return null;
      const groundHeight=heights?heights.get(Math.floor(wild.worldY/16)*180+Math.floor(wild.worldX/16)):manifest.flatSupport.height;
      return Number.isFinite(groundHeight)?{verifiedSourceId,groundHeight}:null;
    };
    let selectPhase=()=>{};
    if(manifest.lavaPhase){
      const bytes=await verifiedExternalBytes(manifest.lavaPhase.texture,baseUrl,signal);
      const bitmap=await abortable(createImageBitmap(new Blob([bytes],{type:'image/webp'}),{imageOrientation:'none'}),signal,b=>b.close());
      const materials=new Set();gltf.scene.traverse(mesh=>{for(const m of [].concat(mesh.material??[]))if(m.name===manifest.lavaPhase.material)materials.add(m);});
      if(!materials.size)throw Error('HUNT_LAVA_MATERIAL_MISSING');
      const replacement=original=>{const texture=original.clone();texture.source=new THREE.Source(bitmap);texture.needsUpdate=true;textures.push(original,texture);return texture;};
      const originals=[...materials].map(material=>({material,map:material.map,emissiveMap:material.emissiveMap,nextMap:replacement(material.map),nextEmissive:replacement(material.emissiveMap)}));
      selectPhase=phase=>{for(const row of originals){row.material.map=phase===1?row.nextMap:row.map;row.material.emissiveMap=phase===1?row.nextEmissive:row.emissiveMap;}};
    }
    gltf.scene.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
    signal?.throwIfAborted();
    return {gltf,resolveSupport,field:{clearColor:manifest.clearColor},textures,materialOwners:[],selectPhase,stats:{assetVersion:manifest.assetVersion}};
  }catch(error){disposer.gltf(gltf);disposer.gltf(prototypes);textures.forEach(disposer.texture);throw error;}
  finally{signal?.removeEventListener('abort',abortDecoder);decoder.dispose();}
}
