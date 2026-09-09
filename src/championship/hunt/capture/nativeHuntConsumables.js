// Tool controllers owned by the current Hunt. Inventory/RNG/AI remain the host's.
import { nativeMeatParameters,nativeAttractionPercent,stepNativeFoodBite,
  nativeShotParameters,nativeShotSpeciesResponse,nativeToolAnimation } from './nativeHuntToolRules.js';
import {createNativeHuntLures} from './nativeHuntLures.js';
import {createNativeHuntWire} from './nativeHuntWire.js';
import {createNativeHuntHazards} from './nativeHuntHazards.js';
import { nativeHuntSpeciesByIndex } from './nativeHuntSources.js';
import { queryNativeHuntActors } from './nativeWildSpatial.js';
const Q12=4096;
const distanceSq=(a,b)=>a.slice(0,2).reduce((s,n,i)=>s+((n>>12)-(b[i]>>12))**2,0);

// 021224C4: up to seven pellets, ten shared primary slots, centre first;
// B2/B3 draws occur even after the last pellet. The incoming response byte is
// supplied by the host's explicit response policy, never read from arbitrary state.
export function nativeHuntScatterPoints(positionQ12,availableSlots,nextChannel){
  const result=[];let point=[...positionQ12];
  for(let i=0;i<Math.min(7,availableSlots);i++){
    result.push(point);
    point=[positionQ12[0]+(nextChannel(0xb2)%32-16)*Q12,positionQ12[1]+(nextChannel(0xb3)%32-16)*Q12,0];
  }
  return result;
}

