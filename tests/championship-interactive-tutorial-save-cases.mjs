import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createChampionshipStandaloneApp} from "../src/championship/app/championshipStandaloneApp.js";
import {normalizeNativeOpening} from "../src/championship/app/nativeOpeningState.js";
import {INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE,normalizeInteractiveTutorialCheckpoint}
  from "../src/championship/app/interactiveTutorialCheckpoint.js";
import {CHAMPIONSHIP_MODERN_SAVE_KEY as KEY} from "../src/championship/app/championshipStandaloneSave.js";

const catalog=JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json","utf8"));
const cages=JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json","utf8")).cages;
function fixture(t,storage=null){
  const data=new Map([["unrelated-player-data","do not touch"]]);
  const memory=storage??{data,fail:false,writes:[],getItem:k=>data.get(k)??null,
    setItem(k,v){if(this.fail)throw Error("TEST_QUOTA");this.writes.push(k);data.set(k,v);},
    removeItem:k=>data.delete(k)};
  const app=createChampionshipStandaloneApp({storage:memory,locks:null,catalog,cages,
    now:()=>"2026-10-09T12:00:00.000Z",rngClock:()=>({hour:1,minute:2,second:3})});
  t.after(()=>app.dispose());
  return {app,storage:memory};
}
async function start(t){
  const f=fixture(t);await f.app.newGame({trainerName:"玩家甲",eggName:"小蛋乙"});f.app.save();return f;
}
const saved=s=>JSON.parse(s.getItem(KEY));
function progress(s){
  const {updatedAt,raisingHome,progression,...rest}=structuredClone(s);
  const {revision,nativeOpening,...normal}=progression;
  return {...rest,progression:normal,trainerName:nativeOpening?.trainerName,
    raisingHome:JSON.parse(raisingHome).payload};
}
function cp(app){return app.getInteractiveTutorial().checkpoint;}
const offered=()=>({version:1,stage:"invitation",message:0});

test("interactive checkpoint accepts only implemented semantic boundaries and exact keys",()=>{
  for(const stage of ["invitation","raising-hatch","declined","completed"])
    assert.deepEqual(normalizeInteractiveTutorialCheckpoint({version:1,stage,message:0}),{version:1,stage,message:0});
  for(const message of [0,1,2])assert.equal(normalizeInteractiveTutorialCheckpoint({version:1,stage:"raising-intro",message}).message,message);
  for(const bad of [null,[],{},true,
    {version:2,stage:"invitation",message:0},{version:1,stage:"battle",message:0},
    {version:1,stage:"completed",message:1},{version:1,stage:"raising-intro",message:3},
    {version:1,stage:"invitation",message:1},{version:1,stage:"invitation",message:-1},
    {version:1,stage:"invitation",message:0.1},{version:1,stage:"invitation",message:NaN},
    {version:1,stage:"invitation",message:Infinity},{version:1,stage:"invitation",message:"0"},
    {version:1,stage:"invitation",message:0,baseline:{}},
    {version:1,stage:"invitation"},{version:1,message:0},
    Object.assign(Object.create({extra:1}),offered())])
    assert.throws(()=>normalizeInteractiveTutorialCheckpoint(bad),/INVALID_INTERACTIVE_TUTORIAL/);
  const good=normalizeNativeOpening({version:2,trainerName:"玩家甲",tutorialStep:null,checkpoint:offered()});
  assert.ok(Object.isFrozen(good.checkpoint));
  assert.throws(()=>normalizeNativeOpening({...good,tutorialStep:0}),/INVALID_NATIVE_OPENING/);
  assert.throws(()=>normalizeNativeOpening({...good,baseline:{}}),/INVALID_NATIVE_OPENING/);
  assert.throws(()=>normalizeNativeOpening(Object.assign(Object.create({version:2}),{trainerName:"玩家甲",tutorialStep:null,checkpoint:offered()})),/INVALID_NATIVE_OPENING/);
  assert.throws(()=>normalizeInteractiveTutorialCheckpoint({...offered(),[Symbol("hidden")]:1}),/INVALID_INTERACTIVE_TUTORIAL/);
  assert.equal(INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE,true);
});

