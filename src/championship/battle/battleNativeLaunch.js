import { rewriteMoveScriptPointers, runMoveScript } from './battleMoveScriptRun.js';
import {readSpriteCellBox} from './battleSpriteCellBox.js';

// C384..C4A8: support preludes use the shared source banks and native center.
export function battlePreludeEffect(memory,owner,move){
  const position=memory.readU32(owner,0x2c),xyz=[0,4,8].map(o=>memory.readU32(position,o)|0);
  let encoded=move.field24??0,priority=-1;
  if(move.pointer1C===0x02120d03){
    const box=readSpriteCellBox(memory,memory.readU32(owner,4),1)?.box;
    if(!box)throw Error('BATTLE_PRELUDE_CELL_REQUIRED');
    xyz[0]=(xyz[0]+((box.lowX+box.highX)<<11))|0;xyz[1]=(xyz[1]+((box.lowY+box.highY)<<11))|0;
    if(move.field44===0){encoded=0x301;priority=1;}
    else if(move.field44>=0x10b&&move.field44<=0x115){encoded=0x401;
      priority=move.field44<=0x10c?0:move.field44<=0x111?2:1;}
  }
  return {encoded,priority,xyz};
}

// D95C..D99C: advance once per accepted contact, including contacts whose
// reaction is later rejected. Read the previous index even when count is zero.
export function nextBattleImpactOffset(memory, object, worldAddress) {
  const previous = memory.readU32(object, 0x10), next = (previous + 1) >>> 0;
  memory.writeU32(object, 0x10, next >= memory.readU32(worldAddress, 0x47884) ? 0 : next);
  return [0, 4, 8].map(o => memory.readU32(worldAddress, (0x47888 + Math.imul(previous, 12) + o) >>> 0) | 0);
}

// D A0C..DF20, after 149A8 has returned. Allocator and VM execution remain
// existing services. The 970 association belongs to the SECONDARY spark,
// independently of the move's field44 actor passed to the auxiliary script.
export function prepareBattleImpact({memory:m, object, worldAddress, targetObject, xyz, targetBox,
  offset, resultCode, nativeKind, auxIndex, allocate}) {
  const move = m.readU32(object, 0x20), owner = m.readU32(object, 0xe4), w = m.writeU32;
  if (auxIndex < 0) return null;
  const vm = object + 0x2a0 + auxIndex * 0x1b4;
  w(object, 0x970 + auxIndex * 4, 0);
  if (nativeKind === 5 || (resultCode !== 1 && resultCode !== 2)) return null;
  const point = xyz.map((v, i) => (v + offset[i]) | 0);
  const freeSlot = () => {
    for (let i = 0; i < 24; i++) if (!m.readU32(object, 0x24 + i * 4)) return i;
    return -1;
  };
  const make = (encoded, slot, position) => {
    const actor = allocate(encoded, slot, vm, position);
    if (actor && m.readU32(owner, 0x94) === object) {
      const base = worldAddress + 0x1f218;
      w(base, 0x19e54 + ((actor - base - 0x394) / 0xd4) * 4, 3);
    }
    return actor;
  };
  const sparks = [];
  if (resultCode === 2) {
    if (m.readU32(move, 0x1c) === 0x02120900) sparks.push('SECONDARY_3D');
    else {
      const slot = freeSlot();
      if (slot >= 0) {
        const species = m.readU32(m.readU32(owner, 0x10), 0) | 0;
        const center = [((targetBox.lowX + targetBox.highX) << 11), ((targetBox.lowY + targetBox.highY) << 11), 0];
        const actor = make(species <= 133 ? 0x12c : 0x124, slot, point.map((v, i) => (v + center[i]) | 0));
        if (actor) w(object, 0x970 + auxIndex * 4, actor);
      }
    }
  } else if (m.readU32(move, 0x3c) !== 0x0212f6ab) return null;
  const slot = freeSlot();
  if (slot < 0) return {started:false, sparks, point};
  const actor = make(resultCode === 1 ? 0x12e : m.readU16(move, 0x44), slot, point);
  if (resultCode === 2) sparks.push('PRIMARY_3D');
  const signed = o => (m.readU8(move, o) << 24) >> 12;
  return {started:true, vm, point, sparks, pointer:resultCode === 1 ? 0x0212f94e : m.readU32(move, 0x3c),
    args:[actor, targetObject, object, signed(0x43), (offset[0] + signed(0x40)) | 0, (offset[1] + signed(0x41)) | 0]};
}

/** 021156BC, called by C628 even when an attack is interrupted mid-script. */
export function releaseBattleLaunchOwner(memory,owner,object){
  for(let i=0;i<3;i++)if(memory.readU32(owner,0x78+i*4)===object){memory.writeU32(owner,0x78+i*4,0);break;}
  if(memory.readU32(owner,0x154)===object)memory.writeU32(owner,0x154,0);
}

