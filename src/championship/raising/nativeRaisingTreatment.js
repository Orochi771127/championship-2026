// OVL18 0210F0B0/0210F324, 02116C14 and 0211BE5C.
// Only the application owns the selected actor, inventory and shared clock.
import {createNativeCharacterAnimationTimeline} from '../presentation/characterAnimationTimeline.js';

export function nativeTreatmentAdmission({species,state,condition,stock}) {
  const dispatch=species>=8&&stock>0;
  return {dispatch,consume:dispatch&&state!==9&&state!==20&&condition!==0};
}

export function nativeTreatmentWait({previous,elapsed,iconEnded,reaction}) {
  const nextElapsed=iconEnded?elapsed:(elapsed+1)&65535;
  return {elapsed:nextElapsed,complete:Boolean(iconEnded)||nextElapsed>60,
    nextState:iconEnded||nextElapsed>60?previous===4?4:previous===18?18:9:null,reaction};
}

export function createNativeTreatmentPresentation({kind,success,reaction,previous}) {
  const mode=success?2:1,count=success?8:4;
  return {kind,success,reaction,previous,elapsed:0,
    icon:createNativeCharacterAnimationTimeline({id:success?4:3,playbackMode:mode,loopStartFrame:0,
      frames:Array.from({length:count},(_,i)=>({texture:`treatment:${i}`,ticks:6}))})};
}

export function advanceNativeTreatmentPresentation(treatment) {
  const icon=treatment.icon.advanceNative(4096);
  const result=nativeTreatmentWait({...treatment,iconEnded:!icon.active});
  treatment.elapsed=result.elapsed;return result;
}
