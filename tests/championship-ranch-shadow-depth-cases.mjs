import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import {createRanchGroundShadows,ranchShadowWorldPoint,ranchShadowScreenEllipses} from '../src/championship/presentation/ranchGroundShadows.js';
import {ranchWorldToNative,RANCH_ELEVATION} from '../src/championship/presentation/ranchThreeCoordinates.js';
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const bounds={x:20,y:-130},scale=2;
check('screen anchor invariant at flat, raised, panned and zoomed ground',()=>{
 for(const h of [0,.006,1.2,3.5])for(const s of [.7,2,5])for(const p of [{x:3,y:60},{x:280,y:900}]){
  const w=ranchShadowWorldPoint(p,bounds,s,h),n=ranchWorldToNative(w);
  assert.ok(Math.abs(n.x*s+bounds.x-p.x)<1e-10);assert.ok(Math.abs(n.y*s+bounds.y-p.y)<1e-10);assert.equal(w.y,h);
 }
});
const scene=new THREE.Scene(),manager=createRanchGroundShadows(scene);
const shadow={visible:true,renderable:true,worldAlpha:.8,toGlobal:p=>({x:100+p.x*2*.8,y:300+p.y*2*.8})};
const entry={shadow,root:{visible:true,threeGroundHeight:1.2},groundShadowEllipses:[{x:0,y:0,radiusX:20,radiusY:7},{x:9,y:0,radiusX:10,radiusY:5}]};
check('preserve hand-state scale and every authored contact ellipse',()=>{const e=ranchShadowScreenEllipses(shadow,entry.groundShadowEllipses);assert.equal(e.length,2);assert.equal(e[0].rx,32);assert.ok(Math.abs(e[0].ry-11.2)<1e-10);});
manager.reset();manager.sync('actor',entry,bounds,scale,true);manager.prune();
check('shadow shares scene with depth testing, never depth writes or actor override',()=>{
 assert.equal(scene.children.length,1);const m=scene.children[0].material;
 assert.equal(m.depthTest,true);assert.equal(m.depthWrite,false);assert.equal(m.transparent,true);assert.equal(m.opacity,1);
 assert.equal(m.uniforms.opacity.value,.26*.8);assert.equal(shadow.renderable,false);
 assert.match(m.fragmentShader,/coverage=max/);assert.match(m.fragmentShader,/discard/);
 assert.equal(scene.children[0].renderOrder,0);
});
check('ground plane sits below unchanged recovered actor support, preserving opaque depth occlusion',()=>{
 const mesh=scene.children[0];for(let i=0;i<4;i++)assert.ok(Math.abs(mesh.geometry.attributes.position.getY(i)-1.206)<1e-6);
 // Camera-ray distance decreases toward camera. An actor on the existing
 // support envelope .015 beats a shadow at .006 at the same screen sample;
 // floor below .006 loses. The actual renderer uses its normal depth test.
 const depth=h=>200-h/Math.sin(RANCH_ELEVATION);
 assert.ok(depth(1.215)<depth(1.206));assert.ok(depth(1.2)>depth(1.206));
 assert.ok(depth(2)<depth(1.206));
});
check('covered/evolution/untransferred actor restores Pixi and removes stale shadow',()=>{
 manager.reset();manager.sync('actor',entry,bounds,scale,false);manager.prune();assert.equal(shadow.renderable,true);assert.equal(scene.children.length,0);
});
check('hidden and invalid geometry do not suppress fallback',()=>{
 shadow.visible=false;manager.sync('actor',entry,bounds,scale,true);assert.equal(scene.children.length,0);shadow.visible=true;
 const e={...entry,groundShadowEllipses:[{x:NaN,y:0,radiusX:20,radiusY:7}]};manager.sync('actor',e,bounds,scale,true);assert.equal(shadow.renderable,true);
});
check('context-loss reset and dispose restore fallback, repeated lifetimes release geometry',()=>{
 manager.sync('actor',entry,bounds,scale,true);const mesh=scene.children[0];let geometryDisposed=false,materialDisposed=false;
 mesh.geometry.addEventListener('dispose',()=>geometryDisposed=true);mesh.material.addEventListener('dispose',()=>materialDisposed=true);
 manager.reset();assert.equal(shadow.renderable,true);assert.equal(mesh.visible,false);manager.dispose();assert.equal(scene.children.length,0);assert.ok(geometryDisposed&&materialDisposed);
});
check('integration keeps original actor support shader and alpha cutout unchanged',()=>{
 const text=fs.readFileSync(new URL('../src/championship/presentation/ranchThreeScene.js',import.meta.url),'utf8');
 assert.match(text,/alphaTest:\.15/);assert.match(text,/groundShadows.sync\(id,entry,bounds,pixelScale,sprites.get\(id\)\?\.seen===true\)/);
 assert.match(text,/groundShadows.prune\(\);\s*renderer.render/);assert.match(text,/if\(disposed\|\|lost\)\{groundShadows.reset/);
 assert.doesNotMatch(text,/depthTest\s*:\s*false/);
});
console.log(`${checks} scoped CPU checks passed; GPU/physical-phone acceptance remains required.`);
