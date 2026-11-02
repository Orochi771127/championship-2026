import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cageGroundMapSpec,installCageGroundMap,cageGroundWaterEdges,CAGE_GROUND_VERTEX,CAGE_GROUND_FRAGMENT,CAGE_GROUND_WATER_FRAGMENT} from '../src/championship/presentation/cageGroundMap.js';

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

// Owner 2026-11-02: the beaches' 10/06 showcase sea rides in the ground map's alpha.
const water={h0:.35,edges:[[1,2,3,4]]};
const compile=m=>{const shader={uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\n}',fragmentShader:'void main(){\n#include <map_fragment>\n}'};m.onBeforeCompile(shader,null);return shader;};

test('water spec: coast offset below the shoreline band and numeric edge spans, else dry',()=>{
  assert.deepEqual(cageGroundMapSpec(material('a',{...spec,water:{h0:.35,edges:[[1,2,3,4],[0,0,1,'x'],[1,2]]}})),{texture:2,bounds:[1,-7,16,8],water:{h0:.35,edges:[[1,2,3,4]]}});
  for(const bad of [{h0:0},{h0:.4},{h0:NaN},null,'sea'])
    assert.deepEqual(cageGroundMapSpec(material('a',{...spec,water:bad})),{texture:2,bounds:[1,-7,16,8]});
  assert.deepEqual(cageGroundWaterEdges(new Map([['a',{water}],['b',{water:null}],['c',{water:{h0:.35,edges:[[5,6,7,8]]}}]])),[[1,2,3,4],[5,6,7,8]]);
});

test('a water map draws the showcase sea on the shared clock; sparkles only when allowed',()=>{
  const time={value:3},pixel={value:.01};
  const calm=material('field_cm39_01-a',{...spec,water}),lively=material('field_cm39_01-b',{...spec,water});
  const maps=new Map([[calm.name,{texture:{id:'c'},bounds:spec.bounds,water}],[lively.name,{texture:{id:'l'},bounds:spec.bounds,water}]]);
  assert.equal(installCageGroundMap(root([calm]),maps,{time,pixel,sparkle:false}),1);
  assert.equal(installCageGroundMap(root([lively]),maps,{time}),1);
  const a=compile(calm),b=compile(lively);
  for(const s of [a,b]){
    assert.ok(s.fragmentShader.includes(CAGE_GROUND_WATER_FRAGMENT)&&!s.fragmentShader.includes(CAGE_GROUND_FRAGMENT));
    assert.equal(s.uniforms.uCageGroundTime,time);assert.equal(s.uniforms.uCageGroundH0.value,.35);
  }
  assert.equal(a.uniforms.uCageGroundPixel,pixel);assert.equal(b.uniforms.uCageGroundPixel.value,.004);
  assert.ok(!a.fragmentShader.includes('#define CAGE_GROUND_SPARKLE')&&b.fragmentShader.includes('#define CAGE_GROUND_SPARKLE'));
  assert.equal(calm.customProgramCacheKey(),'|cage-ground-map-v1|cage-ground-water-v1');
  assert.equal(lively.customProgramCacheKey(),'|cage-ground-map-v1|cage-ground-water-v1+sparkle');
  // A dry map keeps the exact pre-water program.
  const dry=material('field_cm02_01-dry',spec);
  installCageGroundMap(root([dry]),new Map([[dry.name,{texture:{},bounds:spec.bounds,water:null}]]),{time});
  assert.ok(compile(dry).fragmentShader.includes(CAGE_GROUND_FRAGMENT));
  assert.equal(dry.customProgramCacheKey(),'|cage-ground-map-v1');
});

test('water fragment fetches the map and reads the camera pixel size, with no branch',()=>{
  assert.match(CAGE_GROUND_WATER_FRAGMENT,/texture2D\( metalnessMap, vMetalnessMapUv \)\.r/);
  assert.match(CAGE_GROUND_WATER_FRAGMENT,/texture2D\( uCageGroundMap,/);
  assert.match(CAGE_GROUND_WATER_FRAGMENT,/vec2\( uCageGroundPixel \)/);
  assert.doesNotMatch(CAGE_GROUND_WATER_FRAGMENT,/fwidth/);
  assert.match(CAGE_GROUND_WATER_FRAGMENT,/mix\( diffuseColor\.rgb, diffuse \* cageGroundColor, cageGroundCover \)/);
  assert.doesNotMatch(CAGE_GROUND_WATER_FRAGMENT,/\bif\s*\(/);
});

test('bundle: 海灘 and 小海灘 carry the showcase water and its edge spans; no other cage does',()=>{
  const manifest=JSON.parse(fs.readFileSync(B+'manifest.json','utf8'));
  const wet=[];
  for(const f of manifest.fields){
    const g=glbJson(fs.readFileSync(B+f.fieldId+'.glb'));
    for(const m of g.materials??[]){
      const w=m.extras?.cageGroundMap?.water;
      if(!w)continue;
      wet.push(f.fieldId);
      assert.equal(w.h0,.35);
      assert.ok(w.edges.length>0&&w.edges.every(e=>e.length===4&&e.every(Number.isFinite)),f.fieldId);
      assert.ok(cageGroundMapSpec({userData:{cageGroundMap:m.extras.cageGroundMap}})?.water,f.fieldId);
    }
  }
  assert.deepEqual(wet.sort(),['field_cm09_01','field_cm39_01']);
});
