import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battlePartyCondition,nativeBattleQualification,battlePartyAdmission,buildOwnedBattleCreature,settleOwnedBattleIndividual,drawNativeTitleBattleArena} from '../src/championship/battle/battleParty.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {listMoveRecordsForCombatant,listMoveRecordsForSpecies} from '../src/championship/battle/battleCatalogs.js';
import {BATTLE_CREATURE_STAT_MAP} from '../src/championship/battle/battleCreatureBuild.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const cpu=read('docs/research/BATTLE_PARTY_QUALIFICATION_CPU_2026-09-09.json');

test('all 620 native title arena vectors preserve fixed fields and random-channel draws',()=>{
  for(const row of read('docs/research/TITLE_ARENA_CPU_2026-09-14.json').vectors){
    const channels=[];assert.equal(drawNativeTitleBattleArena(row.title,{next:c=>{channels.push(c);return row.random;}}),row.arena);
    assert.deepEqual(channels,row.channels);
  }
});
test('all 23,256 original qualification vectors agree including condition table remapping',()=>{
  for(const v of cpu.vectors)assert.equal(nativeBattleQualification(v,battlePartyCondition(v.rule)),v.accepted,JSON.stringify(v));
});
test('all 216 original per-individual ordinary/title result writers agree',()=>{
  for(const v of cpu.results)assert.deepEqual(settleOwnedBattleIndividual({fields:v.input.fields,narrowFields:{'044':4,'046':22}},
    {...v.input,currentHp:v.input.fields['050'],metricLimit:v.input.fields['054']}),v.output);
});
const profile=()=>nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(34),rng:{next:()=>11}}));

test('all 72 original Practice results update the correct owned side, including draws',()=>{
  const cpu=read('docs/research/PRACTICE_BATTLE_CPU_2026-09-14.json');
  for(const v of cpu.results)assert.deepEqual(settleOwnedBattleIndividual({fields:v.input.fields,narrowFields:{'044':4,'046':22}},
    {...v.input,currentHp:v.input.fields['050'],metricLimit:v.input.fields['054']}),v.output);
});

test('Practice keeps both owned teams distinct, settles both once and awards no global progress or money',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
  let runtime;
  try{
    await app.newGame();app.save();const [key,text]=[...data][0],save=JSON.parse(text),other='practice:other';
    save.creature.nativeProfile=profile();save.creature.speciesId='species-034';
    save.raising.collection.push({instanceId:other,speciesId:'species-034',displayName:'乙隊',nativeProfile:profile(),
      enclosedAt:null,originGateId:null,successAuthority:'CONTROLLED_TEST_PROFILE'});
    save.raising.assignments[other]=save.raising.assignments[save.creature.creatureId];
    data.set(key,JSON.stringify(save));await app.continueGame();app.openBattle();
    const id=app.getRaisingInstances()[0].instanceId,wallet=app.getShopFrame().bits;
    assert.equal((await app.preparePracticeBattle([[id],[id]])).reason,'DUPLICATE_PARTICIPANT');
    assert.equal((await app.preparePracticeBattle([[id],[]])).ok,false);
    assert.equal((await app.preparePracticeBattle([[id],[other]],6)).ok,false);
    const before=app.getGameplayRngState(),party=await app.preparePracticeBattle([[id],[other]],7);assert.equal(party.ok,true,party.reason);
    assert.deepEqual(app.getGameplayRngState(),before);
    runtime=createBattleRuntime({mode:5,battleType:0,playerIndividuals:party.parties[0],opponentIndividuals:party.parties[1],rng:party.rngPreparation.rng});
    runtime.choosePracticeBattle({arenaIndex:party.arenaIndex});const source=runtime.startMatch();assert.equal(source.getFrame().arena.index,7);
    const entry=app.enterPracticeBattle({playerInstanceIds:[id,other],rngPreparation:party.rngPreparation});assert.equal(entry.ok,true,entry.reason);
    for(let tick=0;tick<30000&&!source.getView().outcome.ended;tick++)source.tick();
    const result=runtime.getSettlementResult();assert.equal(result.ended,true);assert.deepEqual(result.individualResults.map(r=>r.instanceId),[id,other]);
    for(let team=0;team<2;team++){
      const final=source.getView().combatants[team*3];assert.deepEqual(result.individualResults[team].nativeProfile,
        settleOwnedBattleIndividual(party.parties[team][0].nativeProfile,{currentHp:final.hp.current,metricLimit:final.resource.current,verdict:result.verdict,mode:5,teamIndex:team}));
    }
    assert.equal(app.finishMatch({...result,attemptId:entry.attempt.attemptId}).ok,true);assert.equal(app.getShopFrame().bits,wallet);
    assert.equal(app.getBattleReceipt().credited,0);app.exitBattle();app.save();
    const stored=JSON.parse(data.get(key));assert.deepEqual(stored.creature.nativeProfile,result.individualResults[0].nativeProfile);
    assert.deepEqual(stored.raising.collection.find(c=>c.instanceId===other).nativeProfile,result.individualResults[1].nativeProfile);
    assert.deepEqual(stored.progression.nativeTitles,save.progression.nativeTitles);
  }finally{runtime?.dispose();await app.dispose();}
});

