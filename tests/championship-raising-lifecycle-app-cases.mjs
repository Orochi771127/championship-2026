import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeRaisingGround} from '../src/championship/raising/nativeRaisingGround.js';
import {constructNativeIndividualForm} from '../src/championship/raising/nativeIndividualEvolution.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const catalog=read('src/data/championship/catalogs/creature-species.r1.json');
const cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
function setup(){const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw Error('QUOTA');data.set(k,v);},removeItem:k=>data.delete(k)};
  return {data,storage,setFail:value=>fail=value,create:()=>createChampionshipStandaloneApp({storage,catalog,cages,rngClock:()=>({hour:12,minute:34,second:56})})};}
function frames(app,n){for(let i=0;i<n;i++){if(app.hasRaisingPresentation())app.advanceRaisingPresentation({frames:1});else app.advanceNaturalClock({frames:1});
  const mailbox=app.getRaisingMailbox();if(mailbox.activeId!==null&&mailbox.queue.find(q=>q.id===mailbox.activeId)?.system)app.acknowledgeRaisingMail();}}
async function hatch(app){const id=app.getRaisingInstances()[0].instanceId;for(let i=0;i<3;i++){app.touchRaisingEgg(id);frames(app,1);}frames(app,200);assert.ok(app.getRaisingActorFrame(id).speciesIndex>=8);return id;}

test('normal hand input hatches the starter, strokes with movement, releases and retains individual care through Save/Continue',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=app.getRaisingInstances()[0].instanceId;
  for(let i=0;i<3;i++){const f=app.getRaisingActorFrame(id),point={x:f.positionQ12[0]/4096,y:f.positionQ12[1]/4096};
    assert.equal(app.beginRaisingHand(id,point),true);assert.equal(app.endRaisingHand(id),true);frames(app,1);}
  frames(app,200);assert.ok(app.getRaisingActorFrame(id).speciesIndex>=8);
  for(let i=0;i<300&&! [1,2,3,5,17].includes(app.getRaisingActorFrame(id).state);i++)frames(app,1);
  app.save();const before=JSON.parse([...h.data.values()][0]).creature.nativeProfile.fields;
  const f=app.getRaisingActorFrame(id),point={x:f.positionQ12[0]/4096,y:f.positionQ12[1]/4096};
  assert.equal(app.beginRaisingHand(id,point),true);app.updateRaisingHand(id,{x:point.x+4,y:point.y});frames(app,1);
  assert.equal(app.getRaisingActorFrame(id).state,8);assert.equal(app.getRaisingActorFrame(id).sequenceId,28);
  for(let i=0;i<1000;i++){app.updateRaisingHand(id,{x:point.x+(i%2?8:4),y:point.y});frames(app,1);}
  assert.equal(app.getRaisingActorFrame(id).state,8);assert.equal(app.endRaisingHand(id),true);frames(app,2);
  assert.notEqual(app.getRaisingActorFrame(id).state,8);
  app.save();const after=JSON.parse([...h.data.values()][0]).creature.nativeProfile.fields;
  assert.ok(after['020']>before['020'],'stroke age writer raises affection');
  await app.dispose();const restored=h.create();assert.ok(await restored.continueGame());
  assert.notEqual(restored.getRaisingActorFrame(id).state,8);restored.save();
  assert.equal(JSON.parse([...h.data.values()][0]).creature.nativeProfile.fields['020'],after['020']);await restored.dispose();
});

