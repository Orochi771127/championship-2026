import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveNativeTitleResult,createNativeTitleProgress,normalizeNativeTitleProgress,toggleNativeTitleRegistration,emptyNativeTitleProgress,applyNativeBattleRecord,nativeBattleWinPercent} from '../src/championship/battle/nativeTitleProgression.js';
const cpu=JSON.parse(readFileSync(new URL('../docs/research/TITLE_PROGRESSION_CPU_CHECK_2026-09-09.json',import.meta.url)));

test('aggregate battle record preserves unknown history, excludes network, caps counters, and retains original half-percent rounding',()=>{
  const fresh=createNativeTitleProgress(),legacy=emptyNativeTitleProgress();
  assert.deepEqual(applyNativeBattleRecord(legacy,{mode:1,won:true}),legacy);
  assert.deepEqual(applyNativeBattleRecord(fresh,{mode:3,won:true}),fresh);
  const won=applyNativeBattleRecord(fresh,{mode:1,won:true});assert.deepEqual(won.record,{battles:1,wins:1});
  assert.deepEqual(applyNativeBattleRecord({...fresh,record:{battles:9999,wins:9999}},{mode:0,won:true}).record,{battles:9999,wins:9999});
  for(const [wins,battles,percent] of [[0,0,null],[0,5,0],[1,8,12],[1,3,33],[2,3,67],[3,3,100]])assert.equal(nativeBattleWinPercent({wins,battles}),percent);
  for(const record of [{wins:2,battles:1},{wins:0,battles:10000},{wins:0,battles:-1},{wins:0,battles:1,extra:0}])assert.throws(()=>normalizeNativeTitleProgress({...fresh,record}));
});
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
