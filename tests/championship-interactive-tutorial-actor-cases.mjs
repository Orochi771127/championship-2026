import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createChampionshipStandaloneApp} from "../src/championship/app/championshipStandaloneApp.js";
import {createRaisingPresentationSource} from "../src/championship/app/raisingPresentationSource.js";
import {createChampionshipClockDriver} from "../src/championship/app/championshipClockDriver.js";
import {isInteractiveTutorialPreviewLocation} from "../src/championship/app/interactiveTutorialPreview.js";
import {tutorialPreviewText} from "../src/championship/text/interactiveTutorialPreviewText.js";
import {setLocale,LOCALES} from "../src/championship/text/locale.js";
import {normalizeInteractiveTutorialCheckpoint} from "../src/championship/app/interactiveTutorialCheckpoint.js";
const KEY="championshipModernSave:v1";
const catalog=JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json","utf8"));
const cages=JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json","utf8")).cages;
function fixture(t,storage=null){
 const data=new Map();storage??={data,fail:false,writes:0,getItem:k=>data.get(k)??null,
 setItem(k,v){if(this.fail)throw Error("TEST_QUOTA");this.writes++;data.set(k,v);},removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog,cages,now:()=>"2026-10-09T12:00:00Z",rngClock:()=>({hour:1,minute:2,second:3})});
 t.after(()=>app.dispose());return {app,storage};
}
function normal(storage){
 const s=JSON.parse(storage.getItem(KEY));delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;
 s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;
 return s;
}
const cp=app=>app.getInteractiveTutorial().checkpoint;
const frame=app=>app.getRaisingActorFrame(app.getCreature().creatureId);
async function start(t){
 const f=fixture(t);await f.app.newGame({trainerName:"玩家甲",eggName:"小蛋乙"});f.app.save();
 f.baseline=normal(f.storage);f.app.offerInteractiveTutorial();await f.app.chooseInteractiveTutorial(true);return f;
}
function hatchPrompt(app){for(let i=0;i<3;i++)assert.equal(app.acknowledgeInteractiveTutorial(cp(app)).ok,true);}
function finishHatch(app){for(let i=0;i<10&&cp(app).stage==="raising-hatch"&&!app.getInteractiveTutorial().pendingSave;i++)app.advanceRaisingPresentation({frames:60});}

test("accepted preview owns a special state18 body and cannot use normal Raising actions",async t=>{
 const {app}=await start(t),id=app.getCreature().creatureId,before=app.getCreature().nativeProfile;
 assert.equal(frame(app).actorAuthority,"TUTORIAL_SPECIAL_19_STATE");
 assert.equal(frame(app).state,18);assert.deepEqual(frame(app).positionQ12,[128*4096,96*4096,0]);
 assert.equal(app.touchRaisingEgg(id,cp(app)),false);
 assert.equal(app.beginRaisingHand(id,{x:128,y:96}),false);
 assert.equal(app.placeRaisingFood({x:100,y:120}).ok,false);
 for(let i=0;i<10;i++)app.advanceRaisingPresentation({frames:120});
 assert.equal(frame(app).state,18);assert.deepEqual(app.getCreature().nativeProfile,before);
});

test("180 native updates issue forced hatch, then animation completion alone saves state1 species17",async t=>{
 const {app,storage,baseline}=await start(t);hatchPrompt(app);
 app.advanceRaisingPresentation({frames:120});app.advanceRaisingPresentation({frames:59});
 assert.equal(frame(app).eggPhase,0);assert.equal(cp(app).stage,"raising-hatch");
 app.advanceRaisingPresentation({frames:1});assert.equal(frame(app).eggPhase,1);
 assert.equal(frame(app).speciesIndex,0);assert.equal(cp(app).stage,"raising-hatch");
 finishHatch(app);
 assert.equal(cp(app).stage,"raising-hatched");assert.equal(frame(app).state,1);
 assert.equal(frame(app).speciesIndex,17);assert.equal(frame(app).actorAuthority,"TUTORIAL_SPECIAL_19_STATE");
 assert.equal(app.getCreature().displayName,"小蛋乙");assert.equal(app.getCreature().nativeProfile.name,"小蛋乙");
 assert.equal(app.getInteractiveTutorial().textId,1498);assert.equal(app.getInteractiveTutorial().finished,false);
 assert.equal(app.getInteractiveTutorial().available,true);
 assert.deepEqual(normal(storage),baseline);
 assert.throws(()=>normalizeInteractiveTutorialCheckpoint({version:1,stage:"raising-feed",message:0}));
});

