import fs from'node:fs';import vm from'node:vm';import assert from'node:assert/strict';
const source=fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js',import.meta.url),'utf8'),baseline=fs.readFileSync(new URL('./fixtures/ranch-v4/historical-v3-snippets.txt',import.meta.url),'utf8');
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++},ok=a=>{assert.ok(a);checks++};
class Texture{constructor(data){this.image={data};this.disposals=0}dispose(){this.disposals++}}
class Vec{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}}
class Material{constructor(){this.userData={};this.listeners={};this.depthWrite=true;this.depthTest=true;this.alphaTest=.15;this.version=0}clone(){return new Material()}addEventListener(k,f){this.listeners[k]=f}dispose(){this.listeners.dispose?.()}set needsUpdate(v){if(v)this.version++}onBeforeCompile(){}customProgramCacheKey(){return 'stock'}}
const E=52*Math.PI/180,direction=new Vec(Math.cos(E)/Math.SQRT2,Math.sin(E),Math.cos(E)/Math.SQRT2);
function context(s){const c={THREE:{DataTexture:Texture,Vector2:Vec,Matrix4:class{},RGBAFormat:1,FloatType:2,NearestFilter:3},direction,SUPPORT_MAX_TRIANGLES:72,CONTACT_HEIGHT_FIELDS:new Set(['field_cm18_01','field_cm34_01'])};vm.createContext(c);const start=s.indexOf('  function depthEnvelopeMaterial('),end=s.indexOf('  function syncSpritePartition(',start);vm.runInContext(s.slice(start,end)+'\nglobalThis.make=partitionMaterial;'+(s.includes('function syncScalarPointDepth(')?'globalThis.sync=syncScalarPointDepth;':''),c);return c}
const c=context(source),old=context(baseline),threshold={value:319.5},base=new Material(),m=c.make(base,false,threshold),stock=c.make(base,true,threshold);
function compile(m){const s={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <opaque_fragment>'};m.onBeforeCompile(s);return s}
// Generic six-field path and stock are literally unchanged at generated-hook level.
const oldLower=compile(old.make(base,false,threshold)),generic=compile(m);
eq(generic.vertexShader,oldLower.vertexShader);eq(generic.fragmentShader,oldLower.fragmentShader);eq(m.customProgramCacheKey(),old.make(base,false,threshold).customProgramCacheKey());
const originalStock=compile(old.make(base,true,threshold));eq(compile(stock).vertexShader,originalStock.vertexShader);eq(compile(stock).fragmentShader,originalStock.fragmentShader);eq(stock.depthWrite,true);eq(stock.depthTest,true);
const item={mesh:{material:m},physicalSupport:{status:'ADMITTED_POINT_CONTACT_ONLY_NO_PROJECTED_TOP_OVERRIDE'}};
const owner={fieldId:'field_cm18_01',ownerIndex:9,shift:0};const root={threeSupportOwner:owner,threeGroundContact:{height:.09465029835700989,owner:{...owner},authority:'EXACT_ADMITTED_AUTHORED_POINT'}};
const h=root.threeGroundContact.height;c.sync(item,root,h);eq(m.userData.scalarPointDepth,true);eq(m.version,1);eq(item.recoveryDepthMode,'SCALAR_POINT_VERTEX_DEPTH');const key=m.customProgramCacheKey();ok(key.includes('scalar-point-vertex'));
c.sync(item,root,h);eq(m.version,1);const active=compile(m);
ok(active.vertexShader.includes('gl_Position.z=(ranchPointClip.z/ranchPointClip.w)*gl_Position.w;'));ok(!/gl_Position\.(?:x|y|w|xy|xyz|xyzw)\s*=/.test(active.vertexShader));ok(!active.fragmentShader.includes('gl_FragDepth'));ok(active.fragmentShader.includes('gl_FragCoord.y>=uRanchPartitionY'));ok(!active.fragmentShader.includes('uRanchSupportTexture'));eq(active.uniforms.uRanchPartitionY,threshold);eq(active.uniforms.uRanchFloor,m.userData.depthEnvelopeUniforms.uRanchFloor);
for(const authority of ['EXACT_ADMITTED_AUTHORED_POINT','EXACT_ADMITTED_DERIVED_LOGICAL_POINT'])for(const fieldId of ['field_cm18_01','field_cm34_01'])for(const shift of [-960,0,960]){const r={threeSupportOwner:{...owner,fieldId,shift},threeGroundContact:{...root.threeGroundContact,authority,owner:{...owner,fieldId,shift}}};c.sync(item,r,h);eq(m.userData.scalarPointDepth,true)}
// Denials revert to unchanged legacy material; no stale scalar program across moving owners.
for(const mutate of [r=>r.threeGroundContact.authority='EXISTING_WALK_SURFACE_FALLBACK',r=>r.threeGroundContact.height+=.001,r=>r.threeGroundContact.owner.ownerIndex++,r=>r.threeGroundContact.owner.shift=960,r=>r.threeSupportOwner.fieldId='field_cm09_01',r=>r.threeGroundContact=null,r=>r.threeSupportOwner=null]){const r=structuredClone(root);mutate(r);c.sync(item,r,h);eq(m.userData.scalarPointDepth,false);eq(compile(m).fragmentShader,oldLower.fragmentShader);c.sync(item,root,h);eq(m.userData.scalarPointDepth,true)}
item.physicalSupport.status='DENIED_INVISIBLE_SUPPORT';c.sync(item,root,h);eq(m.userData.scalarPointDepth,false);item.physicalSupport.status='ADMITTED_POINT_CONTACT_ONLY_NO_PROJECTED_TOP_OVERRIDE';c.sync(item,root,NaN);eq(m.userData.scalarPointDepth,false);
// New material after texture swap starts generic, then re-enters correct mode;
// each owns exactly one disposable support texture, even when optimized out of GLSL.
const tex=m.userData.depthEnvelopeUniforms.uRanchSupportTexture.value;m.dispose();eq(tex.disposals,1);const replacement=c.make(base,false,threshold);item.mesh.material=replacement;c.sync(item,root,h);eq(replacement.userData.scalarPointDepth,true);eq(replacement.customProgramCacheKey(),key);replacement.dispose();eq(replacement.userData.depthEnvelopeUniforms.uRanchSupportTexture.value.disposals,1);
// Independent orthographic algebra. Whole original quad is affine-projected to
// one floor; do not max/clamp vertices individually (would bend interpolation).
const right=[1/Math.SQRT2,0,-1/Math.SQRT2],up=[-Math.sin(E)/Math.SQRT2,Math.cos(E),-Math.sin(E)/Math.SQRT2],D=[direction.x,direction.y,direction.z];const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),add=(a,b,t)=>a.map((v,i)=>v+b[i]*t);
let maxError=0;
for(const floor of [.015,.045439839363098145+.015,.07004508376121521+.015,h+.015,.1201668381690979+.015,.04995611310005188+.015])for(const z of [0,.125,8,32])for(const scale of [.7,1,2])for(const pan of [-60,0,60]){
 const vertices=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>[pan+x*scale/Math.SQRT2,floor+y*scale+z,pan-x*scale/Math.SQRT2]);
 const projected=vertices.map(v=>add(v,D,(floor-v[1])/D[1]));
 for(let i=0;i<4;i++){const v=vertices[i],p=projected[i];for(const axis of [right,up]){const e=Math.abs(dot(v,axis)-dot(p,axis));maxError=Math.max(maxError,e);ok(e<1e-12)}ok(Math.abs(p[1]-floor)<1e-12)}
 for(const w of [[.2,.3,.5],[.01,.49,.5],[1/3,1/3,1/3]]){const ids=[0,1,2],v=[0,1,2].map(k=>ids.reduce((a,id,j)=>a+w[j]*vertices[id][k],0)),interpolated=ids.reduce((sum,id,j)=>sum+w[j]*dot(projected[id],D),0),exact=dot(add(v,D,(floor-v[1])/D[1]),D);ok(Math.abs(interpolated-exact)<1e-12)}
}
// No new epsilon or policy edits: prior scalar floor and contact functions exact.
eq(source.match(/uniforms\.uRanchFloor\.value=[^;]+;/)[0],baseline.match(/uniforms\.uRanchFloor\.value=[^;]+;/)[0]);
for(const [start,end] of [['  function syncPhysicalSupport(','  function syncScalarPointDepth('],['  function updateContactTriangles(','\n  return {']]){if(start.includes('syncPhysical'))eq(source.slice(source.indexOf(start),source.indexOf(end)),baseline.slice(baseline.indexOf(start),baseline.indexOf('  function partitionMaterial(')));}
ok(source.includes('new THREE.PlaneGeometry(1,1),partitionMaterial(material,false,partitionThreshold)'));ok(source.includes('new THREE.PlaneGeometry(1,1),partitionMaterial(material,true,partitionThreshold)'));
console.log(JSON.stringify({status:'PASS_STATIC_ONLY_NOT_GPU',checks,maxOrthographicRayScreenError:maxError,limits:'GLSL fp32/interpolation/MSAA/foreground/upperRGBA require actual GPU; no epsilon changed'}));
