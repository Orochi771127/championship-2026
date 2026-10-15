import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {huntContactShadow,huntShadowGroundTransform} from '../src/championship/presentation/vs2/huntContactShadow.js';
import {stepNativeBindingBounce} from '../src/championship/hunt/capture/nativeWildStatus.js';
const frame=(species,cell=0,sequenceId=0,flipY=false)=>({cell,sequenceId,flipY,geometry:{blank:false,scale:4,origin:species===218?[384,512]:[112,164],sourceSize:species===218?[768,768]:[256,256]}});
test('large footprints land below both inspected soles instead of the empty midpoint',()=>{
 const s=huntContactShadow('species-218',frame(218));assert.equal(s.ellipses.length,2);
 assert.deepEqual(s.ellipses.map(e=>[e.x,e.y]),[[-44.25,2.5],[38,5]]);
 assert(s.ellipses[0].x+s.ellipses[0].radiusX<0);assert(s.ellipses[1].x-s.ellipses[1].radiusX>0);
});
test('ordinary representative derives its small footprint from its own measured soles',()=>{
 const s=huntContactShadow('species-034',frame(34));assert.deepEqual(s.ellipses.map(e=>[e.x,e.y]),[[-7,.5],[6.5,1.5]]);assert(s.ellipses.every(e=>e.radiusX<7));
});
test('walk changes horizontal contact with the measured sole while retaining ground height',()=>{
 const idle=huntContactShadow('species-218',frame(218)),walk=huntContactShadow('species-218',frame(218,5,2));
 assert.deepEqual(walk.ellipses.map(e=>e.y),idle.ellipses.map(e=>e.y));assert.deepEqual(walk.ellipses.map(e=>e.x),[-51.75,53.75]);
});
test('native binding bounce and vertical flips leave shadow on the same world plane',()=>{
 let state={amplitude:4,velocity:4},z=0;const heights=[0];while(state.amplitude){const next=stepNativeBindingBounce(state,z);state=next.bounce;z=next.zQ12;heights.push(z/2048);}
 assert(heights.some(h=>h>0));assert.equal(heights.at(-1),0);
 for(const species of [34,218])for(const flipY of [false,true])for(const height of heights){const f=frame(species,8,4,flipY),s=huntContactShadow('species-'+String(species).padStart(3,'0'),f,height),parentY=1234-height,sign=flipY?-1:1;for(const e of s.ellipses)assert.equal(parentY+sign*(s.localY+s.scaleY*e.y),1234+e.y);}
});
test('lifted poses reuse landing footprint and never use air-pose alpha bottom as ground',()=>{
 const idle=huntContactShadow('species-218',frame(218)),air=huntContactShadow('species-218',frame(218,8,4),20);assert.deepEqual(air.ellipses,idle.ellipses);
});
test('unknown species, missing native art, blank cells and changed geometry keep legacy fallback',()=>{
 assert.equal(huntContactShadow('species-099',frame(218)),null);assert.equal(huntContactShadow('species-218',null),null);
 for(const patch of [{blank:true},{scale:1},{sourceSize:[1024,1024]},{origin:[400,512]}])assert.equal(huntContactShadow('species-218',{...frame(218),geometry:{...frame(218).geometry,...patch}}),null);
});

test('generic fallback stays on the ground through both facings, lift, flip and landing',()=>{
 for(const flipX of [false,true])for(const flipY of [false,true])for(const height of [0,3,20,7,0]){
  const f={flipX,flipY},s=huntShadowGroundTransform(f,height),sign=flipY?-1:1;
  assert.equal(1234-height+sign*(s.localY+s.scaleY*4),1238);
  assert.equal(sign*s.scaleY,1);
  assert.deepEqual(f,{flipX,flipY},'shadow projection must not modify body pose');
 }
});

test('fallback without native frames uses the owner height; invalid height remains neutral',()=>{
 assert.deepEqual(huntShadowGroundTransform(null,12),{localY:12,scaleY:1});
 assert.deepEqual(huntShadowGroundTransform({flipY:true},NaN),{localY:-0,scaleY:-1});
});

