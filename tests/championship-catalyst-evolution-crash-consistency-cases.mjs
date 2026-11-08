// Catalyst evolution crash consistency (docs/reports/ranch-load-2026-11-08/, S1).
// The metal used to be spent and saved when the catalyst started while the
// running evolution lived only in memory: a reload or return to title before
// the new form was written kept the loss and dropped the evolution. The save
// must never hold "metal spent, form unchanged". The real standalone app runs
// with the public entry's options and the fixed ranch-load diagnostic save.
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
const MAIN='resident:species-000',OTHER='diagnostic:species-038',SHARD='metal:chrono-ore-shard';

function harness({shards=2}={}){
  const saved=JSON.parse(fixture);saved.progression.cyberGacha.metals={[SHARD]:shards};
  const data=new Map([[KEY,JSON.stringify(saved)]]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),
    key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
  let now=Date.parse('2026-11-05T13:20:50.000Z');
  const make=()=>createChampionshipStandaloneApp({storage,catalog,cages:RAISING_CAGES,locks:null,playtestPolicy:FRIENDS_PLAYTEST_POLICY,
    productEconomy:true,partnerLife:true,clockPolicy:'REALTIME_V1',now:()=>new Date(now).toISOString()});
  const stored=()=>{const s=JSON.parse(data.get(KEY));return {species:s.creature.speciesId,metal:s.progression.cyberGacha.metals[SHARD]??0};};
  async function open(){
    const app=make();await app.continueGame();
    // Let the ranch place its partners, as the scene clock does on entry.
    for(let i=0;i<3;i++){now+=1000;app.advanceNaturalClock({frames:60});}
    assert.equal(app.getCyberGachaFrame().partners.find(p=>p.instanceId===MAIN)?.inRanch,true,'Main partner on the ranch');
    return app;
  }
  return {data,stored,open,snapshot:()=>data.get(KEY),restore:text=>data.set(KEY,text)};
}
const open=h=>h.open();
const evolving=app=>app.getRaisingLifecycleFrame().evolution!==null;
function finishEvolution(app,onStep=()=>{}){
  for(let frames=0;evolving(app);frames+=10){assert.ok(frames<5000,'Evolution finishes');app.advanceRaisingPresentation({frames:10});onStep();}
}

test('a save taken at any moment of a catalyst evolution never holds a spent metal with the old form',async()=>{
  const h=harness(),app=await open(h);
  assert.deepEqual(h.stored(),{species:'species-034',metal:2});
  const used=app.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'});
  assert.equal(used.ok,true,used.reason);assert.equal(used.kind,'CATALYST');assert.equal(used.target,96);
  const seen=new Set();
  const check=()=>{app.save();const s=h.stored();seen.add(`${s.species}:${s.metal}`);
    assert.ok(s.species==='species-034'&&s.metal===2||s.species==='species-096'&&s.metal===1,`Consistent save: ${JSON.stringify(s)}`);};
  check();finishEvolution(app,check);check();
  assert.equal(app.getCreature().speciesId,'species-096');
  assert.deepEqual([...seen],['species-034:2','species-096:1'],'Only the two consistent states were ever saved');
  await app.dispose();
});
test('reloading mid-evolution keeps partner and metal, and the catalyst can be used again',async()=>{
  const h=harness(),first=await open(h);
  assert.equal(first.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'}).ok,true);
  first.advanceRaisingPresentation({frames:40});assert.ok(evolving(first),'Still evolving');
  first.save();const midEvolution=h.snapshot();await first.dispose();
  h.restore(midEvolution);
  assert.deepEqual(h.stored(),{species:'species-034',metal:2},'The interrupted evolution cost nothing');
  const second=await open(h);
  assert.equal(second.getCyberGachaFrame().metals.find(m=>m.id===SHARD).owned,2);
  const again=second.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'});assert.equal(again.ok,true,again.reason);
  finishEvolution(second);second.save();
  assert.deepEqual(h.stored(),{species:'species-096',metal:1});
  await second.dispose();
});

test('the held metal cannot be used twice while its evolution runs; a second one can',async()=>{
  const one=harness({shards:1}),a=await open(one);
  assert.equal(a.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'}).ok,true);
  assert.equal(a.getCyberGachaFrame().metals.find(m=>m.id===SHARD).owned,0,'Bag shows the held metal as gone');
  assert.equal(a.gachaUseItem(SHARD,OTHER,{mode:'ENHANCE'}).reason,'NOT_OWNED');
  assert.equal(a.gachaFuseShards(SHARD).reason,'NOT_ENOUGH_SHARDS');
  finishEvolution(a);a.save();
  assert.deepEqual(one.stored(),{species:'species-096',metal:0});
  await a.dispose();

  const two=harness({shards:2}),b=await open(two);
  assert.equal(b.gachaUseItem(SHARD,MAIN,{mode:'CATALYST'}).ok,true);
  assert.equal(b.getCyberGachaFrame().metals.find(m=>m.id===SHARD).owned,1);
  const enhanced=b.gachaUseItem(SHARD,OTHER,{mode:'ENHANCE'});assert.equal(enhanced.ok,true,enhanced.reason);
  assert.deepEqual(two.stored(),{species:'species-034',metal:1},'Only the enhance was spent so far');
  finishEvolution(b);b.save();
  assert.deepEqual(two.stored(),{species:'species-096',metal:0});
  await b.dispose();
});
