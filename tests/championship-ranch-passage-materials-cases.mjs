import test from 'node:test';import assert from 'node:assert/strict';
import {withRanchPassages} from '../src/championship/presentation/ranchPassages.js';

test('invisible navigation retains field geometry and lifecycle without fetching or adding artwork',async()=>{
 const field={productGrid:true},displayObject={addChild(){assert.fail('invisible connections must not add artwork');}};
 let disposed=false;const dispose=()=>{disposed=true;};const update=()=>{};
 const art={field,displayObject,dispose,update,getDiagnostics:()=>({original:true})};
 const connections=[{route:[[4,4],[12,4]],cells:[0,1]}];const before=structuredClone(connections);
 const result=await withRanchPassages({art,connections});
 assert.equal(result.field,field);assert.equal(result.displayObject,displayObject);assert.equal(result.update,update);
 assert.deepEqual(connections,before);assert.deepEqual(result.getDiagnostics(),{original:true,ranchPassages:1,ranchPassageAppearance:'invisible'});
 result.dispose();assert.equal(disposed,true);
});
