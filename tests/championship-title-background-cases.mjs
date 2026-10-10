import test from 'node:test';
import assert from 'node:assert/strict';
import {createTitleImageLifecycle} from '../src/championship/presentation/titleImageLifecycle.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 const calls=[],created=[],revoked=[],decodes=[],panel={style:{backgroundImage:''},dataset:{backgroundSrc:'assets/production/title-morning-r1/arena.webp'}};
 const title={hidden:false,ownerDocument:{baseURI:'https://example.test/game/'},querySelectorAll:()=>[],querySelector:()=>panel};
 const sync=createTitleImageLifecycle(title,{fetchImpl:(url,options)=>{const d=deferred();calls.push({url,options,...d});return d.promise;},
  urls:{createObjectURL:blob=>{const url='blob:qa-'+created.length;created.push({url,blob});return url;},revokeObjectURL:url=>revoked.push(url)},
  createImage:()=>{const d=deferred(),image={src:'',decode:()=>d.promise,removeAttribute(){this.src='';}};decodes.push({image,...d});return image;}});
 return {calls,created,revoked,decodes,panel,title,sync};
}
test('title exclusively owns one background request and aborts it when paused',async()=>{
 const h=harness();h.sync(false);h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'https://example.test/game/assets/production/title-morning-r1/arena.webp');
 h.sync(true);assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.panel.style.backgroundImage,'none');h.sync(true);assert.equal(h.calls.length,1);
 h.sync(false);h.sync(false);assert.equal(h.calls.length,2);h.sync.dispose();assert.equal(h.calls[1].options.signal.aborted,true);
});


test('late body completion cannot replace a returned title generation',async()=>{
 const h=harness(),oldBody=deferred(),freshBlob={bytes:'same-original'};h.sync(false);
 h.calls[0].resolve({ok:true,blob:()=>oldBody.promise});await flush();h.sync(true);h.sync(false);
 oldBody.resolve({bytes:'stale'});await flush();assert.equal(h.created.length,0);
 h.calls[1].resolve({ok:true,blob:async()=>freshBlob});await flush();h.decodes[0].resolve();await flush();
 assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.created[0].blob,freshBlob);assert.match(h.panel.style.backgroundImage,/blob:qa-0/);h.sync.dispose();
});

test('decode finishing after pause is ignored and its URL is revoked exactly once',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();
 assert.equal(h.created.length,1);h.sync(true);assert.deepEqual(h.revoked,['blob:qa-0']);
 h.decodes[0].resolve();await flush();assert.equal(h.panel.style.backgroundImage,'none');assert.equal(h.sync.inspect().hasCachedBlob,false);
 h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);
});

test('a completed original Blob returns without another HTTP request and dispose releases it',async()=>{
 const h=harness(),blob={original:true};h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>blob});await flush();h.decodes[0].resolve();await flush();
 assert.equal(h.sync.inspect().hasCachedBlob,true);h.title.hidden=true;h.sync(true);assert.deepEqual(h.revoked,['blob:qa-0']);h.title.hidden=false;h.sync(false);h.sync(false);
 assert.equal(h.calls.length,1);assert.equal(h.created[1].blob,blob);h.decodes[1].resolve();await flush();assert.match(h.panel.style.backgroundImage,/blob:qa-1/);
 h.sync.dispose();h.sync.dispose();h.sync(false);assert.deepEqual(h.revoked,['blob:qa-0','blob:qa-1']);assert.equal(h.sync.inspect().hasCachedBlob,false);assert.equal(h.sync.inspect().disposed,true);assert.equal(h.calls.length,1);
});

test('a failed response keeps the base colour and cannot become a status-driven retry loop',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:false});await flush();assert.equal(h.panel.dataset.titleBackgroundState,'error');
 for(let i=0;i<10;i++)h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.created.length,0);
 h.sync(true);h.sync(false);assert.equal(h.calls.length,2);h.sync.dispose();h.calls[1].resolve({ok:true,blob:async()=>({})});await flush();assert.equal(h.created.length,0);
});

test('a decode failure revokes its object URL and does not cache corrupt image bytes',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].reject(Error('decode'));await flush();
 assert.equal(h.panel.dataset.titleBackgroundState,'error');assert.equal(h.sync.inspect().hasCachedBlob,false);assert.deepEqual(h.revoked,['blob:qa-0']);h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);
});


test('music buffering retains already decoded title art but hiding it still revokes while paused',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].resolve();await flush();
 const ready=h.panel.style.backgroundImage;h.sync(true);h.sync(true);assert.equal(h.panel.style.backgroundImage,ready);assert.deepEqual(h.revoked,[]);
 h.title.hidden=true;h.sync(true);assert.equal(h.panel.style.backgroundImage,'none');assert.deepEqual(h.revoked,['blob:qa-0']);
 h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.created.length,1,'hidden title cannot restart from a stale resume callback');h.sync.dispose();
});


test('return during music buffering restores the cached original without starting network work',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].resolve();await flush();
 h.title.hidden=true;h.sync(true);h.title.hidden=false;h.sync(true);assert.equal(h.calls.length,1);assert.equal(h.created.length,2);
 h.decodes[1].resolve();await flush();assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.sync.inspect().paused,true);
 h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0','blob:qa-1']);
});
