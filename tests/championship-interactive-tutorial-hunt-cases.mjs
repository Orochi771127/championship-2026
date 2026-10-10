import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHuntFieldPointer} from '../src/championship/presentation/vs2/huntFieldPointer.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {TUTORIAL_HUNT_STEPS,TUTORIAL_GATE} from '../src/championship/app/interactiveTutorialHuntSteps.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
const KEY='championshipModernSave:v1',FRAME=1000*560190/33513982;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cp=a=>a.getInteractiveTutorial().checkpoint;
const normal=bytes=>{const s=JSON.parse(bytes);delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;return s;};
async function fixture(t,stage='gate-intro'){
 const data=new Map(),storage={fail:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.fail)throw Error('TEST_SAVE_FAILURE');data.set(k,v);},removeItem:k=>data.delete(k)};
 const make=()=>createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:1,minute:2,second:3})});
 let app=make();await app.newGame({trainerName:'Test',eggName:'Egg'});app.save();
 const save=JSON.parse(storage.getItem(KEY));save.progression.nativeOpening={version:2,trainerName:'Test',tutorialStep:null,checkpoint:{version:1,stage,message:0}};
 await app.dispose();storage.setItem(KEY,JSON.stringify(save));app=make();await app.continueGame();t.after(()=>app.dispose());
 return {app,storage,baseline:normal(storage.getItem(KEY)),reload:async()=>{await app.dispose();app=make();await app.continueGame();return app;}};
}
function input(a,kind,args,expected=cp(a)){return a.interactiveHuntInput(kind,args,expected);}
function tick(a,n=1){for(let i=0;i<n;i++)a.advanceHunt(FRAME);}
function target(a){return a.getHuntRuntime()?.getWildCreatures().find(x=>x.speciesIndex===(TUTORIAL_HUNT_STEPS[cp(a).stage]?.target===1?21:13));}
function circle(a){const c=cp(a),p=target(a),x=p.worldX,y=p.worldY-10;
 for(let i=0;i<16;i++){const angle=i/16*Math.PI*2,pos=[x+70*Math.cos(angle),y+70*Math.sin(angle)];input(a,i?'move':'down',pos,c);tick(a);}
 input(a,'up',[x+70,y],c);tick(a,35);
}
function pull(a){const c=cp(a);let p=target(a);input(a,'down',[p.worldX,p.worldY-10],c);
 for(let i=0;i<6000&&cp(a).stage===c.stage;i++){p=target(a);const tool=a.getHuntRuntime().getToolState();
  if(!tool.rope)input(a,'down',[p.worldX,p.worldY-10],c);
  input(a,'move',[p.worldX+(tool.rope?.durability<30?40:180),p.worldY-20],c);tick(a);
 }
 assert.notEqual(cp(a).stage,c.stage,'actual rope HP predicate must complete');
}
async function one(a){const t=a.getInteractiveTutorial(),s=cp(a).stage;
 if(t.dialogue){assert.equal(a.acknowledgeInteractiveTutorial(cp(a)).ok,true);return;}
 if(s==='gate-select'){a.selectGate(TUTORIAL_GATE.gateId,cp(a));await a.confirmGate(cp(a));return;}
 if(t.action==='select'){assert.equal(input(a,'select',[t.tool]),true);return;}
 if(t.action==='camera'){assert.equal(input(a,'camera',[1,0,390,500]),true);return;}
 if(t.action==='enclose'){circle(a);return;}
 if(t.action==='capture'){if(!target(a).bound)circle(a);if(cp(a).stage===s)pull(a);return;}
 if(t.action==='pull'){pull(a);return;}
 if(t.action==='collect'){tick(a,20);const p=target(a);input(a,'down',[p.worldX,p.worldY-5]);input(a,'up',[p.worldX,p.worldY-5]);tick(a,160);return;}
 if(t.action==='food'){input(a,'down',[1280,1168]);tick(a);input(a,'up',[1280,1168]);tick(a,5);return;}
 if(t.action==='stun'){const p=target(a);input(a,'down',[p.worldX,p.worldY-5]);tick(a,2);input(a,'up',[p.worldX,p.worldY-5]);return;}
 tick(a,300);
}
test('Gate16, two real captures, phase3 return preserve normal baseline and ordinary gate catalog',async t=>{
 const {app:a,storage,baseline}=await fixture(t),seen=new Set();
 for(let i=0;i<100&&cp(a).stage!=='raising-battle-ready';i++){seen.add(cp(a).stage);console.log('hunt-step',cp(a).stage);await one(a);assert.deepEqual(normal(storage.getItem(KEY)),baseline);}
 assert.equal(cp(a).stage,'raising-battle-ready');assert.equal(a.getScreen(),'RAISING_HOME');assert.equal(a.getHuntRuntime(),null);
 for(const stage of Object.keys(TUTORIAL_HUNT_STEPS).filter(s=>s!=='raising-battle-ready'))assert.ok(seen.has(stage),stage);
 assert.equal(listChampionshipGates().length,16);assert.ok(!listChampionshipGates().some(g=>g.gateId===TUTORIAL_GATE.gateId));
 await a.exitInteractiveTutorial(cp(a));assert.deepEqual(normal(storage.getItem(KEY)),baseline);assert.equal(a.getGates().length,16);
});
test('Gate rejects ordinary/stale targets, save failure freezes candidate and retry enters exactly once',async t=>{
 const {app:a,storage,baseline}=await fixture(t);const old=cp(a);a.acknowledgeInteractiveTutorial(old);
 a.selectGate(listChampionshipGates()[0].gateId,cp(a));assert.equal(a.getSelectedGateId(),null);
 a.selectGate(TUTORIAL_GATE.gateId,old);assert.equal(a.getSelectedGateId(),null);
 a.selectGate(TUTORIAL_GATE.gateId,cp(a));const gate=cp(a);storage.fail=true;await a.confirmGate(gate);
 assert.equal(a.getScreen(),'GATE_SELECT');assert.equal(a.getHuntRuntime(),null);assert.equal(a.getInteractiveTutorial().pendingSave,true);
 assert.deepEqual(normal(storage.getItem(KEY)),baseline);storage.fail=false;a.persistenceFacade().retry();
 assert.equal(a.getScreen(),'HUNT_FIELD');const runtime=a.getHuntRuntime();await a.confirmGate(gate);assert.equal(a.getHuntRuntime(),runtime);
 a.exitHunt();a.leaveScreen();assert.equal(a.getScreen(),'HUNT_FIELD');
});
test('all Hunt checkpoints resume safely; stale and wrong-tool input cannot advance',async t=>{
 for(const stage of Object.keys(TUTORIAL_HUNT_STEPS)){
  const f=await fixture(t,stage),a=f.app;assert.equal(cp(a).stage,stage);assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);
  const before=cp(a),bad={...before,stage:'raising-intro'};
  assert.equal(input(a,'select',['ROPE'],bad),false);assert.deepEqual(cp(a),before);
  assert.equal(input(a,'select',['UNKNOWN']),false);assert.deepEqual(cp(a),before);
  if(stage==='hunt-first-enclose'){input(a,'down',[800,800]);input(a,'up',[800,800]);tick(a,30);assert.equal(cp(a).stage,stage);}
  if(stage==='hunt-food-place'){assert.equal(input(a,'down',[0,0]),false);tick(a,3);assert.equal(cp(a).stage,stage);}
  if(stage==='hunt-shot-hit'){input(a,'down',[0,0]);tick(a,2);input(a,'up',[0,0]);assert.equal(cp(a).stage,stage);}
  for(let i=0;i<100&&cp(a).stage!=='raising-battle-ready';i++)await one(a);
  assert.equal(cp(a).stage,'raising-battle-ready',stage+' must remain completable after reload');
  assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline,stage);
  await a.dispose();
 }
});

