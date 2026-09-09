// OVL19 02114E10..02115670; notification 15 at 021130C8 and 18..21.
// Scalar writes belong to the existing combatant; geometry belongs to its
// existing native actor/world object. The host supplies only those references,
// the existing animator, RNG and team services. No additional clock or store.
import tables from '../../data/championship/battleHitTables.json' with {type:'json'};
import { battleAngleIndex } from './battleNativeMath.js';
import { statusProcThreshold, statusResistanceIndex, mapActionStatusToRuntimeCode,
  BATTLE_STATUS_DURATION_BY_RUNTIME_CODE } from './battleStatus.js';

export const BATTLE_HIT_FIELDS = Object.freeze(['field40','field44','field4C','field50',
  'field84','field88','field8C','field90','field98']);
const fx=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a)*BigInt(b)+2048n)>>12n));
const state=(c,id)=>{c.state=id;c.stateCounter=-255;};
const vector=(angle,length)=>{
  const i=(angle&0xffff)>>4;
  return [fx(length,tables.sinCos[i*2+1]),fx(length,tables.sinCos[i*2])];
};

/** 02112820 calls the old notification's exit. Only 15 has a nondefault exit. */
export function notifyBattleHitState(c,code,h){
  if(c.field17C===15){
    c.field88=0;h.point[2]=0;h.rotate(0,4096);h.writeActor(0x440,0);c.field84=0;
  }
  c.field17C=code;c.field180=-255;
}

/** 0211452C: clear the original one-slot negative status and its state writers. */
export function clearBattleHitStatus(c,h){
  const old=c.statusCode;c.statusCode=0;c.statusRemaining=0;h.writeActor(0x6cc,0);
  if(c.currentHp>0 && [1,3,4,5,8,9,10,12].includes(old)){
    state(c,1);notifyBattleHitState(c,1,h);
  }
}

/** 021145C0, including the state/icon writes previously missing at the caller. */
export function applyBattleHitStatus(c,code,h){
  if(code===0){clearBattleHitStatus(c,h);return;}
  if(c.currentHp<=0)return;
  if(!Number.isInteger(code)||code<1||code>14)throw new Error('BATTLE_HIT_STATUS_UNTRACED');
  c.field22=(c.field22+10)&0xffff;
  const icons=[0,6,7,8,9,10,11,12,13,14,15,16,0,0,17];
  const next={1:8,3:9,4:12,5:10,8:11,9:11,10:11,12:11};
  h.writeActor(0x6cc,icons[code]);if(next[code]!==undefined)state(c,next[code]);
  c.statusCode=code;c.statusRemaining=BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[code];
}

/** 021149B8 / 02114A00 / 02114A38, before any damage RNG is consumed. */
export function battleHitEligible(c,kind){
  if(c.currentHp<=0)return false;
  if(kind!==0 && kind!==1)return false;
  if(c.state===23 && ![0,1,2,9,10,11,12].includes(c.field84))return false;
  return ![18,19,20,21].includes(c.field17C);
}

/** The damage core is supplied by battleDamageResolver; no second HP formula. */
export function applyBattleHitResult({c,move,damage,blocked=damage<=0,nativeKind=13,critical=false,
  sourcePoint,rng,h,statusInputs=null}){
  const hitKind=nativeKind===13?move.field14:nativeKind;
  if(damage>0)c.field22=(c.field22+(move.kind===0?1:move.kind===1?10:0))&0xffff;
  h.impactFeedback?.({move,blocked,critical}); // 02114D78..E0C, before action cleanup
  h.releaseOrdinaryActions?.(); // 02114E10, only action-object kind 0
  if(hitKind===5){
    state(c,23);notifyBattleHitState(c,15,h);c.field84=11;c.field180=0;
    return {code:2,hpChanged:false,knockedOut:false};
  }
  const before=c.currentHp;
  if(before<=0)return {code:blocked?1:2,hpChanged:false,knockedOut:false};
  c.currentHp=(before-damage)|0;
  const knockedOut=c.currentHp<=0;
  h.hitTiming?.({damage,blocked,knockedOut});
  if(knockedOut){
    h.sound?.(0x210); // 02114FB4, direct-damage HP-zero entry only
    c.currentHp=0;clearBattleHitStatus(c,h);c.field160=0;c.field164=0;
    h.onKnockout?.();
  }
  const old=c.field84;
  c.field84=0;
  if(blocked)c.field84=13;
  else if(hitKind===6)c.field84=c.currentHp<=0?5:7;
  else if([2,3,4,10,11,12].includes(hitKind))c.field84=({2:8,3:9,4:10,10:3,11:4,12:6})[hitKind];
  else c.field84=c.currentHp<=0?5:(rng.next(216)&1)?1:2;
  c.field50=battleAngleIndex((sourcePoint[1]-h.point[1])|0,(sourcePoint[0]-h.point[0])|0);
  c.field4C=0;c.field40=0;c.field44=c.field50;
  h.writeActor(0x6dc,((c.field44+0x4000)&0x8000)?0:1);
  if((c.field84===9&&old===9)||(c.field84===10&&old===10))c.field90=(c.field90&2)|32;
  else{
    const reaction=c.field84;state(c,23);notifyBattleHitState(c,15,h);c.field84=reaction;
  }
  if(c.currentHp>0&&!blocked&&move.statusCode){
    if(!statusInputs)throw new Error('BATTLE_HIT_STATUS_INPUTS_REQUIRED');
    const actionStatusId=move.statusCode;
    const resistanceIndex=statusResistanceIndex({...statusInputs,actionStatusId});
    const threshold=statusProcThreshold({actionStatusId,attackerIndex:statusInputs.attackerIndex,resistanceIndex});
    if(rng.next(216)<threshold){
      if([3,4,6,8].includes(actionStatusId))c.field84=12;
      applyBattleHitStatus(c,mapActionStatusToRuntimeCode(actionStatusId),h);
    }
  }
  c.currentHp=Math.min(c.currentHp,c.maxHp);
  return {code:blocked?1:2,hpChanged:c.currentHp!==before,knockedOut};
}

