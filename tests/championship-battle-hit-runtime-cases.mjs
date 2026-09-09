import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createBattleHitRuntime} from '../src/championship/battle/battleHitRuntime.js';
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createSessionCombatant} from '../src/championship/battle/battleSession.js';
import {battleStandPosition} from '../src/championship/app/battlePresentationSource.js';
import {damageInputsFor} from '../src/championship/battle/battleDamageInputs.js';
import {BATTLE_FRAME_COMBATANT_FIELDS,stepFrameSlot} from '../src/championship/battle/battleFrameLoop.js';
import oracle from '../docs/research/BATTLE_HIT_RECOVERY_CPU_2026-09-07.json' with {type:'json'};

test('status thresholds receive unclamped levels while the damage curve receives 26',()=>{
  const input=damageInputsFor({attacker:{attackerLevel:26,buffCode:1},
    defender:{currentHp:100,levels:{0x88:26},buffCode:2},action:{power:100,elementSelector:0}});
  assert.equal(input.attackerIndex,26);assert.equal(input.defenderIndex,26);
  assert.equal(input.statusAttackerIndex,27);assert.equal(input.statusDefenderIndex,27);
});

test('original CPU status-tick branch: due ticks, exact zero, state/notification exit, world height and icon cleanup',()=>{
  const c=createSessionCombatant({speciesId:81});
  const session={slots:[c,null,null,null,null,null],rng:{next:()=>0},downed:[0,0],clock:0,frame:0};
  const actors=createBattleNativeActors({slots:session.slots,stands:session.slots.map((_,i)=>battleStandPosition(i))});
  const adapter=createBattleHitRuntime({session,actors}),m=actors.memory,actor=actors.actorOf(0),world=m.readU32(actors.address(0),0x2c);
  for(const {input:v,result} of oracle.dot){
    Object.assign(c,{currentHp:v.hp,maxHp:v.maxHp,statusCode:v.c['158'],statusRemaining:v.c['15c'],
      field17C:9,field180:0,state:3,stateCounter:0,field3C:123,field22:0,field18:0,field160:2,field164:50});
    m.writeU32(world,8,v.z);m.writeU32(actor,0x6cc,17);
    const before=Object.fromEntries(BATTLE_FRAME_COMBATANT_FIELDS.map(k=>[k,c[k]]));
    const ticked=stepFrameSlot(before);Object.assign(c,ticked.combatant);adapter.frameEvents(0,ticked.events,before);
    const snapshot={hp:c.currentHp,z:m.readU32(world,8)|0,icon:m.readU32(actor,0x6cc)|0,
      c:{'3c':c.field3C,'158':c.statusCode,'15c':c.statusRemaining,'168':c.state,'16c':c.stateCounter,'17c':c.field17C,'180':c.field180}};
    assert.deepEqual(snapshot,result,JSON.stringify(v));
    assert.equal(c.field160,2,'DoT does not clear the positive slot');assert.equal(c.field164,49);
  }
});

// R9 restores the two native speed initializations and normal approach timing.
// R10 restores projectile hits and the native bank selector. The changed hit
// and RNG path changed again in R13 when genuine NCER boxes replaced alpha
// bounds and the original special lock now lasts through action disposal.
// Final-source seeds20/30 retain both revival sides and resumed-action requirements.
for(const [seed,expectedSlot] of [[20,3],[30,0]])test(`normal AI seed ${seed}: hit interruption, landing, recovery and final down`,()=>{
  const r=createBattleRuntime({schedule:{entryMode:0,scheduleSlotA:2,scheduleSlotB:6,progressCounter:4},seed});
  r.chooseMatch(r.listMatches()[0].recordIndex);const source=r.startMatch();
  const history=new Map();let restore=null,ready=null,previous=source.getView(),liveHit=false,recoveryPose=false;
  let resumed=false;
  for(let i=0;i<10000&&!source.getView().outcome.ended;i++){
    source.tick();const v=source.getView();
    for(const e of v.nativeLifecycle.reactions.history){history.set(JSON.stringify(e),e);
      if(e.type==='NOTIFICATION_CHANGED'&&e.from===20&&e.to===1)ready=e;}
    for(const [slot,c] of v.nativeLifecycle.reactions.combatants.entries()){
      if(!c)continue;const actor=v.combatants[slot];
      if(c.notification===15&&c.hp>0){liveHit=true;assert.equal(actor.down,false);}
      if(c.notification===20&&c.hp>previous.combatants[slot].hp.current){restore={slot,hp:c.hp,max:actor.hp.maximum};
        assert.equal(c.hp,Math.trunc(actor.hp.maximum*.05));assert.equal(actor.animationRequest.sequenceId,33);}
      if(c.notification===20&&actor.animationRequest.sequenceId===33)recoveryPose=true;
    }
    if(ready&&v.nativeLifecycle.active.some(a=>a.ownerSlot===ready.slot))resumed=true;
    previous=v;
  }
  const events=[...history.values()],final=source.getView();
  assert.ok(liveHit);assert.ok(restore);assert.ok(recoveryPose);
  assert.equal(restore.slot,expectedSlot);
  assert.ok(events.some(e=>e.type==='ACTION_INTERRUPTED'));assert.ok(events.some(e=>e.type==='LANDED'));
  const dead=events.filter(e=>e.type==='FINAL_DOWN');assert.ok(dead.length);
  assert.equal(new Set(dead.map(e=>e.slot)).size,dead.length,'count each permanently defeated slot once');
  assert.ok(ready);assert.ok(resumed,'the restored actor re-enters normal selection and launches an action');
  assert.equal(final.outcome.ended,true);assert.equal(final.nativeLifecycle.active.length,0);
  assert.equal(final.nativeLifecycle.impacts.active,0);assert.equal(final.nativeLifecycle.impacts.created,final.nativeLifecycle.impacts.released);
  const frozen=JSON.stringify(final);source.tick();assert.equal(JSON.stringify(source.getView()),frozen);r.dispose();
});

test('runtime ending cancels pending notification20 before recovery HP/resource writes',()=>{
 const c=createSessionCombatant({speciesId:81,currentHp:0,maxHp:1000,field17C:20,field180:0});
 const ally=createSessionCombatant({speciesId:81,currentHp:1,maxHp:1000,field17C:1});
 const enemy=createSessionCombatant({speciesId:81,currentHp:100,maxHp:1000,field17C:1});
 const session={slots:[c,ally,null,enemy,null,null],rng:{next:()=>0},downed:[0,0],clock:0,frame:0};
 const actors=createBattleNativeActors({slots:session.slots,stands:session.slots.map((_,i)=>battleStandPosition(i))});
 const runtime=createBattleHitRuntime({session,actors}),resource=c.metricLimit;
 runtime.apply(1,{move:{kind:0,field14:0,statusCode:0},damage:100,blocked:false,sourcePoint:[100*4096,150*4096,0]});
 assert.equal(runtime.snapshot().battleEnding,true);runtime.step(0);
 assert.equal(c.field17C,21);assert.equal(c.currentHp,0);assert.equal(c.metricLimit,resource);
 assert.ok(runtime.snapshot().history.some(e=>e.type==='NOTIFICATION_CHANGED'&&e.from===20&&e.to===21));
});
