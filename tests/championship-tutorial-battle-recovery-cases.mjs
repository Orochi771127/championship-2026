import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createBattleFieldView} from '../src/championship/app/vs5Screens.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {setLocale} from '../src/championship/text/locale.js';
import {uiText} from '../src/championship/text/uiText.js';
import {createControlledDocument} from './helpers/battle-navigation-dom.mjs';

const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const frame={arena:{identifier:'BATTLE_NORMAL'},clock:{ratio:1,tier:0},combatants:[],outcome:{ended:false}};

function viewFixture(t,options={}){
  const previous=globalThis.document,document=globalThis.document=createControlledDocument();
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;setLocale('zh-Hant');});
  const root=document.createElement('main');document.body.append(root);
  let callbacks,disposals=0;
  const view=createBattleFieldView({root,frame,mountField(value){callbacks=value;return {dispose(){disposals++;}};},...options});
  return {root,view,get callbacks(){return callbacks;},get disposals(){return disposals;},
    recovery:root.querySelector('[data-load-action="return"]'),
    loading:root.querySelector('.cm-vs5-field__loading'),
    message:root.querySelector('.cm-vs5-field__loading-text'),
    exit:root.querySelector('.cm-vs5-exit')};
}

test('tutorial load error exposes save-and-title while ordinary exit stays locked',async t=>{
  let exits=0;const gate=deferred(),f=viewFixture(t,{onLoadErrorExit:()=>{exits++;return gate.promise;}});
  assert.equal(f.exit.hidden,true);assert.equal(f.recovery.hidden,true);
  f.recovery.click();await flush();assert.equal(exits,0,'a loading or ready tutorial cannot use error-only recovery');
  f.callbacks.onError();
  assert.equal(f.exit.hidden,true);assert.equal(f.recovery.hidden,false);
  assert.equal(f.recovery.textContent,uiText('FIELD_LOAD_RETURN'));
  assert.equal(f.message.textContent,uiText('BATTLE_LOAD_ERROR_TUTORIAL'));
  f.recovery.click();f.recovery.click();await flush();
  assert.equal(exits,1);assert.equal(f.recovery.disabled,true,'double taps cannot duplicate save/navigation');
  gate.resolve(false);await flush();
  assert.equal(f.message.textContent,uiText('FIELD_LOAD_SAVE_FAILED'));
  assert.equal(f.recovery.disabled,false);assert.equal(f.loading.parentNode!==null,true);
  f.view.dispose();
});

test('failed save remains recoverable and a later retry can navigate once',async t=>{
  let attempts=0;const f=viewFixture(t,{onLoadErrorExit:async()=>++attempts>1});
  f.callbacks.onError();f.recovery.click();await flush();
  assert.equal(attempts,1);assert.equal(f.recovery.disabled,false);
  f.recovery.click();await flush();assert.equal(attempts,2);f.view.dispose();
});

test('recovery rejection leaves the view and permits retry',async t=>{
  const previous=console.warn;console.warn=()=>{};t.after(()=>{console.warn=previous;});
  const f=viewFixture(t,{onLoadErrorExit:async()=>{throw Error('SAVE_CONFLICT');}});
  f.callbacks.onError();f.recovery.click();await flush();
  assert.equal(f.recovery.disabled,false);assert.equal(f.loading.parentNode!==null,true);
  assert.equal(f.message.textContent,uiText('FIELD_LOAD_SAVE_FAILED'));f.view.dispose();
});

test('disposed or ready views ignore stale error recovery and late load callbacks',async t=>{
  let exits=0;const f=viewFixture(t,{onLoadErrorExit:async()=>{exits++;return true;}});
  f.callbacks.onError();f.callbacks.onReady();f.recovery.click();await flush();
  assert.equal(exits,0);assert.equal(f.loading.parentNode,null);
  f.view.dispose();const message=f.message.textContent;
  f.callbacks.onError();f.callbacks.onReady();f.recovery.click();await flush();
  assert.equal(exits,0);assert.equal(f.message.textContent,message);
  assert.equal(f.root.children.length,0);assert.equal(f.disposals,1);
});

test('normal battle retains its existing exit and does not expose tutorial recovery',async t=>{
  let exits=0;const f=viewFixture(t,{onExit:()=>{exits++;}});
  f.callbacks.onError();assert.equal(f.recovery.hidden,true);assert.equal(f.exit.hidden,false);
  assert.equal(f.message.textContent,uiText('對戰場地載入失敗，請返回牧場後再試。'));
  f.exit.click();await flush();assert.equal(exits,1);f.view.dispose();
});

for(const locale of ['zh-Hant','en','ja','th','vi'])test(`${locale}: tutorial load error names the available title recovery`,t=>{
  setLocale(locale);const f=viewFixture(t,{onLoadErrorExit:async()=>true});f.callbacks.onError();
  assert.notEqual(f.message.textContent,'BATTLE_LOAD_ERROR_TUTORIAL');
  assert.notEqual(f.recovery.textContent,'FIELD_LOAD_RETURN');
  assert.ok(f.message.textContent.length>15);assert.ok(f.recovery.textContent.length>0);f.view.dispose();
});

