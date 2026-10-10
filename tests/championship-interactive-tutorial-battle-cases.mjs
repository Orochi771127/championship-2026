import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {TUTORIAL_BATTLE_STEPS} from '../src/championship/app/interactiveTutorialBattleSteps.js';
import {INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE} from '../src/championship/app/interactiveTutorialCheckpoint.js';
const KEY='championshipModernSave:v1',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cp=a=>a.getInteractiveTutorial().checkpoint;
const normal=bytes=>{const s=JSON.parse(bytes);delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;return s;};
async function fixture(t,stage='raising-battle-ready',message=0){
 const data=new Map(),storage={fail:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.fail)throw Error('TEST_SAVE_FAILURE');data.set(k,v);},removeItem:k=>data.delete(k)};
 const make=()=>createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:1,minute:2,second:3})});
 let app=make();await app.newGame({trainerName:'Test',eggName:'Egg'});app.save();
 const save=JSON.parse(storage.getItem(KEY));save.progression.nativeOpening={version:2,trainerName:'Test',tutorialStep:null,checkpoint:{version:1,stage,message}};
 await app.dispose();storage.setItem(KEY,JSON.stringify(save));app=make();await app.continueGame();t.after(()=>app.dispose());
 return {app,storage,baseline:normal(storage.getItem(KEY)),reload:async()=>{await app.dispose();app=make();await app.continueGame();return app;}};
}
async function one(a){
 const c=cp(a),t=a.getInteractiveTutorial();
 if(t.dialogue)return a.acknowledgeInteractiveTutorial(c);
 if(c.stage==='raising-battle-ready')return a.openInteractiveTutorialMenu('battle',c);
 const action=t.action;
 if(action==='end')return a.endInteractiveTutorialBattle(c);
 const value=action==='kind'?'TITLE_MATCH':action==='match'?61:action==='member'?[0,1,2].find(i=>!(c.message&(1<<i))):null;
 assert.equal(a.interactiveBattleInput(action,value,c),true,c.stage);
}
async function menu(a){for(let i=0;i<30&&cp(a).stage!=='battle-running';i++)await one(a);assert.equal(cp(a).stage,'battle-running');}
function fight(a){
 const runtime=a.getInteractiveTutorialBattle().runtime,source=runtime.startMatch();let frames=0;
 while(!runtime.outcome().ended&&frames++<100000)source.tick();
 assert.equal(runtime.outcome().ended,true,'real core must reach a verdict');
 const result=runtime.outcome();assert.equal(a.finishInteractiveTutorialBattle(cp(a)),true);return {frames,result};
}
async function complete(a){for(let i=0;i<6&&!a.getInteractiveTutorial().finished;i++)await one(a);assert.equal(cp(a).stage,'completed');}

test('existing Battle core61 / entry4 / mode1 / demo roster finishes truthfully and restores baseline atomically',async t=>{
 const f=await fixture(t),a=f.app;await menu(a);
 const b=a.getInteractiveTutorialBattle();assert.deepEqual(b.individuals.map(x=>x.nativeProfile.fields['000']),[189,212,207]);
 assert.deepEqual(b.runtime.listMatches().map(x=>x.recordIndex),[61]);assert.equal(b.match.arenaIndex,9);
 assert.equal(b.runtime.getEconomyContext().mode,1);assert.equal(b.runtime.getEconomyContext().battleType,0);
 assert.equal(a.finishInteractiveTutorialBattle(cp(a)),false);assert.equal(a.finishMatch({}).reason,'INTERACTIVE_TUTORIAL_ISOLATED');
 assert.equal((await a.enterMatch({recordIndex:61,mode:1,battleType:0})).reason,'INTERACTIVE_TUTORIAL_ISOLATED');
 const actual=fight(a);console.log('actual tutorial battle',actual);assert.deepEqual(a.getInteractiveTutorialBattle().outcome,actual.result);
 assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);await complete(a);
 assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);assert.equal(a.getScreen(),'RAISING_HOME');assert.equal(a.getInteractiveTutorialBattle(),null);
 assert.equal((await f.reload()).getInteractiveTutorial().finished,true);assert.equal(INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE,true);
});

test('every semantic menu checkpoint reloads, rejects stale/wrong intent and preserves mask7 requirement',async t=>{
 for(const [stage,step] of Object.entries(TUTORIAL_BATTLE_STEPS).filter(([,s])=>!s.screen)){
  for(const message of Array.from({length:step.count},(_,i)=>i)){
   const f=await fixture(t,stage,message),a=f.app,before=cp(a);
   assert.equal(a.interactiveBattleInput('start',null,before),stage==='battle-start');
   if(stage!=='battle-start')assert.deepEqual(cp(a),before);
   assert.equal(a.interactiveBattleInput('member',0,{...before,stage:'raising-intro'}),false);
   if(stage==='battle-kind')assert.equal(a.interactiveBattleInput('kind','PASSWORD_BATTLE',before),false);
   if(stage==='battle-match')assert.equal(a.interactiveBattleInput('match',0,before),false);
   await menu(a);assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);await a.dispose();
  }
 }
});

