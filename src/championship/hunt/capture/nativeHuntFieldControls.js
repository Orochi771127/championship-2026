// Normal Hunt's tool/actor coordinator, owned exclusively by huntRuntime.
// Time, RNG, inventory, map, loadout and card capacity are caller authorities.
import { createNativeRopeStroke,sampleNativeRopeStroke,expireNativeRopeSlots,recognizeNativeRopeStroke } from "./nativeRopeStroke.js";
import { nativeRopeParameters,nativeRopeRow,nativeHuntToolSpecies,stepNativeRopeController,nativeStrongPullDestination,nativeShotSpeciesResponse } from "./nativeHuntToolRules.js";
import { createHuntRopeTactics,huntRopeRole,huntRopeBindRule,huntRopeCoefficient,huntTacticalRope,huntRopeWear,huntRopeCrossesBlocked,HUNT_ROPE_TACTICS } from "./huntRopeTactics.js";
import { createNativeWildActor,stepNativeWildActor,nativeWildCaptureSnapshot,nativeWildCharacterFrame,nativeWildRequest } from "./nativeWildActor.js";
import { createNativeHuntConsumables } from './nativeHuntConsumables.js';
import { nativeWildRandom } from "./nativeCapturePhases.js";
import { queryNativeHuntActors } from "./nativeWildSpatial.js";
import { getHuntCatalogItem } from "../loadout/huntEquipmentCatalog.js";
import {separateGroundFootpoints,canTraverseGroundStep} from '../../field/groundFootpointSeparation.js';
import { createLassoTracker, lassoContains, LASSO_RULES } from "./ropeLassoGesture.js";
const Q12=4096;
const FRAME_MS=1000*560190/33513982;
export function nativeHuntGroundSpacingEligible(a){
  return !!(a.actorActive&&a.wildActive&&!a.hidden&&!a.passage&&!a.cardState&&!a.tutorialScripted&&[1,2,3].includes(a.aiState)
    &&a.positionQ12?.[2]===0&&a.currentHp>0&&!a.bound&&!a.pull11&&!a.pull13&&!a.movementRestricted
    &&!a.shake&&!a.shotShakeTicks&&!a.handReady&&!a.trapReady&&!a.foodTarget&&!a.seekingFood&&!a.decoyCenter);
}
export function separateNativeHuntGroundActors(actors,environment){
  const entries=actors.flatMap((actor,poolSlot)=>nativeHuntGroundSpacingEligible(actor)?[{actor,poolSlot,group:0,positionQ12:actor.positionQ12}]:[]);
  const result=separateGroundFootpoints(entries,{canPlace:(_entry,to,from)=>canTraverseGroundStep(from,to,{
    canStand:p=>{
      if(p[0]<0||p[1]<0||p[0]>=environment.width*32768||p[1]>=environment.height*32768)return false;
      const terrain=environment.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768));
      return Number.isInteger(terrain)&&terrain>=0&&terrain<=4&&terrain!==1;
    }})});
  entries.forEach((entry,i)=>{if(result.correctionQ12[i])entry.actor.positionQ12=result.points[i];});
  return result;
}

