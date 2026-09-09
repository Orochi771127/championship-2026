// Hunt owner child: original wild record + AI + actor, never a save or ticker.
import { nativeHuntSpeciesByIndex } from "./nativeHuntSources.js";
import { nativeHuntToolSpecies, nativeShotReaction } from "./nativeHuntToolRules.js";
import { nativeHuntActorBounds, nativeHuntEscapePosition } from "./nativeWildSpatial.js";
import { nativeHuntDegreeVector, resolveNativeHuntFollow } from "./nativeHuntDirection.js";
import { stepNativeHuntMovement } from "./nativeHuntMovement.js";
import { stepNativeWildStatus, stepNativeBindingBounce } from "./nativeWildStatus.js";
import { enterNativeAi10, stepNativeAi10Motion, stepNativeDownClock, stepNativeAi8PullEvents,
  createNativeHandController, stepNativeHandController } from "./nativeCapturePhases.js";
import { BATTLE_CHARACTER_PROFILES } from "../../../data/championship/battleCharacterProfiles.js";
import { createNativeCharacterAnimationTimeline } from "../../presentation/characterAnimationTimeline.js";
import { resolveNativeHuntCharacterSequence, NATIVE_HUNT_CHARACTER_FRAME_CONTRACT } from "../../presentation/nativeHuntCharacterAction.js";
import { nativeIndividualProfile } from "../../raising/nativeIndividualProfile.js";
const Q12 = 4096;
const distanceSq = (a,b) => a.slice(0,2).reduce((sum,n,i) => sum + ((n >> 12) - (b[i] >> 12)) ** 2, 0);

export function createNativeWildActor(record, wildId) {
  const species = nativeHuntSpeciesByIndex(record.speciesIndex), fields = record.individual.fields;
  if (!Number.isInteger(fields["00c"])) throw Error("NATIVE_WILD_ACTIVITY_COUNTER_REQUIRED");
  const a = { wildId, speciesIndex:record.speciesIndex, speciesId:`species-${String(record.speciesIndex).padStart(3,"0")}`,
    individual:record.individual, bounds:nativeHuntActorBounds(record.speciesIndex),
    positionQ12:[...record.positionQ12], previousPositionQ12:[...record.positionQ12],
    destinationQ12:[0,0,0], directionQ12:[0,0,0], speedQ12:record.ai.speedQ12, facing:record.facing,
    actorActive:1, wildActive:1, hidden:false, aiState:record.ai.state, returnAiState:record.ai.field054,
    headingQ12:record.ai.field1e0, lifetime:record.ai.field1d8, followTarget:0, followTicks:0, followFlag:0,
    currentHp:fields["050"], maxHp:fields["058"], satiety:fields["008"], awakeCounter:fields["00c"] | 0,
    maxAwakeCounter:Math.trunc(species.field22 / 10) * 60, sourceVitals:{currentHp:fields["050"],maxHp:fields["058"]},
    bound:0, handReady:false, request:0, bounce:{amplitude:0,velocity:0}, shake:null,
    drowsy:0, distracted:0, blinded:0, blindTicks:0, poisonPending:0, stunPending:0, poisoned:0,
    poisonElapsed:0, poisonDuration:0, recoveryTicks:0, shotShakeTicks:0,
    movementRestricted:0, restrictedTicks:0, pull13:0, pull11:0, escapeCounter:0, distanceAccumulatorQ12:0,
    terrainPose:7, counter:0, expired:0, events:[], cardState:null, displayName:null, handController:null,
    animator:null, sequenceId:null, foodTarget:null, seekingFood:0, decoyCenter:null };
  nativeWildRequest(a,0);
  return a;
}

export function nativeWildRequest(a, request) {
  a.request = request;
  const id = resolveNativeHuntCharacterSequence({request,bound:a.bound,overrideFlags:[a.drowsy,a.poisoned,a.blinded]});
  if (id === a.sequenceId) return;
  const animation = BATTLE_CHARACTER_PROFILES[a.bounds.entityId].sequences.find(s => s.id === id);
  if (!animation) throw Error(`NATIVE_HUNT_SEQUENCE_REQUIRED:${a.bounds.entityId}:${id}`);
  a.animator = createNativeCharacterAnimationTimeline({ ...animation,
    frames:animation.frames.map(f => ({...f,texture:`cell:${f.cell}`})) });
  a.sequenceId = id;
}

