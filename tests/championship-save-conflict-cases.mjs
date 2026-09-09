import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {deserializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
import {createChampionshipPersistentSavePort} from '../src/championship/app/ChampionshipPersistentSavePort.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
function setup(){const data=new Map();let blocked=false;const storage={getItem(k){if(blocked)throw Error('STORAGE_BLOCKED');return data.get(k)??null;},
  setItem(k,v){if(blocked)throw Error('STORAGE_BLOCKED');data.set(k,v);},removeItem:k=>data.delete(k)};
 const create=()=>createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
 cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});return {data,create,block:()=>blocked=true};}
test('stale tab cannot overwrite newer save on retry or inspection; explicit Continue adopts it',async()=>{
 const h=setup(),a=h.create();let b;
 try{await a.newGame();a.save();b=h.create();await b.continueGame();a.creditBits(123);assert.equal(a.save().phase,'SAVED');
 const newer=[...h.data.values()][0];b.creditBits(50);const result=b.save();assert.equal(result.lastCode,'CHAMPIONSHIP_MODERN_SAVE_CONFLICT');
 assert.equal(result.canRetry,false);assert.equal([...h.data.values()][0],newer);
 b.inspectSave();b.canContinue();assert.equal(b.savePort.getStatus().phase,'SAVE_FAILED');assert.equal(b.save().phase,'SAVE_FAILED');assert.equal([...h.data.values()][0],newer);
 const recovery=b.persistenceFacade().exportRecovery();assert.equal(recovery.storedText,newer);assert.notEqual(recovery.pendingText,newer);
 assert.equal(deserializeChampionshipModernSave(recovery.text).shop.bits,50);
 await b.continueGame();assert.equal(b.getShopFrame().bits,123);assert.equal(b.save().phase,'SAVED');
 }finally{await a.dispose();await b?.dispose();}
});

test('exclusive session lock admits one simultaneous owner and transfers only after release',async()=>{
 let held=false;
 const locks={async request(_key,{ifAvailable,mode},run){assert.equal(ifAvailable,true);assert.equal(mode,'exclusive');
   if(held)return run(null);held=true;try{return await run({name:'save'});}finally{held=false;}}};
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const a=createChampionshipPersistentSavePort({storage,locks}),b=createChampionshipPersistentSavePort({storage,locks});
 try{
   assert.deepEqual(await Promise.all([a.acquireSession(),b.acquireSession()]),[true,false]);
   assert.throws(()=>b.clear(),/SESSION_NOT_OWNED/);
   assert.equal(await a.acquireSession(),true);
   await a.releaseSession();assert.equal(await b.acquireSession(),true);
   assert.throws(()=>a.clear(),/SESSION_NOT_OWNED/);b.clear();
 }finally{await a.releaseSession();await b.releaseSession();}
});
test('failed write keeps serializable current progress exportable even when storage reads fail',async()=>{
 const h=setup(),a=h.create();try{await a.newGame();a.save();const durable=[...h.data.values()][0];a.creditBits(71);h.block();
 assert.equal(a.save().phase,'SAVE_FAILED');const recovery=a.persistenceFacade().exportRecovery();
 assert.equal(recovery.error,'STORAGE_BLOCKED');assert.equal(deserializeChampionshipModernSave(recovery.text).shop.bits,71);
 assert.equal([...h.data.values()][0],durable);
 }finally{await a.dispose();}
});
