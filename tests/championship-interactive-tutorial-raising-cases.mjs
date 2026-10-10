import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {TUTORIAL_RAISING_STEPS} from '../src/championship/app/interactiveTutorialRaisingSteps.js';
import {normalizeInteractiveTutorialCheckpoint} from '../src/championship/app/interactiveTutorialCheckpoint.js';
const KEY='championshipModernSave:v1';
const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json'));
const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages;
function fixture(t,bytes=null){
 const data=new Map(bytes?[[KEY,bytes]]:[]),storage={fail:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.fail)throw Error('TEST_SAVE_FAILURE');data.set(k,v);},removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog,cages,now:()=> '2026-10-09T12:00:00Z',rngClock:()=>({hour:1,minute:2,second:3})});
 t.after(()=>app.dispose());return {app,storage};
}
const cp=a=>a.getInteractiveTutorial().checkpoint;
const frame=a=>a.getRaisingActorFrame(a.getCreature().creatureId);
const id=a=>a.getCreature().creatureId;
const tick=(a,n)=>{while(n>0){const size=Math.min(120,n);a.advanceRaisingPresentation({frames:size});n-=size;}};
function normal(bytes){const s=JSON.parse(bytes);delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;return s;}
async function start(t){const f=fixture(t);await f.app.newGame({trainerName:'玩家甲',eggName:'小蛋乙'});f.app.save();f.baseline=normal(f.storage.getItem(KEY));f.app.offerInteractiveTutorial();await f.app.chooseInteractiveTutorial(true);return f;}
function drag(a,x,y,{cancelled=false}={}){
 const checkpoint=cp(a),p=frame(a).positionQ12;
 assert.equal(a.beginRaisingHand(id(a),{x:p[0]/4096,y:p[1]/4096,checkpoint}),true);
 tick(a,12);assert.equal(frame(a).state,6);
 assert.equal(a.updateRaisingHand(id(a),{x,y,inside:true,checkpoint}),true);tick(a,30);
 assert.equal(a.endRaisingHand(id(a),{cancelled,checkpoint}),true);
}
function one(a,allowFailedSave=false){
 const t=a.getInteractiveTutorial(),checkpoint=cp(a),s=checkpoint.stage;
 if(t.dialogue){const result=a.acknowledgeInteractiveTutorial(checkpoint);assert.equal(result.ok,!(allowFailedSave&&a.getInteractiveTutorial().pendingSave));return;}
 if(t.action==='select'){assert.equal(a.selectInteractiveTutorialTool(t.tool,checkpoint),true);return;}
 if(s==='raising-feed-place'){assert.equal(a.placeRaisingFood({x:100,y:120,checkpoint}).ok,true);return;}
 if(s==='raising-clean'){
   const mask=checkpoint.message-1,index=[0,1,2].find(i=>!(mask&(1<<i)));
   if(index!==undefined){const [x,y]=[[100,112],[160,92],[80,72]][index];assert.equal(a.cleanRaisingFood({x,y,checkpoint}),true);}
   tick(a,21);return;
 }
 if(s==='raising-illness-treat'||s==='raising-injury-treat'){assert.equal(a.treatRaisingResident(id(a),s.includes('illness')?1:0,checkpoint).ok,true);return;}
 if(s==='raising-camera'){assert.equal(a.selectInteractiveTutorialTool('hand',checkpoint),true);assert.equal(a.panInteractiveTutorial({x:100,checkpoint,tool:'hand'}),true);return;}
 if(s==='raising-training-drop'||s==='raising-recovery-drop'){drag(a,s.includes('training')?280:380,s.includes('training')?80:112);tick(a,120);return;}
 if(s==='raising-gate-menu'){assert.equal(a.openInteractiveTutorialMenu('hunt',checkpoint),true);return;}
 tick(a,120);
}
function until(a,stage,limit=100){for(let i=0;i<limit&&cp(a).stage!==stage;i++)one(a);assert.equal(cp(a).stage,stage,JSON.stringify(frame(a)));}

