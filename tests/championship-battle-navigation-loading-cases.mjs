import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createLoadAttempt} from '../src/championship/app/loadWatchdog.js';
import {mountBattleResultCharacters} from '../src/championship/presentation/battleResultCharacters.js';
import {createBattleResultView} from '../src/championship/app/vs5Screens.js';
import {createControlledDocument} from './helpers/battle-navigation-dom.mjs';

const main=fs.readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
const between=(start,end)=>main.slice(main.indexOf(start),main.indexOf(end));
// Only the lazy view import is substituted. Both real owners and the existing
// serial mount authority execute; result textures use the real presenter.
const owners=(between('async function mountBattleField() {','/** Developer readout:')+'\n'
  +between('async function mountBattleResult() {','async function mountGateSelect() {')+'\n'
  +between('async function mountCurrentScreen() {','// An explicit acceptance-testing grant'))
  .replaceAll("await import('./vs5Screens.js')",'await loadViews()');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const cell=src=>({src,width:4,height:4,origin:[2,4]});
const texture=()=>({source:{},orig:{width:4,height:4}});
const hud=cells=>({getBattleCells:()=>cells,getBattleFrame:()=>cells[0]??null});

function stageFixture(load=async()=>texture()){
  const events=[],roots=[],sprites=[],unloads=[],loads=[],ticks=new Set(),resizes=new Set();
  const vector=()=>({x:0,y:0,set(x,y=x){this.x=x;this.y=y;}});
  const stage={PIXI:{Sprite:class{constructor(){this.anchor=vector();this.position=vector();this.scale=vector();sprites.push(this);}},
    Assets:{load(src){loads.push(src);return load(src);},unload:async src=>{unloads.push(src);}}},
    app:{screen:{width:390,height:700},ticker:{add(fn){ticks.add(fn);events.push('tick-add');},remove(fn){ticks.delete(fn);events.push('tick-remove');}}},
    createSceneRoot(){const root={destroyCount:0,addChild(){},destroy(){this.destroyCount++;}};roots.push(root);return root;},
    onResize(fn){resizes.add(fn);return()=>resizes.delete(fn);}};
  return {stage,events,roots,sprites,unloads,loads,ticks,resizes};
}

