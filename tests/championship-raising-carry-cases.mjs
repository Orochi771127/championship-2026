import test from 'node:test';
import assert from 'node:assert/strict';
import source from '../docs/research/RAISING_CARRY_CPU_2026-09-10.json' with {type:'json'};
import {nativeCarryPosition,nativeCarryVelocity,stepNativeRaisingFlight} from '../src/championship/raising/nativeRaisingCarry.js';

test('carrying position and velocity match 27 original CPU samples',()=>{
  for(const c of source.carried){const p=nativeCarryPosition(c.pointer,c.height);
    assert.deepEqual(p,c.position);assert.deepEqual(nativeCarryVelocity(c.velocity,c.previous,p),c.output,JSON.stringify(c));}
});
test('flight friction bounce and obstruction branches match 96 original CPU samples',()=>{
  for(const c of source.flights){let calls=0;
    const ground={width:84,pixelWidth:672,owners:new Int16Array(84*25),readTerrain:()=>c.terrain};
    const actual=stepNativeRaisingFlight(c.input,ground,{findOpenTile(_g,x,y,options){calls++;assert.deepEqual({x,y},c.openCall);assert.equal(options.centralBand,true);return {x:15,y:12,distance:3};}});
    assert.deepEqual(actual,c.output,JSON.stringify(c.input));assert.equal(calls,c.openCall?1:0);}
});
