import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {completedCharacterBundleLocation,validateCompletedOriginalRuntime,loadCompletedOriginalCharacters} from '../src/championship/presentation/completedOriginalCharacters.js';
import * as PIXI from '../node_modules/pixi.js/dist/pixi.mjs';
import {createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {applyBattlePagePolicy,readBattlePagePolicy,nativeBattleContract} from '../scripts/lib/public-battle-page-policy.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pack=read('assets/production/characters/battle-packed-20261013/manifest.json'),accepted=read('src/data/championship/accepted-original-character-selection.r1.json');
const base='https://orochi771127.github.io/championship-2026/',index=read('assets/production/ART_PRODUCTION_INDEX.json');

test('public shared pages retain six native motion/geometry contracts and reversible independent bindings',()=>{
 const catalog=read('src/data/championship/public-character-catalog.v1.json'),policy=readBattlePagePolicy(process.cwd()),before=JSON.stringify(catalog);
 assert.equal(policy.mode,'SHARED_EXISTING_MAIN_PAGES');assert.equal(policy.independentFiles.length,28);
 const selected=applyBattlePagePolicy(process.cwd(),catalog,policy),restored=applyBattlePagePolicy(process.cwd(),selected,{...policy,mode:'INDEPENDENT_PACKS'});
 assert.deepEqual(selected,catalog);
 let count=0;
 for(const row of policy.characters){
  const shared=selected.characters.find(c=>c.entityId===row.entityId),original=restored.characters.find(c=>c.entityId===row.entityId);
  assert.equal(shared.battleRuntimePath,undefined);assert.equal(shared.runtimePath,row.sharedRuntimePath);
  assert.equal(original.battleRuntimePath,row.independentRuntimePath);assert.equal(original.battleRuntimeSha256,row.independentRuntimeSha256);
  const a=read(row.sharedRuntimePath),b=read(row.independentRuntimePath);
  assert.deepEqual(nativeBattleContract(a),nativeBattleContract(b));count+=Object.keys(a.geometry.frames).filter(key=>key.includes('/main/')).length;
 }
 assert.equal(count,370);assert.equal(JSON.stringify(catalog),before);
 assert.deepEqual(selected.speciesBindings,catalog.speciesBindings);
 assert.throws(()=>applyBattlePagePolicy(process.cwd(),catalog,{...policy,characters:policy.characters.map((row,i)=>i?row:{...row,nativeContractSha256:'0'.repeat(64)})}),/NATIVE_CONTRACT/);
});

test('only the explicit main-only Battle context selects the six packed bundles, with separate cache namespaces',()=>{
 for(const r of pack.characters){
  const c=accepted.characters.find(c=>c.entityId===r.entity),ordinary=completedCharacterBundleLocation(c,{sides:['main'],productionIndex:index},base);
  const battle=completedCharacterBundleLocation(c,{battleAtlas:true,sides:['main'],productionIndex:index},base);
  assert.equal(ordinary.packed,false);assert.equal(battle.packed,true);assert.notEqual(battle.cachePrefix,ordinary.cachePrefix);
  assert.ok(battle.runtimeUrl.includes('/battle-packed-20261013/'));assert.ok(ordinary.runtimeUrl.includes('/accepted-20261010/'));
  assert.equal(completedCharacterBundleLocation(c,{battleAtlas:true,sides:['main','sub'],productionIndex:index},base).packed,false);
 }
 const other=accepted.characters.find(c=>!pack.characters.some(r=>r.entity===c.entityId));
 assert.equal(completedCharacterBundleLocation(other,{battleAtlas:true,sides:['main'],productionIndex:index},base).packed,false);
 assert.throws(()=>completedCharacterBundleLocation(accepted.characters.find(c=>c.entityId===pack.characters[0].entity),{battleAtlas:true,sides:['main'],productionIndex:{entries:[]}},base),/NOT_REGISTERED/);
});

test('all 370 frame contracts and every native sequence/geometry survive the lossless six-character repack',()=>{
 assert.deepEqual(pack.characters.map(r=>r.species),['species-189','species-212','species-207','species-210','species-177','species-190']);
 let frames=0,bytes=0,pages=0;
 for(const r of pack.characters){
  const originalRoot=accepted.root+r.sourceFolder+'/',root=pack.root+r.entity+'/',original=read(originalRoot+'main.json'),runtime=read(root+'runtime.review.json'),oldRuntime=read(originalRoot+'runtime.review.json');
  assert.equal(hash(originalRoot+'main.webp'),r.sourceImageSha256);assert.equal(hash(originalRoot+'main.json'),r.sourceDataSha256);assert.equal(hash(root+'runtime.review.json'),r.runtimeSha256);
  for(const key of ['artProfile','timing','reviewGeometry','sourceBankSha256','motionContractSha256'])assert.deepEqual(runtime[key],oldRuntime[key]);
  for(const side of ['main','sub'])assert.deepEqual(runtime.sides[side].animations,oldRuntime.sides[side].animations);
  validateCompletedOriginalRuntime(runtime,accepted.characters.find(c=>c.entityId===r.entity),read('assets/production/internal-faithful-baseline/characters-v1/'+r.entity+'/runtime.json'));
  const seen=new Set();
  for(const page of r.pages){
   assert.equal(hash(root+page.image),page.imageSha256);assert.equal(hash(root+page.data),page.dataSha256);
   const data=read(root+page.data);assert.deepEqual(data.meta.size,{w:page.width,h:page.height});assert.ok(page.width<=2048&&page.height<=2048);
   bytes+=page.width*page.height*4;pages++;
   for(const [key,row]of Object.entries(data.frames)){
    assert.ok(!seen.has(key));seen.add(key);const normalized=structuredClone(row);normalized.frame=original.frames[key].frame;
    assert.deepEqual(normalized,original.frames[key]);assert.match(r.framePixelHashes[key],/^[0-9a-f]{64}$/);frames++;
    assert.ok(row.frame.x+row.frame.w<=page.width&&row.frame.y+row.frame.h<=page.height);
   }
  }
  assert.deepEqual([...seen].sort(),Object.keys(original.frames).sort());
 }
 assert.equal(frames,370);assert.equal(pages,11);assert.equal(bytes,125843456);assert.ok(bytes<465567744*.28);
});

test('existing Pixi loader dedupes the 11 real-size sources, keeps native sequence anchors/bounds and releases every source',async t=>{
 const fetch=globalThis.fetch;globalThis.fetch=async url=>({ok:true,json:async()=>read(new URL(url).pathname.slice('/championship-2026/'.length))});t.after(()=>{globalThis.fetch=fetch;});
 const calls=[],sources=[],cache=new Map();
 const assets={async load(value){const url=typeof value==='string'?value:value.src;if(cache.has(url))return cache.get(url);calls.push(url);
   const p=new URL(url).pathname.slice('/championship-2026/'.length);let result;
   if(p.endsWith('.json'))result=read(p);else{const meta=read(p.replace(/\.webp$/,'.json')).meta.size;const source=new PIXI.TextureSource({width:meta.w,height:meta.h});sources.push(source);result=new PIXI.Texture({source});}
   cache.set(url,result);return result;
 },async unload(url){const value=cache.get(url);if(value instanceof PIXI.Texture)value.destroy(true);cache.delete(url);}};
 const scoped=createPixiAssetScope({...PIXI,Assets:assets},base),speciesIds=pack.characters.flatMap(r=>[r.species,r.species]);
 const opts={PIXI:scoped,speciesIds,sides:['main'],productionIndex:index,manifestUrl:base+'assets/production/internal-faithful-baseline/characters-v1/manifest.json',manifest:read('assets/production/internal-faithful-baseline/characters-v1/manifest.json')};
 const packed=await loadCompletedOriginalCharacters({...opts,battleAtlas:true},base);
 assert.deepEqual(packed.getDiagnostics().failures,[]);assert.equal(packed.getDiagnostics().textureMemory.estimatedBaseRgbaBytes,125843456);
 assert.equal(packed.getDiagnostics().textureMemory.sourceCount,11);assert.equal(sources.length,11);assert.equal(new Set(calls).size,calls.length);
 assert.ok(!calls.some(u=>/accepted-20261010\/[^/]+\/main\.webp$/.test(u)));
 const original=await loadCompletedOriginalCharacters(opts,base);
 for(const r of pack.characters){
  const runtime=read(pack.root+r.entity+'/runtime.review.json');
  for(const seq of runtime.sides.main.animations){
   const a=packed.createActor({speciesId:r.species,presentation:'battle'}),b=original.createActor({speciesId:r.species,presentation:'battle'});
   for(let i=0;i<seq.frames.length;i++){
    const args={battleFrame:i,sequenceId:seq.id,nativeRequest:true,nativeSample:{sequenceId:seq.id,frameIndex:i,cell:seq.frames[i].cell}};
    assert.deepEqual(a.battleAnimator.apply(args),b.battleAnimator.apply(args));
    assert.deepEqual(a.sprite.texture.orig,b.sprite.texture.orig);assert.deepEqual(a.sprite.texture.trim,b.sprite.texture.trim);
    assert.deepEqual([a.sprite.anchor.x,a.sprite.anchor.y],[b.sprite.anchor.x,b.sprite.anchor.y]);
    const aa=a.sprite.getBounds(),bb=b.sprite.getBounds();assert.deepEqual([aa.minX,aa.minY,aa.maxX,aa.maxY],[bb.minX,bb.minY,bb.maxX,bb.maxY]);
   }
   a.sprite.destroy();b.sprite.destroy();
  }
 }
 await packed.dispose();assert.ok(sources.slice(0,11).every(s=>s.destroyed));assert.equal(packed.getDiagnostics().textureMemory.sourceCount,0);
 await original.dispose();assert.ok(sources.every(s=>s.destroyed));assert.equal(cache.size,0);
});
