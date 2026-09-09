import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createRaisingPresentationSource} from '../src/championship/app/raisingPresentationSource.js';
import {createNativeRaisingGround} from '../src/championship/raising/nativeRaisingGround.js';
import {normalizeNativeRaisingHome} from '../src/championship/raising/nativeRaisingHomeState.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,stepNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {createNativeRaisingFood} from '../src/championship/raising/nativeRaisingFood.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const catalog=read('src/data/championship/catalogs/creature-species.r1.json');
const cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
function setup(){const values=new Map();let failed=false;
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(failed)throw new Error('QUOTA');values.set(k,v);},removeItem:k=>values.delete(k)};
  return {values,storage,fail:()=>failed=true,repair:()=>failed=false,create:()=>createChampionshipStandaloneApp({storage,catalog,cages})};
}
const owned=(app,index)=>app.getShopFrame().listings.find(r=>r.shopRecordIndex===index).owned;
const saved=h=>JSON.parse([...h.values.values()][0]);
const frames=(app,count)=>{while(count>0){const n=Math.min(120,count);app.advanceNaturalClock({frames:n});count-=n;}};
async function hatch(app){const id=app.getRaisingInstances()[0].instanceId;
  for(let i=0;i<3;i++){app.touchRaisingEgg(id);frames(app,1);}
  for(let i=0;i<8&&app.getRaisingActorFrame(id).speciesIndex<8;i++)frames(app,120);
  assert.ok(app.getRaisingActorFrame(id).speciesIndex>=8);return id;
}
test('normal new-game hatch, food placement, approach, animation bites and existing save/Continue form one playable chain',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);
  const source=createRaisingPresentationSource(app);const unsubscribe=source.subscribe(()=>{});
  assert.equal(source.intents.placeFood({x:180,y:100}).ok,true);assert.equal(owned(app,0),49);
  assert.equal(source.intents.placeFood({x:180,y:100}).reason,'FOOD_AT_POINT');assert.equal(owned(app,0),49);
  const beforePosition=app.getRaisingActorFrame(id).positionQ12;
  frames(app,900);
  const food=app.getRaisingFoodFrame()[0];assert.ok(food.remaining<16);assert.ok(food.remaining>=1);
  assert.notDeepEqual(app.getRaisingActorFrame(id).positionQ12,beforePosition);
  assert.equal(app.save().phase,'SAVED');const checkpoint=saved(h);
  assert.equal(checkpoint.schemaVersion,5);assert.equal(checkpoint.raising.nativeHome.foods.length,1);
  assert.ok(checkpoint.creature.nativeProfile.fields['008']>0);
  const biteRemainder=checkpoint.creature.nativeProfile.narrowFields['194'];
  unsubscribe();await app.dispose();
  const restored=h.create();assert.ok(await restored.continueGame());
  assert.equal(owned(restored,0),49);assert.equal(restored.getRaisingFoodFrame()[0].remaining,food.remaining);
  assert.deepEqual(restored.getRaisingFoodFrame()[0].positionQ12,food.positionQ12);
  assert.equal(restored.save().phase,'SAVED');
  assert.equal(saved(h).creature.nativeProfile.fields['008'],checkpoint.creature.nativeProfile.fields['008']);
  assert.equal(saved(h).creature.nativeProfile.narrowFields['194'],biteRemainder);
  assert.equal(restored.getRaisingActorFrame(id).cageDefinitionIndex,35);await restored.dispose();
});
test('food is independent of egg taps, invalid ground, paused screens and food inventory is consumed only on accepted placement',async()=>{
  const h=setup(),app=h.create();await app.newGame();
  assert.equal(app.placeRaisingFood({x:150,y:-3}).ok,false);
  assert.equal(app.placeRaisingFood({x:NaN,y:100}).ok,false);assert.equal(owned(app,0),50);
  assert.equal(app.placeRaisingFood({x:180,y:100,protein:true}).ok,true);assert.equal(owned(app,1),9);
  frames(app,120);assert.equal(app.getRaisingFoodFrame()[0].remaining,16); // still an egg
  app.openShop();const before=app.getRaisingFoodFrame();frames(app,120);
  assert.deepEqual(app.getRaisingFoodFrame(),before);assert.equal(app.placeRaisingFood({x:140,y:100}).ok,false);
  app.leaveScreen();assert.equal(app.cleanRaisingFood({x:180,y:95}),true);
  assert.equal(app.cleanRaisingFood({x:180,y:95}),false);assert.equal(owned(app,1),9);
  assert.equal(app.getRaisingFoodFrame().length,0);assert.equal(app.placeRaisingFood({x:180,y:100}).slot,0);
  await app.dispose();
});
test('the shared original ten-food pool rejects an eleventh, and a failed Save keeps the previous complete inventory/profile/food checkpoint',async()=>{
  const h=setup(),app=h.create();await app.newGame();const ground=createNativeRaisingGround(app.getCageEditFrame());
  let accepted=0;
  for(let y=28;y<160;y+=32)for(let x=20;x<ground.pixelWidth;x+=40){if(app.placeRaisingFood({x,y}).ok)accepted++;}
  assert.equal(accepted,10);assert.equal(app.getRaisingFoodFrame().length,10);assert.equal(owned(app,0),40);
  assert.equal(app.save().phase,'SAVED');const checkpoint=[...h.values.values()][0];
  const first=app.getRaisingFoodFrame()[0];assert.equal(app.cleanRaisingFood({x:first.positionQ12[0]/4096,y:first.positionQ12[1]/4096}),true);
  h.fail();assert.equal(app.save().phase,'SAVE_FAILED');assert.equal([...h.values.values()][0],checkpoint);
  h.repair();assert.equal(app.save().phase,'SAVED');assert.equal(saved(h).raising.nativeHome.foods.length,9);
  assert.equal(owned(app,0),40);await app.dispose();
});
test('native food Save refuses malformed coordinates, duplicate slots and impossible quantities without broadening the v5 envelope',()=>{
  const good={version:1,poolSlots:{'resident:one':0},foods:[{slot:0,cageDefinitionIndex:35,localPositionQ12:[128*4096,120*4096,0],protein:false,remaining:16,freshness:1440}]};
  assert.ok(normalizeNativeRaisingHome(good));
  for(const mutate of [s=>s.foods.push({...s.foods[0]}),s=>s.foods[0].remaining=17,s=>s.foods[0].localPositionQ12[0]=Infinity,
    s=>s.foods[0].freshness=-1,s=>s.poolSlots['resident:two']=0]){const bad=structuredClone(good);mutate(bad);assert.throws(()=>normalizeNativeRaisingHome(bad));}
});

