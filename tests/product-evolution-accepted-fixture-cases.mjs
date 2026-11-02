// QA-ONLY activation fixture; not release evidence for graphics or assets.
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){const result=next(url,context);
 if(url.endsWith('/product-species-extensions.r1.json')){const d=JSON.parse(result.source.toString());d.entries.forEach(e=>{e.runtimeReady=e.evolutionReady=e.networkReady=true;});return {...result,source:JSON.stringify(d)};}
 if(url.endsWith('/alternate-form-assets.r1.json')){const d=JSON.parse(result.source.toString());d.characters.forEach(e=>{e.runtimeReady=true;e.qa.normalPath='PASS';});return {...result,source:JSON.stringify(d)};}
 return result;}});
const {productHuntSpecies}=await import('../src/championship/contracts/productSpeciesData.js');
const {createNativeHuntIndividual}=await import('../src/championship/hunt/capture/nativeHuntIndividual.js');
const {nativeIndividualProfile}=await import('../src/championship/raising/nativeIndividualProfile.js');
const actor=await import('../src/championship/raising/nativeRaisingActor.js');
const {listDatabaseSlots}=await import('../src/championship/database/databaseCatalog.js');
const {getDatabaseDisplayEntry,DATABASE_DISPLAY_CATALOG}=await import('../src/championship/database/databaseDisplayCatalog.js');
const rng={next:()=>50};
test('accepted catalog adds only2 append-only book slots and owner fixed display order',()=>{const slots=listDatabaseSlots();assert.equal(slots.length,226);assert.deepEqual(slots.slice(216,218).map(s=>s.speciesIndex),[229,230]);
  // Owner 2026-11-03: the playable originals follow the two forms.
  assert.deepEqual(slots.slice(218).map(s=>s.speciesIndex),[231,232,234,235,236,237,239,240]);for(const [id,code] of [[222,'UL02'],[230,'UL03'],[211,'UL33'],[229,'UL34']])assert.equal(getDatabaseDisplayEntry(id).displayCode,code);const ultimate=DATABASE_DISPLAY_CATALOG.entries.filter(e=>e.numberingStageIndex===6);assert.deepEqual(ultimate.map(e=>e.serial),Array.from({length:42},(_,i)=>i+1));});
for(const [source,base,target] of [[139,211,229],[143,211,229],[144,222,230],[139,211,211],[144,222,222]])test(`real choice/animation/form construction ${source} -> ${target}`,()=>{
 const profile=nativeIndividualProfile(createNativeHuntIndividual({species:productHuntSpecies(source),rng}));const a=actor.createNativeRaisingActor(profile,0);actor.initializeNativeRaisingActor(a,profile,[0,0,0],0,rng);
 actor.beginNativeRaisingEvolution(a,{target:base,actor:{'1f4':2,'1f0':1}},rng);
 assert.equal(a.evolution.choicePending,true);assert.equal(a.evolution.elapsed,0);assert.equal(actor.stepNativeRaisingEvolution(a,profile,rng).changed,false);assert.equal(a.speciesIndex,source);
 assert.equal(actor.selectNativeRaisingEvolutionChoice(a,228,rng),false);assert.equal(actor.selectNativeRaisingEvolutionChoice(a,target,rng),true);
 let result;for(let i=0;i<1000;i++){result=actor.stepNativeRaisingEvolution(a,profile,rng);if(result.evolved)break;}
 assert.equal(result.evolved,true);assert.equal(result.profile.fields['000'],target);assert.equal(a.speciesIndex,target);assert.equal(result.event.productRouteId,target===base?null:`${source}:${base}:${target}`);assert.equal(a.sequenceId,33);assert.ok(actor.projectNativeRaisingActor(a));
});
// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): 覺醒體 no longer grow, so the former
// 139->229 route is gone from the page; 229 is offered as an alternate of the 211 burst form on its 成熟期.
test('an alternate battle form rides on its base burst form; a former 覺醒體 page lists no growth route',async()=>{const {projectDatabaseEvolutionRoutes}=await import('../src/championship/database/databaseEvolutionRoutes.js');const {projectDatabaseBurst}=await import('../src/championship/database/databaseBurstEvolution.js');const options={sourceRegistered:true,registeredSpecies:[211,229],evolutionBranches:[],productEvolutionBranches:['139:211:229']};assert.deepEqual(projectDatabaseEvolutionRoutes(139,options).map(r=>r.targetSpeciesIndex),[]);const form=projectDatabaseBurst(229,{registeredSpecies:[211,229]});assert.equal(form.kind,'FORM');assert.equal(form.tier,2);const base=projectDatabaseBurst(form.bases[0].baseSpeciesIndex,{fullView:true});assert.ok(base.forms.some(f=>f.formSpeciesIndex===211&&f.alternates.includes(229)));});
test('real battle presentation preserves both new IDs, names and animation bindings',async()=>{const {createBattleRuntime}=await import('../src/championship/app/battleRuntime.js');const make=id=>({instanceId:`qa-${id}`,nativeProfile:nativeIndividualProfile(createNativeHuntIndividual({species:productHuntSpecies(id),rng}))});const runtime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:[make(229)],opponentIndividuals:[make(230)],localTeamIndex:0,rng});try{runtime.chooseLinkBattle({arenaIndex:0});const source=runtime.startMatch(),members=source.getFrame().combatants.filter(c=>c.present);assert.deepEqual(members.map(c=>c.speciesId),['species-229','species-230']);assert.ok(members.every(c=>typeof c.displayName==='string'&&c.displayName.length));assert.ok(members.every(c=>c.animationRequest));}finally{runtime.dispose();}});
