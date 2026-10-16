// Local review helper only. Production modules own animation, NCER geometry,
// world position, lift, rotation, recoil and hit/recovery transitions.
// Controlled notifications/hit inputs are NOT full AI, damage-resolution or VM validation.
export const BATTLE_CONTEXT_SCENARIOS = Object.freeze({
  attack1: {notification:8, sequence:7, captureCell:12, authority:'CONTROLLED_NATIVE_NOTIFICATION_ENTRY'},
  attack2: {notification:9, sequence:8, captureCell:14, authority:'CONTROLLED_NATIVE_NOTIFICATION_ENTRY'},
  hit26: {hitKind:6, sequence:26, captureCell:44, authority:'REAL_HIT_RESULT_AND_NOTIFICATION_OWNER'},
  recovery54: {hitKind:0, lethal:true, sequence:32, captureCell:54, authority:'REAL_KNOCKOUT_AND_RECOVERY_OWNER'},
  block57: {hitKind:0, blocked:true, sequence:34, captureCell:57, authority:'REAL_BLOCK_RESULT_AND_NOTIFICATION_OWNER'},
  knockback61: {hitKind:12, sequence:38, captureCell:61, authority:'REAL_SPIN_RESULT_AND_NOTIFICATION_OWNER'}
});
const check=(ok,message)=>{if(!ok)throw Error('WHOLE_BANK_BATTLE_'+message);};
const cp=(base,path)=>new URL('src/championship/'+path,base).href;

/** Browser or Node; base is the repo root URL ending in slash. No asset loading. */
export async function createNativeBattleContextFixture({base,scenario,seed=scenario==='recovery54'?8:20,arenaIndex=0}) {
  const spec=BATTLE_CONTEXT_SCENARIOS[scenario];check(spec,'UNKNOWN_SCENARIO');
  const [{createSessionCombatant,createBattleSession},{createBattleNativeActors},
    {createBattleHitRuntime},{createBattleNormalRuntime},{normalBattleStands},{createChannelRng}]=await Promise.all([
    import(cp(base,'battle/battleSession.js')),import(cp(base,'battle/battleNativeActors.js')),
    import(cp(base,'battle/battleHitRuntime.js')),import(cp(base,'battle/battleNormalRuntime.js')),
    import(cp(base,'battle/battleNormalFlow.js')),import(cp(base,'battle/battleRngChannel.js'))
  ]);
  // An ally keeps a genuine lethal hit from immediately ending the target's team.
  // All visible actors are species062, so both variants use the same whole bank.
  const member=()=>createSessionCombatant({speciesId:62,currentHp:1000,maxHp:1000,metricLimit:100,metricBase:100});
  const session=createBattleSession({roster:[member(),member(),null,member(),null,null],rng:createChannelRng(seed)});
  const creatures=session.slots.map(c=>c?{levels:{},stats:{}}:null);
  const actors=createBattleNativeActors({slots:session.slots,stands:normalBattleStands(session.slots),creatures});
  const hit=createBattleHitRuntime({session,actors});
  session.notify=hit.notify;
  session.normalFlow=createBattleNormalRuntime({session,actors,creatures,applyStatus:hit.status,
    initialize(){throw Error('WHOLE_BANK_BATTLE_UNEXPECTED_FULL_ACTION_LAUNCH');}});
  const target=0,history=[];let source=null;
  const limitation='Controlled native notification/hit-result fixture. No normal AI selection, damage calculation, approach/contact, move-script or full-match approval.';
  function sample(label='sample'){
    const p=actors.project(target),c=session.slots[target];
    const value={label,scenario,seed,frame:session.frame,clock:session.clock,
      authority:spec.authority,limitation,positionQ12:actors.position(target),
      stand:p.stand,nativeMotion:p.motion,nativeAnimation:p.nativeAnimation,animationRequest:p.animationRequest,
      notification:c.field17C,counter:c.field180,reaction:c.field84,currentHp:c.currentHp,
      cellBox:actors.box(target),history:hit.snapshot().history};
    history.push(value);return value;
  }
  function stepOwner(){
    // Same native ordering as battleRuntime: setFrame -> notification -> actor advance.
    // Full state/AI dispatch is intentionally absent, not replaced by another formula.
    actors.setFrame(session.frame);session.normalFlow.beforeFrame();
    for(let i=0;i<session.slots.length;i++)if(session.slots[i])hit.step(i);
    actors.advance();session.frame++;session.clock++;
    return {frame:session.frame,events:[],ended:false};
  }
  function tick(){return source?source.tick():stepOwner();}
  if(spec.notification!==undefined)hit.notify(target,spec.notification);
  else hit.apply(target,{move:{kind:0,field14:spec.hitKind,statusCode:0},damage:spec.lethal?1000:spec.blocked?0:1,
    blocked:spec.blocked===true,sourcePoint:actors.position(3)});
  sample('controlled-entry-before-first-native-tick');
  return {
    session,actors,hit,target,spec,scenario,seed,tick,sample,history,
    step(count=1){check(Number.isInteger(count)&&count>=0,'INVALID_STEP_COUNT');for(let i=0;i<count;i++)tick();return sample('after-'+count+'-ticks');},
    seekCapture({maxTicks=420}={}){
      for(let i=0;i<maxTicks;i++){
        const p=actors.project(target);
        if(p.nativeAnimation.sequenceId===spec.sequence&&p.nativeAnimation.cell===spec.captureCell)return sample('capture-target');
        tick();
      }
      throw Error('WHOLE_BANK_BATTLE_TARGET_NOT_REACHED:'+scenario+':'+JSON.stringify(sample('limit')));
    },
    async createSource(){
      check(!source,'SOURCE_ALREADY_CREATED');
      const {createBattlePresentationSource}=await import(cp(base,'app/battlePresentationSource.js'));
      source=createBattlePresentationSource({session,arenaIndex,step:stepOwner,getNativeActor:slot=>actors.project(slot),
        getNativeLifecycle:()=>({reactions:hit.snapshot(),normalFlow:session.normalFlow.snapshot(),active:[],effectActors:[]})});
      return source;
    },
    dispose(){source?.dispose();}
  };
}

