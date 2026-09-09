import test from 'node:test';import assert from 'node:assert/strict';
import oracle from '../docs/research/BATTLE_EFFECT_CPU_2026-09-08.json' with {type:'json'};
import profiles from '../src/data/championship/battleEffectProfiles.json' with {type:'json'};
import {battleNativeSegmentContact,battleNativeProjectileContact} from '../src/championship/battle/battleProjectileContact.js';
import {createBattleEffectActors,battleEffectBankDemand} from '../src/championship/battle/battleEffectActors.js';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {callBattleNative} from '../src/championship/battle/battleScriptNatives.js';
import {createBattleNativeMemory} from '../src/championship/battle/battleNativeMemory.js';
const box=([lowX,lowY,highX,highY])=>({lowX,lowY,highX,highY});
test('R10 native segment contact matches original signed products and degenerate edges',()=>{
 for(const v of oracle.segments)assert.equal(Number(battleNativeSegmentContact(...v.points)),v.result,JSON.stringify(v));
});
test('R10 original rotated projectile/target contact, native target inset and target height distinction',()=>{
 for(const v of oracle.contact)assert.equal(Number(battleNativeProjectileContact(box(v.a),v.p,v.sin,v.cos,box(v.b),v.q)),v.result,JSON.stringify(v));
});
function fixture(){const m=createBattleNativeMemory(),pool=createBattleEffectActors({memory:m,worldAddress:0x20000000,loadedBankIds:[7]});
 const index=a=>(a-(pool.base+0x394))/0xd4;
 const snap=()=>{const count=m.readU32(pool.base,0x1b594),live=Array.from({length:count},(_,i)=>m.readU32(pool.base,0x1a614+i*4));
  return {live:live.map(index),free:m.readU32(pool.base,0x1b598),modes:live.map(a=>m.readU32(pool.base,0x19e54+index(a)*4))};};return {m,pool,index,snap};}
test('R10 original 496-slot LIFO allocation, missing banks, sequence selectors and modes',()=>{
 for(const v of oracle.allocations){const {pool,index,snap}=fixture(),a=pool.allocate(v.encoded,v.mode);
  assert.equal(a?index(a):null,v.index);assert.deepEqual(snap(),v.snapshot);}
});
test('R10 original pool exhaustion, swap-last release, duplicate release and reuse',()=>{
 const {pool,index,snap}=fixture(),allocated=Array.from({length:498},(_,i)=>pool.allocate(0x701,i%4));
 assert.equal(allocated.filter(Boolean).length,oracle.exhaustion.allocated);assert.deepEqual(snap(),oracle.exhaustion.snapshot);
 for(const r of oracle.releases){pool.release(allocated[495-r.index]);assert.deepEqual(snap(),r.snapshot);}
 const again=pool.allocate(0x701,1);assert.equal(index(again),0);pool.clear();assert.equal(pool.diagnostics().active,0);assert.equal(pool.diagnostics().free,496);
});

test('R10 releasing a live handle preserves its native animator until that slot is reused',()=>{
 const {m,pool}=fixture(),a=pool.allocate(0x701,1);pool.call(0x02047904,[a,1]);
 m.writeU8(a,0x5b,0);pool.advance();assert.equal(pool.diagnostics().active,0);assert.deepEqual(pool.snapshot(),[]);
 assert.equal(pool.call(0x02047904,[a,0]),1);assert.equal(pool.call(0x02047c48,[a]),0);
 assert.equal(pool.call(0x0211ad9c,[pool.base,a]),7);
 assert.equal(pool.allocate(0x702,1),a);assert.equal(pool.diagnostics().active,1);
});
test('R10 original pool sweep recycles inactive/finished actors and advances only mode0',()=>{
 const {m,pool,index,snap}=fixture(),a=Array.from({length:8},(_,i)=>pool.allocate(0x701,i%4));
 m.writeU8(a[2],0x5b,0);
 // Same animator service seam as the CPU fixture: only the first actor done.
 const once=profiles.banks[6].sequences.find(s=>s.playbackMode===1);
 assert.ok(once);pool.call(0x02047904,[a[0],once.id]);for(let i=0;i<300;i++)pool.call(0x02047a08,[a[0],4096]);
 assert.equal(pool.call(0x02047c48,[a[0]]),1);
 const before=Object.fromEntries(a.map(x=>[x,pool.call(0x02047c5c,[x])])),moving=a[4];m.writeU32(moving,0x3c,4096);
 pool.advance();assert.deepEqual(snap(),oracle.update.snapshot);assert.equal(m.readU32(moving,0x24),4096);
 assert.equal(pool.call(0x02047c5c,[a[1]]),before[a[1]]);assert.equal(pool.call(0x02047c5c,[a[3]]),before[a[3]]);
 assert.deepEqual(oracle.update.calls.filter(x=>x[0]==='physics').map(x=>x[1]),[index(moving)]);
});

