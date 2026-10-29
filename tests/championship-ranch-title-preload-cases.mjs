import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createRanchTitlePreloader} from '../src/championship/app/ranchTitlePreload.js';
import {createAssetPrefetcher} from '../src/championship/app/assetPrefetch.js';
const base='https://example.test/game/';
const save={creature:{creatureId:'starter',speciesId:'species-000'},raising:{assignments:{starter:'a',one:'a',two:'b'},collection:[{instanceId:'one',speciesId:'species-001'},{instanceId:'two',speciesId:'species-002'},{instanceId:'stored',speciesId:'species-003'}]}};
function fixture({fail=false,block=false,badHash=false}={}){
 const documents=new Map(),calls=[],progress=[];let active=0,peak=0,release;
 const characters=Array.from({length:222},(_,i)=>{
  const path=`entity${i}/runtime.review.json`;
  const runtime={sides:{main:{animations:[{id:0,frames:[{texture:'idle'}]}]}}};
  const pages=[0,1,2].map(n=>({image:'main-'+String(i*3+n).padStart(16,'0')+'.webp',bytes:100}));
  runtime.streaming={sourceRuntimeSha256:'exact-source',texturePages:{idle:0},pages};
  const text=JSON.stringify(runtime);documents.set(new URL(path,base).href,text);
  return {speciesId:'species-'+String(i).padStart(3,'0'),runtimePath:path,sourceRuntimeSha256:'exact-source',runtimeSha256:badHash?'invalid':createHash('sha256').update(text).digest('hex')};
 });
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('.json'))return new Response(documents.get(url));active++;peak=Math.max(peak,active);
  try{if(block)await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});if(fail){fail=false;return new Response('failed',{status:503});}return new Response(new Uint8Array(100),{headers:{'content-length':'100','content-type':'image/webp'}});}finally{active--;}};
 return {characters,fetchImpl,createPrefetcher:createAssetPrefetcher,calls,progress,get peak(){return peak;},unblock(){release?.();}};
}
test('title downloads only assigned residents idle then one next page, sequentially, with actual progress and reusable bytes',async()=>{
 const f=fixture(),loader=createRanchTitlePreloader({...f,baseUrl:base,onProgress:p=>f.progress.push(p)});await loader.start(save);
 const images=f.calls.filter(c=>c.url.endsWith('.webp'));assert.equal(images.length,6);assert.equal(f.peak,1);assert.ok(images.every(c=>c.options.priority==='low'));assert.deepEqual(images.slice(0,3).map(c=>c.url.split('/').at(-2)),['entity0','entity1','entity2']);
 assert.equal(loader.blobOf(images[0].url).size,100);assert.equal(f.progress.at(-1).complete,true);assert.equal(f.progress.at(-1).loaded,600);assert.equal(f.calls.filter(c=>c.url.endsWith('.json')).length,3);loader.stop();assert.equal(loader.blobOf(images[0].url).size,100);
});
test('resident and byte budgets bound prefetch; invalid runtime hashes never fetch images',async()=>{
 const f=fixture(),l=createRanchTitlePreloader({...f,baseUrl:base,maxResidents:2,maxImageBytes:250});await l.start(save);assert.equal(f.calls.filter(c=>c.url.endsWith('.webp')).length,2);
 const bad=fixture({badHash:true});await createRanchTitlePreloader({...bad,baseUrl:base}).start(save);assert.equal(bad.calls.filter(c=>c.url.endsWith('.webp')).length,0);
});
test('stop aborts active transfer and drops queued downloads; failed speculation leaves normal foreground fallback available',async()=>{
 const f=fixture({block:true}),l=createRanchTitlePreloader({...f,baseUrl:base});const pending=l.start(save);while(!f.calls.some(c=>c.url.endsWith('.webp')))await new Promise(r=>setTimeout(r,0));l.stop();await pending;assert.equal(f.calls.filter(c=>c.url.endsWith('.webp')).length,1);assert.equal(l.blobOf(f.calls.at(-1).url),null);
 const failure=fixture({fail:true}),other=createRanchTitlePreloader({...failure,baseUrl:base});await other.start(save);const first=failure.calls.find(c=>c.url.endsWith('.webp'));assert.equal(other.blobOf(first.url),null);assert.equal(other.blobOf(failure.calls.at(-1).url).size,100);
});
test('species drawn with reviewed artwork are not prefetched: their original atlas pages are retired',async()=>{
 const f=fixture(),l=createRanchTitlePreloader({...f,baseUrl:base,reviewedSpecies:new Set(['species-001'])});await l.start(save);
 const runtimes=f.calls.filter(c=>c.url.endsWith('.json')).map(c=>c.url);
 assert.ok(!runtimes.some(u=>u.includes('entity1/')));assert.ok(runtimes.some(u=>u.includes('entity0/')));
 assert.ok(f.calls.filter(c=>c.url.endsWith('.webp')).length>0);
});