// Evaluate the shipped owner callback with the actual standalone app. This is
// a domain/DOM regression gate, not a browser, GPU or network acceptance claim.
const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
const marker='    onLoadErrorExit: tutorial ? async () => {';
const start=main.indexOf(marker),end=main.indexOf('\n  });\n  // Same optional-HUD',start);
assert.ok(start>=0&&end>start,'tutorial recovery owner must be supplied by the app');
const binding=main.slice(start,end);
function recoveryOwner(app,returnToTitle){
  const context=vm.createContext({tutorial:true,viewDisposed:false,app,
    CHAMPIONSHIP_SCREENS:{BATTLE_FIELD:'BATTLE_FIELD'},
    activeRuntime:app.getInteractiveTutorialBattle().runtime,returnToTitle});
  return {context,exit:vm.runInContext('({'+binding+'}).onLoadErrorExit',context)};
}
async function tutorialApp(t){
  const KEY='championshipModernSave:v1',data=new Map();
  const storage={fail:false,getItem:key=>data.get(key)??null,setItem(key,value){if(this.fail)throw Error('TEST_SAVE_FAILURE');data.set(key,value);},removeItem:key=>data.delete(key)};
  const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  const app=createChampionshipStandaloneApp({storage,locks:null,
    catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:1,minute:2,second:3})});
  await app.newGame({trainerName:'QA',eggName:'Egg'});app.save();
  const seed=JSON.parse(storage.getItem(KEY));
  seed.progression.nativeOpening={version:2,trainerName:'QA',tutorialStep:null,checkpoint:{version:1,stage:'battle-running',message:0}};
  await app.dispose();storage.setItem(KEY,JSON.stringify(seed));await app.continueGame();
  t.after(()=>app.dispose());
  return {app,storage,raw:()=>storage.getItem(KEY)};
}
function baseline(bytes){
  const save=JSON.parse(bytes);delete save.updatedAt;delete save.progression.revision;delete save.progression.nativeOpening;
  save.raisingHome=JSON.parse(save.raisingHome);delete save.raisingHome.revision;return save;
}

test('real tutorial saves its checkpoint, returns safely, and Continue retries without changing baseline or outcome',async t=>{
  const f=await tutorialApp(t),checkpoint=f.app.getInteractiveTutorial().checkpoint,before=baseline(f.raw());
  const events=[],returned=deferred();let ui;
  const owner=recoveryOwner(f.app,async source=>{
    events.push(source);ui.view.dispose();owner.context.viewDisposed=true;
    f.app.getInteractiveTutorialBattle().runtime.dispose();await f.app.dispose();returned.resolve();
  });
  ui=viewFixture(t,{onLoadErrorExit:owner.exit});
  assert.equal(ui.recovery.hidden,true);ui.callbacks.onError();
  assert.equal(ui.recovery.hidden,false);ui.recovery.click();await returned.promise;await flush();
  assert.deepEqual(events,['tutorial-battle-load-return']);
  assert.deepEqual(JSON.parse(f.raw()).progression.nativeOpening.checkpoint,checkpoint);
  assert.deepEqual(baseline(f.raw()),before);
  await f.app.continueGame();
  assert.equal(f.app.getScreen(),'BATTLE_FIELD');assert.deepEqual(f.app.getInteractiveTutorial().checkpoint,checkpoint);
  assert.equal(f.app.getInteractiveTutorialBattle().runtime.startMatch().getFrame().outcome.ended,false);
  assert.deepEqual(baseline(f.raw()),before);
});

test('failed real tutorial save cannot return to title or change the saved checkpoint',async t=>{
  const f=await tutorialApp(t),before=f.raw(),checkpoint=f.app.getInteractiveTutorial().checkpoint;let titles=0;
  const owner=recoveryOwner(f.app,async()=>{titles++;});f.storage.fail=true;
  const ui=viewFixture(t,{onLoadErrorExit:owner.exit});ui.callbacks.onError();ui.recovery.click();await flush();
  assert.equal(titles,0);assert.equal(f.raw(),before);assert.equal(ui.recovery.disabled,false);
  assert.equal(ui.message.textContent,uiText('FIELD_LOAD_SAVE_FAILED'));
  assert.equal(f.app.getScreen(),'BATTLE_FIELD');assert.deepEqual(f.app.getInteractiveTutorial().checkpoint,checkpoint);
  f.storage.fail=false;ui.recovery.click();await flush();assert.equal(titles,1);ui.view.dispose();
});

test('an abandoned tutorial owner cannot write or leave a newer screen',async()=>{
  let saves=0,titles=0,screen='BATTLE_FIELD';const runtime={};
  const app={getInteractiveTutorialBattle:()=>({runtime}),getScreen:()=>screen,save(){saves++;return {phase:'SAVED'};}};
  const owner=recoveryOwner(app,async()=>{titles++;});owner.context.viewDisposed=true;
  assert.equal(await owner.exit(),false);owner.context.viewDisposed=false;screen='RAISING_HOME';
  assert.equal(await owner.exit(),false);screen='BATTLE_FIELD';owner.context.activeRuntime={};
  assert.equal(await owner.exit(),false);assert.equal(saves,0);assert.equal(titles,0);
});
