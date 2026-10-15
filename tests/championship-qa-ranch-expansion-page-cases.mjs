// Event-wiring tests with an isolated DOM/storage harness, not browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createQaRanchExpansionText} from '../src/championship/app/qaRanchExpansion.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave,serializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
const fixture=fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url),'utf8');
const original=JSON.parse(fixture);original.cageEdit.layoutVersion='NATIVE_ANCHORS_V1';delete original.cageEdit.expansion;original.shop.bits=123456;
const previous=JSON.stringify(original);
const html=fs.readFileSync(new URL('../full-qa-save.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'');
async function page({locked=false,quota=false,activeQuota=false,silentWrite=false,backupSilent=false,race=false,value=previous,noLocks=false,fixturePending=false,fixtureFailure=false,holdLock=false}={}){
 const nodes=Object.fromEntries(['install','download','expand','status'].map(id=>['#'+id,{disabled:id!=='status',dataset:{}}]));
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,value]]);let downloads=0;const writes=[];
 let resolveFixture, rejectFixture, releaseLock;
 const fixtureResponse={ok:true,text:async()=>fixture};
 const pendingFixture=new Promise((resolve,reject)=>{resolveFixture=resolve;rejectFixture=reject;});
 const context={CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave,serializeChampionshipModernSave,createQaRanchExpansionText,
 document:{querySelector:s=>nodes[s],createElement:()=>({click(){downloads++;if(race)data.set(CHAMPIONSHIP_MODERN_SAVE_KEY,'newer progress');},remove(){}}),body:{append(){}}},
 fetch:()=>fixturePending?pendingFixture:fixtureFailure?Promise.reject(Error('fixture unavailable')):Promise.resolve(fixtureResponse),Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>{},Date,
 localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);if(quota||(activeQuota&&k===CHAMPIONSHIP_MODERN_SAVE_KEY))throw Error('QuotaExceededError');if((silentWrite&&k===CHAMPIONSHIP_MODERN_SAVE_KEY)||(backupSilent&&k!==CHAMPIONSHIP_MODERN_SAVE_KEY))return;data.set(k,v);}},
 navigator:{locks:{request:async(key,options,callback)=>{assert.equal(key,CHAMPIONSHIP_MODERN_SAVE_KEY);assert.equal(options.ifAvailable,true);if(holdLock)await new Promise(resolve=>{releaseLock=resolve;});return callback(locked?null:{});}}},location:{href:''}};
 if(noLocks)delete context.navigator.locks;
 const initialized=vm.runInNewContext(`(async()=>{${script}\n})()`,context);
 if(!fixturePending)await initialized;
 return {nodes,data,context,writes,downloads:()=>downloads,initialized,resolveFixture:()=>resolveFixture(fixtureResponse),rejectFixture:()=>rejectFixture(Error('fixture unavailable')),releaseLock:()=>releaseLock()};
}
test('QA page click backs up exact existing progress, preserves unrelated data, and remains on QA page',async()=>{
 const p=await page();await p.nodes['#expand'].onclick();
 assert.equal(p.downloads(),1);assert.deepEqual(p.writes,[`${CHAMPIONSHIP_MODERN_SAVE_KEY}:qa-expansion-backup`,CHAMPIONSHIP_MODERN_SAVE_KEY]);assert.equal(p.data.get(`${CHAMPIONSHIP_MODERN_SAVE_KEY}:qa-expansion-backup`),previous);
 const saved=JSON.parse(p.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));assert.equal(saved.cageEdit.layoutVersion,'NATIVE_DECKS_V1');saved.cageEdit=original.cageEdit;assert.deepEqual(saved,original);
 assert.equal(p.nodes['#status'].dataset.state,'ready');assert.equal(p.context.location.href,'');assert.equal(p.nodes['#expand'].disabled,false);
 await p.nodes['#expand'].onclick();assert.equal(p.downloads(),1);assert.match(p.nodes['#status'].textContent,/已全部開放/);
});
test('QA page lock or backup quota failures preserve exact active save and show error',async()=>{
 for(const opts of [{locked:true},{quota:true}]){
 const p=await page(opts);await p.nodes['#expand'].onclick();assert.equal(p.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),previous);assert.equal(p.nodes['#status'].dataset.state,'error');assert.equal(p.downloads(),0);assert.equal(p.nodes['#expand'].disabled,false);assert.equal(p.context.location.href,'');
 }
});
test('fixture is canonical serializer output with annex enabled and existing layout preserved',()=>{
 assert.equal(serializeChampionshipModernSave(deserializeChampionshipModernSave(fixture))+'\n',fixture);
 assert.equal(JSON.parse(fixture).cageEdit.layoutVersion,'NATIVE_DECKS_V1');
 assert.deepEqual(JSON.parse(fixture).cageEdit.placements,original.cageEdit.placements);
});

