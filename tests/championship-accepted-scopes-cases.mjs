import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedNumericClip,reviewedArenaClip,sampleReviewedClip} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const digest=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const report='docs/reports/accepted-character-scopes-20261101';
const selection=read('src/data/championship/reviewed-animation-selection.v1.json').characters;
for(const code of ['GR03','GR16','GR14','GR15'])test(`${code}: exact accepted scope changes, verified payloads, other animations preserved`,()=>{
 const e=selection.find(x=>x.displayCode===code),doc=read(e.path),aut=read(e.authoringPath),base=read(`${report}/baseline/${code}/public.json`);
 assert.equal(digest(e.path),e.sha256);assert.equal(digest(e.authoringPath),e.authoringSha256);
 // A later named patch (2026-11-03 walk/bound fixes) may re-bind only the clips it lists, from existing frames.
 const patched=aut.patch20261103?.replacedClips??[],changed=[...aut.acceptedScopes20261101.replacedClips,...patched],frames=new Map(doc.frames.map(f=>[f.id,f]));
 for(const c of base.clips)if(!changed.includes(c.id))assert.deepEqual(doc.clips.find(x=>x.id===c.id),c,`${code} preserved ${c.id}`);
 for(const id of patched)assert.ok(doc.clips.find(x=>x.id===id).frames.every(f=>frames.has(f.assetId)),`${code} patched ${id}`);
 for(const f of doc.frames.filter(f=>f.id.startsWith('accepted20261101_'))){
  assert.equal(digest(path.join(path.dirname(e.path),f.image)),f.sha256);
  assert.ok(!f.mirrorX,'no invented mirroring');assert.equal(f.sampling,'smooth');
  assert.ok(f.origin.every(Number.isFinite)&&f.density>0);assert.ok(!('ownArtTransform' in f),'public payload excludes authoring provenance');
 }
 if(['GR03','GR16'].includes(code))for(const d of ['D','DR','R','UR','U','UL','L','DL']){
  const clips=doc.clips.filter(c=>c.mode==='arena'&&c.action==='move'&&c.direction===d);assert.equal(clips.length,1);
  const c=reviewedArenaClip(doc,'move',d),ticks=code==='GR03'?[8,12,8,12]:[8,10,8,10];
  assert.deepEqual(c.frames.map(f=>Math.round(f.durationMs*60/1000)),ticks);
  assert.equal(c.frames[0].assetId,c.frames[2].assetId);assert.equal(new Set(c.frames.map(f=>f.assetId)).size,3);
  let t=0;for(const f of c.frames){assert.equal(sampleReviewedClip(c,t+.01).assetId,f.assetId);assert.ok(frames.has(f.assetId));t+=f.durationMs;}
 }else{
  const a=reviewedNumericClip(doc,'main',0).clip,b=reviewedNumericClip(doc,'sub',0).clip;
  assert.deepEqual(a.frames,b.frames,'Main0/Sub0 share the exact own-art events');
  assert.deepEqual(a.frames.map(f=>Math.round(f.durationMs*60/1000)),[31,22]);
  assert.equal(a.facingLocked,true);assert.equal(b.facingLocked,true);
  assert.equal(new Set(a.frames.map(f=>f.assetId)).size,2);
 }
});
test('GR16 actual acceptance receipt matches its original bytes, newer approval leaves historical warnings intact',()=>{
 const receipt=read(`${report}/GR16_OWNER_ACCEPTANCE_ORIGINAL.json`);
 assert.equal(digest(`${report}/GR16_OWNER_ACCEPTANCE_ORIGINAL.json`),'75928c15029240e8aeeb5631e73ff8fe019df782062bc1a846823e3967125896');
 assert.equal(receipt.ownerApproved,true);assert.equal(receipt.runtimeVerified,null);
 assert.equal(receipt.exactManifestSha256,'e171e2492201f3cf1307dd422c2e6a5cc92abe53a6a60c378d5141332f51402c');
});
