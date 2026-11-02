// Production-source unit proof. The fixture supplies save data only.
// No loader hooks, catalog replacement, browser storage mutation or GPU claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
const {deserializeChampionshipModernSave,CHAMPIONSHIP_MODERN_SAVE_KEY}=await import('../src/championship/app/championshipStandaloneSave.js');
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): 覺醒體/究極體 (the alternate forms
// 229/230 included) are battle burst forms, so a legacy save's 211/222/229/230 partners load as their 成熟期.
const legacyId=n=>`championship:2026:instance:${String(n).padStart(4,'0')}`;
test('production sources: a legacy v6 save returns 211/222/229/230 to their 成熟期 with those forms, saves and reloads them unchanged',async()=>{
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,fs.readFileSync(new URL('../qa/alternate-form-save.json',import.meta.url),'utf8')]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const options={storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages};
 const app=createChampionshipStandaloneApp(options);let restored;
 try{
  await app.continueGame();
  const forms=[211,222,229,230],ids=forms.map((_,i)=>legacyId(i+1));
  ids.forEach((id,i)=>assert.ok(app.getPartnerBurst(id).some(f=>(f.form===forms[i]&&f.unlocked)||f.alternatesUnlocked.includes(forms[i])),`${id} keeps ${forms[i]}`));
  const before=await Promise.all(ids.map(async id=>(await app.prepareBattleParty(null,[id])).individuals[0].nativeProfile));
  assert.ok(before.every(profile=>profile.fields['000']<224),'only native 成熟期 remain');
  const codes=await Promise.all(ids.map(id=>app.createTeamPassword([id])));
  for(const code of codes){assert.equal(code.ok,true);assert.ok(!code.password.startsWith('CM26-PASSWORD-2.'),'native partners use the native password');}
  assert.equal(app.save().phase,'SAVED');
  const save=deserializeChampionshipModernSave(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(save.schemaVersion,6);
  const persisted=ids.map(id=>save.raising.collection.find(e=>e.instanceId===id).nativeProfile);
  // Normal save stores live ranch coordinates in014/1c0/1c4 for every species.
  for(let i=0;i<ids.length;i++){
   const expected=structuredClone(before[i]);
   for(const key of ['014','1c0','1c4'])expected.fields[key]=persisted[i].fields[key];
   assert.deepEqual(persisted[i],expected);
  }
  await app.dispose();restored=createChampionshipStandaloneApp(options);await restored.continueGame();
  assert.deepEqual(await Promise.all(ids.map(async id=>(await restored.prepareBattleParty(null,[id])).individuals[0].nativeProfile)),persisted);
  const after=await Promise.all(ids.map(id=>restored.createTeamPassword([id])));
  assert.deepEqual(after.map(x=>x.password),codes.map(x=>x.password));
 }finally{await app.dispose();await restored?.dispose();}
});

test('production sources: nothing grows naturally into 229/230 any more; they are alternates of the 211/222 burst forms',async()=>{
 const {PRODUCT_GROWTH_RULES}=await import('../src/championship/contracts/productGrowthRules.js');
 const {burstBasesFor,burstFormsFor}=await import('../src/championship/contracts/productBurstEvolution.js');
 for(const source of [139,143,144])assert.deepEqual(PRODUCT_GROWTH_RULES.rules[source-8],[]);
 for(const [form,alternate] of [[211,229],[222,230]]){
  assert.deepEqual([...burstBasesFor(alternate)],[...burstBasesFor(form)]);
  for(const base of burstBasesFor(form))assert.deepEqual([...burstFormsFor(base).find(f=>f.form===form).alternates],[alternate]);
 }
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,fs.readFileSync(new URL('../qa/alternate-form-save.json',import.meta.url),'utf8')]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});
 try{
  await app.continueGame();app.openBattle();const passwords=[];
  for(const id of [legacyId(3),legacyId(4)]){const result=await app.createTeamPassword([id]);assert.equal(result.ok,true,result.reason??result.message);passwords.push(result.password);}
  const prepared=await app.preparePasswordBattle(passwords);assert.equal(prepared.ok,true,prepared.reason);
  assert.deepEqual(prepared.parties.map(p=>p.map(e=>e.nativeProfile.fields['000'])),[[burstBasesFor(229)[0]],[burstBasesFor(230)[0]]]);
 }finally{await app.dispose();}
});

test('production readiness and observed QA gameplay use equivalent core configurations',async()=>{
 const {listProductExtensions}=await import('../src/championship/contracts/productSpeciesExtensions.js');
 const {ACTIVE_ALTERNATE_FORM_ASSETS}=await import('../src/championship/presentation/alternateFormAssetContracts.js');
 assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length,4);
 for(const e of listProductExtensions())for(const k of ['runtimeReady','evolutionReady','networkReady'])assert.equal(e[k],true);
 assert.deepEqual(read('src/data/championship/product-species-extensions.r1.json').entries,read('qa/alternate-form-product-catalog.json').entries);
 const core=e=>{const {blockers,...rest}=e;return rest;};
 assert.deepEqual(read('src/data/championship/alternate-form-assets.r1.json').characters.map(core),read('qa/alternate-form-asset-catalog.json').characters.map(core));
});
