// Recovery-cage stars. OVL18 02110FB0..021110D4, run right after the status
// icon selector (02110EC8..02110FAC) in the same resident update. A child of the
// resident's clock: it reads the cage definition and the resident state, never
// HP, and it heals nothing. Receipt: docs/research/RAISING_RECOVERY_STARS_CPU_2026-09-14.json.
import data from '../../data/championship/catalogs/raising-feedback.r1.json' with {type:'json'};
import {createNativeCharacterAnimationTimeline} from '../presentation/characterAnimationTimeline.js';

// 02110FD4 reads the cage record's definition (ARM9 02050028, record +4) and
// compares it with 0x0F, 0x12 and 0x1C: ミニほけんしつ, おんせん, ほけんしつ.
export const NATIVE_RECOVERY_STAR_CAGES=Object.freeze([15,18,28]);
export const NATIVE_RECOVERY_STAR_SEQUENCE=32; // 02111004 / 021110CC mov r1,#0x20
export const NATIVE_RECOVERY_STAR_REST=120;    // 02111068 mov r0,#0x78
const START_BLOCKING_STATES=Object.freeze([6,7,20]); // 02110FC0..02110FCC
const STOPPING_STATE=6;                              // 02111034

const sequence=data.sequences.find(s=>s.id===NATIVE_RECOVERY_STAR_SEQUENCE);
const play=()=>createNativeCharacterAnimationTimeline({...sequence,
  frames:sequence.frames.map(f=>({...f,texture:`feedback:${f.cell}`}))});
// The effect position is the body position lifted by 0x1000 (02111014/02111094).
const lifted=p=>[p[0],p[1],p[2]+4096];

export function stepNativeRaisingRecoveryStars(actor){
  const stars=actor.recoveryStars??={active:false,rest:0,animator:null,submitted:false,positionQ12:null};
  stars.submitted=false;
  if(!stars.active){
    if(actor.positionQ12&&!START_BLOCKING_STATES.includes(actor.state)&&NATIVE_RECOVERY_STAR_CAGES.includes(actor.cageDefinitionIndex)){
      stars.active=true;stars.rest=0;stars.positionQ12=lifted(actor.positionQ12);stars.animator=play();
    }
  }else if(actor.state===STOPPING_STATE){stars.active=false;stars.rest=0;}
  if(!stars.active)return;
  if(stars.rest===0){
    // 02111060: a finished play starts the rest and draws nothing this update.
    if(!stars.animator.getSnapshot().active){stars.rest=NATIVE_RECOVERY_STAR_REST;return;}
    stars.positionQ12=lifted(actor.positionQ12);
    stars.animator.advanceNative(4096); // 0211109C 02047A08(+0x310, 0x1000)
    stars.submitted=true;               // 021110AC 0211DF10(+0x310, 0, 0)
    return;
  }
  // 021110B4: count the rest down; restart on the update it reaches zero.
  if(--stars.rest<=0){stars.rest=0;stars.animator=play();}
}

export function projectNativeRaisingRecoveryStars(actor){
  const stars=actor.recoveryStars;
  if(!stars?.submitted)return null;
  const {frameIndex}=stars.animator.getSnapshot();
  return Object.freeze({sequenceId:NATIVE_RECOVERY_STAR_SEQUENCE,frameIndex,cell:sequence.frames[frameIndex].cell,
    positionQ12:Object.freeze([...stars.positionQ12])});
}