test('owned Free Battle singles and teams finish through the shared settlement and durable save',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
  let runtime;
  try{
    await app.newGame();app.save();
    const [key,text]=[...data][0],save=JSON.parse(text),adult=structuredClone(nativeIndividualProfile(
      createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(217),rng:{next:()=>11}})));
    adult.fields['050']=adult.fields['058']=30000;adult.fields['054']=adult.fields['05c']=9000;
    for(const entry of BATTLE_CREATURE_STAT_MAP)if(entry.value!==0x54)adult.fields[entry.value.toString(16).padStart(3,'0')]=999;
    save.creature.nativeProfile=adult;save.creature.speciesId='species-217';data.set(key,JSON.stringify(save));await app.continueGame();
    const id=app.getRaisingInstances()[0].instanceId;
    for(const kind of ['SINGLE','TEAM']){
      app.openBattle();const match=app.getFreeBattleMatches().find(row=>row.kind===kind),wallet=app.getShopFrame().bits;
      assert.equal((await app.prepareFreeBattle(match.id,[])).ok,false);
      assert.equal((await app.prepareFreeBattle('single:999',[id])).ok,false);
      const before=app.getGameplayRngState(),prepared=await app.prepareFreeBattle(match.id,[id]);assert.equal(prepared.ok,true);
      const retry=await app.prepareFreeBattle(match.id,[id]);assert.equal(retry.arenaIndex,prepared.arenaIndex);
      assert.deepEqual(app.getGameplayRngState(),before);assert.ok([0,1,2,3,4,5,7].includes(prepared.arenaIndex));
      runtime=createBattleRuntime({mode:2,battleType:0,playerIndividuals:prepared.individuals,rng:prepared.rngPreparation.rng});
      runtime.chooseFreeBattle({presetIndices:match.presetIndices,arenaIndex:prepared.arenaIndex});const source=runtime.startMatch();
      assert.equal(source.getFrame().combatants.filter(c=>c.present).length,1+match.slots);
      assert.equal(source.getFrame().arena.index,prepared.arenaIndex);
      const entry=app.enterFreeBattle({playerInstanceIds:[id],rngPreparation:prepared.rngPreparation});assert.equal(entry.ok,true,entry.reason);
      assert.equal(entry.attempt.matchIndex,-1);assert.equal(app.getShopFrame().bits,wallet);
      for(let tick=0;tick<30000&&!source.getView().outcome.ended;tick++)source.tick();
      const result=runtime.getSettlementResult();assert.equal(result.ended,true);assert.equal(result.verdict,4);
      const receipt=app.finishMatch({...result,attemptId:entry.attempt.attemptId});assert.equal(receipt.ok,true,receipt.reason);
      assert.equal(receipt.receipt.credited,match.payout);assert.equal(app.getShopFrame().bits,wallet+match.payout);
      assert.equal(app.getCreature().nativeProfile.fields['020'],Math.min(100,prepared.individuals[0].nativeProfile.fields['020']+1));
      assert.equal(app.finishMatch({...result,attemptId:entry.attempt.attemptId}).duplicate,true);
      app.exitBattle();runtime.dispose();runtime=null;
      app.openBattle();assert.equal(app.enterFreeBattle({playerInstanceIds:[id],rngPreparation:retry.rngPreparation}).reason,'BATTLE_PREPARATION_STALE');
      app.leaveScreen();app.save();const stored=JSON.parse(data.get(key));assert.deepEqual(stored.creature.nativeProfile,result.individualResults[0].nativeProfile);
    }
  }finally{runtime?.dispose();await app.dispose();}
});

