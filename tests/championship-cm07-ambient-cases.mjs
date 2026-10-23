import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCm07Ambient} from '../src/championship/presentation/cm07Ambient.js';

class Scale {
  constructor(x=1,y=2,z=3){Object.assign(this,{x,y,z});}
  clone(){return new Scale(this.x,this.y,this.z);}
  copy(s){Object.assign(this,s);return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
}
function fixture(){
  const map={offset:{x:0,y:0}}, material=name=>({name,transparent:false,depthWrite:true,depthTest:true,opacity:.3,emissiveIntensity:.7});
  const terrain={...material('field_cm07_01-terrain-pbr'),emissiveMap:map,map};
  const vapour=material('el-smoke'),rock=material('el-basalt');
  const roots=Array.from({length:3},()=>{
    const smoke={name:'volcano-smoke-1',material:vapour,visible:true,castShadow:true,receiveShadow:true,
      position:{x:9,y:4,z:8},rotation:{y:.2},scale:new Scale()};
    return {visible:true,smoke,traverse(fn){fn({name:'ground',material:terrain});fn(smoke);fn({name:'crag',material:rock});}};
  });
  return {roots,terrain,vapour,rock,map};
}
test('smoke uses depth-tested alpha and cannot cast a solid foreground shadow; rocks unchanged',()=>{
  const f=fixture(), before={...f.rock}, a=createCm07Ambient(f.roots);
  assert.deepEqual(f.rock,before);
  assert.equal(f.vapour.transparent,true);assert.equal(f.vapour.depthWrite,false);assert.equal(f.vapour.depthTest,true);
  assert.equal(f.vapour.opacity,.24);
  for(const r of f.roots){assert.equal(r.smoke.castShadow,false);assert.equal(r.smoke.receiveShadow,false);}
  a.dispose();assert.equal(f.vapour.opacity,.3);assert.equal(f.vapour.transparent,false);
  for(const r of f.roots){assert.equal(r.smoke.castShadow,true);assert.equal(r.smoke.receiveShadow,true);}
});
test('absolute phase matches all wrap copies and remains bounded; emission UV and maps never move',()=>{
  const f=fixture(), a=createCm07Ambient(f.roots), before=JSON.stringify(f.map);
  for(let t=0;t<8;t+=.125){
    a.update({elapsedSeconds:t});
    assert.ok(f.terrain.emissiveIntensity>=1.128-1e-10&&f.terrain.emissiveIntensity<=1.272+1e-10);
    const first=f.roots[0].smoke;
    for(const r of f.roots){assert.deepEqual(r.smoke.position,first.position);assert.deepEqual(r.smoke.scale,first.scale);assert.deepEqual(r.smoke.rotation,first.rotation);}
    assert.equal(first.position.x,9);assert.equal(first.position.z,8);assert.ok(Math.abs(first.position.y-4)<=.07+1e-10);
  }
  assert.equal(f.terrain.map,f.map);assert.equal(f.terrain.emissiveMap,f.map);assert.equal(JSON.stringify(f.map),before);
  a.dispose();
});
test('covered and offscreen updates stop; a returning wrap catches up without accumulated drift',()=>{
  const f=fixture(), a=createCm07Ambient(f.roots);
  a.update({elapsedSeconds:1});const y=f.roots[0].smoke.position.y, e=f.terrain.emissiveIntensity;
  a.update({elapsedSeconds:2,visible:false});assert.equal(f.roots[0].smoke.position.y,y);assert.equal(f.terrain.emissiveIntensity,e);
  for(const r of f.roots)r.visible=false;
  a.update({elapsedSeconds:3});assert.equal(f.terrain.emissiveIntensity,e);
  f.roots[1].visible=true;a.update({elapsedSeconds:3});assert.equal(f.roots[0].smoke.position.y,y);
  f.roots[0].visible=true;a.update({elapsedSeconds:3});assert.equal(f.roots[0].smoke.position.y,f.roots[1].smoke.position.y);
  a.dispose();
});
test('reduced motion restores static authored transforms after animation and on remount',()=>{
  const f=fixture();for(let cycle=0;cycle<3;cycle++){
    const a=createCm07Ambient(f.roots);a.update({elapsedSeconds:1});a.update({elapsedSeconds:2,reducedMotion:true});
    assert.equal(f.terrain.emissiveIntensity,1.2);
    for(const r of f.roots){assert.equal(r.smoke.position.y,4);assert.equal(r.smoke.rotation.y,.2);assert.deepEqual(r.smoke.scale,new Scale());}
    a.dispose();a.dispose();a.update({elapsedSeconds:8});assert.equal(f.terrain.emissiveIntensity,.7);
  }
});
test('invalid times fail explicitly; unrelated materials and smoke-like names are untouched',()=>{
  const f=fixture(), a=createCm07Ambient(f.roots);
  for(const elapsedSeconds of [NaN,Infinity,undefined])assert.throws(()=>a.update({elapsedSeconds}),/FINITE/);
  a.update({elapsedSeconds:-1});assert.equal(f.terrain.emissiveIntensity,1.2);a.dispose();
  const node={name:'volcano-smoke-unrelated',material:f.rock,castShadow:true};
  const other=createCm07Ambient([{visible:true,traverse(fn){fn(node);}}]);assert.equal(node.castShadow,true);other.dispose();
});
test('CM07 integrates once into existing render/dispose, excludes legacy lava and smoke hooks',()=>{
  const source=fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js',import.meta.url),'utf8');
  assert.equal((source.match(/cm07Ambient=createCm07Ambient/g)||[]).length,1);
  assert.ok(source.includes("instances.filter(i=>i.p.fieldId==='field_cm07_01').map(i=>i.object)"));
  assert.ok(source.includes("p.fieldId!=='field_cm07_01'&&(m.name?.includes('cm07')"));
  assert.ok(source.includes("p.fieldId!=='field_cm07_01'&&o.name&&o.name.startsWith('volcano-smoke')"));
  assert.ok(source.includes('visible:!covered,reducedMotion:prefersReducedMotion()'));
  assert.ok(source.indexOf('if(document.hidden)return true')<source.indexOf('cm07Ambient?.update'));
  assert.ok(source.indexOf('object.visible=x+')<source.indexOf('cm07Ambient?.update'));
  assert.ok(source.indexOf('cm07Ambient?.dispose()')<source.indexOf('renderer.dispose()'));
  const controller=fs.readFileSync(new URL('../src/championship/presentation/cm07Ambient.js',import.meta.url),'utf8');
  assert.doesNotMatch(controller,/requestAnimationFrame|setInterval|setTimeout|new THREE|onBeforeCompile/);
});