test('native hand hold lifts after four updates and cancelled gestures cannot remain latched across navigation',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app),f=app.getRaisingActorFrame(id);
  const point={x:f.positionQ12[0]/4096,y:80};
  assert.equal(app.beginRaisingHand(id,point),true);frames(app,3);assert.notEqual(app.getRaisingActorFrame(id).state,6);
  frames(app,1);assert.equal(app.getRaisingActorFrame(id).state,6);
  assert.equal(app.endRaisingHand(id,{cancelled:true}),true);assert.equal(app.getRaisingActorFrame(id).state,7);frames(app,300);
  assert.equal(app.beginRaisingHand(id,point),true);assert.equal(app.beginRaisingHand(id,point),false);
  assert.equal(app.endRaisingHand(id,{cancelled:true}),true);frames(app,4);assert.notEqual(app.getRaisingActorFrame(id).state,6);
  assert.equal(app.beginRaisingHand(id,point),true);app.openHelp();app.leaveScreen();
  assert.equal(app.beginRaisingHand(id,point),true);app.endRaisingHand(id,{cancelled:true});await app.dispose();
});

test('held resident advances on the app clock, releases into native flight, lands and persists its original cage',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);
  const before=app.getRaisingActorFrame(id),point={x:before.positionQ12[0]/4096,y:80};
  assert.equal(app.beginRaisingCarry(id,point),true);assert.equal(app.getRaisingActorFrame(id).state,6);
  assert.equal(app.getRaisingActorFrame(id).sequenceId,11);
  for(let i=0;i<6;i++){app.updateRaisingCarry(id,{x:point.x,y:80-i*12});frames(app,1);}
  const held=app.getRaisingActorFrame(id);assert.equal(held.positionQ12[2],81920);
  assert.equal(app.releaseRaisingCarry(id),true);assert.equal(app.getRaisingActorFrame(id).state,7);
  assert.equal(app.getRaisingActorFrame(id).sequenceId,5);assert.equal(app.releaseRaisingCarry(id),false);
  let airborne=false;for(let i=0;i<600&&app.getRaisingActorFrame(id).state===7;i++){
    frames(app,1);airborne||=app.getRaisingActorFrame(id).positionQ12[2]>held.positionQ12[2];}
  assert.equal(airborne,true);assert.notEqual(app.getRaisingActorFrame(id).state,7);
  assert.equal(app.getRaisingActorFrame(id).positionQ12[2],0);assert.equal(app.getRaisingActorFrame(id).cageDefinitionIndex,before.cageDefinitionIndex);
  assert.equal(app.save().phase,'SAVED');await app.dispose();const restored=h.create();assert.ok(await restored.continueGame());
  assert.equal(restored.getRaisingActorFrame(id).cageDefinitionIndex,before.cageDefinitionIndex);await restored.dispose();
});

test('controlled neglected-adult save follows native disappearance and Continue does not resurrect the released starter',async()=>{
  const h=setup(),initial=h.create();await initial.newGame();await hatch(initial);initial.save();await initial.dispose();
  const [key,text]=[...h.data][0],save=JSON.parse(text),id=save.creature.creatureId;
  const p=structuredClone(constructNativeIndividualForm(save.creature.nativeProfile,71,{next:()=>51}));
  p.fields['18c']=20000;p.fields['020']=0;p.fields['024']=0;p.fields['04c']=0;
  save.creature.nativeProfile=p;save.creature.speciesId='species-071';h.data.set(key,JSON.stringify(save));
  const app=h.create();assert.ok(await app.continueGame());
  let started=false;
  for(let i=0;i<500&&app.getRaisingActorFrame(id);i++){started||=app.getRaisingLifecycleFrame().evolution?.target===-1;frames(app,1);}
  assert.equal(started,true);assert.equal(app.getRaisingInstances().length,0);assert.equal(app.hasRaisingPresentation(),false);
  assert.equal(app.save().phase,'SAVED');await app.dispose();const restored=h.create();assert.ok(await restored.continueGame());
  assert.equal(restored.getRaisingInstances().length,0);await restored.dispose();
});

