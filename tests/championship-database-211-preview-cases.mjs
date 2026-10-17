import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const selection=read('../src/data/championship/public-character-catalog.v1.json');
const policy=read('../src/data/championship/public-playtest.r1.json');
const heroes=read('../src/data/championship/database-hero-portraits.r1.json');
const source=fs.readFileSync(new URL('../src/championship/presentation/acceptedDatabasePortraits.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const hero211=heroes.entries.find(e=>e.speciesIndex===211);
const create=(hero,{runtimeReady=false,evolutionReady=false,assetReady=false}={})=>new Function('publicHudCharacterConfig','databaseHeroPortrait','getProductExtension',source+';return {acceptedDatabasePortraitConfig,acceptedDatabaseIllustrationPreview,loadAcceptedDatabasePortrait};')(id=>{
 const value=selection.characters.find(c=>c.speciesId===id);
 return ['species-211','species-222','species-229','species-230'].includes(id)&&!assetReady?null:value??null;
},hero??(id=>heroes.entries.find(e=>e.speciesIndex===id)),id=>[229,230].includes(id)?{runtimeReady,evolutionReady,entityId:`entity-${id}`}:null);
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
 const manifestText=fs.readFileSync(new URL('../'+config.hudPath,import.meta.url),'utf8'),manifest=JSON.parse(manifestText);
 let requested;const image=await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,fetchImpl:async url=>{requested=url.href;return {ok:true,text:async()=>manifestText};}});assert.equal(requested,base+config.hudPath);assert.equal(image.src,base+manifest.portrait.src);

});
test('aborted database detail does not receive the static fallback',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(create().loadAcceptedDatabasePortrait(211,{baseUrl:base,signal:controller.signal}),{name:'AbortError'});
});

for(const id of [229,230])test(`${id} illustration preview is gated and preserves its own approved image`,async()=>{
 const ready={runtimeReady:true,evolutionReady:true,assetReady:true};
 for(const flag of Object.keys(ready)){const api=create(undefined,{...ready,[flag]:false});assert.equal(api.acceptedDatabaseIllustrationPreview(id),null);assert.equal(await api.loadAcceptedDatabasePortrait(id,{baseUrl:base}),null);}
 const api=create(undefined,ready),own=heroes.entries.find(e=>e.speciesIndex===id);let calls=0;
 const selected=api.acceptedDatabasePortraitConfig(id);assert.equal(selected.speciesId,`species-${id}`);assert.equal(api.acceptedDatabaseIllustrationPreview(id).sha256,own.sha256);
 const text=fs.readFileSync(new URL('../'+selected.hudPath,import.meta.url),'utf8'),hud=JSON.parse(text);
 const result=await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,fetchImpl:async()=>{calls++;return {ok:true,text:async()=>text};}});
 assert.equal(calls,1);assert.equal(result.speciesId,`species-${id}`);assert.equal(result.sha256,hud.portrait.sha256);assert.equal(result.src,base+hud.portrait.src);
 assert.equal(await api.loadAcceptedDatabasePortrait(id,{baseUrl:base,revealed:false}),null);
 for(const wrong of [hero211,{...own,speciesIndex:id===229?230:229},{...own,sha256:'0'.repeat(64)}])assert.equal(create(()=>wrong,ready).acceptedDatabaseIllustrationPreview(id),null);
 const controller=new AbortController();controller.abort();await assert.rejects(api.loadAcceptedDatabasePortrait(id,{baseUrl:base,signal:controller.signal}),{name:'AbortError'});
});

test('222 quadruped uses only its own selected hero without changing animation selection',async()=>{
 const api=create(),own=heroes.entries.find(e=>e.speciesIndex===222);assert.equal(api.acceptedDatabasePortraitConfig(222),null);let calls=0;
 const result=await api.loadAcceptedDatabasePortrait(222,{baseUrl:base,fetchImpl:()=>{calls++;throw Error('NO_MANIFEST_FETCH');}});
 assert.equal(calls,0);assert.equal(result.speciesId,'species-222');assert.equal(result.sha256,'4d1dae7fb4470338818dd8a4213ee77dba8cc59234bbcfe4f29f8cabda13a7c3');assert.equal(result.src,base+own.src);
 const humanoid=heroes.entries.find(e=>e.speciesIndex===230);assert.equal(create(()=>humanoid).acceptedDatabaseIllustrationPreview(222),null);
 assert.equal(await api.loadAcceptedDatabasePortrait(222,{baseUrl:base,revealed:false}),null);
});
