// Ranch load diagnostics (docs/reports/ranch-load-2026-11-08/).
// A species the ranch requests after its roster exists -- an evolution target,
// a hatch, an awakening form -- used to receive no sequence list and so loaded
// every atlas page of its native runtime, one after another, before it could
// draw. A catalyst evolution into species-096 waited ~20-28 s on
// "正在載入夥伴外觀…". A streaming roster now streams those species too, while
// Hunt/Battle rosters (no initialSequences) keep their eager whole load.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as PIXI from '../node_modules/pixi.js/dist/pixi.mjs';
import catalog from '../src/data/championship/public-character-catalog.v1.json' with {type:'json'};
import {loadPublicCharacterRoster} from '../src/championship/presentation/publicCharacterRoster.js';
import {createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';

const base='https://orochi771127.github.io/championship-2026/';
const file=url=>new URL(url).pathname.slice('/championship-2026/'.length),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// Same loader seams as championship-public-character-roster-cases.mjs: bytes from
// this checkout, TextureSources sized from the atlas metadata the loader verified.
function fixture({beforeImage=null}={}){
  const calls=[],cache=new Map(),sources=[],imageSizes=new Map();
  const remember=(url,data)=>{if(data.meta?.image&&data.meta?.size)imageSizes.set(new URL(data.meta.image,url).href,data.meta.size);};
  const fetchImpl=async url=>{const relative=file(url);calls.push(relative);const text=fs.readFileSync(relative,'utf8');remember(url,JSON.parse(text));return new Response(text);};
  const Assets={async load(value){const url=typeof value==='string'?value:value.src,relative=file(url);calls.push(relative);if(cache.has(url))return cache.get(url);
    if(relative.endsWith('.json')){const data=read(relative);remember(url,data);cache.set(url,data);return data;}
    if(beforeImage)await beforeImage(relative);
    const size=imageSizes.get(url);assert.ok(size,'Image must follow its verified atlas metadata');
    const source=new PIXI.TextureSource({width:size.w,height:size.h});sources.push(source);const texture=new PIXI.Texture({source});cache.set(url,texture);return texture;
  },async unload(url){const value=cache.get(url);if(value instanceof PIXI.Texture)value.destroy(true);cache.delete(url);}};
  return {PIXI:createPixiAssetScope({...PIXI,Assets},base),fetchImpl,calls,sources,cache};
}
const config=entityId=>catalog.characters.find(c=>c.entityId===entityId);
// A native-art resident and a native-art evolution-class target (no reviewed artwork):
// ten streamed pages, idle on page 0 and the evolution reveal (sequence 39) on page 9.
const RESIDENT=config('m503_warglaymon'),TARGET=config('m541_dukemon');
const targetRuntime=read(TARGET.runtimePath),targetFolder=TARGET.runtimePath.slice(0,TARGET.runtimePath.lastIndexOf('/')+1);
const pagesOf=seq=>new Set(targetRuntime.sides.main.animations.find(a=>a.id===seq).frames.map(f=>targetRuntime.streaming.texturePages[f.texture]));
const targetImages=f=>f.calls.filter(p=>p.startsWith(targetFolder)&&/\.webp$/.test(p));
// Two atlas pages may share one deduplicated image, so compare image files, not page counts.
const imagesFor=pages=>new Set([...pages].map(page=>targetFolder+targetRuntime.sides.main.atlases[page].image));
const allImages=imagesFor(targetRuntime.sides.main.atlases.keys());

test('fixture premise: the target is a multi-page streamed runtime whose idle and sequence 39 sit on few pages',()=>{
  assert.equal(targetRuntime.streaming?.schemaVersion,1);
  assert.ok(targetRuntime.sides.main.atlases.length>=6);
  assert.ok(imagesFor(new Set([...pagesOf(0),...pagesOf(39)])).size<allImages.size/2);
});

test('a species requested after a streaming (ranch) roster exists streams only its idle and the requested sequence',async()=>{
  const f=fixture();
  const roster=await loadPublicCharacterRoster({...f,speciesIds:[RESIDENT.speciesId],initialSequences:{[RESIDENT.speciesId]:[0]}},base);
  assert.deepEqual(targetImages(f),[],'Target untouched before it is requested');
  assert.equal(await roster.ensureSpecies(`championship:creature:${TARGET.speciesId}`,{sequenceIds:[39]}),true);
  const expected=imagesFor(new Set([...pagesOf(0),...pagesOf(39)]));
  assert.deepEqual(new Set(targetImages(f)),expected,'Only the idle and sequence-39 pages, not the whole runtime');
  assert.equal(targetImages(f).length,expected.size,'Each page requested once');
  const actor=roster.createActor({speciesId:TARGET.speciesId,presentation:'raising'});
  assert.ok(actor.nativeFramePresenter.isFrameReady({sequenceId:0}));
  assert.ok(actor.nativeFramePresenter.isFrameReady({sequenceId:39}));
  // Every other sequence still reaches the presenter through the existing readiness gate.
  const later=targetRuntime.sides.main.animations.find(a=>!actor.nativeFramePresenter.isFrameReady({sequenceId:a.id}));
  assert.ok(later,'Some sequence is deferred');
  await actor.nativeFramePresenter.ensureFrame({sequenceId:later.id});
  assert.ok(actor.nativeFramePresenter.isFrameReady({sequenceId:later.id}));
  const frame=later.frames[0],applied=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:later.id,frameIndex:0,flipBits:0});
  assert.equal(applied.cell,frame.cell);
  actor.sprite.destroy();await roster.dispose();
  assert.equal(f.cache.size,0);assert.ok(f.sources.every(source=>source.destroyed));
});

