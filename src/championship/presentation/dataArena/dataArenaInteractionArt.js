import { createPixiAssetScope } from "../pixiCharacterRuntimeBundle.js";
export const INTERACTION_ART_URL="assets/production/data-arena/interactions-v1/manifest.json";
export async function loadDataArenaInteractionArt({PIXI,map,quality="high",href,signal}) {
  const scope=createPixiAssetScope(PIXI,href,{signal}),held=new Set(),textures=new Map();let disposed=false;
  const load=async src=>{held.add(src);return scope.Assets.load(src);};
  const dispose=async()=>{if(disposed)return;disposed=true;await Promise.allSettled([...held].map(src=>scope.Assets.unload(src)));held.clear();};
  try {
    const manifest=await load(INTERACTION_ART_URL),tier=quality==="low"?"low":"high";
    if(manifest.id!=="data-arena-interactions-v1"||manifest.rights!=="PROJECT_ORIGINAL")throw Error("DATA_ARENA_INTERACTION_ART_MISMATCH");
    const records=[...Object.values(manifest.props).map(r=>r[tier]),...Object.values(manifest.ice).filter(r=>r?.[tier]).map(r=>r[tier]),
      ...(map.stage?manifest.harborPatches.map(r=>r.textures[tier]):[])];
    const unique=[...new Map(records.map(r=>[r.src,r])).values()];
    for(let i=0;i<unique.length;i+=4){const batch=await Promise.allSettled(unique.slice(i,i+4).map(async r=>textures.set(r.src,await load(r.src))));const fail=batch.find(r=>r.status==="rejected");if(fail)throw fail.reason;if(signal?.aborted)throw signal.reason??Error("DATA_ARENA_ABORTED");}
    return{manifest,textures,tier,decodedBytes:unique.reduce((n,r)=>n+r.pixelWidth*r.pixelHeight*4,0),dispose};
  }catch(error){await dispose();throw error;}
}