export function enterNativeWildState(a, id, host) {
  if ([2,3].includes(a.aiState)) { a.followTarget = 0; a.followTicks = 0; }
  if (a.aiState === 9) a.shake = null;
  if (a.aiState === 5) a.foodTarget=null;
  a.aiState = id;
  if (id === 1) { nativeWildRequest(a,0); a.counter=60; }
  else if (id === 2) nativeWildRequest(a,2);
  else if (id === 3) { a.drowsy=0; nativeWildRequest(a,3); }
  else if (id === 4) { nativeWildRequest(a,13); a.counter=(host.nextChannel(0xb2)%20+10)*60; }
  else if (id === 6) { a.bounce={amplitude:4,velocity:4}; nativeWildRequest(a,4); }
  else if (id === 8) {
    // OVL0 02111310..02111318 stores literal 1, not a full Q12 unit.
    // Normalization happens AFTER the first terrain steering blend.
    a.directionQ12=[0,1,0]; a.escapeCounter=0; a.drowsy=0;
    a.movementRestricted=0; a.restrictedTicks=0; nativeWildRequest(a,11);
  } else if (id === 9) {
    a.shake={ticks:a.shotShakeTicks,shakeX:1,shakeY:0,toggle:0}; nativeWildRequest(a,6);
  } else if (id === 10) {
    const down=enterNativeAi10(a.positionQ12,a.previousPositionQ12);
    a.shake=down.clock; a.velocityQ12=down.velocityQ12; nativeWildRequest(a,15);
  } else if (id === 11) {
    a.handReady=true; a.movementRestricted=0; a.counter=0; nativeWildRequest(a,15);
  } else if (id === 12) {
    a.cardState="HAND_ANIMATION"; a.handController=createNativeHandController();
  } else if (id === 17) {
    a.counter=(host.nextChannel(0xb2)%10+20)*60; nativeWildRequest(a,1);
  } else if (id === 18) {
    a.expired=60; a.individual.fields["190"]=0;
    a.lifetime=(Math.trunc(119*host.nextChannel(0xb3)/102)+10)*60;
  } else if (id === 19) {
    a.counter=(host.nextChannel(0xb2)%8+3)*60;
    nativeWildRequest(a,[13,14,28][host.nextChannel(0xb2)%3]);
  } else if (host.enterToolState) host.enterToolState(a,id);
  else throw Error(`NATIVE_HUNT_AI_STATE_PORT_REQUIRED:${id}`);
}

function idleDecision(a, host) {
  const species=nativeHuntSpeciesByIndex(a.speciesIndex);
  if (a.satiety >= species.field1c) a.awakeCounter++;
  if (++a.counter > 60) {
    a.counter=0;
    host.seekFood?.(a);
  }
  if (a.satiety > Math.trunc(species.field1c/2)) a.seekingFood=0;
  if (a.awakeCounter >= Math.trunc(a.maxAwakeCounter/10)*8) { a.drowsy=1; nativeWildRequest(a,1); }
  if (a.awakeCounter <= Math.trunc(a.maxAwakeCounter/2)) { a.drowsy=0; nativeWildRequest(a,0); }
  if (a.awakeCounter >= a.maxAwakeCounter) return 4;
  if (++a.individual.fields["190"] > a.lifetime) return 18;
  const food=host.foodDestination?.(a);
  if (food) { a.destinationQ12=food; return a.satiety <= Math.trunc(species.field1c/4) ? 3 : 2; }
  if (a.blinded) { a.destinationQ12=[a.positionQ12[0]+(a.facing ? 64 : -64)*Q12,a.positionQ12[1],0]; return 2; }
  if (host.wildRandom(0x7fff)%50 !== 0) return -1;
  let walking=host.wildRandom(0x7fff)%5 !== 0;
  if (a.distracted && host.decoy?.active && distanceSq(a.positionQ12,a.decoyCenter) <= 128**2) {
    a.destinationQ12=[a.decoyCenter[0]+(host.wildRandom(200)-100)*Q12,
      a.decoyCenter[1]+(host.wildRandom(200)-100)*Q12,0];
  } else {
    a.distracted=0;
    const choice=host.wildRandom(0x7fff)%3;
    if (choice !== 1) {
      const delta=nativeHuntDegreeVector(host.wildRandom(0x7fff)%360,choice===0?64:32);
      a.destinationQ12=a.positionQ12.map((n,i)=>n+delta[i]);
    } else {
      const family=nativeHuntToolSpecies(a.speciesIndex).family;
      for (const other of host.actors) {
        if (other===a || !other.actorActive || other.hidden || nativeHuntToolSpecies(other.speciesIndex).family!==family
          || distanceSq(a.positionQ12,other.positionQ12)>=96**2) continue;
        if (host.wildRandom(0x7fff)%3 !== 0) {
          const dx=host.nextChannel(0xb3)%32,dy=host.nextChannel(0xb3)%32;
          a.destinationQ12=[other.positionQ12[0]+dx*(host.nextChannel(0xb3)%2===0?1:-1)*Q12,
            other.positionQ12[1]+dy*(host.nextChannel(0xb3)%2===0?1:-1)*Q12,0];
        } else { a.followTarget=other.wildId; a.followTicks=host.wildRandom(300); walking=false; }
      }
    }
  }
  a.destinationQ12=[a.destinationQ12[0],a.destinationQ12[1],0];
  return walking || a.drowsy ? 2 : 3;
}