test("new games remain unchanged by default; only explicit new-game entry offers teaching",async t=>{
  const {app,storage}=await start(t);
  assert.equal(app.getInteractiveTutorial(),null);
  assert.deepEqual(app.getOpeningState(),{version:1,trainerName:"玩家甲",tutorialStep:null});
  const before=progress(saved(storage));
  assert.equal(app.offerInteractiveTutorial().ok,true);
  assert.deepEqual(cp(app),offered());
  assert.equal(app.getTutorial(),null);
  assert.equal(app.beginTutorial().reason,"INTERACTIVE_TUTORIAL_OWNS_OPENING");
  assert.deepEqual(progress(saved(storage)),before);
  assert.equal(app.offerInteractiveTutorial().ok,false);
  assert.deepEqual([...storage.data.keys()].sort(),[KEY,"unrelated-player-data"].sort());
});

test("every old cursor survives Continue and refuses automatic interactive opt-in",async t=>{
  const {app,storage}=await start(t);await app.dispose();
  for(const cursor of [null,-1,...Array.from({length:72},(_,i)=>i)]){
    const old=saved(storage);old.progression.nativeOpening={version:1,trainerName:"玩家甲",tutorialStep:cursor};
    storage.data.set(KEY,JSON.stringify(old));
    const next=fixture(t,storage).app;assert.ok(await next.continueGame());
    assert.equal(next.getOpeningState().tutorialStep,cursor);
    assert.equal(next.getInteractiveTutorial(),null);
    assert.equal(next.offerInteractiveTutorial().reason,"INTERACTIVE_TUTORIAL_NEW_GAME_REQUIRED");
    await next.dispose();
  }
});

test("normal clock and command paths stay paused while tutorial predicates are unbound",async t=>{
  const {app}=await start(t);app.offerInteractiveTutorial();await app.chooseInteractiveTutorial(true);
  const snapshot=app.getSnapshot(),rng=app.getGameplayRngState();
  assert.equal(app.getClockRunState().reason,"INTERACTIVE_TUTORIAL_ACTIVE");
  assert.equal(app.advanceNaturalClock({frames:120}).accepted,false);
  assert.equal(app.advanceClock({units:400}).accepted,false);
  assert.equal(app.dispatch({type:"END_DAY"}).accepted,false);
  assert.equal(app.endDay().accepted,false);
  assert.deepEqual(app.getSnapshot(),snapshot);
  assert.deepEqual(app.getGameplayRngState(),rng);
});

test("demo wallet, items, rank, badges, care, and RNG never enter the canonical projection",async t=>{
  const {app,storage}=await start(t);const baseline=progress(saved(storage));
  app.offerInteractiveTutorial();await app.chooseInteractiveTutorial(true);
  app.creditBits(10000);app.setTamerRank(4);app.setBattleBadges([0]);
  app.care(app.getCreature().creatureId);app.nextGameplayRandom(1);
  app.openShop();assert.equal(app.buyShopItem(0,2).ok,true);
  assert.equal(app.save().phase,"SAVED");
  assert.deepEqual(progress(saved(storage)),baseline);
  assert.equal(storage.getItem("unrelated-player-data"),"do not touch");
  await app.dispose();
  const restored=fixture(t,storage).app;assert.ok(await restored.continueGame());
  assert.deepEqual(cp(restored),{version:1,stage:"raising-intro",message:0});
  assert.equal(restored.getCreature().displayName,"小蛋乙");
  restored.save();assert.deepEqual(progress(saved(storage)),baseline);
});

