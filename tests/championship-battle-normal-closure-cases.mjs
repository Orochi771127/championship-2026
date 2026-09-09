import test from 'node:test';
import assert from 'node:assert/strict';
import oracle from '../docs/research/BATTLE_NORMAL_CLOSURE_CPU_2026-09-08.json' with {type:'json'};
import {BATTLE_WORLD_FLAGS,selectBattlePursuitTarget,stepBattlePursuit,finishBattleTargetedAction,normalBattleStands} from '../src/championship/battle/battleNormalFlow.js';
import {createBattleNormalRuntime} from '../src/championship/battle/battleNormalRuntime.js';
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createBattleHitRuntime} from '../src/championship/battle/battleHitRuntime.js';
import {createSessionCombatant} from '../src/championship/battle/battleSession.js';
import {buildMoveBucketsForSpecies} from '../src/championship/battle/battleMoveBuckets.js';

test('R9 closure CPU: closest packed opponent, ties, suspend flags and distance sentinel',()=>{
 for(const {input:v,index} of oracle.nearest)assert.equal(selectBattlePursuitTarget(v.flags.map(flags9A=>({flags9A})),v.distances),index);
});
test('R9 closure CPU: state8 entry, interrupted target, offset approach, timer gate and launch14',()=>{
 const fields={'24':'field24','28':'field28','3c':'field3C','40':'field40','44':'field44','48':'field48','4c':'field4C','50':'field50',
  '168':'state','16c':'stateCounter','170':'statePeriod','17c':'field17C','180':'field180'};
 for(const {input:v,result,move,target} of oracle.pursuit){
  const c={...Object.fromEntries(Object.values(fields).map(k=>[k,0])),field28:10,statePeriod:1,field17C:1};
  for(const [k,x] of Object.entries(v.c))if(fields[k])c[fields[k]]=x;
  const calls=[],rolls=[];let currentMove=0x2312000,currentTarget=v.target;
  const notify=n=>{c.field17C=n;c.field180=-255;calls.push(['notify',0,n]);};
  let entryAborted=false;
  if(c.stateCounter===0){
   if(!currentTarget){c.state=11;c.stateCounter=-255;entryAborted=true;}
   else{rolls.push(216);currentMove=101+v.rolls[0]%3;notify(7);}
  }
  if(!entryAborted)stepBattlePursuit(c,{target:currentTarget?{flags9A:v.flags,field17C:v.notify}:null,
   point:v.point,targetPoint:v.targetPoint,angle:v.angle,distance:v.distance,launchSlots:['78','7c','80'].map(k=>v.c[k]),
   notify,gate:()=>calls.push(['gate'])});
  assert.deepEqual({c:Object.fromEntries(Object.keys(result.c).map(k=>[k,c[fields[k]]])),calls,rolls},result,JSON.stringify(v));
  assert.equal(currentMove,move);assert.equal(currentTarget,target);
 }
});
test('R9 closure CPU: targeted action1 follow-up writes each eligible opponent and notifies OWNER',()=>{
 for(const {input:v,calls:expected,rolls:expectedRolls,members:expectedMembers} of oracle.followup){
  const members=v.members.map(x=>({currentHp:x.hp,flags9A:x.flags,field17C:x.notify,state:0,stateCounter:0,owner:false,move:0x2312000}));
  const calls=[],rolls=[];let ri=0;
  finishBattleTargetedAction(v.moveId,members,{
   status:(i,code)=>{calls.push(['status',i+1,code]);members[i].state=8;members[i].stateCounter=-255;},
   targetOwner:i=>{members[i].owner=true;},
   chooseOrdinary:i=>{rolls.push(216);members[i].move=100+i*10+v.rolls[ri++%v.rolls.length]%v.members[i].count;},
   notifyOwner:n=>calls.push(['notify',0,n])});
  assert.deepEqual(calls,expected);assert.deepEqual(rolls,expectedRolls);
  assert.deepEqual(members.map(c=>({state:c.state,counter:c.stateCounter,owner:c.owner,move:c.move})),expectedMembers);
 }
});
test('R9 closure CPU: world flags preserve other bits through constructor, frame and knockout',()=>{
 for(const v of oracle.flags){assert.equal(BATTLE_WORLD_FLAGS.initial(v.old),v.initial);
  assert.equal(BATTLE_WORLD_FLAGS.frame(v.old,v.occupied!==null),v.frame);assert.equal(BATTLE_WORLD_FLAGS.knockout(v.frame),v.knockout);}
});

