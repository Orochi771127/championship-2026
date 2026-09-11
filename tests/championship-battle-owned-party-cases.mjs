import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battlePartyCondition,nativeBattleQualification,battlePartyAdmission,buildOwnedBattleCreature,settleOwnedBattleIndividual} from '../src/championship/battle/battleParty.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {listMoveRecordsForCombatant,listMoveRecordsForSpecies} from '../src/championship/battle/battleCatalogs.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const cpu=read('docs/research/BATTLE_PARTY_QUALIFICATION_CPU_2026-09-09.json');
test('all 23,256 original qualification vectors agree including condition table remapping',()=>{
  for(const v of cpu.vectors)assert.equal(nativeBattleQualification(v,battlePartyCondition(v.rule)),v.accepted,JSON.stringify(v));
});
test('all 216 original per-individual ordinary/title result writers agree',()=>{
  for(const v of cpu.results)assert.deepEqual(settleOwnedBattleIndividual({fields:v.input.fields,narrowFields:{'044':4,'046':22}},
    {...v.input,currentHp:v.input.fields['050'],metricLimit:v.input.fields['054']}),v.output);
});
const profile=()=>nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(34),rng:{next:()=>11}}));
test('owned roster preserves damaged HP, spent TP, trained values and instance identity',()=>{
  const p=structuredClone(profile());p.fields['050']=99;p.fields['054']=12;p.fields['060']=432;p.fields['084']=7;
  const c=buildOwnedBattleCreature({instanceId:'owned-1',nativeProfile:p});
  assert.equal(c.instanceId,'owned-1');assert.equal(c.currentHp,99);assert.equal(c.metricLimit,12);
  assert.equal(c.stats.field60,432);assert.equal(c.levels.field18,7);assert.equal(c.maxHp,p.fields['058']);
  assert.equal(battlePartyAdmission(p,0).ok,true);
  for(const k of ['134','138','13c'])assert.equal(battlePartyAdmission({...p,fields:{...p.fields,[k]:1}},0).reason,'CONDITION_UNFIT');
});
test('learned moves append after species scan, preserving order and duplicates',()=>{
  const original=listMoveRecordsForSpecies(34);
  const moves=listMoveRecordsForCombatant({speciesId:34,source12C:5,source130:5});
  assert.deepEqual(moves.slice(0,-2),original);assert.deepEqual(moves.slice(-2).map(m=>m.recordIndex),[5,5]);
});
test('owned individual runs actual battle, returns once, and survives fresh Continue',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
  const app=create();let runtime;
  try{
    await app.newGame();app.save();
    // Explicit controlled adult save. Gameplay still starts with the original egg.
    const [key,text]=[...data][0],save=JSON.parse(text);save.creature.nativeProfile=profile();save.creature.speciesId='species-034';
    data.set(key,JSON.stringify(save));await app.continueGame();
    app.advanceClock({units:19*1440*400});app.creditBits(150);app.openBattle();
    const id=app.getRaisingInstances()[0].instanceId;
    assert.equal((await app.prepareBattleParty(0,[])).ok,false);assert.equal((await app.prepareBattleParty(0,[id,id])).ok,false);
    const party=await app.prepareBattleParty(0,[id]);assert.equal(party.ok,true);
    const rngPreparation=app.prepareBattleRng(),beforeRng=app.getGameplayRngState();
    runtime=createBattleRuntime({schedule:app.getBattleSchedule(),mode:1,battleType:0,playerIndividuals:party.individuals,rng:rngPreparation.rng});
    runtime.chooseMatch(0);const source=runtime.startMatch();
    assert.equal(source.getFrame().combatants.filter(c=>c.present).length,2);
    assert.deepEqual(app.getGameplayRngState(),beforeRng,'unaccepted runtime preparation cannot consume game RNG');
    const entry=await app.enterMatch({...runtime.getEconomyContext(),playerInstanceIds:[id],rngPreparation});assert.equal(entry.ok,true);
    assert.deepEqual(app.getGameplayRngState(),{version:1,...rngPreparation.rng.snapshot()});
    for(let i=0;i<30000&&!source.getView().outcome.ended;i++)source.tick();
    const result=runtime.getSettlementResult();assert.equal(result.ended,true);
    assert.deepEqual(app.getGameplayRngState(),{version:1,...rngPreparation.rng.snapshot()},'live battle shares the accepted app RNG');
    assert.equal(result.individualResults[0].instanceId,id);
    const receipt=app.finishMatch({...result,attemptId:entry.attempt.attemptId});assert.equal(receipt.ok,true);
    assert.equal(app.finishMatch({...result,attemptId:entry.attempt.attemptId}).duplicate,true);
    assert.deepEqual(app.getCreature().nativeProfile,result.individualResults[0].nativeProfile);
    app.exitBattle();assert.equal(app.save().phase,'SAVED');
    const savedRng=app.getGameplayRngState();
    const restored=create();try{await restored.continueGame();assert.deepEqual(restored.getCreature().nativeProfile,result.individualResults[0].nativeProfile);
      // Continue may rebuild Home actors through the original RNG. The durable
      // save itself must contain every battle draw before that reconstruction.
      assert.deepEqual(JSON.parse(data.get(key)).gameplayRng,savedRng);
      assert.deepEqual(restored.getBattleReceipt(),receipt.receipt);}finally{await restored.dispose();}
  }finally{runtime?.dispose();await app.dispose();}
});
