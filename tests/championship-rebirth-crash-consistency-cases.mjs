// Rebirth crash consistency (docs/reports/system-sweep-2026-11-08/, S2).
// The cycle count used to be written when the rebirth animation started while
// the egg only appeared at its end; the running evolution lives only in memory.
// Any save in between (an explicit commit elsewhere, a load-failure leave) kept
// "cycle +1, still 成熟期", and after a reload the partner could be reborn
// again. The save must only ever hold "成熟期, old count" or "egg, new count".
// The real standalone app runs with the public entry's options and the fixed
// ranch-load diagnostic save; the partner reaches 成熟期 by a catalyst first.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY as KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {RAISING_CAGES} from '../src/championship/app/cageRoster.js';

process.env.TZ='UTC';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/championship/catalogs/creature-species.r1.json',import.meta.url),'utf8'));
const fixture=fs.readFileSync(new URL('./fixtures/ranch-load-diagnostic-save.json',import.meta.url),'utf8');
const MAIN='resident:species-000',SHARD='metal:chrono-ore-shard';

function harness(){
  const saved=JSON.parse(fixture);saved.progression.cyberGacha.metals={[SHARD]:1};
  const data=new Map([[KEY,JSON.stringify(saved)]]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),
    key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
  let now=Date.parse('2026-11-05T13:20:50.000Z');
  const make=()=>createChampionshipStandaloneApp({storage,catalog,cages:RAISING_CAGES,locks:null,playtestPolicy:FRIENDS_PLAYTEST_POLICY,
    productEconomy:true,partnerLife:true,clockPolicy:'REALTIME_V1',now:()=>new Date(now).toISOString()});
  const stored=()=>{const s=JSON.parse(data.get(KEY)).creature;return {species:s.speciesId,cycles:s.nativeProfile.narrowFields['03c']};};
  async function open(){
    const app=make();await app.continueGame();
    for(let i=0;i<3;i++){now+=1000;app.advanceNaturalClock({frames:60});}
    return app;
  }
  return {stored,open,snapshot:()=>data.get(KEY),restore:text=>data.set(KEY,text)};
}
const evolving=app=>app.getRaisingLifecycleFrame().evolution!==null;
function finishEvolution(app,onStep=()=>{}){
  for(let frames=0;evolving(app);frames+=10){assert.ok(frames<5000,'Evolution finishes');app.advanceRaisingPresentation({frames:10});onStep();}
}
// A 成熟期 main partner with no rebirth yet, saved.
async function matured(h){
  const app=await h.open();
  assert.equal(app.rebirthRaisingPartner(MAIN).reason,'NOT_FINAL_STAGE');
  assert.equal(app.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'}).ok,true);
  finishEvolution(app);app.save();
  assert.deepEqual(h.stored(),{species:'species-096',cycles:0});
  return app;
}

test('a save taken at any moment of a rebirth never holds the new cycle count with the old form',async()=>{
  const h=harness(),app=await matured(h);
  const reborn=app.rebirthRaisingPartner(MAIN);assert.equal(reborn.ok,true,reborn.reason);assert.equal(reborn.target,1);
  const seen=new Set();
  const check=()=>{app.save();const s=h.stored();seen.add(`${s.species}:${s.cycles}`);
    assert.ok(s.species==='species-096'&&s.cycles===0||s.species==='species-001'&&s.cycles===1,`Consistent save: ${JSON.stringify(s)}`);};
  check();finishEvolution(app,check);check();
  assert.equal(app.getCreature().speciesId,'species-001');
  assert.deepEqual([...seen],['species-096:0','species-001:1'],'Only the two consistent states were ever saved');
  await app.dispose();
});

test('reloading mid-rebirth leaves the partner as it was, and one rebirth still counts once',async()=>{
  const h=harness(),first=await matured(h);
  assert.equal(first.rebirthRaisingPartner(MAIN).ok,true);
  first.advanceRaisingPresentation({frames:40});assert.ok(evolving(first),'Rebirth still running');
  first.save();const midRebirth=h.snapshot();await first.dispose();
  h.restore(midRebirth);
  assert.deepEqual(h.stored(),{species:'species-096',cycles:0},'The interrupted rebirth changed nothing');
  const second=await h.open();
  const again=second.rebirthRaisingPartner(MAIN);assert.equal(again.ok,true,again.reason);assert.equal(again.target,1);
  assert.equal(second.rebirthRaisingPartner(MAIN).reason,'EVOLUTION_RUNNING','No second rebirth while one runs');
  finishEvolution(second);second.save();
  assert.deepEqual(h.stored(),{species:'species-001',cycles:1});
  await second.dispose();
});
