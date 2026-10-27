import fs from 'node:fs';import * as grid from '../src/championship/cage/productRanchGrid.js';import {getCageDefinitionByModuleId} from '../src/championship/cage/cageCatalog.js';import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';import {connectRanchGround} from '../src/championship/cage/ranchConnections.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));const decode=f=>({...f,cells:f.runs.flatMap(([n,...v])=>Array.from({length:n},()=>v)),clearance:f.clearanceRuns.flatMap(([n,v])=>Array(n).fill(v))});
const fields=read('../src/data/championship/catalogs/raising-ground.r1.json').fields.map(decode),modelContactGround=new Map(read('../src/data/championship/catalogs/ranch-three-ground.r1.json').fields.map(f=>[f.definitionIndex,decode(f)])),selectedSportsGround=new Map(read('../src/data/championship/catalogs/ranch-sports-ground.r1.json').fields.map(f=>[f.definitionIndex,decode(f)]));
const text=fs.readFileSync(new URL('../src/championship/raising/nativeRaisingRanchRing.js',import.meta.url),'utf8');const body=text.slice(text.indexOf('export function composeProductRanchGround'),text.indexOf('\nfunction productRaisingSpawnPosition')).replace('export function','function');const dependencies={...grid,getCageDefinitionByModuleId,ORIGINAL_CAGE_DEFINITION_SHAPES,connectRanchGround,fields,modelContactGround,selectedSportsGround,reviewGroundField:()=>null};const compose=Function(...Object.keys(dependencies),body+';return composeProductRanchGround')(...Object.values(dependencies));

import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {getCageDefinition} from '../src/championship/cage/cageCatalog.js';
import {createProductGridArtPlan} from '../src/championship/presentation/raisingRanchArtPlan.js';
import {selectRanchCageArt} from '../src/championship/presentation/ranchCageArtSelection.js';
import {readRaisingGroundSupport} from '../src/championship/app/raisingGroundSupport.js';
import {resolveRanchSupportOwner} from '../src/championship/presentation/ranchSupportOwner.js';




