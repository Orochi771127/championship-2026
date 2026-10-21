// Owner-approved factory interaction, 2026-10-21. One existing simulation tick,
// no timer or RNG. Coordinates come from evaluated Blender belt surfaces.
import conveyor from '../../data/championship/catalogs/ranch-conveyor.r1.json' with {type:'json'};
import {PRODUCT_RANCH_GRID} from '../cage/productRanchGrid.js';
import {canTraverseGroundStep} from '../field/groundFootpointSeparation.js';

function inside(x,y,polygon) {
  let sign=0;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],c=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
    if(Math.abs(c)<1e-4)continue;
    if(sign&&Math.sign(c)!==sign)return false;
    sign=Math.sign(c);
  }
  return true;
}
export function ranchConveyorAt(ground,positionQ12) {
  if(ground?.layoutVersion!==PRODUCT_RANCH_GRID)return null;
  const x=positionQ12[0]/4096,y=positionQ12[1]/4096,p=ground.cageAt(x,y);
  if(p?.definitionIndex!==conveyor.definitionIndex)return null;
  const origin=ground.origin(p.instanceId),localX=((x-origin[0])%ground.pixelWidth+ground.pixelWidth)%ground.pixelWidth;
  const surface=conveyor.surfaces.find(s=>inside(localX,y-origin[1],s.polygon));
  return surface?{...surface,owner:p,direction:conveyor.direction,speed:conveyor.nativePixelsPerTick}:null;
}
export function stepRanchConveyor(actor,ground) {
  // Carry, flight, training, evolution and a reserved feeding station retain
  // their existing controller. Surface height is a presentation offset only.
  if(!actor.positionQ12||actor.positionQ12[2]!==0||actor.detached||actor.tutorialSpecial||actor.evolution||actor.foodSlot!=null
    ||![1,2,3,4,8,9,10,11,14,16,17,18,19,20,25,26].includes(actor.state))return false;
  const belt=ranchConveyorAt(ground,actor.positionQ12);if(!belt)return false;
  const from=actor.positionQ12,to=from.map((v,i)=>i<2?v+Math.round(belt.direction[i]*belt.speed*4096):v);
  const safe=p=>p[1]>=0&&p[1]<ground.pixelHeight*4096
    &&ground.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768))!==1
    &&ground.cageAt(p[0]/4096,p[1]/4096)?.ownerIndex===belt.owner.ownerIndex;
  if(!canTraverseGroundStep(from,to,{wrapXQ12:ground.pixelWidth*4096,canStand:safe}))return false;
  actor.positionQ12=to;
  // An idle standing target follows the platform. Walking destinations remain
  // world-fixed, so a partner can walk across, against, or off the belt.
  if(actor.state===1&&actor.destinationQ12)actor.destinationQ12=actor.destinationQ12.map((v,i)=>v+to[i]-from[i]);
  return true;
}