// 0204819C with step=4096, then 020482AC. Velocity is accumulated BEFORE
// acceleration, and actor position adds accumulated velocity (not just +50).
function vertical(h){
  for(const [acc,velocity,position] of [[0x48,0x3c,0x24],[0x4c,0x40,0x28],[0x50,0x44,0x2c]]){
    const v=(h.readActor(velocity)+h.readActor(acc))|0;
    h.writeActor(velocity,v);h.writeActor(position,(h.readActor(position)+v)|0);
  }
  h.writeActor(0x50,(h.readActor(0x50)+h.readActor(0x38))|0);
  h.point[2]=h.readActor(0x2c);
}
const launchVertical=(h,gravity,velocity)=>{
  h.writeActor(0x38,gravity);h.writeActor(0x44,0);h.writeActor(0x50,velocity);
};
function reactionEntry(c,h){
  const r=c.field84;
  if([3,4,5].includes(r)){
    h.sequence(37);h.writeActor(0x440,0);
    const row={3:[10240,3277,-860,4301],4:[19661,3645,-328,1638],5:[11469,3277,-410,3277]}[r];
    [c.field88,c.field8C]=row;launchVertical(h,row[2],row[3]);
  }else if(r===6){
    h.sequence(38);c.field88=18432;c.field8C=3932;c.field90=0;h.writeActor(0x440,1);
    launchVertical(h,0,0);h.point[2]=Math.trunc(h.height()/3)*4096;
  }else if([8,9,10].includes(r)){
    h.sequence(6);h.writeActor(0x440,0);c.field88=0;c.field8C=0;launchVertical(h,0,0);
    c.field90=r===10?24:36;c.field50=(h.readActor(0x14)&1)?0:32768;h.writeActor(0x2c,8192);
  }else if([7,11,12].includes(r)){
    if(r===12){if([8,9,10].includes(c.statusCode))h.sequence(6);else if(c.statusCode===12)h.sequence(36);}
    else h.sequence(r===7?26:36);
    h.writeActor(0x440,0);c.field90=0;c.field88=0;c.field8C=0;launchVertical(h,-532,2867);
  }else{
    h.sequence(r===13?34:r===1?5:6);h.writeActor(0x440,1);c.field88=32768;c.field8C=r===13?2253:3482;
  }
}

