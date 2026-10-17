import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {projectPublicRenderSources,PUBLIC_RENDER_RECIPE} from '../scripts/lib/public-render-projection.mjs';
import {validatePublicRenderDescriptor,loadPublicRenderDescriptor} from '../src/championship/presentation/publicRenderDescriptors.js';
import {loadRegisteredBattleEffectArt} from '../src/championship/presentation/battleEffectArt.js';
import {loadRegisteredRaisingFeedbackArt} from '../src/championship/presentation/raisingFeedbackArt.js';
import {loadRegisteredHuntFeedbackArt} from '../src/championship/presentation/huntFeedbackArt.js';
import {loadOriginalSharedVfxReview} from '../src/championship/presentation/originalSharedVfxReview.js';
const root=process.cwd(),read=file=>JSON.parse(fs.readFileSync(file,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const index=read('assets/production/ART_PRODUCTION_INDEX.json');
const projection=projectPublicRenderSources({root,input,index});
const byRole=new Map(projection.descriptors.map(value=>[value.role,value]));
const baseUrl='https://orochi771127.github.io/championship-2026/';
function transport(calls){return async url=>{
 const request=String(url);calls.push(request);assert.equal(request.includes('ART_PRODUCTION_INDEX'),false);
 const selected=projection.descriptors.find(row=>new URL(row.path,baseUrl).href===request);assert.ok(selected,request);
 return {ok:true,status:200,text:async()=>selected.bytes.toString('utf8')};
};}
function pixi(images){
 const loads=[],unloads=[];
 class Rectangle{constructor(...args){this.values=args;}}
 class Texture{constructor(value){Object.assign(this,value);}destroy(){this.destroyed=true;}}
 return {loads,unloads,Rectangle,Texture,Assets:{async load(src){loads.push(src);const row=images.get(src);assert.ok(row,src);return {width:row.rasterWidth??row.width,height:row.rasterHeight??row.height,source:{scaleMode:'linear'}};},async unload(src){unloads.push(src);}}};
}

test('v2 permanently excludes authoring index and policy from public file selection while retaining the originals',()=>{
 assert.equal(input.schemaVersion,2);assert.equal(input.authoring.indexPath,'assets/production/ART_PRODUCTION_INDEX.json');
 assert.ok(fs.existsSync(input.authoring.indexPath));assert.ok(Array.isArray(index.entries));
 assert.ok(!input.files.includes(input.authoring.indexPath));assert.ok(!input.files.includes(input.authoring.policyPath));
 const publicIndex=read('assets/production/PUBLIC_RUNTIME_INDEX.json');assert.deepEqual(Object.keys(publicIndex),['schemaVersion','assets']);
 for(const row of publicIndex.assets)assert.ok(Object.keys(row).every(key=>['id','src','sha256','width','height'].includes(key)));
 assert.ok(index.entries.some(row=>row.localOnly===true),'Private production records remain available to authoring and are not promoted into public runtime data.');
});

test('all five render descriptions re-export byte-for-byte without production, source or rights metadata',()=>{
 assert.equal(projection.descriptors.length,5);assert.equal(projection.media.size,361);
 const prohibited=/"(?:localOnly|reviewOnly|runtimeEligible|publicReleasePermitted|shippingReady|humanApproved|rightsStatus|provenance|romSha256|sourceBankSha256|sourceHashes|sourceSha256|sourceRgbaSha256|pcmSha256)"|libfile_|Sentinel_/;
 for(const row of projection.descriptors){assert.ok(fs.readFileSync(row.path).equals(row.bytes));assert.equal(sha(row.bytes),row.sha256);assert.doesNotMatch(row.bytes.toString(),prohibited);}
});

test('runtime projection refuses a missing existing media hash rather than granting approval from a filename or production flag',()=>{
 const [file]=projection.media.keys();const changed=structuredClone(input);changed.publicPlaytest.files=changed.publicPlaytest.files.filter(row=>row.path!==file);
 assert.throws(()=>projectPublicRenderSources({root,input:changed,index}),/PUBLIC_RENDER_MEDIA_NOT_HASH_SELECTED/);
});

test('private or unknown fields cannot be smuggled into any render descriptor',()=>{
 for(const row of projection.descriptors)for(const key of ['localOnly','provenance','libraryFileId','approval']){
  const changed=structuredClone(row.value);changed[key]={secret:'must stay in authoring'};
  assert.throws(()=>validatePublicRenderDescriptor(changed,row.role),/PUBLIC_RENDER_DESCRIPTOR_SCHEMA/);
 }
 const changed=structuredClone(byRole.get('battle-effects').value);changed.cells[0].sourceBankSha256='f'.repeat(64);
 assert.throws(()=>validatePublicRenderDescriptor(changed,'battle-effects'),/PUBLIC_RENDER_DESCRIPTOR_CELL/);
});

test('all five runtime loaders fetch only the selected public descriptor and enforce its exact bytes',async()=>{
 const calls=[];
 for(const row of projection.descriptors){
  const value=await loadPublicRenderDescriptor(row.role,{baseUrl,fetchImpl:transport(calls)});assert.deepEqual(value,row.value);
  await assert.rejects(loadPublicRenderDescriptor(row.role,{baseUrl,fetchImpl:async()=>({ok:true,text:async()=>row.bytes.toString()+' '})}),/PUBLIC_RENDER_HASH/);
 }
 assert.equal(calls.length,5);assert.ok(calls.every(url=>url.includes('/public-runtime/')&&!url.includes('/internal-')));
});

test('battle effect loader retains all 1231 native cells and exact frame/origin/blank bindings without loading an authority index',async()=>{
 const data=byRole.get('battle-effects').value,calls=[],PIXI=pixi(new Map([[data.image.src,data.image]]));
 const art=await loadRegisteredBattleEffectArt({PIXI,baseUrl,fetchImpl:transport(calls)});
 assert.equal(data.cells.length,1231);
 for(const row of data.cells){const result=art.getCell(row.bankId,row.cell);assert.deepEqual(result.origin,row.origin);assert.equal(result.blank,row.blank);assert.deepEqual(result.texture.frame.values,row.frame);}
 await art.dispose();assert.deepEqual(PIXI.unloads,[data.image.src]);assert.equal(calls.length,1);
});

test('raising feedback retains the same 48 selected reaction/treatment/star cells',async()=>{
 const data=byRole.get('raising-feedback').value,calls=[],PIXI=pixi(new Map(data.cells.map(row=>[row.src,row])));
 const art=await loadRegisteredRaisingFeedbackArt({PIXI,baseUrl,fetchImpl:transport(calls)});
 assert.equal(PIXI.loads.length,48);assert.equal(art.getCell(144).src,data.cells.find(row=>row.cell===144).src);assert.equal(art.getCell(100),null);
 await art.dispose();assert.equal(PIXI.unloads.length,48);assert.equal(calls.length,1);
});

test('Hunt lazily loads only carried kinds and uses the same approved care-meat pose/scale without fetching its production manifest',async()=>{
 const data=byRole.get('hunt-feedback').value,calls=[],all=data.banks.flatMap(bank=>bank.cells),PIXI=pixi(new Map(all.map(row=>[row.src,row])));
 const art=await loadRegisteredHuntFeedbackArt({PIXI,baseUrl,fetchImpl:transport(calls),kinds:['MEAT']});
 const frame=art.getFrame({kind:'MEAT',itemIndex:0,tier:3});assert.equal(frame.src,'assets/production/original-ui-intake-20261007/items/care19/meat-0.png');assert.equal(frame.displayScale,.5);
 assert.equal(PIXI.loads.length,data.banks.filter(bank=>bank.kind==='MEAT').flatMap(bank=>bank.cells).length);assert.equal(calls.length,1);
 await art.dispose();
});

test('shared effects preserve native blank state, full sequence coverage and locale atlas selection using only public rendering data',async()=>{
 const data=byRole.get('shared-vfx').value,base=byRole.get('battle-effects').value,calls=[];
 const native=new Map(base.cells.map(row=>[`${row.bankId}:${row.cell}`,row]));
 const images=[data.image,...Object.values(data.localizedText.sets).map(set=>set.image)],PIXI=pixi(new Map(images.map(row=>[row.src,row])));
 let baseDisposals=0;
 const art=await loadOriginalSharedVfxReview({PIXI,baseArt:{getCell:(bank,cell)=>native.get(`${bank}:${cell}`),dispose:async()=>{baseDisposals++;}},
  href:baseUrl+'?vfxOriginal=shared-v1',baseUrl,fetchImpl:transport(calls),getLocale:()=> 'zh-Hant',onLocaleChange:()=>()=>{},deferRelease:callback=>callback()});
 assert.equal(calls.length,1);assert.equal(PIXI.loads.length,2);assert.ok(PIXI.loads.includes(data.localizedText.sets['zh-Hant'].image.src));
 for(const row of data.cells)assert.deepEqual(art.getCell(row.bankId,row.cell).origin,row.origin);
 await art.dispose();assert.equal(baseDisposals,1);
});

test('audio export preserves all 54 sample IDs, channels, rates, lengths and exact original media hashes',()=>{
 const data=byRole.get('battle-audio').value,recipe=read(PUBLIC_RENDER_RECIPE);
 const original=read(recipe.sources.find(row=>row.role==='battle-audio').path);
 const fields=['soundId','src','sha256','channels','sampleRate','sampleFrames','loop'];
 assert.deepEqual(data.sounds,original.sounds.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]]))));
});