// 0211CD80: release only children belonging to this VM. Siblings may continue
// after the primary VM ends; clearing all children here cuts off impact VFX.
export function releaseBattleVmChildren(memory, action, vm) {
  const released=[];
  for(let i=0;i<24;i++){
    const actor=memory.readU32(action,0x24+i*4);
    if(!actor || memory.readU32(action,0x84+i*4)!==vm)continue;
    memory.writeU8(actor,0x5b,0);
    for(let j=0;j<4;j++)if(memory.readU32(action,0x970+j*4)===actor){memory.writeU32(action,0x970+j*4,0);break;}
    memory.writeU32(action,0x24+i*4,0);memory.writeU32(action,0x84+i*4,0);released.push(actor);
  }
  return released;
}

// C144/C958/CB7C relocated object fields, over an existing match's memory.
// The caller supplies the target and starting point. This module never chooses
// an enemy, debits resources, resolves damage, or creates a renderer/ticker.
export function createBattleNativeLaunch({memory,index,owner,target,point,record,callNative:nativeHost,skipPrelude=false,ownerSlot=null,onSupport=null,advanceOwned=null}){
  const object=0x11000000+index*0x2000,moveAddress=object+0x1000,vmAddress=object+0xec;
  const move={...record,...rewriteMoveScriptPointers(record)};
  const w=memory.writeU32;
  // Reusing a pool slot must not retain an old VM's locks, child handles or state.
  for(let o=0;o<0x980;o+=4)w(object,o,0);
  for(let o=0;o<0x68;o+=4)w(moveAddress,o,0);
  for(const [offset,value] of [[0,1],[0x20,moveAddress],[0xe4,owner],[0xe8,target],[0x14,point.x],[0x18,point.y],[0x1c,point.z]])w(object,offset,value);
  // Only known table fields are materialized. The source catalog keeps the
  // decoded widths; aliases here correspond to its documented move offsets.
  for(const [key,value] of Object.entries(move)){
    const match=/^(?:field|pointer)([0-9A-F]{2})$/.exec(key);if(!match||!Number.isInteger(value))continue;
    const offset=parseInt(match[1],16);
    if([0x0a,0x0b,0x20,0x21,0x22,0x2c,0x2d,0x32,0x33,0x40,0x41,0x42,0x43].includes(offset))memory.writeU8(moveAddress,offset,value);
    else if([8,0x24,0x2e,0x30,0x34,0x36,0x38,0x44,0x4c,0x4e].includes(offset))memory.writeU16(moveAddress,offset,value);
    else w(moveAddress,offset,value);
  }
  memory.writeU16(moveAddress,0x48,move.actionCost??0);memory.writeU16(moveAddress,0x4a,move.power??0);
  w(moveAddress,0x50,move.kind);w(moveAddress,0x54,move.targetMode);
  const position=memory.readU32(owner,0x2c);
  const ownerPoint=()=>[0,4,8].map(o=>memory.readU32(position,o)|0);
  const aux=Array.from({length:4},()=>null);
  const diagnostics={unresolvedHostCalls:new Set(),needsObjectGraph:new Set(),calls:new Map(),effectsUnavailable:new Set()};
  const unresolvedDetails=new Map();
  const callNative=(routine,args)=>{const result=nativeHost(routine,args);
    if(result===undefined&&unresolvedDetails.size<32)unresolvedDetails.set(JSON.stringify([routine,...args]),{routine,args:[...args]});
    return result;};
  let state={},phase=skipPrelude?'PRIMARY_INIT':'PRELUDE',lastRun=null,failure=null,disposed=false;
  function effect(id,slot,vm,xyz){
    const actor=callNative(0x0211b264,[0x20000000,id,1])??0;
    if(!actor){if(id)diagnostics.effectsUnavailable.add(id);return 0;}
    [0x24,0x28,0x2c].forEach((o,i)=>w(actor,o,xyz[i]));callNative(0x02047904,[actor,(id&255)-1]);
    memory.writeU8(actor,0x5b,1);w(object,0x24+slot*4,actor);w(object,0x84+slot*4,vm);return actor;
  }
  if(!skipPrelude){
    if(target&&[0x02120900,0x02120d03].includes(move.pointer1C))callNative(0x0203ea30,[0x201,127,0]); // F900/F97C announcement
    const prelude=battlePreludeEffect(memory,owner,move);
    const actor=effect(prelude.encoded,0,vmAddress,prelude.xyz);
    if(actor)callNative(0x020472fc,[actor,prelude.priority]);}
  function run(field,script,vm,args,pointer){
    const result=runMoveScript({record:pointer===undefined?move:{...move,[field]:pointer},field,state:script,frames:1,budget:20000,
      inFlightObject:object,actionObject:owner,memoryAccess:memory,vmAddress:vm,
      ...(args?{args}:{}),callNative});
    for(const k of ['unresolvedHostCalls','needsObjectGraph'])for(const a of result[k]??[])diagnostics[k].add(a);
    for(const c of result.calls??[])diagnostics.calls.set(c.routine,(diagnostics.calls.get(c.routine)??0)+1);
    if(result.error)failure=result;
    return result;
  }
  function initializePrimary(){
    releaseBattleVmChildren(memory,object,vmAddress);
    effect(move.field30??0,0,vmAddress,ownerPoint());effect(move.field36??0,1,vmAddress,ownerPoint());
    phase='PRIMARY';state={};w(object,4,1);
  }
  return {
    object,moveAddress,vmAddress,move,
    step({preludeOnly=false}={}){
      if(disposed||phase==='DONE'||phase==='ERROR')return lastRun;
      try {
      if(preludeOnly&&phase!=='PRELUDE')return lastRun;
      if(phase==='PRIMARY_INIT')initializePrimary();
      if(phase==='PRELUDE'){
        lastRun=run('pointer1C',state,vmAddress,[memory.readU32(object,0x24),owner,object,
          (move.field22&255)<<12,(move.field20<<24)>>12,(move.field21<<24)>>12,point.x,point.y]);
        if(lastRun.error){phase='ERROR';return lastRun;}
        if(lastRun.active)return lastRun;
        if(move.kind===2||move.kind===3){
          releaseBattleVmChildren(memory,object,vmAddress);
          if(!onSupport)throw new Error('BATTLE_SUPPORT_RUNTIME_REQUIRED');
          phase='AUXILIARY';w(object,4,2);onSupport();
        }else initializePrimary();
        if(preludeOnly)return lastRun;
      }
      if(phase==='PRIMARY'){
        lastRun=run('pointer28',state,vmAddress);
        if(failure){phase='ERROR';lastRun=failure;return lastRun;}
      }
      // CBA4/CC18: every auxiliary VM advances in index order; completing one
      // must not stop another. Newly initialized child scripts also resume here.
      for(let i=0;i<4;i++)if(aux[i]){
        const result=run('pointer3C',aux[i].state,object+0x2a0+i*0x1b4,aux[i].args,aux[i].pointer);
        if(result.error){phase='ERROR';lastRun=result;return result;}
        if(!result.active){releaseBattleVmChildren(memory,object,object+0x2a0+i*0x1b4);aux[i]=null;}
      }
      // CBA4 releases primary-owned children after all four auxiliary steps.
      if(phase==='PRIMARY'&&!lastRun.active){releaseBattleVmChildren(memory,object,vmAddress);phase='AUXILIARY';w(object,4,2);}
      if(phase==='AUXILIARY'&&aux.every(v=>!v)){phase='DONE';w(object,0,memory.readU32(object,0)&~1);}
      return lastRun;
      } finally { advanceOwned?.(object); } // CC7C: all active children, once after VM dispatch.
    },
    startImpact({targetObject,xyz,targetBox,resultCode=null,nativeKind=13,offset=[0,0,0],onSpark=null}){
      const i=aux.findIndex(v=>!v);if(i<0)return false;
      if(resultCode!==null){
        const prepared=prepareBattleImpact({memory,object,worldAddress:0x20000000,targetObject,xyz,targetBox,
          offset,resultCode,nativeKind,auxIndex:i,allocate:effect});
        if(!prepared)return false;
        for(const kind of prepared.sparks)onSpark?.(kind,prepared.point);
        if(!prepared.started)return false;
        const child={state:{},args:prepared.args,pointer:prepared.pointer};aux[i]=child;
        const result=run('pointer3C',child.state,prepared.vm,child.args,child.pointer);
        if(result.error){phase='ERROR';lastRun=result;return false;}
        if(!result.active){releaseBattleVmChildren(memory,object,prepared.vm);aux[i]=null;}
        return true;
      }
      let slot=0;while(slot<24&&memory.readU32(object,0x24+slot*4))slot++;
      if(slot===24)return false;
      const vm=object+0x2a0+i*0x1b4,actor=effect(move.field44??0,slot,vm,xyz);
      const args=[actor,targetObject,object,(move.field43<<24)>>12,(move.field40<<24)>>12,(move.field41<<24)>>12];
      // DF04 starts and executes the child immediately. It keeps running after
      // the primary completes; its actor is bound to this exact auxiliary slot.
      w(object,0x970+i*4,actor);const child={state:{},args};aux[i]=child;
      const result=run('pointer3C',child.state,vm,args);
      if(result.error){phase='ERROR';lastRun=result;return false;}
      if(!result.active){releaseBattleVmChildren(memory,object,vm);aux[i]=null;}
      return true;
    },
    dispose(){if(disposed)return;disposed=true;releaseBattleLaunchOwner(memory,owner,object);
      for(const vm of [vmAddress,...aux.map((_,i)=>object+0x2a0+i*0x1b4)])releaseBattleVmChildren(memory,object,vm);
      w(object,0xe4,0);w(object,0xe8,0);w(object,0,0);},
    snapshot(){return {phase,object,owner,ownerSlot,target,moveId:move.recordIndex,
      activeChildren:Array.from({length:24},(_,i)=>memory.readU32(object,0x24+i*4)).filter(Boolean).length,
      auxiliaryActive:aux.filter(Boolean).length,error:lastRun?.error??null,
      nativeCalls:[...diagnostics.calls],unresolvedHostCalls:[...diagnostics.unresolvedHostCalls],needsObjectGraph:[...diagnostics.needsObjectGraph],
      unresolvedDetails:[...unresolvedDetails.values()],effectsUnavailable:[...diagnostics.effectsUnavailable]};}
  };
}
