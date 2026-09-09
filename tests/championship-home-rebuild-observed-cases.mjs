import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';
import {createNativeRaisingGround,nativeRaisingEntryPosition,nativeRaisingSpawnPosition} from '../src/championship/raising/nativeRaisingGround.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,notifyNativeRaisingResidentAdded,startNativeRaisingMorning} from '../src/championship/raising/nativeRaisingActor.js';
import {settleNativeRaisingCage} from '../src/championship/raising/nativeRaisingOvernight.js';
import {nativeRaisingRebuiltListOrder} from '../src/championship/raising/nativeRaisingHomeState.js';
import {allocateNativeRaisingWaste} from '../src/championship/raising/nativeRaisingWaste.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
const evidence=JSON.parse(readFileSync(new URL('../docs/research/RAISING_HOME_REBUILD_OBSERVED_2026-09-09.json',import.meta.url)));

test('the observed original two-resident Home rebuild matches positions, all profile fields and the complete 31-draw sequence',()=>{
  const {before,constructed,overnight,morning}=evidence.stages,definitions=listCageDefinitions();
  const ground=createNativeRaisingGround({layoutVersion:'NATIVE_ANCHORS_V1',unlockedCount:14,
    placements:constructed.placements.map(p=>({moduleId:definitions.find(d=>d.cageDefinitionIndex===p.definitionIndex).moduleId,slotIndex:p.slotIndex}))});
  const authority=restoreChannelRng(before.rng),draws=[],rng={next:channel=>{const value=authority.next(channel);draws.push({channel,value});return value;}};
  const actors=[],profiles=structuredClone(before.profiles);
  const absolute=(definition,local)=>local.map((n,i)=>n+ground.origin(definition)[i]*4096);
  let waste=before.waste.map(w=>({...w,present:true,positionQ12:absolute(w.cageDefinitionIndex,w.localPositionQ12)}));
  const foods=constructed.foods.map(f=>({...f,protein:f.kind===1}));
  for(let slot=0;slot<profiles.length;slot++){
    const p=profiles[slot],definition=p.fields['014'],actor=createNativeRaisingActor(p,slot);actors.push(actor);
    initializeNativeRaisingActor(actor,p,[0,0,0],definition,rng,()=>nativeRaisingEntryPosition(ground,definition,rng,slot),
      {deferActivity:true,onJoin:()=>notifyNativeRaisingResidentAdded(actor,actors,rng)});
    const expected=constructed.actors[slot];
    for(const key of ['positionQ12','flipBits','angleQ12'])assert.deepEqual(actor[key],expected[key],`actor ${slot}: ${key}`);
  }
  assert.deepEqual(authority.snapshot(),{seeds:constructed.rng.seeds,cursors:constructed.rng.cursors},'all constructor RNG channels');
  for(const [minutes,night] of [[before.pendingMinutes,false],[540,true]])for(const placement of ground.placements){
    const definition=placement.definitionIndex,members=nativeRaisingRebuiltListOrder(actors.filter(a=>a.cageDefinitionIndex===definition));
    const cageFoods=nativeRaisingRebuiltListOrder(foods.filter(f=>f.present&&f.cageDefinitionIndex===definition));
    const result=settleNativeRaisingCage(members.map(a=>profiles[a.poolSlot]),{definition,minutes,night,foods:cageFoods,
      wasteCount:waste.filter(w=>w.present&&w.cageDefinitionIndex===definition).length,rng,
      spawnWaste:speciesIndex=>{const positionQ12=nativeRaisingSpawnPosition(ground,definition,rng);
        const next=allocateNativeRaisingWaste(waste,{speciesIndex,cageDefinitionIndex:definition,positionQ12});if(next)waste.push(next);return !!next;}});
    members.forEach((a,i)=>profiles[a.poolSlot]=result.profiles[i]);cageFoods.forEach((f,i)=>Object.assign(f,result.foods[i]));
  }
  assert.deepEqual(profiles,overnight.profiles,'every field after daylight and night');
  assert.deepEqual(authority.snapshot(),{seeds:overnight.rng.seeds,cursors:overnight.rng.cursors},'all overnight RNG channels');
  for(const actor of actors)profiles[actor.poolSlot]=startNativeRaisingMorning(actor,profiles[actor.poolSlot],rng);
  assert.deepEqual(profiles,morning.profiles,'every field after morning entry');
  assert.deepEqual(authority.snapshot(),{seeds:morning.rng.seeds,cursors:morning.rng.cursors},'all morning RNG channels');
  assert.deepEqual(draws,evidence.trace.filter(e=>e.kind==='rng').map(({channel,value})=>({channel,value})), 'ordered original draw sequence');
  assert.deepEqual(waste.map(w=>({slot:w.slot,cageDefinitionIndex:w.cageDefinitionIndex,speciesIndex:w.speciesIndex,
    localPositionQ12:w.positionQ12.map((n,i)=>n-ground.origin(w.cageDefinitionIndex)[i]*4096)})),morning.waste);
  assert.deepEqual(foods.filter(f=>f.present).map(({protein,...f})=>f),morning.foods);
});
