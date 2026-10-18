import test from 'node:test';import assert from 'node:assert/strict';
import {harborActorLife,harborMechanismFrame} from '../src/championship/presentation/dataArena/dataArenaHarborLife.js';
const input=Object.freeze({sequence:0,deltaMS:16,idleMS:3800,elapsedMS:3800,facing:1,speed:0});
test('two approved roles have distinct existing idle cadence and non-synchronized looks',()=>{
 const a=harborActorLife({...input,role:'PLAYER'}),b=harborActorLife({...input,role:'MATE'});
 assert.notEqual(a.deltaMS,b.deltaMS);assert.equal(a.facing,-1);assert.equal(b.facing,1);
 assert.equal(input.facing,1);assert.equal(input.deltaMS,16);
});
test('walking uses real movement speed; combat sequence clocks and facing remain exact',()=>{
 for(const role of ['PLAYER','MATE']){
  const walk=harborActorLife({...input,role,sequence:2,speed:220});assert.ok(walk.deltaMS>0);assert.equal(walk.facing,1);
  for(const sequence of [6,7,15,33]){const r=harborActorLife({...input,role,sequence});assert.equal(r.deltaMS,16);assert.equal(r.facing,1);}
 }
});
test('quiet mode freezes decorative idle/look but preserves essential walk and combat',()=>{
 for(const sequence of [0,2,7]){const r=harborActorLife({...input,role:'MATE',sequence,quiet:true});assert.equal(r.deltaMS,sequence===0?0:16);assert.equal(r.facing,1);}
});
test('contact widths remain bounded across a minute; gantries rest and quiet mode freezes',()=>{
 const frames=[new Set(),new Set(),new Set()];
 for(let ms=0;ms<60000;ms+=100){
  const r=harborActorLife({...input,role:'PLAYER',sequence:2,elapsedMS:ms,speed:250});assert.ok(r.shadowWidth>=50&&r.shadowWidth<=54);assert.ok(r.shadowHeight>10&&r.shadowHeight<12);
  for(let index=0;index<3;index++){const args={elapsed:ms/1000,index,frameCount:24,frameDurationMs:100};const frame=harborMechanismFrame(args);assert.ok(frame>=0&&frame<24);frames[index].add(frame);assert.equal(harborMechanismFrame({...args,quiet:true}),0);}
 }
 assert.ok(frames.every(s=>s.size===24));assert.notEqual(harborMechanismFrame({elapsed:1,index:0,frameCount:24,frameDurationMs:100}),harborMechanismFrame({elapsed:1,index:1,frameCount:24,frameDurationMs:100}));
});
