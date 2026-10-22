import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ranchBorderWithinSharedSegment,ranchBorderWithinSharedSegments} from '../src/championship/presentation/ranchBorderMembership.js';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-v4/cm07-border-fixtures.json',import.meta.url)));
let checked=0,hidden=0,preserved=0;
for(const c of f.cases)for(const n of f.nodes){
 const matched=f.allOuterEdges.filter(e=>ranchBorderWithinSharedSegment(n.points,e));
 assert.equal(matched.length,1,`${n.name}: exactly one authored border edge`);
 const expected=c.sharedEdges.some(e=>JSON.stringify(e)===JSON.stringify(matched[0]));
 assert.equal(ranchBorderWithinSharedSegments(n.points,c.sharedEdges),expected,`${c.left}/${c.right}/${n.name}`);
 // Three wrap copies share the same local classification, irrespective world translation.
 for(const shift of [-960,0,960]){
  const t={x:(c.left+shift)*2.3,z:(c.left-shift)*1.7};
  const recovered=n.points.map(p=>({x:(p.x+t.x)-t.x,z:(p.z+t.z)-t.z}));
  assert.equal(ranchBorderWithinSharedSegments(recovered,c.sharedEdges),expected);
 }
 checked++;expected?hidden++:preserved++;
}
const edge={a:{x:0,z:0},b:{x:4,z:0}};
assert.equal(ranchBorderWithinSharedSegments([{x:0,z:0},{x:4,z:0}],[edge]),true);
assert.equal(ranchBorderWithinSharedSegments([{x:-1,z:0},{x:4,z:0}],[edge]),false);
assert.equal(ranchBorderWithinSharedSegments([{x:0,z:0},{x:1,z:0}],[edge]),false);
assert.equal(ranchBorderWithinSharedSegments([{x:0,z:0},{x:4,z:.2}],[edge]),false);
assert.equal(ranchBorderWithinSharedSegments([{x:NaN,z:0},{x:4,z:0}],[edge]),false);
console.log(JSON.stringify({status:'PASS_LOCAL_NUMERIC_NOT_VISUAL',legalAdjacentPlacementPairs:f.cases.length,checked,hidden,preserved,wrapCopiesPerCheck:3}));
