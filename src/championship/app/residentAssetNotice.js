// Presentation only: readiness/clock gating remains in the existing scene.
// A visible actor buffering its next streamed animation is not a lost actor.
// Keep short transitions out of the shared recovery row; prolonged buffering
// still surfaces, and missing actors/evolution/error states remain immediate.
export function createResidentAssetNotice({onChange=()=>{},delayMs=900,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  let timer=null,visible=false,disposed=false;
  const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
  return Object.freeze({
    update(states=[]) {
      if(disposed)return false;
      const failed=states.some(s=>s.state==='error');
      const pending=states.filter(s=>s.state==='loading');
      const immediate=failed||pending.some(s=>s.loadKind!=='animation'||!s.hasVisibleSprite);
      if(immediate){cancel();visible=true;}
      else if(!pending.length){cancel();visible=false;}
      else if(!visible&&timer===null)timer=setTimer(()=>{timer=null;if(!disposed){visible=true;onChange();}},delayMs);
      return visible;
    },
    get visible(){return visible;},
    reset(){cancel();visible=false;},
    dispose(){disposed=true;cancel();}
  });
}

// Several residents may share one species while playing different sequences.
// Object.fromEntries(residents.map(...)) used to overwrite earlier requests.
export function collectRaisingInitialSequences(residents,getActorFrame) {
  const sequences=new Map();
  for(const resident of residents){
    const ids=sequences.get(resident.speciesId)??new Set([0]);
    const sequence=getActorFrame?.(resident.creatureId)?.sequenceId;
    if(Number.isInteger(sequence))ids.add(sequence);
    sequences.set(resident.speciesId,ids);
  }
  return Object.fromEntries([...sequences].map(([species,ids])=>[species,[...ids]]));
}