function ownerFixture(target,{hudLoad=async()=>hud([cell('result')]),stageLoad=null,stageData=stageFixture(),highlight=false}={}){
  let screen=target,options=null,raisingMounts=0,observer=null;
  const events=[],warnings=[],attempts=[],renders=[],hudUpdates=[],highlightStages=[],timers=new Set();
  const frame={combatants:[{present:true,speciesId:'species-001'}],arena:{identifier:'BATTLE_NORMAL'},outcome:{ended:false}};
  const source={getFrame:()=>frame,getView:()=>frame};
  const outcome={ended:true,verdict:'TEAM_ZERO_AHEAD',reason:'TEAM_DOWN',winningTeam:0};
  const runtime={startMatch:()=>source,prepareOpening(){},getChosenMatch:()=>null,localTeamIndex:()=>0,
    rosterEvidence:()=>'',observe(fn){observer=fn;},getResultParticipants:()=>[{speciesId:'species-001'}],outcome:()=>outcome,
    dispose(){events.push('runtime-dispose');}};
  const host={parentElement:null,getBoundingClientRect:()=>null};
  const newView=()=>({getCharacterHost:()=>host,setHudArt:art=>hudUpdates.push(art),render:view=>renders.push(view),dispose:()=>events.push('view-dispose')});
  const context=vm.createContext({AbortController,console:{warn:(...args)=>warnings.push(args)},URLSearchParams,performance,
    location:{href:'https://localhost/championship.html',search:''},
    CHAMPIONSHIP_SCREENS:{RAISING_HOME:'RAISING_HOME',BATTLE_FIELD:'BATTLE_FIELD',BATTLE_RESULT:'BATTLE_RESULT',SHOP:'SHOP',DATABASE:'DATABASE'},
    app:{getScreen:()=>screen,getInteractiveTutorialBattle:()=>null,getTitleProgress:()=>({record:{}}),
      getBattleReceipt:()=>highlight?{rewardBits:50,credited:50}:null,
      getBattleBadges:()=>[],leaveScreen(){screen='RAISING_HOME';events.push('exit-intent');}},
    battleRuntime:runtime,battleAttemptId:null,battleProgressBefore:null,mountedScreen:'PREVIOUS',mounting:Promise.resolve(),
    view:newView(),raisingSource:{},root:{dataset:{}},RESPONSIVE_BATTLE_CANDIDATE:false,BATTLE_DYNAMIC_FX:false,
    createLoadAttempt(options){
      const attempt=createLoadAttempt({...options,setTimer(fn,ms){const timer={fn,ms};timers.add(timer);return timer;},clearTimer:timer=>timers.delete(timer)});
      attempts.push(attempt);return attempt;
    },loadRegisteredCharacterHudArt:options=>hudLoad(options),
    loadViews:async()=>({createBattleFieldView(value){options=value;events.push('field-view');return newView();},
      createBattleResultView(value){options=value;events.push('result-view');if(highlight)value.highlight({});return newView();}}),
    ensurePixiStage:async(_host,signal)=>{const stage=stageLoad?await stageLoad(signal):stageData.stage;signal?.throwIfAborted();return stage;},
    mountBattleResultCharacters,classifyBattleResultFeedback:()=>highlight?'highlight':null,nativeBattleWinPercent:()=>null,
    playResultHighlight(_request,getStage){highlightStages.push(getStage);},
    resultHeroAnchor(){},resultStageLight(){},uiText:text=>text,showChoiceDialog(){},createLoadProgressView(){},
    observeLoadActivity(){},onPixiAssetSettled(){},mountRaisingHome:async()=>{raisingMounts++;return newView();},
    syncMusic(){},screenChangedAt:0,recoveryDiagnostics:{record(){}},document:{querySelector:()=>null}});
  vm.runInContext(owners,context);
  return {context,events,warnings,attempts,renders,hudUpdates,highlightStages,timers,stageData,
    run:()=>context.mountCurrentScreen(),exit(){options.onExit();return context.mountCurrentScreen();},
    reenter(nextTarget){screen=nextTarget;context.battleRuntime={...runtime};return context.mountCurrentScreen();},
    get raisingMounts(){return raisingMounts;},get options(){return options;},
    observe:()=>observer?.(frame),dispose:()=>context.view?.dispose?.()};
}

for(const target of ['BATTLE_FIELD','BATTLE_RESULT']){
  test(`${target} returns its view and navigates while optional HUD never settles`,async()=>{
    const gate=deferred(),f=ownerFixture(target,{hudLoad:()=>gate.promise});let mounted=false;
    const first=f.run().then(()=>mounted=true);await flush();assert.equal(mounted,true);
    assert.ok(f.events.includes(target==='BATTLE_FIELD'?'field-view':'result-view'));
    await first;await f.exit();assert.equal(f.raisingMounts,1);assert.equal(f.attempts[0].signal.aborted,true);
    assert.equal(f.timers.size,0);const renders=f.renders.length;
    gate.resolve(hud([cell('late')]));await flush();f.observe();
    assert.equal(f.hudUpdates.length,0);assert.equal(f.renders.length,renders);
    assert.equal(f.stageData.roots.length,0);assert.equal(f.warnings.length,0);f.dispose();
  });
}

test('late rejected HUD after abandonment neither updates an old view nor reports an obsolete error',async()=>{
  for(const target of ['BATTLE_FIELD','BATTLE_RESULT']){
    const gate=deferred(),f=ownerFixture(target,{hudLoad:()=>gate.promise});await f.run();await f.exit();
    gate.reject(Error('LATE_HUD_FAILURE'));await flush();assert.equal(f.hudUpdates.length,0);assert.equal(f.warnings.length,0);f.dispose();
  }
});

