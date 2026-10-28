// Presentation adaptation of selected original artwork. The simulation remains
// the sole action, damage, death and clock authority. No new ticker or store.
export const REVIEWED_DIRECTIONS = Object.freeze(['D','DR','R','UR','U','UL','L','DL']);
const mainAliases = [
  ['idle'], ['weak_idle','weakened_idle','weak'], ['move'], ['run','move'],
  ['capture_bounce','hop','idle'], ['release_fall_land','drop','fall','idle'], ['hurt'],
  ['melee'], ['melee'], ['ranged','melee'], ['ranged'], ['picked_up','pickup','carried','lift','idle'],
  ['weak_move','weakened_walk','weak_walk','move'], ['sleep','rest'], ['eat'], ['down','down_ko'],
  ['bound_idle','idle'], ['bound_weak_idle','bound_weakened_idle','weak_idle','idle'],
  ['bound_walk','bound_move','move'], ['bound_fast_move','bound_run','bound_walk','move'],
  ['bound_bounce','bound_reaction','bound_struggle','idle'], ['bound_struggle','bound_idle','idle'],
  ['bound_weak_walk','bound_slow_move','bound_move','move'], ['bound_sleep','sleep','rest'],
  ['bound_eat','bound_eat_gesture','eat'], ['bound_down','down'], ['knockback','hurt'],
  ['guard','attention_hold','idle'], ['petted_satisfied','satisfied','pleased','happy','idle'],
  ['adverse_reaction','unhappy','refusal','idle'], ['training','positive_reaction','happy','idle'],
  ['displeased_refusal','refusal','unhappy','idle'], ['startled','attention_hold','idle'],
  ['victory','happy','positive_reaction','idle'], ['hurt'], ['ranged','melee'], ['hurt'], ['hurt'], ['hurt'], ['guard','idle']
];
const subAliases = [ ['neutral','idle'], ['weak','weak_idle','idle'], ['attack','melee'], ['hurt','hit'],
  ['sleep','rest'], ['down'], ['neutral','idle'], ['satisfied','pleased','happy','idle'],
  ['unhappy','refusal','idle'], ['victory','happy','positive_reaction','idle'], ['rest','idle'], ['weak','idle'], ['refusal','unhappy','idle'] ];

// Explicit reviewed same-character vocabulary. These are caller adaptations,
// not new drawings, new effects or inferred original pose equivalence.
const semanticVariants=Object.freeze({
  idle:['idle','hover_idle'], weak:['weak','weak_idle','weakened_idle','weakened_idle_walk'],
  weak_idle:['weak_idle','weakened_idle','weakened_idle_walk'],
  move:['move','locomotion','flipper_crawl','hover_move','swim_move','slow_glide'],
  run:['run','fast_locomotion','fast_flight','fast_hover','fast_swim','spring_dash','fast_low_shuffle','fast_short_step_dash','run_wing_assisted','slime_bounce','flight'],
  weak_move:['weak_move','weak_step','weak_glide','weak_locomotion','weakened_locomotion','weak_short_shuffle','weakened_idle_walk'],
  weak_walk:['weak_walk','weak_move','weak_step','weak_glide','weak_locomotion','weakened_locomotion','weak_short_shuffle','weakened_idle_walk'],
  melee:['melee','melee_body_lunge','melee_horn_ram','tackle','melee_body_shove','melee_claw_swipe'],
  ranged:['ranged','ranged_release','shoot_pollen','shoot_gem_palm','shoot_mouth_release','shared_body_forward_release'],
  eat:['eat','eat_mime','eat_context'], down:['down','down_ko'],
  bound_fast_move:['bound_fast_move','bound_run','bound_fast_shuffle','bound_spring_dash','bound_fast_step','bound_short_shuffle','bound_move'],
  bound_weak_walk:['bound_weak_walk','bound_weak_shuffle','bound_weak_move','weak_bound_move','weak_bound_walk','weak_bound_short_shuffle'],
  bound_walk:['bound_walk','bound_move','bound_shuffle','bound_short_shuffle'],
  bound_weak_idle:['bound_weak_idle','bound_weakened_idle','weak_bound_idle']
});
const individualAttackAliases=Object.freeze({
  GR31:{7:'beak_attack',8:'talon_attack',9:'wing_bash',10:'gust',35:'gust',sub2:'beak_attack'},
  GR33:{7:'paw_swipe',8:'pounce',9:'shoulder_bump',10:'bell_pulse',35:'bell_pulse',sub2:'paw_swipe'},
  GR36:{7:'paw_swipe',8:'pounce',9:'tail_sweep',10:'ice_breath',35:'ice_breath',sub2:'paw_swipe'},
  GR37:{7:'attack_paw_swipe',8:'attack_leaping_forepaw_strike',9:'attack_low_body_charge',10:'shoot_mouth_release',35:'shoot_mouth_release',sub2:'attack_paw_swipe'}
});

