import assert from 'node:assert/strict';
import {partitionSpriteQuad} from './ranchSpritePartition.js';
let checks=0;const ok=v=>{assert.ok(v);checks++};
const area=p=>{let a=0;for(let i=0;i<p.length;i+=9)a+=((p[i+3]-p[i])*(p[i+7]-p[i+1])-(p[i+4]-p[i+1])*(p[i+6]-p[i]))/2;return a};
for(const flip of [false,true])for(const cut of [-2,-.5,-.499,-.25,0,.123,.499,.5,2]){
 const uv=flip?[.9,.1,.1,.1,.9,.8,.1,.8]:[.1,.1,.9,.1,.1,.8,.9,.8];
 const {upper,lower}=partitionSpriteQuad(uv,cut);
 ok(Math.abs(area(upper.position)+area(lower.position)-1)<1e-6);
 for(const [name,p] of Object.entries({upper,lower})){
  ok(p.position.length<=36);ok(p.uv.length/2===p.position.length/3);
  for(let i=0;i<p.position.length/3;i++){
   const x=p.position[i*3],y=p.position[i*3+1];
   ok(name==='upper'?y>=cut-1e-7:y<=cut+1e-7);
   ok(Math.abs(p.uv[i*2]-(flip?.9-.8*(x+.5):.1+.8*(x+.5)))<1e-7);
   ok(Math.abs(p.uv[i*2+1]-(.1+.7*(.5-y)))<1e-7);
   ok(p.position[i*3+2]===0);
  }
 }
 if(cut<=-.5)ok(lower.position.length===0);
 if(cut>=.5)ok(upper.position.length===0);
 if(cut>-.5&&cut<.5){
  const edge=p=>{const a=[];for(let i=0;i<p.position.length/3;i++)if(Math.abs(p.position[i*3+1]-cut)<1e-7)a.push([p.position[i*3],p.position[i*3+1],p.uv[i*2],p.uv[i*2+1]].join(','));return [...new Set(a)].sort()};
  assert.deepEqual(edge(upper),edge(lower));checks++;
 }
}
assert.throws(()=>partitionSpriteQuad([],0));checks++;
assert.throws(()=>partitionSpriteQuad([0,0,1,0,0,1,1,1],NaN));checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'pure geometry partition/UV/area/seam, no GPU raster equivalence'}));
