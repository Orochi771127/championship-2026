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
const plans=read('./fixtures/ranch-v4/wrap-plan.json'),assets=read('./fixtures/ranch-v4/layouts.json'),results=[];let checks=0;
for(const c of plans.cases.filter(c=>c.id.startsWith('point-wrap'))){
 const q=c.expectedQuery,row=assets.rows.find(r=>r.fieldId===c.fieldId),ground=compose({placements:row.layout,unlockedSlots:Array.from({length:100},(_,i)=>i)}),spec=supportFields.get(c.fieldId);
 const p={ownerIndex:q.rendererOwnerIndex,instanceId:q.stableSourcePlacement.instanceId,moduleId:q.stableSourcePlacement.moduleId,slotIndex:q.stableSourcePlacement.slotIndex,cageDefinitionIndex:q.stableSourcePlacement.definitionIndex,fieldId:c.fieldId,x:q.originNative[0],y:q.originNative[1]};
 const instances=[-960,0,960].map(shift=>{const o=ranchNativeToWorld(q.originNative[0]+shift,q.originNative[1]),object={visible:false},supportMesh={visible:true,parent:object,matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,o.x,0,o.z,1]},updateWorldMatrix(){}};return {p,shift,object,supportMesh,supportTriangles:spec.primitives[0].triangles,contactSheets:spec.supportSheets};});
 const resolver=createRanchSupportOwnerResolver({placements:[p],instances,unit:1,wrapWidthNative:960}),env={...H,eligibleSupportOwner:S.eligibleSupportOwner,instances,logicalBridges,supportOwnerResolver:resolver,ranchNativeToWorld,direction,field:{nativePixelWorldScale:1},walkSurfaces:{},ranchPickWalkSurface:()=>({height:0})};
 const api=Function(...Object.keys(env),'let disposed=false;'+contactBody+pickBody+'return {contactHeight,pickGroundNative,dispose(){disposed=true;supportOwnerResolver.dispose();}};')(...Object.values(env));
 const admission=(x,y)=>readRaisingGroundSupport(ground,x,y),points=c.fieldId==='field_cm18_01'?[[254,160],[268,156],...read('./fixtures/ranch-v4/continuity.json').trajectory25.map(r=>r.pointLocalNative.map((v,i)=>v+q.originNative[i]))]:[[228,44]];
 const rows=[];
 for(const base of points)for(const shift of [-960,0,960]){
  const x=base[0]+shift,y=base[1],a=admission(x,y),before=api.contactHeight(x,y,a);assert.ok(before.height!==null);checks++;
  const displayed={x,y:y-before.height*lift},picked=api.pickGroundNative(displayed,admission),pickedAdmission=admission(picked.x,picked.y);
  assert.ok(Math.abs(picked.x-x)<1e-9&&Math.abs(picked.y-y)<1e-9);assert.ok(pickedAdmission);assert.equal(pickedAdmission.instanceId,a.instanceId);assert.equal(pickedAdmission.navigationComponent,a.navigationComponent);checks+=4;
  for(const instance of instances)instance.object.visible=true;assert.deepEqual(api.contactHeight(x,y,a),before);for(const instance of instances)instance.object.visible=false;checks++;
  const denied=api.pickGroundNative(displayed,()=>null);assert.deepEqual(denied,displayed);checks++;
  rows.push({ground:[x,y],displayed,picked,height:before.height,authority:before.kind,originalAdmission:a,pickedAdmission});
 }
 assert.equal(api.contactHeight(q.displayPointNative[0],q.displayPointNative[1],{...q.admission,instanceId:'other'}).height,null);checks++;
 assert.deepEqual(api.pickGroundNative({x:-1e6,y:-1e6},admission),{x:-1e6,y:-1e6});checks++;
 const target=instances.find(i=>i.shift===q.wrapShiftNative);target.supportMesh.visible=false;assert.equal(api.contactHeight(...q.displayPointNative,q.admission).height,null);target.supportMesh.visible=true;checks++;
 const parent=target.supportMesh.parent;target.supportMesh.parent={visible:false,parent};assert.equal(api.contactHeight(...q.displayPointNative,q.admission).height,null);target.supportMesh.parent=parent;checks++;
 api.dispose();assert.equal(api.contactHeight(...q.displayPointNative,q.admission).height,null);checks++;
 results.push({fieldId:c.fieldId,rows});
}
console.log(JSON.stringify({checks,status:'PASS'}));
