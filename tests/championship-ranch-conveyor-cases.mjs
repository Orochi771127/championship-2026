import test from 'node:test';import assert from 'node:assert/strict';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {ranchConveyorAt,stepRanchConveyor} from '../src/championship/raising/ranchConveyor.js';
import {stepNativeRaisingMovement} from '../src/championship/raising/nativeRaisingMovement.js';
import surface from '../src/data/championship/catalogs/ranch-conveyor.r1.json' with {type:'json'};
const ground=()=>composeProductRanchGround({layoutVersion:'PRODUCT_GRID100_INSTANCES_V1',unlockedSlots:Array.from({length:100},(_,i)=>i),placements:[
 {moduleId:'championship:2026:cage:waiting-room',slotIndex:0,instanceId:'cage:waiting'},
 {moduleId:'championship:2026:cage:14',slotIndex:54,instanceId:'cage:factory'}]});
function standing(g){
 const origin=g.origin('cage:factory');
 for(const s of surface.surfaces.slice(5,11)){
  const p=[0,1].map(i=>(origin[i]+s.polygon.reduce((n,p)=>n+p[i],0)/s.polygon.length)*4096).concat(0).map(Math.round);
  if(g.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768))!==1)return {positionQ12:p,destinationQ12:[...p],state:1,foodSlot:null};
 }
 assert.fail('actual belt must contain a safe standing point');
}
test('actual Blender belt carries a standing partner and preserves ground contact',()=>{
 const g=ground(),a=standing(g),start=[...a.positionQ12];assert.ok(ranchConveyorAt(g,start));
 for(let i=0;i<120;i++)assert.equal(stepRanchConveyor(a,g),true);
 assert.ok(a.positionQ12[0]-start[0]>10*4096);assert.ok(a.positionQ12[1]>start[1]);
 assert.equal(a.positionQ12[2],0);assert.deepEqual(a.destinationQ12,a.positionQ12);
 assert.equal(g.cageAt(a.positionQ12[0]/4096,a.positionQ12[1]/4096).instanceId,'cage:factory');
});
test('walking can leave the belt and surface displacement stops immediately',()=>{
 const g=ground(),a=standing(g);a.state=2;a.mode=0;a.ticks=0;a.threshold=0;a.angleQ12=0;a.desiredAngleQ12=0;
 a.destinationQ12=[a.positionQ12[0],a.positionQ12[1]+25*4096,0];const destination=[...a.destinationQ12];
 let left=false;
 for(let i=0;i<120;i++){
  Object.assign(a,stepNativeRaisingMovement(a,g));stepRanchConveyor(a,g);
  if(!ranchConveyorAt(g,a.positionQ12)){left=true;break;}
 }
 assert.equal(left,true);assert.deepEqual(a.destinationQ12,destination);
 const before=[...a.positionQ12];assert.equal(stepRanchConveyor(a,g),false);assert.deepEqual(a.positionQ12,before);
});
test('rideable geometry continues along the full belt beyond the old 2D walking guide',()=>{
 const g=ground(),a=standing(g),start=[...a.positionQ12];
 for(let i=0;i<1600;i++)stepRanchConveyor(a,g);
 assert.ok(a.positionQ12[0]-start[0]>100*4096,'a hidden legacy boundary must not stop the belt midway');
 assert.notEqual(g.readTerrain(Math.floor(a.positionQ12[0]/32768),Math.floor(a.positionQ12[1]/32768)),1);
 assert.equal(g.cageAt(a.positionQ12[0]/4096,a.positionQ12[1]/4096).instanceId,'cage:factory');
});
test('carried, airborne, evolving and feeding actors remain with their existing controller',()=>{
 const g=ground();for(const patch of [{state:6},{state:7},{state:21},{evolution:{}},{foodSlot:0},{detached:true}]){
  const a={...standing(g),...patch},before=[...a.positionQ12];assert.equal(stepRanchConveyor(a,g),false);assert.deepEqual(a.positionQ12,before);
 }
 const a=standing(g);a.positionQ12[2]=4096;assert.equal(stepRanchConveyor(a,g),false);
});
test('belt never pushes through a blocker or out of its actual owning cage',()=>{
 for(const mode of ['wall','edge']){
  const original=ground(),a=standing(original),before=[...a.positionQ12];
  const g={...original,...(mode==='wall'?{readTerrain:()=>1}:{cageAt:(x,y)=>x<=before[0]/4096?original.cageAt(x,y):null})};
  assert.equal(stepRanchConveyor(a,g),false);assert.deepEqual(a.positionQ12,before);
 }
});
test('conveyor is restricted to the authorized product layout and actual belt polygon',()=>{
 const g=ground(),a=standing(g);assert.equal(stepRanchConveyor(a,{...g,layoutVersion:'NATIVE'}),false);
 a.positionQ12=g.origin('cage:factory').map(v=>v*4096);assert.equal(ranchConveyorAt(g,a.positionQ12),null);
});
