// Ground decals on the visible floor (Owner 2026-11-03): the sports field's grass
// and track sit a few hundredths above the walk height and hid the selection ring.
// Shadows and rings follow such thin sheets; props, walking and actor depth do not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import {RANCH_DECAL_FLOOR,createRanchDecalFloorGrid,ranchDecalFloorHeight} from '../src/championship/presentation/ranchDecalFloor.js';
import {RANCH_SELECTION_RING,ranchSelectionRingPlacement,createRanchSelectionRing,createRanchBloodlineRings} from '../src/championship/presentation/ranchSelectionRing.js';
import {createRanchGroundShadows,ranchShadowWorldPoint} from '../src/championship/presentation/ranchGroundShadows.js';
import {ranchViewProjection,RANCH_VIEW_PITCHES} from '../src/championship/presentation/ranchThreeCoordinates.js';

const source=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('raising a decal onto a sheet never moves it on screen, at every ranch pitch',()=>{
  // Owner asked (2026-11-03) whether the shadow moved down: through the real camera it does not.
  for(const pitch of RANCH_VIEW_PITCHES){
    const view=ranchViewProjection(pitch),camera=new THREE.OrthographicCamera(-20,20,20,-20,.1,600);
    camera.up.set(...view.up);camera.position.set(...view.direction).multiplyScalar(200);camera.lookAt(0,0,0);
    camera.updateMatrixWorld();camera.updateProjectionMatrix();
    const at=height=>{const w=ranchShadowWorldPoint({x:300,y:420},{x:0,y:0},2,height,view);return new THREE.Vector3(w.x,w.y,w.z).project(camera);};
    for(const height of [.006,.028+.006,.06+.009]){
      const a=at(0),b=at(height);
      assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9,`pitch ${pitch}, height ${height}`);
    }
  }
});
// A floor quad (two triangles) from x0..x1, z0..z1 at height y.
function quad(x0,x1,z0,z1,y){return [x0,y,z0, x1,y,z0, x1,y,z1, x0,y,z0, x1,y,z1, x0,y,z1];}
function model(...quads){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(quads.flat(),3));
  const root=new THREE.Group();root.add(new THREE.Mesh(geometry));return root;
}
// Base floor at 0, a grass/track sheet at .028 over x 2..6, a bench top at .3 over x 7..8.
const field=model(quad(0,10,0,10,0),quad(2,6,2,6,.028),quad(7,8,2,3,.3));
const grid=createRanchDecalFloorGrid(field);

test('a decal over a thin sheet follows it; over plain floor it keeps the walk height',()=>{
  const placed=[{grid,offset:{x:0,y:0,z:0}}];
  assert.equal(ranchDecalFloorHeight(placed,4,4,0,.5),.028);
  assert.equal(ranchDecalFloorHeight(placed,.6,9.4,0,.5),0);
  // The footprint reaching onto the sheet is enough: a ring is never cut by its edge.
  assert.equal(ranchDecalFloorHeight(placed,1.8,4,0,.5),.028);
  assert.equal(ranchDecalFloorHeight(placed,1.1,4,0,.5),0);
});

test('props taller than maxRise never lift a decal, and a higher walk height wins',()=>{
  const placed=[{grid,offset:{x:0,y:0,z:0}}];
  assert.ok(.3>RANCH_DECAL_FLOOR.maxRise);
  assert.equal(ranchDecalFloorHeight(placed,7.5,2.5,0,.4),0,'a bench beside the partner is not floor');
  assert.equal(ranchDecalFloorHeight(placed,7.5,2.5,.28,.4),.3,'standing on the bench, its top is the floor');
  assert.equal(ranchDecalFloorHeight(placed,4,4,.1,.5),.1,'a sheet below the walk height is ignored');
});

test('placed copies are offset in world space and far cages are skipped',()=>{
  const placed=[{grid,offset:{x:100,y:0,z:-50}},{grid,offset:{x:0,y:.5,z:0}}];
  assert.equal(ranchDecalFloorHeight(placed,104,-46,0,.5),.028);
  assert.equal(ranchDecalFloorHeight(placed,4,4,.5,.5),.528,'a raised placement adds its height');
  assert.equal(ranchDecalFloorHeight([],4,4,0,.5),0);
  assert.equal(createRanchDecalFloorGrid(new THREE.Group()).bounds,null);
});

test('shadow, selection ring and bloodline ring sit on the decal height, screen position unchanged',()=>{
  const entry=(threeDecalHeight)=>({shadow:{visible:true,worldAlpha:1,renderable:true,destroyed:false,toGlobal:p=>({x:p.x+200,y:p.y+300})},
    groundShadowEllipses:[{x:0,y:3,radiusX:42,radiusY:12}],root:{visible:true,threeGroundHeight:0,threeDecalHeight},
    selection:{visible:true,renderable:true,destroyed:false}});
  const bounds={x:0,y:0,scale:1},pixelScale=2,low=ranchSelectionRingPlacement(entry(undefined),bounds,pixelScale);
  const high=ranchSelectionRingPlacement(entry(.028),bounds,pixelScale);
  assert.ok(Math.abs(high.center.y-(.028+RANCH_SELECTION_RING.lift))<1e-9);
  assert.ok(Math.abs(low.center.y-RANCH_SELECTION_RING.lift)<1e-9,'no decal height: the walk height as before');
  assert.deepEqual(high.screen,low.screen,'the ring stays under the same foot on screen');
  const scene=new THREE.Scene(),ring=createRanchSelectionRing(scene),blood=createRanchBloodlineRings(scene,{getBloodline:()=>({ring:0xffcc33,family:'gold'})});
  const shadows=createRanchGroundShadows(scene),e=entry(.028);
  ring.sync('a',e,bounds,pixelScale,true);blood.sync('a',e,bounds,pixelScale,true);shadows.sync('a',e,bounds,pixelScale,true);
  const named=name=>scene.children.find(o=>o.name===name);
  assert.ok(Math.abs(named('ranch-selection-ring').position.y-(.028+RANCH_SELECTION_RING.lift))<1e-9);
  assert.ok(Math.abs(named('ranch-bloodline-ring').position.y-(.028+.008))<1e-9);
  const shadow=scene.children.find(o=>o.isMesh&&!o.name);
  assert.ok(Array.from({length:4},(_,i)=>shadow.geometry.attributes.position.getY(i)).every(y=>Math.abs(y-(.028+.006))<1e-6),'Float32 shadow corners');
  ring.dispose();blood.dispose();shadows.dispose();
});

test('the ranch scene measures every placed cage and sets the decal height before drawing decals',()=>{
  const scene=source('src/championship/presentation/ranchThreeScene.js');
  assert.match(scene,/decalFloors\.push\(\{grid:decalFloorGrids\.get\(p\.fieldId\),offset:object\.position\}\)/);
  assert.match(scene,/syncDecalHeight\(entry,bounds,pixelScale\);\n\s*groundShadows\.sync\(/);
  // Walking and the actor's depth keep the walk height.
  assert.doesNotMatch(scene.slice(scene.indexOf('function syncSprite'),scene.indexOf('function syncDecalHeight')),/threeDecalHeight/);
});
