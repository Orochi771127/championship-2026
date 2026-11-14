import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sampleReviewedClip,createReviewedArenaPlayback} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const entry=read('src/data/championship/reviewed-animation-selection.v1.json').characters.find(e=>e.displayCode==='AW14');
const doc=read(entry.path),source=read('tests/fixtures/aw14-source-events-r1.json');
const frames=new Map(doc.frames.map(f=>[f.id,f]));
test('AW14 preserves 53 General callers and 83 events with exact native tick boundaries',()=>{
 let count=0;
 for(const row of source.general){const c=doc.clips.find(c=>c.id===row.id);assert.ok(c);assert.equal(c.loop,row.mode===2);assert.equal(row.loopStart,0);assert.deepEqual(c.frames.map(f=>f.assetId),row.frames);let t=0;
  for(const [i,f] of c.frames.entries()){assert.ok(Math.abs(f.durationMs-row.ticks[i]*1000/60)<1e-8);assert.equal(sampleReviewedClip(c,t).frameIndex,i);assert.equal(sampleReviewedClip(c,t+f.durationMs-1e-5).frameIndex,i);t+=f.durationMs;count++;}}
 assert.equal(source.general.length,53);assert.equal(count,83);
});
test('AW14 retains all 482 Arena source events and separate offset frame records',()=>{
 let count=0;for(const row of source.arena){const c=doc.clips.find(c=>c.id===row.id);assert.ok(c);assert.equal(c.frames.length,row.frames.length);let t=0;
  for(const [i,e] of row.frames.entries()){const f=c.frames[i];assert.equal(f.assetId,e.id);assert.ok(Math.abs(f.durationMs-e.ticks*1000/60)<1e-8);assert.equal(f.preserveAuthoredPose,true);assert.equal(sampleReviewedClip(c,t).frameIndex,i);t+=f.durationMs;count++;}}
 assert.equal(source.arena.length,65);assert.equal(count,482);assert.equal(frames.size,102);
});
test('AW14 immutable atlases, selected manifest and fixed world scale match hashes',()=>{
 const sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(path.join(root,entry.path))),entry.sha256);const seen=new Set();
 for(const f of frames.values()){assert.equal(f.density,7);assert.deepEqual(f.sourceSize,[400,400]);assert.ok(f.origin.every(Number.isFinite));
  for(const image of [f,...(f.arena?[f.arena]:[])])if(!seen.has(image.image)){assert.equal(sha(fs.readFileSync(path.join(root,path.dirname(entry.path),image.image))),image.sha256);seen.add(image.image);}}
 assert.equal(seen.size,4);assert.equal(doc.arenaSourcePlayback.referenceHeight,220/7);
});
test('AW14 eight directions align native melee hit5 and ranged hit2 to simulation release',()=>{
 for(const [i,direction] of ['R','DR','D','DL','L','UL','U','UR'].entries())for(const [moveType,index] of [['MELEE',5],['BOLT',2]]){
  const p=createReviewedArenaPlayback(doc),angle=i*Math.PI/4,state={hp:100,sourceCastId:17};
  p.observe({type:'CAST',actionId:17,t:0,angle,moveType});assert.equal(p.sample({...state,time:.3}).frameIndex,index-1);
  p.observe({type:'CAST_RELEASE',actionId:17,t:.4,angle,moveType});const release=p.sample({...state,time:.4});assert.equal(release.direction,direction);assert.equal(release.frameIndex,index);assert.ok(release.release.point.every(Number.isFinite));
  assert.ok(frames.has(p.sample({...state,time:.7}).assetId));
 }
});
test('AW14 all heading move, idle, hurt, faint and victory resolve to distinct approved source poses',()=>{
 for(const [i,dir] of ['R','DR','D','DL','L','UL','U','UR'].entries()){
  const p=createReviewedArenaPlayback(doc),angle=i*Math.PI/4,vx=Math.cos(angle),vy=Math.sin(angle);const move=p.sample({time:0,hp:100,vx,vy});assert.equal(move.direction,dir);
  for(const state of [{time:1,hp:100,vx:0,vy:0},{time:2,hp:100,vx,vy,hit:true},{time:3,hp:0,vx,vy}])assert.ok(frames.has(p.sample(state).assetId));
 }
 const p=createReviewedArenaPlayback(doc);assert.ok(frames.has(p.sample({time:0,hp:100,victory:true,vx:0,vy:0}).assetId));
});
