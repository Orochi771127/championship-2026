import test from 'node:test';
import assert from 'node:assert/strict';
import oracle from '../docs/research/BATTLE_NORMAL_FLOW_CPU_2026-09-07.json' with {type:'json'};
import {releaseBattleLaunchOwner} from '../src/championship/battle/battleNativeLaunch.js';
import {callBattleNative} from '../src/championship/battle/battleScriptNatives.js';
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createBattleHitRuntime} from '../src/championship/battle/battleHitRuntime.js';
import {createSessionCombatant} from '../src/championship/battle/battleSession.js';
import {selectNormalBattleTarget,stepNormalBattlePosition,stepNormalBattleApproach,
  normalBattleStands,normalBattleSpeedScalar,normalBattleLaunchGuard,updateNormalBattleGeometry,
  moveNormalBattleNotification,updateNormalBattleNotification,stepNormalBattleLaunch,updateNormalBattleTeam} from '../src/championship/battle/battleNormalFlow.js';

test('R9 original CPU lock acquisition, owner-specific release and first matching launch-slot cleanup',()=>{
 for(const {input:v,result} of oracle.locks){
  const values=new Map([[0x154,v.lock],...v.slots.map((x,i)=>[0x78+i*4,x])]);
  const unused=()=>{throw new Error('unexpected host call');};
  const host={readU32:(o,k)=>values.get(k)??0,writeU32:(o,k,x)=>values.set(k,x),readU8:unused,writeU8:unused,call:unused,yield:unused};
  if(v.routine===0x21156bc)releaseBattleLaunchOwner(host,0x2300000,v.object);
  else assert.equal(callBattleNative(v.routine,[0x2300000,v.object],host),result.return);
  assert.equal(values.get(0x154),result.lock);assert.deepEqual(v.slots.map((x,i)=>values.get(0x78+i*4)),result.slots);
 }
});

test('R9 original CPU persistent team support-selection counters and health thresholds',()=>{
 for(const v of oracle.teamCounters){const t=structuredClone(v.before);updateNormalBattleTeam(t,v.members);assert.deepEqual(t,v.result);}
});

test('R9 original CPU support writer reaches existing heal, clear, positive slots and ignores dead recipients',()=>{
 const c=createSessionCombatant({speciesId:81});
 const session={slots:[c,null,null,null,null,null],rng:{next:()=>0},downed:[0,0],clock:0,frame:0};
 const actors=createBattleNativeActors({slots:session.slots,stands:normalBattleStands(session.slots)});
 const runtime=createBattleHitRuntime({session,actors});
 for(const {input:v,result} of oracle.support){
  Object.assign(c,{currentHp:v.hp,maxHp:v.maxHp,statusCode:7,statusRemaining:900,field160:2,field164:600,state:3,field17C:1});
  runtime.support(0,v);assert.equal(c.currentHp,result.hp,JSON.stringify(v));
  const clear=result.calls.some(x=>x[0]==='clear'),positive=result.calls.find(x=>x[0]==='positive');
  assert.equal(c.statusCode,clear?0:7);assert.equal(c.statusRemaining,clear?0:900);
  assert.equal(c.field160,positive?.[1]??2);assert.equal(c.field164,positive?900:600);
 }
});

test('R9 original CPU target picker: all 13 selectors and mismatched random eligibility indices',()=>{
  for(const v of oracle.targets){
    let calls=0;const entries=v.entries.map(e=>({...Object.fromEntries(Object.entries(e.c).map(([k,x])=>[k==='17c'?'field17C':k==='9a'?'flags9A':`field${k.toUpperCase()}`,x])),
      currentHp:e.stats['50'],metricLimit:e.stats['54'],maxHp:e.stats['58'],metricBase:e.stats['5c'],stat84:e.stats['84'],stat88:e.stats['88']}));
    assert.equal(selectNormalBattleTarget(entries,v.selector,{next:()=>{calls++;return v.rolls[0];}}),v.result,JSON.stringify(v));
    assert.equal(calls,v.rollsConsumed);
  }
});

const names={'28':'field28','3c':'field3C','40':'field40','44':'field44','48':'field48','4c':'field4C','50':'field50',
 '168':'state','16c':'stateCounter','170':'statePeriod','17c':'field17C','180':'field180','154':'field154','1c':'field1C','158':'statusCode','160':'field160'};
function scalar(v){return {...Object.fromEntries(Object.values(names).map(n=>[n,0])),currentHp:100,field28:10,statePeriod:1,field17C:1,
 ...Object.fromEntries(Object.entries(v.c).map(([k,x])=>[names[k],x]))};}
