import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cageAuthoringGeometry } from '../scripts/lib/cage-authoring-geometry.mjs';
import { validateNativeRanch } from '../src/championship/cage/nativeRanchLayout.js';
const contract = JSON.parse(fs.readFileSync('docs/art/contracts/cage/field_cm01_01.v1.json','utf8'));

test('Cage authoring fixture locks existing inputs and cannot become a runtime manifest', () => {
  assert.equal(contract.fieldId,'field_cm01_01');
  assert.equal(contract.runtimeEligible,false);assert.equal(contract.shippingReady,false);
  for(const [file,expected] of Object.entries(contract.sourceLocks))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(),expected,file);
  assert.equal(contract.rules.runtimeObjectPass,false,'flattened runtime must not receive duplicate objects');
});
test('four bindings preserve source order and signed roots, separate from board/tile positions',()=>{
  assert.deepEqual(contract.core.size,[96,112]);
  assert.deepEqual(contract.objects.map(o=>[o.sequenceId,o.cellId,...o.placement,...o.pivot]),[
    [1,1,68,88,40,35],[2,2,62,17,19,56],[0,0,50,19,23,66],[3,3,84,22,9,44]]);
  assert.deepEqual(contract.objects.map(o=>o.placement.map((v,i)=>v-o.pivot[i])),[[28,53],[43,-39],[27,-47],[75,-22]]);
});
test('templates project existing native multi-cell, row crop, wrap and starting-ranch authorities',()=>{
  const {scenarios,...geometry}=cageAuthoringGeometry();assert.deepEqual(geometry,contract.geometry);
  for(const s of scenarios) assert.ok(validateNativeRanch(s.placements,14),s.id);
  const upper=scenarios[0].plan.placements.find(p=>p.fieldId==='field_cm01_01');
  const lower=scenarios[1].plan.placements.find(p=>p.fieldId==='field_cm01_01');
  assert.equal(upper.sourceRect.y,96);assert.equal(lower.sourceRect.y,0);
  assert.equal(scenarios[2].plan.placements.filter(p=>p.fieldId==='field_cm01_01').length,2);
  assert.equal(scenarios[3].plan.placements.length,4);
});
