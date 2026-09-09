import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyNativeFoodFrame} from '../src/championship/raising/nativeRaisingCare.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {nativeRaisingFeast} from '../src/championship/raising/nativeRaisingFood.js';
const cpu=JSON.parse(readFileSync(new URL('../docs/research/RAISING_FEAST_CPU_CHECK_2026-09-09.json',import.meta.url)));
test('feast food types and all six producers match native CPU behavior',()=>{
  for(const v of cpu.bites){
    const r=applyNativeFoodFrame(nativeIndividualProfile(v.before),{generation:v.input.generation,satietyMaximum:8,animationFrame:1,
      food:{kind:v.input.kind,protein:v.input.protein,remaining:v.input.remaining,freshness:100,present:true}});
    assert.deepEqual(r.profile,nativeIndividualProfile(v.after),JSON.stringify(v.input));assert.equal(r.food.remaining,v.remaining);assert.equal(r.food.present,!!v.present);
  }
  for(const v of cpu.feasts)assert.deepEqual(nativeRaisingFeast(v.value).map(([kind,height])=>({kind,heightQ12:height*4096})),v.calls);
});
