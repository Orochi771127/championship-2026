// OVL18 idle tail 02117B90, selectors 02115B8C/02115CD8, target 02113AF4.
// Numeric source columns and original Main sequences; no presentation RNG.
import data from '../../data/championship/catalogs/raising-activity.r1.json' with {type:'json'};
import {nativeNormalizeQ12} from '../hunt/capture/nativeCapturePhases.js';
import {nativeRaisingHeadings} from './nativeRaisingGround.js';
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../../data/championship/battleCharacterProfiles.js';
import {battleAngleIndex} from '../battle/battleNativeMath.js';
import {requestNativeRaisingFeedback} from './nativeRaisingFeedback.js';
export const nativeActivityRandom=(actor,rng,max)=>Math.trunc((max-1)*rng.next(0x26+actor.poolSlot)/102);
export function selectNativeCageReaction(definition,field18,poolSlot,rng) {
  const row=data.cage[definition];if(!row)throw new Error('RAISING_CAGE_REACTION_SOURCE_REQUIRED');
  const roll=rng.next(0x46+poolSlot)%90;
  if(roll<30)return row[0];if(roll<60)return row[1];
  if(field18&row[2])return 9;if(field18&row[3])return 22;
  return row[rng.next(0x46+poolSlot)%100<50?0:1];
}
export function selectNativePersonalityReaction(personality,poolSlot,rng) {
  const pair=data.personality[personality];if(!pair)throw new Error('RAISING_PERSONALITY_SOURCE_REQUIRED');
  return pair[rng.next(0x56+poolSlot)%100<50?0:1];
}
export function nativeRaisingWanderTarget(actor,rng) {
  const distance=32+nativeActivityRandom(actor,rng,96),angle=nativeActivityRandom(actor,rng,360);
  const [sin,cos]=nativeRaisingHeadings[angle],vector=nativeNormalizeQ12([cos,sin,0]);
  return [actor.positionQ12[0]+vector[0]*distance,actor.positionQ12[1]+vector[1]*distance,0];
}
const tile=p=>p.slice(0,2).map(n=>Math.trunc((n>>12)/8)||0);
const angleTo=(a,b)=>Math.trunc(battleAngleIndex(b[1]-a[1],b[0]-a[0])*360/65535)*4096;
const nativeSequence=(actor,id)=>actor.slow&&[0,2,3].includes(id)?id===0?1:12:id;
export function beginNativeActivityReaction(actor,id,ground,request) {
  actor.activityReaction=id;
  const spec=data.reactions[id];if(!spec)return 0; // original returns -1, retaining idle and its elapsed counter
  actor.state=spec.state;actor.activity={...spec,elapsed:0,alternatePhase:0};
  // 02119880 uses the conditional resident wrapper, not force-and-restart.
  if(spec.state===9&&spec.sequence>=0)request(actor,nativeSequence(actor,spec.sequence));
  actor.feedback=null;
  if(spec.state===9)requestNativeRaisingFeedback(actor,spec.icon);
  if(spec.state===3||spec.state===16){
    actor.mode=1;actor.ticks=spec.movementTicks;actor.threshold=ground.readClearance(...tile(actor.positionQ12));
    actor.destinationState=spec.destinationState;request(actor,nativeSequence(actor,spec.state===3?3:11));
  }
  if(spec.state===13){actor.activity.phase=0;actor.activity.velocity=0x5000;request(actor,0,true,0);}
  return spec.conditionDelta;
}
export function selectNativeIdleActivity(actor,profile,{ground,actors,rng,request}) {
  actor.idleElapsed++;
  if(actor.idleElapsed<actor.idleCounter)return 0;
  const draw=nativeActivityRandom(actor,rng,4),choice=actor.slow?4:draw;
  if(choice===0)return beginNativeActivityReaction(actor,selectNativeCageReaction(actor.cageDefinitionIndex,data.species[actor.speciesIndex].field18,actor.poolSlot,rng),ground,request);
  if(choice===1)return beginNativeActivityReaction(actor,selectNativePersonalityReaction(profile.fields['018'],actor.poolSlot,rng),ground,request);
  const walk=()=>{actor.state=2;actor.mode=0;actor.destinationState=1;actor.destinationQ12=nativeRaisingWanderTarget(actor,rng);request(actor,nativeSequence(actor,2));return 0;};
  // 02050010 -> Cage resident list, with its original physical slot order.
  const peers=[...actors].filter(other=>other!==actor&&!other.detached&&other.cageDefinitionIndex===actor.cageDefinitionIndex);
  if(choice===4||!peers.length||nativeActivityRandom(actor,rng,3)===0)return walk();
  let peer=null,distance=-1;
  for(const other of peers){const dx=(other.positionQ12[0]>>12)-(actor.positionQ12[0]>>12),dy=(other.positionQ12[1]>>12)-(actor.positionQ12[1]>>12),d=dx*dx+dy*dy;
    if(distance===-1||d<distance){peer=other;distance=d;}}
  if(!peer)return walk();
  const a=nativeHuntSpeciesByIndex(actor.speciesIndex),b=nativeHuntSpeciesByIndex(peer.speciesIndex);
  const aExtra=data.species[actor.speciesIndex],bExtra=data.species[peer.speciesIndex];
  const lower=a.generation<b.generation||(a.generation===b.generation&&aExtra.field3a<bExtra.field3a);
  const friendly=actor.speciesIndex===peer.speciesIndex||((aExtra.field18===bExtra.field18||a.attribute===b.attribute)&&lower);
  const different=aExtra.field18!==bExtra.field18&&a.attribute!==b.attribute;
  const rivals=different&&(({1:16,16:1,8:32,32:8,2:4,4:2,128:64,64:128}[aExtra.field18]===bExtra.field18)||([1,2].includes(a.attribute)&&[1,2].includes(b.attribute)));
  const cell=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[peer.speciesIndex]].cells[0],radius=Math.trunc((cell[2]-cell[0])/2)*3;
  if(friendly){
    if(distance<=radius*radius)return beginNativeActivityReaction(actor,peer.activityReaction>=0?peer.activityReaction:[4,18].includes(peer.state)?12:-1,ground,request);
    beginNativeActivityReaction(actor,1,ground,request);actor.mode=2;actor.peer=peer;actor.desiredAngleQ12=angleTo(actor.positionQ12,peer.positionQ12);return 0;
  }
  if(!rivals)return walk();
  if(distance>radius*radius){actor.state=1;return 0;}
  if(nativeActivityRandom(actor,rng,100)<50){actor.flipBits=actor.positionQ12[0]<peer.positionQ12[0]?1:0;return beginNativeActivityReaction(actor,0,ground,request);}
  return beginNativeActivityReaction(actor,1,ground,request);
}
// Returns true on the original handler's completion condition.
export function stepNativeActivityReaction(actor,ground,request) {
  const action=actor.activity;if(!action)return false;
  action.elapsed++;
  if(actor.state===13){
    if(action.phase===0&&action.elapsed>30){action.phase=1;request(actor,0,true,1);}
    else if(action.phase===1){
      action.velocity-=0x800;
      const p=[actor.positionQ12[0]+(actor.flipBits===0?-4096:4096),actor.positionQ12[1],actor.positionQ12[2]+action.velocity];
      if(p[2]<=0){p[2]=0;action.phase=2;request(actor,0,true,0);}
      if(ground.readTerrain(...tile(p))===1)p[0]=actor.positionQ12[0];actor.positionQ12=p;
    } else if(action.phase===2&&action.elapsed>30)return true;
    return false;
  }
  if(actor.state===15){
    if(action.elapsed>60)return true;
    actor.directionQ12[2]-=0x800;
    const p=actor.positionQ12.map((n,i)=>n+actor.directionQ12[i]);
    if(p[2]<=0){p[2]=0;actor.directionQ12[2]=-(actor.directionQ12[2]>>1);
      if(actor.directionQ12.some(Boolean)){const v=nativeNormalizeQ12(actor.directionQ12);actor.directionQ12[0]-=v[0]>>1;actor.directionQ12[1]-=v[1]>>1;}}
    if(ground.readTerrain(...tile(p))===1){p[0]=actor.positionQ12[0];p[1]=actor.positionQ12[1];}
    actor.positionQ12=p;return false;
  }
  if(actor.state!==9)return false;
  // 02119694..021196C8: reaction-local facing timer runs before the
  // alternate/completion checks, including the last update of the reaction.
  if(action.flipTicks>0&&action.elapsed%action.flipTicks===0)actor.flipBits=actor.flipBits===0?1:0;
  if(action.completion===1)return !actor.animator.getSnapshot().active;
  if(action.completion===2)return action.elapsed>=action.ticks;
  if(action.completion===4&&action.elapsed%action.alternateTicks===0){
    if(action.secondTicks>=0){
      if(action.alternatePhase)return true;
      request(actor,action.alternate);requestNativeRaisingFeedback(actor,action.alternateIcon);
      action.alternatePhase=1;action.alternateTicks=action.secondTicks;action.flipTicks=0;
    } else {
      action.alternatePhase^=1;request(actor,action.alternatePhase?action.alternate:action.sequence);
      if(!action.alternatePhase&&--action.alternateCount<=0)return true;
    }
  }
  return false;
}
export function finishNativeActivityMovement(actor,request) {
  if(actor.destinationState===15){actor.state=15;actor.activity={elapsed:0};actor.directionQ12[2]=0x3000;request(actor,15,true);return false;}
  return true;
}
