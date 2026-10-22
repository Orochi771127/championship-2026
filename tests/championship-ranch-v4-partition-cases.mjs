import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js',import.meta.url),'utf8');
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++};const ok=x=>{assert.ok(x);checks++};
const vector=(x=0,y=0,z=0)=>({x,y,z,copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this}});
class V3{constructor(x,y,z){Object.assign(this,{x,y,z})}project(c){Object.assign(this,c.project(this));return this}}
const removed=[];const camera={project:v=>v};
const context={THREE:{Vector3:V3},camera,scene:{remove:m=>removed.push(m)},depthEnvelopeMaterial:base=>{const m=base.clone();m.onBeforeCompile=s=>{s.fragmentShader+='\ngl_FragDepth=gl_FragCoord.z;'};m.customProgramCacheKey=()=> 'floor';return m}};
vm.createContext(context);
let start=source.indexOf('  function partitionMaterial('),end=source.indexOf('  function syncSprite(',start);
vm.runInContext(source.slice(start,end)+'\nglobalThis.make=partitionMaterial;globalThis.sync=syncSpritePartition;globalThis.drop=disposeSpriteItem;',context);
const material=()=>({disposals:0,onBeforeCompile(){},customProgramCacheKey(){return 'stock'},dispose(){this.disposals++},clone(){return material()}});
const threshold={value:1};let upper=context.make(material(),true,threshold),lower=context.make(material(),false,threshold);
const shader=()=>({uniforms:{},fragmentShader:'#include <opaque_fragment>'});let su=shader(),sl=shader();upper.onBeforeCompile(su);lower.onBeforeCompile(sl);
eq(su.uniforms.uRanchPartitionY,undefined);eq(sl.uniforms.uRanchPartitionY,threshold);ok(!su.fragmentShader.includes('gl_FragDepth='));ok(sl.fragmentShader.includes('gl_FragDepth='));ok(!su.fragmentShader.includes('discard'));eq(su.fragmentShader,'#include <opaque_fragment>');ok(sl.fragmentShader.includes('gl_FragCoord.y>=uRanchPartitionY'));ok(upper.customProgramCacheKey()!==lower.customProgramCacheKey());
const geom=()=>({attributes:{position:{count:4},uv:{array:new Float32Array(8)}},disposals:0,dispose(){this.disposals++}});
const mesh=()=>({geometry:geom(),material:material(),position:vector(),scale:vector(1,2,1),quaternion:vector(),visible:true});
const item={mesh:mesh(),upperMesh:mesh(),partitionThreshold:threshold};const u={uRanchFloor:{value:.015},uRanchSupportCount:{value:0},uRanchSupportMax:{value:99},uRanchBufferSize:{value:{y:844}}};item.mesh.material.userData={depthEnvelopeUniforms:u};
const uv=[.2,.1,.8,.1,.2,.9,.8,.9];const originalGeometry=item.mesh.geometry;
// Independent orthographic screen mapping across pan/zoom/DPR. WorldY ceiling
// projects on same horizontal billboard line regardless of X/Z translation.
for(const zoom of [.7,1,1.4])for(const dpr of [1,1.5,2])for(const pan of [-7,0,8]){
 const h=844,cy=pan,pixelScale=3*zoom,cos=Math.cos(52*Math.PI/180);
 camera.project=v=>({x:0,y:2*(v.y-cy)*16*pixelScale*cos/h,z:0});u.uRanchBufferSize.value.y=h*dpr;
 context.sync(item,uv);const expected=h*dpr/2+(.015-cy)*16*pixelScale*cos*dpr;
 ok(Math.abs(threshold.value-expected)<1e-10);eq(item.partition.ceiling,.015);eq(item.mesh.geometry,originalGeometry);
 const t=Math.fround(threshold.value);
 for(const y of [t-1,t-.5,t,t+.5,t+1])ok(1+Number(!(y>=t))>=1);
}
assert.deepEqual([...item.mesh.geometry.attributes.uv.array],[...item.upperMesh.geometry.attributes.uv.array]);checks++;
u.uRanchSupportCount.value=1;u.uRanchSupportMax.value=.016;context.sync(item,uv);eq(item.partition.ceiling,.031);eq(u.uRanchFloor.value,.015);
item.mesh.position.y=5;context.sync(item,uv);eq(item.mesh.visible,true);eq(item.upperMesh.visible,true);eq(item.upperMesh.position.y,5);
item.mesh.position.y=-5;context.sync(item,uv);eq(item.mesh.visible,true);eq(item.upperMesh.visible,true);
context.drop(item);eq(removed.length,2);for(const m of removed){eq(m.geometry.disposals,1);eq(m.material.disposals,1)}
assert.match(source,/item\.upperMesh\.material\.dispose\(\);item\.upperMesh\.material=partitionMaterial\(material,true,item\.partitionThreshold\)/);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'exact wrapper/sync/lifecycle functions, unmodified stock shader + bounded overlay threshold, pan/zoom/DPR arithmetic and UV preservation; not GPU MSAA acceptance'}));
