import assert from'node:assert/strict';import fs from'node:fs';
import{loadSupportMetadata}from'./ranchPhysicalSupport.js';
import{loadLogicalBridges,transformContactTriangles,contactHeightAtPoint,logicalContactHeightAtPoint}from'./ranchContactHeight.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),fields=await loadSupportMetadata(read('./physical-ground-tops.r2.json')),text=read('./logical-stair-bridges.r1.json'),bridges=await loadLogicalBridges(text,fields),tops=fields.get('field_cm18_01').primitives[0].triangles;
const receipt=JSON.parse(read('../stair-mat-support-proposal/logical-continuity-receipt.json')),I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],s=Math.sin(52*Math.PI/180),world=([x,y])=>[(x+y/s)/(16*Math.SQRT2),(-x+y/s)/(16*Math.SQRT2)];let checks=0;
const query=(ts,bs,x,z)=>contactHeightAtPoint(ts,x,z)??logicalContactHeightAtPoint(bs,x,z);
assert.equal(bridges.length,8);checks++;
for(const row of receipt.trajectory25){const [x,z]=world(row.pointLocalNative),hit=query(tops,bridges,x,z);assert.ok(hit);assert.ok(Math.abs(hit.height-row.hits[0].height)<1e-10);checks+=2;}
for(let j=0;j<receipt.trajectory25.length-1;j++){const a=receipt.trajectory25[j].pointLocalNative,b=receipt.trajectory25[j+1].pointLocalNative;let prior=null;const direction=j<12?1:-1;for(let k=0;k<=125;k++){const t=k/125,[x,z]=world(a.map((v,i)=>v+(b[i]-v)*t)),hit=query(tops,bridges,x,z);assert.ok(hit);if(prior!==null)assert.ok(direction*(hit.height-prior)>=-1e-10);prior=hit.height;checks+=2;}}
for(const t of bridges){const c=[0,1,2].map(k=>t.vertices.reduce((n,v)=>n+v[k],0)/3),hit=logicalContactHeightAtPoint(bridges,c[0],c[2]);assert.ok(Math.abs(hit.height-c[1])<1e-10);assert.deepEqual(hit,logicalContactHeightAtPoint([...bridges].reverse(),c[0],c[2]));checks+=2;
 for(const wrap of [-960,0,960]){const [tx,tz]=world([wrap,0]),m=I.slice();m[12]=tx;m[14]=tz;const shifted=transformContactTriangles(bridges,m);assert.ok(Math.abs(logicalContactHeightAtPoint(shifted,c[0]+tx,c[2]+tz).height-c[1])<1e-10);checks++;}
}
assert.equal(logicalContactHeightAtPoint(bridges,1e6,-1e6),null);checks++;
await assert.rejects(()=>loadLogicalBridges(text+'\n',fields),/HASH_MISMATCH/);checks++;
await assert.rejects(()=>loadLogicalBridges(text,new Map()),/AUTHORITY_MISMATCH/);checks++;
const wrong=new Map(fields);wrong.set('field_cm18_01',{...wrong.get('field_cm18_01'),glbSha256:'0'.repeat(64)});await assert.rejects(()=>loadLogicalBridges(text,wrong),/AUTHORITY_MISMATCH/);checks++;
console.log(JSON.stringify({checks,status:'PASS_LOCAL_NUMERICAL_ONLY',gpu:'NOT_RUN',physicalTriangles:18,logicalTriangles:8}));
