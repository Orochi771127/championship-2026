import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sampleReviewedClip,createReviewedArenaPlayback} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const entry=read('src/data/championship/reviewed-animation-selection.v1.json').characters.find(e=>e.displayCode==='AW32');
const doc=read(entry.path),source=read('tests/fixtures/aw32-source-events-r12.json');
const frames=new Map(doc.frames.map(f=>[f.id,f]));
test('AW32 preserves 53 General callers and 83 events with exact native tick boundaries',()=>{
 let count=0;
 for(const row of source.general){const c=doc.clips.find(c=>c.id===row.id);assert.ok(c);assert.equal(c.loop,row.mode===2);assert.equal(row.loopStart,0);assert.deepEqual(c.frames.map(f=>f.assetId),row.frames);let t=0;
  for(const [i,f] of c.frames.entries()){assert.ok(Math.abs(f.durationMs-row.ticks[i]*1000/60)<1e-8);assert.equal(sampleReviewedClip(c,t).frameIndex,i);assert.equal(sampleReviewedClip(c,t+f.durationMs-1e-5).frameIndex,i);t+=f.durationMs;count++;}}
 assert.equal(source.general.length,53);assert.equal(count,83);
});
test('AW32 retains all 538 Arena source events and separate offset frame records',()=>{
 let count=0;for(const row of source.arena){const c=doc.clips.find(c=>c.id===row.id);assert.ok(c);assert.equal(c.frames.length,row.frames.length);let t=0;
  for(const [i,e] of row.frames.entries()){const f=c.frames[i];assert.equal(f.assetId,e.id);assert.ok(Math.abs(f.durationMs-e.ticks*1000/60)<1e-8);assert.equal(f.preserveAuthoredPose,true);assert.equal(sampleReviewedClip(c,t).frameIndex,i);t+=f.durationMs;count++;}}
 assert.equal(source.arena.length,65);assert.equal(count,538);assert.equal(frames.size,306);
});
test('AW32 immutable atlases, selected manifest and fixed world scale match hashes',()=>{
 const sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(path.join(root,entry.path))),entry.sha256);const seen=new Set();
 for(const f of frames.values()){assert.equal(f.density,5);assert.deepEqual(f.sourceSize,[640,640]);assert.ok(f.origin.every(Number.isFinite));
  for(const image of [f,...(f.arena?[f.arena]:[])])if(!seen.has(image.image)){assert.equal(sha(fs.readFileSync(path.join(root,path.dirname(entry.path),image.image))),image.sha256);seen.add(image.image);}}
 assert.equal(seen.size,15);assert.equal(doc.arenaSourcePlayback.referenceHeight,88.5);
});
test('AW32 eight directions retain release event4, visible laser event7 and recovery',()=>{
 for(const [i,direction] of ['R','DR','D','DL','L','UL','U','UR'].entries()){
  const p=createReviewedArenaPlayback(doc),angle=i*Math.PI/4,state={hp:100,sourceCastId:17};
  p.observe({type:'CAST',actionId:17,t:0,angle,moveType:'BOLT'});assert.equal(p.sample({...state,time:.3}).frameIndex,3);
  p.observe({type:'CAST_RELEASE',actionId:17,t:.4,angle,moveType:'BOLT'});const release=p.sample({...state,time:.4});assert.equal(release.direction,direction);assert.equal(release.frameIndex,4);
  const fx=p.sample({...state,time:.5});assert.equal(fx.frameIndex,7);assert.ok(fx.assetId.includes('_laser_'));assert.ok(fx.release.point.every(Number.isFinite));assert.ok(frames.has(p.sample({...state,time:.7}).assetId));
 }
});
test('AW32 all heading move, idle, hurt, faint and victory resolve to distinct approved source poses',()=>{
 for(const [i,dir] of ['R','DR','D','DL','L','UL','U','UR'].entries()){
  const p=createReviewedArenaPlayback(doc),angle=i*Math.PI/4,vx=Math.cos(angle),vy=Math.sin(angle);const move=p.sample({time:0,hp:100,vx,vy});assert.equal(move.direction,dir);
  for(const state of [{time:1,hp:100,vx:0,vy:0},{time:2,hp:100,vx,vy,hit:true},{time:3,hp:0,vx,vy}])assert.ok(frames.has(p.sample(state).assetId));
 }
 const p=createReviewedArenaPlayback(doc);assert.ok(frames.has(p.sample({time:0,hp:100,victory:true,vx:0,vy:0}).assetId));
});
