import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../docs/research/BATTLE_HIT_RECOVERY_CPU_2026-09-07.json' with {type:'json'};
import { getBattleCatalogRecord } from '../src/championship/battle/battleCatalogs.js';
import { applyBattleHitResult,updateBattleHitReaction,updateBattleRecovery,notifyBattleHitState,
  battleHitEligible } from '../src/championship/battle/battleHitState.js';

const fields={'22':'field22','3c':'field3C','40':'field40','44':'field44','4c':'field4C','50':'field50',
 '84':'field84','88':'field88','8c':'field8C','90':'field90','98':'field98','9a':'flags9A',
 '158':'statusCode','15c':'statusRemaining','160':'field160','164':'field164',
 '168':'state','16c':'stateCounter','170':'statePeriod','17c':'field17C','180':'field180'};
function fixture(v){
  const c=Object.fromEntries(Object.values(fields).map(k=>[k,0]));
  Object.assign(c,{field98:2,state:3,statePeriod:1,field17C:15,currentHp:v.hp??100,maxHp:v.maxHp??1000,metricLimit:100});
  for(const [k,n] of Object.entries(v.c??{}))c[fields[k]]=n;
  const a=new Map(Object.entries(v.a??{}).map(([k,n])=>[parseInt(k,16),n]));
  a.set(0x2c,v.z??0);let downed=v.downed??0;
  const calls=[],rolls=[],point=[200*4096,150*4096,v.z??0];
  const h={point,calls,rolls,
    readActor:o=>a.get(o)??0,writeActor:(o,n)=>a.set(o,n|0),
    sequence:n=>calls.push(['sequence',n]),rotate:(s,cos)=>{a.set(0xc,s);a.set(0x10,cos);},
    height:()=>v.height??48,finished:()=>v.finished??0,
    rng:{next(channel){rolls.push(channel);return v.roll??52;}},
    recoveryMove:()=>v.recoveryMove??0,moveCost:id=>getBattleCatalogRecord('moves',id).actionCost,
    ending:()=>v.ending??0,downed:()=>downed,teamCount:()=>v.teamCount??3,
    finalDown:()=>calls.push(['downCount',++downed]),
    snapshot(expected){return {c:Object.fromEntries(Object.entries(fields).map(([o,k])=>[o,c[k]])),
      a:Object.fromEntries(Object.keys(expected.a).map(o=>[o,a.get(parseInt(o,16))??0])),
      point:[...point],hp:c.currentHp,resource:c.metricLimit,downed,calls:[...calls],rolls:[...rolls]};}
  };
  return {c,h};
}
test('R8 original CPU hit-result writers: native-kind override, HP-zero, blocked and repeated hits',()=>{
  for(const {input:v,result} of receipt.writers){
    const {c,h}=fixture(v);
    applyBattleHitResult({c,h,move:{field14:v.hitKind,kind:v.kind??0,statusCode:v.status??0},damage:v.damage,
      blocked:v.blocked??false,sourcePoint:[100*4096,150*4096,0],rng:h.rng,
      statusInputs:{attackerIndex:v.attackerIndex??8,selectedDefenseIndex:v.defenderIndex??6,defenseIndex0x9C:6,defenseIndex0xA0:6,defenseIndex0xA4:6}});
    assert.deepEqual(h.snapshot(result),result,JSON.stringify(v));
  }
});
test('R8 original CPU reaction timelines: raw height, falling, spin, sequence-finish and recovery notification',()=>{
  for(const {input,frames} of receipt.reactions){
    const {c,h}=fixture(input);
    for(let i=0;i<frames.length;i++){
      h.calls.length=0;updateBattleHitReaction(c,h);
      assert.deepEqual(h.snapshot(frames[i]),frames[i],JSON.stringify({input,i}));
      if(c.field17C!==15)break;c.field180++;
    }
  }
});
test('R8 original CPU landing and status boundaries',()=>{
  for(const {input,result} of receipt.boundaries){const {c,h}=fixture(input);updateBattleHitReaction(c,h);
    assert.deepEqual(h.snapshot(result),result,JSON.stringify(input));}
});
test('R8 original CPU down/recovery conditions, exact counters, resource and HP restoration',()=>{
  for(const {input,result} of receipt.recovery){const {c,h}=fixture(input);updateBattleRecovery(c,h);
    assert.deepEqual(h.snapshot(result),result,JSON.stringify(input));}
});
test('reaction is not defeat; guards refuse airborne repeats and recovery before consuming RNG',()=>{
  const {c,h}=fixture({hp:100,c:{'84':1,'168':23}});
  assert.equal(battleHitEligible(c,0),true);c.field84=3;assert.equal(battleHitEligible(c,0),false);
  c.field84=1;for(const n of [18,19,20,21]){c.field17C=n;assert.equal(battleHitEligible(c,0),false);}
  c.field17C=15;notifyBattleHitState(c,1,h);assert.equal(c.field84,0);assert.equal(c.field180,-255);
});
