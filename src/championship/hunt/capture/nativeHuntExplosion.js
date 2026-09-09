import {nativeNormalizeQ12,nativeVectorLengthQ12} from './nativeCapturePhases.js';
import {nativeToolDamage,nativeToolEffectiveness,nativeBombParameters} from './nativeHuntToolRules.js';
const Q=4096;
const normalize=v=>v.some(Boolean)?nativeNormalizeQ12(v):[0,0,0];

// AI15 02112908. Distance determines the impulse. Source HP is divided before
// damage multiplication; combat HP is independent of the captured individual.
export function enterNativeExplosion(a,event){
  const vector=[a.positionQ12[0]-event.positionQ12[0],a.positionQ12[1]-event.positionQ12[1],0];
  let reach=128-(nativeVectorLengthQ12(vector)>>12);if(reach<0)reach=1;
  const normal=normalize(vector);
  return {...a,explosionPhase:0,explosionEvent:event,
    velocityQ12:[normal[0]*(reach>>4),normal[1]*(reach>>4),Math.trunc(reach/128)*Q],
    currentHp:Math.max(0,a.currentHp-nativeToolDamage(event.kind,event.itemIndex,a.speciesIndex,a.maxHp,a))};
}

// AI15 phase0 021125F8..02112820. The vertical velocity participates in
// normalization during ground friction. Replacing this with 2D damping drifts.
export function stepNativeExplosionMotion(a,isBlocked){
  let velocity=[...a.velocityQ12],p;
  if(nativeVectorLengthQ12(velocity)>0){const n=normalize(velocity);velocity[0]-=n[0]>>2;velocity[1]-=n[1]>>2;}
  velocity[2]-=2048;p=a.positionQ12.map((n,i)=>n+velocity[i]);
  const grounded=p[2]<=0;
  if(grounded){
    p[2]=0;velocity[2]=-(velocity[2]>>1);
    if(velocity.some(Boolean)){const n=normalize(velocity);velocity[0]-=n[0]>>1;velocity[1]-=n[1]>>1;}
  }
  if(p[2]<20*Q && isBlocked(...p.slice(0,2).map(n=>Math.trunc((n>>12)/8)))){
    velocity[0]=-velocity[0];velocity[1]=-velocity[1];p[0]=a.positionQ12[0];p[1]=a.positionQ12[1];
  }
  velocity=velocity.map((n,i)=>n>-[2048,2048,1229][i]&&n<[2048,2048,1229][i]?0:n);
  const stopped=grounded&&velocity.every(n=>n===0);
  return {...a,positionQ12:p,velocityQ12:velocity,explosionPhase:stopped?1:0,counter:stopped?0:a.counter};
}

// 0210EC7C's shared sleep/stun/flash result. Mine has no secondary status.
export function applyNativeExplosionStatus(a,event,host){
  if(event.kind!=='BOMB')return 1;
  const row=nativeBombParameters(event.itemIndex);
  if(row.statusSelector===1){
    const effect=nativeToolEffectiveness(a.speciesIndex,8,a);
    if(effect<=1||effect===2&&host.nextChannel(0xb2)%2===0)a.awakeCounter=Math.trunc(a.maxAwakeCounter/10)*8;
  }else if(row.statusSelector===2){
    const effect=nativeToolEffectiveness(a.speciesIndex,10,a);
    if(effect<=1||effect===2&&host.nextChannel(0xb3)%2===0)return 17;
  }else if(row.statusSelector===3){
    const column=Math.max(0,nativeToolEffectiveness(a.speciesIndex,11,a)-1);
    if(host.wildRandom(0x7fff)%100<row.blindPercent[column]){
      a.blinded=1;a.blindTicks=(host.wildRandom(20)+10)*60;
    }
  }
  return 1;
}

export function stepNativeExplosionDecision(a,host){
  if(a.explosionPhase===0){Object.assign(a,stepNativeExplosionMotion(a,host.environment.isBlocked));return -1;}
  if(a.explosionPhase===1){
    const c=Math.max(0,nativeToolEffectiveness(a.speciesIndex,2,a)-1);
    a.explosionPhase=[2,3,4][c];a.counter=0;return -1;
  }
  if(a.explosionPhase===2||a.explosionPhase===3){
    a.counter=(a.counter+1)&0xffff;
    if(a.counter>(a.explosionPhase===2?180:60))a.explosionPhase=4;
    return -1;
  }
  return applyNativeExplosionStatus(a,a.explosionEvent,host);
}
