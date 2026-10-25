import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getProductExtension,isKnownProductSpecies,requirePlayableProductExtension,resolveProductSpeciesDefinition,planUltimateDisplayOrder} from '../src/championship/contracts/productSpeciesExtensions.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const records=read('./base-species.json').records, display=read('./base-display.json').entries;
const frozen=JSON.stringify(records), oldDisplay=JSON.stringify(display);
for(let i=0;i<228;i++)assert.deepEqual(resolveProductSpeciesDefinition(i,records),records[i]);
assert.equal(isKnownProductSpecies(228,records),false);
assert.throws(()=>resolveProductSpeciesDefinition(228,records),/SENTINEL/);
for(const id of [229,230]){
 assert.equal(isKnownProductSpecies(id,records),true);
 assert.equal(requirePlayableProductExtension(id).speciesIndex,id);
 assert.equal(getProductExtension(id).networkReady,true);
 assert.equal(resolveProductSpeciesDefinition(id,records).recordIndex,id);
 const candidate=resolveProductSpeciesDefinition(id,records,{allowUnready:true});
 assert.equal(candidate.recordIndex,id);assert.equal(candidate.lookupKey,getProductExtension(id).entityId);
 assert.notEqual(candidate.lookupKey,records[getProductExtension(id).baseSpeciesIndex].lookupKey);
}
for(const id of [-1,232,2.5,NaN,'229'])assert.equal(isKnownProductSpecies(id,records),false);
const planned=planUltimateDisplayOrder(display),byCode=new Map(planned.map(x=>[x.displayCode,x.speciesIndex]));
assert.equal(planned.length,39);assert.equal(new Set(planned.map(x=>x.speciesIndex)).size,39);
assert.deepEqual(['UL02','UL03','UL33','UL34'].map(x=>byCode.get(x)),[222,230,211,229]);
const before=display.filter(x=>x.numberingStageIndex===6&&![211,222].includes(x.speciesIndex)).sort((a,b)=>a.serial-b.serial).map(x=>x.speciesIndex);
const after=planned.filter(x=>![211,222,229,230].includes(x.speciesIndex)).map(x=>x.speciesIndex);
assert.deepEqual(after,before);assert.equal(JSON.stringify(records),frozen);assert.equal(JSON.stringify(display),oldDisplay);
console.log('PASS: 228 native identities unchanged; sentinel excluded; two distinct production extensions; fixed UL02/03/33/34; remaining relative order unchanged; no input mutation.');
