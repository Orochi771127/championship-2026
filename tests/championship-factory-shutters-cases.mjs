import test from 'node:test';
import assert from 'node:assert/strict';
import { factoryShutterSpec, createFactoryShutterMotion } from '../src/championship/presentation/vs2/huntFactoryShutters.js';
import { cutHuntDepthPieces, solidHuntDepthRegions } from '../src/championship/presentation/vs2/huntDepthOccluders.js';
const location = {hostname:'127.0.0.1',search:'?factoryShutters=r1'};
const field={fieldId:'field_hm10_01',depthOccluders:{}};
const spec=factoryShutterSpec(field,'art:hunt:original-opus:v1',location);
const portal=spec.portals[1];
const actor=(id,y,x=portal.x)=>Object.freeze({wildId:id,worldX:x,worldY:y});
const settle=(m,actors)=>{for(let i=0;i<20;i++)m.update(actors,20,'Factory');return m.snapshot()[1];};
test('only explicit loopback original factory candidate can bind; real entrances only',()=>{
 assert.equal(spec.portals.length,2);assert.deepEqual(spec.portals.map(p=>[p.x,p.anchorY]),[[256,1616],[1280,1040]]);
 for(const [f,a,l] of [[field,'art:hunt:licensed',location],[field,'art:hunt:original-opus:v1',{...location,hostname:'example.com'}],[{...field,fieldId:'field_hm11_01'},'art:hunt:original-opus:v1',location],[field,'art:hunt:original-opus:v1',{...location,search:''}]])assert.equal(factoryShutterSpec(f,a,l),null);
});
test('approach opens before crossing; deep occupancy releases then closes; exit reopens',()=>{
 const m=createFactoryShutterMotion(spec.portals);m.update([],0,'Factory');
 assert.equal(m.update([actor('a',1240)],40,'Factory')[1].phase,'OPENING');
 assert.equal(settle(m,[actor('a',1160)]).openness,1);
 assert.equal(settle(m,[actor('a',1090)]).phase,'OPEN');
 assert.equal(settle(m,[actor('a',1040)]).phase,'CLOSED');
 assert.equal(m.update([actor('a',1060)],16,'Factory')[1].openness,1);
 assert.equal(settle(m,[]).phase,'CLOSED');
});
test('all actors reserve the same entrance, including visible capture phase; removal cannot strand it',()=>{
 const m=createFactoryShutterMotion(spec.portals);
 const a=actor('a',1100),b={...actor('b',1110),state:'HAND_ANIMATION'};
 settle(m,[a,b]);assert.deepEqual(m.snapshot()[1].occupants,['a','b']);
 assert.equal(settle(m,[actor('a',1040),b]).phase,'OPEN');
 assert.equal(settle(m,[]).phase,'CLOSED');
});
test('reset, map change, long suspension and late arrival recover without clipping or stale claims',()=>{
 const m=createFactoryShutterMotion(spec.portals);settle(m,[actor('a',1200)]);m.reset();
 assert.equal(m.snapshot()[1].phase,'CLOSED');assert.deepEqual(m.snapshot()[1].occupants,[]);
 assert.equal(m.update([actor('a',1090)],0,'Factory')[1].openness,1);
 assert.equal(m.update([],5000,'Factory')[1].openness,0);
 assert.equal(m.update([],0,'AnotherGate')[1].phase,'CLOSED');
 assert.equal(m.update([actor('new',1100)],0,'Factory')[1].openness,1);
});
test('render-only sync never advances a half-open door or writes actor positions',()=>{
 const m=createFactoryShutterMotion(spec.portals),actors=Object.freeze([actor('a',1240)]);m.update([],0,'Factory');
 const s=m.update(actors,32,'Factory');for(let i=0;i<10;i++)assert.deepEqual(m.update(actors,0,'Factory'),s);
 assert.equal(actors[0].worldY,1240);
});
test('aperture subtraction preserves every non-aperture texel and its atlas mapping, depth and solidity',()=>{
 const original=[[10,20,20,16,50,70,99,2,1],[60,20,4,4,1,1,12,0,0]];
 const frozen=structuredClone(original);const cut={x:14,y:24,width:9,height:7};
 const result=cutHuntDepthPieces(original,[cut]);assert.deepEqual(original,frozen);
 const pixels=rows=>{const map=new Map();for(const [x,y,w,h,ax,ay,z,page,solid] of rows)for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const key=`${x+xx},${y+yy}`;assert.ok(!map.has(key));map.set(key,[ax+xx,ay+yy,z,page,solid]);}return map;};
 const want=pixels(original);for(let y=cut.y;y<cut.y+cut.height;y++)for(let x=cut.x;x<cut.x+cut.width;x++)want.delete(`${x},${y}`);
 assert.deepEqual(pixels(result),want);assert.equal(cutHuntDepthPieces(original),original);
 assert.throws(()=>cutHuntDepthPieces(original,[{x:0,y:0,width:-1,height:1}]),/CUTOUT_BOUNDS/);
});

test('portal backcap uses exact original texels and only changes solidity/depth inside its rectangle',()=>{
 const piece=[0,0,20,20,40,60,100,1,0],region={x:5,y:5,width:10,height:10,depth:120};
 const result=solidHuntDepthRegions([piece],[region]);let total=0;
 for(const [x,y,w,h,ax,ay,z,page,solid] of result){total+=w*h;assert.equal(ax-x,40);assert.equal(ay-y,60);assert.equal(page,1);
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const inside=xx>=5&&xx<15&&yy>=5&&yy<15;assert.equal(solid,inside?1:0);assert.equal(z,inside?120:100);}}
 assert.equal(total,400);assert.deepEqual(piece,[0,0,20,20,40,60,100,1,0]);
});

// These strips lie inside the two R3 lower walls, outside the old 192px cap.
test('R3 lower-wall gap repair stays local and leaves the original candidate untouched',()=>{
 assert.equal(spec.sideCapWidth,0);
 for(const assetId of ['art:hunt:factory-r3:20261008','art:hunt:final-intake:20261008','art:hunt:final-intake-night:20261008']){
  const s=factoryShutterSpec(field,assetId,{...location,search:'?factoryShutters=r3'});assert.equal(s.sideCapWidth,64);
  assert.deepEqual(s.cutouts.map(c=>[c.x,c.y,c.width,c.height]),[[200,1632,112,64],[1224,1056,112,64]]);
  assert.equal(factoryShutterSpec(field,assetId,{...location,hostname:'example.com',search:'?factoryShutters=r3'}),null);
 }
});
