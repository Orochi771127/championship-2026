import {createPixiAssetScope} from '../pixiCharacterRuntimeBundle.js';
import {loadPublicMetadata} from '../publicMetadata.js';
import {loadRuntimeMapArtField} from '../runtimeMapArtBundle.js';
import {withBattleFieldAmbient} from '../battleFieldAmbient.js';

export async function loadRelayMapArt({PIXI,map,quality,href,signal,fetchImpl,renderer}) {
  const scope=createPixiAssetScope(PIXI,href,{signal});
  const manifest=await loadPublicMetadata('battle-original',{baseHref:href,signal,fetchImpl});
  let art=await loadRuntimeMapArtField({PIXI:scope,manifest,fieldId:map.battleFieldId});
  // Low tier uses the approved composite only. The shared renderer's pooled
  // alpha-mask filter can retain a disposed BindGroup across screen leases.
  // High tier uses the existing single-pass mesh path; omit the lagoon's
  // sprite-mask caustics, retaining its approved water, foam and palm art.
  try { if(quality!=='low'&&renderer?.type===PIXI.RendererType?.WEBGL&&art.field.ambient) {
    const {waterMask,caustics,...ambient}=art.field.ambient;
    art=await withBattleFieldAmbient({PIXI:scope,art:{...art,field:{...art.field,ambient}},quality,renderer});
  } }
  catch(error) { await art.dispose();throw error; }
  let disposed=false;
  return {manifest:{kind:'RELAY_BATTLE',id:map.battleFieldId,portrait:map.portrait},art,propArt:new Map(),
    detach(){art.displayObject.parent?.removeChild(art.displayObject);art.foregroundObject?.parent?.removeChild(art.foregroundObject);},
    async dispose(){if(disposed)return;disposed=true;art.displayObject.parent?.removeChild(art.displayObject);art.foregroundObject?.parent?.removeChild(art.foregroundObject);await art.dispose();}};
}

export function mountRelayMapArt({environment,ground,objects,water}) {
  for(const child of water.removeChildren())child.destroy();
  const {art,manifest}=environment;
  const place=object=>{if(manifest.portrait){object.rotation=Math.PI/2;object.position.set(1088,0);}return object;};
  ground.addChild(place(art.displayObject));
  if(art.foregroundObject){objects.addChild(place(art.foregroundObject));art.foregroundObject.zIndex=Infinity;}
  let elapsed=0;
  return {update(view){const dt=Math.max(0,view.elapsed-elapsed)*1000;elapsed=view.elapsed;if(!view.reducedMotion)art.update(dt);},
    diagnostics(){return {id:manifest.id,portrait:manifest.portrait,...art.getDiagnostics()};}};
}