/** Caller supplies the actual stage, production fieldArt and baseline/candidate roster.
 * No generic arena, fallback actor, custom sprite placement or body normalization.
 * The real scene owns sprite/shadow geometry and camera. It disposes its inputs.
 */
export async function mountNativeBattleContext({base,fixture,stage,fieldArt,characterRoster,
  dynamicFx=true,responsiveLayout=true,fx=null,onView=null}) {
  check(fieldArt?.displayObject&&fieldArt?.field?.nativeWidthPx>0,'REAL_FIELD_ART_REQUIRED');
  check(characterRoster?.createActor,'CHARACTER_ROSTER_REQUIRED');
  const source=await fixture.createSource();
  check(source.getFrame().arena.field===fieldArt.field.fieldId,'ARENA_FIELD_MISMATCH');
  const {mountBattleFieldPixiPresentation}=await import(cp(base,'presentation/vs5/createBattleFieldPixiPresentation.js'));
  stage.app.stop();
  const scene=await mountBattleFieldPixiPresentation({stage,source,fieldArt,characterRoster,
    autoAdvance:false,dynamicFx,responsiveLayout,fx,onView,reducedMotion:false});
  stage.app.stop();
  // Same cadence constant as the actual scene. Advance presentation after every
  // owner tick so camera/field animation are not jumped straight to a held pose.
  const nativeFrameMs=1000*560190/33513982;
  function advanceOne(){fixture.tick();scene.advance({deltaMS:nativeFrameMs});}
  function render(){scene.redraw();stage.app.render();const diagnostic=scene.getDiagnostics();
    const target=diagnostic.characters.find(c=>c.slot===fixture.target);
    check(target?.rendered,'TARGET_NOT_RENDERED');
    check(diagnostic.characters.length===fixture.session.slots.filter(Boolean).length,'ACTOR_FALLBACK');
    if(dynamicFx)check(diagnostic.dynamicFx,'DYNAMIC_CAMERA_FALLBACK');
    check(target.animation?.cell===fixture.actors.project(fixture.target).nativeAnimation.cell,'NATIVE_CELL_MISMATCH');
    return {native:fixture.sample('render'),scene:diagnostic,placement:scene.getFieldPlacement()};}
  return {scene,source,fixture,render,
    seekCapture({maxTicks=420}={}){for(let i=0;i<maxTicks;i++){
      const a=fixture.actors.project(fixture.target).nativeAnimation;
      if(a.sequenceId===fixture.spec.sequence&&a.cell===fixture.spec.captureCell)return render();
      advanceOne();
    }throw Error('WHOLE_BANK_BATTLE_RENDER_TARGET_NOT_REACHED:'+fixture.scenario);},
    step(count=1){check(Number.isInteger(count)&&count>=0,'INVALID_STEP_COUNT');for(let i=0;i<count;i++)advanceOne();return render();},
    async dispose(){fixture.dispose();await scene.dispose();}
  };
}