function decide(a, events, host) {
  const has = code => events.some(e=>e.code===code);
  const early=host.preDecision?.(a,events);
  if(Number.isInteger(early)&&early>=0)return early;
  if (a.aiState===0) return 1;
  if ((a.aiState!==8 || !a.bound) && [1,2,3,4,5,8,9,13,14,17,18,19].includes(a.aiState) && has(0x23)) {
    a.bound=1; a.returnAiState=8; return 6;
  }
  if ([1,13,14,18,19].includes(a.aiState) && [0x25,0x13,0x11].some(has)) { a.returnAiState=8; return 6; }
  if (a.aiState===8) {
    Object.assign(a,stepNativeAi8PullEvents(a,events.map(e=>e.code),host.wildRandom));
    nativeWildRequest(a,a.pull11?15:11);
    if (has(0x12)) { a.returnAiState=a.currentHp>0?8:11; a.escapeCounter=0; return 10; }
    if (has(0x14)) { a.bound=0; a.escapeCounter=0; return 10; }
    if (a.currentHp<=0) { host.stopRope?.(a); a.returnAiState=11; return 10; }
  }
  if ([1,2,3,4,5,8,9,13,17,18,19].includes(a.aiState)) {
    const shot=events.find(e=>e.code===0x2e);
    if (shot) {
      Object.assign(a,nativeShotReaction(a,shot,host));
      if (a.aiState===4) a.awakeCounter=Math.min(a.awakeCounter,Math.trunc(a.maxAwakeCounter/10)*7);
      return 9;
    }
  }
  const toolState=host.toolDecision?.(a,events);
  if (Number.isInteger(toolState) && toolState!==-1) return toolState;
  if(a.aiState===5 && a.satiety>=nativeHuntSpeciesByIndex(a.speciesIndex).field1c)return 1;
  if (a.aiState===1) return idleDecision(a,host);
  if (a.aiState===2 || a.aiState===3) {
    const running=a.aiState===3;
    if (!running && a.satiety>=nativeHuntSpeciesByIndex(a.speciesIndex).field1c) a.awakeCounter++;
    if (a.awakeCounter>=Math.trunc(a.maxAwakeCounter/10)*(running?9:8)) {
      a.drowsy=1; if (running) return 2; nativeWildRequest(a,12);
    }
    if (a.awakeCounter<=Math.trunc(a.maxAwakeCounter/2)) { a.drowsy=0; nativeWildRequest(a,running?3:2); }
    if (!running && a.awakeCounter>=a.maxAwakeCounter) return 4;
    const arrived=a.followTarget ? a.followTicks===0 : distanceSq(a.positionQ12,a.destinationQ12)<25;
    if (arrived) {
      a.followTarget=0;
      if (host.canEat?.(a)) return 5;
      return !running && !a.foodTarget && a.distracted ? 19 : 1;
    }
  } else if ([4,17,19].includes(a.aiState)) {
    a.counter=(a.counter-1)&0xffff;
    if (a.counter===0) { if (a.aiState===4) a.awakeCounter=0; return 1; }
  } else if (a.aiState===6 && a.bounce.amplitude===0) return a.returnAiState;
  else if (a.aiState===8) {
    const escaped=nativeHuntEscapePosition(a.positionQ12,host.environment,host.nextChannel);
    if (escaped) { a.positionQ12=escaped; host.stopRope?.(a); return 1; }
  } else if ([9,10].includes(a.aiState) && a.shake?.ticks===0) {
    if (a.aiState===9) a.shotShakeTicks=0;
    return a.returnAiState;
  } else if (a.aiState===11) {
    if (has(0x16)) {
      if (host.usedG()+nativeHuntToolSpecies(a.speciesIndex).capacityG>host.maxCardG) host.emit("OVER_CAPACITY");
      else return 12;
    }
    if (a.currentHp>=Math.trunc(a.maxHp/10)*5) return 1;
    a.pull11=has(0x11)?1:0;
  } else if (a.aiState===18 && a.expired===0) return 1;
  return -1;
}