export function reviewedNumericClip(document, side, id) {
  // An action whose delivery is incomplete (e.g. an effect delivered only as a recipe)
  // keeps its original route; no alias may stand in for it.
  if (document.nativeFallback?.includes(`${side}:${id}`)) return null;
  const direct =document.clips.find(c=>c.mode===side && c.id===`${side}:${id}`);
  if (direct) return {clip:direct, alias:false,mappingEvidence:'EXPLICIT_NUMERIC_SELECTION'};
  const context=document.clips.find(c=>c.mode===side&&c.source?.sourceContextIds?.includes(id));
  if(context)return {clip:context,alias:true,mappingEvidence:'SOURCE_AUTHORED_CONTEXT_ALIAS'};
  const individual=individualAttackAliases[document.displayCode]?.[side==='sub'?'sub'+id:id];
  if(individual){
    const clip=document.clips.find(c=>c.mode==='main'&&c.action===individual);
    if(clip)return {clip,alias:true,mappingEvidence:'INDIVIDUAL_REVIEWED_ACTION_CALLER_ADAPTATION'};
  }
  const aliases = (side==='sub'?subAliases:mainAliases)[id];
  if (!aliases) return null;
  // Reuse actual approved semantics. This is an authored caller mapping, never
  // a claim of 53 distinct drawings or exact original pose equivalence.
  for (const action of aliases) {
    const variants=semanticVariants[action]??[action];
    const clip = variants.map(name=>document.clips.find(c=>c.mode===side&&c.action===name)
      ??document.clips.find(c=>c.mode==='main'&&c.action===name)).find(Boolean);
    if (clip) return {clip,alias:true,mappingEvidence:'SAME_CHARACTER_REVIEWED_SEMANTIC_ALIAS'};
  }
  return null;
}

export function reviewedArenaClip(document, action, direction) {
  return document.clips.find(c=>c.mode==='arena' && c.action===action && c.direction===direction) ?? null;
}

export function reviewedArenaKoClip(document){
 const approval=document.rootArenaContextApproval;
 if(approval?.scope!=='Arena_KO_STATIC_UNBOUND_ONLY'||!approval.approvalSha256)return null;
 return document.clips.find(c=>c.id==='arena:ko'&&c.mode==='arena'&&c.action==='ko'
  &&c.source?.authorizedContext===approval.scope&&c.source.approvalSha256===approval.approvalSha256)??null;
}

// Inventory only: a numeric reviewed Main15 contract may have no action label.
// Discovery never grants reuse in another mode.
export function reviewedKoCandidateClips(document){
 const numeric=reviewedNumericClip(document,'main',15)?.clip;
 const named=document.clips.filter(c=>c.mode==='main'&&!String(c.action).includes('bound')&&/down|inactive|faint|ko/i.test(String(c.action)));
 return [...new Set([...(numeric?[numeric]:[]),...named])].map(clip=>({clip,
  discovery:clip===numeric?'REVIEWED_NUMERIC_MAIN15_CONTRACT':'AUTHORED_ACTION_LABEL',arenaReuseApproved:false}));
}