function snap(c,result,calls=[],rolls=[]){return {c:Object.fromEntries(Object.keys(result.c).map(k=>[k,c[names[k]]])),calls,rolls};}
test('R9 original CPU ordinary notification entries and long-run decay',()=>{
 for(const {input:v,result,actor440} of oracle.notifications){
  const c=scalar(v),calls=[];let flag=0;
  updateNormalBattleNotification(c,{walk:()=>v.walk,run:()=>v.run,sequence:n=>calls.push(['sequence',n]),writeActor:(o,x)=>{assert.equal(o,0x440);flag=x;}});
  assert.deepEqual(snap(c,result,calls),result,JSON.stringify(v));assert.equal(flag,actor440);
 }
});
test('R9 original CPU common movement and decaying launch impulse',()=>{
 for(const {input:v,result,point} of oracle.movement){
  const c=scalar(v),h={point:[200*4096,150*4096,0],walk:()=>v.walk,writeActor:()=>{}};
  moveNormalBattleNotification(c,h);assert.deepEqual(snap(c,result),result,JSON.stringify(v));assert.deepEqual(h.point,point);
 }
});
test('R9 original CPU six-actor world distance/angle matrix and contact separation',()=>{
 for(const v of oracle.geometry){const points=structuredClone(v.points),g=updateNormalBattleGeometry(points,v.skipSeparation);
  assert.deepEqual(g,{distances:v.distances,angles:v.angles});assert.deepEqual(points,v.resultPoints);}
});
test('R9 original CPU launch 14/15/16 controlled allocation, refusal, notify and completion counters',()=>{
 for(const {input:v,result,tally,slots,objectActive} of oracle.launches){
  const c=scalar(v),calls=[],launchSlots=['78','7c','80'].map(k=>v.c[k]);let active=true;
  const h={launchSlots,globalAbort:v.globalAbort,angle:v.angle,move:{field10:v.moveField10},
   allocate:i=>{calls.push(['allocate']);const a=v.allocated?{}:0;launchSlots[i]=a;return a;},
   initialize:()=>{calls.push(['initialize']);return v.initialized;},release:i=>{launchSlots[i]=0;active=false;},
   notify:n=>{calls.push(['notify',n]);c.field17C=n;c.field180=-255;},face:()=>{},finished:()=>v.finished};
  stepNormalBattleLaunch(c,h);
  assert.deepEqual(snap(c,result,calls),result,JSON.stringify(v));assert.equal(c.field1C,tally);assert.deepEqual(launchSlots.map(Boolean),slots);assert.equal(active,objectActive);
 }
});
test('R9 original CPU states 3/4/5: distance, angle boundaries, movement choices and launch transition',()=>{
  const names={'28':'field28','3c':'field3C','40':'field40','44':'field44','48':'field48','4c':'field4C','50':'field50',
    '168':'state','16c':'stateCounter','170':'statePeriod','17c':'field17C','180':'field180'};
  for(const {input:v,result} of oracle.positions){
    const c={...Object.fromEntries(Object.values(names).map(k=>[k,0])),field28:10,statePeriod:1,field17C:1,field184:50*4096,field188:30*4096};
    for(const [k,x] of Object.entries(v.c))if(names[k])c[names[k]]=x;
    const calls=[],rolls=[];let idx=0;
    const h={point:v.point,targetPoint:v.targetPoint,target:{field17C:1,flags9A:0},angle:v.angle,distance:v.distance,
      rng:{next:channel=>{rolls.push(channel);return v.rolls[idx++%v.rolls.length];}},launchSlots:['78','7c','80'].map(k=>v.c[k]),
      notify:n=>{c.field17C=n;c.field180=-255;calls.push(['notify',n]);},gate:()=>calls.push(['gate'])};
    (v.state===3?stepNormalBattlePosition:stepNormalBattleApproach)(c,h);
    assert.deepEqual({c:Object.fromEntries(Object.entries(names).map(([k,n])=>[k,c[n]])),calls,rolls},result,JSON.stringify(v));
  }
});
test('R9 original CPU C144 guard order and debit: locks, busy object, absent/dead target and exact-cost equality',()=>{
  for(const {input:v,...result} of oracle.guards){
    const got=normalBattleLaunchGuard({owner:{field154:v.lock,metricLimit:v.resource},move:{actionCost:v.cost},
      globalLock:v.globalLock,objectFlags:v.busy,target:v.targetHp===null?null:{currentHp:v.targetHp}});
    assert.deepEqual({accepted:got.accepted,resourceAfter:got.resourceAfter??v.resource,moveAssigned:got.moveAssigned},result,JSON.stringify(v));
  }
});
test('R9 original CPU one/two/three-member placement table and original speed RNG consumption',()=>{
  for(const v of oracle.placement){
    const got=normalBattleStands(Array.from({length:6},(_,i)=>i%3<v.count?{}:null));
    assert.deepEqual(got.map(s=>s?[Math.round(s.x*416*4096),Math.round(s.y*272*4096)+800*4096,0]:null),v.points);
  }
  for(const v of oracle.speeds){let calls=0;const actual=normalBattleSpeedScalar({next:()=>++calls===1?17:v.roll});assert.equal(actual,v.value);assert.equal(calls,v.rollsConsumed);}
});
