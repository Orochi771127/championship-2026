import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {getReviewedRaisingContactShadow as contact} from '../src/championship/presentation/intRh2/raisingContactShadow.js';
import {huntContactShadow} from '../src/championship/presentation/vs2/huntContactShadow.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const selection=read('src/data/championship/accepted-original-character-selection.r1.json');
function fixture(id,sequenceId=0,frameIndex=0){
 const config=selection.characters.find(c=>c.speciesId===id),runtime=read(selection.root+config.folder+'/runtime.review.json');
 const source=runtime.sides.main.animations.find(a=>a.id===sequenceId).frames[frameIndex];
 return {runtime,frame:{sequenceId,frameIndex,cell:source.cell,geometry:runtime.reviewGeometry.frames[source.texture]},
  art:{entityId:config.entityId,folder:config.folder,sourceBankSha256:config.sourceBankSha256,side:'main'}};
}
test('Tunomon authored air cell keeps reviewed ground contact rather than chasing alpha bottom',()=>{
 const idle=fixture('species-023'),air=fixture('species-023',2,1);
 assert.equal(air.frame.cell,5);
 assert.equal(idle.frame.geometry.nativeBounds[3]+1,1);
 assert.equal(air.frame.geometry.nativeBounds[3]+1,-1,'old Raising shadow moved upward with the air pose');
 assert.deepEqual(contact('species-023',air.frame,air.art),contact('species-023',idle.frame,idle.art));
 assert.deepEqual(contact('species-023',air.frame,air.art).map(e=>e.y),[-.25,-.25,-.5]);
});
test('Punimon exact sequence13 cell23 retains its independently reviewed belly support',()=>{
 const {frame,art}=fixture('species-013',13);
 assert.equal(frame.cell,23);
 assert.deepEqual(contact('championship:creature:species-013',frame,art),[{x:-1,y:0,radiusX:4.75,radiusY:.625}]);
 assert.notDeepEqual(contact('species-013',frame,art,10),contact('species-013',frame,art,0));
});
test('mirrored Elecmon contact moves with facing, not tail alpha bbox',()=>{
 const {frame,art}=fixture('species-036',0,1);
 const normal=contact('species-036',frame,art),flipped=contact('species-036',frame,art,0,true);
 assert.equal(normal.length,4);
 for(let i=0;i<normal.length;i++)assert.deepEqual(flipped[i],{...normal[i],x:-normal[i].x});
});
test('all registered poses of the three deliveries preserve existing Hunt profile decisions at half scale',()=>{
 for(const id of ['species-023','species-013','species-036']){
  const {runtime,art}=fixture(id);
  for(const sequence of runtime.sides.main.animations)for(const raw of sequence.frames){
   const frame={sequenceId:sequence.id,cell:raw.cell,geometry:runtime.reviewGeometry.frames[raw.texture]};
   const before=structuredClone(frame);
   for(const lift of [0,3,10,0])for(const flipX of [false,true]){
    const h=huntContactShadow(id,frame,lift,art),r=contact(id,frame,art,lift,flipX);
    assert.deepEqual(r,h?.ellipses.map(e=>({x:e.x/2*(flipX?-1:1),y:e.y/2,radiusX:e.radiusX/2,radiusY:e.radiusY/2}))??null);
   }
   assert.deepEqual(frame,before);
  }
 }
});
test('missing identity, changed delivery, sub art, blank and changed geometry never gain contact',()=>{
 for(const id of ['species-023','species-013','species-036']){
  const {frame,art}=fixture(id);
  for(const invalid of [null,{...art,side:'sub'},{...art,folder:'other'},{...art,sourceBankSha256:'bad'},{...art,entityId:'other'}])assert.equal(contact(id,frame,invalid),null);
  for(const patch of [{blank:true},{scale:1},{origin:[0,0]},{sourceSize:[512,512]}])assert.equal(contact(id,{...frame,geometry:{...frame.geometry,...patch}},art),null);
 }
});
test('unknown species, legacy profiles and eggs are unchanged',()=>{
 const {frame,art}=fixture('species-023');
 for(const id of ['species-034','species-218','species-099','species-000',null])assert.equal(contact(id,frame,art),null);
});
const source=fs.readFileSync(new URL('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',import.meta.url),'utf8');
test('actual Raising decorator draws all reviewed contacts while preserving UI bounds',()=>{
 const body=source.slice(source.indexOf('  function decorateActor('),source.indexOf('  function playReaction('));
 const ctx={PIXI:{Rectangle:class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}}};
 vm.createContext(ctx);vm.runInContext(body+';globalThis.decorate=decorateActor;',ctx);
 const calls=[];const graphic={clear(){return this},ellipse(...a){calls.push(a);return this},fill(){return this},stroke(){return this}};
 const entry={shadow:graphic,selection:{...graphic,ellipse(){return this}},root:{}};
 const {frame,art}=fixture('species-023');const ellipses=contact('species-023',frame,art);
 const geometry={visible:{x:-10,y:-15,width:20,height:15},hitArea:{x:-12,y:-17,width:24,height:19},reviewedContactShadow:ellipses};
 ctx.decorate(entry,geometry);
 assert.deepEqual(calls,ellipses.map(e=>[e.x,e.y,e.radiusX,e.radiusY]));
 assert.deepEqual({...entry.root.hitArea},geometry.hitArea);
});
test('sync and async art paths forward the guard and current lift precedes contact sampling',()=>{
 assert.equal((source.match(/entry\.contactShadowArt\s*=\s*actor\.contactShadowArt/g)||[]).length,2);
 const update=source.slice(source.indexOf('const visualFrame=entry.nativeFramePresenter.apply(frame)'));
 assert(update.indexOf('entry.visualLift=')<update.indexOf('actorGeometry(entry,visualFrame'));
 assert(source.includes('geometry.contactShadow=getRaisingEggContactShadow'));
});