export function sampleReviewedClip(clip, elapsedMs, {holdFirst=false,terminal=false}={}) {
  if (!clip?.frames?.length || !Number.isFinite(elapsedMs) || elapsedMs<0) return null;
  const total=clip.frames.reduce((n,f)=>n+f.durationMs,0);
  if(clip.neutralReturn && elapsedMs>=clip.neutralReturn.afterHoldMs && !terminal)
    return {assetId:clip.neutralReturn.assetId,frameIndex:clip.frames.length,clipId:clip.id,complete:true,totalMs:total,neutralHold:true};
  let t=holdFirst||terminal?0:clip.loop?elapsedMs%total:Math.min(elapsedMs,total-0.000001);
  let index=0;
  for (;index<clip.frames.length-1;index++) {
    if (t<clip.frames[index].durationMs) break;
    t-=clip.frames[index].durationMs;
  }
  return {...clip.frames[index],frameIndex:index,clipId:clip.id,complete:!clip.loop&&elapsedMs>=total,totalMs:total};
}

// A Main15-only art decision can retain the authored falling transition before
// holding its approved final pose. Sub, bound Main25, Arena and ordinary preview
// sampling keep their existing contracts. The owner still decides when KO ends.
export function sampleReviewedCharacterClip(document,side,sequenceId,clip,elapsedMs,options={}) {
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
  const policy=document.main15Terminal;
  if(!options.terminal||side!=='main'||sequenceId!==15||!policy)
    return sampleReviewedClip(clip,elapsedMs,options);
  const index=policy.frameIndex;
  if(policy.scope!=='MAIN15_UNBOUND_ONLY'||policy.clipId!==clip?.id
    ||!Number.isInteger(index)||index<0||!clip.frames[index]
    ||clip.frames[index].assetId!==policy.assetId)
    throw Error('REVIEWED_MAIN15_TERMINAL_POLICY_MISMATCH');
  const transitionMs=clip.frames.slice(0,index).reduce((n,f)=>n+f.durationMs,0);
  // A native one-shot stops with elapsedQ12 reset. Its inactive sample proves
  // the transition has finished; never rewind the pose on later render calls.
  const time=options.nativeActive===0||options.holdFirst?transitionMs:elapsedMs;
  const prefix={...clip,frames:clip.frames.slice(0,index+1),loop:false,neutralReturn:null};
  const sample=sampleReviewedClip(prefix,time);
  return sample?{...sample,terminal:true,phase:time<transitionMs?'KO_TRANSITION':'KO_TERMINAL_HOLD'}:null;
}

