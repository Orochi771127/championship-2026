import {createNativeCharacterAnimationTimeline} from '../characterAnimationTimeline.js';

// Presentation only: a learned ranch appearance keeps the base actor's world
// position/state while playing the displayed species' own numeric sequence.
// It must never use the base creature's frame index in the appearance's atlas.
export function createRaisingAppearanceFrames(profiles) {
  const states=new Map();
  const index=id=>/^championship:creature:species-\d{3}$/.test(id??'')?Number(id.slice(-3)):null;
  return {
    read(id,native,resident,entry){
      const target=index(resident?.speciesId),base=index(resident?.appearanceBaseSpeciesId);
      if(!native||target===null||base!==native.speciesIndex||target===base||entry?.speciesId!==resident.speciesId){states.delete(id);return native;}
      const sequence=profiles[entry.entityId]?.sequences.find(s=>s.id===native.sequenceId);
      if(!sequence){states.delete(id);return native;}
      let state=states.get(id);
      if(!state||state.entity!==entry.entityId||state.sequence!==sequence.id||state.target!==target||native.nativeFrame<state.lastNativeFrame){
        state={entity:entry.entityId,sequence:sequence.id,target,lastNativeFrame:native.nativeFrame,timeline:createNativeCharacterAnimationTimeline({...sequence,frames:sequence.frames.map(f=>({...f,texture:`cell:${f.cell}`}))})};
        states.set(id,state);
      }
      // Reuse the application-owned actor clock: no wall-clock drift or play
      // while the original actor is paused. Repeated reads cannot double-step.
      const delta=native.nativeFrame-state.lastNativeFrame;
      if(Number.isSafeInteger(delta)&&delta>0)state.timeline.advanceNative(delta*4096);
      state.lastNativeFrame=native.nativeFrame;
      const snap=state.timeline.getSnapshot();
      return {...native,speciesIndex:target,sequenceId:snap.sequenceId,frameIndex:snap.frameIndex,cell:snap.cell,texture:snap.texture,
        elapsedQ12:snap.elapsedQ12,active:snap.active,playMode:snap.playMode,appearanceSourceSpeciesIndex:base};
    },
    retain(ids){const live=new Set(ids);for(const id of states.keys())if(!live.has(id))states.delete(id);},
    clear(){states.clear();}
  };
}
