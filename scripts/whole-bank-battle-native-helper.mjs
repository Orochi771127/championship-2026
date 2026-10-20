// Local review helper only. Production modules own animation, NCER geometry,
// world position, lift, rotation, recoil and hit/recovery transitions.
// Controlled notifications/hit inputs are NOT full AI, damage-resolution or VM validation.
export const BATTLE_CONTEXT_SCENARIOS = Object.freeze({
  attack1: {notification:8, sequence:7, captureCell:12, authority:'CONTROLLED_NATIVE_NOTIFICATION_ENTRY'},
  attack2: {notification:9, sequence:8, captureCell:14, authority:'CONTROLLED_NATIVE_NOTIFICATION_ENTRY'},
  hit26: {hitKind:6, sequence:26, captureCell:44, minTicksSinceTrigger:9, authority:'REAL_HIT_RESULT_AND_NOTIFICATION_OWNER'},
  recovery54: {hitKind:0, lethal:true, sequence:32, captureCell:54, authority:'REAL_KNOCKOUT_AND_RECOVERY_OWNER'},
  block57: {hitKind:0, blocked:true, sequence:34, captureCell:57, authority:'REAL_BLOCK_RESULT_AND_NOTIFICATION_OWNER'},
  knockback61: {hitKind:12, sequence:38, captureCell:61, minTicksSinceTrigger:9, authority:'REAL_SPIN_RESULT_AND_NOTIFICATION_OWNER'}
});
// Controlled *simulation* entry point, not a sprite offset or a new ROM spawn.
// Inside the existing 416x272 native arena and its notification clamp. It gives
// the genuine leftward lethal recoil room to remain among the living subjects
// that the production camera frames. Enemy sourcePoint remains its real world point.
export const BATTLE_CONTEXT_TARGET_NATIVE_POSITION = Object.freeze([256,136,0]);
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
  const stands=normalBattleStands(session.slots);
  const originalTargetStand={...stands[0]};
  stands[0]={...stands[0],x:BATTLE_CONTEXT_TARGET_NATIVE_POSITION[0]/416,
    y:BATTLE_CONTEXT_TARGET_NATIVE_POSITION[1]/272,evidence:'CONTROLLED_NATIVE_WORLD_FIXTURE_POSITION'};
  const actors=createBattleNativeActors({slots:session.slots,stands,creatures});
  const hit=createBattleHitRuntime({session,actors});
  session.notify=hit.notify;
  session.normalFlow=createBattleNormalRuntime({session,actors,creatures,applyStatus:hit.status,
    initialize(){throw Error('WHOLE_BANK_BATTLE_UNEXPECTED_FULL_ACTION_LAUNCH');}});
  const target=0,history=[];let source=null,triggerFrame=null;
  const initialPositionsQ12=session.slots.map((c,i)=>c?actors.position(i):null);
  const limitation='Controlled native notification/hit-result fixture. No normal AI selection, damage calculation, approach/contact, move-script or full-match approval.';
  function sample(label='sample'){
    const p=actors.project(target),c=session.slots[target];
    const value={label,scenario,seed,frame:session.frame,clock:session.clock,
      authority:spec.authority,limitation,triggerFrame,ticksSinceTrigger:triggerFrame===null?null:session.frame-triggerFrame,
      setup:{targetPositionNative:[...BATTLE_CONTEXT_TARGET_NATIVE_POSITION],originalTargetStand,initialPositionsQ12,
        positionAuthority:'CONTROLLED_LEGAL_NATIVE_WORLD_FIXTURE_NOT_ROM_READY_SPAWN'},positionQ12:actors.position(target),
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
  function trigger(){
    check(triggerFrame===null,'ALREADY_TRIGGERED');triggerFrame=session.frame;
    if(spec.notification!==undefined)hit.notify(target,spec.notification);
    else hit.apply(target,{move:{kind:0,field14:spec.hitKind,statusCode:0},damage:spec.lethal?1000:spec.blocked?0:1,
      blocked:spec.blocked===true,sourcePoint:actors.position(3)});
    return sample('controlled-input-after-presentation-warmup');
  }
  function isCaptureReady(){const a=actors.project(target).nativeAnimation;
    return triggerFrame!==null&&session.frame-triggerFrame>=(spec.minTicksSinceTrigger??0)
      &&a.sequenceId===spec.sequence&&a.cell===spec.captureCell;}
  sample('idle-before-controlled-input');
  return {
    session,actors,hit,target,spec,scenario,seed,tick,sample,history,trigger,isCaptureReady,
    get triggered(){return triggerFrame!==null;},
    step(count=1){check(Number.isInteger(count)&&count>=0,'INVALID_STEP_COUNT');for(let i=0;i<count;i++)tick();return sample('after-'+count+'-ticks');},
    seekCapture({maxTicks=420}={}){
      if(triggerFrame===null)trigger(); // Numeric-only convenience; GPU mount requires untriggered entry.
      for(let i=0;i<maxTicks;i++){
        if(isCaptureReady())return sample('capture-target');
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
  dynamicFx=true,responsiveLayout=true,fx=null,onView=null,safeMarginCss=16}) {
  check(fieldArt?.displayObject&&fieldArt?.field?.nativeWidthPx>0,'REAL_FIELD_ART_REQUIRED');
  check(characterRoster?.createActor,'CHARACTER_ROSTER_REQUIRED');
  check(!fixture.triggered,'MOUNT_REQUIRES_UNTRIGGERED_FIXTURE');
  check(Number.isFinite(safeMarginCss)&&safeMarginCss>=0,'INVALID_SAFE_MARGIN');
  const source=await fixture.createSource();
  check(source.getFrame().arena.field===fieldArt.field.fieldId,'ARENA_FIELD_MISMATCH');
  const {mountBattleFieldPixiPresentation}=await import(cp(base,'presentation/vs5/createBattleFieldPixiPresentation.js'));
  const createdActors=[];
  const observedRoster={createActor(options){const actor=characterRoster.createActor(options);if(actor)createdActors.push(actor);return actor;},
    dispose:()=>characterRoster.dispose?.(),getDiagnostics:()=>characterRoster.getDiagnostics?.()};
  stage.app.stop();
  const scene=await mountBattleFieldPixiPresentation({stage,source,fieldArt,characterRoster:observedRoster,
    autoAdvance:false,dynamicFx,responsiveLayout,fx,onView,reducedMotion:false});
  stage.app.stop();
  // Same cadence constant as the actual scene. Advance presentation after every
  // owner tick so camera/field animation are not jumped straight to a held pose.
  const nativeFrameMs=1000*560190/33513982;
  function advanceOne(){fixture.tick();scene.advance({deltaMS:nativeFrameMs});}
  const screenOverlay=()=>{
    const d=scene.getDiagnostics(),fxd=d.dynamicFx;
    return {banner:fxd?.banner??null,callout:fxd?.callout??null,dim:fxd?.dim??false,impactFlashes:fxd?.flashes??0,
      openingCue:source.getView().opening?.cue??null};
  };
  const overlayPresent=o=>Boolean(o.banner||o.callout||o.dim||o.openingCue);
  // Let the real START event/banner finish. Never delete/hide an overlay or
  // seek its age, and do not mutate the camera to make a capture pass.
  const beforeWarmup=fixture.sample('presentation-warmup-start');let warmupTicks=0;
  while(overlayPresent(screenOverlay())){
    check(warmupTicks<240,'PRESENTATION_OPENING_DID_NOT_FINISH');advanceOne();warmupTicks++;
  }
  const warmup={ticks:warmupTicks,elapsedMs:warmupTicks*nativeFrameMs,before:beforeWarmup,
    after:fixture.sample('presentation-warmup-finished'),overlay:screenOverlay()};
  check(!overlayPresent(warmup.overlay),'OPENING_OVERLAY_STILL_PRESENT');
  fixture.trigger();
  function render(){scene.redraw();stage.app.render();const diagnostic=scene.getDiagnostics();
    const target=diagnostic.characters.find(c=>c.slot===fixture.target);
    check(target?.rendered,'TARGET_NOT_RENDERED');
    check(diagnostic.characters.length===fixture.session.slots.filter(Boolean).length,'ACTOR_FALLBACK');
    if(dynamicFx)check(diagnostic.dynamicFx,'DYNAMIC_CAMERA_FALLBACK');
    check(target.animation?.cell===fixture.actors.project(fixture.target).nativeAnimation.cell,'NATIVE_CELL_MISMATCH');
    const targetIndex=diagnostic.characters.findIndex(c=>c.slot===fixture.target),sprite=createdActors[targetIndex]?.sprite;
    check(sprite,'TARGET_SPRITE_REQUIRED');const b=sprite.getBounds(),w=stage.app.screen.width,h=stage.app.screen.height;
    const bounds={x:b.x,y:b.y,width:b.width,height:b.height};
    check(b.width>0&&b.height>0&&b.x>=safeMarginCss&&b.y>=safeMarginCss
      &&b.x+b.width<=w-safeMarginCss&&b.y+b.height<=h-safeMarginCss,
      'TARGET_OUTSIDE_SAFE_VIEW:'+JSON.stringify({bounds,viewport:[w,h],safeMarginCss}));
    const overlay=screenOverlay();check(!overlayPresent(overlay),'CAPTURE_OVERLAY_PRESENT:'+JSON.stringify(overlay));
    check(overlay.impactFlashes===0,'CAPTURE_IMPACT_FLASH_PRESENT:'+JSON.stringify(overlay));
    return {native:fixture.sample('render'),scene:diagnostic,placement:scene.getFieldPlacement(),
      captureReadiness:{warmup,bounds,viewport:[w,h],safeMarginCss,overlay,
        impactEffects:'Authentic impact FX are retained. Sample is delayed within its real sequence until the brief white flash ends; no effect is suppressed.'}};}
  return {scene,source,fixture,render,warmup,
    seekCapture({maxTicks=420}={}){for(let i=0;i<maxTicks;i++){
      if(fixture.isCaptureReady())return render();
      advanceOne();
    }throw Error('WHOLE_BANK_BATTLE_RENDER_TARGET_NOT_REACHED:'+fixture.scenario);},
    step(count=1){check(Number.isInteger(count)&&count>=0,'INVALID_STEP_COUNT');for(let i=0;i<count;i++)advanceOne();return render();},
    async dispose(){fixture.dispose();await scene.dispose();}
  };
}
