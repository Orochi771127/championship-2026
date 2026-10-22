import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createResidentAssetNotice,collectRaisingInitialSequences} from '../src/championship/app/residentAssetNotice.js';
import {mountRanchDiscoveryJournal} from '../src/championship/app/ranchDiscoveryJournal.js';
const buffering={state:'loading',loadKind:'animation',hasVisibleSprite:true};
function fixture(){let now=0,id=0,changes=0;const timers=new Map();const gate=createResidentAssetNotice({onChange:()=>changes++,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},clearTimer:i=>timers.delete(i)});return {gate,timers,get changes(){return changes},tick(ms){now+=ms;for(const [i,t] of timers)if(t.at<=now){timers.delete(i);t.fn()}}};}
test('normal first-use animation buffering never flashes shared recovery row when it completes quickly',()=>{
 const f=fixture();for(let i=0;i<20;i++){assert.equal(f.gate.update([buffering]),false);f.tick(100);assert.equal(f.gate.update([{state:'ready'}]),false);f.tick(1000);assert.equal(f.gate.visible,false);}assert.equal(f.changes,0);assert.equal(f.timers.size,0);
});
test('continuous slow buffering surfaces after bounded delay; repeated callbacks cannot postpone it',()=>{
 const f=fixture();f.gate.update([buffering]);for(let i=0;i<8;i++){f.tick(100);f.gate.update([buffering]);}assert.equal(f.gate.visible,false);f.tick(100);assert.equal(f.gate.visible,true);assert.equal(f.changes,1);f.gate.update([{state:'ready'}]);assert.equal(f.gate.visible,false);
});
test('missing first appearance, unknown state reason, evolution and real errors remain immediate',()=>{
 for(const state of [{state:'loading'}, {...buffering,hasVisibleSprite:false},{...buffering,loadKind:'evolution'},{state:'error',error:'404'}]){const f=fixture();assert.equal(f.gate.update([state]),true);assert.equal(f.timers.size,0);}
 const f=fixture();f.gate.update([buffering]);assert.equal(f.gate.update([{...buffering,state:'error'}]),true);assert.equal(f.timers.size,0);
});
test('retry/reset and disposal cancel delayed stale notices',()=>{
 for(const action of ['reset','dispose']){const f=fixture();f.gate.update([buffering]);f.gate[action]();f.tick(5000);assert.equal(f.changes,0);assert.equal(f.timers.size,0);}
});
test('same-species residents merge all current requests rather than last resident overwriting earlier ones',()=>{
 const residents=[{speciesId:'species-001',creatureId:'a'},{speciesId:'species-001',creatureId:'b'},{speciesId:'species-002',creatureId:'c'}];
 const result=collectRaisingInitialSequences(residents,id=>({sequenceId:{a:2,b:13,c:0}[id]}));assert.deepEqual(result,{'species-001':[0,2,13],'species-002':[0]});
 assert.deepEqual(collectRaisingInitialSequences([{speciesId:'new'}]),{new:[0]});
});
const scene=fs.readFileSync(new URL('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',import.meta.url),'utf8');
test('existing resident readiness dedupes repeated animation requests; actual rejection stays error until explicit retry',async()=>{
 const helper=scene.slice(scene.indexOf('  function residentFrameReady('),scene.indexOf('  // The canvas CSS rect'));
 let resolve,reject,requests=0,ready=false;const entry={root:{destroyed:false},assetState:'ready',sprite:{},nativeFramePresenter:{isFrameReady:()=>ready,ensureFrame:()=>{requests++;return new Promise((a,b)=>{resolve=a;reject=b})}}};
 const context={disposed:false,reportResidentAssets(){},onFallback(){},sync(){},source:{getFrame(){return {}}}};vm.runInNewContext(helper+';globalThis.check=residentFrameReady;',context);
 for(let i=0;i<20;i++)assert.equal(context.check(entry,{sequenceId:2}),false);assert.equal(requests,1);assert.equal(entry.assetState,'loading');
 reject(Error('HTTP_404'));await new Promise(r=>setImmediate(r));assert.equal(entry.assetState,'error');context.check(entry,{sequenceId:2});assert.equal(requests,1);
 context.check(entry,{sequenceId:2},{retry:true});assert.equal(requests,2);ready=true;resolve();await new Promise(r=>setImmediate(r));assert.equal(entry.assetState,'ready');assert.equal(context.check(entry,{sequenceId:2}),true);assert.equal(requests,2);
});
test('journal is absent until there is a pending discovery; hides after claim, preserves tutorial gate',()=>{
 const button={dataset:{},setAttribute(){},addEventListener(){},remove(){}};const root={ownerDocument:{createElement:()=>button},append(){}};const journal=mountRanchDiscoveryJournal(root,{});
 for(const exploration of [null,{pending:[]}]){journal.update({exploration});assert.equal(button.hidden,true);}
 journal.update({exploration:{pending:[{kind:'food'}]}});assert.equal(button.hidden,false);assert.match(button.textContent,/1\/12/);
 journal.update({exploration:{pending:[{}]},tutorial:{finished:false}});assert.equal(button.hidden,true);
 journal.update({exploration:{pending:[]}});assert.equal(button.hidden,true);journal.dispose();
});
test('integration preserves genuine readiness/errors and zoom interactions, removes percentage text only',()=>{
 const main=fs.readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(main,/residentNotice.update\(states\)/);assert.match(main,/residentNotice.dispose\(\)/);assert.match(main,/residentNotice.reset\(\)/);
 assert.match(main,/const residentPending = next === 'ready' && residentNotice.visible/);
 assert.match(main,/next === 'loading' \|\| loading/); // aria-busy remains honest
 assert.match(main,/scene.isPlayable !== false/); // actual simulation clock gate unchanged
 assert.match(scene,/if\(frame&&entry.nativeFramePresenter\?\.isFrameReady/);
 assert.match(scene,/hasVisibleSprite:Boolean\(e.sprite\)/);assert.match(scene,/loadKind:/);
 assert.match(scene,/zoomButton.textContent=zoom===1\?'−':'\+'/);assert.doesNotMatch(scene,/− 100%|\+ 70%/);
 assert.match(scene,/zoomButton.addEventListener\('click'/);assert.match(scene,/bindRaisingZoomInput/);
});
