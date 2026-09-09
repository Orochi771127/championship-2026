import test from 'node:test';
import assert from 'node:assert/strict';
import oracle from '../docs/research/BATTLE_IMPACT_CONTINUATION_CPU_2026-09-08.json' with {type:'json'};
import {createBattleNativeMemory} from '../src/championship/battle/battleNativeMemory.js';
import {nextBattleImpactOffset,prepareBattleImpact} from '../src/championship/battle/battleNativeLaunch.js';

test('64 original ARM offset-ring cases preserve previous-index reads including zero count and wrap',()=>{
  const {world,action}=oracle.addresses;
  for(const c of oracle.offsets){
    const m=createBattleNativeMemory();m.writeU32(action,0x10,c.previous);m.writeU32(world,0x47884,c.count);
    c.input.forEach((v,i)=>m.writeU32(world,0x47888+c.previous*12+i*4,v));
    assert.deepEqual(nextBattleImpactOffset(m,action,world),c.offset);
    assert.equal(m.readU32(action,0x10),c.next);
  }
});

for(const resultCode of [0,1,2])test(`original ARM hit result ${resultCode}: allocations, offsets, locks, VM args and secondary ownership`,()=>{
  const {world,action,owner,target,move,species}=oracle.addresses,base=world+0x1f218;
  for(const [caseId,c] of oracle.cases.entries()){
    const v=c.input;if(v.resultCode!==resultCode)continue;
    const m=createBattleNativeMemory(),allocations=[];
    m.writeU32(action,0x20,move);m.writeU32(action,0xe4,owner);m.writeU32(owner,0x10,species);m.writeU32(species,0,v.species);
    m.writeU32(owner,0x94,v.ownerLocked?action:0);
    m.writeU32(move,0x1c,v.specialPrelude?0x2120900:0x2120674);
    m.writeU32(move,0x3c,v.recognizedBlockedScript?0x212f6ab:0x212f4a0);m.writeU16(move,0x44,0x131);
    v.moveOffsets.forEach((n,i)=>m.writeU8(move,[0x40,0x41,0x43][i],n));
    v.busyChildren.forEach(i=>m.writeU32(action,0x24+i*4,0xdead0000+i*4));
    for(let i=0;i<4;i++)m.writeU32(action,0x970+i*4,0xf000+i);
    const allocate=(encoded,slot,vm,point)=>{
      const i=allocations.length,actor=v.failAllocations.includes(i)?0:base+0x394+i*0xd4;
      allocations.push({encoded,mode:1,actor});
      if(actor){
        point.forEach((n,j)=>m.writeU32(actor,0x24+j*4,n));m.writeU8(actor,0x5b,1);
        m.writeU32(action,0x24+slot*4,actor);m.writeU32(action,0x84+slot*4,vm);m.writeU32(base,0x19e54+i*4,1);
      }
      return actor;
    };
    const p=prepareBattleImpact({memory:m,object:action,worldAddress:world,targetObject:target,xyz:v.point,
      targetBox:{highX:v.box[0],highY:v.box[1],lowX:v.box[2],lowY:v.box[3]},offset:v.offset,
      resultCode:v.resultCode,nativeKind:v.nativeKind,auxIndex:[0,1,2,3].findIndex(i=>!v.busyAux.includes(i)),allocate});
    const detail=JSON.stringify({caseId,v});
    assert.deepEqual(allocations,c.allocations,detail);
    assert.deepEqual(p?.sparks??[],c.sparks,detail);
    assert.deepEqual(p?.started?[{vm:p.vm,pointer:p.pointer,args:p.args}]:[],c.scripts,detail);
    assert.deepEqual(Array.from({length:24},(_,i)=>m.readU32(action,0x24+i*4)),c.handles,detail);
    assert.deepEqual(Array.from({length:24},(_,i)=>m.readU32(action,0x84+i*4)),c.owners,detail);
    assert.deepEqual(Array.from({length:4},(_,i)=>m.readU32(action,0x970+i*4)),c.bindings,detail);
    assert.deepEqual(allocations.flatMap((a,i)=>a.actor?[{actor:a.actor,
      point:[0,4,8].map(o=>m.readU32(a.actor,0x24+o)|0),active:m.readU8(a.actor,0x5b),mode:m.readU32(base,0x19e54+i*4)}]:[]),c.actors,detail);
  }
});
