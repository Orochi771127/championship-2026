import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPixiCharacterRuntimeBundle} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {loadLicensedCharacterRoster,LICENSED_CHARACTER_MANIFEST} from '../src/championship/presentation/licensedCharacterRoster.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function fixture(runtimeUrl='http://localhost/fixture/runtime.json'){
 let closes=0;
 const sources=[{pixelWidth:128,pixelHeight:64,width:64,height:32,format:'rgba8unorm'},
  {pixelWidth:16,pixelHeight:8,width:8,height:4,format:'rgba8unorm'}];
 for(const source of sources){source.destroyed=false;source.resource={close(){closes++;}};}
 const atlas=(name,image)=>({data:name+'.json',image:image+'.png'});
 const anim=keys=>[{id:0,frames:keys.map(texture=>({texture,ticks:1}))}];
 const runtime={entityId:'e000_digitama',sides:{main:{atlases:[atlas('a','shared'),atlas('b','b')],animations:anim(['a','b'])},
  sub:{atlases:[atlas('c','shared')],animations:anim(['c'])}}};
 const data=name=>({frames:{[name]:{}},meta:{size:{w:3,h:3}}});
 class Sprite{}
 class Spritesheet{constructor({texture,data}){this.textureSource=texture.source;this.textures=Object.fromEntries(Object.keys(data.frames).map(k=>[k,{source:texture.source}]));}async parse(){}destroy(){}}
 const parsed=name=>({textureSource:sources[0],data:data(name),textures:{[name]:{source:sources[0]}}});
 const loaded=[],unloaded=[];
 const PIXI={Sprite,Spritesheet,Assets:{async load(input){const url=typeof input==='string'?input:input.src;loaded.push(url);
  if(url===runtimeUrl)return runtime;
  const name=new URL(url).pathname.split('/').at(-1);
  return name==='a.json'?parsed('a'):name==='c.json'?parsed('c'):name==='b.json'?data('b'):{source:sources[name==='b.png'?1:0]};
 },async unload(url){unloaded.push(url);if(url.endsWith('a.json')||url.endsWith('c.json'))sources[0].destroyed=true;if(url.endsWith('b.png'))sources[1].destroyed=true;}}};
 return {PIXI,runtimeUrl,sources,loaded,unloaded,closes:()=>closes};
}
test('actual parsed/manual atlas sources determine physical bytes, selected pages and deduplicated Main/Sub memory',async()=>{
 const f=fixture(),bundle=await loadPixiCharacterRuntimeBundle({...f,sides:['main','sub']});
 const m=bundle.getDiagnostics().textureMemory;
 assert.equal(m.measurement,'BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE');
 assert.equal(m.pageCount,3);assert.equal(m.sourceCount,2);assert.equal(m.estimatedBaseRgbaBytes,128*64*4+16*8*4);
 assert.deepEqual(m.atlasPages.map(p=>[p.side,p.width,p.height,p.countedInEstimate]),[['main',128,64,true],['main',16,8,true],['sub',128,64,false]]);
 assert.ok(m.atlasPages.every(p=>p.textureFormat==='rgba8unorm'));
 await bundle.dispose();assert.equal(f.closes(),2);assert.ok(f.sources.every(s=>s.destroyed));
 assert.equal(bundle.getDiagnostics().textureMemory.pageCount,0);assert.equal(bundle.getDiagnostics().textureMemory.estimatedBaseRgbaBytes,0);
 await bundle.dispose();assert.equal(f.closes(),2);
});
test('unknown loaded-source dimensions stay unknown instead of using atlas JSON size',async()=>{
 const f=fixture();delete f.sources[0].pixelWidth;
 const bundle=await loadPixiCharacterRuntimeBundle({...f,sides:['main']});
 const m=bundle.getDiagnostics().textureMemory;assert.equal(m.pageCount,2);assert.equal(m.unknownSourceCount,1);assert.equal(m.estimatedBaseRgbaBytes,null);
 await bundle.dispose();
});
test('roster reports overridden loaded atlas bytes rather than baseline record bytes and releases its estimate',async()=>{
 const manifest=read(LICENSED_CHARACTER_MANIFEST),productionIndex=read('assets/production/ART_PRODUCTION_INDEX.json');
 const manifestUrl='http://localhost/'+LICENSED_CHARACTER_MANIFEST;
 const runtimeUrl=new URL('e000_digitama/runtime.json',manifestUrl).href,f=fixture(runtimeUrl);
 const roster=await loadLicensedCharacterRoster({PIXI:f.PIXI,speciesIds:['species-000','championship:creature:species-000'],manifest,productionIndex,manifestUrl});
 const d=roster.getDiagnostics();assert.equal(d.loadedEntityIds.length,1);assert.equal(d.textureMemory.pageCount,2);
 assert.equal(d.rgbaBytes,128*64*4+16*8*4);assert.notEqual(d.rgbaBytes,manifest.records[0].sides.main.rgbaBytes);
 assert.deepEqual(d.textureMemory.unknownEntityIds,[]);assert.ok(d.textureMemory.atlasPages.every(p=>p.entityId==='e000_digitama'));
 await roster.dispose();assert.equal(roster.getDiagnostics().rgbaBytes,0);assert.equal(roster.getDiagnostics().textureMemory.pageCount,0);
});
test('roster never substitutes baseline bytes for an unmeasured custom loader',async()=>{
 const manifest=read(LICENSED_CHARACTER_MANIFEST),productionIndex=read('assets/production/ART_PRODUCTION_INDEX.json');
 const roster=await loadLicensedCharacterRoster({PIXI:{},speciesIds:['species-000'],manifest,productionIndex,manifestUrl:'http://localhost/'+LICENSED_CHARACTER_MANIFEST,
  loadBundle:async()=>({dispose:async()=>{}})});
 assert.equal(roster.getDiagnostics().rgbaBytes,null);assert.deepEqual(roster.getDiagnostics().textureMemory.unknownEntityIds,['e000_digitama']);await roster.dispose();
});
