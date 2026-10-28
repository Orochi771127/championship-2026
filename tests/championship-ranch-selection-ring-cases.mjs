// Lock-on ring as a ground decal (Owner 2026-10-28): centred on the contact
// shadow (the foot), sized by the body, in the 3D depth buffer below the actor
// billboards, and never on the Pixi canvas over a face.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import {RANCH_SELECTION_RING,ranchSelectionRingPlacement,createRanchSelectionRing} from '../src/championship/presentation/ranchSelectionRing.js';
import {ranchShadowWorldPoint} from '../src/championship/presentation/ranchGroundShadows.js';

const source=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
function fakeEntry({offset={x:200,y:300},radiusX=42,radiusY=12,visible=true}={}){
  const shadow={toGlobal:p=>({x:p.x+offset.x,y:p.y+offset.y})};
  return {shadow,groundShadowEllipses:[{x:0,y:3,radiusX,radiusY}],root:{visible:true,threeGroundHeight:0},
    selection:{visible,renderable:true,destroyed:false}};
}
const bounds={x:0,y:0,scale:1},pixelScale=2;

test('the ring is centred on the contact shadow and grows with the body',()=>{
  const small=ranchSelectionRingPlacement(fakeEntry(),bounds,pixelScale);
  const foot=ranchShadowWorldPoint({x:200,y:303},bounds,pixelScale,RANCH_SELECTION_RING.lift);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(small.center[axis]-foot[axis])<1e-9,axis);
  assert.ok(Math.abs(small.radius-42*RANCH_SELECTION_RING.radiusScale/pixelScale/16)<1e-9);
  const large=ranchSelectionRingPlacement(fakeEntry({radiusX:120}),bounds,pixelScale);
  assert.ok(large.radius>small.radius*2.5,'a large partner gets a large ring');
  assert.equal(ranchSelectionRingPlacement({...fakeEntry(),groundShadowEllipses:[]},bounds,pixelScale),null);
});

test('one pooled decal per selection: depth-tested, no depth write, above the shadow, Pixi ring hidden',()=>{
  const scene=new THREE.Scene(),ring=createRanchSelectionRing(scene),entry=fakeEntry();
  ring.reset();assert.ok(ring.sync('a',entry,bounds,pixelScale,true));ring.prune();
  const rows=ring.diagnostics();assert.equal(rows.length,1);
  assert.equal(rows[0].depthTest,true);assert.equal(rows[0].depthWrite,false);assert.equal(rows[0].renderOrder,RANCH_SELECTION_RING.renderOrder);
  assert.equal(entry.selection.renderable,false,'the flat Pixi ring is not drawn over the 3D body');
  const meshes=scene.children.filter(o=>o.name==='ranch-selection-ring');
  assert.equal(meshes.length,2,'floor ring and back glow');
  assert.ok(meshes.every(m=>m.material.transparent&&!m.material.depthWrite&&m.material.depthTest));
  assert.ok(Math.abs(meshes[0].position.y-RANCH_SELECTION_RING.lift)<1e-9,'between the shadow (+.006) and the actor floor (+.015)');
  // Not transferred to 3D, not selected: nothing drawn, the Pixi ring stays.
  const other=fakeEntry({visible:false});ring.reset();assert.equal(ring.sync('b',other,bounds,pixelScale,true),null);
  assert.equal(ring.sync('a',entry,bounds,pixelScale,false),null);ring.prune();
  assert.equal(entry.selection.renderable,true);assert.equal(scene.children.filter(o=>o.name==='ranch-selection-ring').length,0);
  ring.dispose();
});

test('the 3D scene syncs the ring with each actor; the Pixi fallback ring stays under the sprite with no dots',()=>{
  const scene=source('src/championship/presentation/ranchThreeScene.js');
  assert.match(scene,/groundShadows\.sync\(id,entry,bounds,pixelScale,sprites\.get\(id\)\?\.seen===true,view\);\s*selectionRing\.sync\(id,entry,bounds,pixelScale,sprites\.get\(id\)\?\.seen===true,view\);/);
  assert.match(scene,/disposed=true;groundShadows\.dispose\(\);selectionRing\.dispose\(\);/);
  const pixi=source('src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js');
  assert.match(pixi,/root\.addChild\(shadow, selection, fallback\);/);
  assert.match(pixi,/root\.addChildAt\(actor\.sprite, 2\);/,'sprite above shadow and ring');
  assert.doesNotMatch(pixi,/for\(const \[dx,dy\] of \[\[-1,0\],\[1,0\],\[0,-1\],\[0,1\]\]\)/,'no marker dots on the body');
  assert.match(pixi,/\.ellipse\(contact\.x,contact\.y,rx,ry\)/,'centred on the contact shadow');
});

test('ring shaders avoid GLSL ES 3.0 reserved words (a reserved name fails the compile on device)',()=>{
  const text=source('src/championship/presentation/ranchSelectionRing.js');
  const shaders=[...text.matchAll(/const [A-Z_]+_(?:VERTEX|FRAGMENT)=(`[\s\S]*?`|'[^']*');/g)].map(m=>m[1]);
  assert.equal(shaders.length,4);
  const reserved=/\b(half|fixed|input|output|sample|filter|sizeof|cast|namespace|using|common|partition|active|union|template|goto|inline|noinline|volatile|public|static|extern|external|interface|long|short|double|unsigned|superp|resource)\b/;
  for(const shader of shaders)assert.doesNotMatch(shader,reserved);
});