test('R10 bank demand executes the original move-field and special-script increments',()=>{
 for(const v of oracle.demands)assert.deepEqual(battleEffectBankDemand([v.ids.map(i=>getBattleCatalogRecord('moves',i))]),v.demand);
});
test('R10 D2E0 to AD9C resolves the bank through the owning world and returns its original packed selector',()=>{
 for(const v of oracle.bankLookups){const m=createBattleNativeMemory(),pool=createBattleEffectActors({memory:m,worldAddress:0x20000000,loadedBankIds:[v.id]});
  m.writeU32(0x02131c40,0,0x20000000);const a=v.id?pool.allocate((v.id<<8)|1,1):0;
  const host={...m,call:(routine,...args)=>pool.call(routine,args),yield(){}};
  assert.equal(callBattleNative(0x0211d2e0,[a],host)>>>0,v.result);
 }
});
test('R10 signed acceleration and nonunit steps match original 0204819C',()=>{
 const {m,pool}=fixture(),actor=pool.allocate(0x701,1);
 for(const v of oracle.physics){[0x24,0x28,0x2c,0x3c,0x40,0x44,0x48,0x4c,0x50].forEach((o,i)=>m.writeU32(actor,o,v.values[i]));
  pool.call(0x0204819c,[actor,v.delta]);assert.deepEqual([0x24,0x28,0x2c,0x3c,0x40,0x44].map(o=>m.readU32(actor,o)|0),v.after);
 }
});
test('R10 giant-missile zero-tick frame follows original animator at fractional and multi-frame steps',()=>{
 for(const v of oracle.zeroTickPlayers){const s=profiles.banks[134].sequences[2];assert.deepEqual(s.frames.map(f=>f.ticks),v.durations);
  const t=createNativeCharacterAnimationTimeline({...s,frames:s.frames.map(f=>({...f,texture:`cell${f.cell}`}))},{allowZeroTicks:true});
  for(const expected of v.samples){t.advanceNative(v.delta);const actual=t.getSnapshot();
   for(const k of ['frameIndex','elapsedQ12','active'])assert.equal(actual[k],expected[k],k);
  }
 }
});
test('R10 all 151 numeric banks initialize their sequence and preserve original transformed cell geometry',()=>{
 const m=createBattleNativeMemory(),pool=createBattleEffectActors({memory:m,worldAddress:0x20000000,loadedBankIds:profiles.banks.map(b=>b.id)});
 let sequences=0;
 for(const bank of profiles.banks)for(const s of bank.sequences){const a=pool.allocate((bank.id<<8)|(s.id+1),1);assert.ok(a);
  const expected=bank.boxes[s.frames[s.loopStartFrame].cell];assert.deepEqual(pool.box(a),{highX:expected[0],highY:expected[1],lowX:expected[2],lowY:expected[3]});
  for(let frame=0;frame<5;frame++)pool.call(0x02047a08,[a,4096]);
  pool.release(a);sequences++;
 }
 assert.equal(sequences,484);assert.equal(pool.diagnostics().created,pool.diagnostics().released);
});
