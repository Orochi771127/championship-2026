// 2026-10-25 health check: save size reporting and the one persistent-storage request.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES} from '../src/championship/app/championshipStandaloneSave.js';
import {createStorageDurability, saveSizeLevel, SAVE_SIZE_HIGH_RATIO} from '../src/championship/app/storageDurability.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale} from '../src/championship/text/locale.js';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
function setup(){const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const create=()=>createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
 cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});return {data,create};}
const bytesOf=text=>new TextEncoder().encode(text).byteLength;

test('save status reports the stored byte size against the unchanged envelope budget',async()=>{
 const h=setup(),a=h.create();let b;
 try{
  assert.equal(a.savePort.getStatus().bytes,null);
  assert.equal(a.savePort.getStatus().byteBudget,CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES);
  await a.newGame();assert.equal(a.save().phase,'SAVED');
  const stored=[...h.data.values()][0];
  assert.equal(a.savePort.getStatus().bytes,bytesOf(stored));
  b=h.create();await b.continueGame();
  // Continue adopts the stored text; a later dirty mark keeps the known size.
  assert.equal(b.savePort.getStatus().bytes,bytesOf(stored));
  // Reporting size never rewrites the save.
  assert.equal([...h.data.values()][0],stored);
 }finally{await a.dispose();await b?.dispose();}
});

test('save size level warns from 75% of the budget and ignores unknown values',()=>{
 assert.equal(SAVE_SIZE_HIGH_RATIO,.75);
 assert.equal(saveSizeLevel(15211,65536),'OK');
 assert.equal(saveSizeLevel(49151,65536),'OK');
 assert.equal(saveSizeLevel(49152,65536),'HIGH');
 for(const [bytes,budget] of [[null,65536],[100,0],[-1,65536],[1.5,65536],[100,undefined]])assert.equal(saveSizeLevel(bytes,budget),null);
});

test('an existing grant is reused without asking the browser again',async()=>{
 const calls=[];const changes=[];
 const durability=createStorageDurability({storageManager:{persisted:async()=>{calls.push('persisted');return true;},persist:async()=>{calls.push('persist');return true;}},onChange:s=>changes.push(s)});
 assert.equal(durability.getState(),'UNKNOWN');
 assert.equal(await durability.requestOnce(),'PERSISTED');
 assert.equal(await durability.requestOnce(),'PERSISTED');
 assert.deepEqual(calls,['persisted']);assert.deepEqual(changes,['PERSISTED']);
});

test('the browser is asked at most once and a refusal or failure is reported, not thrown',async()=>{
 let asks=0;
 const refused=createStorageDurability({storageManager:{persisted:async()=>false,persist:async()=>{asks++;return false;}}});
 await Promise.all([refused.requestOnce(),refused.requestOnce()]);await refused.requestOnce();
 assert.equal(refused.getState(),'NOT_PERSISTED');assert.equal(asks,1);
 const failing=createStorageDurability({storageManager:{persisted:async()=>{throw Error('SecurityError');},persist:async()=>true}});
 assert.equal(await failing.requestOnce(),'UNKNOWN');
 const unsupported=createStorageDurability({storageManager:undefined});
 assert.equal(unsupported.getState(),'UNSUPPORTED');assert.equal(await unsupported.requestOnce(),'UNSUPPORTED');
});

test('durability notes exist in all five languages and keep their placeholders',()=>{
 for(const locale of ['zh-Hant','en','ja','th','vi']){
  setLocale(locale);
  const usage=uiText('SAVE_SIZE_USAGE',{used:'15',budget:'64'});
  assert.match(usage,/15/);assert.match(usage,/64/);assert.doesNotMatch(usage,/\{|SAVE_SIZE_USAGE/);
  for(const key of ['SAVE_SIZE_HIGH','STORAGE_PERSISTED','STORAGE_NOT_PERSISTED'])assert.notEqual(uiText(key),key,`${locale}:${key}`);
 }
 setLocale('zh-Hant');
});
