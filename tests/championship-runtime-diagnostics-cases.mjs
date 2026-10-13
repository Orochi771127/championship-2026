import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeRecoveryDiagnostics,DIAGNOSTIC_LIMIT,observeBattleFirstRender} from '../src/championship/app/runtimeRecoveryDiagnostics.js';
import {CHAMPIONSHIP_DIAGNOSTICS_KEY,createChampionshipDiagnosticPort} from '../src/championship/app/ChampionshipPersistentSavePort.js';
import {downloadRuntimeDiagnostics} from '../src/championship/app/downloadSaveBackup.js';
import {setLocale} from '../src/championship/text/locale.js';
import {uiText} from '../src/championship/text/uiText.js';

function fixture(document='00000001',data=new Map()) {
  const keys=[];
  const storage={getItem:k=>{keys.push(k);return data.get(k)??null;},setItem:(k,v)=>{keys.push(k);data.set(k,v);}};
  const win=new EventTarget(),doc=new EventTarget();doc.baseURI='https://example.test/game/';doc.visibilityState='visible';
  win.performance={getEntriesByType:()=>[{type:'reload'}]};let ms=0,screen='TITLE';
  const journal=createRuntimeRecoveryDiagnostics({storage,win,doc,documentId:()=>document,now:()=>ms,
    getScreen:()=>screen,getRenderer:()=> 'PIXI',build:'main-TEST1234.js'});
  return {journal,data,keys,win,doc,setScreen:s=>{screen=s;},advance:()=>{ms+=100;},events:()=>JSON.parse(journal.exportText()).events};
}
const send=(target,type,fields={})=>{const event=Object.assign(new Event(type,{cancelable:true}),fields);target.dispatchEvent(event);return event;};
function rendererFixture(){return {view:{renderTarget:{}},calls:[],render(...args){this.calls.push(args);return args[0];}};}

test('first screen render is recorded once and preserves renderer this, arguments, return and later calls',()=>{
  const renderer=rendererFixture(),records=[],screen={target:renderer.view.renderTarget},offscreen={target:{}};
  const original=renderer.render;
  const stop=observeBattleFirstRender({renderer,record:(type,row)=>records.push({type,...row})});
  assert.equal(renderer.calls.length,0,'installing the observer cannot render');
  assert.equal(renderer.render(offscreen),offscreen);assert.equal(records.length,0);
  assert.equal(renderer.render(screen,'unchanged argument'),screen);assert.deepEqual(records.map(e=>e.phase),['start','done']);
  assert.deepEqual(renderer.calls[1],[screen,'unchanged argument']);assert.equal(renderer.render,original);
  for(let i=0;i<30;i++)renderer.render(screen);
  assert.equal(records.length,2);assert.equal(renderer.calls.length,32);assert.ok(records.every(e=>e.area==='battle'&&e.stage==='first-render'&&e.renderer==='PIXI'));
  stop();stop();
});

test('leaving before render removes the observer; renderer failures remain failures without fake completion',()=>{
  const renderer=rendererFixture(),records=[],original=renderer.render;
  const stop=observeBattleFirstRender({renderer,record:(type,row)=>records.push(row)});stop();renderer.render({});
  assert.equal(renderer.render,original);assert.equal(records.length,0);
  const failure=Error('controlled renderer failure'),failed={render(){throw failure;}};
  const failedOriginal=failed.render;observeBattleFirstRender({renderer:failed,record:(type,row)=>records.push(row)});
  assert.throws(()=>failed.render({}),e=>e===failure);assert.equal(failed.render,failedOriginal);
  assert.deepEqual(records.map(e=>e.phase),['start']);
  assert.doesNotThrow(()=>observeBattleFirstRender({renderer:{}})());
});