test("accept and three explicit acknowledgments persist, reject stale taps, and require the hatch actor predicate",async t=>{
  const {app,storage}=await start(t);app.offerInteractiveTutorial();
  assert.equal((await app.chooseInteractiveTutorial(true)).ok,true);
  const old=cp(app);
  assert.equal(app.acknowledgeInteractiveTutorial(old).ok,true);
  assert.equal(app.acknowledgeInteractiveTutorial(old).reason,"INTERACTIVE_TUTORIAL_STALE_CHECKPOINT");
  assert.equal(app.getInteractiveTutorial().textId,1496);
  await app.dispose();
  const restored=fixture(t,storage).app;await restored.continueGame();
  assert.equal(restored.getInteractiveTutorial().textId,1496);
  assert.equal(restored.acknowledgeInteractiveTutorial(cp(restored)).ok,true);
  assert.equal(restored.getInteractiveTutorial().textId,1497);
  assert.equal(restored.acknowledgeInteractiveTutorial(cp(restored)).ok,true);
  assert.equal(cp(restored).stage,"raising-hatch");
  assert.equal(restored.getInteractiveTutorial().available,true);
  assert.equal(restored.acknowledgeInteractiveTutorial(cp(restored)).ok,false);
  assert.equal(restored.getInteractiveTutorial().finished,false);
});

test("failed invitation writes preserve bytes and retry through the existing persistence facade",async t=>{
  const {app,storage}=await start(t);const bytes=storage.getItem(KEY);
  storage.fail=true;const failed=app.offerInteractiveTutorial();
  assert.equal(failed.ok,false);assert.equal(failed.status.phase,"SAVE_FAILED");
  assert.equal(storage.getItem(KEY),bytes);
  assert.equal((await app.chooseInteractiveTutorial(true)).ok,false);
  assert.equal(app.getInteractiveTutorial().pendingSave,true);
  const recovery=JSON.parse(app.persistenceFacade().exportRecovery().text);
  assert.deepEqual(recovery.progression.nativeOpening.checkpoint,offered());
  storage.fail=false;assert.equal(app.persistenceFacade().retry().phase,"SAVED");
  assert.deepEqual(cp(app),offered());assert.equal(app.getInteractiveTutorial().pendingSave,false);
});

test("failed accept and ACK remain retryable without skipping a message or serializing demo changes",async t=>{
  const {app,storage}=await start(t);const baseline=progress(saved(storage));
  app.offerInteractiveTutorial();storage.fail=true;
  assert.equal((await app.chooseInteractiveTutorial(true)).ok,false);
  assert.equal(cp(app).stage,"invitation");
  app.creditBits(1234);
  assert.equal(app.acknowledgeInteractiveTutorial(cp(app)).ok,false);
  storage.fail=false;app.persistenceFacade().retry();
  const first=cp(app);assert.equal(first.message,0);
  storage.fail=true;assert.equal(app.acknowledgeInteractiveTutorial(first).ok,false);
  assert.equal(cp(app).message,0);assert.equal(app.acknowledgeInteractiveTutorial(first).ok,false);
  storage.fail=false;app.persistenceFacade().retry();
  assert.equal(cp(app).message,1);assert.deepEqual(progress(saved(storage)),baseline);
});

test("decline rolls back live demo changes, retains names, and never publishes exit before a successful save",async t=>{
  const {app,storage}=await start(t);const baseline=progress(saved(storage));
  app.offerInteractiveTutorial();const bytes=storage.getItem(KEY);
  app.creditBits(9999);app.setTamerRank(3);app.setBattleBadges([1]);
  app.care(app.getCreature().creatureId);app.nextGameplayRandom(1);
  storage.fail=true;const result=await app.chooseInteractiveTutorial(false);
  assert.equal(result.ok,false);assert.equal(storage.getItem(KEY),bytes);
  assert.equal(app.getInteractiveTutorial().finished,false);
  assert.equal(app.getInteractiveTutorial().pendingSave,true);
  assert.equal(app.getClockRunState().running,false);
  assert.equal((await app.chooseInteractiveTutorial(true)).ok,false);
  app.creditBits(321);app.setTamerRank(2);app.care(app.getCreature().creatureId);app.nextGameplayRandom(1);
  storage.fail=false;assert.equal(app.persistenceFacade().retry().phase,"SAVED");
  assert.equal(app.getInteractiveTutorial().finished,true);
  assert.equal(app.getCreature().displayName,"小蛋乙");
  assert.deepEqual(progress(saved(storage)),baseline);
  app.save();assert.deepEqual(progress(saved(storage)),baseline,"post-exit save must also preserve the baseline RNG/profile");
  const persisted=saved(storage);assert.equal(persisted.progression.nativeOpening.checkpoint.stage,"declined");
  await app.dispose();const resumed=fixture(t,storage).app;await resumed.continueGame();
  assert.equal(resumed.getInteractiveTutorial().finished,true);
  assert.equal(resumed.offerInteractiveTutorial().ok,false);
});

