// Normal Hunt's tool/actor coordinator, owned exclusively by huntRuntime.
// Time, RNG, inventory, map, loadout and card capacity are caller authorities.
import { createNativeRopeStroke,sampleNativeRopeStroke,expireNativeRopeSlots,recognizeNativeRopeStroke } from "./nativeRopeStroke.js";
import { nativeRopeParameters,stepNativeRopeController,nativeStrongPullDestination,nativeShotSpeciesResponse } from "./nativeHuntToolRules.js";
import { createNativeWildActor,stepNativeWildActor,nativeWildCaptureSnapshot,nativeWildCharacterFrame,nativeWildRequest } from "./nativeWildActor.js";
import { createNativeHuntConsumables } from './nativeHuntConsumables.js';
import { nativeWildRandom } from "./nativeCapturePhases.js";
import { queryNativeHuntActors } from "./nativeWildSpatial.js";
import { getHuntCatalogItem } from "../loadout/huntEquipmentCatalog.js";
const Q12=4096;
const FRAME_MS=1000*560190/33513982;

export function createNativeHuntFieldControls({ records,wildIds,environment,rng,loadout,consumeItem,maxCardG,night=false,onChange=()=>{} }) {
  if (!rng?.next || !loadout?.getSelectedEquipment || typeof consumeItem!=="function") throw Error("NATIVE_HUNT_CONTROL_AUTHORITIES_REQUIRED");
  const actors=records.map((r,i)=>createNativeWildActor(r,wildIds[i]));
  let activeTool="HAND", pointer=null, stroke=null, closure=null, rope=null, selectedWildId=null;
  let accumulator=0, frame=0, notice=null, fault=null;
  const ages=Array(20).fill(0);
  const nextChannel=channel=>rng.next(channel), wildRandom=max=>nativeWildRandom(max,nextChannel);
  const emit=value=>{notice=value;onChange();};
  const cardEntries=()=>actors.map(nativeWildCaptureSnapshot).filter(s=>s.state==="ON_CARD");
  const usedG=()=>cardEntries().reduce((sum,s)=>sum+s.gCost,0);
  const equipped=kind=>{const slot=loadout.getSelectedEquipment().find(s=>s.equipmentClass===kind);return slot?.itemId?{...getHuntCatalogItem(slot.itemId),quantity:slot.quantity}:null;};
  const stopRope=a=>{if(rope?.actor===a)rope=null;};
  const host={ actors,environment,nextChannel,wildRandom,camera:[0,0],maxCardG,usedG,emit,stopRope,night,
    // OWNER_APPROVED_ADAPTATION, 2026-09-08: initialize scatter's response using
    // ordinary Shot's species value. Seven pellets and the native reaction stay intact.
    scatterResponse:a=>nativeShotSpeciesResponse(a.speciesIndex),
    queryControllers:()=>({obstacle:0,secondaryBlocked:false,sideEffectsClosed:true}) };
  const consumables=createNativeHuntConsumables(host,{equipped,consumeItem,request:nativeWildRequest});
  Object.assign(host,consumables);
  const targetAt=p=>queryNativeHuntActors(actors,p,[0,0,0,0]).at(-1)??null;
  function sample() {
    const before=stroke;
    stroke=sampleNativeRopeStroke(stroke,pointer.pixels,[0,0],()=>wildRandom(0x7fff)%2);
    stroke.slots.forEach((slot,i)=>{if(slot && slot!==before.slots[i] && (!before.slots[i]
      || slot.variant!==before.slots[i].variant || slot.positionQ12.some((n,j)=>n!==before.slots[i].positionQ12[j])))ages[i]=20;});
    // A same-position slot can still be re-created. The ring index identifies it.
    const additions=stroke.count-before.count;
    for(let n=0;n<additions;n++)ages[(before.next+n)%20]=20;
  }
  function submitStroke() {
    if(stroke) {
      const shape=recognizeNativeRopeStroke(stroke);
      if(shape)closure={...shape,ticks:18};
    }
    stroke=null;ages.fill(0);
  }
  function step() {
    frame++;
    // Actor requests from the previous tool update precede the next tool tick.
    for(const a of actors)stepNativeWildActor(a,host);
    consumables.tick(pointer,activeTool);
    if(pointer?.released && !['ROPE_PULL','ROPE_STROKE'].includes(pointer.kind))pointer=null;
    if(closure) {
      if(closure.ticks===0) {
        for(const a of queryNativeHuntActors(actors,closure.centerQ12,[-48,-48,48,48]))a.events.push({code:0x23});
        closure=null;
      } else closure.ticks--;
    }
    if(pointer?.kind==="ROPE_STROKE") {
      sample();
      if(pointer.released){submitStroke();pointer=null;}
    }
    if(stroke) {
      const expired=[];
      ages.forEach((age,i)=>{if(age>0 && --ages[i]===0)expired.push(i);});
      stroke=expireNativeRopeSlots(stroke,expired);
    }
    if(rope && pointer?.kind==="ROPE_PULL") {
      const a=rope.actor;
      if(a.cardState || !a.bound){rope=null;return;}
      const anchor=[a.positionQ12[0],a.positionQ12[1]-10*Q12];
      const dx=pointer.q12[0]-anchor[0],dy=pointer.q12[1]-anchor[1];
      // The numerical writer compares the squared distance before normalizing.
      // Inputs outside its bounded CPU test range necessarily exceed break range.
      if(Math.abs(dx)>0x100000 || Math.abs(dy)>0x100000) {
        a.events.push({code:0x14});rope=null;emit("ROPE_BROKEN");return;
      }
      const next=stepNativeRopeController(rope.state,a.currentHp,{dxQ12:dx,dyQ12:dy,movementBlocked:!!a.movementRestricted});
      rope.state=next.rope;a.currentHp=next.currentHp;
      if(next.events.includes(0x11))a.destinationQ12=[...nativeStrongPullDestination(a.positionQ12,pointer.q12)];
      for(const code of next.events)a.events.push({code});
      if(next.rope.controllerState===6){a.events.push({code:0x14});rope=null;emit("ROPE_BROKEN");}
      if(pointer.released){a.events.push({code:0x12});rope=null;pointer=null;}
    }
  }
  return Object.freeze({actors,
    tick(ms,camera=[0,0]){
      if(fault)return;
      host.camera=camera.map(Math.floor);
      accumulator+=ms;
      while(accumulator+1e-8>=FRAME_MS){accumulator-=FRAME_MS;
        try{step();}catch(error){
          if(error.message!=='NATIVE_DIRECTION_UNASSIGNED_BRANCH_REQUIRES_TRACE')throw error;
          // Stop the encounter explicitly; never manufacture movement, a catch
          // or a refund. Completed card entries remain available to normal exit.
          fault=error.message;pointer=null;stroke=null;rope=null;accumulator=0;
          emit('HUNT_INTERRUPTED');return;
        }}
    },
    selectTool(kind){
      if(fault)return false;
      if(!['HAND','ROPE'].includes(kind)&&!consumables.canUse(kind))return false;
      if(kind!=="HAND" && !equipped(kind))return false;
      this.cancel();activeTool=kind;notice=null;onChange();return true;
    },
    pointerDown(x,y){
      if(fault)return false;
      if(pointer)return false;
      const p=[Math.floor(x/2)*Q12,Math.floor(y/2)*Q12,0],a=targetAt(p);
      selectedWildId=a?.wildId??null;
      notice=null;
      if(activeTool==="HAND"){
        if(actors.some(actor=>actor.cardState==='HAND_ANIMATION'))return true;
        if(a?.aiState===11||a?.aiState===16&&a.trapReady){a.events.push({code:0x16});onChange();return true;}
        onChange();return false;
      }
      if(activeTool==="ROPE"){
        const item=equipped("ROPE");if(!item)return false;
        pointer={kind:a?.bound?"ROPE_PULL":"ROPE_STROKE",q12:p,pixels:p.slice(0,2).map(n=>n>>12),released:false};
        if(a?.bound)rope={actor:a,state:nativeRopeParameters(item.nativeItemIndex,a.speciesIndex,a.maxHp)};
        else {stroke=createNativeRopeStroke();ages.fill(0);}
        onChange();return true;
      }
      if(consumables.canUse(activeTool)) {
        pointer={kind:activeTool,q12:p,pixels:p.slice(0,2).map(n=>n>>12),released:false,fresh:true};
        onChange();return true;
      }
      return false;
    },
    pointerMove(x,y){if(!pointer)return false;pointer.q12=[Math.floor(x/2)*Q12,Math.floor(y/2)*Q12,0];pointer.pixels=pointer.q12.slice(0,2).map(n=>n>>12);return true;},
    pointerUp(x,y){if(!pointer)return false;this.pointerMove(x,y);pointer.released=true;return true;},
    cancel(){if(rope)rope.actor.events.push({code:0x12});consumables.cancel();pointer=null;stroke=null;rope=null;ages.fill(0);},
    getSelectedWildId:()=>selectedWildId,
    selectAt(x,y){const a=targetAt([Math.floor(x/2)*Q12,Math.floor(y/2)*Q12,0]);selectedWildId=a?.wildId??null;return !!a;},
    getActors:()=>actors.filter(a=>a.actorActive&&!a.hidden&&(!a.cardState||a.cardState==='HAND_ANIMATION')).map(a=>({wildId:a.wildId,speciesId:a.speciesId,
      worldX:a.positionQ12[0]/2048,worldY:a.positionQ12[1]/2048,worldZ:a.positionQ12[2]/2048,
      facing:a.facing?"right":"left",moving:[2,3,8].includes(a.aiState),state:nativeWildCaptureSnapshot(a).state,
      aiState:a.aiState,speciesIndex:a.speciesIndex,personalityIndex:a.individual.fields['018'],
      currentHp:a.currentHp,maxHp:a.maxHp,bound:!!a.bound,nativeAnimation:nativeWildCharacterFrame(a),
      hpEvidence:"NATIVE_NORMAL_HUNT_CONTROLLER",behaviourEvidence:"NATIVE_HUNT_AI_TRANSLATION"})),
    getCaptureRecord:id=>{const a=actors.find(a=>a.wildId===id);return a?nativeWildCaptureSnapshot(a):null;},
    getOnCardEntries:cardEntries,
    applyReturnedIndividuals(entries) {
      const targets = entries.map(({wildId,individual}) => {
        const actor = actors.find(a=>a.wildId===wildId && a.cardState==="ON_CARD");
        if (!actor || individual.fields["000"] !== actor.speciesIndex) throw Error("HUNT_RETURN_CARD_CHANGED");
        return {actor,individual:structuredClone(individual)};
      });
      for (const {actor,individual} of targets) actor.individual=individual;
    },
    rename(id,name){const a=actors.find(a=>a.wildId===id&&a.cardState==="ON_CARD");if(!a)return false;a.displayName=name;return true;},
    release(id){const a=actors.find(a=>a.wildId===id&&a.cardState==="ON_CARD");if(!a)return false;a.cardState="RELEASED";return true;},
    commit(){for(const a of actors)if(a.cardState==="ON_CARD")a.cardState="HOME_COMMITTED";},
    hasPending:()=>!fault&&actors.some(a=>a.cardState==="HAND_ANIMATION"),
    getState:()=>({activeTool,frame,notice,fault,tools:[{id:"HAND",label:"手",enabled:!fault},
      {id:"ROPE",label:"繩索",enabled:!!equipped("ROPE")},
      ...['SHOT','WIRE','ENTRAP','DAMAGE_TRAP'].filter(kind=>!!equipped(kind)).map(kind=>({id:kind,label:equipped(kind).displayName,
        subtype:equipped(kind).nativeSubcategory,quantity:equipped(kind).quantity,enabled:equipped(kind).quantity>0&&consumables.canUse(kind),
        unavailableReason:consumables.canUse(kind)?null:'NATIVE_HUNT_TOOL_CONTROLLER_UNAVAILABLE'}))].map(tool=>fault?{...tool,enabled:false}:tool),
      objects:consumables.getObjects(),
      rope:rope?{wildId:rope.actor.wildId,from:[rope.actor.positionQ12[0]/2048,rope.actor.positionQ12[1]/2048-20],
        to:pointer.q12.slice(0,2).map(n=>n/2048),durability:rope.state.durability,capacity:rope.state.baseDurability,band:rope.state.band}:null,
      points:stroke?.slots.filter(Boolean).map(s=>({x:s.positionQ12[0]/2048,y:s.positionQ12[1]/2048}))??[],
      closure:closure?{x:closure.centerQ12[0]/2048,y:closure.centerQ12[1]/2048,ticks:closure.ticks}:null,
      usedG:usedG(),maxG:maxCardG}),
    getAvailability(){const a=actors.find(a=>a.wildId===selectedWildId);return {state:a?nativeWildCaptureSnapshot(a).state:"NO_TARGET",canCollect:a?.aiState===11||a?.aiState===16&&a.trapReady,targetWildId:selectedWildId,currentHp:a?.currentHp??null};}
  });
}
