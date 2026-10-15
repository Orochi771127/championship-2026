import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const selection=read('../src/data/championship/accepted-original-character-selection.r1.json');
const policy=read('../src/data/championship/public-playtest.r1.json');
const heroes=read('../src/data/championship/database-hero-portraits.r1.json');
const source=fs.readFileSync(new URL('../src/championship/presentation/acceptedDatabasePortraits.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const hero211=heroes.entries.find(e=>e.speciesIndex===211);
const create=(hero,{runtimeReady=false,evolutionReady=false,assetReady=false}={})=>new Function('selection','policy','originalHudSourceSpecies','databaseHeroPortrait','getProductExtension','alternateFormAsset',source+';return {acceptedDatabasePortraitConfig,acceptedDatabaseIllustrationPreview,loadAcceptedDatabasePortrait};')(selection,policy,x=>x,hero??(id=>heroes.entries.find(e=>e.speciesIndex===id)),id=>({runtimeReady,evolutionReady,entityId:`entity-${id}`}),entityId=>assetReady?{entityId}:null);
const base='https://orochi771127.github.io/championship-2026/';
test('211 missing accepted-animation config uses its already-public OC220 encyclopedia image only',async()=>{
 const api=create();assert.equal(api.acceptedDatabasePortraitConfig(211),null);let calls=0;
 const image=await api.loadAcceptedDatabasePortrait(211,{baseUrl:base,fetchImpl:async()=>{calls++;throw Error('Must not fetch missing runtime');}});
 assert.equal(calls,0);assert.equal(image.src,base+hero211.src);assert.equal(image.speciesId,'species-211');assert.equal(image.sha256,hero211.sha256);assert.equal(image.derivation,'SELECTED_PUBLIC_DATABASE_ILLUSTRATION_PREVIEW');
});
test('preview never substitutes 229 or enables unready alternate forms',async()=>{
 const api=create();assert.equal(api.acceptedDatabaseIllustrationPreview(229),null);assert.equal(await api.loadAcceptedDatabasePortrait(229,{baseUrl:base}),null);
 assert.equal(create(()=>({...hero211,speciesIndex:229,speciesId:'species-229'})).acceptedDatabaseIllustrationPreview(211),null);
 assert.equal(create(()=>({...hero211,src:'assets/production/internal-character-review/unknown.png'})).acceptedDatabaseIllustrationPreview(211),null);
 assert.equal(create(()=>({...hero211,sha256:'0'.repeat(64)})).acceptedDatabaseIllustrationPreview(211),null);
});
test('existing accepted HUD route retains its original validation and fetch',async()=>{
 const api=create(),config=selection.characters[0],id=Number(config.speciesId.slice(8));assert.notEqual(id,211);
 const prefix=selection.root+config.folder+'/hud-r01/';const manifest={entityId:config.entityId,sourceBankSha256:config.sourceBankSha256,localPackagingProvenance:{publicationStatus:'OWNER_AUTHORIZED_HASH_SELECTED_PLAYTEST',ownerReplyId:policy.acceptedOriginalRuntime.ownerReplyId,allImageRgbaExact:true},portrait:{speciesId:config.speciesId,entityId:config.entityId,derivation:'ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA',cell:0,sequenceId:0,nativeScale:2,src:prefix+'main-cell_000.webp',sha256:'a'.repeat(64),rasterScale:4,width:1,height:1,rasterWidth:4,rasterHeight:4}};
 let requested;const image=await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,fetchImpl:async url=>{requested=url.href;return {ok:true,json:async()=>manifest};}});assert.equal(requested,base+prefix+'manifest.json');assert.equal(image.src,base+manifest.portrait.src);
});
test('aborted database detail does not receive the static fallback',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(create().loadAcceptedDatabasePortrait(211,{baseUrl:base,signal:controller.signal}),{name:'AbortError'});
});

for(const id of [229,230])test(`${id} illustration preview is gated and preserves its own approved image`,async()=>{
 const ready={runtimeReady:true,evolutionReady:true,assetReady:true};
 for(const flag of Object.keys(ready)){const api=create(undefined,{...ready,[flag]:false});assert.equal(api.acceptedDatabaseIllustrationPreview(id),null);assert.equal(await api.loadAcceptedDatabasePortrait(id,{baseUrl:base}),null);}
 const api=create(undefined,ready),own=heroes.entries.find(e=>e.speciesIndex===id);let calls=0;
 assert.equal(api.acceptedDatabasePortraitConfig(id),null,'accepted animation selection remains unchanged');
 const result=await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,fetchImpl:async()=>{calls++;throw Error('NO_MANIFEST_FETCH');}});
 assert.equal(calls,0);assert.equal(result.speciesId,`species-${id}`);assert.equal(result.sha256,own.sha256);assert.equal(result.src,base+own.src);
 assert.equal(await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,revealed:false}),null);
 for(const wrong of [hero211,{...own,speciesIndex:id===229?230:229},{...own,sha256:'0'.repeat(64)}])assert.equal(create(()=>wrong,ready).acceptedDatabaseIllustrationPreview(id),null);
 const controller=new AbortController();controller.abort();await assert.rejects(api.loadAcceptedDatabasePortrait(id,{baseUrl:base,signal:controller.signal}),{name:'AbortError'});
});
