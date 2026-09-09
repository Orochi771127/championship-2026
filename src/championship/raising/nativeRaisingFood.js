// Original food records and OVL18 food station selection. Application-owned;
// no inventory, renderer, save key or clock is created here.
const offsets=Object.freeze([[-16,-4],[16,-4],[16,4],[-16,4]].map(Object.freeze));
export function nativeFoodStation(food,index) {
  if(!Number.isInteger(index)||index<0||index>3)throw new TypeError("INVALID_NATIVE_FOOD_STATION");
  return [food.positionQ12[0]+offsets[index][0]*4096,food.positionQ12[1]+offsets[index][1]*4096,0];
}
export function selectNativeFoodStation(food,positionQ12) {
  const x=positionQ12[0]>>12,y=positionQ12[1]>>12,fx=food.positionQ12[0]>>12,fy=food.positionQ12[1]>>12;
  const allowed=new Set([...(x<fx?[0,3]:[1,2]),...(y<fy?[0,1]:[2,3])]);
  let best=-1,distance=0;
  for(let i=0;i<4;i++) {
    if(food.occupants[i]!==null||!allowed.has(i))continue;
    const dx=fx+offsets[i][0]-x,dy=fy+offsets[i][1]-y,d=dx*dx+dy*dy;
    if(distance===0||d<distance){distance=d;best=i;}
  }
  return best;
}
export function findNativeRaisingFood(profile,positionQ12,foods,cageDefinitionIndex,satietyMaximum) {
  if(profile.fields["138"]===1 || (profile.fields["008"]|0)>=satietyMaximum)return null;
  let selected=null,distance=0;
  for(const food of foods) {
    if(!food.present||food.cageDefinitionIndex!==cageDefinitionIndex)continue;
    const dx=(food.positionQ12[0]>>12)-(positionQ12[0]>>12),dy=(food.positionQ12[1]>>12)-(positionQ12[1]>>12),d=dx*dx+dy*dy;
    if(distance===0||d<distance){distance=d;selected=food;}
  }
  if(!selected)return null;
  const station=selectNativeFoodStation(selected,positionQ12);
  return {food:selected,station,target:station<0?null:nativeFoodStation(selected,station)};
}
export function createNativeRaisingFood({slot,cageDefinitionIndex,positionQ12,protein=false,kind=protein?1:0,remaining=kind===2?32:16,freshness=1440,restored=false,heightQ12=65536}) {
  return {slot,cageDefinitionIndex,positionQ12:[...positionQ12],protein:kind===1,kind,remaining,freshness,present:true,
    occupants:[null,null,null,null],counter:0,heightQ12:restored?0:heightQ12,velocityQ12:0,falling:!restored};
}
export function stepNativeRaisingFood(food,ageDelta) {
  if(!food.present)return {search:false,landed:false};
  let landed=false;
  if(food.falling) {
    food.velocityQ12=Math.min(20480,food.velocityQ12+2048);food.heightQ12-=food.velocityQ12;
    if((food.heightQ12>>12)<0) {
      if((food.velocityQ12>>12)===0){food.falling=false;food.heightQ12=0;landed=true;}
      else if(food.velocityQ12>0)food.velocityQ12=-(food.velocityQ12-4096);
    }
  }
  if(food.freshness<=0)return {search:false,landed};
  food.freshness=Math.max(0,food.freshness-ageDelta);
  if(food.freshness===0)return {search:false,landed};
  food.counter=(food.counter+1)&65535;
  const search=food.counter>=30;if(search)food.counter=0;
  return {search,landed};
}
export function foodVisualQuarter(food) {
  const scale=food.kind===2?2:1;
  return food.remaining>12*scale?0:food.remaining>8*scale?1:food.remaining>4*scale?2:3;
}

// OVL18 0210D354..0210D56C. The third argument is initial falling height,
// not food quantity. Special foods occupy slots 10..15 in the same pool.
export function nativeRaisingFeast(value){
  return ({1:[[2,100]],2:[[2,100],[2,150],[2,200]],3:[[2,100],[3,150],[2,200],[3,250],[2,300]],
    4:[[3,100]],5:[[3,100],[3,150],[3,200]]})[value]??[];
}
