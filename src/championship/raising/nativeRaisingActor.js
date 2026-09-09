// Child of the application-owned Raising lifecycle. Numeric sequences reuse
// the existing character metadata and native animator; no renderer or ticker.
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from "../../data/championship/battleCharacterProfiles.js";
import {createNativeCharacterAnimationTimeline} from "../presentation/characterAnimationTimeline.js";
import {NATIVE_HUNT_CHARACTER_FRAME_CONTRACT} from "../presentation/nativeHuntCharacterAction.js";
import {normalizeNativeIndividualProfile} from "./nativeIndividualProfile.js";
import {constructNativeIndividualForm,selectNativeHatchSpecies} from "./nativeIndividualEvolution.js";
import {nativeHuntSpeciesByIndex} from "../hunt/capture/nativeHuntSources.js";
import {stepNativeRaisingMovement,nativeRaisingMovementArrived} from "./nativeRaisingMovement.js";
import {findNativeRaisingFood,nativeFoodStation} from "./nativeRaisingFood.js";
import {applyNativeFoodFrame,applyNativeMedicine} from "./nativeRaisingCare.js";
import {createNativeTreatmentPresentation,advanceNativeTreatmentPresentation} from './nativeRaisingTreatment.js';
import {selectNativeIdleActivity,stepNativeActivityReaction,finishNativeActivityMovement,beginNativeActivityReaction} from './nativeRaisingActivity.js';
import {applyNativeRaisingGrowth} from './nativeRaisingGrowth.js';
import {nativeCageConditionEffects} from './nativeRaisingOvernight.js';
import {NATIVE_RAISING_LIFECYCLE_RULES as lifecycleRules,evaluateNativeEvolution,evaluateNativeRebirth} from './nativeRaisingLifecycle.js';
import {enterNativeRaisingSleep,exitNativeRaisingSleep,enterNativeRaisingMorning} from './nativeRaisingSleep.js';
import {enterNativeRaisingTraining,applyNativeCageEntryConditions,createNativeTrainingTimeline,stepNativeTrainingTimeline} from './nativeRaisingTraining.js';

function request(actor, sequenceId, force=false, frame=null) {
  if(actor.sequenceId===sequenceId&&!force)return;
  const entityId=BATTLE_SPECIES_ENTITIES[actor.speciesIndex];
  const sequence=BATTLE_CHARACTER_PROFILES[entityId]?.sequences.find(s=>s.id===sequenceId);
  if(!sequence)throw new Error(`RAISING_NATIVE_SEQUENCE_REQUIRED:${entityId}:${sequenceId}`);
  actor.animator=createNativeCharacterAnimationTimeline({...sequence,frames:sequence.frames.map(f=>({...f,texture:`cell:${f.cell}`}))},
    frame===null?{}:{initialSnapshot:{frameIndex:frame,elapsedQ12:0,active:false}});
  actor.sequenceId=sequenceId;
}

export function createNativeRaisingActor(profile, poolSlot) {
  const p=normalizeNativeIndividualProfile(profile);
  if(!Number.isInteger(poolSlot)||poolSlot<0||poolSlot>15)throw new TypeError("INVALID_RAISING_POOL_SLOT");
  const actor={speciesIndex:p.fields["000"],poolSlot,nativeFrame:0,sequenceId:null,animator:null,eggPhase:0,eggTouches:0,pendingTouch:false};
  request(actor,0);return actor;
}

export function projectNativeRaisingActor(actor) {
  return Object.freeze({...actor.animator.getSnapshot(),contract:NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,
    flipBits:actor.flipBits??0,speciesIndex:actor.speciesIndex,nativeFrame:actor.nativeFrame,eggPhase:actor.eggPhase,
    positionQ12:actor.positionQ12?Object.freeze([...actor.positionQ12]):null,cageDefinitionIndex:actor.cageDefinitionIndex??null,
    state:actor.state??(actor.speciesIndex<8?26:1),foodSlot:actor.foodSlot??null,
    treatment:actor.treatment?Object.freeze({kind:actor.treatment.kind,success:actor.treatment.success,elapsed:actor.treatment.elapsed,frame:actor.treatment.icon.getSnapshot().frameIndex}):null,
    training:actor.training?Object.freeze({phase:actor.training.phase,lanes:Object.freeze(actor.training.lanes.map(l=>Object.freeze({...l,command:l.command?Object.freeze({...l.command}):null})))}):null,
    evolution:actor.evolution?Object.freeze({...actor.evolution,targetActor:undefined,
      targetFrame:actor.evolution.targetActor?projectNativeRaisingActor(actor.evolution.targetActor):null}):null});
}