export function createNativeHuntFieldControls({ records,wildIds,environment,rng,loadout,consumeItem,maxCardG,night=false,onChange=()=>{} }) {
  if (!rng?.next || !loadout?.getSelectedEquipment || typeof consumeItem!=="function") throw Error("NATIVE_HUNT_CONTROL_AUTHORITIES_REQUIRED");
  const actors=records.map((r,i)=>createNativeWildActor(r,wildIds[i]));
  let activeTool="HAND", pointer=null, stroke=null, closure=null, rope=null, selectedWildId=null;
  // OWNER_APPROVED_ADAPTATION 2026-10-27: the drawn loop itself (ropeLassoGesture.js)
  // decides who is caught; the native sampler still runs for its RNG and fallback.
  const lasso=createLassoTracker();let closureSerial=0,lassoClosed=false;
  // OWNER_APPROVED_ADAPTATION 2026-10-28: rope roles, combos and overheat
  // (huntRopeTactics.js) around the unchanged native rope writer.
  const tactics=createHuntRopeTactics({generationOf:index=>nativeHuntToolSpecies(index).generation});
  let accumulator=0, frame=0, notice=null;
  const ages=Array(20).fill(0);
  const nextChannel=channel=>rng.next(channel), wildRandom=max=>nativeWildRandom(max,nextChannel);
  const emit=value=>{notice=value;onChange();};
  const cardEntries=()=>actors.filter(a=>nativeWildCaptureSnapshot(a).state==="ON_CARD")
    .map(a=>{const snapshot=nativeWildCaptureSnapshot(a),combo=tactics.combo(a);return combo?.bits?Object.freeze({...snapshot,combo}):snapshot;});
  const captureEffects=()=>actors.filter(a=>a.cardState==="HAND_ANIMATION"&&a.handController).map(a=>({
    wildId:a.wildId,
    speciesId:a.speciesId,
    worldX:a.positionQ12[0]/2048,
    worldY:a.positionQ12[1]/2048,
    worldZ:a.positionQ12[2]/2048,
    phase:a.handController.phase,
    counter:a.handController.counter,
    wildHidden:a.hidden,
    timingAuthority:"NATIVE_HAND_CONTROLLER",
    presentationRole:"CAPTURE_TO_MEMORY_CARD"
  }));
  const usedG=()=>cardEntries().reduce((sum,s)=>sum+s.gCost,0);
  const equipped=kind=>{const slot=loadout.getSelectedEquipment().find(s=>s.equipmentClass===kind);return slot?.itemId?{...getHuntCatalogItem(slot.itemId),quantity:slot.quantity}:null;};
  const stopRope=a=>{if(rope?.actor===a)rope=null;};
  const ropeRole=()=>{const item=equipped("ROPE");return item?huntRopeRole(item.nativeItemIndex):null;};
  const cinchTicks=()=>ropeRole()==="SWIFT"?HUNT_ROPE_TACTICS.swiftCinchTicks:18;
  const catchMargin=()=>ropeRole()==="SWIFT"?HUNT_ROPE_TACTICS.swiftCatchMargin:LASSO_RULES.catchMargin;
  // Trees, rocks and water: ground a partner cannot stand on (native 8 px cells).
  const blockedPixel=(x,y)=>{
    if(typeof environment?.readTerrain!=="function"||x<0||y<0)return false;
    const terrain=environment.readTerrain(Math.floor(x/8),Math.floor(y/8));
    return !(Number.isInteger(terrain)&&terrain>=0&&terrain<=4&&terrain!==1);
  };
  // ULTIMATE on a 幼年期 / 成長期: the rope throws it off and it bolts away.
  const repel=(a,from)=>{
    const away=[a.positionQ12[0]-from[0],a.positionQ12[1]-from[1]],length=Math.hypot(away[0],away[1])||1;
    a.returnAiState=3;a.destinationQ12=[a.positionQ12[0]+Math.round(away[0]/length*96)*Q12,a.positionQ12[1]+Math.round(away[1]/length*96)*Q12,0];
    a.events.push(a.bound?{code:0x14}:{code:0x2e,strength:2,statusSelector:0,response:nativeShotSpeciesResponse(a.speciesIndex)});
    emit("ROPE_TOO_HEAVY");
  };
  // The rope key: which rope, its role, any overheat and how many spares (read once per frame).
  const ropeTool=()=>{
    const item=equipped("ROPE");
    return {id:"ROPE",label:"繩索",enabled:!!item,itemId:item?.itemId??null,shopRecordIndex:item?.shopRecordIndex??null,
      ropeName:item?.displayName??null,role:item?huntRopeRole(item.nativeItemIndex):null,
      overheatSeconds:item?Math.ceil(tactics.overheatTicks(item.itemId)/60):0,
      spares:Math.max(0,(loadout.listAvailableEquipment?.().find(c=>c.equipmentClass==="ROPE")?.items.length??1)-1)};
  };
  const bindCaught=(caught,serial,from)=>{
    const item=equipped("ROPE");
    for(const a of caught){
      if(item&&huntRopeBindRule(item.nativeItemIndex,tactics.generation(a))==="REPEL"){repel(a,from);continue;}
      if(item&&huntRopeCoefficient(nativeRopeRow(item.nativeItemIndex),nativeHuntToolSpecies(a.speciesIndex))===0)emit("ROPE_TOO_WEAK");
      tactics.markGroup(a,caught.length>=2?serial:0);
      a.events.push({code:0x23});
    }
  };
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
  // A body (its hit box's middle) inside the drawn loop, or within its margin.
  const lassoCaught=polygon=>actors.filter(a=>a.actorActive&&!a.hidden&&!a.passage&&!a.cardState&&lassoContains(polygon,
    (a.positionQ12[0]>>12)+((a.bounds?.rect?.[0]??0)+(a.bounds?.rect?.[2]??0))/2,(a.positionQ12[1]>>12)+((a.bounds?.rect?.[1]??0)+(a.bounds?.rect?.[3]??0))/2,catchMargin()));
  function submitStroke() {
    if(stroke) {
      const shape=recognizeNativeRopeStroke(stroke);
      if(shape)closure={...shape,ticks:cinchTicks(),serial:++closureSerial};
    }
    stroke=null;ages.fill(0);
  }
  function step() {
    frame++;
    // Actor requests from the previous tool update precede the next tool tick.
    for(const a of actors)stepNativeWildActor(a,host);
    // One Q12 position owner, before consumable and rope readers. Proposals
    // read terrain only: queryControllers has damage/capture side effects.
    separateNativeHuntGroundActors(actors,environment);
    for(const event of tactics.observe(actors,{shotItemIndex:equipped("SHOT")?.nativeItemIndex??null}))if(event.kind==="GUARD_BROKEN")emit("GUARD_BROKEN");
    // A chain that ends on the card pays out once: lure -> disable -> rope.
    for(const a of actors)if(a.cardState==="ON_CARD"&&!tactics.combo(a)){const combo=tactics.settle(a);if(combo.rank)emit(combo.rank==="PERFECT"?"PERFECT_COMBO":"GOOD_COMBO");else if(combo.imprint)emit("DATA_IMPRINT");}
    consumables.tick(pointer,activeTool);
    // A break can remove the rope before pointer-up; release still ends the gesture.
    if(pointer?.released && (!['ROPE_PULL','ROPE_STROKE'].includes(pointer.kind)
      || pointer.kind==='ROPE_PULL' && !rope))pointer=null;
    if(closure) {
      if(closure.ticks===0) {
        // A lasso holds who was inside when it closed (a partner that walks on
        // during the 18-tick cinch is still caught), plus whoever is inside now.
        const held=new Set(closure.caught??[]);
        const caught=closure.polygon?[...new Set([...actors.filter(a=>held.has(a.wildId)&&a.actorActive&&!a.hidden&&!a.cardState),...lassoCaught(closure.polygon)])]
          :queryNativeHuntActors(actors,closure.centerQ12,[-48,-48,48,48]);
        bindCaught(caught,closure.serial,[closure.centerQ12[0],closure.centerQ12[1],0]);
        closure=null;
      } else closure.ticks--;
    }
    if(pointer?.kind==="ROPE_STROKE") {
      sample();
      const loop=closure?null:lasso.add(pointer.pixels[0],pointer.pixels[1]);
      if(loop){
        closure={centerQ12:[Math.round(loop.centroid.x*Q12),Math.round(loop.centroid.y*Q12)],polygon:loop.polygon,ticks:cinchTicks(),
          serial:++closureSerial,caught:lassoCaught(loop.polygon).map(a=>a.wildId)};
        lasso.reset(loop.polygon.at(-1));lassoClosed=true;
      }
      // The native reading is the fallback for a stroke the lasso never closed.
      if(pointer.released){if(!lassoClosed)submitStroke();else{stroke=null;ages.fill(0);}lasso.reset();lassoClosed=false;pointer=null;}
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
        a.events.push({code:0x14});if(!a.tutorialScripted)tactics.overheat(rope.itemId);rope=null;emit("ROPE_BROKEN");return;
      }
      const next=stepNativeRopeController(rope.state,a.currentHp,{dxQ12:dx,dyQ12:dy,movementBlocked:!!a.movementRestricted});
      const overstretched=(dx/Q12)**2+(dy/Q12)**2>160*160;
      const before=rope.state;
      rope.state=huntRopeWear(before,next.rope,{movementBlocked:!!a.movementRestricted,overstretched,groupHold:tactics.groupHold(a,actors),
        terrainCrossed:next.rope.band!=="SLACK"&&huntRopeCrossesBlocked(anchor,pointer.q12,blockedPixel)});
      a.currentHp=next.currentHp;tactics.syncHp(a);
      if(a.currentHp<=0)tactics.ropeDowned(a,before.role);
      if(next.events.includes(0x11))a.destinationQ12=[...nativeStrongPullDestination(a.positionQ12,pointer.q12)];
      for(const code of next.events)a.events.push({code});
      if(rope.state.controllerState===6){a.events.push({code:0x14});if(!a.tutorialScripted)tactics.overheat(rope.itemId);rope=null;emit("ROPE_BROKEN");if(pointer?.released)pointer=null;return;}
      if(pointer.released){a.events.push({code:0x12});rope=null;pointer=null;}
    }
  }
  return Object.freeze({actors,
    tick(ms,camera=[0,0]){
      host.camera=camera.map(Math.floor);
      accumulator+=ms;
      while(accumulator+1e-8>=FRAME_MS){accumulator-=FRAME_MS;step();}
    },
    selectTool(kind){
      if(!['HAND','ROPE'].includes(kind)&&!consumables.canUse(kind))return false;
      if(kind!=="HAND" && !equipped(kind))return false;
      this.cancel();activeTool=kind;notice=null;onChange();return true;
    },
    pointerDown(x,y){
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
        // A rope that broke this hunt is still tangled: switch to a spare or wait.
        if(tactics.overheatTicks(item.itemId)>0){emit("ROPE_OVERHEATED");return true;}
        if(a?.bound&&huntRopeBindRule(item.nativeItemIndex,tactics.generation(a))==="REPEL"){repel(a,p);onChange();return true;}
        pointer={kind:a?.bound?"ROPE_PULL":"ROPE_STROKE",q12:p,pixels:p.slice(0,2).map(n=>n>>12),released:false};
        if(a?.bound){
          const generation=tactics.generation(a);
          rope={actor:a,itemId:item.itemId,state:huntTacticalRope(nativeRopeParameters(item.nativeItemIndex,a.speciesIndex,a.maxHp),{nativeItemIndex:item.nativeItemIndex,
            generation,maxHp:a.maxHp,coefficient:huntRopeCoefficient(nativeRopeRow(item.nativeItemIndex),nativeHuntToolSpecies(a.speciesIndex)),
            pacified:tactics.pacified(a),rage:tactics.rage(a)})};
          if(rope.state.rage)notice="RAGE_GUARD";else if(rope.state.fragile)notice="ROPE_FRAGILE";
        }
        else {stroke=createNativeRopeStroke();ages.fill(0);lasso.reset({x:p[0]>>12,y:p[1]>>12});lassoClosed=false;}
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
    cancel(){if(rope)rope.actor.events.push({code:0x12});consumables.cancel();pointer=null;stroke=null;rope=null;ages.fill(0);lasso.reset();},
    /** Swap to the next owned rope, skipping overheated ones when another is ready. */
    cycleRope(){
      const owned=loadout.listAvailableEquipment?.().find(c=>c.equipmentClass==="ROPE")?.items??[];
      if(owned.length<2||typeof loadout.selectEquipment!=="function")return false;
      const current=owned.findIndex(item=>item.selected);
      const order=owned.map((_,i)=>owned[(current+1+i)%owned.length]).filter(item=>!item.selected);
      const next=order.find(item=>tactics.overheatTicks(item.itemId)===0)??order[0];
      if(!next)return false;
      if(rope)this.cancel();
      loadout.selectEquipment("ROPE",next.itemId);
      emit("ROPE_SWITCHED");return true;
    },
    getSelectedWildId:()=>selectedWildId,
    selectAt(x,y){const a=targetAt([Math.floor(x/2)*Q12,Math.floor(y/2)*Q12,0]);selectedWildId=a?.wildId??null;return !!a;},
    getActors:()=>actors.filter(a=>a.actorActive&&!a.hidden&&(!a.cardState||a.cardState==='HAND_ANIMATION')).map(a=>({wildId:a.wildId,speciesId:a.speciesId,
      worldX:a.positionQ12[0]/2048,worldY:a.positionQ12[1]/2048,worldZ:a.positionQ12[2]/2048,
      facing:a.facing?"right":"left",moving:[2,3,8].includes(a.aiState),state:nativeWildCaptureSnapshot(a).state,
      aiState:a.aiState,speciesIndex:a.speciesIndex,personalityIndex:a.individual.fields['018'],
      currentHp:a.currentHp,maxHp:a.maxHp,bound:!!a.bound,stunTicks:a.shotShakeTicks,nativeAnimation:nativeWildCharacterFrame(a),
      ...(a.passage?{passage:a.passage.phase,passageAlpha:a.passageAlpha??1}:{}),
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
    hasPending:()=>actors.some(a=>a.cardState==="HAND_ANIMATION"),
    getState:()=>({activeTool,frame,notice,tools:[{id:"HAND",label:"手",enabled:true},
      ropeTool(),
      ...['SHOT','WIRE','ENTRAP','DAMAGE_TRAP'].filter(kind=>!!equipped(kind)).map(kind=>({id:kind,label:equipped(kind).displayName,
        itemId:equipped(kind).itemId,shopRecordIndex:equipped(kind).shopRecordIndex,
        subtype:equipped(kind).nativeSubcategory,quantity:equipped(kind).quantity,enabled:equipped(kind).quantity>0&&consumables.canUse(kind),
        unavailableReason:consumables.canUse(kind)?null:'NATIVE_HUNT_TOOL_CONTROLLER_UNAVAILABLE'}))],
      objects:consumables.getObjects(),
      rope:rope?{wildId:rope.actor.wildId,from:[rope.actor.positionQ12[0]/2048,rope.actor.positionQ12[1]/2048-20],
        to:pointer.q12.slice(0,2).map(n=>n/2048),durability:rope.state.durability,capacity:rope.state.baseDurability,band:rope.state.band,
        role:rope.state.role,rage:rope.state.rage,fragile:rope.state.fragile,guard:tactics.guard(rope.actor)}:null,
      points:stroke?.slots.filter(Boolean).map(s=>({x:s.positionQ12[0]/2048,y:s.positionQ12[1]/2048}))??[],
      closure:closure?{x:closure.centerQ12[0]/2048,y:closure.centerQ12[1]/2048,ticks:closure.ticks,serial:closure.serial,
        polygon:closure.polygon?.map(p=>({x:p.x*2,y:p.y*2}))??null,caught:closure.caught?.length??null}:null,
      lassoPath:pointer?.kind==="ROPE_STROKE"?lasso.points.map(p=>({x:p.x*2,y:p.y*2})):[],
      captureEffects:captureEffects(),
      usedG:usedG(),maxG:maxCardG}),
    getAvailability(){const a=actors.find(a=>a.wildId===selectedWildId);return {state:a?nativeWildCaptureSnapshot(a).state:"NO_TARGET",canCollect:a?.aiState===11||a?.aiState===16&&a.trapReady,targetWildId:selectedWildId,currentHp:a?.currentHp??null};}
  });
}