test("actor-target touch requires current expected checkpoint; wrong target/stale input cannot hatch",async t=>{
 const {app}=await start(t),old=cp(app),id=app.getCreature().creatureId;hatchPrompt(app);
 assert.equal(app.touchRaisingEgg("wrong-resident",cp(app)),false);
 assert.equal(app.touchRaisingEgg(id,old),false);assert.equal(app.touchRaisingEgg(id),false);
 assert.equal(app.touchRaisingEgg(id,cp(app)),true);assert.equal(app.touchRaisingEgg(id,cp(app)),false);
 app.advanceRaisingPresentation({frames:1});assert.equal(frame(app).eggPhase,1);
 assert.equal(app.acknowledgeInteractiveTutorial(cp(app)).ok,false);
 finishHatch(app);assert.equal(frame(app).speciesIndex,17);
});

test("reload during hatch resumes the saved safe egg boundary without serializing an animation or demo profile",async t=>{
 const {app,storage,baseline}=await start(t);hatchPrompt(app);
 app.touchRaisingEgg(app.getCreature().creatureId,cp(app));app.advanceRaisingPresentation({frames:2});app.save();
 assert.equal(frame(app).eggPhase,1);assert.deepEqual(normal(storage),baseline);
 await app.dispose();const next=fixture(t,storage).app;await next.continueGame();
 assert.equal(cp(next).stage,"raising-hatch");assert.equal(frame(next).eggPhase,0);assert.equal(frame(next).state,18);
 finishHatch(next);assert.equal(cp(next).stage,"raising-hatched");assert.deepEqual(normal(storage),baseline);
});

test("saved post-hatch checkpoint reconstructs exactly the demo form while retaining the normal baseline",async t=>{
 const {app,storage,baseline}=await start(t);hatchPrompt(app);finishHatch(app);
 const profile=app.getCreature().nativeProfile,rng=app.getGameplayRngState();
 await app.dispose();const next=fixture(t,storage).app;await next.continueGame();
 assert.equal(cp(next).stage,"raising-hatched");assert.deepEqual(next.getCreature().nativeProfile,profile);
 assert.deepEqual(next.getGameplayRngState(),rng);assert.equal(frame(next).state,1);
 next.save();assert.deepEqual(normal(storage),baseline);
});

test("failed hatch checkpoint freezes pending state and retry never reconstructs twice",async t=>{
 const {app,storage,baseline}=await start(t);hatchPrompt(app);const before=storage.getItem(KEY);
 storage.fail=true;finishHatch(app);
 assert.equal(app.getInteractiveTutorial().pendingSave,true);assert.equal(cp(app).stage,"raising-hatch");
 assert.equal(frame(app).speciesIndex,17);assert.equal(storage.getItem(KEY),before);
 const rng=app.getGameplayRngState();app.advanceRaisingPresentation({frames:120});
 assert.deepEqual(app.getGameplayRngState(),rng);assert.equal(app.touchRaisingEgg(app.getCreature().creatureId,cp(app)),false);
 storage.fail=false;app.persistenceFacade().retry();assert.equal(cp(app).stage,"raising-hatched");
 assert.deepEqual(app.getGameplayRngState(),rng);assert.deepEqual(normal(storage),baseline);
});

