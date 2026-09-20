import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cageHexFootprints} from '../scripts/lib/cage-authoring-geometry.mjs';
const receipt=JSON.parse(fs.readFileSync('docs/research/ranch-assembly-2026-09-06/native-geometry-receipt.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('docs/art/production/original-character-cage-r1/cage-base3d-v1/catalog.json','utf8'));
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;

test('all 37 active floors use original shape masks and exact native canvas',()=>{
  const result=cageHexFootprints();assert.equal(result.fields.length,37);
  for(const f of result.fields){
    const spec=catalog.fields.find(s=>s.id===f.fieldId);
    assert.deepEqual(f.nativeSize,spec.nativeSize);
    assert.equal(f.shapeMask,f.definitionIndex===36?1:receipt.maskTable.values[receipt.definitionShapes[f.definitionIndex]]);
    assert.equal(f.cells.length,f.shapeMask.toString(2).replaceAll('0','').length);
    assert.equal(area(f.outline),8448*f.cells.length);
    for(let i=0;i<f.outline.length;i++){
      const a=f.outline[i],b=f.outline[(i+1)%f.outline.length],dx=Math.abs(b[0]-a[0]),dy=Math.abs(b[1]-a[1]);
      assert.ok((dx===0&&dy===64)||(dx===48&&dy===24),'non-hex edge '+f.fieldId);
    }
  }
});
test('single cells have exactly six corners and no tile-envelope tabs',()=>{
  for(const f of cageHexFootprints().fields.filter(f=>f.cells.length===1)){
    assert.deepEqual(f.outline,[[0,24],[48,0],[96,24],[96,88],[48,112],[0,88]]);
  }
});
test('shared edges cancel while original bent and concave shapes remain',()=>{
  for(const f of cageHexFootprints().fields){
    const count=new Map();
    for(const c of f.cells)for(let i=0;i<6;i++){
      const key=JSON.stringify([c.polygon[i],c.polygon[(i+1)%6]].sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
      count.set(key,(count.get(key)||0)+1);
    }
    assert.equal([...count.values()].filter(n=>n===1).length,f.boundaryEdges.length);
    assert.ok([...count.values()].every(n=>n===1||n===2));
  }
  assert.equal(cageHexFootprints().fields.find(f=>f.fieldId==='field_cm10_01').cells.length,4);
});
