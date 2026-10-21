import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {partitionSpriteQuad} from './ranchSpritePartition.js';
const source=fs.readFileSync(new URL('./ranchThreeScene.js',import.meta.url),'utf8');
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++};
class Geometry{constructor(){this.attributes={};this.disposals=0;}setAttribute(k,v){this.attributes[k]=v;}computeBoundingSphere(){}dispose(){this.disposals++;}}
class Attribute{constructor(array,size){this.array=array;this.count=array.length/size;}}
const vec=(x=0,y=0,z=0)=>({x,y,z,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}});
const mat=()=>({disposals:0,dispose(){this.disposals++}});
const mesh=()=>({geometry:new Geometry(),material:mat(),position:vec(),scale:vec(1,1,1),quaternion:vec(),visible:true});
const removed=[];const context={partitionSpriteQuad,THREE:{BufferGeometry:Geometry,BufferAttribute:Attribute},scene:{remove:m=>removed.push(m)}};vm.createContext(context);
const start=source.indexOf('  function partitionGeometry('),end=source.indexOf('  function syncSprite(',start);
vm.runInContext(source.slice(start,end)+'\nglobalThis.sync=syncSpritePartition;globalThis.drop=disposeSpriteItem;',context);
const item={mesh:mesh(),upperMesh:mesh()};
const u={uRanchFloor:{value:.015},uRanchSupportCount:{value:0},uRanchSupportMax:{value:999}};
item.mesh.material.userData={depthEnvelopeUniforms:u};
const uv=[0,1,1,1,0,0,1,0];
let old=item.mesh.geometry,oldU=item.upperMesh.geometry;context.sync(item,uv);eq(old.disposals,1);eq(oldU.disposals,1);eq(item.partition.ceiling,.015);eq(item.mesh.visible,true);eq(item.upperMesh.visible,true);
old=item.mesh.geometry;context.sync(item,uv);eq(item.mesh.geometry,old);eq(old.disposals,0);
// Airborne: upper stock only, full original transform follows native lift.
item.mesh.position.y=2;context.sync(item,uv);eq(item.mesh.visible,false);eq(item.upperMesh.visible,true);eq(item.upperMesh.position.y,2);eq(item.partition.cut,-.5);
// Fully below ceiling, lower policy only.
item.mesh.position.y=-2;context.sync(item,uv);eq(item.mesh.visible,true);eq(item.upperMesh.visible,false);eq(item.partition.cut,.5);
// Only admitted support contributes to partition ceiling; does not overwrite uRanchFloor.
u.uRanchSupportCount.value=1;u.uRanchSupportMax.value=.016;item.mesh.position.y=0;context.sync(item,uv);eq(item.partition.ceiling,.031);eq(u.uRanchFloor.value,.015);
old=item.mesh.geometry;context.sync(item,[1,1,0,1,1,0,0,0]);eq(old.disposals,1);
const g=item.mesh.geometry,gu=item.upperMesh.geometry,m=item.mesh.material,mu=item.upperMesh.material;context.drop(item);eq(g.disposals,1);eq(gu.disposals,1);eq(m.disposals,1);eq(mu.disposals,1);eq(removed.length,2);
// Source-level wiring assertions supplement executed owned-function lifetime checks.
assert.match(source,/item\.upperMesh\.material\.dispose\(\);item\.upperMesh\.material=material\.clone\(\)/);checks++;
assert.match(source,/if\(item\.sprite\.destroyed\)\{disposeSpriteItem\(item\);sprites\.delete/);checks++;
assert.match(source,/if\(!item\.sprite\.destroyed\)item\.sprite\.renderable=true;disposeSpriteItem\(item\)/);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'executed exact partition/lifecycle functions with geometry/material spies; source swap/removal/dispose wiring assertions; not GPU residency proof'}));
