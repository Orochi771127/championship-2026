import {stageBodyScale,scaleNativeGeometry} from '../src/championship/presentation/stageBodySize.js';
import {newArtPortrait,newArtPortraitLike} from '../src/championship/presentation/newArtPortrait.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as PIXI from '../node_modules/pixi.js/dist/pixi.mjs';
import catalog from '../src/data/championship/public-character-catalog.v1.json' with {type:'json'};
import {loadPublicCharacterRoster,validatePublicCharacterRender} from '../src/championship/presentation/publicCharacterRoster.js';
import {loadPublicCharacterHudArt} from '../src/championship/presentation/publicCharacterHudArt.js';
import {createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
const base='https://orochi771127.github.io/championship-2026/';
const file=url=>new URL(url).pathname.slice('/championship-2026/'.length),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function fixture({tamper=null}={}){
 const calls=[],cache=new Map(),sources=[],imageSizes=new Map();let active=0,peak=0;
 const remember=(url,data)=>{if(data.meta?.image&&data.meta?.size)imageSizes.set(new URL(data.meta.image,url).href,data.meta.size);};
 const fetchImpl=async url=>{const relative=file(url);calls.push(relative);active++;peak=Math.max(peak,active);try{await new Promise(resolve=>setTimeout(resolve,1));const text=tamper?.(relative)??fs.readFileSync(relative,'utf8');remember(url,JSON.parse(text));return new Response(text);}finally{active--;}};
 const Assets={async load(value){const url=typeof value==='string'?value:value.src,relative=file(url);calls.push(relative);if(cache.has(url))return cache.get(url);
  if(relative.endsWith('.json')){const data=read(relative);remember(url,data);cache.set(url,data);return data;}
  let size=imageSizes.get(url);
  // Atlas metadata is loaded before its image by both normal bundle paths.
  for(const [key,data]of cache)if(key.endsWith('.json')&&data.meta?.image&&new URL(data.meta.image,key).href===url){size=data.meta.size;break;}
  assert.ok(size,'Image must follow its selected atlas metadata');const source=new PIXI.TextureSource({width:size.w,height:size.h});sources.push(source);const texture=new PIXI.Texture({source});cache.set(url,texture);return texture;
 },async unload(url){const value=cache.get(url);if(value instanceof PIXI.Texture)value.destroy(true);cache.delete(url);}};
 return {PIXI:createPixiAssetScope({...PIXI,Assets},base),fetchImpl,calls,sources,cache,get peak(){return peak;}};
}
const forbidden=path=>path==='src/data/championship/public-character-catalog.v1.json'||path.includes('ART_PRODUCTION_INDEX')||path.includes('/internal-')||path.endsWith('runtime.review.json')||path.endsWith('/manifest.json');
test('public character loading renders native frames with no private index, source manifest or synthesized review registration',async()=>{
 // m201 (GR01) uses the published reviewed animation since Owner 2026-10-29; a native-only Baby stands in.
 const configs=['e000_digitama','m102_koromon','m503_warglaymon','m529_metalgarurumon_va','m541_dukemon'].map(id=>catalog.characters.find(c=>c.entityId===id));
 const f=fixture(),roster=await loadPublicCharacterRoster({...f,speciesIds:configs.map(c=>c.speciesId),initialSequences:Object.fromEntries(configs.map(c=>[c.speciesId,[0]]))},base);
 assert.deepEqual(roster.getDiagnostics().failures,[]);
 for(const c of configs){const actor=roster.createActor({speciesId:c.speciesId,presentation:'raising'}),runtime=read(c.runtimePath),seq=runtime.sides.main.animations[0];assert.ok(actor?.nativeFramePresenter);
  const applied=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:seq.id,frameIndex:0,flipBits:0});assert.equal(applied.cell,seq.frames[0].cell);// Owner 2026-10-30: Awakened/Ultimate cells carry the stage body size (stageBodySize.js).
  assert.deepEqual(applied.geometry,scaleNativeGeometry(runtime.geometry,stageBodyScale(c.speciesId)).frames[seq.frames[0].texture]);
  if(c.nativeSizing)assert.equal(actor.nativeSizing.packedPixelsPerNativePixel,c.density);actor.sprite.destroy();}
 assert.ok(!f.calls.some(forbidden));await roster.dispose();assert.equal(f.cache.size,0);assert.ok(f.sources.every(source=>source.destroyed));
});
test('public render hash/motion/geometry failures cannot load pixels or fall back to private source atlases',async()=>{
 const c=catalog.characters[0],runtime=read(c.runtimePath),f=fixture({tamper:p=>p===c.runtimePath?'{}':null});
 const roster=await loadPublicCharacterRoster({...f,speciesIds:[c.speciesId],initialSequences:{[c.speciesId]:[0]}},base);
 assert.match(roster.getDiagnostics().failures[0].reason,/RUNTIME_HASH/);assert.equal(f.sources.length,0);assert.ok(!f.calls.some(forbidden));await roster.dispose();
 const changed=structuredClone(runtime);changed.sides.main.animations[0].frames[0].ticks++;await assert.rejects(validatePublicCharacterRender(changed,c),/NATIVE_MOTION/);
 const moved=structuredClone(runtime);moved.geometry.frames[runtime.sides.main.animations[0].frames[0].texture].origin[0]++;await assert.rejects(validatePublicCharacterRender(moved,c),/NATIVE_GEOMETRY/);
});
test('HUD loads only requested entities with bounded metadata work and preserves native result sequences and medal identities',async()=>{
 const f=fixture(),configs=catalog.characters.slice(0,16),hud=await loadPublicCharacterHudArt({baseUrl:base,fetchImpl:f.fetchImpl,speciesIds:configs.map(c=>c.speciesId)});
 assert.equal(f.calls.length,16);assert.ok(f.peak<=6);assert.ok(!f.calls.some(forbidden));
 for(const c of configs){const data=read(c.hudPath);assert.deepEqual(hud.getPortrait(c.speciesId),newArtPortraitLike(c.speciesId,data.portrait));for(const seq of data.battle.sequences)assert.deepEqual(hud.getBattleCells(c.speciesId,seq.id).map(cell=>cell.cell),[...new Set(seq.frames.map(frame=>frame.cell))]);}
 for(let id=0;id<61;id++)assert.equal(hud.getMedal(id).titleId,id);
 const c=configs[0],before=f.calls.length;await hud.ensureSpecies([c.speciesId,c.speciesId]);assert.equal(f.calls.length,before);
});
