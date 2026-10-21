import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {loadSupportMetadata,validateSupportGeometry,eligibleSupportOwner,encodeProjectedTriangle,projectedTriangleTouchesBox,sha256,SUPPORT_MAX_TRIANGLES} from './ranchSupportAudit.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
let checks=0;function check(v){assert.ok(v);checks++;}
const metadata=await loadSupportMetadata(fs.readFileSync(new URL('../six-field-support-proposal/physical-top-triangles.proposed.json',import.meta.url),'utf8'));
check(metadata.size===6);check([...metadata.values()].reduce((n,f)=>n+f.primitives[0].triangles.length,0)===136);check(Math.max(...[...metadata.values()].map(f=>f.primitives[0].triangles.length))===SUPPORT_MAX_TRIANGLES);
await assert.rejects(loadSupportMetadata('{}'),/HASH_MISMATCH/);checks++;
const instance={p:{ownerIndex:7,fieldId:'field_cm02_01'},shift:0,supportMesh:{}};
const good={ownerIndex:7,fieldId:'field_cm02_01',shift:0,groundComponent:'NOMINAL_GROUND'};
check(eligibleSupportOwner(good,[instance]).instance===instance);
for(const denied of [null,{}, {...good,ownerIndex:8},{...good,fieldId:'field_cm09_01'},{...good,shift:1},{...good,groundComponent:'RAISED_PROP'}])check(eligibleSupportOwner(denied,[instance]).instance===null);
check(eligibleSupportOwner(good,[instance,instance]).instance===null);check(eligibleSupportOwner(good,[{...instance,supportMesh:null}]).instance===null);
check(eligibleSupportOwner(good,[{...instance,object:{visible:false}}]).instance===null);
check(eligibleSupportOwner(good,[{...instance,supportMesh:{visible:true,parent:{visible:false}}}]).instance===null);
const xyz=new Float32Array([0,0,0,1,0,0,0,0,1]),idx=new Uint32Array([0,1,2]);
const attr={count:3,getX:i=>xyz[3*i],getY:i=>xyz[3*i+1],getZ:i=>xyz[3*i+2]};
const mesh={geometry:{attributes:{position:attr},index:{count:3,getX:i=>idx[i]}}};
const p={nodeIndex:0,meshIndex:0,primitiveIndex:0,positionCount:3,triangleCount:1,positionSha256Float32LE:await sha256(xyz.buffer),indexSha256Uint32LE:await sha256(idx.buffer),triangles:[{sourceTriangleIndex:0,vertices:[[0,0,0],[1,0,0],[0,0,1]],supportY:0}]};
const spec={glbSha256:'abc',primitives:[p]};check((await validateSupportGeometry(spec,'abc',[mesh])).length===1);
for(const [s,h,m,re] of [[spec,'wrong',[mesh],/MODEL_HASH/],[spec,'abc',[],/COUNT/],[{...spec,primitives:[{...p,indexSha256Uint32LE:'bad'}]},'abc',[mesh],/HASH_MISMATCH/],[{...spec,primitives:[{...p,positionSha256Float32LE:'bad'}]},'abc',[mesh],/HASH_MISMATCH/],[{...spec,primitives:[{...p,triangles:[{...p.triangles[0],vertices:[[0,0,0],[2,0,0],[0,0,1]]}]}]},'abc',[mesh],/VERTEX_MISMATCH/]]){await assert.rejects(validateSupportGeometry(s,h,m),re);checks++;}
const a=encodeProjectedTriangle([[0,0],[1,0],[1,1]],.016),b=encodeProjectedTriangle([[0,0],[1,1],[0,1]],.016);
assert.deepEqual([...a.slice(8,12)],[...b.slice(0,4)]);checks++;
check(a[15]===-b[13]);check(projectedTriangleTouchesBox([[0,0],[1,0],[0,1]],{minX:.9,maxX:1.1,minY:.9,maxY:1.1}));
check(!projectedTriangleTouchesBox([[0,0],[1,0],[0,1]],{minX:2,maxX:3,minY:2,maxY:3}));
assert.throws(()=>encodeProjectedTriangle([[0,0],[1,1],[2,2]],0),/DEGENERATE/);checks++;
console.log(JSON.stringify({status:'PASS',checks,fields:6,physicalTops:136,maxPerField:72,scope:'pure validation and denial, not GPU visibility'}));
