import {sourceAsset,sourceHash,huntPackaging} from './helpers/packaged-hunt-art.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateRuntimeMapArtBundle,getRuntimeMapArtField} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {validateHuntDepthPieces} from '../src/championship/presentation/vs2/huntDepthOccluders.js';
import {isPrivateRepositoryPath} from '../scripts/lib/public-art-boundary.mjs';
const root='assets/production/hunt/hm234-day-review-20261007/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const bundle=validateRuntimeMapArtBundle(read('assets/production/hunt/accepted-20261010/manifest.json'));
const h1=huntPackaging.nativeBaselineManifest;
const expected=[['hm02',967,165,3,'02ae5b83e67a24d017b323c5acd8cab505fb6c8b783eec67e9de948053c58a87'],['hm03',2753,121,2,'768f1d6374c7cab90e4355e0d66a752803279f378c47261dc62d1bc595c86fff'],['hm04',3570,109,2,'a0c41ffd545c49f507763a7d8030661204614d27a37e95d5607eb5a8a359808f']];
test('final intake keeps the three exact day fields and preserves native night/animated sibling contracts',()=>{
 assert.deepEqual(bundle.fields.filter(f=>expected.some(([id])=>f.fieldId===`field_${id}_01`)).map(f=>f.fieldId),expected.map(([id])=>`field_${id}_01`));
 assert.throws(()=>getRuntimeMapArtField(bundle,'field_hm99_01'),/FIELD_UNKNOWN/);
 assert.equal(bundle.publicReleasePermitted,false);assert.equal(bundle.shippingReady,false);
 for(const fieldId of ['field_hm02_02','field_hm03_02','field_hm04_02','field_hm10_01','field_hm11_01']){
  const existing=getRuntimeMapArtField(bundle,fieldId),original=getRuntimeMapArtField(h1,fieldId);assert.ok(existing.frames.length>0);
  for(const key of ['worldWidthPx','worldHeightPx','gameplayBinding','gateMapping','collisionBinding'])assert.equal(existing[key],original[key]);
  assert.deepEqual(existing.frames.map(f=>f.durationMs),original.frames.map(f=>f.durationMs));
  if(fieldId.includes('hm10')||fieldId.includes('hm11'))assert.deepEqual(existing.frames.map(f=>f.durationMs),[217.29647047014586,200.58135735705773,200.58135735705773]);
 }
});
for(const[id,count,solids,caps,sha]of expected)test(`${id} exact delivered pixels, page order and native world binding`,()=>{
 const f=getRuntimeMapArtField(bundle,`field_${id}_01`),old=getRuntimeMapArtField(h1,f.fieldId);
 for(const key of ['worldWidthPx','worldHeightPx','gameplayBinding','gateMapping','collisionBinding'])assert.equal(f[key],old[key]);
 assert.equal(f.frames.length,1);assert.equal(f.frames[0].durationMs,null);assert.equal(sourceHash(f.frames[0]),sha);
 assert.deepEqual(f.depthOccluders.atlases.map(a=>sourceAsset(a).source.split('/').at(-1)),['occluders.png','occluders-backcap.png']);
 for(const a of [...f.frames,...f.depthOccluders.atlases,f.depthOccluders.pieces]){assert.ok(sourceAsset(a).source.startsWith(root));assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);assert.equal(isPrivateRepositoryPath(sourceAsset(a).source),true);assert.equal(isPrivateRepositoryPath(a.src),false);}
 const pieces=validateHuntDepthPieces(read(f.depthOccluders.pieces.src),2048,2048,2);
 assert.equal(pieces.length,count);assert.equal(pieces.filter(p=>p[8]).length,solids);assert.equal(pieces.filter(p=>p[7]===1&&p[8]===1).length,caps);
 if(id==='hm03')assert.equal(pieces.filter(p=>p[7]===0).length,2751);
});