import * as H from '../src/championship/presentation/ranchContactHeight.js';import * as S from '../src/championship/presentation/ranchPhysicalSupport.js';import {createRanchSupportOwnerResolver}from'../src/championship/presentation/ranchSupportOwner.js';
const source=fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js',import.meta.url),'utf8'),contactBody=source.slice(source.indexOf('  function updateContactTriangles('),source.indexOf('  function legacyGroundHeight(')),pickBody=source.slice(source.indexOf('  function pickGroundNative('),source.indexOf('  return {render,dispose'));
const supportFields=await S.loadSupportMetadata(fs.readFileSync(new URL('../assets/production/cage/three-20261021/physical-ground-tops.r2.json',import.meta.url),'utf8')),logicalBridges=await H.loadLogicalBridges(fs.readFileSync(new URL('../assets/production/cage/three-20261021/logical-stair-bridges.r1.json',import.meta.url),'utf8'),supportFields);
const E=52*Math.PI/180,lift=16*Math.cos(E),direction={x:Math.cos(E)/Math.SQRT2,y:Math.sin(E),z:Math.cos(E)/Math.SQRT2},ranchNativeToWorld=(x,y,h=0)=>({x:(x+y/Math.sin(E))/(16*Math.SQRT2),y:h,z:(-x+y/Math.sin(E))/(16*Math.SQRT2)});
// Hex cage world (2026-10-26): the captured evidence below is in the old 10×10 board frame
// (960 px wrap). The ground is now composed in the hex world, where that board lands
// 7 columns / 8 rows in; this adapter reads the real world ground and reports it in the
// captured frame, so every height/pick assertion still runs against production ground.
const LEGACY_OFFSET=[7*96,8*88],LEGACY_WRAP=960,legacySlotOf=new Map(Array.from({length:100},(_,i)=>[grid.legacyGrid100SlotToWorld(i),i]));
const worldLayout=layout=>layout.map(p=>({...p,slotIndex:grid.legacyGrid100SlotToWorld(p.slotIndex)}));
// A whole-tile window onto the world ground (offsets are tile multiples), so the captured
// fractional points are classified by the same 8 px tile they were captured on.
const LEGACY_TILE=[LEGACY_OFFSET[0]/8,LEGACY_OFFSET[1]/8];
const legacyGroundView=ground=>{
 const width=LEGACY_WRAP/8,height=110,component=new Int32Array(width*height);
 for(let ty=0;ty<height;ty++)for(let tx=0;tx<width;tx++)component[ty*width+tx]=ground.navigation.component[(ty+LEGACY_TILE[1])*ground.width+tx+LEGACY_TILE[0]];
 const cageAt=(x,y)=>{const cage=Number.isFinite(x)&&Number.isFinite(y)?ground.cageAt((Math.floor(x/8)+LEGACY_TILE[0])*8,(Math.floor(y/8)+LEGACY_TILE[1])*8):null;
  return cage&&{...cage,slotIndex:legacySlotOf.get(cage.slotIndex)};};
 return {layoutVersion:ground.layoutVersion,pixelWidth:LEGACY_WRAP,pixelHeight:height*8,width,height,navigation:{component},cageAt,
  readTerrain:(tx,ty)=>ground.readTerrain(tx+LEGACY_TILE[0],ty+LEGACY_TILE[1]),
  origin:id=>{const o=ground.origin(id);return o&&[o[0]-LEGACY_OFFSET[0],o[1]-LEGACY_OFFSET[1],...o.slice(2)];}};
};
const legacyAdmission=ground=>{const view=legacyGroundView(ground);return (x,y)=>readRaisingGroundSupport(view,x,y);};

const evidence=read('./fixtures/ranch-v4/captured-inverse.json'),plans=read('./fixtures/ranch-v4/wrap-plan.json'),oldSource=fs.readFileSync(new URL('./fixtures/ranch-v4/historical-v2-snippets.txt',import.meta.url),'utf8');let checks=0;const results=[];
const oldContact=oldSource.slice(oldSource.indexOf('  function updateContactTriangles('),oldSource.indexOf('  function legacyGroundHeight(')),oldPick=oldSource.slice(oldSource.indexOf('  function pickGroundNative('),oldSource.indexOf('  return {render,dispose'));
for(const record of evidence.results){
 const c=plans.cases.find(c=>c.id==='point-wrap-'+record.fieldId),q=c.expectedQuery,spec=supportFields.get(record.fieldId),ground=compose({placements:worldLayout(record.preparation.layout),unlockedSlots:Array.from({length:100},(_,i)=>i)}),placement=record.preparation.placement;
 const p={ownerIndex:q.rendererOwnerIndex,instanceId:placement.instanceId,moduleId:placement.moduleId,slotIndex:placement.slotIndex,cageDefinitionIndex:record.preparation.definitionIndex,fieldId:record.fieldId,x:q.originNative[0],y:q.originNative[1]};
 const instances=[-960,0,960].map(shift=>{const o=ranchNativeToWorld(p.x+shift,p.y),object={visible:false},supportMesh={visible:true,parent:object,matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,o.x,0,o.z,1]},updateWorldMatrix(){}};return {p,shift,object,supportMesh,supportTriangles:spec.primitives[0].triangles,contactSheets:spec.supportSheets};});
 const env={...H,eligibleSupportOwner:S.eligibleSupportOwner,instances,logicalBridges,supportOwnerResolver:createRanchSupportOwnerResolver({placements:[p],instances,unit:1,wrapWidthNative:960}),ranchNativeToWorld,direction,view:{lift:16*Math.cos(E),cos:Math.cos(E),sin:Math.sin(E),groundScaleY:1},field:{nativePixelWorldScale:1},walkSurfaces:{},ranchPickWalkSurface:()=>({height:0})},make=(contact,pick)=>Function(...Object.keys(env),'let disposed=false;'+contact+pick+'return {contactHeight,pickGroundNative};')(...Object.values(env)),api=make(contactBody,pickBody),old=make(oldContact,oldPick),admission=legacyAdmission(ground);
 for(const capture of record.captures){
  const pos=capture.snap.positions.find(p=>p.creatureId===record.preparation.residentId),native=capture.nativePoint;
  if(!pos||!capture.pick)continue;
  const screenNative={x:native[0]+(capture.pick.input.x-pos.groundScreen.x)/pos.nativeScreenPixels,y:native[1]+(capture.pick.input.y-pos.groundScreen.y)/pos.nativeScreenPixels};
  const oldPicked=old.pickGroundNative(screenNative,admission),picked=api.pickGroundNative(screenNative,admission);
  assert.deepEqual(picked,{x:native[0],y:native[1]});assert.deepEqual(admission(picked.x,picked.y),pos.testOnlyContactDiagnostic.groundAdmission);checks+=2;
  if(capture.label==='tread-423'){assert.equal(oldPicked.y,capture.pick.native.y);assert.equal(admission(oldPicked.x,oldPicked.y),null);checks+=2;}
  if(capture.label==='tread-487'){assert.equal(oldPicked.y,capture.pick.native.y);assert.notEqual(Math.trunc(oldPicked.y/8),Math.trunc(native[1]/8));checks+=2;}
  for(const shift of [-960,0,960]){
   const input={x:screenNative.x+shift,y:screenNative.y},roundtrip=api.pickGroundNative(input,admission);assert.deepEqual(roundtrip,{x:native[0]+shift,y:native[1]});checks++;
   for(const sign of [-1,1]){const ulp=2**(Math.floor(Math.log2(Math.max(1,Math.abs(input.x))))-52),perturbed={x:input.x+sign*ulp,y:input.y+sign*Number.EPSILON*Math.abs(input.y)},result=api.pickGroundNative(perturbed,admission);assert.deepEqual(result,roundtrip);checks++;}
  }
  results.push({fieldId:record.fieldId,label:capture.label,native,screenNative,capturedOldPick:capture.pick.native,reproducedOldPick:oldPicked,picked});
 }
 if(record.fieldId==='field_cm18_01'){
  for(const y of [160-1/4096,160+1/4096,160-16*2**-45,160+16*2**-45]){assert.equal(H.canonicalContactNativeCoordinate(y),y);checks++;}
  assert.equal(admission(254,160-1/4096),null);assert.ok(admission(254,160));assert.ok(admission(254,160+1/4096));checks+=3;
  for(const local of [[57.21,91.60],[56.97,91.73],[57.45,91.48]]){assert.equal(admission(local[0]+p.x,local[1]+p.y),null);checks++;}
 }
}
for(const value of [0,NaN,Infinity,Number.MAX_SAFE_INTEGER,.123456789,160-1/4096,160+1/4096]){assert.ok(Object.is(H.canonicalContactNativeCoordinate(value),value));checks++;}
console.log(JSON.stringify({checks,status:'PASS'}));
