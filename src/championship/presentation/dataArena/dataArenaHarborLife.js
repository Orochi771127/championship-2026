// Display-only pilot: existing stand/walk frames, two approved harbor actors.
// No world position, simulation time, collision or save is changed here.
const profiles={PLAYER:{period:5100,offset:0,lookStart:3650,lookEnd:4140,idleRate:.86,walkRate:1.04,shadowWidth:52,shadowHeight:11},
 MATE:{period:7300,offset:900,lookStart:5400,lookEnd:6150,idleRate:.64,walkRate:.91,shadowWidth:84,shadowHeight:15}};
export function harborActorLife({role,sequence,deltaMS,idleMS,elapsedMS,facing,speed=0,quiet=false}){
 const p=profiles[role];if(!p)return {deltaMS,facing};
 const phase=(idleMS+p.offset)%p.period,standing=sequence===0,walking=sequence===2;
 const glance=standing&&!quiet&&idleMS>1500&&phase>=p.lookStart&&phase<p.lookEnd;
 const rate=standing?(quiet?0:p.idleRate):(walking&&!quiet?Math.max(.75,Math.min(1.25,speed/(role==='PLAYER'?250:215)))*p.walkRate:1);
 const contact=walking&&!quiet?1+Math.sin(elapsedMS*.012+(role==='MATE'?1.7:0))*.025:1;
 return {deltaMS:deltaMS*rate,facing:glance?-facing:facing,phase,glance,
  shadowWidth:p.shadowWidth*contact,shadowHeight:p.shadowHeight/contact};
}
export function harborMechanismFrame({elapsed,index,frameCount,frameDurationMs,quiet}){
 if(quiet)return 0;
 const duration=frameCount*frameDurationMs/1000,active=duration*2;
 const phase=(elapsed+index*1.37)%(active+3.8+index*1.7);
 return phase<active?Math.floor(phase*1000/frameDurationMs)%frameCount:0;
}
