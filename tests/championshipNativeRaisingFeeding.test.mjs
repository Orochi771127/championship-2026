import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stepNativeRaisingMovement} from '../src/championship/raising/nativeRaisingMovement.js';
import {selectNativeFoodStation,nativeFoodStation,createNativeRaisingFood,stepNativeRaisingFood} from '../src/championship/raising/nativeRaisingFood.js';
import {createNativeRaisingGround,nativeCageOrigin,nativeRaisingSpawnPosition,nativeRaisingEntryPosition,findNativeRaisingOpenTile} from '../src/championship/raising/nativeRaisingGround.js';
import {composeOriginalRanchTilePlanes} from '../src/championship/cage/ranchTileComposition.js';
import {getCageDefinitionByModuleId} from '../src/championship/cage/cageCatalog.js';
import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';
import {nativePlacementMask} from '../src/championship/cage/nativeRanchLayout.js';
import {originalStartingRanch} from '../src/championship/cage/nativeRanchLayout.js';
const oracle=JSON.parse(fs.readFileSync(new URL('../docs/research/RAISING_FEEDING_CPU_CHECK_2026-09-08.json',import.meta.url)));
test('blocked entry repair equals complete original search, including boundary rows and fallback RNG',()=>{
  const g=oracle.openTileGround;
  for(const c of oracle.openTiles){const calls=[];const actual=findNativeRaisingOpenTile({width:g.width,height:g.height,
    readTerrain:(x,y)=>(c.terrain??g.terrain)[((y%g.height+g.height)%g.height)*g.width+(x%g.width+g.width)%g.width]},c.x,c.y,
    {centralBand:c.centralBand,rng:{next:channel=>{calls.push(['rng',channel]);return 51;}}});
    assert.deepEqual(actual,c.output,JSON.stringify(c));assert.deepEqual(calls,c.calls);
  }
});
test('entering all starting cages across 30 seeds never leaves a resident on blocked terrain',()=>{
  const g=createNativeRaisingGround({...originalStartingRanch(),unlockedCount:14});
  for(const p of g.placements)for(let seed=1;seed<=30;seed++){
    let r=seed;const v=nativeRaisingEntryPosition(g,p.definitionIndex,{next:()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r%103}},0);
    assert.notEqual(g.readTerrain(v[0]>>15,v[1]>>15),1,`${p.definitionIndex}:${seed}`);
  }
});
test('food station selection equals complete original OVL18 for 400 quadrants, ties and occupancy masks',()=>{
  for(const c of oracle.stations){
    const food={positionQ12:[409600,409600,0],occupants:Array.from({length:4},(_,i)=>c.occupied&(1<<i)?'occupied':null)};
    const index=selectNativeFoodStation(food,c.position);assert.equal(index,c.result,JSON.stringify(c));
    if(index>=0)assert.deepEqual(nativeFoodStation(food,index),c.target);
  }
});
test('food approach and blocked recovery match complete 02111A40 in all 64 oracle cases',()=>{
  for(const [i,c] of oracle.movement.entries()){
    const actual=stepNativeRaisingMovement(c.input,{readTerrain:()=>c.input.terrain,readClearance:()=>c.input.clearance,pixelWidth:672});
    for(const [key,value] of Object.entries(c.output))assert.deepEqual(actual[key],value,`case ${i} ${key}`);
  }
});
test('native ranch position projects egg relative 128,120 to world 128,96 and rejects outside ground',()=>{
  const ground=createNativeRaisingGround({...originalStartingRanch(),unlockedCount:14});
  assert.deepEqual(nativeCageOrigin(35,0),[0,-24,0]);
  assert.equal(ground.cageAt(128,96)?.definitionIndex,35);
  assert.equal(ground.cageAt(128,-1),null);assert.equal(ground.cageAt(128,192),null);
});
test('all 72 original source-clearance spawn probes preserve position and rejected-candidate RNG calls',()=>{
  for(const c of oracle.spawns){let cursor=0;const channels=[];
    const ground={placement:()=>({slotIndex:c.anchor})};
    const actual=nativeRaisingSpawnPosition(ground,c.definition,{next:channel=>{channels.push(['rng',channel]);return c.rolls[cursor++];}});
    assert.deepEqual(actual,c.positionQ12,`${c.definition}:${c.anchor}`);assert.deepEqual(channels,c.calls);
  }
});
test('functional terrain and membership exactly equal the original tile compositor for all four starting ranch sizes',()=>{
  const receipt=JSON.parse(fs.readFileSync(new URL('../docs/research/ranch-assembly-2026-09-06/native-compositor-receipt.json',import.meta.url)));
  const definitions=new Map(receipt.cases.flatMap(c=>c.steps).filter(s=>s.mode==='ordinary').map(s=>[s.definition,s]));
  const filler=receipt.cases.flatMap(c=>c.steps).find(s=>s.mode==='filler');
  for(const unlockedCount of [14,16,18,20]){
    const ranch={...originalStartingRanch(),unlockedCount},ground=createNativeRaisingGround(ranch);
    const occupied=ranch.placements.reduce((m,p)=>m|nativePlacementMask(p,unlockedCount),0);
    const steps=ranch.placements.map(p=>{const definitionIndex=getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex;
      return {...definitions.get(definitionIndex),definitionIndex,shapeIndex:ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex],anchor:p.slotIndex};});
    for(let i=0;i<unlockedCount;i++)if(!(occupied&(1<<i)))steps.push({...filler,anchor:i,definitionIndex:36});
    const expected=composeOriginalRanchTilePlanes({width:unlockedCount*6,steps:steps.map(s=>({...s,source:receipt.sources[s.fieldId]}))});
    assert.deepEqual([...ground.owners],[...expected.owners]);assert.deepEqual([...ground.clearance],[...expected.collision]);
    assert.deepEqual([...ground.terrain],[...expected.attributes].map(a=>a&1?1:a&2?2:a&4?3:0));
  }
});
test('food lands through original bounce updates and emits a search every 30 native ticks',()=>{
  const food=createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:[512000,278528,0]});
  const land=[],search=[];
  for(let i=1;i<=90;i++){const r=stepNativeRaisingFood(food,0);if(r.landed)land.push(i);if(r.search)search.push(i);}
  assert.deepEqual(land,[22]);assert.deepEqual(search,[30,60,90]);assert.equal(food.heightQ12,0);
});
