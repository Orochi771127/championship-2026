// Bind the verified notification writers to the existing session/actor owner.
import {applyBattleHitResult,updateBattleHitReaction,updateBattleRecovery,
  notifyBattleHitState,finishBattleHitNotification,clearBattleHitStatus,applyBattleHitStatus} from './battleHitState.js';
import {buildCandidateBuckets} from './battleCandidateBuckets.js';
import {scanAffordableAction} from './battleActionSelection.js';
import {getBattleCatalogRecord} from './battleCatalogs.js';
import {battleTeamOfSlot} from './battleOutcome.js';
import {BATTLE_SPECIES_MOVEMENT} from '../../data/championship/battleCharacterProfiles.js';
import {moveNormalBattleNotification,updateNormalBattleNotification} from './battleNormalFlow.js';
import {applyBattleHeal,positiveEffectCodeForField5C,applyPositiveEffect} from './battleSupport.js';

export function createBattleHitRuntime({session,actors,onSound=null,onImpactFeedback=null,onHitTiming=null}){
  const m=actors.memory;
  const history=[];let battleEnding=false;
  function record(slot,type,detail={}){
    history.push({frame:session.frame,clock:session.clock,slot,type,...detail});if(history.length>256)history.shift();
  }
  function clearTargets(slot,sameTeam){
    const team=battleTeamOfSlot(slot),address=actors.address(slot);
    session.slots.forEach((c,i)=>{
      if(!c || (battleTeamOfSlot(i)===team)!==sameTeam)return;
      const wrapper=actors.address(i);
      for(const offset of [0x5c,0x60])if(m.readU32(wrapper,offset)===address)m.writeU32(wrapper,offset,0);
    });
  }
  function host(slot){
    const c=session.slots[slot],actor=actors.actorOf(slot),world=m.readU32(actors.address(slot),0x2c);
    const team=battleTeamOfSlot(slot),point=[0,4,8].map(o=>m.readU32(world,o)|0);
    return {point,actor,world,rng:session.rng,
      sound:id=>onSound?.(id),impactFeedback:detail=>onImpactFeedback?.(detail),
      hitTiming:detail=>onHitTiming?.({...detail,remainingTeamMembers:session.slots.filter((x,i)=>x&&battleTeamOfSlot(i)===team).length-session.downed[team]}),
      readActor:o=>m.readU32(actor,o)|0,writeActor:(o,v)=>m.writeU32(actor,o,v),
      sequence(id){actors.requestSequence(slot,id,'ROM_NOTIFICATION_UPDATE');},
      rotate(s,cos){m.writeU32(actor,0xc,s);m.writeU32(actor,0x10,cos);},
      height:()=>actors.call(0x02047d98,[actor]),finished:()=>actors.call(0x02047c48,[actor]),
      walk:()=>BATTLE_SPECIES_MOVEMENT[c.speciesId]?.walkQ12??0,
      run:()=>BATTLE_SPECIES_MOVEMENT[c.speciesId]?.runQ12??0,
      ending:()=>battleEnding,teamCount:()=>session.slots.filter((x,i)=>x&&battleTeamOfSlot(i)===team).length,
      downed:()=>session.downed[team],
      recoveryMove(){
        const b=buildCandidateBuckets([c.source12C,c.source130]);
        return scanAffordableAction({candidateIds:b.scanGroups[7],actionCostById:b.actionCostById,reserve:c.metricLimit});
      },
      moveCost:id=>getBattleCatalogRecord('moves',id).actionCost,
      clearTeamTargets:()=>clearTargets(slot,true),
      finalDown(){
        session.downed[team]++;clearTargets(slot,false);
        session.slots.forEach((x,i)=>{if(x&&x.currentHp>0&&battleTeamOfSlot(i)===team)x.field22=(x.field22+20)&65535;});
        record(slot,'FINAL_DOWN',{downed:session.downed[team]});
      },
      releaseOrdinaryActions(){
        if(session.normalFlow){session.normalFlow.interrupt(slot);record(slot,'ACTION_INTERRUPTED');return;}
        // The adapter holds one ordinary launch where the original has three
        // +78 slots. Its kind-0 launch and pending adapter claim are interrupted.
        const action=c.committedAction;
        if(action){c.committedAction=0;action.release?.();record(slot,'ACTION_INTERRUPTED');}
      },
      onKnockout(){
        clearTargets(slot,false);
        battleEnding ||= [0,1].some(t=>{
          const members=session.slots.filter((x,i)=>x&&battleTeamOfSlot(i)===t);
          return members.length>0&&members.every(x=>x.currentHp===0);
        });
        if(battleEnding)actors.markBattleEnding();
        record(slot,'HP_ZERO',{battleEnding});
      }
    };
  }
  function writePoint(h){[0,4,8].forEach((o,i)=>m.writeU32(h.world,o,h.point[i]));}
  return {
    status(slot,code){const h=host(slot);applyBattleHitStatus(session.slots[slot],code,h);writePoint(h);actors.syncCombatants();
      record(slot,'STATUS_APPLIED',{code,state:session.slots[slot].state});},
    notify(slot,code){const h=host(slot);notifyBattleHitState(session.slots[slot],code,h);writePoint(h);},
    apply(slot,input){
      const c=session.slots[slot],h=host(slot);
      const result=applyBattleHitResult({...input,c,h,rng:session.rng});writePoint(h);actors.syncCombatants();
      record(slot,'HIT_STATE_WRITTEN',{hp:c.currentHp,reaction:c.field84,notification:c.field17C,result:result.code});
      return result;
    },
    support(slot,move){
      const c=session.slots[slot];if(!c||c.currentHp<=0)return;
      const h=host(slot),code=move.statusCode;
      if(move.kind===2){
        if(code>=14&&code<=19)c.currentHp=applyBattleHeal({currentHp:c.currentHp,maxHp:c.maxHp,field5C:code});
        else if(code===20)clearBattleHitStatus(c,h);
        else if(code>=21&&code<=29){const value=applyPositiveEffect(positiveEffectCodeForField5C(code));c.field160=value.effectCode;c.field164=value.remainingDuration;}
      }
      c.currentHp=Math.min(c.currentHp,c.maxHp);writePoint(h);actors.syncCombatants();
      record(slot,'SUPPORT_APPLIED',{kind:move.kind,statusCode:code,hp:c.currentHp});
    },
    step(slot){
      const c=session.slots[slot];if(!c)return;
      const n=c.field17C;
      // Other ordinary notifications still use the existing dispatch adapter.
      const ordinary=session.normalFlow&&n>=0&&n<=12;
      if(!ordinary&&![1,15,18,19,20,21].includes(n))return;
      const h=host(slot),oldZ=h.point[2],oldReaction=c.field84;
      if(c.field180<0)c.field180=0;
      if(ordinary)updateNormalBattleNotification(c,h);
      else if(n===15)updateBattleHitReaction(c,h);
      else if(n===1){if(c.field180===0){c.field40=0;h.sequence(0);h.writeActor(0x440,0);}}
      else updateBattleRecovery(c,h);
      if(oldZ>0 && h.point[2]<=0)record(slot,'LANDED',{reaction:oldReaction,nextReaction:c.field84});
      if(c.field17C!==n)record(slot,'NOTIFICATION_CHANGED',{from:n,to:c.field17C,hp:c.currentHp});
      if(session.normalFlow)moveNormalBattleNotification(c,h);
      finishBattleHitNotification(c,h);writePoint(h);
    },
    frameEvents(slot,events,before){
      const c=session.slots[slot],h=host(slot);
      for(const event of events){
        if(event.type==='STATUS_EXPIRED'){
          c.statusCode=before.statusCode;clearBattleHitStatus(c,h);
        }else if(event.type==='TIMER_ELAPSED'){c.field160=0;c.field164=0;}
        else if(event.type==='THRESHOLD_CROSSED'){applyBattleHitStatus(c,1,h);c.field22=0;}
        else if(event.type==='DEFEATED'){
          // DoT's HP<0 path notified 18 after the same exit cleanup.
          clearBattleHitStatus(c,h);
          c.field17C=before.field17C;notifyBattleHitState(c,18,h);
          h.point[2]=0;c.field3C=0;h.onKnockout();
        }
      }
      writePoint(h);
    },
    snapshot:()=>({battleEnding,history:[...history],combatants:session.slots.map(c=>c?{
      hp:c.currentHp,state:c.state,notification:c.field17C,counter:c.field180,reaction:c.field84,
      speed:c.field88,phase:c.field90,attemptIndex:c.field98,suspended:!!(c.flags9A&2)}:null)})
  };
}
