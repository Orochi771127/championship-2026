import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { divFx } from '../src/championship/battle/battleScriptVm.js';
import { battleNativeBoxContact } from '../src/championship/battle/battleActionApplication.js';
import { createBattleNativeMemory } from '../src/championship/battle/battleNativeMemory.js';
import { releaseBattleVmChildren,createBattleNativeLaunch } from '../src/championship/battle/battleNativeLaunch.js';
import { createBattleNativeActors } from '../src/championship/battle/battleNativeActors.js';
import { createBattleRuntime } from '../src/championship/app/battleRuntime.js';
import { battleStandPosition } from '../src/championship/app/battlePresentationSource.js';
import { createBattleImpactEffects,BATTLE_IMPACT_FAMILIES } from '../src/championship/battle/battleImpactEffects.js';
import { getBattleCatalogRecord } from '../src/championship/battle/battleCatalogs.js';

const oracle=JSON.parse(fs.readFileSync(new URL('../docs/research/BATTLE_LIFECYCLE_CPU_2026-09-07.json',import.meta.url)));
test('SDK fixed divide matches original CPU including zero and signed overflow inputs',()=>{
  for(const c of oracle.divisions)assert.equal(divFx(c.a,c.b),c.result,JSON.stringify(c));
});
test('512 cell contacts match original CPU including depth subtraction and rejected overlap',()=>{
  for(const c of oracle.contacts)assert.equal(Number(battleNativeBoxContact(c.boxes[0],c.points[0],c.boxes[1],c.points[1])),c.result,JSON.stringify(c));
});
test('original CPU child cleanup preserves sibling VM handles and actor activity',()=>{
  const base=0x2300000,vms=[base+0xec,...Array.from({length:4},(_,i)=>base+0x2a0+i*0x1b4)];
  for(const c of oracle.releases){
    const m=createBattleNativeMemory();
    for(let i=0;i<24;i++){
      const actor=base+0x1000+i*0x100;
      m.writeU32(base,0x24+i*4,actor);m.writeU32(base,0x84+i*4,vms[i%5]);m.writeU8(actor,0x5b,1);
      if(i<4)m.writeU32(base,0x970+i*4,actor);
    }
    releaseBattleVmChildren(m,base,vms[c.vmIndex]);
    assert.deepEqual(Array.from({length:24},(_,i)=>m.readU32(base,0x24+i*4)),c.handles);
    assert.deepEqual(Array.from({length:24},(_,i)=>m.readU32(base,0x84+i*4)),c.owners);
    assert.deepEqual(Array.from({length:4},(_,i)=>m.readU32(base,0x970+i*4)),c.bindings);
    assert.deepEqual(Array.from({length:24},(_,i)=>m.readU8(base+0x1000+i*0x100,0x5b)),c.active);
  }
});
test('actor, world position, native cell banks and reused launch allocations do not alias',()=>{
  const slots=[{speciesId:81},{speciesId:113},null,{speciesId:50},null,null];
  const a=createBattleNativeActors({slots,stands:slots.map((_,i)=>battleStandPosition(i))}),m=a.memory;
  const owner=a.address(0),target=a.address(3),actor=a.actorOf(0),world=m.readU32(owner,0x2c);
  assert.notEqual(world,actor+0x24);
  assert.equal(m.readU32(owner,0)+4,actor);assert.ok(a.box(0));assert.ok(a.box(3));
  a.requestSequence(0,8,'EXISTING_DISPATCH_ORIGINAL_LAUNCH_TIMING_PARTIAL');
  assert.equal(m.readU8(actor,0x58),8);
  assert.equal(a.project(0).animationRequest.sequenceId,8,'visual sequence matches collision animator');
  const point=a.targetPoint(3),record=getBattleCatalogRecord('moves',179);
  const launch=createBattleNativeLaunch({memory:m,index:0,owner,target,point,record,callNative:()=>0});
  assert.equal(m.readU32(launch.object,0xe8),target);assert.equal(m.readU32(launch.object,0xe4),owner);
  assert.equal(m.readU32(launch.object,0x14)|0,point.x);
  m.writeU32(launch.object,0x24,0xdeadbeef);m.writeU32(launch.moveAddress,0x64,0xdeadbeef);
  createBattleNativeLaunch({memory:m,index:0,owner:target,target:owner,point:a.targetPoint(0),record,callNative:()=>0});
  assert.equal(m.readU32(launch.object,0x24),0);assert.equal(m.readU32(launch.moveAddress,0x64),record.field64??0);
  assert.equal(m.readU32(launch.object,0xe4),target);assert.equal(m.readU32(owner,4),actor);
});
test('impact pools respect target threshold, 16-slot capacity, full native duration, reuse and teardown',()=>{
  const p=createBattleImpactEffects(),input={owner:1,target:2,ownerSpeciesId:80,targetSpeciesId:71,point:{x:0,y:0,z:0}};
  assert.equal(p.spawn({...input,owner:0}),null);
  for(let i=0;i<16;i++)assert.ok(p.spawn(input));
  assert.equal(p.spawn(input),null);
  assert.ok(p.spawn({...input,targetSpeciesId:72}));
  assert.ok(p.spawn({...input,secondary:true}));
  assert.deepEqual([...new Set(p.snapshot().map(e=>e.type))],[0,1,3]);
  for(let i=0;i<18;i++)p.advance();
  assert.equal(p.snapshot().filter(e=>e.type<2).length,17,'completion is checked before advancing');
  p.advance();assert.equal(p.snapshot().length,1);
  assert.ok(p.spawn(input));assert.equal(p.snapshot().find(e=>e.type===0).slot,0);
  p.clear();assert.deepEqual(p.snapshot(),[]);assert.equal(p.diagnostics().created,p.diagnostics().released);
  assert.deepEqual(BATTLE_IMPACT_FAMILIES.map(e=>e.frameCount),[18,18,30,30,20]);
});
test('impact selection and finish boundaries match original CPU and all five source animation counts',()=>{
  assert.deepEqual(BATTLE_IMPACT_FAMILIES.map(e=>e.frameCount),oracle.impactAnimations.map(e=>e.frameCount));
  for(const c of oracle.impactSelections){
    const p=createBattleImpactEffects();p.spawn({owner:1,target:2,ownerSpeciesId:c.species,targetSpeciesId:c.species,secondary:c.secondary,point:{x:0,y:0,z:0}});
    const first=p.snapshot()[0];assert.equal(first.type,c.type);
    for(const sample of oracle.impactAnimations[c.type].checks){
      const current=p.snapshot()[0];
      assert.equal(Boolean(current),sample.frame<=first.frameCount);
      if(current)assert.equal(Number(current.frame>=first.frameCount),sample.finished);
      p.advance();
    }
  }
});
test('normal AI selection drives native movement, damage, impact expiry and clean match settlement',()=>{
  const r=createBattleRuntime({schedule:{entryMode:0,scheduleSlotA:2,scheduleSlotB:3,progressCounter:0}});
  r.chooseMatch(r.listMatches()[0].recordIndex);const s=r.startMatch(),initial=s.getView();
  let published=initial;
  s.subscribe(frame=>{published=frame;});
  let moving=false,nativePose=false,impact=false,releasedDuringBattle=false;
  for(let i=0;i<3000&&!s.getView().outcome.ended;i++){
    s.tick();const v=s.getView();
    moving ||= v.combatants.some((c,j)=>c.present&&Math.abs(c.stand.y-initial.combatants[j].stand.y)>.05);
    nativePose ||= v.combatants.some(c=>Number.isInteger(c.animationRequest?.sequenceRequestId));
    impact ||= v.impactEffects.length>0;
    assert.deepEqual(published.combatants.map(c=>c.hp?.current),v.combatants.map(c=>c.hp?.current), 'DOM subscribers receive HP changes on the damage frame');
    releasedDuringBattle ||= !v.outcome.ended&&v.nativeLifecycle.impacts.released>0;
    for(const x of [...v.nativeLifecycle.active,...v.nativeLifecycle.recent]){
      assert.equal(x.error,null);assert.deepEqual(x.needsObjectGraph,[]);assert.deepEqual(x.unresolvedHostCalls,[]);
    }
  }
  const v=s.getView();assert.equal(v.outcome.ended,true);assert.equal(v.outcome.reason,'TEAM_DOWN');
  assert.ok(moving);assert.ok(nativePose);assert.ok(impact);assert.ok(releasedDuringBattle);
  assert.ok(v.nativeLifecycle.recent.some(x=>x.phase==='DONE'));
  assert.deepEqual(v.nativeLifecycle.active,[]);assert.deepEqual(v.impactEffects,[]);
  assert.equal(v.nativeLifecycle.impacts.created,v.nativeLifecycle.impacts.released);
  const before=JSON.stringify(v);s.tick();assert.equal(JSON.stringify(s.getView()),before);
  assert.equal(r.getSettlementResult().ended,true);r.dispose();
});