const selected=JSON.parse(fs.readFileSync('src/data/championship/accepted-original-character-selection.r1.json','utf8'));
function reviewed(speciesId,sequenceId=0,frameIndex=0,flipX=false,flipY=false){
 const c=selected.characters.find(c=>c.speciesId===speciesId),runtime=JSON.parse(fs.readFileSync(selected.root+c.folder+'/runtime.review.json','utf8'));
 const raw=runtime.sides.main.animations.find(a=>a.id===sequenceId).frames[frameIndex];
 return {frame:{sequenceId,frameIndex,cell:raw.cell,flipX,flipY,geometry:runtime.reviewGeometry.frames[raw.texture]},art:{entityId:c.entityId,folder:c.folder,side:'main',sourceBankSha256:c.sourceBankSha256},config:c};
}
test('the three newly identified bodies remain pinned to the inspected approved atlas bytes',()=>{
 for(const [id,hash] of [['species-023','32b9dbbf2141a8e3fc50ced49cef1f5550ad6c11beb0059ebee67ac15545f4c0'],['species-013','25eccc707afdcc757837b0fb8aa178b2e37bc0eba16c6c3741e1e4e68af8f480'],['species-036','d125d563dc1199d1dbd93224a8c2b59c43322ccbbcb8ba6788b8fdc95b81b5ed']]){
  const {config}=reviewed(id);assert.equal(createHash('sha256').update(fs.readFileSync(selected.root+config.folder+'/main.webp')).digest('hex'),hash);
 }
});
test('Tunomon and Elecmon contact centers follow inspected paws instead of the midpoint or tail',()=>{
 const a=reviewed('species-023'),b=reviewed('species-036',0,1);
 assert.deepEqual(huntContactShadow('species-023',a.frame,0,a.art).ellipses.map(e=>[e.x,e.y]),[[-5.75,-.5],[1,-.5],[8.75,-1]]);
 const shadow=huntContactShadow('species-036',b.frame,0,b.art);
 assert.deepEqual(shadow.ellipses.map(e=>[e.x,e.y]),[[-16.75,-1],[-3,-.5],[7.25,-2],[20,-1]]);
 assert(shadow.ellipses.every(e=>e.radiusX<6));
});
test('the exact raw 13/cell23 Punimon pose uses its belly support without naming its action',()=>{
 const {frame,art}=reviewed('species-013',13);
 assert.equal(frame.cell,23);
 assert.deepEqual(huntContactShadow('species-013',frame,0,art).ellipses,[{x:-2,y:0,radiusX:9.5,radiusY:1.25}]);
 assert.notDeepEqual(huntContactShadow('species-013',{...frame,sequenceId:26},0,art).ellipses,huntContactShadow('species-013',frame,0,art).ellipses);
});
test('new contacts reject absent/wrong art identity and geometry, including baseline fallback',()=>{
 for(const id of ['species-023','species-013','species-036']){
  const {frame,art}=reviewed(id);
  assert.equal(huntContactShadow(id,frame),null);
  for(const wrong of [{...art,side:'sub'},{...art,folder:'different-art-delivery'},{...art,entityId:'m003_nyokimon'},{...art,sourceBankSha256:'0'.repeat(64)}])assert.equal(huntContactShadow(id,frame,0,wrong),null);
  for(const geometry of [{...frame.geometry,origin:[0,0]},{...frame.geometry,scale:1},{...frame.geometry,blank:true}])assert.equal(huntContactShadow(id,{...frame,geometry},0,art),null);
 }
});
test('new contacts preserve both facings and vertical flips through lift/landing and authored air poses',()=>{
 for(const id of ['species-023','species-013','species-036'])for(const flipX of [false,true])for(const flipY of [false,true])for(const height of [0,18,6,0]){
  const {frame,art}=reviewed(id,0,0,flipX,flipY),before=structuredClone(frame.geometry),s=huntContactShadow(id,frame,height,art),sign=flipY?-1:1;
  for(const e of s.ellipses)assert.equal(1000-height+sign*(s.localY+s.scaleY*e.y),1000+e.y);
  assert.deepEqual(frame.geometry,before);
 }
 const idle=reviewed('species-023'),air=reviewed('species-023',2,1);
 assert.equal(air.frame.geometry.nativeBounds[3],-2);
 assert.deepEqual(huntContactShadow('species-023',air.frame,0,air.art).ellipses,huntContactShadow('species-023',idle.frame,0,idle.art).ellipses);
});