export function touchNativeRaisingEgg(actor) {
  if(actor.speciesIndex>=8 || actor.eggPhase!==0)return false;
  actor.pendingTouch=true;return true;
}

// OVL18 0211C7C4 and exit 0211C8B4 -> 02116DB8 -> 021173C0.
// All eight species +28 thresholds are 60. The count advances from the single
// world-clock minute delta through 0211E194, once per two native minutes.
export function stepNativeRaisingActor(actor,profile,{ageDelta,rng,feeding=null,lifecycle=null}) {
  if(!Number.isInteger(ageDelta)||ageDelta<0||ageDelta>2)throw new TypeError("INVALID_RAISING_AGE_DELTA");
  actor.animator.advanceNative(4096);
  actor.nativeFrame++;
  if(actor.speciesIndex>=8)return lifecycle&&feeding?stepLifecycle(actor,profile,ageDelta,rng,feeding,lifecycle)
    :feeding ? stepFeeding(actor,profile,ageDelta,rng,feeding) : {profile,changed:false,hatched:false};
  if(actor.eggPhase===1) {
    if(actor.animator.getSnapshot().active)return {profile,changed:false,hatched:false};
    const target=selectNativeHatchSpecies(profile,rng,actor.poolSlot);
    const next=constructNativeIndividualForm(profile,target,rng);
    actor.speciesIndex=target;actor.eggPhase=0;actor.eggTouches=0;actor.pendingTouch=false;
    actor.sequenceId=null;request(actor,0);
    if(feeding)enterIdle(actor,rng);
    initializeLifecycle(actor,next);
    return {profile:next,changed:true,hatched:true};
  }
  let next=profile;
  if(ageDelta) {
    next=structuredClone(profile);next.fields["18c"]=(next.fields["18c"]+ageDelta)>>>0;
    next=normalizeNativeIndividualProfile(next);
  }
  if(next.fields["18c"]>60 || actor.eggTouches>=3) {actor.eggPhase=1;request(actor,1);}
  if(actor.pendingTouch)actor.eggTouches++;
  actor.pendingTouch=false;
  return {profile:next,changed:ageDelta!==0,hatched:false};
}

