import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cageGroundMapSpec,installCageGroundMap,CAGE_GROUND_VERTEX,CAGE_GROUND_FRAGMENT} from '../src/championship/presentation/cageGroundMap.js';

const R=fileURLToPath(new URL('../',import.meta.url)),B=R+'assets/production/cage/three-20261021/';
const glbJson=bytes=>{const n=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+n).toString('utf8'));};
const material=(name,extras,previous)=>({name,metalnessMap:{},userData:{...(extras?{cageGroundMap:extras}:{})},onBeforeCompile:previous,customProgramCacheKey:previous?()=>'authored-water-r1':undefined});
const root=materials=>({traverse(f){for(const m of materials)f({isMesh:true,material:m});}});
const spec={version:1,texture:2,bounds:[1,-7,16,8]};

test('ground map spec is validated before any hook is installed',()=>{
  assert.deepEqual(cageGroundMapSpec(material('a',spec)),{texture:2,bounds:[1,-7,16,8]});
  for(const bad of [null,{...spec,version:2},{...spec,texture:-1},{...spec,texture:1.5},{...spec,bounds:[1,2,3]},{...spec,bounds:[5,0,1,4]},{...spec,bounds:[0,0,1,NaN]}])
    assert.equal(cageGroundMapSpec(material('a',bad)),null);
});

test('hook chains an authored hook, keeps its cache key and installs once per material',()=>{
  const calls=[];
  const authored=material('field_cm09_01-baked',spec,function(shader){calls.push('authored');shader.vertexShader+='//authored';});
  const plain=material('field_cm02_01-baked',spec);
  const none=material('field_cm07_01-baked',null);
  const maps=new Map([[authored.name,{texture:{id:'t1'},bounds:spec.bounds}],[plain.name,{texture:{id:'t2'},bounds:spec.bounds}]]);
  assert.equal(installCageGroundMap(root([authored,plain,none,plain]),maps),2);
  assert.equal(installCageGroundMap(root([authored,plain]),maps),0);
  assert.equal(none.onBeforeCompile,undefined);
  const shader={uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\n}',fragmentShader:'void main(){\n#include <map_fragment>\n}'};
  authored.onBeforeCompile(shader,null);
  assert.deepEqual(calls,['authored']);
  assert.ok(shader.vertexShader.includes(CAGE_GROUND_VERTEX)&&shader.vertexShader.endsWith('//authored'));
  assert.ok(shader.fragmentShader.includes(CAGE_GROUND_FRAGMENT));
  assert.equal(shader.uniforms.uCageGroundMap.value.id,'t1');
  const b=shader.uniforms.uCageGroundBounds.value;
  assert.deepEqual([b.x,b.y],[1,-7]);assert.ok(Math.abs(b.z-1/15)<1e-12&&Math.abs(b.w-1/15)<1e-12);
  assert.equal(authored.customProgramCacheKey(),'authored-water-r1|cage-ground-map-v1');
});

test('a material without a metallic-roughness map is never hooked (no coverage mask)',()=>{
  const m=material('field_cm99_01-baked',spec);m.metalnessMap=null;
  assert.equal(installCageGroundMap(root([m]),new Map([[m.name,{texture:{},bounds:spec.bounds}]])),0);
});

test('fragment hook mixes by coverage and keeps the material tint, with no branch around the fetch',()=>{
  assert.match(CAGE_GROUND_FRAGMENT,/texture2D\( metalnessMap, vMetalnessMapUv \)\.r/);
  assert.match(CAGE_GROUND_FRAGMENT,/mix\( diffuseColor\.rgb, diffuse \* cageGroundColor, cageGroundCover \)/);
  assert.doesNotMatch(CAGE_GROUND_FRAGMENT,/\bif\s*\(/);
});

test('bundle: 32 cages carry a valid ground map; landforms and swatch-only floors keep the atlas',()=>{
  const manifest=JSON.parse(fs.readFileSync(B+'manifest.json','utf8'));
  const carrying=[],names=new Set();
  for(const f of manifest.fields){
    const g=glbJson(fs.readFileSync(B+f.fieldId+'.glb'));
    // The runtime keys loaded maps by material name across every placed cage.
    for(const m of g.materials??[]){assert.ok(!names.has(m.name),m.name);names.add(m.name);}
    const declared=(g.materials??[]).filter(m=>m.extras?.cageGroundMap);
    if(!declared.length)continue;
    carrying.push(f.fieldId);
    for(const m of declared){
      const s=m.extras.cageGroundMap;
      assert.equal(s.version,1);
      const tex=g.textures[s.texture];assert.ok(tex,f.fieldId);
      const img=g.images[tex.extensions?.EXT_texture_webp?.source??tex.source];
      assert.equal(img.mimeType,'image/webp');assert.equal(img.name,'ground-map');
      assert.ok(s.bounds[2]>s.bounds[0]&&s.bounds[3]>s.bounds[1]);
      assert.ok(m.pbrMetallicRoughness.metallicRoughnessTexture,'coverage mask channel');
    }
  }
  assert.equal(carrying.length,32);
  for(const id of ['field_cm07_01','field_cm20_01','field_cm21_01','field_cm28_01','field_cm35_01'])assert.ok(!carrying.includes(id),id);
});