test('repeated exit and field reentry never let the abandoned HUD overwrite the current cards',async()=>{
  const old=deferred(),current=deferred();let calls=0;
  const f=ownerFixture('BATTLE_FIELD',{hudLoad:()=>++calls===1?old.promise:current.promise});
  await f.run();await f.exit();await f.reenter('BATTLE_FIELD');
  old.resolve(hud([cell('obsolete')]));await flush();assert.equal(f.renders.length,0);
  assert.equal(f.options.hudArt.getBattleFrame('species-001',0,0),null);
  current.resolve(hud([cell('current')]));await flush();assert.equal(f.renders.length,1);
  assert.equal(f.options.hudArt.getBattleFrame('species-001',0,0).src,'current');f.dispose();
});

test('a late field HUD becomes visible through the existing card proxy and render',async()=>{
  const gate=deferred(),f=ownerFixture('BATTLE_FIELD',{hudLoad:()=>gate.promise});await f.run();
  assert.equal(f.options.hudArt.getBattleFrame('species-001',0,0),null);
  const art=hud([cell('ready')]);gate.resolve(art);await flush();
  assert.equal(f.options.hudArt.getBattleFrame('species-001',0,0).src,'ready');assert.equal(f.renders.length,1);
  assert.equal(f.timers.size,0);f.dispose();f.observe();assert.equal(f.renders.length,1);
});

test('normal late result art updates its existing view, then mounts and disposes one scene',async()=>{
  const gate=deferred(),f=ownerFixture('BATTLE_RESULT',{hudLoad:()=>gate.promise});await f.run();
  assert.equal(f.hudUpdates.length,0);const art=hud([cell('ready')]);gate.resolve(art);await flush();
  assert.deepEqual(f.hudUpdates,[art]);assert.equal(f.stageData.roots.length,1);assert.equal(f.stageData.ticks.size,1);
  await f.exit();await flush();assert.equal(f.raisingMounts,1);assert.equal(f.stageData.roots[0].destroyCount,1);
  assert.equal(f.stageData.ticks.size,0);assert.equal(f.stageData.resizes.size,0);assert.deepEqual(f.stageData.unloads,['ready']);
});

test('highlight waits for its existing HUD anchor while the result view and navigation stay ready',async()=>{
  const gate=deferred(),f=ownerFixture('BATTLE_RESULT',{hudLoad:()=>gate.promise,highlight:true});await f.run();
  assert.ok(f.events.includes('result-view'));let ready=false;
  const highlight=f.highlightStages[0]().then(stage=>{ready=true;assert.equal(stage,f.stageData.stage);});
  await flush();assert.equal(ready,false);gate.resolve(hud([cell('hero')]));await highlight;await flush();
  assert.equal(f.hudUpdates.length,1);await f.exit();assert.equal(f.raisingMounts,1);
});

test('actual highlight owner skips and disposes immediately while its HUD/stage promise is pending',async()=>{
  const binding=between('function playResultHighlight(request, getStage, getAnchor = null) {','async function mountBattleResult() {');
  for(const close of [false,true]){
    const gate=deferred(),values=[],phases=[],sequences=[];
    const context=vm.createContext({console:{warn(){}},prefersReducedMotion:()=>false,highlightMode:()=> 'full',
      currentQuality:()=>({highlightDecor:true,shardLife:1,threePixelRatioCap:1,threeAntialias:false}),
      highlightOverrides:()=>({}),cappedPixelRatio:()=>1,createHighlightAudio:()=>({}),HIGHLIGHT_DEFAULTS:{audioGain:1},
      settings:{audio:{output:()=>({})}},mountHighlightBurstThree(){},
      createHighlightSequence(options){sequences.push(options);return {done:new Promise(()=>{}),start(){},skip(){},dispose(){}};}});
    vm.runInContext(binding,context);
    const request={host:{dataset:{}},focus:{},target:50,onValue:value=>values.push(value),onPhase:phase=>phases.push(phase)};
    const owner=context.playResultHighlight(request,()=>gate.promise,()=>({x:0.5,y:0.75}));await flush();
    assert.deepEqual(phases,[]);assert.equal(owner.skip(),true);assert.deepEqual(phases,['DONE']);assert.deepEqual(values,[50]);
    if(close)owner.dispose();const phaseCount=phases.length;
    gate.resolve({app:{ticker:{}}});await flush();assert.equal(sequences.length,0);
    if(close)assert.equal(phases.length,phaseCount,'no callbacks after disposal');else assert.equal(phases.at(-1),'DONE');
    owner.dispose();
  }
});

