import{fileURLToPath}from'node:url';
import fs from'node:fs';import assert from'node:assert/strict';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
const R=fileURLToPath(new URL('../',import.meta.url)),out=fileURLToPath(new URL('./fixtures/ranch-v4/',import.meta.url));
const H=await import(new URL('../src/championship/presentation/ranchContactHeight.js',import.meta.url)),S=await import(new URL('../src/championship/presentation/ranchPhysicalSupport.js',import.meta.url)),O=await import(new URL('../src/championship/presentation/ranchSupportOwner.js',import.meta.url));
const text=fs.readFileSync(R+'src/championship/presentation/ranchThreeScene.js','utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const body=text.slice(text.indexOf('  function updateContactTriangles('),text.indexOf('  function legacyGroundHeight('));const fields=await S.loadSupportMetadata(fs.readFileSync(R+'assets/production/cage/three-20261021/physical-ground-tops.r2.json','utf8'));const logicalBridges=await H.loadLogicalBridges(fs.readFileSync(R+'assets/production/cage/three-20261021/logical-stair-bridges.r1.json','utf8'),fields);
// The captured fixture stays immutable. Re-exported triangle IDs are admitted
// only through an exact three-vertex match against its historical support mesh.
const remap=JSON.parse(fs.readFileSync(out+'cm18-r3-triangle-remap.json'));
const cm18=fields.get(remap.fieldId);assert.equal(cm18.glbSha256,remap.currentGlbSha256);
const triangleIds=new Map();
for(const row of remap.triangles){
 const triangle=cm18.primitives[0].triangles.find(t=>t.sourceTriangleIndex===row.currentTriangleIndex);assert.ok(triangle);
 assert.deepEqual([...triangle.vertices].sort(),[...row.vertices].sort());
 triangleIds.set(row.historicalTriangleIndex,row.currentTriangleIndex);
}
const plan=JSON.parse(fs.readFileSync(out+'wrap-plan.json')),E=52*Math.PI/180,ranchNativeToWorld=(x,y,h=0)=>({x:(x+y/Math.sin(E))/(16*Math.SQRT2),y:h,z:(-x+y/Math.sin(E))/(16*Math.SQRT2)}),rows=[];
for(const c of plan.cases.filter(c=>c.id.startsWith('point-wrap'))){
 const q=c.expectedQuery,f=fields.get(c.fieldId),priorId=c.fieldId==='field_cm18_01'?'point-cm18-tread4-waste':'point-cm34-mat-waste',file=out+priorId+'.json';const record=JSON.parse(fs.readFileSync(file)),objects=record.intensity.beforeState.objects;
 const placement={ownerIndex:q.rendererOwnerIndex,instanceId:q.stableSourcePlacement.instanceId,moduleId:q.stableSourcePlacement.moduleId,slotIndex:q.stableSourcePlacement.slotIndex,cageDefinitionIndex:q.stableSourcePlacement.definitionIndex,fieldId:c.fieldId,x:q.originNative[0],y:q.originNative[1]};const origin=ranchNativeToWorld(q.originNative[0]+q.wrapShiftNative,q.originNative[1]);
 const captured=objects.filter(o=>o.name.startsWith(c.fieldId)&&o.type==='Mesh').find(o=>Math.hypot(o.matrixWorld[12]-origin.x,o.matrixWorld[14]-origin.z)<1e-10);assert.ok(captured);const parent=objects.find(o=>o.id===captured.parent);assert.ok(parent);assert.equal(parent.visible,false,'PREVIOUS_CAMERA_ALREADY_CULLED_TARGET_WRAP');
 const object={visible:parent.visible},mesh={visible:captured.visible,parent:object,matrixWorld:{elements:captured.matrixWorld},updateWorldMatrix(){}};const instance={p:placement,shift:q.wrapShiftNative,object,supportMesh:mesh,supportTriangles:f.primitives[0].triangles,contactSheets:f.supportSheets},instances=[instance],resolver=O.createRanchSupportOwnerResolver({placements:[placement],instances,unit:1,wrapWidthNative:q.wrapWidthNative});
 const env={disposed:false,...H,eligibleSupportOwner:S.eligibleSupportOwner,instances,logicalBridges,supportOwnerResolver:resolver,ranchNativeToWorld};const query=new Function(...Object.keys(env),body+'return contactHeight;')(...Object.values(env));const [x,y]=q.displayPointNative;
 const before=query(x,y,q.admission);assert.equal(before.status,'VERIFIED_ADMITTED_AUTHORED_CONTACT');assert.ok(Math.abs(before.height-c.expectedHeightWorld)<1e-10);assert.deepEqual(before.owner,q.derivedSupportOwner);
 object.visible=true;const after=query(x,y,q.admission);assert.equal(after.status,'VERIFIED_ADMITTED_AUTHORED_CONTACT');assert.ok(Math.abs(after.height-c.expectedHeightWorld)<1e-10);assert.deepEqual(after,before);assert.ok(c.expectedContact.acceptableGeometryHits.some(h=>(c.fieldId===remap.fieldId?triangleIds.get(h.sourceTriangleIndex):h.sourceTriangleIndex)===after.sourceTriangleIndex));object.visible=false;assert.deepEqual(query(x,y,q.admission),before);
 resolver.dispose();object.visible=true;assert.equal(query(x,y,q.admission).height,null);
 rows.push({id:c.id,priorEvidenceSha256:sha(fs.readFileSync(file)),capturedMeshId:captured.id,capturedParentId:parent.id,priorParentVisible:parent.visible,exactContactFunctionSha256:sha(body),sameGeometryMatrix:captured.matrixWorld,before,after,onlyMutation:'render-instance parent visibility false→true→false',disposalStillDenied:true});
}
console.log(JSON.stringify(rows.map(r=>({id:r.id,before:r.before.status,after:r.after.status,height:r.after.height}))));
