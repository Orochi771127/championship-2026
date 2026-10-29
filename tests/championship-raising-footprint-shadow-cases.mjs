// Ranch contact shadow under the footprint (shadow audit 2026-10-30, 2,898 frames): the
// ellipse sits mostly behind the nearest foot at the 40-degree ground ratio, lying bodies stay
// shallow, hovering frames keep a smaller, lighter shadow on the ground, and the 3D shader fades it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getRaisingFootprintShadow,raisingFootprintRow,RAISING_FOOTPRINT} from '../src/championship/presentation/intRh2/raisingFootprintShadow.js';
import {RANCH_CONTACT_SHADOW_SOFT_CORE} from '../src/championship/presentation/ranchGroundShadows.js';
const table=JSON.parse(fs.readFileSync(new URL('../src/data/championship/raising-contact-footprints.v1.json',import.meta.url),'utf8'));
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('table rows are measured fractions within the drawn width',()=>{
  assert.equal(table.kind,'RAISING_CONTACT_FOOTPRINTS');assert.deepEqual(table.default,[0,.92]);
  assert.ok(table.rows.length>900);
  for(const [id,sequence,offset,lower] of table.rows){
    assert.match(id,/^species-\d{3}$/);assert.ok([0,2,3,13,14].includes(sequence));
    assert.ok(Math.abs(offset)<=.5,'centre stays inside the body');assert.ok(lower>0&&lower<=.92);
  }
  assert.deepEqual(raisingFootprintRow('species-999',0),[0,.92],'unmeasured species use the default');
  const [id,sequence,offset,lower]=table.rows[0];
  assert.deepEqual([...raisingFootprintRow('championship:creature:'+id,sequence)],[offset,lower]);
});

test('a standing body: the footprint is behind the nearest foot at the 40-degree ground ratio',()=>{
  const visible={x:-10,y:-30,width:20,height:30},s=getRaisingFootprintShadow('species-999',0,visible);
  assert.ok(Math.abs(RAISING_FOOTPRINT.ratio-Math.sin(40*Math.PI/180)*.86)<1e-12);
  assert.equal(s.radiusX,.46*20);assert.ok(Math.abs(s.radiusY-s.radiusX*RAISING_FOOTPRINT.ratio)<1e-12);
  assert.ok(s.y<0,'centre is behind (above) the lowest pixel');
  assert.ok(Math.abs(s.y+s.radiusY-RAISING_FOOTPRINT.front*s.radiusY)<1e-12,'only `front` of the depth shows in front of the feet');
  assert.equal(s.x,0);assert.equal(s.alpha,1);
});

test('a lying body stays shallow; a hovering frame keeps a smaller, lighter shadow on the ground',()=>{
  const lying=getRaisingFootprintShadow('species-999',13,{x:-50,y:-12,width:100,height:12});
  assert.equal(lying.radiusY,12*RAISING_FOOTPRINT.depthPerHeight,'depth capped by the drawn height');
  const tiny=getRaisingFootprintShadow('species-999',0,{x:-2,y:-3,width:4,height:3});
  assert.equal(tiny.radiusY,RAISING_FOOTPRINT.minDepth);
  const ground=getRaisingFootprintShadow('species-999',2,{x:-10,y:-30,width:20,height:30});
  const air=getRaisingFootprintShadow('species-999',2,{x:-10,y:-45,width:20,height:30});
  assert.ok(air.radiusX<ground.radiusX&&air.alpha<1);
  assert.ok(Math.abs(air.y+(1-RAISING_FOOTPRINT.front)*air.radiusY)<1e-12,'anchored to the ground (y = 0), not the body');
});

test('the measured centre offset follows the facing',()=>{
  const [id,seq]=table.rows.find(r=>Math.abs(r[2])>=.1);
  const visible={x:-10,y:-20,width:20,height:20},[offset]=raisingFootprintRow(id,seq);
  assert.ok(Math.abs(getRaisingFootprintShadow(id,seq,visible).x-offset*20)<1e-12);
  assert.ok(Math.abs(getRaisingFootprintShadow(id,seq,visible,true).x+offset*20)<1e-12);
  assert.equal(getRaisingFootprintShadow(id,seq,{x:0,y:0,width:0,height:5}),null);
});

test('the scene uses the footprint where no reviewed or egg contact exists, and the 3D shadow is soft',()=>{
  const pixi=source('src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js');
  assert.match(pixi,/geometry\.footprintShadow=getRaisingFootprintShadow\(entry\.speciesId,\s*entry\.nativeFramePresenter\?\.getSnapshot\(\)\?\.sequenceId,geometry\.visible,flipX\)/);
  assert.match(pixi,/const contact=geometry\.contactShadow\?\?geometry\.footprintShadow\?\?/);
  const three=source('src/championship/presentation/ranchGroundShadows.js');
  assert.match(three,/smoothstep\(\$\{RANCH_CONTACT_SHADOW_SOFT_CORE\.toFixed\(2\)\},1\.0\+edge,d\)/);
  assert.ok(RANCH_CONTACT_SHADOW_SOFT_CORE>0&&RANCH_CONTACT_SHADOW_SOFT_CORE<1);
});
