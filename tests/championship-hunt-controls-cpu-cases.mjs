import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {nativeWireIntersection} from '../src/championship/hunt/capture/nativeHuntWire.js';
import {stepNativeExplosionMotion} from '../src/championship/hunt/capture/nativeHuntExplosion.js';
import {nativeHuntRadarMask,nativeHuntRadarMatches,nativeHuntAnalyzedFields} from '../src/championship/hunt/loadout/nativeHuntPluginRules.js';
const cpu=JSON.parse(fs.readFileSync('reports/hunt-core-two-stage-2026-09-08/controls-cpu.json','utf8'));

test('all 15 radar plugins match all 228 original species under ARM',()=>{
  assert.equal(cpu.radarMatches.length,3420);
  for(const [species,index,mask,answer] of cpu.radarMatches){assert.equal(nativeHuntRadarMask([index]),mask);assert.equal(nativeHuntRadarMatches(species,mask),!!answer,`${species}:${index}`);}
});
test('analyzers preserve maximum HP, individual personality and least-significant family selection',()=>{
  const target={speciesIndex:34,personalityIndex:7,currentHp:90,maxHp:270};
  assert.deepEqual(nativeHuntAnalyzedFields(target,[]),{generation:'???',family:'???',alignment:'???',hp:'???',personality:'???',capacity:'???'});
  assert.deepEqual(nativeHuntAnalyzedFields(target,['GENERATION','FAMILY','ALIGNMENT','HP','PERSONALITY','CAPACITY']),
    {generation:'成長期',family:'龍',alignment:'疫苗',hp:'270',personality:'膽小',capacity:'14 G'});
});
test('wire clipping intersections match 400 original ARM calls including collinear points',()=>{
  for(const row of cpu.wireIntersections)assert.deepEqual(nativeWireIntersection(...row.points),row.result,JSON.stringify(row.points));
});
test('explosion motion, wall reflection, landing friction and snap thresholds match 240 ARM calls',()=>{
  for(const row of cpu.explosionMotions){
    const result=stepNativeExplosionMotion({...row,counter:77,explosionPhase:0},()=>row.blocked);
    const actual=Object.fromEntries(Object.keys(row.after).map(k=>[k,result[k]]));
    assert.deepEqual(actual,row.after,JSON.stringify(row));
  }
});
