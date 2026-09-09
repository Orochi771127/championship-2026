import {nativeToolAnimation} from './nativeHuntToolRules.js';
import {enterNativeExplosion,stepNativeExplosionDecision,applyNativeExplosionStatus} from './nativeHuntExplosion.js';
import tables from '../../../data/championship/battleHitTables.json' with {type:'json'};
const Q=4096,px=v=>v.slice(0,2).map(n=>n>>12);
const range=(a,b,r)=>px(a).reduce((s,n,i)=>s+(n-px(b)[i])**2,0)<r*r;
const ticks=(kind,index,sequence)=>nativeToolAnimation(kind,index,sequence).ticks.reduce((a,b)=>a+b,0);

// OVL0 02121444 / 02124A20. Each controller shares its ushort counter across
// its ten slots. Per-slot fuse timers would change simultaneous placements.
export function createNativeHuntHazards(host,{consume,request}){
  const pools={BOMB:Array(10).fill(null),MINE:Array(10).fill(null)},counters={BOMB:0,MINE:0};
  let brightness=0,brightnessTarget=0;
  const advance=kind=>(counters[kind]=(counters[kind]+1)&0xffff);
  const reset=kind=>{counters[kind]=0;};
  function pulse(h,code){
    const event={code,kind:h.kind,itemIndex:h.item.nativeItemIndex,positionQ12:[...h.positionQ12]};
    for(const a of host.actors)if(a.actorActive&&!a.hidden)a.events.push({...event});
  }
  function particle(h,index){
    const offset=Math.trunc(6552*host.nextChannel(0xb2)/102),radius=host.nextChannel(0xb3)%80+10;
    const angle=Math.trunc(index*0x23ffdc/360)+offset,i=(angle>>4)*2;
    return {started:true,remaining:ticks(h.kind,h.item.nativeItemIndex,2),sequence:2,
      positionQ12:[h.positionQ12[0]+tables.sinCos[i]*radius,h.positionQ12[1]+tables.sinCos[i+1]*radius,0]};
  }
  function secondary(h,count,sequence,centerFirst){
    return Array.from({length:count},(_,index)=>{
      let dx=0,dy=0;
      if(!centerFirst||index){
        dx=host.nextChannel(0xb2)%16+16;dy=host.nextChannel(0xb3)%16+16;
        if(host.nextChannel(0)%2===0)dx=-dx;if(host.nextChannel(0)%2===0)dy=-dy;
      }
      return {started:false,remaining:ticks(h.kind,h.item.nativeItemIndex,sequence),sequence,
        positionQ12:[h.positionQ12[0]+dx*Q,h.positionQ12[1]+dy*Q,0]};
    });
  }
  const startNext=list=>{const p=list.find(p=>!p.started);if(p)p.started=true;};
  function burst(h){
    if(counters[h.kind]%5===0)startNext(h.large.slice(1));
    if(counters[h.kind]%3===0)startNext(h.small);
    if(h.spawnEnabled){const index=h.particles.findIndex(p=>p===null);if(index>=0&&index<10)h.particles[index]=particle(h,index);}
    if(h.particles[0]?.remaining===0)h.spawnEnabled=false;
    const counter=advance(h.kind);
    if(counter>40){h.state=h.kind==='BOMB'?7:8;reset(h.kind);}
    if(h.kind==='BOMB'&&counters.BOMB===10)pulse(h,0x3a);
  }
  function cleanup(h){
    if([...h.large,...h.small,...h.particles].every(p=>!p||!p.started||p.remaining===0))h.state=0;
  }
  function step(h){
    if(h.state===2){h.state=3;reset(h.kind);}
    else if(h.kind==='BOMB'){
      if(h.state===3){if(advance('BOMB')>240){h.state=4;reset('BOMB');}}
      else if(h.state===4){if(advance('BOMB')>5){h.state=5;reset('BOMB');if(h.item.nativeItemIndex===3)counters.BOMB=5;else h.large[0].started=true;}}
      else if(h.state===5){if(advance('BOMB')>5){reset('BOMB');h.state=h.item.nativeItemIndex===3?8:6;if(h.state===6)pulse(h,0x35);}}
      else if(h.state===6)burst(h);
      else if(h.state===7)cleanup(h);
      else if(h.state===8){brightnessTarget=1600;h.state=9;}
      else if(h.state===9&&brightness===brightnessTarget){h.state=10;reset('BOMB');pulse(h,0x37);}
      else if(h.state===10&&advance('BOMB')>4){brightnessTarget=0;brightness=0;h.state=0;}
    }else{
      if(h.state===4){h.state=6;reset('MINE');h.large[0].started=true;}
      else if(h.state===6&&advance('MINE')!==0){reset('MINE');h.state=7;pulse(h,0x35);}
      else if(h.state===7)burst(h);
      else if(h.state===8)cleanup(h);
    }
    for(const p of [...h.large,...h.small,...h.particles])if(p?.started&&p.remaining>0)p.remaining--;
  }
  return {
    place(item,p){
      const kind=item.nativeSubcategory;
      if(host.environment.readTerrain(...px(p).map(n=>Math.trunc(n/8)))===1){host.emit('BLOCKED_TERRAIN');return false;}
      const slot=pools[kind].findIndex(h=>!h||h.state===0);if(slot<0){host.emit('TOOL_POOL_FULL');return false;}
      if(!consume(item))return false;
      const h={kind,item,positionQ12:[...p],state:2,particles:Array(20).fill(null),spawnEnabled:true};
      h.large=secondary(h,5,3,true);h.small=secondary(h,3,4,false);pools[kind][slot]=h;reset(kind);return true;
    },
    tick(){
      if(brightness<brightnessTarget)brightness=Math.min(brightness+200,brightnessTarget);
      for(const kind of ['BOMB','MINE'])for(const h of pools[kind])if(h&&h.state>0)step(h);
    },
    triggerMine(p){
      for(const h of pools.MINE){
        if(h?.state!==3)continue;
        const b=nativeToolAnimation('MINE',h.item.nativeItemIndex),[x,y]=px(p),[hx,hy]=px(h.positionQ12);
        if(x>hx-(b.width>>1)&&x<hx+(b.width>>1)&&y>hy-(b.height>>1)&&y<hy+(b.height>>1)){h.state=4;return true;}
      }
      return false;
    },
    decision(a,events){
      const admitted=[1,2,3,4,5,8,9,13,14,15,17,18,19].includes(a.aiState);
      if(admitted){
        const impact=events.find(e=>e.code===0x35&&range(a.positionQ12,e.positionQ12,96));
        if(impact){a.explosionEvent=impact;return 15;}
      }
      if(a.aiState===15)return stepNativeExplosionDecision(a,host);
      if(admitted){
        const secondary=events.find(e=>(e.code===0x3a||e.code===0x37)&&range(a.positionQ12,e.positionQ12,e.code===0x37?256:96));
        if(secondary)return applyNativeExplosionStatus(a,secondary,host);
      }
      return -1;
    },
    enter(a,id){if(id!==15)return false;Object.assign(a,enterNativeExplosion(a,a.explosionEvent));request(a,15);return true;},
    getObjects(){
      const objects=[];
      for(const kind of ['BOMB','MINE'])for(const h of pools[kind]){
        if(!h||h.state===0)continue;
        if(h.state<=4)objects.push({kind,x:h.positionQ12[0]/2048,y:h.positionQ12[1]/2048,itemIndex:h.item.nativeItemIndex,state:h.state});
        for(const p of [...h.large,...h.small,...h.particles])if(p?.started&&p.remaining>0)objects.push({kind:'TOOL_BURST',
          sourceKind:kind,itemIndex:h.item.nativeItemIndex,sequence:p.sequence,x:p.positionQ12[0]/2048,y:p.positionQ12[1]/2048,remaining:p.remaining});
      }
      if(brightness>0)objects.push({kind:'FLASH',alpha:brightness/1600});
      return objects;
    }
  };
}