test('native hand relocation changes physical membership, interrupts feeding and saves through the same individual',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);
  app.placeRaisingFood({x:180,y:100});frames(app,120);
  const source=createRaisingPresentationSource(app),g=createNativeRaisingGround(app.getCageEditFrame());
  const origin=app.getRaisingActorFrame(id).positionQ12;
  assert.equal(source.intents.relocateToGround(id,{x:120,y:-10}),false);
  assert.deepEqual(app.getRaisingActorFrame(id).positionQ12,origin);
  let point=null;
  for(let y=30;y<160&&!point;y+=8)for(let x=8;x<g.pixelWidth;x+=8){const c=g.cageAt(x,y);if(c&&c.definitionIndex!==35&&g.readTerrain(x>>3,y>>3)!==1){point={x,y,definition:c.definitionIndex};break;}}
  assert.ok(point);assert.equal(source.intents.relocateToGround(id,point),true);
  assert.equal(app.getRaisingActorFrame(id).cageDefinitionIndex,point.definition);assert.equal(app.getRaisingActorFrame(id).foodSlot,null);
  const remaining=app.getRaisingFoodFrame()[0].remaining;frames(app,900);
  assert.equal(app.getRaisingFoodFrame()[0].remaining,remaining); // another Cage's food is excluded
  app.save();assert.equal(saved(h).creature.nativeProfile.fields['014'],point.definition);
  await app.dispose();const restored=h.create();await restored.continueGame();
  assert.equal(restored.getRaisingActorFrame(id).cageDefinitionIndex,point.definition);await restored.dispose();
});

test('four hungry residents share food without duplicate station claims; full belly exit applies both original writers once',()=>{
  const rng={next:()=>51},species=nativeHuntSpeciesByIndex(8),actors=[],profiles=[];
  const food=createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:[100*4096,100*4096,0],restored:true});
  const ground={width:84,height:24,pixelWidth:672,readTerrain:()=>0,readClearance:()=>4};
  for(let i=0;i<4;i++) {
    const raw=createNativeHuntIndividual({species,rng});raw.fields['008']=species.field1c-1;raw.fields['020']=99;
    raw.fields['050']=raw.fields['058'];raw.fields['00c']=0;raw.fields['134']=0;raw.fields['138']=0;raw.narrowFields['194']=3;
    const p=nativeIndividualProfile(raw),actor=createNativeRaisingActor(p,i);
    initializeNativeRaisingActor(actor,p,[(i<2?80:120)*4096,(i%2?105:95)*4096,0],35,rng);actors.push(actor);profiles.push(p);
  }
  const signatures=new Set();
  for(let tick=0;tick<600;tick++){
    const signals=new Map([[35,{search:tick%30===0}]]);
    for(let i=0;i<4;i++){const result=stepNativeRaisingActor(actors[i],profiles[i],{ageDelta:0,rng,feeding:{ground,foods:[food],signals,actors}});profiles[i]=result.profile;}
    const claimed=food.occupants.filter(n=>n!==null);assert.equal(new Set(claimed).size,claimed.length);
    for(const a of actors)if(a.sequenceId===14&&a.state===5)signatures.add(a.poolSlot);
  }
  assert.equal(signatures.size,4);assert.equal(food.remaining,12);
  for(const p of profiles){assert.equal(p.fields['008'],species.field1c);assert.equal(p.fields['020'],100);
    assert.equal(p.fields['00c'],Math.trunc(p.fields['178']/10)*8);}
  assert.deepEqual(food.occupants,[null,null,null,null]);
});