test('party/start/result save failures remain isolated and retry exactly once',async t=>{
 for(const [stage,message] of [['battle-party-select',3],['battle-start',0],['battle-running',0]]){
  const f=await fixture(t,stage,message),a=f.app,before=cp(a),bytes=f.storage.getItem(KEY);f.storage.fail=true;
  if(stage==='battle-running')fight(a);else await one(a);
  assert.equal(a.getInteractiveTutorial().pendingSave,true);assert.deepEqual(cp(a),before);assert.equal(f.storage.getItem(KEY),bytes);
  assert.equal(a.interactiveBattleInput('start',null,before),false);
  f.storage.fail=false;a.persistenceFacade().retry();assert.notDeepEqual(cp(a),before);const saved=f.storage.getItem(KEY);
  const checkpoint=cp(a);a.persistenceFacade().retry();assert.deepEqual(cp(a),checkpoint);assert.deepEqual(normal(f.storage.getItem(KEY)),normal(saved));assert.deepEqual(normal(saved),f.baseline);
 }
});

test('unfinished Battle reload repeats the same entry seed; real verdict/HP are reproducible without reroll',async t=>{
 const f=await fixture(t,'battle-running');let a=f.app;const first=a.getInteractiveTutorialBattle().runtime.startMatch();
 const initial=first.getFrame();for(let i=0;i<90;i++)first.tick();a=await f.reload();
 assert.deepEqual(a.getInteractiveTutorialBattle().runtime.startMatch().getFrame(),initial);
 const actual=fight(a),saved=f.storage.getItem(KEY);a=await f.reload();
 assert.deepEqual(a.getInteractiveTutorialBattle().outcome,actual.result);assert.equal(f.storage.getItem(KEY),saved);await complete(a);
 assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);
});

test('saved win/loss/level result resumes true display and explicit safe end, without native-outcome claims',async t=>{
 for(const [stage,verdict,team] of [['battle-result-win','TEAM_ZERO_AHEAD',0],['battle-result-loss','TEAM_ONE_AHEAD',1],['battle-result-draw','LEVEL',null]]){
  for(const message of [0,1]){const f=await fixture(t,stage,message),a=f.app;
   assert.deepEqual(a.getInteractiveTutorialBattle().outcome,{ended:true,reason:message?'TIME_UP':'TEAM_DOWN',verdict,winningTeam:team});
   assert.throws(()=>a.getInteractiveTutorialBattle().runtime.outcome(),/NO_MATCH_STARTED/);
   await complete(a);assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);
  }
 }
});

test('completion and Battle exit failures keep baseline and allow save retry or safe reload',async t=>{
 for(const stage of ['raising-after-battle','battle-party-select','battle-running']){
  const f=await fixture(t,stage),a=f.app;
  if(stage==='raising-after-battle')await one(a);
  const before=f.storage.getItem(KEY);f.storage.fail=true;
  const result=stage==='raising-after-battle'?await one(a):await a.exitInteractiveTutorial(cp(a));
  assert.equal(result.ok,false);assert.equal(f.storage.getItem(KEY),before);assert.equal(a.getInteractiveTutorial().pendingSave,true);
  f.storage.fail=false;a.persistenceFacade().retry();assert.equal(cp(a).stage,stage==='raising-after-battle'?'completed':'declined');
  assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);
 }
});

test('each menu/dialogue safe checkpoint survives a failed next save and reload before retry',async t=>{
 for(const [stage,step] of Object.entries(TUTORIAL_BATTLE_STEPS).filter(([,s])=>!s.screen||s.screen==='RAISING_HOME')){
  for(let message=0;message<step.count;message++){
   const f=await fixture(t,stage,message);let a=f.app;const before=cp(a),bytes=f.storage.getItem(KEY);
   f.storage.fail=true;await one(a);assert.equal(a.getInteractiveTutorial().pendingSave,true,stage+':'+message);
   assert.equal(f.storage.getItem(KEY),bytes);f.storage.fail=false;a=await f.reload();assert.deepEqual(cp(a),before);
   await one(a);assert.equal(a.getInteractiveTutorial().pendingSave,false);assert.notDeepEqual(cp(a),before);
   assert.deepEqual(normal(f.storage.getItem(KEY)),f.baseline);await a.dispose();
  }
 }
});
