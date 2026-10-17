import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {selectedMapProjections,publicMapProjection} from '../scripts/lib/public-map-projection.mjs';
import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {fetchRuntimeMapResponse,publicMapManifestPath} from '../src/championship/presentation/publicMapRequests.js';
import {finalHuntArtManifestUrl} from '../src/championship/presentation/finalHuntArt20261008.js';
import {huntGateThumbnail} from '../src/championship/presentation/huntMobileReadouts.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const recipe=read('docs/contracts/championship/PUBLIC_MAP_RENDER_SOURCES.v1.json');
const maps=selectedMapProjections({root:process.cwd(),input});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('map exports preserve every frame, clock, footprint, native pixel scale and occlusion reference',()=>{
 assert.equal(maps.descriptors.length,4);assert.equal(maps.files.size,206);
 for(const descriptor of maps.descriptors){
  const source=read(recipe.sources.find(row=>row.role===descriptor.role).path);
  const before=validateRuntimeMapArtBundle(source),after=validateRuntimeMapArtBundle(descriptor.value);
  assert.ok(fs.readFileSync(descriptor.path).equals(descriptor.bytes));
  assert.equal(before.family,after.family);assert.equal(before.memoryPolicy,after.memoryPolicy);
  assert.deepEqual(after.fields.map(f=>f.fieldId),before.fields.map(f=>f.fieldId));
  for(let i=0;i<before.fields.length;i++){
   const a=before.fields[i],b=after.fields[i];
   for(const key of ['worldWidthPx','worldHeightPx','nativeWidthPx','nativeHeightPx','nativePixelWorldScale','visualRole','gameplayBinding','gateMapping','collisionBinding','visualPaddingNative','rasterPixelsPerNative'])assert.deepEqual(b[key],a[key],key);
   assert.deepEqual(b.frames,a.frames.map(({src,sha256,durationMs,rasterWidthPx,rasterHeightPx})=>Object.fromEntries(Object.entries({src,sha256:sha256.toLowerCase(),durationMs,rasterWidthPx,rasterHeightPx}).filter(([,v])=>v!==undefined))));
   if(a.depthOccluders){
    for(const key of ['pieceCount','bandNativePx','pieces','atlases','animationFrames'])assert.deepEqual(b.depthOccluders[key],a.depthOccluders[key]);
   }
  }
 }
});

test('public map format excludes private source evidence and refuses unknown metadata without changing the source',()=>{
 for(const {value,bytes} of maps.descriptors){
  assert.doesNotMatch(bytes.toString(),/"(?:rights|localOnly|productionStatus|source|intakeProvenance|publicPackagingProvenance|durationEvidence|durationRawTicks)"|libfile_|Sentinel_/);
  assert.throws(()=>validateRuntimeMapArtBundle({...value,localOnly:true}),/PUBLIC_MAP_UNRECOGNIZED_FIELD/);
  const changed=structuredClone(value);changed.fields[0].source={archive:'private'};
  assert.throws(()=>validateRuntimeMapArtBundle(changed),/PUBLIC_MAP_UNRECOGNIZED_FIELD/);
 }
 for(const row of recipe.sources){assert.equal(sha(fs.readFileSync(row.path)),row.sha256);assert.ok(!input.files.includes(row.path));}
 assert.ok(!input.files.includes('assets/production/hunt/licensed-runtime-v1/manifest.json'));
 assert.equal(sha(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json')),'3e7b7694a88c3b7d75e444b1e04bb769923480bfeecb2df19e68005c6b6eb87f');
});

test('map exports require existing media hash approvals, including all final cages and night fields',()=>{
 const copy=structuredClone(input),first=maps.files.keys().next().value;
 copy.publicPlaytest.files=copy.publicPlaytest.files.filter(row=>row.path!==first);
 assert.throws(()=>selectedMapProjections({root:process.cwd(),input:copy}),/PUBLIC_MAP_MEDIA_NOT_APPROVED/);
 assert.equal(maps.descriptors.find(row=>row.role==='cage-final').value.fields.length,37);
 assert.equal(maps.descriptors.find(row=>row.role==='hunt-night').value.fields[0].fieldId,'field_hm10_01');
});

test('normal Hunt uses approved selection, the night variant remains explicit, and all Gate identities stay fixed',()=>{
 const publicUrl=new URL('https://orochi771127.github.io/championship-2026/');
 assert.equal(finalHuntArtManifestUrl('field_hm10_01',17,publicUrl),publicMapManifestPath('hunt-night'));
 assert.equal(finalHuntArtManifestUrl('field_hm10_01',16,publicUrl),publicMapManifestPath('hunt-accepted'));
 for(const gate of listChampionshipGates()){
  const thumbnail=huntGateThumbnail(gate,publicUrl);
  assert.equal(thumbnail.fieldId,gate.originalFields.dayFieldId);
  assert.ok(maps.files.has(thumbnail.src));
 }
 assert.equal(finalHuntArtManifestUrl('field_hm01_01',1,new URL('http://localhost/?industrialReview=r1')),null);
});

test('runtime map request validates selected hash and refuses raw metadata on a public URL',async()=>{
 const descriptor=maps.descriptors[0],base='https://orochi771127.github.io/championship-2026/';let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,status:200,text:async()=>descriptor.bytes.toString()};};
 const response=await fetchRuntimeMapResponse(descriptor.path,base,{fetchImpl});assert.deepEqual(await response.json(),descriptor.value);assert.equal(calls,1);
 await assert.rejects(()=>fetchRuntimeMapResponse(descriptor.path,base,{fetchImpl:async()=>({ok:true,status:200,text:async()=>'{"fields":[]}'})}),/PUBLIC_MAP_RUNTIME_HASH/);
 await assert.rejects(()=>fetchRuntimeMapResponse(recipe.sources[0].path,base,{fetchImpl}),/PRIVATE_MAP_METADATA_NOT_A_PUBLIC_RUNTIME_INPUT/);assert.equal(calls,1);
});

test('237 runtime derivative paths are reproducible from exact local Git blobs without network or changed approvals',()=>{
 const result=JSON.parse(execFileSync(process.execPath,['scripts/materialize-approved-runtime.mjs','--check'],{encoding:'utf8',windowsHide:true}));
 assert.equal(result.checked,237);assert.equal(result.restored,0);assert.equal(result.bytes,2028339);assert.equal(result.networkUsed,false);assert.equal(result.approvalsChanged,false);
});
