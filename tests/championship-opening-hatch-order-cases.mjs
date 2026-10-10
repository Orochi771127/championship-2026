import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
const KEY='championshipModernSave:v1';
const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json'));
const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages;
function fixture(t,storage){
 const data=new Map();storage??={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog,cages,rngClock:()=>({hour:1,minute:2,second:3})});
 t.after(()=>app.dispose());return {app,storage};
}
const saved=s=>JSON.parse(s.getItem(KEY));
function progress(s){s=structuredClone(s);delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;return s;}
async function hatch(t){
 const f=fixture(t),{app}=f;await app.newGame({trainerName:'阿光',eggName:'小光'});app.save();
 const id=app.getCreature().creatureId;
 assert.equal(app.getInteractiveTutorial(),null);assert.equal(app.getCreature().nativeProfile.fields['000'],0);
 for(let i=0;i<3;i++){assert.equal(app.touchRaisingEgg(id),true);app.advanceNaturalClock({frames:1});}
 for(let i=0;i<20&&app.getCreature().nativeProfile.fields['000']<8;i++)app.advanceNaturalClock({frames:10});
 assert.ok(app.getCreature().nativeProfile.fields['000']>=8);assert.equal(app.getCreature().nativeProfile.name,'小光');
 assert.equal(app.getInteractiveTutorial(),null);assert.equal(app.offerInteractiveTutorial().ok,true);
 f.baseline=progress(saved(f.storage));return f;
}
test('legacy hatched baseline: decline after real normal hatch preserves the hatched starter, name and full baseline on Continue',async t=>{
 const {app,storage,baseline}=await hatch(t);
 assert.equal((await app.chooseInteractiveTutorial(false)).ok,true);assert.deepEqual(progress(saved(storage)),baseline);
 await app.dispose();const next=fixture(t,storage).app;await next.continueGame();
 assert.equal(next.getOpeningState().trainerName,'阿光');assert.equal(next.getCreature().nativeProfile.name,'小光');
 assert.ok(next.getCreature().nativeProfile.fields['000']>=8);assert.equal(next.getInteractiveTutorial().checkpoint.stage,'declined');
 assert.equal(next.offerInteractiveTutorial().reason,'INTERACTIVE_TUTORIAL_NEW_GAME_REQUIRED');
});
test('legacy saved hatch-first onboarding uses a separate demo egg, resumes its checkpoint and restores hatched baseline',async t=>{
 let {app,storage,baseline}=await hatch(t);assert.equal((await app.chooseInteractiveTutorial(true)).ok,true);
 assert.equal(app.getCreature().nativeProfile.fields['000'],0);assert.deepEqual(progress(saved(storage)),baseline);
 await app.dispose();app=fixture(t,storage).app;await app.continueGame();
 assert.equal(app.getInteractiveTutorial().checkpoint.stage,'raising-intro');assert.equal(app.getCreature().nativeProfile.fields['000'],0);
 for(let i=0;i<3;i++)assert.equal(app.acknowledgeInteractiveTutorial(app.getInteractiveTutorial().checkpoint).ok,true);
 for(let i=0;i<10&&app.getInteractiveTutorial().checkpoint.stage==='raising-hatch';i++)app.advanceRaisingPresentation({frames:60});
 assert.equal(app.getInteractiveTutorial().checkpoint.stage,'raising-hatched');assert.equal(app.getCreature().nativeProfile.fields['000'],17);
 assert.deepEqual(progress(saved(storage)),baseline);
 assert.equal((await app.exitInteractiveTutorial(app.getInteractiveTutorial().checkpoint)).ok,true);
 assert.deepEqual(progress(saved(storage)),baseline);assert.ok(app.getCreature().nativeProfile.fields['000']>=8);
});