test('capture and return save failures hold the checkpoint and retry without double collection',async t=>{
 for(const stage of ['hunt-first-collect','hunt-final-collect','hunt-return-wait']){
  const {app:a,storage,baseline}=await fixture(t,stage),before=cp(a),bytes=storage.getItem(KEY);
  storage.fail=true;await one(a);
  assert.equal(a.getInteractiveTutorial().pendingSave,true,stage);
  assert.deepEqual(cp(a),before);assert.equal(storage.getItem(KEY),bytes);
  const cards=a.getHuntRuntime().getOnCardEntries().length;
  assert.equal(input(a,'down',[800,800]),false);tick(a,300);
  assert.equal(a.getHuntRuntime().getOnCardEntries().length,cards);
  storage.fail=false;a.persistenceFacade().retry();
  assert.equal(cp(a).stage,TUTORIAL_HUNT_STEPS[stage].next);
  assert.equal(input(a,'down',[800,800],before),false);
  if(stage==='hunt-return-wait'){assert.equal(a.getScreen(),'RAISING_HOME');assert.equal(a.getHuntRuntime(),null);}
  else assert.equal(a.getHuntRuntime().getOnCardEntries().length,cards);
  assert.deepEqual(normal(storage.getItem(KEY)),baseline);
 }
});

