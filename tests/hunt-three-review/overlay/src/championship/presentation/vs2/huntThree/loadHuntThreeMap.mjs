import {MAPS,HM02_LOD2_MANIFEST} from './manifestBindings.mjs';
import {verifiedExternalBytes} from './externalMapAssets.mjs';
import {createFlatSupportResolver} from './hm02FlatSupport.mjs';

export function huntThreeReviewRequest(location=globalThis.location,fieldId=null){
  const url=new URL(location.href);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return null;
  const requested=url.searchParams.get('huntThreeReview');
  const key=requested??(url.searchParams.get('hm02ThreeReview')==='1'?'hm02':null);
  const map=MAPS[key];
  return map&&(fieldId===null||map.fields.includes(fieldId))?{key,...map,manifest:key==='hm02'&&url.searchParams.get('hm02ThreeTrees')==='lod2'?HM02_LOD2_MANIFEST:map.manifest}:null;
}
// Existing mount owner and clock only. Default/public path does no fetch/import.
export async function loadHuntThreeMap({stage,fieldArt,fieldSource,signal,onFallback=()=>{}}){
  const fieldId=fieldArt?.getDiagnostics?.().fieldId;
  const request=huntThreeReviewRequest(globalThis.location,fieldId);
  if(!request||!fieldId)return null;
  try{
    const view=fieldSource.field.getView({viewportWidth:stage.app.screen.width,viewportHeight:stage.app.screen.height});
    if(view.worldWidthPx!==request.worldSize||view.worldHeightPx!==request.worldSize)throw new Error('HUNT_THREE_NATIVE_WORLD_SIZE_REQUIRED');
    const baseUrl=new URL(request.directory,globalThis.location.href);
    const bytes=await verifiedExternalBytes(request.manifest,baseUrl,signal);
    const manifest=JSON.parse(new TextDecoder().decode(bytes));
    if(request.key==='hm02'&&(manifest.assetVersion!=='v5'||manifest.horizontalRotationEnabled!==false))throw new Error('HM02_V5_FIXED_CAMERA_REQUIRED');
    const [THREE,{GLTFLoader},{DRACOLoader},{createHuntThreeMap}]=await Promise.all([
      import('three'),
      import('../../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
      import('../../../../../node_modules/three/examples/jsm/loaders/DRACOLoader.js'),
      import('./createHuntThreeMap.mjs')
    ]);
    signal?.throwIfAborted();
    const pilot=await createHuntThreeMap({THREE,GLTFLoader,DRACOLoader,
      dracoDecoderPath:new URL('../../../../../node_modules/three/examples/jsm/libs/draco/gltf/',import.meta.url).href,
      stage,fieldArt,fieldId,manifest,baseUrl,enabled:true,reviewHarness:true,signal,onFallback,
      resolveSupport:request.key==='hm02'?createFlatSupportResolver(manifest):undefined});
    if(signal?.aborted){pilot?.dispose();return null;}
    return pilot;
  }catch(error){if(!signal?.aborted)onFallback(error);return null;}
}
