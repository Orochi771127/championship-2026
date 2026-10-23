import fs from 'node:fs';import assert from 'node:assert/strict';
const candidate=JSON.parse(fs.readFileSync('tests/hm02-three-review/catalog/hm02-expansion-candidate.json','utf8'));
const base=JSON.parse(fs.readFileSync('src/data/championship/catalogs/hunt-scene.r1.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('tests/hm02-three-review/catalog/native-candidate-tests.json','utf8'));
const expand=r=>r.flatMap(([count,value])=>Array(count).fill(value));let checks=0;
assert.deepEqual(Object.keys(candidate.environments).sort(),['field_hm02_01','field_hm02_02']);
for(const [id,c]of Object.entries(candidate.environments)){
 const b=base.environments[id];assert.equal(c.width,180);assert.equal(c.height,180);assert.deepEqual(c.base,{widthTiles:128,heightTiles:128,originTile:[0,0]});
 for(const key of ['terrainRuns','directionRuns']){const old=expand(b[key]),next=expand(c[key]);assert.equal(next.length,32400);for(let y=0;y<128;y++)for(let x=0;x<128;x++){if(key==='directionRuns'&&next[y*180+x]!==old[y*128+x]){assert(x===127||y===127);assert(provenance[id].boundary_direction_exceptions.some(([a,b])=>a===x&&b===y));}else assert.equal(next[y*180+x],old[y*128+x],`${id}:${key}:${x},${y}`);checks++;}}
 assert.deepEqual(c.directionPalette.slice(0,b.directionPalette.length),b.directionPalette);assert.equal(c.caveGroups.flatMap(g=>g.caves).length,3);
}
console.log(JSON.stringify({status:'PASS',nativeCellChecks:checks,directionBoundaryPolicy:'only documented x127/y127 expansion seams may differ; interior direction and all terrain preserved',selection:'read-only fixture; production catalog not replaced',HM01HM08:'not in candidate'}));