const nativeRandom=(actor,rng,max)=>Math.trunc((max-1)*rng.next(0x26+actor.poolSlot)/102);
function enterIdle(actor,rng) {
  actor.state=1;actor.foodSlot=null;actor.station=-1;actor.biteLatched=false;
  actor.idleElapsed=0;actor.activity=null;actor.activityReaction=-1;actor.peer=null;actor.destinationState=1;
  actor.idleCounter=nativeRandom(actor,rng,60);actor.canDefecate=true;request(actor,actor.slow?1:0,true);
}
function initializeLifecycle(actor,profile){
  const f=profile.fields,s=nativeHuntSpeciesByIndex(f['000']);actor.evolutionChecked=false;actor.evolution=null;actor.training=null;actor.trainingPending=false;actor.treatment=null;
  actor.growthFields={'404':0,'408':0,'40c':0,'410':0,'414':0,'418':0,'41c':0,
    '428':f['04c']?lifecycleRules.extendedLife[s.generation]:lifecycleRules.species[f['000']].life,
    '430':0,'45c':0xffffffff,'460':0,'470':0x36+actor.poolSlot};
}
export function initializeNativeRaisingActor(actor,profile,positionQ12,cageDefinitionIndex,rng,spawnPosition=null,{deferActivity=false,onJoin=null}={}) {
  actor.positionQ12=[...positionQ12];actor.destinationQ12=[...positionQ12];actor.cageDefinitionIndex=cageDefinitionIndex;
  actor.flipBits=nativeRandom(actor,rng,32767)%2;
  actor.angleQ12=nativeRandom(actor,rng,360)*4096;actor.desiredAngleQ12=actor.angleQ12;
  onJoin?.(); // 0211147C -> 0204FC8C, before the position sampler.
  if(spawnPosition){actor.positionQ12=spawnPosition();actor.destinationQ12=[...actor.positionQ12];}
  actor.mode=0;actor.ticks=0;actor.threshold=0;actor.slow=0;actor.foodSlot=null;actor.station=-1;
  actor.state=actor.speciesIndex<8?26:1;
  initializeLifecycle(actor,profile);
  // 021174D4 selects morning state 25 before idle entry. Rebuilding Home
  // must not spend the idle-counter draw before the two overnight passes.
  if(actor.speciesIndex>=8&&!deferActivity)enterIdle(actor,rng);
}
// 0204FE20 notifies the existing residents in insertion order. 02116B70
// refreshes their occupancy fields and consumes their own channel draw.
export function notifyNativeRaisingResidentAdded(actor,existing,rng){
  const members=[...existing].filter(a=>a!==actor&&a.positionQ12&&a.cageDefinitionIndex===actor.cageDefinitionIndex).sort((a,b)=>a.poolSlot-b.poolSlot);
  const count=members.length+1,capacity=lifecycleRules.cages[actor.cageDefinitionIndex].capacity;
  for(const member of members){member.growthFields['40c']=count;member.growthFields['410']=(count-capacity)>>>0;
    member.growthFields['438']=nativeRandom(member,rng,60);}
}
function detachFood(actor,foods) {
  const food=foods.find(f=>f.slot===actor.foodSlot);
  if(food&&actor.station>=0&&food.occupants[actor.station]===actor.poolSlot)food.occupants[actor.station]=null;
  actor.foodSlot=null;actor.station=-1;
}
// The original state table at 02128630 handles the medicine commands only
// in these states. The toolbar's debit gate is separate (02116C14); it must
// not be replaced with this list. In particular training can consume an item
// while its state handler ignores the command.
export function treatNativeRaisingActor(actor,profile,kind,{foods,ground,rng,mode=1}) {
  if(![1,2,3,4,5,16,17,18,19].includes(actor.state))return {profile,applied:false,success:null};
  const previous=actor.state,species=nativeHuntSpeciesByIndex(actor.speciesIndex);
  const result=applyNativeMedicine(profile,{kind,generation:species.generation,poolSlot:actor.poolSlot,mode,rng});
  // The medicine writer runs before the previous state's exit callback.
  // Sleep still applies early-waking effects; a full eater still receives
  // its affection/fatigue exit writes, even when the medicine was unnecessary.
  let next=result.profile;
  if(previous===4)next=exitNativeRaisingSleep(next,actor.poolSlot,rng);
  if(previous===5&&(next.fields['008']|0)>=species.field1c){
    next=structuredClone(next);next.fields['020']=Math.min(100,(next.fields['020']+2)|0);
    next.fields['00c']=(Math.trunc((next.fields['178']|0)/10)*8)>>>0;next=normalizeNativeIndividualProfile(next);
  }
  detachFood(actor,foods);
  if(!result.hasCondition){const delta=beginNativeActivityReaction(actor,22,ground,request);
    if(delta){next=structuredClone(next);next.fields['01c']=Math.max(0,Math.min(100,(next.fields['01c']+delta)|0));next=normalizeNativeIndividualProfile(next);}
    return {...result,profile:next,applied:true};}
  actor.state=20;actor.treatment=createNativeTreatmentPresentation({...result,kind,previous});
  return {...result,profile:next,applied:true};
}
export function interruptNativeRaisingFeeding(actor,foods,rng) {detachFood(actor,foods);enterIdle(actor,rng);}
export function removeNativeRaisingFoodTarget(actor,foods,rng) {
  const eating=actor.state===5;detachFood(actor,foods);
  if(eating)react(actor,1,30);else enterIdle(actor,rng);
}
function react(actor,sequence,ticks) {actor.state=9;actor.activity=null;actor.activityReaction=-1;actor.reactionTicks=ticks;actor.sequenceId=null;if(sequence>=0)request(actor,sequence);}
function stepFeeding(actor,profile,ageDelta,rng,{ground,foods,signals,actors,fullGrowth=false}) {
  let next=profile,changed=false,foodChanged=false;
  const modify=()=>{if(next===profile||Object.isFrozen(next.fields))next=structuredClone(next);changed=true;return next.fields;};
  let f=profile.fields;
  const species=nativeHuntSpeciesByIndex(actor.speciesIndex);
  actor.slow=f["134"]===1||f["138"]===1||(f["00c"]|0)>=Math.trunc((f["178"]|0)/10)*9
    ||(f["050"]|0)<=Math.trunc((f["058"]|0)/10)*2?1:0;
  // The hunger prefix of 02114A10 is independent of its unbound training,
  // evolution and social writers. Feeding does not claim those are complete.
  if(!fullGrowth&&ageDelta&&actor.state!==5&&(f["008"]|0)>0) {
    f=modify();
    if(f["174"]<240)f["174"]=Math.min(240,f["174"]+ageDelta);
    else {f["170"]+=ageDelta;if(f["170"]>=120){f["170"]=0;f["008"]--;}}
  }
  if(actor.state===9) {
    if(actor.activity?stepNativeActivityReaction(actor,ground,request):--actor.reactionTicks<=0)enterIdle(actor,rng);
    return {profile:changed?normalizeNativeIndividualProfile(next):profile,changed,hatched:false,foodChanged};
  }
  if(actor.state===13||actor.state===15){
    if(stepNativeActivityReaction(actor,ground,request))enterIdle(actor,rng);
    return {profile:changed?normalizeNativeIndividualProfile(next):profile,changed,hatched:false,foodChanged};
  }
  const notice=signals.get(actor.cageDefinitionIndex);
  if(notice?.landed&&(actor.state===1||actor.state===2)) {
    const roll=nativeRandom(actor,rng,32767)%100;
    if(roll<50&&[0,4,5,6,7].includes(f["018"])) {
      detachFood(actor,foods);
      if(f["018"]===0||f["018"]===4){f=modify();if(f["01c"]>0)f["01c"]--;react(actor,30,70);}
      else react(actor,f["018"]===7?0:-1,60);
      return {profile:changed?normalizeNativeIndividualProfile(next):profile,changed,hatched:false,foodChanged};
    }
  }
  if(notice?.search&&(actor.state===1||actor.state===2)&&actor.foodSlot===null) {
    const found=findNativeRaisingFood(next,actor.positionQ12,foods,actor.cageDefinitionIndex,species.field1c);
    if(found&&found.station>=0) {
      actor.foodSlot=found.food.slot;actor.station=found.station;actor.destinationQ12=found.target;actor.mode=0;
      actor.state=2;request(actor,actor.slow?12:2);
    }
  }
  if([2,3,16].includes(actor.state)) {
    if(actor.state===3&&(f['00c']|0)>=Math.trunc((f['178']|0)/10)*9){actor.state=2;request(actor,actor.slow?12:2,true);}
    const movement=stepNativeRaisingMovement({...actor,fast:f["01c"]>=90?1:0,hasFood:actor.foodSlot!==null},ground);Object.assign(actor,movement);
    if(nativeRaisingMovementArrived(actor)){
      if(actor.foodSlot!==null)actor.state=5;
      else if(finishNativeActivityMovement(actor,request))enterIdle(actor,rng);
    }
  } else if(actor.state===5) {
    const food=foods.find(entry=>entry.slot===actor.foodSlot);
    if(actor.sequenceId!==14) {
      if(!food?.present){detachFood(actor,foods);enterIdle(actor,rng);}
      else {
        const target=nativeFoodStation(food,actor.station),dx=actor.positionQ12[0]-target[0],dy=actor.positionQ12[1]-target[1];
        const square=Number(((BigInt(dx)*BigInt(dx)+2048n)>>12n)+((BigInt(dy)*BigInt(dy)+2048n)>>12n));
        if(square<0x100000) {
          actor.flipBits=actor.positionQ12[0]<food.positionQ12[0]?1:0;
          food.occupants[actor.station]=actor.poolSlot;
          // 02115660 / 02116BE0: another actor targeting this exact station
          // returns to idle; it must select an available station on a later pulse.
          for(const other of actors)if(other!==actor&&other.foodSlot===actor.foodSlot&&other.station===actor.station)
            interruptNativeRaisingFeeding(other,foods,rng);
          actor.biteLatched=false;request(actor,14);
        } else {
          detachFood(actor,foods);
          const found=findNativeRaisingFood(next,actor.positionQ12,foods,actor.cageDefinitionIndex,species.field1c);
          if(found&&found.station>=0){actor.foodSlot=found.food.slot;actor.station=found.station;actor.destinationQ12=found.target;actor.mode=0;
            actor.state=2;request(actor,actor.slow?12:2);}
          else enterIdle(actor,rng);
        }
      }
    } else if(food) {
      const result=applyNativeFoodFrame(next,{generation:species.generation,satietyMaximum:species.field1c,food,
        animationFrame:actor.animator.getSnapshot().frameIndex,biteLatched:actor.biteLatched});
      actor.biteLatched=result.biteLatched;
      if(result.consumed){next=result.profile;changed=true;Object.assign(food,result.food);foodChanged=true;}
      if(result.leave) {
        detachFood(actor,foods);
        if((next.fields["008"]|0)>=species.field1c) {
          f=modify();f["020"]=Math.max(0,Math.min(100,(f["020"]+2)|0));
          f["00c"]=(Math.trunc((f["178"]|0)/10)*8)>>>0;react(actor,28,60);
        } else enterIdle(actor,rng);
      }
    }
  } else if(actor.state===1) {
    const delta=selectNativeIdleActivity(actor,next,{ground,actors,rng,request});
    if(delta){f=modify();f['01c']=Math.max(0,Math.min(100,f['01c']+delta));}
  }
  return {profile:changed?normalizeNativeIndividualProfile(next):profile,changed,hatched:false,foodChanged};
}

