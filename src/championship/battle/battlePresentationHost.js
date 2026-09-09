// OVL19 camera dispatch fields and ARM9 view coordinates. The existing phone
// viewport consumes these values; this is not a second camera clock or store.
import tables from '../../data/championship/battlePresentationProfiles.json' with {type:'json'};

export function writeBattleHitTiming(m,world,{damage,blocked,knockedOut=false,remainingTeamMembers=null}) {
  // 14ED4..14F38: damage>=500 takes entry2, >250 entry1, otherwise entry0.
  const base=tables.hitPauseTable[damage>=500?2:damage>250?1:0];
  let pause=blocked?Math.trunc(base/2):base,unknown=null;
  if(knockedOut&&!m.readU32(world,0x1f12c)){
    pause=Math.max(pause,base*6);
    const index=tables.knockoutSlowdownIndices[remainingTeamMembers];
    if(index===undefined)unknown='0211272C_REMAINING_TEAM_INDEX_REQUIRES_CALLER_TRACE';
    else m.writeU32(world,0x1f138,Math.max(m.readU32(world,0x1f138),tables.knockoutSlowdownTable[index]));
  }
  m.writeU32(world,0x1f134,Math.max(m.readU32(world,0x1f134),pause));
  return unknown;
}

export function advanceBattlePresentationTiming(m,world){
  // D42C..D474 decrements both counters before selecting an update branch.
  for(const offset of [0x1f134,0x1f138]){const n=m.readU32(world,offset)|0;if(n>0)m.writeU32(world,offset,n-1);}
  return (m.readU32(world,0x1f134)|0)<=0&&(m.readU32(world,0x1f138)|0)%8===0;
}
export function callBattlePresentationHost(m,world,routine,args){
  const [p,a,b]=args,r=(p,o)=>m.readU32(p,o)|0,w=m.writeU32;
  if(routine===0x0207f810){w(p,0x14,a);return p;}
  if(routine===0x02111808)return +(r(world,0x1f108)===0&&r(world,0x1f10c)===12);
  if(routine===0x02111834)return +(r(p,0x1f0ec)!==0);
  if(routine===0x021117c4){
    if(r(p,0x1f108)!==a||r(p,0x1f10c)!==b){
      w(p,0x1f110,r(p,0x1f108));w(p,0x1f114,r(p,0x1f10c));
      if(r(p,0x1f108)===1)w(p,0x1f118,r(p,0x1f10c));
      w(p,0x1f108,a);w(p,0x1f10c,b);
      initialize(p);
    }
    return p;
  }
  if(routine===0x021117e8){w(p,0x1f108,r(p,0x1f110));w(p,0x1f10c,r(p,0x1f114));initialize(p);return p;}
  if(routine===0x020460e4){
    for(const offset of [0x60,0x88]){w(p,offset,a);w(p,offset+4,b);w(p,offset+8,0);}
    // 02043EF4 is the original screen matrix upload when attached. Rendering
    // is owned by the existing browser field and reads this numeric projection.
    return p;
  }
  return undefined;
  function initialize(p){
    // 021115E4 does nothing for explicit camera mode 0. Mode 1 follows one of
    // the nine original vector references (02111630..0211176C).
    if(r(p,0x1f108)!==1)return;
    const mode=r(p,0x1f10c),table=[0x1f0fc,0x1f0fc,0x5e38,0x5e44,0x5e50,0x1f0fc,0x5e5c,0x5e68,0x5e74];
    w(p+0x1f050,0x30,p+(table[mode]??table[0]));m.writeU8(p+0x1f050,8,2);
    w(p,0x1f0c8,mode===1||mode===5?16:mode>=2&&mode<=8?2:32);
    w(p+0x1f050,0x50,0);w(p+0x1f050,0x54,-40*4096);
  }
}

// C264..C33C -> F900/F97C. A special owns +94 through C628 disposal,
// including its primary and auxiliary scripts, not only its zoom prelude.
export function beginBattlePresentationEngagement({slots,actors,slot,targetSlot,action,notify}) {
  if(targetSlot<0||![0x02120900,0x02120d03].includes(action.move.pointer1C))return false;
  const owner=slots[slot],target=slots[targetSlot],m=actors.memory;
  if(!owner||!target)return false;
  const object=0x11000000+action.index*0x2000;
  owner.field94=object;
  m.writeU32(actors.actorOf(slot),0xd4,-0x180000);
  if(action.move.kind!==2){
    target.field94=object;target.state=0;target.stateCounter=-255;
    if(target.field17C!==15||target.field84!==12)notify(targetSlot,1);
    m.writeU32(actors.actorOf(targetSlot),0xd4,-0x180000);
  }else if(action.move.targetMode===0||action.move.targetMode===1){
    m.writeU32(actors.actorOf(targetSlot),0xd4,-0x180000);
  }else if(action.move.targetMode===2){
    slots.forEach((c,i)=>{if(c?.currentHp>0&&Math.floor(i/3)===Math.floor(slot/3))m.writeU32(actors.actorOf(i),0xd4,-0x180000);});
  }
  actors.syncCombatants();return true;
}

export function endBattlePresentationEngagement({slots,actors,slot,object}) {
  if(slots[slot]?.field94!==object)return false;
  // FA60 deliberately resets the engaged wrappers, not every roster member.
  for(let i=0;i<slots.length;i++)if(slots[i]?.field94){
    actors.memory.writeU32(actors.actorOf(i),0xd4,0x800000);slots[i].field94=0;
  }
  actors.syncCombatants();return true;
}
