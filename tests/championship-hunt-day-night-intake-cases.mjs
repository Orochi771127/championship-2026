import {sourceAsset,sourceHash,huntPackaging} from './helpers/packaged-hunt-art.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {validateHuntDepthPieces} from '../src/championship/presentation/vs2/huntDepthOccluders.js';
import {isPrivateRepositoryPath} from '../scripts/lib/public-art-boundary.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const bundle=validateRuntimeMapArtBundle(read('assets/production/hunt/accepted-20261010/manifest.json'));
const expected=read('tests/fixtures/hunt-selected-contract-20261010.json');
const original=huntPackaging.nativeBaselineManifest;
const field=id=>bundle.fields.find(f=>f.fieldId===id);
const selected=expected.fields.map(row=>field(row.fieldId));
const phases=d=>d.animationFrames??[{atlases:d.atlases}];

test('final intake retains all eight source field contracts without inventing native field IDs or public acceptance',()=>{
 assert.equal(selected.length,8);assert.ok(selected.every(Boolean));
 assert.equal(new Set(selected.map(f=>f.fieldId)).size,8);
 assert.deepEqual(bundle.fields.map(f=>f.fieldId).sort(),original.fields.map(f=>f.fieldId).sort());
 assert.equal(bundle.shippingReady,false);assert.equal(bundle.publicReleasePermitted,false);
 assert.equal(bundle.runtimeScope,'LOOPBACK_ONLY');
 for(const row of expected.fields){
  const f=field(row.fieldId);
  for(const [key,value]of Object.entries(row.binding))assert.equal(f[key],value,row.fieldId+':'+key);
  assert.deepEqual(f.frames.map(v=>({sha256:sourceHash(v),durationRawTicks:v.durationRawTicks,durationMs:v.durationMs})),row.frames);
 }
 for(const id of ['field_hm06_01','field_hm10_01','field_hm11_01']){
  const f=field(id),native=original.fields.find(f=>f.fieldId===id);
  for(const key of ['worldWidthPx','worldHeightPx','gameplayBinding','gateMapping','collisionBinding'])assert.equal(f[key],native[key]);
  assert.deepEqual(f.frames.map(v=>v.durationMs),native.frames.map(v=>v.durationMs));
 }
});
test('HM01 preserves native 20/20 cadence and both phase-specific foliage and backcap pages',()=>{
 for(const f of selected.filter(f=>f.fieldId.startsWith('field_hm01'))){
  assert.deepEqual(f.frames.map(v=>v.durationRawTicks),[20,20]);
  assert.deepEqual(f.frames.map(v=>v.durationMs),[334.30226226176285,334.30226226176285]);
  const a=f.depthOccluders;assert.equal(a.animationFrames.length,2);assert.deepEqual(a.atlases,a.animationFrames[0].atlases);
  assert.equal(a.animationFrames[0].atlases.length,2);assert.equal(a.animationFrames[1].atlases.length,2);
  for(let page=0;page<2;page++)assert.notEqual(a.animationFrames[0].atlases[page].src,a.animationFrames[1].atlases[page].src);
 }
 assert.equal(sourceAsset(field('field_hm01_01').frames[0]).source,'assets/production/hunt/cave-clearance-natural-r11/frame-00.png');
});
test('actual day/night file hashes, atlas order and pieces equal the source contract; static phases remain static',()=>{
 for(const row of expected.fields){
  const f=field(row.fieldId),d=f.depthOccluders;
  // Historical source-path privacy remains protected; relocated final pieces are checked by exact bytes.
  for(const src of [...row.sourceFramePaths,row.sourcePiecesPath])assert.equal(isPrivateRepositoryPath(src),true);
  assert.equal(d.pieces.sha256,row.piecesSha256);
  assert.deepEqual(d.atlases.map(sourceHash),row.atlasHashes);
  assert.deepEqual(phases(d).map(p=>p.atlases.map(sourceHash)),row.animationAtlasHashes);
  const assets=[...f.frames,d.pieces,...phases(d).flatMap(a=>a.atlases)];
  for(const a of assets){
   assert.ok(a.src.startsWith('assets/production/')&&!a.src.includes('..'));
   assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256.toLowerCase());
  }
  validateHuntDepthPieces(read(d.pieces.src),2048,2048,d.atlases.length);
  if(!f.fieldId.startsWith('field_hm01')){
   assert.equal(f.frames.length,1);assert.equal(f.frames[0].durationMs,null);
   assert.equal(f.frames[0].durationRawTicks,null);assert.equal(phases(d).length,1);
   assert.deepEqual(phases(d)[0].atlases,d.atlases);
  }
  if(!f.fieldId.startsWith('field_hm01')&&f.fieldId.endsWith('_02')){
   const day=field(f.fieldId.replace('_02','_01'));
   assert.deepEqual(fs.readFileSync(d.pieces.src),fs.readFileSync(day.depthOccluders.pieces.src));
  }
 }
 // The immutable HM03 hashes above bind the exact sampling-R2 delivery even after path relocation.
 assert.match(expected.fields.find(f=>f.fieldId==='field_hm03_02').sourceLabel,/SAMPLING_R2/);
});
