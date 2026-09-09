// Bind verified normal state bodies to the existing battle session and actors.
// This adapter has no clock, renderer, persistent state or independent actors.
import {normalBattleSpeedScalar,normalBattleTargetSelector,selectNormalBattleTarget,
  updateNormalBattleGeometry,stepNormalBattlePosition,stepNormalBattleApproach,
  stepNormalBattleWait,stepNormalBattleLaunch,updateNormalBattleTeam,selectBattlePursuitTarget,
  stepBattlePursuit,finishBattleTargetedAction} from './battleNormalFlow.js';
import {getBattleCatalogRecord} from './battleCatalogs.js';
import {buildMoveBucketsForSpecies} from './battleMoveBuckets.js';
import {negativeStatusActionGate} from './battleStatus.js';

export function createBattleNormalRuntime({session,actors,creatures,initialize,applyStatus,globalAbort=()=>!!(actors.worldFlags()&2)}){
  const m=actors.memory,history=[];
  const teamSlots=t=>session.slots.flatMap((c,i)=>c&&Math.floor(i/3)===t?[i]:[]);
  const teams=[0,1].map(t=>({slots:teamSlots(t),metric44:[0,0,0],metric54:[0,0,0],guard40:0,guard50:0}));
  const point=i=>{const p=m.readU32(actors.address(i),0x2c);return [0,4,8].map(o=>m.readU32(p,o)|0);};
  const setPoint=(i,pt)=>{const p=m.readU32(actors.address(i),0x2c);[0,4,8].forEach((o,j)=>m.writeU32(p,o,pt[j]));};
  const targetSlot=i=>{const addr=m.readU32(actors.address(i),0x5c);return session.slots.findIndex((c,j)=>c&&actors.address(j)===addr);};
  const emit=(slot,type,detail={})=>{history.push({frame:session.frame,clock:session.clock,slot,type,...detail});if(history.length>512)history.shift();};
  const setState=(c,s)=>{c.state=s;c.stateCounter=-255;};
  let geometry;
  function updateGeometry(){
    const points=session.slots.map((c,i)=>c?point(i):[0,0,0]);
    geometry=updateNormalBattleGeometry(points);
    session.slots.forEach((c,i)=>{if(c)setPoint(i,points[i]);});
  }
  session.slots.forEach((c,i)=>{
    if(!c)return;
    // 0210CB94 and CBB4 both call 140CC for this same populated slot.
    normalBattleSpeedScalar(session.rng);
    Object.assign(c,{field1C:1,field1E:0,field20:0,field3C:normalBattleSpeedScalar(session.rng),field184:50*4096,field188:30*4096,
      field44:i<3?0:32768,field17C:1,field180:-255,state:1,stateCounter:-255,statePeriod:1,launchSlots:[0,0,0],pendingDecision:null,
      speedIndex:creatures[i]?.levels.field20??0});
  });
  updateGeometry();
  function entries(indices){return indices.map(i=>({...session.slots[i],stat84:creatures[i]?.levels.field18??0,stat88:creatures[i]?.levels.field1C??0}));}
  function releaseSlot(slot,launchIndex,action){
    const c=session.slots[slot];if(c.launchSlots[launchIndex]===action)c.launchSlots[launchIndex]=0;
    m.writeU32(actors.address(slot),0x78+launchIndex*4,0);
    if(c.committedAction===action)c.committedAction=c.launchSlots.find(Boolean)??0;
  }
  function chooseOrdinary(slot){
    const c=session.slots[slot],bucket=buildMoveBucketsForSpecies(c.speciesId).buckets[4],roll=session.rng.next(216);
    // Original reads the unused +C0 slot even when count is zero. Its stale
    // pointer is not reconstructed for noncombatants; preserve that boundary.
    const action=bucket.length?bucket[roll%bucket.length]:null;
    c.pendingDecision={action};c.pendingTargetSlot=targetSlot(slot);
    emit(slot,action?'PURSUIT_MOVE_SELECTED':'UNKNOWN_REQUIRES_TRACE',action?{moveId:action.actionId,targetSlot:c.pendingTargetSlot}:
      {site:'02116508_EMPTY_C0_SLOT',roll});
  }
  return {
    beforeFrame(){
      actors.updateWorldFlags();
      // 0211240C updates each team's existing target-cascade counters.
      for(const team of teams)updateNormalBattleTeam(team,team.slots.map(i=>session.slots[i]));
    },
    afterActions:updateGeometry,
    statusGate(slot){
      const c=session.slots[slot];if(c.statusCode!==1)return false;
      const result=negativeStatusActionGate({runtimeCode:1,auxiliaryTimer24:c.field24,speedIndex:c.speedIndex});
      if(result.resetCooldownFromSpeed){c.field184=50*4096;c.field188=30*4096;c.field28=result.decisionCooldown;}
      setState(c,result.nextState);emit(slot,'PURSUIT_GATE',{timer:c.field24,to:c.state});return true;
    },
    prepareGate(slot){
      const c=session.slots[slot],team=teams[Math.floor(slot/3)],opponents=teams[1-Math.floor(slot/3)].slots,opposing=entries(opponents);
      let selected=selectNormalBattleTarget(opposing,normalBattleTargetSelector(c.profileIndex),session.rng);
      if(selected===null)selected=selectNormalBattleTarget(opposing,0,session.rng);
      if(selected===null){
        if(selectNormalBattleTarget(opposing,12,session.rng)===null)setState(c,13);
        return null;
      }
      return {targetSlot:opponents[selected],allySlots:team.slots,targeted:{group2Guard:team.guard40,group4Guard:team.guard50,
        positiveEffectCode:c.field160,roster:team.slots.map((i,j)=>({currentHp:session.slots[i].currentHp,positiveEffectCode:session.slots[i].field160,
          metric44:team.metric44[j],metric54:team.metric54[j]}))}};
    },
    commitDecision(slot,decision,selection){
      const c=session.slots[slot],old=targetSlot(slot),next=selection.targetSlot;
      if(old>=0&&old!==next)session.slots[old].field1E=(session.slots[old].field1E-1)<<16>>16;
      session.slots[next].field1E=(session.slots[next].field1E+1)<<16>>16;
      m.writeU32(actors.address(slot),0x5c,actors.address(next));
      c.pendingDecision=decision;
      if(decision.primaryQ12!==undefined){c.field184=decision.primaryQ12;c.field188=decision.secondaryQ12;}
      c.pendingTargetSlot=decision.target?.kind==='SELF'?slot:Number.isInteger(decision.target?.index)?selection.allySlots[decision.target.index]:next;
      setState(c,decision.state);
      emit(slot,'SELECTED',{state:c.state,targetSlot:next,actionTarget:c.pendingTargetSlot,moveId:decision.action?.actionId??decision.actionId??null});
    },
    stepState(slot,gate){
      const c=session.slots[slot];if(![3,4,5,6,7,8,14,15,16].includes(c.state))return false;
      if(c.state===8&&c.stateCounter===0){
        const opponents=teams[1-Math.floor(slot/3)].slots;
        const pick=selectBattlePursuitTarget(opponents.map(i=>session.slots[i]),opponents.map(i=>geometry.distances[slot][i]));
        if(pick===null){setState(c,11);emit(slot,'PURSUIT_NO_TARGET');return true;}
        m.writeU32(actors.address(slot),0x5c,actors.address(opponents[pick]));
        chooseOrdinary(slot);session.notify(slot,7);
      }
      const index=targetSlot(slot),actor=actors.actorOf(slot),target=index>=0?session.slots[index]:null;
      // VM writes +154 in the existing relocated wrapper, not another scalar.
      c.field154=m.readU32(actors.address(slot),0x154);
      const moveId=c.pendingDecision?.action?.actionId??c.pendingDecision?.actionId;
      const move=Number.isInteger(moveId)?getBattleCatalogRecord('moves',moveId):null;
      const h={target,point:point(slot),targetPoint:index>=0?point(index):[0,0,0],angle:index>=0?geometry.angles[slot][index]:65535,
        distance:index>=0?geometry.distances[slot][index]:0,rng:session.rng,launchSlots:c.launchSlots,gate,move,
        notify:n=>session.notify(slot,n),globalAbort:globalAbort(),face:a=>m.writeU32(actor,0x6dc,((a+16384)&32768)?0:1),
        finished:()=>actors.call(0x02047c48,[actor]),
        allocate(launchIndex,targeted){
          const action=session.allocateAction(slot,c.pendingDecision,{targetSlot:targeted?c.pendingTargetSlot:index,launchIndex});
          if(action){c.launchSlots[launchIndex]=action;c.committedAction=action;m.writeU32(actors.address(slot),0x78+launchIndex*4,0x11000000+action.index*0x2000);}
          return action;
        },
        initialize(action){const resourceBefore=c.metricLimit,ok=initialize(slot,action);
          emit(slot,ok?'LAUNCHED':'LAUNCH_REFUSED',{moveId:moveId??null,targetSlot:action.targetSlot,state:c.state,actionIndex:action.index,
            resourceBefore,resourceAfter:c.metricLimit});return ok;},
        release(launchIndex,action){action.release();releaseSlot(slot,launchIndex,action);},
        afterTargeted(){
          const opponents=teams[1-Math.floor(slot/3)].slots;
          finishBattleTargetedAction(moveId,opponents.map(i=>session.slots[i]),{
            status:(i,code)=>applyStatus(opponents[i],code),
            targetOwner:i=>m.writeU32(actors.address(opponents[i]),0x5c,actors.address(slot)),
            chooseOrdinary:i=>chooseOrdinary(opponents[i]),notifyOwner:n=>session.notify(slot,n)});
          if(moveId===1)emit(slot,'TARGETED_FOLLOWUP',{moveId});
        }};
      const before=c.state;
      if(c.state===3)stepNormalBattlePosition(c,h);
      else if([4,5].includes(c.state))stepNormalBattleApproach(c,h);
      else if([6,7].includes(c.state))stepNormalBattleWait(c,h);
      else if(c.state===8)stepBattlePursuit(c,h);
      else stepNormalBattleLaunch(c,h);
      if(c.state!==before)emit(slot,'STATE_CHANGED',{from:before,to:c.state});
      return true;
    },
    releaseSlot,
    inFlight(){return session.slots.flatMap((c,slot)=>c?c.launchSlots.filter(Boolean).map(action=>({slot,action})):[]).sort((a,b)=>a.action.index-b.action.index);},
    isActive(action){return session.slots[action.slot]?.launchSlots.includes(action);},
    interrupt(slot){const c=session.slots[slot];for(const action of [...c.launchSlots])if(action&&action.move.kind===0)action.release();},
    snapshot:()=>({evidence:'ROM_NORMAL_BRANCHES_CONTROLLED_INITIAL_RNG',worldFlags:actors.worldFlags(),history:[...history],
      initialRngBoundary:'0210CB94/CBB4: two 021140CC initializations per populated slot; pre-constructor RNG history is supplied by the fixture seed',
      slots:session.slots.map((c,i)=>c?{state:c.state,targetSlot:targetSlot(i),point:point(i),ownerLock:m.readU32(actors.address(i),0x154),launches:c.launchSlots.map(a=>a?a.index:null)}:null)})
  };
}
