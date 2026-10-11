import test from 'node:test';
import assert from 'node:assert/strict';
import {huntContactShadow} from '../src/championship/presentation/vs2/huntContactShadow.js';
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