export function stepNativeWildActor(a, host) {
  if (!a.actorActive || a.cardState && a.cardState!=="HAND_ANIMATION") return;
  const previous=[...a.positionQ12], events=a.events.splice(0);
  if (!a.cardState) {
    const next=decide(a,events,host);
    if (next>=0) enterNativeWildState(a,next,host);
    let mode=({2:0,3:1,7:1})[a.aiState];
    if (a.aiState===8) mode=a.pull11?2:3;
    if (a.aiState===11 && a.pull11) mode=2;
    if (mode!==undefined) {
      const movement=stepNativeHuntMovement(a,mode,{ ...host.environment,camera:host.camera,
        resolveFollow:(s,m)=>resolveNativeHuntFollow(s,m,{light:host.light,target:host.actors.find(o=>o.wildId===s.followTarget)}),
        queryControllers:position=>host.queryControllers(a,position) });
      Object.assign(a,movement.state);
      if(a.enteredCaptureTrap){host.stopRope?.(a);a.enteredCaptureTrap=false;enterNativeWildState(a,16,host);}
      if(movement.forcedAi!==null)enterNativeWildState(a,movement.forcedAi,host);
    }
    if (a.aiState===1 || a.aiState===2) a.awakeCounter++;
    if ([3,7,8].includes(a.aiState)) a.awakeCounter--;
    if (a.aiState===10) Object.assign(a,stepNativeAi10Motion(a.positionQ12,a.velocityQ12,host.environment.isBlocked));
    if (a.aiState===11) a.counter++;
    host.updateToolState?.(a);
    const status=stepNativeWildStatus(a,host.wildRandom);
    Object.assign(a,status.state);
    if (status.effects.includes("ENTER_AI17")) enterNativeWildState(a,17,host);
  }
  if (a.cardState==="HAND_ANIMATION") {
    const hand=stepNativeHandController(a.handController);
    a.handController=hand.controller;
    if (hand.effects.includes("HIDE_WILD")) a.hidden=true;
    if (hand.insert) { a.cardState="ON_CARD"; host.emit("ON_CARD"); }
  }
  if (a.shake) { const s=stepNativeDownClock(a.shake,a.positionQ12); a.shake=s.clock; a.positionQ12=[...s.positionQ12]; }
  const bounce=stepNativeBindingBounce(a.bounce,a.positionQ12[2]);
  a.bounce=bounce.bounce; a.positionQ12=[...a.positionQ12]; a.positionQ12[2]=bounce.zQ12;
  if (a.expired>0) a.expired--;
  a.animator.advanceNative(Q12);
  a.previousPositionQ12=previous;
  a.individual.fields["008"]=a.satiety >>> 0; a.individual.fields["00c"]=a.awakeCounter >>> 0;
}

export function nativeWildCaptureSnapshot(a) {
  return Object.freeze({wildId:a.wildId,speciesId:a.speciesId,currentHp:a.currentHp,maxHp:a.maxHp,
    sourceVitals:Object.freeze({...a.sourceVitals}),gCost:nativeHuntToolSpecies(a.speciesIndex).capacityG,
    state:a.cardState ?? (a.aiState===11||a.aiState===16&&a.trapReady?"HAND_READY":a.aiState===10?"DOWN_ANIMATION":a.bound?"TETHERED":"WILD"),
    displayName:a.displayName,traceId:"HUNT_NORMAL_NATIVE_CONTROLLER",nativePhase:{wildHidden:a.hidden,handController:a.handController},
    ...(a.cardState === "ON_CARD" ? {nativeProfile:nativeIndividualProfile(a.individual, a.speciesId)} : {}),
    successAuthority:"NATIVE_NORMAL_HUNT_CONTROLLER"});
}
export function nativeWildCharacterFrame(a) {
  return Object.freeze({...a.animator.getSnapshot(),contract:NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,flipBits:a.facing?0:1});
}
