import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveNativeTitleResult,createNativeTitleProgress,normalizeNativeTitleProgress,toggleNativeTitleRegistration} from '../src/championship/battle/nativeTitleProgression.js';
const cpu=JSON.parse(readFileSync(new URL('../docs/research/TITLE_PROGRESSION_CPU_CHECK_2026-09-09.json',import.meta.url)));
test('all 600 original CPU result and rank-commit vectors match',()=>{
  assert.equal(cpu.vectors.length,600);
  for(const [index,v] of cpu.vectors.entries())assert.deepEqual(resolveNativeTitleResult(v.input),v.output,`CPU vector ${index}`);
});
test('new-player registrations toggle without a fee and reject won or locked titles',()=>{
  const start=createNativeTitleProgress();assert.deepEqual(start.registered,[4,8]);
  const off=toggleNativeTitleRegistration(start,{recordIndex:4,rank:0});assert.deepEqual(off.registered,[8]);
  assert.deepEqual(toggleNativeTitleRegistration(off,{recordIndex:4,rank:0}),start);
  assert.equal(toggleNativeTitleRegistration(start,{recordIndex:4,rank:0,won:[4]}),null);
  assert.equal(toggleNativeTitleRegistration(start,{recordIndex:61,rank:9}),null);
  for(const registered of [[4,4],[-1],[61],['4'],Array(1)])assert.throws(()=>normalizeNativeTitleProgress({...start,registered}));
});