/** One execution of 021130C8. The dispatcher owns the +180 entry/increment. */
export function updateBattleHitReaction(c,h){
  if(c.field180===0)reactionEntry(c,h);
  if(c.field84===6){
    const increment=(48-Math.trunc(Math.min(h.height(),48)*16/24))<<8;
    c.field90=(c.field90+((h.readActor(0x14)&1)?-increment:increment))&65535;
    if(c.field88<4915){h.sequence(15);h.point[2]=0;c.field8C=3686;c.field84=3;c.field90=0;}
    const i=(c.field90>>4)*2;h.rotate(tables.sinCos[i],tables.sinCos[i+1]);
  }else if([8,9,10].includes(c.field84)&&c.field90>0){
    --c.field90;h.point[0]=(h.point[0]+((c.field90&2)?4096:-4096))|0;
    if(c.field90===0){
      if(c.field84===10){c.field84=7;h.sequence(26);h.writeActor(0x440,0);c.field88=0;c.field8C=0;launchVertical(h,-532,2867);}
      else{c.field84=3;h.sequence(37);h.writeActor(0x440,0);c.field88=10240;c.field8C=3277;launchVertical(h,-860,4096);}
    }
  }
  const [dx,dy]=vector(c.field50,c.field88);h.point[0]=(h.point[0]-dx)|0;h.point[1]=(h.point[1]-dy)|0;
  if(c.field84===11||c.field84===12){
    if(c.field90===0){
      vertical(h);if(h.point[2]>0)return;
      h.point[2]=0;h.sequence(15);
      if(c.field84===12){if(c.statusCode===10)h.sequence(1);else if(c.statusCode===9)h.sequence(13);}
      ++c.field90;h.writeActor(0x440,1);h.writeActor(0x43c,15);return;
    }
    if(c.field90===1){h.writeActor(0x440,0);++c.field90;if(c.currentHp<=0)notifyBattleHitState(c,18,h);}
    return;
  }
  if(h.readActor(0x440)!==0){
    if(c.field88>410){c.field88=fx(c.field88,c.field8C);return;}
    if(c.field84===13&&c.field180<=30)return;
    notifyBattleHitState(c,c.currentHp>0?1:18,h);return;
  }
  vertical(h);
  if(c.field84===7){
    if(h.point[2]<=0)h.point[2]=0;
    if(h.finished())h.writeActor(0x440,1);
    return;
  }
  if(h.point[2]>0)return;
  h.point[2]=0;h.sequence(15);h.writeActor(0x440,1);
}

/** Notification 18/19/20/21; numeric table indices remain unnamed. */
export function updateBattleRecovery(c,h){
  const n=c.field17C,k=c.field180;
  const candidate=()=>h.recoveryMove();
  const roll=(name)=>{
    if(c.field98<0||c.field98>2)throw new Error('BATTLE_RECOVERY_TABLE_INDEX_UNTRACED');
    return h.rng.next(216)<tables.recovery[name][c.field98];
  };
  if(n===18){
    if(k!==0)return;
    h.sequence(15);h.writeActor(0x440,0);
    if(h.ending()){notifyBattleHitState(c,21,h);return;}
    if(h.downed()+1<h.teamCount()&&roll(candidate()?'moveEntry':'noMoveEntry'))notifyBattleHitState(c,19,h);
    else notifyBattleHitState(c,21,h);
  }else if(n===19){
    if(k===0){h.sequence(15);return;}
    if(h.ending()){notifyBattleHitState(c,21,h);return;}
    if([190,230,270].includes(k))h.sequence(32);
    else if([210,250].includes(k))h.sequence(15);
    if(k>=310){
      const name=candidate()?'moveFinal':'noMoveFinal';const success=roll(name);c.field98=(c.field98-1)&255;
      notifyBattleHitState(c,success?20:21,h);
    }else if(k>=295)h.point[0]=(h.point[0]+((k&2)?4096:-4096))|0;
  }else if(n===20){
    if(h.ending()){notifyBattleHitState(c,21,h);return;}
    if(k===0){
      h.sequence(33);launchVertical(h,-819,2867);
      const move=candidate();
      if(move)c.metricLimit-=h.moveCost(move);
      c.currentHp=Math.trunc(c.maxHp*(move===29?30:5)/100);return;
    }
    if(h.finished()){h.clearTeamTargets?.();notifyBattleHitState(c,1,h);c.flags9A&=~2;}
    vertical(h);if(h.point[2]>0)return;
    h.point[2]=0;launchVertical(h,0,0);
  }else if(n===21 && k===0){
    h.sequence(15);if(c.flags9A&2)return;c.flags9A|=2;c.currentHp=0;h.finalDown();
  }
}

/** Bounded common notification tail, 02112B3C..02112D58. */
export function finishBattleHitNotification(c,h){
  c.field44&=65535;c.field50&=65535;
  h.writeActor(0x6dc,((c.field44+16384)&32768)?0:1);
  if(c.field17C!==0){
    h.point[0]=Math.max(131072,Math.min(1572864,h.point[0]));
    const slope=Math.abs(Math.trunc(((h.point[0]-851968)<<4)/176));
    if(h.point[1]<294912)h.point[1]=Math.max(h.point[1],229376+slope);
    if(h.point[1]>1048576)h.point[1]=Math.min(h.point[1],1114112-slope);
  }
  [0x24,0x28,0x2c].forEach((o,i)=>h.writeActor(o,h.point[i]));
  c.field180=(c.field180+1)|0;
}