test("post-hatch exit restores starter/name and retries an immutable baseline after late mutations",async t=>{
 const {app,storage,baseline}=await start(t);hatchPrompt(app);finishHatch(app);
 const checkpoint=cp(app);storage.fail=true;
 assert.equal((await app.exitInteractiveTutorial(checkpoint)).ok,false);
 assert.equal(app.getInteractiveTutorial().finished,false);
 app.creditBits(777);app.setTamerRank(2);app.nextGameplayRandom(1);
 storage.fail=false;app.persistenceFacade().retry();
 assert.equal(app.getInteractiveTutorial().finished,true);assert.equal(frame(app).actorAuthority,"NORMAL_RAISING");
 assert.equal(app.getCreature().nativeProfile.fields["000"],0);assert.equal(app.getCreature().displayName,"小蛋乙");
 app.save();assert.deepEqual(normal(storage),baseline);
});

test("Raising presentation unsubscribes old session, binds hydrated session, then disposes both subscriptions",async t=>{
 const {app}=await start(t),tracked=new Map();
 const proxy=new Proxy({...app},{get(target,key){
  if(key!=="getSession")return target[key];
  return ()=>{const s=target.getSession();if(!s)return null;
   if(!tracked.has(s)){const record={active:0};record.proxy=new Proxy({...s},{get(target,key){
    if(key!=="subscribeRaisingHome")return target[key];
    return listener=>{record.active++;const stop=target.subscribeRaisingHome(listener);return ()=>{record.active--;stop();};};
   }});tracked.set(s,record);}return tracked.get(s).proxy;};
 }});
 const source=createRaisingPresentationSource(proxy);let calls=0;const stop=source.subscribe(()=>calls++);
 const old=app.getSession();assert.equal(tracked.get(old).active,1);
 hatchPrompt(app);finishHatch(app);await app.exitInteractiveTutorial(cp(app));
 const current=app.getSession();assert.notEqual(current,old);assert.equal(tracked.get(old).active,0);assert.equal(tracked.get(current).active,1);
 const before=calls;app.advanceNaturalClock({frames:60});assert.ok(calls>before);
 assert.equal(source.getFrame().tutorial.finished,true);stop();assert.equal(tracked.get(current).active,0);
});

test("single existing clock driver advances special hatch while normal calendar stays paused, and hidden time is discarded",async t=>{
 const {app}=await start(t);hatchPrompt(app);let tick,now=0,visible=true,adds=0,removes=0;
 const driver=createChampionshipClockDriver({app,ticker:{add:f=>{tick=f;adds++;},remove:f=>{assert.equal(f,tick);removes++;}},now:()=>now,isVisible:()=>visible});
 const before=app.getSnapshot();driver.setActive(true);tick();visible=false;now=5000;tick();visible=true;tick();
 assert.equal(frame(app).eggPhase,0);
 for(let i=0;i<400&&cp(app).stage==="raising-hatch";i++){now+=17;tick();}
 assert.equal(cp(app).stage,"raising-hatched");assert.deepEqual(app.getSnapshot(),before);
 driver.dispose();assert.equal(adds,1);assert.equal(removes,1);
});

test("review entry is loopback-only, and preview controls share all five existing locales",()=>{
 assert.equal(isInteractiveTutorialPreviewLocation({hostname:"127.0.0.1",search:"?tutorialPreview=raising"}),true);
 assert.equal(isInteractiveTutorialPreviewLocation({hostname:"example.com",search:"?tutorialPreview=raising"}),false);
 assert.equal(isInteractiveTutorialPreviewLocation({hostname:"localhost",search:""}),false);
 const names=new Set();
 for(const locale of LOCALES){setLocale(locale);const c=tutorialPreviewText();names.add(c.title);
  for(const key of ["invite","accept","decline","next","waiting","boundary","keep","exit","retry","failed"])assert.ok(c[key].length>0);}
 setLocale("zh-Hant");assert.equal(names.size,5);
});
