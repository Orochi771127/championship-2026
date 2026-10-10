// Bounded OVL18 special table 021283D0, separate from normal think/growth.
// Shared animation, geometry, food, medicine and cage-program primitives retain
// their existing owners. The application supplies the sole ticker and RNG.
import {requestNativeRaisingSequence as request} from "./nativeRaisingActor.js";
import {constructNativeIndividualForm} from "./nativeIndividualEvolution.js";
import {normalizeNativeIndividualProfile} from "./nativeIndividualProfile.js";
import {nativeHuntSpeciesByIndex} from "../hunt/capture/nativeHuntSources.js";
import {findNativeRaisingFood,nativeFoodStation} from "./nativeRaisingFood.js";
import {stepNativeRaisingMovement,nativeRaisingMovementArrived} from "./nativeRaisingMovement.js";
import {applyNativeFoodFrame,applyNativeMedicine} from "./nativeRaisingCare.js";
import {createNativeTreatmentPresentation,advanceNativeTreatmentPresentation} from "./nativeRaisingTreatment.js";
import {stepNativeRaisingStatusFeedback} from "./nativeRaisingFeedback.js";
import {stepNativeRaisingRecoveryStars} from "./nativeRaisingRecoveryStars.js";
import {nativeCarryPosition,nativeCarryVelocity,nativeReleaseVelocity,stepNativeRaisingFlight} from "./nativeRaisingCarry.js";
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from "../../data/championship/battleCharacterProfiles.js";
import {beginNativeActivityReaction,stepNativeActivityReaction} from "./nativeRaisingActivity.js";
import {NATIVE_RAISING_LIFECYCLE_RULES as rules,evaluateNativeEvolution} from "./nativeRaisingLifecycle.js";
import {enterNativeRaisingTraining,createNativeTrainingTimeline,stepNativeTrainingTimeline,applyNativeCageEntryConditions} from "./nativeRaisingTraining.js";

