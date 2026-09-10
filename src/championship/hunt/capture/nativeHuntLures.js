import {nativeAttractionPercent,nativeToolAnimation,nativeHuntToolSpecies} from './nativeHuntToolRules.js';
import {nativeNormalizeQ12} from './nativeCapturePhases.js';
const Q12=4096;
// Original ARM 02002A6C zero-input result is [0,0,0] in controls-cpu.json.
const normalize=v=>v.some(Boolean)?nativeNormalizeQ12(v):[0,0,0];
const distanceSq=(a,b)=>a.slice(0,2).reduce((s,n,i)=>s+((n>>12)-(b[i]>>12))**2,0);
const blocked=(host,p)=>host.environment.readTerrain(...p.slice(0,2).map(n=>Math.trunc((n>>12)/8)))===1;

// Native kind 5 = moving decoy, kind 6 = stationary night light. The raw
// controller globals have no English names; do not derive identity from them.
export function createNativeHuntLures(host,{consume,request}) {
  const decoy={active:false,state:0,positionQ12:[0,0,0]},light={active:false};
  let trap=null;
  // These two aliases preserve the existing AI field names (1A0 versus 1A4).
  host.light=decoy;host.decoy=light;
  function launch(destination) {
    if(!consume(decoy.item)){decoy.active=false;decoy.state=0;return;}
    const delta=destination.map((n,i)=>n-decoy.positionQ12[i]);
    decoy.directionQ12=normalize(delta).map(n=>Math.trunc(n/2)||0);
    decoy.state=2;decoy.active=true;decoy.timer=0;decoy.interval=host.nextChannel(0xb2)%10+55;
  }
  function pulse(code,p){for(const a of host.actors)if(a.actorActive&&!a.hidden)a.events.push({code,positionQ12:[...p]});}
  return {
    place(item,p) {
      if(item.nativeSubcategory==='DECOY'&&decoy.state===1){launch(p);return true;}
      if(blocked(host,p)){host.emit('BLOCKED_TERRAIN');return false;}
      if(item.quantity<=0){host.emit('EMPTY');return false;}
      if(item.nativeSubcategory==='DECOY') {
        if(decoy.state!==0)return false;
        Object.assign(decoy,{active:false,state:1,item,positionQ12:[...p],timer:0,visualTicks:0});return true;
      }
      if(item.nativeSubcategory==='LIGHT') {
        if(light.active)return false;
        if(!consume(item))return false;
        Object.assign(light,{active:true,item,positionQ12:[...p],timer:0,visualTicks:0,
          interval:host.nextChannel(0xb2)%10+25,remaining:32400*60/400});return true;
      }
      if(item.nativeSubcategory==='CAPTURE_TRAP') {
        if(trap)return false;
        if(!consume(item))return false;
        trap={active:true,item,positionQ12:[...p],targetId:null,visualTicks:0};return true;
      }
      return false;
    },
    tick() {
      if(decoy.state)decoy.visualTicks++;
      if(light.active)light.visualTicks++;
      if(trap)trap.visualTicks++;
      if(decoy.state===1 && ++decoy.timer>180)launch([
        (host.camera[0]+Math.trunc(255*host.nextChannel(0xb2)/102))*Q12,
        (host.camera[1]+Math.trunc(191*host.nextChannel(0xb2)/102))*Q12,0]);
      else if(decoy.state===2) {
        if(++decoy.timer>decoy.interval){decoy.timer=0;decoy.interval=host.nextChannel(0xb2)%10+55;pulse(0x36,decoy.positionQ12);}
        const next=decoy.positionQ12.map((n,i)=>n+decoy.directionQ12[i]);
        if(blocked(host,next)||host.triggerMine?.(next)){
          decoy.active=false;decoy.state=3;decoy.timer=nativeToolAnimation('DECOY',decoy.item.nativeItemIndex,1).ticks.reduce((a,b)=>a+b,0);
          decoy.visualTicks=0;
          decoy.blinkPeriod=20;decoy.blinkTimer=0;
        }else decoy.positionQ12=next;
      } else if(decoy.state===3) {
        if(decoy.timer>0)decoy.timer--;
        else if(++decoy.blinkTimer%decoy.blinkPeriod===0){
          decoy.blinkTimer=0;decoy.blinkPeriod-=2;
          if(decoy.blinkPeriod===0)decoy.state=0;
        }
      }
      if(light.active) {
        if(host.night && ++light.timer>light.interval){light.timer=0;light.interval=host.nextChannel(0xb2)%10+25;pulse(0x38,light.positionQ12);}
        if(--light.remaining<=0)light.active=false;
      }
    },
    toolDecision(a,events) {
      if(a.aiState===16) {
        if(!a.trapReady) {
          const direction=normalize(a.destinationQ12.map((n,i)=>n-a.positionQ12[i]));
          a.positionQ12=a.positionQ12.map((n,i)=>n+direction[i]);
          if(distanceSq(a.positionQ12,a.destinationQ12)<4)a.trapReady=true;
        } else if(events.some(e=>e.code===0x16)) {
          if(host.usedG()+nativeHuntToolSpecies(a.speciesIndex).capacityG>host.maxCardG)host.emit('OVER_CAPACITY');
          else {trap=null;return 12;}
        }
        return -1;
      }
      if(![1,2,3].includes(a.aiState))return -1;
      const moving=events.find(e=>e.code===0x36);
      if(moving&&!a.followFlag&&host.wildRandom(0x7fff)%100<nativeAttractionPercent('DECOY',decoy.item.nativeItemIndex,a)
        &&distanceSq(a.positionQ12,moving.positionQ12)<96**2){a.followFlag=1;return 2;}
      const stationary=events.find(e=>e.code===0x38);
      if(stationary&&!a.distracted&&host.wildRandom(0x7fff)%100<nativeAttractionPercent('LIGHT',light.item.nativeItemIndex,a)
        &&distanceSq(a.positionQ12,stationary.positionQ12)<128**2){
        a.distracted=1;a.decoyCenter=[...stationary.positionQ12];
        a.destinationQ12=[a.decoyCenter[0]+(host.wildRandom(200)-100)*Q12,a.decoyCenter[1]+(host.wildRandom(200)-100)*Q12,0];return 2;
      }
      return -1;
    },
    captureTrapCollision(a,p) {
      if(!trap)return false;
      const bounds=nativeToolAnimation('CAPTURE_TRAP',trap.item.nativeItemIndex);
      const [x,y]=p.slice(0,2).map(n=>n>>12),[tx,ty]=trap.positionQ12.slice(0,2).map(n=>n>>12);
      if(x<=tx+(bounds.width>>1)*-1 || x>=tx+(bounds.width>>1) || y<=ty-(bounds.height>>1)||y>=ty+(bounds.height>>1))return false;
      if(!trap.targetId){trap.targetId=a.wildId;trap.visualTicks=0;a.trapDestination=[...trap.positionQ12];a.enteredCaptureTrap=true;}
      return !a.enteredCaptureTrap;
    },
    enterCaptureTrap(a){a.destinationQ12=[...a.trapDestination];a.trapReady=false;request(a,15);},
    getObjects:()=>[
      ...(decoy.state?[{kind:'DECOY',x:decoy.positionQ12[0]/2048,y:decoy.positionQ12[1]/2048,state:decoy.state,
        itemIndex:decoy.item.nativeItemIndex,sequence:decoy.state===3?(decoy.timer>0?1:2):0,visualTicks:decoy.visualTicks,
        visible:decoy.state!==3||decoy.timer>0||decoy.blinkTimer<decoy.blinkPeriod/2}]:[]),
      ...(light.active?[{kind:'LIGHT',x:light.positionQ12[0]/2048,y:light.positionQ12[1]/2048,itemIndex:light.item.nativeItemIndex,visualTicks:light.visualTicks}]:[]),
      ...(trap?[{kind:'CAPTURE_TRAP',x:trap.positionQ12[0]/2048,y:trap.positionQ12[1]/2048,triggered:!!trap.targetId,
        itemIndex:trap.item.nativeItemIndex,visualTicks:trap.visualTicks}]:[])]
  };
}