test('real pending result textures do not lock navigation; completed and late textures release',async()=>{
  const gate=deferred(),s=stageFixture(src=>src==='pending'?gate.promise:Promise.resolve(texture()));
  const f=ownerFixture('BATTLE_RESULT',{hudLoad:async()=>hud([cell('ready'),cell('pending')]),stageData:s});await f.run();await flush();
  assert.deepEqual(s.loads,['ready','pending']);assert.equal(s.roots.length,0);
  await f.exit();await flush();assert.equal(f.raisingMounts,1);assert.deepEqual(s.unloads,['ready']);
  gate.resolve(texture());await flush();assert.deepEqual(s.unloads,['ready','pending']);
  assert.equal(s.roots.length,0);assert.equal(s.ticks.size,0);assert.equal(f.warnings.length,0);
});

test('a pending shared stage is aborted on exit and cannot start result art later',async()=>{
  const gate=deferred();let stageSignal;
  const f=ownerFixture('BATTLE_RESULT',{stageLoad:signal=>{stageSignal=signal;return gate.promise;}});await f.run();await flush();
  await f.exit();assert.equal(stageSignal.aborted,true);gate.resolve(f.stageData.stage);await flush();
  assert.equal(f.stageData.loads.length,0);assert.equal(f.stageData.roots.length,0);assert.equal(f.warnings.length,0);
});

test('ordinary result stage rejection is handled while late HUD and navigation remain available',async()=>{
  const gate=deferred(),f=ownerFixture('BATTLE_RESULT',{hudLoad:()=>gate.promise,stageLoad:async()=>{throw Error('STAGE_FAILED');}});
  await f.run();await flush();assert.equal(f.warnings.length,1);assert.equal(f.stageData.roots.length,0);
  gate.resolve(hud([cell('medal-only')]));await flush();assert.equal(f.hudUpdates.length,1);
  await f.exit();assert.equal(f.raisingMounts,1);assert.equal(f.stageData.loads.length,0);
});

test('existing 20-second HUD timeout falls back without taking away the result view',async()=>{
  const gate=deferred(),f=ownerFixture('BATTLE_RESULT',{hudLoad:()=>gate.promise});await f.run();
  const [timer]=f.timers;assert.equal(timer.ms,20000);timer.fn();await flush();
  assert.equal(f.warnings.length,1);assert.equal(f.options.outcome.verdict,'TEAM_ZERO_AHEAD');
  await f.exit();assert.equal(f.raisingMounts,1);gate.reject(Error('IGNORED_LATE_FAILURE'));await flush();
  assert.equal(f.warnings.length,1);
});

test('result presenter rejects pre-aborted work without requests, scene or callbacks',async()=>{
  const s=stageFixture(),controller=new AbortController();controller.abort();
  await assert.rejects(mountBattleResultCharacters({stage:s.stage,hudArt:hud([cell('a')]),participants:[{speciesId:'x'}],won:true,signal:controller.signal}),{name:'AbortError'});
  assert.equal(s.loads.length,0);assert.equal(s.roots.length,0);assert.equal(s.ticks.size,0);
});

test('a rejected texture cancels its unfinished peer and promptly releases settled pixels',async()=>{
  const gate=deferred(),bad=deferred(),s=stageFixture(src=>src==='bad'?bad.promise:src==='pending'?gate.promise:Promise.resolve(texture()));
  const loading=mountBattleResultCharacters({stage:s.stage,hudArt:hud([cell('ready'),cell('bad'),cell('pending')]),participants:[{speciesId:'x'}],won:true});
  const rejected=assert.rejects(loading,/TEXTURE_FAIL/);await flush();bad.reject(Error('TEXTURE_FAIL'));await rejected;await flush();
  assert.deepEqual(s.unloads,['ready']);assert.equal(s.roots.length,0);gate.reject(Error('LATE_PEER_FAIL'));await flush();
  assert.equal(s.ticks.size,0);assert.equal(s.resizes.size,0);
});

