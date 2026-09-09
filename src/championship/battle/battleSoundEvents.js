import profiles from '../../data/championship/battlePresentationProfiles.json' with {type:'json'};

// Original EA30 dispatch: high byte selects SSAR or FF stream; zero and FF00
// are silent. Events belong to this battle, never to its save or render clock.
export function createBattleSoundEvents() {
  let serial=0;const events=[];
  return {
    attach(memory){profiles.soundTable.forEach((id,i)=>memory.writeU16(profiles.soundTableAddress,i*2,id));},
    impactId(move,blocked){return blocked?0x211:profiles.hitSoundTable[move.field64??0];},
    call(routine,args,frame,moveId=null){
      if(routine===0x0203eae8){events.push({id:++serial,frame,moveId,kind:'STOP_SEQUENCE',fadeFrames:args[0]});if(events.length>64)events.shift();return 0;}
      if(routine!==0x0203ea30)return undefined;
      const [soundId,volume=127,pan=0]=args;
      if(soundId===0 || soundId===0xff00)return 0;
      events.push({id:++serial,frame,moveId,soundId,volume,pan,kind:(soundId>>>8)===255?'STREAM':'SEQUENCE'});
      if(events.length>64)events.shift();return 0;
    },
    snapshot(){return {emitted:serial,events:events.map(e=>({...e}))};},
    clear(){events.length=0;serial=0;}
  };
}
