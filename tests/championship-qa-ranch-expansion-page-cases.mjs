// Event-wiring tests with an isolated DOM/storage harness, not browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyQaRanchExpansion} from '../src/championship/app/qaRanchExpansion.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave,serializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
const fixture=fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url),'utf8');
const original=JSON.parse(fixture);original.cageEdit.layoutVersion='NATIVE_ANCHORS_V1';delete original.cageEdit.expansion;original.shop.bits=123456;
const previous=JSON.stringify(original);
const html=fs.readFileSync(new URL('../full-qa-save.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'');
async function page({locked=false,quota=false}={}){
 const nodes=Object.fromEntries(['install','download','expand','status'].map(id=>['#'+id,{disabled:false,dataset:{}}]));
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,previous]]);let downloads=0;
 const context={CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave,serializeChampionshipModernSave,applyQaRanchExpansion,
 document:{querySelector:s=>nodes[s],createElement:()=>({click(){downloads++;},remove(){}}),body:{append(){}}},
 fetch:async()=>({ok:true,text:async()=>fixture}),Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>{},Date,
 localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(quota)throw Error('QuotaExceededError');data.set(k,v);}},
 navigator:{locks:{request:async(key,options,callback)=>{assert.equal(key,CHAMPIONSHIP_MODERN_SAVE_KEY);assert.equal(options.ifAvailable,true);return callback(locked?null:{});}}},location:{href:''}};
 await vm.runInNewContext(`(async()=>{${script}\n})()`,context);
 return {nodes,data,context,downloads:()=>downloads};
}
test('QA page click backs up exact existing progress, preserves unrelated data, and remains on QA page',async()=>{
 const p=await page();await p.nodes['#expand'].onclick();
 assert.equal(p.downloads(),1);assert.equal(p.data.get(`${CHAMPIONSHIP_MODERN_SAVE_KEY}:qa-expansion-backup`),previous);
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
