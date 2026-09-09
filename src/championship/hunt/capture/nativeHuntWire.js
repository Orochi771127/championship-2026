import {battleNativeSegmentContact} from '../../battle/battleProjectileContact.js';
import {nativeNormalizeQ12,nativeVectorLengthQ12} from './nativeCapturePhases.js';
import {nativeWireParameters,nativeToolEffectiveness,nativeToolDamage} from './nativeHuntToolRules.js';
const Q=4096,px=v=>v.slice(0,2).map(n=>n>>12);
const mul=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a)*BigInt(b)+2048n)>>12n));
const sub=(a,b)=>a.map((n,i)=>(n-b[i])|0);
const box=w=>[Math.min(w.start[0],w.end[0]),Math.min(w.start[1],w.end[1]),Math.max(w.start[0],w.end[0]),Math.max(w.start[1],w.end[1])];

// 02122DC0. Intersections return whole-pixel coordinates after the native
// Q12 divide/multiply, including the original collinear endpoint branch.
export function nativeWireIntersection(a,b,c,d){
  const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1];
  const det=(Math.imul(dx,ey)-Math.imul(dy,ex))|0;
  if(det===0){
    const first=(c[0]-b[0])**2+(c[1]-b[1])**2;
    const second=(c[1]-b[1])**2+(d[1]-b[1])**2;
    return [...(first>second?c:d).map(n=>n*Q),0];
  }
  const numerator=(Math.imul(c[0]-a[0],ey)-Math.imul(c[1]-a[1],ex))|0;
  const quotient=BigInt(numerator)*4294967296n/BigInt(det);
  const ratio=Number(BigInt.asIntN(32,(quotient+0x80000n)>>20n));
  return [(a[0]+(mul(ratio,dx*Q)>>12))*Q,(a[1]+(mul(ratio,dy*Q)>>12))*Q,0];
}

// 02123378 checks the side facing the origin: X first, then Y. It is not a
// nearest point projection and must not select a different clipping edge.
export function clipNativeWireBox(w,rectangle){
  const a=px(w.start),b=px(w.end),[lx,ly,hx,hy]=rectangle;
  const edges=[];
  if(lx>a[0])edges.push([[lx,ly],[lx,hy]]);
  else if(hx<a[0])edges.push([[hx,ly],[hx,hy]]);
  if(ly>a[1])edges.push([[lx,ly],[hx,ly]]);
  else if(hy<a[1])edges.push([[lx,hy],[hx,hy]]);
  for(const [c,d] of edges)if(battleNativeSegmentContact(a,b,c,d)){
    w.end=nativeWireIntersection(a,b,c,d);return true;
  }
  return false;
}

