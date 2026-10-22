// Read-only presentation admission from the already composed simulation ground.
// XY connectivity is not a vertical support height or new navigation authority.
export function readRaisingGroundSupport(ground,x,y){
  if(ground?.layoutVersion!=='PRODUCT_GRID100_INSTANCES_V1'||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const width=ground.pixelWidth,height=ground.pixelHeight;
  if(!(width>0)||!(height>0)||y<0||y>=height||!ground.navigation?.component)return null;
  const wrappedX=((x%width)+width)%width,tx=Math.floor(wrappedX/8),ty=Math.floor(y/8);
  const cage=ground.cageAt(wrappedX,y),terrain=ground.readTerrain(tx,ty);
  const component=ground.navigation.component[ty*ground.width+tx];
  if(!cage||terrain===1||!Number.isInteger(component)||component<0||typeof cage.instanceId!=='string'||!cage.instanceId||typeof cage.moduleId!=='string'||!Number.isInteger(cage.slotIndex)||!Number.isInteger(cage.definitionIndex))return null;
  const origin=ground.origin(cage.instanceId);
  if(!Array.isArray(origin)||!origin.slice(0,2).every(Number.isFinite))return null;
  const localX=((wrappedX-origin[0])%width+width)%width;
  return Object.freeze({kind:'CURRENT_GROUND_XY_ADMISSION_V1',instanceId:cage.instanceId,moduleId:cage.moduleId,
    slotIndex:cage.slotIndex,definitionIndex:cage.definitionIndex,nativeOwnerIndex:cage.ownerIndex,
    navigationComponent:component,terrain,wrapWidthNative:width,
    originNative:Object.freeze(origin.slice(0,2)),localNative:Object.freeze([localX,y-origin[1]]),
    positionNative:Object.freeze([wrappedX,y])});
}
