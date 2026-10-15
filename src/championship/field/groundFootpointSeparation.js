// OWNER_APPROVED_ADAPTATION: bounded ordinary-ground crowd spacing, not ROM
// shared physics. No RNG, clock, save state, body bounds or attack AABB.
const Q12=4096;
const wrap=(x,width)=>width>0?((x%width)+width)%width:x;
const dx=(a,b,width)=>{let n=b-a;if(width>0){if(n>width/2)n-=width;if(n<-width/2)n+=width;}return n;};
const zeroDirections=[[4096,0],[2896,2896],[0,4096],[-2896,2896],[-4096,0],[-2896,-2896],[0,-4096],[2896,-2896]];

// Check the short actual path, including both sides of a crossed tile corner.
// canStand must be a side-effect-free owner terrain/cage query.
export function canTraverseGroundStep(from,to,{canStand,wrapXQ12=0}){
  const x=dx(from[0],to[0],wrapXQ12),y=to[1]-from[1],steps=Math.max(1,Math.ceil(Math.max(Math.abs(x),Math.abs(y))/Q12));
  let prior=from;
  for(let i=1;i<=steps;i++){
    const p=[wrap(from[0]+Math.trunc(x*i/steps),wrapXQ12),from[1]+Math.trunc(y*i/steps),from[2]];
    if(!canStand(p)||!canStand([p[0],prior[1],p[2]])||!canStand([prior[0],p[1],p[2]]))return false;
    prior=p;
  }
  return true;
}

export function separateGroundFootpoints(entries,{canPlace,wrapXQ12=0,radiusQ12=8*Q12,maxCorrectionQ12=2*Q12,passes=2}={}){
  const points=entries.map(e=>[...e.positionQ12]),spent=entries.map(()=>0);
  const order=entries.map((_,i)=>i).sort((a,b)=>entries[a].poolSlot-entries[b].poolSlot);
  const diameter=radiusQ12*2;
  function move(i,x,y,amount){
    const budget=Math.max(0,maxCorrectionQ12-spent[i]);amount=Math.min(Math.ceil(amount),budget);
    if(amount<=0||entries[i].movable===false)return;
    const length=Math.sqrt(x*x+y*y);let ox=Math.trunc(x*amount/length),oy=Math.trunc(y*amount/length);
    if(!ox&&!oy){if(Math.abs(x)>=Math.abs(y))ox=Math.sign(x);else oy=Math.sign(y);}
    const cost=Math.ceil(Math.sqrt(ox*ox+oy*oy));if(!cost||cost>budget)return;
    const p=[wrap(points[i][0]+ox,wrapXQ12),points[i][1]+oy,points[i][2]];
    if(canPlace&&!canPlace(entries[i],p,points[i]))return;
    points[i]=p;spent[i]+=cost;
  }
  for(let pass=0;pass<Math.min(2,passes);pass++)for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
    const i=order[a],j=order[b],left=entries[i],right=entries[j];
    if(left.group!==right.group||left.movable===false&&right.movable===false)continue;
    let x=dx(points[i][0],points[j][0],wrapXQ12),y=points[j][1]-points[i][1];
    const distance=Math.sqrt(x*x+y*y);if(distance>=diameter)continue;
    if(distance===0)[x,y]=zeroDirections[(left.poolSlot*3+right.poolSlot*5)&7];
    const amount=(diameter-distance)/(left.movable===false||right.movable===false?1:2);
    move(i,-x,-y,amount);move(j,x,y,amount);
  }
  let unresolved=0;
  for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
    const i=order[a],j=order[b];if(entries[i].group!==entries[j].group)continue;
    const x=dx(points[i][0],points[j][0],wrapXQ12),y=points[j][1]-points[i][1];if(x*x+y*y<diameter*diameter)unresolved++;
  }
  return {points,correctionQ12:spent,changed:spent.some(Boolean),unresolved};
}
