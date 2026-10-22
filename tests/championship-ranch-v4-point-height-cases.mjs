import assert from'node:assert/strict';import fs from'node:fs';
import{contactHeightAtPoint,transformContactTriangles}from'../src/championship/presentation/ranchContactHeight.js';
import{loadSupportMetadata,validateSupportGeometry,eligibleSupportOwner}from'../src/championship/presentation/ranchPhysicalSupport.js';
import{resolveRanchSupportOwner}from'../src/championship/presentation/ranchSupportOwner.js';
const metadataText=fs.readFileSync(new URL('../assets/production/cage/three-20261021/physical-ground-tops.r2.json',import.meta.url),'utf8'),fields=await loadSupportMetadata(metadataText);let checks=0;
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],E=52*Math.PI/180,world=(x,y,h=0)=>[(x+y/Math.sin(E))/(16*Math.SQRT2),h,(-x+y/Math.sin(E))/(16*Math.SQRT2)],native=v=>[(v[0]-v[2])*16/Math.SQRT2,(v[0]+v[2])*Math.sin(E)*16/Math.SQRT2];
for(const id of ['field_cm18_01','field_cm34_01']){
 const spec=fields.get(id),tris=spec.primitives[0].triangles,transformed=transformContactTriangles(tris,I);
 for(const t of transformed){const center=[0,1,2].map(k=>t.vertices.reduce((n,v)=>n+v[k],0)/3),p=native(center),hit=contactHeightAtPoint(transformed,center[0],center[2]);assert.ok(Math.abs(hit.height-center[1])<1e-12);checks++;
  const placement={ownerIndex:17,instanceId:'current',moduleId:'actual-fixture-module',slotIndex:0,cageDefinitionIndex:8,fieldId:id,x:0,y:0};
  const admission={kind:'CURRENT_GROUND_XY_ADMISSION_V1',instanceId:'current',moduleId:placement.moduleId,slotIndex:0,definitionIndex:8,wrapWidthNative:480,terrain:0,navigationComponent:1,originNative:[0,0],localNative:p,positionNative:p};
  for(const shift of [-480,0,480]){
   const mesh={visible:true},instance={p:placement,shift,supportMesh:mesh,object:{visible:true}},args={placements:[placement],instances:[instance],unit:1,wrapWidthNative:480,displayNativeX:p[0]+shift};
   const owner=resolveRanchSupportOwner(admission,args);assert.equal(owner?.ownerIndex,17);assert.equal(owner?.shift,shift);assert.equal(eligibleSupportOwner(owner,[instance]).status,'VERIFIED_OWNER');
   const tr=world(shift,0),m=I.slice();m[12]=tr[0];m[14]=tr[2];const q=world(p[0]+shift,p[1]);assert.ok(Math.abs(contactHeightAtPoint(transformContactTriangles(tris,m),q[0],q[2]).height-hit.height)<1e-10);checks++;
   for(const bad of [{...admission,instanceId:'stale'},{...admission,terrain:1},{...admission,navigationComponent:-1}]){assert.equal(resolveRanchSupportOwner(bad,args),null);checks++;}
   mesh.visible=false;assert.equal(eligibleSupportOwner(owner,[instance]).status,'DENIED_INVISIBLE_SUPPORT');checks++;
  }
  for(const nativeZ of [0,.125,8,32]){const baseY=523.28,scale=3,rootY=baseY-hit.height*16*Math.cos(E)*scale,bodyY=rootY-nativeZ*scale,shadowY=rootY+3;assert.ok(Math.abs((shadowY-bodyY)-(3+nativeZ*scale))<1e-10);const projectedY=p[1]-hit.height*16*Math.cos(E);assert.ok(Math.abs((projectedY-p[1])*scale-(rootY-baseY))<1e-10);checks++;}
 }
 assert.equal(contactHeightAtPoint(transformed,-1e6,-1e6),null);checks++;
 await assert.rejects(()=>validateSupportGeometry(spec,'0'.repeat(64),[]),/MODEL_HASH_MISMATCH/);checks++;
}
await assert.rejects(()=>loadSupportMetadata(metadataText+'\n'),/HASH_MISMATCH/);checks++;
const same=[{sourceTriangleIndex:7,vertices:[[0,1,0],[1,1,0],[0,1,1]]},{sourceTriangleIndex:3,vertices:[[1,1,1],[0,1,1],[1,1,0]]}];assert.equal(contactHeightAtPoint(same,.5,.5).sourceTriangleIndex,3);assert.deepEqual(contactHeightAtPoint(same,.5,.5),contactHeightAtPoint([...same].reverse(),.5,.5));checks+=2;
const tilt=I.slice();tilt[1]=.001;assert.throws(()=>transformContactTriangles(same,tilt),/TRANSFORM/);checks++;
console.log(JSON.stringify({checks,status:'PASS_STATIC_POINTS_ONLY',continuousStairs:'TESTED_SEPARATELY_IN_LOGICAL_HEIGHT_CASES_NOT_GPU',gpu:'NOT_RUN'}));
