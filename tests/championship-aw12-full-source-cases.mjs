import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sampleReviewedClip,reviewedNumericClip,reviewedArenaClip,createReviewedArenaPlayback} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const entry=read('src/data/championship/reviewed-animation-selection.v1.json').characters.find(e=>e.displayCode==='AW12');
const doc=read(entry.path),frames=new Map(doc.frames.map(f=>[f.id,f]));
const source=read('tests/fixtures/aw12-source-events-r6.json');
const directions={Down:'D',DownRight:'DR',Right:'R',UpRight:'UR',Up:'U',UpLeft:'UL',Left:'L',DownLeft:'DL'};
const actions={walk:'move',attack:'melee',shoot:'ranged',special:'special',idle:'idle',hurt:'hurt',faint:'faint',charge:'charge',sleep:'sleep'};
test('AW12 53 General callers retain 83 ordered source events, modes and tick boundaries',()=>{
 let count=0;
 for(const r of source.general){
  const [side,id]=r.id.split(':'),c=reviewedNumericClip(doc,side,+id)?.clip;assert.ok(c,r.id);
  assert.equal(c.loop,r.mode===2);assert.equal(r.loopStart,0);
  assert.deepEqual(c.frames.map(f=>f.assetId),'poses' in r?r.poses.map(p=>'aw12-r6-'+p):[]);
  let ms=0;
  for(const [i,f] of c.frames.entries()){
   assert.ok(Math.abs(f.durationMs-r.ticks[i]*1000/60)<1e-8);assert.equal(sampleReviewedClip(c,ms).frameIndex,i);
   assert.equal(sampleReviewedClip(c,ms+f.durationMs-1e-5).frameIndex,i);ms+=f.durationMs;count++;
  }
 }
 assert.equal(count,83);assert.equal(source.general.length,53);
});
test('AW12 506 Arena events keep every repeated pivot and original tick duration',()=>{
 for(const e of source.arena){
  const [action,direction,index]=e.id.split('/'),c=reviewedArenaClip(doc,actions[action],directions[direction]);assert.ok(c,e.id);
  const f=c.frames[+index];assert.equal(f.assetId,'aw12-r6-'+e.pose);
  assert.ok(Math.abs(f.durationMs-e.ticks*1000/60)<1e-8);
  assert.deepEqual(f.offset??[0,0],e.delta.map(x=>x*7.6));assert.equal(f.preserveAuthoredPose,true);
 }
 assert.equal(source.arena.length,506);
});
test('AW12 selected manifest and every referenced atlas match pinned SHA with one uniform density',()=>{
 const sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(path.join(root,entry.path))),entry.sha256);
 const checked=new Set();
 for(const f of frames.values()){
  assert.equal(f.density,7.6);assert.deepEqual(f.sourceSize,[480,480]);assert.ok(f.origin.every(Number.isFinite));
  for(const image of [f,...(f.arena?[f.arena]:[])])if(!checked.has(image.image)){
   checked.add(image.image);assert.equal(sha(fs.readFileSync(path.join(root,path.dirname(entry.path),image.image))),image.sha256);
  }
 }
 assert.equal(checked.size,5);assert.equal(frames.size,109);
 assert.equal(doc.arenaSourcePlayback.referenceHeight,200/7.6);
 assert.equal(frames.get('aw12-r6-BLANK').blank,true);assert.notEqual(frames.get('aw12-r6-P35').blank,true);
});
test('AW12 all eight move/idle/hurt/faint directions and win resolve without missing art',()=>{
 const vectors={D:[0,1],DR:[1,1],R:[1,0],UR:[1,-1],U:[0,-1],UL:[-1,-1],L:[-1,0],DL:[-1,1]};
 for(const [d,[vx,vy]] of Object.entries(vectors)){
  const p=createReviewedArenaPlayback(doc);const s=p.sample({time:0,hp:100,vx,vy});assert.equal(s.direction,d);assert.ok(frames.has(s.assetId));
  assert.ok(frames.has(p.sample({time:1,hp:100,vx,vy,hit:true}).assetId));
  assert.ok(frames.has(p.sample({time:2,hp:0,vx,vy}).assetId));
 }
 const p=createReviewedArenaPlayback(doc);assert.ok(frames.has(p.sample({time:0,hp:100,vx:0,vy:0,victory:true}).assetId));
});


test('AW12 authored attack pose aligns with the existing simulation release without changing its clock',()=>{
 const vectors={D:[0,1],DR:[1,1],R:[1,0],UR:[1,-1],U:[0,-1],UL:[-1,-1],L:[-1,0],DL:[-1,1]};
 for(const [direction,[vx,vy]] of Object.entries(vectors))for(const moveType of ['LUNGE','PROJECTILE']){
  const p=createReviewedArenaPlayback(doc),angle=Math.atan2(vy,vx),state={hp:100,vx:0,vy:0,angle,castId:1,sourceCastId:1};
  p.observe({type:'CAST',actionId:1,t:0,angle,moveType,moveId:'test'});
  const wind=p.sample({...state,time:.1});assert.equal(wind.phase,'WINDUP');assert.ok(wind.frameIndex<4);
  p.observe({type:'CAST_RELEASE',actionId:1,t:.3,angle,moveType,moveId:'test'});
  const release=p.sample({...state,time:.3});assert.equal(release.direction,direction);assert.equal(release.frameIndex,4);assert.equal(release.phase,'RELEASE');
  assert.ok(release.release.point.every(Number.isFinite));
  const contacts=moveType==='LUNGE'?{D:[245,318],DR:[335,310],R:[385,241],UR:[332,164],U:[246,95],UL:[138,100],L:[87,219],DL:[142,307]}:{D:[240,243],DR:[366,282],R:[372,250],UR:[369,199],U:[240,180],UL:[118,175],L:[112,213],DL:[120,255]};
  assert.deepEqual(release.release.point.map((v,i)=>v+frames.get(release.assetId).origin[i]),contacts[direction]);
 }
});
