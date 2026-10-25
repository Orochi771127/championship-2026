// Owner-approved artwork adaptation. The native actor still owns the clock,
// sequence request, cells and gameplay events. Only the rendered body changes.
export function sampleAuthoredCharacterFrame(sequence, sample, authored, reducedMotion=false) {
  const clip=authored?.[sequence?.id];
  if(!clip?.frames?.length)return null;
  const index=sample?.frameIndex;
  if(!Number.isInteger(index)||index<0||index>=sequence.frames.length)return null;
  const total=sequence.frames.reduce((sum,f)=>sum+f.ticks,0);
  const duration=clip.frames.reduce((sum,f)=>sum+f.durationMs,0);
  if(!(total>0)||!(duration>0))return null;
  const nativeElapsed=sequence.frames.slice(0,index).reduce((sum,f)=>sum+f.ticks,0)
    +Math.max(0,Math.min(sequence.frames[index].ticks,(sample.elapsedQ12??0)/4096));
  const phase=reducedMotion?0:sample.active===0?1:Math.min(1,nativeElapsed/total);
  let target=Math.min(duration-Number.EPSILON*duration,phase*duration);
  for(const frame of clip.frames){
    if(target<frame.durationMs)return frame;
    target-=frame.durationMs;
  }
  return clip.frames.at(-1);
}

export function sampleAuthoredArenaFrame(arena,{direction,action,sequence,sample,hold=false,releaseProgress=null,reducedMotion=false}){
  if(!Number.isInteger(direction)||direction<0||direction>7)return null;
  const clip=arena?.clips?.[`${direction}/${action}`];
  if(!clip?.frames?.length)return null;
  if(hold||reducedMotion)return clip.frames[0];
  if(releaseProgress!==null){
    const released=clip.frames.slice(1);
    if(!released.length)return clip.frames[0];
    const total=released.reduce((n,f)=>n+f.durationMs,0);
    let time=Math.max(0,Math.min(1,releaseProgress))*(total-Number.EPSILON*total);
    for(const f of released){if(time<f.durationMs)return f;time-=f.durationMs;}
    return released.at(-1);
  }
  return sampleAuthoredCharacterFrame(sequence,sample,{[sequence.id]:clip},false);
}