test('normal ground relocation runs the original Cage program once; same-Cage drops do not retrain',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);app.save();
  const ground=createNativeRaisingGround(app.getCageEditFrame());
  const tile=Array.from(ground.owners).findIndex((definition,i)=>definition===0&&ground.terrain[i]!==1&&ground.clearance[i]>2);
  assert.ok(tile>=0);const point={x:tile%ground.width*8+4,y:Math.floor(tile/ground.width)*8+4};
  const before=JSON.parse([...h.data.values()][0]).creature.nativeProfile;
  assert.equal(app.moveRaisingResidentToGround(id,point),true);
  let training=false;for(let i=0;i<600;i++){frames(app,1);training||=app.getRaisingActorFrame(id)?.state===11;}
  assert.equal(training,true);app.save();const after=JSON.parse([...h.data.values()][0]).creature.nativeProfile;
  const trainingFields=[...Array.from({length:11},(_,i)=>(0x58+i*4).toString(16).padStart(3,'0')),...Array.from({length:11},(_,i)=>(0x100+i*4).toString(16))];
  assert.ok(trainingFields.some(k=>after.fields[k]!==before.fields[k]),'one of the three native weighted programs changes its own stat or attribute channels');
  assert.equal(app.moveRaisingResidentToGround(id,point),true);
  for(let i=0;i<200;i++){frames(app,1);assert.notEqual(app.getRaisingActorFrame(id)?.state,11);}
  await app.dispose();
});

test('normal food, sleep and repeated days reach automatic evolution and retain identity across Save/Continue',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);let evolved=false;
  for(let day=0;day<12&&!evolved;day++){
    const actor=app.getRaisingActorFrame(id);assert.ok(actor,'care path retains its individual');
    if(actor.speciesIndex<8){for(let t=0;t<3;t++){app.touchRaisingEgg(id);frames(app,1);}}
    app.placeRaisingFood({x:actor.positionQ12[0]/4096,y:actor.positionQ12[1]/4096});
    for(let tick=0;tick<600;tick++){const e=app.getRaisingLifecycleFrame().evolution;evolved||=!!e&&e.target>=8;frames(app,1);}
    if(evolved)break;
    assert.equal(app.endDay().accepted,true);frames(app,40);assert.equal(app.acknowledgeRaisingCalendar(),true);frames(app,26);
  }
  assert.ok(evolved);frames(app,350);const species=app.getRaisingActorFrame(id).speciesIndex;
  app.save();await app.dispose();const restored=h.create();assert.ok(await restored.continueGame());
  assert.equal(restored.getRaisingInstances()[0].instanceId,id);assert.equal(restored.getRaisingActorFrame(id).speciesIndex,species);await restored.dispose();
});