function fixture(){
 const slots=[0,1,2,3,4,5].map(()=>createSessionCombatant({speciesId:81,currentHp:100,maxHp:100,metricLimit:100}));
 const session={slots,rng:{next:()=>17},downed:[0,0],frame:0,clock:0};
 const actors=createBattleNativeActors({slots,stands:normalBattleStands(slots)}),hit=createBattleHitRuntime({session,actors});
 session.notify=hit.notify;
 session.normalFlow=createBattleNormalRuntime({session,actors,creatures:[],initialize:()=>true,applyStatus:hit.status});
 return {session,actors,hit,flow:session.normalFlow};
}
test('R9 closure CPU: status1 action gate uses the actual +24 timer and unbuffed speed cooldown',()=>{
 const {session,flow}=fixture(),c=session.slots[0];
 for(const {input:v,...expected} of oracle.gates){
  Object.assign(c,{statusCode:1,field24:v.timer,speedIndex:v.speed,field160:3,field28:10,field184:204800,field188:122880});
  assert.equal(flow.statusGate(0),true);
  assert.deepEqual({state:c.state,cooldown:c.field28,primary:c.field184,secondary:c.field188},expected);
 }
});
test('R9 closure integrated status1 animator, pursuit selection and targeted follow-up share existing actors',()=>{
 const {session,actors,hit,flow}=fixture(),m=actors.memory,c=session.slots[0];
 hit.status(0,1);assert.equal(c.state,8);assert.equal(m.readU32(actors.actorOf(0),0x6cc),6);
 c.stateCounter=0;flow.stepState(0,()=>{});
 assert.ok(flow.snapshot().history.some(e=>e.type==='PURSUIT_MOVE_SELECTED'));
 const ordinary=buildMoveBucketsForSpecies(81).buckets[4];assert.equal(c.pendingDecision.action.actionId,ordinary[17%ordinary.length].actionId);
 hit.step(0);assert.equal(actors.project(0).animationRequest.sequenceId,3,'pursuit notification7 uses original run sequence');
 Object.assign(c,{state:16,stateCounter:2,pendingDecision:{actionId:1}});
 actors.requestSequence(0,35,'CONTROLLED_FOLLOWUP_TEST');for(let i=0;i<200;i++)actors.advance();
 session.slots[4].flags9A=2;session.slots[5].currentHp=0;
 flow.stepState(0,()=>{});
 const opponent=session.slots[3];assert.equal(opponent.statusCode,1);assert.equal(opponent.state,8);assert.equal(opponent.stateCounter,1);
 assert.equal(m.readU32(actors.address(3),0x5c),actors.address(0));
 assert.equal(opponent.pendingTargetSlot,0);assert.equal(c.field17C,7);
 assert.equal(session.slots[4].statusCode,0);assert.equal(session.slots[5].statusCode,0);
 assert.ok(flow.snapshot().history.some(e=>e.type==='TARGETED_FOLLOWUP'));
});
test('R9 closure integrated HP-zero abort rejects new launches and releases allocated slots',()=>{
 const {session,actors,hit,flow}=fixture(),m=actors.memory,c=session.slots[0];
 session.slots[1].currentHp=session.slots[2].currentHp=0;
 flow.beforeFrame();assert.equal(actors.worldFlags(),1);
 hit.apply(0,{move:{kind:0,field14:0,statusCode:0},damage:100,sourcePoint:[0,0,0]});
 assert.equal(actors.worldFlags(),3,'last HP-zero preserves bit0 and sets bit1');
 session.slots[3].field94=1;flow.beforeFrame();assert.equal(actors.worldFlags(),2);
 session.slots[3].field94=0;flow.beforeFrame();assert.equal(actors.worldFlags(),3);
 let initialized=0,released=0;session.allocateAction=()=>({index:0,release:()=>released++});
 const adapter=createBattleNormalRuntime({session,actors,creatures:[],initialize:()=>{initialized++;return true;},applyStatus:hit.status});
 Object.assign(c,{state:14,stateCounter:0,pendingDecision:{actionId:179},field17C:1,field180:0});
 m.writeU32(actors.address(0),0x5c,actors.address(3));adapter.stepState(0,()=>{});
 assert.equal(initialized,0);assert.equal(released,1);assert.equal(c.state,1);assert.ok(c.launchSlots.every(x=>!x));
 assert.equal(m.readU32(actors.address(0),0x78),0);
});
