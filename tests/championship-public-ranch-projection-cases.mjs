import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {publicRanchRenderProjection} from '../scripts/lib/public-ranch-render-projection.mjs';
import {assertPublicBytes} from '../scripts/lib/public-runtime-boundary.mjs';
import {validateCompletedOriginalRuntime} from '../src/championship/presentation/completedOriginalCharacters.js';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function source(){
 const animation={id:0,name:'action_00',semanticAlias:null,playbackMode:2,playback:'forward_loop',loopStartFrame:1,
  semanticEvidence:'private-review-comment',frames:[{texture:'entity/main/cell_000',cell:0,ticks:7,millisecondsAt60Hz:117},{texture:'entity/main/cell_001',cell:1,ticks:11}]};
 return {schemaVersion:1,entityId:'entity',renderer:'PIXIJS_V8_SPRITESHEET',sourceBankSha256:'private-bank',
  artProfile:{scale:4,filter:'nearest',logicalCanvas:[96,88],anchor:{x:0.5,y:1},reviewOnly:true,runtimeEligible:false,publicReleasePermitted:false},
  timing:{tickRateHz:60,source:'private-review'},localPackagingProvenance:{ownerReplyId:'private-message'},
  sides:{main:{atlases:[{data:'main-0000000000000000.json',image:'main-0000000000000000.webp'}],animations:[animation]},sub:{atlases:[{image:'../../main.webp',data:'../../sub.json'}],animations:[animation]}},
  reviewGeometry:{frames:{'entity/main/cell_000':{blank:false,scale:4,origin:[192,352],sourceSize:[384,352],nativeBounds:[-1,-1,1,0],privateNote:'unused'}}},
  streaming:{schemaVersion:1,side:'main',texturePages:{'entity/main/cell_000':0},pages:[{data:'main-0000000000000000.json',image:'main-0000000000000000.webp',width:384,height:352,bytes:100,dataSha256:'data-hash',imageSha256:'image-hash'}],sourceRuntimeSha256:'runtime-hash',sourceImageSha256:'image-hash'}};
}
test('render projection preserves frame IDs/ticks/loop and geometry while excluding every source review field',()=>{
 const input=source(),original=JSON.stringify(input),publicDoc=publicRanchRenderProjection(input);
 assert.equal(JSON.stringify(input),original);
 const sequence=publicDoc.sides.main.animations[0];
 assert.deepEqual(sequence.frames.map(f=>[f.texture,f.cell,f.ticks]),input.sides.main.animations[0].frames.map(f=>[f.texture,f.cell,f.ticks]));
 assert.equal(sequence.loopStartFrame,1);assert.equal(sequence.playbackMode,2);
 assert.deepEqual(publicDoc.geometry.frames['entity/main/cell_000'].origin,[192,352]);
 assert.deepEqual(publicDoc.sides.sub.atlases,[]);
 assert.ok(!JSON.stringify(publicDoc).includes('private'));
 const collect=v=>{const keys=new Set();function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){keys.add(k);visit(x);}}visit(v);return [...keys];};
 assert.doesNotThrow(()=>assertPublicBytes('assets/production/public-runtime/test-render.json',Buffer.from(JSON.stringify(publicDoc)),{jsonFields:collect(publicDoc)}));
 input.localPackagingProvenance.ownerReplyId='a different private message';input.artProfile.publicReleasePermitted=true;
 assert.deepEqual(publicRanchRenderProjection(input),publicDoc);
});
test('a projected descriptor has an explicit scope and still rejects native motion, density and origin drift',()=>{
 const selection=read('src/data/championship/ranch-render-selection.v1.json').characters[0];
 const runtime=read(selection.runtimePath),config=read('src/data/championship/accepted-original-character-selection.r1.json').characters.find(c=>c.entityId===selection.entityId);
 const baseline={sides:{main:{animations:runtime.sides.main.animations},sub:{animations:runtime.sides.sub.animations}}};
 const validate=value=>validateCompletedOriginalRuntime(value,config,baseline,{publicRender:true});
 assert.doesNotThrow(()=>validate(runtime));
 assert.throws(()=>validateCompletedOriginalRuntime(runtime,config,baseline),/RENDER_SCOPE/);
 const motion=structuredClone(runtime);motion.sides.main.animations[0].frames[0].ticks++;assert.throws(()=>validate(motion),/MOTION_DRIFT/);
 const density=structuredClone(runtime);density.artProfile.scale++;assert.throws(()=>validate(density),/PROFILE_DRIFT/);
 const geometry=structuredClone(runtime);geometry.geometry.frames[runtime.sides.main.animations[0].frames[0].texture].origin[0]++;assert.throws(()=>validate(geometry),/ORIGIN_DRIFT/);
});