export function wakeNativeRaisingActor(actor,profile,foods,rng) {
  if(actor.state!==4)return null;
  const next=exitNativeRaisingSleep(profile,actor.poolSlot,rng);detachFood(actor,foods);enterIdle(actor,rng);return next;
}
export function startNativeRaisingMorning(actor,profile,rng) {
  if(actor.speciesIndex<8)return profile;
  actor.state=25;request(actor,13,true);
  const morning=enterNativeRaisingMorning(profile,actor.poolSlot,rng);actor.morningWait=morning.waitFrames;actor.morningFrames=0;return morning.profile;
}
export function enterNativeRaisingCage(actor,profile,{previousDefinition,ground,season,level=0},rng){
  if(actor.speciesIndex<8)return profile;
  let p=profile;const definition=actor.cageDefinitionIndex,reaction=lifecycleRules.cages[definition].entryReaction;
  const delta=beginNativeActivityReaction(actor,reaction,ground,request);
  if(delta){p=structuredClone(p);p.fields['01c']=Math.max(0,Math.min(100,p.fields['01c']+delta));}
  if(reaction===-1)p=applyNativeCageEntryConditions(p,{definition,season,level},rng);
  const f=p.fields,healthy=!['134','138','13c'].some(k=>f[k]===1)&&(f['050']|0)>Math.trunc((f['058']|0)/10);
  actor.training=null;actor.trainingPending=healthy&&reaction!==-1&&previousDefinition!==definition;
  if(!healthy){actor.state=f['13c']===1?18:1;actor.activity=null;request(actor,actor.state===18?15:1,true);}
  else if(previousDefinition===definition&&reaction!==-1)enterIdle(actor,rng);
  return normalizeNativeIndividualProfile(p);
}
export function beginNativeRaisingEvolution(actor,selection,rng) {
  actor.state=selection.target<0?21:12;actor.evolution={oldSpecies:actor.speciesIndex,target:selection.target,index:selection.actor?.['1f4']??0,
    last:selection.actor?.['1f0']??1,inherited:selection.actor?.['464']??0,phase:0,elapsed:0,period:20,reveal:false,totalFrames:0,targetActor:null};
  if(selection.target>=0){const targetActor={speciesIndex:selection.target,sequenceId:null,animator:null,nativeFrame:0};
    request(targetActor,selection.target<8?0:39,true);actor.evolution.targetActor=targetActor;}
  request(actor,39,true);
}
// 0211A338 phase counters. Scene transforms remain a projection; this does not
// create another animation clock or write the form before the original exit.
export function stepNativeRaisingEvolution(actor,profile,rng) {
  const e=actor.evolution;if(!e)return {profile,changed:false};
  e.elapsed++;e.totalFrames++;actor.animator.advanceNative(4096);
  if(e.targetActor)e.targetActor.animator.advanceNative(4096);
  if(e.target<0){ // 0211C038 / 0211C778: effect sequence 15 advances only in phase 3.
    if(e.phase===0&&e.elapsed>=15){e.phase=1;e.elapsed=0;}
    else if(e.phase===1&&e.elapsed>=10){e.phase=2;e.elapsed=0;}
    else if(e.phase===2){if(e.elapsed%e.period===0){e.period-=2;e.elapsed=0;if(e.period===0)e.phase=3;}
      e.reveal=e.phase===3||e.elapsed<Math.floor(e.period/2);}
    else if(e.phase===3&&e.elapsed>=30){actor.evolution=null;return {profile,changed:false,disappeared:true};}
    return {profile,changed:false};
  }
  if(e.phase===0&&e.elapsed>=15){e.phase=1;e.elapsed=0;}
  else if(e.phase===1&&e.elapsed>=20){e.phase=2;e.elapsed=0;}
  else if(e.phase===2){
    if(e.elapsed%e.period===0){e.period-=2;e.elapsed=0;
      if(e.period===0){e.phase=3;e.reveal=true;}}
    if(e.phase===2){if(e.elapsed===0)e.reveal=true;else if(e.elapsed===Math.floor(e.period/2))e.reveal=false;}
  } else if(e.phase===3&&e.elapsed>=25){e.phase=4;e.elapsed=0;request(e.targetActor,0,true);}
  else if(e.phase===4&&e.elapsed>3){e.phase=5;e.elapsed=0;}
  else if(e.phase===5&&e.elapsed>7){e.phase=6;e.elapsed=0;}
  else if(e.phase===6&&e.elapsed>=60){e.phase=7;e.elapsed=0;}
  else if(e.phase===7&&e.elapsed>=30){
    const event={oldSpecies:e.oldSpecies,target:e.target,index:e.index,inherited:e.inherited};
    let next=structuredClone(constructNativeIndividualForm(profile,e.target,rng));
    if(e.target<8){next.fields['024']=0;next.fields['028']=0;next.fields['01c']=0;next.narrowFields['03d']=0;}
    else if(!e.last)next.fields['020']=Math.min(100,(next.fields['020']+10)|0);
    actor.speciesIndex=e.target;actor.sequenceId=null;request(actor,0,true);initializeLifecycle(actor,next);
    if(e.target<8){actor.state=26;actor.eggPhase=0;actor.eggTouches=0;}else{react(actor,33,60);}
    return {profile:normalizeNativeIndividualProfile(next),changed:true,evolved:true,event};
  }
  return {profile,changed:false};
}