test('repeated requests share one load; sequences named before the load starts join it',async()=>{
  const f=fixture();
  const roster=await loadPublicCharacterRoster({...f,speciesIds:[RESIDENT.speciesId],initialSequences:{[RESIDENT.speciesId]:[0]}},base);
  const first=roster.ensureSpecies(TARGET.speciesId),second=roster.ensureSpecies(`championship:creature:${TARGET.speciesId}`,{sequenceIds:[39]});
  assert.equal(first,second,'One pending promise per entity');
  assert.equal(await first,true);
  assert.deepEqual(new Set(targetImages(f)),imagesFor(new Set([...pagesOf(0),...pagesOf(39)])));
  assert.equal(targetImages(f).length,new Set(targetImages(f)).size);
  await roster.dispose();assert.ok(f.sources.every(source=>source.destroyed));
});

test('an eager roster (Hunt/Battle: no initialSequences) keeps loading a later species whole',async()=>{
  const f=fixture();
  const roster=await loadPublicCharacterRoster({...f,speciesIds:[RESIDENT.speciesId]},base);
  assert.equal(await roster.ensureSpecies(TARGET.speciesId,{sequenceIds:[39]}),true);
  assert.deepEqual(new Set(targetImages(f)),allImages);
  const actor=roster.createActor({speciesId:TARGET.speciesId,presentation:'hunt'});
  for(const seq of targetRuntime.sides.main.animations)
    assert.equal(actor.nativeFramePresenter.isFrameReady?.({sequenceId:seq.id})??true,true);
  actor.sprite.destroy();await roster.dispose();assert.ok(f.sources.every(source=>source.destroyed));
});

test('the idle and the requested sequence pages are fetched together, not one after another',async()=>{
  // The idle page's image is held until sequence 39's page metadata has been
  // requested. A serial loader never asks for it, and this load times out.
  const idleImage=targetFolder+targetRuntime.sides.main.atlases[[...pagesOf(0)][0]].image;
  const revealData=targetFolder+targetRuntime.sides.main.atlases[[...pagesOf(39)][0]].data;
  let calls=null;
  const f=fixture({beforeImage:async relative=>{
    if(relative!==idleImage)return;
    for(let i=0;i<200&&!calls.includes(revealData);i++)await new Promise(r=>setTimeout(r,5));
    if(!calls.includes(revealData))throw Error('SERIAL_SEQUENCE_LOAD');
  }});calls=f.calls;
  const roster=await loadPublicCharacterRoster({...f,speciesIds:[RESIDENT.speciesId],initialSequences:{[RESIDENT.speciesId]:[0]}},base);
  assert.equal(await roster.ensureSpecies(TARGET.speciesId,{sequenceIds:[39]}),true);
  assert.deepEqual(roster.getDiagnostics().failures,[]);
  await roster.dispose();assert.ok(f.sources.every(source=>source.destroyed));
});