test('new-game hatch, food, two-pass night, original calendar acknowledgement and Continue share one durable state',async()=>{
  const h=setup(),app=h.create();await app.newGame();const id=await hatch(app);
  app.placeRaisingFood({x:180,y:100});frames(app,200);app.save();const before=JSON.parse([...h.data.values()][0]);
  const oldClock=app.getSnapshot().clockMinutes;
  assert.equal(app.requestRaisingDayEnd(),true);frames(app,40);assert.equal(app.getSnapshot().clockMinutes,oldClock);
  assert.equal(app.confirmRaisingDayEnd(false),true);assert.equal(app.getSnapshot().dayOfSeason,0);
  assert.equal(app.requestRaisingDayEnd(),true);assert.equal(app.confirmRaisingDayEnd(true).accepted,true);
  const morning=app.getSnapshot();assert.equal(morning.dayOfSeason,1);assert.equal(morning.clockMinutes,420);
  app.advanceRaisingPresentation({frames:40});assert.equal(app.getRaisingLifecycleFrame().day.phase,'calendar');assert.equal(app.getRaisingLifecycleFrame().day.calendar.days.length,8);
  frames(app,120);assert.equal(app.getSnapshot().clockUnits,0);assert.equal(app.placeRaisingFood({x:180,y:100}).ok,false);
  assert.equal(app.endDay().accepted,false);assert.equal(app.acknowledgeRaisingCalendar(),true);assert.equal(app.acknowledgeRaisingCalendar(),false);
  frames(app,26);assert.equal(app.hasRaisingPresentation(),false);assert.equal(app.getRaisingActorFrame(id).speciesIndex,before.creature.nativeProfile.fields['000']);
  app.save();const after=JSON.parse([...h.data.values()][0]);assert.equal(after.schemaVersion,5);
  assert.ok(after.creature.nativeProfile.fields['18c']>before.creature.nativeProfile.fields['18c']);assert.equal(after.creature.nativeProfile.fields['00c'],0);
  const waste=app.getRaisingWasteFrame();assert.ok(waste.length>0);const food=app.getRaisingFoodFrame();await app.dispose();
  const restored=h.create();assert.ok(await restored.continueGame());assert.deepEqual(restored.getRaisingWasteFrame(),waste);assert.deepEqual(restored.getRaisingFoodFrame(),food);
  const w=waste[0],x=w.positionQ12[0]/4096,y=w.positionQ12[1]/4096;
  assert.equal(restored.cleanRaisingFood({x:x-7,y}),false);assert.equal(restored.cleanRaisingFood({x,y}),true);assert.equal(restored.cleanRaisingFood({x,y}),false);
  restored.save();await restored.dispose();
});
test('failed day-end save preserves the last complete save and retry never settles overnight twice',async()=>{
  const h=setup(),app=h.create();await app.newGame();await hatch(app);app.save();const old=[...h.data.values()][0];h.setFail(true);
  app.endDay();frames(app,10);assert.equal(app.getRaisingLifecycleFrame().day.savePhase,'SAVE_FAILED');assert.equal([...h.data.values()][0],old);
  const count=app.getRaisingWasteFrame().length;frames(app,120);assert.equal(app.getSnapshot().clockUnits,0);assert.equal(app.getRaisingWasteFrame().length,count);
  h.setFail(false);assert.equal(app.save().phase,'SAVED');const once=[...h.data.values()][0];frames(app,30);
  assert.equal(app.getRaisingLifecycleFrame().day.phase,'calendar');assert.equal([...h.data.values()][0],once);assert.equal(app.getSnapshot().dayOfSeason,1);await app.dispose();
});

test('Continue from the calendar save settles the same pending night exactly once with the same RNG and ground objects',async()=>{
  const h=setup(),app=h.create();await app.newGame();await hatch(app);
  app.placeRaisingFood({x:180,y:100});frames(app,200);app.save();
  const [key,priorText]=[...h.data][0],prior=JSON.parse(priorText);
  assert.equal(app.endDay().accepted,true);app.advanceRaisingPresentation({frames:40});
  const pendingText=h.data.get(key),pending=JSON.parse(pendingText);
  assert.equal(app.getRaisingLifecycleFrame().day.phase,'calendar');
  assert.ok(Number.isInteger(pending.raising.nativeHome.pendingOvernightMinutes));
  assert.equal(pending.creature.nativeProfile.fields['18c'],prior.creature.nativeProfile.fields['18c']);
  assert.equal(app.acknowledgeRaisingCalendar(),true);app.advanceRaisingPresentation({frames:24});app.save();
  const uninterrupted=JSON.parse(h.data.get(key));await app.dispose();
  h.data.set(key,pendingText);const resumed=h.create();await resumed.continueGame();resumed.prepareMorningMessages();resumed.save();
  const restored=JSON.parse(h.data.get(key));
  for(const field of ['creature','gameplayRng'])assert.deepEqual(restored[field],uninterrupted[field],field);
  assert.deepEqual(restored.raising.nativeHome,uninterrupted.raising.nativeHome);
  assert.equal(restored.raising.nativeHome.pendingOvernightMinutes,undefined);
  assert.ok(restored.creature.nativeProfile.fields['18c']>pending.creature.nativeProfile.fields['18c']);
  const settledAge=restored.creature.nativeProfile.fields['18c'];await resumed.dispose();
  const again=h.create();await again.continueGame();again.save();
  assert.equal(JSON.parse(h.data.get(key)).creature.nativeProfile.fields['18c'],settledAge);await again.dispose();
});
