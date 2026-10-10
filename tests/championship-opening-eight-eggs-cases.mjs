import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeRaisingStarter} from '../src/championship/raising/nativeRaisingStarter.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {selectNativeHatchSpecies} from '../src/championship/raising/nativeIndividualEvolution.js';
import {OPENING_EGG_CHOICES,openingEggChoices} from '../src/championship/app/openingEggChoices.js';
import {COMPLETED_ORIGINAL_CHARACTERS} from '../src/championship/presentation/completedOriginalCharacterCatalog.js';
import {openingEggText} from '../src/championship/text/openingEggText.js';import {LOCALES,setLocale} from '../src/championship/text/locale.js';
const KEY='championshipModernSave:v1',read=p=>JSON.parse(fs.readFileSync(p));
const catalog=read('src/data/championship/catalogs/creature-species.r1.json'),cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
function fixture(t,storage){const data=new Map();storage??={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};const app=createChampionshipStandaloneApp({storage,locks:null,catalog,cages,rngClock:()=>({hour:1,minute:2,second:3})});t.after(()=>app.dispose());return {app,storage};}
const saved=s=>JSON.parse(s.getItem(KEY)),cp=a=>a.getInteractiveTutorial().checkpoint;
function progress(s){s=structuredClone(s);delete s.updatedAt;delete s.progression.revision;delete s.progression.nativeOpening;s.raisingHome=JSON.parse(s.raisingHome);delete s.raisingHome.revision;return s;}
test('eight exact existing original egg identities and portraits, with five complete UI locales',()=>{
 assert.deepEqual(OPENING_EGG_CHOICES.map(e=>e.speciesIndex),[0,1,2,3,4,5,6,7]);
  assert.deepEqual(OPENING_EGG_CHOICES.map(e=>e.formalName),['星絮蛋','焰脈蛋','潮環蛋','森芽蛋','雷紋蛋','月霧蛋','晶棘蛋','聖耀蛋']);
  assert.deepEqual(openingEggChoices('https://orochi771127.github.io/championship-2026/').map(e=>e.formalName),OPENING_EGG_CHOICES.map(e=>e.formalName));
 const publicEggs=openingEggChoices('https://orochi771127.github.io/championship-2026/');assert.deepEqual(publicEggs.map(({speciesIndex,entityId,width,height})=>({speciesIndex,entityId,width,height})),OPENING_EGG_CHOICES.map(({speciesIndex,entityId,width,height})=>({speciesIndex,entityId,width,height})));
 for(const e of publicEggs){assert.ok(e.src.startsWith('assets/production/characters/accepted-20261010/'));const c=COMPLETED_ORIGINAL_CHARACTERS.find(c=>c.entityId===e.entityId);assert.equal(c.speciesId,`species-${String(e.speciesIndex).padStart(3,'0')}`);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);}
 try{for(const l of LOCALES){setLocale(l);for(const k of ['title','hint','egg','confirm','back','cancel'])assert.ok(openingEggText()[k]);}}finally{setLocale('zh-Hant');}
});
test('selected eggs retain native construction and hatch rule; only original egg0 has starter ancestry14',()=>{
 for(let i=0;i<8;i++){const rng={next:()=>11},actual=createNativeRaisingStarter(rng,i),base=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(i),rng}));const expected=structuredClone(base);expected.fields['1c0']=128;expected.fields['1c4']=120;if(i===0)expected.fields['140']=14;assert.deepEqual(actual,expected);assert.equal(selectNativeHatchSpecies(actual,rng,0),selectNativeHatchSpecies(expected,rng,0));}
});
test('invalid selected egg is rejected before clearing an existing save',async t=>{const {app,storage}=fixture(t);await app.newGame();app.save();const old=storage.getItem(KEY);for(const eggSpeciesIndex of [-1,8,1.5,'1',null]){await assert.rejects(app.newGame({eggSpeciesIndex}));assert.equal(storage.getItem(KEY),old);}});
for(let egg=0;egg<8;egg++)test(`egg${egg}: invitation before hatch; decline, demo resume and controlled completed cleanup preserve selected egg`,async t=>{
 let {app,storage}=fixture(t);await app.newGame({trainerName:'Test',eggName:'Egg',eggSpeciesIndex:egg});app.save();assert.equal(app.getCreature().nativeProfile.fields['000'],egg);assert.equal(app.offerInteractiveTutorial().ok,true);
 const invitation=saved(storage),baseline=progress(invitation);assert.equal(app.getCreature().creatureId,'resident:species-000');assert.ok(invitation.raising.assignments[app.getCreature().creatureId]);assert.equal(app.getRaisingInstances().length,1);assert.equal((await app.chooseInteractiveTutorial(false)).ok,true);assert.deepEqual(progress(saved(storage)),baseline);await app.dispose();
 app=fixture(t,storage).app;await app.continueGame();assert.equal(app.getCreature().nativeProfile.fields['000'],egg);assert.equal(app.offerInteractiveTutorial().ok,false);await app.dispose();
 storage.setItem(KEY,JSON.stringify(invitation));app=fixture(t,storage).app;await app.continueGame();await app.chooseInteractiveTutorial(true);assert.equal(app.getCreature().nativeProfile.fields['000'],0);assert.deepEqual(progress(saved(storage)),baseline);await app.dispose();
 app=fixture(t,storage).app;await app.continueGame();assert.equal(cp(app).stage,'raising-intro');assert.equal(app.getCreature().nativeProfile.fields['000'],0);
 for(let i=0;i<3;i++)await app.acknowledgeInteractiveTutorial(cp(app));for(let i=0;i<10&&cp(app).stage==='raising-hatch';i++)app.advanceRaisingPresentation({frames:60});assert.equal(app.getCreature().nativeProfile.fields['000'],17);assert.deepEqual(progress(saved(storage)),baseline);
 await app.dispose();const final=saved(storage);final.progression.nativeOpening.checkpoint={version:1,stage:'raising-after-battle',message:0};storage.setItem(KEY,JSON.stringify(final));app=fixture(t,storage).app;await app.continueGame();await app.acknowledgeInteractiveTutorial(cp(app));await app.acknowledgeInteractiveTutorial(cp(app));assert.equal(cp(app).stage,'completed');assert.equal(app.getCreature().nativeProfile.fields['000'],egg);assert.equal(app.getCreature().nativeProfile.name,'Egg');assert.deepEqual(progress(saved(storage)),baseline);
});
