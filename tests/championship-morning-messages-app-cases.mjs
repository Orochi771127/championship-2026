import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeRaisingMessages,enqueueNativeRaisingMessage} from '../src/championship/raising/nativeRaisingMessages.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const catalog=read('src/data/championship/catalogs/creature-species.r1.json'),cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
async function setup(notes){
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,catalog,cages,rngClock:()=>({hour:12,minute:34,second:56})});
  const first=create();await first.newGame();first.save();await first.dispose();
  const [key,text]=[...data][0],save=JSON.parse(text);let mailbox=createNativeRaisingMessages();for(const n of notes)mailbox=enqueueNativeRaisingMessage(mailbox,n);
  save.progression.nativeMessages=mailbox;data.set(key,JSON.stringify(save));const app=create();await app.continueGame();
  return {app,create,data};
}
test('birthday money is credited at open exactly once across Save/Continue, then claimed on acknowledgement',async()=>{
  const h=await setup([197]);let app=h.app;app.save();const before=JSON.parse([...h.data.values()][0]).shop.bits;
  assert.equal(app.openRaisingMail(),true);assert.equal(app.getClockRunState().running,false);assert.equal(app.acknowledgeRaisingMail(),false);
  app.save();let save=JSON.parse([...h.data.values()][0]);assert.equal(save.shop.bits,before+5000);assert.equal(save.progression.nativeMessages.birthdayClaimed,false);
  await app.dispose();app=h.create();await app.continueGame();app.openRaisingMail();app.advanceRaisingPresentation({frames:61});assert.equal(app.acknowledgeRaisingMail(),true);
  assert.equal(app.acknowledgeRaisingMail(),false);app.save();save=JSON.parse([...h.data.values()][0]);assert.equal(save.shop.bits,before+5000);assert.equal(save.progression.nativeMessages.birthdayClaimed,true);await app.dispose();
});
test('birthday cake and rank feast become six-slot ground food and survive Save/Continue',async()=>{
  const h=await setup([198,120]);let app=h.app;
  for(let i=0;i<2;i++){assert.equal(app.openRaisingMail(),true);app.advanceRaisingPresentation({frames:61});assert.equal(app.acknowledgeRaisingMail(),true);app.advanceNaturalClock({frames:1});}
  const food=app.getRaisingFoodFrame();assert.equal(food.length,6);assert.deepEqual(food.map(f=>f.slot),[10,11,12,13,14,15]);
  assert.deepEqual(food.map(f=>f.kind),[3,2,3,2,3,2]);assert.ok(food.every(f=>f.cageDefinitionIndex===35));app.save();await app.dispose();
  app=h.create();await app.continueGame();assert.deepEqual(app.getRaisingFoodFrame().map(f=>[f.slot,f.kind,f.remaining]),food.map(f=>[f.slot,f.kind,f.remaining]));await app.dispose();
});
test('item and egg gifts use the existing inventory and identity allocation, and never repeat after Continue',async()=>{
  const h=await setup([195,199]);let app=h.app;app.save();const before=JSON.parse([...h.data.values()][0]);
  for(let i=0;i<2;i++){assert.equal(app.openRaisingMail(),true);app.advanceRaisingPresentation({frames:61});assert.equal(app.acknowledgeRaisingMail(),true);}
  app.save();const after=JSON.parse([...h.data.values()][0]);assert.equal(after.shop.quantities[2],before.shop.quantities[2]+1);assert.equal(app.getRaisingInstances().length,2);
  const ids=app.getRaisingInstances().map(r=>r.instanceId);assert.equal(new Set(ids).size,2);await app.dispose();app=h.create();await app.continueGame();assert.equal(app.openRaisingMail(),false);assert.deepEqual(app.getRaisingInstances().map(r=>r.instanceId),ids);await app.dispose();
});
test('calendar registration and cancellation are durable without charging the wallet',async()=>{
  const h=await setup([]);let app=h.app;app.openSchedule();assert.deepEqual(app.getTitleProgress().registered,[4,8]);
  assert.equal(app.toggleTitleRegistration(4),true);app.save();await app.dispose();app=h.create();await app.continueGame();assert.deepEqual(app.getTitleProgress().registered,[8]);
  app.openSchedule();assert.equal(app.toggleTitleRegistration(4),true);assert.equal(app.toggleTitleRegistration(61),false);app.save();await app.dispose();app=h.create();await app.continueGame();assert.deepEqual(app.getTitleProgress().registered,[4,8]);await app.dispose();
});
