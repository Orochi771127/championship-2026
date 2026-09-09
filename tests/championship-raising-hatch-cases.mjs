import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createNativeRaisingActor,stepNativeRaisingActor,stepNativeRaisingAgeClock} from "../src/championship/raising/nativeRaisingActor.js";
import {selectNativeHatchSpecies} from "../src/championship/raising/nativeIndividualEvolution.js";
import {createNativeRaisingStarter} from "../src/championship/raising/nativeRaisingStarter.js";
import {restoreChannelRng} from "../src/championship/battle/battleRngChannel.js";
import {createChampionshipStandaloneApp} from "../src/championship/app/championshipStandaloneApp.js";
import {createRaisingPresentationSource} from "../src/championship/app/raisingPresentationSource.js";
import {createNativeRaisingGround,nativeRaisingSpawnPosition} from "../src/championship/raising/nativeRaisingGround.js";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const oracle=read("docs/research/RAISING_HATCH_CPU_CHECK_2026-09-08.json");
const care=read("docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json");
const rng=()=>restoreChannelRng(care.starterRng);
const starter=()=>createNativeRaisingStarter(rng());
test("age cadence matches the original running-clock boundaries",()=>{
  for(const row of oracle.clocks.filter(row=>row.running))
    assert.deepEqual(stepNativeRaisingAgeClock(row.remainder,row.minuteDelta),{remainder:row.afterRemainder,ageDelta:row.ageDelta});
});
test("egg time, touch ordering and animation exit match the original CPU",()=>{
  for(const row of oracle.eggs){
    const p=structuredClone(starter());p.fields["18c"]=row.age;
    const actor=createNativeRaisingActor(p,0);
    actor.eggPhase=row.phase;actor.eggTouches=row.touches;actor.pendingTouch=row.touch;
    // The CPU harness supplies this native animation-complete result too.
    actor.animator={advanceNative(){},getSnapshot:()=>({active:Number(!row.complete)})};
    const result=stepNativeRaisingActor(actor,p,{ageDelta:row.delta,rng:rng()});
    assert.equal(result.hatched,row.result===1,JSON.stringify(row));
    if(result.hatched)continue;
    assert.equal(result.profile.fields["18c"],row.afterAge);
    assert.equal(actor.eggPhase,row.afterPhase);assert.equal(actor.eggTouches,row.afterTouches);
    if(row.requests.length)assert.equal(actor.sequenceId,row.requests.at(-1));
  }
});
test("all 408 ancestry choices use the native scaled RNG and correct history branch",()=>{
  for(const row of oracle.selections){
    const p=structuredClone(starter());p.fields["140"]=row.first;p.fields["158"]=row.second;
    const calls=[];
    assert.equal(selectNativeHatchSpecies(p,{next:c=>{calls.push(c);return row.roll;}},3),row.target);
    assert.deepEqual(calls,row.first!==228&&row.second===228?[]:[0x29]);
  }
});
const catalog=read("src/data/championship/catalogs/creature-species.r1.json");
const presentation=read("docs/contracts/championship/raising-home-presentation.v1.json");
test("normal clock and three distinct touches hatch one persistent individual, then Continue restores its form and RNG",async()=>{
  for(const touch of [false,true]){
    const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    const app=createChampionshipStandaloneApp({storage,catalog,cages:presentation.cages});
    await app.newGame();
    const id=app.getRaisingInstances()[0].instanceId;
    const source=createRaisingPresentationSource(app);let frames=0;
    const unsubscribe=source.subscribe(()=>frames++);
    if(touch)for(let i=0;i<3;i++){assert.equal(app.touchRaisingEgg(id),true);app.advanceNaturalClock({frames:1});}
    for(let i=0;i<30&&app.getRaisingInstances()[0].speciesId==="species-000";i++)app.advanceNaturalClock({frames:120});
    const before=app.getRaisingInstances()[0];
    assert.equal(before.speciesId,"species-014");assert.equal(before.instanceId,id);
    assert.equal(source.getFrame().residents[0].speciesId,"championship:creature:species-014");
    assert.ok(frames>0);assert.equal(app.touchRaisingEgg(id),false);
    assert.equal(app.getDatabaseFrame().registeredCount,1);
    assert.equal(app.save().phase,"SAVED");
    const checkpoint=[...values.values()][0];
    unsubscribe();await app.dispose();
    const restored=createChampionshipStandaloneApp({storage,catalog,cages:presentation.cages});
    assert.ok(await restored.continueGame());
    assert.deepEqual(restored.getRaisingInstances()[0],before);
    assert.equal(restored.getDatabaseFrame().entries.find(row=>row.speciesIndex===14).state,"REGISTERED");
    assert.equal(restored.save().phase,"SAVED");
    const after=JSON.parse([...values.values()][0]);
    // Continue restores the saved RNG, then the original Home actor entry
    // consumes two slot-channel draws, source-grid spawn draws, and idle entry.
    const expected=restoreChannelRng(JSON.parse(checkpoint).gameplayRng);
    expected.next(0x26);expected.next(0x26);
    nativeRaisingSpawnPosition(createNativeRaisingGround({...after.cageEdit,unlockedCount:14}),35,expected);
    expected.next(0x26);
    assert.deepEqual(after.gameplayRng,{version:1,...expected.snapshot()});
    await restored.dispose();
  }
});