test('reentry waits for abandoned shared pixels to retire, then mounts only fresh texture',async()=>{
  const old=deferred(),fresh=deferred();let calls=0;
  const s=stageFixture(()=>++calls===1?old.promise:fresh.promise),controller=new AbortController();
  const args={stage:s.stage,hudArt:hud([cell('same')]),participants:[{speciesId:'x'}],won:true};
  const first=mountBattleResultCharacters({...args,signal:controller.signal});const rejected=assert.rejects(first,{name:'AbortError'});
  await flush();controller.abort();await rejected;
  const second=mountBattleResultCharacters(args);await flush();assert.equal(calls,1);old.resolve(texture());await flush();
  assert.equal(calls,2);assert.equal(s.roots.length,0);assert.deepEqual(s.unloads,['same']);
  const freshTexture=texture();fresh.resolve(freshTexture);const scene=await second;assert.equal(s.sprites[0].texture,freshTexture);
  scene.dispose();scene.dispose();await flush();assert.deepEqual(s.unloads,['same','same']);assert.equal(s.roots[0].destroyCount,1);
});

test('initial result redraw failure cleans the scene, ticker, resize observer and texture',async()=>{
  const s=stageFixture(),art={...hud([cell('bad-frame')]),getBattleFrame(){throw Error('FRAME_FAIL');}};
  await assert.rejects(mountBattleResultCharacters({stage:s.stage,hudArt:art,participants:[{speciesId:'x'}],won:true}),/FRAME_FAIL/);
  await flush();assert.equal(s.roots[0].destroyCount,1);assert.equal(s.ticks.size,0);assert.equal(s.resizes.size,0);assert.deepEqual(s.unloads,['bad-frame']);
});

test('late result HUD refresh preserves title panel, settled data, button identity and focus',t=>{
  const prior=globalThis.document,document=globalThis.document=createControlledDocument();
  document.createDocumentFragment=()=>document.createElement('fragment');
  t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
  const root=document.createElement('main');document.body.append(root);
  const view=createBattleResultView({root,outcome:{ended:true,verdict:'TEAM_ZERO_AHEAD',reason:'TEAM_DOWN',winningTeam:0},
    receipt:{status:'SETTLED',won:true,credited:50,walletAfter:80,rewardBits:50},
    progression:{rankBefore:1,rankAfter:1,earnedTitles:[{id:3,name:'Controlled title'}]}});
  const next=root.querySelector('button'),exit=root.querySelector('.cm-vs5-exit');next.click();next.click();exit.focus();
  const before=view.inspect(),body=root.querySelector('.cm-vs5-result__body'),replaceCount=body.replaceCount;
  const art={getMedal:()=>({src:'medal.png',width:10,height:10})};view.setHudArt(art);
  assert.equal(root.querySelector('[data-panel="TITLE"]').dataset.panel,'TITLE');assert.deepEqual(view.inspect(),before);
  assert.equal(root.querySelector('.cm-vs5-result__medal').src,'medal.png');assert.equal(root.querySelector('button'),next);
  assert.equal(root.querySelector('.cm-vs5-exit'),exit);assert.equal(document.activeElement,exit);assert.equal(body.replaceCount,replaceCount+1);
  view.dispose();view.setHudArt(null);assert.equal(body.replaceCount,replaceCount+1);
});

test('HUD arriving before title navigation is used when that unchanged panel is first shown',t=>{
  const prior=globalThis.document,document=globalThis.document=createControlledDocument();document.createDocumentFragment=()=>document.createElement('fragment');
  t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
  const root=document.createElement('main');document.body.append(root);
  const view=createBattleResultView({root,outcome:{ended:true,verdict:'TEAM_ZERO_AHEAD',reason:'TEAM_DOWN',winningTeam:0},
    receipt:{status:'SETTLED',won:true,credited:1,walletAfter:1},progression:{rankBefore:1,rankAfter:1,earnedTitles:[{id:0,name:'title'}]}});
  const body=root.querySelector('.cm-vs5-result__body'),before=body.replaceCount;
  view.setHudArt({getMedal:()=>({src:'early.png',width:1,height:1})});assert.equal(body.replaceCount,before);
  const next=root.querySelector('button');next.click();next.click();assert.equal(root.querySelector('.cm-vs5-result__medal').src,'early.png');view.dispose();
});
