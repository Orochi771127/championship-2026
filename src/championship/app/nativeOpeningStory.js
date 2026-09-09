// ARM9 02090474..020906E4, called in card order by 0208E964.
// Presentation timing only: no gameplay clock, RNG, save or router authority.
export const OPENING_STORY_CARDS = Object.freeze([
  Object.freeze({parts:4,frames:500}), Object.freeze({parts:2,frames:750}),
  Object.freeze({parts:2,frames:900}), Object.freeze({parts:1,frames:300})
]);

export function createOpeningStoryState(){
  return {frame:0,scrollPixels:0,done:false,cards:OPENING_STORY_CARDS.map((c,i)=>({
    phase:i===0?1:0,remaining:c.frames,wait:0,scale:410,revealed:0,y:0
  }))};
}

export function advanceOpeningStory(state,released=false){
  if(state.done)return state;
  state.frame++;
  for(let i=0;i<state.cards.length;i++){
    const c=state.cards[i],parts=OPENING_STORY_CARDS[i].parts;
    if(c.phase===1){
      c.remaining--;
      if(c.revealed>=parts){c.phase=2;c.wait=0;}
      else if(Math.abs(c.scale-4096)<205){c.revealed++;c.scale=410;}
      else c.scale+=Math.trunc((4096-c.scale)/2);
    }else if(c.phase===2){
      if(released)c.phase=3;
      else if(++c.wait>=c.remaining)c.phase=3;
    }else if(c.phase===3){
      if(c.y> -192)c.y-=4;
      else {c.phase=4;if(state.cards[i+1]?.phase===0)state.cards[i+1].phase=1;}
    }
    if(c.phase===3)state.scrollPixels+=4;
  }
  // The original begins its fade when the last card enters its scroll phase.
  if(state.cards[3].phase===3)state.done=true;
  return state;
}

export function openingStoryProjection(state){
  return [state.frame,state.scrollPixels,Number(state.done),...state.cards.flatMap(c=>[
    c.phase,c.remaining,c.wait,c.scale,c.revealed,c.y
  ])];
}

// A DOM Web Animation consumes this finite trajectory. Releasing a pointer
// recompiles only the unread remainder; no requestAnimationFrame loop is added.
export function openingStoryTrajectory(initial=createOpeningStoryState()){
  const state=structuredClone(initial),frames=[structuredClone(state)];
  while(!state.done&&frames.length<3000){advanceOpeningStory(state);frames.push(structuredClone(state));}
  if(!state.done)throw new Error('OPENING_STORY_TIMELINE_DID_NOT_TERMINATE');
  return frames;
}