test('technical history survives another document and keeps navigation separate from title return and context loss',()=>{
  const a=fixture();a.setScreen('BATTLE_FIELD');a.journal.record('LOAD',{area:'battle',stage:'overlay',phase:'start'});
  a.journal.dispose(); // An absent pagehide is evidence of no observed event, not an OOM diagnosis.
  const b=fixture('00000002',a.data);
  assert.equal(b.events().filter(e=>e.type==='BOOT').length,2);
  assert.equal(b.events().some(e=>e.type==='PAGE_HIDE'),false);
  assert.equal(b.events().findLast(e=>e.type==='BOOT').navigation,'reload');
  b.setScreen('RAISING_HOME');b.journal.record('TITLE_RETURN',{source:'save-and-quit'});
  b.journal.record('DOCUMENT_RELOAD',{source:'raising-load-reload'});
  assert.equal(send(b.win,'webglcontextlost').defaultPrevented,false,'diagnostics cannot change restoration behaviour');
  send(b.win,'webglcontextrestored');send(b.win,'pagehide',{persisted:true});send(b.win,'pageshow',{persisted:true});
  const events=b.events();assert.ok(events.some(e=>e.type==='CONTEXT_LOST'&&e.renderer==='PIXI'));
  assert.ok(events.some(e=>e.type==='CONTEXT_RESTORED'));
  assert.ok(events.some(e=>e.type==='PAGE_SHOW'&&e.persisted));
  assert.equal(events.filter(e=>e.type==='TITLE_RETURN').length,1);b.journal.dispose();
});

test('only the diagnostic key is accessed; names, save fields, raw errors and URL parameters never enter the log',()=>{
  const data=new Map([['championshipModernSave:v1','PRIVATE_PLAYER_SAVE'],['championshipModernSave:preferences:v1','PRIVATE_PREFS']]);
  const h=fixture('00000001',data),error=new Error('PRIVATE_PLAYER_NAME NATIVE_CHARACTER_TEXTURE_MISSING:PRIVATE_ID');
  error.stack='PRIVATE_PLAYER_NAME\n at src/championship/presentation/nativeHuntCharacterAction.js:48:27?name=PRIVATE_QUERY';
  h.journal.record('ERROR',{error,playerName:'PRIVATE_PLAYER_NAME',save:'PRIVATE_PLAYER_SAVE',nickname:'PRIVATE_NICKNAME'});
  h.journal.record('ASSET_FAILED',{url:'https://PRIVATE_HOST/game/assets/production/test/main.png?name=PRIVATE_QUERY#PRIVATE_FRAGMENT'});
  const text=h.journal.exportText();assert.doesNotMatch(text,/PRIVATE_/);
  assert.ok(h.events().some(e=>e.code==='NATIVE_CHARACTER_TEXTURE_MISSING'));
  assert.equal(h.events().find(e=>e.module)?.module,'src/championship/presentation/nativeHuntCharacterAction.js:48:27');
  assert.equal(h.events().find(e=>e.asset)?.asset,'assets/production/test/main.png');
  assert.ok(h.keys.every(k=>k===CHAMPIONSHIP_DIAGNOSTICS_KEY));
  assert.equal(data.get('championshipModernSave:v1'),'PRIVATE_PLAYER_SAVE');h.journal.dispose();
});

test('entry and UTF-8 byte limits apply to storage and export, with repeated ticker errors deduplicated',()=>{
  const h=fixture();const error=new Error('NATIVE_CHARACTER_TEXTURE_MISSING');
  for(let i=0;i<200;i++){h.advance();h.journal.record('ERROR',{error});}
  assert.equal(h.events().length,2);
  for(let i=0;i<200;i++){h.advance();h.journal.record('ASSET_FAILED',{url:'https://example.test/assets/production/test/'+('a'.repeat(100))+i+'.png'});}
  assert.ok(h.events().length<=DIAGNOSTIC_LIMIT.entries);
  assert.ok(Buffer.byteLength(h.journal.exportText())<=DIAGNOSTIC_LIMIT.bytes);
  assert.ok(Buffer.byteLength(h.data.get(CHAMPIONSHIP_DIAGNOSTICS_KEY))<=DIAGNOSTIC_LIMIT.bytes);
  assert.throws(()=>createChampionshipDiagnosticPort({setItem(){}}).write('a'.repeat(8193)),/BYTE_LIMIT/);h.journal.dispose();
});

