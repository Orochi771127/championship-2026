// OVL18 02111A40 modes 0/1/2: approach, obstruction recovery and peer following.
// Same shared Nitro math used by the original ARM9, no Hunt AI rules reused.
import {nativeNormalizeQ12,nativeVectorLengthQ12} from "../hunt/capture/nativeCapturePhases.js";
import {battleAngleIndex} from "../battle/battleNativeMath.js";
import {nativeRaisingHeadings} from "./nativeRaisingGround.js";
const mul=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a)*BigInt(b)+2048n)>>12n));
const tile=p=>p.slice(0,2).map(n=>Math.trunc((n>>12)/8)||0);
export function stepNativeRaisingMovement(input,environment) {
  if(![0,1,2].includes(input.mode))throw new Error("RAISING_MOVEMENT_MODE_REQUIRES_TRACE");
  let {mode,ticks,threshold,angleQ12,desiredAngleQ12}=input;
  let position=[...input.positionQ12],destination=[...input.destinationQ12],direction=[0,0,0];
  if(mode===0)direction=destination.map((n,i)=>(n-position[i])|0);
  else {
    ticks--;const [x,y]=tile(position),value=environment.readClearance(x,y);
    if(value<threshold||value<=1) {
      const limit=value<threshold-1?180:90;
      let difference=Math.abs((desiredAngleQ12>>12)-(angleQ12>>12));if(difference>180)difference=360-difference;
      if(difference<limit) {
        const neighbors=[[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];
        let best=-1,maximum=0;
        neighbors.forEach(([dx,dy],i)=>{const v=environment.readClearance(x+dx,y+dy);if(v>maximum){maximum=v;best=i;}});
        const dx=best>=0&&best<=2?4096:best>=4&&best<=6?-4096:0;
        const dy=best>=2&&best<=4?4096:best===0||best===6||best===7?-4096:0;
        desiredAngleQ12=Math.trunc(battleAngleIndex(dy,dx)*360/65535)*4096;
      }
    } else if(mode===2){
      if(input.peer?.positionQ12&&![4,5,18,21,22].includes(input.peer.state))desiredAngleQ12=Math.trunc(battleAngleIndex(input.peer.positionQ12[1]-position[1],input.peer.positionQ12[0]-position[0])*360/65535)*4096;
      else ticks=0;
    }
    let current=angleQ12-Math.floor(angleQ12/(360*4096))*360*4096;
    const target=desiredAngleQ12-Math.floor(desiredAngleQ12/(360*4096))*360*4096;
    if(target-180*4096>current)current+=360*4096;
    if(target+180*4096<current)current-=360*4096;
    angleQ12+=Math.max(-40960,Math.min(40960,mul(target-current,0x333)));
    if(angleQ12<0)angleQ12+=360*4096;
    if(angleQ12>=360*4096)angleQ12-=360*4096;
    const [sin,cos]=nativeRaisingHeadings[angleQ12>>12];direction=[cos,sin,0];
  }
  if(direction.some(Boolean))direction=nativeNormalizeQ12(direction);
  let delta=direction.map((n,i)=>i<2?mul(n,0xb33):n);
  if(input.state===3||input.state===16)delta=delta.map((n,i)=>i<2?n*2:n);
  if(input.slow===1)delta=delta.map((n,i)=>i<2?Math.trunc(n/3)||0:n);
  else if(input.fast===1)delta=delta.map((n,i)=>i<2?mul(n,input.hasFood===false?0x4cd:0x1800):n);
  const flipBits=delta[0]<0?0:1,candidate=position.map((n,i)=>(n+delta[i])|0);
  if(environment.readTerrain(...tile(candidate))===1) {
    if(mode===0){destination=candidate;mode=1;ticks=60;threshold=environment.readClearance(...tile(position));}
    else {desiredAngleQ12=angleQ12>180*4096?angleQ12-180*4096:angleQ12+180*4096;angleQ12=desiredAngleQ12;}
  } else position=candidate;
  if(position[0]<0)position[0]=environment.pixelWidth*4096;
  else if(position[0]>environment.pixelWidth*4096)position[0]=0;
  return {...input,positionQ12:position,destinationQ12:destination,directionQ12:direction,mode,ticks,threshold,angleQ12,desiredAngleQ12,flipBits};
}
export function nativeRaisingMovementArrived(actor) {
  return actor.mode===0 ? nativeVectorLengthQ12(actor.positionQ12.map((n,i)=>n-actor.destinationQ12[i]))<20480 : actor.ticks<=0;
}