export function createNativeHuntWire(host,{consume,request}){
  const wires=[null,null];let preview=null,lastCommitted=-1;
  const blocked=p=>host.environment.readTerrain(...px(p).map(n=>Math.trunc(n/8)))===1;
  function clip(w){
    for(const a of host.actors){
      if(!a.actorActive||a.hidden)continue;
      const [x,y]=a.positionQ12,width=a.bounds.rect[2]-a.bounds.rect[0]-10,height=5-a.bounds.rect[1];
      const [lx,ly,hx,hy]=box(w);
      if(x+width*Q/2<=lx||x-width*Q/2>=hx||y<=ly||y-(height>>1)*Q>=hy)continue;
      const dist=px(a.positionQ12).reduce((s,n,i)=>s+(n-px(w.start)[i])**2,0);
      if(dist<100){w.cancelled=true;w.state=0;return;}
      clipNativeWireBox(w,[(x>>12)-(width>>1),(y>>12)-(height>>1),(x>>12)+(width>>1),(y>>12)+8]);
    }
    const delta=sub(w.end,w.start),count=Math.trunc((nativeVectorLengthQ12(delta)>>12)/4);
    if(delta.some(Boolean)){
      const direction=nativeNormalizeQ12(delta).map(n=>n*4);let p=[...w.start],last=[0,0];
      for(let i=0;i<count;i++){
        p=p.map((n,j)=>n+direction[j]);const xy=px(p);
        if(xy[0]===last[0]&&xy[1]===last[1])continue;
        last=xy;
        if(blocked(p)){clipNativeWireBox(w,[xy[0]-1,xy[1]-1,xy[0]+9,xy[1]+9]);break;}
      }
    }
    for(const other of wires)if(other&&other!==w&&other.state===5
      &&battleNativeSegmentContact(px(w.start),px(w.end),px(other.start),px(other.end)))other.state=0;
  }
  return {
    begin(item){
      if(item.quantity<=0){host.emit('EMPTY');return false;}
      if(wires.every(w=>w?.state===5))wires[1-lastCommitted]=null;
      const slot=wires.findIndex(w=>!w||w.state===0);
      if(slot<0)return false;
      preview={item,slot,state:2,start:null,end:null};wires[slot]=preview;return true;
    },
    tick(pointer){
      for(const w of wires){
        if(!w)continue;
        if(w.state===5){if(--w.remaining<0)w.state=0;continue;}
        if(w.state===4){
          if(consume(w.item)){w.state=5;w.remaining=600;lastCommitted=w.slot;}else w.state=0;
          continue;
        }
        if(w!==preview)continue;
        if(!pointer||pointer.kind!=='WIRE'){w.state=0;preview=null;continue;}
        if(w.state===2){
          if(pointer.released){w.state=0;preview=null;continue;}
          if(blocked(pointer.q12))continue;
          w.start=[...pointer.q12];w.end=[...pointer.q12];w.state=3;continue;
        }
        const delta=sub(pointer.q12,w.start),max=nativeWireParameters(w.item.nativeItemIndex,0).maxLength;
        w.end=(nativeVectorLengthQ12(delta)>>12)<max?[...pointer.q12]
          :nativeNormalizeQ12(delta).map((n,i)=>w.start[i]+n*max);
        clip(w);
        if(w.cancelled){preview=null;continue;}
        const [lx,ly,hx,hy]=box(w);w.valid=((hx-lx)>>12)**2+((hy-ly)>>12)**2>1024&&!w.cancelled;
        if(pointer.released){w.state=w.valid?4:0;preview=null;}
      }
    },
    cancel(){if(preview){preview.state=0;preview=null;}},
    collide(a,p){
      let width=(a.bounds.rect[2]-a.bounds.rect[0]-10)*Q,height=(5-a.bounds.rect[1])*Q;
      for(const w of wires){
        if(w?.state!==5)continue;
        const index=w.item.nativeItemIndex,parameters=nativeWireParameters(index,a.speciesIndex,a);
        if(parameters.kind==='BIND'){width>>=1;height>>=1;}
        const [lx,ly,hx,hy]=box(w),[x,y]=p;
        if(x+(width>>1)<=lx||x-(width>>1)>=hx||y<=ly||y-height>=hy)continue;
        if(!battleNativeSegmentContact(px(w.start),px(w.end),[(x-(width>>1))>>12,y>>12],[(x+(width>>1))>>12,y>>12]))continue;
        if(parameters.kind==='BLOCK'){
          // ARM9 02066AA8 = (B-A) cross ((P-A) cross (B-A)),
          // returned reversed by 02123794. Preserve the Q12 cross stages.
          const ab=sub(w.end,w.start),ap=sub(p,w.start);
          const cross=(u,v)=>[mul(u[1],v[2])-mul(u[2],v[1]),mul(u[2],v[0])-mul(u[0],v[2]),mul(u[0],v[1])-mul(u[1],v[0])];
          const normal=cross(ab,cross(ab,ap));
          const outward=normal.some(Boolean)?nativeNormalizeQ12(normal).map(n=>-n):normal;
          return {obstacle:1,destinationQ12:a.positionQ12.map((n,i)=>n+outward[i]*32),nextAi:a.aiState!==8&&a.currentHp>0?3:null};
        }
        if(parameters.kind==='BIND'){
          a.bindingTicks=parameters.bindingTicks;
          return {obstacle:2,nextAi:a.currentHp>0?(nativeToolEffectiveness(a.speciesIndex,12,a)<=2?13:1):null};
        }
        a.currentHp=Math.max(0,a.currentHp-nativeToolDamage('WIRE',index,a.speciesIndex,a.maxHp,a));
        return {obstacle:3,destinationQ12:[...a.positionQ12],nextAi:a.currentHp>0?(nativeToolEffectiveness(a.speciesIndex,10,a)<=2?14:1):null};
      }
      return {obstacle:0,nextAi:null};
    },
    enter(a,id){
      if(id===13){a.drowsy=0;a.counter=0;request(a,11);return true;}
      if(id===14){a.shake={ticks:30,shakeX:1,shakeY:0,toggle:0};request(a,6);return true;}
      return false;
    },
    preDecision(a){
      if(a.aiState!==14)return -1;
      if(a.shake?.ticks===0)return 17;
      if(a.currentHp<=0){host.stopRope(a);a.returnAiState=11;return 10;}
      return -1;
    },
    decision(a){
      if(a.aiState!==13)return -1;
      if(a.counter>a.bindingTicks){a.counter=0;a.facing=1-a.facing;}
      return wires.some(w=>w?.state===5)?-1:1;
    },
    getObjects:()=>wires.filter(w=>w&&w.state>=3).map(w=>({kind:'WIRE',from:w.start.slice(0,2).map(n=>n/2048),
      to:w.end.slice(0,2).map(n=>n/2048),state:w.state,valid:w.valid,itemIndex:w.item.nativeItemIndex}))
  };
}
