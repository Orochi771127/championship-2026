import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectBm03AlphaPoints,bm03LiftProjection,isBm03ShadowCandidate,bm03CanUseBakedPose} from '../src/championship/presentation/bm03GroundShadows.js';
const data=JSON.parse(readFileSync(new URL('../assets/production/battle/bm03-volcano-review-r2/shadows.json',import.meta.url)));
test('rare native rotations use the existing cheap fallback without a synchronous raster computation',()=>{
 assert.equal(bm03CanUseBakedPose(0),true);
 for(const angle of [Math.PI/2,-Math.PI/4,.0001,NaN])assert.equal(bm03CanUseBakedPose(angle),false);
 const source=readFileSync(new URL('../src/championship/presentation/bm03GroundShadows.js',import.meta.url),'utf8');
 assert.ok(!source.includes('getImageData'));assert.ok(!source.includes('createStamp'));
});
test('local candidate requires the selected asset, field and loopback host',()=>{
 const art={assetId:'art:battle:original-opus:v1:bm03-volcano-review-r2',field:{fieldId:'field_bm03_01'}};
 assert.equal(isBm03ShadowCandidate(art,{hostname:'127.0.0.1'}),true);
 assert.equal(isBm03ShadowCandidate(art,{hostname:'example.com'}),false);
 assert.equal(isBm03ShadowCandidate({...art,field:{fieldId:'field_bm04_01'}},{hostname:'localhost'}),false);
});
test('mirroring changes the silhouette but keeps the same sun displacement',()=>{
 const args=[[[6,-40,1],[0,-1,.25]],{offset:[0,0]},[0,0,0,0]];
 const a=projectBm03AlphaPoints(...args,1,0,[.55,.9,7],data),b=projectBm03AlphaPoints(...args,-1,0,[.55,.9,7],data);
 assert.ok(a[0].x>6);assert.ok(b[0].x>-6);assert.equal(a[0].y,b[0].y);
 assert.ok(Math.abs(a[0].x-b[0].x-12)<1e-9);assert.equal(a[1].a,.25);
});
test('jumping moves only the cast along the sun and removes contact; no centering of poses',()=>{
 assert.deepEqual(bm03LiftProjection(0,1,data),{x:0,y:0,contactAlpha:1});
 const lift=bm03LiftProjection(12,2,data);assert.ok(lift.x>0&&lift.y>0);assert.equal(lift.contactAlpha,0);
 const frame={offset:[-2,-4]},bounds=[-2,-4,2,0];
 const a=projectBm03AlphaPoints([[0,0,1]],frame,bounds,1,0,[.55,.9,7],data);
 const b=projectBm03AlphaPoints([[0,0,1]],{offset:[8,-4]},bounds,1,0,[.55,.9,7],data);
 assert.equal(b[0].x-a[0].x,10);
});
test('native rotation is applied about the actor origin, not an invented per-pose foot',()=>{
 const p=projectBm03AlphaPoints([[0,-20,1]],{offset:[0,0]},[-1,-20,1,1],1,Math.PI/2,[.55,.9,7],data)[0];
 assert.ok(p.x>20);assert.ok(p.contact);assert.ok(Math.abs(p.contact[0]-20)<1e-8);
});
test('only BM03 background changes in the candidate field table',()=>{
 const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
 const baseline=read('../assets/production/battle/original-opus-v1/manifest.json');
 const candidate=read('../assets/production/battle/bm03-volcano-review-r2/manifest.json');
 for(let i=0;i<baseline.fields.length;i++)if(i!==2)assert.deepEqual(candidate.fields[i],baseline.fields[i]);
 assert.equal(candidate.fields[2].arenaIndex,2);assert.equal(candidate.fields[2].nativeWidthPx,416);assert.equal(candidate.fields[2].worldWidthPx,1664);
});

// October static stage intake: reuse the existing shadow system with per-scene data.
test('stage review selects only the explicit local batch and preserves BM03 R2',async()=>{
 const {resolveGroundShadowCandidateRoot}=await import('../src/championship/presentation/bm03GroundShadows.js');
 const {isPrivateRepositoryPath}=await import('../scripts/lib/public-art-boundary.mjs');
 for(let i=1;i<=11;i++){
  const fieldId=`field_bm${String(i).padStart(2,'0')}_01`;
  const art={assetId:'art:battle:original-opus:v1:stage-review-20261007',field:{fieldId}};
  const root=resolveGroundShadowCandidateRoot(art,{hostname:'localhost'});
  assert.equal(root,i===3?'assets/production/battle/bm03-volcano-review-r2/':`assets/production/battle/stage-review-20261007/fields/${fieldId}/`);
  assert.equal(isPrivateRepositoryPath(root+'frame-00.png'),true);
  assert.equal(resolveGroundShadowCandidateRoot(art,{hostname:'example.com'}),null);
  assert.equal(resolveGroundShadowCandidateRoot({...art,assetId:'art:battle:original-opus:v1'},{hostname:'localhost'}),null);
 }
 assert.equal(resolveGroundShadowCandidateRoot({assetId:'art:battle:original-opus:v1:stage-review-20261007',field:{fieldId:'../field_bm01_01'}},{hostname:'localhost'}),null);
});
test('ten static candidates retain arena geometry, BM03 and native shadow pose geometry',async()=>{
 const {createHash}=await import('node:crypto');
 const {validateRuntimeMapArtBundle}=await import('../src/championship/presentation/runtimeMapArtBundle.js');
 const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
 const baseline=read('../assets/production/battle/bm03-volcano-review-r2/manifest.json');
 const candidate=validateRuntimeMapArtBundle(read('../assets/production/battle/stage-review-20261007/manifest.json'));
 assert.equal(candidate.fields.length,11);assert.deepEqual(candidate.fields[2],baseline.fields[2]);
 for(const f of candidate.fields){
  const old=baseline.fields.find(x=>x.fieldId===f.fieldId);
  for(const key of ['arenaIndex','nativeWidthPx','nativeHeightPx','worldWidthPx','worldHeightPx','gameplayBinding','collisionBinding'])assert.equal(f[key],old[key]);
  if(f.arenaIndex===2)continue;
  assert.equal(f.frames.length,1);assert.equal(f.frames[0].durationMs,null);
  const frame=readFileSync(new URL('../'+f.frames[0].src,import.meta.url));assert.equal(createHash('sha256').update(frame).digest('hex').toUpperCase(),f.frames[0].sha256);
  const base='../assets/production/battle/stage-review-20261007/fields/'+f.fieldId+'/';
  const shadow=read(base+'shadows.json');assert.equal(shadow.fieldId,f.fieldId);assert.deepEqual(shadow.frames,data.frames);assert.deepEqual(shadow.entities,data.entities);
  assert.equal(Object.keys(shadow.stamps).length,256);assert.ok(shadow.receiverPolicy.includes('DEPTH_Z0'));
  assert.equal(createHash('sha256').update(readFileSync(new URL(base+'stamps.png',import.meta.url))).digest('hex'),shadow.stampsSha256);
  const receiver=readFileSync(new URL(base+'receiver.png',import.meta.url));assert.equal(receiver.readUInt32BE(16),1664);assert.equal(receiver.readUInt32BE(20),1088);
 }
});
