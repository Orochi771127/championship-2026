// Production-source unit proof. The fixture supplies save data only.
// No loader hooks, catalog replacement, browser storage mutation or GPU claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
const {deserializeChampionshipModernSave,CHAMPIONSHIP_MODERN_SAVE_KEY}=await import('../src/championship/app/championshipStandaloneSave.js');
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
test('production sources: real app saves and reloads v6 without changing229/230 profiles or transport identities',async()=>{
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,fs.readFileSync(new URL('../qa/alternate-form-save.json',import.meta.url),'utf8')]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const options={storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages};
 const app=createChampionshipStandaloneApp(options);let restored;
 try{
  await app.continueGame();
  const species=[211,222,229,230],ids=species.map(id=>app.getRaisingInstances().find(e=>e.speciesId===`species-${id}`).instanceId);
  const before=await Promise.all(ids.map(async id=>(await app.prepareBattleParty(null,[id])).individuals[0].nativeProfile));
  const codes=await Promise.all(ids.map(id=>app.createTeamPassword([id])));
  for(let i=0;i<codes.length;i++){assert.equal(codes[i].ok,true);assert.equal(codes[i].password.startsWith('CM26-PASSWORD-2.'),species[i]>228);}
  assert.equal(app.save().phase,'SAVED');
  const raw=data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),save=deserializeChampionshipModernSave(raw);
  assert.equal(save.schemaVersion,6);
  const persisted=ids.map(id=>save.raising.collection.find(e=>e.instanceId===id).nativeProfile);
  // Normal save stores live ranch coordinates in014/1c0/1c4 for every species.
  // Preserve every other field exactly, then compare reload with persisted bytes.
  for(let i=0;i<ids.length;i++){
   const expected=structuredClone(before[i]);
   for(const key of ['014','1c0','1c4'])expected.fields[key]=persisted[i].fields[key];
   assert.deepEqual(persisted[i],expected);assert.equal(persisted[i].fields['000'],species[i]);
  }
  for(const schemaVersion of [4,5]){
   const malformed=JSON.parse(raw);malformed.schemaVersion=schemaVersion;if(schemaVersion===4)delete malformed.huntHistory;
   assert.throws(()=>deserializeChampionshipModernSave(JSON.stringify(malformed)),/PRODUCT_SPECIES_REQUIRES_SAVE_V6/);
  }
  await app.dispose();restored=createChampionshipStandaloneApp(options);await restored.continueGame();
  assert.deepEqual(await Promise.all(ids.map(async id=>(await restored.prepareBattleParty(null,[id])).individuals[0].nativeProfile)),persisted);
  const after=await Promise.all(ids.map(id=>restored.createTeamPassword([id])));
  assert.deepEqual(after.map(x=>x.password),codes.map(x=>x.password));
 }finally{await app.dispose();await restored?.dispose();}
});

test('production sources: normal App evolution choices139→229 and144→230 can generate and prepare v2 passwords',async()=>{
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,fs.readFileSync(new URL('../qa/alternate-form-save.json',import.meta.url),'utf8')]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});
 const evolved=[];
 try{
  await app.continueGame();
  for(const target of [229,230]){
   for(let i=0;i<100&&!app.getRaisingLifecycleFrame().evolution;i++)app.advanceNaturalClock({frames:120});
   const choice=app.getRaisingLifecycleFrame().evolution;assert.equal(choice?.choicePending,true);assert.ok(choice.choices.includes(target));
   assert.equal(app.selectRaisingEvolutionChoice(choice.instanceId,target),true);
   for(let i=0;i<12&&app.getRaisingLifecycleFrame().evolution?.instanceId===choice.instanceId;i++)app.advanceRaisingPresentation({frames:120});
   assert.equal(app.getRaisingInstances().find(e=>e.instanceId===choice.instanceId).speciesId,`species-${target}`);
   evolved.push(choice.instanceId);
  }
  app.openBattle();const passwords=[];
  for(const id of evolved){const result=await app.createTeamPassword([id]);assert.equal(result.ok,true,result.reason??result.message);assert.match(result.password,/^CM26-PASSWORD-2\./);passwords.push(result.password);}
  const prepared=await app.preparePasswordBattle(passwords);assert.equal(prepared.ok,true,prepared.reason);
  assert.deepEqual(prepared.parties.map(p=>p.map(e=>e.nativeProfile.fields['000'])),[[229],[230]]);
 }finally{await app.dispose();}
});

test('production readiness and observed QA gameplay use equivalent core configurations',async()=>{
 const {listProductExtensions}=await import('../src/championship/contracts/productSpeciesExtensions.js');
 const {ACTIVE_ALTERNATE_FORM_ASSETS}=await import('../src/championship/presentation/alternateFormAssetContracts.js');
 assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length,4);
 for(const e of listProductExtensions())for(const k of ['runtimeReady','evolutionReady','networkReady'])assert.equal(e[k],true);
 assert.deepEqual(read('src/data/championship/product-species-extensions.r1.json').entries.filter(e=>e.generationIndex===6),read('qa/alternate-form-product-catalog.json').entries);
 const core=e=>{const {blockers,...rest}=e;return rest;};
 assert.deepEqual(read('src/data/championship/alternate-form-assets.r1.json').characters.map(core),read('qa/alternate-form-asset-catalog.json').characters.map(core));
});
