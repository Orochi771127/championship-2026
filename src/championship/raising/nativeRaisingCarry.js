// OVL18 02118B04 / 02118AA0 / 02118C34. Q12 operations preserve
// ARM arithmetic shifts and Nitro normalization. Stepped by the resident owner.
import {nativeNormalizeQ12 as normalize,nativeVectorLengthQ12 as length} from '../hunt/capture/nativeCapturePhases.js';
import {findNativeRaisingOpenTile} from './nativeRaisingGround.js';

export function nativeCarryPosition({x,y},height){
  return [Math.trunc(x)*4096,(Math.min(Math.trunc(y),150)+2*Math.trunc(height/3))*4096,20*4096];
}
export function nativeCarryVelocity(velocity,previous,position){
  let v=[...velocity];
  v[0]=(v[0]+((position[0]-previous[0])>>2))|0;
  v[1]=(v[1]+((position[1]-previous[1])>>2))|0;
  if(length(v)>0){const n=normalize(v);v[0]-=n[0]<<1;v[1]-=n[1]<<1;}
  const speed=length(v);
  if(speed>40960){v=normalize(v);v[0]*=10;v[1]*=10;}
  // Native dead zone clears X only (02118C18); do not symmetrize it.
  if(speed<4096)v[0]=0;
  return v;
}
export function nativeReleaseVelocity(velocity){
  return [velocity[0],velocity[1]>>1,Math.min(velocity[2]-velocity[1],30*4096)];
}
const tile=v=>Math.trunc((v>>12)/8);
function ownerAt(ground,x,y){
  if(x>=ground.width)x-=ground.width;else if(x<0)x+=ground.width;
  return ground.owners[Math.max(0,Math.min(24,y))*ground.width+x]??-1;
}
export function stepNativeRaisingFlight(input,ground,{rng,poolSlot=0,cameraX=0,findOpenTile=findNativeRaisingOpenTile}={}){
  const old=input.positionQ12,p=[...old],v=[...input.velocityQ12];
  let phase=input.phase??0,destination=input.destinationQ12?[...input.destinationQ12]:[0,0,0];
  if(length(v)>0&&(phase===0||phase===2)){const n=normalize(v);v[0]-=n[0]>>2;v[1]-=n[1]>>2;}
  v[2]-=2048;for(let i=0;i<3;i++)p[i]+=v[i];
  const contact=p[2]<=0;
  if(contact){p[2]=0;v[2]=-(v[2]>>1);
    if(v.some(Boolean)){const n=normalize(v);v[0]-=n[0]>>1;v[1]-=n[1]>>1;}}
  if(p[2]<81920){const x=tile(p[0]),y=tile(p[1]);
    if(phase===1&&ownerAt(ground,x,y)!==-1)phase=2;
    if(ground.readTerrain(x,y)===1){
      if(phase===0||phase===2){v[0]=-(v[0]>>1);v[1]=-(v[1]>>1);p[0]=old[0];p[1]=old[1];}
      if(p[2]<=0){const open=findOpenTile(ground,tile(old[0]),tile(old[1]),{centralBand:true,rng,poolSlot});
        if(open.distance){
          if(phase===0){destination=[(open.x*8+4)*4096,(open.y*8+4)*4096,0];phase=1;}
          if((destination[0]>>12)>ground.pixelWidth&&cameraX>(p[0]>>12))p[0]+=ground.pixelWidth*4096;
          let delta=destination.map((value,i)=>value-p[i]);const distance=length(delta);
          if(distance>=131072||delta.some(Boolean)){delta=normalize(delta);const factor=distance<131072?2:Math.trunc((distance>>12)/32)+1;
            delta=[delta[0]*factor,delta[1]*factor,16384];}
          if(delta[2])v.splice(0,3,...delta);
        }else phase=0;
      }
    }
  }
  p[1]=Math.max(24*4096,Math.min(160*4096,p[1]));
  if(p[0]<0)p[0]+=ground.pixelWidth*4096;else if(p[0]>ground.pixelWidth*4096)p[0]-=ground.pixelWidth*4096;
  for(let i=0;i<3;i++){const threshold=i===2?1229:2048;if(v[i]>-threshold&&v[i]<threshold)v[i]=0;}
  return {positionQ12:p,velocityQ12:v,destinationQ12:destination,phase,contact,settled:contact&&!v.some(Boolean)};
}

// 02116740 bad throw; 021161B8 gentle release. Null means ordinary idle.
export function nativeLandingReaction(personality,badThrow,roll){
  if(badThrow)return [4,4,24,12,4,14,4,24][personality]??null;
  return (roll%100<50?[6,4,19,3,6,null,0,24]:[null,4,1,null,0,null,14,8])[personality]??null;
}
