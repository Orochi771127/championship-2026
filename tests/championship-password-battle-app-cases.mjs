import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
const passwords=['四ぬ体石た＿ダヨせＶ７ぶッ九ぐ','ザワヌＴ木タぬケ五パチる真ミどどＤＣＬサコぃ'];

function createApp(){
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  return createChampionshipStandaloneApp({storage,
    catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,
    rngClock:()=>({hour:13,minute:20,second:50})});
}

test('Password Battle restores two transient teams and commits exactly its prepared RNG',async()=>{
  const app=createApp();let runtime;
  try{
    await app.newGame();app.openBattle();
    const before=app.getGameplayRngState();
    const invalid=await app.preparePasswordBattle(['A',passwords[1]]);
    assert.equal(invalid.ok,false);assert.deepEqual(app.getGameplayRngState(),before);
    const prepared=await app.preparePasswordBattle(passwords);assert.equal(prepared.ok,true,prepared.message);
    const retry=await app.preparePasswordBattle(passwords);assert.equal(retry.ok,true,retry.message);
    assert.deepEqual(prepared.passwords,passwords);assert.deepEqual(retry.arenaIndex,prepared.arenaIndex);
    assert.deepEqual(app.getGameplayRngState(),before,'preview does not spend live gameplay RNG');
    assert.deepEqual(prepared.parties.map(team=>team.length),[2,3]);
    assert.equal(new Set(prepared.parties.flat().map(entry=>entry.instanceId)).size,5);
    runtime=createBattleRuntime({mode:4,battleType:0,playerIndividuals:prepared.parties[0],
      opponentIndividuals:prepared.parties[1],rng:prepared.rngPreparation.rng});
    runtime.choosePasswordBattle({arenaIndex:prepared.arenaIndex});const source=runtime.startMatch();
    assert.equal(source.getFrame().arena.index,prepared.arenaIndex);
    assert.equal(source.getFrame().combatants.filter(entry=>entry.present).length,5);
    const entry=app.enterPasswordBattle({passwords:prepared.passwords,rngPreparation:prepared.rngPreparation});
    assert.equal(entry.ok,true,entry.reason);assert.equal(entry.attempt.mode,4);assert.equal(entry.attempt.matchIndex,-1);
    assert.deepEqual(app.getGameplayRngState(),{version:1,...prepared.rngPreparation.rng.snapshot()});
    assert.equal(app.enterPasswordBattle({passwords:retry.passwords,rngPreparation:retry.rngPreparation}).reason,'BATTLE_SELECT_NOT_ACTIVE');
  }finally{runtime?.dispose();await app.dispose();}
});

test('Password Battle settles no transient profile into the Raising roster',async()=>{
  const app=createApp();let runtime;
  try{
    await app.newGame();const beforeCreature=structuredClone(app.getCreature().nativeProfile);
    app.openBattle();const beforeRecord=structuredClone(app.getTitleProgress().record);
    const prepared=await app.preparePasswordBattle(passwords);assert.equal(prepared.ok,true,prepared.message);
    runtime=createBattleRuntime({mode:4,battleType:0,playerIndividuals:prepared.parties[0],
      opponentIndividuals:prepared.parties[1],rng:prepared.rngPreparation.rng});
    runtime.choosePasswordBattle({arenaIndex:prepared.arenaIndex});const source=runtime.startMatch();
    const entry=app.enterPasswordBattle({passwords:prepared.passwords,rngPreparation:prepared.rngPreparation});assert.equal(entry.ok,true,entry.reason);
    for(let tick=0;tick<30000&&!source.getView().outcome.ended;tick++)source.tick();
    const result=runtime.getSettlementResult();assert.equal(result.ended,true);assert.equal(result.individualResults,undefined);
    const settled=app.finishMatch({...result,attemptId:entry.attempt.attemptId});assert.equal(settled.ok,true,settled.reason);
    assert.equal(settled.receipt.credited,0);assert.deepEqual(app.getCreature().nativeProfile,beforeCreature);
    assert.deepEqual(app.getTitleProgress().record,{battles:beforeRecord.battles+1,wins:beforeRecord.wins+Number(settled.receipt.won)});
  }finally{runtime?.dispose();await app.dispose();}
});