test('camera completion requires visible target and legacy enclosure cannot bypass tutorial gates',async t=>{
 const {app:a}=await fixture(t,'hunt-camera'),before=cp(a);
 input(a,'camera',[2000,2000,390,500]);assert.deepEqual(cp(a),before);
 assert.equal(a.beginEnclosureStroke(800,800),false);
 assert.equal(a.extendEnclosureStroke(900,800),false);assert.equal(a.endEnclosureStroke(),null);
 input(a,'camera',[-2000,-2000,390,500]);
 const camera=a.getHuntRuntime().getCamera(390,500),target=a.getHuntRuntime().getWildCreatures()[0];
 input(a,'camera',[target.worldX-(camera.left+camera.right)/2,target.worldY-(camera.top+camera.bottom)/2,390,500]);
 assert.equal(cp(a).stage,'hunt-explain');
});

test('exit from Hunt publishes Raising and failed exit can safely retry',async t=>{
 const {app:a,storage,baseline}=await fixture(t,'hunt-final-capture');let publications=0;
 const stop=a.subscribeScreen(()=>publications++);const before=storage.getItem(KEY);storage.fail=true;
 const result=await a.exitInteractiveTutorial(cp(a));assert.equal(result.ok,false);
 assert.equal(a.getScreen(),'RAISING_HOME');assert.equal(a.getHuntRuntime(),null);assert.ok(publications>0);
 assert.equal(storage.getItem(KEY),before);assert.equal(a.getInteractiveTutorial().pendingSave,true);
 storage.fail=false;a.persistenceFacade().retry();
 assert.equal(cp(a).stage,'declined');assert.deepEqual(normal(storage.getItem(KEY)),baseline);stop();
});

// Resizing tutorial copy must cancel a held user gesture, not the script's controls.
test('idle UI cancellation leaves the real tutorial rope, pull and hand demonstration completable',async t=>{
 const {app:a,storage,baseline}=await fixture(t,'hunt-demo-rope');
 const pointer=createHuntFieldPointer({getView:()=>null,intents:{abortEnclosureStroke:()=>a.getHuntRuntime().abortEnclosureStroke()}});
 for(const [active,next] of [['hunt-demo-rope','hunt-demo-pull-intro'],['hunt-demo-pull','hunt-demo-hand-intro'],['hunt-demo-hand','hunt-practice-intro']]){
  if(a.getInteractiveTutorial().dialogue)a.acknowledgeInteractiveTutorial(cp(a));
  assert.equal(cp(a).stage,active);
  for(let n=0;n<600&&cp(a).stage===active;n++){pointer.cancel();tick(a);}
  assert.equal(cp(a).stage,next,active+' survives layout resize when no user pointer is held');
  assert.deepEqual(normal(storage.getItem(KEY)),baseline);
 }
});