test('whole Raising uses real predicates, food/treatment/cage core, special sleep, and isolated menu boundary',async t=>{
 const {app:a,storage,baseline}=await start(t),seen=new Set();
 for(let i=0;i<200&&cp(a).stage!=='raising-gate-ready';i++){
   const before=cp(a);seen.add(before.stage);one(a);
   assert.deepEqual(normal(storage.getItem(KEY)),baseline,before.stage);
 }
 assert.equal(cp(a).stage,'raising-gate-ready');assert.equal(a.getInteractiveTutorial().available,true);
 assert.equal(frame(a).state,4);assert.equal(a.getScreen(),'RAISING_HOME');
 for(const stage of Object.keys(TUTORIAL_RAISING_STEPS).filter(s=>s!=='raising-gate-ready'))assert.ok(seen.has(stage),stage);
 assert.equal(a.getCreature().displayName,'小蛋乙');assert.equal(a.getCreature().nativeProfile.fields['138'],0);assert.equal(a.getCreature().nativeProfile.fields['134'],0);
 await a.exitInteractiveTutorial(cp(a));a.save();assert.deepEqual(normal(storage.getItem(KEY)),baseline);assert.equal(frame(a).speciesIndex,0);
});

test('wrong tool, wrong ground point, stale input, two cleaned targets, cancelled and wrong-cage drops cannot advance',async t=>{
 const {app:a}=await start(t);until(a,'raising-feed-select');const old=cp(a);
 assert.equal(a.selectInteractiveTutorialTool('clean',old),false);assert.equal(a.placeRaisingFood({x:100,y:120,checkpoint:old}).ok,false);
 one(a);one(a);const feed=cp(a);assert.equal(a.placeRaisingFood({x:220,y:130,checkpoint:feed}).ok,false);
 assert.equal(a.placeRaisingFood({x:100,y:120,protein:true,checkpoint:feed}).ok,false);assert.equal(a.placeRaisingFood({x:100,y:120,checkpoint:old}).ok,false);
 one(a);assert.ok(a.getRaisingFoodFrame().length);tick(a,90);assert.ok([2,5,9,1].includes(frame(a).state));
 assert.ok(a.getRaisingFoodFrame()[0].remaining<16,'a real animation bite consumes the demonstration food');
 until(a,'raising-clean');one(a);
 for(const [x,y] of [[100,112],[160,92]]){assert.equal(a.cleanRaisingFood({x,y,checkpoint:cp(a)}),true);tick(a,21);}
 tick(a,600);assert.equal(cp(a).stage,'raising-clean');assert.equal(cp(a).message,4);
 assert.equal(a.cleanRaisingFood({x:230,y:80,checkpoint:cp(a)}),false);
 until(a,'raising-training-drop');const drop=cp(a);
 const position=frame(a).positionQ12;
 assert.equal(a.beginRaisingHand(id(a),{x:position[0]/4096,y:position[1]/4096,checkpoint:drop}),true);
 tick(a,3);assert.equal(frame(a).state,1);tick(a,1);assert.equal(frame(a).state,6);
 a.endRaisingHand(id(a),{cancelled:true,checkpoint:drop});
 drag(a,100,80,{cancelled:true});tick(a,120);assert.deepEqual(cp(a),drop);
 drag(a,100,80);tick(a,120);assert.deepEqual(cp(a),drop);assert.equal(frame(a).cageDefinitionIndex,35);
 assert.equal(a.endRaisingHand(id(a),{checkpoint:feed}),false);
 until(a,'raising-recovery-drop');const recovery=cp(a);
 assert.equal(a.getCreature().nativeProfile.fields['050'],1);drag(a,100,80);tick(a,120);assert.deepEqual(cp(a),recovery);
 assert.equal(frame(a).cageDefinitionIndex,1);
 until(a,'raising-gate-menu');tick(a,600);assert.equal(frame(a).state,4);assert.equal(cp(a).stage,'raising-gate-menu');
 assert.equal(a.openInteractiveTutorialMenu('battle',cp(a)),false);assert.equal(a.acknowledgeInteractiveTutorial(cp(a)).ok,false);
});

