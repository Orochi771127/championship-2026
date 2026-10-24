import assert from 'node:assert/strict';
import test from 'node:test';
import {BATTLE_AI_OPENING_SKILL_TICKS,chooseBattleAiOpeningSkill} from '../src/championship/battle/battleAiAdaptation.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';
import {createBattleOpeningPhase} from '../src/championship/battle/battleOpeningPhase.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
const input = () => ({policy:'IMPROVED_V1',clock:300,launched:false,
 combatant:{currentHp:100,statusCode:0,pendingField24:0,metricLimit:10},
 buckets:{5:[{actionId:1,costField48:10},{actionId:2,costField48:11}],6:[]},rng:{next:()=>0}});
test('first opportunity is exactly five active seconds rounded to existing tick; cost equality legal',()=>{
 assert.equal(BATTLE_AI_OPENING_SKILL_TICKS,300);
 for(let clock=0;clock<300;clock++)assert.equal(chooseBattleAiOpeningSkill({...input(),clock}),null);
 const i=input(),before=structuredClone(i.combatant),d=chooseBattleAiOpeningSkill(i);
 assert.equal(d.action.actionId,1);assert.equal(d.state,5);assert.deepEqual(i.combatant,before);
});
test('original, already launched, no moves, insufficient energy, status and pending action remain untouched',()=>{
 for(const patch of [{policy:'ORIGINAL'},{launched:true},{buckets:{5:[],6:[]}},
  {combatant:{...input().combatant,metricLimit:0}}, {combatant:{...input().combatant,statusCode:1}},
  {combatant:{...input().combatant,pendingField24:1}}, {combatant:{...input().combatant,currentHp:0}}]){
  const i={...input(),...patch,rng:{next(){throw Error('must not consume RNG');}}};
  assert.equal(chooseBattleAiOpeningSkill(i),null);
 }
});
test('asset waits and READY/FIGHT do not spend opening combat ticks',()=>{
 const opening=createBattleOpeningPhase();opening.prepare();let clock=0;
 for(let i=0;i<1000;i++)if(opening.advance())clock++;
 assert.equal(clock,0);opening.ready();
 for(let i=0;i<147;i++)if(opening.advance())clock++;
 assert.equal(clock,0);assert.equal(opening.advance(),true);
});
const individual=(id,species)=>({instanceId:id,nativeProfile:structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(species),rng:{next:()=>5}})))});
function firstSkills(species,policy='IMPROVED_V1'){
 const runtime=createBattleRuntime({mode:5,battleType:0,seed:5,aiPolicy:policy,
 playerIndividuals:species.map((s,i)=>individual('A'+i,s)),opponentIndividuals:species.map((s,i)=>individual('B'+i,s))});
 runtime.choosePracticeBattle({arenaIndex:2});const source=runtime.startMatch();const found=new Map();
 for(let t=0;t<1600&&!source.getView().outcome.ended;t++){
  source.tick();for(const e of source.getView().nativeLifecycle.normalFlow.history){
   if(e.type!=='LAUNCHED'||found.has(e.slot)||getBattleCatalogRecord('moves',e.moveId)?.kind!==1)continue;
   assert.equal(e.resourceBefore-e.resourceAfter,getBattleCatalogRecord('moves',e.moveId).actionCost);
   assert.ok(e.targetSlot>=0);found.set(e.slot,e);
  }
  if(found.size===species.length*2)break;
 }
 runtime.dispose();return [...found.values()];
}
test('1v1 first legal skills ~5 seconds instead of reserve-tier delay (before-fails)',()=>{
 for(const species of [61,124,148,159,186]){
  const events=firstSkills([species]);assert.ok(events.length>0);
  const first=Math.min(...events.map(e=>e.clock));
  assert.ok(first>=300&&first<=370,`${species}: ${first}`);
 }
});
test('three-on-three both teams receive early skill opportunity without free cast',()=>{
 const events=firstSkills([124,148,159]);
 assert.ok(events.some(e=>e.slot<3&&e.clock>=300&&e.clock<600));
 assert.ok(events.some(e=>e.slot>=3&&e.clock>=300&&e.clock<600));
});
test('ORIGINAL runtime remains reserve-tier delayed',()=>{
 const events=firstSkills([124],'ORIGINAL');assert.ok(events.length>0);
 assert.ok(Math.min(...events.map(e=>e.clock))>=900);
});