export function tutorialRaisingIdle(actor){
  actor.state=1;actor.foodSlot=null;actor.station=-1;actor.activity=null;actor.training=null;actor.treatment=null;actor.feedback=null;actor.detached=false;
  request(actor,0);
}
export function tutorialRaisingPosition(actor,x,y,cage=35){
  actor.positionQ12=[x*4096,y*4096,0];actor.destinationQ12=[...actor.positionQ12];actor.cageDefinitionIndex=cage;
}
export function initializeNativeTutorialRaisingActor(actor) {
  if(actor.speciesIndex>=8)throw new TypeError("TUTORIAL_STARTER_EGG_REQUIRED");
  actor.tutorialSpecial=true;actor.state=18;actor.eggPhase=0;
  actor.pendingHatch=false;actor.hatchWait=0;actor.nativeFrame=0;
  tutorialRaisingPosition(actor,128,96);
  actor.flipBits=0;actor.foodSlot=null;actor.slow=0;actor.mode=0;actor.ticks=0;actor.threshold=0;actor.angleQ12=0;actor.desiredAngleQ12=0;
  request(actor,0,true);return actor;
}
export function requestNativeTutorialHatch(actor) {
  if(!actor?.tutorialSpecial||actor.state!==18||actor.eggPhase!==0||actor.pendingHatch)return false;
  actor.pendingHatch=true;return true;
}
export function restoreNativeTutorialHatchedActor(actor,profile,rng) {
  const next=constructNativeIndividualForm(profile,17,rng);
  actor.speciesIndex=17;actor.eggPhase=0;actor.pendingHatch=false;actor.sequenceId=null;tutorialRaisingIdle(actor);
  return {profile:next,hatched:true};
}
export function tutorialRaisingCondition(profile,selector){
  const p=structuredClone(profile),f=p.fields;
  if(selector===2)f["138"]=1;else if(selector===3)f["138"]=0;
  else if(selector===4){f["050"]=1;f["13c"]=1;}
  else if(selector===5){f["050"]=f["058"];f["13c"]=0;}
  else if(selector===6)f["134"]=1;else if(selector===7)f["134"]=0;
  return normalizeNativeIndividualProfile(p);
}
export function tutorialRaisingStatus(actor,profile,hungry=false){
  actor.growthFields??={};actor.growthFields["418"]=hungry?1:0;stepNativeRaisingStatusFeedback(actor,profile);
}
export function tutorialRaisingSleep(actor){tutorialRaisingIdle(actor);actor.state=4;request(actor,13);}
export function tutorialRaisingFeed(actor,profile,foods){
  const found=findNativeRaisingFood(profile,actor.positionQ12,foods,actor.cageDefinitionIndex,nativeHuntSpeciesByIndex(17).field1c);
  if(!found||found.station<0)return false;
  actor.foodSlot=found.food.slot;actor.station=found.station;actor.destinationQ12=found.target;
  actor.mode=0;actor.state=2;request(actor,2);return true;
}
export function tutorialRaisingTreat(actor,profile,kind,rng){
  if(!actor?.tutorialSpecial||![1,15,16].includes(actor.state))return null;
  const result=applyNativeMedicine(profile,{kind,generation:nativeHuntSpeciesByIndex(17).generation,poolSlot:actor.poolSlot,mode:6,rng});
  if(!result.hasCondition)return null;
  const previous=actor.state;actor.state=17;
  actor.treatment=createNativeTreatmentPresentation({...result,kind,previous});return result;
}
const height=actor=>{const box=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[17]].cells[actor.animator.getSnapshot().cell];return box[3]-box[1];};
export function tutorialRaisingCarry(actor,pointer){
  if(![1,15,16].includes(actor.state))return false;
  actor.previousCageDefinition=actor.cageDefinitionIndex;actor.detached=true;actor.state=6;
  actor.carryPointer={...pointer};actor.velocityQ12=[0,0,0];request(actor,11);
  actor.positionQ12=nativeCarryPosition(pointer,height(actor));return true;
}
export function tutorialRaisingRelease(actor){
  if(actor.state!==6)return false;
  actor.state=7;actor.velocityQ12=nativeReleaseVelocity(actor.velocityQ12);actor.phase=0;return true;
}
function reaction(actor,id,ground){beginNativeActivityReaction(actor,id,ground,request);}
export function tutorialRaisingTraining(actor,profile,{rng,season}){
  actor.state=11;
  const trained=enterNativeRaisingTraining(profile,{definition:actor.cageDefinitionIndex,season,level:0},rng);
  actor.training=createNativeTrainingTimeline(trained.commands);if(trained.commands?.length)request(actor,30);
  return trained.profile;
}
export function stepNativeTutorialRaisingActor(actor,profile,{rng,ground,foods=[],season=0}={}) {
  if(!actor?.tutorialSpecial)return {profile,hatched:false};
  actor.animator.advanceNative(4096);actor.nativeFrame++;
  stepNativeRaisingStatusFeedback(actor,profile);stepNativeRaisingRecoveryStars(actor);
  if(actor.state===9)actor.feedback?.animator.advanceNative(4096);
  if(actor.state===18){
    if(actor.eggPhase===0&&actor.pendingHatch){actor.pendingHatch=false;actor.eggPhase=1;request(actor,1,true);}
    else if(actor.eggPhase===1&&!actor.animator.getSnapshot().active)return restoreNativeTutorialHatchedActor(actor,profile,rng);
  }else if(actor.state===2||actor.state===3){
    Object.assign(actor,stepNativeRaisingMovement({...actor,fast:0,hasFood:actor.foodSlot!==null},ground));
    if(nativeRaisingMovementArrived(actor)){
      if(actor.foodSlot!==null){actor.state=5;actor.biteLatched=false;}
      else if(actor.destinationState===11)profile=tutorialRaisingTraining(actor,profile,{rng,season});
      else tutorialRaisingIdle(actor);
    }
  }else if(actor.state===5){
    const food=foods.find(f=>f.slot===actor.foodSlot);
    if(!food?.present)tutorialRaisingIdle(actor);
    else if(actor.sequenceId!==14){
      const p=nativeFoodStation(food,actor.station),square=actor.positionQ12.slice(0,2).reduce((n,v,i)=>n+(v-p[i])**2/4096,0);
      if(square<0x100000){actor.flipBits=actor.positionQ12[0]<food.positionQ12[0]?1:0;food.occupants[actor.station]=actor.poolSlot;request(actor,14);}
      else tutorialRaisingFeed(actor,profile,foods);
    }else{
      const s=nativeHuntSpeciesByIndex(17),result=applyNativeFoodFrame(profile,{generation:s.generation,satietyMaximum:s.field1c,food,
        animationFrame:actor.animator.getSnapshot().frameIndex,biteLatched:actor.biteLatched});
      actor.biteLatched=result.biteLatched;profile=result.profile;
      if(result.consumed)Object.assign(food,result.food);
      if(result.leave){food.occupants[actor.station]=null;tutorialRaisingIdle(actor);if(result.reaction!==null)reaction(actor,result.reaction,ground);}
    }
  }else if(actor.state===6){
    const position=nativeCarryPosition(actor.carryPointer,height(actor));
    actor.velocityQ12=nativeCarryVelocity(actor.velocityQ12,actor.positionQ12,position);actor.positionQ12=position;
  }else if(actor.state===7){
    const flight=stepNativeRaisingFlight(actor,ground,{rng,poolSlot:actor.poolSlot,cameraX:actor.carryPointer.cameraX??0});Object.assign(actor,flight);
    if(flight.settled){
      const cage=ground.cageAt(actor.positionQ12[0]>>12,actor.positionQ12[1]>>12);
      if(cage){
        actor.cageDefinitionIndex=cage.definitionIndex;actor.detached=false;
        const p=structuredClone(profile);p.fields["014"]=cage.definitionIndex;profile=normalizeNativeIndividualProfile(p);
        if(profile.fields["13c"]===1){actor.state=cage.definitionIndex===15?16:15;request(actor,15);}
        else if(cage.definitionIndex===1&&actor.previousCageDefinition!==1){
          reaction(actor,rules.cages[1].entryReaction,ground);actor.destinationState=11;
        }else {if(rules.cages[cage.definitionIndex].entryReaction===-1)profile=applyNativeCageEntryConditions(profile,{definition:cage.definitionIndex,season},rng);tutorialRaisingIdle(actor);}
        return {profile,hatched:false,landed:true};
      }
    }
  }else if(actor.state===17){
    const treatment=actor.treatment,wait=advanceNativeTreatmentPresentation(treatment);
    if(wait.complete){actor.treatment=null;
      if(treatment.previous===4)tutorialRaisingSleep(actor);
      else if(treatment.previous===15){actor.state=15;request(actor,15);}
      else reaction(actor,treatment.reaction,ground);
    }
  }else if(actor.state===15||actor.state===16){request(actor,15);
  }else if(actor.state===9){
    if(stepNativeActivityReaction(actor,ground,request))tutorialRaisingIdle(actor);
  }else if(actor.state===11&&stepNativeTrainingTimeline(actor.training)){
    // Special 02123988 shares the evolution predicate; this fixed first
    // training must not silently enter an unimplemented special evolution.
    const result=evaluateNativeEvolution(profile,{rank:0,roster:[],lifetime:false,lifeThreshold:0xffffffff},rng);
    if(result.code===1)throw new Error("TUTORIAL_SPECIAL_EVOLUTION_REQUIRES_TRACE");
    profile=result.profile;tutorialRaisingIdle(actor);
  }
  // State4 deliberately has no fatigue/growth wake path (02121C10).
  return {profile,hatched:false};
}