export function reviewedDirection(x,y,previous='D') {
  if (!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<0.001) return previous;
  return ['R','DR','D','DL','L','UL','U','UR'][(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8];
}

// Event ids are scoped to this actor. Duplicated releases cannot restart an
// animation, and a release from an older cast cannot replace a newer cast.
export function createReviewedArenaPlayback(document,{reducedMotion=false,nativeFallback=true}={}) {
  const terminalClip=reviewedArenaKoClip(document);
  // With the original atlas retired there is no native sequence 15 to fall back
  // to: an unapproved KO holds the last hurt key of the current heading instead.
  const hurtHold=direction=>{
    const hurt=nativeFallback||terminalClip?null:reviewedArenaClip(document,'hurt',direction);if(!hurt)return null;
    const last=hurt.frames.length-1;
    return {...hurt.frames[last],frameIndex:last,clipId:hurt.id,complete:true,terminal:true,action:'ko',phase:'KO_HURT_HOLD_NO_APPROVED_KO',direction,actionId:null};
  };
  let cast=null,lastId=-1,direction='D',stateKey=null,start=0,ko=false,hurtStarted=null,hurtDirection='D',wasHurt=false;
  return Object.freeze({
    observe(event) {
      if (!['CAST','ULT_CAST','CAST_RELEASE'].includes(event?.type)||!Number.isSafeInteger(event.actionId)||!Number.isFinite(event.t)) return;
      if (event.actionId<lastId) return;
      if(event.actionId>lastId) {lastId=event.actionId;cast={id:lastId,startedAt:event.t,releasedAt:null,angle:event.angle,moveId:event.moveId,moveType:event.moveType};}
      if(event.type==='CAST_RELEASE'&&cast?.releasedAt===null) cast.releasedAt=event.t;
    },
    reset() {cast=null;lastId=-1;stateKey=null;ko=false;hurtStarted=null;wasHurt=false;},
    sample({time,hp,vx=0,vy=0,facing=1,hit=false,attack=false,castId=null,angle=null}) {
      if(!Number.isFinite(time))throw Error('REVIEWED_ARENA_TIME');
      if(hp<=0){ko=true;cast=null;}
      else if(ko){ko=false;stateKey=null;} // only actual simulation liveness clears KO
      if(ko)return terminalClip?{...sampleReviewedClip(terminalClip,0,{terminal:true}),terminal:true,action:'ko',phase:'KO_STATIC_HOLD',direction,
        authoredHeading:terminalClip.direction,actionId:null}:hurtHold(direction)??{fallbackSequenceId:15,terminal:true,direction,actionId:null};
      const aim=cast && Number.isFinite(cast.angle)?cast.angle:angle;
      direction=Number.isFinite(aim)&&cast?reviewedDirection(Math.cos(aim),Math.sin(aim),direction)
        :reviewedDirection(vx,vy,Math.abs(vx)+Math.abs(vy)<0.001?direction:facing>0?'R':'L');
      if(hit&&!wasHurt){hurtStarted=time;hurtDirection=direction;}
      wasHurt=hit;
      let action='move',elapsed=0,holdFirst=Math.hypot(vx,vy)<2;
      const hurt=reviewedArenaClip(document,'hurt',hurtDirection);
      const hurtDuration=hurt?.frames.reduce((n,f)=>n+f.durationMs,0)??0;
      if(hurtStarted!==null && ((time-hurtStarted)*1000<hurtDuration||hit&&hurt?.neutralReturn)){
        direction=hurtDirection;action='hurt';elapsed=(time-hurtStarted)*1000;holdFirst=false;
      } else if(cast) {
        if(cast.releasedAt===null && castId!==cast.id){cast=null;}
        else {
          action=['LUNGE','MELEE'].includes(cast.moveType)?'melee':'ranged';
          const clip=reviewedArenaClip(document,action,direction);
          const first=clip?.frames[0]?.durationMs??0;
          elapsed=cast.releasedAt===null?0:first+(time-cast.releasedAt)*1000;
          holdFirst=cast.releasedAt===null;
          if(cast.releasedAt!==null && elapsed>=(clip?.frames.reduce((n,f)=>n+f.durationMs,0)??0))cast=null;
        }
      } else if(attack) {action='ranged';holdFirst=false;}
      if(!cast&&action!=='hurt'&&!attack){action='move';}
      const key=action+'/'+direction;
      if(stateKey!==key){stateKey=key;start=time;}
      const clip=reviewedArenaClip(document,action,direction);
      if(!clip)return {missing:`arena/${direction}/${action}`,direction,actionId:cast?.id??null};
      if(action==='move'||(!cast&&attack))elapsed=(time-start)*1000;
      const sample=sampleReviewedClip(clip,reducedMotion?0:Math.max(0,elapsed),{holdFirst});
      return {...sample,direction,action,actionId:cast?.id??null,phase:cast?(cast.releasedAt===null?'WINDUP':'RELEASE'):action.toUpperCase()};
    }
  });
}
