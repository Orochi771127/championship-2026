import test from 'node:test';
import assert from 'node:assert/strict';
import {createRanchRaisingGround,ranchRaisingSpawnPosition,findRanchRaisingOpenTile} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {productGridCell,productFieldTileOrigin,PRODUCT_RANCH_GRID,productPlacementCells,validateProductRanch} from '../src/championship/cage/productRanchGrid.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {WAITING_ROOM_MODULE} from '../src/championship/cage/nativeRanchLayout.js';
import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';
import {nativeCarryPosition,stepNativeRaisingFlight} from '../src/championship/raising/nativeRaisingCarry.js';
const waiting={moduleId:WAITING_ROOM_MODULE,slotIndex:0};
const frame=(placements=[waiting],rows=[0,1,2,3,4,5,6,7,8,9])=>({layoutVersion:PRODUCT_RANCH_GRID,unlockedCount:20,placements,gridAccess:{version:1,legacyUnlockedSlots:Array.from({length:20},(_,i)=>i),purchasedRows:[],testUnlockedRows:rows}});
test('all legal facility anchors share terrain/art origin and spawn on their owning facility',()=>{
 let count=0;
 for(const d of listCageDefinitions())for(let slotIndex=0;slotIndex<100;slotIndex++){
  if(d.moduleId===WAITING_ROOM_MODULE)continue;
  const p={moduleId:d.moduleId,slotIndex};if(!validateProductRanch([waiting,p]))continue;
  const g=createRanchRaisingGround(frame([waiting,p]));
  assert.equal(g.pixelWidth,960);assert.equal(g.pixelHeight,880);
  const o=productFieldTileOrigin(slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[d.cageDefinitionIndex]);
  assert.deepEqual(g.origin(d.cageDefinitionIndex),[o.tileX*8,o.tileY*8,0]);
  const spawn=ranchRaisingSpawnPosition(g,d.cageDefinitionIndex,{next:()=>51});
  assert.equal(g.cageAt(spawn[0]/4096,spawn[1]/4096)?.definitionIndex,d.cageDefinitionIndex);
  assert.notEqual(g.readTerrain(Math.floor(spawn[0]/32768),Math.floor(spawn[1]/32768)),1);count++;
 }
 assert.ok(count>1000);
});
test('locked lower rows are not walkable; explicit test-row grant changes only access',()=>{
 const closed=createRanchRaisingGround(frame([waiting],[])),open=createRanchRaisingGround(frame());
 for(let slot=40;slot<50;slot++){
  const c=productGridCell(slot),x=(c.x+48)/8,y=(c.y+32)/8;
  assert.equal(closed.readTerrain(x,y),1);
 }
 assert.deepEqual(closed.placements,open.placements);
 assert.equal(closed.readTerrain(1,-1),1);assert.equal(open.readTerrain(1,110),1);
});
test('carry and landing retain lower-row coordinates instead of native150/160 clamps',()=>{
 const d=listCageDefinitions().find(d=>d.cageDefinitionIndex===0),g=createRanchRaisingGround(frame([waiting,{moduleId:d.moduleId,slotIndex:45}]));
 const p=ranchRaisingSpawnPosition(g,0,{next:()=>51});
 assert.ok(p[1]/4096>300);
 assert.ok(nativeCarryPosition({x:p[0]/4096,y:360},30,g)[1]/4096>300);
 const result=stepNativeRaisingFlight({positionQ12:p,velocityQ12:[0,0,0]},g,{rng:{next:()=>51}});
 assert.ok(result.positionQ12[1]/4096>300);
 const nearest=findRanchRaisingOpenTile(g,Math.floor(p[0]/32768),Math.floor(p[1]/32768),{centralBand:true});assert.ok(nearest.y>30);
});
test('horizontal copies query one owner and do not create placements',()=>{
 const g=createRanchRaisingGround(frame()),p=ranchRaisingSpawnPosition(g,35,{next:()=>51});
 for(let lap=-4;lap<=4;lap++)assert.equal(g.cageAt(p[0]/4096+960*lap,p[1]/4096)?.definitionIndex,35);
 assert.equal(g.placements.length,1);
});

test('native twenty-slot terrain outside the selected sports grounds and facility-local saved coordinates are preserved',async()=>{
 const {createNativeRaisingGround}=await import('../src/championship/raising/nativeRaisingGround.js');
 const {NATIVE_RANCH_LAYOUT,originalStartingRanch}=await import('../src/championship/cage/nativeRanchLayout.js');
 const placements=originalStartingRanch().placements;
 const native=createNativeRaisingGround({layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount:20,placements});
 const product=createRanchRaisingGround(frame(placements,[]));
 // Owner selected the new CM02/CM30 design and matching ground on 2026-10-21.
 // Only those owners may differ; every unrelated native cell remains exact.
 const sports=new Set([1,27]);
 for(let i=0;i<native.terrain.length;i++){
  const x=i%native.width*8,y=Math.floor(i/native.width)*8;
  if(sports.has(native.cageAt(x,y)?.definitionIndex)||sports.has(product.cageAt(x,y)?.definitionIndex))continue;
  assert.equal(product.terrain[i],native.terrain[i],`unrelated cell ${i}`);
 }
 const unchanged=placements.filter(p=>!sports.has(listCageDefinitions().find(d=>d.moduleId===p.moduleId).cageDefinitionIndex));
 assert.deepEqual(createRanchRaisingGround(frame(unchanged,[])).terrain.slice(0,native.terrain.length),
  createNativeRaisingGround({layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount:20,placements:unchanged}).terrain);
 for(const p of product.placements)assert.deepEqual(product.origin(p.definitionIndex),native.origin(p.definitionIndex));
 const d=listCageDefinitions().find(d=>d.cageDefinitionIndex===0);
 const lower=createRanchRaisingGround(frame([waiting,{moduleId:d.moduleId,slotIndex:45}]));
 const local=[32*4096,56*4096,0],origin=lower.origin(0);
 const restored=local.map((n,i)=>n+origin[i]*4096);
 assert.deepEqual(restored.map((n,i)=>n-origin[i]*4096),local);
 assert.equal(lower.cageAt(restored[0]/4096,restored[1]/4096)?.definitionIndex,0);
});

test('total-open count does not unlock native rank-gated columns',()=>{
 const f=frame([waiting],[2]);f.unlockedCount=24;f.mainUnlockedCount=14;f.gridAccess.legacyUnlockedSlots=Array.from({length:14},(_,i)=>i);
 const g=createRanchRaisingGround(f);
 for(const slot of [14,15,16,17,18,19,40,49]){const c=productGridCell(slot);assert.equal(g.readTerrain((c.x+48)/8,(c.y+32)/8),1);}
});
