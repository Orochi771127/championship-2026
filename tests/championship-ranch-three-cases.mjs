import test from 'node:test';
import assert from 'node:assert/strict';
import {ranchNativeToWorld,ranchWorldToNative,RANCH_ELEVATION,ranchSurfaceHeight,ranchPickWalkSurface,ranchSpriteScreenQuad,ranchSpriteUvs} from '../src/championship/presentation/ranchThreeCoordinates.js';
import {alignRanchRaisingPosition,composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {PRODUCT_RANCH_GRID} from '../src/championship/cage/productRanchGrid.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
test('fixed camera ground mapping preserves native navigation and wrapping coordinates',()=>{
  for(const x of [-960,0,48,240,960,1920])for(const y of [-24,0,112,880]){
    const point=ranchWorldToNative(ranchNativeToWorld(x,y));
    assert.ok(Math.abs(point.x-x)<1e-9);assert.ok(Math.abs(point.y-y)<1e-9);
  }
});
test('saved eggs inside a moved prop recover inside the same cage; valid points stay identical',()=>{
  const defs=listCageDefinitions(),ground=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,
    unlockedSlots:Array.from({length:100},(_,i)=>i),placements:[
      {moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:waiting'},
      {moduleId:defs[6].moduleId,slotIndex:24,instanceId:'cage:test'}]});
  const blocked=Array.from(ground.terrain.keys()).find(i=>ground.owners[i]===1&&ground.terrain[i]===1);
  assert.ok(Number.isInteger(blocked));
  const original=[(blocked%ground.width*8+4)*4096,(Math.floor(blocked/ground.width)*8+4)*4096,0];
  const aligned=alignRanchRaisingPosition(ground,original,'cage:test');
  assert.notDeepEqual(aligned,original);
  assert.equal(ground.cageAt(aligned[0]/4096,aligned[1]/4096).instanceId,'cage:test');
  assert.notEqual(ground.readTerrain(Math.floor(aligned[0]/32768),Math.floor(aligned[1]/32768)),1);
  assert.equal(alignRanchRaisingPosition(ground,aligned,'cage:test'),aligned);
  assert.equal(alignRanchRaisingPosition({layoutVersion:'NATIVE_RANCH'},original,'cage:test'),original);
});
test('height projects upward without shifting contact x or altering ground geometry',()=>{
  const ground=ranchWorldToNative(ranchNativeToWorld(123,456));
  const raised=ranchWorldToNative(ranchNativeToWorld(123,456,2));
  assert.equal(raised.x,ground.x);
  assert.ok(Math.abs(ground.y-raised.y-32*Math.cos(RANCH_ELEVATION))<1e-9);
});
test('model placement is translation only and preserves lengths and right angles',()=>{
  const p=ranchNativeToWorld(384,176),v=[1,2,3],w=[-2,1,0];
  const translate=a=>a.map((n,i)=>n+[p.x,p.y,p.z][i]);
  const a=translate(v),b=translate(w),o=translate([0,0,0]);
  assert.ok(Math.abs(a.reduce((s,n,i)=>s+(n-o[i])*(b[i]-o[i]),0))<1e-10);
  assert.ok(Math.abs(Math.hypot(...a.map((n,i)=>n-o[i]))-Math.hypot(...v))<1e-10);
});
test('walk surfaces interpolate stairs and raised platforms without treating a roof as ground',()=>{
 const triangles=[[[0,0,.2],[10,0,.2],[0,10,1.2]]];
 assert.ok(Math.abs(ranchSurfaceHeight(2,3,triangles)-.5)<1e-9);
 assert.equal(ranchSurfaceHeight(20,20,triangles),0);
 assert.equal(ranchSurfaceHeight(2,3,[]),0);
});
test('trimmed 2D sprite keeps its rendered size, mirror and top-origin atlas frame in 3D',()=>{
 const sprite={visualBounds:{minX:-20,minY:-30,maxX:12,maxY:4},
   getBounds(){assert.fail('512px untrimmed canvas is not the rendered quad');},
   toGlobal:({x,y})=>({x:100-x*2,y:200+y*2})};
 assert.deepEqual(ranchSpriteScreenQuad(sprite),{x:76,y:140,width:64,height:68});
 const u={x0:.1,y0:.2,x1:.3,y1:.2,x2:.3,y2:.4,x3:.1,y3:.4};
 assert.deepEqual(ranchSpriteUvs(u,false),[.1,.2,.3,.2,.1,.4,.3,.4]);
 assert.deepEqual(ranchSpriteUvs(u,true),[.3,.2,.1,.2,.3,.4,.1,.4]);
});
test('pointer picking on an elevated platform returns its ground coordinate rather than the floor behind it',()=>{
 const triangles=[[[0,0,2],[10,0,2],[0,10,2]]];
 const picked=ranchPickWalkSurface(2,3-32*Math.cos(RANCH_ELEVATION),triangles);
 assert.ok(Math.abs(picked.y-3)<1e-9);assert.equal(picked.height,2);assert.equal(picked.x,2);
 assert.deepEqual(ranchPickWalkSurface(20,20,triangles),{x:20,y:20,height:0});
});