test("storage conflicts retain isolation and do not overwrite the newer tab on retry",async t=>{
  const {app,storage}=await start(t);app.offerInteractiveTutorial();
  const newer=saved(storage);newer.progression.revision+=100;const bytes=JSON.stringify(newer);storage.data.set(KEY,bytes);
  const result=await app.chooseInteractiveTutorial(true);
  assert.equal(result.ok,false);assert.equal(result.status.lastCode,"CHAMPIONSHIP_MODERN_SAVE_CONFLICT");
  app.persistenceFacade().retry();assert.equal(storage.getItem(KEY),bytes);
  assert.equal(app.getInteractiveTutorial().pendingSave,true);
});

test("malformed or future interactive saves are rejected before replacing an open session",async t=>{
  const {app,storage}=await start(t);app.offerInteractiveTutorial();
  const current=app.getSession(),snapshot=app.getSnapshot();
  const bad=saved(storage);bad.progression.nativeOpening.checkpoint.stage="battle";
  storage.data.set(KEY,JSON.stringify(bad));
  assert.equal(app.canContinue().loadable,false);
  assert.equal(await app.continueGame(),null);
  assert.equal(app.getSession(),current);assert.deepEqual(app.getSnapshot(),snapshot);
});

test("pure save preparation does not change storage/status, and invalid new-game setup cannot replace another save",async t=>{
  const {app,storage}=await start(t);const bytes=storage.getItem(KEY),status=app.savePort.getStatus();
  const stored=saved(storage);
  const candidate=app.savePort.prepare({...stored.progression,snapshot:app.getSnapshot(),creature:stored.creature,
    sessionId:stored.sessionId,raising:stored.raising,shop:stored.shop,cageEdit:stored.cageEdit,
    battleEconomy:stored.battleEconomy,instanceIdentity:stored.instanceIdentity,gameplayRng:stored.gameplayRng,huntHistory:stored.huntHistory});
  assert.deepEqual(progress(candidate.save),progress(stored));
  assert.throws(()=>app.savePort.prepare({}),/./);
  assert.equal(app.savePort.getStatus(),status);assert.equal(storage.getItem(KEY),bytes);
  await assert.rejects(app.newGame({trainerName:"超過五個字元的名字",eggName:"小蛋乙"}),/INVALID_NATIVE_OPENING/);
  assert.equal(storage.getItem(KEY),bytes);
});


test("invalid interactive RNG is rejected before closing a live session",async t=>{
  const {app,storage}=await start(t);app.offerInteractiveTutorial();
  const session=app.getSession(),bad=saved(storage);bad.gameplayRng=null;storage.data.set(KEY,JSON.stringify(bad));
  assert.equal(app.canContinue().loadable,false);
  await assert.rejects(app.continueGame(),/INTERACTIVE_TUTORIAL_RNG_REQUIRED/);
  assert.equal(app.getSession(),session);
});

test("save observers cannot reenter tutorial transitions or produce duplicate writes",async t=>{
  const {app,storage}=await start(t);app.offerInteractiveTutorial();await app.chooseInteractiveTutorial(true);
  const expected=cp(app),count=storage.writes.length;let reentered=null;
  const unsubscribe=app.savePort.subscribe(status=>{if(status.phase==="SAVED"){
    reentered=app.acknowledgeInteractiveTutorial(expected);app.save();
  }});
  app.acknowledgeInteractiveTutorial(expected);unsubscribe();
  assert.equal(reentered.ok,false);assert.equal(storage.writes.length,count+1);assert.equal(cp(app).message,1);
});