function stepLifecycle(actor,profile,ageDelta,rng,feeding,context) {
  let next=profile,result={profile,changed:false};const s=nativeHuntSpeciesByIndex(actor.speciesIndex),a=actor.growthFields;
  const residents=context.residents,capacity=lifecycleRules.cages[actor.cageDefinitionIndex].capacity;
  a['40c']=residents.length;a['410']=(residents.length-capacity)>>>0;
  const update=()=>{next=structuredClone(next);result.changed=true;return next.fields;};
  if(actor.state===20){
    const treatment=actor.treatment,wait=advanceNativeTreatmentPresentation(treatment);
    if(wait.complete){
      actor.treatment=null;
      if(wait.nextState===4){actor.state=4;request(actor,13,true);}
      else if(wait.nextState===18){actor.state=18;request(actor,15,true);}
      else {const delta=beginNativeActivityReaction(actor,treatment.reaction,feeding.ground,request);
        if(delta){const f=update();f['01c']=Math.max(0,Math.min(100,(f['01c']+delta)|0));}}
    }
  }
  else if(actor.state===25){if(++actor.morningFrames>actor.morningWait)enterIdle(actor,rng);}
  else if(actor.state===11){
    if(stepNativeTrainingTimeline(actor.training)){
      if(actor.training.phase===2){actor.training=null;react(actor,0,30);}
      else{
        update()['020']=Math.min(100,next.fields['020']+1);
        const selection=evaluateNativeEvolution(next,{rank:context.rank,roster:context.roster,lifetime:false,lifeThreshold:a['428']},rng);
        next=selection.profile;actor.training=null;
        if(selection.code===1&&context.minute<1290){beginNativeRaisingEvolution(actor,selection,rng);return {profile:next,changed:true,evolutionStarted:true};}
        if((next.fields['040']|0)>30&&rng.next(0x86+actor.poolSlot)%100<Math.min(100,next.fields['040'])){
          const f=update();f['134']=1;f['020']=Math.max(0,f['020']-5);next.narrowFields['03d']=Math.min(7,next.narrowFields['03d']+1);
        }
        enterIdle(actor,rng);
      }
    }
  }
  else if(actor.state===18||actor.state===19){
    const f=next.fields;
    if(f['13c']===0)enterIdle(actor,rng);
    else if(actor.state===18&&(f['050']|0)<=Math.trunc((f['058']|0)/10)&&[15,18].includes(actor.cageDefinitionIndex))actor.state=19;
    else if(actor.state===18&&f['188']>1440){const rebirth=evaluateNativeRebirth(next,false);detachFood(actor,feeding.foods);beginNativeRaisingEvolution(actor,{target:rebirth.target},rng);return {profile:rebirth.profile,changed:true,evolutionStarted:true};}
  }
  else if(actor.state===4){if((next.fields['17c']|0)>(next.fields['178']|0)){next=exitNativeRaisingSleep(next,actor.poolSlot,rng);result.changed=true;enterIdle(actor,rng);}}
  else if(actor.state===14){
    actor.wasteFrames++;
    if(actor.wasteFrames===30){const f=update();if(context.spawnWaste(actor.speciesIndex,actor.positionQ12))f['190']=0;
      else {if((f['01c']|0)<100)f['01c']++;f['190']=((f['190']|0)>>1)>>>0;}}
    if(actor.wasteFrames>=60)enterIdle(actor,rng);
  } else if(actor.state===1){
    const f=next.fields;
    if(actor.canDefecate&&f['190']>lifecycleRules.wasteThresholds[s.generation]){
      if(feeding.ground.readClearance(Math.trunc((actor.positionQ12[0]>>12)/8),Math.trunc((actor.positionQ12[1]>>12)/8))>1){actor.state=14;actor.wasteFrames=0;request(actor,0,true);}
      else actor.canDefecate=false;
    }
    if(actor.state===1&&(f['00c']|0)>=(f['178']|0)){next=enterNativeRaisingSleep(next,actor.poolSlot,rng);result.changed=true;actor.state=4;request(actor,13,true);}
    if(actor.state===1){
      // 021177AC dirty environment periodic branch. Command pulses from actual
      // waste/rotten food are carried on the same Cage context.
      if(context.dirtyRemoved&&!context.wasteCount&&!context.rottenFoodCount){const delta=beginNativeActivityReaction(actor,9,feeding.ground,request);if(delta){const m=update();m['01c']=Math.max(0,Math.min(100,m['01c']+delta));}}
      else if(a['408']&&(f['1a0']|0)>60){const m=update();m['1a0']=0;m['01c']=Math.min(100,(m['01c']+context.wasteCount+context.rottenFoodCount-1)|0)>>>0;beginNativeActivityReaction(actor,18,feeding.ground,request);}
      else if((a['410']|0)>0&&(f['1a4']|0)>180){const m=update();m['1a4']=0;m['01c']=Math.min(100,(m['01c']+(a['410']|0)-1)|0)>>>0;beginNativeActivityReaction(actor,18,feeding.ground,request);}
      else if([5,6].includes(s.generation)&&capacity<=2&&f['1b4']>180){update()['1b4']=0;beginNativeActivityReaction(actor,18,feeding.ground,request);}
      else if(residents.length<=1&&f['018']===7&&f['1a8']>180){update()['1a8']=0;beginNativeActivityReaction(actor,18,feeding.ground,request);}
    }
    if(actor.state===1&&context.minute<1290){
      const lifetime=next.fields['18c']>a['428'];
      if(lifetime||!actor.evolutionChecked){if(!lifetime)actor.evolutionChecked=true;
        let selection=evaluateNativeEvolution(next,{rank:context.rank,roster:context.roster,lifetime,lifeThreshold:a['428']},rng);
        next=selection.profile;a['428']=selection.actor['428'];result.changed=true;
        if(lifetime&&selection.code!==1&&selection.code!==2){const rebirth=evaluateNativeRebirth(next,selection.code!==0);next=rebirth.profile;
          selection={target:rebirth.target,code:1};}
        if(selection.code===1){detachFood(actor,feeding.foods);beginNativeRaisingEvolution(actor,selection,rng);return {profile:next,changed:true,evolutionStarted:true};}
      }
    }
    if(actor.state===1&&(next.fields['180']>=1200||next.fields['184']>=1200||(next.fields['050']|0)<=Math.trunc((next.fields['058']|0)/10))){
      const f=update();f['13c']=1;f['020']=Math.max(0,f['020']-1);actor.state=18;request(actor,15,true);
    }
    if(actor.state===1){const fed=stepFeeding(actor,next,ageDelta,rng,{...feeding,fullGrowth:true});result={...fed,changed:result.changed||fed.changed};next=fed.profile;}
  } else {result=stepFeeding(actor,next,ageDelta,rng,{...feeding,fullGrowth:true});next=result.profile;}
  if(actor.state===1&&actor.trainingPending){
    actor.trainingPending=false;actor.state=11;
    const trained=enterNativeRaisingTraining(next,{definition:actor.cageDefinitionIndex,season:context.season,level:context.cageLevel??0,stressed:a['404']===1},rng);
    next=trained.profile;result.changed=true;actor.training=createNativeTrainingTimeline(trained.commands);if(trained.commands?.length)request(actor,30,true);
  }
  const grown=applyNativeRaisingGrowth(next,a,{state:actor.state,ageDelta,baseUnit:60,generation:s.generation,mode:context.season,minute:context.minute,
    ranchSize:capacity,effects:nativeCageConditionEffects(actor.cageDefinitionIndex,context.season,context.cageLevel??1),satietyMaximum:s.field1c,
    peerCount:residents.length,residents,wasteCount:context.wasteCount,rottenFoodCount:context.rottenFoodCount,
    dirtyAdded:context.dirtyAdded,dirtyRemoved:context.dirtyRemoved},rng);
  actor.growthFields=grown.actorFields;
  return {...result,profile:grown.profile,changed:result.changed||ageDelta>0||grown.events.length>0||next!==profile};
}

export function stepNativeRaisingAgeClock(remainder,minuteDelta) {
  if(!Number.isInteger(remainder)||remainder<0||remainder>4||!Number.isInteger(minuteDelta)||minuteDelta<0)throw new TypeError("INVALID_RAISING_AGE_CLOCK");
  let total=remainder+minuteDelta;
  if(total>4)total=2;
  return total<2 ? {remainder:total,ageDelta:0} : {remainder:total-2,ageDelta:total>>>1};
}