export function createNativeHuntConsumables(host,{equipped,consumeItem,request}) {
  const foods=Array(10).fill(null);
  const shots=Array(10).fill(null);
  let shotCooldown=0;
  const consume=item=>{const result=consumeItem(item.itemId,1);if(!result.ok)host.emit(result.reason);return result.ok;};
  const lures=createNativeHuntLures(host,{consume,request});
  const wire=createNativeHuntWire(host,{consume,request});
  const hazards=createNativeHuntHazards(host,{consume,request});
  host.triggerMine=hazards.triggerMine;
  function tool(kind){return ['SHOT','WIRE','ENTRAP','DAMAGE_TRAP'].map(equipped).find(i=>i?.nativeSubcategory===kind);}
  function seekFood(a) {
    if(!foods.some(f=>f?.active))return;
    if(a.satiety>Math.trunc(nativeHuntSpeciesByIndex(a.speciesIndex).field1c/2))return;
    const meat=tool('MEAT');
    if(meat && host.nextChannel(0xb2)%100<nativeAttractionPercent('MEAT',meat.nativeItemIndex,a))a.seekingFood=1;
  }
  function foodDestination(a) {
    if(!a.seekingFood)return null;
    let best=null,distance=Infinity;
    for(const f of foods) {
      if(!f?.active || f.nutrition<=0)continue;
      const d=distanceSq(a.positionQ12,f.positionQ12);
      if(d<nativeMeatParameters(f.itemIndex).radius**2 && d<distance){best=f;distance=d;}
    }
    if(!best){a.foodTarget=null;return null;}
    a.foodTarget=best;
    return [best.positionQ12[0]+(a.positionQ12[0]<best.positionQ12[0]?-16:16)*Q12,best.positionQ12[1],0];
  }
  function preDecision(a) {
    const early=wire.preDecision(a);if(early>=0)return early;
    if(a.aiState!==5)return -1;
    if(!a.foodTarget)return 1;
    const result=stepNativeFoodBite(a,a.foodTarget,a.animator.getSnapshot().frameIndex,host.nextChannel,
      nativeHuntSpeciesByIndex(a.speciesIndex).field1c);
    Object.assign(a,result.state);Object.assign(a.foodTarget,result.food);
    return result.nextAi;
  }
  function enterToolState(a,id) {
    if(hazards.enter(a,id))return;
    if(wire.enter(a,id))return;
    if(id===16){lures.enterCaptureTrap(a);return;}
    if(id!==5)throw Error(`NATIVE_HUNT_TOOL_STATE_REQUIRED:${id}`);
    a.biteLatch=0;request(a,14);a.facing=a.positionQ12[0]<a.foodTarget.positionQ12[0]?1:0;
  }
  return {
    seekFood,foodDestination,preDecision,enterToolState,
    toolDecision(a,events){
      const blast=hazards.decision(a,events);if(blast>=0)return blast;
      const next=lures.toolDecision(a,events);return next>=0?next:wire.decision(a);
    },
    queryControllers(a,p){
      const result=wire.collide(a,p);hazards.triggerMine(p);
      return {...result,secondaryBlocked:lures.captureTrapCollision(a,p),sideEffectsClosed:true};
    },
    canEat:a=>!!a.foodTarget?.active,
    canUse(kind){const item=equipped(kind);return !!item && (['MEAT','DECOY','LIGHT','CAPTURE_TRAP','WIRE','BOMB','MINE'].includes(item.nativeSubcategory)
      || item.nativeSubcategory==='SHOT'&&(!nativeShotParameters(item.nativeItemIndex).spread||typeof host.scatterResponse==='function'));},
    use(item,positionQ12) {
      if(['BOMB','MINE'].includes(item.nativeSubcategory))return hazards.place(item,positionQ12);
      if(item.nativeSubcategory==='WIRE')return wire.begin(item);
      if(['DECOY','LIGHT','CAPTURE_TRAP'].includes(item.nativeSubcategory))return lures.place(item,positionQ12);
      if(item.nativeSubcategory==='MEAT') {
        const index=foods.findIndex(f=>!f?.active);
        if(index<0){host.emit('FOOD_POOL_FULL');return false;}
        if(!consume(item))return false;
        foods[index]={kind:'MEAT',itemIndex:item.nativeItemIndex,positionQ12:[...positionQ12],
          nutrition:nativeMeatParameters(item.nativeItemIndex).nutrition,active:true};
        return true;
      }
      if(item.nativeSubcategory==='SHOT') {
        const row=nativeShotParameters(item.nativeItemIndex);
        if(row.spread&&typeof host.scatterResponse!=='function' || shotCooldown>0)return false;
        shotCooldown=row.cooldownTicks;
        if(!consume(item))return false;
        const points=row.spread?nativeHuntScatterPoints(positionQ12,shots.filter(s=>!s||s.remaining===0).length,host.nextChannel):[positionQ12];
        for(const point of points){
          const a=queryNativeHuntActors(host.actors,point,[0,0,0,0]).at(-1);
          if(a)a.events.push({code:0x2e,strength:row.impactStrength,statusSelector:row.statusSelector,
            response:row.spread?host.scatterResponse(a):nativeShotSpeciesResponse(a.speciesIndex)});
          const slot=shots.findIndex(s=>!s||s.remaining===0);
          if(slot<0)continue;
          const remaining=nativeToolAnimation('SHOT',row.statusSelector,0).ticks.reduce((n,v)=>n+v,0);
          shots[slot]={positionQ12:[...point],remaining,hit:!!a,status:row.statusSelector};
        }
        return true;
      }
      return false;
    },
    tick(pointer,activeTool){
      const shotCooling=shotCooldown>0;
      for(const shot of shots)if(shot?.remaining>0)shot.remaining--;
      if(shotCooldown>0)shotCooldown--;
      lures.tick();
      hazards.tick();
      if(pointer?.fresh){pointer.fresh=false;if(activeTool!=='SHOT'||!shotCooling)this.use(equipped(activeTool),pointer.q12);}
      else if(pointer?.kind==='SHOT'&&!pointer.released&&activeTool==='SHOT'&&!shotCooling)this.use(equipped('SHOT'),pointer.q12);
      wire.tick(pointer);
    },
    cancel:wire.cancel,
    getObjects:()=>[...shots.filter(s=>s?.remaining>0).map(s=>({kind:'SHOT_IMPACT',x:s.positionQ12[0]/2048,y:s.positionQ12[1]/2048,
      hit:s.hit,status:s.status,remaining:s.remaining})),...hazards.getObjects(),...wire.getObjects(),...lures.getObjects(),...foods.filter(f=>f?.active).map(f=>({kind:f.kind,x:f.positionQ12[0]/2048,y:f.positionQ12[1]/2048,
      itemIndex:f.itemIndex,tier:Math.max(0,Math.ceil(f.nutrition/(nativeMeatParameters(f.itemIndex).nutrition/4))-1)}))]
  };
}
