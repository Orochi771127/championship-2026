// TEST ONLY: denied/unaccepted catalogs in an isolated Node test worker.
// The production-positive suites import unmodified catalogs; this fixture never
// changes a repository file, browser storage, source oracle or published flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){
 const r=next(url,context);
 if(url.endsWith('/product-species-extensions.r1.json')){
  const d=JSON.parse(r.source.toString());for(const e of d.entries)for(const k of ['runtimeReady','evolutionReady','networkReady'])e[k]=false;
  return {...r,source:JSON.stringify(d)};
 }
 if(url.endsWith('/alternate-form-assets.r1.json')){
  const d=JSON.parse(r.source.toString());for(const e of d.characters){e.runtimeReady=false;e.qa.normalPath='PENDING';}
  return {...r,source:JSON.stringify(d)};
 }
 return r;
}});
const {getProductExtension,requirePlayableProductExtension,resolveProductSpeciesDefinition}=await import('../src/championship/contracts/productSpeciesExtensions.js');
const {productHuntSpecies,productEvolutionOptions,assertPlayableProductSaveData}=await import('../src/championship/contracts/productSpeciesData.js');
const {nativeIndividualProfile,NATIVE_INDIVIDUAL_WORDS}=await import('../src/championship/raising/nativeIndividualProfile.js');
const {createNativeHuntIndividual}=await import('../src/championship/hunt/capture/nativeHuntIndividual.js');
const {createNativeRaisingActor,beginNativeRaisingEvolution,selectNativeRaisingEvolutionChoice}=await import('../src/championship/raising/nativeRaisingActor.js');
const password=await import('../src/championship/battle/nativePasswordBattle.js');
const link=await import('../src/championship/battle/nativeLinkBattle.js');
const {requireReadyTransportSpecies,productTransportHeader,encodeProductBattleEnvelope,PRODUCT_LINK_PREFIX}=await import('../src/championship/contracts/productBattleTransport.js');
const {encodeProductPasswordData}=await import('../src/championship/contracts/productPasswordTransport.js');
const {ACTIVE_ALTERNATE_FORM_ASSETS,ALTERNATE_FORM_ASSET_CANDIDATES,validateAlternateFormAsset}=await import('../src/championship/presentation/alternateFormAssetContracts.js');
const {getDatabaseDisplayEntry}=await import('../src/championship/database/databaseDisplayCatalog.js');
const {loadAcceptedDatabasePortrait}=await import('../src/championship/presentation/acceptedDatabasePortraits.js');
const rng=()=>({next:()=>50});
const profile=id=>nativeIndividualProfile(createNativeHuntIndividual({species:productHuntSpecies(id),rng:rng()}));
const individual=id=>({instanceId:`disabled:${id}`,nativeProfile:profile(id)});
const compact=speciesIndex=>({speciesIndex,personalityIndex:4,levelTens:1,hpSteps:2,tpSteps:3,level84:1,level88:1,level8C:1,level90:1,level94:3,level98:3,level9C:3,levelA0:3,levelA4:3});
test('disabled fixture: resolution and save ancestry remain fail-closed, never cast IDs',()=>{
 for(const id of [229,230]){
  for(const k of ['runtimeReady','evolutionReady','networkReady'])assert.equal(getProductExtension(id)[k],false);
  assert.throws(()=>requirePlayableProductExtension(id),/NOT_READY/);
  assert.throws(()=>resolveProductSpeciesDefinition(id,[]),/NOT_READY/);
  const p=structuredClone(profile(139));p.fields['154']=id;const before=JSON.stringify(p);
  assert.throws(()=>assertPlayableProductSaveData({creature:{nativeProfile:p}}),/PRODUCT_EXTENSION_NOT_READY/);assert.equal(JSON.stringify(p),before);
 }
});
test('disabled fixture: no new choices or inherited target activation',()=>{
 assert.deepEqual(productEvolutionOptions(211),[211]);assert.deepEqual(productEvolutionOptions(222),[222]);
 const a=createNativeRaisingActor(profile(139),0);beginNativeRaisingEvolution(a,{target:211,actor:{'1f4':2,'1f0':1}},rng());
 assert.equal(a.evolution.target,211);assert.equal(a.evolution.choicePending,undefined);assert.equal(selectNativeRaisingEvolutionChoice(a,229,rng()),false);
 const b=createNativeRaisingActor(profile(139),0),before=b.speciesIndex;
 assert.throws(()=>beginNativeRaisingEvolution(b,{target:229,actor:{'464':1}},rng()),/PRODUCT_EXTENSION_NOT_READY/);assert.equal(b.speciesIndex,before);assert.equal(b.evolution,undefined);
});
test('disabled fixture: every public password/link entry rejects new forms',()=>{
 const nativeInvite=link.createChampionshipLinkInvite({individuals:[individual(211)],arenaIndex:0,transportVersion:2});
 for(const id of [229,230]){
  assert.throws(()=>requireReadyTransportSpecies(id),/SPECIES_NOT_READY/);
  assert.equal(password.championshipPasswordProfileAdmission(profile(id)).reason,'PRODUCT_SPECIES_NOT_READY');
  assert.throws(()=>password.encodeChampionshipPasswordTeamFromProfiles([profile(id)]),/SPECIES_NOT_READY/);
  assert.throws(()=>link.createChampionshipLinkInvite({individuals:[individual(id)],arenaIndex:0}),/SPECIES_NOT_READY/);
  assert.throws(()=>link.createChampionshipLinkReply({inviteCode:nativeInvite.code,individuals:[individual(id)]}),/SPECIES_NOT_READY/);
 }
 const team={teamField:1,members:[{extra:1,compact:compact(229)},null,{extra:1,compact:compact(230)}]};
 assert.throws(()=>password.encodeChampionshipPasswordTeam(team),/SPECIES_NOT_READY/);
 assert.throws(()=>password.decodeChampionshipPasswordTeam(encodeProductPasswordData(team)),/SPECIES_NOT_READY/);
 const narrow=['03c','03d','044','046','194'],wire=p=>[NATIVE_INDIVIDUAL_WORDS.map(k=>p.fields[k]),narrow.map(k=>p.narrowFields[k]),p.name];
 const code=encodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,{...productTransportHeader('INVITE'),arenaIndex:0,host:[wire(profile(229)),wire(profile(230))]});
 assert.throws(()=>link.readChampionshipLinkInvite(code),/SPECIES_NOT_READY/);
});
test('disabled fixture: no live alternate assets or new Dex preview leakage',async()=>{
 assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length,0);
 for(const c of ALTERNATE_FORM_ASSET_CANDIDATES)assert.throws(()=>validateAlternateFormAsset({...c,runtimeReady:true}),/QA_REQUIRED/);
 for(const id of [229,230]){
  assert.equal(getDatabaseDisplayEntry(id),null);
  assert.equal(await loadAcceptedDatabasePortrait(id,{baseUrl:'https://example.test/',fetchImpl:()=>{throw Error('Unexpected fetch');}}),null);
 }
});
