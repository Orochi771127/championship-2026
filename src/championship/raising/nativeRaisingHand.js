// OVL18 0210C4D0 and 0210CA28. One input sample per existing native update;
// screen coordinates are expressed in original pixels by the presentation seam.
export function classifyNativeRaisingHand({held,elapsed,origin,pointer,admit,inside}) {
  const counter=(elapsed+1)&65535;
  if(!held)return counter<10&&admit(0x7e)?2:0;
  if(Math.abs(pointer.x-origin.x)>3||Math.abs(pointer.y-origin.y)>3)return admit(0x7f)?4:0;
  if(counter>3){if(!inside)return 0;if(admit(0x80))return 3;}
  return -1;
}

export function stepNativeRaisingStrokeInput({held,elapsed,previous,pointer,actorScreen}) {
  if(Math.abs(pointer.x-actorScreen.x)>96||Math.abs(pointer.y-actorScreen.y)>96)return {result:0,counter:elapsed};
  const counter=Math.abs(pointer.x-previous.x)<3&&Math.abs(pointer.y-previous.y)<3?(elapsed+1)&65535:0;
  return {result:!held||counter>60?0:-1,counter};
}

// Entry/exit flag writes in the 02128630 state table, not visual pose names.
export function nativeRaisingHandAdmission(actor,command){
  const state=actor.state??(actor.speciesIndex<8?26:1);
  if(command===0x7f)return [1,2,3,4,5,17].includes(state);
  if(command===0x80)return actor.speciesIndex>=8&&[1,2,3,4,5,7,9,10,13,16,17,18,19].includes(state);
  if(command===0x7e)return [1,2,3,4,5,9,16,17,26].includes(state)&&!(state===26&&actor.eggPhase!==0);
  return false;
}

export function enterNativeRaisingStroke(profile,request){
  const p=structuredClone(profile);
  if(!['134','138','13c'].some(k=>p.fields[k]!==0))request(28);
  if((p.fields['01c']|0)>0)p.fields['01c']--;
  return {profile:p,phase:1,counter:0,music:0};
}

export function stepNativeRaisingStroke(stroke,held){
  if(!held)return {complete:true,music:0,sound:null};
  if(stroke.phase===1){stroke.counter=(stroke.counter+1)&65535;
    if(stroke.counter>=57){stroke.counter=0;stroke.phase=0;}}
  const music=stroke.phase===1?1:0,sound=music&&!stroke.music?0x601:null;
  stroke.music=music;return {complete:false,music,sound};
}

// 021180CC: a sleeping resident consumes 7F without changing state.
// Its 7E wake check is personality-dependent on channel 76+poolSlot.
export function nativeRaisingTapWakes(personality,poolSlot,rng){
  const chance=[40,10,80,10,40,40,80,80][personality]??0;
  return rng.next(0x76+poolSlot)%100<chance;
}

export function enterNativeRaisingTap(tap){
  return {count:(tap?.elapsed??0)<30?Math.min(3,((tap?.count??0)+1)&255):0,elapsed:0};
}

// 021199F8 -> 021161B8. This is the hand response table, distinct from
// the spontaneous personality table used by idle activity selection.
export function selectNativeRaisingTapReaction(tap,{healthy,previousState,personality,poolSlot},rng){
  if(!healthy||tap.count<3)return null;
  tap.count=0;
  const trigger=rng.next(0x76+poolSlot)%100;
  if(trigger>=50&&previousState!==4)return null;
  const half=rng.next(0x56+poolSlot)%100<50?0:1;
  return [[6,null],[4,4],[19,1],[3,null],[6,0],[null,null],[0,14],[24,8]][personality]?.[half]??null;
}
