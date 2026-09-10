// OVL18 02115410 (encoded icon), 02119998 -> 0211DF10 (one native step).
// This is a child of the resident's clock, independent of its Main pose.
import data from '../../data/championship/catalogs/raising-feedback.r1.json' with {type:'json'};
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../../data/championship/battleCharacterProfiles.js';
import {createNativeCharacterAnimationTimeline} from '../presentation/characterAnimationTimeline.js';

export function nativeRaisingFeedbackPosition(positionQ12,width,height,flipBits,sequenceId){
  const position=[...positionQ12];
  if(sequenceId!==5)position[2]+=Math.floor(height/5)*4*4096;
  if(sequenceId<=1){position[2]-=Math.floor(height/5)*2*4096;position[0]+=Math.floor(width/4)*4096*(flipBits? -1:1);}
  return position;
}

export function requestNativeRaisingFeedback(actor, encoded) {
  if(!Number.isInteger(encoded)||encoded<0)return;
  const sequenceId=encoded&127,fixedFrame=encoded>>8;
  const sequence=data.sequences.find(s=>s.id===sequenceId);
  if(!sequence)throw new Error(`RAISING_FEEDBACK_SEQUENCE_REQUIRED:${sequenceId}`);
  const cell=actor.animator.getSnapshot().cell;
  const box=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[actor.speciesIndex]].cells[cell];
  const position=nativeRaisingFeedbackPosition(actor.positionQ12,box[2]-box[0],box[3]-box[1],actor.flipBits,sequenceId);
  actor.feedback={encoded,sequenceId,positionQ12:position,
    animator:createNativeCharacterAnimationTimeline({...sequence,frames:sequence.frames.map(f=>({...f,texture:`feedback:${f.cell}`}))},
      fixedFrame>0?{initialSnapshot:{frameIndex:fixedFrame,elapsedQ12:0,active:false}}:{})};
}

export function projectNativeRaisingFeedback(actor) {
  if(actor.state!==9||!actor.feedback)return null;
  const f=actor.feedback;
  return Object.freeze({...f.animator.getSnapshot(),sequenceId:f.sequenceId,encoded:f.encoded,
    positionQ12:Object.freeze([...f.positionQ12])});
}

// OVL18 02110EC8..02110FAC chooses one status every 60 updates. ARM9
// 02065368..020654D8 maps these codes to fixed frames in common sequence 6.
export function stepNativeRaisingStatusFeedback(actor,profile){
  const f=profile.fields,a=actor.growthFields??{},codes=[];
  if(actor.statusMusic)codes.push(4);
  else{
    if(f['134'])codes.push(1);
    if(f['138'])codes.push(2);
    if(a['418']&&actor.state!==4)codes.push(3);
    if(a['404'])codes.push(5);
  }
  actor.statusCode=0;
  if(codes.length){actor.statusCounter=(actor.statusCounter??0)+1;
    if(actor.statusCounter>=60*codes.length)actor.statusCounter=0;
    actor.statusCode=codes[Math.floor(actor.statusCounter/60)];}
}

export function projectNativeRaisingStatusFeedback(actor){
  if(!actor.statusCode||!actor.positionQ12)return null;
  const frameIndex={1:0,2:1,3:4,4:5,5:6}[actor.statusCode];
  const box=BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[actor.speciesIndex]].cells[actor.animator.getSnapshot().cell];
  const position=[...actor.positionQ12];position[2]+=Math.floor((box[3]-box[1])/5)*4*4096;
  return Object.freeze({sequenceId:6,frameIndex,cell:data.sequences[6].frames[frameIndex].cell,
    positionQ12:Object.freeze(position),statusCode:actor.statusCode});
}
