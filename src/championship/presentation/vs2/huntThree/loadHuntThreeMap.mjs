import {huntThreeProductionRequest} from './manifestBindings.mjs';
import {verifiedExternalBytes} from './externalMapAssets.mjs';

// Reuse the existing shared renderer, fixed projection and owned fallback path.
export async function loadHuntThreeMap({stage,fieldArt,fieldSource,signal,onFallback=()=>{}}){
  const fieldId=fieldArt?.getDiagnostics?.().fieldId;
  const request=huntThreeProductionRequest(globalThis.location,fieldId);
  if(!request)return null;
  try{
    const view=fieldSource.field.getView({viewportWidth:stage.app.screen.width,viewportHeight:stage.app.screen.height});
    if(view.worldWidthPx!==request.worldSize||view.worldHeightPx!==request.worldSize)throw new Error('HUNT_THREE_NATIVE_WORLD_SIZE_REQUIRED');
    const baseUrl=new URL(request.directory,globalThis.location.href);
    const bytes=await verifiedExternalBytes(request.manifest,baseUrl,signal);
    const manifest=JSON.parse(new TextDecoder().decode(bytes));
    const [THREE,{GLTFLoader},{DRACOLoader},{createHuntThreeMap}]=await Promise.all([
      import('three'),
      import('../../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
      import('../../../../../node_modules/three/examples/jsm/loaders/DRACOLoader.js'),
      import('./createHuntThreeMap.mjs')
    ]);
    signal?.throwIfAborted();
    const map=await createHuntThreeMap({THREE,GLTFLoader,DRACOLoader,
      dracoDecoderPath:new URL('../../../../../node_modules/three/examples/jsm/libs/draco/gltf/',import.meta.url).href,
      stage,fieldArt,fieldId,manifest,baseUrl,enabled:true,
      appearanceApproved:request.appearanceApproved,signal,onFallback});
    if(signal?.aborted){map?.dispose();return null;}
    return map;
  }catch(error){if(!signal?.aborted)onFallback(error);return null;}
}