test('owned championship rounds use arena 10, one committed draw and native round recovery',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
  let runtime;
  try{
    await app.newGame();app.save();
    const [key,text]=[...data][0],save=JSON.parse(text),adult=structuredClone(nativeIndividualProfile(
      createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(217),rng:{next:()=>11}})));
    adult.fields['050']=adult.fields['058']=30000;adult.fields['054']=adult.fields['05c']=9000;
    for(const entry of BATTLE_CREATURE_STAT_MAP)if(entry.value!==0x54)adult.fields[entry.value.toString(16).padStart(3,'0')]=999;
    save.creature.nativeProfile=adult;save.creature.speciesId='species-217';
    save.progression.nativeTitles.championship={stage:1,entry:1,worldEntry:0};
    data.set(key,JSON.stringify(save));assert.equal(app.inspectSave().present,true,JSON.stringify(app.inspectSave()));
    await app.continueGame();app.openBattle();app.openChampionship();
    const opened=app.beginChampionship(0);assert.equal(opened.ok,true,JSON.stringify(opened));
    const id=app.getRaisingInstances()[0].instanceId,wallet=app.getShopFrame().bits;
    assert.equal((await app.prepareChampionshipBattle([])).ok,false);
    for(let round=0;round<3;round++){
      const before=app.getGameplayRngState(),run=app.getChampionshipRun();
      const prepared=await app.prepareChampionshipBattle([id]);assert.equal(prepared.ok,true,JSON.stringify(prepared));
      assert.deepEqual(app.getGameplayRngState(),before,'preparation spends no live random state');
      const preview=await app.prepareChampionshipBattle([id]);
      assert.deepEqual(preview.opponent,prepared.opponent,'retrying preparation does not reroll');
      runtime=createBattleRuntime({mode:0,battleType:0,playerIndividuals:prepared.individuals,rng:prepared.rngPreparation.rng});
      runtime.chooseChampionshipRound({category:0,teamIndex:prepared.opponent.teamIndex,cursor:round,totalRounds:run.totalRounds});
      const source=runtime.startMatch();assert.equal(source.getFrame().arena.index,10);
      const attemptId=`battle:${app.getBattleEconomyState().nextSequence}`;
      const entry=app.enterChampionshipRound({attemptId,playerInstanceIds:[id],rngPreparation:prepared.rngPreparation});assert.equal(entry.ok,true,entry.reason);
      assert.deepEqual(app.getGameplayRngState(),{version:1,...prepared.rngPreparation.rng.snapshot()});
      for(let tick=0;tick<30000&&!source.getView().outcome.ended;tick++)source.tick();
      const result=runtime.getSettlementResult();assert.equal(result.ended,true);assert.equal(result.verdict,4,JSON.stringify({round,reason:result.reason,combatants:source.getView().combatants}));
      const final=source.getView().combatants[0];
      const expected=settleOwnedBattleIndividual(prepared.individuals[0].nativeProfile,{currentHp:final.hp.current,
        metricLimit:final.resource.current,verdict:result.verdict,mode:0,event:0,cursor:round+1,totalRounds:3});
      assert.deepEqual(result.individualResults[0].nativeProfile,expected);
      assert.equal(app.finishMatch({...result,attemptId}).ok,true);assert.equal(app.getChampionshipRun().cursor,round+1);
      assert.deepEqual(app.getCreature().nativeProfile,expected);
      app.exitBattle();runtime.dispose();runtime=null;
    }
    assert.equal(app.settleChampionship().prize,50000);assert.equal(app.getShopFrame().bits,wallet+50000);
    assert.equal(app.settleChampionship().reason,'NO_CHAMPIONSHIP_RUNNING');
    app.save();const saved=JSON.parse(data.get([...data.keys()][0]));assert.equal(saved.progression.championshipRun,null);
  }finally{runtime?.dispose();await app.dispose();}
});
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
