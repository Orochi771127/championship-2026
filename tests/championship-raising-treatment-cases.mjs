import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeTreatmentAdmission,nativeTreatmentWait,createNativeTreatmentPresentation,advanceNativeTreatmentPresentation} from '../src/championship/raising/nativeRaisingTreatment.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,treatNativeRaisingActor} from '../src/championship/raising/nativeRaisingActor.js';
import {createNativeRaisingGround} from '../src/championship/raising/nativeRaisingGround.js';
import {originalStartingRanch} from '../src/championship/cage/nativeRanchLayout.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const cpu=read('docs/research/RAISING_TREATMENT_CPU_CHECK_2026-09-09.json');

test('treatment inventory gate and reaction boundary match original ARM execution',()=>{
  for(const c of cpu.admission){const r=nativeTreatmentAdmission(c);
    assert.equal(c.stock-Number(r.consume),c.remaining,JSON.stringify(c));
    assert.equal(r.dispatch,c.commands.some(x=>x[0]==='command'&&x[1]===(c.kind?0x7d:0x7c)));}
  for(const c of cpu.timeline){const r=nativeTreatmentWait({...c,reaction:9});
    assert.equal(r.elapsed,c.nextElapsed);assert.equal(r.complete,c.result!==0xffffffff);
    assert.equal(r.nextState,c.result===0xffffffff?null:c.result);}
  for(const success of [false,true]){const p=createNativeTreatmentPresentation({kind:0,success,reaction:success?9:18,previous:1});
    const icon=cpu.icons.find(i=>i.sequence===(success?4:3));assert.equal(p.icon.getSnapshot().playMode,icon.mode);
    let frames=0,r;do{r=advanceNativeTreatmentPresentation(p);frames++;assert.ok(frames<=61);}while(!r.complete);
    assert.equal(frames,success?61:icon.durations.reduce((a,b)=>a+b,0));}
});

test('medicine followed by sleep/eating exit matches the original composed writers and RNG order',()=>{
  const ground=createNativeRaisingGround({...originalStartingRanch(),unlockedCount:14});
  for(const c of cpu.exits){
    const calls=[],rng={next:channel=>{calls.push(['rng',channel]);return c.roll;}};
    const profile={version:1,...c.before},actor=createNativeRaisingActor(profile,c.poolSlot);
    initializeNativeRaisingActor(actor,profile,[409600,409600,0],35,rng);actor.state=c.previous;calls.length=0;
    const result=treatNativeRaisingActor(actor,profile,c.kind,{foods:[],ground,rng});
    assert.deepEqual(result.profile.fields,c.after.fields,JSON.stringify({species:c.species,previous:c.previous,kind:c.kind,condition:c.condition,roll:c.roll}));
    assert.deepEqual(calls,c.calls.filter(x=>x[0]==='rng'));assert.equal(actor.state,c.nextState);
  }
});

test('normal treatment changes the same individual and inventory and survives Save/Continue without a second debit',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:12,minute:34,second:56})});
  let app=create();await app.newGame();const id=app.getRaisingInstances()[0].instanceId;
  // Hatch through the normal actor input/tick, then persist a controlled wound
  // fixture. The test never replaces the app's RNG, inventory or write ports.
  for(let i=0;i<4;i++){app.touchRaisingEgg(id);app.advanceNaturalClock({frames:1});}
  for(let i=0;i<4;i++)app.advanceNaturalClock({frames:120});
  app.save();await app.dispose();const [key,json]=[...data][0],save=JSON.parse(json);
  assert.ok(save.creature.nativeProfile.fields['000']>=8);
  save.creature.nativeProfile.fields['134']=1;save.creature.nativeProfile.fields['138']=0;
  save.shop.quantities[3]=2;data.set(key,JSON.stringify(save));app=create();await app.continueGame();
  assert.equal(app.getRaisingActorFrame(id).state,1);
  const result=app.treatRaisingResident(id,0);assert.deepEqual(result,{ok:true,consumed:true,applied:true,success:true});
  assert.equal(app.getRaisingActorFrame(id).state,20);
  assert.equal(app.treatRaisingResident(id,0).consumed,false);
  app.save();const after=JSON.parse(data.get(key));assert.equal(after.shop.quantities[3],1);assert.equal(after.creature.nativeProfile.fields['134'],0);
  await app.dispose();app=create();await app.continueGame();app.save();
  const resumed=JSON.parse(data.get(key));assert.equal(resumed.creature.nativeProfile.fields['134'],0);
  assert.equal(resumed.shop.quantities[3],1);await app.dispose();
});