test('routine loading cannot evict document boundaries or the battle ready-to-render window',()=>{
  const a=fixture();a.setScreen('BATTLE_FIELD');
  for(const [stage,phase]of [['ready',undefined],['loading-card','done'],['audio','start'],['first-render','start'],['first-render','done']])a.journal.record('LOAD',{area:'battle',stage,phase});
  for(let i=0;i<60;i++){a.advance();a.journal.record('LOAD',{area:'raising',stage:i%2?'engine':'partners',phase:'done'});}
  const b=fixture('00000002',a.data);send(b.win,'pageshow',{persisted:false});
  const events=b.events();assert.equal(events.filter(e=>e.type==='BOOT').length,2);
  assert.deepEqual(events.filter(e=>e.type==='LOAD'&&e.area==='battle').map(e=>[e.stage,e.phase]),
    [['ready',undefined],['loading-card','done'],['audio','start'],['first-render','start'],['first-render','done']]);
  assert.ok(events.length<=32);assert.ok(Buffer.byteLength(b.journal.exportText())<=8192);a.journal.dispose();b.journal.dispose();
});

test('blocked or corrupt diagnostic storage never blocks recording or touches game data',()=>{
  const blocked=createRuntimeRecoveryDiagnostics({storage:()=>{throw Error('blocked');},documentId:()=> '00000001',win:null,doc:null,now:()=>0});
  blocked.record('LOAD_FAILED',{area:'raising',error:new Error('LOAD_TIMEOUT')});
  const exported=JSON.parse(blocked.exportText());assert.equal(exported.persistent,false);assert.equal(exported.events.length,2);
  const data=new Map([[CHAMPIONSHIP_DIAGNOSTICS_KEY,'{"player":"PRIVATE_NAME"}']]);const h=fixture('00000002',data);
  assert.doesNotMatch(h.journal.exportText(),/PRIVATE_NAME/);assert.equal(h.events().length,1);h.journal.dispose();blocked.dispose();
});

test('readable storage with failed writes retains every new event in memory',()=>{
  const old=fixture();old.journal.dispose();
  const journal=createRuntimeRecoveryDiagnostics({storage:{getItem:k=>old.data.get(k),setItem(){throw new Error('quota');}},
    documentId:()=> '00000002',win:null,doc:null,now:()=>0});
  journal.record('LOAD_FAILED',{area:'raising',error:new Error('LOAD_TIMEOUT')});
  journal.record('DOCUMENT_RELOAD',{source:'raising-load-reload'});
  const exported=JSON.parse(journal.exportText());assert.equal(exported.persistent,false);
  assert.deepEqual(exported.events.map(e=>e.type),['BOOT','BOOT','LOAD_FAILED','DOCUMENT_RELOAD']);journal.dispose();
});

test('download is an explicit JSON file with cleanup, and diagnostic UI keys work in five locales',()=>{
  const clicked=[],revoked=[],deferred=[];let value;
  class BlobMock{constructor(parts){value=parts.join('');}}
  const doc={body:{append(){}},createElement:()=>({click(){clicked.push(this.download);},remove(){}})};
  const h=fixture();const result=downloadRuntimeDiagnostics(()=>h.journal.exportText(),{doc,BlobClass:BlobMock,
    urls:{createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)},defer:fn=>deferred.push(fn)});
  assert.equal(result.ok,true);assert.deepEqual(clicked,['championship-runtime-diagnostics.json']);
  assert.equal(JSON.parse(value).kind,'CHAMPIONSHIP_RUNTIME_DIAGNOSTICS');deferred[0]();assert.deepEqual(revoked,['blob:test']);
  try{for(const locale of ['zh-Hant','en','ja','th','vi']){setLocale(locale);for(const key of ['DIAGNOSTIC_DOWNLOAD','DIAGNOSTIC_HINT','DIAGNOSTIC_READY','DIAGNOSTIC_FAILED'])assert.notEqual(uiText(key),key);}}
  finally{setLocale('zh-Hant');h.journal.dispose();}
});