test('every declared semantic boundary reloads, blocks stale input, and can exit without altering baseline',async t=>{
 const {app:a,storage,baseline}=await start(t),snapshots=new Map();
 for(let i=0;i<250;i++){
   snapshots.set(cp(a).stage+':'+cp(a).message,storage.getItem(KEY));
   if(cp(a).stage==='raising-gate-ready')break;one(a);
 }
 for(const [key,bytes] of snapshots){
   const f=fixture(t,bytes);await f.app.continueGame();assert.equal(cp(f.app).stage+':'+cp(f.app).message,key);
   assert.equal(frame(f.app).actorAuthority,'TUTORIAL_SPECIAL_19_STATE');
   assert.equal(f.app.openInteractiveTutorialMenu('hunt',{version:1,stage:'raising-intro',message:0}),false);
   f.app.save();assert.deepEqual(normal(f.storage.getItem(KEY)),baseline,key);
   until(f.app,"raising-gate-ready",200);
   await f.app.exitInteractiveTutorial(cp(f.app));f.app.save();assert.deepEqual(normal(f.storage.getItem(KEY)),baseline,key);
 }
 for(const [stage,step] of Object.entries(TUTORIAL_RAISING_STEPS)){
   for(let message=0;message<step.count;message++)assert.doesNotThrow(()=>normalizeInteractiveTutorialCheckpoint({version:1,stage,message}));
   assert.throws(()=>normalizeInteractiveTutorialCheckpoint({version:1,stage,message:step.count}));
 }
 assert.throws(()=>normalizeInteractiveTutorialCheckpoint({version:1,stage:{toString:()=> 'raising-hatch'},message:0}));
});

test('failed operation checkpoint preserves bytes, freezes actor, retries once, and resumes without duplicate stock or reward',async t=>{
 const {app:a,storage,baseline}=await start(t);until(a,'raising-illness-treat');one(a);
 const before=storage.getItem(KEY),checkpoint=cp(a);storage.fail=true;
 assert.equal(a.treatRaisingResident(id(a),1,checkpoint).ok,true);assert.equal(a.getInteractiveTutorial().pendingSave,true);
 const f=frame(a),rng=a.getGameplayRngState();tick(a,600);assert.deepEqual(frame(a),f);assert.deepEqual(a.getGameplayRngState(),rng);assert.equal(storage.getItem(KEY),before);
 assert.equal(a.treatRaisingResident(id(a),1,checkpoint).ok,false);storage.fail=false;a.persistenceFacade().retry();assert.equal(cp(a).stage,'raising-illness-wait');
 assert.deepEqual(a.getGameplayRngState(),rng);assert.deepEqual(normal(storage.getItem(KEY)),baseline);
 until(a,'raising-gate-ready');assert.deepEqual(normal(storage.getItem(KEY)),baseline);
});

test('each Raising transition can fail its canonical write and resume once through the same retry owner',async t=>{
 const {app:a,storage,baseline}=await start(t),failed=new Set();
 for(let i=0;i<250&&cp(a).stage!=='raising-gate-ready';i++){
   const before=storage.getItem(KEY),previous=cp(a);storage.fail=true;one(a,true);
   if(a.getInteractiveTutorial().pendingSave){
     failed.add(previous.stage+':'+previous.message);assert.equal(storage.getItem(KEY),before);
     const actorBefore=frame(a),rng=a.getGameplayRngState();tick(a,120);
     assert.deepEqual(frame(a),actorBefore);assert.deepEqual(a.getGameplayRngState(),rng);
     storage.fail=false;a.persistenceFacade().retry();assert.equal(a.getInteractiveTutorial().pendingSave,false);
     assert.deepEqual(normal(storage.getItem(KEY)),baseline);
   }else storage.fail=false;
 }
 assert.equal(cp(a).stage,'raising-gate-ready');assert.ok(failed.size>=45);
});

test('all partial three-target masks survive reload independently of cleaning order',async t=>{
 const {app:a,storage}=await start(t);until(a,'raising-clean');one(a);const initial=storage.getItem(KEY);
 const targets=[[100,112],[160,92],[80,72]],masks=new Set();
 for(const order of [[0,1,2],[1,2,0],[2,0,1]]){
   const f=fixture(t,initial);await f.app.continueGame();let mask=0;
   for(const index of order.slice(0,2)){
     const [x,y]=targets[index];f.app.cleanRaisingFood({x,y,checkpoint:cp(f.app)});tick(f.app,21);mask|=1<<index;masks.add(mask);
     assert.equal(cp(f.app).message,mask+1);
     const resumed=fixture(t,f.storage.getItem(KEY));await resumed.app.continueGame();
     assert.equal(cp(resumed.app).message,mask+1);assert.equal(resumed.app.getRaisingFoodFrame().length+resumed.app.getRaisingWasteFrame().length,3-order.slice(0,2).indexOf(index)-1);
     until(resumed.app,'raising-illness-intro');
   }
 }
 assert.deepEqual([...masks].sort((a,b)=>a-b),[1,2,3,4,5,6]);
});
