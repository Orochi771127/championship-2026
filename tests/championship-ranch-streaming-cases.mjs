import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as PIXI from '../node_modules/pixi.js/dist/pixi.mjs';
import {loadPixiCharacterRuntimeBundle,createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {completedCharacterBundleLocation,loadCompletedOriginalCharacters} from '../src/championship/presentation/completedOriginalCharacters.js';
import {LICENSED_CHARACTER_ASSET_ID,LICENSED_CHARACTER_MANIFEST} from '../src/championship/presentation/licensedCharacterRoster.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const focus=new Set(['e000_digitama','m503_warglaymon','m509_shinegraymon','m518_blackwargreymon','m529_metalgarurumon_va','m541_dukemon']);
const packed={characters:read('src/data/championship/ranch-streaming-selection.r1.json').characters.filter(c=>focus.has(c.entityId))};
const selection=read('src/data/championship/accepted-original-character-selection.r1.json');
const base='https://orochi771127.github.io/championship-2026/';
const manifestUrl=base+'assets/production/internal-faithful-baseline/characters-v1/manifest.json';
// The registration needed by this loader, not a copied production/private index.
const publicIndex={entries:[{assetId:LICENSED_CHARACTER_ASSET_ID,manifestPath:LICENSED_CHARACTER_MANIFEST,runtimeEligible:true,publicReleasePermitted:false}]};
const fromUrl=url=>new URL(url).pathname.slice('/championship-2026/'.length);
function fixtures({failImage=null,delayImage=null}={}){
 const cache=new Map(),calls=[],sources=[],unloaded=[];let failed=false,active=0,peak=0;
 const assets={async load(value){const url=typeof value==='string'?value:value.src;calls.push(url);if(cache.has(url))return cache.get(url);const name=fromUrl(url);
  if(name.endsWith('.json')){const d=read(name);cache.set(url,d);return d;}
  active++;peak=Math.max(peak,active);
  try{
   if(delayImage)await delayImage(name);
   if(failImage?.(name)&&!failed){failed=true;throw Error('TEST_PAGE_DOWNLOAD_FAILED');}
   const row=packed.characters.flatMap(c=>read(c.runtimePath).streaming.pages).find(p=>p.image===name.split('/').at(-1));
   const size=row?{w:row.width,h:row.height}:read(name.replace(/\.(webp|png)$/,'.json')).meta.size;
   const source=new PIXI.TextureSource({width:size.w,height:size.h});sources.push(source);const texture=new PIXI.Texture({source});cache.set(url,texture);return texture;
  }finally{active--;}
 },async unload(url){const value=cache.get(url);if(value instanceof PIXI.Texture)value.destroy(true);cache.delete(url);unloaded.push(url);}};
 return {PIXI:createPixiAssetScope({...PIXI,Assets:assets},base),fetchImpl:async url=>({ok:true,text:async()=>fs.readFileSync(fromUrl(url),'utf8')}),calls,sources,unloaded,cache,get peak(){return peak;}};
}
function frame(seq,i=0){return {contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:seq.id,frameIndex:i,flipBits:0};}

test('initial load prepares only required pages, every native sequence later resolves exact frame geometry, and resources release',async()=>{
 const f=fixtures();let checks=0;
 for(const c of packed.characters){
  const rt=read(c.runtimePath),url=base+c.runtimePath;
  const bundle=await loadPixiCharacterRuntimeBundle({PIXI:f.PIXI,fetchImpl:f.fetchImpl,runtimeUrl:url,runtimeDocument:rt,sides:['main'],initialSequenceIds:[0]});
  const initial=bundle.getDiagnostics().streaming;
  assert.ok(initial.readyPages<initial.totalPages);assert.equal(initial.pendingPages,0);
  const actor=bundle.createActor({animation:0,side:'main',nativeFramePresentation:true,nativeGeometry:rt.reviewGeometry});
  assert.ok(actor.nativeFramePresenter.isFrameReady(frame(rt.sides.main.animations[0])));
  const before=f.calls.length;
  for(const seq of rt.sides.main.animations){
   await Promise.all([actor.nativeFramePresenter.ensureFrame(frame(seq)),actor.nativeFramePresenter.ensureFrame(frame(seq))]);
   for(let i=0;i<seq.frames.length;i++){
    const applied=actor.nativeFramePresenter.apply(frame(seq,i));assert.equal(applied.cell,seq.frames[i].cell);
    assert.deepEqual(applied.geometry,rt.reviewGeometry.frames[seq.frames[i].texture]);checks++;
   }
  }
  assert.ok(f.calls.length>before);assert.equal(bundle.getDiagnostics().streaming.readyPages,rt.sides.main.atlases.length);
  assert.equal(f.calls.filter(u=>u.includes('/ranch-streaming-v1/')&&/\.webp$/.test(u)).length,new Set(f.calls.filter(u=>u.includes('/ranch-streaming-v1/')&&/\.webp$/.test(u))).size);
  actor.sprite.destroy();await bundle.dispose();assert.equal(bundle.getDiagnostics().textureMemory.sourceCount,0);
 }
 assert.ok(checks>300);assert.ok(f.sources.every(s=>s.destroyed));assert.equal(f.cache.size,0);assert.ok(f.peak<=2);
 assert.ok(!f.calls.some(u=>/accepted-20261010\/[^/]+\/main\.(webp|png)$/.test(u)));
});

test('failed deferred page remains unavailable, retries successfully, and never replaces the last verified frame',async()=>{
 const c=packed.characters.find(c=>c.entityId==='m518_blackwargreymon'),rt=read(c.runtimePath);
 const bootPages=new Set(rt.sides.main.animations.find(a=>a.id===0).frames.map(f=>rt.streaming.texturePages[f.texture]));
 const seq=rt.sides.main.animations.find(a=>a.frames.some(f=>!bootPages.has(rt.streaming.texturePages[f.texture])));
 const image=rt.streaming.pages[rt.streaming.texturePages[seq.frames[0].texture]].image;
 const f=fixtures({failImage:n=>n.endsWith(image)}),bundle=await loadPixiCharacterRuntimeBundle({PIXI:f.PIXI,fetchImpl:f.fetchImpl,runtimeUrl:base+c.runtimePath,runtimeDocument:rt,sides:['main'],initialSequenceIds:[0]});
 const a=bundle.createActor({animation:0,nativeFramePresentation:true}),old=a.sprite.texture;
 await assert.rejects(a.nativeFramePresenter.ensureFrame(frame(seq)),/TEST_PAGE_DOWNLOAD_FAILED/);
 assert.equal(a.nativeFramePresenter.isFrameReady(frame(seq)),false);assert.equal(a.sprite.texture,old);
 await a.nativeFramePresenter.ensureFrame(frame(seq));assert.equal(a.nativeFramePresenter.isFrameReady(frame(seq)),true);
 a.nativeFramePresenter.apply(frame(seq));assert.notEqual(a.sprite.texture,old);a.sprite.destroy();await bundle.dispose();assert.ok(f.sources.every(s=>s.destroyed));
});

test('dispose waits for a late page, prevents activation, and releases its decoded source',async()=>{
 const c=packed.characters.find(c=>c.entityId==='m503_warglaymon'),rt=read(c.runtimePath);let unblock;let block=false;
 const f=fixtures({delayImage:async()=>{if(block)await new Promise(resolve=>{unblock=resolve;});}});
 const bundle=await loadPixiCharacterRuntimeBundle({PIXI:f.PIXI,fetchImpl:f.fetchImpl,runtimeUrl:base+c.runtimePath,runtimeDocument:rt,sides:['main'],initialSequenceIds:[0]});
 const a=bundle.createActor({animation:0,nativeFramePresentation:true});block=true;
 const seq=rt.sides.main.animations.find(s=>!a.nativeFramePresenter.isFrameReady(frame(s)));
 const pending=a.nativeFramePresenter.ensureFrame(frame(seq));while(!unblock)await new Promise(r=>setTimeout(r,0));
 const disposed=bundle.dispose();unblock();await assert.rejects(pending,/DISPOSED/);await disposed;
 assert.throws(()=>bundle.createActor({animation:0}),/DISPOSED/);assert.ok(f.sources.every(s=>s.destroyed));a.sprite.destroy();
});

test('streamed selection preserves ordinary Battle/Hunt choices and verifies runtime hash before loading pixels',async t=>{
 const c=packed.characters.find(c=>c.entityId==='m541_dukemon'),config=selection.characters.find(x=>x.entityId===c.entityId);
 assert.equal(completedCharacterBundleLocation(config,{sides:['main']},base).streamed,undefined);
 assert.equal(completedCharacterBundleLocation(config,{ranchStreaming:true,sides:['main']},base).streamed.entityId,c.entityId);
 assert.equal(completedCharacterBundleLocation(config,{ranchStreaming:true,sides:['main','sub']},base).streamed,undefined);
 assert.equal(completedCharacterBundleLocation({...config,assetRoot:'assets/production/characters/alternate-forms-20261015/',folder:'another-approved-form'},
  {ranchStreaming:true,sides:['main']},base).streamed,undefined);
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async url=>{const name=fromUrl(url);return {ok:true,json:async()=>read(name),text:async()=>name===c.runtimePath?'{}':fs.readFileSync(name,'utf8')};};
 const f=fixtures(),roster=await loadCompletedOriginalCharacters({PIXI:f.PIXI,speciesIds:[config.speciesId],sides:['main'],ranchStreaming:true,initialSequences:{[config.speciesId]:[0]},productionIndex:publicIndex,manifestUrl,manifest:read(fromUrl(manifestUrl))},base);
 assert.ok(roster.getDiagnostics().failures.some(e=>e.reason==='RANCH_STREAMING_RUNTIME_HASH'));
 assert.equal(f.calls.filter(u=>/\.(webp|png)$/.test(u)).length,0);assert.equal(roster.createActor({speciesId:config.speciesId,presentation:'raising'}),null);await roster.dispose();
});

test('normal completed-original roster validates all six streamed bundles and forwards the requested native sequence',async t=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});
 globalThis.fetch=async url=>{const name=fromUrl(url);return {ok:true,json:async()=>read(name),text:async()=>fs.readFileSync(name,'utf8')};};
 const f=fixtures(),configs=packed.characters.map(c=>selection.characters.find(x=>x.entityId===c.entityId));
 const roster=await loadCompletedOriginalCharacters({PIXI:f.PIXI,speciesIds:configs.map(c=>c.speciesId),sides:['main'],ranchStreaming:true,
  initialSequences:Object.fromEntries(configs.map(c=>[c.speciesId,[0,1]])),productionIndex:publicIndex,manifestUrl,manifest:read(fromUrl(manifestUrl))},base);
 assert.deepEqual(roster.getDiagnostics().failures,[]);assert.equal(roster.getDiagnostics().completedOriginalArt.loaded.length,6);
 for(const c of configs){const a=roster.createActor({speciesId:c.speciesId,presentation:'raising'});assert.ok(a.nativeFramePresenter.isFrameReady({sequenceId:1}));assert.ok(a.nativeSizing);a.sprite.destroy();}
 assert.ok(f.calls.filter(u=>/\.webp$/.test(u)).length<15);await roster.dispose();assert.ok(f.sources.every(s=>s.destroyed));
});
