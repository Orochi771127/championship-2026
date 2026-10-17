import {PUBLIC_CHARACTER_RENDER_KIND,characterRenderAnimations} from '../src/championship/presentation/publicCharacterRenderContract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../src/championship/presentation/completedOriginalCharacters.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const base='https://example.test/';
function fixture(response,{strict=false,expectedText=null}={}){
 const entity='m503_warglaymon',texture=entity+'/main/cell_000',sub=entity+'/sub/cell_000';
 const config={entityId:entity,speciesId:'species-189',folder:'test-original',sourceBankSha256:'a'.repeat(64),density:4,logicalCanvas:[64,64],rasterCanvas:[256,256],origin:[32,48],frameOrigins:{[texture]:[128,192],[sub]:[128,192]}};
 const sequence=key=>[{id:0,playbackMode:2,frames:[{cell:0,ticks:31,texture:key}]}];
 const baseline={entityId:entity,sides:{main:{animations:sequence(texture)},sub:{animations:sequence(sub)}}};
 const runtime={schemaVersion:1,renderer:'PIXIJS_V8_SPRITESHEET',entityId:entity,sourceBankSha256:config.sourceBankSha256,artProfile:{reviewOnly:true,runtimeEligible:false,publicReleasePermitted:false,scale:4,logicalCanvas:[64,64],anchor:{x:.5,y:.75}},sides:baseline.sides,reviewGeometry:{frames:Object.fromEntries([texture,sub].map(key=>[key,{scale:4,origin:[128,192],sourceSize:[256,256]}]))}};
 if(strict){config.assetRoot='assets/alternate/';config.motionDonorEntityId=entity;config.baselineRuntimeSha256=createHash('sha256').update(expectedText??JSON.stringify(baseline)).digest('hex');}
 const calls={loads:[],disposed:0,json:0,text:0};
 const fetch=async()=>({ok:true,...Object.fromEntries(Object.entries(response).map(([key,value])=>[key,async()=>{calls[key]++;return value===true?(key==='json'?baseline:JSON.stringify(baseline)):value;}]))});
 const loadBundle=async args=>{calls.loads.push(args.runtimeUrl);return {runtime,dispose:async()=>{calls.disposed++;}};};
 const loadRoster=async opts=>{const bundle=await opts.loadBundle({runtimeUrl:base+'assets/baseline/'+entity+'/runtime.json'});return {dispose:()=>bundle.dispose(),getDiagnostics:()=>({})};};
 const loader=new Function('PUBLIC_CHARACTER_RENDER_KIND','characterRenderAnimations','ranchPacking','acceptedSelection','battlePacking','isApprovedOriginalPublicLocation','isOriginalRuntimeLocation','loadLicensedCharacterRoster','loadPixiCharacterRuntimeBundle','COMPLETED_ORIGINAL_CHARACTERS','readHudManifest','alternateFormAsset','mergeAlternateFormConfigs','bindAlternateFormManifest','rekeyAlternateDonorRuntime','fetch',source+';return loadCompletedOriginalCharacters;')(PUBLIC_CHARACTER_RENDER_KIND,characterRenderAnimations,{characters:[]},{characters:[config],root:'assets/accepted/'},{assetId:'packed',root:'assets/packed/',characters:[{entity}]},()=>true,()=>true,loadRoster,loadBundle,[],()=>{},()=>null,x=>x,x=>x,x=>x,fetch);
 const run=()=>loader({sides:['main'],battleAtlas:true,manifest:{},productionIndex:{entries:[{assetId:'packed',manifestPath:'assets/packed/manifest.json',runtimeEligible:true,publicReleasePermitted:true}]}},base);
 return {run,calls};
}
test('native packed loader retains json-only response contract without text or extra fetch fallback',async()=>{
 const f=fixture({json:true});const roster=await f.run();assert.deepEqual(roster.getDiagnostics().completedOriginalArt.failures,[]);assert.equal(f.calls.json,1);assert.equal(f.calls.text,0);assert.equal(f.calls.loads.length,1);assert.match(f.calls.loads[0],/assets\/packed/);await roster.dispose();assert.equal(f.calls.disposed,1);
});
test('hash-bound alternate loader reads exact text and keeps byte-hash validation',async()=>{
 const f=fixture({text:true},{strict:true});const roster=await f.run();assert.deepEqual(roster.getDiagnostics().completedOriginalArt.failures,[]);assert.equal(f.calls.text,1);assert.equal(f.calls.json,0);assert.equal(f.calls.loads.length,1);
});
test('hash-bound alternate loader rejects changed donor bytes instead of JSON fallback',async()=>{
 const f=fixture({text:'{}',json:true},{strict:true});await assert.rejects(f.run,/ALTERNATE_FORM_DONOR_HASH_MISMATCH/);assert.equal(f.calls.json,0);assert.equal(f.calls.loads.length,1);assert.equal(f.calls.disposed,1);
});
test('hash-bound alternate loader never silently accepts a json-only response',async()=>{
 const f=fixture({json:true},{strict:true});await assert.rejects(f.run,/text is not a function/);assert.equal(f.calls.json,0);assert.equal(f.calls.loads.length,1);assert.equal(f.calls.disposed,1);
});