test('HTML writer handles active-save quota, silent writes, failed backup verification and concurrent progress',async()=>{
 for(const opts of [{activeQuota:true},{silentWrite:true},{backupSilent:true},{race:true}]){
  const p=await page(opts);await p.nodes['#expand'].onclick();
  assert.equal(p.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),opts.race?'newer progress':previous);
  assert.equal(p.nodes['#status'].dataset.state,'error');assert.equal(p.nodes['#expand'].disabled,false);
  if(opts.backupSilent)assert.equal(p.downloads(),0);
  if(opts.race)assert.equal(p.writes.includes(CHAMPIONSHIP_MODERN_SAVE_KEY),false);
 }
});
test('HTML validates before backup; translates stable helper codes; missing/malformed saves are untouched',async()=>{
 for(const value of [null,'not JSON',JSON.stringify({...original,cageEdit:{placements:[]}})]){
  const p=await page({value});await p.nodes['#expand'].onclick();
  assert.equal(p.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),value);assert.deepEqual(p.writes,[]);
  assert.equal(p.downloads(),0);assert.equal(p.nodes['#status'].dataset.state,'error');
  if(value?.includes('"placements":[]'))assert.match(p.nodes['#status'].textContent,/不是目前的原生牧場格式/);
 }
});
test('HTML fallback without Web Locks retains validation and optimistic concurrency check',async()=>{
 const p=await page({noLocks:true});await p.nodes['#expand'].onclick();assert.equal(p.nodes['#status'].dataset.state,'ready');
 const raced=await page({noLocks:true,race:true});await raced.nodes['#expand'].onclick();assert.equal(raced.nodes['#status'].dataset.state,'error');assert.equal(raced.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),'newer progress');
});


test('cold HTML keeps all write buttons disabled until module handlers are ready',()=>{
 for(const id of ['expand','install','download'])assert.match(html,new RegExp(`<button[^>]*id="${id}"[^>]*\\bdisabled\\b`));
});
test('expansion works while full QA fetch is pending or failed without resetting progress',async()=>{
 for(const opts of [{fixturePending:true},{fixtureFailure:true}]){
  const p=await page(opts);
  assert.equal(p.nodes['#expand'].disabled,false);assert.equal(typeof p.nodes['#expand'].onclick,'function');
  assert.equal(p.nodes['#install'].disabled,true);assert.equal(p.nodes['#download'].disabled,true);
  await p.nodes['#expand'].onclick();
  const upgraded=JSON.parse(p.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(upgraded.cageEdit.expansion.decks,2);upgraded.cageEdit=original.cageEdit;assert.deepEqual(upgraded,original);
  assert.equal(p.data.get(`${CHAMPIONSHIP_MODERN_SAVE_KEY}:qa-expansion-backup`),previous);
  assert.match(p.nodes['#status'].textContent,/主牧場仍依原階級解鎖，金錢與關卡不變/);
  const success=p.nodes['#status'].textContent;
  assert.equal(p.context.location.href,'');assert.equal(p.nodes['#install'].disabled,true);
  if(opts.fixturePending){p.rejectFixture();await p.initialized;}
  assert.equal(p.nodes['#install'].disabled,true);assert.equal(p.nodes['#download'].disabled,true);
  assert.equal(p.nodes['#status'].textContent,success);
 }
});
test('late fixture readiness does not erase expansion result or enable installer during expansion',async()=>{
 const p=await page({fixturePending:true,holdLock:true});
 const expanding=p.nodes['#expand'].onclick();
 p.resolveFixture();await p.initialized;
 assert.equal(p.nodes['#expand'].disabled,true);assert.equal(p.nodes['#install'].disabled,true);assert.equal(p.nodes['#download'].disabled,true);
 p.releaseLock();await expanding;
 assert.equal(p.nodes['#install'].disabled,false);assert.equal(p.nodes['#download'].disabled,false);
 assert.match(p.nodes['#status'].textContent,/主牧場仍依原階級解鎖/);
 const q=await page({fixturePending:true});await q.nodes['#expand'].onclick();
 const success=q.nodes['#status'].textContent;q.resolveFixture();await q.initialized;
 assert.equal(q.nodes['#status'].textContent,success);assert.equal(q.nodes['#install'].disabled,false);
});
